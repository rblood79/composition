/**
 * ADR-134 Phase 6 — AI 의 합성 판정이 팔레트와 같은가.
 *
 * 이 판정이 갈리면 같은 컴포넌트가 만든 경로에 따라 다른 모양이 된다 (2026-08-28 실측:
 * AI 가 만든 Select 는 자식 0개, 팔레트로 만든 Select 는 Label + SelectTrigger 트리).
 * 그래서 기대값을 손으로 적지 않고 팔레트가 읽는 SSOT 를 그대로 읽어 대조한다.
 */
import { describe, expect, it } from "vitest";
import { COMPLEX_COMPONENT_TAGS } from "../../../builder/factories/constants";
import {
  getReusableCompositeOriginId,
  isReusableCompositeType,
} from "../../../builder/components/reusableCompositeOrigins";
import { componentCatalog } from "@composition/shared";
import { resolveCompositeMode } from "./compositeCreation";

describe("합성 판정 — 팔레트와 같은 SSOT", () => {
  it("catalog 전 type 에서 팔레트 우선순위와 일치한다", () => {
    const mismatches: string[] = [];
    for (const entry of componentCatalog) {
      // 팔레트: reusableOrigin > complex > none (useElementCreator:162~192)
      const expected = isReusableCompositeType(entry.type)
        ? "reusable"
        : COMPLEX_COMPONENT_TAGS.has(entry.type)
          ? "complex"
          : "leaf";
      const actual = resolveCompositeMode(entry.type);
      if (actual !== expected) {
        mismatches.push(`${entry.type}: ${actual} ≠ ${expected}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("Select 같은 COMPLEX 는 complex 로 간다 (RED 사례)", () => {
    // ADR-228: 팔레트 RAC 항목은 전부 reusable origin — COMPLEX 멤버라도 reusable 이 우선.
    //   complex 는 팔레트 밖 COMPLEX (Toast · ColorPicker …) 에만 남는다.
    expect(COMPLEX_COMPONENT_TAGS.has("Select")).toBe(true);
    expect(resolveCompositeMode("Select")).toBe("reusable");
    expect(COMPLEX_COMPONENT_TAGS.has("ColorPicker")).toBe(true);
    expect(resolveCompositeMode("ColorPicker")).toBe("complex");
  });

  it("Card / Form 같은 reusable 은 ref 인스턴스 경로", () => {
    for (const type of ["Card", "Form"]) {
      expect(getReusableCompositeOriginId(type)).toBeTruthy();
      expect(resolveCompositeMode(type)).toBe("reusable");
    }
  });

  it("leaf 는 기존 단일 element 경로를 그대로 쓴다", () => {
    // ADR-228: X 집합 (내용/레이아웃 primitive) 만 leaf — Button/Link 는 reusable.
    for (const type of ["Text", "Icon", "Image", "Separator"]) {
      expect(resolveCompositeMode(type)).toBe("leaf");
    }
    for (const type of ["Button", "Link"]) {
      expect(resolveCompositeMode(type)).toBe("reusable");
    }
  });

  it("COMPLEX ∩ reusable 은 우선순위 (reusable 승) 로 갈린다 — ADR-228", () => {
    const both = [...COMPLEX_COMPONENT_TAGS].filter((t) =>
      isReusableCompositeType(t),
    );
    // ADR-233 Phase 2: Radio (COMPLEX — Radio > Label) 가 팔레트 밖 reusable 로 합류 — 41 → 42.
    // ADR-239 Phase 4: ColorSwatchPicker (COMPLEX) 합류 — 42 → 43.
    expect(both.length).toBe(43);
    for (const type of both)
      expect(resolveCompositeMode(type)).toBe("reusable");
  });
});
