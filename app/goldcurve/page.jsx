"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GoldCurveRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/metals");
  }, [router]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, Arial" }}>
      Redirecting to Metals…
    </main>
  );
}
