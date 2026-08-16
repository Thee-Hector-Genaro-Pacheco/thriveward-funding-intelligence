import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
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
    return Boolean(this.isEnabled && this.client);
  }

  public getModelName(): string {
    return this.model;
  }

  public async analyze(snapshot: InputSnapshot): Promise<AnalysisResponse> {
    if (!this.isEnabled || !this.client) {
      throw new Error('AI_ANALYST_NOT_CONFIGURED: AI Funding Analyst service is disabled or OPENAI_API_KEY is not configured.');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: EvidenceCatalogBuilder.getSystemPrompt() },
          { role: 'user', content: `IMMUTABLE INPUT SNAPSHOT & EVIDENCE CATALOG:\n${JSON.stringify(snapshot, null, 2)}` },
        ],
        response_format: zodResponseFormat(FundingAnalysisResultSchema, 'funding_analysis_result'),
        max_tokens: this.maxTokens,
      });

      const choice = completion.choices[0];
      if (!choice) {
        throw new Error('OpenAI returned empty completion choices.');
      }

      if (choice.message.refusal) {
        throw new Error(`OpenAI Provider Refusal: ${choice.message.refusal}`);
      }

      const content = choice.message.content;
      if (!content) {
        throw new Error('OpenAI returned empty response content.');
      }

      const parsedResult = FundingAnalysisResultSchema.parse(JSON.parse(content));

      // Validate evidence references against snapshot catalog
      EvidenceCatalogBuilder.validateEvidenceRefs(parsedResult, snapshot.evidenceCatalog);

      return {
        result: parsedResult,
        meta: {
          provider: 'OPENAI',
          model: this.model,
          promptVersion: snapshot.promptVersion || EvidenceCatalogBuilder.PROMPT_VERSION,
          providerResponseId: completion.id || undefined,
          inputTokenCount: completion.usage?.prompt_tokens,
          outputTokenCount: completion.usage?.completion_tokens,
          rawRefusal: choice.message.refusal || null,
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
