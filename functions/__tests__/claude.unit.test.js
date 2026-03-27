const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { extractToolResult } = require("../lib/claude");

describe("extractToolResult", () => {
  it("extracts tool_use block input", () => {
    const response = {
      content: [
        { type: "text", text: "Here is my analysis:" },
        { type: "tool_use", id: "t1", name: "test_tool", input: { foo: "bar" } },
      ],
    };
    const result = extractToolResult(response);
    assert.deepEqual(result, { foo: "bar" });
  });

  it("returns error when no tool_use block", () => {
    const response = {
      content: [{ type: "text", text: "No tool use here" }],
    };
    const result = extractToolResult(response);
    assert.equal(result.error, true);
    assert.equal(result.errorType, "no_tool_use");
  });

  it("passes through error responses", () => {
    const response = { error: true, errorType: "api_failure" };
    const result = extractToolResult(response);
    assert.equal(result.error, true);
    assert.equal(result.errorType, "api_failure");
  });

  it("handles response with empty content array", () => {
    const response = { content: [] };
    const result = extractToolResult(response);
    assert.equal(result.error, true);
    assert.equal(result.errorType, "no_tool_use");
  });

  it("handles response with undefined content", () => {
    const response = {};
    const result = extractToolResult(response);
    assert.equal(result.error, true);
  });
});
