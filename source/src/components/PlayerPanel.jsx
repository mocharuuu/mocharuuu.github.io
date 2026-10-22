import { useState } from "react";
import { formatDate, formatDateTime, formatInt, formatXp, nameColor,
  PRIVATE_STATS_TITLE } from "../lib.js";
import { Modal } from "./Modal.jsx";
import PlayerAvatar from "./PlayerAvatar.jsx";
import { SECTION_COLORS, Status } from "./roster.jsx";
import MemberStatsPage from "./MemberStatsPage.jsx";

/** One player's full picture, opened from a member card or a leaderboard row.
 *
 * Read-only by design. Staff actions live on the page-top StaffActionBar
 * instead, because those put up their own position:fixed modals — nesting
 * those inside this one would stack two dialogs at the same z-index with no
 * clear way back out of either.
 *
 * Both inputs are optional and the panel degrades to whatever it was given:
 * `member` is the roster row (identity, region, Discord, staff-only fields),
 * `metrics` is the combined-leaderboard row (raids/XP/wars). A member who is
 * in-game but not yet mirrored into web_roster has only the latter; a member
 * the guild fetch missed has only the former. */

export function StatTile({ label, value, sub, title }) {
  return (
    <div className="stat-tile" title={title}>
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      <div className="stat-tile-sub">{sub || " "}</div>
    </div>
  );
}

function Fact({ label, children }) {
  return (
    <div className="player-fact">
      <div className="player-fact-label">{label}</div>
      <div>{children}</div>
    </div>
  );
}

export default function PlayerPanel({ member, metrics, raidCodes, viewerStaff, onClose }) {
  const [page, setPage] = useState("overview");
  const name = member?.name || metrics?.name || "Unknown";
  const uuid = member?.uuid || metrics?.uuid;
  const section = member?.section || metrics?.section;
  const title = member?.title || metrics?.title;
  const ingameRank = member?.ingame_rank || metrics?.ingame_rank;
  // Prime Minister is a roster overlay flag, not a real title/tier section
  // (see roster.jsx's splitGentry), so it takes precedence over whatever
  // section the member actually holds.
  const accent = member?.prime_minister
    ? SECTION_COLORS["Prime Minister"]
    : (SECTION_COLORS[section] || "var(--orange)");
  // Status wants the roster row's shape (status/online/last_seen). The
  // leaderboard row carries online/server but never a last_seen or an
  // On-Leave mark, so it stands in only when there's no roster row at all.
  const statusOf = member || (metrics && { online: metrics.online, server: metrics.server,
                                           last_seen: null });

  return (
    <Modal onClose={onClose} maxWidth={page === "stats" ? 880 : undefined}>
      <div className="player-panel">
        <div className="player-panel-head">
          <PlayerAvatar uuid={uuid} size={64} radius={10} />
          <div style={{ minWidth: 0, paddingRight: 56 }}>
            <div className="player-panel-title" style={{ color: nameColor(title, accent) }}>
              {title ? `${title} ${name}` : name}
            </div>
            <div className="muted">
              {section || "Unranked"}
              {ingameRank && <> · <span style={{ textTransform: "capitalize" }}>{ingameRank}</span></>}
            </div>
            <div style={{ marginTop: 6 }}>{statusOf && <Status m={statusOf} />}</div>
          </div>
        </div>

        {uuid && (
          <button type="button" className="btn"
            style={{ position: "absolute", top: 10, right: 80, padding: "3px 10px", fontSize: 12 }}
            onClick={() => setPage((p) => (p === "overview" ? "stats" : "overview"))}>
            {page === "overview" ? "Stats →" : "← Overview"}
          </button>
        )}

        {page === "stats" ? (
          <MemberStatsPage uuid={uuid} />
        ) : (
          <>
            {/* `metrics.*.all` is missing when this came from a period-only
                payload (e.g. Leaderboard's Last Week rows, which only ever
                carry `.week`) — shown as "—" rather than silently rendering
                a missing all-time total as a misleading 0. */}
            {/* A private member's raids/XP/wars reach signed-in members only;
                a visitor gets placeholder zeros, never shown as numbers. */}
            <div className="stat-tiles">
              {metrics?.stats_hidden ? (
                <StatTile label="Raids" value="—" sub="Private" />
              ) : (
                <StatTile label="Raids" value={metrics?.raids?.all != null ? formatInt(metrics.raids.all) : "—"}
                  sub={metrics?.raids?.week != null ? `${formatInt(metrics.raids.week)} this week` : null} />
              )}
              {metrics?.stats_hidden ? (
                <StatTile label="Guild XP" value="—" sub="Private" />
              ) : (
                <StatTile label="Guild XP" value={metrics?.xp?.all != null ? formatXp(metrics.xp.all) : "—"}
                  sub={metrics?.xp?.week != null ? `${formatXp(metrics.xp.week)} this week` : null} />
              )}
              {metrics?.stats_hidden ? (
                <StatTile label="Wars" value="—" sub="Private" />
              ) : (
                <StatTile label="Wars" value={metrics?.wars?.all != null ? formatInt(metrics.wars.all) : "—"}
                  sub={metrics?.wars?.week != null ? `${formatInt(metrics.wars.week)} this week` : null} />
              )}
            </div>

            {metrics?.stats_hidden && (
              <p className="muted" title={PRIVATE_STATS_TITLE} style={{ marginTop: 10,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {name}'s stats are private to guild members.
              </p>
            )}
            {metrics && !metrics.stats_hidden && raidCodes?.length > 0 && (
              <table className="table" style={{ marginTop: 14 }}>
                <thead>
                  <tr><th>Raid</th><th className="val">All-Time</th><th className="val">This Week</th></tr>
                </thead>
                <tbody>
                  {raidCodes.map((r) => {
                    const got = metrics.by_raid?.[r.code] || { all: 0, week: 0 };
                    return (
                      <tr key={r.code}>
                        <td title={r.name}>{r.name}</td>
                        <td className={got.all ? "val" : "val muted"}>{formatInt(got.all)}</td>
                        <td className={got.week ? "val" : "val muted"}>{formatInt(got.week)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {member && (
              <div className="player-facts">
                <Fact label="Region">{member.region || "—"}</Fact>
                {/* Visitors get no Discord identity at all (the API nulls
                    it), so the fact is left out rather than shown empty. */}
                {member.discord_username && <Fact label="Discord">{member.discord_username}</Fact>}
                {(member.accepted_at || member.joined_at) && (
                  <Fact label={member.accepted_at ? "Accepted" : "Joined"}>
                    <span title={formatDateTime(member.accepted_at || member.joined_at)}>
                      {formatDate(member.accepted_at || member.joined_at)}
                    </span>
                  </Fact>
                )}
                {viewerStaff && member.last_promoted_at && (
                  <Fact label="Last promoted">
                    <span title={formatDateTime(member.last_promoted_at)}>
                      {formatDate(member.last_promoted_at)}
                    </span>
                  </Fact>
                )}
                {viewerStaff && member.section === "Trial Member" && (
                  <Fact label="Recruit class">
                    {member.recruit_class_complete
                      ? <span className="badge online">complete</span>
                      : <span className="badge leave">pending</span>}
                  </Fact>
                )}
              </div>
            )}

            <p style={{ marginBottom: 0 }}>
              <a href={`https://wynncraft.com/stats/player/${encodeURIComponent(name)}`}
                target="_blank" rel="noopener noreferrer">View {name} on Wynncraft →</a>
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
