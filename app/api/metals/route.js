import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function GET() {
  try {
    const client = await pool.connect();

    try {
      // Pull latest curve
      const curveRes = await client.query(`
        SELECT
          metal,
          tenor_months,
          price,
          as_of_date
        FROM v_metals_curve_today
        ORDER BY metal, tenor_months
      `);

      // Pull prior curve (most recent prior date)
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

      const todayMap = {};
      const priorMap = {};

      curveRes.rows.forEach((r) => {
        const key = `${r.metal}_${r.tenor_months}`;
        todayMap[key] = r;
      });

      priorRes.rows.forEach((r) => {
        const key = `${r.metal}_${r.tenor_months}`;
        priorMap[key] = r;
      });

      const tenors = new Set();
      curveRes.rows.forEach((r) => tenors.add(r.tenor_months));
      priorRes.rows.forEach((r) => tenors.add(r.tenor_months));

      const curves = Array.from(tenors)
        .sort((a, b) => a - b)
        .map((tenor) => {
          const goldToday = todayMap[`Gold_${tenor}`]?.price ?? null;
          const goldPrior = priorMap[`Gold_${tenor}`]?.price ?? null;
          const silverToday = todayMap[`Silver_${tenor}`]?.price ?? null;
          const silverPrior = priorMap[`Silver_${tenor}`]?.price ?? null;

          return {
            tenorMonths: tenor,
            goldToday,
            goldPrior,
            silverToday,
            silverPrior,
          };
        });

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
