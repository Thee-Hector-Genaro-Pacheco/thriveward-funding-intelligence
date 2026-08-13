import { prisma } from '../lib/prisma';
import { RelevanceStatus } from '@prisma/client';
import { BRIDGE_FORWARD_PROFILE, getProfileHash } from '../config/bridgeForwardProfile';
import { sanitizeHtmlToText } from '@bridge-ai/shared';

export interface RelevanceResult {
  id: string;
  fundingOpportunityId: string;
  relevanceStatus: RelevanceStatus;
  relevanceScore: number;
  positiveReasons: string[];
  exclusionReasons: string[];
  explanation: string;
  evidenceFields: string[];
  analysisVersion: string;
  profileVersion: string;
  profileHash: string;
  isCurrent: boolean;
  citations: Array<{
    field: string;
    matchedTerm: string;
    contextSnippet: string;
  }>;
}

export class RelevanceService {
  /**
   * Deterministically assesses contextual relevance for a funding opportunity.
   */
  static async assessRelevance(fundingOpportunityId: string): Promise<RelevanceResult> {
    const opp = await prisma.fundingOpportunity.findUnique({
      where: { id: fundingOpportunityId },
      include: { snapshots: true },
    });

    if (!opp) {
      throw new Error(`Funding opportunity '${fundingOpportunityId}' not found`);
    }

    const titleText = sanitizeHtmlToText(opp.title);
    const agencyText = sanitizeHtmlToText(opp.fundingAgency);
    const descText = sanitizeHtmlToText(opp.description);
    const programText = sanitizeHtmlToText(opp.program || '');
    const geographyText = sanitizeHtmlToText(opp.geography || '');
    const fullText = `${titleText} ${agencyText} ${descText} ${programText} ${geographyText}`.toLowerCase();

    const positiveReasons: string[] = [];
    const exclusionReasons: string[] = [];
    const citations: Array<{ field: string; matchedTerm: string; contextSnippet: string }> = [];
    const evidenceFieldsSet = new Set<string>();

    let score = 0;

    // --- 1. Misleading Keyword Collisions (Negative Drivers) ---

    // A. Clinical / Biomedical Research Collision
    const clinicalTerms = [
      'ncats',
      'clinical and translational science',
      'clinical trial',
      'biomedical research',
      'research career',
      'scholars',
      'postdoctoral',
      'grant program for the ncats',
      'r03',
    ];

    const hasClinicalMatch = clinicalTerms.some((t) => fullText.includes(t));
    if (hasClinicalMatch && (fullText.includes('re-entry') || fullText.includes('reentry'))) {
      exclusionReasons.push('CLINICAL_RESEARCH_REENTRY_COLLISION');
      citations.push({
        field: 'title/description',
        matchedTerm: 'NCATS / Clinical Trial / Research Scholar Re-entry',
        contextSnippet: titleText.slice(0, 150),
      });
      evidenceFieldsSet.add('title');
      evidenceFieldsSet.add('description');
    }

    // B. International Travel / Cultural Exchange Collision
    const internationalTerms = [
      'congress-bundestag',
      'youth exchange',
      'staff exchange',
      'cultural exchange',
      'diplomacy',
      'study abroad',
    ];

    const hasIntlMatch = internationalTerms.some((t) => fullText.includes(t));
    if (hasIntlMatch) {
      exclusionReasons.push('INTERNATIONAL_TRAVEL_REENTRY_COLLISION');
      citations.push({
        field: 'title/description',
        matchedTerm: 'Congress-Bundestag / International Youth Exchange Re-entry Orientation',
        contextSnippet: titleText.slice(0, 150),
      });
      evidenceFieldsSet.add('title');
      evidenceFieldsSet.add('fundingAgency');
    }

    // C. Academic / Scientific Researcher Re-entry Collision
    if (
      !hasClinicalMatch &&
      !hasIntlMatch &&
      (fullText.includes('faculty re-entry') || fullText.includes('laboratory research supplement'))
    ) {
      exclusionReasons.push('ACADEMIC_RESEARCH_REENTRY_COLLISION');
      citations.push({
        field: 'description',
        matchedTerm: 'Academic / Laboratory Research Re-entry',
        contextSnippet: descText.slice(0, 150),
      });
      evidenceFieldsSet.add('description');
    }

    // --- 2. Relevant Theme Matching (Positive Drivers) ---

    // Theme A: Reentry & Justice-Involved Populations
    const reentryTerms = [
      'reentry',
      're-entry',
      'returning citizens',
      'justice-involved',
      'justice involved',
      'recidivism',
      'system-impacted',
      'system impacted',
    ];

    const matchedReentryTerms = reentryTerms.filter((t) => fullText.includes(t));
    if (matchedReentryTerms.length > 0 && exclusionReasons.length === 0) {
      score += 40;
      positiveReasons.push('REENTRY_POPULATION_MATCH');
      citations.push({
        field: 'description',
        matchedTerm: matchedReentryTerms.join(', '),
        contextSnippet: descText.slice(0, 150),
      });
      evidenceFieldsSet.add('description');
      evidenceFieldsSet.add('eligiblePopulations');
    }

    // Theme B: Workforce Development & Career Training
    const workforceTerms = [
      'workforce development',
      'career connected',
      'career-connected',
      'vocational',
      'technical education',
      'apprenticeship',
      'employment pathways',
      'job training',
      'stipends',
    ];

    const matchedWorkforceTerms = workforceTerms.filter((t) => fullText.includes(t));
    if (matchedWorkforceTerms.length > 0) {
      score += 25;
      positiveReasons.push('WORKFORCE_TRAINING_MATCH');
      citations.push({
        field: 'description',
        matchedTerm: matchedWorkforceTerms.join(', '),
        contextSnippet: descText.slice(0, 150),
      });
      evidenceFieldsSet.add('description');
    }

    // Theme C: Technology & Digital Skills
    const techTerms = ['controls to code', 'raspberry pi', 'python', 'iot', 'digital skills', 'hardware', 'coding'];
    const matchedTechTerms = techTerms.filter((t) => fullText.includes(t));
    if (matchedTechTerms.length > 0) {
      score += 20;
      positiveReasons.push('TECHNOLOGY_SKILLS_MATCH');
      citations.push({
        field: 'description',
        matchedTerm: matchedTechTerms.join(', '),
        contextSnippet: descText.slice(0, 150),
      });
      evidenceFieldsSet.add('description');
    }

    // Theme D: Community Services & Supportive Assistance
    const communityTerms = [
      'community services block grant',
      'csbg',
      'community-based',
      'supportive services',
      'mentorship',
      'economic mobility',
    ];
    const matchedCommunityTerms = communityTerms.filter((t) => fullText.includes(t));
    if (matchedCommunityTerms.length > 0) {
      score += 20;
      positiveReasons.push('COMMUNITY_SERVICES_MATCH');
      citations.push({
        field: 'title/agency',
        matchedTerm: matchedCommunityTerms.join(', '),
        contextSnippet: `${titleText} — ${agencyText}`.slice(0, 150),
      });
      evidenceFieldsSet.add('title');
      evidenceFieldsSet.add('fundingAgency');
    }

    // Theme E: California Geography Match
    const caTerms = ['california', 'bay area', 'northern ca', 'orange county', 'los angeles', 'san bernardino', 'san diego'];
    if (caTerms.some((t) => fullText.includes(t))) {
      score += 10;
      positiveReasons.push('CALIFORNIA_GEOGRAPHY_MATCH');
      evidenceFieldsSet.add('geography');
    }

    // --- 3. Score Normalization & Status Determination ---
    if (exclusionReasons.length > 0) {
      score = Math.min(score, 10);
    } else {
      score = Math.min(score, 100);
    }

    let status: RelevanceStatus = RelevanceStatus.UNKNOWN;
    if (exclusionReasons.length > 0 || score < 25) {
      status = RelevanceStatus.IRRELEVANT;
    } else if (score >= 70) {
      status = RelevanceStatus.RELEVANT;
    } else {
      status = RelevanceStatus.POSSIBLY_RELEVANT;
    }

    // Human-readable explanation
    let explanation = '';
    if (exclusionReasons.includes('CLINICAL_RESEARCH_REENTRY_COLLISION')) {
      explanation = `Misleading keyword collision: Opportunity uses "re-entry" to describe biomedical/clinical research scholar career re-entry (NCATS/NIH), which is unrelated to Bridge Forward's justice-involved reentry mission. Contextually IRRELEVANT.`;
    } else if (exclusionReasons.includes('INTERNATIONAL_TRAVEL_REENTRY_COLLISION')) {
      explanation = `Misleading keyword collision: Opportunity uses "re-entry" to describe international cultural/youth exchange participant orientation, which is unrelated to Bridge Forward's criminal justice reentry mission. Contextually IRRELEVANT.`;
    } else if (status === RelevanceStatus.RELEVANT) {
      explanation = `High contextual relevance (${score}/100): Direct alignment with Bridge Forward's target population (justice-involved/returning citizens) and core services (${positiveReasons.join(', ')}).`;
    } else if (status === RelevanceStatus.POSSIBLY_RELEVANT) {
      explanation = `Moderate contextual relevance (${score}/100): Aligns with community workforce services or technical skills training, but requires human triage to confirm population fit (${positiveReasons.join(', ')}).`;
    } else {
      explanation = `Low relevance (${score}/100): Does not contain evidence of alignment with Bridge Forward's reentry model.`;
    }

    const currentProfileHash = getProfileHash();

    // Mark previous relevance as non-current
    await prisma.opportunityRelevance.updateMany({
      where: { fundingOpportunityId, isCurrent: true },
      data: { isCurrent: false },
    });

    // Create new OpportunityRelevance record
    const record = await prisma.opportunityRelevance.create({
      data: {
        fundingOpportunityId,
        relevanceStatus: status,
        relevanceScore: score,
        positiveReasons,
        exclusionReasons,
        explanation,
        evidenceFields: Array.from(evidenceFieldsSet),
        analysisVersion: '1.0',
        profileVersion: BRIDGE_FORWARD_PROFILE.profileVersion,
        profileHash: currentProfileHash,
        isCurrent: true,
        citations: {
          create: citations.map((c) => ({
            field: c.field,
            matchedTerm: c.matchedTerm,
            contextSnippet: c.contextSnippet,
          })),
        },
      },
      include: {
        citations: true,
      },
    });

    // Update pursuit stage from NEW to REVIEWING if currently NEW
    if (opp.pursuitStage === 'NEW') {
      await prisma.fundingOpportunity.update({
        where: { id: fundingOpportunityId },
        data: { pursuitStage: 'REVIEWING' },
      });
      await prisma.pursuitHistory.create({
        data: {
          fundingOpportunityId,
          fromStage: 'NEW',
          toStage: 'REVIEWING',
          actorId: 'system-relevance-engine',
          notes: 'Automatic transition to REVIEWING upon contextual relevance calculation.',
        },
      });
    }

    return {
      id: record.id,
      fundingOpportunityId: record.fundingOpportunityId,
      relevanceStatus: record.relevanceStatus,
      relevanceScore: record.relevanceScore,
      positiveReasons: record.positiveReasons,
      exclusionReasons: record.exclusionReasons,
      explanation: record.explanation,
      evidenceFields: record.evidenceFields,
      analysisVersion: record.analysisVersion,
      profileVersion: record.profileVersion,
      profileHash: record.profileHash,
      isCurrent: record.isCurrent,
      citations: record.citations,
    };
  }

  /**
   * Retrieves the current relevance record for a funding opportunity.
   */
  static async getRelevance(fundingOpportunityId: string): Promise<RelevanceResult | null> {
    const record = await prisma.opportunityRelevance.findFirst({
      where: { fundingOpportunityId, isCurrent: true },
      include: { citations: true },
    });

    if (!record) return null;

    return {
      id: record.id,
      fundingOpportunityId: record.fundingOpportunityId,
      relevanceStatus: record.relevanceStatus,
      relevanceScore: record.relevanceScore,
      positiveReasons: record.positiveReasons,
      exclusionReasons: record.exclusionReasons,
      explanation: record.explanation,
      evidenceFields: record.evidenceFields,
      analysisVersion: record.analysisVersion,
      profileVersion: record.profileVersion,
      profileHash: record.profileHash,
      isCurrent: record.isCurrent,
      citations: record.citations,
    };
  }
}
