/* Pure geometry for the family tree. No DOM, no React: give it a text
 * measurer and it returns the shapes to draw. The browser measures with a
 * canvas context; the offline preview script uses an estimator. */

export const COL = 180;        // horizontal grid unit
export const ROW = 215;        // vertical grid unit (one generation)
export const PAD_X = 120;      // margin either side
export const PAD_TOP = 96;     // room for the house captions
export const PAD_BOTTOM = 90;
const BUS_RISE = 34;           // how far above a child's name the sibling bar sits
const GAP = 10;                // gap between a name and the marriage bar
const R = 14;                  // corner radius on routed links
const HOUSE_PAD_X = 26;
const HOUSE_PAD_Y = 22;

export const FONT_MAJOR = 26;
/* Named people are drawn as cards carrying a player head, username and Fox
   title; unnamed placeholder ancestors stay as bare small text. */
export const BOX_W = 158;
export const BOX_H = 76;
export const AVATAR = 30;
export const FONT_MINOR = 13;

const fontOf = (p) => (p.minor ? FONT_MINOR : FONT_MAJOR);

/* Orthogonal polyline with rounded corners. Points must alternate between
   horizontal and vertical moves. */
function orthPath(pts, r = R) {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1];
    const inLen = Math.hypot(cx - px, cy - py);
    const outLen = Math.hypot(nx - cx, ny - cy);
    const rr = Math.max(0, Math.min(r, inLen / 2, outLen / 2));
    const ix = cx - Math.sign(cx - px) * rr, iy = cy - Math.sign(cy - py) * rr;
    const ox = cx + Math.sign(nx - cx) * rr, oy = cy + Math.sign(ny - cy) * rr;
    d += ` L ${ix} ${iy} Q ${cx} ${cy} ${ox} ${oy}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last[0]} ${last[1]}`;
  return d;
}

export function layout({ people, families, godparents, houses, measure }) {
  const byId = new Map();
  const maxCol = Math.max(...people.map((p) => p.col));
  const maxRow = Math.max(...people.map((p) => p.row));

  for (const p of people) {
    const fs = fontOf(p);
    const boxed = !p.minor;
    const w = boxed ? BOX_W : measure(p.name, fs);
    const h = boxed ? BOX_H : fs * 1.15;
    const x = PAD_X + (p.col - 1) * COL;
    const y = PAD_TOP + p.row * ROW;
    const house = houses.find((hh) => (hh.id ?? null) === (p.house ?? null));
    byId.set(p.id, {
      ...p, x, y, w, h, fs, boxed, color: house ? house.color : "#f2f5fa",
      left: x - w / 2, right: x + w / 2,
      top: y - h / 2, bottom: y + h / 2,
    });
  }

  const marriages = [];
  const descents = [];
  const adoptions = [];

  for (const fam of families) {
    const parents = fam.parents.map((id) => byId.get(id));
    const kids = (fam.children || []).map((id) => byId.get(id)).sort((a, b) => a.x - b.x);
    if (parents.some((p) => !p) || kids.some((k) => !k)) continue;

    let anchorX, anchorY;
    if (parents.length === 2) {
      const [a, b] = parents.slice().sort((p, q) => p.x - q.x);
      if (fam.route === "below") {
        /* A couple who are not side by side: their bar becomes a connector
           routed through the gap under their row. This is what keeps a person
           with two partners from reading as one four-way union — only the
           partners who share children stay adjacent. */
        const lane = Math.max(a.bottom, b.bottom) + 42;
        marriages.push({
          kind: "path",
          d: orthPath([[a.x, a.bottom], [a.x, lane], [b.x, lane], [b.x, b.bottom]]),
          strikeAt: { x: (a.x + b.x) / 2, y: lane },
          labelAt: { x: (a.x + b.x) / 2, y: lane + 20 },
          divorced: fam.status === "divorced",
          key: fam.parents.join("+"),
        });
        anchorX = (a.x + b.x) / 2;
        anchorY = lane;
      } else {
        const x1 = a.right + GAP, x2 = b.left - GAP;
        marriages.push({
          kind: "bar", x1, x2, y: a.y,
          strikeAt: { x: (x1 + x2) / 2, y: a.y },
          divorced: fam.status === "divorced",
          key: fam.parents.join("+"),
        });
        anchorX = (x1 + x2) / 2;
        anchorY = a.y;
      }
    } else {
      anchorX = parents[0].x;
      anchorY = parents[0].bottom;
    }

    // A union with no children (a dissolved marriage) draws its bar and stops.
    if (!kids.length) continue;

    const busY = Math.min(...kids.map((k) => k.top)) - (fam.rise || BUS_RISE);
    if (fam.adopted) {
      adoptions.push({ x: anchorX, y: (anchorY + busY) / 2, key: "adopted-" + fam.children[0] });
    }

    if (kids.length === 1) {
      const k = kids[0];
      const pts = Math.abs(k.x - anchorX) < 1
        ? [[anchorX, anchorY], [k.x, k.top]]
        : [[anchorX, anchorY], [anchorX, busY], [k.x, busY], [k.x, k.top]];
      descents.push({ d: orthPath(pts), key: fam.children.join(","), dashed: !!fam.adopted });
    } else {
      descents.push({ d: orthPath([[anchorX, anchorY], [anchorX, busY]]),
                      key: "stem-" + fam.children[0], dashed: !!fam.adopted });
      const left = Math.min(kids[0].x, anchorX);
      const right = Math.max(kids[kids.length - 1].x, anchorX);
      descents.push({ d: `M ${left} ${busY} L ${right} ${busY}`,
                      key: "bus-" + fam.children[0], dashed: !!fam.adopted });
      for (const k of kids) {
        descents.push({ d: `M ${k.x} ${busY} L ${k.x} ${k.top}`,
                        key: "stub-" + k.id, dashed: !!fam.adopted });
      }
    }
  }

  /* Godparent links are dashed and routed around the names rather than through
     them, ending on the child's sibling bar exactly as in the drawing. */
  const godLinks = [];
  const laneY = PAD_TOP + maxRow * ROW + 52;
  let laneSlot = 0;
  for (const g of godparents) {
    const from = byId.get(g.person), child = byId.get(g.child);
    if (!from || !child) continue;
    // Stagger where each link meets the child so two godparents do not land
    // on the same point.
    const endX = child.x + (laneSlot === 0 ? -14 : 14);
    const lane = laneY + laneSlot * 26;
    const viaX = g.viaCol != null ? PAD_X + (g.viaCol - 1) * COL : from.x;
    const pts = [[from.x, from.bottom], [from.x, lane], [viaX, lane],
                 [viaX, lane], [endX, lane], [endX, child.bottom]];
    // Collapse any zero-length segments the generic form leaves behind.
    const clean = pts.filter((pt, i, a) =>
      i === 0 || pt[0] !== a[i - 1][0] || pt[1] !== a[i - 1][1]);
    godLinks.push({
      d: orthPath(clean), role: g.role, key: g.person + "-" + g.child,
      labelAt: { x: (from.x + endX) / 2, y: lane - 10, orient: "h" },
    });
    laneSlot += 1;
  }

  /* No enclosing outlines: a box drawn round one house's members inevitably
     encloses people from another, which is what made the first draft hard to
     read. Houses are carried by name colour plus the legend instead. */
  const legend = houses.filter((h) =>
    people.some((p) => (p.house ?? null) === (h.id ?? null)));

  return {
    width: PAD_X * 2 + (maxCol - 1) * COL,
    height: PAD_TOP + maxRow * ROW + PAD_BOTTOM,
    laneBottom: laneY + Math.max(0, godparents.length - 1) * 26,
    nodes: [...byId.values()],
    marriages, descents, godLinks, adoptions, legend,
  };
}

/* Width estimator for environments without a canvas (the preview script).
   Calibrated roughly against a bold sans; only affects gap sizing. */
export function estimateWidth(text, fontSize) {
  const narrow = "ijlItf.,:;'\u00b4";
  const wide = "MWmw@";
  let units = 0;
  for (const ch of text) {
    if (narrow.includes(ch)) units += 0.34;
    else if (wide.includes(ch)) units += 0.92;
    else if (ch === " ") units += 0.30;
    else if (ch === ch.toUpperCase() && ch !== ch.toLowerCase()) units += 0.68;
    else units += 0.56;
  }
  return units * fontSize;
}
