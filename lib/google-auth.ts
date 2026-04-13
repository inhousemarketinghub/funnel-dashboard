import { google } from "googleapis";

let cachedClient: ReturnType<typeof google.sheets> | null = null;

export function getSheetsClient() {
  if (cachedClient) return cachedClient;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim().replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  cachedClient = google.sheets({ version: "v4", auth });
  return cachedClient;
}
