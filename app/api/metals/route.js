import { NextResponse } from "next/server";

export async function GET() {
  const sample = {
    asOfDate: "2025-12-27",
    priorDate: "2025-12-26",
    realYield10y: 1.9,
    dollarIndex: 104.2,
    deficitFlag: false,
    curves: [
      { tenorMonths: 1, goldToday: 4546.2, goldPrior: 4539.6, silverToday: 78.84, silverPrior: 73.75 },
      { tenorMonths: 3, goldToday: 4560.1, goldPrior: 4541.2, silverToday: 79.1, silverPrior: 74.2 },
      { tenorMonths: 6, goldToday: 4602.0, goldPrior: 4588.4, silverToday: 80.05, silverPrior: 76.0 },
      { tenorMonths: 12, goldToday: 4718.0, goldPrior: 4702.1, silverToday: 82.9, silverPrior: 78.6 },
    ],
  };

  return NextResponse.json(sample);
}
