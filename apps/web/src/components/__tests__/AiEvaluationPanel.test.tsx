import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
