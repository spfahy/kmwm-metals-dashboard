import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function GET() {
  const client = await pool.connect();
  try {
    // Find the most recent as_of_date in history
    const d = await client.query(`
      SELECT MAX(as_of_date) AS as_of_date
      FROM metals_curve_history
    `);

    const asOfDate = d.rows?.[0]?.as_of_date;
    if (!asOfDate) {
      return NextResponse.json(
        { ok: false, error: "No metals_curve_history data found" },
        { status: 400 }
      );
    }

    // Upsert latest from that most recent date
    await client.query(
      `
      INSERT INTO metals_curve_latest (
        as_of_date,
        metal,
        tenor_months,
        price,
        real_10yr_yld,
        dollar_index,
        deficit_gdp_flag,
        updated_at
      )
      SELECT
        as_of_date,
        metal,
        tenor_months,
        price,
        real_10yr_yld,
        dollar_index,
        deficit_gdp_flag,
        NOW()
      FROM metals_curve_history
      WHERE as_of_date = $1
      ON CONFLICT (metal, tenor_months)
      DO UPDATE SET
        as_of_date        = EXCLUDED.as_of_date,
        price             = EXCLUDED.price,
        real_10yr_yld     = EXCLUDED.real_10yr_yld,
        dollar_index      = EXCLUDED.dollar_index,
        deficit_gdp_flag  = EXCLUDED.deficit_gdp_flag,
        updated_at        = NOW()
      `,
      [asOfDate]
    );

    return NextResponse.json({ ok: true, asOfDate });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
