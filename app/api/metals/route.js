import { NextResponse } from "next/server";

function toNum(x) {
  const s = String(x ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export async function GET() {
  try {
    const url = process.env.METALS_CSV_URL;
    if (!url) {
      return NextResponse.json(
        { error: "Missing METALS_CSV_URL" },
        { status: 500 }
      );
    }

    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: `CSV fetch failed ${res.status}`, body200: text.slice(0, 200) },
        { status: 500 }
      );
    }

    const lines = text.split(/\r?\n/).filter(l => l.trim().length);
    if (lines.length < 2) {
      return NextResponse.json(
        { error: "CSV empty or missing rows" },
        { status: 500 }
      );
    }

    const headers = lines[0].split(",").map(h => h.trim());

    const rows = lines.slice(1).map(line => {
      const cols = line.split(",");
      const obj = {};
      headers.forEach((h, i) => (obj[h] = cols[i]));
      return obj;
    });

    const first = rows[0] || {};

    const asOfDate = first.as_of_date ?? "";
    const priorDate = first.prior_date ?? "";

    const curves = rows
      .map(r => ({
        tenorMonths: toNum(r.tenor_months),
        goldToday: toNum(r.gold_today),
        goldPrior: toNum(r.gold_prior),
        silverToday: toNum(r.silver_today),
        silverPrior: toNum(r.silver_prior),
      }))
      .filter(r => r.tenorMonths != null)
      .sort((a, b) => a.tenorMonths - b.tenorMonths);

    return NextResponse.json({
      asOfDate,
      priorDate,
      curves,
    });
  } catch (e) {
    return NextResponse.json(
      { error: String(e.message || e) },
      { status: 500 }
    );
  }
}
