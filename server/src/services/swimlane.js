/**
 * Swimlane layout for a procedure's process flow.
 *
 * A procedure's steps already name the actor performing each one, so the
 * sequence carries a second piece of information the arrow chain threw away:
 * where the work changes hands. A hand-off is where procedures fail — the step
 * nobody picked up because two functions each believed the other owned it — so
 * the flow is laid out as lanes, one per actor, and the reader can see every
 * transition rather than infer it from a "Performed by" column.
 *
 * The layout is computed here rather than in the document builder or the client
 * so that the generated document and the on-screen diagram place the same step
 * in the same lane. Two renderers deriving lanes independently would drift, and
 * a diagram that disagrees with the document it illustrates is worse than no
 * diagram.
 *
 * Lanes are ordered by first appearance, which keeps the diagonal of a
 * well-ordered process running from the first lane to the last instead of
 * sorting actors into an order the process does not follow.
 */

/**
 * @param {Array<{name: string, actor: string, decision?: object}>} steps
 * @param {(text: string) => string} resolve  Applies the parameter set.
 * @returns {{lanes: string[], rows: Array<{no: number, lane: number, name: string, actor: string, decision?: object}>}}
 */
export function swimlanes(steps, resolve = (t) => t) {
  const lanes = [];
  const rows = (steps || []).map((step, i) => {
    const actor = resolve(step.actor);
    let lane = lanes.indexOf(actor);
    if (lane === -1) { lanes.push(actor); lane = lanes.length - 1; }
    return { no: i + 1, lane, name: resolve(step.name), actor, decision: step.decision };
  });
  return { lanes, rows };
}

/**
 * The hand-offs in a process: each point where the next step is performed by a
 * different actor. Reported alongside the diagram because the count is the
 * single most useful number about a procedure's fragility, and it is not
 * visible from a step list.
 */
export function handoffs({ rows }) {
  const out = [];
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].lane !== rows[i - 1].lane) {
      out.push({ from: rows[i - 1], to: rows[i] });
    }
  }
  return out;
}
