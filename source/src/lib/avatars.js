import { BASE } from "../lib.js";
/** Player-head avatars, fetched in batches rather than one request each.
 *
 * The obvious design — one <img src="/api/avatar/{uuid}"> per row — is what
 * broke the Members page: it draws ~106 of them, so a single page load fired
 * 106 requests in one burst, sailed past the site's own /api/ rate limit
 * (10r/s, burst 20) and took the page's own data call down with it. The
 * roster failed to load with a 429 while the heads it was waiting on were
 * what had used the budget up.
 *
 * So every PlayerAvatar that mounts drops its UUID into a queue, and one
 * animation frame later the whole queue goes out as a single /api/avatars
 * call. A hundred avatars become one request; a lone avatar on a player card
 * still works without the caller knowing any of this.
 *
 * Results are memoised for the life of the page, so re-renders, filtering and
 * navigating between pages never refetch a head that's already in hand.
 */

const CHUNK = 20;                 // UUIDs per request — see the note in flush()

// The only sizes the backend renders (avatars._SIZES). It snaps anything else
// to the nearest of these, so asking for a size that isn't on the ladder gets
// you a neighbour's pixels under a URL and a cache key of its own: a caller
// passing 20 and one passing 22 were both served the same 22px image, but as
// two separate request groups and two separate browser-cache entries. Snapping
// here instead means one request covers both, and the displayed size stays
// whatever the component was given — this only picks which asset to ask for.
const RENDER_SIZES = [22, 32, 64, 128];

const snapSize = (size) => RENDER_SIZES.reduce(
  (best, s) => (Math.abs(s - size) < Math.abs(best - size) ? s : best), RENDER_SIZES[0]);

const cache = new Map();          // "uuid:size" -> data URI
const inflight = new Map();       // "uuid:size" -> Promise<string | null>
let queue = [];                   // [{ key, uuid, size, resolve }]
let scheduled = false;

const keyOf = (uuid, size) =>
  `${String(uuid).replace(/-/g, "").toLowerCase()}:${snapSize(size)}`;

async function flush() {
  scheduled = false;
  const batch = queue;
  queue = [];
  if (batch.length === 0) return;

  // One call per size. In practice a page uses one or two (22 in tables, 64
  // on cards), so this is one or two requests for the whole screen.
  const bySize = new Map();
  for (const item of batch) {
    if (!bySize.has(item.size)) bySize.set(item.size, []);
    bySize.get(item.size).push(item);
  }

  await Promise.all([...bySize.entries()].map(async ([size, items]) => {
    const uuids = [...new Set(items.map((i) => i.uuid))];
    // Chunked because the whole roster in one query string is a ~3.5KB
    // request line, and nginx's default client_header_buffer_size is 1KB —
    // the full-roster URL came back 414. 20 undashed UUIDs is ~710 chars,
    // comfortably inside it, so the roster costs six requests rather than
    // one. Still nothing next to the ~106 this replaced, and well under the
    // /api/ burst allowance.
    //
    // The chunks go out together, not one after the next. Awaiting them in a
    // loop made the roster's six requests six round trips: measured at ~90ms
    // each, that was ~540ms of heads trickling in for no reason, since none
    // of them depends on any other. The /api/avatars rate-limit tier is
    // already sized for a whole page of heads at once (100r/s, burst 200 —
    // see the foximg zone in ops/nginx/foxweb), so six in parallel is well
    // within what it exists to allow.
    const chunks = [];
    for (let i = 0; i < uuids.length; i += CHUNK) chunks.push(uuids.slice(i, i + CHUNK));
    const responses = await Promise.all(chunks.map(async (slice) => {
      try {
        const res = await fetch(
          `${BASE}/avatars?size=${size}&uuids=${encodeURIComponent(slice.join(","))}`,
          { credentials: "same-origin" });
        return res.ok ? (await res.json()).avatars || {} : {};
      } catch {
        // Network or rate-limit failure: those waiters resolve to null and
        // render nothing rather than a broken image. The next mount retries.
        // Per chunk, so one failed chunk costs its own 20 heads, not the
        // whole page's.
        return {};
      }
    }));
    const found = Object.assign({}, ...responses);
    for (const item of items) {
      const uri = found[item.uuid] || null;
      if (uri) cache.set(item.key, uri);
      inflight.delete(item.key);
      item.resolve(uri);
    }
  }));
}

/** The data URI for one player's head, or null if it couldn't be fetched. */
export function loadAvatar(uuid, size) {
  const key = keyOf(uuid, size);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = inflight.get(key);
  if (pending) return pending;

  // Both taken off `key`, so the request that goes out uses the snapped size
  // that produced it rather than the raw one the caller asked for.
  const [snappedUuid, snappedSize] = key.split(":");
  const promise = new Promise((resolve) => {
    queue.push({ key, uuid: snappedUuid, size: Number(snappedSize), resolve });
  });
  inflight.set(key, promise);
  if (!scheduled) {
    scheduled = true;
    // A frame, because that is the point at which React has finished mounting
    // this render's rows, so the queue holds the whole screen rather than one
    // row's worth.
    //
    // With a timeout behind it, because a frame never comes in a background
    // tab: browsers suspend requestAnimationFrame entirely while
    // document.hidden is true, so a page opened with cmd-click, restored with
    // a session, or simply loaded behind another window queued every avatar
    // and then sat on placeholder squares until it was focused. Confirmed in
    // Chrome against the live site: document.hidden true, rAF did not fire
    // within 1.5s, all 106 heads unrendered with no request sent.
    //
    // Whichever fires first wins and the other is a no-op — flush() clears
    // `scheduled` and takes the queue on entry, so a second call finds it
    // empty and returns. 50ms is long enough to still batch a whole screen
    // when the frame is merely slow, and short enough not to be noticed.
    requestAnimationFrame(flush);
    setTimeout(flush, 50);
  }
  return promise;
}
