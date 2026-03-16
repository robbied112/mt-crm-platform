/**
 * Tests for normalize.js — row normalization with column mapping.
 */
import { describe, it, expect } from "vitest";
import {
  normalizeRows,
  num,
  str,
  normalizeState,
  normalizeDate,
} from "../../../packages/pipeline/src/normalize.js";

describe("helper functions", () => {
  describe("num", () => {
    it("parses plain numbers", () => {
      expect(num("42")).toBe(42);
      expect(num(42)).toBe(42);
    });

    it("strips dollar signs and commas", () => {
      expect(num("$1,234.56")).toBe(1234.56);
    });

    it("returns 0 for null, empty, and non-numeric", () => {
      expect(num(null)).toBe(0);
      expect(num("")).toBe(0);
      expect(num("abc")).toBe(0);
      expect(num(undefined)).toBe(0);
    });
  });

  describe("str", () => {
    it("trims whitespace", () => {
      expect(str("  hello  ")).toBe("hello");
    });

    it("returns empty string for null/undefined", () => {
      expect(str(null)).toBe("");
      expect(str(undefined)).toBe("");
    });
  });

  describe("normalizeState", () => {
    it("returns 2-letter uppercase for state abbreviations", () => {
      expect(normalizeState("ny")).toBe("NY");
      expect(normalizeState("CA")).toBe("CA");
    });

    it("truncates long strings to 2 chars", () => {
      expect(normalizeState("California")).toBe("CA");
    });

    it("handles empty values", () => {
      expect(normalizeState("")).toBe("");
      expect(normalizeState(null)).toBe("");
    });
  });

  describe("normalizeDate", () => {
    it("normalizes valid dates to ISO format", () => {
      expect(normalizeDate("2024-01-15")).toBe("2024-01-15");
      expect(normalizeDate("1/15/2024")).toBe("2024-01-15");
    });

    it("returns empty string for falsy values", () => {
      expect(normalizeDate("")).toBe("");
      expect(normalizeDate(null)).toBe("");
      expect(normalizeDate(undefined)).toBe("");
    });

    it("passes through non-parseable strings", () => {
      expect(normalizeDate("Q1 2024")).toBe("Q1 2024");
    });
  });
});

describe("normalizeRows", () => {
  const mapping = {
    acct: "Account Name",
    dist: "Distributor",
    st: "State",
    ch: "Channel",
    sku: "Product",
    qty: "Cases",
    date: "Date",
    revenue: "Amount",
  };

  const rows = [
    {
      "Account Name": "The Wine Bar",
      "Distributor": "Southern Glazer's",
      "State": "NY",
      "Channel": "On-Premise",
      "Product": "Pinot Noir 750ml",
      "Cases": "25",
      "Date": "2024-03-15",
      "Amount": "$1,250.00",
    },
    {
      "Account Name": "  Metro Liquors  ",
      "Distributor": "Republic National",
      "State": "ca",
      "Channel": "Off-Premise",
      "Product": "Chardonnay 750ml",
      "Cases": "50",
      "Date": "2024-04-01",
      "Amount": "2500",
    },
  ];

  it("maps column names to internal field names", () => {
    const result = normalizeRows(rows, mapping);
    expect(result[0].acct).toBe("The Wine Bar");
    expect(result[0].dist).toBe("Southern Glazer's");
    expect(result[0].sku).toBe("Pinot Noir 750ml");
  });

  it("normalizes state to uppercase 2-letter", () => {
    const result = normalizeRows(rows, mapping);
    expect(result[0].st).toBe("NY");
    expect(result[1].st).toBe("CA");
  });

  it("parses numeric fields (qty, revenue)", () => {
    const result = normalizeRows(rows, mapping);
    expect(result[0].qty).toBe(25);
    expect(result[0].revenue).toBe(1250);
    expect(result[1].qty).toBe(50);
    expect(result[1].revenue).toBe(2500);
  });

  it("normalizes dates to ISO format", () => {
    const result = normalizeRows(rows, mapping);
    expect(result[0].date).toBe("2024-03-15");
    expect(result[1].date).toBe("2024-04-01");
  });

  it("trims whitespace from string fields", () => {
    const result = normalizeRows(rows, mapping);
    expect(result[1].acct).toBe("Metro Liquors");
  });

  it("defaults unmapped fields to empty/zero", () => {
    const result = normalizeRows(rows, mapping);
    expect(result[0].stage).toBe("");
    expect(result[0].owner).toBe("");
    expect(result[0].estValue).toBe(0);
    expect(result[0].oh).toBe(0);
    expect(result[0].doh).toBe(0);
  });

  it("includes month columns when present in mapping", () => {
    const mappingWithMonths = {
      ...mapping,
      _monthColumns: ["Nov", "Dec", "Jan"],
    };
    const rowsWithMonths = [
      { ...rows[0], Nov: "10", Dec: "15", Jan: "20" },
    ];
    const result = normalizeRows(rowsWithMonths, mappingWithMonths);
    expect(result[0]._months).toEqual([10, 15, 20]);
  });

  it("includes week columns when present in mapping", () => {
    const mappingWithWeeks = {
      ...mapping,
      _weekColumns: ["W1", "W2", "W3"],
    };
    const rowsWithWeeks = [
      { ...rows[0], W1: "5", W2: "8", W3: "3" },
    ];
    const result = normalizeRows(rowsWithWeeks, mappingWithWeeks);
    expect(result[0]._weeks).toEqual([5, 8, 3]);
  });

  it("omits _months and _weeks when not in mapping", () => {
    const result = normalizeRows(rows, mapping);
    expect(result[0]._months).toBeUndefined();
    expect(result[0]._weeks).toBeUndefined();
  });

  it("handles empty input", () => {
    expect(normalizeRows([], mapping)).toEqual([]);
  });
});
