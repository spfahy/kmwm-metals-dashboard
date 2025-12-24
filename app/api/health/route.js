export const runtime = "nodejs";

export async function GET() {
  const u = process.env.METALS_CSV_URL || "";
  return Response.json({
    ok: true,
    service: "kmwm-metals-dashboard",
    hasMetalsCsvUrl: !!u,
    metalsCsvUrl: u ? u.slice(0, 140) : "",
    hasDatabaseUrl: !!process.env.DATABASE_URL,
  });
}
