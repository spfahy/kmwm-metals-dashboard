import { NextResponse } from "next/server";

function stripQuotes(s) {
  return String(s ?? "").trim().replace(/^"+|"+$/g, "").replace(/"/g, "").trim();
}

function toNum(x) {
  const s = stripQuotes(x);
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normKey(k) {
  return stripQuotes(k).toLowerCase().replace(/[\s_]+/g, "");
}

function getCell(obj, wantedKey) {
  // obj is stored with normalized keys
  return obj[wantedKey];
}

export async function GET() {
  try {
    const url = process.env.METALS_CSV_URL;
    if (!url) {
      return NextResponse.json({ error: "Missing env var METALS_CSV_URL" }, { status: 500 });
    }

    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();

    if (!res.ok) {
      return NextResponse.json(
        { error: `CSV fetch failed ${res.status}`, body200: text.slice(0, 200) },
        { status: 500 }
      );
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV empty or missing rows" }, { status: 500 });
    }

    // --- parse headers ---
    const rawHeaders = lines[0].split(",").map((h) => stripQuotes(h));
    const headers = rawHeaders.map(normKey);

    // We expect at least these (normalized)
    const need = ["asofdate", "metal", "tenormonths", "price"];
    const missing = need.filter((k) => !headers.includes(k));
    if (missing.length) {
      return NextResponse.json(
        { error: "CSV headers not recognized", missing, got: rawHeaders },
        { status: 500 }
      );
    }

    // --- parse rows into normalized objects ---
    const parsed = lines.slice(1).map((line) => {
      const cols = line.split(",");
      const obj = {};
      headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
      return obj;
    });

    // collect dates
    const dates = Array.from(
      new Set(parsed.map((r) => stripQuotes(getCell(r, "asofdate"))).filter(Boolean))
    ).sort(); // ISO sorts correctly

    const asOfDate = dates.length ? dates[dates.length - 1] : "";
    const priorDate = dates.length >= 2 ? dates[dates.length - 2] : "";

    // macro fields (optional) from asOfDate row if present
    const asOfRow = parsed.find((r) => stripQuotes(getCell(r, "asofdate")) === asOfDate) || {};
    const realYield = toNum(getCell(asOfRow, "10yrrealyld"));
    const dollarIndex = toNum(getCell(asOfRow, "dollarindex"));
    const deficitFlagRaw = stripQuotes(getCell(asOfRow, "deficitgdpflag"));
    const deficitFlag =
      deficitFlagRaw === "" ? null : ["true", "1", "yes", "y"].includes(deficitFlagRaw.toLowerCase());

    // build curves by tenorMonths from GOLD/SILVER for asOf + prior
    const map = new Map(); // tenorMonths -> row obj

    function ensure(tenorMonths) {
      if (!map.has(tenorMonths)) map.set(tenorMonths, { tenorMonths });
      return map.get(tenorMonths);
    }

    function ingest(date, metal, tenor, price, isPrior) {
      if (tenor == null) return;
      const row = ensure(tenor);
      const m = (metal || "").toLowerCase();
      if (m === "gold") row[isPrior ? "goldPrior" : "goldToday"] = price;
      if (m === "silver") row[isPrior ? "silverPrior" : "silverToday"] = price;
    }

    for (const r of parsed) {
      const d = stripQuotes(getCell(r, "asofdate"));
      const metal = stripQuotes(getCell(r, "metal"));
      const tenor = toNum(getCell(r, "tenormonths"));
      const price = toNum(getCell(r, "price"));

      if (d === asOfDate) ingest(d, metal, tenor, price, false);
      if (priorDate && d === priorDate) ingest(d, metal, tenor, price, true);
    }

    const curves = Array.from(map.values()).sort((a, b) => a.tenorMonths - b.tenorMonths);

    return NextResponse.json({
      asOfDate,
      priorDate,
      realYield,
      dollarIndex,
      deficitFlag,
      curves,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}
