import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
});

function parseTenors(s) {
  if (!s) return [0, 1, 2, 3, 4, 5, 12];
  return s
    .split(",")
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

export async function GET(req) {
  const client = await pool.connect();

  try {
    const { searchParams } = new URL(req.url);

    const metal = (searchParams.get("metal") || "Gold").trim();
    const daysRaw = parseInt(searchParams.get("days") || "90", 10);
    const days = Number.isFinite(daysRaw) ? Math.max(10, Math.min(daysRaw, 365)) : 90;

    const tenors = parseTenors(searchParams.get("tenors"));

    const sql = `
      WITH d AS (
        SELECT DISTINCT as_of_date
        FROM metals_curve_history
        WHERE metal = $1
          AND as_of_date >= (CURRENT_DATE - ($2 || ' days')::interval)
        ORDER BY as_of_date DESC
        LIMIT $2
      )
      SELECT h.as_of_date,
             h.tenor_months,
             h.price::float
      FROM metals_curve_history h
      JOIN d ON d.as_of_date = h.as_of_date
      WHERE h.metal = $1
        AND h.tenor_months = ANY($3)
      ORDER BY h.as_of_date ASC, h.tenor_months ASC;
    `;

    const res = await client.query(sql, [metal, days, tenors]);

    return NextResponse.json({
      metal,
      days,
      tenors,
      rows: (res.rows || []).map((r) => ({
        as_of_date: String(r.as_of_date).slice(0, 10),
        tenor_months: Number(r.tenor_months),
        price: Number(r.price),
      })),
    });
  } catch (err) {
    console.error("Error in /api/metals-history:", err);
    return NextResponse.json(
      {
        error: "Failed to load metals curve history",
        detail: err?.message || String(err),
      },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
