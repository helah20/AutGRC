/**
 * A procedure's process flow as an editable PowerPoint swimlane chart.
 *
 * The diagram on screen is an image of the procedure; organisations present
 * and amend their procedures in PowerPoint, so the export is built from native
 * shapes — every lane, box, diamond, line and label is a separate object that
 * can be moved or retyped. It follows the on-screen diagram: lanes in
 * order of first appearance, one column per node, the flow running from the
 * reading start (right to left in Arabic), a decision's continuing outcome on
 * the main line and its other outcome dropping to a box below. A diagram that
 * disagreed with the document it illustrates would be worse than none.
 *
 * Lines are drawn as separate segments rather than glued connectors, because
 * the library writes no connection sites; moving a box means moving its lines
 * with it. The full wording of each step — what it starts from, what is done,
 * what it hands on — goes in the speaker notes, so the boxes can stay short.
 */

import PptxGenJS from 'pptxgenjs';
import { currentBrand, fitWithin } from './brand.js';

const INK = '0F1A3D';
const LINE = '333333';
const GREY = '8C8C8C';
const WHITE = 'FFFFFF';

const SW = 24;              // slide width, inches
const X0 = 0.2;
const X1 = SW - 0.2;
const TOP = 0.85;           // below the title bar
const LAB_W = 1.0;          // lane name bar: wide enough for a full role name on three lines
const MAIN_H = 1.55;        // band holding a lane's steps
const EXIT_H = 1.3;         // band below it, for outcomes that leave the path
const COL_PX = { start: 74, end: 74, step: 184, decision: 176 };   // as the on-screen diagram
const MAX_SCALE = 1.95 / 150;                                       // a step box no wider than 1.95"

/** Same rule as the on-screen diagram: the outcome that carries on to the next step. */
const CONTINUES = /^(continue|proceed)\b|^(يُ?نتقل|ينتقل|يُمضى|يمضي)/i;

const WORDS = {
  ar: { start: 'بداية الإجراء', end: 'نهاية الإجراء', yes: 'نعم', no: 'لا', input: 'المدخل', output: 'المخرج', responsible: 'المسؤول', decision: 'قرار' },
  en: { start: 'Start', end: 'End', yes: 'Yes', no: 'No', input: 'Input', output: 'Output', responsible: 'Responsible', decision: 'Decision' }
};

/**
 * @param {object} opts
 * @param {{steps: object[], lanes?: string[], rows?: object[], title?: string}} opts.flow
 * @param {object} opts.params      Parameter values for {{placeholders}}.
 * @param {'ar'|'en'} opts.lang
 * @param {string} opts.title
 * @param {string} [opts.subtitle]  Reference and version, shown in the title bar.
 * @returns {Promise<Buffer>}
 */
export async function buildSwimlanePptx({ flow, params = {}, lang = 'en', title, subtitle, brand = currentBrand() }) {
  const rtl = lang === 'ar';
  // The organisation's colours: bars in the primary, boxes in a light tint of
  // the accent so dark text stays readable on them, outlines in the accent.
  const BAR = brand.primary;
  const BOX = brand.soft;
  const EDGE = brand.accent;
  const W = WORDS[rtl ? 'ar' : 'en'];
  const resolve = (text) => String(text ?? '').replace(/\{\{(\w+)\}\}/g, (m, k) => params[k] ?? m);
  const font = { fontFace: rtl ? brand.fonts.arabic : brand.fonts.latin, lang: rtl ? 'ar-SA' : 'en-US', rtlMode: rtl, color: INK };

  // ---------------------------------------------------------------- lanes --
  const steps = flow.steps || [];
  let laneNames = flow.lanes;
  let rows = flow.rows;
  if (!laneNames?.length || rows?.length !== steps.length) {
    laneNames = [];
    rows = steps.map((s, i) => {
      const actor = resolve(s.actor);
      if (!laneNames.includes(actor)) laneNames.push(actor);
      return { no: i + 1, lane: laneNames.indexOf(actor) };
    });
  }

  // ---------------------------------------------------------------- nodes --
  const nodes = [{ kind: 'start', lane: rows[0]?.lane ?? 0 }];
  steps.forEach((step, i) => {
    const lane = rows[i].lane;
    nodes.push({ kind: 'step', lane, step, no: i + 1 });
    if (step.decision) {
      const options = [{ word: W.yes, text: resolve(step.decision.yes) }, { word: W.no, text: resolve(step.decision.no) }];
      const main = options.find((o) => CONTINUES.test(o.text)) || null;
      nodes.push({ kind: 'decision', lane, step, main, exits: options.filter((o) => o !== main) });
    }
  });
  nodes.push({ kind: 'end', lane: rows[rows.length - 1]?.lane ?? 0 });

  const hasExit = laneNames.map((_, l) => nodes.some((n) => n.kind === 'decision' && n.lane === l && n.exits.length));
  const laneH = (l) => MAIN_H + (hasExit[l] ? EXIT_H : 0);
  const laneTop = laneNames.map((_, l) => TOP + laneNames.slice(0, l).reduce((sum, __, k) => sum + laneH(k), 0));
  const contentBottom = laneTop[laneNames.length - 1] + laneH(laneNames.length - 1);
  const SH = Math.max(7.5, contentBottom + 0.25);
  const mainY = (l) => laneTop[l] + MAIN_H / 2;
  const exitY = (l) => laneTop[l] + MAIN_H + EXIT_H / 2 - 0.05;

  // Columns from the reading start, scaled to the slide.
  const areaStart = rtl ? X1 - LAB_W - 0.15 : X0 + LAB_W + 0.15;
  const area = X1 - X0 - LAB_W - 0.3;
  const px = nodes.map((n) => COL_PX[n.kind]);
  const scale = Math.min(area / px.reduce((a, b) => a + b, 0), MAX_SCALE);
  const fwd = rtl ? -1 : 1;
  const cx = (i) => areaStart + fwd * (px.slice(0, i).reduce((a, b) => a + b, 0) + px[i] / 2) * scale;
  const size = {
    step: { w: 150 * scale, h: 0.95 },
    decision: { w: Math.max(148 * scale, 1.45), h: 1.2 },
    exit: { w: 158 * scale, h: 0.8 },
    start: { w: 0.42, h: 0.42 },
    end: { w: 0.42, h: 0.42 }
  };
  const halfW = (n) => size[n.kind].w / 2;

  // ---------------------------------------------------------------- slide --
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'SWIMLANE', width: SW, height: SH });
  pptx.layout = 'SWIMLANE';
  pptx.rtlMode = rtl;
  pptx.title = title;
  const slide = pptx.addSlide();
  slide.background = { color: WHITE };

  // A straight segment from (x1, y1) to (x2, y2), with an arrowhead at the end if asked.
  const segment = (x1, y1, x2, y2, { arrow = false, dash = false, color = LINE, name = rtl ? 'سهم' : 'Arrow' } = {}) => {
    slide.addShape(pptx.ShapeType.line, {
      x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
      flipH: x2 < x1, flipV: y2 < y1,
      line: { color, width: dash ? 1 : 1.25, dashType: dash ? 'dash' : 'solid', ...(arrow ? { endArrowType: 'triangle' } : {}) },
      objectName: name
    });
  };
  const label = (x, y, text) => {
    const w = 0.11 * text.length + 0.25;
    slide.addText(text, { ...font, x: x - w / 2, y: y - 0.13, w, h: 0.26, fontSize: 9.5, bold: true, align: 'center', valign: 'middle', fill: { color: WHITE }, margin: 0, objectName: rtl ? 'تسمية سهم' : 'Arrow label' });
  };

  // Title bar.
  slide.addText([
    { text: title, options: { bold: true, fontSize: 20, color: WHITE } },
    ...(subtitle ? [{ text: `   ${subtitle}`, options: { fontSize: 12, color: WHITE } }] : [])
  ], { ...font, x: X0, y: 0.15, w: X1 - X0, h: 0.55, align: 'center', valign: 'middle', fill: { color: BAR }, line: { color: BAR }, objectName: rtl ? 'عنوان المخطط' : 'Title' });

  // The logo at the end of the title bar, on a white plate so any logo
  // colour reads against the bar.
  if (brand.logo) {
    const size = fitWithin(brand.logo, 1.4, 0.43);
    const plateW = size.width + 0.12;
    const plateX = rtl ? X0 + 0.06 : X1 - 0.06 - plateW;
    slide.addShape(pptx.ShapeType.roundRect, { x: plateX, y: 0.21, w: plateW, h: 0.43, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF' }, objectName: 'Logo plate' });
    slide.addImage({
      data: `data:image/${brand.logo.type === 'jpg' ? 'jpeg' : 'png'};base64,${brand.logo.buffer.toString('base64')}`,
      x: plateX + 0.06, y: 0.21 + (0.43 - size.height) / 2, w: size.width, h: size.height, objectName: 'Logo'
    });
  }

  // Lanes, with their name bar at the reading start.
  laneNames.forEach((name, l) => {
    const y = laneTop[l];
    const h = laneH(l);
    slide.addShape(pptx.ShapeType.rect, { x: X0, y, w: X1 - X0, h, fill: { type: 'none' }, line: { color: '000000', width: 2 }, objectName: `${rtl ? 'مسار' : 'Lane'} ${name}` });
    slide.addText(name, {
      ...font, x: rtl ? X1 - LAB_W : X0, y, w: LAB_W, h, fontSize: 10.5, bold: true, color: WHITE,
      align: 'center', valign: 'middle', vert: 'vert270', fill: { color: BAR }, line: { color: '000000', width: 2 }, margin: 2,
      objectName: `${rtl ? 'اسم المسار' : 'Lane name'} ${name}`
    });
  });

  // Nodes.
  nodes.forEach((n, i) => {
    const x = cx(i);
    const y = mainY(n.lane);
    const { w, h } = size[n.kind];
    if (n.kind === 'start' || n.kind === 'end') {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: x - w / 2, y: y - h / 2, w, h, fill: { color: BOX },
        line: n.kind === 'end' ? { color: '000000', width: 3.5 } : { color: EDGE, width: 1 },
        objectName: n.kind === 'start' ? W.start : W.end
      });
      slide.addText(n.kind === 'start' ? W.start : W.end, { ...font, x: x - 0.8, y: y + h / 2 + 0.02, w: 1.6, h: 0.3, fontSize: 10, bold: true, align: 'center', valign: 'top', margin: 0 });
    } else if (n.kind === 'step') {
      slide.addText([
        { text: String(n.no), options: { bold: true, fontSize: 11, breakLine: true } },
        { text: resolve(n.step.name), options: { fontSize: 11 } }
      ], {
        ...font, shape: pptx.ShapeType.roundRect, rectRadius: 0.12, x: x - w / 2, y: y - h / 2, w, h,
        align: 'center', valign: 'middle', fill: { color: BOX }, line: { color: EDGE, width: 1 }, margin: 3,
        objectName: `${rtl ? 'الخطوة' : 'Step'} ${n.no}`
      });
    } else if (n.kind === 'decision') {
      const question = resolve(n.step.decision.question);
      slide.addText(question, {
        ...font, shape: pptx.ShapeType.flowChartDecision, x: x - w / 2, y: y - h / 2, w, h,
        fontSize: 9, align: 'center', valign: 'middle', fill: { color: BOX }, line: { color: EDGE, width: 1 }, margin: 2,
        objectName: `${W.decision}: ${question}`
      });
      // Outcomes that leave the main line, each in a dashed box below. A
      // second one sits under the step before the decision: that column's
      // lower band is always empty, where the next column's is crossed by the
      // line to the next step whenever the work changes lanes there.
      n.exits.forEach((exit, k) => {
        const col = k === 0 ? i : i - 1;
        const ex = cx(col);
        const ey = exitY(n.lane);
        const box = size.exit;
        const top = y + h / 2;
        const boxTop = ey - box.h / 2;
        if (k === 0) {
          segment(x, top, ex, boxTop, { arrow: true });
        } else {
          segment(x, top, x, top + 0.08);
          segment(x, top + 0.08, ex, top + 0.08);
          segment(ex, top + 0.08, ex, boxTop, { arrow: true });
        }
        label(ex + fwd * -0.28, boxTop - 0.2, exit.word);
        slide.addText(exit.text, {
          ...font, shape: pptx.ShapeType.roundRect, rectRadius: 0.1, x: ex - box.w / 2, y: boxTop, w: box.w, h: box.h,
          fontSize: 9.5, align: 'center', valign: 'middle', fill: { color: WHITE }, line: { color: GREY, width: 1, dashType: 'dash' }, margin: 3,
          objectName: `${exit.word}: ${exit.text}`
        });
      });
    }
  });

  // Links between consecutive nodes: straight along a lane, an elbow in the
  // gap between columns where the work changes hands.
  nodes.slice(1).forEach((node, k) => {
    const from = nodes[k];
    const ax = cx(k) + fwd * halfW(from);
    const ay = mainY(from.lane);
    const bx = cx(k + 1) - fwd * halfW(node);
    const by = mainY(node.lane);
    if (from.lane === node.lane) {
      segment(ax, ay, bx, by, { arrow: true });
    } else {
      const midX = (ax + bx) / 2;
      segment(ax, ay, midX, ay);
      segment(midX, ay, midX, by);
      segment(midX, by, bx, by, { arrow: true });
    }
    // The continuing answer sits over the middle of the first segment.
    const firstEnd = from.lane === node.lane ? bx : (ax + bx) / 2;
    if (from.kind === 'decision' && from.main) label((ax + firstEnd) / 2, ay - 0.3, from.main.word);
  });

  // The full wording, for the presenter and for whoever edits the chart.
  slide.addNotes(steps.map((s, i) => [
    `${i + 1}. ${resolve(s.name)} — ${W.responsible}: ${resolve(s.actor)}`,
    s.input ? `${W.input}: ${resolve(s.input)}` : null,
    resolve(s.detail),
    s.decision ? `${W.decision}: ${resolve(s.decision.question)} ${W.yes}: ${resolve(s.decision.yes)} / ${W.no}: ${resolve(s.decision.no)}` : null,
    s.output ? `${W.output}: ${resolve(s.output)}` : null
  ].filter(Boolean).join('\n')).join('\n\n'));

  return pptx.write({ outputType: 'nodebuffer' });
}
