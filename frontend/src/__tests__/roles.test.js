/**
 * Tests for config/roles.js — role definitions and capability matrix.
 */

import { describe, it, expect } from "vitest";
import {
  ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, ROLE_COLORS,
  ROLE_CAPABILITIES, ROLES_ORDERED,
} from "../config/roles";

describe("Role definitions", () => {
  it("defines exactly 4 roles", () => {
    expect(Object.keys(ROLES)).toHaveLength(4);
    expect(ROLES.ADMIN).toBe("admin");
    expect(ROLES.MANAGER).toBe("manager");
    expect(ROLES.REP).toBe("rep");
    expect(ROLES.VIEWER).toBe("viewer");
  });

  it("has labels for every role", () => {
    for (const role of Object.values(ROLES)) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(typeof ROLE_LABELS[role]).toBe("string");
    }
  });

  it("has descriptions for every role", () => {
    for (const role of Object.values(ROLES)) {
      expect(ROLE_DESCRIPTIONS[role]).toBeTruthy();
    }
  });

  it("has colors for every role", () => {
    for (const role of Object.values(ROLES)) {
      expect(ROLE_COLORS[role]).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("ROLES_ORDERED is highest to lowest authority", () => {
    expect(ROLES_ORDERED).toEqual(["admin", "manager", "rep", "viewer"]);
  });
});

describe("Role capabilities", () => {
  it("has capabilities for every role", () => {
    for (const role of Object.values(ROLES)) {
      expect(ROLE_CAPABILITIES[role]).toBeDefined();
    }
  });

  it("admin has all capabilities", () => {
    const caps = ROLE_CAPABILITIES[ROLES.ADMIN];
    expect(caps.canWrite).toBe(true);
    expect(caps.canManageTeam).toBe(true);
    expect(caps.canAccessSettings).toBe(true);
    expect(caps.canViewAllTerritories).toBe(true);
    expect(caps.canAssignAccounts).toBe(true);
    expect(caps.canImportData).toBe(true);
    expect(caps.canDeleteData).toBe(true);
    expect(caps.canManageBilling).toBe(true);
  });

  it("manager can write and view all territories but cannot manage team", () => {
    const caps = ROLE_CAPABILITIES[ROLES.MANAGER];
    expect(caps.canWrite).toBe(true);
    expect(caps.canManageTeam).toBe(false);
    expect(caps.canAccessSettings).toBe(false);
    expect(caps.canViewAllTerritories).toBe(true);
    expect(caps.canAssignAccounts).toBe(true);
    expect(caps.canImportData).toBe(true);
  });

  it("rep can write but is restricted to own territory", () => {
    const caps = ROLE_CAPABILITIES[ROLES.REP];
    expect(caps.canWrite).toBe(true);
    expect(caps.canManageTeam).toBe(false);
    expect(caps.canAccessSettings).toBe(false);
    expect(caps.canViewAllTerritories).toBe(false);
    expect(caps.canAssignAccounts).toBe(false);
    expect(caps.canImportData).toBe(false);
  });

  it("viewer has no write capabilities", () => {
    const caps = ROLE_CAPABILITIES[ROLES.VIEWER];
    expect(caps.canWrite).toBe(false);
    expect(caps.canManageTeam).toBe(false);
    expect(caps.canAccessSettings).toBe(false);
    expect(caps.canViewAllTerritories).toBe(false);
    expect(caps.canAssignAccounts).toBe(false);
    expect(caps.canImportData).toBe(false);
    expect(caps.canDeleteData).toBe(false);
    expect(caps.canManageBilling).toBe(false);
  });

  it("all roles have the same set of capability keys", () => {
    const adminKeys = Object.keys(ROLE_CAPABILITIES[ROLES.ADMIN]).sort();
    for (const role of Object.values(ROLES)) {
      expect(Object.keys(ROLE_CAPABILITIES[role]).sort()).toEqual(adminKeys);
    }
  });

  it("capability values are all booleans", () => {
    for (const role of Object.values(ROLES)) {
      for (const [key, value] of Object.entries(ROLE_CAPABILITIES[role])) {
        expect(typeof value).toBe("boolean");
      }
    }
  });
});
