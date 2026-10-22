import { memo } from "react";
import { formatDate, formatDateTime, nameColor, shallowEqual } from "../lib.js";
import { RecruitClassToggle } from "./staff/RecruitClassToggle.jsx";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { Status } from "./roster.jsx";

/** One roster member as a card — the default view on /members. The whole
 * card opens the player panel (not just the name/avatar row) — one big
 * click target rather than a small one buried inside it — except for the
 * staff-only recruit-class toggle at the bottom, which stops its own click
 * from also opening the panel.
 *
 * `accent` is the *displayed* section's colour, passed in rather than looked
 * up from m.section: the page carves "Landed Gentry" and "Prime Minister"
 * out of the raw Gentry section (splitGentry), so a member's own section
 * field doesn't always name the section they're being shown under.
 *
 * `showRemoval`: staff-only, on while the page-top "🚪 Up for Removal" filter
 * is active — every card shown is already a candidate (the backend's
 * removal_candidate flag), so this adds the one figure that filter's own chip
 * doesn't otherwise surface: their actual playtime in the window. */
function MemberCard({ m, accent, viewerStaff, onDone, onSelect, showPromotions, showRemoval }) {
  return (
    <div className="member-card" style={{ borderLeftColor: nameColor(m.title, accent) }}
      role="button" tabIndex={0} title={`View ${m.name}'s stats`}
      onClick={() => onSelect(m)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(m)}>
      <div className="member-card-open">
        <PlayerAvatar uuid={m.uuid} size={32} radius={6} />
        <span className="member-card-name" style={{ "--name-color": nameColor(m.title, accent) }}>
          {m.name}
        </span>
      </div>

      <div className="member-card-title-row">
        <div className="member-card-title" style={{ color: nameColor(m.title, accent) }}>
          {m.title || "—"}
          {viewerStaff && m.recruit_class_complete && <span title="Recruit class complete"> 🎓</span>}
        </div>
        <div className="member-card-status">
          <Status m={m} />
        </div>
      </div>
      <div className="member-card-meta muted">
        <span style={{ textTransform: "capitalize" }}>{m.ingame_rank || "—"}</span>
        <span>{m.region}</span>
      </div>
      {(m.accepted_at || m.joined_at) && (
        <div className="member-card-stats muted" title={formatDateTime(m.accepted_at || m.joined_at)}>
          {m.accepted_at ? "accepted" : "joined"} {formatDate(m.accepted_at || m.joined_at)}
        </div>
      )}
      {viewerStaff && showPromotions && m.last_promoted_at && (
        <div className="member-card-stats muted" title={formatDateTime(m.last_promoted_at)}>
          promoted {formatDate(m.last_promoted_at)}
        </div>
      )}
      {viewerStaff && showRemoval && m.playtime_14d != null && (
        <div className="member-card-stats muted">
          🚪 {m.playtime_14d}h played in the last 14d
        </div>
      )}
      {viewerStaff && m.section === "Trial Member" && (
        <div className="member-card-actions" onClick={(e) => e.stopPropagation()}>
          <RecruitClassToggle player={m} onDone={onDone} />
        </div>
      )}
    </div>
  );
}

/* Memoised because the roster is ~100 of these and the page re-renders often:
 * /members polls every 30s, holds a second 60s poll for the panel's metrics,
 * and re-renders on every character typed into the search box. Each poll tick
 * hands back freshly parsed member objects, so reference equality would rebuild
 * every card on a payload that usually hasn't changed at all — hence the
 * field-wise compare. Every value on a member row is a primitive, so a shallow
 * compare covers all of them and, unlike an explicit field list, can't quietly
 * stop updating when the backend adds one. The page passes stable callbacks
 * (see Members' useCallback) so onDone/onSelect don't defeat this.
 */
export default memo(MemberCard, (a, b) =>
  a.accent === b.accent
  && a.viewerStaff === b.viewerStaff
  && a.showPromotions === b.showPromotions
  && a.showRemoval === b.showRemoval
  && a.onDone === b.onDone
  && a.onSelect === b.onSelect
  && shallowEqual(a.m, b.m));
