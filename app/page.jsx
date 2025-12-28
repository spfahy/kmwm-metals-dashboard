export default function Home() {
  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
        background: "#f6f7f9",
        minHeight: "100vh",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 34, fontWeight: 900, margin: 0 }}>
          KMWM Metals Dashboard
        </div>
        <div style={{ opacity: 0.75, marginTop: 6 }}>
          Gold & Silver term structure + curve view
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {/* Gold Curve */}
        <a
          href="/goldcurve"
          style={{
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              background: "white",
              border: "1px solid #e5e5e5",
              borderRadius: 14,
              padding: 18,
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900 }}>Gold Curve</div>
              <div
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 999,
                  background: "#fff4cc",
                  border: "1px solid #ffe08a",
                }}
              >
                Curve View
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.4 }}>
              Interactive chart with Today vs Prior lines and deltas.
            </div>

            <div style={{ marginTop: 14, fontWeight: 800, color: "#b45309" }}>
              Open →
            </div>
          </div>
        </a>

        {/* Metals Term Structure */}
        <a
          href="/metals"
          style={{
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div
            style={{
              background: "white",
              border: "1px solid #e5e5e5",
              borderRadius: 14,
              padding: 18,
              boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 900 }}>
                Gold & Silver Term Structure
              </div>
              <div
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 999,
                  background: "#e9f5ff",
                  border: "1px solid #bfe3ff",
                }}
              >
                Table + JSON
              </div>
            </div>

            <div style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.4 }}>
              Spot + 1D Change boxes + curve table (Today vs Prior).
            </div>

            <div style={{ marginTop: 14, fontWeight: 800, color: "#0369a1" }}>
              Open →
            </div>
          </div>
        </a>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 18, opacity: 0.6, fontSize: 12 }}>
        Tip: bookmark <strong>/goldcurve</strong> and <strong>/metals</strong>.
      </div>
    </main>
  );
}
