import { HOUSES, PEOPLE, FAMILIES, GODPARENTS } from "./src/family/data.js";
import { layout, estimateWidth } from "./src/family/layout.js";
const g = layout({ people: PEOPLE, families: FAMILIES, godparents: GODPARENTS,
                   houses: HOUSES, measure: estimateWidth });
const key = (p) => p.house ?? "none";
console.log("full:", Math.round(g.width) + "x" + Math.round(g.height));
for (const h of g.legend) {
  const k = h.id ?? "none";
  const m = g.nodes.filter((n) => key(n) === k);
  const pad = 70;
  const x1 = Math.max(0, Math.min(...m.map((q) => q.left)) - pad);
  const x2 = Math.min(g.width, Math.max(...m.map((q) => q.right)) + pad);
  const y1 = Math.max(0, Math.min(...m.map((q) => q.top)) - pad);
  const y2 = Math.min(g.height, Math.max(...m.map((q) => q.bottom)) + pad);
  console.log(`${k.padEnd(9)} n=${String(m.length).padStart(2)} viewBox ${Math.round(x1)} ${Math.round(y1)} ${Math.round(x2-x1)} ${Math.round(y2-y1)}`);
}
process.exit(0);
