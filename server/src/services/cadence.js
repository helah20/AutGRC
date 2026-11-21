/**
 * How often something recurs, read from the frequency the knowledge base and
 * the control library write in words ("quarterly", "at least annually",
 * "monthly and on change"). The shortest cycle named wins: a control tested
 * "monthly and annually by Internal Audit" is due monthly.
 */

// "Continuous" and "real time" say how a control operates, not how often it
// is reviewed or its evidence collected, so they name no cycle: "Continuous,
// reviewed annually" is annual.
const CYCLES = [
  [/\bdaily\b|يومي/i, 1],
  [/\bweekly\b|أسبوعي/i, 7],
  [/\bmonthly\b|شهري/i, 30],
  [/\bquarterly\b|ربع سنوي/i, 91],
  [/\bsemi[- ]annual(ly)?\b|\bsix[- ]monthly\b|\bbiannual(ly)?\b|نصف سنوي/i, 182],
  [/\bannual(ly)?\b|\byearly\b|\bonce a year\b|سنوي/i, 365],
  [/\bbiennial(ly)?\b|\bevery two years\b/i, 730]
];

/** Days between occurrences, or null when the wording names no cycle. */
export function cycleDays(frequency) {
  const text = String(frequency || '');
  const found = CYCLES.filter(([re]) => re.test(text)).map(([, days]) => days);
  return found.length ? Math.min(...found) : null;
}

/** The date a cycle next falls due after `from`, or null without a cycle. */
export function nextDue(frequency, from = new Date()) {
  const days = cycleDays(frequency);
  if (!days) return null;
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
