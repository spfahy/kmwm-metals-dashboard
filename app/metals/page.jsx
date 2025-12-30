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

function toNumOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function corr(xs, ys) {
  const pts = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x == null || y == null) continue;
    pts.push([x, y]);
  }
  if (pts.length < 3) return null;

  const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;

  let num = 0,
    dx = 0,
    dy = 0;
  for (const [x, y] of pts) {
    num += (x - mx) * (y - my);
    dx += (x - mx) ** 2;
    dy += (y - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  if (!Number.isFinite(den) || den === 0) return null;
  return num / den;
}

function fmt2(v) {
  return v == null ? "--" : Number(v).toFixed(2);
}

function fmtPct(v) {
  return v == null ? "--" : `${(Number(v) * 100).toFixed(2)}%`;
}

function badgeTone(v) {
  if (v == null) return { background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb" };
  if (v < 0) return { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" }; // backwardation
  if (v > 0) return { background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }; // contango
  return { background: "#f3f4f6", color: "#111827", border: "1px solid #e5e7eb" };
}

// Build a tight y-axis domain from series keys, with padding.
function makeDomain(data, keys, padPct = 0.04) {
  let min = Infinity;
  let max = -Infinity;

  for (const row of (data || [])) {
    for (const k of keys) {
      const v = row?.[k];
      if (v == null) continue;
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      if (n < min) min = n;
      if (n > max) max = n;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return ["auto", "auto"];

  if (min === max) {
    const bump = min === 0 ? 1 : Math.abs(min) * 0.02;
    return [min - bump, max + bump];
  }

  const range = max - min;
  const pad = range * padPct;
  return [min - pad, max + pad];
}


export default function MetalsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    let alive = true;

    fetch("/api/metals", { cache: "no-store" })
      .then(async (res) => {
        const text = await res.text();
        if (alive) setRawText(text.slice(0, 8000));
        if (!res.ok) throw new Error(`API status ${res.status}. First 200 chars: ${text.slice(0, 200)}`);
        const json = JSON.parse(text);
        if (alive) setData(json);
      })
      .catch((e) => alive && setError(String(e?.message || e)))
      .finally(() => alive && setLoading(false));

    return () => (alive = false);
  }, []);

  const curvesRaw = Array.isArray(data) ? data : data?.curves ?? [];

  const rows = useMemo(() => {
    return curvesRaw
      .map((r) => {
        const tenor = toNumOrNull(r.tenorMonths ?? r.tenor_months ?? r.months);
        if (tenor == null) return null;
        return {
          tenorMonths: tenor,
          goldToday: toNumOrNull(r.goldToday ?? r.gold),
          goldPrior: toNumOrNull(r.goldPrior),
          silverToday: toNumOrNull(r.silverToday ?? r.silver),
          silverPrior: toNumOrNull(r.silverPrior),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.tenorMonths - b.tenorMonths);
  }, [curvesRaw]);

  const asOfDate = (Array.isArray(data) ? data?.[0]?.asOfDate : data?.asOfDate) ?? "--";
  const priorDate = (Array.isArray(data) ? data?.[0]?.priorDate : data?.priorDate) ?? "--";

  const trackedTenors = new Set([0, 1, 2, 3, 4, 5, 12]);
  const trackedRows = rows.filter((r) => trackedTenors.has(r.tenorMonths));

  const spot =
    rows.find((r) => r.tenorMonths === 0) ||
    rows.find((r) => r.tenorMonths === 1) ||
    rows.find((r) => r.goldToday != null || r.silverToday != null) ||
    null;

  const goldSpot = spot?.goldToday ?? null;
  const silverSpot = spot?.silverToday ?? null;

  const row12 = rows.find((r) => r.tenorMonths === 12) || null;

  const goldSpread12m = goldSpot != null && row12?.goldToday != null ? row12.goldToday - goldSpot : null;
  const silverSpread12m = silverSpot != null && row12?.silverToday != null ? row12.silverToday - silverSpot : null;

  const gsCorr = corr(
    rows.map((r) => r.goldToday),
    rows.map((r) => r.silverToday)
  );

  const pctRows = useMemo(() => {
    const g0 = goldSpot;
    const s0 = silverSpot;
    const g0p = spot?.goldPrior ?? null;
    const s0p = spot?.silverPrior ?? null;

    return rows.map((r) => ({
      tenorMonths: r.tenorMonths,
      goldPct: g0 != null && r.goldToday != null ? r.goldToday / g0 - 1 : null,
      silverPct: s0 != null && r.silverToday != null ? r.silverToday / s0 - 1 : null,
      goldPctPrior: g0p != null && r.goldPrior != null ? r.goldPrior / g0p - 1 : null,
      silverPctPrior: s0p != null && r.silverPrior != null ? r.silverPrior / s0p - 1 : null,
    }));
  }, [rows, goldSpot, silverSpot, spot]);

  const ratioRows = useMemo(() => {
  return rows
    .map((r) => {
      if (r.goldToday == null || r.silverToday == null) return null;

      const g = Number(r.goldToday);
      const s = Number(r.silverToday);
      if (!Number.isFinite(g) || !Number.isFinite(s) || s === 0) return null;

      const ratioToday = g / s;
if (ratioToday < 10 || ratioToday > 200) return null;

      let ratioPrior = null;
      if (r.goldPrior != null && r.silverPrior != null) {
        const gp = Number(r.goldPrior);
        const sp = Number(r.silverPrior);
        if (Number.isFinite(gp) && Number.isFinite(sp) && sp !== 0) {
          ratioPrior = gp / sp;
          if (ratioPrior < 10 || ratioPrior > 200) ratioPrior = null;
        }
      }

      return {
        tenorMonths: Number(r.tenorMonths),
        ratioToday,
        ratioPrior,
      };
    })
    .filter(Boolean);
}, [rows]);
const ratioDomainLive = useMemo(() => makeDomain(ratioRows, ["ratioToday", "ratioPrior"], 0.08), [ratioRows]);


  // Dynamic y-axis domains
  const goldAbsDomain = useMemo(() => makeDomain(rows, ["goldToday", "goldPrior"], 0.03), [rows]);
  const silverAbsDomain = useMemo(() => makeDomain(rows, ["silverToday", "silverPrior"], 0.06), [rows]);
  const ratioDomain = useMemo(() => makeDomain(ratioRows, ["ratioToday", "ratioPrior"], 0.04), [ratioRows]);
  const pctDomain = useMemo(() => makeDomain(pctRows, ["goldPct", "silverPct", "goldPctPrior", "silverPctPrior"], 0.10), [pctRows]);

  return (
    <main style={{ padding: 20, fontFamily: "system-ui, Arial", background: "#f6f7f9", minHeight: "100vh" }}>
      {/* Center + max width so cards aren’t stretched */}
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Gold & Silver — Term Structure</h1>
          <div style={{ fontSize: 13, opacity: 0.85, textAlign: "right" }}>
            As of: <strong>{asOfDate}</strong> &nbsp; | &nbsp; Prior: <strong>{priorDate}</strong>
          </div>
        </div>

        {loading && (
          <div style={{ marginTop: 10, padding: 10, border: "1px solid #ddd", borderRadius: 12, background: "white" }}>
            Loading…
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 10,
              padding: 10,
              border: "1px solid #f5c2c7",
              borderRadius: 12,
              background: "#f8d7da",
              color: "#842029",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "pre-wrap",
            }}
          >
            {error}
          </div>
        )}

        {/* Compact top row */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 14, background: "white" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Gold</div>
            <div style={{ fontSize: 14 }}>
              Spot: <strong>{fmt2(goldSpot)}</strong>
            </div>
            <div style={{ marginTop: 8 }}>
              <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12, ...badgeTone(goldSpread12m) }}>
                12m − 0m: {fmt2(goldSpread12m)}
              </span>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 14, background: "white" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Silver</div>
            <div style={{ fontSize: 14 }}>
              Spot: <strong>{fmt2(silverSpot)}</strong>
            </div>
            <div style={{ marginTop: 8 }}>
              <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12, ...badgeTone(silverSpread12m) }}>
                12m − 0m: {fmt2(silverSpread12m)}
              </span>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 14, background: "white" }}>
            <div style={{ fontWeight: 900, marginBottom: 6 }}>Gold vs Silver</div>
            <div style={{ fontSize: 14 }}>
              Curve Correlation: <strong>{gsCorr != null ? gsCorr.toFixed(2) : "--"}</strong>
            </div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 6 }}>Negative spread = backwardation.</div>
          </div>
        </div>

        {/* HERO: % vs Spot (with clear colors) */}
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 14, background: "white" }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 16 }}>Curve Shape (% vs Spot)</h2>
          <div style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pctRows} margin={{ top: 10, right: 20, left: 48, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                <YAxis domain={pctDomain} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                <Tooltip formatter={(v) => fmtPct(v)} />
                <Legend />
                <Line name="Gold % Today" type="monotone" dataKey="goldPct" dot={false} stroke="#111827" strokeWidth={2.5} />
                <Line name="Gold % Prior" type="monotone" dataKey="goldPctPrior" dot={false} stroke="#9ca3af" strokeWidth={2} strokeDasharray="6 4" />
                <Line name="Silver % Today" type="monotone" dataKey="silverPct" dot={false} stroke="#2563eb" strokeWidth={2.5} />
                <Line name="Silver % Prior" type="monotone" dataKey="silverPctPrior" dot={false} stroke="#93c5fd" strokeWidth={2} strokeDasharray="6 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Absolute charts split + dynamic range */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 14, background: "white" }}>
            <h2 style={{ margin: "0 0 10px 0", fontSize: 16 }}>Gold (Absolute)</h2>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 10, right: 20, left: 48, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tenorMonths" />
                  <YAxis domain={goldAbsDomain} />
                  <Tooltip />
                  <Legend />
                  <Line name="Gold Today" type="monotone" dataKey="goldToday" dot={false} stroke="#111827" strokeWidth={2.5} />
                  <Line name="Gold Prior" type="monotone" dataKey="goldPrior" dot={false} stroke="#9ca3af" strokeWidth={2} strokeDasharray="6 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 14, background: "white" }}>
            <h2 style={{ margin: "0 0 10px 0", fontSize: 16 }}>Silver (Absolute)</h2>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 10, right: 20, left: 48, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="tenorMonths" />
                  <YAxis domain={silverAbsDomain} />
                  <Tooltip />
                  <Legend />
                  <Line name="Silver Today" type="monotone" dataKey="silverToday" dot={false} stroke="#2563eb" strokeWidth={2.5} />
                  <Line name="Silver Prior" type="monotone" dataKey="silverPrior" dot={false} stroke="#93c5fd" strokeWidth={2} strokeDasharray="6 4" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Ratio with dynamic range */}
        <div style={{ marginTop: 12, padding: 12, border: "1px solid #ddd", borderRadius: 14, background: "white" }}>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 16 }}>Gold-to-Silver Ratio by Tenor</h2>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={ratioRows} margin={{ top: 10, right: 20, left: 48, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tenorMonths" />
                348 | <YAxis type="number" domain={[45, 85]} tickCount={9} tickFormatter={(v) => v.toFixed(0)} />
                349 | <Tooltip formatter={(v) => (v == null ? "--" : Number(v).toFixed(2))} />
                <Legend />
                <Line name="Ratio Today" type="monotone" dataKey="ratioToday" dot={false} stroke="#111827" strokeWidth={2.5} />
                <Line name="Ratio Prior" type="monotone" dataKey="ratioPrior" dot={false} stroke="#9ca3af" strokeWidth={2} strokeDasharray="6 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tracked table card not full-width */}
        <div style={{ marginTop: 12, display: "flex", justifyContent: "center" }}>
          <div style={{ width: "100%", maxWidth: 860, padding: 12, border: "1px solid #ddd", borderRadius: 14, background: "white" }}>
            <h2 style={{ margin: "0 0 10px 0", fontSize: 16 }}>Tracked Tenors (0, 1, 2, 3, 4, 5, 12)</h2>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 6px" }}>Tenor</th>
                  <th style={{ textAlign: "right", padding: "6px 6px" }}>Gold Today</th>
                  <th style={{ textAlign: "right", padding: "6px 6px", opacity: 0.7 }}>Gold Prior</th>
                  <th style={{ textAlign: "right", padding: "6px 6px" }}>Silver Today</th>
                  <th style={{ textAlign: "right", padding: "6px 6px", opacity: 0.7 }}>Silver Prior</th>
                </tr>
              </thead>
              <tbody>
                {trackedRows.map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: "6px 6px" }}>{r.tenorMonths}m</td>
                    <td style={{ padding: "6px 6px", textAlign: "right" }}>{fmt2(r.goldToday)}</td>
                    <td style={{ padding: "6px 6px", textAlign: "right", opacity: 0.7 }}>{fmt2(r.goldPrior)}</td>
                    <td style={{ padding: "6px 6px", textAlign: "right" }}>{fmt2(r.silverToday)}</td>
                    <td style={{ padding: "6px 6px", textAlign: "right", opacity: 0.7 }}>{fmt2(r.silverPrior)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: 10 }}>
              <button
                onClick={() => setShowRaw((v) => !v)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  background: "white",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                {showRaw ? "Hide raw JSON" : "Show raw JSON"}
              </button>
            </div>

            {showRaw && (
              <pre
                style={{
                  marginTop: 10,
                  padding: 12,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  background: "#fafafa",
                  fontSize: 12,
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                }}
              >
                {rawText || JSON.stringify(data, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
