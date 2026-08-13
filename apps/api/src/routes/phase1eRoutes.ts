import { Router, Request, Response } from 'express';
import { FiscalSponsorService } from '../services/fiscalSponsorService';
import { StrategicPartnerService } from '../services/strategicPartnerService';
import { ReadinessPlanService } from '../services/readinessPlanService';
import { GrantCalendarService } from '../services/grantCalendarService';
import { OutreachBriefingService } from '../services/outreachBriefingService';
import { SponsorDiscoveryService } from '../services/sponsorDiscoveryService';
import { calculateSopMatchRequirement } from '../services/sopMatchCalculator';
import { SponsorMatchStatus, RecurrenceConfidence, PlanTaskStatus } from '@prisma/client';

export const phase1eRouter = Router();

// --- Fiscal Sponsor Directory & Matching ---

// POST /api/fiscal-sponsors/discovery
phase1eRouter.post('/fiscal-sponsors/discovery', async (req: Request, res: Response) => {
  try {
    const result = await SponsorDiscoveryService.runDiscovery(req.body);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/sop-match-calculator
phase1eRouter.get('/sop-match-calculator', async (req: Request, res: Response) => {
  try {
    const awardAmount = req.query.awardAmount ? Number(req.query.awardAmount) : 150000;
    const calc = calculateSopMatchRequirement(awardAmount);
    res.json({ success: true, data: calc });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/fiscal-sponsors
phase1eRouter.get('/fiscal-sponsors', async (req: Request, res: Response) => {
  try {
    const { verificationStatus, acceptingNewProjects, isFixture } = req.query;
    const candidates = await FiscalSponsorService.listCandidates({
      verificationStatus: verificationStatus as string,
      acceptingNewProjects: acceptingNewProjects as string,
      isFixture: isFixture !== undefined ? isFixture === 'true' : undefined,
    });
    res.json({ success: true, count: candidates.length, data: candidates });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/fiscal-sponsors
phase1eRouter.post('/fiscal-sponsors', async (req: Request, res: Response) => {
  try {
    const candidate = await FiscalSponsorService.createCandidate(req.body);
    res.status(201).json({ success: true, data: candidate });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/fiscal-sponsors/matches/:opportunityId
phase1eRouter.get('/fiscal-sponsors/matches/:opportunityId', async (req: Request, res: Response) => {
  try {
    const matches = await FiscalSponsorService.matchOpportunityToSponsors(req.params.opportunityId);
    res.json({ success: true, count: matches.length, data: matches });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET & POST /api/opportunities/:opportunityId/sponsor-matches
phase1eRouter.get('/opportunities/:opportunityId/sponsor-matches', async (req: Request, res: Response) => {
  try {
    const matches = await FiscalSponsorService.matchOpportunityToSponsors(req.params.opportunityId);
    res.json({ success: true, count: matches.length, data: matches });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

phase1eRouter.post('/opportunities/:opportunityId/sponsor-matches', async (req: Request, res: Response) => {
  try {
    const matches = await FiscalSponsorService.matchOpportunityToSponsors(req.params.opportunityId);
    res.json({ success: true, count: matches.length, data: matches });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/fiscal-sponsors/matches/:matchId/status
phase1eRouter.post('/fiscal-sponsors/matches/:matchId/status', async (req: Request, res: Response) => {
  try {
    const { targetStatus, reviewerId, notes } = req.body;
    const authHeader = req.headers.authorization;
    const updated = await FiscalSponsorService.transitionMatchStatus({
      matchId: req.params.matchId,
      targetStatus: targetStatus as SponsorMatchStatus,
      reviewerId,
      authHeader,
      notes,
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/fiscal-sponsors/:id/briefing
phase1eRouter.get('/fiscal-sponsors/:id/briefing', async (req: Request, res: Response) => {
  try {
    const { opportunityId } = req.query;
    const briefing = await OutreachBriefingService.generateSponsorBriefingPacket(
      req.params.id,
      opportunityId as string | undefined
    );
    res.json({ success: true, data: briefing });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Strategic Partner Directory & CoC Alignment ---

// POST /api/strategic-partners/discovery
phase1eRouter.post('/strategic-partners/discovery', async (_req: Request, res: Response) => {
  try {
    const result = await StrategicPartnerService.runDiscovery();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/strategic-partners
phase1eRouter.get('/strategic-partners', async (req: Request, res: Response) => {
  try {
    const { organizationType, verificationStatus, opportunityId, targetCounty } = req.query;
    const partners = await StrategicPartnerService.listPartners({
      organizationType: organizationType as string,
      verificationStatus: verificationStatus as string,
      opportunityId: opportunityId as string,
      targetCounty: targetCounty as string,
    });
    res.json({ success: true, count: partners.length, data: partners });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/strategic-partners
phase1eRouter.post('/strategic-partners', async (req: Request, res: Response) => {
  try {
    const partner = await StrategicPartnerService.runDiscovery();
    res.status(201).json({ success: true, data: partner });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET & POST /api/opportunities/:opportunityId/partner-matches
phase1eRouter.get('/opportunities/:opportunityId/partner-matches', async (req: Request, res: Response) => {
  try {
    const matches = await StrategicPartnerService.matchOpportunityToPartners(req.params.opportunityId);
    res.json({ success: true, count: matches.length, data: matches });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

phase1eRouter.post('/opportunities/:opportunityId/partner-matches', async (req: Request, res: Response) => {
  try {
    const matches = await StrategicPartnerService.matchOpportunityToPartners(req.params.opportunityId);
    res.json({ success: true, count: matches.length, data: matches });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/strategic-partners/matches/:matchId/status
phase1eRouter.post('/strategic-partners/matches/:matchId/status', async (req: Request, res: Response) => {
  try {
    const { targetStatus, reviewerId, notes } = req.body;
    const authHeader = req.headers.authorization;
    const updated = await StrategicPartnerService.transitionPartnerMatchStatus({
      matchId: req.params.matchId,
      targetStatus,
      reviewerId,
      authHeader,
      notes,
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// GET /api/strategic-partners/:id/briefing
phase1eRouter.get('/strategic-partners/:id/briefing', async (req: Request, res: Response) => {
  try {
    const { opportunityId, inquiryPurpose } = req.query;
    const briefing = await OutreachBriefingService.generatePartnerBriefingPacket(
      req.params.id,
      opportunityId as string | undefined,
      (inquiryPurpose as any) || 'GRANT_COMPETITION'
    );
    res.json({ success: true, data: briefing });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Readiness Plans ---

// GET /api/readiness-plans
phase1eRouter.get('/readiness-plans', async (_req: Request, res: Response) => {
  try {
    const plans = await ReadinessPlanService.listPlans();
    res.json({ success: true, count: plans.length, data: plans });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/readiness-plans/opportunity/:opportunityId
phase1eRouter.get('/readiness-plans/opportunity/:opportunityId', async (req: Request, res: Response) => {
  try {
    const plan = await ReadinessPlanService.getOrGeneratePlan(req.params.opportunityId);
    res.json({ success: true, data: plan });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// POST /api/readiness-plans/tasks/:taskId/status
phase1eRouter.post('/readiness-plans/tasks/:taskId/status', async (req: Request, res: Response) => {
  try {
    const { targetStatus, actorId, notes } = req.body;
    const updated = await ReadinessPlanService.updateTaskStatus({
      taskId: req.params.taskId,
      targetStatus: targetStatus as PlanTaskStatus,
      actorId: actorId || 'human-reviewer-admin-01',
      notes,
    });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- Recurring Grant Calendar ---

// GET /api/grant-calendar
phase1eRouter.get('/grant-calendar', async (_req: Request, res: Response) => {
  try {
    const items = await GrantCalendarService.listCalendarItems();
    res.json({ success: true, count: items.length, data: items });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/grant-calendar
phase1eRouter.post('/grant-calendar', async (req: Request, res: Response) => {
  try {
    const item = await GrantCalendarService.createCalendarItem(req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
