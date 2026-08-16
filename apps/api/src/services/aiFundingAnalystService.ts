import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import {
  FundingAnalystProvider,
  InputSnapshot,
} from './ai/fundingAnalystProvider';
import { OpenAiFundingAnalystProvider } from './ai/openAiFundingAnalystProvider';
import { EvidenceCatalogBuilder } from './ai/evidenceCatalogBuilder';
import { AuthService } from './authService';

export class AiFundingAnalystService {
  private static providerOverride: FundingAnalystProvider | null = null;
  private static defaultProvider: OpenAiFundingAnalystProvider = new OpenAiFundingAnalystProvider();
  
  // In-flight active generation lock map to prevent concurrent duplicate model invocations
  private static idempotencyMap = new Map<string, Promise<any>>();

  public static setProvider(provider: FundingAnalystProvider): void {
    AiFundingAnalystService.providerOverride = provider;
  }

  public static resetProvider(): void {
    AiFundingAnalystService.providerOverride = null;
    AiFundingAnalystService.clearRateLimits();
  }

  public static clearRateLimits(): void {
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

  private static async checkHourlyRateLimit(userId: string): Promise<void> {
    const maxPerHour = Number(process.env.AI_EVALUATION_RATE_LIMIT_PER_HOUR) || 5;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const count = await prisma.aiEvaluation.count({
      where: {
        generatedByUserId: userId,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (count >= maxPerHour) {
      const oldestEval = await prisma.aiEvaluation.findFirst({
        where: {
          generatedByUserId: userId,
          createdAt: { gte: oneHourAgo },
        },
        orderBy: { createdAt: 'asc' },
      });

      const retryMs = oldestEval ? oldestEval.createdAt.getTime() + 60 * 60 * 1000 - Date.now() : 60 * 60 * 1000;
      const retryMins = Math.max(1, Math.ceil(retryMs / 60000));

      throw new Error(`RATE_LIMIT_EXCEEDED: Maximum ${maxPerHour} AI evaluations per hour per user. Please wait ${retryMins} minute(s) before generating another evaluation.`);
    }
  }

  public static async generateEvaluation(params: {
    opportunityId: string;
    userId: string;
    idempotencyKey?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<any> {
    const { opportunityId, userId, idempotencyKey, ipAddress, userAgent } = params;

    // 1. Durable Database-Backed Idempotency Check (Survives process restarts, user-scoped)
    if (idempotencyKey) {
      const existing = await prisma.aiEvaluation.findFirst({
        where: {
          generatedByUserId: userId,
          opportunityId,
          idempotencyKey,
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

      if (existing) {
        return existing;
      }
    }

    // 2. In-Flight Active Generation Lock (Prevents concurrent duplicate LLM invocations)
    const lockKey = `${userId}_${opportunityId}_${idempotencyKey || 'default'}`;
    if (AiFundingAnalystService.idempotencyMap.has(lockKey)) {
      return await AiFundingAnalystService.idempotencyMap.get(lockKey)!;
    }

    const executionPromise = (async () => {
      // 3. Hourly Rate Limit Check (5 per hour per user default)
      await AiFundingAnalystService.checkHourlyRateLimit(userId);

      // 4. Fetch authoritative records from PostgreSQL
      const opp = await prisma.fundingOpportunity.findUnique({
        where: { id: opportunityId },
      });
      if (!opp) {
        throw new Error('Funding opportunity not found');
      }

      const orgProfile = await prisma.organizationProfile.findFirst({
        include: { programs: true },
      });

      // 5. Build snapshot and hash
      const snapshot: InputSnapshot = EvidenceCatalogBuilder.buildSnapshot(opp, orgProfile);
      const inputHash = EvidenceCatalogBuilder.hashSnapshot(snapshot);

      // 6. Call provider
      const activeProvider = AiFundingAnalystService.getActiveProvider();
      const response = await activeProvider.analyze(snapshot);
      const { result, meta } = response;

      // 7. Versioning check
      const lastEval = await prisma.aiEvaluation.findFirst({
        where: { opportunityId },
        orderBy: { version: 'desc' },
      });
      const nextVersion = lastEval ? lastEval.version + 1 : 1;

      // 8. Atomic persistence in PostgreSQL with idempotencyKey
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
          idempotencyKey: idempotencyKey || null,
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

      // 9. Audit log
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
          idempotencyKey,
        }),
      });

      return evaluation;
    })();

    AiFundingAnalystService.idempotencyMap.set(lockKey, executionPromise);

    try {
      const res = await executionPromise;
      return res;
    } catch (err) {
      throw err;
    } finally {
      AiFundingAnalystService.idempotencyMap.delete(lockKey);
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

  public static async getEvaluationWithProvenance(evaluationId: string) {
    const evaluation = await prisma.aiEvaluation.findUnique({
      where: { id: evaluationId },
      include: {
        generatedByUser: { select: { id: true, displayName: true, email: true, role: true } },
        reviewedByUser: { select: { id: true, displayName: true, email: true, role: true } },
        recoveryRecords: true,
      },
    });

    if (!evaluation) return null;

    let recoveryNotice: string | null = null;
    if (evaluation.recoveryRecords.length > 0) {
      const rec = evaluation.recoveryRecords[0];
      recoveryNotice = `Recovery provenance: This evaluation's persistence row was reconstructed after an automated-test cleanup deleted its original opportunity relationship. The saved evaluation content, provider response metadata, input snapshot, and input hash remain preserved. Original opportunity ID at generation: ${rec.originalOpportunityId}.`;
    }

    return {
      ...evaluation,
      recoveryNotice,
    };
  }
}

