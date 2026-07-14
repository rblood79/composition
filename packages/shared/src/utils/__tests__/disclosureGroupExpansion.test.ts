import { describe, expect, it } from "vitest";

import {
  allowsMultipleExpanded,
  isDisclosureExpandedByIntent,
  isDisclosureExpandedInContext,
  resolveGroupExpandedDisclosureIds,
  type DisclosureExpansionNode,
} from "../disclosureGroupExpansion";

/**
 * DisclosureGroup 확장 판정 SSOT 회귀 게이트 (2026-07-14).
 *
 * 버그: `allowsMultipleExpanded` 가 CSS/Skia 어느 쪽에도 반영되지 않았다.
 *   - DOM(RAC): 그룹 상태머신(useDisclosureGroupState)이 "allowsMultipleExpanded=false 면
 *     첫 번째 키만" 규칙을 적용 → 실제로는 하나만 펼쳐짐.
 *   - Skia: `disclosure.props.isExpanded === false` 만 보고 **부모 그룹 제약을 몰라** 자식
 *     Disclosure 를 전부 펼쳐 그림 → CSS↔Skia 발산.
 *
 * 본 helper 가 두 경로의 단일 규칙 source. RAC 소스와 동형이어야 한다
 * (react-stately useDisclosureGroupState.mjs:24-30 — `expandedKeys.values().next().value`).
 */

const disc = (
  id: string,
  props: Record<string, unknown> = {},
): DisclosureExpansionNode => ({ id, type: "Disclosure", props });

const group = (
  props: Record<string, unknown> = {},
): DisclosureExpansionNode => ({
  id: "grp",
  type: "DisclosureGroup",
  props,
});

describe("allowsMultipleExpanded — composition binding default = true", () => {
  it("미지정이면 true (다중 허용) — RAC 자체 기본값(false)과 다른 composition 의 선택", () => {
    expect(allowsMultipleExpanded(undefined)).toBe(true);
    expect(allowsMultipleExpanded({})).toBe(true);
  });

  it("명시 false 일 때만 단일 확장", () => {
    expect(allowsMultipleExpanded({ allowsMultipleExpanded: false })).toBe(
      false,
    );
    expect(allowsMultipleExpanded({ allowsMultipleExpanded: true })).toBe(true);
  });
});

describe("isDisclosureExpandedByIntent — binding default = true(펼침)", () => {
  it("미지정이면 펼침", () => {
    expect(isDisclosureExpandedByIntent(undefined)).toBe(true);
    expect(isDisclosureExpandedByIntent({})).toBe(true);
  });

  it("명시 false 일 때만 접힘", () => {
    expect(isDisclosureExpandedByIntent({ isExpanded: false })).toBe(false);
    expect(isDisclosureExpandedByIntent({ isExpanded: true })).toBe(true);
  });
});

describe("resolveGroupExpandedDisclosureIds", () => {
  it("allowsMultipleExpanded=true — 후보 전부 확장", () => {
    const ids = resolveGroupExpandedDisclosureIds({}, [disc("a"), disc("b")]);
    expect([...ids]).toEqual(["a", "b"]);
  });

  it("allowsMultipleExpanded=false — 후보가 여럿이면 첫 번째만 (RAC 동형)", () => {
    const ids = resolveGroupExpandedDisclosureIds(
      { allowsMultipleExpanded: false },
      [disc("a"), disc("b"), disc("c")],
    );
    expect([...ids]).toEqual(["a"]);
  });

  it("allowsMultipleExpanded=false + 후보 1개 — 그대로 유지", () => {
    const ids = resolveGroupExpandedDisclosureIds(
      { allowsMultipleExpanded: false },
      [disc("a", { isExpanded: false }), disc("b")],
    );
    expect([...ids]).toEqual(["b"]);
  });

  it("isExpanded:false 인 자식은 후보에서 제외 — 첫 번째 판정은 남은 후보 기준", () => {
    const ids = resolveGroupExpandedDisclosureIds(
      { allowsMultipleExpanded: false },
      [disc("a", { isExpanded: false }), disc("b"), disc("c")],
    );
    expect([...ids]).toEqual(["b"]); // a 가 아니라 b
  });

  it("모두 접힘이면 빈 집합", () => {
    const ids = resolveGroupExpandedDisclosureIds({}, [
      disc("a", { isExpanded: false }),
      disc("b", { isExpanded: false }),
    ]);
    expect(ids.size).toBe(0);
  });

  it("Disclosure 아닌 자식은 무시", () => {
    const ids = resolveGroupExpandedDisclosureIds({}, [
      { id: "x", type: "Text", props: {} },
      disc("a"),
    ]);
    expect([...ids]).toEqual(["a"]);
  });
});

describe("isDisclosureExpandedInContext", () => {
  it("그룹 밖 단독 Disclosure — 자기 isExpanded 만 따름 (기존 동작 보존)", () => {
    expect(isDisclosureExpandedInContext(disc("a"), null, undefined)).toBe(
      true,
    );
    expect(
      isDisclosureExpandedInContext(
        disc("a", { isExpanded: false }),
        null,
        undefined,
      ),
    ).toBe(false);
  });

  it("부모가 DisclosureGroup 아니면 단독 취급", () => {
    const parent: DisclosureExpansionNode = {
      id: "p",
      type: "Frame",
      props: { allowsMultipleExpanded: false },
    };
    // Frame 이므로 그룹 제약 미적용 → 자기 intent(true) 유지
    expect(
      isDisclosureExpandedInContext(disc("a"), parent, [disc("a"), disc("b")]),
    ).toBe(true);
  });

  it("그룹 안 + allowsMultipleExpanded=true — 둘 다 펼침", () => {
    const kids = [disc("a"), disc("b")];
    const g = group({ allowsMultipleExpanded: true });
    expect(isDisclosureExpandedInContext(kids[0], g, kids)).toBe(true);
    expect(isDisclosureExpandedInContext(kids[1], g, kids)).toBe(true);
  });

  it("그룹 안 + allowsMultipleExpanded=false — 첫 번째만 펼침 (버그 재발 차단)", () => {
    const kids = [disc("a"), disc("b")];
    const g = group({ allowsMultipleExpanded: false });
    expect(isDisclosureExpandedInContext(kids[0], g, kids)).toBe(true);
    // ❌ 회귀: Skia 가 그룹 제약을 무시하면 여기서 true 가 되어 CSS 와 발산한다.
    expect(isDisclosureExpandedInContext(kids[1], g, kids)).toBe(false);
  });

  it("그룹 안 + 개별 isExpanded=false 는 여전히 접힘 (다중 허용이어도)", () => {
    const kids = [disc("a"), disc("b", { isExpanded: false })];
    const g = group({ allowsMultipleExpanded: true });
    expect(isDisclosureExpandedInContext(kids[1], g, kids)).toBe(false);
  });
});
