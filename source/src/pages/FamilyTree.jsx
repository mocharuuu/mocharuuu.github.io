import { useEffect, useMemo, useRef, useState } from "react";
import { HOUSES, PEOPLE, FAMILIES, GODPARENTS } from "../family/data.js";
import { layout, estimateWidth, FONT_MINOR, BOX_H, AVATAR } from "../family/layout.js";
import "../family/family.css";

const FAMILY_FONT = '800 {size}px "Segoe UI", system-ui, -apple-system, sans-serif';

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

export default function FamilyTree() {
  const g = useMemo(() => layout({
    people: PEOPLE, families: FAMILIES, godparents: GODPARENTS,
    houses: HOUSES, measure: makeMeasure(),
  }), []);

  /* Two independent framings. A house button frames that house; clicking a
     person frames their immediate circle. Each clears the other, and `null`
     for both means the whole tree. The houseless group is keyed "none" so it
     does not collide with the no-filter sentinel. */
  const [focus, setFocus] = useState(null);
  const [picked, setPicked] = useState(null);
  const houseKey = (h) => h.id ?? "none";
  const personKey = (p) => p.house ?? "none";

  /* A double-click also delivers two clicks, so hold the zoom briefly and
     drop it if the second click arrives. */
  const clickTimer = useRef(null);
  useEffect(() => () => clearTimeout(clickTimer.current), []);

  const onPersonClick = (id) => {
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

  const inFrame = useMemo(() => {
    if (picked) return g.neighbours.get(picked) || new Set([picked]);
    return null;
  }, [picked, g]);

  const view = useMemo(() => {
    const full = { x: 0, y: 0, w: g.width, h: g.height };
    const members = picked
      ? g.nodes.filter((n) => inFrame.has(n.id))
      : focus !== null
        ? g.nodes.filter((n) => personKey(n) === focus)
        : null;
    if (!members || !members.length) return full;
    const pad = 70;
    const x1 = Math.max(0, Math.min(...members.map((m) => m.left)) - pad);
    const x2 = Math.min(g.width, Math.max(...members.map((m) => m.right)) + pad);
    const y1 = Math.max(0, Math.min(...members.map((m) => m.top)) - pad);
    const y2 = Math.min(g.height, Math.max(...members.map((m) => m.bottom)) + pad);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }, [focus, picked, inFrame, g]);

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
          Red bars are marriages (struck through where dissolved), blue lines
          descent, blue-grey lines descent, dashed blue-grey a godparent or an adoption. A dissolved marriage is a dashed connector, struck through. Each card shows the player's head, in-game username and Fox title. Pick a house in the key to frame its members; click a person to frame their immediate circle, or double-click to open their Wynncraft stats. Within a generation,
          those drawn higher are the older.
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
              onClick={() => { setPicked(null); setFocus(null); }}
            >
              Everyone
            </button>
          </li>
        </ul>
      </header>

      <div className="family-scroll">
        <svg
          className="family-svg"
          viewBox={`${Math.round(view.x)} ${Math.round(view.y)} ${Math.round(view.w)} ${Math.round(view.h)}`}
          width={Math.round(view.w)} height={Math.round(view.h)}
          preserveAspectRatio="xMidYMid meet"
          style={focus !== null || picked ? { minWidth: 0 } : undefined}
          role="img" aria-label="Kingdom of Foxes family tree"
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
