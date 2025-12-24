export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { Pool } from "pg";
function computeStressStreak(rows, thresholdAbsSlope) {
  // rows: [{ as_of_date, tenor_months, price }]
  // Build map: date -> {0: price0, 1: price1}
  const byDate = new Map();

  for (const r of rows) {
    const d = String(r.as_of_date).slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, {});
    byDate.get(d)[Number(r.tenor_months)] = Number(r.price);
  }

  // Sort dates ascending, then walk backwards from latest
  const dates = Array.from(byDate.keys()).sort();
  let streak = 0;

  for (let i = dates.length - 1; i >= 0; i--) {
    const obj = byDate.get(dates[i]);
    const p0 = obj?.[0];
    const p1 = obj?.[1];
    if (p0 == null || p1 == null) break;

    const slope = p1 - p0; // 0→1 month slope per month
    if (Math.abs(slope) > thresholdAbsSlope) streak += 1;
    else break;
  }

  return streak;
}


// Uses DATABASE_URL from Vercel env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const client = await pool.connect();

  try {
    // 1) Find latest as_of_date from history
   const latestRes = await client.query(`
  SELECT MAX(as_of_date) AS as_of_date
  FROM metals_curve_latest
`);


    const latestDate = latestRes.rows[0]?.as_of_date;
    if (!latestDate) {
      return NextResponse.json(
       { error: "No rows in metals_curve_latest" },
        { status: 500 }
      );
    }

    // 2) Find prior as_of_date (immediately before latest)
    const priorRes = await client.query(
      `SELECT MAX(as_of_date) AS as_of_date
       FROM metals_curve_history
       WHERE as_of_date < $1`,
      [latestDate]
    );

    const priorDate = priorRes.rows[0]?.as_of_date || null;

    // 3) Pull rows for latest (and prior if it exists)
    // 3) Pull rows for latest from LATEST table (source of truth)
const latestRowsRes = await client.query(
  `SELECT
     as_of_date,
     metal,
     tenor_months,
     price::float,
     real_10yr_yld,
     dollar_index,
     deficit_gdp_flag
   FROM metals_curve_latest
   WHERE LOWER(metal) IN ('gold', 'silver')
   ORDER BY metal, tenor_months`
);

const latestRows = latestRowsRes.rows || [];

// Pull prior rows from HISTORY (if prior exists)
let priorRows = [];
if (priorDate) {
  const priorRowsRes = await client.query(
    `SELECT
       as_of_date,
       metal,
       tenor_months,
       price::float,
       real_10yr_yld,
       dollar_index,
       deficit_gdp_flag
     FROM metals_curve_history
     WHERE as_of_date = $1
       AND LOWER(metal) IN ('gold', 'silver')
     ORDER BY metal, tenor_months`,
    [priorDate]
  );
  priorRows = priorRowsRes.rows || [];
}

// Combine
const rows = [...latestRows, ...priorRows];


    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "No metals curve rows found for latest/prior dates" },
        { status: 500 }
      );
    }

    // Split rows into today / prior, by metal
    const byMetalToday = { GOLD: [], SILVER: [] };
    const byMetalPrior = { GOLD: [], SILVER: [] };

    for (const r of rows) {
      const key = r.metal.toUpperCase();
      if (key !== "GOLD" && key !== "SILVER") continue;

      if (
        r.as_of_date &&
        latestDate &&
        r.as_of_date.getTime() === latestDate.getTime()
      ) {
        byMetalToday[key].push(r);
      } else if (
        priorDate &&
        r.as_of_date &&
        r.as_of_date.getTime() === priorDate.getTime()
      ) {
        byMetalPrior[key].push(r);
      }
    }

    const metals = ["GOLD", "SILVER"];

    // Build curve points: today + prior price per tenor
    const curves = metals.map((metal) => {
      const todayRows = (byMetalToday[metal] || []).slice();
      const priorRows = (byMetalPrior[metal] || []).slice();

      todayRows.sort((a, b) => a.tenor_months - b.tenor_months);
      priorRows.sort((a, b) => a.tenor_months - b.tenor_months);

      const points = todayRows.map((tr) => {
        const match = priorRows.find(
          (pr) => pr.tenor_months === tr.tenor_months
        );
        return {
          tenorMonths: tr.tenor_months,
          priceToday: tr.price,
          pricePrior: match ? match.price : null,
        };
      });

      return { metal, points };
    });

    // Macro (today + prior)
    const todayAll = rows.filter(
      (r) =>
        r.as_of_date &&
        latestDate &&
        r.as_of_date.getTime() === latestDate.getTime()
    );
    const priorAll =
      priorDate &&
      rows.filter(
        (r) =>
          r.as_of_date &&
          priorDate &&
          r.as_of_date.getTime() === priorDate.getTime()
      );

    const baseToday = todayAll[0] || {};
    const basePrior = priorAll && priorAll[0] ? priorAll[0] : {};

    const goldTodayRows = byMetalToday.GOLD || [];
    const goldPriorRows = byMetalPrior.GOLD || [];

    const goldFrontMonthToday =
      goldTodayRows.find((r) => r.tenor_months === 0)?.price ?? null;
    const goldFrontMonthPrior =
      goldPriorRows.find((r) => r.tenor_months === 0)?.price ?? null;

    const macro = {
      asOfDate: latestDate,
      priorAsOfDate: priorDate,
      real10y: baseToday.real_10yr_yld ?? null,
      real10yPrior: basePrior.real_10yr_yld ?? null,
      dollarIndex: baseToday.dollar_index ?? null,
      dollarIndexPrior: basePrior.dollar_index ?? null,
      deficitFlag: baseToday.deficit_gdp_flag ?? null,
      deficitFlagPrior: basePrior.deficit_gdp_flag ?? null,
      goldFrontMonth: goldFrontMonthToday,
      goldFrontMonthPrior,
    };
// ===== Front-end stress persistence (last ~60 days) =====
const lookbackDays = 60;

const histRes = await client.query(
  `
  SELECT as_of_date, metal, tenor_months, price
  FROM metals_curve_history
  WHERE as_of_date >= (CURRENT_DATE - $1::int)
    AND UPPER(metal) IN ('GOLD','SILVER')
    AND tenor_months IN (0, 1)
  ORDER BY as_of_date ASC
  `,
  [lookbackDays]
);

const histRows = histRes.rows || [];

const goldRows = histRows.filter(
  (r) => String(r.metal).toUpperCase() === "GOLD"
);
const silverRows = histRows.filter(
  (r) => String(r.metal).toUpperCase() === "SILVER"
);

// MUST match UI thresholds
const stressStreak = {
  gold: computeStressStreak(goldRows, 20),
  silver: computeStressStreak(silverRows, 1.25),
};

const out = NextResponse.json({
  asOfDate: latestDate,
  priorDate,
  curves,
  macro,
  stressStreak,
});

out.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
out.headers.set("Pragma", "no-cache");
out.headers.set("Expires", "0");
return out;

  } catch (err) {
    console.error("Error in /api/goldcurve:", err);
    return NextResponse.json(
      {
        error: "Failed to load metals curve data",
        detail: err?.message || String(err),
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
