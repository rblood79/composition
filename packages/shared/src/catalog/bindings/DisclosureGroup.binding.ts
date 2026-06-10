import type { PrimitiveBinding } from "../types";

/**
 * DisclosureGroup — RAC 디스클로저 그룹 (사용자에게 "Accordion" 으로 익숙한 통칭, RAC 레퍼런스
 *   "A DisclosureGroup is a grouping of related disclosures, sometimes called an accordion").
 *   자식 Disclosure 들을 담는 순수 레이아웃 컨테이너 (RAC DisclosureGroup div).
 *
 * **ADR-912 catalog cutover (Disclosure 군 일괄, 2026-06-10)**: DisclosureGroup 은 catalog 미등록
 *   상태에서 spec.render.shapes(DisclosureGroup.spec.ts:107)가 Skia 시각 source 였다. 단
 *   SHELL_ONLY_CONTAINER_TAGS 멤버(buildSpecNodeData) → _hasChildren=true 항상 주입 →
 *   shell-only(bg roundRect + border) 컨테이너. catalog 등록으로 Skia 는 buildCatalogShapes
 *   generic 경로로 이전 — rule(`COMPONENT_RULES_TABLE.DisclosureGroup`: variants default/accent +
 *   sizes sm/md/lg borderRadius)가 동일 shell 시각 제공 → spec shell 과 시각 대칭, buildCatalogShapes
 *   미수정. (Disclosure 동형 — recon wf_bc9f6ff9-4fc parity PASS)
 *
 * **DOM = renderDisclosureGroup 위임 (DELEGATING_INTERNAL_RENDERERS 등록 필수)**: renderDisclosureGroup
 *   (LayoutRenderers.tsx)은 자식을 `context.childrenByParent.get(id)` 에서 받아 `<DisclosureGroup>`
 *   안에 renderElement 재귀한다. canonical 렌더 경로(CanonicalNodeRenderer)의 renderContext.childrenByParent
 *   는 preview elements state 기반이라 **비어 있어**, generic 일반 rendererMap 위임으로는 DisclosureGroup
 *   이 자식 0개 빈 컨테이너로 렌더된다(CSS preview 미표시). 따라서 `disclosuregroup` 을
 *   DELEGATING_INTERNAL_RENDERERS 에 등록해 flattenNodeChildrenByParent 보강 위임을 받아야 자식
 *   Disclosure 가 정상 렌더된다(disclosure/breadcrumbs 동형 — 2026-06-10 fix).
 *   allowsMultipleExpanded / variant / size 는 accepts → toRacProps(data-* 라우팅)로 전달.
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
    },
    toRacProps: "default",
  },
};
