import {
  FundingAnalystProvider,
  InputSnapshot,
  AnalysisResponse,
  FundingAnalysisResult,
} from './fundingAnalystProvider';
import { EvidenceCatalogBuilder } from './evidenceCatalogBuilder';

export class MockFundingAnalystProvider implements FundingAnalystProvider {
  public async analyze(snapshot: InputSnapshot): Promise<AnalysisResponse> {
    const oppTitle = snapshot.opportunity.title || 'Funding Opportunity';
    const isDirectEligible = snapshot.opportunity.candidateRoutingStatus === 'DIRECT_FEDERAL_ELIGIBLE';

    const result: FundingAnalysisResult = {
      alignmentScore: isDirectEligible ? 90 : 65,
      eligibility: isDirectEligible ? 'POSSIBLY_ELIGIBLE' : 'UNLIKELY_ELIGIBLE',
      summary: `AI Evaluation for "${oppTitle}": Project Thriveward's pre-incorporation stage requires careful evaluation of direct eligibility and fiscal sponsorship requirements.`,
      strengths: [
        {
          text: `Mission alignment with target population: ${snapshot.organization.primaryPopulations.join(', ')}.`,
          evidenceRefs: ['OPP.title', 'ORG.mission', 'ORG.servicePopulation'],
        },
        {
          text: 'Core training program Control to Code aligns with workforce technology objectives.',
          evidenceRefs: ['OPP.agency', 'ORG.programs'],
        },
      ],
      risks: [
        {
          text: 'Organization is pre-incorporation and has not obtained 501(c)(3) tax status.',
          evidenceRefs: ['ORG.formationStatus', 'ORG.taxExemptionStatus'],
        },
        {
          text: 'Requires fiscal sponsor partnership or Collaborative Applicant structure for submission.',
          evidenceRefs: ['OPP.eligibility', 'ORG.operatingHistory'],
        },
      ],
      requirements: [
        {
          requirement: '501(c)(3) Nonprofit Status or Eligible Fiscal Sponsorship',
          status: 'NOT_MET',
          evidenceRefs: ['ORG.taxExemptionStatus', 'OPP.eligibility'],
        },
        {
          requirement: 'Geographic Service Coverage in California',
          status: 'MET',
          evidenceRefs: ['ORG.serviceAreas', 'OPP.sourceUrl'],
        },
        {
          requirement: 'Programmatic Operating History Metrics',
          status: 'UNKNOWN',
          evidenceRefs: ['ORG.operatingHistory'],
        },
      ],
      recommendedNextAction: isDirectEligible
        ? 'Prepare technical proposal narrative while securing fiscal sponsorship agreement.'
        : 'Explore strategic partner collaborative applicant submission prior to deadline.',
      confidence: 0.88,
      limitations: [
        'Analysis based solely on static DB organization profile and opportunity text.',
        'Pre-incorporation status requires third-party fiscal sponsor execution.',
      ],
    };

    // Validate evidence references internally to verify catalog integrity
    EvidenceCatalogBuilder.validateEvidenceRefs(result, snapshot.evidenceCatalog);

    return {
      result,
      meta: {
        provider: 'MOCK_OPENAI',
        model: 'gpt-5.6-luna',
        promptVersion: snapshot.promptVersion || EvidenceCatalogBuilder.PROMPT_VERSION,
        providerResponseId: `mock-resp-${Date.now()}`,
        inputTokenCount: 420,
        outputTokenCount: 280,
        rawRefusal: null,
      },
    };
  }
}
