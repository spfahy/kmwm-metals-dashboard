import { NextResponse } from "next/server";
import { Pool } from "pg";

// Uses DATABASE_URL from Vercel env
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const client = await pool.connect();
  try {
    const todayResult = await client.query(
      `SELECT as_of_date,
              metal,
              tenor_months,
              price::float,
              real_10yr_yld,
              dollar_index,
              deficit_gdp_flag
       FROM v_metals_curve_today
       WHERE LOWER(metal) IN ('gold', 'silver')
       ORDER BY metal, tenor_months`
    );

    const today = todayResult.rows;

    if (!today || today.length === 0) {
      return NextResponse.json({
        asOfDate: null,
        priorDate: null,
        curves: [],
        macro: {
          asOfDate: null,
          real10y: null,
          dollarIndex: null,
          deficitFlag: null,
          goldFrontMonth: null,
        },
      });
    }

    const asOfDate = today[0]?.as_of_date ?? null;

    const byMetal = { GOLD: [], SILVER: [] };
    for (const r of today) {
      const key = r.metal.toUpperCase();
      if (key === "GOLD" || key === "SILVER") {
        byMetal[key].push(r);
      }
    }

    const metals = ["GOLD", "SILVER"];

    const curves = metals.map((metal) => {
      const points = (byMetal[metal] || [])
        .slice()
        .sort((a, b) => a.tenor_months - b.tenor_months)
        .map((r) => ({
          tenorMonths: r.tenor_months,
          priceToday: r.price,
          pricePrior: null,
        }));

      return { metal, points };
    });

    const base = today[0] || {};
    const macro = {
      asOfDate,
      real10y: base.real_10yr_yld ?? null,
      dollarIndex: base.dollar_index ?? null,
      deficitFlag: base.deficit_gdp_flag ?? null,
      goldFrontMonth:
        today
          .filter((r) => r.metal.toLowerCase() === "gold")
          .sort((a, b) => a.tenor_months - b.tenor_months)[0]?.price ?? null,
    };

    return NextResponse.json({
      asOfDate,
      priorDate: null,
      curves,
      macro,
    });
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
