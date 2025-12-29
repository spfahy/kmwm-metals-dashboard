import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function GET(req) {
  const url = new URL(req.url);
  const ping = url.searchParams.get("ping");

  const csvUrl = process.env.METALS_CSV_URL || "";

  // PING MODE: tell us what code + env this running instance sees
  if (ping) {
    return NextResponse.json({
      ok: true,
      route: "metals-ingest",
      ping: true,
      metals_csv_url_present: !!csvUrl,
      metals_csv_url_prefix: csvUrl ? csvUrl.slice(0, 60) : "",
    });
  }

  if (!csvUrl) {
    return NextResponse.json({ ok: false, error: "METALS_CSV_URL not set" }, { status: 500 });
  }

const bust = `cb=${Date.now()}`;
const url2 = csvUrl.includes("?") ? `${csvUrl}&${bust}` : `${csvUrl}?${bust}`;
const res = await fetch(url2, {
  cache: "no-store",
  headers: { "Cache-Control": "no-cache" },
});

  cache: "no-store",
  headers: { "Cache-Control": "no-cache" },
});

  const text = await res.text();
  const lines = text.split("\n").filter(Boolean);
  const rows = lines.slice(1);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const line of rows) {
      const cols = line.split(",");

      const asOfDate = cols[0];
      const metal = cols[1];
      const tenorMonths = Number(cols[2]);
      const price = Number(cols[4]);
      const real10y = Number(cols[5]);
      const dollarIndex = Number(cols[6]);
      const deficitFlag = Number(cols[7]);

      if (!metal || !Number.isFinite(tenorMonths) || !Number.isFinite(price)) continue;

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
        [asOfDate, metal, tenorMonths, price, real10y, dollarIndex, deficitFlag]
      );
    }

    await client.query("COMMIT");
    return NextResponse.json({ ok: true, route: "metals-ingest" });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
