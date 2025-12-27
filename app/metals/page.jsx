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

  if (loading) return <div style={{ padding: 24 }}>Loading metals…</div>;
  if (error) return <div style={{ padding: 24, color: "red" }}>{error}</div>;
  if (!data) return null;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>
        KMWM Metals Dashboard — Page 2
      </h1>

      <div style={{ marginTop: 12 }}>
        <a href="/goldcurve">← Back to Gold Curve</a>
      </div>

      <div
        style={{
          marginTop: 24,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 10,
        }}
      >
        <strong>Status:</strong> Page restored.  
        This is where your **second full dashboard page** lives.
      </div>
    </main>
  );
}
