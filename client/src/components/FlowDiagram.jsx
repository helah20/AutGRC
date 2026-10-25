/**
 * Procedure flow, drawn as a swimlane flowchart.
 *
 * One horizontal lane per actor, and the process reads along the lanes in the
 * reader's direction: right to left in Arabic, left to right in English. It
 * opens at a start event and closes at an end event. Each step is a box; a
 * step that ends in a question is followed by a decision diamond, whose
 * outcome that carries on ("Continue to Approval") leads to the next step and
 * whose other outcome leads down to a box saying what happens instead. A line
 * that changes lane is a hand-off: the point at which the work changes hands,
 * and where a step is most often left unstarted.
 *
 * The lane layout comes from the server on `flow.lanes`/`flow.rows` so that
 * the diagram and the document it illustrates cannot disagree; it is derived
 * here only for a document generated before that was carried.
 */

import { useT } from '../i18n/index.jsx';

const PAD = 12;
const HEAD_W = 128;          // lane name column, at the reading start
const MAIN_H = 104;          // the band of a lane that holds its steps
const EXIT_H = 92;           // the band below it, for decision outcomes that leave the path
const COL = { start: 74, end: 74, step: 184, decision: 176 };
const STEP_W = 150, STEP_H = 62;
const DIAMOND_W = 148, DIAMOND_H = 86;
const EXIT_W = 158, EXIT_H_BOX = 62;
const EVENT_R = 15;

/**
 * A decision outcome that carries on to the next step ("Continue to
 * Approval"), as against one that leaves the main path ("Close the request").
 */
const CONTINUES = /^(continue|proceed)\b|^(يُ?نتقل|ينتقل|يُمضى|يمضي)/i;

/** Up to `count` lines of about `max` characters, broken at spaces; the last is shortened if need be. */
function lines(text, max, count = 2) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out = [''];
  for (const word of words) {
    const current = out[out.length - 1];
    if (!current || (current + ' ' + word).length <= max) out[out.length - 1] = current ? `${current} ${word}` : word;
    else if (out.length < count) out.push(word);
    else { out[count - 1] = truncate(`${out[count - 1]} ${word}`, max); break; }
  }
  return out;
}

export default function FlowDiagram({ steps, lanes, rows, params = {}, rtl = false }) {
  const t = useT();
  const resolve = (text) => String(text || '').replace(/\{\{(\w+)\}\}/g, (m, k) => params[k] ?? m);
  const layout = laneLayout({ steps, lanes, rows, resolve });
  if (!layout) return null;
  const { lanes: laneNames, rows: laneRows } = layout;
  const yesWord = t('documentDetail.branchYes');
  const noWord = t('documentDetail.branchNo');

  const outcomes = (row) => {
    const d = row.decision;
    const options = [{ word: yesWord, text: resolve(d.yes) }, { word: noWord, text: resolve(d.no) }];
    const main = options.find((o) => CONTINUES.test(o.text)) || null;
    return { main, exits: options.filter((o) => o !== main) };
  };

  // The sequence of nodes along the reading direction, one per column.
  const nodes = [{ kind: 'start', lane: laneRows[0].lane }];
  laneRows.forEach((row) => {
    nodes.push({ kind: 'step', lane: row.lane, row });
    if (row.decision) nodes.push({ kind: 'decision', lane: row.lane, row, ...outcomes(row) });
  });
  nodes.push({ kind: 'end', lane: laneRows[laneRows.length - 1].lane });

  // Lanes with a leaving outcome get a second band to hold it.
  const hasExit = laneNames.map((_, l) => nodes.some((n) => n.kind === 'decision' && n.lane === l && n.exits.length));
  const laneH = (l) => MAIN_H + (hasExit[l] ? EXIT_H : 0);
  const laneTop = laneNames.map((_, l) => PAD + laneNames.slice(0, l).reduce((sum, __, k) => sum + laneH(k), 0));
  const mainY = (l) => laneTop[l] + MAIN_H / 2;
  const exitY = (l) => laneTop[l] + MAIN_H + EXIT_H / 2 - 4;

  const colW = nodes.map((n) => COL[n.kind]);
  const flowW = colW.reduce((a, b) => a + b, 0);
  const width = PAD * 2 + HEAD_W + flowW;
  const height = laneTop[laneNames.length - 1] + laneH(laneNames.length - 1) + PAD;
  // Column centres, laid out from the reading start.
  const offset = (i) => colW.slice(0, i).reduce((a, b) => a + b, 0) + colW[i] / 2;
  const cxOf = (i) => (rtl ? width - PAD - HEAD_W - offset(i) : PAD + HEAD_W + offset(i));
  const forward = rtl ? -1 : 1;
  const halfW = (n) => (n.kind === 'step' ? STEP_W / 2 : n.kind === 'decision' ? DIAMOND_W / 2 : EVENT_R);

  // Connectors between consecutive nodes: straight along a lane, an elbow in
  // the gap between columns when the work changes lanes.
  const links = [];
  nodes.slice(1).forEach((node, k) => {
    const from = nodes[k];
    const ax = cxOf(k) + forward * halfW(from);
    const ay = mainY(from.lane);
    const bx = cxOf(k + 1) - forward * halfW(node);
    const by = mainY(node.lane);
    const handoff = from.lane !== node.lane;
    const midX = (ax + bx) / 2;
    const d = handoff ? `M ${ax} ${ay} L ${midX} ${ay} L ${midX} ${by} L ${bx - forward * 2} ${by}`
      : `M ${ax} ${ay} L ${bx - forward * 2} ${by}`;
    const label = from.kind === 'decision' && from.main ? from.main.word : null;
    links.push({ d, handoff, label, lx: ax + forward * 18, ly: ay - 8 });
  });

  const exits = [];
  nodes.forEach((node, i) => {
    if (node.kind !== 'decision') return;
    node.exits.forEach((exit, k) => {
      // The first outcome sits under its diamond; a second, under the next column.
      const col = Math.min(i + k, nodes.length - 1);
      const ex = cxOf(col);
      const ey = exitY(node.lane);
      const top = mainY(node.lane) + DIAMOND_H / 2;
      const d = k === 0
        ? `M ${cxOf(i)} ${top} L ${ex} ${ey - EXIT_H_BOX / 2 - 2}`
        : `M ${cxOf(i)} ${top} L ${cxOf(i)} ${top + 10} L ${ex} ${top + 10} L ${ex} ${ey - EXIT_H_BOX / 2 - 2}`;
      exits.push({ key: `${i}-${k}`, d, x: ex, y: ey, word: exit.word, text: exit.text, lx: cxOf(i) + forward * 8 + (k ? forward * 40 : 0), ly: top + (k ? 22 : 14) });
    });
  });

  const nameX = rtl ? width - PAD - HEAD_W / 2 : PAD + HEAD_W / 2;
  const start = t('documentDetailUi.flowStart');
  const end = t('documentDetailUi.flowEnd');

  return (
    <div className="flow-canvas">
      <svg className="flow-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height}
        role="img" style={{ direction: rtl ? 'rtl' : 'ltr' }}
        aria-label={`Process flow across ${laneNames.length} actors and ${laneRows.length} steps`}>
        <defs>
          {['', '-handoff', '-exit'].map((suffix) => (
            <marker key={suffix} id={`flow-arrow${suffix}`} markerWidth="9" markerHeight="8" refX="8" refY="4" orient="auto">
              <polygon points="0 0, 9 4, 0 8" className={`flow-arrow ${suffix.slice(1)}`} />
            </marker>
          ))}
        </defs>

        {/* Lanes: a header cell at the reading start, then the lane's band. */}
        {laneNames.map((name, l) => (
          <g key={`lane-${l}`}>
            <rect x={PAD} y={laneTop[l]} width={width - PAD * 2} height={laneH(l)} className={`flow-lane ${l % 2 ? 'alt' : ''}`} />
            <rect x={rtl ? width - PAD - HEAD_W : PAD} y={laneTop[l]} width={HEAD_W} height={laneH(l)} className="flow-lane-head" />
            <line x1={PAD} y1={laneTop[l]} x2={width - PAD} y2={laneTop[l]} className="flow-lane-edge" />
            {lines(name, 17, 4).map((line, k, all) => (
              <text key={k} x={nameX} y={laneTop[l] + laneH(l) / 2 + (k - (all.length - 1) / 2) * 15 + 4}
                textAnchor="middle" className="flow-lane-label">{line}</text>
            ))}
          </g>
        ))}
        <rect x={PAD} y={PAD} width={width - PAD * 2} height={height - PAD * 2} className="flow-frame" />

        {links.map((link, k) => (
          <g key={`link-${k}`}>
            <path d={link.d} className={`flow-link ${link.handoff ? 'handoff' : ''}`}
              markerEnd={`url(#flow-arrow${link.handoff ? '-handoff' : ''})`} />
            {link.label && (
              <text x={link.lx} y={link.ly} textAnchor="start" className="flow-branch-word">{link.label}</text>
            )}
          </g>
        ))}

        {exits.map((exit) => (
          <g key={exit.key}>
            <path d={exit.d} className="flow-link exit" markerEnd="url(#flow-arrow-exit)" />
            <text x={exit.lx} y={exit.ly} textAnchor="start" className="flow-branch-word exit">{exit.word}</text>
            <rect x={exit.x - EXIT_W / 2} y={exit.y - EXIT_H_BOX / 2} width={EXIT_W} height={EXIT_H_BOX} rx="8" className="flow-exit-box" />
            {lines(exit.text, 26, 3).map((line, k, all) => (
              <text key={k} x={exit.x} y={exit.y + (k - (all.length - 1) / 2) * 13 + 4} textAnchor="middle" className="flow-exit-text">{line}</text>
            ))}
          </g>
        ))}

        {nodes.map((node, i) => {
          const cx = cxOf(i);
          const cy = mainY(node.lane);
          if (node.kind === 'start' || node.kind === 'end') {
            return (
              <g key={`node-${i}`}>
                <circle cx={cx} cy={cy} r={EVENT_R} className={`flow-event ${node.kind}`} />
                <text x={cx} y={cy + EVENT_R + 15} textAnchor="middle" className="flow-event-label">{node.kind === 'start' ? start : end}</text>
              </g>
            );
          }
          if (node.kind === 'decision') {
            return (
              <g key={`node-${i}`}>
                <polygon points={`${cx},${cy - DIAMOND_H / 2} ${cx + DIAMOND_W / 2},${cy} ${cx},${cy + DIAMOND_H / 2} ${cx - DIAMOND_W / 2},${cy}`}
                  className="flow-node-box decision" />
                {lines(resolve(node.row.decision.question), 19, 3).map((line, k, all) => (
                  <text key={k} x={cx} y={cy + (k - (all.length - 1) / 2) * 12 + 4} textAnchor="middle" className="flow-node-question">{line}</text>
                ))}
              </g>
            );
          }
          const x = cx - STEP_W / 2;
          const y = cy - STEP_H / 2;
          const badgeX = rtl ? x + STEP_W - 13 : x + 13;
          return (
            <g key={`node-${i}`}>
              <rect x={x} y={y} width={STEP_W} height={STEP_H} rx="8" className="flow-node-box" />
              <circle cx={badgeX} cy={y + 13} r="9" className="flow-node-badge" />
              <text x={badgeX} y={y + 16.5} textAnchor="middle" className="flow-node-num">{node.row.no}</text>
              {lines(node.row.name, 18, 2).map((line, k, all) => (
                <text key={k} x={cx} y={cy + (k - (all.length - 1) / 2) * 14 + 9} textAnchor="middle" className="flow-node-title">{line}</text>
              ))}
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
