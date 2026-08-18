import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import {
  FundingAnalystProvider,
  InputSnapshot,
  AnalysisResponse,
  FundingAnalysisResultSchema,
} from './fundingAnalystProvider';
import { EvidenceCatalogBuilder } from './evidenceCatalogBuilder';

export class OpenAiFundingAnalystProvider implements FundingAnalystProvider {
  private client: OpenAI | null = null;
  private model: string;
  private timeoutMs: number;
  private maxTokens: number;
  private isEnabled: boolean;

  constructor() {
    this.isEnabled = process.env.AI_FUNDING_ANALYST_ENABLED === 'true';
    const apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-5.6-luna';
    this.timeoutMs = Number(process.env.OPENAI_TIMEOUT_MS) || 30000;
    this.maxTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) || 2500;

    if (this.isEnabled && apiKey) {
      this.client = new OpenAI({
        apiKey,
        timeout: this.timeoutMs,
        maxRetries: 0, // Disable automatic retries to prevent duplicate calls
      });
    }
  }

  public isConfigured(): boolean {
    const isEnabled = process.env.AI_FUNDING_ANALYST_ENABLED === 'true';
    return Boolean(isEnabled && this.client);
  }

  public getModelName(): string {
    return this.model;
  }

  public async analyze(snapshot: InputSnapshot): Promise<AnalysisResponse> {
    const isEnabled = process.env.AI_FUNDING_ANALYST_ENABLED === 'true';
    if (!isEnabled || !this.client) {
      throw new Error('AI_ANALYST_NOT_CONFIGURED: AI Funding Analyst service is disabled or OPENAI_API_KEY is not configured.');
    }

    try {
      const response = await this.client.responses.parse({
        model: this.model,
        input: [
          { role: 'system', content: EvidenceCatalogBuilder.getSystemPrompt() },
          { role: 'user', content: `IMMUTABLE INPUT SNAPSHOT & EVIDENCE CATALOG:\n${JSON.stringify(snapshot, null, 2)}` },
        ],
        text: {
          format: zodTextFormat(FundingAnalysisResultSchema, 'funding_analysis_result'),
        },
        max_output_tokens: this.maxTokens,
      });

      // Check refusal or empty output
      let refusal: string | null = null;
      if (Array.isArray(response.output)) {
        for (const item of response.output) {
          if ((item as any).type === 'refusal') {
            refusal = (item as any).refusal || 'Model refused request';
            break;
          }
        }
      }

      if (refusal) {
        throw new Error(`OpenAI Provider Refusal: ${refusal}`);
      }

      const parsedResult = response.output_parsed;
      if (!parsedResult) {
        throw new Error('OpenAI returned empty or unparsable response output.');
      }

      // Re-validate against strict Zod schema & evidence references
      const validatedResult = FundingAnalysisResultSchema.parse(parsedResult);
      if (snapshot.promptVersion === EvidenceCatalogBuilder.GROUNDED_PROMPT_VERSION) {
        EvidenceCatalogBuilder.validateGroundedEvidenceRefs(validatedResult, snapshot.evidenceCatalog);
      } else {
        EvidenceCatalogBuilder.validateEvidenceRefs(validatedResult, snapshot.evidenceCatalog);
      }

      return {
        result: validatedResult,
        meta: {
          provider: 'OPENAI',
          model: this.model,
          promptVersion: snapshot.promptVersion || EvidenceCatalogBuilder.PROMPT_VERSION,
          providerResponseId: response.id || undefined,
          inputTokenCount: response.usage?.input_tokens,
          outputTokenCount: response.usage?.output_tokens,
          rawRefusal: refusal,
        },
      };
    } catch (err: any) {
      if (err.message?.includes('AI_ANALYST_NOT_CONFIGURED') || err.message?.includes('OpenAI Provider Refusal')) {
        throw err;
      }
      throw new Error(`OpenAI Provider Error: ${err.message || 'Upstream LLM invocation failed'}`);
    }
  }
}
