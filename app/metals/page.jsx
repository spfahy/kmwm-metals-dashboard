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
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const curves = data?.curves ?? [];

  const rows = useMemo(() => {
    return (curves || [])
      .filter((r) => Number.isFinite(Number(r.tenorMonths)) && Number(r.tenorMonths) > 0)
      .map((r) => ({
        tenorMonths: Number(r.tenorMonths),
        goldToday: r.goldToday == null ? null : Number(r.goldToday),
        goldPrior: r.goldPrior == null ? null : Number(r.goldPrior),
        silverToday: r.silverToday == null ? null : Number(r.silverToday),
        silverPrior: r.silverPrior == null ? null : Number(r.silverPrior),
      }))
      .sort((a, b) => a.tenorMonths - b.tenorMonths);
  }, [curves]);

    // Spot: use tenorMonths === 0 (sheet-defined spot). Fallback to 1 if 0 is missing.
const spotRow =
  rows.find((r) => r.tenorMonths === 0) ||
  rows.find((r) => r.tenorMonths === 1) ||
  rows.find((r) => r.goldToday != null || r.silverToday != null) ||
  null;


  const goldSpot = spotRow?.goldToday ?? null;
  const goldDelta =
    spotRow?.goldToday != null && spotRow?.goldPrior != null
      ? Number(spotRow.goldToday) - Number(spotRow.goldPrior)
      : null;

  const silverSpot = spotRow?.silverToday ?? null;
  const silverDelta =
    spotRow?.silverToday != null && spotRow?.silverPrior != null
      ? Number(spotRow.silverToday) - Number(spotRow.silverPrior)
      : null;

  const headerAsOf = data?.asOfDate ?? "--";
  const headerPrior = data?.priorDate ?? "";

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

      {/* Spot cards */}
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            marginBottom: 18,
          }}
        >
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 6 }}>
            <strong>Gold</strong>
            <div>Spot: {goldSpot != null ? goldSpot.toFixed(2) : "--"}</div>
            <div>1D Change: {goldDelta != null ? goldDelta.toFixed(2) : "--"}</div>
          </div>

          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 6 }}>
            <strong>Silver</strong>
            <div>Spot: {silverSpot != null ? silverSpot.toFixed(2) : "--"}</div>
            <div>1D Change: {silverDelta != null ? silverDelta.toFixed(2) : "--"}</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 18 }}>
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "white" }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 18 }}>Gold Curve (Today vs Prior)</h2>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="goldToday" dot={false} />
                <Line type="monotone" dataKey="goldPrior" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "white" }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 18 }}>Silver Curve (Today vs Prior)</h2>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="silverToday" dot={false} />
                <Line type="monotone" dataKey="silverPrior" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ marginTop: 18, padding: 12, border: "1px solid #ddd", borderRadius: 8, background: "white" }}>
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

        <div style={{ marginTop: 12 }}>
          <button
            onClick={() => setShowRaw((v) => !v)}
            style={{
              padding: "8px 10px",
              border: "1px solid #ddd",
              borderRadius: 8,
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
              borderRadius: 8,
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
