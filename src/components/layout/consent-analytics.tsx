"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const CONSENT_KEY = "cookie-consent";

export function ConsentAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    const check = () => setConsented(localStorage.getItem(CONSENT_KEY) === "accepted");
    check();
    window.addEventListener("cookie-consent-updated", check);
    return () => window.removeEventListener("cookie-consent-updated", check);
  }, []);

  if (!consented) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
