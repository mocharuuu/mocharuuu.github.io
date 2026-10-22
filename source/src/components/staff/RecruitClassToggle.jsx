import { api } from "../../lib.js";
import { Spinner } from "../../ui.jsx";
import { smallBtn, useAction } from "./actions.js";

/** Trial Member only — a one-click toggle (no modal, no confirmation; it's
 * reversible and purely informational, see recruit-class docs in
 * botdb.py/api.py) for whether a recruit's onboarding class is done. This was
 * one item in the old per-row "⋯" menu; View Application/Offboard/On Leave/
 * Warn moved to the page-top StaffActionBar, which left this as the only
 * thing still worth a per-row control, so it's now its own small inline
 * button instead of a dropdown.
 *
 * Labelled as an imperative action, not a status — "🎓 Class complete" sat on
 * a still-pending card read as if it were already describing that card's
 * state, not something to click. "Mark class complete" / "Revert to
 * pending" both read as instructions regardless of which one currently shows.
 * Green success styling marks "Revert to pending" (undoing a mistaken
 * completion is the action worth flagging); "Mark class complete" stays a
 * plain button. */
export function RecruitClassToggle({ player, onDone }) {
  const { busy, note, runDirect } = useAction(onDone);
  if (player.section !== "Trial Member") return null;
  const complete = player.recruit_class_complete;

  return (
    <span>
      <button type="button" className={complete ? "btn success" : "btn"} style={smallBtn} disabled={busy}
        title={complete
          ? "Revert — this recruit's onboarding class is currently marked complete"
          : "Mark this recruit's onboarding class as complete"}
        onClick={() => runDirect(
          () => complete ? api.recruitClassClear(player.discord_user_id)
                        : api.recruitClassSet(player.discord_user_id),
          complete ? "Marked class pending." : "Marked class complete.")}>
        {complete ? "↩️ Revert to pending" : "✅ Mark class complete"}
      </button>
      {busy && <Spinner />}
      {note && (
        <div className={note.ok ? "muted" : "error"}
          style={{ fontSize: 12, marginTop: 4, maxWidth: 220 }}>
          {note.text}
        </div>
      )}
    </span>
  );
}
