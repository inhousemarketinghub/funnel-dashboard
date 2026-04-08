import { randomBytes } from "crypto";

export function generateToken(): string {
  return randomBytes(24).toString("hex");
}

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

export function getExpiryDate(days: number = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
