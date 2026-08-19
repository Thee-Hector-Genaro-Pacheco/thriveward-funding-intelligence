export function formatProviderModelAttribution(
  provider?: string | null,
  model?: string | null
) {
  const displayProvider = provider && provider.trim() ? provider.trim() : 'Provider not reported';
  const displayModel = model && model.trim() ? model.trim() : 'Model not reported';
  return {
    provider: displayProvider,
    model: displayModel,
    displayText: `Provider: ${displayProvider} | Model: ${displayModel}`,
  };
}
