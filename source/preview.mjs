/* Offline render of the tree to preview.svg, for checking geometry without a
   browser. Mirrors FamilyTree.jsx; the geometry comes from the same layout(). */
import fs from "node:fs";
import { HOUSES, PEOPLE, FAMILIES, GODPARENTS } from "./src/family/data.js";
import { layout, estimateWidth, FONT_MINOR, BOX_H, AVATAR } from "./src/family/layout.js";

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
for (const s of g.descents) out.push(`<path d="${s.d}" fill="none" stroke="#7e95ad" stroke-width="5" stroke-linecap="round"${s.dashed ? ' stroke-dasharray="7 9"' : ""}/>`);
for (const a of g.adoptions) out.push(`<text x="${a.x}" y="${a.y}" transform="rotate(-90 ${a.x} ${a.y})" text-anchor="middle" fill="#a7bccd" style="font:${F(12)}">${a.label}</text>`);
for (const s of g.godLinks) {
  out.push(`<path d="${s.d}" fill="none" stroke="#7e95ad" stroke-width="5" stroke-linecap="round" stroke-dasharray="14 11"/>`);
  out.push(`<text x="${s.labelAt.x}" y="${s.labelAt.y}" text-anchor="middle" fill="#a7bccd" style="font:${F(12)}">${esc(s.role)}</text>`);
}
for (const m of g.marriages) {
  if (m.kind === "path") {
    out.push(`<path d="${m.d}" fill="none" stroke="#f3a6bf" stroke-width="6" stroke-linecap="round"${m.divorced ? ' stroke-dasharray="16 10"' : ""}/>`);
  } else {
    out.push(`<path d="M ${m.x1} ${m.y} L ${m.x2} ${m.y}" stroke="#f3a6bf" stroke-width="6" stroke-linecap="round"/>`);
  }
  if (m.divorced) {
    const s = m.strikeAt;
    out.push(`<path d="M ${s.x - 11} ${s.y + 12} L ${s.x - 1} ${s.y - 12}" stroke="#f3a6bf" stroke-width="5" stroke-linecap="round"/>`);
    out.push(`<path d="M ${s.x + 1} ${s.y + 12} L ${s.x + 11} ${s.y - 12}" stroke="#f3a6bf" stroke-width="5" stroke-linecap="round"/>`);
    if (m.labelAt) out.push(`<text x="${m.labelAt.x}" y="${m.labelAt.y}" text-anchor="middle" fill="#f3a6bf" style="font:${F(12)}">divorced</text>`);
  }
}
for (const p of g.nodes) {
  if (!p.boxed) {
    out.push(`<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="middle" fill="${p.color}" style="font:${F(FONT_MINOR)}">${esc(p.name)}</text>`);
    continue;
  }
  out.push(`<rect x="${p.left}" y="${p.top}" width="${p.w}" height="${p.h}" rx="8" fill="#141a26" stroke="#263145" stroke-width="1.5"/>`);
  out.push(`<rect x="${p.left}" y="${p.top}" width="4" height="${p.h}" rx="2" fill="${p.color}"/>`);
  out.push(`<rect x="${p.left + 13}" y="${p.top + 10}" width="${AVATAR}" height="${AVATAR}" rx="3" fill="#20293a"/>`);
  out.push(`<text x="${p.left + 46}" y="${p.top + 25}" fill="${p.color}" style="font:${F(p.userFs)}">${esc(p.username || p.name)}</text>`);
  out.push(`<text x="${p.left + 46}" y="${p.top + 44}" fill="${p.color}" style="font:700 12.5px 'DejaVu Sans', sans-serif">${esc(p.title || "\u2014")}</text>`);
  if (p.username) out.push(`<text x="${p.left + 13}" y="${p.top + BOX_H - 12}" fill="#8893a6" style="font:600 11px 'DejaVu Sans', sans-serif">${esc(p.name)}</text>`);
}
out.push("</svg>");
fs.writeFileSync("preview.svg", out.join("\n"));
console.log("OK", Math.round(g.width) + "x" + Math.round(g.height), "nodes", g.nodes.length,
            "marriages", g.marriages.length, "godlinks", g.godLinks.length, "legend", g.legend.length);
process.exit(0);
