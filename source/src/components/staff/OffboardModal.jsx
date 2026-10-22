import { useState } from "react";
import { Spinner } from "../../ui.jsx";
import { Modal } from "../Modal.jsx";

const OPTIONS = [
  {
    mode: "townsperson",
    label: "Make Townsperson",
    help: "Stays in the Discord as a community member.",
  },
  {
    mode: "all_roles",
    label: "Remove all roles",
    help: "Takes every role and resets their nickname.",
  },
];

/** Offboard confirm modal, shared by the roster's Staff Actions bar and the
 * Unlinked card's Offboard button. Staff pick Townsperson (a reason is
 * required) or Remove all roles. Stays open through the queue/poll cycle
 * (like every other action modal) instead of closing the instant it's
 * confirmed — busy/note come from the caller's own useAction so the result
 * shows in place. */
export function OffboardModal({ player, onClose, onQueue, busy, note }) {
  const [mode, setMode] = useState("townsperson");
  const [reason, setReason] = useState("");
  const needsReason = mode === "townsperson";
  // A failed attempt can be retried; a successful one is final.
  const done = !!note?.ok;
  const canConfirm = !busy && !done && (!needsReason || reason.trim());

  return (
    <Modal title={`📤 Offboard ${player.name || "member"}?`} onClose={onClose}>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!canConfirm) return;
        onQueue({ kind: "offboard", target_discord_id: player.discord_user_id,
                  mode, reason: needsReason ? reason.trim() : "" });
      }}>
        <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
          {OPTIONS.map((o) => (
            <label key={o.mode} className="card"
              style={{ display: "flex", gap: 10, padding: 10, margin: 0, cursor: "pointer",
                       borderColor: mode === o.mode ? "var(--orange)" : undefined }}>
              <input type="radio" name="offboard-mode" id={`offboard-mode-${o.mode}`}
                value={o.mode} checked={mode === o.mode} disabled={busy || done}
                onChange={() => setMode(o.mode)} style={{ marginTop: 3 }} />
              <span>
                <b>{o.label}</b>
                <span className="muted" style={{ display: "block", fontSize: 12 }}>{o.help}</span>
                {o.mode === "townsperson" && mode === "townsperson" && (
                  <input className="text" id="offboard-reason" autoFocus value={reason}
                    maxLength={300} disabled={busy || done}
                    placeholder="Reason"
                    style={{ marginTop: 8, width: "100%", minWidth: 0 }}
                    onChange={(e) => setReason(e.target.value)} />
                )}
              </span>
            </label>
          ))}
        </div>
        <button className="btn danger" type="submit" disabled={!canConfirm}>
          {busy ? "…" : "Offboard"}
        </button>
        <button className="btn" type="button" style={{ marginLeft: 8 }} onClick={onClose}>
          {done ? "Close" : "Cancel"}
        </button>
        {busy && <Spinner />}
      </form>
      {note && (
        <div className={note.ok ? "muted" : "error"} style={{ fontSize: 12, marginTop: 10 }}>
          {note.text}
        </div>
      )}
    </Modal>
  );
}
