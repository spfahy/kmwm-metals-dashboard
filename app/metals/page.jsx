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
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

 // TEMP: disable API loading
const data = {};


  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>
        KMWM Metals Dashboard — Page 2
      </h1>

      <div style={{ marginTop: 12 }}>
        <a href="/goldcurve">← Back to Gold Curve</a>
      </div>

     <div style={{ marginTop: 24 }}>
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
      <div>Spot: —</div>
      <div>1D Change: —</div>
    </div>

    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 10 }}>
      <strong>Silver</strong>
      <div>Spot: —</div>
      <div>1D Change: —</div>
    </div>
  </div>
</div>

    </main>
  );
}
