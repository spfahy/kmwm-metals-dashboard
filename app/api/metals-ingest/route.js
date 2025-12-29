import { NextResponse } from "next/server";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

function parseCsv(text) {
  // Minimal CSV parser that respects quotes
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => String(c).trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  // last cell
  row.push(cur);
  if (row.some((c) => String(c).trim() !== "")) rows.push(row);

  return rows;
}

function toNum(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  const csvUrl = process.env.METALS_CSV_URL;

  if (!csvUrl) {
    return NextResponse.json({ ok: false, error: "METALS_CSV_URL not set" }, { status: 500 });
  }

  // cache-bust
  const bust = `cb=${Date.now()}`;
  const fetchUrl = csvUrl.includes("?") ? `${csvUrl}&${bust}` : `${csvUrl}?${bust}`;

  const res = await fetch(fetchUrl, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });

  const text = await res.text();
  const table = parseCsv(text);

  if (table.length < 2) {
    return NextResponse.json(
      { ok: false, error: "CSV returned no rows", sample: text.slice(0, 200) },
      { status: 500 }
    );
  }

  const header = table[0].map((h) => String(h || "").trim().toLowerCase());

  // Find column indexes by header name (robust)
  const idx = (name) => header.indexOf(name);

  const iAsOf = idx("as of date");
  const iMetal = idx("metal");
  const iTenor = idx("tenor months");
  const iPrice = idx("price");
  const iReal = idx("10 yr real yld");
  const iDxy = idx("dollar index");
  const iDef = idx("deficit gdp flag");

  if (iAsOf < 0 || iMetal < 0 || iTenor < 0 || iPrice < 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "CSV header mismatch",
        header,
      },
      { status: 500 }
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let asOfDateSeen = null;
    let upsertedLatest = 0;

    for (let r = 1; r < table.length; r++) {
      const row = table[r];

      const asOfDate = String(row[iAsOf] || "").trim();
      const metal = String(row[iMetal] || "").trim();
      const tenorMonths = toNum(row[iTenor]);
      const price = toNum(row[iPrice]);

      const real10y = iReal >= 0 ? toNum(row[iReal]) : null;
      const dollarIndex = iDxy >= 0 ? toNum(row[iDxy]) : null;
      const deficitFlag = iDef >= 0 ? toNum(row[iDef]) : null;

      if (!asOfDate || !metal) continue;
      if (tenorMonths == null || price == null) continue;

      asOfDateSeen = asOfDate;

      // history append
      await client.query(
        `
        INSERT INTO metals_curve_history (
          as_of_date, metal, tenor_months, price,
          real_10yr_yld, dollar_index, deficit_gdp_flag, inserted_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
        `,
        [asOfDate, metal, tenorMonths, price, real10y, dollarIndex, deficitFlag]
      );

      // latest upsert
      await client.query(
        `
        INSERT INTO metals_curve_latest (
          as_of_date, metal, tenor_months, price,
          real_10yr_yld, dollar_index, deficit_gdp_flag, updated_at
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
        [asOfDate, metal, tenorMonths, price, real10y, dollarIndex, deficitFlag]
      );

      upsertedLatest++;
    }

    await client.query("COMMIT");

    return NextResponse.json({
      ok: true,
      route: "metals-ingest",
      asOfDate: asOfDateSeen,
      upsertedLatest,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  } finally {
    client.release();
  }
}
