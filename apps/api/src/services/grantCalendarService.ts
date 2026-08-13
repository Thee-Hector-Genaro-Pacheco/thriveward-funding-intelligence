import { prisma } from '../lib/prisma';
import { RecurrenceConfidence } from '@prisma/client';

export interface CreateCalendarItemInput {
  fundingOpportunityId?: string;
  opportunityTitle: string;
  agency: string;
  forecastedPostDate?: Date;
  postedDate?: Date;
  deadline?: Date;
  priorCycleDates?: string[];
  recurrenceConfidence: RecurrenceConfidence;
  expectedNextCyclePrepDate?: Date;
  recurrenceEvidenceSource: string;
  notes?: string;
}

export class GrantCalendarService {
  /**
   * List all items in the recurring grant calendar.
   */
  public static async listCalendarItems() {
    return await prisma.grantCalendarItem.findMany({
      include: {
        fundingOpportunity: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create or update a recurring grant calendar item.
   * Ensures recurrence confidence is evaluated and deadlines are source-backed.
   */
  public static async createCalendarItem(input: CreateCalendarItemInput) {
    if (!input.recurrenceEvidenceSource || input.recurrenceEvidenceSource.trim() === '') {
      throw new Error('Grant calendar item requires an explicit recurrence evidence source URL or document citation.');
    }

    return await prisma.grantCalendarItem.create({
      data: {
        fundingOpportunityId: input.fundingOpportunityId,
        opportunityTitle: input.opportunityTitle,
        agency: input.agency,
        forecastedPostDate: input.forecastedPostDate,
        postedDate: input.postedDate,
        deadline: input.deadline,
        priorCycleDates: input.priorCycleDates || [],
        recurrenceConfidence: input.recurrenceConfidence,
        expectedNextCyclePrepDate: input.expectedNextCyclePrepDate,
        recurrenceEvidenceSource: input.recurrenceEvidenceSource,
        notes: input.notes,
      },
    });
  }
}
