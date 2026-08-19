import { describe, it, expect } from 'vitest';
import { formatProviderModelAttribution } from '../aiAttribution';

describe('aiAttribution helper suite', () => {
  it('renders provided metadata honestly when present', () => {
    const result = formatProviderModelAttribution('DETERMINISTIC_MOCK', 'deterministic-mock-v1');
    expect(result.provider).toBe('DETERMINISTIC_MOCK');
    expect(result.model).toBe('deterministic-mock-v1');
    expect(result.displayText).toBe('Provider: DETERMINISTIC_MOCK | Model: deterministic-mock-v1');
  });

  it('renders neutral fallbacks when provider or model are missing/empty', () => {
    const result1 = formatProviderModelAttribution(undefined, undefined);
    expect(result1.provider).toBe('Provider not reported');
    expect(result1.model).toBe('Model not reported');

    const result2 = formatProviderModelAttribution('', '   ');
    expect(result2.provider).toBe('Provider not reported');
    expect(result2.model).toBe('Model not reported');
  });

  it('never introduces gpt-5.6-luna as a fallback when metadata is missing', () => {
    const result = formatProviderModelAttribution(null, null);
    expect(result.model).not.toContain('gpt-5.6-luna');
    expect(result.model).toBe('Model not reported');
  });
});
