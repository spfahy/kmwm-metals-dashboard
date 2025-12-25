"use client";
export const dynamic = "force-dynamic";

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

function buildCurves(data) {
  const curves = Array.isArray(data?.curves) ? data.curves : [];
  const map = {};

  for (const c of curves) {
    if (!c?.metal || !Array.isArray(c.points)) continue;
    map[c.metal.toUpperCase()] = c.points;
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

function carry(points, t1, t2, which = "today") {
  const p1 = priceAt(points, t1, which);
  const p2 = priceAt(points, t2, which);
  if (p1 == null || p2 == null) return null;
  return p2 - p1;
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

function slopeChange(points, t1, t2) {
  const sToday = segmentSlope(points, t1, t2, "today");
  const sPrior = segmentSlope(points, t1, t2, "prior");
  if (sToday == null || sPrior == null) return null;
  return sToday - sPrior;
}

function interpretSlope(slopePerMonth, thresholds = { flat: 0.5, mild: 2.0 }) {
  if (slopePerMonth == null) return "No data";
  const v = Number(slopePerMonth);
  const abs = Math.abs(v);

  if (abs <= thresholds.flat) return "Flat";
  if (abs <= thresholds.mild) return v > 0 ? "Gentle upward carry" : "Gentle inversion";
  return v > 0 ? "Upward carry (steep)" : "Inversion (sharp)";
}

function moveDriverLabel(frontSlope, backSlope, ratio = 1.5) {
  if (frontSlope == null || backSlope == null) return "No data";
  const f = Math.abs(frontSlope);
  const b = Math.abs(backSlope);

  if (f > b * ratio) return "Front-led";
  if (b > f * ratio) return "Back-led";
  return "Mixed";
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

function percentChange(from, to) {
  if (from == null || to == null || from === 0) return null;
  return ((to - from) / from) * 100;
}

/* ===================== UI HELPERS ===================== */
function Chip({ children }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: "1px solid #e6e6e6",
        background: "#fbfbfb",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function Card({ title, right, children }) {
  return (
    <div
      style={{
        border: "1px solid #e6e6e6",
        borderRadius: 12,
        padding: 14,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 900 }}>{title}</div>
        {right ? <div style={{ fontSize: 12, color: "#666" }}>{right}</div> : null}
      </div>
      <div style={{ marginTop: 10 }}>{children}</div>
    </div>
  );
}

function StatCard({ label, value, subline }) {
  return (
    <div
      style={{
        border: "1px solid #e6e6e6",
        borderRadius: 12,
        padding: 12,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4 }}>{value}</div>
      {subline ? (
        <div style={{ fontSize: 12, color: "#777", marginTop: 4 }}>{subline}</div>
      ) : null}
    </div>
  );
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

/* ===================== TOOLTIPS ===================== */
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
          {goldDelta == null ? "—" : (goldDelta >= 0 ? "+" : "") + goldDelta.toFixed(1)}
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700 }}>Silver</div>
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

function HistoryTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const byKey = {};
  for (const p of payload) byKey[p.dataKey] = p.value;

  const gold = byKey.gold;
  const silver = byKey.silver;

  return (
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
      <div style={{ fontWeight: 800, marginBottom: 6 }}>
        Date: {label}
      </div>
      <div>Gold: {gold == null ? "—" : Number(gold).toFixed(1)}</div>
      <div>Silver: {silver == null ? "—" : Number(silver).toFixed(2)}</div>
    </div>
  );
}

/* ===================== ALERTS ===================== */
function metalAlert(points, metalName, frontStressAbsSlopeThreshold, decimals) {
  if (!points || points.length < 4) {
    return {
      headline: `${metalName}: insufficient curve data`,
      detail: "Need at least 0m, 1m, 3m, 12m points.",
      level: "neutral",
    };
  }

  const s01 = segmentSlope(points, 0, 1, "today");
  const s03 = segmentSlope(points, 0, 3, "today");
  const s012 = segmentSlope(points, 0, 12, "today");
  const c012 = carry(points, 0, 12, "today");

  const carry12 = c012 == null ? null : Number(c012);

  const regime =
    carry12 == null
      ? "Unknown"
      : carry12 > 15
      ? "Contango"
      : carry12 < -15
      ? "Backwardation"
      : "Flat";

  const frontStress = s01 != null && Math.abs(s01) > frontStressAbsSlopeThreshold;

  const headline = frontStress
    ? `${metalName} front-end: STRESS`
    : `${metalName} curve: ${regime.toLowerCase()}`;

  const detail = `Slopes ($/mo): 0→1m ${
    s01 == null ? "—" : s01.toFixed(2)
  } · 0→3m ${s03 == null ? "—" : s03.toFixed(2)} · 0→12m ${
    s012 == null ? "—" : s012.toFixed(2)
  } | Carry (12m−0m): ${
    carry12 == null ? "—" : `${carry12 >= 0 ? "+" : ""}${carry12.toFixed(decimals)}`
  }`;

  return {
    headline,
    detail,
    level: frontStress ? "alert" : "ok",
  };
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
  if (!hasPrior) {
    return {
      headline:
        "Bottom line: Prior curve data is not available yet — today’s read is current curve shape and front-end stability only.",
      bullets: [
        `Carry: Gold ${goldRegime.label} (${goldRegime.detail}) | Silver ${silverRegime.label} (${silverRegime.detail})`,
        `Front-end (0→1m): Gold ${
          goldSlope_0_1 == null ? "—" : Number(goldSlope_0_1).toFixed(2)
        } /mo | Silver ${
          silverSlope_0_1 == null ? "—" : Number(silverSlope_0_1).toFixed(2)
        } /mo`,
      ],
    };
  }

  const stressLine = `Stress: ${goldFrontStress ? "Gold ALERT" : "Gold Normal"} | ${
    silverFrontStress ? "Silver ALERT" : "Silver Normal"
  }`;

  const momLine = `Momentum (3-day): Gold ${
    goldSince3dIsSignal ? "Signal" : "Noise"
  } ${
    goldSince3d == null
      ? "(—)"
      : `(${goldSince3d >= 0 ? "+" : ""}${goldSince3d.toFixed(2)}%)`
  } | Silver ${silverSince3dIsSignal ? "Signal" : "Noise"} ${
    silverSince3d == null
      ? "(—)"
      : `(${silverSince3d >= 0 ? "+" : ""}${silverSince3d.toFixed(2)}%)`
  }`;

  const macroLine = macro
    ? `Macro (vs prior): Real 10-year ${
        macro.real10y != null && macro.real10yPrior != null
          ? `${macro.real10y - macro.real10yPrior >= 0 ? "+" : ""}${(
              macro.real10y - macro.real10yPrior
            ).toFixed(2)} pts`
          : "—"
      } | Dollar index ${
        macro.dollarIndex != null && macro.dollarIndexPrior != null
          ? `${macro.dollarIndex - macro.dollarIndexPrior >= 0 ? "+" : ""}${(
              macro.dollarIndex - macro.dollarIndexPrior
            ).toFixed(2)}`
          : "—"
      }`
    : "Macro (vs prior): —";

  return {
    headline: `Bottom line: Gold ${goldRegime.label.toLowerCase()} (${goldRegime.detail}); Silver ${silverRegime.label.toLowerCase()} (${silverRegime.detail}).`,
    bullets: [
      stressLine,
      `Front-end (0→1m): Gold ${
        goldSlope_0_1 == null ? "—" : Number(goldSlope_0_1).toFixed(2)
      } /mo | Silver ${
        silverSlope_0_1 == null ? "—" : Number(silverSlope_0_1).toFixed(2)
      } /mo`,
      momLine,
      macroLine,
    ],
  };
}

export default function GoldCurvePage() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState(null);
  const [historyError, setHistoryError] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  // ===== RENDER GUARDS (PREVENT REACT 310 CRASH) =====
 

  if (error) {
    return (
      <pre style={{ padding: 24, color: "red" }}>
        {String(error)}
      </pre>
    );
  }

  if (!data || !Array.isArray(data.curves)) {
    return (
      <pre style={{ padding: 24 }}>
        Invalid data shape:
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }

useEffect(() => {
  let alive = true;

  async function load() {
    try {
      const res = await fetch("/api/goldcurve");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (alive) setData(json);
    } catch (err) {
      if (alive) setError(err.message || "Failed to load curve data");
    } finally {
      if (alive) setLoading(false);
    }
  }

  load();
  return () => {
    alive = false;
  };
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

  const { asOfDate, priorDate, macro, stressStreak } = data;
  const hasPrior = !!priorDate;

  const curves = useMemo(() => {
  if (!data || !Array.isArray(data.curves)) return {};
  return buildCurves(data);
}, [data]);

  const gold = curves.GOLD || [];
  const silver = curves.SILVER || [];

  // Tenors used in curve chart
  const tenors = Array.from(
    new Set([...gold.map((p) => p.tenorMonths), ...silver.map((p) => p.tenorMonths)])
  ).sort((a, b) => a - b);

  const curveChartData = tenors.map((t) => ({
    tenor: t,
    goldToday: priceAt(gold, t, "today"),
    goldPrior: hasPrior ? priceAt(gold, t, "prior") : null,
    silverToday: priceAt(silver, t, "today"),
    silverPrior: hasPrior ? priceAt(silver, t, "prior") : null,
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
  const goldSlope_3_12 = segmentSlope(gold, 3, 12, "today");
  const silverSlope_0_1 = segmentSlope(silver, 0, 1, "today");
  const silverSlope_3_12 = segmentSlope(silver, 3, 12, "today");

  const goldSlopeChg_0_1 = hasPrior ? slopeChange(gold, 0, 1) : null;
  const goldSlopeChg_1_3 = hasPrior ? slopeChange(gold, 1, 3) : null;
  const goldSlopeChg_3_12 = hasPrior ? slopeChange(gold, 3, 12) : null;

  const silverSlopeChg_0_1 = hasPrior ? slopeChange(silver, 0, 1) : null;
  const silverSlopeChg_1_3 = hasPrior ? slopeChange(silver, 1, 3) : null;
  const silverSlopeChg_3_12 = hasPrior ? slopeChange(silver, 3, 12) : null;

  const goldFrontStress = goldSlope_0_1 != null && Math.abs(goldSlope_0_1) > 20;
  const silverFrontStress = silverSlope_0_1 != null && Math.abs(silverSlope_0_1) > 1.25;

  const goldShape = classifyCurve(gold, "today");
  const silverShape = classifyCurve(silver, "today");

  const goldRegime = regimeTag(gold, "today");
  const silverRegime = regimeTag(silver, "today");

  const goldCarry_0_3 = carry(gold, 0, 3, "today");
  const silverCarry_0_3 = carry(silver, 0, 3, "today");

  const goldCarryText =
    goldCarry_0_3 == null ? "—" : `${goldCarry_0_3 >= 0 ? "+" : ""}${goldCarry_0_3.toFixed(2)}`;
  const silverCarryText =
    silverCarry_0_3 == null ? "—" : `${silverCarry_0_3 >= 0 ? "+" : ""}${silverCarry_0_3.toFixed(2)}`;

  const historyOk = !historyLoading && !historyError && history && history.length > 0;

  const historyGoldDomain = historyOk ? computeDomain(history.map((d) => d.gold)) : ["auto", "auto"];
  const historySilverDomain = historyOk ? computeDomain(history.map((d) => d.silver)) : ["auto", "auto"];

  const goldNow = historyOk ? history[history.length - 1]?.gold : null;
  const silverNow = historyOk ? history[history.length - 1]?.silver : null;

  const gold3dAgo = historyOk && history.length >= 4 ? history[history.length - 4]?.gold : null;
  const silver3dAgo = historyOk && history.length >= 4 ? history[history.length - 4]?.silver : null;

  const goldSince3d = percentChange(gold3dAgo, goldNow);
  const silverSince3d = percentChange(silver3dAgo, silverNow);

  const GOLD_IGNORE_3D = 0.30;
  const SILVER_IGNORE_3D = 0.75;

  const goldSince3dIsSignal = goldSince3d != null && Math.abs(goldSince3d) >= GOLD_IGNORE_3D;
  const silverSince3dIsSignal = silverSince3d != null && Math.abs(silverSince3d) >= SILVER_IGNORE_3D;

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

  const goldDriver = moveDriverLabel(goldSlope_0_1, goldSlope_3_12, 1.5);
  const silverDriver = moveDriverLabel(silverSlope_0_1, silverSlope_3_12, 1.5);

  const goldMom3 = momentumLabel(history || [], "gold", 3, 0.30);
  const silverMom3 = momentumLabel(history || [], "silver", 3, 0.75);

  const real10yDelta =
    macro?.real10y != null && macro?.real10yPrior != null
      ? Number(macro.real10y) - Number(macro.real10yPrior)
      : null;

  const dollarDelta =
    macro?.dollarIndex != null && macro?.dollarIndexPrior != null
      ? Number(macro.dollarIndex) - Number(macro.dollarIndexPrior)
      : null;

  const real10yDeltaText =
    real10yDelta == null ? "N/A" : `${real10yDelta >= 0 ? "+" : ""}${real10yDelta.toFixed(2)} pts`;

  const dollarDeltaText =
    dollarDelta == null ? "N/A" : `${dollarDelta >= 0 ? "+" : ""}${dollarDelta.toFixed(2)}`;

  const goldStressLabel = goldFrontStress ? "Front-End Stress" : "Normal";
  const silverStressLabel = silverFrontStress ? "Front-End Stress" : "Normal";

  // Alerts (executive)
  const goldAlert = metalAlert(gold, "Gold", 20, 2);
  const silverAlert = metalAlert(silver, "Silver", 1.25, 2);

  const SILVER_NEUTRAL = "#666666";
  const GOLD_COLOR = "#d4af37";
  const ALERT_RED = "#b00020";

  const curveLegendPayload = useMemo(() => {
    const items = [
      { value: "Gold Today", color: GOLD_COLOR },
      ...(hasPrior ? [{ value: "Gold Prior", color: GOLD_COLOR, payload: { strokeDasharray: "6 4" } }] : []),
      { value: "Silver Today", color: SILVER_NEUTRAL },
      ...(hasPrior ? [{ value: "Silver Prior", color: SILVER_NEUTRAL, payload: { strokeDasharray: "6 4" } }] : []),
    ];
    return items;
  }, [hasPrior]);

  const historyLegendPayload = useMemo(() => {
    return [
      { value: "Gold Front-Month", color: GOLD_COLOR },
      { value: "Silver Front-Month", color: SILVER_NEUTRAL },
    ];
  }, []);

  return (
    <div style={{ padding: 32, fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ marginBottom: 8 }}>Gold &amp; Silver Term Structure</h1>

      {/* ===== PRIMARY VERDICT (Executive banner) ===== */}
      <div
        style={{
          marginTop: 10,
          marginBottom: 14,
          padding: "10px 14px",
          borderRadius: 12,
          border: `1px solid ${goldFrontStress || silverFrontStress ? "#f1c1c7" : "#e6e6e6"}`,
          background: goldFrontStress || silverFrontStress ? "#fff7f8" : "#fbfbfb",
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 14 }}>Primary Regime:</div>

        <Chip>
          Gold: {goldRegime.label}{" "}
          <span style={{ color: "#777", fontWeight: 800 }}>({goldRegime.detail})</span>
        </Chip>

        <Chip>
          Silver: {silverRegime.label}{" "}
          <span style={{ color: "#777", fontWeight: 800 }}>({silverRegime.detail})</span>
        </Chip>

        <Chip>
          Carry (0→3m): Gold <strong style={{ marginLeft: 6 }}>{goldCarryText}</strong> | Silver{" "}
          <strong style={{ marginLeft: 6 }}>{silverCarryText}</strong>
        </Chip>

        <Chip>
          Front-end: Gold{" "}
          <strong style={{ color: goldFrontStress ? ALERT_RED : "#2e7d32" }}>
            {goldFrontStress ? "Stress" : "Normal"}
          </strong>
          {goldFrontStress && stressStreak?.gold ? (
            <span style={{ marginLeft: 6, color: "#777", fontWeight: 800 }}>
              (Day {stressStreak.gold})
            </span>
          ) : null}
          {" "} | Silver{" "}
          <strong style={{ color: silverFrontStress ? ALERT_RED : "#2e7d32" }}>
            {silverFrontStress ? "Stress" : "Normal"}
          </strong>
          {silverFrontStress && stressStreak?.silver ? (
            <span style={{ marginLeft: 6, color: "#777", fontWeight: 800 }}>
              (Day {stressStreak.silver})
            </span>
          ) : null}
        </Chip>

        <Chip>
          Momentum (3-day): Gold <strong style={{ marginLeft: 6 }}>{goldMom3.label}</strong> | Silver{" "}
          <strong style={{ marginLeft: 6 }}>{silverMom3.label}</strong>
        </Chip>
      </div>

      <div style={{ marginBottom: 10, color: "#555" }}>
        As of: <strong>{formatDate(asOfDate)}</strong>
        {hasPrior && (
          <span style={{ marginLeft: 12, fontSize: 13, color: "#777" }}>
            (prior curve: <strong>{formatDate(priorDate)}</strong>)
          </span>
        )}
      </div>

      {/* ===== AT-A-GLANCE STRIP (signals only) ===== */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <Chip>
          Regime: {goldRegime.label} / {silverRegime.label}
        </Chip>
        <Chip>
          Front-end stress: Gold {goldStressLabel} | Silver {silverStressLabel}
        </Chip>
        <Chip>
          Momentum (3-day): Gold {goldMom3.tag} | Silver {silverMom3.tag}
        </Chip>
        <Chip>
          Macro Δ: Real 10-year {real10yDeltaText} | Dollar index {dollarDeltaText}
        </Chip>
      </div>

      <div style={{ fontSize: 12, color: "#777", marginBottom: 12 }}>
        Shaded area highlights front-end (0–3m) curve sensitivity
      </div>

      {/* ===== EXEC ALERT PANELS (Gold + Silver) ===== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            border: `1px solid ${goldAlert.level === "alert" ? "#f1c1c7" : "#e6e6e6"}`,
            background: goldAlert.level === "alert" ? "#fff7f8" : "#ffffff",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 900, color: goldAlert.level === "alert" ? ALERT_RED : "#222" }}>
            {goldAlert.headline}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{goldAlert.detail}</div>
        </div>

        <div
          style={{
            border: `1px solid ${silverAlert.level === "alert" ? "#f1c1c7" : "#e6e6e6"}`,
            background: silverAlert.level === "alert" ? "#fff7f8" : "#ffffff",
            borderRadius: 12,
            padding: 12,
          }}
        >
          <div style={{ fontWeight: 900, color: silverAlert.level === "alert" ? ALERT_RED : "#222" }}>
            {silverAlert.headline}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{silverAlert.detail}</div>
        </div>
      </div>

      {/* ===== SUMMARY + CHECKLIST ===== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
          gap: 14,
          marginBottom: 12,
        }}
      >
        <Card title="Daily Auto Summary" right={hasPrior ? "Includes vs prior read" : "Prior not available"}>
          <div style={{ fontSize: 13, color: "#333", lineHeight: "18px" }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>{dailySummary.headline}</div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {dailySummary.bullets.map((b, i) => (
                <Chip key={i}>{b}</Chip>
              ))}
            </div>

            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => setShowDetails((v) => !v)}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #ccc",
                  background: "#f7f7f7",
                  cursor: "pointer",
                }}
              >
                {showDetails ? "Hide details" : "Show details"}
              </button>

              {showDetails && (
                <div style={{ marginTop: 10, fontSize: 12, color: "#555", lineHeight: "18px" }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Daily Summary Details</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>
                    {dailySummary.bullets.map((b) => `• ${b}`).join("\n")}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card title="Daily Checklist" right={hasPrior ? "Fast scan" : "Current curve only"}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "240px 1fr",
              columnGap: 12,
              rowGap: 8,
              fontSize: 13,
              lineHeight: "18px",
            }}
          >
            <div style={{ color: "#555" }}>1) Curve Regime (12m − 0m)</div>
            <div>
              Gold: <strong>{goldRegime.label}</strong>{" "}
              <span style={{ color: "#777" }}>({goldRegime.detail})</span> | Silver:{" "}
              <strong>{silverRegime.label}</strong>{" "}
              <span style={{ color: "#777" }}>({silverRegime.detail})</span>
            </div>

            <div style={{ color: "#555" }}>2) Front-End Stress (0→1m slope)</div>
            <div>
              Gold: <strong>{formatNumber(goldSlope_0_1, 2)} /mo</strong>{" "}
              {goldFrontStress ? (
                <strong style={{ color: ALERT_RED }}>ALERT</strong>
              ) : (
                <span style={{ color: "#2e7d32", fontWeight: 700 }}>Normal</span>
              )}{" "}
              | Silver: <strong>{formatNumber(silverSlope_0_1, 2)} /mo</strong>{" "}
              {silverFrontStress ? (
                <strong style={{ color: ALERT_RED }}>ALERT</strong>
              ) : (
                <span style={{ color: "#2e7d32", fontWeight: 700 }}>Normal</span>
              )}
            </div>

            <div style={{ color: "#555" }}>3) Front vs Back Driver</div>
            <div>
              Gold: <strong>{goldDriver}</strong> | Silver: <strong>{silverDriver}</strong>
            </div>

            <div style={{ color: "#555" }}>4) Front-Month Momentum (3-day)</div>
            <div>
              Gold: <strong>{goldMom3.label}</strong>{" "}
              {goldMom3.pct != null ? (
                <span style={{ color: "#777" }}>
                  ({goldMom3.pct >= 0 ? "+" : ""}
                  {goldMom3.pct.toFixed(2)}%)
                </span>
              ) : null}{" "}
              | Silver: <strong>{silverMom3.label}</strong>{" "}
              {silverMom3.pct != null ? (
                <span style={{ color: "#777" }}>
                  ({silverMom3.pct >= 0 ? "+" : ""}
                  {silverMom3.pct.toFixed(2)}%)
                </span>
              ) : null}
            </div>

            <div style={{ color: "#555" }}>5) Macro Check (vs prior)</div>
            <div>
              Real 10-year: <strong>{real10yDeltaText}</strong> | Dollar index:{" "}
              <strong>{dollarDeltaText}</strong>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, color: "#777" }}>
            Ignore zones (noise bands): Gold ±0.30% (3-day), Silver ±0.75% (3-day). Alerts are only for front-end stress thresholds.
          </div>
        </Card>
      </div>

      {/* ===== CHANGE SINCE PRIOR (what moved) ===== */}
      {hasPrior && (
        <div style={{ marginBottom: 14 }}>
          <Card title="Change Since Prior (Curve Segments)" right="Today slope minus prior slope">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 1fr",
                rowGap: 10,
                columnGap: 12,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 900, color: "#555" }} />
              <div style={{ fontWeight: 900 }}>Gold</div>
              <div style={{ fontWeight: 900 }}>Silver</div>

              <div style={{ color: "#555" }}>0→1 month</div>
              <div>
                {formatNumber(goldSlopeChg_0_1, 2)} /mo{" "}
                <span style={{ color: "#777" }}>({interpretSlope(goldSlopeChg_0_1)})</span>
              </div>
              <div>
                {formatNumber(silverSlopeChg_0_1, 2)} /mo{" "}
                <span style={{ color: "#777" }}>({interpretSlope(silverSlopeChg_0_1)})</span>
              </div>

              <div style={{ color: "#555" }}>1→3 months</div>
              <div>
                {formatNumber(goldSlopeChg_1_3, 2)} /mo{" "}
                <span style={{ color: "#777" }}>({interpretSlope(goldSlopeChg_1_3)})</span>
              </div>
              <div>
                {formatNumber(silverSlopeChg_1_3, 2)} /mo{" "}
                <span style={{ color: "#777" }}>({interpretSlope(silverSlopeChg_1_3)})</span>
              </div>

              <div style={{ color: "#555" }}>3→12 months</div>
              <div>
                {formatNumber(goldSlopeChg_3_12, 2)} /mo{" "}
                <span style={{ color: "#777" }}>({interpretSlope(goldSlopeChg_3_12)})</span>
              </div>
              <div>
                {formatNumber(silverSlopeChg_3_12, 2)} /mo{" "}
                <span style={{ color: "#777" }}>({interpretSlope(silverSlopeChg_3_12)})</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ===== MACRO CARDS GRID ===== */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          marginTop: 6,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="Real 10-year yield"
          value={`${formatNumber(macro?.real10y)}%`}
          subline={
            hasPrior && macro?.real10yPrior != null
              ? `Prior: ${formatNumber(macro.real10yPrior)}% | Δ ${real10yDeltaText}`
              : null
          }
        />
        <StatCard
          label="Dollar index"
          value={formatNumber(macro?.dollarIndex)}
          subline={
            hasPrior && macro?.dollarIndexPrior != null
              ? `Prior: ${formatNumber(macro.dollarIndexPrior)} | Δ ${dollarDeltaText}`
              : null
          }
        />
        <StatCard
          label="Deficit flag"
          value={macro?.deficitFlag ? "On" : "Off"}
          subline={
            hasPrior && macro?.deficitFlagPrior != null
              ? `Prior: ${macro.deficitFlagPrior ? "On" : "Off"}`
              : null
          }
        />
        <StatCard
          label="Gold front-month"
          value={formatNumber(macro?.goldFrontMonth, 1)}
          subline={
            hasPrior && macro?.goldFrontMonthPrior != null
              ? `Prior: ${formatNumber(macro.goldFrontMonthPrior, 1)}`
              : null
          }
        />
      </div>

      {/* Legend ABOVE the curve chart */}
      <WrappedLegend payload={curveLegendPayload} />

      {/* Curve chart */}
      <div style={{ width: "100%", height: 360, marginBottom: 24 }}>
        <ResponsiveContainer>
          <LineChart data={curveChartData} margin={{ top: 10, right: 55, bottom: 55, left: 60 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />

            <ReferenceArea
              x1={0}
              x2={3}
              yAxisId="left"
              ifOverflow="extendDomain"
              fill="#999"
              fillOpacity={0.18}
              strokeOpacity={0}
              label={{
                value: "Front-End Sensitivity Zone (0–3 months)",
                position: "insideTopLeft",
                fill: "#555",
                fontSize: 12,
                fontWeight: 800,
              }}
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

            <Line yAxisId="left" type="monotone" dataKey="goldToday" stroke={GOLD_COLOR} strokeWidth={3} dot={false} />
            {hasPrior ? (
              <Line yAxisId="left" type="monotone" dataKey="goldPrior" stroke={GOLD_COLOR} strokeWidth={2} strokeDasharray="6 4" dot={false} />
            ) : null}

            <Line yAxisId="right" type="monotone" dataKey="silverToday" stroke="#666666" strokeWidth={3} dot={false} />
            {hasPrior ? (
              <Line yAxisId="right" type="monotone" dataKey="silverPrior" stroke="#666666" strokeWidth={2} strokeDasharray="6 4" dot={false} />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Curve metrics */}
      <h3>Curve Shape Metrics</h3>
      <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Gold Curve</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
            Shape: <strong>{goldShape}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            0→1m slope: {formatNumber(segmentSlope(gold, 0, 1, "today"), 2)}/mo | 1→3m slope:{" "}
            {formatNumber(segmentSlope(gold, 1, 3, "today"), 2)}/mo | 3→12m:{" "}
            {formatNumber(segmentSlope(gold, 3, 12, "today"), 2)} | 0→12m:{" "}
            {formatNumber(segmentSlope(gold, 0, 12, "today"), 2)}
          </div>
        </div>

        <div style={{ flex: "1 1 260px", border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Silver Curve</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>
            Shape: <strong>{silverShape}</strong>
          </div>
          <div style={{ fontSize: 12, color: "#555" }}>
            0→1m slope: {formatNumber(segmentSlope(silver, 0, 1, "today"), 2)}/mo | 1→3m slope:{" "}
            {formatNumber(segmentSlope(silver, 1, 3, "today"), 2)}/mo | 3→12m:{" "}
            {formatNumber(segmentSlope(silver, 3, 12, "today"), 2)} | 0→12m:{" "}
            {formatNumber(segmentSlope(silver, 0, 12, "today"), 2)}
          </div>
        </div>
      </div>

      {/* Table */}
      <h3>Term Structure (Gold vs Silver)</h3>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 900, marginBottom: 24 }}>
        <thead>
          <tr>
            {["Tenor (months)", "Gold (Today)", "Gold (Prior)", "Silver (Today)", "Silver (Prior)"].map((h) => (
              <th
                key={h}
                style={{
                  borderBottom: "1px solid #ccc",
                  padding: "6px 8px",
                  textAlign: h === "Tenor (months)" ? "left" : "right",
                }}
              >
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

          <WrappedLegend payload={historyLegendPayload} />

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

                <Tooltip content={<HistoryTooltip />} />

                <Line yAxisId="left" type="monotone" dataKey="gold" name="Gold Front-Month" stroke={GOLD_COLOR} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="silver" name="Silver Front-Month" stroke={SILVER_NEUTRAL} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {/* ====== RAW JSON TOGGLE ====== */}
      <div style={{ marginTop: 10 }}>
        <button
          onClick={() => setShowRawJson((v) => !v)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #ccc",
            background: "#f7f7f7",
            cursor: "pointer",
            marginBottom: 8,
          }}
        >
          {showRawJson ? "Hide raw JSON" : "Show raw JSON"}
        </button>

        {showRawJson && (
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
