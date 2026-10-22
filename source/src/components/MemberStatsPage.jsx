import { useState } from "react";
import { api, useFetch } from "../lib.js";
import { Async } from "../ui.jsx";
import MemberStatBarChart from "./MemberStatBarChart.jsx";

// Second page of the member card (PlayerPanel.jsx) — one member's own
// raids/playtime/wars/XP trend, resampled the same way the staff-only Graphs
// page is (see services.member_stat_series), just public and scoped to one
// uuid. One chart on screen at a time (metric toggle) rather than stacked —
// four full-width bar charts in a row read as a scroll wall on a card this
// size.
const CHARTS = [
  ["playtime", "Playtime"],
  ["raids", "Guild raids"],
  ["wars", "Guild wars"],
  ["xp", "Guild XP"],
];

export default function MemberStatsPage({ uuid }) {
  const [days, setDays] = useState(7);
  const [metric, setMetric] = useState(CHARTS[0][0]);
  const state = useFetch(async () => api.playerStats(uuid, days), [uuid, days]);
  const label = CHARTS.find(([key]) => key === metric)?.[1];

  return (
    <div className="member-stats-page">
      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div className="segmented">
          {CHARTS.map(([key, chartLabel]) => (
            <button key={key} className={key === metric ? "on" : ""} onClick={() => setMetric(key)}>
              {chartLabel}
            </button>
          ))}
        </div>
        <div className="segmented">
          {[7, 14, 30].map((d) => (
            <button key={d} className={d === days ? "on" : ""} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
      </div>
      <Async state={state}>
        {(data) => (
          <MemberStatBarChart points={data[metric]} label={label}
            bucketHours={metric === "playtime" ? data.playtime_bucket_hours : data.bucket_hours}
            {...(data.stats_hidden
              ? { emptyMessage: "private — only signed-in guild members can see this." } : {})} />
        )}
      </Async>
    </div>
  );
}
