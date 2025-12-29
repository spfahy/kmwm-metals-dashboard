// app/api/metals/route.js

import { NextResponse } from "next/server";
import { Client } from "pg";

function toNum(x) {
  const s = String(x ?? "").trim().replace(/^"|"$/g, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normKey(k) {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, ""); // remove spaces/underscores
}

function getByNorm(obj, keys) {
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

export async function GET() {
  let client;
  try {
    // --- 1) Fetch CSV ---
    const csvUrl = process.env.METALS_CSV_URL;
    if (!csvUrl) {
      return NextResponse.json(
        { error: "Missing env var METALS_CSV_URL" },
        { status: 500 }
      );
    }

    const res = await fetch(csvUrl, { cache: "no-store" });
    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: `CSV fetch failed ${res.status}`, body200: text.slice(0, 200) },
        { status: 500 }
      );
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV empty or missing rows" },
        { status: 500 }
      );
    }

    // --- 2) Parse headers + rows (supports your sheet headers) ---
    const rawHeaders = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    const headers = rawHeaders.map(normKey);

    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => String(c ?? "").replace(/^"|"$/g, ""));
      const obj = {};
      headers.forEach((h, i) => (obj[h] = cols[i]));
      return obj;
    });

    // Required headers (normalized):
    // As Of Date -> asofdate
    // Metal -> metal
    // Tenor Months -> tenormonths
    // Price -> price
    const need = ["asofdate", "metal", "tenormonths", "price"];
    const missing = need.filter((k) => !headers.includes(k));
    if (missing.length) {
      return NextResponse.json(
        {
          error: "CSV headers not recognized",
          need: ["As Of Date", "Metal", "Tenor Months", "Price"],
          got: rawHeaders,
        },
        { status: 500 }
      );
    }

    // --- 3) Pull today (from CSV) ---
    const first = rows[0] || {};
    const asOfDate = String(getByNorm(first, ["asofdate"]) ?? "").slice(0, 10); // "YYYY-MM-DD"

    const realYield = toNum(getByNorm(first, ["10yrrealyld", "10yrrealyield", "realyield"]));
    const dollarIndex = toNum(getByNorm(first, ["dollarindex"]));
    const deficitFlagRaw = getByNorm(first, ["deficitgdpflag"]);
    const deficitFlag = String(deficitFlagRaw ?? "").trim() === "1" ? true : false;

    const todayMap = new Map();
    const tenorsSet = new Set();

    for (const r of rows) {
      const metal = String(getByNorm(r, ["metal"]) ?? "").trim().toUpperCase();
      const tenorMonths = toNum(getByNorm(r, ["tenormonths"]));
      const price = toNum(
  getByNorm(r, ["price", "cmecontrprice", "cmecontractprice"])
);


      if (!metal || tenorMonths == null || price == null) continue;

      tenorsSet.add(tenorMonths);
      todayMap.set(`${metal}|${tenorMonths}`, price);
    }

    const tenors = Array.from(tenorsSet).sort((a, b) => a - b);

    // --- 4) Pull PRIOR from database (latest date < asOfDate) ---
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      return NextResponse.json(
        { error: "Missing env var DATABASE_URL" },
        { status: 500 }
      );
    }

    client = new Client({ connectionString: dbUrl });
    await client.connect();

    const priorDateRes = await client.query(
      `
      SELECT MAX(as_of_date) AS prior_date
      FROM metals_curve_history
      WHERE as_of_date < $1::date
      `,
      [asOfDate]
    );

    const priorDateVal = priorDateRes.rows?.[0]?.prior_date;
    const priorDate = priorDateVal ? String(priorDateVal).slice(0, 10) : "";

    const priorMap = new Map();

    if (priorDate) {
      const priorRowsRes = await client.query(
        `
        SELECT metal, tenor_months, price
        FROM metals_curve_history
        WHERE as_of_date = $1::date
        `,
        [priorDate]
      );

      for (const pr of priorRowsRes.rows || []) {
        const metal = String(pr.metal ?? "").trim().toUpperCase();
        const tenorMonths = Number(pr.tenor_months);
        const price = Number(pr.price);
        if (!metal || !Number.isFinite(tenorMonths) || !Number.isFinite(price)) continue;
        priorMap.set(`${metal}|${tenorMonths}`, price);
      }
    }

    await client.end();
    client = null;

    // --- 5) Build curves output ---
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
    try {
      if (client) await client.end();
    } catch {}
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
