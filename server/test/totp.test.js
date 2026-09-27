/**
 * TOTP unit tests.
 *
 * Runs without a server. The RFC 6238 vectors are the point of this file: a
 * second factor that disagrees with the published algorithm would refuse every
 * real authenticator app, and a home-grown one is exactly where that happens.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  base32Encode, base32Decode, generateSecret, generateCode, verifyCode, otpauthUri,
  generateRecoveryCodes, hashRecoveryCode, consumeRecoveryCode
} from '../src/services/totp.js';

// RFC 4226 / 6238 use the ASCII seed "12345678901234567890".
const RFC_SEED = Buffer.from('12345678901234567890', 'ascii');
const RFC_SECRET = base32Encode(RFC_SEED);

test('TOTP and recovery codes', async (t) => {
  await t.test('matches the RFC 6238 test vectors', () => {
    // The RFC prints eight digits; six-digit codes are its last six.
    const vectors = [
      [59, '287082'], [1111111109, '081804'], [1111111111, '050471'],
      [1234567890, '005924'], [2000000000, '279037'], [20000000000, '353130']
    ];
    for (const [seconds, expected] of vectors) {
      assert.equal(generateCode(RFC_SECRET, seconds * 1000), expected, `vector at t=${seconds}`);
    }
  });

  await t.test('base32 round-trips and matches RFC 4648', () => {
    assert.equal(base32Encode(Buffer.from('foobar')), 'MZXW6YTBOI');
    assert.ok(base32Decode(base32Encode(RFC_SEED)).equals(RFC_SEED));
    assert.throws(() => base32Decode('has-a-1-in-it'), /not a base32 character/);
  });

  await t.test('generates a 160-bit secret', () => {
    const secret = generateSecret();
    assert.equal(secret.length, 32);
    assert.equal(base32Decode(secret).length, 20);
    assert.notEqual(generateSecret(), secret, 'secrets are not deterministic');
  });

  await t.test('accepts one step of drift either side and no more', () => {
    const now = 1700000000000;
    assert.notEqual(verifyCode(RFC_SECRET, generateCode(RFC_SECRET, now), now), null);
    assert.notEqual(verifyCode(RFC_SECRET, generateCode(RFC_SECRET, now - 30_000), now), null);
    assert.notEqual(verifyCode(RFC_SECRET, generateCode(RFC_SECRET, now + 30_000), now), null);
    assert.equal(verifyCode(RFC_SECRET, generateCode(RFC_SECRET, now - 90_000), now), null);
    assert.equal(verifyCode(RFC_SECRET, generateCode(RFC_SECRET, now + 90_000), now), null);
  });

  await t.test('rejects anything that is not six digits', () => {
    const now = 1700000000000;
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 34 56 78', null, undefined]) {
      assert.equal(verifyCode(RFC_SECRET, bad, now), null, `rejects ${JSON.stringify(bad)}`);
    }
  });

  await t.test('builds an otpauth URI an authenticator can read', () => {
    const uri = otpauthUri({ secret: 'JBSWY3DPEHPK3PXP', account: 'noura@example.sa' });
    assert.match(uri, /^otpauth:\/\/totp\//);
    const parsed = new URL(uri);
    assert.equal(decodeURIComponent(parsed.pathname).replace(/^\/+/, ''), 'AutGRC:noura@example.sa');
    assert.equal(parsed.searchParams.get('secret'), 'JBSWY3DPEHPK3PXP');
    assert.equal(parsed.searchParams.get('digits'), '6');
    assert.equal(parsed.searchParams.get('period'), '30');
  });

  await t.test('recovery codes are stored hashed and spent on use', () => {
    const codes = generateRecoveryCodes();
    assert.equal(codes.length, 10);
    assert.equal(new Set(codes).size, 10, 'no duplicates');

    const hashes = codes.map(hashRecoveryCode);
    assert.ok(hashes.every((h) => /^[0-9a-f]{64}$/.test(h)), 'stored as SHA-256 hex');
    assert.ok(hashes.every((h) => !codes.includes(h)), 'the plain code is not recoverable from the store');

    // Case and spacing are how people actually type them.
    const remaining = consumeRecoveryCode(hashes, ` ${codes[4].toLowerCase()} `);
    assert.equal(remaining.length, 9);
    assert.equal(consumeRecoveryCode(remaining, codes[4]), null, 'a spent code does not work twice');
    assert.equal(consumeRecoveryCode(hashes, 'ZZZZZ-ZZZZZ'), null, 'an unknown code is refused');
  });
});
