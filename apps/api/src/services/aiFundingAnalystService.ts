import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import {
  FundingAnalystProvider,
  InputSnapshot,
} from './ai/fundingAnalystProvider';
import { OpenAiFundingAnalystProvider } from './ai/openAiFundingAnalystProvider';
import { EvidenceCatalogBuilder } from './ai/evidenceCatalogBuilder';
import { AuthService } from './authService';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

export class AiFundingAnalystService {
  private static providerOverride: FundingAnalystProvider | null = null;
  private static defaultProvider: OpenAiFundingAnalystProvider = new OpenAiFundingAnalystProvider();
  
  // In-memory rate limiting and idempotency maps
  private static rateLimitMap = new Map<string, RateLimitRecord>();
  private static idempotencyMap = new Map<string, Promise<any>>();

  public static setProvider(provider: FundingAnalystProvider): void {
    AiFundingAnalystService.providerOverride = provider;
  }

  public static resetProvider(): void {
    AiFundingAnalystService.providerOverride = null;
    AiFundingAnalystService.clearRateLimits();
  }

  public static clearRateLimits(): void {
    AiFundingAnalystService.rateLimitMap.clear();
    AiFundingAnalystService.idempotencyMap.clear();
  }

  public static getActiveProvider(): FundingAnalystProvider {
    return AiFundingAnalystService.providerOverride || AiFundingAnalystService.defaultProvider;
  }

  public static isConfigured(): boolean {
    if (AiFundingAnalystService.providerOverride) return true;
    return AiFundingAnalystService.defaultProvider.isConfigured();
  }

  public static getConfigurationStatus() {
    const isMock = Boolean(AiFundingAnalystService.providerOverride);
    const provider = isMock ? 'MOCK_OPENAI' : 'OPENAI';
    const isConfigured = AiFundingAnalystService.isConfigured();
    const model = isMock ? 'gpt-5.6-luna' : AiFundingAnalystService.defaultProvider.getModelName();

    return {
      enabled: isConfigured,
      provider,
      model,
      promptVersion: EvidenceCatalogBuilder.PROMPT_VERSION,
    };
  }

  private static checkRateLimit(userId: string): void {
    const now = Date.now();
    const windowMs = 60000; // 1 minute
    const maxRequests = 5;

    const record = AiFundingAnalystService.rateLimitMap.get(userId);
    if (!record || now > record.resetTime) {
      AiFundingAnalystService.rateLimitMap.set(userId, { count: 1, resetTime: now + windowMs });
      return;
    }

    if (record.count >= maxRequests) {
      throw new Error(`RATE_LIMIT_EXCEEDED: Maximum ${maxRequests} AI evaluations per minute per user. Please wait before generating another analysis.`);
    }

    record.count += 1;
  }

  public static async generateEvaluation(params: {
    opportunityId: string;
    userId: string;
    idempotencyKey?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<any> {
    const { opportunityId, userId, idempotencyKey, ipAddress, userAgent } = params;

    // Idempotency check to prevent concurrent duplicate model calls
    const cacheKey = idempotencyKey ? `idem_${opportunityId}_${idempotencyKey}` : null;
    if (cacheKey && AiFundingAnalystService.idempotencyMap.has(cacheKey)) {
      return await AiFundingAnalystService.idempotencyMap.get(cacheKey)!;
    }

    const executionPromise = (async () => {
      // 1. Check rate limit
      AiFundingAnalystService.checkRateLimit(userId);

      // 2. Fetch authoritative records from PostgreSQL
      const opp = await prisma.fundingOpportunity.findUnique({
        where: { id: opportunityId },
      });
      if (!opp) {
        throw new Error('Funding opportunity not found');
      }

      const orgProfile = await prisma.organizationProfile.findFirst({
        include: { programs: true },
      });

      // 3. Build snapshot and hash
      const snapshot: InputSnapshot = EvidenceCatalogBuilder.buildSnapshot(opp, orgProfile);
      const inputHash = EvidenceCatalogBuilder.hashSnapshot(snapshot);

      // 4. Call provider
      const activeProvider = AiFundingAnalystService.getActiveProvider();
      const response = await activeProvider.analyze(snapshot);
      const { result, meta } = response;

      // 5. Versioning check
      const lastEval = await prisma.aiEvaluation.findFirst({
        where: { opportunityId },
        orderBy: { version: 'desc' },
      });
      const nextVersion = lastEval ? lastEval.version + 1 : 1;

      // 6. Atomic persistence
      const evaluation = await prisma.aiEvaluation.create({
        data: {
          opportunityId,
          version: nextVersion,
          status: 'GENERATED',
          alignmentScore: result.alignmentScore,
          eligibility: result.eligibility as any,
          summary: result.summary,
          strengths: result.strengths as any,
          risks: result.risks as any,
          requirements: result.requirements as any,
          recommendedNextAction: result.recommendedNextAction,
          confidence: result.confidence,
          limitations: result.limitations,
          evidenceSnapshot: snapshot.evidenceCatalog as any,
          inputSnapshot: snapshot as any,
          inputHash,
          provider: meta.provider,
          model: meta.model,
          promptVersion: meta.promptVersion,
          providerResponseId: meta.providerResponseId || null,
          inputTokenCount: meta.inputTokenCount || null,
          outputTokenCount: meta.outputTokenCount || null,
          generatedByUserId: userId,
        },
        include: {
          generatedByUser: {
            select: { id: true, displayName: true, email: true, role: true },
          },
        },
      });

      // 7. Audit log
      await AuthService.logSecurityEvent({
        userId,
        eventType: 'AI_EVALUATION_GENERATED',
        ipAddress,
        userAgent,
        details: JSON.stringify({
          evaluationId: evaluation.id,
          opportunityId,
          version: nextVersion,
          alignmentScore: result.alignmentScore,
          eligibility: result.eligibility,
          provider: meta.provider,
          model: meta.model,
        }),
      });

      return evaluation;
    })();

    if (cacheKey) {
      AiFundingAnalystService.idempotencyMap.set(cacheKey, executionPromise);
      // Clean up cacheKey after 1 minute
      setTimeout(() => AiFundingAnalystService.idempotencyMap.delete(cacheKey), 60000);
    }

    try {
      return await executionPromise;
    } catch (err) {
      if (cacheKey) AiFundingAnalystService.idempotencyMap.delete(cacheKey);
      throw err;
    }
  }

  public static async getEvaluationsForOpportunity(opportunityId: string): Promise<any[]> {
    return await prisma.aiEvaluation.findMany({
      where: { opportunityId },
      orderBy: { version: 'desc' },
      include: {
        generatedByUser: {
          select: { id: true, displayName: true, email: true, role: true },
        },
        reviewedByUser: {
          select: { id: true, displayName: true, email: true, role: true },
        },
      },
    });
  }

  public static async reviewEvaluation(params: {
    evaluationId: string;
    userId: string;
    decision: 'APPROVED' | 'REJECTED';
    reason: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<any> {
    const { evaluationId, userId, decision, reason, ipAddress, userAgent } = params;

    if (!reason || reason.trim().length < 5) {
      throw new Error('A detailed human review reason (minimum 5 characters) is required.');
    }

    const evaluation = await prisma.aiEvaluation.findUnique({
      where: { id: evaluationId },
    });

    if (!evaluation) {
      throw new Error('AI Evaluation not found');
    }

    if (evaluation.status !== 'GENERATED') {
      throw new Error(`AI Evaluation has already been reviewed with status '${evaluation.status}'. Reviews are immutable.`);
    }

    const updated = await prisma.aiEvaluation.update({
      where: { id: evaluationId },
      data: {
        status: decision,
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewReason: reason.trim(),
      },
      include: {
        generatedByUser: {
          select: { id: true, displayName: true, email: true, role: true },
        },
        reviewedByUser: {
          select: { id: true, displayName: true, email: true, role: true },
        },
      },
    });

    const auditEventType = decision === 'APPROVED' ? 'AI_EVALUATION_APPROVED' : 'AI_EVALUATION_REJECTED';
    await AuthService.logSecurityEvent({
      userId,
      eventType: auditEventType,
      ipAddress,
      userAgent,
      details: JSON.stringify({
        evaluationId: evaluation.id,
        opportunityId: evaluation.opportunityId,
        version: evaluation.version,
        decision,
        reason: reason.trim(),
      }),
    });

    return updated;
  }
}
