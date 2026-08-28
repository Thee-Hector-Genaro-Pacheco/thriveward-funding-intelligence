import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiEvaluationPanel, AiEvaluationData } from '../AiEvaluationPanel';

describe('AiEvaluationPanel Component Attribution Suite', () => {
  const dummyUser = { id: 'usr-1', displayName: 'Admin User', role: 'ADMIN' };

  it('renders "Provider not reported" and "Model not reported" when metadata is missing', () => {
    const mockEval: AiEvaluationData = {
      id: 'eval-101',
      opportunityId: 'opp-101',
      version: 1,
      status: 'GENERATED',
      alignmentScore: 65,
      eligibility: 'UNLIKELY_ELIGIBLE',
      summary: 'Summary text',
      strengths: [],
      risks: [],
      requirements: [],
      recommendedNextAction: 'Action',
      confidence: 0.85,
      limitations: [],
      evidenceSnapshot: [],
      inputSnapshot: {},
      promptVersion: 'funding-analyst-v1',
      createdAt: new Date().toISOString(),
      provider: undefined,
      model: undefined,
    };

    render(
      <AiEvaluationPanel
        evaluations={[mockEval]}
        currentUser={dummyUser}
        isAiConfigured={true}
        onGenerateAiAnalysis={vi.fn()}
        onReviewAiAnalysis={vi.fn()}
        generating={false}
        error={null}
      />
    );

    expect(screen.getByText('Provider not reported')).toBeInTheDocument();
    expect(screen.getByText('Model not reported')).toBeInTheDocument();
    expect(screen.queryByText('gpt-5.6-luna')).not.toBeInTheDocument();
  });

  it('renders saved provider and model metadata when present', () => {
    const mockEval: AiEvaluationData = {
      id: 'eval-102',
      opportunityId: 'opp-101',
      version: 2,
      status: 'GENERATED',
      alignmentScore: 85,
      eligibility: 'LIKELY_ELIGIBLE',
      summary: 'Grounded summary',
      strengths: [],
      risks: [],
      requirements: [],
      recommendedNextAction: 'Action',
      confidence: 0.9,
      limitations: [],
      evidenceSnapshot: [],
      inputSnapshot: {},
      promptVersion: 'funding-analyst-document-grounded-v1',
      createdAt: new Date().toISOString(),
      provider: 'DETERMINISTIC_MOCK',
      model: 'deterministic-mock-v1',
    };

    render(
      <AiEvaluationPanel
        evaluations={[mockEval]}
        currentUser={dummyUser}
        isAiConfigured={true}
        onGenerateAiAnalysis={vi.fn()}
        onReviewAiAnalysis={vi.fn()}
        generating={false}
        error={null}
      />
    );

    expect(screen.getByText('DETERMINISTIC_MOCK')).toBeInTheDocument();
    expect(screen.getByText('deterministic-mock-v1')).toBeInTheDocument();
    expect(screen.queryByText('gpt-5.6-luna')).not.toBeInTheDocument();
  });

  it('warns and gates review decisions when a grounded evaluation uses stale organization readiness', () => {
    const onReview = vi.fn().mockResolvedValue(undefined);
    const staleEvaluation: AiEvaluationData = {
      id: 'eval-stale-grounded',
      opportunityId: 'opp-bja',
      version: 1,
      status: 'GENERATED',
      alignmentScore: 70,
      eligibility: 'UNLIKELY_ELIGIBLE',
      summary: 'Historical grounded summary',
      strengths: [],
      risks: [],
      requirements: [],
      recommendedNextAction: 'Re-analyze against current readiness',
      confidence: 0.8,
      limitations: [],
      evidenceSnapshot: [{ id: 'ORG.formationStatus', category: 'ORGANIZATION', label: 'Formation', value: 'PRE_INCORPORATION' }],
      inputSnapshot: { organization: { name: 'Project Thriveward' } },
      promptVersion: 'funding-analyst-document-grounded-v1',
      createdAt: '2026-08-01T10:00:00Z',
    };

    render(
      <AiEvaluationPanel
        evaluations={[staleEvaluation]}
        currentUser={dummyUser}
        isAiConfigured={true}
        onGenerateAiAnalysis={vi.fn()}
        onReviewAiAnalysis={onReview}
        generating={false}
        error={null}
        organizationReadiness={{
          status: 'INCORPORATED',
          californiaIncorporation: 'VERIFIED',
          samGovUeiStatus: 'NOT_REGISTERED',
          grantsGovStatus: 'NOT_REGISTERED',
        }}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('This evaluation was generated using an earlier organization profile');
    expect(screen.getByRole('alert')).toHaveTextContent('Current organization readiness has changed');
    expect(screen.getByRole('alert')).toHaveTextContent('INCORPORATED — REGISTRATIONS PENDING');

    const approveButton = screen.getByRole('button', { name: /Approve AI Evaluation/i });
    const rejectButton = screen.getByRole('button', { name: /Reject AI Evaluation/i });
    expect(approveButton).toBeDisabled();
    expect(rejectButton).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /I acknowledge that this grounded evaluation/i }));
    expect(approveButton).not.toBeDisabled();
    expect(rejectButton).not.toBeDisabled();
    expect(onReview).not.toHaveBeenCalled();
  });

  describe('AI-2C Grounding Source Selection Suite', () => {
    const mockVersions = [
      {
        id: 'ver-ready-v1',
        version: 1,
        documentType: 'OFFICIAL_NOTICE',
        title: 'HUD NOFO v1 Guidelines',
        status: 'READY',
        isIndexReady: true,
        createdAt: '2026-08-01T10:00:00Z',
      },
      {
        id: 'ver-ready-v2',
        version: 2,
        documentType: 'OFFICIAL_NOTICE',
        title: 'HUD NOFO v2 Amended Guidelines',
        status: 'READY',
        isIndexReady: true,
        createdAt: '2026-08-10T10:00:00Z',
      },
      {
        id: 'ver-unready-v3',
        version: 3,
        documentType: 'OFFICIAL_NOTICE',
        title: 'HUD NOFO v3 Draft',
        status: 'PROCESSING',
        isIndexReady: false,
        createdAt: '2026-08-15T10:00:00Z',
      },
    ];

    it('initial render has no selected version, renders placeholder, and disables analyze button', () => {
      const handleGrounded = vi.fn().mockResolvedValue(undefined);

      render(
        <AiEvaluationPanel
          evaluations={[]}
          currentUser={dummyUser}
          isAiConfigured={true}
          isGroundingEnabled={true}
          documentVersions={mockVersions}
          onGenerateAiAnalysis={vi.fn()}
          onGenerateGroundedAiAnalysis={handleGrounded}
          onReviewAiAnalysis={vi.fn()}
          generating={false}
          error={null}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('');
      expect(screen.getByText('Select source document version…')).toBeInTheDocument();

      const groundedBtn = screen.getByRole('button', { name: /Analyze with Official Notice/i });
      expect(groundedBtn).toBeDisabled();

      fireEvent.click(groundedBtn);
      expect(handleGrounded).not.toHaveBeenCalled();
    });

    it('enables analyze button upon selecting Version A and passes Version A exact ID', () => {
      const handleGrounded = vi.fn().mockResolvedValue(undefined);

      render(
        <AiEvaluationPanel
          evaluations={[]}
          currentUser={dummyUser}
          isAiConfigured={true}
          isGroundingEnabled={true}
          documentVersions={mockVersions}
          onGenerateAiAnalysis={vi.fn()}
          onGenerateGroundedAiAnalysis={handleGrounded}
          onReviewAiAnalysis={vi.fn()}
          generating={false}
          error={null}
        />
      );

      const select = screen.getByRole('combobox');
      expect(select).toHaveValue('');

      // Select Version A (ver-ready-v1)
      fireEvent.change(select, { target: { value: 'ver-ready-v1' } });
      expect(select).toHaveValue('ver-ready-v1');

      const groundedBtn = screen.getByRole('button', { name: /Analyze with Official Notice/i });
      expect(groundedBtn).not.toBeDisabled();

      fireEvent.click(groundedBtn);
      expect(handleGrounded).toHaveBeenCalledTimes(1);
      expect(handleGrounded).toHaveBeenCalledWith('ver-ready-v1');
    });

    it('changing selection to Version B passes Version B exact ID', () => {
      const handleGrounded = vi.fn().mockResolvedValue(undefined);

      render(
        <AiEvaluationPanel
          evaluations={[]}
          currentUser={dummyUser}
          isAiConfigured={true}
          isGroundingEnabled={true}
          documentVersions={mockVersions}
          onGenerateAiAnalysis={vi.fn()}
          onGenerateGroundedAiAnalysis={handleGrounded}
          onReviewAiAnalysis={vi.fn()}
          generating={false}
          error={null}
        />
      );

      const select = screen.getByRole('combobox');

      // Select Version B (ver-ready-v2)
      fireEvent.change(select, { target: { value: 'ver-ready-v2' } });
      expect(select).toHaveValue('ver-ready-v2');

      const groundedBtn = screen.getByRole('button', { name: /Analyze with Official Notice/i });
      fireEvent.click(groundedBtn);

      expect(handleGrounded).toHaveBeenCalledTimes(1);
      expect(handleGrounded).toHaveBeenCalledWith('ver-ready-v2');
    });

    it('disables unready options in dropdown and prevents submission', () => {
      const handleGrounded = vi.fn().mockResolvedValue(undefined);

      render(
        <AiEvaluationPanel
          evaluations={[]}
          currentUser={dummyUser}
          isAiConfigured={true}
          isGroundingEnabled={true}
          documentVersions={mockVersions}
          onGenerateAiAnalysis={vi.fn()}
          onGenerateGroundedAiAnalysis={handleGrounded}
          onReviewAiAnalysis={vi.fn()}
          generating={false}
          error={null}
        />
      );

      const unreadyOption = screen.getByText(/HUD NOFO v3 Draft — Not Ready/i) as HTMLOptionElement;
      expect(unreadyOption.disabled).toBe(true);

      const groundedBtn = screen.getByRole('button', { name: /Analyze with Official Notice/i });
      expect(groundedBtn).toBeDisabled();
      expect(handleGrounded).not.toHaveBeenCalled();
    });
  });
});
