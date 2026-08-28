import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { AiFundingAnalystService } from '../services/aiFundingAnalystService';
import { DocumentIndexingService } from '../services/documentIndexingService';
import { OrganizationProfileService, OrganizationReadinessSnapshot } from '../services/organizationProfileService';

export const healthRouter = Router();

export function buildHealthOrganizationStatus(readiness: OrganizationReadinessSnapshot | null) {
  return {
    name: readiness?.organizationName || 'UNKNOWN',
    status: readiness?.formationStatus || 'UNKNOWN',
    taxStatus: readiness?.taxStatus || 'UNKNOWN',
    irs501c3Status: readiness?.irs501c3Status || 'UNKNOWN',
    einStatus: readiness?.einStatus || 'UNKNOWN',
    californiaIncorporation: readiness?.californiaIncorporation || 'UNKNOWN',
    californiaTaxExemption: readiness?.californiaTaxExemption || 'UNKNOWN',
    si100Status: readiness?.si100Status || 'UNKNOWN',
    californiaCharitableRegistration: readiness?.californiaCharitableRegistration || 'UNKNOWN',
    samGovUeiStatus: readiness?.samGovUeiStatus || 'UNKNOWN',
    grantsGovStatus: readiness?.grantsGovStatus || 'UNKNOWN',
  };
}

healthRouter.get('/', async (req: Request, res: Response) => {
  const pythonAgentUrl = process.env.FUNDING_AGENT_URL || 'http://localhost:8000';
  let pythonAgentStatus = 'UNKNOWN';
  let dbStatus = 'UNKNOWN';
  let isDbHealthy = false;
  let readiness: OrganizationReadinessSnapshot | null = null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const resp = await fetch(`${pythonAgentUrl}/health`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (resp.ok) {
      const data = (await resp.json()) as { status?: string };
      pythonAgentStatus = data.status || 'UP';
    } else {
      pythonAgentStatus = `DOWN (HTTP ${resp.status})`;
    }
  } catch (err: any) {
    pythonAgentStatus = `UNREACHABLE (${err.message || 'Offline'})`;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    const oppCount = await prisma.fundingOpportunity.count();
    readiness = await OrganizationProfileService.getReadinessSnapshot();
    dbStatus = `UP (PostgreSQL 16, ${oppCount} opportunities persisted)`;
    isDbHealthy = true;
  } catch (err: any) {
    dbStatus = `UNHEALTHY (${err.message || 'Database query failed'})`;
    isDbHealthy = false;
  }

  const statusCode = isDbHealthy ? 200 : 500;

  res.status(statusCode).json({
    status: isDbHealthy ? 'UP' : 'DOWN',
    service: 'Thriveward Funding Intelligence Core API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    organization: buildHealthOrganizationStatus(readiness),
    integrations: {
      fundingAgent: {
        url: pythonAgentUrl,
        status: pythonAgentStatus,
      },
      database: {
        status: dbStatus,
        provider: 'PostgreSQL + Prisma ORM',
        healthy: isDbHealthy,
      },
    },
    governance: {
      humanInTheLoopEnforced: true,
      autonomousSubmissionsAllowed: false,
    },
    aiAnalyst: AiFundingAnalystService.getConfigurationStatus(),
    documentIngestion: {
      enabled: process.env.DOCUMENT_INGESTION_ENABLED === 'true' || process.env.DOCUMENT_INGESTION_ENABLED === '1',
      maxFileBytes: Number(process.env.DOCUMENT_MAX_FILE_BYTES) || 26214400,
      maxPages: Number(process.env.DOCUMENT_MAX_PAGES) || 300,
      extractionVersion: process.env.DOCUMENT_EXTRACTION_VERSION || 'pdf-page-text-v1',
    },
    documentGrounding: {
      enabled: DocumentIndexingService.isGroundingEnabled(),
      configured: DocumentIndexingService.isGroundingEnabled(),
      provider: DocumentIndexingService.getActiveProvider().getProviderName(),
      embeddingModel: DocumentIndexingService.getActiveProvider().getModelName(),
      embeddingDimensions: DocumentIndexingService.getActiveProvider().getDimensions(),
      chunkingVersion: 'document-chunker-v1',
      retrievalVersion: 'document-retrieval-v1',
      promptVersion: 'funding-analyst-document-grounded-v1',
    },
  });
});
