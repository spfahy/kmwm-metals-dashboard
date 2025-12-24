import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET() {
  const client = await pool.connect();
  try {
    const history = await client.query(`
      select
        count(*) as rows,
        count(distinct as_of_date) as days,
        min(as_of_date) as first_day,
        max(as_of_date) as last_day
      from metals_curve_history;
    `);

    const latest = await client.query(`
      select
        count(*) as rows,
        count(distinct as_of_date) as days,
        min(as_of_date) as first_day,
        max(as_of_date) as last_day,
        max(updated_at) as last_updated_at
      from metals_curve_latest;
    `);

    const daily = await client.query(`
      select
        count(*) as rows,
        count(distinct as_of_date) as days,
        min(as_of_date) as first_day,
        max(as_of_date) as last_day
      from metal_daily;
    `);

    const deletions = await client.query(`
      select
        count(*) as deleted_rows,
        max(deleted_at) as last_delete_at
      from metals_curve_history_audit;
    `);

    return NextResponse.json({
      ok: true,
      metals_curve_history: history.rows[0],
      metals_curve_latest: latest.rows[0],
      metal_daily: daily.rows[0],
      delete_audit: deletions.rows[0],
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "report_failed", detail: err?.message || String(err) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
