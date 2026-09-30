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

export default function FrameworkPicker({ frameworks, selected, onChange, disabled = false, strings = {} }) {
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
                  ? <Badge tone="critical">{strings.regulatory || 'Regulatory'}</Badge>
                  : <Badge tone="neutral">{strings.framework || 'Framework'}</Badge>}
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
      {group(regulatory, strings.regulatoryTitle || 'Regulations',
        strings.regulatoryHint || 'These apply by law or by supervision. Select the ones your organisation is subject to.')}
      {group(voluntary, strings.frameworkTitle || 'Frameworks and standards',
        strings.frameworkHint || 'These apply because the organisation adopts them — for certification, for assurance, or as good practice.')}
    </div>
  );
}
