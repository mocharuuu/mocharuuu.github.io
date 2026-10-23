import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HOUSES, PEOPLE, FAMILIES, GODPARENTS } from "../family/data.js";
import { layout, estimateWidth, FONT_MINOR, BOX_H, AVATAR,
         clampView, zoomView } from "../family/layout.js";
import "../family/family.css";

const FAMILY_FONT = '800 {size}px "Segoe UI", system-ui, -apple-system, sans-serif';
const ZOOM_STEP = 1.35;
const TWEEN_MS = 480;

/* Measure with a canvas so each marriage bar stops exactly at the names,
   whatever the browser actually renders them at. */
function makeMeasure() {
  if (typeof document === "undefined") return estimateWidth;
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return estimateWidth;
  return (text, size) => {
    ctx.font = FAMILY_FONT.replace("{size}", String(size));
    return ctx.measureText(text).width;
  };
}

const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

export default function FamilyTree() {
  const g = useMemo(() => layout({
    people: PEOPLE, families: FAMILIES, godparents: GODPARENTS,
    houses: HOUSES, measure: makeMeasure(),
  }), []);

  const full = useMemo(() => ({ x: 0, y: 0, w: g.width, h: g.height }), [g]);

  /* Two framings, either of which can be active: a house from the key, or one
     person's immediate circle. The houseless group is keyed "none" so it does
     not collide with the no-filter sentinel. */
  const [focus, setFocus] = useState(null);
  const [picked, setPicked] = useState(null);
  const houseKey = (h) => h.id ?? "none";
  const personKey = (p) => p.house ?? "none";

  const inFrame = useMemo(
    () => (picked ? g.neighbours.get(picked) || new Set([picked]) : null),
    [picked, g]
  );

  /* The live viewBox. Programmatic changes tween; dragging and the zoom
     buttons set it straight away. */
  const [view, setView] = useState(full);
  const viewRef = useRef(full);
  const rafRef = useRef(0);
  const svgRef = useRef(null);

  const apply = useCallback((v) => { viewRef.current = v; setView(v); }, []);

  const stop = () => { cancelAnimationFrame(rafRef.current); rafRef.current = 0; };

  const animateTo = useCallback((target) => {
    stop();
    const reduce = typeof window !== "undefined" && window.matchMedia
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = viewRef.current;
    if (reduce) { apply(target); return; }
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / TWEEN_MS);
      const e = easeInOut(p);
      apply({
        x: lerp(from.x, target.x, e), y: lerp(from.y, target.y, e),
        w: lerp(from.w, target.w, e), h: lerp(from.h, target.h, e),
      });
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [apply]);

  useEffect(() => () => stop(), []);

  /* The frame a selection implies. */
  const frameOf = useCallback(() => {
    const members = picked
      ? g.nodes.filter((n) => inFrame.has(n.id))
      : focus !== null
        ? g.nodes.filter((n) => personKey(n) === focus)
        : null;
    if (!members || !members.length) return full;
    const pad = 70;
    const x1 = Math.max(0, Math.min(...members.map((m) => m.left)) - pad);
    const x2 = Math.min(full.w, Math.max(...members.map((m) => m.right)) + pad);
    const y1 = Math.max(0, Math.min(...members.map((m) => m.top)) - pad);
    const y2 = Math.min(full.h, Math.max(...members.map((m) => m.bottom)) + pad);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }, [focus, picked, inFrame, g, full]);

  useEffect(() => { animateTo(frameOf()); }, [focus, picked, frameOf, animateTo]);

  /* ---- manual zoom and pan ------------------------------------------- */
  const zoomBy = (factor) => {
    stop();
    apply(zoomView(viewRef.current, factor, full));
  };

  const reset = () => { setPicked(null); setFocus(null); animateTo(full); };

  const drag = useRef(null);
  const unitsPerPixel = () => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || !box.width) return 1;
    // preserveAspectRatio="meet" fits the longer side, so the scale is
    // whichever axis is the binding constraint.
    return Math.max(viewRef.current.w / box.width, viewRef.current.h / box.height);
  };
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    stop();
    drag.current = { px: e.clientX, py: e.clientY, view: viewRef.current, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const k = unitsPerPixel();
    const dx = (e.clientX - d.px) * k, dy = (e.clientY - d.py) * k;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    apply(clampView({ ...d.view, x: d.view.x - dx, y: d.view.y - dy }, full));
  };
  const onPointerUp = (e) => {
    if (drag.current) e.currentTarget.releasePointerCapture?.(e.pointerId);
    drag.current = null;
  };

  const onWheel = (e) => {
    e.preventDefault();
    stop();
    const box = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    const k = Math.max(v.w / box.width, v.h / box.height);
    apply(zoomView(v, e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, full, {
      x: v.x + (e.clientX - box.left) * k,
      y: v.y + (e.clientY - box.top) * k,
    }));
  };

  /* A double-click also delivers two clicks, so hold the zoom briefly and
     drop it if a second click arrives. A click that panned is not a click. */
  const clickTimer = useRef(null);
  useEffect(() => () => clearTimeout(clickTimer.current), []);
  const onPersonClick = (id) => {
    if (drag.current?.moved) return;
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      setFocus(null);
      setPicked((cur) => (cur === id ? null : id));
    }, 220);
  };
  const onPersonDoubleClick = (person) => {
    clearTimeout(clickTimer.current);
    if (!person.username) return;
    window.open(
      `https://wynncraft.com/stats/player/${encodeURIComponent(person.username)}`,
      "_blank", "noopener,noreferrer"
    );
  };

  const dim = (p) => {
    if (picked) return inFrame.has(p.id) ? 1 : 0.18;
    if (focus !== null) return personKey(p) === focus ? 1 : 0.22;
    return 1;
  };

  return (
    <div className="family-page">
      <header className="family-head">
        <h1>Family Tree</h1>
        <p>
          Pink bars are marriages (struck through where dissolved), blue-grey
          lines descent, dashed blue-grey a godparent or an adoption. Within a
          generation, those drawn higher are the older. Pick a house in the key
          to frame its members; click a person to frame their immediate circle,
          or double-click to open their Wynncraft stats. Drag to pan, scroll or
          use the buttons to zoom.
        </p>
        <ul className="family-legend">
          {g.legend.map((h) => (
            <li key={h.id || "none"}>
              <button
                type="button"
                className={"family-house-btn" + (focus === houseKey(h) ? " is-active" : "")}
                aria-pressed={focus === houseKey(h)}
                onClick={() => { setPicked(null); setFocus(focus === houseKey(h) ? null : houseKey(h)); }}
              >
                <span className="family-swatch" style={{ background: h.color }} />
                {h.label}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={"family-house-btn" + (focus === null && !picked ? " is-active" : "")}
              aria-pressed={focus === null && !picked}
              onClick={reset}
            >
              Everyone
            </button>
          </li>
        </ul>
      </header>

      <div className="family-stage">
        <div className="family-controls">
          <button type="button" onClick={() => zoomBy(ZOOM_STEP)} aria-label="Zoom in" title="Zoom in">+</button>
          <button type="button" onClick={() => zoomBy(1 / ZOOM_STEP)} aria-label="Zoom out" title="Zoom out">&minus;</button>
          <button type="button" onClick={reset} className="family-controls-reset">Reset</button>
        </div>

        <svg
          ref={svgRef}
          className="family-svg"
          viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${view.w.toFixed(1)} ${view.h.toFixed(1)}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          role="img"
          aria-label="Kingdom of Foxes family tree"
        >
          {g.descents.map((s) => (
            <path key={s.key} d={s.d} fill="none" stroke="#7e95ad"
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={s.dashed ? "7 9" : undefined} />
          ))}

          {g.adoptions.map((a) => (
            <text key={a.key} className="family-role" x={a.x} y={a.y}
                  transform={`rotate(-90 ${a.x} ${a.y})`} textAnchor="middle">
              adopted
            </text>
          ))}

          {g.godLinks.map((s) => (
            <g key={s.key}>
              <path d={s.d} fill="none" stroke="#7e95ad" strokeWidth="5"
                    strokeLinecap="round" strokeDasharray="14 11" />
              <text className="family-role" x={s.labelAt.x} y={s.labelAt.y}
                    textAnchor="middle">{s.role}</text>
            </g>
          ))}

          {g.marriages.map((m) => (
            <g key={m.key}>
              {m.kind === "path"
                ? <path d={m.d} fill="none" stroke="#f3a6bf" strokeWidth="6"
                        strokeLinecap="round" strokeDasharray="16 10" />
                : <path d={`M ${m.x1} ${m.y} L ${m.x2} ${m.y}`}
                        stroke="#f3a6bf" strokeWidth="6" strokeLinecap="round" />}
              {/* A dissolved marriage keeps its connector and is struck
                  through, the usual genealogical mark for a divorce. */}
              {m.divorced && (
                <>
                  <path d={`M ${m.strikeAt.x - 11} ${m.strikeAt.y + 12} L ${m.strikeAt.x - 1} ${m.strikeAt.y - 12}`}
                        stroke="#f3a6bf" strokeWidth="5" strokeLinecap="round" />
                  <path d={`M ${m.strikeAt.x + 1} ${m.strikeAt.y + 12} L ${m.strikeAt.x + 11} ${m.strikeAt.y - 12}`}
                        stroke="#f3a6bf" strokeWidth="5" strokeLinecap="round" />
                </>
              )}
              {m.labelAt && m.divorced && (
                <text className="family-role family-divorced" x={m.labelAt.x}
                      y={m.labelAt.y} textAnchor="middle">divorced</text>
              )}
            </g>
          ))}

          {g.nodes.map((p) => (
            p.boxed ? (
              <g key={p.id} opacity={dim(p)} style={{ cursor: "pointer" }}
                 role="button" tabIndex={0}
                 onClick={() => onPersonClick(p.id)}
                 onDoubleClick={() => onPersonDoubleClick(p)}
                 onKeyDown={(e) => {
                   if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPersonClick(p.id); }
                 }}>
                <title>
                  {p.username
                    ? `${p.username} — ${p.title || "no title"}. Click to frame their circle, double-click for Wynncraft stats.`
                    : `${p.name} — no username on record.`}
                </title>
                <rect x={p.left} y={p.top} width={p.w} height={p.h} rx="8" ry="8"
                      fill="#141a26" stroke="#263145" strokeWidth="1.5" />
                {/* Left accent in the house colour, as on the site's roster cards. */}
                <rect x={p.left} y={p.top} width="4" height={p.h} rx="2" ry="2"
                      fill={p.color} />
                <rect x={p.left + 13} y={p.top + 10} width={AVATAR} height={AVATAR}
                      rx="3" fill="#20293a" />
                {p.username && (
                  /* Heads come straight from mc-heads.net in the visitor's
                     browser, which is how the main site sourced them before it
                     started proxying them through its own API. */
                  <image href={`https://mc-heads.net/avatar/${encodeURIComponent(p.username)}/${AVATAR}`}
                         x={p.left + 13} y={p.top + 10}
                         width={AVATAR} height={AVATAR} />
                )}
                <text className="family-user" x={p.left + 46} y={p.top + 25}
                      fontSize={p.userFs} fill={p.color}>{p.username || p.name}</text>
                <text className="family-title" x={p.left + 46} y={p.top + 44}
                      fill={p.color}>{p.title || "\u2014"}</text>
                {p.username && (
                  <text className="family-nick" x={p.left + 13} y={p.top + BOX_H - 12}>
                    {p.name}
                  </text>
                )}
              </g>
            ) : (
              <text key={p.id} x={p.x} y={p.y} textAnchor="middle"
                    dominantBaseline="middle" fill={p.color} opacity={dim(p)}
                    className="family-name family-name-minor"
                    fontSize={FONT_MINOR}>
                {p.name}
              </text>
            )
          ))}
        </svg>
      </div>
    </div>
  );
}
