/**
 * ADR-214 Phase 1 — `VariableDef` / `VariableOwner` 모델 + 가드.
 */
import { describe, expect, it } from "vitest";
import {
  VARIABLE_DEF_TYPES,
  VariableDefSchema,
  isVariableDef,
  isVariableDefList,
  resolveVariableOwnerKey,
} from "../variable.types";

describe("isVariableDef", () => {
  it("id · name · type 5종이 있어야 한다", () => {
    expect(isVariableDef({ id: "v1", name: "count", type: "number" })).toBe(
      true,
    );
    expect(
      isVariableDef({
        id: "v1",
        name: "user",
        type: "object",
        defaultValue: { a: 1 },
        persist: true,
      }),
    ).toBe(true);
    expect(isVariableDef({ id: "v1", name: "x", type: "date" })).toBe(false);
    expect(isVariableDef({ id: "v1", name: "", type: "string" })).toBe(false);
    expect(isVariableDef({ name: "x", type: "string" })).toBe(false);
    expect(isVariableDef(null)).toBe(false);
    expect(isVariableDef("v1")).toBe(false);
  });

  it("isVariableDefList 는 배열 원소 전부가 VariableDef 일 때만 true", () => {
    expect(isVariableDefList([])).toBe(true);
    expect(isVariableDefList([{ id: "a", name: "a", type: "string" }])).toBe(
      true,
    );
    expect(
      isVariableDefList([{ id: "a", name: "a", type: "string" }, { id: "b" }]),
    ).toBe(false);
    expect(isVariableDefList({})).toBe(false);
  });

  it("VARIABLE_DEF_TYPES 는 기존 VariableType 5종과 같다", () => {
    expect([...VARIABLE_DEF_TYPES]).toEqual([
      "string",
      "number",
      "boolean",
      "object",
      "array",
    ]);
  });
});

describe("VariableDefSchema (zod — export envelope · define_variable op 공용)", () => {
  it("파싱 성공 / 실패", () => {
    expect(
      VariableDefSchema.safeParse({ id: "v", name: "n", type: "boolean" })
        .success,
    ).toBe(true);
    expect(
      VariableDefSchema.safeParse({ id: "v", name: "n", type: "nope" }).success,
    ).toBe(false);
    expect(VariableDefSchema.safeParse({ id: "v", name: "n" }).success).toBe(
      false,
    );
  });
});

describe("resolveVariableOwnerKey", () => {
  it("소유자를 안정 문자열 키로 만든다 (Map 키 · 로그용)", () => {
    expect(resolveVariableOwnerKey({ kind: "project" })).toBe("project");
    expect(resolveVariableOwnerKey({ kind: "page", pageId: "p1" })).toBe(
      "page:p1",
    );
    expect(resolveVariableOwnerKey({ kind: "element", elementId: "e1" })).toBe(
      "element:e1",
    );
  });
});
