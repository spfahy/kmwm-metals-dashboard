async function getData() {
  const url = `${process.env.NEXT_PUBLIC_DASHBOARD_URL}/api/goldcurve`;

  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  return data;
}

export default async function GoldCurvePage() {
  const data = await getData();

  return (
    <div style={{ padding: "40px" }}>
      <h1>Gold Curve</h1>

      <h3>Raw API Output (for debugging)</h3>
      <pre style={{ background: "#eee", padding: "20px" }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
