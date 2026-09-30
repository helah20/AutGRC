/**
 * First-run setup: which frameworks and regulations apply to this organisation.
 *
 * Asked once, before anything is generated, because it is a fact about the
 * organisation rather than a choice to be remade on each document. Asking per
 * package is what let two policies in one library cite different source sets
 * with nothing recording why.
 *
 * The screen stands in front of the application rather than sitting inside it:
 * until the question is answered, every generated document would be missing the
 * traceability that makes it worth generating, so there is nothing useful to do
 * behind it. A user who cannot change settings is told who can, rather than
 * being shown a form they cannot submit.
 */

import { useState } from 'react';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useApi.js';
import { useAuth } from '../lib/auth.jsx';
import { Card, Loading, ErrorNote, Empty, useToast } from '../components/ui.jsx';
import { IconCheck, IconShield } from '../components/Icons.jsx';
import FrameworkPicker from '../components/FrameworkPicker.jsx';
import { useI18n } from '../i18n/index.jsx';

export default function Setup() {
  const { t } = useI18n();
  const { can, refreshOrg } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/frameworks');
  const [selected, setSelected] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmingNone, setConfirmingNone] = useState(false);

  if (!can('settings:write')) {
    return (
      <div style={{ maxWidth: 680, margin: '8vh auto', padding: 16 }}>
        <Empty title={t('setup.blockedTitle')} icon={IconShield}>
          {t('setup.blockedBody')}
        </Empty>
      </div>
    );
  }

  if (loading) return <Loading label={t('setup.loading')} />;
  if (error) return <ErrorNote error={error} onRetry={reload} />;

  const save = async (codes) => {
    setBusy(true);
    try {
      await api.put('/admin/org/frameworks', { codes });
      await refreshOrg();
      toast.success(codes.length ? t('setup.saved', { n: codes.length }) : t('setup.savedNone'));
    } catch (err) {
      toast.error(t('setup.saveFailed'), err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 940, margin: '6vh auto', padding: '0 16px 48px' }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ marginBottom: 6 }}>{t('setup.title')}</h1>
        <p className="muted" style={{ marginBottom: 0 }}>{t('setup.subtitle')}</p>
      </div>

      <Card>
        <div className="callout">
          <strong>{t('setup.calloutTitle')}</strong>
          <p style={{ marginBottom: 0 }}>{t('setup.calloutBody')}</p>
        </div>

        <div style={{ marginTop: 16 }}>
          <FrameworkPicker
            frameworks={data.items}
            selected={selected}
            onChange={setSelected}
            disabled={busy}
            strings={{
              regulatory: t('setup.regulatory'),
              framework: t('setup.framework'),
              regulatoryTitle: t('setup.regulatoryTitle'),
              regulatoryHint: t('setup.regulatoryHint'),
              frameworkTitle: t('setup.frameworkTitle'),
              frameworkHint: t('setup.frameworkHint')
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" disabled={busy || !selected.length}
            onClick={() => save(selected)}>
            <IconCheck width={13} height={13} />{t('setup.confirm', { n: selected.length })}
          </button>
          {/* Selecting nothing is a legitimate answer, but it is not the same as
              not having answered, and it costs every document its framework
              traceability — so it is confirmed rather than reached by clicking
              past the question. */}
          {!selected.length && (
            confirmingNone ? (
              <button className="btn" disabled={busy} onClick={() => save([])}>
                {t('setup.noneConfirm')}
              </button>
            ) : (
              <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirmingNone(true)}>
                {t('setup.none')}
              </button>
            )
          )}
          <span className="tiny muted">{t('setup.changeLater')}</span>
        </div>
      </Card>
    </div>
  );
}
