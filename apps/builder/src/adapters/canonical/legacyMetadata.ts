import type { Element } from "../../types/core/store.types";
import { asElementWithLegacyMirror } from "./legacyElementFields";

/**
 * canonical CanonicalNode.metadata 의 type discriminator.
 * adapter quarantine payload 식별용 contract.
 */
export const LEGACY_ELEMENT_PROPS_METADATA_TYPE =
  "legacy-element-props" as const;

/**
 * legacyToCanonical 의 adapter quarantine payload 표준 빌더.
 *
 * ADR-916 direct cutover 이후 runtime resolver/preview/store 는 이 payload 를
 * props source 로 읽지 않는다. 남은 용도는 adapter boundary 감사와 legacy
 * export 테스트 fixture 검증이다.
 *
 * **보존 필수 fields**:
 * - core top-level: `id` / `parent_id` / `page_id` / `layout_id` / `order_num` /
 *   `fills` / `type` (ADR-916 Phase 2 G3 Step 1b — hot path inverse 변환에서
 *   element.type 복원에 필요. ref 노드의 경우 canonical type 이 "ref" 로
 *   변환되므로 원본 element.type 보존 없이 LayerTree 분기 불가).
 * - mirror compatibility: `slot_name` / `componentRole` / `masterId` /
 *   `overrides` / `descendants` / `componentName` (ADR-916 G6-3 parity — legacy
 *   mirror payload 를 export boundary 에서만 복원).
 *
 * **ADR-916 Phase 5 G7 본격 cutover** (2026-05-01): `element.events` /
 * `element.dataBinding` 은 본 metadata 에 더 이상 spread 되지 않는다. 대신
 * `x-composition` extension namespace 로 분리 (`buildCompositionExtensionField`,
 * `index.ts` / `slotAndLayoutAdapter.ts` 양쪽). transition first slice 의 dual-storage
 * 는 종결 — extension 이 단일 SSOT.
 *
 * spread 순서: `...element.props` 먼저 → top-level fields 가 props 의 동명 키 덮어씀.
 */
export function buildLegacyElementMetadata(element: Element): {
  type: typeof LEGACY_ELEMENT_PROPS_METADATA_TYPE;
  legacyProps: Record<string, unknown>;
} {
  const legacy = asElementWithLegacyMirror(element);

  return {
    type: LEGACY_ELEMENT_PROPS_METADATA_TYPE,
    legacyProps: {
      ...element.props,
      id: element.id,
      customId: element.customId,
      parent_id: element.parent_id,
      page_id: element.page_id,
      layout_id: legacy.layout_id,
      order_num: element.order_num,
      fills: element.fills,
      type: element.type,
      slot_name: legacy.slot_name,
      componentRole: legacy.componentRole,
      masterId: legacy.masterId,
      overrides: legacy.overrides,
      descendants: legacy.descendants,
      componentName: legacy.componentName,
    },
  };
}

/**
 * Layout/Slot System ownership 규칙: layoutId 가 있으면 page_id=null,
 * 없으면 page_id=pageId. `useElementCreator` (단순 컴포넌트 경로) 와
 * `createElementsFromDefinition` (복합 컴포넌트 경로) 양쪽이 동일 규칙 사용.
 */
export function resolveOwnerPageId(
  pageId: string | null,
  layoutId: string | null | undefined,
): string | null {
  return layoutId ? null : pageId;
}
