import { useEffect, useState } from "react";
import { api, formatDate } from "../../lib.js";
import { Spinner } from "../../ui.jsx";
import { Modal } from "../Modal.jsx";

function VoteList({ label, voters }) {
  return (
    <div style={{ marginTop: 4 }}>
      <span className="muted">{label} </span>
      {voters.length === 0
        ? <span className="muted">—</span>
        : voters.map((v, i) => (
            <span key={v.id}>{i > 0 && ", "}{v.name || `user ${v.id}`}</span>
          ))}
    </div>
  );
}

const GUILD_FIELDS = [
  ["country", "Country"], ["timezone", "Time zone"], ["age", "Age"],
  ["pronouns", "Pronouns"], ["inviter", "Invited by"],
  ["why", "Why join Fox?"], ["enjoys", "Aspects of Wynncraft they enjoy"],
  ["notes", "Notes"],
];

const COMMUNITY_FIELDS = [
  ["nickname", "Nickname"], ["country", "Country"], ["timezone", "Time zone"],
  ["age", "Age"], ["inviter", "Invited by"], ["why", "Why join Fox?"],
  ["notes", "Notes"],
];

export function ApplicationModal({ player, onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let alive = true;
    api.playerApplication(player.discord_user_id)
      .then((d) => alive && setState({ loading: false, data: d, error: null }))
      .catch((e) => alive && setState({ loading: false, data: null,
                                        error: String(e.message || e) }));
    return () => { alive = false; };
  }, [player.discord_user_id]);

  const { loading, data, error } = state;
  const app = data?.application;
  const fields = app?.kind === "community" ? COMMUNITY_FIELDS : GUILD_FIELDS;
  const hasVotes = data && (data.votes.approve.length || data.votes.deny.length);

  return (
    <Modal title={`📄 ${player.name || "Application"}`} onClose={onClose}>
      {loading && <Spinner />}
      {error && <div className="error">{error}</div>}
      {app && (
        <>
          <div style={{ marginBottom: 10 }}>
            <span className="pill">{app.kind === "community" ? "Community" : "In-game"}</span>{" "}
            <span className={"badge " + (app.status === "approved" ? "online"
                              : app.status === "rejected" ? "leave" : "staff")}>
              {app.status}
            </span>{" "}
            {app.region && <span className="pill">region: {app.region}</span>}
          </div>
          {app.minecraft_username && (
            <div style={{ marginBottom: 10 }}>
              <span className="muted">IGN </span>
              <b>{app.minecraft_username}</b>
              {!app.minecraft_uuid &&
                <span className="muted"> (not verified via API)</span>}
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <span className="muted">Discord </span>
            <b>{player.discord_username || player.discord_user_id || "—"}</b>
          </div>
          <table className="table" style={{ marginBottom: 10 }}>
            <tbody>
              {fields.map(([key, label]) => (
                app.answers[key] ? (
                  <tr key={key}>
                    <td className="muted" style={{ whiteSpace: "nowrap",
                        verticalAlign: "top" }}>{label}</td>
                    <td style={{ whiteSpace: "pre-wrap" }}>{app.answers[key]}</td>
                  </tr>
                ) : null
              ))}
            </tbody>
          </table>
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}>
            <div>
              <span className="muted">Decision </span>
              {app.status === "pending"
                ? <span className="muted">pending</span>
                : <>
                    <b>{app.status === "approved" ? "Approved ✅" : "Denied ❌"}</b>
                    {app.decided_by &&
                      <span> by {app.decided_by_name || `user ${app.decided_by}`}</span>}
                    {app.decided_at &&
                      <span className="muted"> · {formatDate(app.decided_at)}</span>}
                  </>}
            </div>
            {hasVotes ? (
              <>
                <VoteList label="👍 Upvoted by:" voters={data.votes.approve} />
                <VoteList label="👎 Downvoted by:" voters={data.votes.deny} />
              </>
            ) : (
              <div className="muted" style={{ marginTop: 4 }}>
                No recorded votes (reviewed before vote history was kept).
              </div>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
