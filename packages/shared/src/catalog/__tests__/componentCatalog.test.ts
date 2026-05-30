import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import {
  componentCatalog,
  getCatalogCutoverTypes,
  getCatalogEntry,
} from "../componentCatalog";

/**
 * ADR-142 — componentCatalog 무결성 + family atomicity(불변식 D).
 * 6 registry 를 대체하는 단일 등록 SSOT 의 계약 검증.
 */
describe("componentCatalog — entry 무결성", () => {
  it("모든 primitive entry 의 binding 이 getPrimitiveBinding 과 일치", () => {
    for (const e of componentCatalog) {
      if (e.kind === "primitive") {
        expect(e.binding).toBe(getPrimitiveBinding(e.type));
      }
    }
  });

  it("reusable entry 는 reusableId 를 가진다 (family ① 은 reusable 없음)", () => {
    for (const e of componentCatalog) {
      if (e.kind === "reusable") {
        expect(typeof e.reusableId).toBe("string");
        expect(e.reusableId.length).toBeGreaterThan(0);
      }
    }
  });

  it("type 중복 없음", () => {
    const types = componentCatalog.map((e) => e.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it("모든 entry 의 panel.placeable 정의", () => {
    for (const e of componentCatalog) {
      expect(typeof e.panel.placeable).toBe("boolean");
    }
  });
});

describe("componentCatalog — family atomicity (불변식 D)", () => {
  it("같은 family 의 모든 entry 는 cutover 값이 동일", () => {
    const byFamily = new Map<string, Set<string>>();
    for (const e of componentCatalog) {
      if (!byFamily.has(e.family)) byFamily.set(e.family, new Set());
      byFamily.get(e.family)!.add(e.cutover);
    }
    for (const [family, cutoverValues] of byFamily) {
      expect(
        cutoverValues.size,
        `family "${family}" 에 혼재된 cutover: ${[...cutoverValues].join(", ")}`,
      ).toBe(1);
    }
  });
});

describe("componentCatalog — family ① (primitives) 구성", () => {
  it("family ① 8 primitive 전부 등록 (reusable 없음)", () => {
    const fam1 = componentCatalog.filter((e) => e.family === "primitives");
    const types = fam1.map((e) => e.type).sort();
    expect(types).toEqual(
      [
        "Badge",
        "Button",
        "Icon",
        "Link",
        "Separator",
        "ToggleButton",
        "ToggleButtonGroup",
        "Toolbar",
      ].sort(),
    );
    expect(fam1.every((e) => e.kind === "primitive")).toBe(true);
  });

  it("getCatalogEntry O(1) 조회", () => {
    expect(getCatalogEntry("Button")?.type).toBe("Button");
    expect(getCatalogEntry("Nonexistent")).toBeUndefined();
  });
});

describe("getCatalogCutoverTypes — cutover 게이트 파생", () => {
  it("cutover==='catalog' entry 만 반환 (family ① flip 전엔 비어있음)", () => {
    const cutoverTypes = getCatalogCutoverTypes();
    const expectedCatalog = componentCatalog
      .filter((e) => e.cutover === "catalog")
      .map((e) => e.type);
    expect([...cutoverTypes].sort()).toEqual(expectedCatalog.sort());
  });
});
