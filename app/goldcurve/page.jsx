// BASELINE STABLE — do not delete this file

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
function LegendRow({ hasPrior }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 10, marginBottom: 8 }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 18, borderTop: "3px solid #111", display: "inline-block" }} />
        Gold Today
      </span>

      {hasPrior ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 18, borderTop: "3px dashed #111", display: "inline-block" }} />
          Gold Prior
        </span>
      ) : null}

      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 18, borderTop: "3px solid #666", display: "inline-block" }} />
        Silver Today
      </span>

      {hasPrior ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 18, borderTop: "3px dashed #666", display: "inline-block" }} />
          Silver Prior
        </span>
      ) : null}
    </div>
  );
}


/* ===================== DATA HELPERS ===================== */
function buildCurves(data) {
  const curves = Array.isArray(data?.curves) ? data.curves : [];
  const map = {};
  for (const c of curves) {
    if (!c?.metal || !Array.isArray(c.points)) continue;
    map[String(c.metal).toUpperCase()] = c.points;
  }
  return map;
}

function priceAt(points, tenor, which = "today") {
  const p = (points || []).find((x) => Number(x.tenorMonths) === Number(tenor));
  if (!p) return null;
  return which === "prior" ? p.pricePrior : p.priceToday;
}

function computeDomain(values, padPct = 0.02) {
  const clean = (values || [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));

  if (clean.length === 0) return ["auto", "auto"];

  const min = Math.min(...clean);
  const max = Math.max(...clean);

  if (min === max) {
    const bump = Math.abs(min) * 0.01 || 1;
    return [Math.floor(min - bump), Math.ceil(max + bump)];
  }

  const range = max - min;
  const pad = range * padPct;
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    const s = String(value);
    return s.includes("T") ? s.split("T")[0] : s;
  }
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ===================== TOOLTIP ===================== */
function CurveTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const byKey = {};
  for (const p of payload) byKey[p.dataKey] = p.value;

  const gT = byKey.goldToday;
  const gP = byKey.goldPrior;
  const sT = byKey.silverToday;
  const sP = byKey.silverPrior;

  const goldDelta = gT != null && gP != null ? Number(gT) - Number(gP) : null;
  const silverDelta = sT != null && sP != null ? Number(sT) - Number(sP) : null;

  return (
    <div>
      <LegendRow hasPrior={hasPrior} />
{hasPrior && (
  <div style={{ fontSize: 12, marginBottom: 6, display: "flex", gap: 14, alignItems: "center" }}>
    <span>
      Gold Δ:{" "}
      <span style={{ color: goldDelta === null ? "#777" : goldDelta >= 0 ? "green" : "red", fontWeight: 700 }}>
        {goldDelta === null ? "–" : `${goldDelta >= 0 ? "+" : ""}${goldDelta.toFixed(1)}`}
      </span>
    </span>

    <span>
      Silver Δ:{" "}
      <span style={{ color: silverDelta === null ? "#777" : silverDelta >= 0 ? "green" : "red", fontWeight: 700 }}>
        {silverDelta === null ? "–" : `${silverDelta >= 0 ? "+" : ""}${silverDelta.toFixed(2)}`}
      </span>
    </span>
  </div>
)}


    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 10,
        padding: 10,
        fontSize: 12,
        boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Tenor: {label} months</div>

      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>Gold</div>
        <div>Today: {gT == null ? "—" : Number(gT).toFixed(1)}</div>
        <div>Prior: {gP == null ? "—" : Number(gP).toFixed(1)}</div>
        <div>
          Change:{" "}
          {goldDelta == null ? "—" : `${goldDelta >= 0 ? "+" : ""}${goldDelta.toFixed(1)}`}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700 }}>Silver</div>
        <div>Today: {sT == null ? "—" : Number(sT).toFixed(2)}</div>
        <div>Prior: {sP == null ? "—" : Number(sP).toFixed(2)}</div>
        <div>
          Change:{" "}
          {silverDelta == null ? "—" : `${silverDelta >= 0 ? "+" : ""}${silverDelta.toFixed(2)}`}
        </div>
      </div>
    </div>
    </div>
      );
}

function DeltaStrip({ chartData, hasPrior }) {
  if (!chartData || chartData.length === 0) return null;

  const last = chartData[chartData.length - 1];

  const goldDelta =
    hasPrior && last.goldToday != null && last.goldPrior != null
      ? last.goldToday - last.goldPrior
      : null;

  const silverDelta =
    hasPrior && last.silverToday != null && last.silverPrior != null
      ? last.silverToday - last.silverPrior
      : null;

  return (
    <div
      style={{
        marginTop: 12,
        marginBottom: 6,
        padding: "6px 10px",
        fontSize: 13,
        display: "flex",
        gap: 16,
        background: "#fafafa",
        border: "1px solid #ddd",
        borderRadius: 6,
      }}
    >
      <div>
        <strong>Gold Δ:</strong>{" "}
        {goldDelta == null ? "—" : goldDelta.toFixed(1)}
      </div>
      <div>
        <strong>Silver Δ:</strong>{" "}
        {silverDelta == null ? "—" : silverDelta.toFixed(2)}
      </div>
    </div>
  );
}

/* ===================== PAGE ===================== */
export default function GoldCurvePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch("/api/goldcurve", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (alive) setData(json);
      } catch (e) {
        if (alive) setError(String(e?.message || e || "Failed to load /api/goldcurve"));
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const curves = useMemo(() => buildCurves(data), [data]);
  const gold = curves.GOLD || [];
  const silver = curves.SILVER || [];

  const hasPrior = !!data?.priorDate;

  const tenors = useMemo(() => {
    const t = new Set([
      ...gold.map((p) => Number(p.tenorMonths)),
      ...silver.map((p) => Number(p.tenorMonths)),
    ]);
    return Array.from(t).filter(Number.isFinite).sort((a, b) => a - b);
  }, [gold, silver]);

  const chartData = useMemo(() => {
    return tenors.map((t) => ({
      tenor: t,
      goldToday: priceAt(gold, t, "today"),
      goldPrior: hasPrior ? priceAt(gold, t, "prior") : null,
      silverToday: priceAt(silver, t, "today"),
      silverPrior: hasPrior ? priceAt(silver, t, "prior") : null,
    }));
  }, [tenors, gold, silver, hasPrior]);

 const goldDomain = useMemo(
  () => computeDomain(chartData.flatMap((d) => [d.goldToday, d.goldPrior]), 0.02),
  [chartData]
);

const silverDomain = useMemo(
  () => computeDomain(chartData.flatMap((d) => [d.silverToday, d.silverPrior]), 0.03),
  [chartData]
);


  if (loading) return <div style={{ padding: 24 }}>Loading gold curve…</div>;
  if (error) return <pre style={{ padding: 24, color: "red" }}>{error}</pre>;
  if (!data || !Array.isArray(data.curves))
    return <pre style={{ padding: 24 }}>Invalid data shape: {JSON.stringify(data, null, 2)}</pre>;

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900 }}>KMWM Metals Dashboard</h1>
      <div style={{ marginTop: 8, color: "#555" }}>
        As of: <strong>{formatDate(data.asOfDate)}</strong>
        {data.priorDate ? (
          <span style={{ marginLeft: 12 }}>
            Prior: <strong>{formatDate(data.priorDate)}</strong>
          </span>
        ) : null}
      </div>  

      <DeltaStrip chartData={chartData} hasPrior={hasPrior} />
      
<div style={{ marginTop: 6, marginBottom: 6 }}>
  <LegendRow hasPrior={hasPrior} />
</div>
      <div style={{ marginTop: 12, width: "100%", height: 380, background: "white", border: "1px solid #e5e5e5", borderRadius: 12, padding: 12 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />

            <ReferenceArea x1={0} x2={3} fillOpacity={0.12} />

            <XAxis dataKey="tenor" type="number" domain={[0, 12]} allowDecimals={false} />

           <YAxis
  yAxisId="left"
  domain={goldDomain}
  tick={{ fontSize: 12 }}
  label={{ value: "Gold (United States dollars)", angle: -90, position: "insideLeft" }}
/>

<YAxis
  yAxisId="right"
  orientation="right"
  domain={silverDomain}
  tick={{ fontSize: 12 }}
  label={{ value: "Silver (United States dollars)", angle: 90, position: "insideRight" }}
/>


           <Tooltip formatter={(v) => (v == null ? "" : Number(v).toFixed(2))} />


            <Line yAxisId="left" type="monotone" dataKey="goldToday" dot={false} stroke="#111" strokeWidth={3} />
{hasPrior ? (
  <Line yAxisId="left" type="monotone" dataKey="goldPrior" dot={false} stroke="#111" strokeWidth={2} strokeDasharray="6 4" />
) : null}

<Line yAxisId="right" type="monotone" dataKey="silverToday" dot={false} stroke="#666" strokeWidth={3} />
{hasPrior ? (
  <Line yAxisId="right" type="monotone" dataKey="silverPrior" dot={false} stroke="#666" strokeWidth={2} strokeDasharray="6 4" />
) : null}

          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
