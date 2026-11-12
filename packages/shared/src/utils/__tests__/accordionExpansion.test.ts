import { describe, expect, it } from "vitest";

import {
  allowsMultipleExpanded,
  isDisclosureExpandedByIntent,
  type DisclosureExpansionNode,
} from "../accordionExpansion";

/**
 * Accordion 확장 판정 SSOT 회귀 게이트 (2026-07-14).
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
  type: "Accordion",
  props,
});

describe("allowsMultipleExpanded — S2 default = false", () => {
  it("미지정이면 false (S2 단일 확장)", () => {
    expect(allowsMultipleExpanded(undefined)).toBe(false);
    expect(allowsMultipleExpanded({})).toBe(false);
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
