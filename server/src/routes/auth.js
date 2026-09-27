import express from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { z } from 'zod';
import config from '../config.js';
import { q, nowIso, toJson, fromJson } from '../db/index.js';
import { id } from '../utils/ids.js';
import {
  authenticate, hashPassword, verifyPassword, validatePassword, signAccessToken,
  createSession, rotateSession, revokeSession, revokeAllSessions, permissionsFor,
  audit, registerFailedLogin, clearFailedLogins, isLocked, ROLES,
  accountStateBlock, mfaRequiredFor, mfaRequiredRoles
} from '../middleware/auth.js';
import {
  generateSecret, verifyCode, otpauthUri, generateRecoveryCodes,
  hashRecoveryCode, consumeRecoveryCode
} from '../services/totp.js';
import { asyncHandler, validate, HttpError } from '../middleware/errors.js';
import { getOrgProfile } from './_shared.js';

const router = express.Router();

/**
 * Throttles failed sign-ins per address. Successful ones are not counted:
 * what this defends against is guessing, and a shared office address behind
 * one NAT can legitimately produce far more than twenty sign-ins in fifteen
 * minutes. Per-account lockout after five consecutive failures sits behind
 * this and does not care which address the attempts come from.
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed sign-in attempts. Try again in 15 minutes.' }
});

const REFRESH_COOKIE = 'autgrc_refresh';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/api/auth',
  maxAge: 7 * 24 * 3600 * 1000
};

/**
 * Carries one fact — this password was correct — for long enough to type a
 * six-digit code. It is deliberately not a session token: authenticate()
 * rejects anything bearing this purpose.
 */
const CHALLENGE_TTL_SECONDS = 300;

function signChallengeToken(user) {
  return jwt.sign(
    { sub: user.id, purpose: 'mfa_challenge' },
    config.jwt.secret,
    { expiresIn: CHALLENGE_TTL_SECONDS, issuer: config.jwt.issuer }
  );
}

function readChallengeToken(token) {
  try {
    const payload = jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
    if (payload.purpose !== 'mfa_challenge') return null;
    return q.get('SELECT * FROM users WHERE id = ? AND status = ?', payload.sub, 'active');
  } catch {
    return null;
  }
}

function sessionPayload(user) {
  return {
    user: {
      id: user.id, name: user.name, email: user.email, role: user.role,
      roleLabel: ROLES[user.role], jobTitle: user.job_title, lastLoginAt: user.last_login_at,
      mfaEnabled: Boolean(user.mfa_enabled),
      mfaRequired: mfaRequiredFor(user.role),
      mustChangePassword: Boolean(user.must_change_password)
    },
    permissions: permissionsFor(user.role),
    // Non-null when the session may do nothing but clear this state.
    accountBlock: accountStateBlock(user),
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

    // The password is only the first factor. Where a second is enrolled, no
    // session exists until it is presented: the challenge token below proves
    // the password was right and nothing else, and authenticate() refuses it.
    if (fresh.mfa_enabled) {
      req.user = { id: fresh.id, email: fresh.email, role: fresh.role };
      audit(req, {
        action: 'login', entityType: 'user', entityId: fresh.id,
        summary: 'Password accepted; awaiting second factor'
      });
      return res.json({
        mfaRequired: true,
        mfaToken: signChallengeToken(fresh),
        expiresInSeconds: CHALLENGE_TTL_SECONDS
      });
    }

    const { refreshToken } = createSession(fresh, req);
    req.user = { id: fresh.id, email: fresh.email, role: fresh.role };
    audit(req, { action: 'login', entityType: 'user', entityId: fresh.id, summary: 'Signed in' });

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    return res.json({ ...sessionPayload(fresh), org: getOrgProfile() });
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

    // Clears an administrator's reset: choosing your own password is the point
    // of the flag, so this is the only place it comes off.
    q.run(
      'UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?',
      hashPassword(req.body.newPassword), nowIso(), user.id
    );
    revokeAllSessions(user.id);
    audit(req, { action: 'password:change', entityType: 'user', entityId: user.id, summary: 'Password changed; all sessions revoked' });
    res.clearCookie(REFRESH_COOKIE, { ...cookieOptions, maxAge: undefined });
    res.json({ ok: true, message: 'Password changed. Please sign in again.' });
  })
);

// ----------------------------------------------- multi-factor authentication

/** Same reasoning as the login limiter: count the wrong codes, not the right ones. */
const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many failed verification attempts. Try again in 15 minutes.' }
});

/**
 * Complete a sign-in that stopped at the second factor. Accepts either a
 * six-digit code or one recovery code; a recovery code is spent on use.
 */
router.post('/mfa/verify',
  mfaLimiter,
  validate(z.object({ mfaToken: z.string().min(10), code: z.string().min(6).max(20) })),
  asyncHandler(async (req, res) => {
    const user = readChallengeToken(req.body.mfaToken);
    if (!user) throw new HttpError(401, 'That sign-in attempt has expired. Please start again.');
    req.user = { id: user.id, email: user.email, role: user.role };

    if (isLocked(user)) {
      audit(req, { action: 'login:mfa', entityType: 'user', entityId: user.id, summary: 'Second factor blocked: account locked', outcome: 'denied' });
      throw new HttpError(423, 'Account temporarily locked. Try again shortly.');
    }

    const submitted = req.body.code.trim();
    let usedRecoveryCode = false;

    if (verifyCode(user.mfa_secret, submitted) === null) {
      const remaining = consumeRecoveryCode(fromJson(user.mfa_recovery_codes, []), submitted);
      if (remaining === null) {
        const { failed, lockedUntil } = registerFailedLogin(user);
        audit(req, {
          action: 'login:mfa', entityType: 'user', entityId: user.id,
          summary: `Incorrect second factor (attempt ${failed})`, outcome: 'failure'
        });
        throw new HttpError(401, lockedUntil
          ? 'That code is not valid. The account is now locked for 15 minutes.'
          : 'That code is not valid.');
      }
      q.run('UPDATE users SET mfa_recovery_codes = ? WHERE id = ?', toJson(remaining), user.id);
      usedRecoveryCode = true;
    }

    clearFailedLogins(user);
    const fresh = q.get('SELECT * FROM users WHERE id = ?', user.id);
    const { refreshToken } = createSession(fresh, req);
    audit(req, {
      action: 'login', entityType: 'user', entityId: fresh.id,
      summary: usedRecoveryCode ? 'Signed in using a recovery code' : 'Signed in with a second factor',
      detail: usedRecoveryCode ? { recoveryCodesRemaining: fromJson(fresh.mfa_recovery_codes, []).length } : undefined
    });

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    res.json({
      ...sessionPayload(fresh),
      org: getOrgProfile(),
      usedRecoveryCode,
      recoveryCodesRemaining: fromJson(fresh.mfa_recovery_codes, []).length
    });
  })
);

/**
 * Begin enrolment. The secret is generated and stored but not activated, so an
 * abandoned enrolment cannot lock anyone out.
 */
router.post('/mfa/setup', authenticate, asyncHandler(async (req, res) => {
  const user = q.get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (user.mfa_enabled) throw new HttpError(409, 'Multi-factor authentication is already enabled on this account.');

  const secret = generateSecret();
  q.run('UPDATE users SET mfa_secret = ?, updated_at = ? WHERE id = ?', secret, nowIso(), user.id);

  const uri = otpauthUri({ secret, account: user.email });
  audit(req, { action: 'mfa:setup', entityType: 'user', entityId: user.id, summary: 'Started multi-factor enrolment' });

  res.json({
    secret,
    otpauthUri: uri,
    // Rendered server-side so the secret never has to reach a third-party
    // chart service to become a picture.
    qrDataUri: await QRCode.toDataURL(uri, { margin: 1, width: 240 }),
    issuer: 'AutGRC',
    account: user.email
  });
}));

/** Finish enrolment by proving the authenticator works. */
router.post('/mfa/enable',
  authenticate,
  mfaLimiter,
  validate(z.object({ code: z.string().min(6).max(10) })),
  asyncHandler(async (req, res) => {
    const user = q.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (user.mfa_enabled) throw new HttpError(409, 'Multi-factor authentication is already enabled.');
    if (!user.mfa_secret) throw new HttpError(409, 'Start enrolment first.');
    if (verifyCode(user.mfa_secret, req.body.code.trim()) === null) {
      audit(req, { action: 'mfa:enable', entityType: 'user', entityId: user.id, summary: 'Enrolment code rejected', outcome: 'failure' });
      throw new HttpError(400, 'That code is not valid. Check the clock on your device and try the current code.');
    }

    const recoveryCodes = generateRecoveryCodes();
    q.run(
      'UPDATE users SET mfa_enabled = 1, mfa_enrolled_at = ?, mfa_recovery_codes = ?, updated_at = ? WHERE id = ?',
      nowIso(), toJson(recoveryCodes.map(hashRecoveryCode)), nowIso(), user.id
    );
    audit(req, {
      action: 'mfa:enable', entityType: 'user', entityId: user.id,
      summary: 'Multi-factor authentication enabled'
    });

    const fresh = q.get('SELECT * FROM users WHERE id = ?', user.id);
    res.json({
      ...sessionPayload(fresh),
      // Shown once. Only hashes are kept, so they cannot be reissued.
      recoveryCodes
    });
  })
);

/** Turn it off. Requires the password, so a borrowed session cannot do it. */
router.post('/mfa/disable',
  authenticate,
  mfaLimiter,
  validate(z.object({ password: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const user = q.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!user.mfa_enabled) throw new HttpError(409, 'Multi-factor authentication is not enabled.');
    if (!verifyPassword(req.body.password, user.password_hash)) {
      audit(req, { action: 'mfa:disable', entityType: 'user', entityId: user.id, summary: 'Disable refused: password incorrect', outcome: 'failure' });
      throw new HttpError(400, 'Password is incorrect.');
    }
    if (mfaRequiredFor(user.role)) {
      audit(req, { action: 'mfa:disable', entityType: 'user', entityId: user.id, summary: `Disable refused: required for role ${user.role}`, outcome: 'denied' });
      throw new HttpError(403, `Multi-factor authentication is mandatory for the ${ROLES[user.role]} role and cannot be turned off.`);
    }

    q.run(
      'UPDATE users SET mfa_enabled = 0, mfa_secret = NULL, mfa_enrolled_at = NULL, mfa_recovery_codes = NULL, updated_at = ? WHERE id = ?',
      nowIso(), user.id
    );
    audit(req, { action: 'mfa:disable', entityType: 'user', entityId: user.id, summary: 'Multi-factor authentication disabled' });
    res.json(sessionPayload(q.get('SELECT * FROM users WHERE id = ?', user.id)));
  })
);

/** Replace the recovery codes; the previous set stops working immediately. */
router.post('/mfa/recovery-codes',
  authenticate,
  validate(z.object({ password: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const user = q.get('SELECT * FROM users WHERE id = ?', req.user.id);
    if (!user.mfa_enabled) throw new HttpError(409, 'Multi-factor authentication is not enabled.');
    if (!verifyPassword(req.body.password, user.password_hash)) {
      throw new HttpError(400, 'Password is incorrect.');
    }
    const recoveryCodes = generateRecoveryCodes();
    q.run('UPDATE users SET mfa_recovery_codes = ?, updated_at = ? WHERE id = ?',
      toJson(recoveryCodes.map(hashRecoveryCode)), nowIso(), user.id);
    audit(req, { action: 'mfa:recovery_codes', entityType: 'user', entityId: user.id, summary: 'Recovery codes regenerated' });
    res.json({ recoveryCodes });
  })
);

router.get('/mfa/status', authenticate, asyncHandler(async (req, res) => {
  const user = q.get('SELECT * FROM users WHERE id = ?', req.user.id);
  res.json({
    enabled: Boolean(user.mfa_enabled),
    enrolledAt: user.mfa_enrolled_at,
    required: mfaRequiredFor(user.role),
    requiredRoles: mfaRequiredRoles(),
    recoveryCodesRemaining: fromJson(user.mfa_recovery_codes, []).length
  });
}));

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
