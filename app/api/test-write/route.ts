import { NextResponse } from "next/server";

// Temporary diagnostic endpoint — DELETE after debugging
export async function GET() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "(missing)";
  const rawKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "(missing)";

  // Diagnose private key format
  const keyLen = rawKey.length;
  const hasLiteralBackslashN = rawKey.includes("\\n");
  const hasRealNewline = rawKey.includes("\n") && !rawKey.includes("\\n");
  const startsWithQuote = rawKey.startsWith('"');
  const startsWithBegin = rawKey.startsWith("-----BEGIN");
  const first30 = rawKey.substring(0, 30);
  const last20 = rawKey.substring(rawKey.length - 20);

  // Try to create auth with the key
  let authResult = "not tested";
  try {
    const { google } = await import("googleapis");
    const processedKey = rawKey.replace(/\\n/g, "\n");
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: processedKey },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const client = await auth.getClient();
    authResult = "OK - authenticated successfully";
  } catch (err) {
    authResult = `FAILED: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({
    email,
    keyDiagnostics: {
      length: keyLen,
      hasLiteralBackslashN,
      hasRealNewline,
      startsWithQuote,
      startsWithBegin,
      first30,
      last20,
    },
    authResult,
  });
}
