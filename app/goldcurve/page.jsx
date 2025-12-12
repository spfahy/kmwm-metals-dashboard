"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
} from "recharts";

function buildCurves(data) {
  const curves = data?.curves ?? [];
  const map = {};
  for (const c of curves) {
    map[c.metal.toUpperCase()] = c.points || [];
  }
  return map;
}

function formatNumber(v, digits = 2) {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Number(v).toFixed(digits);
}

function priceAt(points, tenor, which = "today") {
  const p = points.find((x) => x.tenorMonths === tenor);
  if (!p) return null;
  return which === "prior" ? p.pricePrior : p.priceToday;
}

// Simple slope between two tenors
function segmentSlope(points, t1, t2, which = "today") {
  const p1 = priceAt(points, t1, which);
  const p2 = priceAt(points, t2, which);
  if (p1 == null || p2 == null) return null;
  return (p2 - p1) / (t2 - t1);
}

// Classify curve shape: normal / flat / inverted based on total slope
function classifyCurve(points, which = "today") {
  const p0 = priceAt(points, 0, which);
  const p12 = priceAt(points, 12, which);
  if (p0 == null || p12 == null) return "No data";

  const slope = (p12 - p0) / 12;
  if (slope > 3) return "Steepening (normal)";
  if (slope < -3) return "Inverted / stressed";
  return "Flat / mild";
}
function regimeTag(points, which = "today") {
  const p0 = priceAt(points, 0, which);
  const p12 = priceAt(points, 12, which);
  if (p0 == null || p12 == null) return { label: "No data", detail: "" };

  const diff = p12 - p0;

  if (diff > 15) return { label: "Contango", detail: "upward carry" };
  if (diff < -15) return { label: "Backwardation", detail: "front-end stress" };
  return { label: "Flat", detail: "neutral carry" };
}

/**
 * Compute a tight axis domain from a list of values.
 * - Ignores null/undefined/NaN
 * - Adds padding so the line doesn't touch the chart frame
 */
function slopeLabel(slope, flatThreshold = 1) {
  if (slope == null) return "No data";
  if (slope > flatThreshold) return "Steepening";
  if (slope < -flatThreshold) return "Inverting";
  return "Flat";
}

function CurveTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  // payload entries come in as: goldToday, goldPrior, silverToday, silverPrior
  const byKey = {};
  for (const p of payload) {
    byKey[p.dataKey] = p.value;
  }

  const gT = byKey.goldToday;
  const gP = byKey.goldPrior;
  const sT = byKey.silverToday;
  const sP = byKey.silverPrior;

  const goldDelta = gT != null && gP != null ? gT - gP : null;
  const silverDelta = sT != null && sP != null ? sT - sP : null;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 10,
        fontSize: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>
        Tenor: {label} months
      </div>

      <div style={{ marginBottom: 6 }}>
        <div style={{ fontWeight: 600 }}>Gold</div>
        <div>Today: {gT == null ? "—" : Number(gT).toFixed(1)}</div>
        <div>Prior: {gP == null ? "—" : Number(gP).toFixed(1)}</div>
        <div>
          Change:{" "}
          {goldDelta == null ? "—" : (goldDelta >= 0 ? "+" : "") + goldDelta.toFixed(1)}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600 }}>Silver</div>
        <div>Today: {sT == null ? "—" : Number(sT).toFixed(2)}</div>
        <div>Prior: {sP == null ? "—" : Number(sP).toFixed(2)}</div>
        <div>
          Change:{" "}
          {silverDelta == null ? "—" : (silverDelta >= 0 ? "+" : "") + silverDelta.toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function computeDomain(values, padPct = 0.02) {
  const clean = (values || []).filter(
    (v) => v !== null && v !== undefined && !Number.isNaN(Number(v))
  );
  if (clean.length === 0) return ["auto", "auto"];

  const min = Math.min(...clean);
  const max = Math.max(...clean);

  // If flat line (min == max), widen a bit so axis still renders nicely
  if (min === max) {
    const bump = Math.abs(min) * 0.01 || 1;
    return [Math.floor(min - bump), Math.ceil(max + bump)];
  }

  const range = max - min;
  const pad = range * padPct;

  return [Math.floor(min - pad), Math.ceil(max + pad)];
}

/**
 * Custom legend that WRAPS cleanly (no overlap).
 * This is the fix for your legend writing over itself.
 */
function WrappedLegend(props) {
  const { payload } = props;
  if (!payload || payload.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: 14,
        paddingTop: 8,
        paddingBottom: 10,
        lineHeight: "16px",
      }}
    >
      {payload.map((entry) => (
        <div
          key={entry.dataKey}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span
            style={{
              width: 18,
              height: 0,
              borderTop: `3px ${entry.payload?.strokeDasharray ? "dashed" : "solid"} ${entry.color}`,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 13, color: "#333" }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}
function deltaAt(points, tenor) {
  const today = priceAt(points, tenor, "today");
  const prior = priceAt(points, tenor, "prior");
  if (today == null || prior == null) return null;
  return today - prior;
}

export default function GoldCurvePage() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  // Load today/prior curve
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/goldcurve", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load curve data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Load front-month history
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/metals-history", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setHistory(json.series || []);
      } catch (err) {
        console.error(err);
        setHistoryError(err.message || "Failed to load history");
      } finally {
        setHistoryLoading(false);
      }
    }
    loadHistory();
  }, []);

  if (loading) {
    return <div style={{ padding: 20 }}>Loading gold &amp; silver curves…</div>;
  }

  if (error || !data) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        Error loading dashboard: {error || "No curve data returned"}
      </div>
    );
  }

  const { asOfDate, priorDate, macro } = data;
  const hasPrior = !!priorDate;

  const curves = buildCurves(data);
  const gold = curves.GOLD || [];
  const silver = curves.SILVER || [];
  const goldDelta0 = deltaAt(gold, 0);
  const goldDelta12 = deltaAt(gold, 12);
  const silverDelta0 = deltaAt(silver, 0);
  const silverDelta12 = deltaAt(silver, 12);


  const tenors = Array.from(
    new Set([
      ...gold.map((p) => p.tenorMonths),
      ...silver.map((p) => p.tenorMonths),
    ])
  ).sort((a, b) => a - b);

  // Build Recharts data for term-structure chart
  const curveChartData = tenors.map((t) => ({
    tenor: t,
    goldToday: priceAt(gold, t, "today"),
    goldPrior: priceAt(gold, t, "prior"),
    silverToday: priceAt(silver, t, "today"),
    silverPrior: priceAt(silver, t, "prior"),
  }));

  // === Dynamic axis domains (tight scales) ===
  const goldDomain = computeDomain(
    curveChartData.flatMap((d) => [d.goldToday, d.goldPrior]),
    0.02
  );
  const silverDomain = computeDomain(
    curveChartData.flatMap((d) => [d.silverToday, d.silverPrior]),
    0.03
  );

  // Slope metrics
  const goldSlope_0_1 = segmentSlope(gold, 0, 1, "today");
  const goldSlope_1_3 = segmentSlope(gold, 1, 3, "today");
  const goldSlope_3_12 = segmentSlope(gold, 3, 12, "today");
  const goldSlope_total = segmentSlope(gold, 0, 12, "today");

  const silverSlope_0_1 = segmentSlope(silver, 0, 1, "today");
  const goldFrontStress = goldSlope_0_1 != null && Math.abs(goldSlope_0_1) > 20;
  const silverFrontStress = silverSlope_0_1 != null && Math.abs(silverSlope_0_1) > 1.25;
  const silverSlope_1_3 = segmentSlope(silver, 1, 3, "today");
  const silverSlope_3_12 = segmentSlope(silver, 3, 12, "today");
  const silverSlope_total = segmentSlope(silver, 0, 12, "today");
  const goldSlopeLabel = slopeLabel(goldSlope_total, 2);
  const silverSlopeLabel = slopeLabel(silverSlope_total, 0.1);

  const goldShape = classifyCurve(gold, "today");
  const silverShape = classifyCurve(silver, "today");
  const goldRegime = regimeTag(gold, "today");
  const silverRegime = regimeTag(silver, "today");

  return (
    <div style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Gold &amp; Silver Term Structure</h1>
      <div style={{ marginBottom: 4, color: "#555" }}>
        As of: <strong>{String(asOfDate) || "—"}</strong>
        {hasPrior && (
          <span style={{ marginLeft: 12, fontSize: 13, color: "#777" }}>
            (prior curve: <strong>{String(priorDate)}</strong>)
          </span>
        )}
      </div>
{hasPrior && (
  <div style={{ marginBottom: 10, color: "#666", fontSize: 13 }}>
    <strong>Regime:</strong>{" "}
    Gold {goldRegime.label}{" "}
    <span style={{ color: "#888" }}>({goldRegime.detail})</span> |{" "}
    Silver {silverRegime.label}{" "}
    <span style={{ color: "#888" }}>({silverRegime.detail})</span>
  </div>
)}
      <div style={{ fontSize: 12, color: "#777", marginTop: 4, marginBottom: 10 }}>
  Shaded area highlights front-end (0–3m) curve sensitivity
</div>

{(goldFrontStress || silverFrontStress) && (
  <div style={{ marginBottom: 12, fontSize: 13 }}>
    <strong style={{ color: "#b00020" }}>Front-End Stress:</strong>{" "}
    {goldFrontStress && <span style={{ marginRight: 12 }}>Gold 0→1m</span>}
    {silverFrontStress && <span>Silver 0→1m</span>}
  </div>
)}


      {/* Macro panel */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {/* Real 10Y */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: 12, color: "#777" }}>Real 10Y Yield</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {formatNumber(macro?.real10y)}%
          </div>
          {hasPrior && macro?.real10yPrior != null && (
            <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>
              Prev: {formatNumber(macro.real10yPrior)}%
            </div>
          )}
        </div>

        {/* Dollar Index */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: 12, color: "#777" }}>Dollar Index</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {formatNumber(macro?.dollarIndex)}
          </div>
          {hasPrior && macro?.dollarIndexPrior != null && (
            <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>
              Prev: {formatNumber(macro.dollarIndexPrior)}
            </div>
          )}
        </div>

        {/* Deficit Flag */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: 12, color: "#777" }}>Deficit Flag</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {macro?.deficitFlag ? "On" : "Off"}
          </div>
          {hasPrior && macro?.deficitFlagPrior != null && (
            <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>
              Prev: {macro.deficitFlagPrior ? "On" : "Off"}
            </div>
          )}
        </div>

        {/* Gold Front Month */}
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid #ddd",
            minWidth: 200,
          }}
        >
          <div style={{ fontSize: 12, color: "#777" }}>Gold Front-Month</div>
          <div style={{ fontSize: 20, fontWeight: 600 }}>
            {formatNumber(macro?.goldFrontMonth, 1)}
          </div>
          {hasPrior && macro?.goldFrontMonthPrior != null && (
            <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>
              Prev: {formatNumber(macro.goldFrontMonthPrior, 1)}
            </div>
          )}
        </div>
      </div>
{/* Legend ABOVE the chart (prevents all overlap issues) */}
<WrappedLegend
  payload={[
    { value: "Gold Today", color: "#d4af37" },
    { value: "Gold Prior", color: "#d4af37", payload: { strokeDasharray: "6 4" } },
    { value: "Silver Today", color: "#C0392B" },
    { value: "Silver Prior", color: "#C0392B", payload: { strokeDasharray: "6 4" } },
  ]}
/>

<div style={{ width: "100%", height: 360, marginBottom: 24 }}>

     
        <ResponsiveContainer>
          <LineChart
            data={curveChartData}
            margin={{ top: 10, right: 55, bottom: 95, left: 60 }} // more bottom for legend + axis label
          >
      <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />

<ReferenceArea
  x1={0}
  x2={3}
  yAxisId="left"
  fill="#000"
  fillOpacity={0.10}
  strokeOpacity={0}
/>


<XAxis
  dataKey="tenor"
  type="number"
  domain={[0, 12]}
  allowDecimals={false}
  label={{
    value: "Tenor (Months)",
    position: "bottom",
    offset: 15,
  }}
  tick={{ fontSize: 12 }}
/>



            {/* Left axis for Gold (tight scale) */}
            <YAxis
              yAxisId="left"
              domain={goldDomain}
              tick={{ fontSize: 12 }}
              tickCount={5}
              label={{
                value: "Gold",
                angle: -90,
                position: "insideLeft",
                dx: -10,
              }}
            />

            {/* Right axis for Silver (tight scale) */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={silverDomain}
              tick={{ fontSize: 12 }}
              tickCount={5}
              label={{
                value: "Silver",
                angle: 90,
                position: "insideRight",
                dx: 10,
              }}
            />

            
            <Tooltip content={<CurveTooltip />} />

           
            {/* GOLD: Today = thicker solid; Prior = thinner dashed */}
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="goldToday"
              name="Gold Today"
              stroke="#d4af37"
              strokeWidth={3}
              dot={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="goldPrior"
              name="Gold Prior"
              stroke="#d4af37"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
            />

            {/* SILVER: Today = thicker solid RED; Prior = thinner dashed RED */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="silverToday"
              name="Silver Today"
              stroke="#C0392B"
              strokeWidth={3}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="silverPrior"
              name="Silver Prior"
              stroke="#C0392B"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ====== SLOPE / CURVE-SHAPE METRICS ====== */}
      <h3>Curve Shape Metrics</h3>
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        {/* Gold metrics */}
        <div
          style={{
            flex: "1 1 260px",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Gold Curve</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
            Shape: <strong>{goldShape}</strong>
          </div>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              fontSize: 12,
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Segment</th>
                <th style={{ textAlign: "right", padding: "4px 6px" }}>
                  Slope (Today)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "3px 6px" }}>0→1m</td>
                <td style={{ padding: "3px 6px", textAlign: "right" }}>
                  {formatNumber(goldSlope_0_1, 2)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3px 6px" }}>1→3m</td>
                <td style={{ padding: "3px 6px", textAlign: "right" }}>
                  {formatNumber(goldSlope_1_3, 2)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3px 6px" }}>3→12m</td>
                <td style={{ padding: "3px 6px", textAlign: "right" }}>
                  {formatNumber(goldSlope_3_12, 2)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3px 6px" }}>0→12m (total)</td>
                <td style={{ padding: "3px 6px", textAlign: "right" }}>
                  {formatNumber(goldSlope_total, 2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Silver metrics */}
        <div
          style={{
            flex: "1 1 260px",
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Silver Curve</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
            Shape: <strong>{silverShape}</strong>
          </div>
          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              fontSize: 12,
            }}
          >
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "4px 6px" }}>Segment</th>
                <th style={{ textAlign: "right", padding: "4px 6px" }}>
                  Slope (Today)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: "3px 6px" }}>0→1m</td>
                <td style={{ padding: "3px 6px", textAlign: "right" }}>
                  {formatNumber(silverSlope_0_1, 2)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3px 6px" }}>1→3m</td>
                <td style={{ padding: "3px 6px", textAlign: "right" }}>
                  {formatNumber(silverSlope_1_3, 2)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3px 6px" }}>3→12m</td>
                <td style={{ padding: "3px 6px", textAlign: "right" }}>
                  {formatNumber(silverSlope_3_12, 2)}
                </td>
              </tr>
              <tr>
                <td style={{ padding: "3px 6px" }}>0→12m (total)</td>
                <td style={{ padding: "3px 6px", textAlign: "right" }}>
                  {formatNumber(silverSlope_total, 2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ====== TERM STRUCTURE TABLE (TODAY VS PRIOR) ====== */}
      <h3>Term Structure (Gold vs Silver)</h3>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          maxWidth: 900,
          marginBottom: 24,
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                borderBottom: "1px solid #ccc",
                padding: "6px 8px",
                textAlign: "left",
              }}
            >
              Tenor (months)
            </th>
            <th
              style={{
                borderBottom: "1px solid #ccc",
                padding: "6px 8px",
                textAlign: "right",
              }}
            >
              Gold (Today)
            </th>
            <th
              style={{
                borderBottom: "1px solid #ccc",
                padding: "6px 8px",
                textAlign: "right",
              }}
            >
              Gold (Prior)
            </th>
            <th
              style={{
                borderBottom: "1px solid #ccc",
                padding: "6px 8px",
                textAlign: "right",
              }}
            >
              Silver (Today)
            </th>
            <th
              style={{
                borderBottom: "1px solid #ccc",
                padding: "6px 8px",
                textAlign: "right",
              }}
            >
              Silver (Prior)
            </th>
          </tr>
        </thead>
        <tbody>
          {tenors.map((t) => (
            <tr key={t}>
              <td
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "4px 8px",
                }}
              >
                {t}
              </td>
              <td
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "4px 8px",
                  textAlign: "right",
                }}
              >
                {formatNumber(priceAt(gold, t, "today"), 1)}
              </td>
              <td
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "4px 8px",
                  textAlign: "right",
                }}
              >
                {hasPrior ? formatNumber(priceAt(gold, t, "prior"), 1) : "—"}
              </td>
              <td
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "4px 8px",
                  textAlign: "right",
                }}
              >
                {formatNumber(priceAt(silver, t, "today"), 2)}
              </td>
              <td
                style={{
                  borderBottom: "1px solid #eee",
                  padding: "4px 8px",
                  textAlign: "right",
                }}
              >
                {hasPrior ? formatNumber(priceAt(silver, t, "prior"), 2) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ====== FRONT-MONTH HISTORY CHART ====== */}
      <h3>Front-Month History (Gold vs Silver)</h3>
      {historyLoading && (
        <div style={{ padding: 8 }}>Loading front-month history…</div>
      )}
      {historyError && (
        <div style={{ padding: 8, color: "red" }}>
          Error loading history: {historyError}
        </div>
      )}
      {!historyLoading && !historyError && history && history.length > 0 && (
        <div style={{ width: "100%", height: 320, marginBottom: 24 }}>
          <ResponsiveContainer>
            <LineChart
  data={history}
  margin={{ top: 10, right: 55, bottom: 50, left: 60 }}
>

              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis
  yAxisId="left"
  domain={["auto", "auto"]}
  tick={{ fontSize: 12 }}
  tickCount={5}
  label={{ value: "Gold", angle: -90, position: "insideLeft", dx: -10 }}
/>

<YAxis
  yAxisId="right"
  orientation="right"
  domain={["auto", "auto"]}
  tick={{ fontSize: 12 }}
  tickCount={5}
  label={{ value: "Silver", angle: 90, position: "insideRight", dx: 10 }}
/>

              <Tooltip />
              <Legend />
            <Line
  yAxisId="left"
  type="monotone"
  dataKey="gold"
  name="Gold Front-Month"
  stroke="#d4af37"
  dot={false}
/>

            <Line
  yAxisId="right"
  type="monotone"
  dataKey="silver"
  name="Silver Front-Month"
  stroke="#ff4d4f"
  dot={false}
/>

            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ====== RAW JSON TOGGLE ====== */}
      <button
        onClick={() => setShowRaw((v) => !v)}
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          border: "1px solid #ccc",
          background: "#f7f7f7",
          cursor: "pointer",
          marginBottom: 8,
        }}
      >
        {showRaw ? "Hide raw JSON" : "Show raw JSON"}
      </button>

      {showRaw && (
        <pre
          style={{
            background: "#f4f4f4",
            padding: 12,
            borderRadius: 8,
            fontSize: 11,
            marginTop: 8,
            overflowX: "auto",
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
