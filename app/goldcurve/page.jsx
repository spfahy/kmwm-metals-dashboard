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
function computeDomain(values, padPct = 0.02) {
  if (clean.length === 0) return ["auto", "auto"];

  const min = Math.min(...clean);
  const max = Math.max(...clean);

  if (min === max) {
    const bump = Math.abs(min) * 0.01 || 1;
    return [min - bump, max + bump];
  }

  const range = max - min;
  const pad = range * padPct;

  return [min - pad, max + pad];
}

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
  const p = (points || []).find((x) => x?.tenorMonths === tenor);
  if (!p) return null;
  return which === "prior" ? p.pricePrior : p.priceToday;
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).split("T")[0] || String(value);
  return d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
}
function computeDomain(values, padPct = 0.02) {
  const clean = values.filter(
    (v) => v !== null && v !== undefined && !Number.isNaN(v)
  );
  if (clean.length === 0) return ["auto", "auto"];

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const pad = range * padPct;

  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

export default function GoldCurvePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/goldcurve", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (alive) setData(json);
      } catch (e) {
        if (alive) setError(String(e?.message || e));
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
    const t = new Set();
    for (const p of gold) if (p?.tenorMonths != null) t.add(p.tenorMonths);
    for (const p of silver) if (p?.tenorMonths != null) t.add(p.tenorMonths);
    return Array.from(t).sort((a, b) => a - b);
  }, [gold, silver]);
const curveChartData = tenors.map((t) => ({
  tenor: t,
  goldToday: priceAt(gold, t, "today"),
  goldPrior: hasPrior ? priceAt(gold, t, "prior") : null,
  silverToday: priceAt(silver, t, "today"),
  silverPrior: hasPrior ? priceAt(silver, t, "prior") : null,
}));

  const chartData = useMemo(() => {
    const goldDomain = computeDomain(
  curveChartData.flatMap(d => [d.goldToday, d.goldPrior]),
  0.02
);

const silverDomain = computeDomain(
  curveChartData.flatMap(d => [d.silverToday, d.silverPrior]),
  0.03
);

    return tenors.map((t) => ({
      tenor: t,
      goldToday: priceAt(gold, t, "today"),
      goldPrior: hasPrior ? priceAt(gold, t, "prior") : null,
      silverToday: priceAt(silver, t, "today"),
      silverPrior: hasPrior ? priceAt(silver, t, "prior") : null,
    }));
  }, [tenors, gold, silver, hasPrior]);

  // ---- RENDER (no hooks below this line) ----
  if (loading) return <div style={{ padding: 24 }}>Loading gold curve…</div>;

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Gold curve error</div>
        <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{error}</pre>
      </div>
    );
  }

  if (!data) return <div style={{ padding: 24 }}>No data returned.</div>;

  if (!Array.isArray(data?.curves)) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ fontWeight: 900, marginBottom: 8 }}>Invalid data shape</div>
        <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(data, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: 28, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ margin: 0, marginBottom: 10 }}>KMWM Metals Dashboard</h1>
      <div style={{ marginBottom: 18, color: "#555" }}>
        As of: <strong>{formatDate(data.asOfDate)}</strong>
        {hasPrior ? (
          <span style={{ marginLeft: 10 }}>
            Prior: <strong>{formatDate(data.priorDate)}</strong>
          </span>
        ) : null}
      </div>
const goldDomain = ["auto", "auto"];
const silverDomain = ["auto", "auto"];

      <div style={{ width: "100%", height: 360 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 10, right: 30, bottom: 30, left: 20 }}>
            <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            strokeOpacity={0.2}
    />
            <XAxis dataKey="tenor" type="number" domain={[0, 12]} allowDecimals={false} />
            <YAxis
  yAxisId="left"
  domain={goldDomain}
  tickCount={6}
  tick={{ fontSize: 12 }}
  label={{ value: "Gold ($)", angle: -90, position: "insideLeft", dx: -10 }}
/>

            <YAxis
  yAxisId="right"
  orientation="right"
  domain={silverDomain}
  tickCount={6}
  tick={{ fontSize: 12 }}
  label={{ value: "Silver ($)", angle: 90, position: "insideRight", dx: 10 }}
/>

            <Tooltip content={<CurveTooltip />} />
            <Line yAxisId="left" type="monotone" dataKey="goldToday" dot={false} />
            {hasPrior ? <Line yAxisId="left" type="monotone" dataKey="goldPrior" dot={false} strokeDasharray="6 4" /> : null}
            <Line yAxisId="right" type="monotone" dataKey="silverToday" dot={false} />
            {hasPrior ? <Line yAxisId="right" type="monotone" dataKey="silverPrior" dot={false} strokeDasharray="6 4" /> : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
