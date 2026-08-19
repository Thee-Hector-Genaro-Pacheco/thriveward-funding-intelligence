import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfficialFundingDocuments } from '../OfficialFundingDocuments';

describe('OfficialFundingDocuments Capability Notice Component Suite', () => {
  const dummyUser = { id: 'usr-1', displayName: 'Admin User', role: 'ADMIN' };
  const mockApiFetch = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )
  );

  it('1. renders enabled notice when both isIngestionEnabled and isGroundingEnabled are true', () => {
    render(
      <OfficialFundingDocuments
        opportunityId="opp-1"
        currentUser={dummyUser}
        apiFetch={mockApiFetch}
        isIngestionEnabled={true}
        isGroundingEnabled={true}
      />
    );

    expect(
      screen.getByText(
        /Document upload and indexing are enabled in this environment. Verify critical requirements against the original PDF./i
      )
    ).toBeInTheDocument();
  });

  it('2. renders ingestion-only notice when isIngestionEnabled=true and isGroundingEnabled=false', () => {
    render(
      <OfficialFundingDocuments
        opportunityId="opp-1"
        currentUser={dummyUser}
        apiFetch={mockApiFetch}
        isIngestionEnabled={true}
        isGroundingEnabled={false}
      />
    );

    expect(
      screen.getByText(
        /Document upload is enabled, but vector indexing is disabled; existing indexed evidence remains available./i
      )
    ).toBeInTheDocument();
  });

  it('3. renders grounding-only notice when isIngestionEnabled=false and isGroundingEnabled=true', () => {
    render(
      <OfficialFundingDocuments
        opportunityId="opp-1"
        currentUser={dummyUser}
        apiFetch={mockApiFetch}
        isIngestionEnabled={false}
        isGroundingEnabled={true}
      />
    );

    expect(
      screen.getByText(
        /New document upload is disabled, but vector indexing is enabled; existing indexed evidence remains available./i
      )
    ).toBeInTheDocument();
  });

  it('4. renders disabled notice when both isIngestionEnabled and isGroundingEnabled are false', () => {
    render(
      <OfficialFundingDocuments
        opportunityId="opp-1"
        currentUser={dummyUser}
        apiFetch={mockApiFetch}
        isIngestionEnabled={false}
        isGroundingEnabled={false}
      />
    );

    expect(
      screen.getByText(
        /New document upload and indexing are disabled; existing indexed evidence remains available for grounded review./i
      )
    ).toBeInTheDocument();
  });
});
