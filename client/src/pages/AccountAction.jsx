import { useState, useEffect } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Field, ErrorNote, useToast } from '../components/ui.jsx';
import { IconLock, IconShield, IconCheck, IconAlert, IconCopy } from '../components/Icons.jsx';
import { useT } from '../i18n/index.jsx';
import { useLabels } from '../i18n/labels.js';

/**
 * The screen a blocked account lands on, and the only one it can use.
 *
 * The server refuses every other route while the block stands, so this is not
 * a nudge the person can dismiss: it is the whole application until they have
 * chosen their own password, or enrolled the second factor their role requires.
 */
export default function AccountAction({ block }) {
  const t = useT();
  const labels = useLabels();
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
            <div className="tiny muted">{user?.name} · {user?.role ? labels.role(user.role, user.roleLabel) : user?.roleLabel}</div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginInlineStart: 'auto' }} onClick={logout}>{t('accountActionUi.signOut')}</button>
        </div>

        {block === 'password_change_required' ? <ChangePassword /> : <EnrolMfa />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ password reset --- */

function ChangePassword() {
  const t = useT();
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
      toast.success(t('accountActionUi.passwordChanged'), t('accountActionUi.passwordChangedBody'));
      // Every session was revoked server-side, including this one.
      setTimeout(logout, 1600);
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  if (done) {
    return (
      <Card title={t('accountActionUi.passwordChanged')}>
        <p className="small">
          {t('accountActionUi.allSessionsSignedOut')}
        </p>
      </Card>
    );
  }

  return (
    <Card title={t('accountActionUi.newPasswordTitle')}
      subtitle={t('accountActionUi.newPasswordSubtitle')}>
      <form onSubmit={submit} className="stack">
        {error && <ErrorNote error={error} />}
        <Field label={t('accountActionUi.temporaryPassword')} hint={t('accountActionUi.temporaryPasswordHint')}>
          <input className="input" type="password" autoComplete="current-password" required
            value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label={t('accountActionUi.newPassword')}
          hint={t('accountActionUi.newPasswordHint')}>
          <input className="input" type="password" autoComplete="new-password" required
            value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label={t('accountActionUi.confirmPassword')} error={mismatch ? t('accountActionUi.mismatch') : null}>
          <input className="input" type="password" autoComplete="new-password" required
            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <button className="btn btn-primary btn-block" type="submit"
          disabled={busy || mismatch || next.length < 12}>
          {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} />{t('accountActionUi.saving')}</> : <><IconLock width={14} height={14} />{t('accountActionUi.setPassword')}</>}
        </button>
      </form>
    </Card>
  );
}

/* ---------------------------------------------------------- enrol MFA --- */

export function EnrolMfa({ onDone, embedded = false }) {
  const t = useT();
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
      toast.success(t('accountActionUi.mfaOn'));
    } catch (err) { setError(err); } finally { setBusy(false); }
  }

  if (recoveryCodes) {
    return (
      <Card title={t('accountActionUi.recoveryTitle')}
        subtitle={t('accountActionUi.recoverySubtitle')}>
        <div className="callout" data-callout="warn" style={{ marginBottom: 14 }}>
          <div className="row-tight"><IconAlert width={14} height={14} /><strong style={{ margin: 0 }}>{t('accountActionUi.recoveryWarning')}</strong></div>
          <p style={{ marginTop: 4, marginBottom: 0 }}>
            {t('accountActionUi.recoveryBody')}
          </p>
        </div>
        <ul className="recovery-codes">
          {recoveryCodes.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <div className="row-tight" style={{ marginTop: 12 }}>
          <button className="btn btn-sm" onClick={() => {
            navigator.clipboard?.writeText(recoveryCodes.join('\n'))
              .then(() => toast.success(t('accountActionUi.copied')))
              .catch(() => toast.error(t('accountActionUi.couldNotCopy'), t('accountActionUi.copyManually')));
          }}><IconCopy width={13} height={13} />{t('accountActionUi.copyAll')}</button>
          <button className="btn btn-primary btn-sm" onClick={() => onDone?.()}>
            <IconCheck width={13} height={13} />{t('accountActionUi.savedThem')}
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={embedded ? t('accountActionUi.mfaSetupTitle') : t('accountActionUi.mfaRequiredTitle')}
      subtitle={embedded
        ? t('accountActionUi.mfaSetupBody')
        : t('accountActionUi.mfaRequiredBody')}>
      {error && <ErrorNote error={error} />}
      {!setup && !error && <p className="small muted">{t('accountActionUi.mfaPreparing')}</p>}

      {setup && (
        <form onSubmit={enable} className="stack">
          <ol className="enrol-steps">
            <li>
              <strong>{t('accountActionUi.mfaScan')}</strong>
              <p className="small muted">{t('accountActionUi.mfaScanBody')}</p>
              <img src={setup.qrDataUri} alt={t('accountActionUi.mfaQrAlt')} className="enrol-qr" width={200} height={200} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowSecret((v) => !v)}>
                {showSecret ? t('accountActionUi.mfaHide') : t('accountActionUi.mfaCannotScan')}
              </button>
              {showSecret && (
                <div className="enrol-secret">
                  <div className="tiny muted">{t('accountActionUi.mfaManualKey')}</div>
                  <code>{setup.secret}</code>
                  <div className="tiny muted">{t('accountActionUi.mfaKeyDetails', { account: setup.account, issuer: setup.issuer })}</div>
                </div>
              )}
            </li>
            <li>
              <strong>{t('accountActionUi.mfaEnterCode')}</strong>
              <Field label="" hint={t('accountActionUi.mfaCodeHint')}>
                <input className="input" required inputMode="numeric" autoComplete="one-time-code"
                  placeholder="000000" value={code} onChange={(e) => setCode(e.target.value)}
                  style={{ fontFamily: 'var(--mono)', fontSize: 17, letterSpacing: '.12em', maxWidth: 190 }} />
              </Field>
            </li>
          </ol>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy || code.trim().length < 6}>
            {busy ? <><span className="spinner" style={{ width: 14, height: 14 }} />{t('accountActionUi.verifying')}</> : <><IconShield width={14} height={14} />{t('accountActionUi.mfaTurnOn')}</>}
          </button>
        </form>
      )}
    </Card>
  );
}
