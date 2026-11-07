import type { PrimitiveBinding } from "../types";

/**
 * Accordion — S2와 같은 이름을 사용하는 Composition 그룹.
 * DOM은 RAC DisclosureGroup으로 자식 Disclosure의 펼침 상태를 관리한다.
 * Canvas와 DOM의 기본 스타일은 COMPONENT_RULES_TABLE.Accordion이 제공한다.
 * catalog 식별자·원본 주소·렌더러 키는 Accordion / accordion으로 통일한다.
 */
export const accordionBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "accordion",
  },
  props: {
    accepts: {
      allowsMultipleExpanded: {
        kind: "boolean",
        label: "Allow Multiple Expanded",
        section: "state",
        default: false,
      },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — delegatedDom `accordion` 이 RAC 에 넘긴다.
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
