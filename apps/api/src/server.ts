import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { healthRouter } from './routes/health';
import { BRIDGE_FORWARD_PROFILE } from '@bridge-ai/shared';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/health', healthRouter);

// Organization profile route
app.get('/api/profile', (req: Request, res: Response) => {
  res.json(BRIDGE_FORWARD_PROFILE);
});

// Root API Info
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Bridge AI API — Funding Intelligence Engine',
    version: '0.1.0-phase0',
    documentation: '/docs',
    healthCheck: '/health',
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[API Error]:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Bridge AI Core API active on http://localhost:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});
