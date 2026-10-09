import type { PrimitiveBinding } from "../types";

/**
 * DisclosureGroup — RAC 디스클로저 그룹 (사용자에게 "Accordion" 으로 익숙한 통칭, RAC 레퍼런스
 *   "A DisclosureGroup is a grouping of related disclosures, sometimes called an accordion").
 *   자식 Disclosure 들을 담는 순수 레이아웃 컨테이너 (RAC DisclosureGroup div).
 *
 * **Canvas**: rule `COMPONENT_RULES_TABLE.DisclosureGroup` (variants default/accent + sizes
 *   borderRadius) 이 컨테이너 shell 을 그리고 자식 Disclosure 는 각자 그린다.
 *
 * **DOM = delegatedDom `disclosuregroup` (delegating 등록 필수)**: RAC `DisclosureGroup` 안에 자식
 *   노드를 그대로 담고, 펼침 키를 그 RAC context 가 닿는 모든 Disclosure 의 `isExpanded` (선언 값 ·
 *   Preview 실행 값) 로 넘긴다. allowsMultipleExpanded / isDisabled 는 RAC prop, variant / size 는
 *   `data-variant` / `data-size`.
 *
 * D1: composition — RAC DisclosureGroup(div, role 없음, expandedKeys 관리) D1/ARIA 권위 보존.
 * D2: allowsMultipleExpanded + variant + size 편집 surface.
 * D3: 시각(컨테이너 radius/border/배경)은 theme rule (COMPONENT_RULES_TABLE.DisclosureGroup).
 *     Skia generic shell ↔ DOM RAC 컨테이너 시각 대칭.
 */
export const disclosureGroupBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "disclosuregroup",
  },
  props: {
    accepts: {
      allowsMultipleExpanded: {
        kind: "boolean",
        label: "Allow Multiple Expanded",
        section: "state",
        default: true,
      },
      variant: {
        kind: "variant",
        label: "Variant",
        section: "appearance",
        default: "default",
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — delegatedDom `disclosuregroup` 이 RAC 에 넘긴다.
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
