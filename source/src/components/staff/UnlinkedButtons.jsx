import { useState } from "react";
import { Spinner } from "../../ui.jsx";
import { Modal } from "../Modal.jsx";
import { OffboardModal } from "./OffboardModal.jsx";
import { smallBtn, useAction } from "./actions.js";

/** Unlink button for a "left the Discord · still in-game" Unlinked-card row:
 * the member record points at a Discord account that's no longer in the
 * server, so the one sensible website action is removing that stale record
 * (queued as the same unlink web_action the row menu uses). The player then
 * shows as "in-game, no Discord link", ready for a fresh Link — or an
 * in-game removal. */
export function UnlinkedUnlinkButton({ row, onDone }) {
  const [open, setOpen] = useState(false);
  const { busy, note, run } = useAction(onDone);

  return (
    <>
      <button className="btn danger" style={smallBtn} disabled={busy}
        onClick={() => setOpen(true)} title="Remove the stale Discord link">
        🔗 Unlink
      </button>
      {busy && <Spinner />}
      {note && (
        <div className={note.ok ? "muted" : "error"}
          style={{ fontSize: 12, marginTop: 4, maxWidth: 220 }}>
          {note.text}
        </div>
      )}
      {open && (
        <Modal title={`🔗 Unlink ${row.name || "member"}?`}
          onClose={() => setOpen(false)}>
          <p className="muted" style={{ marginTop: 0 }}>
            <b>{row.name}</b> is still in the in-game guild, but their linked
            Discord account (<code>{row.discord_user_id}</code>) has left the
            server. Unlinking removes that stale member record — they'll then
            show here as “in-game, no Discord link”, ready to be relinked to
            a new account or removed in-game.
          </p>
          <button className="btn danger" onClick={() => {
            setOpen(false);
            run({ kind: "unlink", target_discord_id: row.discord_user_id });
          }}>
            Confirm unlink
          </button>
          <button className="btn" style={{ marginLeft: 8 }}
            onClick={() => setOpen(false)}>
            Cancel
          </button>
        </Modal>
      )}
    </>
  );
}

/** Link button for an Unlinked-card row. Nothing is linked yet on either
 * kind, so there's no Unlink half here — just:
 *  - discord_mismatch: the Discord account is already known (row.discord_user_id);
 *    staff only need to type the IGN.
 *  - ingame_unlinked: the IGN/UUID is already known (row.name); staff need to
 *    supply the Discord account instead — typed by ID (right-click a member in
 *    Discord → Copy User ID, with Developer Mode on), matching this project's
 *    typed-input-over-dropdown convention. */
export function UnlinkedLinkButton({ row, onDone }) {
  const [open, setOpen] = useState(false);
  const [ign, setIgn] = useState(row.kind === "ingame_unlinked" ? (row.name || "") : "");
  const [discordId, setDiscordId] = useState("");
  const { busy, note, run } = useAction(onDone);

  const needsDiscordId = row.kind === "ingame_unlinked";
  const targetId = needsDiscordId ? discordId.replace(/\D/g, "") : row.discord_user_id;
  const canSubmit = ign.trim() && targetId;

  return (
    <>
      <button className="btn" style={smallBtn} disabled={busy}
        onClick={() => setOpen(true)} title="Link their Wynncraft account">
        🔗 Link
      </button>
      {busy && <Spinner />}
      {note && (
        <div className={note.ok ? "muted" : "error"}
          style={{ fontSize: 12, marginTop: 4, maxWidth: 220 }}>
          {note.text}
        </div>
      )}
      {open && (
        <Modal title={`🔗 Link ${row.name || "member"}`} onClose={() => setOpen(false)}>
          <p className="muted" style={{ marginTop: 0 }}>
            {needsDiscordId
              ? "This Wynncraft account has no Discord link. Paste the Discord user ID it belongs to (Developer Mode → right-click the member → Copy User ID)."
              : "This Discord account holds a guild role but has no Wynncraft link. Type their exact IGN."}
          </p>
          <form onSubmit={(e) => {
            e.preventDefault();
            setOpen(false);
            run({ kind: "link", target_discord_id: targetId, ign: ign.trim() });
          }}>
            {needsDiscordId && (
              <div style={{ marginBottom: 8 }}>
                <input className="text" autoFocus inputMode="numeric" maxLength={20}
                  placeholder="Discord user ID (numeric)" value={discordId}
                  onChange={(e) => setDiscordId(e.target.value)} />
              </div>
            )}
            <input className="text" autoFocus={!needsDiscordId} value={ign} maxLength={64}
              placeholder="Exact Wynncraft IGN"
              onChange={(e) => setIgn(e.target.value)} />
            <button className="btn" type="submit" style={{ marginLeft: 8 }}
              disabled={!canSubmit}>Link</button>
          </form>
        </Modal>
      )}
    </>
  );
}

/** Offboard button for a "has a guild role · not in-game" Unlinked-card row:
 * they hold a Discord guild role but the bot has never seen them in-game (a
 * legacy record, or a link that's simply wrong — anyone it *has* seen leave
 * is offboarded automatically), so staff can offboard straight from here
 * instead of finding them in the main roster. Sits alongside the row's Link
 * button — fixing the link may be the real answer. Same OffboardModal the
 * Staff Actions bar uses. */
export function UnlinkedOffboardButton({ row, onDone }) {
  const [open, setOpen] = useState(false);
  const { busy, note, run } = useAction(onDone);

  return (
    <>
      <button className="btn danger" style={smallBtn} disabled={busy}
        onClick={() => setOpen(true)} title="Offboard this member">
        📤 Offboard
      </button>
      {!open && note && (
        <div className={note.ok ? "muted" : "error"}
          style={{ fontSize: 12, marginTop: 4, maxWidth: 220 }}>
          {note.text}
        </div>
      )}
      {open && (
        <OffboardModal player={row} onClose={() => setOpen(false)}
          busy={busy} note={note} onQueue={run} />
      )}
    </>
  );
}
