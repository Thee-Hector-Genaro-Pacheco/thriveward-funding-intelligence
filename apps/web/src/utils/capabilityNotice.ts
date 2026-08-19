export function deriveCapabilityNotice(
  isIngestionEnabled: boolean = false,
  isGroundingEnabled: boolean = false
): string {
  if (isIngestionEnabled && isGroundingEnabled) {
    return 'Document upload and indexing are enabled in this environment. Verify critical requirements against the original PDF.';
  }
  if (isIngestionEnabled) {
    return 'Document upload is enabled, but vector indexing is disabled; existing indexed evidence remains available.';
  }
  if (isGroundingEnabled) {
    return 'New document upload is disabled, but vector indexing is enabled; existing indexed evidence remains available.';
  }
  return 'New document upload and indexing are disabled; existing indexed evidence remains available for grounded review.';
}
