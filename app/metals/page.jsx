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
  const goldSpot = data?.gold?.spot ?? "—";
const goldChange = data?.gold?.change1d ?? "—";
const silverSpot = data?.silver?.spot ?? "—";
const silverChange = data?.silver?.change1d ?? "—";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
useEffect(() => {
  fetch("/api/metals")
    .then((r) => r.json())
    .then(setData)
    .catch(() => setError("Failed to load data"))
    .finally(() => setLoading(false));
}, []);

const gold = data?.gold;
const silver = data?.silver;

const goldSpot = gold?.spot ?? "—";
const goldChange = gold?.change1d ?? "—";

const silverSpot = silver?.spot ?? "—";



  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
  {data && (
  <div
    style={{
      marginBottom: 16,
      padding: 12,
      border: "1px solid #ddd",
      borderRadius: 6,
    }}
  >
    <div><strong>As of:</strong> {data.asOfDate}</div>
    <div><strong>Prior:</strong> {data.priorDate}</div>
  </div>
)}


      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>
        KMWM Metals Dashboard — Page 2
      </h1>

      <div style={{ marginTop: 12 }}>
        <a href="/goldcurve">← Back to Gold Curve</a>
      </div>

     <div style={{ marginTop: 24 }}>
       {data && (
  <div
    style={{
      marginBottom: 16,
      padding: 12,
      border: "1px solid #ddd",
      borderRadius: 6,
    }}
  >
    <div><strong>As of:</strong> {data.asOfDate}</div>
    <div><strong>Prior:</strong> {data.priorDate}</div>
  </div>
)}

  <h2 style={{ marginBottom: 12 }}>Metals Overview</h2>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: 16,
    }}
  >
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
      <strong>Gold</strong>
      <div>1D Change: {goldChange}</div>
      <div>1D Change: —</div>
    </div>

    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
      <strong>Silver</strong>
      <div>Spot: {silverSpot}</div>
      <div>1D Change: {silverChange}</div>
    </div>
  </div>
</div>

    </main>
  );
}
