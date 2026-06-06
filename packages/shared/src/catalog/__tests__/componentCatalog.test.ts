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
  it("같은 family 의 모든 entry 는 cutover 값이 동일 (native 제외 — cutover 개념 없음)", () => {
    const byFamily = new Map<string, Set<string>>();
    for (const e of componentCatalog) {
      // composition-native(frame/Slot)는 cutover 필드 없음(metadata-only) → 불변식 D 무관.
      if (e.kind === "native") continue;
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
  it("family ① primitive 전부 등록 (reusable 없음)", () => {
    const fam1 = componentCatalog.filter((e) => e.family === "primitives");
    const types = fam1.map((e) => e.type).sort();
    expect(types).toEqual(
      [
        "Badge",
        "Button",
        // ADR-912 단계 5 선행-1: catalog 미등록 leaf 등록
        "FileTrigger",
        "Icon",
        "Link",
        "Separator",
        // ADR-912 단계 5 선행-1: loading placeholder internal leaf
        "Skeleton",
        "ToggleButton",
        "ToggleButtonGroup",
        "Toolbar",
        // ADR-912 위험군 해소(선행-1/6): TEXT_LEAF + field/form/text leaf catalog 등록
        //   (HEAD 시점 본 배열에 누락된 stale — container shell 3 추가와 함께 actual 21 로 정합)
        "Text",
        "Heading",
        "Paragraph",
        "Code",
        "Kbd",
        "Label",
        "Description",
        "FieldError",
        // ADR-912 internal 4 slice (2026-06-04): 인라인 알림 box leaf (internal source)
        "InlineAlert",
        // ADR-912 진로 1번 (2026-06-06): 빈 상태(empty state) internal leaf (skiaPrimitive escape)
        "IllustratedMessage",
        // ADR-912 진로 1번 (2026-06-06): 상태 표시 dot+label internal leaf (status_light escape)
        "StatusLight",
        // ADR-912 진로 1번 (2026-06-06): 사용자 아바타 circle+image internal leaf (avatar escape)
        "Avatar",
        // ADR-912 진로 1번 (2026-06-06): 원형 진행률 internal leaf (value_fill_arc escape)
        "ProgressCircle",
        // ADR-912 선행-6 (2026-06-05): field 입력 영역 자식 leaf (rac source)
        "Input",
        // ADR-912 container shell 3 (2026-06-04): box형 시맨틱 컨테이너 leaf (internal source)
        "body",
        "Section",
        "Nav",
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
  it("cutover==='catalog' entry 만 반환 (native 제외)", () => {
    const cutoverTypes = getCatalogCutoverTypes();
    // native(frame/Slot)는 cutover 개념 없음 → 게이트 제외(metadata-only).
    const expectedCatalog = componentCatalog
      .filter((e) => e.kind !== "native" && e.cutover === "catalog")
      .map((e) => e.type);
    expect([...cutoverTypes].sort()).toEqual(expectedCatalog.sort());
  });
});
