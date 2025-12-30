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
    const x = xs[i];
    const y = ys[i];
    if (x == null || y == null) continue;
    pts.push([x, y]);
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
  if (!Number.isFinite(den) || den === 0) return null;
  return num / den;
}

function fmt2(v) {
  return v == null ? "--" : Number(v).toFixed(2);
}

function fmtPct(v) {
  return v == null ? "--" : `${(Number(v) * 100).toFixed(2)}%`;
}

function badgeTone(v) {
  // spreads: negative = backwardation; positive = contango
  if (v == null) return { background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb" };
  if (v < 0) return { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" };
  if (v > 0) return { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" };
  return { background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb" };
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
        if (!res.ok) throw new Error(`API status ${res.status}. First 200 chars: ${text.slice(0, 200)}`);
        const json = JSON.parse(text);
        if (alive) setData(json);
      })
      .catch((e) => alive && setError(String(e?.message || e)))
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

  const asOfDate = (Array.isArray(data) ? data?.[0]?.asOfDate : data?.asOfDate) ?? "--";
  const priorDate = (Array.isArray(data) ? data?.[0]?.priorDate : data?.priorDate) ?? "--";

  // Spot rows
  const spot =
    rows.find((r) => r.tenorMonths === 0) ||
    rows.find((r) => r.tenorMonths === 1) ||
    rows.find((r) => r.goldToday != null || r.silverToday != null) ||
    null;

  const goldSpot = spot?.goldToday ?? null;
  const silverSpot = spot?.silverToday ?? null;

  // Spreads (12m - 0m)
  const row12 = rows.find((r) => r.tenorMonths === 12) || null;

  const goldSpread12m = goldSpot != null && row12?.goldToday != null ? row12.goldToday - goldSpot : null;
  const silverSpread12m = silverSpot != null && row12?.silverToday != null ? row12.silverToday - silverSpot : null;

  // Correlation across the curve (today)
  const gsCorr = corr(
    rows.map((r) => r.goldToday),
    rows.map((r) => r.silverToday)
  );

  // Percent vs spot (shape view)
  const pctRows = useMemo(() => {
    const g0 = goldSpot;
    const s0 = silverSpot;
    return rows.map((r) => ({
      tenorMonths: r.tenorMonths,
      goldPct: g0 != null && r.goldToday != null ? r.goldToday / g0 - 1 : null,
      silverPct: s0 != null && r.silverToday != null ? r.silverToday / s0 - 1 : null,
      goldPctPrior:
        g0 != null && r.goldPrior != null && spot?.goldPrior != null ? r.goldPrior / spot.goldPrior - 1 : null,
      silverPctPrior:
        s0 != null && r.silverPrior != null && spot?.silverPrior != null ? r.silverPrior / spot.silverPrior - 1 : null,
    }));
  }, [rows, goldSpot, silverSpot, spot]);

  // Gold-to-silver ratio by tenor (difference view)
  const ratioRows = useMemo(() => {
    return rows
      .map((r) => {
        if (r.goldToday == null || r.silverToday == null || r.silverToday === 0) return null;
        const ratioToday = r.goldToday / r.silverToday;

        let ratioPrior = null;
        if (r.goldPrior != null && r.silverPrior != null && r.silverPrior !== 0) {
          ratioPrior = r.goldPrior / r.silverPrior;
        }

        return { tenorMonths: r.tenorMonths, ratioToday, ratioPrior };
      })
      .filter(Boolean);
  }, [rows]);

  // Simple front/back slope flags (uses 0, 1, 3, 12 if present)
  const r1 = rows.find((r) => r.tenorMonths === 1) || null;
  const r3 = rows.find((r) => r.tenorMonths === 3) || null;

  const goldFront = goldSpot != null && r1?.goldToday != null ? r1.goldToday - goldSpot : null;
  const goldMid = goldSpot != null && r3?.goldToday != null ? r3.goldToday - goldSpot : null;
  const goldBack = goldSpot != null && row12?.goldToday != null ? row12.goldToday - goldSpot : null;

  const silverFront = silverSpot != null && r1?.silverToday != null ? r1.silverToday - silverSpot : null;
  const silverMid = silverSpot != null && r3?.silverToday != null ? r3.silverToday - silverSpot : null;
  const silverBack = silverSpot != null && row12?.silverToday != null ? row12.silverToday - silverSpot : null;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      {loading && (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #ddd", borderRadius: 10 }}>
          Loading…
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            border: "1px solid #f5c2c7",
            borderRadius: 10,
            background: "#f8d7da",
            color: "#842029",
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: "pre-wrap",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Gold & Silver — Term Structure</h1>

        <div style={{ fontSize: 13, opacity: 0.85, textAlign: "right" }}>
          As of: <strong>{asOfDate}</strong> &nbsp; | &nbsp; Prior: <strong>{priorDate}</strong>
        </div>
      </div>

      {/* Top summary cards */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "white" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Gold</div>
            <div>Spot: {goldSpot != null ? fmt2(goldSpot) : "--"}</div>
            <div style={{ marginTop: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  ...badgeTone(goldSpread12m),
                }}
              >
                12m − 0m: {fmt2(goldSpread12m)}
              </span>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              1m−0m: {fmt2(goldFront)} &nbsp; | &nbsp; 3m−0m: {fmt2(goldMid)}
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "white" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Silver</div>
            <div>Spot: {silverSpot != null ? fmt2(silverSpot) : "--"}</div>
            <div style={{ marginTop: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  ...badgeTone(silverSpread12m),
                }}
              >
                12m − 0m: {fmt2(silverSpread12m)}
              </span>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              1m−0m: {fmt2(silverFront)} &nbsp; | &nbsp; 3m−0m: {fmt2(silverMid)}
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "white" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Gold vs Silver</div>
            <div>Curve Correlation (Today): {gsCorr != null ? gsCorr.toFixed(2) : "--"}</div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.85 }}>
              Backwardation = negative spread. Contango = positive spread.
            </div>
          </div>
        </div>
      </div>

      {/* Curve charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18, marginTop: 18 }}>
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "white" }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 18 }}>Absolute Prices (Today vs Prior)</h2>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line name="Gold Today" type="monotone" dataKey="goldToday" dot={false} />
                <Line name="Gold Prior" type="monotone" dataKey="goldPrior" dot={false} />
                <Line name="Silver Today" type="monotone" dataKey="silverToday" dot={false} />
                <Line name="Silver Prior" type="monotone" dataKey="silverPrior" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
            This view is dominated by gold’s price level. Use the next chart to compare *shape*.
          </div>
        </div>

        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "white" }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 18 }}>Curve Shape (% vs Spot)</h2>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pctRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip formatter={(v) => fmtPct(v)} />
                <Legend />
                <Line name="Gold % Today" type="monotone" dataKey="goldPct" dot={false} />
                <Line name="Silver % Today" type="monotone" dataKey="silverPct" dot={false} />
                <Line name="Gold % Prior" type="monotone" dataKey="goldPctPrior" dot={false} />
                <Line name="Silver % Prior" type="monotone" dataKey="silverPctPrior" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "white" }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 18 }}>Gold-to-Silver Ratio by Tenor</h2>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ratioRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line name="Ratio Today" type="monotone" dataKey="ratioToday" dot={false} />
                <Line name="Ratio Prior" type="monotone" dataKey="ratioPrior" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "white" }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: 18 }}>Term Structure Table</h2>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 4px" }}>Tenor</th>
              <th style={{ textAlign: "right", padding: "6px 4px" }}>Gold Today</th>
              <th style={{ textAlign: "right", padding: "6px 4px", opacity: 0.7 }}>Gold Prior</th>
              <th style={{ textAlign: "right", padding: "6px 4px" }}>Silver Today</th>
              <th style={{ textAlign: "right", padding: "6px 4px", opacity: 0.7 }}>Silver Prior</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: r.tenorMonths <= 3 ? "#f9fafb" : "transparent" }}>
                <td style={{ padding: "6px 4px" }}>{r.tenorMonths}m</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{fmt2(r.goldToday)}</td>
                <td style={{ padding: "6px 4px", textAlign: "right", opacity: 0.7 }}>{fmt2(r.goldPrior)}</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>{fmt2(r.silverToday)}</td>
                <td style={{ padding: "6px 4px", textAlign: "right", opacity: 0.7 }}>{fmt2(r.silverPrior)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowRaw((v) => !v)}
            style={{
              padding: "8px 10px",
              border: "1px solid #ddd",
              borderRadius: 10,
              background: "white",
              cursor: "pointer",
              fontSize: 13,
            }}
          >
            {showRaw ? "Hide raw JSON" : "Show raw JSON"}
          </button>
        </div>

        {showRaw && (
          <pre
            style={{
              marginTop: 10,
              padding: 12,
              border: "1px solid #ddd",
              borderRadius: 10,
              background: "#fafafa",
              fontSize: 12,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
            }}
          >
            {rawText || JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </main>
  );
}
