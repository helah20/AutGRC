import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { Field } from '../components/ui.jsx';
import { IconShield, IconLayers, IconTarget, IconLock, IconAlert, IconGlobe } from '../components/Icons.jsx';
import { useI18n } from '../i18n/index.jsx';

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
  const { t, language, setLanguage, languages } = useI18n();
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
              <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: '#8FA9C4' }}>{t('app.tagline')}</div>
            </div>
          </div>

          <h2>{t('auth.headline')}</h2>
          <p style={{ marginTop: 14, marginBottom: 34 }}>
{t('auth.lede')}
          </p>

          <div className="auth-feature">
            <IconShield width={18} height={18} />
            <div>
              <div className="auth-feature-title">{t('auth.featureTraceTitle')}</div>
              <div className="auth-feature-desc">{t('auth.featureTraceBody')}</div>
            </div>
          </div>
          <div className="auth-feature">
            <IconLayers width={18} height={18} />
            <div>
              <div className="auth-feature-title">{t('auth.featureFrameworksTitle')}</div>
              <div className="auth-feature-desc">{t('auth.featureFrameworksBody')}</div>
            </div>
          </div>
          <div className="auth-feature">
            <IconTarget width={18} height={18} />
            <div>
              <div className="auth-feature-title">{t('auth.featureAuditTitle')}</div>
              <div className="auth-feature-desc">{t('auth.featureAuditBody')}</div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 11.5, color: '#7590AD' }}>
{t('auth.sourceCaveat')}
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          {/* Before the language switch in the shell is reachable: somebody who
              cannot read English must be able to change it from here. */}
          <div className="auth-lang">
            {languages.map((l) => (
              <button key={l.code} type="button" lang={l.code}
                className={`auth-lang-option ${l.code === language ? 'on' : ''}`}
                onClick={() => setLanguage(l.code)}
                aria-pressed={l.code === language}>
                {l.code === language && <IconGlobe width={12} height={12} />}
                {l.native}
              </button>
            ))}
          </div>
          <h1 style={{ marginBottom: 4 }}>{challenge ? t('auth.twoStep') : t('auth.signIn')}</h1>
          <p className="muted small" style={{ marginBottom: 22 }}>
{challenge ? t('auth.twoStepSubtitle') : t('auth.signInSubtitle')}
          </p>

          {error && (
            <div className="callout" data-callout="danger" style={{ marginBottom: 16 }}>
              <div className="row-tight"><IconAlert width={14} height={14} /><strong style={{ margin: 0 }}>{challenge ? t('auth.verificationFailed') : t('auth.signInFailed')}</strong></div>
              <p style={{ marginTop: 4, marginBottom: 0 }}>{error}</p>
            </div>
          )}

          {challenge ? (
            <form onSubmit={submitCode}>
              <Field label={t('auth.verificationCode')} hint={t('auth.verificationCodeHint')}>
                <input className="input" autoFocus required inputMode="text" autoComplete="one-time-code"
                  placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)}
                  style={{ fontFamily: 'var(--mono)', fontSize: 17, letterSpacing: '.12em' }} />
              </Field>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy || code.trim().length < 6}>
                {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} />{t('auth.verifying')}</> : <><IconLock width={15} height={15} />{t('auth.verify')}</>}
              </button>
              <button className="btn btn-ghost btn-sm btn-block" type="button" style={{ marginTop: 8 }}
                onClick={() => { setChallenge(null); setError(null); }}>
                {t('auth.startAgain')}
              </button>
              <p className="tiny muted" style={{ marginTop: 10, textAlign: 'center' }}>
                {t('auth.recoveryCodeNote')}
              </p>
            </form>
          ) : (
            <form onSubmit={submit}>
              <Field label={t('auth.email')}>
                <input className="input" type="email" autoComplete="username" required
                  value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label={t('auth.password')}>
                <input className="input" type="password" autoComplete="current-password" required
                  value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <button className="btn btn-primary btn-lg btn-block" type="submit" disabled={busy}>
                {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} />{t('auth.signingIn')}</> : <><IconLock width={15} height={15} />{t('auth.signIn')}</>}
              </button>
            </form>
          )}

          {!challenge && <div className="divider" />}

          {!challenge && <button className="btn btn-ghost btn-sm btn-block" type="button" onClick={() => setShowAccounts((s) => !s)}>
            {showAccounts ? t('auth.hideAccounts') : t('auth.showAccounts')}
          </button>}

          {!challenge && showAccounts && (
            <div style={{ marginTop: 10 }}>
              <p className="tiny muted" style={{ marginBottom: 8 }}>
{t('auth.accountsHint')}
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
