import { NextResponse } from "next/server";

function toNum(x) {
  const n = Number(String(x ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] != null && String(obj[k]).trim() !== "") return obj[k];
  }
  return null;
}

// Expected CSV columns (header row required):
// as_of_date, prior_date, tenor_months, gold_today, gold_prior, silver_today, silver_prior
// You can add extra columns; they’ll be ignored.
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
    if (!res.ok) {
      return NextResponse.json(
        { error: `CSV fetch failed: ${res.status}` },
        { status: 500 }
      );
    }

    const text = await res.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV empty or missing rows" },
        { status: 500 }
      );
    }

    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => {
      const cols = line.split(",");
      const obj = {};
      headers.forEach((h, i) => (obj[h] = cols[i]));
      return obj;
    });

    // Pull dates from first row (or fallback to blanks)
    const first = rows[0] || {};
    const asOfDate = pick(first, ["as_of_date", "asOfDate", "date"]) ?? "";
    const priorDate = pick(first, ["prior_date", "priorDate"]) ?? "";

    const curves = rows
      .map((r) => ({
        tenorMonths: toNum(pick(r, ["tenor_months", "tenorMonths", "tenor"])),
        goldToday: toNum(pick(r, ["gold_today", "goldToday"])),
        goldPrior: toNum(pick(r, ["gold_prior", "goldPrior"])),
        silverToday: toNum(pick(r, ["silver_today", "silverToday"])),
        silverPrior: toNum(pick(r, ["silver_prior", "silverPrior"])),
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
