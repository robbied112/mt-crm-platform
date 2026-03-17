import { describe, expect, it } from "vitest";
import {
  isLegacyLogoUrl,
  sanitizeTenantBranding,
  sanitizeTenantLogoUrl,
} from "../utils/branding";

describe("branding helpers", () => {
  it("flags known legacy sidekick logo URLs", () => {
    expect(isLegacyLogoUrl("/logo.png")).toBe(true);
    expect(isLegacyLogoUrl("./logo.png?v=2")).toBe(true);
    expect(isLegacyLogoUrl("https://cdn.example.com/sidekick-bi.svg")).toBe(true);
  });

  it("preserves non-legacy tenant logos", () => {
    expect(sanitizeTenantLogoUrl(" https://cdn.example.com/crufolio-mark.svg ")).toBe(
      "https://cdn.example.com/crufolio-mark.svg"
    );
  });

  it("removes legacy logo values from tenant branding config", () => {
    expect(
      sanitizeTenantBranding({
        companyName: "CruFolio",
        logo: "/logo.png",
      })
    ).toEqual({
      companyName: "CruFolio",
      logo: "",
    });
  });
});
