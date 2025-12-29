import { NextResponse } from "next/server";
import { Client } from "pg";

function clean(x) {
  return String(x ?? "").trim().replace(/^"|"$/g, "");
}

function toNum(x) {
  const s = clean(x);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normKey(k) {
  return clean(k).toLowerCase().replace(/[\s_]+/g, "");
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return { headers: [], rows: [] };

  const rawHeaders = lines[0].split(",").map(clean);
  const headers = rawHeaders.map(normKey);

  const rows = lines.slice(1).map((line) => {
    const cols = line.split(",").map(clean);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    return obj;
  });

  return { headers, rows };
}

function pick(obj, keys) {
  for (const k of keys) {
    const nk = normKey(k);
    if (obj[nk] != null && clean(obj[nk]) !== "") return obj[nk];
  }
  return null;
}

// CSV expected (your Metals tab):
// As Of Date, Metal, Tenor Months, Price, 10 Yr Real Yld, Dollar Index, Deficit GDP Flag
export async function GET() {
  try {
    const csvUrl = process.env.METALS_CSV_URL;
    const dbUrl = process.env.DATABASE_URL;

    if (!csvUrl) {
      return NextResponse.json(
        { error: "Missing env var METALS_CSV_URL" },
        { status: 500 }
      );
    }
    if (!dbUrl) {
      return NextResponse.json(
        { error: "Missing env var DATABASE_URL" },
        { status: 500 }
      );
    }

    // 1) Load TODAY from CSV
    const res = await fetch(csvUrl, { cache: "no-store" });
    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: `CSV fetch failed ${res.status}`, body200: text.slice(0, 200) },
        { status: 500 }
      );
    }

    const { rows } = parseCsv(text);
    if (!rows.length) {
      return NextResponse.json(
        { error: "CSV empty or missing rows" },
        { status: 500 }
      );
    }

    // Use first row for metadata
    const first = rows[0];
    const rawDate = clean(
  pick(first, ["As Of Date", "as_of_date", "asOfDate", "date"])
);

const parsedDate = rawDate ? new Date(rawDate) : null;

const asOfDate =
  parsedDate && !isNaN(parsedDate)
    ? parsedDate.toISOString().slice(0, 10)
    : "";

    const realYield = toNum(pick(first, ["10 Yr Real Yld", "realYield", "real_10yr_yld"]));
    const dollarIndex = toNum(pick(first, ["Dollar Index", "dollarIndex"]));
    const deficitFlagRaw = clean(pick(first, ["Deficit GDP Flag", "deficitFlag", "deficit_gdp_flag"]));
    const deficitFlag =
      deficitFlagRaw === "true" || deficitFlagRaw === "TRUE" || deficitFlagRaw === "1";

    if (!asOfDate) {
      return NextResponse.json(
        { error: "Missing As Of Date in CSV (Metals tab)" },
        { status: 500 }
      );
    }

    // Build TODAY maps by (metal, tenor)
    const todayMap = new Map(); // key = metal|tenor -> price
    const tenorsSet = new Set();

    for (const r of rows) {
      const metal = clean(pick(r, ["Metal", "metal"]))?.toUpperCase();
      const tenorMonths = toNum(pick(r, ["Tenor Months", "tenorMonths", "tenor_months", "tenor"]));
      const price = toNum(pick(r, ["Price", "price"]));
      const rowDate = clean(pick(r, ["As Of Date", "as_of_date", "asOfDate", "date"])) || asOfDate;

      if (!metal || tenorMonths == null || price == null) continue;
      if (rowDate !== asOfDate) continue;

      tenorsSet.add(tenorMonths);
      todayMap.set(`${metal}|${tenorMonths}`, price);
    }

    const tenors = Array.from(tenorsSet).sort((a, b) => a - b);

    // 2) Pull PRIOR from DB (latest date < asOfDate) + prices for that date
    const client = new Client({ connectionString: dbUrl });
    await client.connect();

  

    const priorMap = new Map();
    // Prior date comes from database: asOfDate - 1 day
const priorRowsRes = await client.query(
  `
  SELECT metal, tenor_months, price
  FROM metals_curve_history
  WHERE as_of_date = (
  SELECT MAX(as_of_date)
  FROM metals_curve_history
  WHERE as_of_date < $1::date
)
const priorRowsRes = await client.query(
  `
  SELECT as_of_date, metal, tenor_months, price
  FROM metals_curve_history
  WHERE as_of_date = (
    SELECT MAX(as_of_date)
    FROM metals_curve_history
    WHERE as_of_date < $1::date
  )
  `,
  [asOfDate]
);



const priorDate =
  priorRowsRes.rows?.length
    ? String(priorRowsRes.rows[0].as_of_date).slice(0, 10)
    : "";


const priorMap = new Map();
for (const pr of priorRowsRes.rows || []) {
  const metal = String(pr.metal || "").toUpperCase();
  const tenorMonths = Number(pr.tenor_months);
  const price = Number(pr.price);
  if (!metal || !Number.isFinite(tenorMonths) || !Number.isFinite(price)) continue;
  priorMap.set(`${metal}|${tenorMonths}`, price);
}


    await client.end();

    // 3) Build curves output
    const curves = tenors.map((t) => ({
      tenorMonths: t,
      goldToday: todayMap.get(`GOLD|${t}`) ?? null,
      goldPrior: priorMap.get(`GOLD|${t}`) ?? null,
      silverToday: todayMap.get(`SILVER|${t}`) ?? null,
      silverPrior: priorMap.get(`SILVER|${t}`) ?? null,
    }));

    return NextResponse.json({
      asOfDate,
      priorDate,
      realYield,
      dollarIndex,
      deficitFlag,
      curves,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
