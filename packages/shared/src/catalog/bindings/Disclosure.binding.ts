import type { PrimitiveBinding } from "../types";

/**
 * Disclosure — RAC 디스클로저(아코디언) 컨테이너. trigger 헤더(title) + 펼침 콘텐츠.
 *
 * **ADR-912 §2-5 collapse 진입 proof slice (2026-06-10)**: Disclosure 는 catalog 미등록
 *   상태에서 spec.render.shapes(Disclosure.spec.ts:119)가 Skia 시각 source 였다. 단 Disclosure 는
 *   SHELL_ONLY_CONTAINER_TAGS 멤버(buildSpecNodeData:167) → _hasChildren=true 항상 주입 →
 *   spec.render.shapes 가 즉시 `[]` 반환(투명 레이아웃 컨테이너, Disclosure.spec.ts:181). catalog
 *   등록으로 Skia 는 buildCatalogShapes generic 경로로 이전 — Disclosure rule
 *   (`COMPONENT_RULES_TABLE.Disclosure`)은 `variants:{}` (variant 없음)이라 visual undefined →
 *   bgColor null → hasVisibleBg=false(buildCatalogShapes.ts:148) + _hasChildren → 빈 shell 반환.
 *   spec `[]` 과 **시각 결과 동일**(둘 다 빈 box) → Skia parity 성립, buildCatalogShapes 미수정.
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
      // RAC/RSP 프로퍼티 패널 정합 감사 (2026-07-15): RAC 공식 prop — renderDisclosure 배선 동반.
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
};
