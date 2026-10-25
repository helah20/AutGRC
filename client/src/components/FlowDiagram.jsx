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

import { useT } from '../i18n/index.jsx';

const LANE_W = 196;
const ROW_H = 60;
// A decision is drawn as a diamond, which needs more height to hold its text.
const DECISION_H = 96;
const HEAD_H = 52;
const GAP = 30;
const PAD = 12;
const BOX_INSET = 8;

/**
 * A decision outcome that carries on to the next step ("Continue to
 * Approval"), as against one that leaves the main path ("Close the request").
 * The first labels the arrow to the next step; the second is drawn as a side
 * exit, so the diagram shows where the process goes when the answer is the
 * other one.
 */
const CONTINUES = /^(continue|proceed)\b|^(يُ?نتقل|ينتقل|يُمضى|يمضي)/i;

/** Up to two lines of about `max` characters, broken at spaces. */
function lines(text, max) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out = [''];
  for (const word of words) {
    const current = out[out.length - 1];
    if (!current || (current + ' ' + word).length <= max) out[out.length - 1] = current ? `${current} ${word}` : word;
    else if (out.length < 2) out.push(word);
    else { out[1] = truncate(`${out[1]} ${word}`, max); break; }
  }
  return out;
}

export default function FlowDiagram({ steps, lanes, rows, params = {}, rtl = false }) {
  const t = useT();
  const resolve = (text) => String(text || '').replace(/\{\{(\w+)\}\}/g, (m, k) => params[k] ?? m);
  const layout = laneLayout({ steps, lanes, rows, resolve });
  if (!layout) return null;

  const { lanes: laneNames, rows: laneRows } = layout;
  const width = PAD * 2 + laneNames.length * LANE_W;
  const rowH = (i) => (laneRows[i].decision ? DECISION_H : ROW_H);
  const offsets = laneRows.reduce((acc, _, i) => [...acc, acc[i] + rowH(i) + GAP], [0]);
  const height = PAD * 2 + HEAD_H + offsets[laneRows.length] - GAP + 8;
  const yesWord = t('documentDetail.branchYes');
  const noWord = t('documentDetail.branchNo');

  // Right-to-left reverses the lane order rather than mirroring the canvas, and
  // the SVG takes the reader's direction, so "start" is the reading start in
  // both languages and text is laid out by the browser the way it belongs.
  const column = (lane) => (rtl ? laneNames.length - 1 - lane : lane);
  const laneX = (lane) => PAD + column(lane) * LANE_W;
  const boxX = (lane) => laneX(lane) + BOX_INSET;
  const boxW = LANE_W - BOX_INSET * 2;
  const centreX = (lane) => laneX(lane) + LANE_W / 2;
  const rowY = (i) => PAD + HEAD_H + offsets[i];
  // The edge a line of text starts from, and a step inward from it.
  const startEdge = (lane) => (rtl ? boxX(lane) + boxW : boxX(lane));
  const inward = (lane, by) => startEdge(lane) + (rtl ? -by : by);

  // The two outcomes of each decision: which one continues, which ones leave.
  const branches = (row) => {
    const d = row.decision;
    if (!d) return { main: null, exits: [] };
    const options = [
      { word: yesWord, text: resolve(d.yes) },
      { word: noWord, text: resolve(d.no) }
    ];
    const main = options.find((o) => CONTINUES.test(o.text)) || null;
    return { main, exits: options.filter((o) => o !== main) };
  };

  return (
    <div className="flow-canvas">
      <svg className="flow-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height}
        preserveAspectRatio="xMinYMin meet" role="img" style={{ direction: rtl ? 'rtl' : 'ltr' }}
        aria-label={`Swimlane process flow across ${laneNames.length} actors and ${laneRows.length} steps`}>
        <defs>
          <marker id="flow-arrow" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">
            <polygon points="0 0, 9 4, 0 8" className="flow-arrow" />
          </marker>
          <marker id="flow-arrow-handoff" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">
            <polygon points="0 0, 9 4, 0 8" className="flow-arrow handoff" />
          </marker>
          <marker id="flow-arrow-exit" markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">
            <polygon points="0 0, 9 4, 0 8" className="flow-arrow exit" />
          </marker>
        </defs>

        {/* Lane bands first, so every connector and box sits above them. */}
        {laneNames.map((name, i) => (
          <g key={`lane-${i}`}>
            <rect x={laneX(i)} y={PAD} width={LANE_W} height={height - PAD * 2}
              className={`flow-lane ${i % 2 ? 'alt' : ''}`} />
            <line x1={laneX(i)} y1={PAD} x2={laneX(i)} y2={height - PAD} className="flow-lane-edge" />
            {lines(name, 26).map((line, k, all) => (
              <text key={k} x={centreX(i)} y={PAD + (all.length > 1 ? 20 : 27) + k * 14}
                className="flow-lane-label" textAnchor="middle">{line}</text>
            ))}
          </g>
        ))}
        <line x1={PAD} y1={PAD + HEAD_H - 8} x2={width - PAD} y2={PAD + HEAD_H - 8} className="flow-lane-edge" />

        {/* Connectors: straight down inside a lane, an elbow when the work
            changes hands, so a crossing line is the visible event. A decision's
            continuing answer labels its connector. */}
        {laneRows.slice(1).map((row, k) => {
          const from = laneRows[k];
          const y1 = rowY(k) + rowH(k);
          const y2 = rowY(k + 1);
          const mid = y1 + GAP / 2;
          const sameLane = from.lane === row.lane;
          const path = sameLane
            ? `M ${centreX(row.lane)} ${y1} L ${centreX(row.lane)} ${y2 - 2}`
            : `M ${centreX(from.lane)} ${y1} L ${centreX(from.lane)} ${mid} `
              + `L ${centreX(row.lane)} ${mid} L ${centreX(row.lane)} ${y2 - 2}`;
          const { main } = branches(from);
          return (
            <g key={`link-${k}`}>
              <path d={path} className={`flow-link ${sameLane ? '' : 'handoff'}`}
                markerEnd={`url(#flow-arrow${sameLane ? '' : '-handoff'})`} />
              {main && (
                <g>
                  <rect x={centreX(from.lane) + (rtl ? -38 : 6)} y={y1 + 2} width={32} height={15} rx="7" className="flow-branch-pill main" />
                  <text x={centreX(from.lane) + (rtl ? -22 : 22)} y={y1 + 13} textAnchor="middle" className="flow-branch-word">{main.word}</text>
                </g>
              )}
            </g>
          );
        })}

        {laneRows.map((row, i) => {
          const x = boxX(row.lane);
          const y = rowY(i);
          const h = rowH(i);
          const cx = x + boxW / 2;
          const kind = row.decision ? 'decision' : i === 0 || i === laneRows.length - 1 ? 'terminal' : '';
          const { exits } = branches(row);
          // Side exits leave from the diamond's side vertex into the free part
          // of the same row: towards the reading end when there is a lane there.
          const side = rtl ? column(row.lane) === 0 : column(row.lane) < laneNames.length - 1; // true: physical right
          const exitW = LANE_W - 14;
          const exitX = side ? x + boxW + 26 : x - 26 - exitW;
          const fits = laneNames.length > 1;
          return (
            <g key={`step-${i}`}>
              {row.decision ? (
                <>
                  <polygon points={`${cx},${y} ${x + boxW},${y + h / 2} ${cx},${y + h} ${x},${y + h / 2}`}
                    className={`flow-node-box ${kind}`} />
                  <circle cx={inward(row.lane, 12)} cy={y + 12} r="9" className="flow-node-badge" />
                  <text x={inward(row.lane, 12)} y={y + 15.5} textAnchor="middle" className="flow-node-num">{row.no}</text>
                  <text x={cx} y={y + h / 2 - 9} textAnchor="middle" className="flow-node-title">{truncate(row.name, 16)}</text>
                  {lines(resolve(row.decision.question), 22).map((line, k) => (
                    <text key={k} x={cx} y={y + h / 2 + 7 + k * 12} textAnchor="middle" className="flow-node-actor">{line}</text>
                  ))}
                </>
              ) : (
                <>
                  <rect x={x} y={y} width={boxW} height={h} rx="8" className={`flow-node-box ${kind}`} />
                  <circle cx={inward(row.lane, 14)} cy={y + 15} r="9" className="flow-node-badge" />
                  <text x={inward(row.lane, 14)} y={y + 18.5} textAnchor="middle" className="flow-node-num">{row.no}</text>
                  <text x={inward(row.lane, 30)} y={y + 34} className="flow-node-title" textAnchor="start">
                    {truncate(row.name, 22)}
                  </text>
                </>
              )}
              {fits && exits.map((exit, k) => {
                const eh = exits.length > 1 ? 26 : 38;
                const ey = exits.length > 1 ? y + h / 2 - eh - 3 + k * (eh + 6) : y + h / 2 - eh / 2;
                const fromX = side ? x + boxW : x;
                const toX = side ? exitX : exitX + exitW;
                const textStart = rtl ? exitX + exitW - 9 : exitX + 9;
                return (
                  <g key={`exit-${k}`}>
                    <path d={`M ${fromX} ${y + h / 2} L ${fromX + (side ? 12 : -12)} ${y + h / 2} L ${fromX + (side ? 12 : -12)} ${ey + eh / 2} L ${toX + (side ? -2 : 2)} ${ey + eh / 2}`}
                      className="flow-link exit" markerEnd="url(#flow-arrow-exit)" />
                    <rect x={exitX} y={ey} width={exitW} height={eh} rx="7" className="flow-exit-box" />
                    {(exits.length > 1 ? [truncate(`${exit.word}: ${exit.text}`, 34)] : lines(`${exit.word}: ${exit.text}`, 30)).map((line, n, all) => (
                      <text key={n} x={textStart} y={ey + (all.length > 1 ? eh / 2 - 3 : eh / 2 + 4) + n * 13}
                        className="flow-exit-text" textAnchor="start">{line}</text>
                    ))}
                  </g>
                );
              })}
            </g>
          );
        })}
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
export function DecisionList({ steps, params = {} }) {
  const t = useT();
  const resolve = (text) => String(text || '').replace(/\{\{(\w+)\}\}/g, (m, k) => params[k] ?? m);
  const decisions = steps.map((s, i) => ({ ...s, no: i + 1 })).filter((s) => s.decision);
  if (!decisions.length) return null;

  const stepLabel = t('documentDetail.stepLabel');
  const yes = t('documentDetail.branchYes');
  const no = t('documentDetail.branchNo');

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
