import { Router, Request, Response } from 'express';
import { BRIDGE_FORWARD_PROFILE } from '@bridge-ai/shared';
import { prisma } from '../lib/prisma';

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  const pythonAgentUrl = process.env.FUNDING_AGENT_URL || 'http://localhost:8000';
  let pythonAgentStatus = 'UNKNOWN';
  let dbStatus = 'UNKNOWN';
  let isDbHealthy = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
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
    dbStatus = `UP (PostgreSQL 16, ${oppCount} opportunities persisted)`;
    isDbHealthy = true;
  } catch (err: any) {
    dbStatus = `UNHEALTHY (${err.message || 'Database query failed'})`;
    isDbHealthy = false;
  }

  const statusCode = isDbHealthy ? 200 : 500;

  res.status(statusCode).json({
    status: isDbHealthy ? 'UP' : 'DOWN',
    service: 'Bridge AI Core API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    organization: {
      name: BRIDGE_FORWARD_PROFILE.name,
      status: BRIDGE_FORWARD_PROFILE.status,
      taxStatus: BRIDGE_FORWARD_PROFILE.taxStatus,
    },
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
  });
});
