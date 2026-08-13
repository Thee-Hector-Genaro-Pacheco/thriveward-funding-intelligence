import { prisma } from '../lib/prisma';
import { OpportunityStatus, PursuitStage, RelevanceStatus, CandidateRoutingStatus, Prisma } from '@prisma/client';

export interface OpportunityQueryOptions {
  status?: string;
  fundingType?: string;
  minimumFitScore?: number;
  dataKind?: string;
  sourceSystem?: string;
  verificationStatus?: string;
  pursuitStage?: string;
  relevanceStatus?: string;
  candidateRoutingStatus?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const opportunityIncludeObject = {
  fundingSource: true,
  eligibilityRequirements: true,
  allowableCostItems: true,
  requiredDocuments: true,
  scoringCriteria: true,
  sourceCitations: true,
  opportunityAnalyses: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  relevanceAnalyses: {
    where: { isCurrent: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
  pursuitHistory: {
    orderBy: { createdAt: 'desc' as const },
  },
};

export class OpportunityService {
  /**
   * List funding opportunities with validated filtering and pagination.
   */
  static async listOpportunities(options: OpportunityQueryOptions): Promise<PaginatedResult<any>> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.FundingOpportunityWhereInput = {};

    // Filter by dataKind (demo vs official)
    if (options.dataKind) {
      const kind = options.dataKind.toLowerCase();
      if (kind === 'demo') {
        where.isDemo = true;
      } else if (kind === 'official') {
        where.isDemo = false;
      } else {
        throw new Error(`Invalid dataKind parameter: '${options.dataKind}'. Allowed values: 'demo', 'official'`);
      }
    }

    // Filter by pursuitStage
    if (options.pursuitStage) {
      const stageUpper = options.pursuitStage.toUpperCase();
      if (stageUpper === 'NEEDS_ANALYSIS') {
        where.pursuitStage = { in: ['NEW', 'REVIEWING'] };
      } else if (Object.values(PursuitStage).includes(stageUpper as PursuitStage)) {
        where.pursuitStage = stageUpper as PursuitStage;
      } else {
        throw new Error(`Invalid pursuitStage parameter: '${options.pursuitStage}'. Allowed values: ${Object.values(PursuitStage).join(', ')}, NEEDS_ANALYSIS`);
      }
    }

    // Filter by relevanceStatus
    if (options.relevanceStatus) {
      const relUpper = options.relevanceStatus.toUpperCase();
      if (Object.values(RelevanceStatus).includes(relUpper as RelevanceStatus)) {
        where.relevanceAnalyses = {
          some: {
            isCurrent: true,
            relevanceStatus: relUpper as RelevanceStatus,
          },
        };
      } else {
        throw new Error(`Invalid relevanceStatus parameter: '${options.relevanceStatus}'. Allowed values: ${Object.values(RelevanceStatus).join(', ')}`);
      }
    }

    // Filter by candidateRoutingStatus
    if (options.candidateRoutingStatus) {
      const routingUpper = options.candidateRoutingStatus.toUpperCase();
      if (routingUpper === 'POTENTIAL_PATHWAYS') {
        where.candidateRoutingStatus = {
          in: ['FISCAL_SPONSOR_REQUIRED', 'PARTNERSHIP_REQUIRED', 'FUTURE_OPPORTUNITY'] as CandidateRoutingStatus[],
        };
      } else if (['DIRECT_FEDERAL_ELIGIBLE', 'FISCAL_SPONSOR_REQUIRED', 'PARTNERSHIP_REQUIRED', 'FUTURE_OPPORTUNITY', 'EXCLUDED'].includes(routingUpper)) {
        where.candidateRoutingStatus = routingUpper as CandidateRoutingStatus;
      } else {
        throw new Error(`Invalid candidateRoutingStatus parameter: '${options.candidateRoutingStatus}'. Allowed values: POTENTIAL_PATHWAYS, DIRECT_FEDERAL_ELIGIBLE, FISCAL_SPONSOR_REQUIRED, PARTNERSHIP_REQUIRED, FUTURE_OPPORTUNITY, EXCLUDED`);
      }
    }

    // Exclude IRRELEVANT / EXCLUDED opportunities from active candidates feed unless explicitly requested
    if (options.pursuitStage === 'DISMISSED' && !options.candidateRoutingStatus) {
      where.candidateRoutingStatus = {
        in: ['FISCAL_SPONSOR_REQUIRED', 'PARTNERSHIP_REQUIRED', 'FUTURE_OPPORTUNITY'] as CandidateRoutingStatus[],
      };
    } else if (options.pursuitStage !== 'DISMISSED' && options.relevanceStatus !== 'IRRELEVANT' && !options.candidateRoutingStatus) {
      where.OR = [
        { candidateRoutingStatus: null },
        { candidateRoutingStatus: { not: 'EXCLUDED' as CandidateRoutingStatus } },
      ];
      where.NOT = {
        relevanceAnalyses: {
          some: {
            isCurrent: true,
            relevanceStatus: 'IRRELEVANT',
          },
        },
      };
    }

    // Filter by sourceSystem (e.g. GRANTS_GOV, DEMO_FIXTURE)
    if (options.sourceSystem) {
      where.sourceSystem = options.sourceSystem.toUpperCase();
    }

    // Filter by verificationStatus
    if (options.verificationStatus) {
      where.verificationStatus = options.verificationStatus.toUpperCase();
    }

    // Filter by OpportunityStatus enum
    if (options.status) {
      const uppercaseStatus = options.status.toUpperCase();
      if (Object.values(OpportunityStatus).includes(uppercaseStatus as OpportunityStatus)) {
        where.status = uppercaseStatus as OpportunityStatus;
      } else {
        throw new Error(`Invalid status parameter: '${options.status}'. Allowed values: ${Object.values(OpportunityStatus).join(', ')}`);
      }
    }

    // Filter by agencyType / fundingType on FundingSource
    if (options.fundingType) {
      where.fundingSource = {
        agencyType: {
          contains: options.fundingType,
          mode: 'insensitive',
        },
      };
    }

    // Filter by minimum overall fit score in latest OpportunityAnalysis
    if (options.minimumFitScore !== undefined) {
      if (isNaN(options.minimumFitScore) || options.minimumFitScore < 0 || options.minimumFitScore > 100) {
        throw new Error('minimumFitScore must be a number between 0 and 100');
      }
      where.opportunityAnalyses = {
        some: {
          overallFitScore: {
            gte: options.minimumFitScore,
          },
        },
      };
    }

    const [total, records] = await Promise.all([
      prisma.fundingOpportunity.count({ where }),
      prisma.fundingOpportunity.findMany({
        where,
        include: opportunityIncludeObject,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: records,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Retrieve a single funding opportunity by ID with all relations.
   */
  static async getOpportunityById(id: string) {
    const record = await prisma.fundingOpportunity.findUnique({
      where: { id },
      include: opportunityIncludeObject,
    });

    return record;
  }
}
