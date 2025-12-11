import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET() {
  const client = await pool.connect();

  try {
    // Last 90 days of history, front-month (tenor 0)
    const res = await client.query(
      `
      SELECT
        as_of_date,
        metal,
        tenor_months,
        price::float
      FROM metals_curve_history
      WHERE tenor_months = 0
        AND LOWER(metal) IN ('gold', 'silver')
      ORDER BY as_of_date ASC, metal ASC
      `
    );

    const rows = res.rows || [];

    // Group by date
    const byDate = new Map();

    for (const r of rows) {
      const d = r.as_of_date;
      if (!d) continue;
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD

      if (!byDate.has(key)) {
        byDate.set(key, { date: key, gold: null, silver: null });
      }

      const entry = byDate.get(key);
      const m = r.metal.toLowerCase();
      if (m === "gold") entry.gold = r.price;
      if (m === "silver") entry.silver = r.price;
    }

    const series = Array.from(byDate.values());

    return NextResponse.json({ series });
  } catch (err) {
    console.error("Error in /api/metals-history:", err);
    return NextResponse.json(
      {
        error: "Failed to load metals history",
        detail: err?.message || String(err),
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
