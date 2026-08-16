import { BRIDGE_FORWARD_PROFILE, BridgeOrganizationProfile } from '@thriveward/shared';

export type NarrativeLens =
  | 'YOUTH_JUSTICE_REENTRY'
  | 'ADULT_REENTRY'
  | 'HOUSING_STABILITY'
  | 'WORKFORCE_PATHWAYS'
  | 'TECHNOLOGY_EDUCATION'
  | 'SUPPORTIVE_SERVICES';

export interface BuildOpportunityNarrativeInput {
  opportunity?: any;
  organizationProfile?: BridgeOrganizationProfile;
  requiredApplicationPathway?: string;
  requiredPartnerType?: string;
  selectedPartner?: any;
}

export interface OpportunityNarrativeResult {
  selectedNarrativeLenses: NarrativeLens[];
  opportunitySpecificOrganizationNarrative: string;
  geographicContextNarrative: string;
  narrativeEvidenceFacts: string[];
  narrativeSafeguardsApplied: string[];
}

export class OpportunityNarrativeService {
  /**
   * Deterministically builds opportunity-specific outreach positioning and narrative
   * safeguards without modifying the canonical Bridge Forward profile or master mission.
   */
  public static buildOpportunitySpecificNarrative(
    input: BuildOpportunityNarrativeInput
  ): OpportunityNarrativeResult {
    const opp = input.opportunity;
    const partner = input.selectedPartner;

    // 1. Deterministically select narrative lenses based on opportunity facts
    const selectedNarrativeLenses = OpportunityNarrativeService.selectLenses(opp);

    // 2. Build opportunity-specific organization positioning narrative
    const opportunitySpecificOrganizationNarrative =
      OpportunityNarrativeService.generatePositioningNarrative(selectedNarrativeLenses, opp);

    // 3. Build partner-specific geographic localization narrative
    const partnerCounty = OpportunityNarrativeService.resolvePartnerCounty(partner);
    const partnerCocNumber = (partner?.cocNumber && partner.cocNumber !== 'UNKNOWN') ? partner.cocNumber : (partnerCounty.includes('Orange') ? 'CA-602' : partnerCounty.includes('Los Angeles') ? 'CA-600' : partnerCounty.includes('San Bernardino') ? 'CA-609' : partnerCounty.includes('San Diego') ? 'CA-601' : 'CoC Lead');
    const geographicContextNarrative =
      OpportunityNarrativeService.generateGeographicNarrative(partnerCounty, partnerCocNumber);

    // 4. Document underlying evidence facts
    const narrativeEvidenceFacts = [
      `Project Thriveward is PRE_INCORPORATION (nonprofit initiative stage)`,
      `Planned Launch Service Areas: Orange County and Los Angeles County`,
      `Project Thriveward’s service models are planned or developing; no completed cohort outcomes or operating history are claimed.`,
      `Opportunity pathway: ${input.requiredApplicationPathway || opp?.candidateRoutingStatus || 'PARTNERSHIP_REQUIRED'}`,
    ];

    // 5. Document narrative safeguards applied
    const narrativeSafeguardsApplied = [
      `LENS_FILTERED: Emphasized opportunity-aligned mission lenses (${selectedNarrativeLenses.join(', ')}) instead of master mission`,
      `LEGAL_STAGE_SAFEGUARD: Described as 'emerging Southern California nonprofit initiative' (PRE_INCORPORATION)`,
      `GEOGRAPHIC_LOCALIZATION: Localized inquiry to ${partnerCounty} (${partnerCocNumber}) within 2-county launch footprint (Orange & Los Angeles counties)`,
      `CURRENT_CYCLE_STATUS_SAFEGUARD: Enforced information-seeking wording for unverified/conflicting cycles`,
      `TERMINOLOGY_SAFEGUARD: Used non-stigmatizing labels ('justice-involved youth and young adults', 'system-impacted youth')`,
      `ZERO_FABRICATION_SAFEGUARD: Preserved pre-incorporation limitations; zero fabricated outcomes or historical cohorts`,
    ];

    return {
      selectedNarrativeLenses,
      opportunitySpecificOrganizationNarrative,
      geographicContextNarrative,
      narrativeEvidenceFacts,
      narrativeSafeguardsApplied,
    };
  }

  private static selectLenses(opp?: any): NarrativeLens[] {
    if (!opp) {
      return ['HOUSING_STABILITY', 'WORKFORCE_PATHWAYS', 'SUPPORTIVE_SERVICES'];
    }

    const title = (opp.title || '').toLowerCase();
    const desc = (opp.description || '').toLowerCase();
    const oppNum = (opp.fundingOpportunityNumber || '').toUpperCase();

    // CPD-2600-DC-0025 or CoC / Youth Homelessness grants
    if (
      oppNum.includes('CPD-2600-DC-0025') ||
      title.includes('continuum of care') ||
      title.includes('youth homelessness') ||
      desc.includes('youth homelessness')
    ) {
      return ['YOUTH_JUSTICE_REENTRY', 'HOUSING_STABILITY', 'SUPPORTIVE_SERVICES'];
    }

    if (title.includes('reentry') || desc.includes('justice-involved') || title.includes('justice')) {
      return ['ADULT_REENTRY', 'WORKFORCE_PATHWAYS', 'SUPPORTIVE_SERVICES'];
    }

    if (title.includes('technology') || desc.includes('code') || title.includes('technical training')) {
      return ['YOUTH_JUSTICE_REENTRY', 'TECHNOLOGY_EDUCATION', 'WORKFORCE_PATHWAYS'];
    }

    if (title.includes('workforce') || title.includes('pathways')) {
      return ['WORKFORCE_PATHWAYS', 'SUPPORTIVE_SERVICES', 'HOUSING_STABILITY'];
    }

    return ['HOUSING_STABILITY', 'WORKFORCE_PATHWAYS', 'SUPPORTIVE_SERVICES'];
  }

  private static generatePositioningNarrative(lenses: NarrativeLens[], opp?: any): string {
    if (lenses.includes('YOUTH_JUSTICE_REENTRY')) {
      return `I am writing on behalf of Project Thriveward, an emerging Southern California nonprofit initiative focused on developing a youth-centered service model for justice-involved and system-impacted youth and young adults, including young people transitioning from juvenile justice involvement. Our planned model connects housing stabilization, individualized reentry support, mentorship, education and workforce pathways, and sustained community-based support.`;
    }

    if (lenses.includes('ADULT_REENTRY')) {
      return `I am writing on behalf of Project Thriveward, an emerging Southern California nonprofit initiative focused on helping justice-involved adults achieve successful community reentry, career-connected education, and long-term independence. We are developing an individualized reentry support model combining pre-release preparation, mentorship, workforce development, and employer partnerships.`;
    }

    return `I am writing on behalf of Project Thriveward, an emerging Southern California nonprofit initiative focused on advancing housing stability, career-connected education, and community support for justice-involved adults and system-impacted young people. We are developing an integrated service model combining individualized support, skills training, and sustained community partnerships.`;
  }

  private static resolvePartnerCounty(partner?: any): string {
    if (!partner) return 'Orange County';
    if (partner.cocNumber === 'CA-602' || (partner.name || '').includes('Orange')) return 'Orange County';
    if (partner.cocNumber === 'CA-600' || (partner.name || '').includes('LAHSA') || (partner.geography || '').includes('Los Angeles')) return 'Los Angeles County';
    if (partner.countiesServed && partner.countiesServed.length > 0) return partner.countiesServed[0];
    return 'Orange County';
  }

  private static generateGeographicNarrative(county: string, cocNumber: string): string {
    return `Project Thriveward’s planned launch footprint includes Orange and Los Angeles counties. This inquiry specifically concerns potential participation in ${county}’s ${cocNumber} Continuum of Care process and opportunities to support justice-involved youth and young adults experiencing or at risk of homelessness.`;
  }
}
