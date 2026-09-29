/**
 * Procedure flow, drawn as a swimlane chart.
 *
 * One lane per actor, one row per step. The chain the diagram used to draw made
 * the sequence obvious and the hand-offs invisible: the actor was a line of
 * small text inside each box, so a reader had to compare boxes to notice that
 * the work had changed hands. A hand-off is where procedures fail — the step
 * nobody started because two functions each believed the other owned it — so it
 * is what the diagram is for.
 *
 * Lanes are columns and steps are rows, matching the generated Procedure, which
 * lays the grid out the same way because there are two to seven actors and six
 * to nine steps. The layout comes from the server on `flow.lanes`/`flow.rows`
 * so that the diagram and the document it illustrates cannot disagree; it is
 * derived here only for a document generated before that was carried.
 *
 * Right-to-left is handled by mirroring the x axis, so an Arabic reader starts
 * at the first lane rather than the last.
 */

const LANE_W = 176;
const ROW_H = 58;
const HEAD_H = 46;
const GAP = 14;
const PAD = 12;
const NUM_W = 34;

export default function FlowDiagram({ steps, lanes, rows, params = {}, rtl = false }) {
  const resolve = (text) => String(text || '').replace(/\{\{(\w+)\}\}/g, (m, k) => params[k] ?? m);
  const layout = laneLayout({ steps, lanes, rows, resolve });
  if (!layout) return null;

  const { lanes: laneNames, rows: laneRows } = layout;
  const width = PAD * 2 + NUM_W + laneNames.length * LANE_W;
  const height = PAD * 2 + HEAD_H + laneRows.length * (ROW_H + GAP);

  // Right-to-left is handled by reversing the lane order, not by mirroring the
  // canvas. Flipping the drawing means flipping every label back again, and the
  // counter-transform has to be recomputed from each element's own x — which is
  // arithmetic that goes wrong quietly, and did: labels landed outside their
  // boxes. Reversing the column index instead leaves one coordinate system, and
  // text is laid out by the browser in the direction it belongs to.
  const column = (lane) => (rtl ? laneNames.length - 1 - lane : lane);
  const numX = rtl ? PAD + laneNames.length * LANE_W + 6 : PAD + 6;
  const laneX = (lane) => PAD + (rtl ? 0 : NUM_W) + column(lane) * LANE_W;
  const boxX = (lane) => laneX(lane) + 8;
  const centreX = (lane) => laneX(lane) + LANE_W / 2;
  const rowY = (i) => PAD + HEAD_H + i * (ROW_H + GAP);
  const textX = (lane) => (rtl ? boxX(lane) + LANE_W - 27 : boxX(lane) + 11);
  const anchor = rtl ? 'end' : 'start';

  return (
    <div className="flow-canvas">
      <svg className="flow-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height}
        preserveAspectRatio="xMinYMin meet" role="img"
        aria-label={`Swimlane process flow across ${laneNames.length} actors and ${laneRows.length} steps`}>
        <defs>
          <marker id="flow-arrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <polygon points="0 0, 9 3.5, 0 7" className="flow-arrow" />
          </marker>
        </defs>

        <g>
          {/* Lane bands first, so every connector and box sits above them. */}
          {laneNames.map((name, i) => (
            <g key={`lane-${i}`}>
              <rect x={laneX(i)} y={PAD} width={LANE_W} height={height - PAD * 2}
                className={`flow-lane ${i % 2 ? 'alt' : ''}`} />
              <line x1={laneX(i)} y1={PAD} x2={laneX(i)} y2={height - PAD} className="flow-lane-edge" />
              <text x={centreX(i)} y={PAD + 27} className="flow-lane-label" textAnchor="middle">
                {truncate(name, 24)}
              </text>
            </g>
          ))}
          <line x1={PAD} y1={PAD + HEAD_H - 8} x2={width - PAD} y2={PAD + HEAD_H - 8} className="flow-lane-edge" />

          {/* Connectors: straight down inside a lane, an elbow when the work
              changes hands, so a crossing line is the visible event. */}
          {laneRows.slice(1).map((row, k) => {
            const from = laneRows[k];
            const y1 = rowY(k) + ROW_H;
            const y2 = rowY(k + 1);
            const sameLane = from.lane === row.lane;
            const path = sameLane
              ? `M ${centreX(row.lane)} ${y1} L ${centreX(row.lane)} ${y2 - 4}`
              : `M ${centreX(from.lane)} ${y1} L ${centreX(from.lane)} ${y1 + GAP / 2} `
                + `L ${centreX(row.lane)} ${y1 + GAP / 2} L ${centreX(row.lane)} ${y2 - 4}`;
            return (
              <path key={`link-${k}`} d={path}
                className={`flow-link ${sameLane ? '' : 'handoff'}`} markerEnd="url(#flow-arrow)" />
            );
          })}

          {laneRows.map((row, i) => {
            const x = boxX(row.lane);
            const y = rowY(i);
            const kind = row.decision ? 'decision' : i === 0 || i === laneRows.length - 1 ? 'terminal' : '';
            return (
              <g key={`step-${i}`}>
                <text x={numX} y={y + ROW_H / 2 + 4} className="flow-node-num">
                  {String(row.no).padStart(2, '0')}
                </text>
                <rect x={x} y={y} width={LANE_W - 16} height={ROW_H} rx="7" className={`flow-node-box ${kind}`} />
                <text x={textX(row.lane)} y={y + 23} className="flow-node-title" textAnchor={anchor}>
                  {truncate(row.name, 21)}
                </text>
                {row.decision && (
                  <text x={textX(row.lane)} y={y + 41} className="flow-node-actor" textAnchor={anchor}>
                    ◆ {truncate(resolve(row.decision.question), 22)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

/**
 * The lane layout, preferring the one the server computed.
 *
 * Deriving it again here would let the diagram and the document disagree about
 * which lane a step belongs to, so this only falls back for a Procedure
 * generated before the layout was carried on the flow payload.
 */
function laneLayout({ steps, lanes, rows, resolve }) {
  if (Array.isArray(lanes) && lanes.length && Array.isArray(rows) && rows.length) {
    return { lanes: lanes.map(resolve), rows: rows.map((r) => ({ ...r, name: resolve(r.name) })) };
  }
  if (!steps?.length) return null;
  const derived = [];
  const laneRows = steps.map((step, i) => {
    const actor = resolve(step.actor);
    let lane = derived.indexOf(actor);
    if (lane === -1) { derived.push(actor); lane = derived.length - 1; }
    return { no: i + 1, lane, name: resolve(step.name), actor, decision: step.decision };
  });
  return { lanes: derived, rows: laneRows };
}

function truncate(text, max) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Decision points listed in full beneath the diagram. */
export function DecisionList({ steps, params = {}, strings = {} }) {
  const resolve = (text) => String(text || '').replace(/\{\{(\w+)\}\}/g, (m, k) => params[k] ?? m);
  const decisions = steps.map((s, i) => ({ ...s, no: i + 1 })).filter((s) => s.decision);
  if (!decisions.length) return null;

  const stepLabel = strings.step || 'Step';
  const yes = strings.yes || 'Yes';
  const no = strings.no || 'No';

  return (
    <div className="flow-decision-list">
      {decisions.map((s) => (
        <div key={s.no} className="flow-decision">
          <div className="flow-decision-q">{stepLabel} {s.no} — {resolve(s.decision.question)}</div>
          <div className="flow-branch"><span className="flow-branch-label">{yes}</span><span>{resolve(s.decision.yes)}</span></div>
          <div className="flow-branch"><span className="flow-branch-label">{no}</span><span>{resolve(s.decision.no)}</span></div>
        </div>
      ))}
    </div>
  );
}
