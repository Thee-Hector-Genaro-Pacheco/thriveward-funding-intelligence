import { prisma } from '../lib/prisma';
import { OpportunityStatus, Prisma } from '@prisma/client';

export interface OpportunityQueryOptions {
  status?: string;
  fundingType?: string;
  minimumFitScore?: number;
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
