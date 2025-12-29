import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

export async function GET(req) {
  const csvUrl = process.env.METALS_CSV_URL;

  if (!csvUrl) {
    return NextResponse.json(
      { ok: false, error: "METALS_CSV_URL not set" },
      { status: 500 }
    );
  }

  // Cache-busted fetch to force fresh Google Sheets data
  const bust = `cb=${Date.now()}`;
  const fetchUrl = csvUrl.includes("?")
    ? `${csvUrl}&${bust}`
    : `${csvUrl}?${bust}`;

  const res = await fetch(fetchUrl, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });

  const text = await res.text();
  const lines = text.split("\n").filter(Boolean);

  // Remove header
  const rows = lines.slice(1);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let asOfDateSeen = null;

    for (const line of rows) {
      const cols = line.split(",");

      const asOfDate = cols[0]?.trim();
      const metal = cols[1]?.trim();
      const tenorMonths = Number(cols[2]);
      const price = Number(cols[4]);
      const real10y = Number(cols[5]);
      const dollarIndex = Number(cols[6]);
      const deficitFlag = Number(cols[7]);

      if (!asOfDate || !metal) continue;
      if (!Number.isFinite(tenorMonths) || !Number.isFinite(price)) continue;

      asOfDateSeen = asOfDate;

      // History append
      await client.query(
        `
        INSERT INTO metals_curve_history (
          as_of_date,
          metal,
          tenor_months,
          price,
          real_10yr_yld,
          dollar_index,
          deficit_gdp_flag,
          inserted_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        `,
        [
          asOfDate,
          metal,
          tenorMonths,
          price,
          real10y,
          dollarIndex,
          deficitFlag,
        ]
      );

      // Latest upsert (THIS is what fixes your issue)
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
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        ON CONFLICT (metal, tenor_months)
        DO UPDATE SET
          as_of_date       = EXCLUDED.as_of_date,
          price            = EXCLUDED.price,
          real_10yr_yld    = EXCLUDED.real_10yr_yld,
          dollar_index     = EXCLUDED.dollar_index,
          deficit_gdp_flag = EXCLUDED.deficit_gdp_flag,
          updated_at       = NOW()
        `,
        [
          asOfDate,
          metal,
          tenorMonths,
          price,
          real10y,
          dollarIndex,
          deficitFlag,
        ]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      route: "metals-ingest",
      asOfDate: asOfDateSeen,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
