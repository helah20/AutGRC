import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { q, nowIso } from '../db/index.js';
import { id } from '../utils/ids.js';
import {
  authenticate, hashPassword, verifyPassword, validatePassword, signAccessToken,
  createSession, rotateSession, revokeSession, revokeAllSessions, permissionsFor,
  audit, registerFailedLogin, clearFailedLogins, isLocked, ROLES
} from '../middleware/auth.js';
import { asyncHandler, validate, HttpError } from '../middleware/errors.js';
import { getOrgProfile } from './_shared.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again in 15 minutes.' }
});

const REFRESH_COOKIE = 'autgrc_refresh';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: 7 * 24 * 3600 * 1000
};

function sessionPayload(user) {
  return {
    user: {
      id: user.id, name: user.name, email: user.email, role: user.role,
      roleLabel: ROLES[user.role], jobTitle: user.job_title, lastLoginAt: user.last_login_at
    },
    permissions: permissionsFor(user.role),
    accessToken: signAccessToken(user)
  };
}

router.post('/login',
  loginLimiter,
  validate(z.object({ email: z.string().email(), password: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = q.get('SELECT * FROM users WHERE lower(email) = lower(?)', email);

    if (!user) {
      // Constant-ish work regardless of whether the account exists.
      verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid');
      audit(req, { action: 'login', entityType: 'user', summary: `Failed sign-in for unknown address ${email}`, outcome: 'failure' });
      throw new HttpError(401, 'Email or password is incorrect');
    }
    if (user.status !== 'active') {
      audit(req, { action: 'login', entityType: 'user', entityId: user.id, summary: 'Sign-in blocked: account suspended', outcome: 'denied' });
      throw new HttpError(403, 'This account has been suspended');
    }
    if (isLocked(user)) {
      audit(req, { action: 'login', entityType: 'user', entityId: user.id, summary: 'Sign-in blocked: account locked', outcome: 'denied' });
      throw new HttpError(423, 'Account temporarily locked after repeated failed attempts. Try again shortly.');
    }
    if (!verifyPassword(password, user.password_hash)) {
      const { failed, lockedUntil } = registerFailedLogin(user);
      audit(req, { action: 'login', entityType: 'user', entityId: user.id, summary: `Failed sign-in (attempt ${failed})`, outcome: 'failure' });
      throw new HttpError(401, lockedUntil ? 'Email or password is incorrect. Account is now locked for 15 minutes.' : 'Email or password is incorrect');
    }

    clearFailedLogins(user);
    const fresh = q.get('SELECT * FROM users WHERE id = ?', user.id);
    const { refreshToken } = createSession(fresh, req);
    req.user = { id: fresh.id, email: fresh.email, role: fresh.role };
    audit(req, { action: 'login', entityType: 'user', entityId: fresh.id, summary: 'Signed in' });

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    res.json({ ...sessionPayload(fresh), org: getOrgProfile() });
  })
);

router.post('/refresh', asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE] || req.body?.refreshToken;
  if (!token) throw new HttpError(401, 'No session to refresh');
  const rotated = rotateSession(token, req);
  if (!rotated) {
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    throw new HttpError(401, 'Session expired. Please sign in again.');
  }
  res.cookie(REFRESH_COOKIE, rotated.refreshToken, cookieOptions);
  res.json({ ...sessionPayload(rotated.user), org: getOrgProfile() });
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  revokeSession(token);
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = q.get('SELECT * FROM users WHERE id = ?', req.user.id);
  res.json({ ...sessionPayload(user), org: getOrgProfile() });
}));

router.post('/change-password',
  authenticate,
  validate(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const user = q.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!verifyPassword(req.body.currentPassword, user.password_hash)) {
      audit(req, { action: 'password:change', entityType: 'user', entityId: user.id, summary: 'Password change rejected: current password incorrect', outcome: 'failure' });
      throw new HttpError(400, 'Current password is incorrect');
    }
    const errors = validatePassword(req.body.newPassword);
    if (errors.length) throw new HttpError(400, 'Password does not meet the policy', errors);
    if (verifyPassword(req.body.newPassword, user.password_hash)) {
      throw new HttpError(400, 'The new password must differ from the current password');
    }

    q.run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', hashPassword(req.body.newPassword), nowIso(), user.id);
    revokeAllSessions(user.id);
    audit(req, { action: 'password:change', entityType: 'user', entityId: user.id, summary: 'Password changed; all sessions revoked' });
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    res.json({ ok: true, message: 'Password changed. Please sign in again.' });
  })
);

router.get('/sessions', authenticate, asyncHandler(async (req, res) => {
  const rows = q.all(
    'SELECT id, user_agent, ip, created_at, last_seen_at, expires_at, revoked_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    req.user.id
  );
  res.json(rows);
}));

router.delete('/sessions', authenticate, asyncHandler(async (req, res) => {
  revokeAllSessions(req.user.id);
  audit(req, { action: 'session:revoke_all', entityType: 'user', entityId: req.user.id, summary: 'All sessions revoked by user' });
  res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
}));

export default router;
