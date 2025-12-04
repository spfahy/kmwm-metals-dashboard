export default function HomePage() {
  return (
    <div
      style={{
        maxWidth: 800,
        margin: "0 auto",
        background: "white",
        padding: 24,
        borderRadius: 12,
        boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      }}
    >
      <h1 style={{ marginTop: 0 }}>KMWM Metals Dashboard</h1>
      <p style={{ fontSize: 14, color: "#555" }}>
        The dashboard is live. Gold &amp; silver curve view is at{" "}
        <code>/goldcurve</code>.
      </p>
    </div>
  );
}
