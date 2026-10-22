// Single-member variant of GuildStatBarChart.jsx (see that file for the full
// rationale on bucket states): same bucket-resampled bar rendering and
// touch-scrub hover, minus the "top contributors" row, which only makes
// sense for a guild-wide aggregate — a personal chart's contributor is
// always just the member viewing it.
import { useRef, useState } from "react";
import { fmtShort, fmtTick, MAIN_COLOR, niceTicks } from "./PopulationChart.jsx";

const W = 1000, H = 220;
const PAD = { l: 52, r: 16, t: 16, b: 34 };
const STALE_COLOR = "#98a1b5";
const STALE_TOKEN_H = 16;

export default function MemberStatBarChart({ points, bucketHours, label,
                                             emptyMessage = "No data yet — the bot collects this over time." }) {
  const [hover, setHover] = useState(null);
  const svgRef = useRef(null);

  const pts = points || [];
  if (pts.length === 0) {
    return <div className="card muted">{label}: {emptyMessage}</div>;
  }

  const n = pts.length;
  const ymax = Math.max(1, ...pts.map((p) => p.value ?? 0));
  const slotW = (W - PAD.l - PAD.r) / n;
  const barW = Math.max(2, Math.min(22, slotW * 0.72));
  const baseline = H - PAD.b;
  const xOf = (i) => PAD.l + slotW * (i + 0.5);
  const yOf = (v) => H - PAD.b - (v / ymax) * (H - PAD.t - PAD.b);

  const settled = pts.filter((p) => !p.stale && !p.partial);
  const total = settled.reduce((sum, p) => sum + p.value, 0);
  const avg = settled.length ? total / settled.length : null;
  const bucketLabel = bucketHours < 24 ? `${bucketHours}h` : `${bucketHours / 24}d`;

  const xTickCount = Math.min(6, n);
  const xTickIdx = Array.from({ length: xTickCount }, (_, i) =>
    Math.round((i * (n - 1)) / Math.max(1, xTickCount - 1)));
  const spanMs = new Date(pts[n - 1].t).getTime() - new Date(pts[0].t).getTime();

  const barAt = (clientX) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return null;
    const vx = ((clientX - rect.left) / rect.width) * W;
    return Math.max(0, Math.min(n - 1, Math.round((vx - PAD.l) / slotW - 0.5)));
  };
  const onTouchScrub = (event) => {
    if (event.pointerType === "mouse") return;
    const i = barAt(event.clientX);
    if (i != null) setHover(i);
  };

  const hoverPoint = hover != null ? pts[hover] : null;
  const hoverRange = hoverPoint && (() => {
    const end = new Date(hoverPoint.t);
    const start = new Date(end.getTime() - bucketHours * 3600e3);
    return `${start.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" })}`
      + ` – ${end.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })}`;
  })();
  const hoverState = hoverPoint && (hoverPoint.stale
    ? (hoverPoint.partial ? "no data yet this period" : "no data — possible outage")
    : hoverPoint.partial ? "still counting" : null);

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="section-head"><h3>{label}</h3></div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", touchAction: "pan-y" }}
        role="img" onPointerDown={onTouchScrub} onPointerMove={onTouchScrub}
        onPointerCancel={() => setHover(null)}>
        {niceTicks(ymax, 3).map((v) => {
          const y = yOf(v);
          return (
            <g key={v}>
              <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="#232b3d" />
              <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#98a1b5">{fmtShort(v)}</text>
            </g>
          );
        })}
        {xTickIdx.map((i, k) => (
          <text key={k} x={xOf(i)} y={H - 8} fontSize="11" fill="#98a1b5"
            textAnchor={k === 0 ? "start" : k === xTickIdx.length - 1 ? "end" : "middle"}>
            {fmtTick(pts[i].t, spanMs)}
          </text>
        ))}
        {pts.map((p, i) => {
          const x = xOf(i) - barW / 2;
          const isHover = hover === i;
          return (
            <g key={p.t}>
              {p.stale ? (
                <rect x={x} y={baseline - STALE_TOKEN_H} width={barW} height={STALE_TOKEN_H}
                  fill="none" stroke={STALE_COLOR} strokeOpacity={isHover ? 0.9 : 0.5}
                  strokeDasharray="3,3" rx="3" />
              ) : (
                <rect x={x} y={yOf(p.value)} width={barW} height={Math.max(2, baseline - yOf(p.value))}
                  fill={MAIN_COLOR} opacity={p.partial ? 0.5 : (isHover ? 1 : 0.88)} rx="2" />
              )}
              <rect x={x - 1} y={PAD.t} width={barW + 2} height={baseline - PAD.t}
                fill="transparent"
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 18, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span className="pill">
          {hoverPoint ? (
            <>
              <strong>{hoverRange}</strong>
              {hoverPoint.value != null && <> · <strong>{fmtShort(hoverPoint.value)}</strong></>}
              {hoverState && <> ({hoverState})</>}
            </>
          ) : "tap or hover a bar for details"}
        </span>
        <span className="pill">each bar = {bucketLabel}</span>
        {avg != null && <span className="pill">total this window: <strong>{fmtShort(total)}</strong></span>}
      </div>
    </div>
  );
}
