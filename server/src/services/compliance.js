/**
 * Whether a requirement is met, judged from the controls mapped to it.
 *
 * A mapping says which control is meant to answer a requirement; it does not
 * say the control is in place. A requirement is compliant when a control
 * that fully covers it is implemented and has not been found ineffective in
 * operation. It is partially compliant when the controls meant to answer it
 * are approved but not yet implemented, cover it only in part, or operate
 * only partly effectively. With no mapped control, or only proposed, retired
 * or ineffective ones, it is non-compliant.
 *
 * `mapped` rows carry the mapping's `coverage` and the control's `status` and
 * `operating_effectiveness`.
 */
export function requirementStatus(mapped = []) {
  const live = mapped.filter((m) => m.coverage !== 'not_applicable' && m.status !== 'retired');
  if (mapped.length && !live.length && mapped.every((m) => m.coverage === 'not_applicable')) return 'not_applicable';
  const working = live.filter((m) => m.operating_effectiveness !== 'ineffective');
  const compliant = working.some((m) => m.coverage === 'covered' && m.status === 'implemented'
    && m.operating_effectiveness !== 'partially_effective');
  if (compliant) return 'compliant';
  const partial = working.some((m) => ['covered', 'partial'].includes(m.coverage) && ['approved', 'implemented'].includes(m.status));
  return partial ? 'partially_compliant' : 'non_compliant';
}
