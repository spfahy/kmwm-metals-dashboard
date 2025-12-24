// app/api/metals-ingest/route.js
// PRODUCTION VERSION: validates auth token and writes rows into Neon.

import { Pool } from 'pg';

const REQUIRED_TOKEN = process.env.METALS_INGEST_TOKEN; // set in Vercel env
const DATABASE_URL = process.env.DATABASE_URL;          // set in Vercel env

// Reuse pool across invocations
let pool;
function getPool() {
  if (!pool) {
    if (!DATABASE_URL) throw new Error('Missing DATABASE_URL env var');
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
  }
  return pool;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function unauthorized() {
  return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
}

export async function GET() {
  // Lightweight health check
  return jsonResponse({ ok: true, route: 'metals-ingest' }, 200);
}

export async function POST(req) {
  // ---- Auth ----
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!REQUIRED_TOKEN || token !== REQUIRED_TOKEN) return unauthorized();

  // ---- Parse body ----
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const rows = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) {
    return jsonResponse({ ok: false, error: 'No rows provided' }, 400);
  }

  // ---- Validate and normalize rows ----
  const cleaned = [];
  for (const r of rows) {
    const as_of_date = String(r.as_of_date || '').trim();
    const metal = String(r.metal || '').trim();
    const tenor_months = Number(r.tenor_months);
    const price = Number(r.price);

    if (!as_of_date || !metal) continue;
    if (!Number.isFinite(tenor_months) || !Number.isFinite(price)) continue;

    cleaned.push({
      as_of_date,
      metal,
      tenor_months,
      price,
      real_10yr_yld: r.real_10yr_yld === null || r.real_10yr_yld === undefined ? null : Number(r.real_10yr_yld),
      dollar_index: r.dollar_index === null || r.dollar_index === undefined ? null : Number(r.dollar_index),
      deficit_gdp_flag: r.deficit_gdp_flag === null || r.deficit_gdp_flag === undefined ? null : Boolean(r.deficit_gdp_flag),
    });
  }

  if (cleaned.length === 0) {
    return jsonResponse({ ok: false, error: 'All rows invalid after validation' }, 400);
  }

  // ---- DB write (single transaction) ----
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    // Upsert into latest
    // Unique constraint expected: (metal, tenor_months)
    const upsertSql = `
      INSERT INTO metals_curve_latest
        (as_of_date, metal, tenor_months, price, real_10yr_yld, dollar_index, deficit_gdp_flag, updated_at)
      VALUES
        ($1::date, $2::text, $3::int, $4::numeric, $5::numeric, $6::numeric, $7::boolean, NOW())
      ON CONFLICT (metal, tenor_months)
      DO UPDATE SET
        as_of_date = EXCLUDED.as_of_date,
        price = EXCLUDED.price,
        real_10yr_yld = EXCLUDED.real_10yr_yld,
        dollar_index = EXCLUDED.dollar_index,
        deficit_gdp_flag = EXCLUDED.deficit_gdp_flag,
        updated_at = NOW()
    `;

    for (const r of cleaned) {
      await client.query(upsertSql, [
        r.as_of_date,
        r.metal,
        r.tenor_months,
        r.price,
        r.real_10yr_yld,
        r.dollar_index,
        r.deficit_gdp_flag,
      ]);
    }

    // Append into history
    const historySql = `
  INSERT INTO metals_curve_history
    (as_of_date, metal, tenor_months, price, real_10yr_yld, dollar_index, deficit_gdp_flag, inserted_at)
  VALUES
    ($1::date, $2::text, $3::int, $4::numeric, $5::numeric, $6::numeric, $7::boolean, NOW())
  ON CONFLICT DO NOTHING
`;


    for (const r of cleaned) {
      await client.query(historySql, [
        r.as_of_date,
        r.metal,
        r.tenor_months,
        r.price,
        r.real_10yr_yld,
        r.dollar_index,
        r.deficit_gdp_flag,
      ]);
    }

    await client.query('COMMIT');
    return jsonResponse({ ok: true, inserted: cleaned.length }, 200);
  } catch (e) {
    await client.query('ROLLBACK');
    return jsonResponse({ ok: false, error: String(e?.message || e) }, 500);
  } finally {
    client.release();
  }
}
