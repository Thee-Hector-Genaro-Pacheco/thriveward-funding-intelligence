export interface OrganizationReadinessSummary {
  status?: string | null;
  formationStatus?: string | null;
  californiaIncorporation?: string | null;
  samGovUeiStatus?: string | null;
  grantsGovStatus?: string | null;
}

export function normalizeReadinessStatus(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.trim().toUpperCase().replace(/[\s-]+/g, '_');
}

export function getCurrentReadinessLabel(readiness: OrganizationReadinessSummary | null): string {
  if (!readiness) return 'VERIFYING CURRENT STATE';
  const currentStatus = normalizeReadinessStatus(readiness.status || readiness.formationStatus);
  const incorporated = currentStatus === 'INCORPORATED' || readiness.californiaIncorporation === 'VERIFIED';
  if (!incorporated) return currentStatus || 'UNKNOWN';
  const registrationsPending = readiness.samGovUeiStatus !== 'REGISTERED'
    || readiness.grantsGovStatus !== 'REGISTERED';
  return registrationsPending ? 'INCORPORATED — REGISTRATIONS PENDING' : 'INCORPORATED';
}

export function getAnalysisFormationStatus(profileSnapshot: any): string | null {
  return profileSnapshot?.status
    || profileSnapshot?.formationStatus
    || profileSnapshot?.organizationStage
    || null;
}

export function getEvaluationFormationStatus(inputSnapshot: any, evidenceSnapshot?: any): string | null {
  const operatingHistory = inputSnapshot?.evidenceCatalog?.find(
    (item: any) => item?.id === 'ORG.operatingHistory'
  )?.value || evidenceSnapshot?.find?.(
    (item: any) => item?.id === 'ORG.operatingHistory'
  )?.value;
  const historicalLimitations = inputSnapshot?.organization?.limitations;
  const containsHistoricalPreIncorporationState = /PRE[_ -]INCORPORATION/i.test(
    [
      typeof operatingHistory === 'string' ? operatingHistory : '',
      ...(Array.isArray(historicalLimitations) ? historicalLimitations : []),
    ].join(' ')
  );

  if (containsHistoricalPreIncorporationState) return 'PRE_INCORPORATION';

  const snapshotStatus = inputSnapshot?.organization?.status
    || inputSnapshot?.organization?.formationStatus
    || inputSnapshot?.evidenceCatalog?.find((item: any) => item?.id === 'ORG.formationStatus')?.value
    || evidenceSnapshot?.find?.((item: any) => item?.id === 'ORG.formationStatus')?.value
    || null;
  return normalizeReadinessStatus(snapshotStatus);
}

export function hasStaleReadinessState(
  readiness: OrganizationReadinessSummary | null,
  analysisFormationStatus: string | null,
  persistedBlockingReason?: string | null
): boolean {
  const currentStatus = normalizeReadinessStatus(readiness?.status || readiness?.formationStatus)
    || (readiness?.californiaIncorporation === 'VERIFIED' ? 'INCORPORATED' : null);
  if (!currentStatus) return false;
  const normalizedAnalysisStatus = normalizeReadinessStatus(analysisFormationStatus);
  if (normalizedAnalysisStatus && normalizedAnalysisStatus !== currentStatus) return true;
  return currentStatus === 'INCORPORATED' && /PRE[_-]INCORPORATION/i.test(persistedBlockingReason || '');
}
