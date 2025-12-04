"use client";

import { useEffect, useState } from "react";

export default function GoldCurvePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/goldcurve", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load goldcurve data");
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error(e);
        setError(e.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading gold and silver curve…</div>;
  }

  if (error || !data) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        Error loading goldcurve dashboard: {error || "No data"}
      </div>
    );
  }

  const { asOfDate, curves, macro } = data;
  const gold = curves.find((c) => c.metal === "GOLD");
  const silver = curves.find((c) => c.metal === "SILVER");

  return (
    <div style={{ padding: 20 }}>
      <h1>Gold and Silver Futures – Table View</h1>
      <p style={{ fontSize: 12, color: "#555" }}>
        As of {asOfDate}. Real 10-year:{" "}
        {macro.real10y !== null ? `${macro.real10y.toFixed(2)}%` : "n/a"} · DXY:{" "}
        {macro.dollarIndex !== null ? macro.dollarIndex.toFixed(2) : "n/a"}
      </p>

      <h2 style={{ fontSize: 14, marginTop: 20 }}>Gold</h2>
      {gold ? (
        <TermTable curve={gold} />
      ) : (
        <p>No gold data found in API response.</p>
      )}

      <h2 style={{ fontSize: 14, marginTop: 20 }}>Silver</h2>
      {silver ? (
        <TermTable curve={silver} />
      ) : (
        <p>No silver data found in API response.</p>
      )}
    </div>
  );
}

function TermTable({ curve }) {
  return (
    <table
      style={{
        borderCollapse: "collapse",
        width: "100%",
        maxWidth: 600,
        fontSize: 12,
      }}
    >
      <thead>
        <tr>
          <th style={thCell}>Tenor (months)</th>
          <th style={thCell}>Price (today)</th>
        </tr>
      </thead>
      <tbody>
        {curve.points.map((p) => (
          <tr key={p.tenorMonths}>
            <td style={tdCell}>{p.tenorMonths}</td>
            <td style={tdCell}>{p.priceToday}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const thCell = {
  border: "1px solid #ccc",
  padding: "4px 6px",
  background: "#f2f2f2",
  textAlign: "right",
};

const tdCell = {
  border: "1px solid #ccc",
  padding: "4px 6px",
  textAlign: "right",
};
