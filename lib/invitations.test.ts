import { describe, it, expect } from "vitest";
import { generateToken, isTokenExpired } from "./invitations";

describe("generateToken", () => {
  it("returns a 48-char hex string", () => {
    const token = generateToken();
    expect(token).toMatch(/^[a-f0-9]{48}$/);
  });

  it("generates unique tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
  });
});

describe("isTokenExpired", () => {
  it("returns false for future date", () => {
    const future = new Date(Date.now() + 86400000).toISOString();
    expect(isTokenExpired(future)).toBe(false);
  });

  it("returns true for past date", () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    expect(isTokenExpired(past)).toBe(true);
  });
});
