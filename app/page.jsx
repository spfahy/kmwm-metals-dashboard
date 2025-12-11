"use client";

import { useEffect, useState } from "react";

function buildCurves(data) {
  const curves = data?.curves ?? [];
  const map = {};
  for (const c of curves) {
    map[c.metal.toUpperCase()] = c.points || [];
  }
  return map;
}

function formatNumber(v, digits = 2) {
  if (v === null || v === undefined) return "—";
  return Number(v).toFixed(digits);
}

export default function GoldCurvePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/goldcurve", { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading gold &amp; silver curves…</div>;
  }

  if (error || !data) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        Error loading dashboard: {error || "No data returned"}
      </div>
    );
  }

  const { asOfDate, macro } = data;
  const curves = buildCurves(data);
  const gold = curves.GOLD || [];
  const silver = curves.SILVER || [];

  const tenors = Array.from(
    new Set([
      ...gold.map((p) => p.tenorMonths),
      ...silver.map((p) => p.tenorMonths),
    ])
  ).sort((a, b) => a - b);

  function priceAt(points, tenor) {
    const p = points.find((x) => x.tenorMonths === tenor);
    return p ? p.priceToday : null;
  }

  return (
    <div style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Gold &amp; Silver Term Structure</h1>
      <div style={{ marginBottom: 4, color: "#555" }}>
        As of: <strong>{asOfDate || "—"}</strong>
      </div>

      {/* Macro panel */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 12, color: "#777" }}>Real 10Y Yield</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {formatNumber(macro?.real10y)}
            <span style={{ fontSize: 12 }}>%</span>
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 12, color: "#777" }}>Dollar Index</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {formatNumber(macro?.dollarIndex)}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 12, color: "#777" }}>Deficit Flag</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {macro?.deficitFlag ? "On" : "Off"}
          </div>
        </div>

        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: 12, color: "#777" }}>Gold Front-Month</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {formatNumber(macro?.goldFrontMonth, 1)}
          </div>
        </div>
      </div>

      {/* Term structure table */}
      <h3>Term Structure (Gold vs Silver)</h3>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          maxWidth: 600,
          marginBottom: 24,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                borderBottom: "1px solid #ccc",
                padding: "6px 8px",
                textAlign: "left",
              }}
            >
              Tenor (months)
            </th>
            <th
              style={{
                borderBottom: "1px solid #ccc",
                padding: "6px 8px",
                textAlign: "right",
              }}
            >
              Gold
            </th>
            <th
              style={{
                borderBottom: "1px solid #ccc",
                padding: "6px 8px",
                textAlign: "right",
              }}
            >
              Silver
            </th>
          </tr>
        </thead>
        <tbody>
          {tenors.map((t) => (
            <tr key={t}>
              <td
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "4px 8px",
                }}
              >
                {t}
              </td>
              <td
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "4px 8px",
                  textAlign: "right",
                }}
              >
                {formatNumber(priceAt(gold, t), 1)}
              </td>
              <td
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "4px 8px",
                  textAlign: "right",
                }}
              >
                {formatNumber(priceAt(silver, t), 2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Raw JSON toggle */}
      <button
        onClick={() => setShowRaw((v) => !v)}
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid #ccc",
          background: "#f7f7f7",
          cursor: "pointer",
          marginBottom: 8,
        }}
      >
        {showRaw ? "Hide raw JSON" : "Show raw JSON"}
      </button>

      {showRaw && (
        <pre
          style={{
            background: "#f4f4f4",
            padding: 12,
            borderRadius: 8,
            fontSize: 11,
            marginTop: 8,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
