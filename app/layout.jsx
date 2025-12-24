export const metadata = {
  title: "Metals Dashboard",
  description: "Gold & Silver Futures Term Structure"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "Arial, sans-serif", margin: 0, padding: 20 }}>
        {children}
      </body>
    </html>
  );
}
