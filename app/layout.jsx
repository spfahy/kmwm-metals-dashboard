export const metadata = {
  title: "KMWM Metals Dashboard",
  description: "Gold and silver curves viewer",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 20,
          fontFamily: "Arial, sans-serif",
          backgroundColor: "#f5f5f5",
        }}
      >
        {children}
      </body>
    </html>
  );
}
