import { prisma } from '../lib/prisma';

export interface CreateStrategicPartnerInput {
  name: string;
  organizationType: string;
  websiteUrl: string;
  geography: string;
  mission: string;
  servicesOffered: string[];
  collaborationFocus: string;
  contactChannel?: string;
  verificationStatus?: string;
  internalNotes?: string;
}

export class StrategicPartnerService {
  /**
   * List strategic partner candidates.
   */
  public static async listPartners(filter?: { organizationType?: string; verificationStatus?: string }) {
    const where: any = {};
    if (filter?.organizationType) {
      where.organizationType = filter.organizationType;
    }
    if (filter?.verificationStatus) {
      where.verificationStatus = filter.verificationStatus;
    }

    return await prisma.strategicPartnerCandidate.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Create a new strategic partner candidate.
   * Maintains strict separation from fiscal sponsors.
   */
  public static async createPartner(input: CreateStrategicPartnerInput) {
    const contactChannel = input.contactChannel || 'UNKNOWN';
    const verificationStatus = input.verificationStatus || 'PENDING_HUMAN_REVIEW';

    return await prisma.strategicPartnerCandidate.create({
      data: {
        name: input.name,
        organizationType: input.organizationType,
        websiteUrl: input.websiteUrl,
        geography: input.geography,
        mission: input.mission,
        servicesOffered: input.servicesOffered || [],
        collaborationFocus: input.collaborationFocus,
        contactChannel,
        verificationStatus,
        internalNotes: input.internalNotes,
      },
    });
  }

  /**
   * Get partner by ID.
   */
  public static async getPartnerById(id: string) {
    return await prisma.strategicPartnerCandidate.findUnique({
      where: { id },
    });
  }
}
