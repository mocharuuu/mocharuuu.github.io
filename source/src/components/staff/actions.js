import { useState } from "react";
import { api } from "../../lib.js";

// Staff-only per-player actions on the /players roster. The website has no
// Discord access of its own: POST /players/actions only queues a row in
// bot.db, the bot's webactions loop executes it (roles/nicknames/DB), writes
// a plain-text result back, and we poll for that here — a request-don't-
// perform model, with per-action feedback.

const POLL_MS = 2000;
const TIMEOUT_MS = 45000;

// After "done": the bot has already asked its roster sync to run early; give
// it a beat to land before refetching.
const RESYNC_WAIT_MS = 6000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function runPlayerAction(body) {
  const { action_id } = await api.playerActionCreate(body);
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    const st = await api.playerActionStatus(action_id);
    if (st.status === "done") return st.result || "Done.";
    if (st.status === "error") throw new Error(st.result || "action failed");
  }
  throw new Error("still queued — the bot may be offline; check Discord");
}

/** Small shared runner state for one action button: busy → ok/err note. */
export function useAction(onDone) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(null);   // {ok, text}

  const run = async (body) => {
    setBusy(true); setNote(null);
    try {
      const result = await runPlayerAction(body);
      setNote({ ok: true, text: result });
      await sleep(RESYNC_WAIT_MS);
      await onDone();
    } catch (e) {
      setNote({ ok: false, text: String(e.message || e) });
    } finally {
      setBusy(false);
    }
  };
  // Direct bot.db writes (no Discord side effect) skip runPlayerAction
  // entirely — there's no bot round-trip to poll for, so no RESYNC_WAIT_MS
  // either; `okText` is supplied by the caller since there's no bot-authored
  // result string to show instead.
  const runDirect = async (fn, okText) => {
    setBusy(true); setNote(null);
    try {
      await fn();
      setNote({ ok: true, text: okText });
      await onDone();
    } catch (e) {
      setNote({ ok: false, text: String(e.message || e) });
    } finally {
      setBusy(false);
    }
  };
  return { busy, note, run, runDirect, setNote };
}

export const smallBtn = { padding: "3px 9px", fontSize: 12 };
