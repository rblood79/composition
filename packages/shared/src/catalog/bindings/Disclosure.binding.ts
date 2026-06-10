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
 * **DOM = renderDisclosure self-compose (DELEGATING)**: Disclosure 는 `childrenByParent` context 가
 *   필요한 self-compose 렌더러다 — renderDisclosure(LayoutRenderers.tsx:1577)가 자식
 *   DisclosureHeader/Heading 의 children 을 title 로 추출 + 나머지를 contentChildren 으로 분리해
 *   RAC `<Disclosure title defaultExpanded>` 로 자기완결 렌더(expand/collapse 동작 = RAC self-compose).
 *   generic `<RAC.X>{childNodes 재귀}` 로는 title 추출/콘텐츠 분리가 깨지므로 catalog cutover 시
 *   **DELEGATING_INTERNAL_RENDERERS 에 "disclosure" 등록 필수**(progressbar/tabs/breadcrumbs 동형) —
 *   cutover DOM 경로가 rendererMap["Disclosure"]=renderDisclosure 로 위임 + generic 자식 재귀 skip.
 *   따라서 catalog 등록 후에도 DOM expand/collapse 동작 보존, 발효 가치는 Skia 게이트 통합 한정.
 *
 * D1: composition — RAC Disclosure(Heading>Button slot="trigger" + DisclosurePanel) D1/ARIA 권위
 *     보존. renderDisclosure 위임으로 RAC primitive 가 DOM 구조/접근성 담당.
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
    },
    toRacProps: "default",
  },
};
