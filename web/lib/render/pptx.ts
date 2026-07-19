import PptxGenJS from "pptxgenjs";
import type { ChartSpec, DeckSpec, SlideSpec } from "../schemas";

// Deck-spec -> .pptx. Mirrors scripts/build_pptx.py's neutral style:
// white surface, assertive 24pt headline + accent rule, sources in speaker notes.
// bar/barh/line/pie become NATIVE PowerPoint charts (editable); venn/gantt/swot
// are drawn with shapes.

const INK = "0B0B0B";
const INK2 = "52514E";
const MUTED = "898781";
const ACCENT = "2A78D6";
// Validated categorical palette, fixed order (same as build_charts.py).
const SERIES = ["2A78D6", "008300", "E87BA4", "EDA100", "1BAF7A", "EB6834", "4A3AA7", "E34948"];
const SWOT_COLORS = { s: SERIES[0], w: SERIES[7], o: SERIES[1], t: SERIES[3] };

const W = 13.333;
const H = 7.5;
const MARGIN = 0.6;
const BODY_TOP = 1.55;

type Slide = PptxGenJS.Slide;

function headline(slide: Slide, text: string) {
  slide.addText(text, {
    x: MARGIN, y: 0.45, w: W - MARGIN * 2, h: 0.95,
    fontSize: 24, bold: true, color: INK, align: "left", valign: "top",
  });
  slide.addShape("rect", { x: MARGIN, y: 1.38, w: 1.6, h: 0.03, fill: { color: ACCENT } });
}

function notes(slide: Slide, s: SlideSpec) {
  const parts: string[] = [];
  if (s.notes) parts.push(s.notes);
  if (s.sources?.length) parts.push("Sources: " + s.sources.join("; "));
  if (parts.length) slide.addNotes(parts.join("\n"));
}

function bulletRuns(bullets: (string | { text: string; sub?: string[] })[]): PptxGenJS.TextProps[] {
  const runs: PptxGenJS.TextProps[] = [];
  for (const b of bullets) {
    const text = typeof b === "string" ? b : b.text;
    runs.push({ text, options: { bullet: { characterCode: "2022", indent: 12 }, fontSize: 16, color: INK2, paraSpaceAfter: 10 } });
    if (typeof b !== "string" && b.sub) {
      for (const s of b.sub) {
        runs.push({ text: s, options: { bullet: { characterCode: "2013", indent: 12 }, indentLevel: 1, fontSize: 14, color: MUTED, paraSpaceAfter: 4 } });
      }
    }
  }
  return runs;
}

// ---------- charts ----------

function chartCommon(spec: ChartSpec) {
  return {
    x: 1.2, y: 1.7, w: W - 2.4, h: 4.9,
    chartColors: SERIES,
    title: spec.title,
    showTitle: true,
    titleFontSize: 15,
    titleColor: INK,
    titleAlign: "left" as const,
    catAxisLabelColor: MUTED,
    valAxisLabelColor: MUTED,
    valGridLine: { color: "E1E0D9", style: "solid" as const, size: 1 },
    catGridLine: { style: "none" as const },
    legendPos: "t" as const,
    legendColor: INK2,
    legendFontSize: 10,
    dataLabelColor: INK2,
    dataLabelFontSize: 9,
    showValue: true,
  };
}

function addNativeChart(pptx: PptxGenJS, slide: Slide, spec: ChartSpec) {
  const d = spec.data as { labels: string[]; series?: { name: string; values: number[] }[]; values?: number[] };
  if (spec.type === "pie") {
    slide.addChart(pptx.ChartType.pie, [{ name: spec.title, labels: d.labels, values: d.values ?? [] }], {
      ...chartCommon(spec),
      showPercent: true,
      showValue: false,
      showLegend: true,
    });
    return;
  }
  const data = (d.series ?? []).map((s) => ({ name: s.name, labels: d.labels, values: s.values }));
  const type = spec.type === "line" ? pptx.ChartType.line : pptx.ChartType.bar;
  slide.addChart(type, data, {
    ...chartCommon(spec),
    barDir: spec.type === "barh" ? "bar" : "col",
    lineSize: spec.type === "line" ? 2 : undefined,
    lineDataSymbol: spec.type === "line" ? "circle" : undefined,
    lineDataSymbolSize: 6,
    showLegend: (d.series ?? []).length > 1,
  });
}

function addVenn(slide: Slide, spec: ChartSpec) {
  const d = spec.data as { sets: string[]; overlap_label?: string };
  const three = spec.type === "venn3" && d.sets.length >= 3;
  const cy = 3.6;
  const r = 1.55;
  const centers = three
    ? [{ x: 5.1, y: cy - 0.4 }, { x: 6.9, y: cy - 0.4 }, { x: 6.0, y: cy + 1.0 }]
    : [{ x: 5.2, y: cy }, { x: 7.0, y: cy }];
  centers.forEach((c, i) => {
    slide.addShape("ellipse", {
      x: c.x - r, y: c.y - r, w: r * 2, h: r * 2,
      fill: { color: SERIES[i], transparency: 60 },
      line: { color: SERIES[i], width: 2 },
    });
  });
  const labelPos = three
    ? [{ x: 2.2, y: 1.3 }, { x: 8.6, y: 1.3 }, { x: 5.0, y: 6.3 }]
    : [{ x: 2.0, y: 1.6 }, { x: 8.8, y: 1.6 }];
  d.sets.slice(0, centers.length).forEach((name, i) => {
    slide.addText(name, { x: labelPos[i].x, y: labelPos[i].y, w: 2.8, h: 0.5, fontSize: 13, bold: true, color: INK, align: "center" });
  });
  if (d.overlap_label) {
    slide.addText(d.overlap_label, { x: 4.6, y: three ? 3.0 : 3.2, w: 3.0, h: 0.9, fontSize: 11, bold: true, color: INK, align: "center", valign: "middle" });
  }
  if (spec.caption) slide.addText(spec.caption, { x: MARGIN, y: 6.9, w: W - MARGIN * 2, h: 0.35, fontSize: 8, color: MUTED });
}

function addSwot(slide: Slide, spec: ChartSpec) {
  const d = spec.data as { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] };
  const quads = [
    { title: "STRENGTHS", items: d.strengths, color: SWOT_COLORS.s, col: 0, row: 0 },
    { title: "WEAKNESSES", items: d.weaknesses, color: SWOT_COLORS.w, col: 1, row: 0 },
    { title: "OPPORTUNITIES", items: d.opportunities, color: SWOT_COLORS.o, col: 0, row: 1 },
    { title: "THREATS", items: d.threats, color: SWOT_COLORS.t, col: 1, row: 1 },
  ];
  const qw = (W - MARGIN * 2 - 0.2) / 2;
  const qh = 2.55;
  for (const q of quads) {
    const x = MARGIN + q.col * (qw + 0.2);
    const y = 1.7 + q.row * (qh + 0.2);
    slide.addShape("rect", { x, y, w: qw, h: qh, fill: { color: q.color, transparency: 90 }, line: { color: q.color, width: 1.5 } });
    slide.addText(q.title, { x: x + 0.15, y: y + 0.08, w: qw - 0.3, h: 0.4, fontSize: 13, bold: true, color: q.color });
    slide.addText(
      q.items.slice(0, 5).map((it) => ({ text: it, options: { bullet: { characterCode: "2022", indent: 10 }, fontSize: 11, color: INK, paraSpaceAfter: 4 } })),
      { x: x + 0.15, y: y + 0.5, w: qw - 0.3, h: qh - 0.6, valign: "top" }
    );
  }
  if (spec.caption) slide.addText(spec.caption, { x: MARGIN, y: 7.05, w: W - MARGIN * 2, h: 0.3, fontSize: 8, color: MUTED });
}

function addGantt(slide: Slide, spec: ChartSpec) {
  const d = spec.data as { tasks: { name: string; start: string; end: string; group?: string }[] };
  const tasks = d.tasks;
  if (!tasks.length) return;
  const t0 = Math.min(...tasks.map((t) => Date.parse(t.start)));
  const t1 = Math.max(...tasks.map((t) => Date.parse(t.end)));
  const span = Math.max(t1 - t0, 1);
  const plotX = 3.2;
  const plotW = W - plotX - MARGIN;
  const rowH = Math.min(0.7, 4.6 / tasks.length);
  const groups: string[] = [];
  for (const t of tasks) {
    const g = t.group ?? "";
    if (!groups.includes(g)) groups.push(g);
  }
  tasks.forEach((t, i) => {
    const y = 1.9 + i * (rowH + 0.15);
    const x = plotX + ((Date.parse(t.start) - t0) / span) * plotW;
    const w = Math.max(((Date.parse(t.end) - Date.parse(t.start)) / span) * plotW, 0.15);
    const color = SERIES[groups.indexOf(t.group ?? "") % SERIES.length];
    slide.addText(t.name, { x: MARGIN, y, w: plotX - MARGIN - 0.1, h: rowH, fontSize: 11, color: INK2, align: "right", valign: "middle" });
    slide.addShape("rect", { x, y: y + rowH * 0.15, w, h: rowH * 0.7, fill: { color } });
  });
  // month tick labels
  const start = new Date(t0);
  const months: Date[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cur.getTime() <= t1) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  months.forEach((m) => {
    const x = plotX + ((m.getTime() - t0) / span) * plotW;
    if (x >= plotX - 0.01 && x <= plotX + plotW) {
      slide.addText(m.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), {
        x: x - 0.4, y: 6.55, w: 0.9, h: 0.3, fontSize: 9, color: MUTED, align: "center",
      });
    }
  });
  if (groups.length > 1 && groups.some(Boolean)) {
    const legendRuns = groups.map((g, i) => ({ text: `■ ${g || "other"}   `, options: { color: SERIES[i % SERIES.length], fontSize: 10 } }));
    slide.addText(legendRuns, { x: plotX, y: 1.45, w: plotW, h: 0.35 });
  }
  if (spec.caption) slide.addText(spec.caption, { x: MARGIN, y: 6.95, w: W - MARGIN * 2, h: 0.35, fontSize: 8, color: MUTED });
}

// ---------- slides ----------

export async function renderDeck(spec: DeckSpec): Promise<{ buffer: Buffer; warnings: string[] }> {
  const warnings: string[] = [];
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "WIDE", width: W, height: H });
  pptx.layout = "WIDE";
  const meta = spec.meta;
  const charts = new Map(spec.charts.map((c) => [c.id, c]));

  for (const s of spec.slides) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };

    switch (s.type) {
      case "title": {
        slide.addText(meta.title, { x: MARGIN, y: 2.5, w: W - MARGIN * 2, h: 1.0, fontSize: 38, bold: true, color: INK });
        if (meta.subtitle) slide.addText(meta.subtitle, { x: MARGIN, y: 3.6, w: W - MARGIN * 2, h: 0.7, fontSize: 20, color: INK2 });
        const byline = [meta.author, meta.date].filter(Boolean).join(" · ");
        if (byline) slide.addText(byline, { x: MARGIN, y: 6.4, w: W - MARGIN * 2, h: 0.5, fontSize: 12, color: MUTED });
        break;
      }
      case "agenda": {
        headline(slide, s.headline ?? "Agenda");
        slide.addText(
          s.items.map((item, i) => ({ text: `${i + 1}   ${item}`, options: { fontSize: 18, color: INK2, paraSpaceAfter: 14 } })),
          { x: MARGIN, y: BODY_TOP, w: W - MARGIN * 2, h: 5.2, valign: "top" }
        );
        break;
      }
      case "content": {
        headline(slide, s.headline);
        if (s.bullets.length > 6) warnings.push(`slide "${s.headline}": ${s.bullets.length} bullets (>6)`);
        slide.addText(bulletRuns(s.bullets), { x: MARGIN, y: BODY_TOP, w: W - MARGIN * 2, h: 5.2, valign: "top" });
        break;
      }
      case "two_column": {
        headline(slide, s.headline);
        const colW = (W - MARGIN * 2 - 0.4) / 2;
        ([s.left, s.right] as const).forEach((col, i) => {
          const x = MARGIN + i * (colW + 0.4);
          slide.addText(col.title, { x, y: BODY_TOP, w: colW, h: 0.45, fontSize: 17, bold: true, color: ACCENT });
          slide.addText(bulletRuns(col.bullets), { x, y: BODY_TOP + 0.55, w: colW, h: 4.6, valign: "top" });
        });
        break;
      }
      case "chart":
      case "swot": {
        headline(slide, s.headline);
        const chart = charts.get(s.chart_id)!; // refs validated by deckSpec schema
        if (chart.type === "swot") addSwot(slide, chart);
        else if (chart.type === "venn2" || chart.type === "venn3") addVenn(slide, chart);
        else if (chart.type === "gantt") addGantt(slide, chart);
        else addNativeChart(pptx, slide, chart);
        if ("takeaway" in s && s.takeaway) {
          slide.addText(s.takeaway, { x: MARGIN, y: 6.85, w: W - MARGIN * 2, h: 0.5, fontSize: 13, italic: true, color: INK2, align: "center" });
        }
        break;
      }
      case "table": {
        headline(slide, s.headline);
        const rows: PptxGenJS.TableRow[] = [
          s.columns.map((c) => ({ text: c, options: { bold: true, fontSize: 13, color: INK, fill: { color: "F0EFEC" } } })),
          ...s.rows.map((r) => r.map((v) => ({ text: v, options: { fontSize: 12, color: INK2 } }))),
        ];
        slide.addTable(rows, { x: MARGIN, y: BODY_TOP, w: W - MARGIN * 2, border: { type: "solid", color: "E1E0D9", pt: 0.5 }, autoPage: false });
        break;
      }
      case "closing": {
        slide.addText(s.headline, { x: MARGIN, y: 2.2, w: W - MARGIN * 2, h: 0.9, fontSize: 28, bold: true, color: INK });
        if (s.call_to_action) slide.addText(s.call_to_action, { x: MARGIN, y: 3.2, w: W - MARGIN * 2, h: 0.6, fontSize: 18, bold: true, color: ACCENT });
        if (s.next_steps?.length) {
          slide.addText("Next steps", { x: MARGIN, y: 4.2, w: W - MARGIN * 2, h: 0.4, fontSize: 15, bold: true, color: MUTED });
          slide.addText(
            s.next_steps.map((n) => ({ text: n, options: { bullet: { characterCode: "2022", indent: 10 }, fontSize: 15, color: INK2, paraSpaceAfter: 6 } })),
            { x: MARGIN, y: 4.65, w: W - MARGIN * 2, h: 2.2, valign: "top" }
          );
        }
        break;
      }
    }
    notes(slide, s);
  }

  const buffer = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return { buffer, warnings };
}
