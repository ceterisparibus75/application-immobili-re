import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export async function GET() {
  const keyPresent = !!env.GOOGLE_AI_API_KEY;
  const keyLength = env.GOOGLE_AI_API_KEY?.length ?? 0;
  const keyPrefix = env.GOOGLE_AI_API_KEY?.substring(0, 8) ?? "N/A";

  // Test direct API call without SDK
  let apiTestResult = "not tested";
  if (env.GOOGLE_AI_API_KEY) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001?key=${env.GOOGLE_AI_API_KEY}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const data = await res.json();
      apiTestResult = res.ok ? `OK: ${data.displayName}` : `ERROR ${res.status}: ${JSON.stringify(data)}`;
    } catch (err) {
      apiTestResult = `FETCH_ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Test SDK
  let sdkTestResult = "not tested";
  if (env.GOOGLE_AI_API_KEY) {
    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });
      const response = await model.generateContent("Réponds uniquement: OK");
      sdkTestResult = `OK: ${response.response.text().substring(0, 50)}`;
    } catch (err) {
      sdkTestResult = `SDK_ERROR: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  return NextResponse.json({
    keyPresent,
    keyLength,
    keyPrefix,
    processEnvPresent: !!process.env.GOOGLE_AI_API_KEY,
    apiTestResult,
    sdkTestResult,
  });
}
