import { useMemo } from "react";
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

  return (
    <div className="family-page">
      <header className="family-head">
        <h1>Family Tree</h1>
        <p>
          Red bars are marriages (struck through where dissolved), blue lines
          descent, blue-grey lines descent, dashed blue-grey a godparent or an adoption. A dissolved marriage is a dashed connector, struck through. Each card shows the player's head, in-game username and Fox title. Within a generation,
          those drawn higher are the older.
        </p>
        <ul className="family-legend">
          {g.legend.map((h) => (
            <li key={h.id || "none"}>
              <span className="family-swatch" style={{ background: h.color }} />
              {h.label}
            </li>
          ))}
        </ul>
      </header>

      <div className="family-scroll">
        <svg
          className="family-svg"
          viewBox={`0 0 ${Math.round(g.width)} ${Math.round(g.height)}`}
          width={Math.round(g.width)} height={Math.round(g.height)}
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
              <g key={p.id}>
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
                <text className="family-user" x={p.left + 50} y={p.top + 25}
                      fill={p.color}>{p.username || p.name}</text>
                <text className="family-title" x={p.left + 50} y={p.top + 43}
                      fill={p.color}>{p.title || "\u2014"}</text>
                {p.username && (
                  <text className="family-nick" x={p.left + 13} y={p.top + BOX_H - 12}>
                    {p.name}
                  </text>
                )}
              </g>
            ) : (
              <text key={p.id} x={p.x} y={p.y} textAnchor="middle"
                    dominantBaseline="middle" fill={p.color}
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
