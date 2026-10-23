/* Prints the frame each click would produce, so the zoom behaviour can be
   checked without a browser. */
import { HOUSES, PEOPLE, FAMILIES, GODPARENTS } from "./src/family/data.js";
import { layout, estimateWidth, clampView, zoomView, MIN_VIEW_W } from "./src/family/layout.js";
const g = layout({ people: PEOPLE, families: FAMILIES, godparents: GODPARENTS,
                   houses: HOUSES, measure: estimateWidth });
const key = (p) => p.house ?? "none";
const frame = (members) => {
  const pad = 70;
  const x1 = Math.max(0, Math.min(...members.map((q) => q.left)) - pad);
  const x2 = Math.min(g.width, Math.max(...members.map((q) => q.right)) + pad);
  const y1 = Math.max(0, Math.min(...members.map((q) => q.top)) - pad);
  const y2 = Math.min(g.height, Math.max(...members.map((q) => q.bottom)) + pad);
  return `${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2 - x1)} ${Math.round(y2 - y1)}`;
};
console.log("full:", Math.round(g.width) + "x" + Math.round(g.height));
console.log("\n-- houses --");
for (const h of g.legend) {
  const k = h.id ?? "none";
  const m = g.nodes.filter((n) => key(n) === k);
  console.log(`${k.padEnd(9)} n=${String(m.length).padStart(2)}  ${frame(m)}`);
}
console.log("\n-- people (immediate circle) --");
for (const n of g.nodes) {
  if (!n.boxed) continue;
  const circle = g.neighbours.get(n.id);
  const m = g.nodes.filter((q) => circle.has(q.id));
  const others = [...circle].filter((i) => i !== n.id).join(",");
  console.log(`${n.id.padEnd(9)} n=${String(m.length).padStart(2)}  ${frame(m).padEnd(22)} ${others}`);
}

/* ---- pan / zoom arithmetic ---- */
const full = { x: 0, y: 0, w: g.width, h: g.height };
console.log("\n-- zoom --");
let v = full;
for (let i = 1; i <= 8; i++) {
  v = zoomView(v, 1.35, full);
  console.log(`in  x${i}  w=${v.w.toFixed(0)} h=${v.h.toFixed(0)} x=${v.x.toFixed(0)} y=${v.y.toFixed(0)}`);
}
console.log(`clamped at MIN_VIEW_W=${MIN_VIEW_W}: ${v.w.toFixed(0) === String(MIN_VIEW_W) ? "yes" : "NO"}`);
for (let i = 1; i <= 10; i++) v = zoomView(v, 1 / 1.35, full);
console.log(`out to fit: w=${v.w.toFixed(0)} (full ${full.w}) -> ${Math.abs(v.w - full.w) < 1 ? "yes" : "NO"}`);
const centred = zoomView(full, 1.35, full);
console.log(`centre held: ${(centred.x + centred.w / 2).toFixed(0)} vs ${(full.w / 2).toFixed(0)}`);
const far = clampView({ x: 99999, y: 99999, w: 1000, h: 400 }, full);
console.log(`pan clamp: x=${far.x.toFixed(0)} (max ${(full.w - 1000 + full.w * 0.25).toFixed(0)})`);
process.exit(0);
