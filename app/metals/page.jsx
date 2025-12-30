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

type CurveRow = {
  tenorMonths: number;
  goldToday: number | null;
  goldPrior: number | null;
  silverToday: number | null;
  silverPrior: number | null;
};

function toNumOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function corr(xs: Array<number | null>, ys: Array<number | null>): number | null {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x == null || y == null) continue;
    pts.push([x, y]);
  }
  if (pts.length < 3) return null;

  const meanX = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const meanY = pts.reduce((s, p) => s + p[1], 0) / pts.length;

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (const [x, y] of pts) {
    const dx = x - meanX;
    const dy = y - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  const den = Math.sqrt(denX) * Math.sqrt(denY);
  if (!Number.isFinite(den) || den === 0) return null;
  return num / den;
}

export default function MetalsPage() {
  const [data, setData] = useState<any>(null);
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

        if (!res.ok) {
          throw new Error(`API status ${res.status}. First 200 chars: ${text.slice(0, 200)}`);
        }

        const trimmed = (text || "").trim();
        if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
          throw new Error("API did not return JSON. First 200 chars: " + trimmed.slice(0, 200));
        }

        const json = JSON.parse(trimmed);
        if (alive) setData(json);
      })
      .catch((e) => {
        if (alive) setError(String(e?.message || e));
      })
      .finally(() => {
        if (alive) setLoading(false));
      });

    return () => {
      alive = false;
    };
  }, []);

  // Accept either:
  // 1) { curves: [...] }
  // 2) [...] (array response)
  const curvesRaw = useMemo(() => {
    if (Array.isArray(data)) return data;
    return data?.curves ?? [];
  }, [data]);

  const rows: CurveRow[] = useMemo(() => {
    return (curvesRaw || [])
      .map((r: any) => {
        const tenor = toNumOrNull(r.tenorMonths ?? r.tenor_months ?? r.tenor ?? r.months);
        if (tenor == null) return null;

        return {
          tenorMonths: tenor,
          goldToday: toNumOrNull(r.goldToday ?? r.gold_today ?? r.gold),
          goldPrior: toNumOrNull(r.goldPrior ?? r.gold_prior),
          silverToday: toNumOrNull(r.silverToday ?? r.silver_today ?? r.silver),
          silverPrior: toNumOrNull(r.silverPrior ?? r.silver_prior),
        } as CurveRow;
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.tenorMonths - b.tenorMonths) as CurveRow[];
  }, [curvesRaw]);

  // Spot: tenorMonths === 0 preferred, then 1, then first row with anything usable
  const spotRow =
    rows.find((r) => r.tenorMonths === 0) ||
    rows.find((r) => r.tenorMonths === 1) ||
    rows.find((r) => r.goldToday != null || r.silverToday != null) ||
    null;

  const goldSpot = spotRow?.goldToday ?? null;
  const goldDelta =
    spotRow?.goldToday != null && spotRow?.goldPrior != null
      ? spotRow.goldToday - spotRow.goldPrior
      : null;

  const silverSpot = spotRow?.silverToday ?? null;
  const silverDelta =
    spotRow?.silverToday != null && spotRow?.silverPrior != null
      ? spotRow.silverToday - spotRow.silverPrior
      : null;

  // Backwardation quick check: 12m - 0m (negative = backwardation)
  const row0 = rows.find((r) => r.tenorMonths === 0) || null;
  const row12 = rows.find((r) => r.tenorMonths === 12) || null;

  const goldSpread12m =
    row0?.goldToday != null && row12?.goldToday != null ? row12.goldToday - row0.goldToday : null;
  const silverSpread12m =
    row0?.silverToday != null && row12?.silverToday != null
      ? row12.silverToday - row0.silverToday
      : null;

  // Gold vs Silver curve correlation (today), across tenors
  const goldSeries = rows.map((r) => r.goldToday);
  const silverSeries = rows.map((r) => r.silverToday);
  const gsCorr = corr(goldSeries, silverSeries);

  // Gold-to-Silver ratio by tenor (today), useful for “differences”
  const ratioRows = useMemo(() => {
    return rows
      .map((r) => {
        if (r.goldToday == null || r.silverToday == null) return null;
        if (r.silverToday === 0) return null;
        return {
          tenorMonths: r.tenorMonths,
          ratioToday: r.goldToday / r.silverToday,
          ratioPrior:
            r.goldPrior != null && r.silverPrior != null && r.silverPrior !== 0
              ? r.goldPrior / r.silverPrior
              : null,
        };
      })
      .filter(Boolean) as Array<{ tenorMonths: number; ratioToday: number; ratioPrior: number | null }>;
  }, [rows]);

  const headerAsOf = (Array.isArray(data) ? data?.[0]?.asOfDate : data?.asOfDate) ?? "--";
  const headerPrior = (Array.isArray(data) ? data?.[0]?.priorDate : data?.priorDate) ?? "";

  const badgeStyle = (v: number | null) => {
    if (v == null) return { background: "#f3f4f6", color: "#111827" };
    // For spreads: negative = backwardation (good/interesting), positive = contango
    if (v < 0) return { background: "#dcfce7", color: "#166534" };
    if (v > 0) return { background: "#fee2e2", color: "#991b1b" };
    return { background: "#f3f4f6", color: "#111827" };
  };

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      {loading && (
        <div style={{ marginTop: 10, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
          Loading…
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            border: "1px solid #f5c2c7",
            borderRadius: 8,
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

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Gold & Silver — Term Structure</h1>

        <div style={{ fontSize: 13, opacity: 0.85, textAlign: "right" }}>
          As of {headerAsOf}
          {headerPrior ? ` | Prior ${headerPrior}` : ""}
        </div>
      </div>

      {/* Top cards */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <strong>Gold</strong>
            <div>Spot: {goldSpot != null ? goldSpot.toFixed(2) : "--"}</div>
            <div>1D Change: {goldDelta != null ? goldDelta.toFixed(2) : "--"}</div>
            <div style={{ marginTop: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                  ...badgeStyle(goldSpread12m),
                }}
              >
                12m − 0m: {goldSpread12m != null ? goldSpread12m.toFixed(2) : "--"}
              </span>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <strong>Silver</strong>
            <div>Spot: {silverSpot != null ? silverSpot.toFixed(2) : "--"}</div>
            <div>1D Change: {silverDelta != null ? silverDelta.toFixed(2) : "--"}</div>
            <div style={{ marginTop: 8 }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "4px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                  ...badgeStyle(silverSpread12m),
                }}
              >
                12m − 0m: {silverSpread12m != null ? silverSpread12m.toFixed(2) : "--"}
              </span>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
            <strong>Gold vs Silver</strong>
            <div>Curve Correlation (Today): {gsCorr != null ? gsCorr.toFixed(2) : "--"}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>
              (This compares today’s gold curve points to today’s silver curve points across tenors.)
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10, background: "white" }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 18 }}>Gold Curve (Today vs Prior)</h2>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line name="Gold Today" type="monotone" dataKey="goldToday" dot={false} />
                <Line name="Gold Prior" type="monotone" dataKey="goldPrior" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10, background: "white" }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 18 }}>Silver Curve (Today vs Prior)</h2>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line name="Silver Today" type="monotone" dataKey="silverToday" dot={false} />
                <Line name="Silver Prior" type="monotone" dataKey="silverPrior" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10, background: "white" }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 18 }}>Gold-to-Silver Ratio (Today vs Prior)</h2>
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
      <div style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 10, background: "white" }}>
        <h2 style={{ margin: "0 0 12px 0", fontSize: 18 }}>Term Structure (Today vs Prior)</h2>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 4px" }}>Tenor (months)</th>
              <th style={{ textAlign: "right", padding: "6px 4px" }}>Gold Today</th>
              <th style={{ textAlign: "right", padding: "6px 4px", opacity: 0.7 }}>Gold Prior</th>
              <th style={{ textAlign: "right", padding: "6px 4px" }}>Silver Today</th>
              <th style={{ textAlign: "right", padding: "6px 4px", opacity: 0.7 }}>Silver Prior</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                style={{
                  background: row.tenorMonths <= 3 ? "#f9fafb" : "transparent",
                }}
              >
                <td style={{ padding: "6px 4px" }}>{row.tenorMonths}</td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>
                  {row.goldToday != null ? row.goldToday.toFixed(2) : "--"}
                </td>
                <td style={{ padding: "6px 4px", textAlign: "right", opacity: 0.7 }}>
                  {row.goldPrior != null ? row.goldPrior.toFixed(2) : "--"}
                </td>
                <td style={{ padding: "6px 4px", textAlign: "right" }}>
                  {row.silverToday != null ? row.silverToday.toFixed(2) : "--"}
                </td>
                <td style={{ padding: "6px 4px", textAlign: "right", opacity: 0.7 }}>
                  {row.silverPrior != null ? row.silverPrior.toFixed(2) : "--"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
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
