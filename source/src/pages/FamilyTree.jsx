import { useMemo } from "react";
import { HOUSES, PEOPLE, FAMILIES, GODPARENTS } from "../family/data.js";
import { layout, estimateWidth, FONT_MAJOR, FONT_MINOR } from "../family/layout.js";
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
          descent, dashed blue a godparent or an adoption. A dissolved marriage is a dashed red connector, struck through. Within a generation,
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
            <path key={s.key} d={s.d} fill="none" stroke="#1b9fd0"
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
              <path d={s.d} fill="none" stroke="#1b9fd0" strokeWidth="5"
                    strokeLinecap="round" strokeDasharray="14 11" />
              <text className="family-role" x={s.labelAt.x} y={s.labelAt.y}
                    textAnchor="middle">{s.role}</text>
            </g>
          ))}

          {g.marriages.map((m) => (
            <g key={m.key}>
              {m.kind === "path"
                ? <path d={m.d} fill="none" stroke="#e4121b" strokeWidth="6"
                        strokeLinecap="round" strokeDasharray="16 10" />
                : <path d={`M ${m.x1} ${m.y} L ${m.x2} ${m.y}`}
                        stroke="#e4121b" strokeWidth="6" strokeLinecap="round" />}
              {/* A dissolved marriage keeps its connector and is struck
                  through, the usual genealogical mark for a divorce. */}
              {m.divorced && (
                <>
                  <path d={`M ${m.strikeAt.x - 11} ${m.strikeAt.y + 12} L ${m.strikeAt.x - 1} ${m.strikeAt.y - 12}`}
                        stroke="#e4121b" strokeWidth="5" strokeLinecap="round" />
                  <path d={`M ${m.strikeAt.x + 1} ${m.strikeAt.y + 12} L ${m.strikeAt.x + 11} ${m.strikeAt.y - 12}`}
                        stroke="#e4121b" strokeWidth="5" strokeLinecap="round" />
                </>
              )}
              {m.labelAt && m.divorced && (
                <text className="family-role family-divorced" x={m.labelAt.x}
                      y={m.labelAt.y} textAnchor="middle">divorced</text>
              )}
            </g>
          ))}

          {g.nodes.map((p) => (
            <text key={p.id} x={p.x} y={p.y} textAnchor="middle"
                  dominantBaseline="middle" fill={p.color}
                  className={p.minor ? "family-name family-name-minor" : "family-name"}
                  fontSize={p.minor ? FONT_MINOR : FONT_MAJOR}>
              {p.name}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}
