import { describe, it, expect } from 'vitest';
import { deriveCapabilityNotice } from '../capabilityNotice';

describe('capabilityNotice helper suite', () => {
  it('1. returns exact enabled notice when both ingestion and grounding are true', () => {
    const notice = deriveCapabilityNotice(true, true);
    expect(notice).toBe(
      'Document upload and indexing are enabled in this environment. Verify critical requirements against the original PDF.'
    );
  });

  it('2. returns ingestion-only notice when ingestion is true and grounding is false', () => {
    const notice = deriveCapabilityNotice(true, false);
    expect(notice).toBe(
      'Document upload is enabled, but vector indexing is disabled; existing indexed evidence remains available.'
    );
  });

  it('3. returns grounding-only notice when ingestion is false and grounding is true', () => {
    const notice = deriveCapabilityNotice(false, true);
    expect(notice).toBe(
      'New document upload is disabled, but vector indexing is enabled; existing indexed evidence remains available.'
    );
  });

  it('4. returns disabled notice when both ingestion and grounding are false', () => {
    const notice = deriveCapabilityNotice(false, false);
    expect(notice).toBe(
      'New document upload and indexing are disabled; existing indexed evidence remains available for grounded review.'
    );
  });
});
