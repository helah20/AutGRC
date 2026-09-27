/**
 * Time-based one-time passwords (RFC 6238) and the base32 encoding RFC 4648
 * defines for the shared secret.
 *
 * Written against node:crypto rather than pulled in as a dependency. The whole
 * algorithm is a truncated HMAC, and a second factor is the last place to
 * widen the supply chain for forty lines of code.
 */

import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DIGITS = 6;
const PERIOD_SECONDS = 30;

/**
 * How many steps either side of now are accepted. One step covers the clock
 * drift between a phone and a server and the seconds a person spends typing;
 * more than that widens the window a stolen code stays usable in.
 */
const DRIFT_STEPS = 1;

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input) {
  const cleaned = String(input).toUpperCase().replace(/[=\s-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error(`"${char}" is not a base32 character`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 bits, which is what RFC 4226 recommends for an HMAC-SHA1 key. */
export function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function codeForCounter(secret, counter) {
  const key = base32Decode(secret);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', key).update(message).digest();
  // Dynamic truncation: the low nibble of the last byte picks the offset.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function generateCode(secret, atMs = Date.now()) {
  return codeForCounter(secret, Math.floor(atMs / 1000 / PERIOD_SECONDS));
}

/**
 * Compare in constant time and across the accepted drift window. Returns the
 * matching step so a caller can refuse a code that has already been used.
 */
export function verifyCode(secret, submitted, atMs = Date.now()) {
  const candidate = String(submitted || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(candidate)) return null;
  const current = Math.floor(atMs / 1000 / PERIOD_SECONDS);
  for (let drift = -DRIFT_STEPS; drift <= DRIFT_STEPS; drift += 1) {
    const step = current + drift;
    const expected = codeForCounter(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(candidate))) return step;
  }
  return null;
}

/** The URI an authenticator app reads from the enrolment QR code. */
export function otpauthUri({ secret, account, issuer = 'AutGRC' }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(PERIOD_SECONDS)
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ------------------------------------------------------- recovery codes ----

const RECOVERY_CODE_COUNT = 10;

/**
 * Shown once at enrolment and stored only as hashes, so a database copy does
 * not hand over a way past the second factor. Ten is enough to cover a lost
 * phone without becoming a password list.
 */
export function generateRecoveryCodes() {
  const codes = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(String(code).toUpperCase().replace(/\s/g, '')).digest('hex');
}

/**
 * Consume a recovery code: returns the remaining hashes when one matches, or
 * null when none does. A used code is spent, never reusable.
 */
export function consumeRecoveryCode(storedHashes, submitted) {
  const hash = hashRecoveryCode(submitted);
  const remaining = storedHashes.filter((h) => h !== hash);
  return remaining.length === storedHashes.length ? null : remaining;
}
