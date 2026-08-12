import { z } from 'zod';

export const GrantsGovSearchHitSchema = z.object({
  id: z.union([z.string(), z.number()]),
  number: z.string().optional(),
  title: z.string().optional(),
  agency: z.string().optional(),
  agencyCode: z.string().optional(),
  openDate: z.string().optional(),
  closeDate: z.string().optional(),
  oppStatus: z.string().optional(),
  docType: z.string().optional(),
  alnNumber: z.string().optional(),
});

export const GrantsGovSearchResponseSchema = z.object({
  opportunityHits: z.array(GrantsGovSearchHitSchema).optional(),
  hitCount: z.number().optional(),
  totalCount: z.number().optional(),
});

export const GrantsGovDetailResponseSchema = z.object({
  oppId: z.union([z.string(), z.number()]).optional(),
  opportunityId: z.union([z.string(), z.number()]).optional(),
  opportunityNumber: z.string().optional(),
  opportunityTitle: z.string().optional(),
  agencyName: z.string().optional(),
  agencyCode: z.string().optional(),
  description: z.string().optional(),
  synopsisDescription: z.string().optional(),
  postDate: z.string().optional(),
  closeDate: z.string().optional(),
  archiveDate: z.string().optional(),
  awardFloor: z.union([z.string(), z.number()]).optional(),
  awardCeiling: z.union([z.string(), z.number()]).optional(),
  estimatedTotalProgramFunding: z.union([z.string(), z.number()]).optional(),
  fundingInstruments: z.array(z.string()).optional(),
  eligibleApplicants: z.array(z.string()).optional(),
  additionalInformationOnEligibility: z.string().optional(),
  alnNumbers: z.array(z.string()).optional(),
  status: z.string().optional(),
  opportunityStatus: z.string().optional(),
  lastUpdatedDate: z.string().optional(),
});
