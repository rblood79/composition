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
 * **DOM = renderDisclosureGroup generic 재귀 (DELEGATING 불필요)**: renderDisclosureGroup
 *   (LayoutRenderers.tsx:1547)은 자식을 `childrenByParent` 에서 받아 그대로 renderElement 재귀한다
 *   (title 추출/콘텐츠 분리 같은 self-compose 없음 — Disclosure 와 다른 점). 따라서 generic
 *   `<RAC.DisclosureGroup>{childNodes 재귀}` 로 동일 동작 → DELEGATING_INTERNAL_RENDERERS 등록 불필요.
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
