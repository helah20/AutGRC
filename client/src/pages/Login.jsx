import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Field } from '../components/ui.jsx';
import { IconShield, IconLayers, IconTarget, IconLock, IconAlert } from '../components/Icons.jsx';

const DEMO_ACCOUNTS = [
  { email: 'grc@autgrc.demo', name: 'Noura Al-Harbi', role: 'GRC Manager — generate, edit, publish' },
  { email: 'ciso@autgrc.demo', name: 'Faisal Al-Otaibi', role: 'Approver (CISO) — approve documents' },
  { email: 'analyst@autgrc.demo', name: 'Omar Al-Zahrani', role: 'Cybersecurity User — author and review' },
  { email: 'auditor@autgrc.demo', name: 'Yousef Al-Shammari', role: 'Auditor — assess and read the audit log' },
  { email: 'admin@autgrc.demo', name: 'Layla Al-Rashid', role: 'Administrator — full access' },
  { email: 'viewer@autgrc.demo', name: 'Sara Al-Dosari', role: 'Read Only — view and export' }
];

export default function Login() {
  const { login, completeMfa } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('grc@autgrc.demo');
  const [password, setPassword] = useState('Autgrc#2025');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  // Set when the password was right but a second factor is still owed.
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await login(email.trim(), password);
      if (result?.mfaRequired) {
        setChallenge(result);
        setCode('');
        return;
      }
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await completeMfa(challenge.mfaToken, code.trim());
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Unable to verify that code');
      // An expired challenge cannot be retried; send them back to the password.
      if (err.status === 401 && /expired/i.test(err.message || '')) setChallenge(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <aside className="auth-aside">
        <div>
          <div className="row-tight" style={{ marginBottom: 34 }}>
            <svg width="32" height="32" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="7" fill="#2E6F9E" />
              <path d="M16 6l8 3.2v6.1c0 4.6-3.2 8.8-8 10.2-4.8-1.4-8-5.6-8-10.2V9.2L16 6z" fill="none" stroke="#DCE8F4" strokeWidth="1.8" />
              <path d="M12.2 16.2l2.7 2.7 5-5.2" fill="none" stroke="#DCE8F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <div style={{ fontWeight: 700, fontSize: 19, color: '#fff' }}>AutGRC</div>
              <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8FA9C4' }}>Cybersecurity Governance</div>
            </div>
          </div>

          <h2>Governance documentation that stays consistent.</h2>
          <p style={{ marginTop: 14, marginBottom: 34 }}>
            Generate a complete governance package from one requirement model, so the policy, standard,
            procedure, RACI and control library all state the same thing — and the platform tells you
            when a human edit makes them disagree.
          </p>

          <div className="auth-feature">
            <IconShield width={18} height={18} />
            <div>
              <div className="auth-feature-title">Traceable to the source</div>
              <div className="auth-feature-desc">Every requirement traces from the regulation through the control, policy clause and procedure step to the evidence that proves it.</div>
            </div>
          </div>
          <div className="auth-feature">
            <IconLayers width={18} height={18} />
            <div>
              <div className="auth-feature-title">Fourteen frameworks mapped</div>
              <div className="auth-feature-desc">NCA ECC, CSCC, DCC, TCC and CCC, SAMA CSF, ISO/IEC 27001, 27002, 27005 and 22301, NIST CSF and 800-53, CIS v8 and COBIT 2019.</div>
            </div>
          </div>
          <div className="auth-feature">
            <IconTarget width={18} height={18} />
            <div>
              <div className="auth-feature-title">Audit-ready by construction</div>
              <div className="auth-feature-desc">Controls carry evidence requirements, owners and indicators. Gap assessments start from your real coverage position.</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: '#7590AD' }}>
          Framework catalogue entries are reference metadata for mapping. Verify against the official
          publication before relying on them for regulatory attestation.
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <h1 style={{ marginBottom: 4 }}>{challenge ? 'Two-step verification' : 'Sign in'}</h1>
          <p className="muted small" style={{ marginBottom: 22 }}>
            {challenge
              ? 'Your password was accepted. Enter the code from your authenticator to finish signing in.'
              : 'Use your organisational account to access the governance library.'}
          </p>

          {error && (
            <div className="callout" data-callout="danger" style={{ marginBottom: 16 }}>
              <div className="row-tight"><IconAlert width={14} height={14} /><strong style={{ margin: 0 }}>{challenge ? 'Verification failed' : 'Sign-in failed'}</strong></div>
              <p style={{ marginTop: 4, marginBottom: 0 }}>{error}</p>
            </div>
          )}

          {challenge ? (
            <form onSubmit={submitCode}>
              <Field label="Verification code"
                hint="The six-digit code from your authenticator, or one of your recovery codes.">
                <input className="input" autoFocus required inputMode="text" autoComplete="one-time-code"
                  placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)}
                  style={{ fontFamily: 'var(--mono)', fontSize: 17, letterSpacing: '.12em' }} />
              </Field>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy || code.trim().length < 6}>
                {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} />Verifying…</> : <><IconLock width={15} height={15} />Verify</>}
              </button>
              <button className="btn btn-ghost btn-sm btn-block" type="button" style={{ marginTop: 8 }}
                onClick={() => { setChallenge(null); setError(null); }}>
                Start again
              </button>
              <p className="tiny muted" style={{ marginTop: 10, textAlign: 'center' }}>
                A recovery code works once and is then spent.
              </p>
            </form>
          ) : (
            <form onSubmit={submit}>
              <Field label="Email address">
                <input className="input" type="email" autoComplete="username" required
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password">
                <input className="input" type="password" autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
                {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} />Signing in…</> : <><IconLock width={15} height={15} />Sign in</>}
              </button>
            </form>
          )}

          {!challenge && <div className="divider" />}

          {!challenge && <button className="btn btn-ghost btn-sm btn-block" type="button" onClick={() => setShowAccounts((s) => !s)}>
            {showAccounts ? 'Hide' : 'Show'} demonstration accounts
          </button>}

          {!challenge && showAccounts && (
            <div style={{ marginTop: 10 }}>
              <p className="tiny muted" style={{ marginBottom: 8 }}>
                Each account demonstrates a different access level. Selecting one fills the form.
              </p>
              {DEMO_ACCOUNTS.map((acc) => (
                <button key={acc.email} type="button" className="demo-account"
                  onClick={() => { setEmail(acc.email); setPassword('Autgrc#2025'); }}>
                  <span className="avatar" style={{ width: 26, height: 26, fontSize: 10 }}>
                    {acc.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="demo-account-name">{acc.name}</span>
                    <span className="demo-account-role" style={{ display: 'block' }}>{acc.role}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
