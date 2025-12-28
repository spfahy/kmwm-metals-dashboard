export const metadata = {
  title: "KMWM Metals Dashboard",
  description: "Gold & Silver curve dashboard",
};

export default function RootLayout({ children }) {
  return (
   <body
  style={{
    margin: 0,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    background: "#f3f4f6",
  }}
>
  {children}
</body>

  );
}
