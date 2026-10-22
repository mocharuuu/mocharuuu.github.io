import { useEffect, useState } from "react";
import { api, formatDate, formatDateTime } from "../../lib.js";
import { Spinner } from "../../ui.jsx";
import { Modal } from "../Modal.jsx";
import { useAction } from "./actions.js";

/** Promote — reached from the page-top StaffActionBar (search for a member,
 * same as View Application/Offboard/On Leave/Warn), rather than a per-row
 * control: Baron+ and Lord/Lady/Liege members are disabled in that search
 * (see StaffActionBar's ACTIONS[…].disabled), so this only ever really opens
 * for a member on a promotable tier (Page → Sir/Madam/Knight) — the same
 * next-tier ladder the bot used to offer via right-click, and the same
 * application-suggested-title lookup and confirmation copy. Still handles a
 * non-promotable target gracefully (a stale search result opened just as a
 * promotion landed elsewhere) rather than assuming the picker always caught
 * it. Stays open after promoting (like OnLeaveModal/WarnModal) so the result
 * shows in place instead of the modal vanishing on click. */
export function PromoteModal({ player, onClose, onDone }) {
  const [suggested, setSuggested] = useState(null);
  const { busy, note, run } = useAction(onDone);
  // Both come from the backend (services.promotion_options and the
  // application's suggested_title), so the ladder lives in foxshared/titles.py
  // alone. promote_to is null when the member can't be promoted from here.
  const options = player.promote_to;
  const hasVariants = (options?.length ?? 0) > 1;

  useEffect(() => {
    if (!hasVariants) return;   // not promotable, or Page→Squire has no variant to suggest
    api.playerApplication(player.discord_user_id)
      .then((d) => setSuggested(d?.suggested_title ?? null))
      .catch(() => {});   // no application on file — just leaves it unhighlighted
  }, [player.discord_user_id, hasVariants]);

  const promote = (toTitle) => {
    run({ kind: "promote", target_discord_id: player.discord_user_id, to_title: toTitle });
  };

  return (
    <Modal title={`⬆️ Promote ${player.name || "member"}`} onClose={onClose}>
      {player.last_promoted_at && (
        <p className="muted" style={{ marginTop: 0, fontSize: 12 }}
          title={formatDateTime(player.last_promoted_at)}>
          Last promoted {formatDate(player.last_promoted_at)}.
        </p>
      )}
      {options ? (player.tier === 0 ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Page → <b>Squire</b> swaps their trial (Page) role for the
            Gentry role and renames them <b>Squire {player.name}</b>.
          </p>
          <button className="btn" disabled={busy} onClick={() => promote("Squire")}>
            Promote to Squire
          </button>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            Current title: <b>{player.title}</b>. Pick the new title —
            the rename is applied immediately.
            {player.tier === 2 &&
              " Reaching Lord/Lady/Liege also grants the Landed-Gentry role."}
            {suggested &&
              <> Suggested from their application: <b>{suggested}</b>.</>}
          </p>
          <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
            {options.map((t) => (
              <button key={t} className="btn" disabled={busy} onClick={() => promote(t)}
                style={t === suggested
                  ? { boxShadow: "0 0 0 2px var(--gold)" } : undefined}>
                {t === suggested ? `★ ${t}` : t}
              </button>
            ))}
          </span>
        </>
      )) : (
        <p className="muted" style={{ marginTop: 0 }}>
          {player.title || "This member"} can't be promoted from here —
          Nobility+ is a manual rank bump.
        </p>
      )}
      {busy && <Spinner />}
      {note && (
        <div className={note.ok ? "muted" : "error"} style={{ fontSize: 12, marginTop: 8 }}>
          {note.text}
        </div>
      )}
    </Modal>
  );
}
