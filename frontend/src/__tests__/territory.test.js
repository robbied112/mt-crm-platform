/**
 * Tests for utils/territory.js — territory matching and region map building.
 */

import { describe, it, expect } from "vitest";
import { matchesUserTerritory, buildRegionMap } from "../utils/territory";

describe("matchesUserTerritory", () => {
  const territories = {
    Southeast: ["GA", "FL", "SC", "NC"],
    Northeast: ["NY", "NJ", "CT", "MA"],
  };

  it("returns true for null user (no auth)", () => {
    expect(matchesUserTerritory("GA", null)).toBe(true);
  });

  it("returns true for admin role regardless of territory", () => {
    const admin = { role: "admin", territory: "Northeast" };
    expect(matchesUserTerritory("GA", admin, territories)).toBe(true);
  });

  it("returns true for manager role regardless of territory", () => {
    const manager = { role: "manager", territory: "Southeast" };
    expect(matchesUserTerritory("NY", manager, territories)).toBe(true);
  });

  it("returns true when territory is 'all'", () => {
    const rep = { role: "rep", territory: "all" };
    expect(matchesUserTerritory("GA", rep, territories)).toBe(true);
  });

  it("returns true when territory is null/undefined", () => {
    const rep = { role: "rep" };
    expect(matchesUserTerritory("GA", rep, territories)).toBe(true);
  });

  it("matches state in named territory via dynamic config", () => {
    const rep = { role: "rep", territory: "Southeast" };
    expect(matchesUserTerritory("GA", rep, territories)).toBe(true);
    expect(matchesUserTerritory("FL", rep, territories)).toBe(true);
  });

  it("rejects state not in named territory", () => {
    const rep = { role: "rep", territory: "Southeast" };
    expect(matchesUserTerritory("NY", rep, territories)).toBe(false);
  });

  it("works with array territory", () => {
    const rep = { role: "rep", territory: ["GA", "FL"] };
    expect(matchesUserTerritory("GA", rep, territories)).toBe(true);
    expect(matchesUserTerritory("NY", rep, territories)).toBe(false);
  });

  it("falls back to exact state match", () => {
    const rep = { role: "rep", territory: "CA" };
    expect(matchesUserTerritory("CA", rep)).toBe(true);
    expect(matchesUserTerritory("NY", rep)).toBe(false);
  });

  it("viewer is filtered by territory (not exempt)", () => {
    const viewer = { role: "viewer", territory: "Southeast" };
    expect(matchesUserTerritory("GA", viewer, territories)).toBe(true);
    expect(matchesUserTerritory("NY", viewer, territories)).toBe(false);
  });
});

describe("buildRegionMap", () => {
  it("inverts territory config to state → territory map", () => {
    const territories = {
      Southeast: ["GA", "FL"],
      Northeast: ["NY", "NJ"],
    };
    const map = buildRegionMap(territories);
    expect(map).toEqual({
      GA: "Southeast",
      FL: "Southeast",
      NY: "Northeast",
      NJ: "Northeast",
    });
  });

  it("returns empty object for null/undefined input", () => {
    expect(buildRegionMap(null)).toEqual({});
    expect(buildRegionMap(undefined)).toEqual({});
  });

  it("handles empty territories object", () => {
    expect(buildRegionMap({})).toEqual({});
  });
});
