export default function Home() {
  return (
    <main style={{ padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>KMWM Metals Dashboard</h1>
        <div style={{ display: "flex", gap: 10, fontSize: 13 }}>
          <a href="/goldcurve" style={{ textDecoration: "none" }}>Gold Curve</a>
          <a href="/metals" style={{ textDecoration: "none" }}>Metals</a>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* LEFT: Gold Curve */}
        <div style={{ border: "2px solid #111", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", background: "#111", color: "white", fontWeight: 800 }}>
            Gold & Silver Curve
          </div>
          <div style={{ height: "82vh", background: "white" }}>
            <iframe
              title="Gold Curve"
              src="/goldcurve"
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          </div>
        </div>

        {/* RIGHT: Metals Page */}
        <div style={{ border: "2px solid #111", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "10px 12px", background: "#0b3d91", color: "white", fontWeight: 800 }}>
            Metals Dashboard
          </div>
          <div style={{ height: "82vh", background: "white" }}>
            <iframe
              title="Metals"
              src="/metals"
              style={{ width: "100%", height: "100%", border: 0 }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
