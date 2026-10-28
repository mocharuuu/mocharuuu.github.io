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
    /* Anchor the tween to the first animation frame rather than to
       performance.now(): the two only share a time origin by convention, and
       if they ever diverge the eased value overshoots wildly. */
    let t0 = null;
    const tick = (now) => {
      if (t0 === null) t0 = now;
      const p = Math.min(1, Math.max(0, (now - t0) / TWEEN_MS));
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

  /* Pointer capture is taken only once a drag actually begins. Capturing on
     pointerdown retargets the whole gesture to the <svg>, which is what stopped
     taps from ever reaching a card. */
  const drag = useRef(null);
  const panned = useRef(false);
  const unitsPerPixel = () => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || !box.width) return 1;
    // preserveAspectRatio="meet" fits the binding axis, so the scale is
    // whichever of the two is the constraint.
    return Math.max(viewRef.current.w / box.width, viewRef.current.h / box.height);
  };
  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    stop();
    panned.current = false;
    drag.current = {
      px: e.clientX, py: e.clientY, id: e.pointerId,
      view: viewRef.current, active: false,
    };
  };
  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dxPx = e.clientX - d.px, dyPx = e.clientY - d.py;
    if (!d.active) {
      if (Math.hypot(dxPx, dyPx) < 4) return;   // still a tap, not a drag
      d.active = true;
      panned.current = true;
      try { e.currentTarget.setPointerCapture(d.id); } catch { /* not fatal */ }
    }
    const k = unitsPerPixel();
    apply(clampView({ ...d.view, x: d.view.x - dxPx * k, y: d.view.y - dyPx * k }, full));
  };
  const onPointerUp = (e) => {
    const d = drag.current;
    if (d?.active) { try { e.currentTarget.releasePointerCapture(d.id); } catch { /* ignore */ } }
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

  /* Selection is driven from the card's own pointerup rather than synthetic
     click/dblclick: that works for touch as well as mouse, and does not depend
     on how the browser retargets events during a drag. A first tap frames the
     person after a short wait; a second tap on the same card inside that
     window opens their Wynncraft stats instead. */
  const tap = useRef({ id: null, at: 0, timer: null });
  useEffect(() => () => clearTimeout(tap.current.timer), []);

  const openStats = (person) => {
    if (!person.username) return;
    window.open(
      `https://wynncraft.com/stats/player/${encodeURIComponent(person.username)}`,
      "_blank", "noopener,noreferrer"
    );
  };

  const framePerson = (id) => {
    setFocus(null);
    setPicked((cur) => (cur === id ? null : id));
  };

  const onPersonTap = (person) => {
    if (panned.current) { panned.current = false; return; }
    const now = performance.now();
    const prev = tap.current;
    if (prev.id === person.id && now - prev.at < 340) {
      clearTimeout(prev.timer);
      tap.current = { id: null, at: 0, timer: null };
      openStats(person);
      return;
    }
    clearTimeout(prev.timer);
    const timer = setTimeout(() => {
      tap.current = { id: null, at: 0, timer: null };
      framePerson(person.id);
    }, 260);
    tap.current = { id: person.id, at: now, timer };
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
          or click twice to open their Wynncraft stats. Drag to pan, scroll or
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
              {a.label}
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
                        strokeLinecap="round"
                        strokeDasharray={m.divorced ? "16 10" : undefined} />
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
                 onPointerUp={() => onPersonTap(p)}
                 onKeyDown={(e) => {
                   if (e.key === "Enter" || e.key === " ") { e.preventDefault(); framePerson(p.id); }
                   if (e.key === "s" || e.key === "S") openStats(p);
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
