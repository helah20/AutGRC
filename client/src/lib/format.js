/** Shared formatting and label helpers. */

export const STATUS_TONE = {
  draft: 'neutral', under_review: 'warn', approved: 'info',
  published: 'ok', under_revision: 'warn', retired: 'neutral'
};

export const SEVERITY_TONE = {
  critical: 'critical', high: 'danger', medium: 'warn', low: 'info', info: 'neutral'
};

export const RISK_TONE = { critical: 'critical', high: 'danger', medium: 'warn', low: 'ok' };

export const COVERAGE_TONE = {
  covered: 'ok', partial: 'warn', not_covered: 'danger', not_applicable: 'neutral'
};

export const GAP_TONE = {
  compliant: 'ok', partially_compliant: 'warn', non_compliant: 'danger', not_applicable: 'neutral'
};

export const EVIDENCE_TONE = {
  required: 'neutral', collected: 'info', verified: 'ok', missing: 'danger', expired: 'warn'
};

export function titleCase(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(value, { withTime = false } = {}) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const opts = withTime
    ? { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }
    : { year: 'numeric', month: 'short', day: '2-digit' };
  return new Intl.DateTimeFormat('en-GB', opts).format(date);
}

export function relativeTime(value) {
  if (!value) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 1) return 'just now';
  if (Math.abs(minutes) < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return `${days}d ago`;
  return formatDate(value);
}

export function daysUntil(value) {
  if (!value) return null;
  return Math.ceil((new Date(value) - new Date()) / 86400000);
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function pct(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function pluralise(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural || `${singular}s`}`;
}

/** Deterministic chart palette, aligned to the application tokens. */
export const CHART_COLORS = ['#2E6F9E', '#1F7A4D', '#A66A00', '#7A4A8F', '#B3261E', '#2B7C8A', '#5A6B7D', '#8C5A2B'];

export const TONE_COLORS = {
  ok: '#1F7A4D', warn: '#A66A00', danger: '#B3261E',
  critical: '#7A1912', info: '#2E6F9E', neutral: '#5A6B7D'
};

/** File sizes for attachment lists: 1 decimal place, binary units. */
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '—';
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
