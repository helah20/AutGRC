import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');
export const SERVER_ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });

const dataDir = process.env.AUTGRC_DATA_DIR || path.join(SERVER_ROOT, 'data');
fs.mkdirSync(dataDir, { recursive: true });
const uploadDir = path.join(dataDir, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
// Evidence artefacts are kept apart from imported source documents: they are
// audit records with their own retention, not working material.
const evidenceDir = path.join(dataDir, 'evidence');
fs.mkdirSync(evidenceDir, { recursive: true });

/**
 * JWT secret resolution. In production a secret MUST be supplied; in
 * development we persist a generated one so tokens survive a restart.
 */
function resolveSecret(name, fileName) {
  if (process.env[name]) return process.env[name];
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `${name} must be set in production. Generate one with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
  }
  const file = path.join(dataDir, fileName);
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, generated, { mode: 0o600 });
  return generated;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  dataDir,
  uploadDir,
  evidenceDir,
  dbFile: process.env.AUTGRC_DB_FILE || path.join(dataDir, 'autgrc.db'),
  clientDist: path.join(ROOT, 'client', 'dist'),
  jwt: {
    secret: resolveSecret('JWT_SECRET', '.jwt-secret'),
    accessTtl: process.env.JWT_ACCESS_TTL || '2h',
    refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
    issuer: 'autgrc'
  },
  security: {
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
    maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 15 * 1024 * 1024),
    sessionIdleMinutes: Number(process.env.SESSION_IDLE_MINUTES || 120)
  },
  ai: {
    provider: process.env.AI_PROVIDER || (process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'builtin'),
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.AI_MODEL || 'claude-sonnet-5',
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    maxTokens: Number(process.env.AI_MAX_TOKENS || 8000),
    timeoutMs: Number(process.env.AI_TIMEOUT_MS || 120000),
    // Governance text is not a place for phrasing variety. Alharthi et al.
    // (Grant CRPG-25-1063) report that lower temperatures produced "more
    // deterministic and regulation-oriented outputs" while higher ones
    // "occasionally introduced variability in terminology and policy
    // formulation" (section 6.4, page 26). Their evidence is a stated tendency
    // rather than a measured effect, so this is set on the argument: varying
    // terminology between runs is the drift the consistency engine exists to
    // catch, and generating it deliberately is indefensible.
    // `??` alone would read the blank line .env.example ships as 0, which is a
    // different setting nobody chose.
    temperature: process.env.AI_TEMPERATURE?.trim()
      ? Number(process.env.AI_TEMPERATURE)
      : 0.2
  },
  seedPassword: process.env.SEED_PASSWORD || 'Autgrc#2025'
};

export default config;
