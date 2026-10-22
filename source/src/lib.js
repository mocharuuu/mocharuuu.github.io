import { useEffect, useRef, useState } from "react";

// Standalone GitHub Pages build: there is no local backend to proxy to, so
// /api is absolute against the live site. Cross-origin, so no session cookie
// travels with these requests — every response is the logged-out public one.
export const BASE = "https://kingdomfoxes.com/api";

export const DISCORD_INVITE_URL = "https://discord.gg/kingdomfoxes";

// Minecraft UUIDs show up dashed from some endpoints and undashed from
// others (or mixed case) — normalize before using one as a Map key so a
// roster/leaderboard join never misses just because the two sides formatted
// the same uuid differently.
export const uuidKey = (u) => (u || "").replace(/-/g, "").toLowerCase();

// Shared between /ranks and /players so both pages color the same rank
// category identically.
export const RANK_COLORS = {
  Royalty: "#ffcc00",
  Viceroyalty: "#ff9a19",
  Viceroy: "#ff9a19",
  "House Everton": "#ffcc00",
  "High Nobility": "#4dd6ec",
  Nobility: "#0eacb4",
  "Prime Minister": "#8e77cc",
  "Landed Gentry": "#5a84d4",
  Gentry: "#5a84d4",
  "Trial Member": "#5a84d4",
};

// Per-title overrides for a member's rendered *name* color, distinct from
// their section's accent (RANK_COLORS). A Viceroy stays grouped under House
// Everton for everything else — ladder, border, title-text color — but reads
// orange rather than the section's yellow, to set them apart within that
// group. Add further entries here if another title ever needs the same
// treatment.
const TITLE_NAME_COLORS = { Viceroy: RANK_COLORS.Viceroy };

// `title` is the member's Fox title (m.title / p.title); `fallback` is
// whatever color the name would otherwise use (usually the section's accent).
export function nameColor(title, fallback) {
  return TITLE_NAME_COLORS[title] || fallback;
}

// Tiny client-side TTL cache so hopping between tabs reuses responses instead
// of refetching — matches the backend's 30s Cache-Control window.
const TTL_MS = 60_000;
const _cache = new Map();

async function readError(r) {
  try {
    const body = await r.json();
    if (Array.isArray(body?.detail)) return body.detail.map((item) => item.msg || "Invalid input").join("; ");
    if (body && body.detail) return String(body.detail);
    if (body?.error?.message) return `${body.error.code}: ${body.error.message}`;
  } catch { /* not JSON */ }
  return `request failed (${r.status})`;
}

// A stalled request must not hang forever — useFetch's polling schedules its
// next tick only once the current one settles, so an unbounded fetch would
// silently stop all future polling for that mount, not just delay one tick.
const FETCH_TIMEOUT_MS = 20_000;

async function getJSON(path, { fresh = false, timeoutMs = FETCH_TIMEOUT_MS } = {}) {
  if (!fresh) {
    const hit = _cache.get(path);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
  }
  const r = await fetch(BASE + path,
    { ...(fresh ? { cache: "no-store" } : {}), signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(await readError(r));
  const data = await r.json();
  if (!fresh) _cache.set(path, { at: Date.now(), data });
  return data;
}

async function sendJSON(path, method, body) {
  // The custom header doubles as the CSRF token the backend requires —
  // cross-site forms can't set it, so a stolen click can't distribute.
  const r = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", "X-Fox-Csrf": "1" },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

const postJSON = (path, body) => sendJSON(path, "POST", body);
let _authMeInFlight = null;

export const api = {
  // Fresh, not cached: these auto-refresh on a timer (see useFetch's
  // pollMs), so a stale client-side copy would defeat the point of polling.
  summary: () => getJSON("/summary", { fresh: true }),
  // Home-page level/progress widget — level + xpPercent change slowly, but
  // fresh keeps it in step with summary()'s own polling on the same page.
  guildProgress: () => getJSON("/guild-progress", { fresh: true }),
  // Every metric for every member in one row-per-player payload — the
  // combined board, and the Members cards' stat line. Fresh, not cached: the
  // wars column only exists for staff, so a cached copy could show or hide
  // it across a login, same reasoning as players().
  leaderboard: () => getJSON("/leaderboard", { fresh: true }),
  // The most recently archived COMPLETED week (raids/XP always; wars only
  // once weekly_war_history has its first archived week — see
  // `wars_available` on the payload), for the Leaderboard page's Last Week
  // button.
  leaderboardLastWeek: () => getJSON("/leaderboard/last-week", { fresh: true }),
  territories: () => getJSON("/territories", { fresh: true }),
  // The war map's res-tick timer: just the inferred last tick, no map payload.
  territoriesTick: () => getJSON("/territories/tick", { fresh: true }),
  // upgrade-prediction experiment (members only, see warmap/TowerPrediction.jsx).
  territoryPredictions: () => getJSON("/territories/predictions", { fresh: true }),
  // Camp (lootrun) + raid loot-pool previews. Fresh, not cached: a partial
  // payload (see `pending`) is re-asked for within seconds, and a cached
  // copy would just hand the same gaps back.
  lootPools: () => getJSON("/loot-pools", { fresh: true }),
  // The /uniform page: a player's current skin with the guild uniform
  // composited on, returned as a base64 data: PNG (rendered in 3D + offered
  // for download). `model` is "auto" (detect classic/slim), "classic", or
  // "slim". Parameterised, so fresh — the client TTL cache keys on the path
  // and the backend already caches the composite in-process.
  uniformSkin: ({ user, season, model, medals }) =>
    getJSON(`/uniform/skin?user=${encodeURIComponent(user)}&season=${encodeURIComponent(season)}`
      + `&model=${encodeURIComponent(model || "auto")}`
      // Exactly 3 comma-separated Position 1/2/3 slots (empty allowed) — see
      // api.py's uniform_skin docstring. Omitted entirely until the member
      // has made (or been offered) a choice.
      + (medals ? `&medals=${encodeURIComponent(medals)}` : ""),
      // Longer than the default 20s: a cold request does a guild-roster fetch
      // plus up to three Mojang calls. The backend caps itself at ~25s.
      { fresh: true, timeoutMs: 35_000 }),
  // Guild-name search across all of Wynncraft (not just current territory
  // holders) for the territory map's guild-search filter.
  guildSearch: (query) => getJSON(`/guilds/search?q=${encodeURIComponent(query)}`, { fresh: true }),
  // Live top-N Season Rating standings for the territory map's leaderboard
  // popup — public, unlike the Graphs page's staff-only seasonRating().
  seasonRatingLeaderboard: (limit = 20) => getJSON(`/guilds/season-rating?limit=${limit}`, { fresh: true }),
  // Staff-only: no weekly split like raids/xp, just the all-time diff since
  // the bot started tracking each player's wars.
  wars: () => getJSON("/leaderboard/wars", { fresh: true }),
  population: (days) => getJSON(`/population?days=${days}`),
  // Staff-only guild-wide time series (Graphs page) — metric is raids|xp|wars.
  guildStats: (metric, days) => getJSON(`/graphs/guild-stats?metric=${metric}&days=${days}`),
  // Staff-only Season Rating (SR) trend for the current season — every
  // guild's line (Fox + the top 10) comes back together in one payload.
  seasonRating: (days) => getJSON(`/graphs/season-rating?days=${days}`),
  // Staff-only: current guild members bucketed by highest-class combat
  // level, for the Graphs page's Levels pie chart.
  levels: () => getJSON("/graphs/levels"),
  // Fresh, not cached: the payload varies by who's logged in (staff-only
  // columns), so a stale cached copy could leak/hide fields after a login.
  players: () => getJSON("/players", { fresh: true }),
  // Staff-only player actions: view the stored application, and queue
  // link/unlink/promote/offboard for the bot to execute (see components/staff/actions.js).
  playerApplication: (id) => getJSON(`/players/${id}/application`, { fresh: true }),
  playerActionCreate: (body) => postJSON("/players/actions", body),
  playerActionStatus: (id) => getJSON(`/players/actions/${id}`, { fresh: true }),
  // Staff-only On Leave / Warned status — a direct write, no bot round-trip.
  // `until` (YYYY-MM-DD, on_leave only) auto-clears the status on that date.
  playerStatusSet: (id, status, reason, until) =>
    postJSON(`/players/${id}/status`, { status, reason, until: until || null }),
  playerStatusClear: (id) => sendJSON(`/players/${id}/status`, "DELETE"),
  // Staff-only warning history — separate from the On Leave / Warned status
  // above: this is additive (every warning is kept), while warning also sets
  // that status's live "warned" badge as a side effect.
  playerWarn: (id, reason) => postJSON(`/players/${id}/warnings`, { reason }),
  playerWarnings: (id) => getJSON(`/players/${id}/warnings`, { fresh: true }),
  // Every On Leave a member has taken, newest first — member_status only
  // holds the current one, so this is what makes a repeat absence
  // distinguishable from a first.
  playerLeaves: (id) => getJSON(`/players/${id}/leaves`, { fresh: true }),
  // Staff-only: every active member's hours played in a chosen window, for
  // the Members page's Playtime section (7/14/30-day picker).
  playersPlaytime: (days) => getJSON(`/players/playtime?days=${days}`, { fresh: true }),
  // Public: one member's own raids/XP/wars/playtime trend, for the member
  // card's second page (7/14/30-day picker).
  playerStats: (uuid, days) => getJSON(`/players/${uuid}/stats?days=${days}`, { fresh: true }),
  // Staff-only Trial Member onboarding tracker — also a direct write.
  recruitClassSet: (id) => postJSON(`/players/${id}/recruit-class`, {}),
  recruitClassClear: (id) => sendJSON(`/players/${id}/recruit-class`, "DELETE"),
  aspects: () => getJSON("/aspects", { fresh: true }),
  aspectDetail: (id) => getJSON(`/aspects/${id}`),
  authMe: () => {
    // The app shell and most pages ask on the same mount; share one request.
    _authMeInFlight ??= getJSON("/auth/me", { fresh: true })
      .finally(() => { _authMeInFlight = null; });
    return _authMeInFlight;
  },
  logout: () => postJSON("/auth/logout"),
  // Server-side logout: bumps the account's session generation, killing every
  // outstanding cookie (other devices, stolen copies) — not just this one.
  logoutEverywhere: () => postJSON("/auth/logout-everywhere"),
  aspectPreview: (total) => postJSON("/aspects/preview", { total }),
  aspectDistribute: (total) => postJSON("/aspects/distribute", { total }),
  // Staff-only standing aspect forwards: preview/list what's active, create
  // one (replaces any existing forward from the same source — see
  // services.create_aspect_forward), and remove one.
  aspectForwards: () => getJSON("/aspects/forwards", { fresh: true }),
  aspectForwardCreate: (body) => postJSON("/aspects/forwards", body),
  aspectForwardDelete: (id) => sendJSON(`/aspects/forwards/${id}`, "DELETE"),
  // Fresh: staff creating an event should see it take effect immediately.
  raidEventActive: () => getJSON("/raid-event/active", { fresh: true }),
  raidEventCreate: (body) => postJSON("/raid-event", body),
  raidEventUpdate: (id, body) => sendJSON(`/raid-event/${id}`, "PATCH", body),
  raidEventCancel: (id) => sendJSON(`/raid-event/${id}`, "DELETE"),
  raidEventHistoryList: () => getJSON("/raid-event/history", { fresh: true }),
  raidEventHistoryDetail: (id) => getJSON(`/raid-event/history/${id}`),
  // Site-admin only: permanently prune an event out of history.
  raidEventHistoryDelete: (id) => sendJSON(`/raid-event/history/${id}`, "DELETE"),
  // Site-admin only: view + revoke site access, end sessions, and the audit
  // log. Keyed on the Minecraft UUID, not a Discord id — a member who never
  // linked Discord has no Discord id to address them by, which is exactly why
  // they were once unrecordable and unrevokable here.
  adminUsers: () => getJSON("/admin/users", { fresh: true }),
  adminRevoke: (uuid) => postJSON(`/admin/users/${uuid}/revoke`),
  adminUnrevoke: (uuid) => postJSON(`/admin/users/${uuid}/unrevoke`),
  adminSignOut: (uuid) => postJSON(`/admin/users/${uuid}/sign-out`),
  adminRankPinSet: (uuid, title) => sendJSON(`/admin/users/${uuid}/rank-pin`, "PUT", { title }),
  adminRankPinRemove: (uuid) => sendJSON(`/admin/users/${uuid}/rank-pin`, "DELETE"),
  adminLinkExceptions: () => getJSON("/admin/link-exceptions", { fresh: true }),
  adminLinkExceptionAdd: (account, note) =>
    postJSON("/admin/link-exceptions", { account, note: note || null }),
  adminLinkExceptionRemove: (discordId) =>
    sendJSON(`/admin/link-exceptions/${discordId}`, "DELETE"),
  adminAudit: (limit = 100) => getJSON(`/admin/audit?limit=${limit}`, { fresh: true }),
  // Site-admin only: bot loop health, live-board stats, command usage,
  // website traffic, and bot.db storage growth — a live snapshot, not history.
  adminMetrics: () => getJSON("/admin/metrics", { fresh: true }),
  adminDiagnosticsSummary: (range = "24h") =>
    getJSON(`/admin/diagnostics/summary?range=${encodeURIComponent(range)}`, { fresh: true }),
  adminDiagnosticEvents: (filters = {}) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== "" && value != null && value !== false) qs.set(key, String(value));
    }
    return getJSON(`/admin/diagnostics/events?${qs}`, { fresh: true });
  },
  adminDiagnosticEvent: (id) =>
    getJSON(`/admin/diagnostics/events/${encodeURIComponent(id)}`, { fresh: true }),
  adminRalleUsers: () =>
    getJSON("/admin/diagnostics/ralle-users", { fresh: true }),
  adminRalleUser: (uuid) =>
    getJSON(`/admin/diagnostics/ralle-users/${encodeURIComponent(uuid)}`, { fresh: true }),
  adminResolveCosmeticUser: (ign) =>
    sendJSON("/admin/diagnostics/ralle-users/resolve", "POST", { ign }),
  adminCreateCosmeticUser: (body) =>
    sendJSON("/admin/diagnostics/ralle-users/cosmetics", "POST", body),
  adminSetCosmeticGrants: (uuid, body) =>
    sendJSON(`/admin/diagnostics/ralle-users/${encodeURIComponent(uuid)}/cosmetics`, "PUT", body),
};

/** Minimal data-fetch hook: { loading, data, error }. Pass { pollMs } to
 * silently re-fetch in the background on an interval — only the initial load
 * (or a deps change) shows the spinner; a poll tick swaps in fresh data
 * without ever re-showing it, and a failed poll just keeps the last good
 * data on screen instead of surfacing an error.
 *
 * pollMs may be a number, or `(data) => number` to adapt the interval to
 * what a tick just fetched (e.g. poll fast only while something's active).
 * The function runs synchronously against that tick's own result, so the
 * new interval applies starting with the very next tick — not one tick
 * later, which is what re-deriving it through a separate render/effect
 * round-trip would cost. A failed tick can't compute pollMs from data it
 * doesn't have, so it reuses whatever interval the last successful tick
 * scheduled (a plain-number pollMs is unaffected either way). Falsy pollMs
 * (or a function returning falsy) skips scheduling the next tick — a
 * caller can stop polling entirely once nothing's worth watching for, but
 * polling that starts disabled can't be turned back on without a deps
 * change, since there's no running timer left to redirect. getJSON/sendJSON
 * carry their own request timeout, so one slow/stuck request can only delay
 * a tick, not stall every poll after it.
 *
 * A hidden tab keeps polling on its normal interval — deliberately, so the
 * data on screen is never something the user has to wait for after switching
 * back. refetchOnVisible adds the other half of that guarantee: the browser
 * throttles background timers regardless of what we schedule, so returning to
 * the tab also takes a tick straight away rather than waiting out a clamped
 * one. Opt-in, since it costs an extra request per tab switch and only pays
 * off for genuinely live data.
 *
 * keepDataWhileLoading changes only what a deps-change reload (not a poll
 * tick, which already never resets) shows while in flight: the previous
 * data stays on screen with loading still true, instead of a hard reset to
 * {loading:true, data:null} that flashes every consumer's Async back to its
 * loading state. Opt in only when every value `deps` can take fetches the
 * *same shape* of data (e.g. a refreshKey bump after a mutation) — a deps
 * change that switches to a genuinely different resource (a different
 * metric, a different id) should keep the hard reset, or a moment of the
 * old resource's data can render through code paths chosen for the new one. */
export function useFetch(fn, deps, { pollMs, keepDataWhileLoading, refetchOnVisible } = {}) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let alive = true;
    let timer = null;
    let inFlight = false;
    let lastDelay = typeof pollMs === "function" ? undefined : pollMs;
    const schedule = (delay) => {
      lastDelay = delay;
      if (alive && delay) timer = setTimeout(() => load(true), delay);
    };
    // Polling itself never pauses while the tab is hidden (see the note in
    // the doc comment), but the *timer* it runs on is not ours to trust:
    // browsers clamp setTimeout in a background tab (Chrome to >=1 minute,
    // further still under intensive throttling), so a 30s poll can land a
    // minute or more late and the first thing shown on the way back is that
    // late tick's already-stale data. Taking a tick immediately on becoming
    // visible closes that window: the pending timer is dropped, one fetch
    // goes out now, and the normal interval resumes from it.
    const onVisible = () => {
      if (!alive || document.visibilityState !== "visible") return;
      // A tick already in flight will settle and reschedule on its own;
      // firing a second one alongside it would just duplicate the request.
      if (inFlight) return;
      if (timer) { clearTimeout(timer); timer = null; }
      load(true);
    };
    const load = (isPoll) => {
      inFlight = true;
      if (!isPoll) {
        setState((prev) => keepDataWhileLoading
          ? { loading: true, data: prev.data, error: null }
          : { loading: true, data: null, error: null });
      }
      Promise.resolve()
        .then(fn)
        .then((d) => {
          inFlight = false;
          if (alive) setState({ loading: false, data: d, error: null });
          schedule(typeof pollMs === "function" ? pollMs(d) : pollMs);
        })
        .catch((e) => {
          inFlight = false;
          if (alive && !isPoll) {
            setState({ loading: false, data: null, error: String(e.message || e) });
          }
          schedule(lastDelay);   // a plain-number pollMs is always already == lastDelay
        });
    };
    load(false);
    const watchVisibility = Boolean(refetchOnVisible) && typeof document !== "undefined";
    if (watchVisibility) document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      if (watchVisibility) document.removeEventListener("visibilitychange", onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

/** Same keys, same values by ===. For React.memo comparators over API rows:
 * every poll tick re-parses the payload into brand-new objects, so reference
 * equality reports "changed" on data that is in fact identical. Only valid for
 * flat rows of primitives — a nested object or array is compared by identity
 * and so always reads as different.
 */
export function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => a[k] === b[k]);
}

/** Adds a class to <body> for as long as the calling page is mounted, so
 * page-scoped rules can live in theme.css instead of the router having to know
 * about them (see the .nav backdrop-filter overrides, and .loot-pools-page's
 * wider container). Removing it on unmount is the whole point — a class left
 * behind would restyle whatever page the visitor navigates to next.
 */
export function usePageClass(name) {
  useEffect(() => {
    if (!name) return undefined;
    document.body.classList.add(name);
    return () => document.body.classList.remove(name);
  }, [name]);
}

/** Filter/sort state mirrored into both the URL query string and
 * localStorage: the query string so a filtered board or roster is a link
 * someone can paste, localStorage so a plain visit reopens the way you left
 * it. The URL wins when both have a value — an explicit link must never be
 * overridden by whatever this browser happened to have open last.
 *
 * `scope` namespaces the stored key ("members", "leaderboard") so two pages
 * can both own a `q` without reading each other's; the URL parameter stays
 * unprefixed so the links stay readable. Values are strings — callers encode
 * booleans as "1"/"".
 *
 * Writes use replaceState, not pushState: nudging a filter shouldn't stack up
 * history entries the back button then has to walk out of one at a time.
 *
 * A link can also preset a value without putting it in the URL, via router
 * state (`<Link state={{ preset: { online: "1" } }}>`). That sits between the
 * URL and localStorage, and is deliberately *not* remembered: the home page's
 * stat buttons use it to open a view without rewriting the filters you left.
 */
export function useStickyState(scope, key, fallback) {
  const storeKey = `fox:${scope}:${key}`;
  const sourcedFromUrl = useRef(new URLSearchParams(window.location.search).get(key) != null);
  const fromPreset = sourcedFromUrl.current ? null : window.history.state?.usr?.preset?.[key];
  const sourcedFromPreset = useRef(fromPreset != null);
  const [value, setValue] = useState(() => {
    const fromUrl = new URLSearchParams(window.location.search).get(key);
    if (fromUrl != null) return fromUrl;
    if (fromPreset != null) return fromPreset;
    // Storage access throws outright in some privacy modes, so every read and
    // write here is guarded — a browser that won't persist should still get a
    // working page, just one that forgets.
    try {
      return window.localStorage.getItem(storeKey) ?? fallback;
    } catch {
      return fallback;
    }
  });
  const isFirstRun = useRef(true);

  // Debounced, not written on every keystroke. Both sinks below are
  // surprisingly expensive to hit at typing speed — localStorage.setItem is a
  // synchronous write to disk-backed storage, and history.replaceState is a
  // synchronous main-thread call into the browser's session history (Firefox
  // in particular charges real milliseconds for it). Typing into the Members
  // or Leaderboard search box fired both per character, on top of re-filtering
  // and re-rendering the list, which is what made the boxes feel laggy. Only
  // the *mirroring* is delayed: `value` (and therefore the filtered list) still
  // updates synchronously, so nothing on screen waits for this.
  useEffect(() => {
    // A value merely restored from localStorage (e.g. a period picked on a
    // past visit) shouldn't get written into the address bar on the page's
    // first render — otherwise a bare navigation to the clean path immediately
    // grows a query string, which is exactly the "always redirects" bug this
    // guards against. Only skip that one first write when nothing on this
    // load actually asked for the param (no `?key=` in the URL that brought
    // us here); once the user interacts, or on any later render, sync as usual
    // so in-session state stays reflected/shareable in the URL.
    //
    // Decided here, synchronously, rather than inside the debounced callback
    // below: a change arriving before that first callback ever fires cancels
    // it, and a flag still waiting to be flipped in there would then make the
    // user's own first edit look like the mount write and swallow it.
    const skipUrlSync = isFirstRun.current && !sourcedFromUrl.current;
    // A preset is only this visit's starting point, so its first render
    // writes nowhere; the user's own changes after that persist as usual.
    const skipAll = isFirstRun.current && sourcedFromPreset.current;
    isFirstRun.current = false;
    if (skipAll) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(storeKey, value);
      } catch { /* not persistable here; the page still works */ }
      if (skipUrlSync) return;
      const url = new URL(window.location.href);
      // An empty value is the "off" state for every toggle here, so it carries
      // no more information than an absent key — drop it rather than leaving a
      // bare `?splitClass=` hanging off the URL. Toggles whose fallback is
      // already "" hit the first branch and behaved this way all along; this
      // only catches the ones (like Members' splitClass) that default to on.
      if (value === fallback || value === "") url.searchParams.delete(key);
      else url.searchParams.set(key, value);
      window.history.replaceState(null, "", url);
    }, 250);
    return () => clearTimeout(timer);
  }, [storeKey, key, value, fallback]);

  return [value, setValue];
}


export function formatXp(n) {
  n = Number(n) || 0;
  const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, unit] of units) {
    if (Math.abs(n) >= size) {
      const v = n / size;
      return (Math.abs(v) < 100 ? v.toFixed(1) : Math.round(v)) + unit;
    }
  }
  return String(n);
}

export const formatInt = (n) => (Number(n) || 0).toLocaleString();

/** Tooltip for a stat the API withheld because it belongs to a private member
 * (`stats_hidden` — see the backend's domain/privacy.py). */
export const PRIVATE_STATS_TITLE = "Private — only signed-in guild members can see this";

// Wynncraft's guild levelling curve — mirrors raid_event_service.
// guild_level_cost (see there for the source): XP to go from `level` to the
// next, which stops growing from level 130.
export function guildLevelCost(level) {
  const n = Math.min(level, 130);
  return Math.round(20_000 * (1.15 ** n - 1) / 0.15);
}

// [{level, xp}] — XP from a start position (level + percent through it) to
// reach each level up to `targetLevel`.
export function levelMilestones(startLevel, startPercent, targetLevel) {
  const out = [];
  let xp = -guildLevelCost(startLevel) * (startPercent || 0) / 100;
  for (let level = startLevel; level < targetLevel && out.length < 40; level += 1) {
    xp += guildLevelCost(level);
    out.push({ level: level + 1, xp: Math.round(xp) });
  }
  return out;
}

// Podium marker for a 1-based leaderboard rank, "#4" onwards. Shared so the
// raid/XP/war/event boards and the Season Rating table can't drift into
// disagreeing about what third place looks like.
export const medal = (rank) => ({ 1: "🥇", 2: "🥈", 3: "🥉" }[rank] || `#${rank}`);

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d) ? "—" : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Date + time, in the viewer's own locale and local timezone (the underlying
// boundary is always a fixed instant — 2 PM Sydney reset — so this is just a
// different clock's view of the same moment, not a separate value). Asks for
// a long month name + 12-hour clock (the "6 July, 2:00 pm" shape), but each
// piece still comes from the viewer's own locale via toLocaleDateString/
// toLocaleTimeString(undefined, …) rather than hardcoded English — only the
// comma joining them is fixed (toLocaleString's combined form joins with
// "at" in some locales instead).
export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const date = d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date}, ${time}`;
}

export function timeAgo(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return "—";
  const s = (Date.now() - d.getTime()) / 1000;
  for (const [sec, u] of [[31536000, "y"], [2592000, "mo"], [604800, "w"], [86400, "d"], [3600, "h"], [60, "m"]]) {
    if (s >= sec) return `${Math.floor(s / sec)}${u} ago`;
  }
  return "just now";
}
