// app/api/metals-validate/route.js
import { Pool } from "pg";

const REQUIRED_TOKEN = process.env.METALS_INGEST_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

let pool;
function getPool() {
  if (!pool) {
    if (!DATABASE_URL) throw new Error("Missing DATABASE_URL env var");
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  }
  return pool;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req) {
  try {
    // Auth (same token as ingest)
    const auth = req.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!REQUIRED_TOKEN || token !== REQUIRED_TOKEN) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    const client = await getPool().connect();
    try {
      const latestMax = await client.query(
        `select max(as_of_date) as max_date from metals_curve_latest`
      );
      const histMax = await client.query(
        `select max(as_of_date) as max_date from metals_curve_history`
      );

      // Recent counts by date+metal (history)
      const counts = await client.query(`
        select as_of_date, metal, count(*)::int as rows
        from metals_curve_history
        group by as_of_date, metal
        order by as_of_date desc, metal
        limit 60
      `);

      return jsonResponse({
        ok: true,
        latest_max_date: latestMax.rows[0]?.max_date || null,
        history_max_date: histMax.rows[0]?.max_date || null,
        history_counts_recent: counts.rows,
      });
    } finally {
      client.release();
    }
  } catch (e) {
    return jsonResponse({ ok: false, error: String(e?.message || e) }, 500);
  }
}
