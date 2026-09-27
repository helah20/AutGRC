import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Field, ErrorNote, useToast } from '../components/ui.jsx';
import { IconLock, IconShield, IconCheck, IconAlert, IconCopy } from '../components/Icons.jsx';

/**
 * The screen a blocked account lands on, and the only one it can use.
 *
 * The server refuses every other route while the block stands, so this is not
 * a nudge the person can dismiss: it is the whole application until they have
 * chosen their own password, or enrolled the second factor their role requires.
 */
export default function AccountAction({ block }) {
  const { user, logout } = useAuth();

  return (
    <div className="account-gate">
      <div className="account-gate-inner">
        <div className="row-tight" style={{ marginBottom: 18 }}>
          <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="#2E6F9E" />
            <path d="M16 6l8 3.2v6.1c0 4.6-3.2 8.8-8 10.2-4.8-1.4-8-5.6-8-10.2V9.2L16 6z" fill="none" stroke="#DCE8F4" strokeWidth="1.8" />
            <path d="M12.2 16.2l2.7 2.7 5-5.2" fill="none" stroke="#DCE8F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div className="strong">AutGRC</div>
            <div className="tiny muted">{user?.name} · {user?.roleLabel}</div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto' }} onClick={logout}>Sign out</button>
        </div>

        {block === 'password_change_required' ? <ChangePassword /> : <EnrolMfa />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ password reset --- */

function ChangePassword() {
  const { logout } = useAuth();
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setDone(true);
      toast.success('Password changed', 'Sign in again with your new password.');
      // Every session was revoked server-side, including this one.
      setTimeout(logout, 1600);
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <Card title="Password changed">
        <p className="small">
          All sessions were signed out, including this one. You will be returned to the sign-in screen.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Choose a new password"
      subtitle="An administrator reset this account. Until you set your own password, the platform will not let you do anything else.">
      <form onSubmit={submit} className="stack">
        {error && <ErrorNote error={error} />}
        <Field label="Temporary password" hint="The one the administrator gave you.">
          <input className="input" type="password" autoComplete="current-password" required
            value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password"
          hint="At least 12 characters, with an upper-case letter, a lower-case letter and a digit.">
          <input className="input" type="password" autoComplete="new-password" required
            value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Confirm new password" error={mismatch ? 'The two entries do not match.' : null}>
          <input className="input" type="password" autoComplete="new-password" required
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <button className="btn btn-primary btn-block" type="submit"
          disabled={busy || mismatch || next.length < 12}>
          {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} />Saving…</> : <><IconLock width={14} height={14} />Set my password</>}
        </button>
      </form>
    </Card>
  );
}

/* ---------------------------------------------------------- enrol MFA --- */

export function EnrolMfa({ onDone, embedded = false }) {
  const { applySession } = useAuth();
  const toast = useToast();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [showSecret, setShowSecret] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.post('/auth/mfa/setup')
      .then((res) => { if (!cancelled) setSetup(res); })
      .catch((err) => { if (!cancelled) setError(err); });
    return () => { cancelled = true; };
  }, []);

  async function enable(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api.post('/auth/mfa/enable', { code: code.trim() });
      setRecoveryCodes(res.recoveryCodes);
      applySession(res);
      toast.success('Two-step verification is on');
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  if (recoveryCodes) {
    return (
      <Card title="Save your recovery codes"
        subtitle="Shown once. Only their hashes are stored, so they cannot be shown again.">
        <div className="callout" data-callout="warn" style={{ marginBottom: 14 }}>
          <div className="row-tight"><IconAlert width={14} height={14} /><strong style={{ margin: 0 }}>Keep these somewhere safe and offline</strong></div>
          <p style={{ marginTop: 4, marginBottom: 0 }}>
            Each code signs you in once if you lose your authenticator, and is then spent. Without them
            and without your device, only an administrator can restore access.
          </p>
        </div>
        <ul className="recovery-codes">
          {recoveryCodes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div className="row-tight" style={{ marginTop: 12 }}>
          <button className="btn btn-sm" onClick={() => {
            navigator.clipboard?.writeText(recoveryCodes.join('\n'))
              .then(() => toast.success('Copied'))
              .catch(() => toast.error('Could not copy', 'Select the codes and copy them manually.'));
          }}><IconCopy width={13} height={13} />Copy all</button>
          <button className="btn btn-primary btn-sm" onClick={() => onDone?.()}>
            <IconCheck width={13} height={13} />I have saved them
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={embedded ? 'Set up two-step verification' : 'Two-step verification is required'}
      subtitle={embedded
        ? 'Adds a six-digit code from your phone to your password.'
        : 'Your role can approve or administer governance records, so the platform requires a second factor — the same control its own IAM Standard mandates for privileged access.'}>
      {error && <ErrorNote error={error} />}
      {!setup && !error && <p className="small muted">Preparing your enrolment…</p>}

      {setup && (
        <form onSubmit={enable} className="stack">
          <ol className="enrol-steps">
            <li>
              <strong>Scan this with an authenticator app</strong>
              <p className="small muted">Microsoft Authenticator, Google Authenticator, 1Password, Aegis — any TOTP app.</p>
              <img src={setup.qrDataUri} alt="Enrolment QR code" className="enrol-qr" width={200} height={200} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSecret((v) => !v)}>
                {showSecret ? 'Hide' : 'Cannot scan it?'}
              </button>
              {showSecret && (
                <div className="enrol-secret">
                  <div className="tiny muted">Enter this key manually:</div>
                  <code>{setup.secret}</code>
                  <div className="tiny muted">Account {setup.account} · issuer {setup.issuer} · 6 digits · 30 seconds</div>
                </div>
              )}
            </li>
            <li>
              <strong>Enter the code it shows</strong>
              <Field label="" hint="Six digits. It changes every 30 seconds.">
                <input className="input" required inputMode="numeric" autoComplete="one-time-code"
                  placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)}
                  style={{ fontFamily: 'var(--mono)', fontSize: 17, letterSpacing: '.12em', maxWidth: 190 }} />
              </Field>
            </li>
          </ol>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || code.trim().length < 6}>
            {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} />Verifying…</> : <><IconShield width={14} height={14} />Turn on two-step verification</>}
          </button>
        </form>
      )}
    </Card>
  );
}
