/**
 * AutGRC API server.
 *
 * Serves the JSON API under /api and, in production, the built client from
 * client/dist with SPA fallback.
 */

import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import config from './config.js';
import { db } from './db/index.js';
import { errorHandler } from './middleware/errors.js';
import { validateKnowledgeBase } from './knowledge/index.js';
import { startSweepSchedule, stopSweepSchedule } from './services/notify.js';

import authRoutes from './routes/auth.js';
import documentRoutes from './routes/documents.js';
import generatorRoutes from './routes/generator.js';
import controlRoutes from './routes/controls.js';
import roleRoutes from './routes/roles.js';
import raciRoutes from './routes/raci.js';
import frameworkRoutes from './routes/frameworks.js';
import evidenceRoutes from './routes/evidence.js';
import gapRoutes from './routes/gaps.js';
import aiRoutes from './routes/ai.js';
import findingRoutes from './routes/findings.js';
import searchRoutes from './routes/search.js';
import dashboardRoutes from './routes/dashboard.js';
import exportRoutes from './routes/exports.js';
import importRoutes from './routes/imports.js';
import reportRoutes from './routes/reports.js';
import adminRoutes from './routes/admin.js';
import notificationRoutes from './routes/notifications.js';
import riskRoutes from './routes/risks.js';
import actionRoutes from './routes/actions.js';
import soaRoutes from './routes/soa.js';

const app = express();

/**
 * Whether to believe X-Forwarded-For.
 *
 * Trusting it unconditionally means that when the platform is reached directly,
 * with no reverse proxy in front, the header is attacker-controlled and the
 * per-address rate limiters key on a value the attacker chooses. Rotating it
 * resets the bucket. Per-account lockout still stops credential guessing, so
 * this is not a route to an account — but it removes one layer, and the layer
 * is free to keep.
 *
 * So it is opt-in: set TRUST_PROXY to the number of proxies in front of the
 * application (usually 1), and leave it unset when nothing is.
 */
const trustProxy = Number(process.env.TRUST_PROXY || 0);
app.set('trust proxy', trustProxy > 0 ? trustProxy : false);
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // The client is a Vite bundle; styles are injected at runtime.
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'same-origin' }
}));

app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '4mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

if (config.env !== 'production') {
  app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }));
  app.use(morgan('dev', { skip: (req) => req.path.startsWith('/assets') }));
} else {
  app.use(morgan('combined'));
}

app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
}));

app.get('/api/health', (req, res) => {
  const problems = validateKnowledgeBase();
  res.json({
    status: problems.length ? 'degraded' : 'ok',
    version: '1.0.0',
    environment: config.env,
    knowledgeBaseProblems: problems.length,
    uptimeSeconds: Math.round(process.uptime())
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/generator', generatorRoutes);
app.use('/api/controls', controlRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/raci', raciRoutes);
app.use('/api/frameworks', frameworkRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/assessments', gapRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/findings', findingRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/risks', riskRoutes);
app.use('/api/actions', actionRoutes);
app.use('/api/soa', soaRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: `No API route for ${req.method} ${req.path}` }));

// Serve the built client, with SPA fallback for client-side routes.
if (fs.existsSync(config.clientDist)) {
  app.use(express.static(config.clientDist, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    }
  }));
  app.get('*', (req, res) => res.sendFile(path.join(config.clientDist, 'index.html')));
} else {
  app.get('/', (req, res) => res.status(503).json({
    error: 'The client has not been built yet. Run "npm run build", or "npm run dev" for the development server.'
  }));
}

app.use(errorHandler);

const problems = validateKnowledgeBase();
if (problems.length) {
  console.warn(`[AutGRC] Knowledge base integrity problems (${problems.length}):`);
  problems.slice(0, 10).forEach((p) => console.warn(`  - ${p}`));
}

const server = app.listen(config.port, () => {
  console.log(`[AutGRC] API listening on http://localhost:${config.port} (${config.env})`);
  console.log(`[AutGRC] Database: ${config.dbFile}`);
  console.log(`[AutGRC] AI provider: ${config.ai.provider}`);
});

// Review dates and unverified evidence are swept here rather than by a cron:
// the platform runs as a single local process, so it sweeps for itself.
startSweepSchedule();

function shutdown(signal) {
  console.log(`[AutGRC] ${signal} received, shutting down.`);
  stopSweepSchedule();
  server.close(() => {
    try { db.close(); } catch { /* already closed */ }
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
