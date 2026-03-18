/**
 * Tests for uploadErrors — structured error model for import flows.
 */
import { describe, it, expect } from "vitest";
import {
  ERROR_TYPES,
  IMPORT_STEPS,
  createUploadError,
  formatUploadError,
  getRecoveryHint,
} from "../utils/uploadErrors";

describe("uploadErrors", () => {
  describe("ERROR_TYPES", () => {
    it("has all expected error type categories", () => {
      // File validation
      expect(ERROR_TYPES.FILE_EMPTY).toBe("file_empty");
      expect(ERROR_TYPES.FILE_TOO_LARGE).toBe("file_too_large");
      expect(ERROR_TYPES.FILE_UNSUPPORTED).toBe("file_unsupported");

      // Parsing
      expect(ERROR_TYPES.PARSE_FAILED).toBe("parse_failed");
      expect(ERROR_TYPES.NO_DATA).toBe("no_data");
      expect(ERROR_TYPES.NO_HEADERS).toBe("no_headers");

      // AI
      expect(ERROR_TYPES.AI_COMPREHEND_FAILED).toBe("ai_comprehend_failed");
      expect(ERROR_TYPES.AI_MAPPING_FAILED).toBe("ai_mapping_failed");

      // Network
      expect(ERROR_TYPES.NETWORK_ERROR).toBe("network_error");
      expect(ERROR_TYPES.TIMEOUT).toBe("timeout");
    });

    it("all values are unique strings", () => {
      const values = Object.values(ERROR_TYPES);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
      for (const v of values) {
        expect(typeof v).toBe("string");
      }
    });
  });

  describe("IMPORT_STEPS", () => {
    it("has all expected steps", () => {
      expect(IMPORT_STEPS.VALIDATE).toBe("validate");
      expect(IMPORT_STEPS.PARSE).toBe("parse");
      expect(IMPORT_STEPS.COMPREHEND).toBe("comprehend");
      expect(IMPORT_STEPS.MAP).toBe("map");
      expect(IMPORT_STEPS.TRANSFORM).toBe("transform");
      expect(IMPORT_STEPS.PREVIEW).toBe("preview");
      expect(IMPORT_STEPS.SAVE).toBe("save");
      expect(IMPORT_STEPS.MATCH).toBe("match");
    });
  });

  describe("createUploadError", () => {
    it("creates error with all fields", () => {
      const err = createUploadError(ERROR_TYPES.PARSE_FAILED, "CSV has no headers", {
        fileName: "test.csv",
        step: IMPORT_STEPS.PARSE,
      });
      expect(err.type).toBe("parse_failed");
      expect(err.message).toBe("CSV has no headers");
      expect(err.recoveryHint).toBe("Make sure the file has a header row with column names.");
      expect(err.step).toBe("parse");
      expect(err.context.fileName).toBe("test.csv");
      expect(err.timestamp).toBeGreaterThan(0);
    });

    it("falls back to IMPORT_FAILED for unknown type", () => {
      const err = createUploadError(null, "Something broke");
      expect(err.type).toBe(ERROR_TYPES.IMPORT_FAILED);
    });

    it("falls back to default message when none provided", () => {
      const err = createUploadError(ERROR_TYPES.FILE_EMPTY);
      expect(err.message).toBe("Something went wrong.");
    });

    it("falls back to generic recovery hint for unknown type", () => {
      const err = createUploadError("custom_unknown", "Custom error");
      expect(err.recoveryHint).toBe("Try again or contact support.");
    });

    it("has recovery hints for all standard error types", () => {
      for (const type of Object.values(ERROR_TYPES)) {
        const err = createUploadError(type, "test");
        expect(err.recoveryHint).toBeTruthy();
        expect(err.recoveryHint).not.toBe("Try again or contact support.");
      }
    });

    it("step defaults to null when not in context", () => {
      const err = createUploadError(ERROR_TYPES.FILE_EMPTY, "empty");
      expect(err.step).toBeNull();
    });
  });

  describe("formatUploadError", () => {
    it("returns string errors as-is", () => {
      expect(formatUploadError("raw error")).toBe("raw error");
    });

    it("returns message from structured error", () => {
      const err = createUploadError(ERROR_TYPES.FILE_EMPTY, "File is empty");
      expect(formatUploadError(err)).toBe("File is empty");
    });

    it("handles null/undefined", () => {
      expect(formatUploadError(null)).toBe("An unknown error occurred.");
      expect(formatUploadError(undefined)).toBe("An unknown error occurred.");
    });

    it("falls back for objects without message", () => {
      expect(formatUploadError({})).toBe("Something went wrong.");
    });
  });

  describe("getRecoveryHint", () => {
    it("returns hint from structured error", () => {
      const err = createUploadError(ERROR_TYPES.FILE_TOO_LARGE, "too big");
      expect(getRecoveryHint(err)).toBe("Try splitting the file or removing unnecessary columns.");
    });

    it("returns null for string errors", () => {
      expect(getRecoveryHint("some error")).toBeNull();
    });

    it("returns null for null/undefined", () => {
      expect(getRecoveryHint(null)).toBeNull();
      expect(getRecoveryHint(undefined)).toBeNull();
    });

    it("falls back to type-based lookup when recoveryHint is missing", () => {
      const err = { type: ERROR_TYPES.NETWORK_ERROR };
      expect(getRecoveryHint(err)).toBe("Check your internet connection and try again.");
    });
  });
});
