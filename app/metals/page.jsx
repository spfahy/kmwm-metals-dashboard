"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function toNumOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function corr(xs, ys) {
  const pts = [];
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] != null && ys[i] != null) pts.push([xs[i], ys[i]]);
  }
  if (pts.length < 3) return null;

  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;

  let num = 0,
    dx = 0,
    dy = 0;
  for (const [x, y] of pts) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? null : num / den;
}

export default function MetalsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let alive = true;

    fetch("/api/metals", { cache: "no-store" })
      .then(async (res) => {
        const text = await res.text();
        if (alive) setRawText(text.slice(0, 8000));

        if (!res.ok) throw new Error(`API status ${res.status}`);

        const json = JSON.parse(text);
        if (alive) setData(json);
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));

    return () => (alive = false);
  }, []);

  const curvesRaw = Array.isArray(data) ? data : data?.curves ?? [];

  const rows = useMemo(() => {
    return curvesRaw
      .map((r) => {
        const tenor = toNumOrNull(r.tenorMonths ?? r.tenor_months ?? r.months);
        if (tenor == null) return null;
        return {
          tenorMonths: tenor,
          goldToday: toNumOrNull(r.goldToday ?? r.gold),
          goldPrior: toNumOrNull(r.goldPrior),
          silverToday: toNumOrNull(r.silverToday ?? r.silver),
          silverPrior: toNumOrNull(r.silverPrior),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.tenorMonths - b.tenorMonths);
  }, [curvesRaw]);

  const spot =
    rows.find((r) => r.tenorMonths === 0) ||
    rows.find((r) => r.tenorMonths === 1) ||
    rows[0];

  const goldSpread =
    spot && rows.find((r) => r.tenorMonths === 12)
      ? rows.find((r) => r.tenorMonths === 12).goldToday - spot.goldToday
      : null;

  const silverSpread =
    spot && rows.find((r) => r.tenorMonths === 12)
      ? rows.find((r) => r.tenorMonths === 12).silverToday - spot.silverToday
      : null;

  const gsCorr = corr(
    rows.map((r) => r.goldToday),
    rows.map((r) => r.silverToday)
  );

  return (
    <main style={{ padding: 24 }}>
      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "red" }}>{error}</div>}

      <h1>Gold & Silver — Term Structure</h1>

<div style={{ fontSize: 13, opacity: 0.85, marginBottom: 12 }}>
  As of: <strong>{(Array.isArray(data) ? data?.[0]?.asOfDate : data?.asOfDate) ?? "--"}</strong>
  {"   "}
  Prior: <strong>{(Array.isArray(data) ? data?.[0]?.priorDate : data?.priorDate) ?? "--"}</strong>
</div>


      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div>
          <strong>Gold Spot</strong>
          <div>{spot?.goldToday ?? "--"}</div>
          <div>12m − 0m: {goldSpread?.toFixed(2) ?? "--"}</div>
        </div>
        <div>
          <strong>Silver Spot</strong>
          <div>{spot?.silverToday ?? "--"}</div>
          <div>12m − 0m: {silverSpread?.toFixed(2) ?? "--"}</div>
        </div>
        <div>
          <strong>Curve Correlation</strong>
          <div>{gsCorr?.toFixed(2) ?? "--"}</div>
        </div>
      </div>

      <div style={{ height: 300, marginTop: 24 }}>
        <ResponsiveContainer>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tenorMonths" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line dataKey="goldToday" name="Gold Today" dot={false} />
            <Line dataKey="goldPrior" name="Gold Prior" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ height: 300, marginTop: 24 }}>
        <ResponsiveContainer>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tenorMonths" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line dataKey="silverToday" name="Silver Today" dot={false} />
            <Line dataKey="silverPrior" name="Silver Prior" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <button onClick={() => setShowRaw(!showRaw)} style={{ marginTop: 20 }}>
        {showRaw ? "Hide Raw" : "Show Raw"}
      </button>

      {showRaw && <pre>{rawText}</pre>}
    </main>
  );
}
