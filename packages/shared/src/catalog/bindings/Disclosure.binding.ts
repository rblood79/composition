import type { PrimitiveBinding } from "../types";

/**
 * Disclosure — RAC 디스클로저(아코디언) 컨테이너. trigger 헤더(title) + 펼침 콘텐츠.
 *
 * **Canvas**: rule `COMPONENT_RULES_TABLE.Disclosure` 는 `variants:{}` (fill 없음) — 컨테이너는 빈
 *   shell 이고 헤더·패널 시각은 자식 노드가 그린다.
 *
 * **DOM = RAC Disclosure 의 노드 트리 (ADR-256 Phase 8c)**: delegatedDom `disclosure` 가 RAC
 *   `Disclosure` 를 그리고 자식 노드 — 레퍼런스 `Heading > Button[slot=trigger] > (chevron Icon + 제목 Text)`
 *   + `DisclosurePanel > 내용` — 를 순서대로 담는다. 펼침 (선언 값 · Preview 실행 값 · DisclosureGroup) 과
 *   showWhen state frame 을 넘기므로 delegating 등록이 필요하다.
 *
 * D1: RAC Disclosure · Heading · Button[trigger] · DisclosurePanel 그대로 (D1/ARIA 권위 보존).
 * D2: title(children) + isExpanded + size 편집 surface.
 * D3: 시각(헤더 폰트/크기/패딩, 컨테이너 radius/border)은 theme rule
 *     (COMPONENT_RULES_TABLE.Disclosure.sizes). Skia generic shell ↔ DOM RAC self-compose 시각 대칭.
 */
export const disclosureBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "disclosure",
  },
  props: {
    accepts: {
      title: { kind: "string", label: "Title", section: "content" },
      isExpanded: {
        kind: "boolean",
        label: "Expanded",
        section: "state",
        default: true,
      },
      // kind:"size" 는 options 미보유(types.ts:139-142) — theme rule 동적 제공.
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — delegatedDom `disclosure` 가 RAC 에 넘긴다.
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
