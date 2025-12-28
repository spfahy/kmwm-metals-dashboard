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
useEffect(() => {
  fetch("/api/metals")
    .then((r) => r.json())
    .then(setData)
    .catch(() => setError("Failed to load data"))
    .finally(() => setLoading(false));
}, []);




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
     

  
   
  </div>


   
  


    </main>
  );
}
