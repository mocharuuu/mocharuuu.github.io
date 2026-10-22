import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, nameColor, useFetch, usePageClass, useStickyState, uuidKey } from "../lib.js";
import { Async, PageHead } from "../ui.jsx";
import { CollapseToggle, OffboardedSection, UnlinkedSection } from "../components/staff/RosterStaffCards.jsx";
import MemberCard from "../components/MemberCard.jsx";
import PlayerPanel from "../components/PlayerPanel.jsx";
import StaffActionBar, { useStaffActionState } from "../components/staff/StaffActionBar.jsx";
import SearchInput from "../components/SearchInput.jsx";
import { SECTION_COLORS, splitGentry } from "../components/roster.jsx";
import { RANKS, categoriesFor, ladderFor } from "../lib/ranks.js";

/** The official-rank / in-game-rank / role rows for a section, shown inline
 * under its heading. This is the old /ranks chart, folded in next to the
 * members it actually describes. */
function RankLadder({ section, accent }) {
  const rows = ladderFor(section);
  if (rows.length === 0) return null;
  return (
    <table className="table ranks-table stack" style={{ marginBottom: 10 }}>
      <colgroup>
        <col style={{ width: "28%" }} />
        <col style={{ width: "18%" }} />
        <col style={{ width: "54%" }} />
      </colgroup>
      <thead>
        <tr><th>Official Rank</th><th>In-game Rank</th><th>Role in the Guild</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.rank}>
            <td className="stack-head" style={{ color: nameColor(r.rank, accent), fontWeight: 700 }}>{r.rank}</td>
            <td data-label="In-game Rank">{r.ingame}</td>
            <td className="muted stack-wide">{r.role}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Trial Member only, and only while the page-top "Split by recruit class"
 * toggle is on: the section's members as two columns instead of one grid —
 * still-pending on the left, class-complete on the right — so where a
 * recruit stands is the layout itself, not a filter that hides everyone
 * else. Nobody is dropped; a recruit who's the only one in either column
 * just leaves the other column showing its empty state. */
function ClassSplitGrid({ members, accent, viewerStaff, onDone, onSelect, showPromotions, showRemoval }) {
  const pending = members.filter((m) => !m.recruit_class_complete);
  const complete = members.filter((m) => m.recruit_class_complete);
  return (
    <div className="class-split">
      {[["Pending", pending, "Nobody pending — everyone's through the class."],
        ["Class complete", complete, "Nobody yet."]].map(([label, list, empty]) => (
        <div className="class-split-col" key={label}>
          <div className="class-split-head">
            {label} <span className="pill">{list.length}</span>
          </div>
          {list.length === 0 ? (
            <div className="muted">{empty}</div>
          ) : (
            <div className="member-grid">
              {list.map((m) => (
                <MemberCard key={m.uuid} m={m} accent={accent}
                  viewerStaff={viewerStaff} onDone={onDone} onSelect={onSelect}
                  showPromotions={showPromotions} showRemoval={showRemoval} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** One rank section: the heading (name, count, rank-guide toggle) over the
 * member card grid — or, for Trial Member with the page-top split toggle on,
 * over ClassSplitGrid's two columns instead. */
function Section({ section, members, viewerStaff, onDone, onSelect, splitClass, showPromotions, showRemoval }) {
  const [guideOpen, setGuideOpen] = useState(false);
  const [open, setOpen] = useState(true);
  const accent = SECTION_COLORS[section] || "var(--orange)";
  const hasLadder = ladderFor(section).length > 0;
  const showSplit = section === "Trial Member" && viewerStaff && splitClass;

  return (
    <div className="card" style={{ marginBottom: 14, borderLeft: `4px solid ${accent}` }}>
      <div className="section-head">
        <h3 style={{ color: accent }}>{section}</h3>
        <span className="pill">{members.length}</span>
        {hasLadder && (
          <button type="button" className="rank-guide-toggle" aria-expanded={guideOpen}
            onClick={() => setGuideOpen((o) => !o)}
            title={`What ${section} means in the guild`}>
            Rank guide {guideOpen ? "▾" : "▸"}
          </button>
        )}
        <CollapseToggle open={open} onToggle={() => setOpen((o) => !o)} />
      </div>

      {open && guideOpen && <RankLadder section={section} accent={accent} />}

      {open && (members.length === 0 ? (
        <div className="muted">No members match this filter.</div>
      ) : showSplit ? (
        <ClassSplitGrid members={members} accent={accent}
          viewerStaff={viewerStaff} onDone={onDone} onSelect={onSelect}
          showPromotions={showPromotions} showRemoval={showRemoval} />
      ) : (
        <div className="member-grid">
          {members.map((m) => (
            <MemberCard key={m.uuid} m={m} accent={accent}
              viewerStaff={viewerStaff} onDone={onDone} onSelect={onSelect}
              showPromotions={showPromotions} showRemoval={showRemoval} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A rank category the chart describes but nobody currently holds — rendered
 * ladder-only so merging /ranks into this page didn't quietly drop the ranks
 * with no live members. */
function LadderOnlySection({ category, color, rows }) {
  return (
    <div className="card" style={{ marginBottom: 14, borderLeft: `4px solid ${color}` }}>
      <div className="section-head">
        <h3 style={{ color }}>{category}</h3>
        <span className="pill">no current members</span>
      </div>
      <table className="table ranks-table stack">
        <colgroup>
          <col style={{ width: "28%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "54%" }} />
        </colgroup>
        <thead>
          <tr><th>Official Rank</th><th>In-game Rank</th><th>Role in the Guild</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank}>
              <td className="stack-head" style={{ color, fontWeight: 700 }}>{r.rank}</td>
              <td data-label="In-game Rank">{r.ingame}</td>
              <td className="muted stack-wide">{r.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Members() {
  // Drops the sticky nav's backdrop-filter for this page — the roster is one
  // of the site's long scrolls, and re-blurring the nav strip on every scroll
  // frame is the single most expensive thing on it (see the .nav override in
  // theme.css).
  usePageClass("members-page");
  const [refreshKey, setRefreshKey] = useState(0);
  // Online status and last-seen change continuously on Wynncraft's end, not
  // just on a roster sync — poll so they stay live without a manual reload.
  // keepDataWhileLoading: refreshKey bumps after every staff action (recruit
  // class, Warn, On Leave, Offboard, …) to pick up the change — without it,
  // each one would flash the whole roster to a spinner and back, which read
  // as "the entire page refreshes" for something as small as one toggle.
  const state = useFetch(api.players, [refreshKey],
    { pollMs: 30_000, keepDataWhileLoading: true });
  // Raids/XP/wars for the player detail panel's stat tiles. Deliberately a
  // separate, slower fetch rather than something the roster waits on: if
  // this one is slow or fails, the panel just shows an em-dash instead of
  // the whole page showing an error.
  const board = useFetch(api.leaderboard, [refreshKey], { pollMs: 60_000 });

  const [q, setQ] = useStickyState("members", "q", "");
  const [region, setRegion] = useStickyState("members", "region", "All");
  const [online, setOnline] = useStickyState("members", "online", "");
  const onlineOnly = online === "1";
  // Staff-only "Trial Members" filter (button lives on StaffActionBar, to
  // the right of the actions — see `staffFilters` below): focuses the page
  // on Trial Member alone (every other rank section hidden) and splits it
  // into two columns, pending | class complete. Defaults on for a browser
  // that's never set it (fallback "1"), since onboarding is the thing staff
  // most often land on this page to work through; explicitly toggling it off
  // is remembered from then on, same as every other sticky filter here. Only
  // ever takes effect for a staff viewer with an actual Trial Member section
  // to focus on — see `focusTrial` below.
  const [splitClass, setSplitClass] = useStickyState("members", "splitClass", "1");
  const splitClassOn = splitClass === "1";
  // Staff-only "Up for Removal" filter: narrows the roster grid down to
  // members the backend flags removal_candidate, same as "Online only" narrows to online
  // members — a section that empties out just disappears (see `match`
  // below), rather than the whole-category "leftover ladder" treatment
  // "Trial Members" focus gets. Each shown card also picks up its playtime
  // figure (see MemberCard's showRemoval prop) so staff don't have to
  // cross-reference a separate table for the number that put them here.
  const [upForRemoval, setUpForRemoval] = useStickyState("members", "upForRemoval", "");
  const upForRemovalOn = upForRemoval === "1";
  // The panel tracks a UUID, not the row object it was opened from, so the
  // 30s poll (and any staff action that refetches) keeps it current instead
  // of leaving a frozen copy on screen. A member who leaves the roster
  // entirely simply resolves to nothing and the panel closes itself.
  const [selectedUuid, setSelectedUuid] = useState(null);
  const needle = q.trim().toLowerCase();
  // Shared with StaffActionBar: which staff action (if any) is armed and
  // waiting for a card/row click to supply its target. Read via a ref inside
  // onSelect below rather than closed over directly, so onSelect's own
  // identity (see the memoisation comment there) doesn't have to change
  // every time an action is armed/disarmed/picked.
  const staffAction = useStaffActionState();
  const staffActionRef = useRef(staffAction);
  staffActionRef.current = staffAction;
  // While an action is armed, every clickable card/row on the page (styled
  // via the body.staff-picking rules in theme.css) accepts the click as that
  // action's target instead of opening the read-only PlayerPanel. Tied to the
  // armed action alone (not also "still picking"): a per-member modal's
  // translucent backdrop (rgba(0,0,0,0.6), not opaque) lets the grid show
  // through, so toggling this off and back on for every single pick made the
  // glow ring flicker behind the modal instead of just staying put for the
  // whole armed run.
  useEffect(() => {
    const picking = !!staffAction.action;
    document.body.classList.toggle("staff-picking", picking);
    return () => document.body.classList.remove("staff-picking");
  }, [staffAction.action]);
  // Promote's own armed state doubles as the "show promotion dates" toggle
  // — merged rather than a separate control, since the date only matters
  // while actively picking who to promote next (PlayerPanel always shows it
  // regardless, for staff who open a card outside this flow).
  const showPromotionsOn = staffAction.action?.key === "promote";
  // While an action with a disabled(m) guard is armed, hide every card it
  // would refuse anyway (Warn/On Leave/Offboard: staff members; Promote:
  // staff and non-promotable tiers) — same information the blocked-click
  // toast already gives, just surfaced before the click instead of after,
  // so staff aren't tempted to click someone the action was always going to
  // reject. Actions with no disabled() (View Application) hide nobody.
  //
  // Tied to the armed action alone, not also "still picking" (!player): the
  // action stays armed across a whole run of picks (see useStaffActionState's
  // close/deselect split), so gating this on player too made the filtered set
  // pop back to the full roster and re-filter again on every single modal
  // open/close — a visible reflow of the grid behind each modal for no
  // reason, since which members are eligible for the armed action never
  // actually changes mid-run.
  const hideIneligible = (m) =>
    !!staffAction.action && !!staffAction.action.disabled?.(m);

  // Stable identities, not fresh closures per render: MemberCard is memoised
  // (~100 of them on this page), and a new function on every keystroke would
  // invalidate every card's memo and undo the point of it.
  const onDone = useCallback(async () => setRefreshKey((n) => n + 1), []);
  const onSelect = useCallback((m) => {
    const sa = staffActionRef.current;
    if (sa.action && !sa.player) {
      const reason = sa.action.disabled?.(m);
      if (reason) { sa.setBlocked(reason); return; }
      sa.setBlocked(null);
      sa.setPlayer(m);
      return;
    }
    setSelectedUuid(m.uuid);
  }, []);

  const metrics = useMemo(() => {
    const m = new Map();
    for (const p of board.data?.players || []) m.set(uuidKey(p.uuid), p);
    return m;
  }, [board.data]);
  const metricsFor = (uuid) => metrics.get(uuidKey(uuid)) || null;

  const searchMatch = (m) =>
    !needle ||
    (m.name || "").toLowerCase().includes(needle) ||
    (m.discord_username || "").toLowerCase().includes(needle) ||
    (m.title || "").toLowerCase().includes(needle);
  const matchEver = (m) => (region === "All" || m.region === region) && searchMatch(m);
  const match = (m) => matchEver(m) && (!onlineOnly || m.online)
    && (!upForRemovalOn || m.removal_candidate) && !hideIneligible(m);
  // Everything `match` checks except the region gate itself — drives the
  // region chips' own counts (see totalCount/regionCounts below), so "NA ·
  // 12" reads as "12 would show if NA were selected, under every other
  // filter active right now" instead of the roster's raw, filter-oblivious
  // regional split. Search/online-only/Removals/an armed staff action (the
  // same things `shown`/`onlineCount` already reflect) all narrow it. Pages
  // (focusTrial) isn't folded in here since it isn't known until `data` is
  // — see matchRegionlessFocused below, inside the Async closure.
  const matchRegionless = (m) => searchMatch(m) && (!onlineOnly || m.online)
    && (!upForRemovalOn || m.removal_candidate) && !hideIneligible(m);

  return (
    <>
      <PageHead title="Fox Members" sub="Kingdom of Foxes roster and rank ladder" />
      <Async state={state}>
        {(data) => {
          const allMembers = data.sections.flatMap((s) => s.members);
          const baseSections = splitGentry(data.sections
            .map((s) => ({ ...s, members: s.members.filter(match) }))
            .filter((s) => s.members.length > 0));
          // Raw data.sections, not baseSections/match and not even matchEver
          // — same reasoning as everSections further down: no filter (search,
          // region, online-only, Removals, an armed staff action) may ever
          // change whether the Trial Member section counts as populated, or
          // the Pages filter chip itself disappears (it's gated on hasTrial
          // below). It used to be baseSections.some(...), so turning on
          // Online only while Removals was already active (an intersection
          // real rosters often have ~zero members in) made the Pages button
          // vanish entirely instead of just showing "no players match" once
          // toggled on — and it later used matchEver (region+search), which
          // had the same bug for a region filter or search term that simply
          // didn't match any trial member.
          const hasTrial = data.sections.some((s) =>
            s.section === "Trial Member" && s.members.length > 0);
          // "Pages" is a focused, staff-only view of onboarding — every
          // other rank section (and the ladder-only leftovers further down)
          // is hidden while it's on, rather than just pushed further down
          // the page. Gated on viewer_staff too: the sticky default is "on"
          // for every browser that's never set it, staff or not, so a public
          // visitor must never have their roster view narrowed by a control
          // they can't even see (StaffActionBar etc. are already gated the
          // same way; Section's own split-into-columns view below carries
          // its own separate viewerStaff check).
          const focusTrial = splitClassOn && hasTrial && data.viewer_staff;
          const visibleSections = focusTrial
            ? baseSections.filter((s) => s.section === "Trial Member") : baseSections;
          // The filter chip's own count — the full roster's candidate total,
          // not narrowed by whatever search/region/online-only is currently
          // set. Unlike totalCount/regionCounts below, this one's meant to
          // advertise "how many candidates exist" as a constant, not "how
          // many would show" under the current view.
          const removalCount = data.sections.reduce(
            (n, s) => n + s.members.filter((m) => m.removal_candidate).length, 0);
          // The toolbar's "All"/per-region chip counts — every currently-
          // active filter except the region selection itself (matchRegionless
          // above), plus Pages' own section-narrowing (not part of
          // matchRegionless, since focusTrial isn't known outside this
          // closure), so they always agree with what's actually on screen —
          // just the Trial Member section, while Pages is on — instead of
          // the roster's raw, unfiltered split. Replaces
          // data.total/data.regions[].count, which never moved with
          // search/online-only/Removals/Pages/an armed staff action.
          const matchRegionlessFocused = (m) =>
            matchRegionless(m) && (!focusTrial || m.section === "Trial Member");
          const regionlessMembers = allMembers.filter(matchRegionlessFocused);
          const totalCount = regionlessMembers.length;
          const regionCounts = {};
          for (const m of regionlessMembers) {
            regionCounts[m.region] = (regionCounts[m.region] || 0) + 1;
          }
          // shown/onlineCount reflect visibleSections (baseSections narrowed
          // to Trial Member alone while Pages is on), not baseSections
          // itself — otherwise these kept counting the whole filtered
          // roster while the grid below only ever showed the Page section.
          const shown = visibleSections.reduce((n, s) => n + s.members.length, 0);
          const onlineCount = visibleSections.reduce(
            (n, s) => n + s.members.filter((m) => m.online).length, 0);
          // Which categories have real members at all, ignoring every filter
          // (search, region, online-only, Removals, an armed staff action) —
          // a section emptied out by any of them still covers its category
          // here, so it doesn't also show up below as a ladder-only "no
          // current members" leftover. Deliberately raw data.sections, not
          // even matchEver (region+search): a region filter or search term
          // that just happens to match nobody in a genuinely populated
          // category must not make that category read as vacant either.
          const everSections = splitGentry(data.sections
            .filter((s) => s.members.length > 0));
          const covered = new Set(everSections.flatMap((s) => categoriesFor(s.section)));
          const leftover = RANKS.filter((r) => !covered.has(r.category));
          const selected = selectedUuid
            ? allMembers.find((m) => uuidKey(m.uuid) === uuidKey(selectedUuid)) || null
            : null;
          // Staff-only view filters, rendered by StaffActionBar to the right
          // of the five actions rather than in the public toolbar below.
          // Promotion dates isn't here — it's merged into the Promote button
          // itself now (see showPromotionsOn above). `on` is what draws the
          // gold-tinted chip; `onToggle` is the only thing StaffActionBar
          // actually calls.
          // services._is_removal_candidate decides who is flagged; these are
          // its numbers, for the copy only.
          const rule = data.removal_rule;
          const staffFilters = data.viewer_staff ? [
            // Pages and Removals are mutually exclusive — both narrow the
            // same roster grid along a different axis (onboarding vs.
            // inactivity), and a member can't usefully be viewed through
            // both lenses at once, so turning one on clears the other
            // rather than compounding into an ever-narrower intersection.
            hasTrial && {
              key: "trial", emoji: "🎓", label: "Pages", on: splitClassOn,
              title: "Focus on Trial Member alone, split into two columns: still pending the onboarding class, and class complete",
              onToggle: () => {
                setSplitClass(splitClassOn ? "" : "1");
                if (!splitClassOn) setUpForRemoval("");
              },
            },
            {
              key: "removal", emoji: "🚪",
              label: `Removals${removalCount ? ` · ${removalCount}` : ""}`,
              on: upForRemovalOn,
              title: `Under ${rule.hours}h of playtime in the last ${rule.window_days} days, unless marked On Leave — plus anyone currently warned`,
              onToggle: () => {
                setUpForRemoval(upForRemovalOn ? "" : "1");
                if (!upForRemovalOn) { setSplitClass(""); setOnline(""); }
              },
            },
          ].filter(Boolean) : [];

          return (
            <>
              {data.viewer_staff && (
                <StaffActionBar onDone={onDone} state={staffAction} filters={staffFilters} />
              )}
              {upForRemovalOn && (
                <p className="filter-hint">
                  🚪 Showing members under {rule.hours}h played in the last{" "}
                  {rule.window_days} days, plus anyone currently warned — on-leave members
                  (unless warned), and trial members still in their first {rule.trial_grace_days} days,
                  are left out.
                </p>
              )}
              <UnlinkedSection rows={data.unlinked} onDone={onDone} />
              {data.viewer_staff && (
                <OffboardedSection rows={data.offboarded} />
              )}

              {data.sections.length === 0 ? (
                <div className="card muted">No roster yet — the bot's roster sync fills this in within a few minutes of starting.</div>
              ) : (
                <>
                  <div className="toolbar">
                    <SearchInput value={q} onChange={setQ} placeholder="Search player or title…" />
                    <div className="chips">
                      <button className={region === "All" ? "on" : ""}
                        onClick={() => setRegion("All")}>
                        All · {totalCount}
                      </button>
                      {data.regions.map((r) => (
                        <button key={r.region} className={region === r.region ? "on" : ""}
                          onClick={() => setRegion(r.region)}>
                          {r.region} · {regionCounts[r.region] || 0}
                        </button>
                      ))}
                      {!upForRemovalOn && (
                        <button className={onlineOnly ? "on" : ""}
                          onClick={() => setOnline(onlineOnly ? "" : "1")}>
                          ● Online only
                        </button>
                      )}
                    </div>
                    <span className="pill">
                      {shown} shown · {onlineCount} online
                    </span>
                  </div>

                  {visibleSections.length === 0 && (
                    <div className="card muted">No players match the current filters.</div>
                  )}
                  {visibleSections.map((s) => (
                    <Section key={s.section} section={s.section} members={s.members}
                      viewerStaff={data.viewer_staff}
                      onDone={onDone} onSelect={onSelect}
                      splitClass={splitClassOn} showPromotions={showPromotionsOn}
                      showRemoval={upForRemovalOn} />
                  ))}
                  {!focusTrial && leftover.map((r) => (
                    <LadderOnlySection key={r.category} {...r} />
                  ))}
                </>
              )}

              {selected && (
                <PlayerPanel member={selected} metrics={metricsFor(selected.uuid)}
                  raidCodes={board.data?.raid_codes} viewerStaff={data.viewer_staff}
                  onClose={() => setSelectedUuid(null)} />
              )}
            </>
          );
        }}
      </Async>
    </>
  );
}
