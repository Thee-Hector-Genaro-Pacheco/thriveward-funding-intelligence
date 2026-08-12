import { Router, Request, Response } from 'express';
import { BRIDGE_FORWARD_PROFILE } from '@bridge-ai/shared';

export const healthRouter = Router();

healthRouter.get('/', async (req: Request, res: Response) => {
  const pythonAgentUrl = process.env.FUNDING_AGENT_URL || 'http://localhost:8000';
  let pythonAgentStatus = 'UNKNOWN';

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

  res.json({
    status: 'UP',
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
        status: 'CONFIGURED',
        provider: 'PostgreSQL + Prisma ORM',
      },
    },
    governance: {
      humanInTheLoopEnforced: true,
      autonomousSubmissionsAllowed: false,
    },
  });
});
