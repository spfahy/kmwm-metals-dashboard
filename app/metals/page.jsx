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
  if (!Number.isFinite(v)) return { color: "#6b7280" }; // gray
  if (v > 0) return { color: "#166534", fontWeight: 800 }; // green
  if (v < 0) return { color: "#991b1b", fontWeight: 800 }; // red
  return { color: "#6b7280", fontWeight: 700 }; // gray for zero
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

/* ================= page ================= */

export default function MetalsPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/api/metals")
      .then((r) => r.json())
      .then(setData);
  }, []);

  const trackedTenorList = [0, 1, 2, 3, 4, 5, 12];
  const trackedTenors = new Set(trackedTenorList);

  /* ---------- normalize rows ---------- */

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

  if (!data) return null;

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

  // spread as % of spot (for thresholding)
  const spreadPctOfSpot = (spread, spot) => {
    if (!Number.isFinite(spread) || !Number.isFinite(spot) || spot === 0) return null;
    return spread / spot;
  };

  const goldSpreadPct = spreadPctOfSpot(goldSpread, goldSpot);
  const silverSpreadPct = spreadPctOfSpot(silverSpread, silverSpot);

  // ===== Threshold bands =====
  const BACKWARDATION_ALERT_PCT = -0.0025; // -0.25%

  const goldMajorBack = goldSpreadPct != null && goldSpreadPct <= BACKWARDATION_ALERT_PCT;
  const silverMajorBack = silverSpreadPct != null && silverSpreadPct <= BACKWARDATION_ALERT_PCT;

  const goldMinorBack =
    goldSpreadPct != null && goldSpreadPct < 0 && goldSpreadPct > BACKWARDATION_ALERT_PCT;
  const silverMinorBack =
    silverSpreadPct != null && silverSpreadPct < 0 && silverSpreadPct > BACKWARDATION_ALERT_PCT;

  const anyMajorBackwardation = goldMajorBack || silverMajorBack;
  const anyMinorBackwardation = !anyMajorBackwardation && (goldMinorBack || silverMinorBack);

  // ===== Divergence detection =====
  const divergenceMajor =
    (goldMajorBack && !silverMajorBack) || (!goldMajorBack && silverMajorBack);

  const divergenceMinor =
    !divergenceMajor &&
    ((goldMinorBack && !(silverMinorBack || silverMajorBack)) ||
      (silverMinorBack && !(goldMinorBack || goldMajorBack)) ||
      ((goldSpreadPct != null && goldSpreadPct < 0) !== (silverSpreadPct != null && silverSpreadPct < 0)));

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

    const goldChg = r.goldToday != null && r.goldPrior != null ? r.goldToday - r.goldPrior : null;
    const silverChg =
      r.silverToday != null && r.silverPrior != null ? r.silverToday - r.silverPrior : null;

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

  const qualityStatus = missingTenors.length === 0 ? "Complete" : "Missing Tenors";

  /* ---------- decision panels ---------- */

  const divergence =
    goldRegime !== "Unknown" &&
    silverRegime !== "Unknown" &&
    goldRegime !== silverRegime;

  const tighterMetal =
    goldSpread != null && silverSpread != null
      ? goldSpread < silverSpread
        ? "Gold"
        : "Silver"
      : null;

  const divergenceLine = divergence
    ? `Divergence: Gold is ${goldRegime}, Silver is ${silverRegime}. Treat this as a signal conflict.`
    : `Aligned: Gold and Silver are both ${goldRegime}.`;

  const interpretationLine =
    tighterMetal == null
      ? "Interpretation: insufficient data."
      : tighterMetal === "Gold"
      ? "Interpretation: Gold curve is tighter than Silver (more monetary/defensive bid)."
      : "Interpretation: Silver curve is tighter than Gold (more industrial/risk-on bid).";

  const majorAlertLine = `ALERT (≤ -0.25% of spot): ${
    goldMajorBack ? `Gold 12m−0m = ${fmtAbs(goldSpread)} (${fmtPct(goldSpreadPct)})` : ""
  }${goldMajorBack && silverMajorBack ? " | " : ""}${
    silverMajorBack ? `Silver 12m−0m = ${fmtAbs(silverSpread)} (${fmtPct(silverSpreadPct)})` : ""
  }`;

  const minorWatchLine = `WATCH (small backwardation): ${
    goldMinorBack ? `Gold 12m−0m = ${fmtAbs(goldSpread)} (${fmtPct(goldSpreadPct)})` : ""
  }${goldMinorBack && silverMinorBack ? " | " : ""}${
    silverMinorBack ? `Silver 12m−0m = ${fmtAbs(silverSpread)} (${fmtPct(silverSpreadPct)})` : ""
  }`;

  const divText = divergenceText();

  /* ================= render ================= */

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Gold & Silver — Term Structure</h1>

      {/* ================= Top Cards ================= */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Gold</div>
          <div>Spot: <b>{fmtAbs(goldSpot)}</b></div>
          <div style={{ marginTop: 6 }}>
            <span style={chipStyleForRegime(goldRegime)}>{goldRegime}</span>
            <span style={{ marginLeft: 10 }}>
              12m − 0m:{" "}
              <span style={spreadTextStyle(goldSpread)}>{fmtAbs(goldSpread)}</span>
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
          <div>Spot: <b>{fmtAbs(silverSpot)}</b></div>
          <div style={{ marginTop: 6 }}>
            <span style={chipStyleForRegime(silverRegime)}>{silverRegime}</span>
            <span style={{ marginLeft: 10 }}>
              12m − 0m:{" "}
              <span style={spreadTextStyle(silverSpread)}>{fmtAbs(silverSpread)}</span>
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
          <div>Curve Correlation: <b>{corrText}</b></div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
            Negative spread = backwardation.
          </div>
        </div>
      </div>

      {/* ================= Divergence Banner ================= */}
      {divergenceMajor && divText && (
        <div style={divergenceAlertStyle}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Divergence Alert</div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{divText}</div>
        </div>
      )}

      {divergenceMinor && divText && (
        <div style={divergenceWatchStyle}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Divergence Watch</div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{divText}</div>
        </div>
      )}

      {/* ================= Backwardation Banner ================= */}
      {anyMajorBackwardation && (
        <div style={alertBannerStyle}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Backwardation Alert</div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{majorAlertLine}</div>
        </div>
      )}

      {anyMinorBackwardation && (
        <div style={watchBannerStyle}>
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Backwardation Watch</div>
          <div style={{ fontSize: 13, lineHeight: 1.4 }}>{minorWatchLine}</div>
        </div>
      )}

      {/* ================= Curve Shape ================= */}
      <div style={cardStyle}>
        <div style={{ fontWeight: 800, marginBottom: 8 }}>Curve Shape (% vs Spot)</div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={curveRows} margin={{ top: 10, right: 16, left: 36, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tenorMonths" />
              <YAxis width={80} domain={pctDomain} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
              <Tooltip formatter={fmtPct} />
              <Legend />
              <Line name="Gold % Today" dataKey="goldPct" stroke="#111827" strokeWidth={3} dot={false} />
              <Line name="Gold % Prior" dataKey="goldPctPrior" stroke="#9ca3af" strokeWidth={2} strokeDasharray="8 5" dot={false} />
              <Line name="Silver % Today" dataKey="silverPct" stroke="#2563eb" strokeWidth={3} dot={false} />
              <Line name="Silver % Prior" dataKey="silverPctPrior" stroke="#93c5fd" strokeWidth={2} strokeDasharray="8 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ================= Absolute Charts ================= */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Gold (Absolute)</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 10, right: 16, left: 36, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis width={80} domain={goldAbsDomain} tickFormatter={fmtAbs} />
                <Tooltip formatter={fmtAbs} />
                <Legend />
                <Line name="Gold Today" dataKey="goldToday" stroke="#111827" strokeWidth={3} dot={false} />
                <Line name="Gold Prior" dataKey="goldPrior" stroke="#9ca3af" strokeWidth={2} strokeDasharray="8 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={cardStyle}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Silver (Absolute)</div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 10, right: 16, left: 36, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis width={80} domain={silverAbsDomain} tickFormatter={fmtAbs} />
                <Tooltip formatter={fmtAbs} />
                <Legend />
                <Line name="Silver Today" dataKey="silverToday" stroke="#2563eb" strokeWidth={3} dot={false} />
                <Line name="Silver Prior" dataKey="silverPrior" stroke="#93c5fd" strokeWidth={2} strokeDasharray="8 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ================= Bottom Panels ================= */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginTop: 16 }}>
        {/* Tenor Table */}
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
                  <td style={thtd}>{r.tenorMonths === 0 ? "Spot" : `${r.tenorMonths}m`}</td>

                  <td style={thtd}>{fmtAbs(r.goldToday)}</td>
                  <td style={{ ...thtd, ...deltaTextStyle(r.goldChg) }}>{fmtAbs(r.goldChg)}</td>

                  <td style={thtd}>{fmtAbs(r.silverToday)}</td>
                  <td style={{ ...thtd, ...deltaTextStyle(r.silverChg) }}>{fmtAbs(r.silverChg)}</td>

                  <td style={thtd}>{fmtRatio(r.ratioToday)}</td>
                  <td style={{ ...thtd, ...deltaTextStyle(r.ratioChg) }}>{fmtRatio(r.ratioChg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Decision + Quality */}
        <div style={{ display: "grid", gap: 16 }}>
          <div style={cardStyle}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Decision Read</div>

            {divergenceMajor && divText && (
              <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 900, color: "#991b1b" }}>
                {divText}
              </div>
            )}

            {divergenceMinor && divText && (
              <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 900, color: "#92400e" }}>
                {divText}
              </div>
            )}

            {anyMajorBackwardation && (
              <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 900, color: "#991b1b" }}>
                {majorAlertLine}
              </div>
            )}

            {anyMinorBackwardation && (
              <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 900, color: "#92400e" }}>
                {minorWatchLine}
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              Gold: <span style={chipStyleForRegime(goldRegime)}>{goldRegime}</span>
              <span style={{ marginLeft: 10 }}>
                Silver: <span style={chipStyleForRegime(silverRegime)}>{silverRegime}</span>
              </span>
            </div>

            <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 8 }}>{divergenceLine}</div>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>{interpretationLine}</div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Data Quality</div>
            <div>Status: <b>{qualityStatus}</b></div>
            {missingTenors.length > 0 ? (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                Missing: {missingTenors.map((t) => (t === 0 ? "Spot" : `${t}m`)).join(", ")}
              </div>
            ) : (
              <div style={{ marginTop: 8, fontSize: 13 }}>
                All tracked tenors present for both metals.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
