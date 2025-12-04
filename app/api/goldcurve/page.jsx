"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

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

  const { asOfDate, priorDate, curves, macro } = data;

  const gold = curves.find((c) => c.metal === "GOLD");
  const silver = curves.find((c) => c.metal === "SILVER");

  const chartData = buildTermStructureData(gold, silver);

  return (
    <div style={{ padding: 20 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 20 }}>
            Gold and Silver Futures Term Structure
          </h1>
          <p style={{ margin: "4px 0", fontSize: 12, color: "#555" }}>
            As of {asOfDate}
            {priorDate ? ` (prior snapshot: ${priorDate})` : ""}.
          </p>
        </div>
        <div style={{ fontSize: 12, color: "#555", textAlign: "right" }}>
          <div>
            Real 10-year yield:{" "}
            {macro.real10y !== null ? `${macro.real10y.toFixed(2)}%` : "n/a"}
          </div>
          <div>
            Dollar index:{" "}
            {macro.dollarIndex !== null
              ? macro.dollarIndex.toFixed(2)
              : "n/a"}
          </div>
          <div>Deficit flag: {macro.deficitFlag ? "On" : "Off / n/a"}</div>
        </div>
      </header>

      <section
        style={{
          marginTop: 24,
          background: "white",
          padding: 16,
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 14 }}>
          Term Structure – Gold and Silver (Today)
        </h2>
        <div style={{ height: 360 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="tenorMonths"
                label={{
                  value: "Tenor (months)",
                  position: "insideBottom",
                  offset: -5,
                }}
              />
              <YAxis
                label={{
                  value: "Price",
                  angle: -90,
                  position: "insideLeft",
                }}
              />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="goldToday"
                name="Gold (today)"
                dot
              />
              <Line
                type="monotone"
                dataKey="silverToday"
                name="Silver (today)"
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function buildTermStructureData(gold, silver) {
  const byTenor = new Map();

  const add = (curve, keyPrefix) => {
    if (!curve) return;
    curve.points.forEach((p) => {
      const existing =
        byTenor.get(p.tenorMonths) || {
          tenorMonths: p.tenorMonths,
          goldToday: null,
          silverToday: null,
        };
      if (keyPrefix === "gold") {
        existing.goldToday = p.priceToday;
      } else {
        existing.silverToday = p.priceToday;
      }
      byTenor.set(p.tenorMonths, existing);
    });
  };

  add(gold, "gold");
  add(silver, "silver");

  return Array.from(byTenor.values()).sort(
    (a, b) => a.tenorMonths - b.tenorMonths
  );
}
