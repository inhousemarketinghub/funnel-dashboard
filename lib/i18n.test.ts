import { describe, it, expect } from "vitest";
import { t, normalizeLang } from "./i18n";

describe("i18n t()", () => {
  it("returns the Chinese string for zh", () => {
    expect(t("zh", "totalSales")).toBe("总销售额");
  });

  it("returns the English string for en", () => {
    expect(t("en", "totalSales")).toBe("Total Sales");
  });

  it("keeps shared acronyms identical across languages", () => {
    expect(t("zh", "cpl")).toBe("CPL");
    expect(t("en", "cpl")).toBe("CPL");
  });

  it("falls back to the key when missing", () => {
    expect(t("zh", "nonexistent_key")).toBe("nonexistent_key");
  });
});

describe("normalizeLang()", () => {
  it("maps zh to zh", () => expect(normalizeLang("zh")).toBe("zh"));
  it("defaults everything else to en", () => {
    expect(normalizeLang("en")).toBe("en");
    expect(normalizeLang(undefined)).toBe("en");
    expect(normalizeLang("ms")).toBe("en");
    expect(normalizeLang(null)).toBe("en");
  });
});
