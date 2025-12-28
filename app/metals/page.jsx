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
  ReferenceArea,
} from "recharts";

export default function MetalsPage() {
  const [data, setData] = useState(null);



  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
    const [showRaw, setShowRaw] = useState(false);

useEffect(() => {
  fetch("/api/metals")
    .then((r) => r.json())
    .then(setData)
    .catch(() => setError("Failed to load data"))
    .finally(() => setLoading(false));
}, []);

  const curves = data?.curves ?? [];

  const rows = useMemo(() => {
    return curves
      .filter((r) => Number.isFinite(r.tenorMonths))
      .sort((a, b) => a.tenorMonths - b.tenorMonths);
  }, [curves]);

  const goldSpot = rows.length ? rows[0].goldToday : null;
  const goldDelta =
    rows.length && rows[0].goldPrior != null
      ? rows[0].goldToday - rows[0].goldPrior
      : null;

  const silverSpot = rows.length ? rows[0].silverToday : null;
  const silverDelta =
    rows.length && rows[0].silverPrior != null
      ? rows[0].silverToday - rows[0].silverPrior
      : null;



  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
 <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 16,
    gap: 12,
  }}
>
  <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>
    Gold & Silver — Term Structure
  </h1>

  <div style={{ fontSize: 13, opacity: 0.8 }}>
    As of {data?.asOfDate ?? "—"}
    {data?.priorDate ? ` | Prior ${data.priorDate}` : ""}
  </div>
</div>



     

     <div style={{ marginTop: 24 }}>
       <div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 24,
  }}
>
  <div
    style={{
      padding: 12,
      border: "1px solid #ddd",
      borderRadius: 6,
    }}
  >
    <strong>Gold</strong>
    <div>Spot: {data?.goldSpot != null ? data.goldSpot.toFixed(2) : "—"}</div>
    <div>1D Change: {data?.goldDelta != null ? data.goldDelta.toFixed(2) : "—"}</div>
  </div>

  <div
    style={{
      padding: 12,
      border: "1px solid #ddd",
      borderRadius: 6,
    }}
  >
    <strong>Silver</strong>
    <div>Spot: {data?.silverSpot != null ? data.silverSpot.toFixed(2) : "—"}</div>
    <div>1D Change: {data?.silverDelta != null ? data.silverDelta.toFixed(2) : "—"}</div>
  </div>
</div>
       <div
  style={{
    marginTop: 24,
    padding: 12,
    border: "1px solid #ddd",
    borderRadius: 8,
    background: "white",
  }}
>
  <h2 style={{ margin: "0 0 12px 0", fontSize: 18 }}>
    Term Structure (Today vs Prior)
  </h2>

  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
    <thead>
      <tr>
        <th style={{ textAlign: "left", padding: "6px 4px" }}>Tenor (mo)</th>
        <th style={{ textAlign: "right", padding: "6px 4px" }}>Gold Today</th>
        <th style={{ textAlign: "right", padding: "6px 4px" }}>Gold Prior</th>
        <th style={{ textAlign: "right", padding: "6px 4px" }}>Silver Today</th>
        <th style={{ textAlign: "right", padding: "6px 4px" }}>Silver Prior</th>
      </tr>
    </thead>
    <tbody>
    {rows.map((row, i) => (

        <tr
          key={i}
          style={{
            background:
              row.tenorMonths <= 3 ? "#f9fafb" : "transparent",
          }}
        >
          <td style={{ padding: "4px" }}>{row.tenorMonths}</td>

          <td style={{ padding: "4px", textAlign: "right" }}>
            {row.goldToday != null ? row.goldToday.toFixed(2) : "—"}
          </td>

          <td style={{ padding: "4px", textAlign: "right", opacity: 0.7 }}>
            {row.goldPrior != null ? row.goldPrior.toFixed(2) : "—"}
          </td>

          <td style={{ padding: "4px", textAlign: "right" }}>
            {row.silverToday != null ? row.silverToday.toFixed(2) : "—"}
          </td>

          <td style={{ padding: "4px", textAlign: "right", opacity: 0.7 }}>
            {row.silverPrior != null ? row.silverPrior.toFixed(2) : "—"}
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
    }}
  >
    {JSON.stringify(data, null, 2)}
  </pre>
)}

</div>

     

  
   
  </div>


   
  


    </main>
  );
}
