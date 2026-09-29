/**
 * Authentication, role-based access control and audit logging.
 *
 * Access tokens are short-lived JWTs; refresh tokens are opaque, hashed at
 * rest and bound to a server-side session row so they can be revoked.
 */

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import { q, nowIso } from '../db/index.js';
import { id } from '../utils/ids.js';

export const ROLES = {
  admin: 'Administrator',
  grc_manager: 'GRC Manager',
  cyber_user: 'Cybersecurity User',
  reviewer: 'Reviewer',
  approver: 'Approver',
  auditor: 'Auditor',
  read_only: 'Read Only'
};

/**
 * Permission matrix. Every protected route names a permission rather than a
 * role, so access segregation is defined in one place.
 */
export const PERMISSIONS = {
  'document:read': ['admin', 'grc_manager', 'cyber_user', 'reviewer', 'approver', 'auditor', 'read_only'],
  'document:create': ['admin', 'grc_manager', 'cyber_user'],
  'document:update': ['admin', 'grc_manager', 'cyber_user'],
  'document:delete': ['admin', 'grc_manager'],
  'document:submit': ['admin', 'grc_manager', 'cyber_user'],
  'document:review': ['admin', 'grc_manager', 'reviewer'],
  'document:approve': ['admin', 'approver'],
  // Recording a five-criterion assessment is a judgement about the document,
  // not a lifecycle decision, so it is wider than document:review: the panel
  // whose disagreement this is meant to expose is the CISO, the auditor and the
  // GRC function, and restricting it to the assigned reviewer would leave a
  // panel of one. The author's own role is excluded on purpose, and the route
  // additionally refuses the document's own owner.
  'assessment:write': ['admin', 'grc_manager', 'reviewer', 'approver', 'auditor'],
  'document:publish': ['admin', 'grc_manager'],
  'document:retire': ['admin', 'grc_manager'],
  'comment:write': ['admin', 'grc_manager', 'cyber_user', 'reviewer', 'approver', 'auditor'],
  'generate:run': ['admin', 'grc_manager', 'cyber_user'],
  'ai:use': ['admin', 'grc_manager', 'cyber_user', 'reviewer'],
  'control:write': ['admin', 'grc_manager', 'cyber_user'],
  'role:write': ['admin', 'grc_manager', 'cyber_user'],
  'raci:write': ['admin', 'grc_manager', 'cyber_user'],
  'mapping:write': ['admin', 'grc_manager', 'cyber_user'],
  'evidence:write': ['admin', 'grc_manager', 'cyber_user'],
  // Whoever collected an artefact cannot be the one who attests to it;
  // the route enforces that on top of this list.
  'evidence:verify': ['admin', 'grc_manager', 'reviewer', 'auditor'],
  'gap:write': ['admin', 'grc_manager', 'cyber_user', 'auditor'],
  'import:write': ['admin', 'grc_manager', 'cyber_user'],
  'finding:write': ['admin', 'grc_manager', 'cyber_user', 'auditor'],
  'risk:read': ['admin', 'grc_manager', 'cyber_user', 'reviewer', 'approver', 'auditor', 'read_only'],
  'risk:write': ['admin', 'grc_manager', 'cyber_user'],
  // Accepting a risk commits the organisation to living with it, so it sits
  // with the roles that can already approve governance, not with the authors.
  'risk:accept': ['admin', 'approver'],
  'action:write': ['admin', 'grc_manager', 'cyber_user'],
  // Closing your own corrective action is not verification.
  'action:verify': ['admin', 'grc_manager', 'reviewer', 'auditor'],
  'soa:write': ['admin', 'grc_manager', 'cyber_user'],
  'export:run': ['admin', 'grc_manager', 'cyber_user', 'reviewer', 'approver', 'auditor', 'read_only'],
  'settings:write': ['admin', 'grc_manager'],
  'user:manage': ['admin'],
  'audit:read': ['admin', 'grc_manager', 'auditor']
};

export function can(role, permission) {
  return (PERMISSIONS[permission] || []).includes(role);
}

/** All permissions held by a role — sent to the client to drive the UI. */
export function permissionsFor(role) {
  return Object.keys(PERMISSIONS).filter((p) => can(role, p));
}

// ------------------------------------------------------------- passwords ---

export function hashPassword(plain) {
  return bcrypt.hashSync(plain, config.security.bcryptRounds);
}

export function verifyPassword(plain, hash) {
  try {
    return bcrypt.compareSync(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Password policy. Mirrors the platform's own IAM Standard: length first,
 * with a small composition requirement and a block list of obvious choices.
 */
export function validatePassword(plain) {
  const errors = [];
  if (!plain || plain.length < 12) errors.push('Password must be at least 12 characters.');
  if (plain && plain.length > 200) errors.push('Password must be 200 characters or fewer.');
  if (plain && !/[a-z]/.test(plain)) errors.push('Password must contain a lower-case letter.');
  if (plain && !/[A-Z]/.test(plain)) errors.push('Password must contain an upper-case letter.');
  if (plain && !/\d/.test(plain)) errors.push('Password must contain a digit.');
  const weak = ['password', 'welcome', 'qwerty', '123456', 'letmein', 'admin123'];
  if (plain && weak.some((w) => plain.toLowerCase().includes(w))) {
    errors.push('Password contains a commonly breached pattern.');
  }
  return errors;
}

// ---------------------------------------------------------------- tokens ---

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, email: user.email },
    config.jwt.secret,
    { expiresIn: config.jwt.accessTtl, issuer: config.jwt.issuer }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(user, req) {
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const expires = new Date(Date.now() + parseTtl(config.jwt.refreshTtl)).toISOString();
  const sessionId = id('ses');
  q.run(
    `INSERT INTO sessions (id, user_id, refresh_hash, user_agent, ip, created_at, last_seen_at, expires_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    sessionId, user.id, hashToken(refreshToken),
    String(req.headers['user-agent'] || '').slice(0, 300), req.ip, nowIso(), nowIso(), expires
  );
  return { sessionId, refreshToken, expiresAt: expires };
}

export function rotateSession(refreshToken, req) {
  const row = q.get(
    'SELECT * FROM sessions WHERE refresh_hash = ? AND revoked_at IS NULL',
    hashToken(refreshToken)
  );
  if (!row) return null;
  if (new Date(row.expires_at) < new Date()) {
    q.run('UPDATE sessions SET revoked_at = ? WHERE id = ?', nowIso(), row.id);
    return null;
  }
  const idleLimit = config.security.sessionIdleMinutes * 60 * 1000;
  if (Date.now() - new Date(row.last_seen_at).getTime() > idleLimit) {
    q.run('UPDATE sessions SET revoked_at = ? WHERE id = ?', nowIso(), row.id);
    return null;
  }
  const user = q.get('SELECT * FROM users WHERE id = ? AND status = ?', row.user_id, 'active');
  if (!user) return null;

  // Rotate the refresh token on every use so a stolen token is single-use.
  const nextToken = crypto.randomBytes(48).toString('hex');
  q.run(
    'UPDATE sessions SET refresh_hash = ?, last_seen_at = ?, ip = ? WHERE id = ?',
    hashToken(nextToken), nowIso(), req.ip, row.id
  );
  return { user, refreshToken: nextToken, sessionId: row.id };
}

export function revokeSession(refreshToken) {
  if (!refreshToken) return;
  q.run('UPDATE sessions SET revoked_at = ? WHERE refresh_hash = ?', nowIso(), hashToken(refreshToken));
}

export function revokeAllSessions(userId) {
  q.run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', nowIso(), userId);
}

function parseTtl(ttl) {
  const m = String(ttl).match(/^(\d+)\s*([smhd])$/);
  if (!m) return 7 * 24 * 3600 * 1000;
  const n = Number(m[1]);
  return n * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
}

// ------------------------------------------------------- account state -----

/**
 * Roles that may not sign in on a password alone.
 *
 * The platform's own IAM Standard requires multi-factor authentication for
 * privileged access, and a governance tool that exempts itself from the control
 * it writes is not evidence of anything. The enforcement is real — an account
 * in a listed role can reach nothing but the enrolment screen until it enrols.
 *
 * It ships empty all the same. Turning it on by default would lock the seeded
 * administrator out of a fresh installation until whoever cloned the repository
 * found an authenticator app, and a control that arrives as an obstacle gets
 * switched off rather than understood. Settings states plainly when no role
 * requires it, which is the honest position: the control is one click away and
 * the platform says so, rather than claiming a posture it does not have.
 */
export const DEFAULT_MFA_REQUIRED_ROLES = [];

export function mfaRequiredRoles() {
  const row = q.get('SELECT mfa_required_roles FROM org_profile WHERE id = 1');
  if (!row || row.mfa_required_roles === null || row.mfa_required_roles === undefined) {
    return DEFAULT_MFA_REQUIRED_ROLES;
  }
  return String(row.mfa_required_roles).split(',').map((r) => r.trim()).filter(Boolean);
}

export function mfaRequiredFor(role) {
  return mfaRequiredRoles().includes(role);
}

/**
 * A reason the account may do nothing but fix itself, or null. Returned as a
 * machine-readable code so the client can route to the right screen rather
 * than guess from the message.
 */
export function accountStateBlock(user) {
  if (user.must_change_password) return 'password_change_required';
  if (!user.mfa_enabled && mfaRequiredFor(user.role)) return 'mfa_enrolment_required';
  return null;
}

const BLOCK_MESSAGE = {
  password_change_required:
    'Your password was reset by an administrator. Choose a new one before continuing.',
  mfa_enrolment_required:
    'Your role requires multi-factor authentication. Enrol an authenticator before continuing.'
};

/**
 * The only routes a blocked account may reach: the ones that clear the block,
 * plus the ones the client needs to render the screen that does it.
 */
const BLOCK_EXEMPT_PREFIXES = [
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/change-password',
  '/api/auth/mfa'
];

// ----------------------------------------------------------- middleware ----

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  // A challenge token proves only that the password was right. It must never
  // be accepted as a session token.
  if (payload.purpose === 'mfa_challenge') {
    return res.status(401).json({ error: 'Multi-factor authentication is not complete' });
  }

  const user = q.get('SELECT * FROM users WHERE id = ? AND status = ?', payload.sub, 'active');
  if (!user) return res.status(401).json({ error: 'Account is not active' });
  req.user = { id: user.id, email: user.email, name: user.name, role: user.role, jobTitle: user.job_title };

  const block = accountStateBlock(user);
  if (block && !BLOCK_EXEMPT_PREFIXES.some((prefix) => req.originalUrl.startsWith(prefix))) {
    return res.status(403).json({ error: BLOCK_MESSAGE[block], code: block });
  }
  return next();
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (!can(req.user.role, permission)) {
      audit(req, {
        action: `denied:${permission}`,
        entityType: 'authorisation',
        summary: `Access denied for ${req.user.email} attempting ${permission}`,
        outcome: 'denied'
      });
      return res.status(403).json({
        error: 'You do not have permission to perform this action',
        required: permission,
        yourRole: req.user.role
      });
    }
    return next();
  };
}

// --------------------------------------------------------------- audit -----

export function audit(req, { action, entityType, entityId, summary, detail, outcome = 'success' }) {
  q.run(
    `INSERT INTO audit_log (at, user_id, user_email, action, entity_type, entity_id, summary, detail, ip, outcome)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    nowIso(),
    req.user?.id || null,
    req.user?.email || null,
    action,
    entityType || null,
    entityId || null,
    summary || null,
    detail ? JSON.stringify(detail).slice(0, 4000) : null,
    req.ip || null,
    outcome
  );
}

// ------------------------------------------------------- login throttling --

const LOCK_THRESHOLD = 5;
const LOCK_MINUTES = 15;

export function registerFailedLogin(user) {
  const failed = (user.failed_logins || 0) + 1;
  const lockedUntil = failed >= LOCK_THRESHOLD
    ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString()
    : null;
  q.run('UPDATE users SET failed_logins = ?, locked_until = ? WHERE id = ?', failed, lockedUntil, user.id);
  return { failed, lockedUntil };
}

export function clearFailedLogins(user) {
  q.run('UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = ? WHERE id = ?', nowIso(), user.id);
}

export function isLocked(user) {
  return Boolean(user.locked_until && new Date(user.locked_until) > new Date());
}
