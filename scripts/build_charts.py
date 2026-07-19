#!/usr/bin/env python3
"""Render chart-spec JSON into slide-ready PNGs.

Usage:
    python scripts/build_charts.py <spec.json> [--outdir deliverables/charts]

<spec.json> is either a full deck spec (reads its "charts" array) or a
standalone {"charts": [...]} file. See specs/deck-spec.schema.md.
"""
import argparse
import json
import sys
from datetime import date
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.dates as mdates
import matplotlib.pyplot as plt
from matplotlib.patches import Circle

# Validated categorical palette (fixed order, never cycled) — light surface.
SERIES = ["#2a78d6", "#008300", "#e87ba4", "#eda100",
          "#1baf7a", "#eb6834", "#4a3aa7", "#e34948"]
INK = "#0b0b0b"
INK_2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
BASELINE = "#c3c2b7"
SURFACE = "#ffffff"

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Segoe UI", "Arial", "sans-serif"],
    "figure.facecolor": SURFACE,
    "axes.facecolor": SURFACE,
    "axes.edgecolor": BASELINE,
    "axes.labelcolor": INK_2,
    "axes.titlecolor": INK,
    "xtick.color": MUTED,
    "ytick.color": MUTED,
    "axes.grid": False,
    "axes.spines.top": False,
    "axes.spines.right": False,
})

FIGSIZE = (10, 5.5)
DPI = 200


def _new_fig():
    fig, ax = plt.subplots(figsize=FIGSIZE)
    return fig, ax


def _finish(fig, ax, spec, outpath, caption_y=0.01):
    ax.set_title(spec.get("title", ""), fontsize=15, loc="left", pad=14, weight="bold")
    caption = spec.get("caption")
    if caption:
        fig.text(0.01, caption_y, caption, fontsize=8, color=MUTED)
    fig.tight_layout()
    fig.savefig(outpath, dpi=DPI, facecolor=SURFACE, bbox_inches="tight")
    plt.close(fig)


def _fmt(v):
    return f"{v:g}"


def render_bar(spec, outpath, horizontal=False):
    d = spec["data"]
    labels, series = d["labels"], d["series"]
    fig, ax = _new_fig()
    n = len(series)
    width = 0.8 / n
    for i, s in enumerate(series):
        offset = (i - (n - 1) / 2) * width
        pos = [j + offset for j in range(len(labels))]
        color = SERIES[i % len(SERIES)]
        if horizontal:
            bars = ax.barh(pos, s["values"], height=width * 0.92, color=color,
                           label=s["name"])
            for b in bars:
                ax.text(b.get_width(), b.get_y() + b.get_height() / 2,
                        f" {_fmt(b.get_width())}", va="center", fontsize=9, color=INK_2)
        else:
            bars = ax.bar(pos, s["values"], width=width * 0.92, color=color,
                          label=s["name"])
            for b in bars:
                ax.text(b.get_x() + b.get_width() / 2, b.get_height(),
                        f"{_fmt(b.get_height())}", ha="center", va="bottom",
                        fontsize=9, color=INK_2)
    if horizontal:
        ax.set_yticks(range(len(labels)), labels)
        ax.invert_yaxis()
        ax.xaxis.grid(True, color=GRID, linewidth=0.8)
    else:
        ax.set_xticks(range(len(labels)), labels)
        ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    if len(series) > 1:
        ax.legend(frameon=False, fontsize=9, labelcolor=INK_2)
    _finish(fig, ax, spec, outpath)


def render_line(spec, outpath):
    d = spec["data"]
    labels, series = d["labels"], d["series"]
    fig, ax = _new_fig()
    for i, s in enumerate(series):
        color = SERIES[i % len(SERIES)]
        ax.plot(labels, s["values"], color=color, linewidth=2, marker="o",
                markersize=5, label=s["name"])
        # direct label at line end
        ax.annotate(f' {s["name"]} ({_fmt(s["values"][-1])})',
                    xy=(len(labels) - 1, s["values"][-1]),
                    fontsize=9, color=color, va="center")
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    ax.margins(x=0.02)
    if len(series) > 1:
        ax.legend(frameon=False, fontsize=9, labelcolor=INK_2)
    _finish(fig, ax, spec, outpath)


def render_pie(spec, outpath):
    d = spec["data"]
    fig, ax = _new_fig()
    total = sum(d["values"]) or 1
    wedges, _texts, autotexts = ax.pie(
        d["values"],
        labels=d["labels"],
        colors=[SERIES[i % len(SERIES)] for i in range(len(d["values"]))],
        autopct=lambda p: f"{p:.0f}%",
        startangle=90,
        counterclock=False,
        wedgeprops={"linewidth": 2, "edgecolor": SURFACE},
        textprops={"fontsize": 10, "color": INK_2},
    )
    for t in autotexts:
        t.set_color("#ffffff")
        t.set_fontsize(9)
        t.set_weight("bold")
    _finish(fig, ax, spec, outpath)


def render_venn(spec, outpath):
    d = spec["data"]
    sets = d["sets"]
    fig, ax = _new_fig()
    ax.set_xlim(0, 10)
    ax.set_ylim(0, 6)
    ax.axis("off")
    if len(sets) == 2:
        centers = [(4, 3), (6, 3)]
        label_pos = [(2.6, 5.0), (7.4, 5.0)]
    else:
        centers = [(4, 3.6), (6, 3.6), (5, 2.0)]
        label_pos = [(2.4, 5.4), (7.6, 5.4), (5, 0.35)]
    for i, (c, lp) in enumerate(zip(centers, label_pos)):
        ax.add_patch(Circle(c, 1.9, facecolor=SERIES[i], alpha=0.45,
                            edgecolor=SERIES[i], linewidth=2))
        ax.text(*lp, sets[i], fontsize=12, ha="center", color=INK, weight="bold")
    overlap = d.get("overlap_label")
    if overlap:
        oy = 3 if len(sets) == 2 else 3.1
        ax.text(5, oy, overlap, fontsize=10, ha="center", va="center",
                color=INK, weight="bold", wrap=True)
    _finish(fig, ax, spec, outpath)


def render_gantt(spec, outpath):
    tasks = spec["data"]["tasks"]
    fig, ax = _new_fig()
    groups = []
    for t in tasks:
        g = t.get("group", "")
        if g not in groups:
            groups.append(g)
    for i, t in enumerate(tasks):
        start = date.fromisoformat(t["start"])
        end = date.fromisoformat(t["end"])
        gi = groups.index(t.get("group", ""))
        color = SERIES[gi % len(SERIES)]
        ax.barh(i, (end - start).days, left=mdates.date2num(start), height=0.55,
                color=color)
        ax.text(mdates.date2num(start), i, f'{t["name"]}  ', ha="right",
                va="center", fontsize=9, color=INK_2)
    ax.set_yticks([])
    ax.invert_yaxis()
    ax.xaxis_date()
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    ax.xaxis.grid(True, color=GRID, linewidth=0.8)
    ax.set_axisbelow(True)
    if len(groups) > 1 and any(groups):
        handles = [plt.Rectangle((0, 0), 1, 1, color=SERIES[i % len(SERIES)])
                   for i in range(len(groups))]
        ax.legend(handles, groups, frameon=False, fontsize=9, labelcolor=INK_2)
    _finish(fig, ax, spec, outpath)


def render_swot(spec, outpath):
    d = spec["data"]
    quads = [("STRENGTHS", d["strengths"], SERIES[0]),
             ("WEAKNESSES", d["weaknesses"], SERIES[7]),
             ("OPPORTUNITIES", d["opportunities"], SERIES[1]),
             ("THREATS", d["threats"], SERIES[3])]
    fig, ax = _new_fig()
    ax.set_xlim(0, 2)
    ax.set_ylim(0, 2)
    ax.axis("off")
    pos = [(0, 1), (1, 1), (0, 0), (1, 0)]
    for (title, items, color), (x, y) in zip(quads, pos):
        ax.add_patch(plt.Rectangle((x + 0.01, y + 0.01), 0.98, 0.98,
                                   facecolor=color, alpha=0.10,
                                   edgecolor=color, linewidth=1.5))
        ax.text(x + 0.05, y + 0.88, title, fontsize=12, weight="bold", color=color)
        body = "\n".join(f"• {it}" for it in items[:5])
        ax.text(x + 0.05, y + 0.80, body, fontsize=9.5, color=INK, va="top")
    _finish(fig, ax, spec, outpath)


RENDERERS = {
    "bar": lambda s, p: render_bar(s, p, horizontal=False),
    "barh": lambda s, p: render_bar(s, p, horizontal=True),
    "line": render_line,
    "pie": render_pie,
    "venn2": render_venn,
    "venn3": render_venn,
    "gantt": render_gantt,
    "swot": render_swot,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--outdir", default="deliverables/charts")
    args = ap.parse_args()

    spec = json.loads(Path(args.spec).read_text(encoding="utf-8"))
    charts = spec.get("charts", [])
    if not charts:
        print("No charts in spec; nothing to do.")
        return
    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    failed = []
    for c in charts:
        ctype = c.get("type")
        if ctype not in RENDERERS:
            failed.append((c.get("id", "?"), f"unknown type '{ctype}'"))
            continue
        outpath = outdir / f'{c["id"]}.png'
        try:
            RENDERERS[ctype](c, outpath)
            print(f'OK  {c["id"]} ({ctype}) -> {outpath}')
        except Exception as e:  # noqa: BLE001 — report per-chart, keep going
            failed.append((c.get("id", "?"), str(e)))

    if failed:
        for cid, err in failed:
            print(f"FAIL {cid}: {err}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
