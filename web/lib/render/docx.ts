import {
  AlignmentType, Document, HeadingLevel, Packer, Paragraph, Table, TableCell,
  TableRow, TextRun, WidthType,
} from "docx";
import type { MinutesSpec } from "../schemas";

// Minutes-spec -> .docx. Mirrors scripts/build_docx.py: title block, attendees
// table, agenda, sections ((L) markers preserved), decisions, actions table,
// needs-human-review box, sources appendix, ~450-words-per-page budget check.

const WORDS_PER_PAGE = 450;
const PAGE_BUDGET = 10;

const INK2 = "52514E";
const MUTED = "898781";
const ACCENT = "2A78D6";

function kv(label: string, value: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, color: INK2 }),
      new TextRun({ text: value, color: INK2 }),
    ],
  });
}

function bullet(text: string, color?: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, color })], bullet: { level: 0 } });
}

function headerRow(cells: string[]): TableRow {
  return new TableRow({
    children: cells.map(
      (c) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: c, bold: true })] })] })
    ),
  });
}

function row(cells: string[]): TableRow {
  return new TableRow({ children: cells.map((c) => new TableCell({ children: [new Paragraph(c)] })) });
}

export async function renderMinutes(spec: MinutesSpec): Promise<{ buffer: Buffer; estPages: number; overBudget: boolean }> {
  const meta = spec.meta;
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({ text: meta.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.LEFT }));
  for (const [label, value] of [
    ["Date", meta.date], ["Time", meta.time], ["Location", meta.location], ["Author", meta.author],
  ] as const) {
    if (value) children.push(kv(label, value));
  }

  if (spec.attendees.length) {
    children.push(new Paragraph({ text: "Attendees", heading: HeadingLevel.HEADING_1 }));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          headerRow(["Name", "Role", "Present"]),
          ...spec.attendees.map((a) => row([a.name, a.role ?? "", a.present ? "Yes" : "No"])),
        ],
      })
    );
  }

  if (spec.agenda.length) {
    children.push(new Paragraph({ text: "Agenda", heading: HeadingLevel.HEADING_1 }));
    spec.agenda.forEach((item, i) => children.push(new Paragraph(`${i + 1}. ${item}`)));
  }

  for (const sec of spec.sections) {
    children.push(new Paragraph({ text: sec.heading, heading: HeadingLevel.HEADING_1 }));
    if (sec.summary) {
      children.push(new Paragraph({ children: [new TextRun({ text: sec.summary, italics: true, color: INK2 })] }));
    }
    for (const pt of sec.points) {
      children.push(bullet(pt.confidence === "L" ? `${pt.text} (L)` : pt.text));
    }
  }

  if (spec.decisions.length) {
    children.push(new Paragraph({ text: "Decisions", heading: HeadingLevel.HEADING_1 }));
    for (const d of spec.decisions) {
      children.push(bullet(d.owner ? `${d.text} — owner: ${d.owner}` : d.text));
    }
  }

  if (spec.actions.length) {
    children.push(new Paragraph({ text: "Action Items", heading: HeadingLevel.HEADING_1 }));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          headerRow(["Action", "Owner", "Due"]),
          ...spec.actions.map((a) => row([a.text, a.owner ?? "", a.due ?? "TBD"])),
        ],
      })
    );
  }

  if (spec.review_items.length) {
    children.push(new Paragraph({ text: "Needs Human Review", heading: HeadingLevel.HEADING_1 }));
    for (const r of spec.review_items) {
      children.push(bullet(`${r.text} — ${r.reason ?? "low confidence"}`, ACCENT));
    }
  }

  if (spec.appendix_sources.length) {
    children.push(new Paragraph({ text: "Appendix — Sources", heading: HeadingLevel.HEADING_1 }));
    for (const s of spec.appendix_sources) children.push(bullet(s, MUTED));
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);

  // Word-count estimate from the spec content itself (same heuristic as build_docx.py).
  const texts: string[] = [
    meta.title,
    ...spec.agenda,
    ...spec.sections.flatMap((s) => [s.heading, s.summary ?? "", ...s.points.map((p) => p.text)]),
    ...spec.decisions.map((d) => d.text),
    ...spec.actions.map((a) => `${a.text} ${a.owner ?? ""} ${a.due ?? ""}`),
    ...spec.review_items.map((r) => `${r.text} ${r.reason ?? ""}`),
    ...spec.appendix_sources,
    ...spec.attendees.map((a) => `${a.name} ${a.role ?? ""}`),
  ];
  const words = texts.join(" ").split(/\s+/).filter(Boolean).length;
  const estPages = Math.max(1, Math.ceil(words / WORDS_PER_PAGE));

  return { buffer: Buffer.from(buffer), estPages, overBudget: estPages > PAGE_BUDGET };
}
