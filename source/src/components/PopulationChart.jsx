// Hand-rolled SVG chart (no chart library) for a time-series: one headline
// line with a gradient area fill plus optional thin regional overlay lines,
// time-axis ticks and a hover crosshair readout. Generic over what it plots —
// callers pass a `spec` describing the main series (+ optional regions); see
// SCOPES below for the Population page's wynncraft/guild specs, and the
// Graphs page for the single-series Raids/Wars/XP-gain specs.
import { useMemo, useRef, useState } from "react";

const W = 1000, H = 320;
const PAD = { l: 52, r: 16, t: 16, b: 34 };
const REGION_COLORS = { NA: "#3498db", EU: "#2ecc71", AS: "#9b59b6", OCE: "#e67e22" };

// The Population page's two specs: the headline line + its regional overlays.
// All-Wynncraft splits by world region (NA/EU/AS); the Fox guild splits by
// members' Discord region roles (NA/EU/OCE) — mirroring the bot's collector.
export const SCOPES = {
  wynncraft: {
    id: "wynncraft",
    main: { label: "All Wynncraft online", of: (p) => p.total },
    regions: ["NA", "EU", "AS"],
    regionOf: (p, r) => (p.regions ? (p.regions[r] ?? 0) : null),
  },
  guild: {
    id: "guild",
    main: { label: "Fox guild online", of: (p) => p.guild_online },
    regions: ["NA", "EU", "OCE"],
    regionOf: (p, r) => (p.guild_regions ? (p.guild_regions[r] ?? 0) : null),
  },
};
// Also the accent GuildStatBarChart.jsx plots its bars in — one color for
// "this is Fox's own trend" across every chart on the Graphs page.
export const MAIN_COLOR = "#f05126";

// spec.regions entries are either a plain region code (Population — looked up
// in REGION_COLORS below) or a {id, label, color} descriptor (the Graphs
// page's Season Rating spec, one per guild, colored via lib/colors.js's
// guildColor() — see Graphs.jsx). Normalizing here keeps the rest of this
// file working off one consistent shape.
function regionMeta(r) {
  return typeof r === "string"
    ? { id: r, label: r, color: REGION_COLORS[r] }
    : r;
}

const num = (v) => (typeof v === "number" && !isNaN(v) ? v : null);

// Line path that lifts the pen over null gaps (rows captured before a series
// existed stay gaps instead of being bridged or dropped to zero).
function linePath(pts, values, xOf, yOf) {
  let d = "", pen = false;
  for (let i = 0; i < pts.length; i++) {
    const v = values[i];
    if (v == null) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${xOf(pts[i]._t).toFixed(1)},${yOf(v).toFixed(1)}`;
    pen = true;
  }
  return d;
}

function areaPath(pts, values, xOf, yOf) {
  const usable = [];
  for (let i = 0; i < pts.length; i++) {
    if (values[i] != null) usable.push([pts[i]._t, values[i]]);
  }
  if (usable.length === 0) return "";
  const base = (H - PAD.b).toFixed(1);
  return `M${xOf(usable[0][0]).toFixed(1)},${base} ` +
    usable.map(([t, v]) => `L${xOf(t).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ") +
    ` L${xOf(usable[usable.length - 1][0]).toFixed(1)},${base} Z`;
}

// Shared with GuildStatBarChart.jsx and MemberStatBarChart.jsx so every bar/
// line chart's y-axis picks gridlines the same way. Evenly dividing the axis
// into a fixed number of slots and rounding each independently (the old
// approach here) breaks whenever `max` isn't a clean multiple of the slot
// count: e.g. max=5 over 5 slots (i/4 of 5) rounds to 0, 1, 3, 4, 5 — 2 is
// silently skipped, and a different max can just as easily round two slots
// to the same label instead. Picking a "nice" round step (1/2/5 × a power of
// ten) sized for ~targetCount gridlines and listing its whole multiples up
// to max instead guarantees every label is distinct and none are skipped —
// at the cost of not always hitting exactly targetCount+1 of them. A small
// max (e.g. 2) naturally yields fewer ticks than targetCount+1 — there
// aren't that many nicely-spaced values to show between 0 and 2, so fewer is
// correct, not a bug.
export function niceTicks(max, targetCount = 4) {
  if (!(max > 0)) return [0];
  const rawStep = max / targetCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  const step = (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const ticks = [];
  for (let i = 0; step * i <= max + step * 1e-9; i++) {
    // Round off float noise (e.g. 0.1 * 3 = 0.30000000000000004) without
    // forcing a fractional step (small max values, e.g. playtime hours) to
    // a whole number.
    ticks.push(Math.round(step * i * 1e6) / 1e6);
  }
  return ticks;
}

// Shared with GuildStatBarChart.jsx (the Raids/Wars/XP-gain buckets) so both
// charts on the Graphs page format axis ticks the same way.
export const fmtTick = (t, spanMs) =>
  new Date(t).toLocaleDateString(undefined, spanMs < 3 * 86400e3
    ? { weekday: "short", hour: "numeric" }
    : { month: "short", day: "numeric" });

// A smoothed value is a moving average, so it's rarely a whole number; large
// values (XP gain routinely runs into the billions) are unreadable at full
// precision. Round to 1 decimal, trim a trailing ".0", and abbreviate with a
// k/m/b suffix once the magnitude calls for it — e.g. 1234567890 -> "1.2b".
export const fmtShort = (v) => {
  if (v == null) return "";
  const abs = Math.abs(v);
  const scale = abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : abs >= 1e3 ? 1e3 : 1;
  const suffix = scale === 1e9 ? "b" : scale === 1e6 ? "m" : scale === 1e3 ? "k" : "";
  const r = Math.round((v / scale) * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)) + suffix;
};

// Plain (non-rolling) median over whatever values are passed in — used for
// the single "median across the viewed time frame" stat, as opposed to
// smooth()'s per-point rolling average that actually draws the line.
function median(values) {
  const nums = values.filter((v) => v != null).slice().sort((a, b) => a - b);
  if (nums.length === 0) return null;
  const mid = nums.length >> 1;
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

// Centered moving average over a TIME window (not a fixed sample count), so it
// copes with uneven sampling and scales to the visible span — the same
// approach the bot's old population dashboard used. Window is ~1.5% of the
// visible range, clamped between 45min and 4h, so a short history isn't
// flattened and a long one stays legible. This is what tames the Fox guild
// line: its 0-20 range makes every single-member swing look like a spike.
// Null gaps stay null (a point captured before a series existed isn't
// bridged); pts must be sorted ascending by _t.
const SMOOTH_MIN_MS = 45 * 60 * 1000;
// Was 4h, which capped the 30-day view's 1.5%-of-range window (~10.8h) well
// short of what it needed, leaving that view visibly jagged; 12h lets longer
// ranges smooth further while the 7-day view (already well under 4h) is
// unaffected.
const SMOOTH_MAX_MS = 12 * 60 * 60 * 1000;
const SMOOTH_FRAC = 0.015;

function smoothWindowMs(xmin, xmax) {
  if (xmax <= xmin) return SMOOTH_MIN_MS;
  return Math.max(SMOOTH_MIN_MS, Math.min(SMOOTH_MAX_MS, (xmax - xmin) * SMOOTH_FRAC));
}

function smooth(pts, values, windowMs) {
  const n = values.length;
  const out = new Array(n).fill(null);
  const half = windowMs / 2;
  let lo = 0, hi = 0, runSum = 0, runCount = 0;
  for (let i = 0; i < n; i++) {
    const left = pts[i]._t - half, right = pts[i]._t + half;
    while (hi < n && pts[hi]._t <= right) {
      if (values[hi] != null) { runSum += values[hi]; runCount++; }
      hi++;
    }
    while (pts[lo]._t < left) {
      if (values[lo] != null) { runSum -= values[lo]; runCount--; }
      lo++;
    }
    if (values[i] != null && runCount > 0) out[i] = runSum / runCount;
  }
  return out;
}

const MAIN_ID = "__main__";

export default function PopulationChart({ points, spec = SCOPES.wynncraft, days,
                                        emptyMessage = "No data yet — the bot collects this over time." }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);          // index into pts
  // Series hidden by a legend click, by id — cleared whenever the chart
  // switches to a different spec (metric change) via the `key={spec.id}`
  // the caller renders this component with, so this never carries a hidden
  // guild's id over into an unrelated chart.
  const [hidden, setHidden] = useState(() => new Set());
  const toggle = (id) => setHidden((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Legend entry currently hovered, by id. Season Rating draws Fox plus ~20
  // rivals on one axis, where even well-separated colors can only do so much
  // — pointing at a legend entry lifts that line out of the pack and fades
  // the others, which is far quicker than toggling twenty of them off to read
  // one. Purely a hover affordance: it changes no state the chart is scaled
  // from, so the y-axis and medians don't move under the pointer.
  const [focus, setFocus] = useState(null);

  const allPts = useMemo(
    () => (points || []).map((p) => ({ ...p, _t: new Date(p.t).getTime() })).filter((p) => !isNaN(p._t)),
    [points],
  );

  // Defensive: a series endpoint handing back a point slightly earlier than
  // the requested window's xmin (a boundary-adjacent row) shouldn't stretch
  // this chart's fixed x-axis — filtered here rather than server-side so the
  // fix stays local to this chart and doesn't affect other consumers of the
  // series endpoints. Population and Season Rating (the two series this
  // component renders — raids/wars/xp-gain are GuildStatBarChart.jsx's own
  // fixed calendar buckets, already exactly windowed) both query with a
  // plain `captured_at >= since` filter, so this hasn't been observed to
  // trigger in practice; kept as a cheap guard rather than removed.
  const xmin = useMemo(() => {
    if (allPts.length === 0) return 0;
    if (!days) return Math.min(...allPts.map((p) => p._t));
    const xmax = Math.max(...allPts.map((p) => p._t));
    return xmax - days * 86400000;
  }, [allPts, days]);
  const pts = useMemo(() => allPts.filter((p) => p._t >= xmin), [allPts, xmin]);

  // Every series the legend can show/toggle — main plus each region/guild
  // line — regardless of hidden state (hiding a line keeps it in the legend,
  // just dimmed, so it can be toggled back on).
  const rawSeries = useMemo(() => {
    const out = [{
      id: MAIN_ID, label: spec.main.label, color: MAIN_COLOR, main: true,
      values: pts.map((p) => num(spec.main.of(p))),
    }];
    for (const r of spec.regions || []) {
      const meta = regionMeta(r);
      const values = pts.map((p) => num(spec.regionOf(p, meta.id)));
      if (values.some((v) => v != null && v > 0)) {
        out.push({ ...meta, main: false, values });
      }
    }
    return out;
  }, [pts, spec]);

  // What's actually plotted: main always, regions/guilds unless toggled off.
  // Hidden lines drop out of the y-scale and the median stats too, so hiding
  // a runaway series gives the rest more resolution instead of just visually
  // masking a line that's still stretching the axis.
  const visibleSeries = useMemo(
    () => rawSeries.filter((s) => s.main || !hidden.has(s.id)),
    [rawSeries, hidden]);

  if (pts.length === 0) {
    return <div className="card muted">{emptyMessage}</div>;
  }

  const xs = pts.map((p) => p._t);
  // Fixed to the selected day range (not just whatever data exists) so a
  // history younger than the selection honestly shows as empty space before
  // the line starts, rather than being silently stretched to fill the width —
  // otherwise e.g. "30 days" looks identical to "14 days" once the collector
  // is only ~14 days old. (xmin itself is computed above, before the
  // left-edge-overflow filter, so it stays pinned to the real window.)
  const xmax = Math.max(...xs);
  const windowMs = smoothWindowMs(xmin, xmax);
  const series = visibleSeries.map((s) => ({ ...s, values: smooth(pts, s.values, windowMs) }));
  // The median of the raw (unsmoothed) samples across the whole currently-
  // viewed window — a single reference stat, not another line on the chart.
  const medians = visibleSeries.map((s) => ({ id: s.id, label: s.label, color: s.color, value: median(s.values) }));
  const ys = series.flatMap((s) => s.values).filter((v) => v != null);
  const ymax = Math.max(1, ...ys);
  const xOf = (t) => PAD.l + (xmax === xmin ? 0 : (t - xmin) / (xmax - xmin)) * (W - PAD.l - PAD.r);
  const yOf = (v) => H - PAD.b - (v / ymax) * (H - PAD.t - PAD.b);
  const yTicks = 4, xTicks = 4;

  const onMove = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const t = xmin + ((e.clientX - rect.left) / rect.width * W - PAD.l) / (W - PAD.l - PAD.r) * (xmax - xmin);
    let best = 0;
    for (let i = 1; i < pts.length; i++) {
      if (Math.abs(pts[i]._t - t) < Math.abs(pts[best]._t - t)) best = i;
    }
    setHover(best);
  };

  const main = series[0];

  return (
    <div className="card">
      {/* A touchscreen sends no mousemove until it synthesises one after the
          tap has already finished, so on a phone this chart had no readout at
          all -- the finger had to be dragged, and a drag was a page scroll.
          touch-action: pan-y hands us horizontal drags (scrubbing) while
          leaving vertical drags to the page, so the chart is scrubbable
          without trapping the scroll. The mouse handlers stay for mice; the
          pointer ones ignore pointerType "mouse" so nothing runs twice. */}
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", touchAction: "pan-y" }}
        role="img" onMouseMove={onMove} onMouseLeave={() => setHover(null)}
        onPointerDown={(e) => { if (e.pointerType !== "mouse") onMove(e); }}
        onPointerMove={(e) => { if (e.pointerType !== "mouse") onMove(e); }}
        onPointerCancel={() => setHover(null)}>
        <defs>
          <linearGradient id={`area-${spec.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={MAIN_COLOR} stopOpacity="0.22" />
            <stop offset="100%" stopColor={MAIN_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

        {niceTicks(ymax, yTicks).map((v) => {
          const y = yOf(v);
          return (
            <g key={v}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#232b3d" />
              <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#98a1b5">{fmtShort(v)}</text>
            </g>
          );
        })}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const t = xmin + ((xmax - xmin) * i) / xTicks;
          return (
            <text key={i} x={xOf(t)} y={H - 8} fontSize="11" fill="#98a1b5"
              textAnchor={i === 0 ? "start" : i === xTicks ? "end" : "middle"}>
              {fmtTick(t, xmax - xmin)}
            </text>
          );
        })}

        <path d={areaPath(pts, main.values, xOf, yOf)} fill={`url(#area-${spec.id})`} />
        {series.map((s) => {
          const dimmed = focus != null && focus !== s.id;
          return (
            <path key={s.id} d={linePath(pts, s.values, xOf, yOf)} fill="none"
              stroke={s.color}
              strokeWidth={focus === s.id ? 2.6 : s.main ? 2 : 1.3}
              opacity={dimmed ? 0.15 : s.main ? 1 : 0.9} />
          );
        })}

        {hover != null && (
          <g pointerEvents="none">
            <line x1={xOf(pts[hover]._t)} y1={PAD.t} x2={xOf(pts[hover]._t)} y2={H - PAD.b}
              stroke="#98a1b5" strokeDasharray="3,3" />
            {series.map((s) => s.values[hover] != null && (
              <circle key={s.id} cx={xOf(pts[hover]._t)} cy={yOf(s.values[hover])}
                r="3.5" fill={s.color} />
            ))}
          </g>
        )}
      </svg>
      <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {rawSeries.map((s) => {
          const isHidden = !s.main && hidden.has(s.id);
          const shown = !isHidden && series.find((v) => v.id === s.id);
          return (
            <button key={s.id} type="button" className="pill"
              onClick={s.main ? undefined : () => toggle(s.id)}
              // Focus follows the pointer and the keyboard alike, so the same
              // isolation is available to someone tabbing the legend.
              onMouseEnter={() => !isHidden && setFocus(s.id)}
              onMouseLeave={() => setFocus((f) => (f === s.id ? null : f))}
              onFocus={() => !isHidden && setFocus(s.id)}
              onBlur={() => setFocus((f) => (f === s.id ? null : f))}
              title={s.main ? undefined : (isHidden ? "Click to show" : "Click to hide")}
              style={{
                appearance: "none", background: "none", border: "none", padding: 0,
                font: "inherit", textAlign: "left",
                cursor: s.main ? "default" : "pointer",
                opacity: isHidden ? 0.4 : 1,
                textDecoration: isHidden ? "line-through" : "none",
              }}>
              <span style={{ color: s.color }}>●</span> {s.label}
              {hover != null && shown && shown.values[hover] != null &&
                <strong> · {fmtShort(shown.values[hover])}</strong>}
            </button>
          );
        })}
        <span className="pill">{hover != null
          ? new Date(pts[hover]._t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
          : "hover for details"}</span>
        <span className="pill">lines smoothed to reduce sampling noise</span>
      </div>
      {spec.showMedians !== false && (
        <div style={{ display: "flex", gap: 18, marginTop: 6, flexWrap: "wrap" }}>
          {medians.map((m) => m.value != null && (
            <span key={`median-${m.id}`} className="pill">
              {m.label} median ({days ? `${days}d` : "all time"}): <strong>{fmtShort(m.value)}</strong>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
