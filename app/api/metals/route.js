import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

function classifyMetal(m) {
  const s = String(m || "").trim().toLowerCase();
  if (!s) return null;

  if (s === "gold" || s === "gc" || s === "xau" || s.includes("gold")) return "Gold";
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
      // 1) Get latest + prior dates from HISTORY (source of truth)
      const dateRes = await client.query(`
        SELECT DISTINCT as_of_date
        FROM metals_curve_history
        ORDER BY as_of_date DESC
        LIMIT 2
      `);

      const asOfDate = dateRes.rows?.[0]?.as_of_date ?? null;
      const priorDate = dateRes.rows?.[1]?.as_of_date ?? null;

      if (!asOfDate) {
        return NextResponse.json({
          asOfDate: null,
          priorDate: null,
          curves: [],
          note: "No metals_curve_history data found.",
        });
      }

      // 2) Pull TODAY curve from history using asOfDate
      const curveRes = await client.query(
        `
        SELECT metal, tenor_months, price, as_of_date
        FROM metals_curve_history
        WHERE as_of_date = $1
        ORDER BY metal, tenor_months
        `,
        [asOfDate]
      );

      // 3) Pull PRIOR curve from history using priorDate (if we have it)
      let priorRes = { rows: [] };
      if (priorDate) {
        priorRes = await client.query(
          `
          SELECT metal, tenor_months, price, as_of_date
          FROM metals_curve_history
          WHERE as_of_date = $1
          ORDER BY metal, tenor_months
          `,
          [priorDate]
        );
      }

      const todayBy = {};
      const priorBy = {};

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

          return { tenorMonths: tenor, goldToday, goldPrior, silverToday, silverPrior };
        });

      return NextResponse.json({ asOfDate, priorDate, curves });
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
