import { NextResponse } from "next/server";

function toNum(x) {
  const s = String(x ?? "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normKey(k) {
  return String(k ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "");
}

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
        { asOfDate: "", priorDate: "", curves: [] },
        { status: 200 }
      );
    }

    const rawHeaders = lines[0].split(",").map((h) => h.trim());
    const headers = rawHeaders.map(normKey);

    // Expecting your tab columns like:
    // As Of Date, Metal, Tenor Months, Price, ...
    const idxDate = headers.indexOf("asofdate");
    const idxMetal = headers.indexOf("metal");
    const idxTenor = headers.indexOf("tenormonths");
    const idxPrice = headers.indexOf("price");

    if (idxDate === -1 || idxMetal === -1 || idxTenor === -1 || idxPrice === -1) {
      return NextResponse.json(
        {
          error: "CSV headers not recognized",
          need: ["As Of Date", "Metal", "Tenor Months", "Price"],
          got: rawHeaders,
        },
        { status: 500 }
      );
    }

    const parsed = lines.slice(1).map((line) => line.split(","));

    // collect all dates
    const dates = Array.from(
      new Set(
        parsed
          .map((c) => String(c[idxDate] ?? "").trim())
          .filter((d) => d.length)
      )
    ).sort(); // YYYY-MM-DD sorts correctly

    const asOfDate = dates[dates.length - 1] ?? "";
    const priorDate = dates[dates.length - 2] ?? "";

    // map: date|metal|tenor -> price
    const m = new Map();
    for (const c of parsed) {
      const d = String(c[idxDate] ?? "").trim();
      const metal = String(c[idxMetal] ?? "").trim().toLowerCase();
      const tenor = toNum(c[idxTenor]);
      const price = toNum(c[idxPrice]);

      if (!d || tenor == null || price == null) continue;
      if (metal !== "gold" && metal !== "silver") continue;

      m.set(`${d}|${metal}|${tenor}`, price);
    }

    // tenors present in latest date (use those as the table)
    const tenors = Array.from(
      new Set(
        parsed
          .filter((c) => String(c[idxDate] ?? "").trim() === asOfDate)
          .map((c) => toNum(c[idxTenor]))
          .filter((t) => t != null)
      )
    ).sort((a, b) => a - b);

    const curves = tenors.map((t) => ({
      tenorMonths: t,
      goldToday: m.get(`${asOfDate}|gold|${t}`) ?? null,
      goldPrior: priorDate ? m.get(`${priorDate}|gold|${t}`) ?? null : null,
      silverToday: m.get(`${asOfDate}|silver|${t}`) ?? null,
      silverPrior: priorDate ? m.get(`${priorDate}|silver|${t}`) ?? null : null,
    }));

    return NextResponse.json({ asOfDate, priorDate, curves });
  } catch (e) {
    return NextResponse.json(
      { error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
