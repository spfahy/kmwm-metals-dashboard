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

/* ------------------ helpers ------------------ */

const toNumOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmtPct = (v) =>
  v == null ? "--" : `${(v * 100).toFixed(1)}%`;

const tightDomain = (values) => {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return ["auto", "auto"];
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  if (lo === hi) return [lo * 0.999, hi * 1.001];
  const pad = (hi - lo) * 0.03;
  return [lo - pad, hi + pad];
};

/* ------------------ page ------------------ */

export default function MetalsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/metals")
      .then((r) => r.json())
      .then(setData);
  }, []);

  /* -------- normalize rows -------- */

  const curvesRaw = Array.isArray(data?.curves)
    ? data.curves
    : Array.isArray(data)
    ? data
    : [];

  const trackedTenors = new Set([0, 1, 2, 3, 4, 5, 12]);

  const rows = useMemo(() => {
    return curvesRaw
      .map((r) => {
        const tenor =
          toNumOrNull(r.tenorMonths ?? r.tenor_months ?? r.months);
        if (!trackedTenors.has(tenor)) return null;

        const metal = String(r.metal ?? "").toLowerCase();
        const price = toNumOrNull(r.price);

        return {
          tenorMonths: tenor,

          goldToday:
            toNumOrNull(r.goldToday) ??
            (metal.includes("gold") ? price : null),

          silverToday:
            toNumOrNull(r.silverToday) ??
            (metal.includes("silver") ? price : null),

          goldPrior: toNumOrNull(r.goldPrior),
          silverPrior: toNumOrNull(r.silverPrior),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.tenorMonths - b.tenorMonths);
  }, [curvesRaw]);

  /* -------- derived -------- */

  const goldSpot = rows.find((r) => r.tenorMonths === 0)?.goldToday;
  const silverSpot = rows.find((r) => r.tenorMonths === 0)?.silverToday;

  const curveRows = rows.map((r) => ({
    ...r,
    goldPct:
      goldSpot != null && r.goldToday != null
        ? (r.goldToday - goldSpot) / goldSpot
        : null,
    goldPctPrior:
      goldSpot != null && r.goldPrior != null
        ? (r.goldPrior - goldSpot) / goldSpot
        : null,
    silverPct:
      silverSpot != null && r.silverToday != null
        ? (r.silverToday - silverSpot) / silverSpot
        : null,
    silverPctPrior:
      silverSpot != null && r.silverPrior != null
        ? (r.silverPrior - silverSpot) / silverSpot
        : null,
  }));

  const goldAbsDomain = tightDomain(
    rows.map((r) => r.goldToday)
  );
  const silverAbsDomain = tightDomain(
    rows.map((r) => r.silverToday)
  );
  const pctDomain = tightDomain(
    curveRows.flatMap((r) => [
      r.goldPct,
      r.goldPctPrior,
      r.silverPct,
      r.silverPctPrior,
    ])
  );

  if (!data) return null;

  /* ------------------ render ------------------ */

  return (
    <div style={{ padding: 16 }}>

      {/* ================= Curve Shape ================= */}

      <h2>Curve Shape (% vs Spot)</h2>

      <div style={{ height: 320 }}>
        <ResponsiveContainer>
          <LineChart
            data={curveRows}
            margin={{ top: 10, right: 16, left: 36, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tenorMonths" />
            <YAxis
              width={80}
              domain={pctDomain}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip formatter={fmtPct} />
            <Legend />

            <Line
              name="Gold % Today"
              dataKey="goldPct"
              stroke="#111827"
              strokeWidth={3}
              dot={false}
            />
            <Line
              name="Gold % Prior"
              dataKey="goldPctPrior"
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="8 5"
              dot={false}
            />
            <Line
              name="Silver % Today"
              dataKey="silverPct"
              stroke="#2563eb"
              strokeWidth={3}
              dot={false}
            />
            <Line
              name="Silver % Prior"
              dataKey="silverPctPrior"
              stroke="#93c5fd"
              strokeWidth={2}
              strokeDasharray="8 5"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ================= Absolute Charts ================= */}

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        {/* -------- Gold Absolute -------- */}
        <div style={{ border: "1px solid #ddd", padding: 12 }}>
          <h3>Gold (Absolute)</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart
                data={rows}
                margin={{ top: 10, right: 16, left: 36, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis width={80} domain={goldAbsDomain} />
                <Tooltip />
                <Legend />
                <Line
                  name="Gold Today"
                  dataKey="goldToday"
                  stroke="#111827"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  name="Gold Prior"
                  dataKey="goldPrior"
                  stroke="#9ca3af"
                  strokeWidth={2}
                  strokeDasharray="8 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* -------- Silver Absolute -------- */}
        <div style={{ border: "1px solid #ddd", padding: 12 }}>
          <h3>Silver (Absolute)</h3>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart
                data={rows}
                margin={{ top: 10, right: 16, left: 36, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis width={80} domain={silverAbsDomain} />
                <Tooltip />
                <Legend />
                <Line
                  name="Silver Today"
                  dataKey="silverToday"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  name="Silver Prior"
                  dataKey="silverPrior"
                  stroke="#93c5fd"
                  strokeWidth={2}
                  strokeDasharray="8 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
