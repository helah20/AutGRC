/**
 * Which frameworks and regulations the organisation is subject to.
 *
 * One component for both the places this is answered — the setup screen a new
 * installation lands on, and the Settings section it is changed in afterwards —
 * because it is the same decision, and two pickers would eventually offer two
 * different sets of choices.
 *
 * The distinction the component is careful about is between a regulation and a
 * framework. A regulation applies whether or not the organisation adopts it, so
 * it is labelled as mandatory and its jurisdiction is shown; a framework is
 * something the organisation chooses. A user selecting sources for the first
 * time needs that difference visible, not buried in a description.
 */

import { Badge } from './ui.jsx';
import { useT } from '../i18n/index.jsx';

export default function FrameworkPicker({ frameworks, selected, onChange, disabled = false }) {
  const t = useT();
  const regulatory = frameworks.filter((f) => f.is_mandatory);
  const voluntary = frameworks.filter((f) => !f.is_mandatory);

  const toggle = (code) => {
    if (disabled) return;
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  };

  const group = (list, title, hint) => (list.length ? (
    <div style={{ marginBottom: 18 }}>
      <div className="strong small" style={{ marginBottom: 2 }}>{title}</div>
      <p className="tiny muted" style={{ marginBottom: 8 }}>{hint}</p>
      <div className="grid grid-2">
        {list.map((f) => (
          <label key={f.code} className={`option-card ${selected.includes(f.code) ? 'selected' : ''}`}>
            <input type="checkbox" checked={selected.includes(f.code)} disabled={disabled}
              onChange={() => toggle(f.code)} />
            <span className="option-card-body">
              <span className="option-card-title">
                {f.code}
                {f.is_mandatory
                  ? <Badge tone="critical">{t('setup.regulatory')}</Badge>
                  : <Badge tone="neutral">{t('setup.framework')}</Badge>}
              </span>
              <span className="option-card-desc">{f.name}</span>
              <span className="tiny faint" style={{ display: 'block', marginTop: 3 }}>
                {f.publisher}{f.version ? ` · ${f.version}` : ''}{f.jurisdiction ? ` · ${f.jurisdiction}` : ''}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  ) : null);

  return (
    <div>
      {group(regulatory, t('setup.regulatoryTitle'), t('setup.regulatoryHint'))}
      {group(voluntary, t('setup.frameworkTitle'), t('setup.frameworkHint'))}
    </div>
  );
}
