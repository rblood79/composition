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
    // date (2026-10-29): an ISO text of any shape stays, trimmed.
    expect(variableDefaultForType("date", " 2026-10-29 ", "state")).toBe(
      "2026-10-29",
    );
    expect(variableDefaultForType("date", "2026-10-29T10:00", "project")).toBe(
      "2026-10-29T10:00",
    );
    expect(variableDefaultForType("date", "10:00", "state")).toBe("10:00");
    expect(variableDefaultForType("date", "", "state")).toBe("");
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
    expect(variableDefaultForType("date", "hello", "state")).toBe("");
    expect(variableDefaultForType("date", "2026-13-01", "project")).toBe(
      undefined,
    );
    expect(variableDefaultForType("date", 20261029, "state")).toBe("");
  });

  it("a page · element structured default keeps a JSON value of the type, else the contract's empty string (2026-10-29)", () => {
    expect(variableDefaultForType("object", { a: 1 }, "state")).toEqual({
      a: 1,
    });
    expect(variableDefaultForType("array", [1, 2], "state")).toEqual([1, 2]);
    expect(variableDefaultForType("object", [1, 2], "state")).toBe("");
    expect(variableDefaultForType("array", { a: 1 }, "state")).toBe("");
    expect(variableDefaultForType("array", "", "state")).toBe("");
  });

  it("no value stays empty", () => {
    expect(variableDefaultForType("number", undefined, "state")).toBe(0);
    expect(variableDefaultForType("string", null, "project")).toBe(undefined);
  });
});
