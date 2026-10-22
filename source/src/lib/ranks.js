import { RANK_COLORS } from "../lib.js";

// The guild's own rank sheet, verbatim — this is a reference chart, not a
// projection of the live roster, so it deliberately disagrees with
// titles.py in two places:
//
//   * Royalty and Viceroyalty stay separate categories here even though the
//     roster's title ladder collapses both into one "House Everton" section
//     (see SECTION_CATEGORIES below, which re-joins them for display).
//   * Prime Minister is listed unconditionally even though on the roster
//     it's a live overlay flag (PRIME_MINISTER_ROLE_ID, config.py) that only
//     appears when the seat is filled — the chart describes the guild's
//     structure regardless.
//
// Gentry splits into "Landed Gentry" (Lord/Lady/Liege) here, matching how
// the roster splits its Gentry section by tier.
export const RANKS = [
  {
    category: "Royalty", color: RANK_COLORS.Royalty,
    rows: [
      { rank: "King", ingame: "Owner", role: "Owner and Leader of the guild" },
      { rank: "Prince", ingame: "Chief", role: "Vice Owner of the guild" },
      { rank: "Archduke", ingame: "Chief", role: "Leader of Everton House" },
    ],
  },
  {
    category: "Viceroyalty", color: RANK_COLORS.Viceroyalty,
    rows: [
      { rank: "Viceroy", ingame: "Chief", role: "Vice Leader of the guild" },
    ],
  },
  {
    category: "High Nobility", color: RANK_COLORS["High Nobility"],
    rows: [
      { rank: "Marquis / Marchioness / Marqix", ingame: "Chief", role: "Advisory Community Managers" },
      { rank: "Count / Countess / Countx", ingame: "Chief", role: "Standard Regional Managers" },
    ],
  },
  {
    category: "Nobility", color: RANK_COLORS.Nobility,
    rows: [
      { rank: "Viscount / Viscountess / Viscountx", ingame: "Chief", role: "Senior intermediary officers" },
      { rank: "Baron / Baroness / Baronx", ingame: "Chief", role: "Junior intermediary officers" },
    ],
  },
  {
    category: "Prime Minister", color: RANK_COLORS["Prime Minister"],
    rows: [
      { rank: "Prime Minister", ingame: "Chief", role: "Gentry representative" },
    ],
  },
  {
    category: "Landed Gentry", color: RANK_COLORS["Landed Gentry"],
    rows: [
      { rank: "Lord / Lady / Liege", ingame: "Strategist", role: "Trusted senior members" },
    ],
  },
  {
    category: "Gentry", color: RANK_COLORS.Gentry,
    rows: [
      { rank: "Sir / Madam / Knight", ingame: "Captain/Strategist", role: "Standard members" },
      { rank: "Squire", ingame: "Recruiter", role: "Proven recruits in training" },
    ],
  },
  {
    category: "Trial Member", color: RANK_COLORS["Trial Member"],
    rows: [
      { rank: "Page", ingame: "Recruit", role: "New recruits in a trial period" },
    ],
  },
];

// Roster section name -> the chart categories that describe it. Only listed
// where the two disagree; everything else is a straight name match.
const SECTION_CATEGORIES = {
  "House Everton": ["Royalty", "Viceroyalty"],
};

/** The chart categories a roster section covers. */
export function categoriesFor(section) {
  return SECTION_CATEGORIES[section] || [section];
}

/** The ladder rows to show under a roster section's heading — empty for a
 * section the chart doesn't describe at all (e.g. "Unranked", which is a
 * catch-all for members whose title hasn't been set, not a real rank). */
export function ladderFor(section) {
  const wanted = categoriesFor(section);
  return RANKS.filter((r) => wanted.includes(r.category)).flatMap((r) => r.rows);
}
