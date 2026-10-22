import { useState } from "react";
import { createPortal } from "react-dom";
import { Spinner } from "../../ui.jsx";
import { ApplicationModal } from "./ApplicationModal.jsx";
import { OffboardModal } from "./OffboardModal.jsx";
import { OnLeaveModal, WarnModal } from "./StatusModals.jsx";
import { PromoteModal } from "./PromoteModal.jsx";
import { useAction } from "./actions.js";

/** The five staff actions previously reached from each card/row's "⋯" menu
 * (Promote used to be its own per-row control on the title itself — see
 * PromoteModal), now standout buttons at the top of the page: click one to
 * "arm" it, then click any member's card or row anywhere on the page (the
 * roster grid, the Up for Removal card, …) to run it on them — no separate
 * search step. See useStaffActionState below for how that arm/pick state is
 * shared with the rest of the page.
 *
 * `disabled(m)` mirrors the server-side guards (offboard/status refuse staff
 * targets; promote only accepts Page → Sir/Madam/Knight, same as
 * services.validate_player_action). Members.jsx uses the same function two
 * ways while an action is armed: a click on a matching-but-disabled target
 * shows its reason instead of failing after the click, and every disabled
 * target is hidden from the grid outright rather than left there to click
 * (see hideIneligible) — so arming On Leave/Warn/Offboard, say, quietly
 * drops every staff member from view instead of each one being a dead end.
 *
 * `variant` + `groupBreak` are purely visual: View Application/Promote read
 * as the "look something up / move someone forward" half (Promote picks up
 * the same green .btn.success the recruit-class action already uses for
 * "the positive one"); On Leave/Warn/Offboard are the "flag or remove a
 * member" half, split off by a thin divider, with Offboard — the one action
 * here with no cancel-from-here undo path — in .btn.danger red. On Leave and
 * Warn stay the plain default: both are reversible status flags, not
 * destructive, so red would overstate them. */
const ACTIONS = [
  // "Application", not "View Application" — the longest label in the row
  // was the single biggest thing standing between five buttons and one
  // clean line; the 📄 plus the "Staff Actions" heading above already say
  // what it's for. `toastVerb` fills in the armed-toast sentence ("Click a
  // member's card or row to <toastVerb>."); most actions read fine as
  // "<label> them" (see ArmedToast's fallback below) so only the two that
  // don't — a noun ("Application") and a status you set rather than do
  // ("On Leave") — need an explicit override.
  { key: "app",      emoji: "📄", label: "Application", toastVerb: "view their Application" },
  // Arming this also flips on each card's promotion-date line and hides
  // every non-promotable member from the grid — see Members.jsx's
  // showPromotionsOn/hideIneligible, both driven off this action's own
  // `disabled` below rather than a separate "Promotion dates" toggle.
  { key: "promote",  emoji: "⬆️", label: "Promote", variant: "success",
    disabled: (m) => m.staff ? "Staff can't be targeted from the site"
      : !m.promote_to && "Nobility+ is a manual rank bump — can't be promoted here" },
  { key: "leave",    emoji: "🌴", label: "On Leave", groupBreak: true, toastVerb: "mark them On Leave",
    disabled: (m) => m.staff && "Staff can't be targeted from the site" },
  { key: "warn",     emoji: "⚠️", label: "Warn",
    disabled: (m) => m.staff && "Staff can't be targeted from the site" },
  { key: "offboard", emoji: "📤", label: "Offboard", variant: "danger",
    disabled: (m) => m.staff && "Staff can't be targeted from the site" },
];

/** Shared "which action is armed, and who's it for" state — created once by
 * the page (Members.jsx) so both this bar (which arms an action) and the
 * page's own member cards/rows (which, via their existing onSelect, supply
 * the target while one is armed) can read and write the same state.
 *
 * Two distinct ways out, not one: `close` fully disarms (action AND player
 * both cleared) — wired only to the armed toast's own Cancel button, the one
 * explicit "stop doing this" control. `deselect` clears just the picked
 * target, dropping back to the toast with the action still armed, ready for
 * the next member — wired to every per-member modal's own Close/Cancel, so
 * finishing (or backing out of) one member's Warn/Application/Offboard/…
 * doesn't force staff to re-arm the button for the next one. */
export function useStaffActionState() {
  const [action, setAction] = useState(null);    // one of ACTIONS, or null
  const [player, setPlayer] = useState(null);     // chosen target, or null = still picking
  const [blocked, setBlocked] = useState(null);   // disabled(m) reason from the last blocked pick
  const close = () => { setAction(null); setPlayer(null); setBlocked(null); };
  const deselect = () => { setPlayer(null); setBlocked(null); };
  return { action, setAction, player, setPlayer, blocked, setBlocked, close, deselect };
}

/** Fixed toast telling staff an action is armed, with a Cancel out — one
 * unchanging banner for the whole armed lifetime (see useStaffActionState's
 * close/deselect split above: picking a member never disarms it, only
 * Cancel does), not a per-pick message that swaps text each time a member is
 * selected — that made the toast itself re-flow on every single pick, on top
 * of the roster grid doing the same (see Members.jsx's hideIneligible). Its
 * z-index sits above the per-member modal's own (see theme.css) so it stays
 * visible and Cancel stays reachable even with a modal open on top. Portaled
 * to <body> for the same reason Modal is (see its comment) — position:fixed
 * only escapes an ancestor's hover-transform containing block from outside
 * the DOM subtree that transform applies to. Anchored to the viewport bottom
 * rather than stacked under the sticky nav: the nav's own height varies
 * (wraps to more rows depending on session/viewport), so a bottom-anchored
 * toast sidesteps needing to know it and stays visible however far staff
 * scroll to find their target. */
function ArmedToast({ action, blocked, onCancel }) {
  return createPortal(
    <div className={"staff-action-toast" + (action.variant === "danger" ? " danger" : "")}>
      <span className="staff-action-toast-msg">{action.emoji} Click a member's card or row to <b>{action.toastVerb || `${action.label} them`}</b>.</span>
      {blocked && <span className="staff-action-toast-blocked">— {blocked}</span>}
      <button type="button" className="btn staff-action-toast-cancel" onClick={onCancel}>Cancel</button>
    </div>,
    document.body,
  );
}

/** `filters`: staff-only view filters (Trial Members, Up for Removal, …)
 * that narrow the roster below rather than acting on a target — Members.jsx
 * owns their state (each is `{ key, emoji, label, on, title, onToggle }`)
 * since that's where the filtering itself happens; this bar renders them
 * chip-shaped at the end of the same row as the five actions (split off by
 * a divider, no label — the shape alone says "filter"), so every staff-only
 * control lives in one place instead of some sitting in the page toolbar
 * and some up here. ("Promotion dates" used to be a filter here too — it's
 * merged into the Promote button itself now, see Members.jsx's
 * showPromotionsOn.) */
export default function StaffActionBar({ onDone, state, filters = [] }) {
  const { action, setAction, player, blocked, close, deselect } = state;
  // Offboard alone queues a web_action for the bot (see runPlayerAction); On
  // Leave/Warn/View Application never touch this — they're either direct
  // bot.db writes or (View Application) pure reads. OffboardModal stays open
  // through the queue/poll cycle (same as every other action modal — only an
  // explicit Close/Cancel dismisses it), so busy/note are handed down into it
  // to render in place rather than only surfacing here underneath it.
  const { busy, note, run: queueOffboard } = useAction(onDone);

  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="section-head">
        <h3>Staff Actions</h3>
      </div>
      <div className="staff-action-row">
        {ACTIONS.map((a) => (
          <span key={a.key} className="staff-action-item">
            {a.groupBreak && <span className="staff-action-divider" aria-hidden="true" />}
            <button type="button" title={a.label}
              className={(a.variant ? `btn ${a.variant} staff-action-btn` : "btn staff-action-btn")
                + (action?.key === a.key ? " staff-action-armed-btn" : "")}
              onClick={() => setAction(action?.key === a.key ? null : a)}>
              {a.emoji} <span className="staff-action-label">{a.label}</span>
            </button>
          </span>
        ))}
        {/* Filters share the actions' row rather than getting their own —
            just a divider (the same pipe that splits the actions themselves
            into two groups) to mark the shift from "acts on whoever I click
            next" to "narrows what's shown", no label needed. Chip-shaped
            (outlined pill, same look the page's own search/region/online
            toolbar chips use below) rather than solid .btn fills keeps that
            distinction visible even without one. */}
        {filters.length > 0 && <span className="staff-action-divider" aria-hidden="true" />}
        {filters.map((f) => (
          <button key={f.key} type="button" title={f.title}
            className={"staff-filter-chip" + (f.on ? " on" : "")}
            onClick={f.onToggle}>
            {f.emoji} <span className="staff-action-label">{f.label}</span>
          </button>
        ))}
        {busy && <Spinner />}
      </div>
      {note && (
        <div className={note.ok ? "muted" : "error"} style={{ fontSize: 12, marginTop: 6 }}>
          {note.text}
        </div>
      )}

      {action && (
        <ArmedToast action={action} blocked={blocked} onCancel={close} />
      )}
      {action?.key === "app" && player &&
        <ApplicationModal player={player} onClose={deselect} />}
      {action?.key === "offboard" && player && (
        <OffboardModal player={player} onClose={deselect}
          busy={busy} note={note} onQueue={queueOffboard} />
      )}
      {action?.key === "leave" && player && (
        <OnLeaveModal player={player} onClose={deselect} onDone={onDone} />
      )}
      {action?.key === "warn" && player &&
        <WarnModal player={player} onClose={deselect} onDone={onDone} />}
      {action?.key === "promote" && player &&
        <PromoteModal player={player} onClose={deselect} onDone={onDone} />}
    </div>
  );
}
