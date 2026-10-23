/* Offline render of the tree to preview.svg, for checking geometry without a
   browser. Mirrors FamilyTree.jsx; the geometry comes from the same layout(). */
import fs from "node:fs";
import { HOUSES, PEOPLE, FAMILIES, GODPARENTS } from "./src/family/data.js";
import { layout, estimateWidth, FONT_MAJOR, FONT_MINOR } from "./src/family/layout.js";

const g = layout({ people: PEOPLE, families: FAMILIES, godparents: GODPARENTS,
                   houses: HOUSES, measure: estimateWidth });
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const F = (s) => `800 ${s}px 'DejaVu Sans', sans-serif`;
const out = [];
out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(g.width)} ${Math.round(g.height)}" width="${Math.round(g.width)}" height="${Math.round(g.height)}">`);
out.push(`<rect width="100%" height="100%" fill="#0d1119"/>`);
g.legend.forEach((h, i) => {
  const x = 40 + i * 240;
  out.push(`<rect x="${x}" y="24" width="16" height="16" rx="3" fill="${h.color}"/>`);
  out.push(`<text x="${x + 24}" y="38" fill="#c3ccdb" style="font:${F(15)}">${esc(h.label)}</text>`);
});
for (const s of g.descents) out.push(`<path d="${s.d}" fill="none" stroke="#1b9fd0" stroke-width="5" stroke-linecap="round"${s.dashed ? ' stroke-dasharray="7 9"' : ""}/>`);
for (const a of g.adoptions) out.push(`<text x="${a.x}" y="${a.y}" transform="rotate(-90 ${a.x} ${a.y})" text-anchor="middle" fill="#9fd4ea" style="font:${F(12)}">adopted</text>`);
for (const s of g.godLinks) {
  out.push(`<path d="${s.d}" fill="none" stroke="#1b9fd0" stroke-width="5" stroke-linecap="round" stroke-dasharray="14 11"/>`);
  out.push(`<text x="${s.labelAt.x}" y="${s.labelAt.y}" text-anchor="middle" fill="#9fd4ea" style="font:${F(12)}">${esc(s.role)}</text>`);
}
for (const m of g.marriages) {
  if (m.kind === "path") {
    out.push(`<path d="${m.d}" fill="none" stroke="#e4121b" stroke-width="6" stroke-linecap="round" stroke-dasharray="16 10"/>`);
  } else {
    out.push(`<path d="M ${m.x1} ${m.y} L ${m.x2} ${m.y}" stroke="#e4121b" stroke-width="6" stroke-linecap="round"/>`);
  }
  if (m.divorced) {
    const s = m.strikeAt;
    out.push(`<path d="M ${s.x - 11} ${s.y + 12} L ${s.x - 1} ${s.y - 12}" stroke="#e4121b" stroke-width="5" stroke-linecap="round"/>`);
    out.push(`<path d="M ${s.x + 1} ${s.y + 12} L ${s.x + 11} ${s.y - 12}" stroke="#e4121b" stroke-width="5" stroke-linecap="round"/>`);
    if (m.labelAt) out.push(`<text x="${m.labelAt.x}" y="${m.labelAt.y}" text-anchor="middle" fill="#f08a8f" style="font:${F(12)}">divorced</text>`);
  }
}
for (const p of g.nodes) {
  out.push(`<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="middle" fill="${p.color}" style="font:${F(p.minor ? FONT_MINOR : FONT_MAJOR)}">${esc(p.name)}</text>`);
}
out.push("</svg>");
fs.writeFileSync("preview.svg", out.join("\n"));
console.log("OK", Math.round(g.width) + "x" + Math.round(g.height), "nodes", g.nodes.length,
            "marriages", g.marriages.length, "godlinks", g.godLinks.length, "legend", g.legend.length);
process.exit(0);
