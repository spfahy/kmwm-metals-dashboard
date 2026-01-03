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

/* ================= helpers ================= */

const toNumOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmtPct = (v) => (v == null ? "--" : `${(v * 100).toFixed(1)}%`);

const fmtAbs = (v) =>
  v == null
    ? "--"
    : Number(v).toLocaleString(undefined, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });

const fmtRatio = (v) =>
  v == null
    ? "--"
    : Number(v).toLocaleString(undefined, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
      });

const tightDomain = (values) => {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return ["auto", "auto"];
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  if (lo === hi) return [lo * 0.999, hi * 1.001];
  const pad = (hi - lo) * 0.03;
  return [lo - pad, hi + pad];
};

const corr = (xs, ys) => {
  const pairs = xs
    .map((x, i) => [x, ys[i]])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pairs.length < 3) return null;

  const x = pairs.map((p) => p[0]);
  const y = pairs.map((p) => p[1]);

  const mx = x.reduce((s, v) => s + v, 0) / x.length;
  const my = y.reduce((s, v) => s + v, 0) / y.length;

  let num = 0,
    dx = 0,
    dy = 0;

  for (let i = 0; i < x.length; i++) {
    const a = x[i] - mx;
    const b = y[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }

  const den = Math.sqrt(dx * dy);
  if (!Number.isFinite(den) || den === 0) return null;

  return num / den;
};

const cardStyle = {
  border: "1px solid #ddd",
  borderRadius: 14,
  padding: 12,
  background: "white",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const thtd = {
  padding: "8px 8px",
  borderBottom: "1px solid #eee",
  textAlign: "left",
};

const chipStyleForRegime = (regime) => {
  const base = {
    display: "inline-block",
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1.2,
  };

  if (regime === "Backwardation") {
    return { ...base, background: "#fee2e2", color: "#991b1b" };
  }
  if (regime === "Contango") {
    return { ...base, background: "#dcfce7", color: "#166534" };
  }
  return { ...base, background: "#e5e7eb", color: "#111827" };
};

const spreadTextStyle = (spread) => {
  if (!Number.isFinite(spread)) return {};
  return spread < 0
    ? { color: "#991b1b", fontWeight: 800 }
    : { color: "#111827", fontWeight: 800 };
};

const deltaTextStyle = (v) => {
  if (!Number.isFinite(v)) return { color: "#6b7280" };
  if (v > 0) return { color: "#166534", fontWeight: 800 };
  if (v < 0) return { color: "#991b1b", fontWeight: 800 };
  return { color: "#6b7280", fontWeight: 700 };
};

const alertBannerStyle = {
  border: "1px solid #fecaca",
  background: "#fee2e2",
  color: "#7f1d1d",
  borderRadius: 14,
  padding: 12,
  marginBottom: 16,
};

const watchBannerStyle = {
  border: "1px solid #fde68a",
  background: "#fef3c7",
  color: "#92400e",
  borderRadius: 14,
  padding: 12,
  marginBottom: 16,
};

const divergenceAlertStyle = {
  border: "1px solid #fca5a5",
  background: "#fee2e2",
  color: "#7f1d1d",
  borderRadius: 14,
  padding: 12,
  marginBottom: 16,
};

const divergenceWatchStyle = {
  border: "1px solid #fde68a",
  background: "#fef3c7",
  color: "#92400e",
  borderRadius: 14,
  padding: 12,
  marginBottom: 16,
};

const headlineStyle = {
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  borderRadius: 14,
  padding: 12,
  marginBottom: 14,
  fontWeight: 800,
  color: "#111827",
};

/* ================= page ================= */

export default function MetalsPage() {
  const [data, setData] = useState(null);

  // NEW: Gold curve history for the historical curve panel
  const [goldHistory, setGoldHistory] = useState(null);

  useEffect(() => {
    fetch("/api/metals")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ curves: [] }));
  }, []);

  // NEW: fetch historical curves from your existing route: /api/metals-history
  useEffect(() => {
    const tenors = "0,1,2,3,4,5,12";
    fetch(`/api/metals-history?metal=Gold&days=90&tenors=${tenors}`)
      .then((r) => r.json())
      .then(setGoldHistory)
      .catch(() => setGoldHistory({ rows: [] }));
  }, []);

  const trackedTenorList = [0, 1, 2, 3, 4, 5, 12];
  const trackedTenors = new Set(trackedTenorList);

  const curvesRaw = Array.isArray(data?.curves)
    ? data.curves
    : Array.isArray(data)
    ? data
    : [];

  const rows = useMemo(() => {
    return curvesRaw
      .map((r) => {
        const tenor = toNumOrNull(r.tenorMonths ?? r.tenor_months ?? r.months);
        if (tenor == null || !trackedTenors.has(tenor)) return null;

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

  /* ---------- summary values ---------- */

  const goldSpot = rows.find((r) => r.tenorMonths === 0)?.goldToday;
  const silverSpot = rows.find((r) => r.tenorMonths === 0)?.silverToday;

  const gold12m = rows.find((r) => r.tenorMonths === 12)?.goldToday;
  const silver12m = rows.find((r) => r.tenorMonths === 12)?.silverToday;

  const goldSpread =
    goldSpot != null && gold12m != null ? gold12m - goldSpot : null;
  const silverSpread =
    silverSpot != null && silver12m != null ? silver12m - silverSpot : null;

  const regimeForSpread = (s) =>
    s == null ? "Unknown" : s < 0 ? "Backwardation" : "Contango";

  const goldRegime = regimeForSpread(goldSpread);
  const silverRegime = regimeForSpread(silverSpread);

  const spreadPctOfSpot = (spread, spot) => {
    if (!Number.isFinite(spread) || !Number.isFinite(spot) || spot === 0)
      return null;
    return spread / spot;
  };

  const goldSpreadPct = spreadPctOfSpot(goldSpread, goldSpot);
  const silverSpreadPct = spreadPctOfSpot(silverSpread, silverSpot);

  const BACKWARDATION_ALERT_PCT = -0.0025; // -0.25%

  const goldMajorBack =
    goldSpreadPct != null && goldSpreadPct <= BACKWARDATION_ALERT_PCT;
  const silverMajorBack =
    silverSpreadPct != null && silverSpreadPct <= BACKWARDATION_ALERT_PCT;

  const goldMinorBack =
    goldSpreadPct != null &&
    goldSpreadPct < 0 &&
    goldSpreadPct > BACKWARDATION_ALERT_PCT;
  const silverMinorBack =
    silverSpreadPct != null &&
    silverSpreadPct < 0 &&
    silverSpreadPct > BACKWARDATION_ALERT_PCT;

  const anyMajorBackwardation = goldMajorBack || silverMajorBack;
  const anyMinorBackwardation =
    !anyMajorBackwardation && (goldMinorBack || silverMinorBack);

  const divergenceMajor =
    (goldMajorBack && !silverMajorBack) || (!goldMajorBack && silverMajorBack);

  const divergenceMinor =
    !divergenceMajor &&
    ((goldMinorBack && !(silverMinorBack || silverMajorBack)) ||
      (silverMinorBack && !(goldMinorBack || goldMajorBack)) ||
      ((goldSpreadPct != null && goldSpreadPct < 0) !==
        (silverSpreadPct != null && silverSpreadPct < 0)));

  const divergenceText = () => {
    const g = goldSpreadPct == null ? "--" : fmtPct(goldSpreadPct);
    const s = silverSpreadPct == null ? "--" : fmtPct(silverSpreadPct);

    if (divergenceMajor) {
      return `DIVERGENCE ALERT: One metal is in MAJOR backwardation (≤ -0.25% of spot) while the other is not. Gold: ${g} | Silver: ${s}`;
    }
    if (divergenceMinor) {
      return `DIVERGENCE WATCH: Curves disagree (signal conflict). Gold: ${g} | Silver: ${s}`;
    }
    return null;
  };

  const divText = divergenceText();

  /* ---------- curve shape ---------- */

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

  const pctDomain = tightDomain(
    curveRows.flatMap((r) => [
      r.goldPct,
      r.goldPctPrior,
      r.silverPct,
      r.silverPctPrior,
    ])
  );

  const goldAbsDomain = tightDomain(rows.map((r) => r.goldToday));
  const silverAbsDomain = tightDomain(rows.map((r) => r.silverToday));

  /* ---------- tenor table + correlation + daily change ---------- */

  const tenorMap = new Map();
  for (const t of trackedTenorList) tenorMap.set(t, { tenorMonths: t });

  for (const r of rows) {
    const base = tenorMap.get(r.tenorMonths) || { tenorMonths: r.tenorMonths };
    if (r.goldToday != null) base.goldToday = r.goldToday;
    if (r.silverToday != null) base.silverToday = r.silverToday;
    if (r.goldPrior != null) base.goldPrior = r.goldPrior;
    if (r.silverPrior != null) base.silverPrior = r.silverPrior;
    tenorMap.set(r.tenorMonths, base);
  }

  const tenorTable = trackedTenorList.map((t) => {
    const r = tenorMap.get(t) || { tenorMonths: t };

    const ratioToday =
      r.goldToday != null && r.silverToday != null && r.silverToday !== 0
        ? r.goldToday / r.silverToday
        : null;

    const ratioPrior =
      r.goldPrior != null && r.silverPrior != null && r.silverPrior !== 0
        ? r.goldPrior / r.silverPrior
        : null;

    const goldChg =
      r.goldToday != null && r.goldPrior != null
        ? r.goldToday - r.goldPrior
        : null;

    const silverChg =
      r.silverToday != null && r.silverPrior != null
        ? r.silverToday - r.silverPrior
        : null;

    const ratioChg =
      ratioToday != null && ratioPrior != null ? ratioToday - ratioPrior : null;

    return {
      ...r,
      ratioToday,
      ratioPrior,
      goldChg,
      silverChg,
      ratioChg,
    };
  });

  const curveCorr = corr(
    tenorTable.map((r) => r.goldToday),
    tenorTable.map((r) => r.silverToday)
  );
  const corrText = curveCorr == null ? "--" : Number(curveCorr).toFixed(2);

  /* ---------- data quality ---------- */

  const missingTenors = trackedTenorList.filter((t) => {
    const r = tenorMap.get(t);
    return !(r?.goldToday != null && r?.silverToday != null);
  });
  const qualityStatus =
    missingTenors.length === 0 ? "Complete" : "Missing Tenors";

  const signalConfidence =
    missingTenors.length === 0
      ? "High"
      : missingTenors.length <= 2
      ? "Medium"
      : "Low";

  /* ---------- action bias ---------- */

  const actionBias = divergenceMajor
    ? "Caution / Neutral (conflict)"
    : anyMajorBackwardation
    ? "Risk-Off"
    : anyMinorBackwardation
    ? "Caution"
    : goldRegime === "Contango" && silverRegime === "Contango"
    ? "Risk-On"
    : "Neutral";

  /* ---------- decision text ---------- */

  const divergenceLine =
    goldRegime !== "Unknown" &&
    silverRegime !== "Unknown" &&
    goldRegime !== silverRegime
      ? `Divergence: Gold is ${goldRegime}, Silver is ${silverRegime}. Treat this as a signal conflict.`
      : `Aligned: Gold and Silver are both ${goldRegime}.`;

  const tighterMetal =
    goldSpread != null && silverSpread != null
      ? goldSpread < silverSpread
        ? "Gold"
        : "Silver"
      : null;

  const interpretationLine =
    tighterMetal == null
      ? "Interpretation: insufficient data."
      : tighterMetal === "Gold"
      ? "Interpretation: Gold curve is tighter than Silver (more monetary/defensive bid)."
      : "Interpretation: Silver curve is tighter than Gold (more industrial/risk-on bid).";

  /* ---------- alerts ---------- */

  const majorAlertLine = `ALERT (≤ -0.25% of spot): ${
    goldMajorBack
      ? `Gold 12m−0m = ${fmtAbs(goldSpread)} (${fmtPct(goldSpreadPct)})`
      : ""
  }${goldMajorBack && silverMajorBack ? " | " : ""}${
    silverMajorBack
      ? `Silver 12m−0m = ${fmtAbs(silverSpread)} (${fmtPct(silverSpreadPct)})`
      : ""
  }`;

  const minorWatchLine = `WATCH (small backwardation): ${
    goldMinorBack
      ? `Gold 12m−0m = ${fmtAbs(goldSpread)} (${fmtPct(goldSpreadPct)})`
      : ""
  }${goldMinorBack && silverMinorBack ? " | " : ""}${
    silverMinorBack
      ? `Silver 12m−0m = ${fmtAbs(silverSpread)} (${fmtPct(silverSpreadPct)})`
      : ""
  }`;

  /* ---------- build Historical Curve Evolution data ---------- */

  const goldHistoryBundle = useMemo(() => {
    const raw = Array.isArray(goldHistory?.rows) ? goldHistory.rows : [];
    if (!raw.length) {
      return {
        chartData: [],
        series: [],
        latestKey: null,
        yDomain: ["auto", "auto"],
      };
    }

    // Group by date -> (tenor -> price)
    const byDate = new Map();
    for (const r of raw) {
      const d = String(r.as_of_date || "").slice(0, 10);
      const t = Number(r.tenor_months);
      const p = Number(r.price);
      if (!d || !Number.isFinite(t) || !Number.isFinite(p)) continue;

      if (!byDate.has(d)) byDate.set(d, new Map());
      byDate.get(d).set(t, p);
    }

    // Keep only complete curves (all tracked tenors present)
    const datesAll = Array.from(byDate.keys()).sort();
    const completeDates = [];
    for (const d of datesAll) {
      const m = byDate.get(d);
      const ok = trackedTenorList.every((t) => Number.isFinite(m.get(t)));
      if (ok) completeDates.push(d);
    }

    if (!completeDates.length) {
      return {
        chartData: [],
        series: [],
        latestKey: null,
        yDomain: ["auto", "auto"],
      };
    }

    // Sample curves so the chart stays readable and fast
    // (about ~14 curves across 90 days + always include latest)
    const STEP = Math.max(1, Math.round(completeDates.length / 14));
    const sampled = [];
    for (let i = 0; i < completeDates.length; i += STEP) sampled.push(completeDates[i]);

    const latestDate = completeDates[completeDates.length - 1];
    if (!sampled.includes(latestDate)) sampled.push(latestDate);

    // Build series definitions + chart table
    const series = sampled.map((date, idx) => {
      const key = `d_${date.replaceAll("-", "_")}`; // safe key
      return { date, key, idx };
    });

    const chartData = trackedTenorList.map((tenorMonths) => {
      const row = { tenorMonths };
      for (const s of series) {
        const m = byDate.get(s.date);
        row[s.key] = Number(m.get(tenorMonths));
      }
      return row;
    });

    const latestKey = `d_${latestDate.replaceAll("-", "_")}`;

    // Y-domain across the plotted series (tight but not clipped)
    const allVals = [];
    for (const r of chartData) {
      for (const s of series) allVals.push(r[s.key]);
    }
    const yDomain = tightDomain(allVals);

    return { chartData, series, latestKey, yDomain };
  }, [goldHistory, trackedTenorList]);

  const goldHistData = goldHistoryBundle.chartData;
  const goldHistSeries = goldHistoryBundle.series;
  const goldHistLatestKey = goldHistoryBundle.latestKey;
  const goldHistYDomain = goldHistoryBundle.yDomain;

  const opacityForSeries = (i, n) => {
    if (n <= 1) return 1;
    const x = i / (n - 1); // oldest->newest
    const o = 0.10 + 0.55 * Math.pow(x, 2.0);
    return Math.min(Math.max(o, 0.08), 0.70);
  };


  /* ---------- headline ---------- */

  const divergenceLabel = divergenceMajor
    ? "Divergence ALERT"
    : divergenceMinor
    ? "Divergence WATCH"
    : "No divergence";

  const todaysTake = `Action Bias: ${actionBias} | Confidence: ${signalConfidence} | Gold ${goldRegime} | Silver ${silverRegime} | ${divergenceLabel}`;

  const loading = data == null;

  return (
    <div style={{ padding: 16 }}>
      <div style={headlineStyle}>
        {loading ? "Today’s Take: loading…" : todaysTake}
      </div>

      <h1 style={{ marginBottom: 8 }}>Gold & Silver — Term Structure</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Gold</div>
          <div>
            Spot: <b>{fmtAbs(goldSpot)}</b>
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={chipStyleForRegime(goldRegime)}>{goldRegime}</span>
            <span style={{ marginLeft: 10 }}>
              12m − 0m:{" "}
              <span style={spreadTextStyle(goldSpread)}>
                {fmtAbs(goldSpread)}
              </span>
              {goldSpreadPct != null && (
                <span style={{ marginLeft: 8, opacity: 0.75 }}>
                  ({fmtPct(goldSpreadPct)})
                </span>
              )}
            </span>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Silver</div>
          <div>
            Spot: <b>{fmtAbs(silverSpot)}</b>
          </div>
          <div style={{ marginTop: 6 }}>
            <span style={chipStyleForRegime(silverRegime)}>{silverRegime}</span>
            <span style={{ marginLeft: 10 }}>
              12m − 0m:{" "}
              <span style={spreadTextStyle(silverSpread)}>
                {fmtAbs(silverSpread)}
              </span>
              {silverSpreadPct != null && (
                <span style={{ marginLeft: 8, opacity: 0.75 }}>
                  ({fmtPct(silverSpreadPct)})
                </span>
              )}
            </span>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Gold vs Silver</div>
          <div>
            Curve Correlation: <b>{corrText}</b>
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Negative spread = backwardation.
          </div>
        </div>
      </div>

      {divergenceMajor && divText && (
        <div style={divergenceAlertStyle}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            Divergence Alert
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{divText}</div>
        </div>
      )}

      {divergenceMinor && divText && (
        <div style={divergenceWatchStyle}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            Divergence Watch
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{divText}</div>
        </div>
      )}

      {anyMajorBackwardation && (
        <div style={alertBannerStyle}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            Backwardation Alert
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            {majorAlertLine}
          </div>
        </div>
      )}

      {anyMinorBackwardation && (
        <div style={watchBannerStyle}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>
            Backwardation Watch
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>
            {minorWatchLine}
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>
          Curve Shape (% vs Spot)
        </div>
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
                stroke="#6b7280"
                strokeWidth={2.5}
                strokeDasharray="10 6"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
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
                stroke="#3b82f6"
                strokeWidth={2.5}
                strokeDasharray="10 6"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Absolute charts */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginTop: 16,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Gold (Absolute)</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart
                data={rows}
                margin={{ top: 10, right: 16, left: 36, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis width={80} domain={goldAbsDomain} tickFormatter={fmtAbs} />
                <Tooltip formatter={fmtAbs} />
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
                  stroke="#6b7280"
                  strokeWidth={2.5}
                  strokeDasharray="10 6"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Silver (Absolute)
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart
                data={rows}
                margin={{ top: 10, right: 16, left: 36, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis
                  width={80}
                  domain={silverAbsDomain}
                  tickFormatter={fmtAbs}
                />
                <Tooltip formatter={fmtAbs} />
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
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  strokeDasharray="10 6"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tenor table + decision + data quality */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 16,
          marginTop: 16,
        }}
      >
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Tenor Table</div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thtd}>Tenor</th>
                <th style={thtd}>Gold Today</th>
                <th style={thtd}>Gold Δ</th>
                <th style={thtd}>Silver Today</th>
                <th style={thtd}>Silver Δ</th>
                <th style={thtd}>Ratio (G/S)</th>
                <th style={thtd}>Ratio Δ</th>
              </tr>
            </thead>
            <tbody>
              {tenorTable.map((r) => (
                <tr key={r.tenorMonths}>
                  <td style={thtd}>
                    {r.tenorMonths === 0 ? "Spot" : `${r.tenorMonths}m`}
                  </td>
                  <td style={thtd}>{fmtAbs(r.goldToday)}</td>
                  <td style={{ ...thtd, ...deltaTextStyle(r.goldChg) }}>
                    {fmtAbs(r.goldChg)}
                  </td>
                  <td style={thtd}>{fmtAbs(r.silverToday)}</td>
                  <td style={{ ...thtd, ...deltaTextStyle(r.silverChg) }}>
                    {fmtAbs(r.silverChg)}
                  </td>
                  <td style={thtd}>{fmtRatio(r.ratioToday)}</td>
                  <td style={{ ...thtd, ...deltaTextStyle(r.ratioChg) }}>
                    {fmtRatio(r.ratioChg)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={cardStyle}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>
              Decision Read
            </div>

            <div style={{ fontSize: 13, marginBottom: 6 }}>
              <b>Action Bias:</b> {actionBias}
            </div>
            <div style={{ fontSize: 13, marginBottom: 10 }}>
              <b>Signal Confidence:</b> {signalConfidence}
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 8 }}>
              {divergenceLine}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>
              {interpretationLine}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Data Quality</div>
            <div>
              Status: <b>{qualityStatus}</b>
            </div>
            {missingTenors.length > 0 ? (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                Missing:{" "}
                {missingTenors
                  .map((t) => (t === 0 ? "Spot" : `${t}m`))
                  .join(", ")}
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                All tracked tenors present for both metals.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Historical Curve Evolution (Gold) — restored panel */}
      <div style={{ marginTop: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Historical Curve (Gold) — Daily Curves (Last 90 Days)
          </div>

          <div style={{ height: 360 }}>
            <ResponsiveContainer>
             <LineChart data={goldHistData} margin={{ top: 10, right: 16, left: 36, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis width={80} domain={goldHistYDomain} tickFormatter={fmtAbs} />
                <Tooltip formatter={fmtAbs} />
                <Legend />

              {/* History (sampled, faded) */}
{goldHistSeries
  .filter((s) => s.key !== goldHistLatestKey)
  .map((s, i, arr) => (
    <Line
      key={s.key}
      name={i === 0 ? "History (sampled)" : undefined}
      dataKey={s.key}
      dot={false}
      stroke="#6b7280"
      strokeWidth={1}
      strokeOpacity={opacityForSeries(i, arr.length)}
      isAnimationActive={false}
    />
  ))}


{goldHistLatestKey && (
  <Line
    key={goldHistLatestKey}
    name="Latest"
    dataKey={goldHistLatestKey}
    dot={false}
    stroke="#111827"
    strokeWidth={3}
    strokeOpacity={1}
    isAnimationActive={false}
  />
)}

              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
            Older curves are faded; the most recent curve is highlighted.
          </div>
        </div>
      </div>
    </div>
  );
}
