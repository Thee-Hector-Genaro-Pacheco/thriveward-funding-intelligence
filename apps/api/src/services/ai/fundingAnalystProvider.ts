import { z } from 'zod';

export const StrengthItemSchema = z.object({
  text: z.string().min(1).max(500),
  evidenceRefs: z.array(z.string()).min(1).max(10),
});

export const RiskItemSchema = z.object({
  text: z.string().min(1).max(500),
  evidenceRefs: z.array(z.string()).min(1).max(10),
});

export const RequirementItemSchema = z.object({
  requirement: z.string().min(1).max(500),
  status: z.enum(['MET', 'NOT_MET', 'UNKNOWN']),
  evidenceRefs: z.array(z.string()).min(1).max(10),
});

export const AiEligibilityRatingSchema = z.enum([
  'LIKELY_ELIGIBLE',
  'POSSIBLY_ELIGIBLE',
  'UNLIKELY_ELIGIBLE',
  'INSUFFICIENT_INFORMATION',
]);

export const FundingAnalysisResultSchema = z.object({
  alignmentScore: z.number().int().min(0).max(100),
  eligibility: AiEligibilityRatingSchema,
  summary: z.string().min(10).max(2000),
  strengths: z.array(StrengthItemSchema).min(0).max(15),
  risks: z.array(RiskItemSchema).min(0).max(15),
  requirements: z.array(RequirementItemSchema).min(0).max(25),
  recommendedNextAction: z.string().min(5).max(1000),
  confidence: z.number().min(0).max(1),
  limitations: z.array(z.string().min(1).max(500)).min(0).max(15),
});

export type StrengthItem = z.infer<typeof StrengthItemSchema>;
export type RiskItem = z.infer<typeof RiskItemSchema>;
export type RequirementItem = z.infer<typeof RequirementItemSchema>;
export type AiEligibilityRating = z.infer<typeof AiEligibilityRatingSchema>;
export type FundingAnalysisResult = z.infer<typeof FundingAnalysisResultSchema>;

export interface EvidenceCatalogItem {
  id: string;
  category: 'OPPORTUNITY' | 'ORGANIZATION' | 'DOCUMENT_RETRIEVED';
  label: string;
  value: string;
}

export interface InputSnapshot {
  opportunity: {
    id: string;
    title: string;
    fundingAgency: string;
    fundingOpportunityNumber?: string | null;
    sourceSystem: string;
    officialSourceUrl?: string | null;
    description: string;
    candidateRoutingStatus?: string | null;
    pursuitStage: string;
    createdAt: string;
  };
  organization: {
    name: string;
    status: string;
    taxStatus: string;
    mission: string;
    primaryPopulations: string[];
    primaryOutcome: string;
    coreModel: string;
    limitations: string[];
    programs: Array<{ name: string; description: string; isOperational: boolean }>;
  };
  evidenceCatalog: EvidenceCatalogItem[];
  promptVersion: string;
}

export interface ProviderOutputMeta {
  provider: string;
  model: string;
  promptVersion: string;
  providerResponseId?: string;
  inputTokenCount?: number;
  outputTokenCount?: number;
  rawRefusal?: string | null;
}

export interface AnalysisResponse {
  result: FundingAnalysisResult;
  meta: ProviderOutputMeta;
}

export interface FundingAnalystProvider {
  isConfigured(): boolean;
  getProviderName(): string;
  getModelName(): string;
  analyze(snapshot: InputSnapshot): Promise<AnalysisResponse>;
}
