/* Prints the frame each click would produce, so the zoom behaviour can be
   checked without a browser. */
import { HOUSES, PEOPLE, FAMILIES, GODPARENTS } from "./src/family/data.js";
import { layout, estimateWidth } from "./src/family/layout.js";
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
process.exit(0);
