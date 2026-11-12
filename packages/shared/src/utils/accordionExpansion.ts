/**
 * @fileoverview Accordion 의 "실제로 펼쳐지는 Disclosure" 판정 SSOT (2026-07-14).
 *
 * **문제**: Accordion 의 `allowsMultipleExpanded` 가 CSS/Skia 어느 쪽에도 제대로 반영되지
 *   않았다. 두 경로가 서로 다른 진실을 봤기 때문이다:
 *
 *   - **DOM(RAC)**: `renderAccordion` 이 `defaultExpandedKeys` 를 넘기면, RAC 의
 *     `useDisclosureGroupState` 가 **그룹 상태머신**으로 확장을 관리한다. 그 안에는
 *     "Ensure only one item is expanded if allowsMultipleExpanded is false" 로직이 있어
 *     (react-stately useDisclosureGroupState.mjs:24-30) 키가 2개 이상이면 **첫 번째만** 남긴다.
 *     즉 개별 Disclosure 의 `isExpanded` 는 그룹이 override 한다.
 *   - **Skia** (당시): `applyImplicitStyles`(disclosure 분기 — 2026-10-05 삭제) / `resolveDisclosureHeaderParent`(chevron)가
 *     오직 `disclosure.props.isExpanded === false` 만 봤다. **부모 그룹의 제약을 전혀 모른다** →
 *     `allowsMultipleExpanded=false` 인데도 자식 Disclosure 를 전부 펼쳐 그림.
 *
 * **해법**: 그룹의 유효 확장 집합을 본 모듈이 단일 규칙으로 계산하고, DOM(defaultExpandedKeys) /
 *   Skia(content display:none + chevron 방향)가 **같은 함수**를 소비한다 → 시각 대칭(D3).
 *
 * **규칙** (RAC useDisclosureGroupState 와 동형):
 *   1. 확장 후보 = `isExpanded ?? true` 인 자식 Disclosure (composition binding default 는 true —
 *      RAC 자체 기본값 false 와 다르지만 composition 의 선택을 따른다).
 *   2. `allowsMultipleExpanded === false` 면 후보 중 **첫 번째만** 확장 (RAC 와 동일 — 순서 의존).
 *      S2 기본값은 false이며 명시 true일 때 다중 확장을 허용한다.
 */

/** 확장 판정에 필요한 최소 노드 형태 (PreviewElement / CanvasLayoutNode / CanvasSceneNode 공통). */
export interface DisclosureExpansionNode {
  readonly id: string;
  readonly type?: string;
  readonly props?: Record<string, unknown> | null;
}

/** 그룹 노드에서 allowsMultipleExpanded 를 읽는다. S2 기본값 = false(단일 확장). */
export function allowsMultipleExpanded(
  groupProps: Record<string, unknown> | null | undefined,
): boolean {
  return groupProps?.allowsMultipleExpanded === true;
}

/** 개별 Disclosure 의 의도된 확장 여부. composition binding default = true(펼침). */
export function isDisclosureExpandedByIntent(
  disclosureProps: Record<string, unknown> | null | undefined,
): boolean {
  return disclosureProps?.isExpanded !== false;
}
