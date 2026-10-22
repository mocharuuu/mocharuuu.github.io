import { useState } from "react";
import { timeAgo } from "../../lib.js";
import { UnlinkedLinkButton, UnlinkedOffboardButton, UnlinkedUnlinkButton } from "./UnlinkedButtons.jsx";

// The staff-only cards that sit above the roster itself (Unlinked,
// Offboarded). They're deliberately independent of the page's search/region/
// view controls — staff want each of these lists whole, at a glance, not
// narrowed to whatever filter happens to be set. "Up for Removal" used to be
// a third card here too; it's now the "🚪 Up for Removal" staff filter on
// Members.jsx instead (see REMOVAL_WINDOW_DAYS there), so a candidate shows
// up right in the roster grid — with their own playtime figure on the card —
// rather than in a separate table staff have to cross-reference.

// Staff-only: in-game members with no Discord link, in-game members whose
// linked Discord account has left the server, or Discord members holding
// a guild role who aren't in-game. The bot handles the clear-cut cases on its
// own (kick requests for anyone who left the Discord, an automatic offboard
// for anyone it saw leave the in-game guild); this card is the to-do list for
// the rest — mostly legacy players who never applied.
const ISSUE_TEXT = {
  ingame_unlinked: "in-game, no Discord link",
  discord_left: "in-game, left the Discord",
  discord_mismatch: "has a guild role, not in-game",
};

// Shared collapse/expand trigger for the staff-only cards below — closed by
// default (Members.jsx's own toolbar/section counts already summarize what's
// here; these cards are for staff who go looking, not a permanent wall of
// tables above the roster).
export function CollapseToggle({ open, onToggle }) {
  return (
    <button type="button" className="rank-guide-toggle" aria-expanded={open}
      style={{ marginLeft: "auto" }} onClick={onToggle} title="Show or hide the list">
      {open ? "Hide ▾" : "Show ▸"}
    </button>
  );
}

export function UnlinkedSection({ rows, onDone }) {
  const [open, setOpen] = useState(false);
  if (!rows || rows.length === 0) return null;
  return (
    <div className="card unlinked-card" style={{ marginBottom: 14 }}>
      <div className="section-head">
        <h3>❗ Unlinked</h3>
        <span className="pill">{rows.length}</span>
        <CollapseToggle open={open} onToggle={() => setOpen((o) => !o)} />
      </div>
      {open && (
        <table className="table stack">
          <thead>
            <tr><th></th><th>Name</th><th>Issue</th><th>Region</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.kind}:${r.uuid || r.discord_user_id}`}>
                <td className="flag-cell stack-hide" title="Needs linking">❗</td>
                <td className="stack-head">{r.name}</td>
                <td className="muted stack-wide">
                  {ISSUE_TEXT[r.kind] || r.kind}
                </td>
                <td className="muted" data-label="Region">{r.region || "—"}</td>
                <td data-label="Actions">
                  {r.kind === "discord_left" && <UnlinkedUnlinkButton row={r} onDone={onDone} />}
                  {r.kind !== "discord_left" && <UnlinkedLinkButton row={r} onDone={onDone} />}
                  {r.kind === "discord_mismatch" &&
                    <> <UnlinkedOffboardButton row={r} onDone={onDone} /></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Staff-only: offboards still waiting on an in-game kick. Everyone offboarded
// while still in the in-game guild shows here and nowhere else —
// services.players() excludes them from every other section the moment
// offboarding is queued. "Pending kick" means a Regional Manager still needs
// to remove them in-game; the bot notices on its own once they're gone. There
// is no Cancel: a mistaken offboard is fixed by hand.
const OFFBOARD_STATUS_LABEL = { pending_kick: "Pending kick", done: "Offboarded" };

export function OffboardedSection({ rows }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="section-head">
        <h3>📤 Offboarded</h3>
        <span className="pill">{rows.length}</span>
      </div>
      <table className="table stack">
        <thead>
          <tr><th></th><th>Name</th><th>Region</th><th>Status</th><th>Requested</th>
            <th>Confirmed</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="flag-cell stack-hide" title="Offboarded">📤</td>
              <td className="stack-head">{r.name}</td>
              <td className="muted" data-label="Region">{r.region || "—"}</td>
              <td data-label="Status">
                <span className={r.status === "pending_kick" ? "badge warn" : "badge leave"}>
                  {OFFBOARD_STATUS_LABEL[r.status] || r.status}
                </span>
              </td>
              <td className="muted" data-label="Requested">
                {r.requested_by_name ? `${r.requested_by_name} · ` : ""}{timeAgo(r.requested_at)}
              </td>
              <td className="muted" data-label="Confirmed">
                {r.kick_confirmed_at
                  ? `${r.kick_confirmed_by_name ? r.kick_confirmed_by_name + " · " : ""}${timeAgo(r.kick_confirmed_at)}`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
