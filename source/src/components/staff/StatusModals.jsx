import { useEffect, useState } from "react";
import { api, formatDate } from "../../lib.js";
import { Spinner } from "../../ui.jsx";
import { Modal } from "../Modal.jsx";
import { smallBtn } from "./actions.js";

/** Mark a member On Leave (with a required reason), or remove the current
 * status. Unlike the queue actions this is a direct bot.db write (no Discord
 * side effect), so the result shows on the next refetch — no bot round-trip
 * to poll. onDone fires only after a successful write; stays open afterward
 * (like Warn/Promote) so the confirmation shows in place rather than the
 * modal vanishing before staff see it — closing without acting just calls
 * onClose.
 *
 * Shares member_status with Warn (one current value — setting either
 * replaces the other), so a member currently flagged Warned gets a note here
 * too rather than silently clobbering that badge. */
export function OnLeaveModal({ player, onClose, onDone }) {
  const [reason, setReason] = useState(
    player.status === "on_leave" ? (player.status_reason || "") : "");
  const [until, setUntil] = useState(
    player.status === "on_leave" ? (player.status_until || "").slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [done, setDone] = useState(null);
  const [history, setHistory] = useState({ loading: true, rows: [], error: null });

  // Whether an absence is a pattern or a one-off is the actual question when
  // staff open this modal, and member_status can't answer it — it holds one
  // current value. leaves_state keeps every past leave; this shows them.
  const loadHistory = () => {
    api.playerLeaves(player.discord_user_id)
      .then((d) => setHistory({ loading: false, rows: d.leaves || [], error: null }))
      .catch((e) => setHistory({ loading: false, rows: [], error: String(e.message || e) }));
  };
  useEffect(loadHistory, [player.discord_user_id]);

  const run = async (fn, doneText) => {
    setBusy(true); setErr(null); setDone(null);
    try {
      await fn();
      await onDone();
      loadHistory();
      setDone(doneText);
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`🌴 ${player.name || "Member"} — On Leave`} onClose={onClose}>
      {player.status && (
        <p className="muted" style={{ marginTop: 0 }}>
          {player.status === "on_leave" ? (
            <>
              Currently on leave
              {player.status_until && <> until <b>{formatDate(player.status_until)}</b></>}
              {player.status_reason && <> — “{player.status_reason}”</>}
              {player.status_by &&
                <> (set by {player.status_by}
                  {player.status_at ? `, ${formatDate(player.status_at)}` : ""})</>}.
            </>
          ) : (
            <>
              Currently flagged <b>Warned</b>
              {player.status_reason && <> — “{player.status_reason}”</>}.
              Marking On Leave replaces that badge (their warning history is kept).
            </>
          )} Submitting again replaces the current status.
        </p>
      )}
      <form onSubmit={(e) => {
        e.preventDefault();
        run(() => api.playerStatusSet(player.discord_user_id, "on_leave",
          reason.trim(), until), "✅ Marked On Leave.");
      }}>
        <div style={{ marginBottom: 8 }}>
          <label className="muted" style={{ fontSize: 12, marginRight: 8 }}>
            Auto-clears on (optional):
          </label>
          <input className="text" type="date" value={until}
            style={{ minWidth: 0 }}
            min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
            onChange={(e) => setUntil(e.target.value)} />
        </div>
        <div>
          <input className="text" autoFocus value={reason} maxLength={300}
            placeholder="Reason (shown to staff only)"
            onChange={(e) => setReason(e.target.value)} />
          <button className="btn danger" type="submit" style={{ marginLeft: 8 }}
            disabled={busy || !reason.trim()}>
            {busy ? "…" : "Mark On Leave"}
          </button>
        </div>
      </form>
      {player.status === "on_leave" && (
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 14,
                      paddingTop: 12 }}>
          <button className="btn" disabled={busy}
            onClick={() => run(() => api.playerStatusClear(player.discord_user_id),
              "✅ Removed On Leave status.")}>
            Remove On Leave
          </button>
        </div>
      )}
      {err && (
        <div className="error" style={{ marginTop: 10, fontSize: 12 }}>{err}</div>
      )}
      {done && (
        <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>{done}</div>
      )}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 12 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Leave history ({history.rows.length})
        </div>
        {history.loading && <Spinner />}
        {history.error && <div className="error" style={{ fontSize: 12 }}>{history.error}</div>}
        {!history.loading && !history.error && history.rows.length === 0 && (
          <div className="muted">No leave on file.</div>
        )}
        {history.rows.map((l) => (
          <div key={l.id} style={{ marginBottom: 8, fontSize: 13 }}>
            <div>
              {l.reason || <span className="muted">no reason recorded</span>}
              {!l.ended_at && (
                <span className="badge leave" style={{ marginLeft: 8 }}>ongoing</span>
              )}
            </div>
            <div className="muted" style={{ fontSize: 11 }}>
              {formatDate(l.started_at)}
              {l.ended_at ? <> → {formatDate(l.ended_at)}</>
                          : l.until && <> → due back {formatDate(l.until)}</>}
              {l.set_by_name && <> · by {l.set_by_name}</>}
              {l.ended_reason === "expired" && <> · ended automatically</>}
              {l.ended_reason === "replaced" && <> · superseded</>}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Warn a member (reason required) and browse their permanent warning
 * history. Unlike On Leave, warnings are never overwritten — each submit
 * appends a new record (warnings_state on the backend) in addition to
 * setting the live "warned" badge on member_status, which behaves exactly
 * like today's On Leave/Warned status (one current value, clearable
 * independently of the history below it). */
export function WarnModal({ player, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [history, setHistory] = useState({ loading: true, rows: [], error: null });

  const loadHistory = () => {
    api.playerWarnings(player.discord_user_id)
      .then((d) => setHistory({ loading: false, rows: d.warnings || [], error: null }))
      .catch((e) => setHistory({ loading: false, rows: [], error: String(e.message || e) }));
  };
  useEffect(loadHistory, [player.discord_user_id]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await api.playerWarn(player.discord_user_id, reason.trim());
      setReason("");
      loadHistory();
      await onDone();
    } catch (e2) {
      setErr(String(e2.message || e2));
    } finally {
      setBusy(false);
    }
  };

  const clearBadge = async () => {
    setBusy(true); setErr(null);
    try {
      await api.playerStatusClear(player.discord_user_id);
      await onDone();
    } catch (e2) {
      setErr(String(e2.message || e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`⚠️ ${player.name || "Member"} — Warn`} onClose={onClose}>
      <form onSubmit={submit} style={{ marginBottom: 12 }}>
        <input className="text" autoFocus value={reason} maxLength={300}
          placeholder="Reason for this warning"
          onChange={(e) => setReason(e.target.value)} />
        <button className="btn danger" type="submit" style={{ marginLeft: 8 }}
          disabled={busy || !reason.trim()}>
          {busy ? "…" : "Add warning"}
        </button>
      </form>
      {err && <div className="error" style={{ marginBottom: 10, fontSize: 12 }}>{err}</div>}
      {player.status === "warned" && (
        <div style={{ marginBottom: 14 }}>
          <span className="badge warn" style={{ marginRight: 8 }}>warned</span>
          <button className="btn" style={smallBtn} disabled={busy} onClick={clearBadge}>
            Remove warned badge
          </button>
        </div>
      )}
      <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
          Warning history ({history.rows.length})
        </div>
        {history.loading && <Spinner />}
        {history.error && <div className="error" style={{ fontSize: 12 }}>{history.error}</div>}
        {!history.loading && !history.error && history.rows.length === 0 && (
          <div className="muted">No warnings on file.</div>
        )}
        {history.rows.map((w) => (
          <div key={w.id} style={{ marginBottom: 8, fontSize: 13 }}>
            <div>{w.reason}</div>
            <div className="muted" style={{ fontSize: 11 }}>
              {w.warned_by_name && <>by {w.warned_by_name} · </>}{formatDate(w.warned_at)}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
