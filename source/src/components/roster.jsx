import { formatDate, timeAgo, RANK_COLORS } from "../lib.js";

// Section name -> accent color, matching the guild rank chart's category
// colors (RANK_COLORS in lib.js) so the roster and the ladder agree.
export const SECTION_COLORS = RANK_COLORS;

export function Status({ m }) {
  // Staff-only On Leave / Warned marks (set via the 🚩 action, stored in
  // bot.db's member_status — non-staff payloads carry no status at all).
  // The badge outranks online/last-seen, same as the old on-leave role did;
  // reason + who/when ride the hover title rather than crowding the cell.
  if (m.status === "on_leave" || m.status === "warned") {
    const info = [m.status_reason,
                  m.status_until && `until ${formatDate(m.status_until)}`,
                  m.status_by && `set by ${m.status_by}`,
                  m.status_at && formatDate(m.status_at)].filter(Boolean).join(" · ");
    return (
      <span className={m.status === "warned" ? "badge warn" : "badge leave"}
        title={info || undefined}>
        {m.status === "warned" ? "warned" : "on leave"}
      </span>
    );
  }
  if (m.online) return <span className="badge online">{m.server || "online"}</span>;
  if (!m.last_seen) {
    // Wynncraft's API sometimes has no lastJoin for a member at all — an
    // account privacy setting, or one that's simply never logged in since
    // joining. Not something a re-sync can fix, so flag it as such rather
    // than a bare, unexplained "—".
    return <span className="muted" title="Wynncraft hasn't given us a last-seen time for this player (account privacy setting, or they may not have logged in since joining)">—</span>;
  }
  return <span className="muted">{timeAgo(m.last_seen)}</span>;
}

// Gentry (tiers 1-3: Squire, Sir/Madam/Knight, Lord/Lady/Liege) splits into
// its own "Landed Gentry" section for the Lord/Lady/Liege tier (3), shown
// above the rest of Gentry — mirrors the rank chart's ordering without any
// backend/titles.py change (tier is already on each member row).
//
// Prime Minister (the Gentry representative) is a live-roster overlay flag
// (PRIME_MINISTER_ROLE_ID in config.py, off when unset) layered on top of
// whatever title/tier a member already holds — it doesn't change their real
// section. Carved out here into its own section, slotted between Nobility
// and Landed Gentry to match the rank ladder.
export function splitGentry(sections) {
  const pm = [];
  const out = [];
  for (const s of sections) {
    const rest = [];
    for (const m of s.members) (m.prime_minister ? pm : rest).push(m);
    if (s.section !== "Gentry") {
      if (rest.length) out.push({ ...s, members: rest });
      continue;
    }
    const landed = rest.filter((m) => m.tier === 3);
    const gentry = rest.filter((m) => m.tier !== 3);
    if (landed.length) out.push({ section: "Landed Gentry", members: landed });
    if (gentry.length) out.push({ section: "Gentry", members: gentry });
  }
  if (pm.length) {
    let i = out.findIndex((s) => s.section === "Landed Gentry" || s.section === "Gentry");
    if (i === -1) {
      const nobIdx = out.findIndex((s) => s.section === "Nobility");
      i = nobIdx === -1 ? out.length : nobIdx + 1;
    }
    out.splice(i, 0, { section: "Prime Minister", members: pm });
  }
  return out;
}

