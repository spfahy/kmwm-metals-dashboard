import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

function classifyMetal(m) {
  const s = String(m || "").trim().toLowerCase();
  if (!s) return null;

  // Gold aliases
  if (s === "gold" || s === "gc" || s === "xau" || s.includes("gold")) return "Gold";

  // Silver aliases
  if (s === "silver" || s === "si" || s === "xag" || s.includes("silver")) return "Silver";

  return null;
}

function toNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const client = await pool.connect();

    try {
      // Latest curve (view)
      const curveRes = await client.query(`
        SELECT
          metal,
          tenor_months,
          price,
          as_of_date
        FROM v_metals_curve_today
        ORDER BY metal, tenor_months
      `);

      // Prior curve: most recent prior date in history
      const priorRes = await client.query(`
        WITH dates AS (
          SELECT DISTINCT as_of_date
          FROM metals_curve_history
          ORDER BY as_of_date DESC
          LIMIT 2
        )
        SELECT
          metal,
          tenor_months,
          price,
          as_of_date
        FROM metals_curve_history
        WHERE as_of_date = (SELECT MIN(as_of_date) FROM dates)
        ORDER BY metal, tenor_months
      `);

      const todayBy = {}; // key: Gold_12
      const priorBy = {};

      // Build maps using normalized metal labels
      for (const r of curveRes.rows) {
        const label = classifyMetal(r.metal);
        if (!label) continue;
        const tenor = Number(r.tenor_months);
        if (!Number.isFinite(tenor)) continue;
        todayBy[`${label}_${tenor}`] = {
          price: toNum(r.price),
          as_of_date: r.as_of_date,
        };
      }

      for (const r of priorRes.rows) {
        const label = classifyMetal(r.metal);
        if (!label) continue;
        const tenor = Number(r.tenor_months);
        if (!Number.isFinite(tenor)) continue;
        priorBy[`${label}_${tenor}`] = {
          price: toNum(r.price),
          as_of_date: r.as_of_date,
        };
      }

      // Tenors union
      const tenors = new Set();
      Object.keys(todayBy).forEach((k) => tenors.add(Number(k.split("_")[1])));
      Object.keys(priorBy).forEach((k) => tenors.add(Number(k.split("_")[1])));

      const curves = Array.from(tenors)
        .filter((t) => Number.isFinite(t))
        .sort((a, b) => a - b)
        .map((tenor) => {
          const goldToday = todayBy[`Gold_${tenor}`]?.price ?? null;
          const goldPrior = priorBy[`Gold_${tenor}`]?.price ?? null;
          const silverToday = todayBy[`Silver_${tenor}`]?.price ?? null;
          const silverPrior = priorBy[`Silver_${tenor}`]?.price ?? null;

          return {
            tenorMonths: tenor,
            goldToday,
            goldPrior,
            silverToday,
            silverPrior,
          };
        });

      // Dates
      const asOfDate =
        curveRes.rows.length > 0 ? curveRes.rows[0].as_of_date : null;
      const priorDate =
        priorRes.rows.length > 0 ? priorRes.rows[0].as_of_date : null;

      return NextResponse.json({
        asOfDate,
        priorDate,
        curves,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    return new NextResponse(
      JSON.stringify({
        error: "Metals API failed",
        detail: String(err),
      }),
      { status: 500 }
    );
  }
}
