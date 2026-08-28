import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

describe('App BJA stale grounded evaluation flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes current readiness into the detail panel and gates the historical BJA evaluation', async () => {
    const opportunity = {
      id: '384fe777-5794-4562-bf97-f1beac40b7fc',
      fundingOpportunityNumber: 'O-BJA-2026-172698',
      title: 'BJA FY 2026 Second Chance Act Improving Reentry Education and Employment Outcomes',
      fundingAgency: 'Department of Justice, Bureau of Justice Assistance',
      geography: 'United States',
      description: 'Official BJA opportunity',
      sourceUrl: 'https://example.invalid/bja',
      status: 'OPEN',
      isDemo: false,
      pursuitStage: 'NEW',
      candidateRoutingStatus: 'FUTURE_OPPORTUNITY',
      dismissedReason: 'NEEDS_REGISTRATIONS',
      opportunityAnalyses: [],
      relevanceAnalyses: [],
      opportunityMatches: [],
    };
    // Mirrors the Prisma-backed GET /ai-evaluations shape for the real BJA
    // evaluation, including its conflicting historical organization evidence.
    const evaluation = {
      id: 'ffbff17f-7f73-4067-b765-fbcb22e89cca',
      opportunityId: opportunity.id,
      version: 1,
      status: 'GENERATED',
      alignmentScore: 70,
      eligibility: 'UNLIKELY_ELIGIBLE',
      summary: 'Historical pre-incorporation evaluation',
      strengths: [],
      risks: [],
      requirements: [],
      recommendedNextAction: 'Complete registration pathway',
      confidence: 0.8,
      limitations: ['Historical organization profile'],
      evidenceSnapshot: [
        { id: 'ORG.formationStatus', category: 'ORGANIZATION', label: 'Organization Formation Status', value: 'INCORPORATED' },
        { id: 'ORG.operatingHistory', category: 'ORGANIZATION', label: 'Operating History', value: 'Pre-incorporation pilot stage. No past federal grant history or 501(c)(3) determination.' },
      ],
      inputSnapshot: {
        organization: {
          name: 'Project Thriveward',
          status: 'INCORPORATED',
          limitations: [],
        },
        evidenceCatalog: [
          { id: 'ORG.formationStatus', category: 'ORGANIZATION', label: 'Organization Formation Status', value: 'INCORPORATED' },
          { id: 'ORG.operatingHistory', category: 'ORGANIZATION', label: 'Operating History', value: 'Pre-incorporation pilot stage. No past federal grant history or 501(c)(3) determination.' },
        ],
        promptVersion: 'funding-analyst-document-grounded-v1',
      },
      provider: 'OPENAI',
      model: 'gpt-5.6-luna',
      promptVersion: 'funding-analyst-document-grounded-v1',
      createdAt: '2026-08-01T10:00:00Z',
      reviewedByUserId: null,
      reviewedByUser: null,
      reviewedAt: null,
      reviewReason: null,
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/api/auth/me') return jsonResponse({ success: true, user: { id: 'user-admin', role: 'ADMIN', displayName: 'Admin' } });
      if (url === '/api/health') return jsonResponse({ integrations: { database: { healthy: true }, fundingAgent: { status: 'UP' } } });
      if (url === '/api/organization/readiness') return jsonResponse({
        success: true,
        data: {
          status: 'INCORPORATED',
          californiaIncorporation: 'VERIFIED',
          samGovUeiStatus: 'NOT_REGISTERED',
          grantsGovStatus: 'NOT_REGISTERED',
        },
      });
      if (url.startsWith('/api/opportunities?')) return jsonResponse({ success: true, data: [opportunity] });
      if (url === `/api/opportunities/${opportunity.id}`) return jsonResponse(opportunity);
      if (url === `/api/opportunities/${opportunity.id}/ai-evaluations`) return jsonResponse({ success: true, data: [evaluation] });
      if (url === `/api/opportunities/${opportunity.id}/funding-documents`) return jsonResponse({ success: true, data: [] });
      if (url === `/api/opportunities/${opportunity.id}/analysis`) return jsonResponse({ currentAnalysis: null });
      if (url === `/api/opportunities/${opportunity.id}/sponsor-matches`) return jsonResponse({ data: [] });
      return jsonResponse({ success: true, data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /Review Details/i }));

    const warning = await screen.findByRole('alert');
    expect(warning).toHaveTextContent('This evaluation was generated using an earlier organization profile');
    expect(warning).toHaveTextContent('Current organization readiness has changed');
    expect(warning).toHaveTextContent('INCORPORATED — REGISTRATIONS PENDING');

    const approveButton = screen.getByRole('button', { name: /Approve AI Evaluation/i });
    const rejectButton = screen.getByRole('button', { name: /Reject AI Evaluation/i });
    expect(approveButton).toBeDisabled();
    expect(rejectButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /I acknowledge that this grounded evaluation/i }));
    await waitFor(() => {
      expect(approveButton).not.toBeDisabled();
      expect(rejectButton).not.toBeDisabled();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/organization/readiness', expect.objectContaining({ credentials: 'include' }));
  });
});
