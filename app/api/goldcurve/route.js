import { NextResponse } from "next/server";
import { Pool } from "pg";

// Uses DATABASE_URL you set in Vercel
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const client = await pool.connect();
  try {
    // Today snapshot
    const todayResult = await client.query(
      `SELECT as_of_date,
              metal,
              tenor_months,
              price::float,
              real_10yr_yld,
              dollar_index,
              deficit_gdp_flag
       FROM v_metals_curve_today
       WHERE metal IN ('GOLD', 'SILVER')
       ORDER BY metal, tenor_months`
    );

    // Prior snapshot (from history view)
    const priorResult = await client.query(
      `SELECT as_of_date,
              metal,
              tenor_months,
              price::float,
              real_10yr_yld,
              dollar_index,
              deficit_gdp_flag
       FROM v_metals_curve_prior
       WHERE metal IN ('GOLD', 'SILVER')
       ORDER BY metal, tenor_months`
    );

    const today = todayResult.rows;
    const prior = priorResult.rows;

    const asOfDate = today[0]?.as_of_date ?? null;
    const priorDate = prior[0]?.as_of_date ?? null;

    // Group by metal
    function groupByMetal(rows) {
      const out = { GOLD: [], SILVER: [] };
      for (const r of rows) {
        if (r.metal === "GOLD" || r.metal === "SILVER") {
          out[r.metal].push(r);
        }
      }
      return out;
    }

    const todayBy = groupByMetal(today);
    const priorBy = groupByMetal(prior);

    const metals = ["GOLD", "SILVER"];

    // Build curve arrays
    const curves = metals.map((metal) => {
      const t = (todayBy[metal] || []).sort(
        (a, b) => a.tenor_months - b.tenor_months
      );
      const p = (priorBy[metal] || []).sort(
        (a, b) => a.tenor_months - b.tenor_months
      );
      const mapPrior = new Map(p.map((r) => [r.tenor_months, r]));

      return {
        metal,
        points: t.map((r) => ({
          tenorMonths: r.tenor_months,
          priceToday: r.price,
          pricePrior: mapPrior.get(r.tenor_months)?.price ?? null,
        })),
      };
    });

    // Macro snapshot from "today" rows
    const base = today[0] || {};
    const macro = {
      asOfDate,
      real10y: base.real_10yr_yld ?? null,
      dollarIndex: base.dollar_index ?? null,
      deficitFlag: base.deficit_gdp_flag ?? null,
      goldFrontMonth:
        today
          .filter((r) => r.metal === "GOLD")
          .sort((a, b) => a.tenor_months - b.tenor_months)[0]?.price ?? null,
    };

    return NextResponse.json({
      asOfDate,
      priorDate,
      curves,
      macro,
    });
  } catch (err) {
    console.error("Error in /api/goldcurve:", err);
    return NextResponse.json(
      { error: "Failed to load metals curve data" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
