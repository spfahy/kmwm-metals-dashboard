async function getData() {
  // Call the API route inside the same app
  const res = await fetch("/api/goldcurve", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load goldcurve data (${res.status})`);
  }
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
