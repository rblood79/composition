import { describe, expect, it } from "vitest";
import { variableDefaultForType } from "../variableTypeChange";

/** ADR-288 결정 1 — 타입 변경 시 시작값: 맞으면 두고 (변환) 아니면 비움. 세 소유자 같은 규칙. */
describe("variableDefaultForType", () => {
  it("keeps a value that fits the new type, converted", () => {
    expect(variableDefaultForType("number", "42", "project")).toBe(42);
    expect(variableDefaultForType("number", " 4.5 ", "state")).toBe(4.5);
    expect(variableDefaultForType("string", 3, "state")).toBe("3");
    expect(variableDefaultForType("string", true, "project")).toBe("true");
    expect(variableDefaultForType("boolean", "true", "state")).toBe(true);
    expect(variableDefaultForType("boolean", "False", "project")).toBe(false);
    expect(variableDefaultForType("object", { a: 1 }, "project")).toEqual({
      a: 1,
    });
    expect(variableDefaultForType("array", [1], "project")).toEqual([1]);
  });

  it("empties a value that does not fit — the owner's empty", () => {
    expect(variableDefaultForType("number", "hi", "state")).toBe(0);
    expect(variableDefaultForType("number", "hi", "project")).toBe(undefined);
    expect(variableDefaultForType("number", true, "state")).toBe(0);
    expect(variableDefaultForType("boolean", "yes", "state")).toBe(false);
    expect(variableDefaultForType("boolean", 1, "project")).toBe(undefined);
    expect(variableDefaultForType("string", { a: 1 }, "state")).toBe("");
    expect(variableDefaultForType("object", [1], "project")).toBe(undefined);
    expect(variableDefaultForType("array", { a: 1 }, "project")).toBe(
      undefined,
    );
  });

  it("a page · element structured default is always the contract's empty string", () => {
    expect(variableDefaultForType("object", { a: 1 }, "state")).toBe("");
    expect(variableDefaultForType("array", [1, 2], "state")).toBe("");
    expect(variableDefaultForType("array", "", "state")).toBe("");
  });

  it("no value stays empty", () => {
    expect(variableDefaultForType("number", undefined, "state")).toBe(0);
    expect(variableDefaultForType("string", null, "project")).toBe(undefined);
  });
});
