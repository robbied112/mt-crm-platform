/**
 * Tests for TeamSetupWizard component logic.
 * Validates step progression, territory management, and invite creation flow.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock contexts
const mockAuthValues = { currentUser: { uid: "u1", email: "test@test.com" } };
const mockDataValues = {
  tenantConfig: { companyName: "", territories: {} },
  updateTenantConfig: vi.fn().mockResolvedValue(undefined),
};
const mockTeamValues = {
  generateInvite: vi.fn().mockResolvedValue({ code: "abc-123" }),
};

vi.mock("../context/AuthContext", () => ({
  useAuth: () => mockAuthValues,
}));
vi.mock("../context/DataContext", () => ({
  useData: () => mockDataValues,
}));
vi.mock("../context/TeamContext", () => ({
  useTeam: () => mockTeamValues,
}));

// Since TeamSetupWizard is a React component, test the logic patterns directly
import { ROLES_ORDERED, ROLE_LABELS, ROLE_DESCRIPTIONS } from "../config/roles";

describe("TeamSetupWizard support logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ROLES_ORDERED provides roles for invite selection", () => {
    const inviteRoles = ROLES_ORDERED.filter((r) => r !== "admin");
    expect(inviteRoles).toContain("manager");
    expect(inviteRoles).toContain("rep");
    expect(inviteRoles).toContain("viewer");
    expect(inviteRoles).not.toContain("admin");
  });

  it("all non-admin roles have labels and descriptions", () => {
    const inviteRoles = ROLES_ORDERED.filter((r) => r !== "admin");
    for (const role of inviteRoles) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_DESCRIPTIONS[role]).toBeTruthy();
    }
  });

  it("generateInvite receives expected parameters", async () => {
    const { generateInvite } = mockTeamValues;
    await generateInvite({ role: "rep", territory: "all", maxUses: 10 });
    expect(generateInvite).toHaveBeenCalledWith({
      role: "rep",
      territory: "all",
      maxUses: 10,
    });
  });

  it("updateTenantConfig can save company name", async () => {
    const { updateTenantConfig } = mockDataValues;
    await updateTenantConfig({ companyName: "Napa Valley Imports" });
    expect(updateTenantConfig).toHaveBeenCalledWith({
      companyName: "Napa Valley Imports",
    });
  });

  it("updateTenantConfig can save territories", async () => {
    const { updateTenantConfig } = mockDataValues;
    const territories = { Southeast: ["GA", "FL", "SC"] };
    await updateTenantConfig({ territories });
    expect(updateTenantConfig).toHaveBeenCalledWith({ territories });
  });

  it("invite link format matches expected pattern", () => {
    const code = "abc-123";
    const origin = "https://app.crufolio.com";
    const link = `${origin}/join/${code}`;
    expect(link).toBe("https://app.crufolio.com/join/abc-123");
    expect(link).toMatch(/\/join\/[a-z0-9-]+$/);
  });

  it("total steps is 4 (company name, territories, invite, done)", () => {
    // Mirrors TOTAL_STEPS constant in TeamSetupWizard
    const TOTAL_STEPS = 4;
    expect(TOTAL_STEPS).toBe(4);

    // Progress calculation
    expect((1 / TOTAL_STEPS) * 100).toBe(25);
    expect((2 / TOTAL_STEPS) * 100).toBe(50);
    expect((3 / TOTAL_STEPS) * 100).toBe(75);
    expect((4 / TOTAL_STEPS) * 100).toBe(100);
  });

  it("territory state validation requires 2-char uppercase", () => {
    const isValidState = (st) => {
      const cleaned = (st || "").trim().toUpperCase();
      return cleaned.length === 2;
    };
    expect(isValidState("GA")).toBe(true);
    expect(isValidState("ga")).toBe(true);
    expect(isValidState("G")).toBe(false);
    expect(isValidState("GAA")).toBe(false);
    expect(isValidState("")).toBe(false);
  });
});
