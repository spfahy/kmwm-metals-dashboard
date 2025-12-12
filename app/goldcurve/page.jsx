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

function segmentSlope(points, t1, t2, which = "today") {
  const p1 = priceAt(points, t1, which);
  const p2 = priceAt(points, t2, which);
  if (p1 == null || p2 == null) return null;
  return (p2 - p1) / (t2 - t1);
}

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
  return { label: "Flat", detail: "no meaningful carry" };
}

function slopeLabel(slope, flatThreshold = 1) {
  if (slope == null) return "No data";
  if (slope > flatThreshold) return "Steepening";
  if (slope < -flatThreshold) return "Inverting";
  return "Flat";
}

function CurveTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const byKey = {};
  for (const p of payload) byKey[p.dataKey] = p.value;

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
          {goldDelta == null
            ? "—"
            : (goldDelta >= 0 ? "+" : "") + goldDelta.toFixed(1)}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 600 }}>Silver</div>
        <div>Today: {sT == null ? "—" : Number(sT).toFixed(2)}</div>
        <div>Prior: {sP == null ? "—" : Number(sP).toFixed(2)}</div>
        <div>
          Change:{" "}
          {silverDelta == null
            ? "—"
            : (silverDelta >= 0 ? "+" : "") + silverDelta.toFixed(2)}
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

  if (min === max) {
    const bump = Math.abs(min) * 0.01 || 1;
    return [Math.floor(min - bump), Math.ceil(max + bump)];
  }

  const range = max - min;
  const pad = range * padPct;
  return [Math.floor(min - pad), Math.ceil(max + pad)];
}
function safePctChange(from, to) {
  if (from == null || to == null || Number(from) === 0) return null;
  return ((Number(to) - Number(from)) / Number(from)) * 100;
}

function momentumLabel(historyArr, key, lookbackDays = 3, noiseThresholdPct = 0.3) {
  // Needs at least lookbackDays+1 points: e.g., 4 points for 3-day lookback
  if (!historyArr || historyArr.length < lookbackDays + 1) {
    return { label: "Insufficient history", pct: null, tag: "N/A" };
  }

  const last = historyArr[historyArr.length - 1]?.[key];
  const prior = historyArr[historyArr.length - 1 - lookbackDays]?.[key];

  const pct = safePctChange(prior, last);
  if (pct == null) return { label: "No data", pct: null, tag: "N/A" };

  const absPct = Math.abs(pct);
  const tag = absPct < noiseThresholdPct ? "Noise" : "Signal";

  const dir = pct > 0 ? "Up" : pct < 0 ? "Down" : "Flat";
  return { label: `${dir} (${tag})`, pct, tag };
}

function moveDriverLabel(frontSlope, backSlope, ratio = 1.5) {
  if (frontSlope == null || backSlope == null) return "No data";
  const f = Math.abs(frontSlope);
  const b = Math.abs(backSlope);

  if (f > b * ratio) return "Front-led";
  if (b > f * ratio) return "Back-led";
  return "Mixed";
}

function dailyAutoSummary({
  hasPrior,
  goldRegime,
  silverRegime,
  goldFrontStress,
  silverFrontStress,
  goldSlope_0_1,
  silverSlope_0_1,
  goldSince3d,
  silverSince3d,
  goldSince3dIsSignal,
  silverSince3dIsSignal,
  macro,
}) {
  // If we don’t have prior data, don’t pretend we do.
  if (!hasPrior) {
    return "Bottom line: Prior curve data is not available yet, so today’s read focuses on current curve shape and front-end stability only.";
  }

  const goldRegTxt = `Gold ${goldRegime.label.toLowerCase()} (${goldRegime.detail})`;
  const silverRegTxt = `Silver ${silverRegime.label.toLowerCase()} (${silverRegime.detail})`;

  const stressBits = [];
  if (goldFrontStress) stressBits.push(`Gold front-end stress flagged (0→1m slope ${Number(goldSlope_0_1).toFixed(2)})`);
  if (silverFrontStress) stressBits.push(`Silver front-end stress flagged (0→1m slope ${Number(silverSlope_0_1).toFixed(2)})`);
  const stressTxt =
    stressBits.length > 0
      ? stressBits.join(". ") + "."
      : `No front-end stress signals (Gold 0→1m ${goldSlope_0_1 == null ? "—" : Number(goldSlope_0_1).toFixed(2)}, Silver 0→1m ${silverSlope_0_1 == null ? "—" : Number(silverSlope_0_1).toFixed(2)}).`;

  const momTxt = `Momentum (3-day): Gold ${goldSince3dIsSignal ? "signal" : "noise"} (${goldSince3d == null ? "—" : (goldSince3d >= 0 ? "+" : "") + goldSince3d.toFixed(2) + "%"}) | Silver ${silverSince3dIsSignal ? "signal" : "noise"} (${silverSince3d == null ? "—" : (silverSince3d >= 0 ? "+" : "") + silverSince3d.toFixed(2) + "%"})`;

  const macroTxt =
    macro
      ? `Macro (vs prior): Real 10-year yield ${(macro.real10y != null && macro.real10yPrior != null) ? ((macro.real10y - macro.real10yPrior >= 0 ? "+" : "") + (macro.real10y - macro.real10yPrior).toFixed(2)) : "—"} pts | Dollar index ${(macro.dollarIndex != null && macro.dollarIndexPrior != null) ? ((macro.dollarIndex - macro.dollarIndexPrior >= 0 ? "+" : "") + (macro.dollarIndex - macro.dollarIndexPrior).toFixed(2)) : "—"}` 
      : "";

  return `Bottom line: ${goldRegTxt}; ${silverRegTxt}. ${stressTxt} ${momTxt}${macroTxt ? " " + macroTxt + "." : ""}`;
}

function WrappedLegend({ payload }) {
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
      {payload.map((entry, idx) => (
        <div
          key={`${entry.value}-${idx}`}
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <span
            style={{
              width: 18,
              height: 0,
              borderTop: `3px ${
                entry.payload?.strokeDasharray ? "dashed" : "solid"
              } ${entry.color}`,
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
function formatDate(value) {
  if (!value) return "—";

  const d = new Date(value);

  // If Date parsing fails, fall back to the raw string (or date part)
  if (Number.isNaN(d.getTime())) {
    const s = String(value);
    return s.includes("T") ? s.split("T")[0] : s;
  }

  // IMPORTANT: lock to UTC so you don't get "Dec 11" when you meant "Dec 12"
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function percentChange(from, to) {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

export default function GoldCurvePage() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

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
    new Set([...gold.map((p) => p.tenorMonths), ...silver.map((p) => p.tenorMonths)])
  ).sort((a, b) => a - b);

  const curveChartData = tenors.map((t) => ({
    tenor: t,
    goldToday: priceAt(gold, t, "today"),
    goldPrior: priceAt(gold, t, "prior"),
    silverToday: priceAt(silver, t, "today"),
    silverPrior: priceAt(silver, t, "prior"),
  }));

  const goldDomain = computeDomain(
    curveChartData.flatMap((d) => [d.goldToday, d.goldPrior]),
    0.02
  );
  const silverDomain = computeDomain(
    curveChartData.flatMap((d) => [d.silverToday, d.silverPrior]),
    0.03
  );

  const goldSlope_0_1 = segmentSlope(gold, 0, 1, "today");
  const goldSlope_1_3 = segmentSlope(gold, 1, 3, "today");
  const goldSlope_3_12 = segmentSlope(gold, 3, 12, "today");
  const goldSlope_total = segmentSlope(gold, 0, 12, "today");

  const silverSlope_0_1 = segmentSlope(silver, 0, 1, "today");
  const silverSlope_1_3 = segmentSlope(silver, 1, 3, "today");
  const silverSlope_3_12 = segmentSlope(silver, 3, 12, "today");
  const silverSlope_total = segmentSlope(silver, 0, 12, "today");

  const goldFrontStress = goldSlope_0_1 != null && Math.abs(goldSlope_0_1) > 20;
  const silverFrontStress =
    silverSlope_0_1 != null && Math.abs(silverSlope_0_1) > 1.25;

  const goldShape = classifyCurve(gold, "today");
  const silverShape = classifyCurve(silver, "today");
  const goldRegime = regimeTag(gold, "today");
  const silverRegime = regimeTag(silver, "today");
  // ===== 3-day momentum from front-month history (noise-filtered) =====
const historyOk = !historyLoading && !historyError && history && history.length > 0;
// ✅ REQUIRED: compute history domains BEFORE JSX
const historyGoldDomain =
  historyOk
    ? computeDomain(history.map((d) => d.gold))
    : ["auto", "auto"];

const historySilverDomain =
  historyOk
    ? computeDomain(history.map((d) => d.silver))
    : ["auto", "auto"];

const goldNow = historyOk ? history[history.length - 1]?.gold : null;
const silverNow = historyOk ? history[history.length - 1]?.silver : null;

const gold3dAgo = historyOk && history.length >= 4 ? history[history.length - 4]?.gold : null;
const silver3dAgo = historyOk && history.length >= 4 ? history[history.length - 4]?.silver : null;

const goldSince3d = percentChange(gold3dAgo, goldNow);     // percent
const silverSince3d = percentChange(silver3dAgo, silverNow); // percent

// Ignore zones (noise bands) — tweak anytime
const GOLD_IGNORE_3D = 0.30;   // percent
const SILVER_IGNORE_3D = 0.75; // percent

const goldSince3dIsSignal = goldSince3d != null && Math.abs(goldSince3d) >= GOLD_IGNORE_3D;
const silverSince3dIsSignal = silverSince3d != null && Math.abs(silverSince3d) >= SILVER_IGNORE_3D;

// ===== Daily summary string =====
const dailySummary = dailyAutoSummary({
  hasPrior,
  goldRegime,
  silverRegime,
  goldFrontStress,
  silverFrontStress,
  goldSlope_0_1,
  silverSlope_0_1,
  goldSince3d,
  silverSince3d,
  goldSince3dIsSignal,
  silverSince3dIsSignal,
  macro,
});

// ===== Daily Checklist (computed) =====
const goldDriver = moveDriverLabel(goldSlope_0_1, goldSlope_3_12, 1.5);
const silverDriver = moveDriverLabel(silverSlope_0_1, silverSlope_3_12, 1.5);

// Momentum (3-day lookback) with fixed "ignore zone" thresholds
// Gold: 0.30% noise band, Silver: 0.75% noise band
const goldMom3 = momentumLabel(history || [], "gold", 3, 0.30);
const silverMom3 = momentumLabel(history || [], "silver", 3, 0.75);

// Macro deltas vs prior (if your API provides prior fields)
const real10yDelta =
  macro?.real10y != null && macro?.real10yPrior != null
    ? Number(macro.real10y) - Number(macro.real10yPrior)
    : null;

const dollarDelta =
  macro?.dollarIndex != null && macro?.dollarIndexPrior != null
    ? Number(macro.dollarIndex) - Number(macro.dollarIndexPrior)
    : null;

  return (
    <div style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Gold &amp; Silver Term Structure</h1>

<div style={{ marginBottom: 4, color: "#555" }}>
  As of: <strong>{formatDate(asOfDate)}</strong>
  {hasPrior && (
    <span style={{ marginLeft: 12, fontSize: 13, color: "#777" }}>
      (prior curve: <strong>{formatDate(priorDate)}</strong>)
    </span>
  )}
</div>
 {/* ===== Daily Auto Summary ===== */}
<div
  style={{
    border: "1px solid #ddd",
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    background: "#fafafa",
    maxWidth: 920,
  }}
>
  <div style={{ fontWeight: 700, marginBottom: 6 }}>Daily Auto Summary</div>
  <div style={{ fontSize: 13, color: "#333", lineHeight: "18px" }}>
    {dailySummary}
  </div>
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
{/* ===== Daily Checklist ===== */}
<div
  style={{
    border: "1px solid #ddd",
    borderRadius: 10,
    padding: 14,
    marginTop: 14,
    marginBottom: 18,
    background: "#fafafa",
  }}
>
  <div style={{ fontWeight: 700, marginBottom: 10 }}>Daily Checklist</div>

  <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", rowGap: 8, columnGap: 12 }}>
    <div style={{ color: "#555" }}>1) Curve Regime (12m − 0m)</div>
    <div>
      Gold: <strong>{goldRegime.label}</strong> <span style={{ color: "#777" }}>({goldRegime.detail})</span>
      {"  "} | Silver: <strong>{silverRegime.label}</strong> <span style={{ color: "#777" }}>({silverRegime.detail})</span>
    </div>

    <div style={{ color: "#555" }}>2) Front-End Stress (0→1m slope)</div>
    <div>
  Gold: <strong>{formatNumber(goldSlope_0_1, 2)} /mo</strong>{" "}
{goldFrontStress ? (
  <strong style={{ color: "#b00020" }}>ALERT</strong>
) : (
  <span style={{ color: "#2e7d32", fontWeight: 600 }}>Normal</span>
)}
{" "} |{" "}
Silver: <strong>{formatNumber(silverSlope_0_1, 2)} /mo</strong>{" "}
{silverFrontStress ? (
  <strong style={{ color: "#b00020" }}>ALERT</strong>
) : (
  <span style={{ color: "#2e7d32", fontWeight: 600 }}>Normal</span>
)}
    </div>

    <div style={{ color: "#555" }}>3) Front vs Back Driver</div>
    <div>
      Gold: <strong>{goldDriver}</strong>{"  "} | Silver: <strong>{silverDriver}</strong>
    </div>
    </div>
    <div style={{ color: "#555" }}>4) Front-Month Momentum (3-day)</div>
    <div>
      Gold: <strong>{goldMom3.label}</strong>
      {goldMom3.pct != null && (
        <span style={{ color: "#777" }}>
          {" "}
          ({goldMom3.pct >= 0 ? "+" : ""}
          {goldMom3.pct.toFixed(2)}%)
        </span>
      )}
      {"  "} | Silver: <strong>{silverMom3.label}</strong>
      {silverMom3.pct != null && (
        <span style={{ color: "#777" }}>
          {" "}
          ({silverMom3.pct >= 0 ? "+" : ""}
          {silverMom3.pct.toFixed(2)}%)
        </span>
      )}
    </div>

    <div style={{ color: "#555" }}>5) Macro Check (vs prior)</div>
    <div>
      Real 10-Year Yield:{" "}
      <strong>{real10yDelta == null ? "N/A" : (real10yDelta >= 0 ? "+" : "") + real10yDelta.toFixed(2) + " pts"}</strong>
      {"  "} | Dollar Index:{" "}
      <strong>{dollarDelta == null ? "N/A" : (dollarDelta >= 0 ? "+" : "") + dollarDelta.toFixed(2)}</strong>
    </div>
  </div>

  <div style={{ marginTop: 10, fontSize: 12, color: "#777" }}>
    Ignore zones (noise bands): Gold ±0.30% (3-day), Silver ±0.75% (3-day). Alerts are only for front-end stress thresholds.
  </div>
</div>

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
        <div style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", minWidth: 180 }}>
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

        <div style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", minWidth: 180 }}>
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

        <div style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", minWidth: 180 }}>
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

        <div style={{ padding: 12, borderRadius: 8, border: "1px solid #ddd", minWidth: 200 }}>
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

      {/* Legend ABOVE the chart */}
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
            margin={{ top: 10, right: 55, bottom: 55, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />

            <ReferenceArea
  x1={0}
  x2={3}
  yAxisId="left"
  ifOverflow="extendDomain"
  fill="#999"
  fillOpacity={0.18}
  strokeOpacity={0}
/>


            <XAxis
              dataKey="tenor"
              type="number"
              domain={[0, 12]}
              allowDecimals={false}
              label={{ value: "Tenor (Months)", position: "bottom", offset: 15 }}
              tick={{ fontSize: 12 }}
            />

            <YAxis
              yAxisId="left"
              domain={goldDomain}
              tick={{ fontSize: 12 }}
              tickCount={5}
              label={{ value: "Gold", angle: -90, position: "insideLeft", dx: -10 }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              domain={silverDomain}
              tick={{ fontSize: 12 }}
              tickCount={5}
              label={{ value: "Silver", angle: 90, position: "insideRight", dx: 10 }}
            />

            <Tooltip content={<CurveTooltip />} />

            <Line yAxisId="left" type="monotone" dataKey="goldToday" stroke="#d4af37" strokeWidth={3} dot={false} />
            <Line yAxisId="left" type="monotone" dataKey="goldPrior" stroke="#d4af37" strokeWidth={2} strokeDasharray="6 4" dot={false} />

            <Line yAxisId="right" type="monotone" dataKey="silverToday" stroke="#C0392B" strokeWidth={3} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="silverPrior" stroke="#C0392B" strokeWidth={2} strokeDasharray="6 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Curve metrics */}
      <h3>Curve Shape Metrics</h3>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Gold Curve</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
            Shape: <strong>{goldShape}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            0→1m slope: {formatNumber(goldSlope_0_1, 2)}/mo | 1→3m slope: {formatNumber(goldSlope_1_3, 2)}/mo | 3→12m: {formatNumber(goldSlope_3_12, 2)} | 0→12m: {formatNumber(goldSlope_total, 2)}
          </div>
        </div>

        <div style={{ flex: "1 1 260px", border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Silver Curve</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
            Shape: <strong>{silverShape}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            0→1m slope: {formatNumber(silverSlope_0_1, 2)}/mo | 1→3m slope: {formatNumber(silverSlope_1_3, 2)}/mo | 3→12m: {formatNumber(silverSlope_3_12, 2)} | 0→12m: {formatNumber(silverSlope_total, 2)}
          </div>
        </div>
      </div>

      {/* Table */}
      <h3>Term Structure (Gold vs Silver)</h3>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 900, marginBottom: 24 }}>
        <thead>
          <tr>
            {["Tenor (months)", "Gold (Today)", "Gold (Prior)", "Silver (Today)", "Silver (Prior)"].map((h) => (
              <th key={h} style={{ borderBottom: "1px solid #ccc", padding: "6px 8px", textAlign: h === "Tenor (months)" ? "left" : "right" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tenors.map((t) => (
            <tr key={t}>
              <td style={{ borderBottom: "1px solid #eee", padding: "4px 8px" }}>{t}</td>
              <td style={{ borderBottom: "1px solid #eee", padding: "4px 8px", textAlign: "right" }}>
                {formatNumber(priceAt(gold, t, "today"), 1)}
              </td>
              <td style={{ borderBottom: "1px solid #eee", padding: "4px 8px", textAlign: "right" }}>
                {hasPrior ? formatNumber(priceAt(gold, t, "prior"), 1) : "—"}
              </td>
              <td style={{ borderBottom: "1px solid #eee", padding: "4px 8px", textAlign: "right" }}>
                {formatNumber(priceAt(silver, t, "today"), 2)}
              </td>
              <td style={{ borderBottom: "1px solid #eee", padding: "4px 8px", textAlign: "right" }}>
                {hasPrior ? formatNumber(priceAt(silver, t, "prior"), 2) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Front-month history */}
     {history && history.length > 0 && (
  <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
    Showing last <strong>{history.length}</strong> days (updates each morning)
  </div>
)}

      <h3>Front-Month History (Gold vs Silver)</h3>

      {historyLoading && <div style={{ padding: 8 }}>Loading front-month history…</div>}
      {historyError && <div style={{ padding: 8, color: "red" }}>Error loading history: {historyError}</div>}

      {historyOk && (
        <>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
            Gold axis = left, Silver axis = right (auto-scaled)
          </div>

          <div style={{ width: "100%", height: 320, marginBottom: 24 }}>
            <ResponsiveContainer>
              <LineChart data={history} margin={{ top: 10, right: 55, bottom: 35, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" />

                <YAxis
                  yAxisId="left"
                  domain={historyGoldDomain}
                  tick={{ fontSize: 12 }}
                  tickCount={5}
                  label={{ value: "Gold", angle: -90, position: "insideLeft", dx: -10 }}
                />

                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={historySilverDomain}
                  tick={{ fontSize: 12 }}
                  tickCount={5}
                  label={{ value: "Silver", angle: 90, position: "insideRight", dx: 10 }}
                />

                <Tooltip />
                <Legend />

                <Line yAxisId="left" type="monotone" dataKey="gold" name="Gold Front-Month" stroke="#d4af37" dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="silver" name="Silver Front-Month" stroke="#ff4d4f" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
           {/* ====== RAW JSON TOGGLE ====== */}
      <div style={{ marginTop: 10 }}>
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
    </div>
  );
}

