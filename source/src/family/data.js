/* The Kingdom of Foxes family tree.
 *
 * Adding a person: one entry in PEOPLE with a `col` (horizontal slot) and
 * `row` (generation), then wire them into FAMILIES. Columns and rows are grid
 * units, not pixels. Spouses must be adjacent in `col` so the marriage bar
 * lands between their two names; family clusters are spaced a couple of
 * columns apart so each reads as its own group.
 *
 * Rows carry birth order as well as generation: the Auspects children sit
 * slightly above Choco because they are older, and both sit below Spase.
 *
 * `house: null` is someone who married or was adopted in without belonging to
 * a house. `minor: true` is an unnamed placeholder ancestor, drawn small.
 */

export const HOUSES = [
  { id: "auspects", label: "House Auspects", color: "#5b9bf2" },
  { id: "calder",   label: "House Calder",   color: "#e05561" },
  { id: "lorcan",   label: "House Lorcan",   color: "#e8a33d" },
  { id: "everton",  label: "House Everton",  color: "#4fc08d" },
  { id: "yoshima",  label: "House Yoshima",  color: "#7cc7f5" },
  { id: "imago",    label: "House Imago",    color: "#a78bfa" },
  { id: null,       label: "No house",       color: "#98a1b5" },
];

export const PEOPLE = [
  // ---- generation 0 ----------------------------------------------------
  { id: "higher_matriarch", name: "some higher matriarch", house: "everton", col: 16.4, row: 0, minor: true },
  { id: "imago_gf", name: "male imago", house: "imago", col: 23.8, row: 0, minor: true },
  { id: "imago_gm", name: "Unknown",    house: "imago", col: 25.2, row: 0, minor: true },

  // ---- generation 1 ----------------------------------------------------
  { id: "calder_m1",   name: "male calder",    house: "calder",  col: 5.4,  row: 1, minor: true },
  { id: "unknown_1",   name: "Unknown",        house: "calder",  col: 6.8,  row: 1, minor: true },
  { id: "matriarch_1", name: "some matriarch", house: "everton", col: 14.4, row: 1, minor: true },
  { id: "matriarch_2", name: "some matriarch", house: "everton", col: 16.8, row: 1, minor: true },
  { id: "matriarch_3", name: "some matriarch", house: "everton", col: 18.0, row: 1, minor: true },
  { id: "unknown_n",   name: "Unknown",        house: "lorcan",  col: 19.0, row: 1, minor: true },
  { id: "lorcan_m1",   name: "male lorcan",    house: "lorcan",  col: 20.2, row: 1, minor: true },
  { id: "unknown_t",   name: "Unknown",        house: "lorcan",  col: 21.4, row: 1, minor: true },
  { id: "imago_f",     name: "female imago",   house: "imago",   col: 23.4, row: 1, minor: true },
  { id: "imago_sib",   name: "imago",          house: "imago",   col: 25.6, row: 1, minor: true },

  // ---- generation 2 ----------------------------------------------------
  { id: "auspects_m1", name: "male auspects", house: "auspects", col: 3.0, row: 2, minor: true },
  { id: "calder_f2",   name: "female calder", house: "calder",   col: 4.4, row: 2, minor: true },
  { id: "calder_m2",   name: "male calder",   house: "calder",   col: 7.8, row: 2, minor: true },
  { id: "unknown_2",   name: "Unknown",       house: "calder",   col: 9.2, row: 2, minor: true },
  { id: "neon",   name: "Neon",   house: "lorcan",  col: 19.6, row: 2, username: "NeonRider", title: "Baron" },
  { id: "borky",  name: "Borky",  house: "lorcan",  col: 22.0, row: 2, username: "Borkyy", title: "Sir" },
  { id: "tom",    name: "Tom",    house: "lorcan",  col: 20.8, row: 2, username: "ToolyTom", title: "Lord" },
  { id: "spase",  name: "Spase",  house: "everton", col: 13.2, row: 2, username: "SpaseCow", title: "King" },
  { id: "apollo", name: "Apollo", house: "everton", col: 12.0, row: 2, title: "Deceased" },
  { id: "rob",    name: "Rob",    house: "everton", col: 14.4, row: 2, username: "Robturne", title: "Prince" },
  { id: "salty",  name: "Salty",  house: "everton", col: 15.6, row: 2, username: "SaltyKing", title: "Viceroy" },
  { id: "pho",    name: "Pho",    house: "everton", col: 16.8, row: 2, username: "photor320", title: "Archduke" },
  { id: "viri",   name: "Viri",   house: "everton", col: 18.0, row: 2, username: "Viridian", title: "Marquis" },
  // Jake has no recorded tie to anyone else: Viri's generation, unconnected.
  { id: "jake",   name: "Jake",   house: "yoshima", col: 27.4, row: 2, username: "Jake70", title: "Marquis" },

  // ---- generation 3 — the Auspects children are the older half ----------
  { id: "chalupe", name: "Chalup\u00e9", house: "auspects", col: 1.0, row: 2.8, username: "chalupe", title: "Lord" },
  { id: "magnum",  name: "Magnum",  house: "auspects", col: 2.0, row: 2.8, username: "MagnumXD_", title: "Lord" },
  { id: "window",  name: "Window",  house: "auspects", col: 3.0, row: 2.8, username: "Window991", title: "Lord" },
  { id: "fool",    name: "Fool",    house: null,       col: 4.2, row: 2.8, username: "fooleaten", title: "Lady" },
  { id: "sek",     name: "Sek",     house: "auspects", col: 5.4, row: 2.8, username: "sek3big", title: "Townsperson" },
  { id: "sini",    name: "Sini",    house: "auspects", col: 6.4, row: 2.8, username: "nothesinistrtype", title: "Countx" },
  // Sitting beyond Lorcan and Yoshima, awaiting the family they will belong to.
  { id: "mocha", name: "Mocha", house: "imago", col: 23.4, row: 2, username: "mocharuu",  title: "Baroness" },
  { id: "mango", name: "Mango", house: "imago", col: 24.6, row: 2, username: "trumango",  title: "Sir" },
  { id: "max",   name: "Max",   house: "imago", col: 26.0, row: 2, username: "Maxkarson", title: "Lord" },
  // ---- generation 3 — younger than Sini's siblings ----------------------
  { id: "choco",   name: "Choco",   house: "calder",   col: 8.6,  row: 3.2, username: "_HotChocolate", title: "Count" },
  { id: "clod",    name: "Clod",    house: "calder",   col: 9.8,  row: 3.2, username: "Clodwad", title: "Count" },
  { id: "astral",  name: "Astral",  house: "lorcan",   col: 20.2, row: 3.2, username: "Astral_Heart", title: "Lord" },
  { id: "quack",   name: "Quack",   house: "lorcan",   col: 21.4, row: 3.2, username: "QuackMC", title: "Sir" },
  { id: "hboom",   name: "Hboom",   house: "lorcan",   col: 22.6, row: 3.2, username: "hBoom", title: "Sir" },

  // ---- generation 4 ----------------------------------------------------
  { id: "leoh",   name: "Leoh",   house: "calder", col: 9.2,  row: 4.2, username: "__Leoh_", title: "Lord" },
  { id: "hyun",   name: "Hyun",   house: null,     col: 10.6, row: 4.2, username: "hyunugii", title: "Lord" },
  { id: "hkiim",  name: "Hkiim",  house: null,     col: 11.8, row: 4.2, username: "hkiim", title: "Madam" },
  { id: "mail", name: "Mail", house: null, col: 23.6, row: 3.2, username: "MailOrderGF", title: "Madam" },
  { id: "mima", name: "Mima", house: null, col: 24.8, row: 3.2, username: "Mima_chan",   title: "Madam" },
  { id: "nano", name: "Nano", house: null, col: 26.0, row: 3.2, username: "Nanoshere",   title: "Sir" },
];

/* One or two parents plus their children. Two parents draw the red bar between
 * them and descend from its midpoint; a single parent descends from their own
 * name. `status: "divorced"` strikes the bar through, `adopted: true` dashes
 * the descent, and `rise` lifts a sibling bar where its span passes over
 * someone who is not one of the siblings.
 */
export const FAMILIES = [
  { parents: ["higher_matriarch"], children: ["matriarch_1", "matriarch_2", "matriarch_3"] },
  { parents: ["matriarch_1"], children: ["spase", "rob", "salty"], rise: 80 },
  { parents: ["matriarch_2"], children: ["pho"] },
  { parents: ["matriarch_3"], children: ["viri"] },
  { parents: ["unknown_n", "lorcan_m1"], children: ["neon"] },
  { parents: ["lorcan_m1", "unknown_t"], children: ["tom"] },
  // Mocha is the third child of male lorcan, by a different mother again.
  // He already has a partner either side, so this union is routed.
  { parents: ["lorcan_m1", "imago_f"], children: ["mocha"], route: "below" },
  { parents: ["imago_gf", "imago_gm"], children: ["imago_f", "imago_sib"] },
  { parents: ["imago_sib"], children: ["max"] },
  { parents: ["calder_m1", "unknown_1"],   children: ["calder_f2", "calder_m2"] },
  { parents: ["auspects_m1", "calder_f2"], children: ["chalupe", "magnum", "window", "sek", "sini"], rise: 74 },
  { parents: ["calder_m2", "unknown_2"],   children: ["choco"] },
  { parents: ["window", "fool"], children: [] },
  { parents: ["mocha", "mango"], children: ["mail", "mima", "nano"], adopted: "fostered", rise: 66 },
  { parents: ["tom", "spase"],  children: [], status: "divorced", route: "below" },
  { parents: ["tom", "borky"],  children: ["astral", "quack", "hboom"] },
  { parents: ["apollo", "spase"], children: ["clod"], status: "divorced" },
  { parents: ["choco", "clod"], children: ["leoh"] },
  // Adopted by Clod alone, not by Choco.
  { parents: ["clod"], children: ["hyun", "hkiim"], adopted: true, rise: 66 },
];

/* Godparent links run through a clear lane beneath the tree and come up to
 * the child from below, so they never cross a marriage bar or a descent.
 * `viaCol` is the column the link uses to get down there. */
export const GODPARENTS = [
  { person: "sini", child: "choco", role: "godmother", viaCol: 7.3 },
];
