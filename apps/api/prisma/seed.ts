import { PrismaClient, TriStateStatus, OpportunityStatus, EligibilityStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding deterministic Bridge AI demonstration records...');

  // 1. Organization Profile (Project Thriveward)
  const orgProfile = await prisma.organizationProfile.upsert({
    where: { id: 'demo-org-profile-001' },
    update: {
      name: 'Project Thriveward',
      status: 'PRE_INCORPORATION',
      taxStatus: 'NOT_OBTAINED',
      primaryPopulations: ['Justice-involved adults', 'System-impacted young people'],
      primaryOutcome: 'Successful reentry and long-term independence',
      coreModel:
        'Project Thriveward advances successful reentry and long-term independence for justice-involved adults and system-impacted young people through housing and basic-needs stabilization, individualized reentry support, career-connected education, technology and skilled-trades training, mentorship, employment pathways, and sustained community support.',
    },
    create: {
      id: 'demo-org-profile-001',
      name: 'Project Thriveward',
      status: 'PRE_INCORPORATION',
      taxStatus: 'NOT_OBTAINED',
      primaryPopulations: ['Justice-involved adults', 'System-impacted young people'],
      primaryOutcome: 'Successful reentry and long-term independence',
      coreModel:
        'Project Thriveward advances successful reentry and long-term independence for justice-involved adults and system-impacted young people through housing and basic-needs stabilization, individualized reentry support, career-connected education, technology and skilled-trades training, mentorship, employment pathways, and sustained community support.',
      limitations: [
        'Organization has not yet incorporated.',
        '501(c)(3) status has not yet been obtained.',
        'No grant awards have been received.',
        'No cohort has yet been completed.',
        'No employment outcomes should be claimed.',
        'Employer partnerships are currently being developed.',
        'Government contracts have not been obtained.',
        'Housing and rental assistance planned (not currently operational).',
      ],
      programs: {
        create: [
          { id: 'demo-prog-001', name: 'Bridge Inside', description: 'Pre-release preparation and reentry planning.', isOperational: true, keyFocus: 'In-facility orientation' },
          { id: 'demo-prog-002', name: 'Bridge Reentry', description: 'Individualized Bridge Plans, mentorship, life skills.', isOperational: true, keyFocus: 'Case management' },
          { id: 'demo-prog-003', name: 'Bridge Career Pathways', description: 'Career exploration & education pathways.', isOperational: true, keyFocus: 'Career readiness' },
          { id: 'demo-prog-004', name: 'Controls to Code', description: 'Industrial automation, PLCs, Python, IoT, software development.', isOperational: true, keyFocus: 'Industrial Technology' },
          { id: 'demo-prog-005', name: 'Bridge Work', description: 'Employer partnerships, placement & retention support.', isOperational: true, keyFocus: 'Employment' },
          { id: 'demo-prog-006', name: 'Future Construction & Trades Pathway', description: 'Trades instruction (Painting, skilled trades).', isOperational: false, keyFocus: 'Trades' },
        ],
      },
    },
  });

  // 2. Demonstration Funding Sources
  const stateSource = await prisma.fundingSource.upsert({
    where: { id: 'demo-src-state-001' },
    update: {},
    create: {
      id: 'demo-src-state-001',
      name: '[DEMO] California State Workforce Development Board (Fixture)',
      agencyType: 'STATE_GOVERNMENT',
      websiteUrl: 'https://demo-fixture.example.gov/cwdb-demo',
      description: 'Demonstration fixture modeling a California state workforce grant notice.',
    },
  });

  const fedSource = await prisma.fundingSource.upsert({
    where: { id: 'demo-src-fed-001' },
    update: {},
    create: {
      id: 'demo-src-fed-001',
      name: '[DEMO] U.S. Department of Labor Employment & Training Administration (Fixture)',
      agencyType: 'FEDERAL_GOVERNMENT',
      websiteUrl: 'https://demo-fixture.example.gov/dol-reentry-demo',
      description: 'Demonstration fixture modeling a federal reentry workforce training notice.',
    },
  });

  const foundationSource = await prisma.fundingSource.upsert({
    where: { id: 'demo-src-found-001' },
    update: {},
    create: {
      id: 'demo-src-found-001',
      name: '[DEMO] Tech Reentry & Opportunity Philanthropies (Fixture)',
      agencyType: 'PRIVATE_FOUNDATION',
      websiteUrl: 'https://demo-fixture.example.org/tech-reentry-demo',
      description: 'Demonstration fixture modeling a private philanthropic technology grant.',
    },
  });

  // 3. Demonstration Opportunity 1: [DEMO] California Workforce Pathways Pilot
  const opp1 = await prisma.fundingOpportunity.upsert({
    where: { id: 'demo-opp-001' },
    update: {},
    create: {
      id: 'demo-opp-001',
      fundingSourceId: stateSource.id,
      isDemo: true,
      title: '[DEMO] California Workforce Pathways Pilot',
      fundingAgency: '[DEMO] California State Workforce Board',
      program: 'Reentry & Youth Career Advancement Initiative',
      description:
        '[DEMO FIXTURE DATA] Demonstration opportunity modeling state funding for localized career pathways, participant supportive services, and technical training for justice-involved individuals.',
      sourceUrl: 'https://demo-fixture.example.gov/cwdb-demo/pathways-2026',
      status: OpportunityStatus.PENDING_HUMAN_REVIEW,
      openingDate: '2026-09-01',
      deadline: '2026-11-15',
      awardMin: '$150,000',
      awardMax: '$500,000',
      totalAvailableFunding: '$5,000,000',
      geography: 'California (Priority: Bay Area & Northern CA)',
      eligibleApplicantTypes: ['Nonprofit Organizations', 'Community-Based Organizations', 'Fiscal Sponsors Allowed'],
      eligiblePopulations: ['Justice-involved adults (18+)', 'System-impacted young adults (18-24)'],
      matchRequirement: '10% non-federal match (cash or in-kind)',
      periodOfPerformance: '18 Months',
      allowableCosts: ['Training Equipment & Toolkits', 'Participant Stipends', 'Staffing & Instructors', 'Case Management Software', 'Transportation Assistance'],
      prohibitedCosts: ['Capital construction projects', 'Out-of-state travel', 'Lobbying'],
      participantCompensationRules: 'Paid training stipends allowable up to $20/hr during intensive 12-week instruction.',
      requiredPartnerships: 'Requires formal partnership or MOU with at least one local employer or workforce board.',
      operatingHistoryRequirements: 'Requires applicant organization or fiscal sponsor to have operational presence in CA.',
      
      // Participant Support Allowability Matrix
      supportTrainingStipends: TriStateStatus.YES,
      supportNeedsRelatedPayments: TriStateStatus.YES,
      supportTransportation: TriStateStatus.YES,
      supportMeals: TriStateStatus.CONDITIONAL,
      supportChildcare: TriStateStatus.CONDITIONAL,
      supportTools: TriStateStatus.YES,
      supportPPE: TriStateStatus.YES,
      supportWorkClothing: TriStateStatus.YES,
      supportLaptops: TriStateStatus.YES,
      supportTrainingEquipment: TriStateStatus.YES,
      supportCertifications: TriStateStatus.YES,
      supportPaidWorkExperience: TriStateStatus.YES,
      supportSubsidizedEmployment: TriStateStatus.YES,
      supportOnTheJobTraining: TriStateStatus.YES,
      supportEmergencyAssistance: TriStateStatus.CONDITIONAL,

      eligibilityRequirements: {
        create: [
          { id: 'demo-req-001-1', criteriaCategory: 'Geographic Focus', description: 'Must serve participants in California.', isMandatory: true, verifiedStatus: TriStateStatus.YES, notes: 'Project Thriveward operates in CA.' },
          { id: 'demo-req-001-2', criteriaCategory: 'Target Population', description: 'Must serve justice-involved or system-impacted individuals.', isMandatory: true, verifiedStatus: TriStateStatus.YES, notes: 'Primary target population match.' },
          { id: 'demo-req-001-3', criteriaCategory: 'Entity Status', description: '501(c)(3) tax status OR explicit fiscal sponsorship agreement.', isMandatory: true, verifiedStatus: TriStateStatus.CONDITIONAL, notes: 'Project Thriveward requires a fiscal sponsor prior to grant application.' },
        ],
      },

      allowableCostItems: {
        create: [
          { id: 'demo-cost-001-1', costCategory: 'Participant Stipends', isAllowable: TriStateStatus.YES, restrictions: 'Capped at $20/hr during classroom hours' },
          { id: 'demo-cost-001-2', costCategory: 'Training Hardware / Laptops', isAllowable: TriStateStatus.YES, restrictions: 'For participant loaner devices' },
        ],
      },

      requiredDocuments: {
        create: [
          { id: 'demo-doc-001-1', documentName: 'Project Narrative & Workplan', description: '15-page limit outlining pilot curriculum', isMandatory: true },
          { id: 'demo-doc-001-2', documentName: 'Budget Narrative & Line-Item Sheet', description: 'Itemized expense breakdown', isMandatory: true },
          { id: 'demo-doc-001-3', documentName: 'Fiscal Sponsor Agreement / MOU', description: 'Proof of tax-exempt umbrella', isMandatory: true },
        ],
      },

      scoringCriteria: {
        create: [
          { id: 'demo-score-001-1', criterionName: 'Program Design & Curriculum Alignment', maxPoints: 35, description: 'Evaluation of Controls to Code technical training quality' },
          { id: 'demo-score-001-2', criterionName: 'Target Population Reach & Supportive Services', maxPoints: 30, description: 'Depth of reentry mentorship and participant stipend coverage' },
          { id: 'demo-score-001-3', criterionName: 'Employer Partnerships & Placement Feasibility', maxPoints: 20, description: 'Strength of industry employer network' },
          { id: 'demo-score-001-4', criterionName: 'Cost Efficiency & Budget Realism', maxPoints: 15, description: 'Reasonableness of cost-per-participant' },
        ],
      },

      sourceCitations: {
        create: [
          {
            id: 'demo-cite-001-1',
            sourceUrl: 'https://demo-fixture.example.gov/cwdb-demo/pathways-2026',
            sourceTitle: '[DEMO FIXTURE] State Workforce Board Demonstration Guidelines',
            sourceOrganization: '[DEMO] California State Workforce Board',
            quotedSection: 'This record is a synthetic demonstration fixture created solely for Bridge AI architecture testing.',
            extractedClaim: 'Synthetic fixture claim for testing system display of allowable stipends and match requirements.',
          },
        ],
      },

      opportunityAnalyses: {
        create: [
          {
            sourceFingerprint: 'e7f97d76262778912c9d819a78882fffbe77af5040f55771a2c7d7b5237dfb9e',
            profileVersion: '1.0.0-phase0',
            profileHash: '0678e0eab1d44e84e03dcb9b3df20ce9476d89a8bd9da48fff81af9050007e3e',
            profileSnapshot: { profileId: 'bridge-forward-org-profile', version: '1.0.0-phase0' },
            eligibilityDecision: 'ELIGIBLE',
            recommendation: 'HIGH_PRIORITY',
            overallFitScore: 88,
            eligibilityStatus: EligibilityStatus.HIGH_PRIORITY,
            missingEligibilityRequirements: ['Requires finalized Fiscal Sponsor agreement prior to formal submission'],
            missingCapabilities: ['Employer MOUs are currently in active development'],
            reasoningSummary:
              'High mission and population alignment with Project Thriveward Controls to Code and reentry model. Mandatory tax-status eligibility met conditionally via fiscal sponsor pathway.',
            missionAlignmentScore: 95,
            populationAlignmentScore: 100,
            programAlignmentScore: 90,
            geographicEligibilityScore: 100,
            applicantEligibilityScore: 80,
            taxStatusEligibilityScore: 75,
            organizationalMaturityScore: 70,
            requiredPartnershipsScore: 80,
            allowableCostAlignmentScore: 95,
            awardSizeSuitabilityScore: 90,
            deadlineFeasibilityScore: 85,
            evidenceTrackRecordScore: 65,
            humanReviewRequired: true,
          },
        ],
      },
    },
  });

  // 4. Demonstration Opportunity 2: [DEMO] Justice-Involved Reentry Innovation Fund
  const opp2 = await prisma.fundingOpportunity.upsert({
    where: { id: 'demo-opp-002' },
    update: {},
    create: {
      id: 'demo-opp-002',
      fundingSourceId: fedSource.id,
      isDemo: true,
      title: '[DEMO] Justice-Involved Reentry Innovation Fund',
      fundingAgency: '[DEMO] U.S. Department of Labor ETA',
      program: 'Growth Opportunities Reentry Demonstration',
      description:
        '[DEMO FIXTURE DATA] Federal demonstration grant modeling high-impact reentry, career-connected technical education, and employer-backed apprenticeship pathways for system-impacted adults.',
      sourceUrl: 'https://demo-fixture.example.gov/dol-reentry-demo/innovation-2026',
      status: OpportunityStatus.PENDING_HUMAN_REVIEW,
      openingDate: '2026-10-01',
      deadline: '2026-12-01',
      awardMin: '$1,000,000',
      awardMax: '$3,000,000',
      totalAvailableFunding: '$25,000,000',
      geography: 'Nationwide (Competitive Urban / High-Need Focus)',
      eligibleApplicantTypes: ['Incorporated 501(c)(3) Nonprofits with 3+ Years Operating History'],
      eligiblePopulations: ['Justice-involved adults released within 180 days'],
      matchRequirement: '25% Mandatory Cash Match',
      periodOfPerformance: '36 Months',
      allowableCosts: ['Staff Salaries', 'Vocational Equipment', 'Participant Subsidized Wages'],
      prohibitedCosts: ['Pre-award planning expenses', 'Direct cash assistance without training tie'],
      participantCompensationRules: 'WIOA compliant supportive payments.',
      requiredPartnerships: 'Mandatory MOU with State Department of Corrections and 3 Registered Apprenticeships.',
      operatingHistoryRequirements: 'Mandatory requirement: Minimum 3 consecutive years of audited organizational operations and 2 completed cohorts with placement track record.',

      supportTrainingStipends: TriStateStatus.YES,
      supportNeedsRelatedPayments: TriStateStatus.CONDITIONAL,
      supportTransportation: TriStateStatus.YES,
      supportMeals: TriStateStatus.NO,
      supportChildcare: TriStateStatus.NO,
      supportTools: TriStateStatus.YES,
      supportPPE: TriStateStatus.YES,
      supportWorkClothing: TriStateStatus.YES,
      supportLaptops: TriStateStatus.CONDITIONAL,
      supportTrainingEquipment: TriStateStatus.YES,
      supportCertifications: TriStateStatus.YES,
      supportPaidWorkExperience: TriStateStatus.YES,
      supportSubsidizedEmployment: TriStateStatus.YES,
      supportOnTheJobTraining: TriStateStatus.YES,
      supportEmergencyAssistance: TriStateStatus.NO,

      eligibilityRequirements: {
        create: [
          { id: 'demo-req-002-1', criteriaCategory: 'Operating History', description: 'Requires 3+ years of operating history and audited financial records.', isMandatory: true, verifiedStatus: TriStateStatus.NO, notes: 'DISQUALIFIER: Project Thriveward is currently pre-incorporation.' },
          { id: 'demo-req-002-2', criteriaCategory: 'Tax Status', description: 'Requires direct 501(c)(3) status (Fiscal sponsors not eligible).', isMandatory: true, verifiedStatus: TriStateStatus.NO, notes: 'DISQUALIFIER: 501(c)(3) status not yet obtained.' },
        ],
      },

      allowableCostItems: {
        create: [
          { id: 'demo-cost-002-1', costCategory: 'Vocational Equipment', isAllowable: TriStateStatus.YES, restrictions: 'Must be installed in certified training lab' },
        ],
      },

      requiredDocuments: {
        create: [
          { id: 'demo-doc-002-1', documentName: '3 Years Audited Financial Statements', description: 'CPA audited statements', isMandatory: true },
          { id: 'demo-doc-002-2', documentName: 'Department of Corrections MOU', description: 'Signed facility access agreement', isMandatory: true },
        ],
      },

      scoringCriteria: {
        create: [
          { id: 'demo-score-002-1', criterionName: 'Historical Placement Metrics & Track Record', maxPoints: 40, description: 'Evaluation of prior cohort employment retention' },
        ],
      },

      sourceCitations: {
        create: [
          {
            id: 'demo-cite-002-1',
            sourceUrl: 'https://demo-fixture.example.gov/dol-reentry-demo/innovation-2026',
            sourceTitle: '[DEMO FIXTURE] Federal Reentry Grant Notice Demonstration',
            sourceOrganization: '[DEMO] U.S. Department of Labor ETA',
            quotedSection: 'Applicants must possess 3 years of operating history. Demonstrations fixtures explicitly test disqualifier separation.',
            extractedClaim: 'Mandatory eligibility rule requiring 3 years operating history disqualifies pre-incorporation entities.',
          },
        ],
      },

      opportunityAnalyses: {
        create: [
          {
            id: 'demo-analysis-002',
            sourceFingerprint: 'e7f97d76262778912c9d819a78882fffbe77af5040f55771a2c7d7b5237dfb9e',
            profileVersion: '1.0.0-phase0',
            profileHash: '0678e0eab1d44e84e03dcb9b3df20ce9476d89a8bd9da48fff81af9050007e3e',
            profileSnapshot: { profileId: 'bridge-forward-org-profile', version: '1.0.0-phase0' },
            eligibilityDecision: 'NOT_ELIGIBLE',
            recommendation: 'NOT_ELIGIBLE',
            overallFitScore: 42,
            eligibilityStatus: EligibilityStatus.NOT_ELIGIBLE,
            missingEligibilityRequirements: [
              'Project Thriveward does not satisfy the mandatory 3-year operating history requirement.',
              'Direct 501(c)(3) status required; fiscal sponsorship not permitted for this FOA.',
            ],
            missingCapabilities: ['No completed cohorts or historical employment placement track record.'],
            reasoningSummary:
              'High semantic alignment with reentry workforce goals, but DISQUALIFIED due to mandatory operating history and direct tax-status requirements. Engine correctly classifies as NOT ELIGIBLE.',
            missionAlignmentScore: 90,
            populationAlignmentScore: 95,
            programAlignmentScore: 85,
            geographicEligibilityScore: 100,
            applicantEligibilityScore: 0,
            taxStatusEligibilityScore: 0,
            organizationalMaturityScore: 0,
            requiredPartnershipsScore: 30,
            allowableCostAlignmentScore: 85,
            awardSizeSuitabilityScore: 20,
            deadlineFeasibilityScore: 70,
            evidenceTrackRecordScore: 0,
            humanReviewRequired: true,
          },
        ],
      },
    },
  });

  // 5. Demonstration Opportunity 3: [DEMO] Youth Technology Training Foundation Grant
  const opp3 = await prisma.fundingOpportunity.upsert({
    where: { id: 'demo-opp-003' },
    update: {},
    create: {
      id: 'demo-opp-003',
      fundingSourceId: foundationSource.id,
      isDemo: true,
      title: '[DEMO] Youth Technology Training Foundation Grant',
      fundingAgency: '[DEMO] Tech Reentry & Opportunity Philanthropies',
      program: 'Digital Inclusion & Hardware Skills Grant',
      description:
        '[DEMO FIXTURE DATA] Philanthropic grant opportunity funding hardware, Raspberry Pi, industrial automation computing, and coding instruction for system-impacted youth.',
      sourceUrl: 'https://demo-fixture.example.org/tech-reentry-demo/youth-tech-2026',
      status: OpportunityStatus.PENDING_HUMAN_REVIEW,
      openingDate: '2026-08-15',
      deadline: '2026-10-30',
      awardMin: '$50,000',
      awardMax: '$150,000',
      totalAvailableFunding: '$1,200,000',
      geography: 'California & Pacific Northwest',
      eligibleApplicantTypes: ['Nonprofits', 'Community Programs', 'Fiscal Sponsors Welcome'],
      eligiblePopulations: ['System-impacted young adults (ages 18-24)'],
      matchRequirement: 'None Required',
      periodOfPerformance: '12 Months',
      allowableCosts: ['Raspberry Pi hardware', 'Sensors & Transmitters', 'Laptops', 'Instructor Honoraria', 'Certification Exam Fees'],
      prohibitedCosts: ['Administrative overhead > 10%'],
      participantCompensationRules: 'Training stipends and completion bonuses allowable.',
      requiredPartnerships: 'Community outreach partners encouraged.',
      operatingHistoryRequirements: 'Flexible for emerging pilot programs with fiscal sponsors.',

      supportTrainingStipends: TriStateStatus.YES,
      supportNeedsRelatedPayments: TriStateStatus.UNKNOWN,
      supportTransportation: TriStateStatus.YES,
      supportMeals: TriStateStatus.YES,
      supportChildcare: TriStateStatus.UNKNOWN,
      supportTools: TriStateStatus.YES,
      supportPPE: TriStateStatus.YES,
      supportWorkClothing: TriStateStatus.UNKNOWN,
      supportLaptops: TriStateStatus.YES,
      supportTrainingEquipment: TriStateStatus.YES,
      supportCertifications: TriStateStatus.YES,
      supportPaidWorkExperience: TriStateStatus.CONDITIONAL,
      supportSubsidizedEmployment: TriStateStatus.UNKNOWN,
      supportOnTheJobTraining: TriStateStatus.UNKNOWN,
      supportEmergencyAssistance: TriStateStatus.UNKNOWN,

      eligibilityRequirements: {
        create: [
          { id: 'demo-req-003-1', criteriaCategory: 'Age Focus', description: 'Must serve young adults ages 18-24.', isMandatory: true, verifiedStatus: TriStateStatus.YES, notes: 'Matches system-impacted youth focus.' },
          { id: 'demo-req-003-2', criteriaCategory: 'Technical Focus', description: 'Curriculum must involve practical computer or hardware technology skills.', isMandatory: true, verifiedStatus: TriStateStatus.YES, notes: 'Direct match for Controls to Code.' },
        ],
      },

      allowableCostItems: {
        create: [
          { id: 'demo-cost-003-1', costCategory: 'Raspberry Pi & Sensors', isAllowable: TriStateStatus.YES, restrictions: 'For Controls to Code lab kits' },
        ],
      },

      requiredDocuments: {
        create: [
          { id: 'demo-doc-003-1', documentName: 'Pilot Program Overview & Hardware Budget', description: 'Details on kit allocation (~15 participants)', isMandatory: true },
        ],
      },

      scoringCriteria: {
        create: [
          { id: 'demo-score-003-1', criterionName: 'Innovative Technology Curriculum', maxPoints: 50, description: 'Evaluation of PLC, Python, Raspberry Pi hands-on learning' },
        ],
      },

      sourceCitations: {
        create: [
          {
            id: 'demo-cite-003-1',
            sourceUrl: 'https://demo-fixture.example.org/tech-reentry-demo/youth-tech-2026',
            sourceTitle: '[DEMO FIXTURE] Philanthropic Foundation Grant Announcement',
            sourceOrganization: '[DEMO] Tech Reentry & Opportunity Philanthropies',
            quotedSection: 'Demonstration fixture testing technology-focused grant matching with Controls to Code.',
            extractedClaim: 'Synthetic fixture claim confirming eligibility of Raspberry Pi hardware and student stipends.',
          },
        ],
      },

      opportunityAnalyses: {
        create: [
          {
            id: 'demo-analysis-003',
            sourceFingerprint: 'e7f97d76262778912c9d819a78882fffbe77af5040f55771a2c7d7b5237dfb9e',
            profileVersion: '1.0.0-phase0',
            profileHash: '0678e0eab1d44e84e03dcb9b3df20ce9476d89a8bd9da48fff81af9050007e3e',
            profileSnapshot: { profileId: 'bridge-forward-org-profile', version: '1.0.0-phase0' },
            eligibilityDecision: 'ELIGIBLE',
            recommendation: 'HIGH_PRIORITY',
            overallFitScore: 94,
            eligibilityStatus: EligibilityStatus.HIGH_PRIORITY,
            missingEligibilityRequirements: ['Fiscal Sponsor agreement signature pending'],
            missingCapabilities: [],
            reasoningSummary:
              'Exceptional fit with Controls to Code signature pathway (PLCs, Raspberry Pi, Python, IoT). Flexible eligibility criteria explicitly accommodate emerging pilot programs (~15 participants). Highly actionable.',
            missionAlignmentScore: 98,
            populationAlignmentScore: 95,
            programAlignmentScore: 100,
            geographicEligibilityScore: 100,
            applicantEligibilityScore: 90,
            taxStatusEligibilityScore: 85,
            organizationalMaturityScore: 85,
            requiredPartnershipsScore: 90,
            allowableCostAlignmentScore: 98,
            awardSizeSuitabilityScore: 100,
            deadlineFeasibilityScore: 95,
            evidenceTrackRecordScore: 85,
            humanReviewRequired: true,
          },
        ],
      },
    },
  });

  // 4. Phase 1E — Fiscal Sponsor Directory Seed (Fixture Demonstration Records)
  const sponsor1Data = {
    name: 'Community Partners (Southern California)',
    canonicalDomain: 'communitypartners.org',
    websiteUrl: 'https://communitypartners.org',
    directorySourceUrl: 'https://portal.communitypartners.org/how-to-apply-new',
    geography: 'California & Southern California (Los Angeles, Riverside, San Bernardino)',
    mission: 'Fosters civic engagement and manages community-based initiatives advancing equity, youth services, and workforce development.',
    populationsServed: ['Unhoused youth', 'Justice-impacted adults', 'Low-income families', 'System-impacted young people'],
    modelsOffered: ['MODEL_A', 'MODEL_C'],
    acceptingNewProjects: 'UNKNOWN',
    intakeStatus: 'UNKNOWN',
    intakeStatusVerifiedAt: null,
    applicationProcess: 'Online application form at https://portal.communitypartners.org/how-to-apply-new',
    estimatedReviewTime: 'Minimum 6 weeks (approx 6–8 weeks per FAQ)',
    setupFee: 'UNKNOWN',
    adminPercentage: '9% private-source revenue / 15% public & government sources',
    minRevenueRequirement: 'After year 1: raise at least $22,500 annually or pay $2,000 min fee',
    administersGovGrants: 'YES',
    federalGrantCapability: 'Publishes government-grant administration services',
    samUeiStatus: 'Active SAM.gov entity registration & verified UEI number',
    contactChannel: 'info@communitypartners.org',
    verificationStatus: 'VERIFIED_OFFICIAL',
    identityVerified: 'CONFIRMED',
    websiteVerified: 'CONFIRMED',
    sponsorshipModelsVerified: 'CONFIRMED',
    governmentGrantAdministrationVerified: 'CONFIRMED',
    feeVerified: 'CONFIRMED',
    leadTimeVerified: 'CONFIRMED',
    opportunitySpecificCompatibility: 'HUMAN_CONFIRMATION_REQUIRED',
    verificationLevel: 'SEED_FIXTURE',
    isFixture: true,
    lastVerifiedTimestamp: new Date(),
    internalNotes: 'Community Partners offers Model A & Model C. Concerns: Model A does not accept projects where housing is a key element; Model C does not accept government cost-reimbursement projects.',
  };

  const existingSponsor1 = await prisma.fiscalSponsorCandidate.findUnique({
    where: { id: 'sponsor-community-partners-la' },
  });

  const sponsor1 = await prisma.fiscalSponsorCandidate.upsert({
    where: { id: 'sponsor-community-partners-la' },
    update: {
      ...sponsor1Data,
      isFixture: true,
      hasLiveVerification: existingSponsor1?.hasLiveVerification ?? false,
      lastVerifiedTimestamp: existingSponsor1?.lastVerifiedTimestamp ?? sponsor1Data.lastVerifiedTimestamp,
    },
    create: {
      id: 'sponsor-community-partners-la',
      ...sponsor1Data,
      isFixture: true,
      hasLiveVerification: false,
      citations: {
        create: [
          {
            sourceUrl: 'https://portal.communitypartners.org/how-to-apply-new',
            quotedSection: 'Community Partners charges 9% on private revenue and 15% on public/government revenue. Projects must raise at least $22,500 annually or pay a $2,000 minimum fee after year 1.',
            extractedClaim: 'Verifies published 9% private / 15% public fee and $22,500 annual raise / $2,000 min fee requirements.',
            verificationLevel: 'SEED_FIXTURE',
          },
        ],
      },
    },
  });

  const sponsor2Data = {
    name: 'Community Initiatives',
    canonicalDomain: 'communityinitiatives.org',
    websiteUrl: 'https://communityinitiatives.org',
    directorySourceUrl: 'https://communityinitiatives.org/learn/fees-and-minimums/',
    geography: 'California Statewide (Northern & Southern California)',
    mission: 'Provides fiscal sponsorship and administrative infrastructure to community leaders and social impact initiatives.',
    populationsServed: ['Youth & young adults', 'Reentry communities', 'System-impacted populations'],
    modelsOffered: ['MODEL_A'],
    acceptingNewProjects: 'UNKNOWN',
    intakeStatus: 'UNKNOWN',
    intakeStatusVerifiedAt: null,
    applicationProcess: 'Inquiry form via https://communityinitiatives.org/get-started/',
    estimatedReviewTime: 'UNKNOWN',
    setupFee: 'UNKNOWN',
    adminPercentage: '10% gross receipts standard / 15% government funds',
    minRevenueRequirement: '$50,000 minimum annual fundraising / $5,000 minimum annual admin fee',
    administersGovGrants: 'YES',
    federalGrantCapability: 'Publishes government-grant administration services',
    samUeiStatus: 'Active SAM.gov registration & verified UEI',
    contactChannel: 'info@communityinitiatives.org',
    verificationStatus: 'VERIFIED_OFFICIAL',
    identityVerified: 'CONFIRMED',
    websiteVerified: 'CONFIRMED',
    sponsorshipModelsVerified: 'CONFIRMED',
    governmentGrantAdministrationVerified: 'CONFIRMED',
    feeVerified: 'CONFIRMED',
    leadTimeVerified: 'UNKNOWN',
    opportunitySpecificCompatibility: 'HUMAN_CONFIRMATION_REQUIRED',
    verificationLevel: 'SEED_FIXTURE',
    isFixture: true,
    lastVerifiedTimestamp: new Date(),
    internalNotes: 'Community Initiatives offers Model A comprehensive sponsorship with 10% standard / 15% government fee and $50,000 annual fundraising / $5,000 min admin fee.',
  };

  const existingSponsor2 = await prisma.fiscalSponsorCandidate.findUnique({
    where: { id: 'sponsor-community-initiatives-sf' },
  });

  const sponsor2 = await prisma.fiscalSponsorCandidate.upsert({
    where: { id: 'sponsor-community-initiatives-sf' },
    update: {
      ...sponsor2Data,
      isFixture: true,
      hasLiveVerification: existingSponsor2?.hasLiveVerification ?? false,
      lastVerifiedTimestamp: existingSponsor2?.lastVerifiedTimestamp ?? sponsor2Data.lastVerifiedTimestamp,
    },
    create: {
      id: 'sponsor-community-initiatives-sf',
      ...sponsor2Data,
      isFixture: true,
      hasLiveVerification: false,
      citations: {
        create: [
          {
            sourceUrl: 'https://communityinitiatives.org/learn/fees-and-minimums/',
            quotedSection: 'Community Initiatives standard administrative fee is 10% of gross receipts, 15% for government funds, with a $50,000 minimum annual fundraising requirement and $5,000 minimum annual administrative fee.',
            extractedClaim: 'Verifies published 10% standard / 15% government fee and $50k annual fundraising / $5k min fee.',
            verificationLevel: 'SEED_FIXTURE',
          },
        ],
      },
    },
  });
  // 5. Phase 1E — Strategic Partners Seed
  const partner1 = await prisma.strategicPartnerCandidate.upsert({
    where: { id: 'partner-riverside-coc' },
    update: { verificationStatus: 'FUTURE_EXPANSION' },
    create: {
      id: 'partner-riverside-coc',
      name: 'Riverside County Continuum of Care (CoC CA-608)',
      organizationType: 'CONTINUUM_OF_CARE',
      websiteUrl: 'https://rivcocob.org/coc',
      geography: 'Riverside County / Inland Empire',
      mission: 'Coordinates housing and supportive services for unhoused individuals and youth in Riverside County.',
      servicesOffered: ['Emergency shelter', 'Coordinated entry system', 'Youth housing placement'],
      collaborationFocus: 'Subrecipient partnership & coordinated youth outreach (Future Expansion)',
      contactChannel: 'coc@rivco.org',
      verificationStatus: 'FUTURE_EXPANSION',
      lastVerified: new Date(),
      internalNotes: 'Regional CoC partner retained for future expansion. Out of active launch footprint.',
    },
  });

  const partner2 = await prisma.strategicPartnerCandidate.upsert({
    where: { id: 'partner-sbvc-applied-tech' },
    update: { verificationStatus: 'FUTURE_EXPANSION' },
    create: {
      id: 'partner-sbvc-applied-tech',
      name: 'San Bernardino Valley College — Division of Applied Technology',
      organizationType: 'COMMUNITY_COLLEGE',
      websiteUrl: 'https://www.valleycollege.edu/academics/applied-technology/',
      geography: 'San Bernardino County / Inland Empire',
      mission: 'Provides vocational certification and apprenticeship training in automotive, welding, HVAC, and trades.',
      servicesOffered: ['Vocational training', 'Apprenticeship certifications', 'Industry credentials'],
      collaborationFocus: 'Technical education subrecipient & career pathway referral partner (Future Expansion)',
      contactChannel: 'appliedtech@valleycollege.edu',
      verificationStatus: 'FUTURE_EXPANSION',
      lastVerified: new Date(),
      internalNotes: 'Key academic partner retained for future expansion. Out of active launch footprint.',
    },
  });

  // 6. Phase 1E — Recurring Grant Calendar Items Seed
  await prisma.grantCalendarItem.upsert({
    where: { id: 'calendar-item-sop-2027' },
    update: {},
    create: {
      id: 'calendar-item-sop-2027',
      opportunityTitle: 'HHS ACF Street Outreach Program (SOP) Annual Grant',
      agency: 'HHS Administration for Children and Families (ACYF)',
      forecastedPostDate: new Date('2027-05-15T00:00:00Z'),
      deadline: new Date('2027-07-15T00:00:00Z'),
      priorCycleDates: ['2024-07-10', '2025-07-22', '2026-08-17'],
      recurrenceConfidence: 'HISTORICALLY_RECURRING',
      expectedNextCyclePrepDate: new Date('2027-02-15T00:00:00Z'),
      recurrenceEvidenceSource: 'https://www.grants.gov/search-results-detail/362088',
      notes: 'Annual recurring federal grant solicitation (Detail ID 362088). Preparation must begin 90-120 days prior to anticipated May 2027 post date.',
    },
  });

  await prisma.grantCalendarItem.upsert({
    where: { id: 'calendar-item-cwdb-2027' },
    update: {},
    create: {
      id: 'calendar-item-cwdb-2027',
      opportunityTitle: 'California CWDB Reentry Pathways & High Road Training Partnership',
      agency: 'California Labor & Workforce Development Agency / CWDB',
      forecastedPostDate: new Date('2027-03-01T00:00:00Z'),
      deadline: new Date('2027-05-01T00:00:00Z'),
      priorCycleDates: ['2025-04-15', '2026-04-30'],
      recurrenceConfidence: 'CONFIRMED_FORECAST',
      expectedNextCyclePrepDate: new Date('2026-12-01T00:00:00Z'),
      recurrenceEvidenceSource: 'https://cwdb.ca.gov/initiatives/hrtp/',
      notes: 'Statewide California workforce initiative funding community-based reentry and trades education.',
    },
  });

  console.log('✅ Phase 1E Fiscal Sponsors, Partners, and Calendar Items Seeded Successfully!');
  console.log(` seeded records:
  - Organization: ${orgProfile.name}
  - Opportunities:
    1. ${opp1.title} (Status: ${opp1.status})
    2. ${opp2.title} (Status: ${opp2.status})
    3. ${opp3.title} (Status: ${opp3.status})
  - Fiscal Sponsors: ${sponsor1.name}, ${sponsor2.name}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
