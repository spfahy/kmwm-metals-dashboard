// app/api/metals/route.js
// REPLACE THE ENTIRE FILE WITH THIS (full file)

import { NextResponse } from "next/server";
console.log("HEADERS:", headers);
console.log("FIRST ROW:", rows[0]);

// app/api/metals/route.js
// CHANGE ONLY THIS FUNCTION

function toNum(x) {
  let s = String(x ?? "").trim();

  // treat blanks as null (Number("") becomes 0 — that's your "all zeros" bug)
  if (s === "") return null;

  // strip simple wrapping quotes from CSV
  if (s.startsWith('"') && s.endsWith('"')) s = s.slice(1, -1).trim();

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}


// normalize header names so ANY of these work:
// "tenor_months", "Tenor Months", "TENOR MONTHS", "tenorMonths", etc.
function normKey(k) {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, ""); // remove spaces + underscores
}

function pickNorm(obj, keys) {
  for (const k of keys) {
    const v = obj[normKey(k)];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

// Expected CSV columns (header row required):
// as_of_date, prior_date, tenor_months, gold_today, gold_prior, silver_today, silver_prior
// BUT we now also accept space/case variants like "As Of Date", "Tenor Months", etc.
export async function GET() {
  try {
    const url = process.env.METALS_CSV_URL;
    if (!url) {
      return NextResponse.json(
        { error: "Missing env var METALS_CSV_URL" },
        { status: 500 }
      );
    }

    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: `CSV fetch failed: ${res.status}`, body200: text.slice(0, 200) },
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

    const rawHeaders = lines[0].split(",").map((h) => h.trim());
    const headers = rawHeaders.map(normKey);

    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",");
      const obj = {};
      headers.forEach((h, i) => (obj[h] = cols[i]));
      return obj;
    });

    const first = rows[0] || {};

    const asOfDate =
      pickNorm(first, ["as_of_date", "asOfDate", "As Of Date", "date"]) ?? "";
    const priorDate =
      pickNorm(first, ["prior_date", "priorDate", "Prior Date"]) ?? "";

    const curves = rows
      .map((r) => ({
      tenorMonths: toNum(
  pick(r, [
    "tenor_months",
    "tenorMonths",
    "tenor",
    "Tenor (mo)",
    "months"
  ])
),

        goldToday: toNum(pickNorm(r, ["gold_today", "goldToday", "Gold Today"])),
        goldPrior: toNum(pickNorm(r, ["gold_prior", "goldPrior", "Gold Prior"])),
        silverToday: toNum(
          pickNorm(r, ["silver_today", "silverToday", "Silver Today"])
        ),
        silverPrior: toNum(
          pickNorm(r, ["silver_prior", "silverPrior", "Silver Prior"])
        ),
      }))
      .filter((r) => r.tenorMonths != null)
      .sort((a, b) => a.tenorMonths - b.tenorMonths);

    return NextResponse.json({
      asOfDate,
      priorDate,
      curves,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
