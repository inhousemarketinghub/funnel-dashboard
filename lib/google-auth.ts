import { google } from "googleapis";

let cachedAuth: InstanceType<typeof google.auth.GoogleAuth> | null = null;
let cachedClient: ReturnType<typeof google.sheets> | null = null;

function getAuth() {
  if (cachedAuth) return cachedAuth;
  cachedAuth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim().replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return cachedAuth;
}

export function getSheetsClient() {
  if (cachedClient) return cachedClient;
  cachedClient = google.sheets({ version: "v4", auth: getAuth() });
  return cachedClient;
}

/**
 * Access token for raw REST reads in lib/sheets.ts. Those reads stay on plain
 * fetch() (not the googleapis client) so they keep Next's fetch cache —
 * revalidate + sheet:${id} tags and the refresh button's updateTag depend on
 * it. GoogleAuth caches the token internally until near expiry, so this is
 * cheap to call per request. Note the token lands in the fetch cache key
 * (headers are part of it), so rotation (~hourly) costs one cache miss.
 */
export async function getSheetsAccessToken(): Promise<string> {
  const token = await getAuth().getAccessToken();
  if (!token) throw new Error("Failed to obtain Google access token");
  return token;
}
