/**
 * Procedure flow diagram.
 *
 * Renders the process as an SVG chain, branching decision points out to the
 * side so the happy path stays readable top to bottom.
 */

const BOX_W = 208;
const BOX_H = 62;
const GAP_Y = 34;
const DECISION_W = 186;
const PAD = 16;

export default function FlowDiagram({ steps, params = {} }) {
  if (!steps?.length) return null;

  const resolve = (text) => String(text || '').replace(/\{\{(\w+)\}\}/g, (m, k) => params[k] ?? m);

  const hasDecisions = steps.some((s) => s.decision);
  const width = PAD * 2 + BOX_W + (hasDecisions ? DECISION_W + 46 : 0);
  const height = PAD * 2 + steps.length * BOX_H + (steps.length - 1) * GAP_Y;

  return (
    <div className="flow-canvas">
      <svg className="flow-svg" viewBox={`0 0 ${width} ${height}`} width={width} height={height}
        role="img" aria-label="Process flow diagram">
        <defs>
          <marker id="flow-arrow" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
            <polygon points="0 0, 9 3.5, 0 7" className="flow-arrow" />
          </marker>
        </defs>

        {steps.map((step, i) => {
          const y = PAD + i * (BOX_H + GAP_Y);
          const isFirst = i === 0;
          const isLast = i === steps.length - 1;
          const kind = step.decision ? 'decision' : isFirst || isLast ? 'terminal' : '';

          return (
            <g key={i}>
              {i > 0 && (
                <line x1={PAD + BOX_W / 2} y1={y - GAP_Y} x2={PAD + BOX_W / 2} y2={y - 5}
                  className="flow-link" markerEnd="url(#flow-arrow)" />
              )}

              <rect x={PAD} y={y} width={BOX_W} height={BOX_H} rx="7" className={`flow-node-box ${kind}`} />
              <text x={PAD + 11} y={y + 18} className="flow-node-num">{String(i + 1).padStart(2, '0')}</text>
              <text x={PAD + 11} y={y + 36} className="flow-node-title">
                {truncate(resolve(step.name), 24)}
              </text>
              <text x={PAD + 11} y={y + 51} className="flow-node-actor">
                {truncate(resolve(step.actor), 30)}
              </text>

              {step.decision && (
                <g>
                  <line x1={PAD + BOX_W} y1={y + BOX_H / 2} x2={PAD + BOX_W + 34} y2={y + BOX_H / 2}
                    className="flow-link" markerEnd="url(#flow-arrow)" />
                  <text x={PAD + BOX_W + 6} y={y + BOX_H / 2 - 6} className="flow-link-label">no</text>
                  <rect x={PAD + BOX_W + 38} y={y + 6} width={DECISION_W} height={BOX_H - 12} rx="6"
                    className="flow-node-box decision" />
                  <text x={PAD + BOX_W + 48} y={y + 26} className="flow-node-actor" style={{ fontWeight: 600 }}>
                    {truncate(resolve(step.decision.question), 30)}
                  </text>
                  <text x={PAD + BOX_W + 48} y={y + 42} className="flow-node-actor">
                    {truncate(resolve(step.decision.no), 32)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncate(text, max) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Decision points listed in full beneath the diagram. */
export function DecisionList({ steps, params = {} }) {
  const resolve = (text) => String(text || '').replace(/\{\{(\w+)\}\}/g, (m, k) => params[k] ?? m);
  const decisions = steps.map((s, i) => ({ ...s, no: i + 1 })).filter((s) => s.decision);
  if (!decisions.length) return null;

  return (
    <div className="flow-decision-list">
      {decisions.map((s) => (
        <div key={s.no} className="flow-decision">
          <div className="flow-decision-q">Step {s.no} — {resolve(s.decision.question)}</div>
          <div className="flow-branch"><span className="flow-branch-label">Yes</span><span>{resolve(s.decision.yes)}</span></div>
          <div className="flow-branch"><span className="flow-branch-label">No</span><span>{resolve(s.decision.no)}</span></div>
        </div>
      ))}
    </div>
  );
}
