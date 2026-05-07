/**
 * @fileoverview Slot + Layout Legacy Adapter — ADR-903 P1 Stream 3.
 *
 * 변환 책임:
 *  - type="Slot" element → 부모 컨테이너의 slot 메타 (별도 Slot 특수 노드 제거)
 *  - Page.layout_id → page를 layout shell의 ref 인스턴스로 표현
 *  - page의 elements (slot_name으로 그룹핑) → descendants[slotPath].children
 *    (canonical mode C children replacement)
 *
 * **Hard Constraint #8**: `slot`은 컨테이너의 schema 속성
 * (`false | string[]` — 추천 reusable component ID). legacy `slot_name` 문자열은
 * descendants path 키로만 보존.
 *
 * **default slot name 정책**: legacy 시스템은 `slot_name` 미설정 page element를
 * 기본 slot 없이 page root에만 위치시켰다. 본 adapter는 `"content"`를 default
 * slot name으로 사용한다. layout shell이 `"content"` slot을 갖지 않으면
 * descendants["content"].children이 무시될 수 있다 (P1 단계 known broken case —
 * P3 frameset UI에서 layout shell에 "content" slot 자동 보장 예정).
 *
 * **DRY 인지**: `convertElementToCanonical`과 `convertElementWithSlotHoisting`은
 * Stream 1의 `buildNode`와 유사한 logic을 포함한다. P1 의도적 격리 —
 * Phase 2 resolver 통합 단계에서 단일화 예정.
 *
 * @see docs/adr/903-ref-descendants-slot-composition-format-migration-plan.md
 * @see packages/shared/src/types/composition-document.types.ts
 */

import type { Element } from "@/types/builder/unified.types";
import type { Layout } from "@/types/builder/layout.types";
import type {
  CanonicalNode,
  CompositionExtension,
  FrameNode,
  RefNode,
  SerializedDataBinding,
  SerializedEventHandler,
} from "@composition/shared";
import type { ConvertSlotElementFn, ConvertPageLayoutFn } from "./types";
import { tagToType, isLegacySlotTag } from "./tagRename";
import { buildLegacyElementMetadata } from "./legacyMetadata";
import { buildIdPathContext, segId } from "./idPath";
import { getCanonicalSlotDeclaration } from "./slotDeclaration";

/**
 * ADR-116 Phase 5 G7 본격 cutover (2026-05-01) — element.events / dataBinding
 * 를 `x-composition` extension 으로 분리. index.ts 의 `buildCompositionExtensionField`
 * 와 동일 contract — 본 모듈은 별도 분기를 가지므로 helper 중복 정의.
 */
function buildCompositionExtensionField(element: Element): {
  "x-composition"?: CompositionExtension;
} {
  const ext: CompositionExtension = {};
  if (Array.isArray(element.events) && element.events.length > 0) {
    ext.events = element.events as SerializedEventHandler[];
  }
  if (element.dataBinding !== undefined && element.dataBinding !== null) {
    ext.dataBinding = element.dataBinding as SerializedDataBinding;
  }
  if (ext.events === undefined && ext.dataBinding === undefined) {
    return {};
  }
  return { "x-composition": ext };
}

// ─────────────────────────────────────────────
// ConvertSlotElementFn
// ─────────────────────────────────────────────

/**
 * Slot Element 변환:
 *  - SlotProps.name → slotName (canonical descendants path 키)
 *  - 추천 reusable IDs는 legacy 시스템에 없으므로 빈 배열
 *    (P3 NodesPanel UI에서 사용자 입력 가능해질 예정)
 */
export const convertSlotElement: ConvertSlotElementFn = (slotElement) => {
  const props = slotElement.props as Partial<{ name: string }>;
  const slotName =
    props.name ?? slotElement.slot_name ?? undefined ?? "content";
  return {
    slotMeta: [], // 빈 배열 = "slot 정의는 있으나 추천 reusable IDs 미지정"
    slotName,
  };
};

// ─────────────────────────────────────────────
// ConvertPageLayoutFn
// ─────────────────────────────────────────────

/**
 * Page → RefNode 변환 (layout_id 있을 때).
 *
 * Layout shell이 정의된 경우:
 *   1. page.layout_id가 가리키는 Layout을 찾는다 (없으면 null 반환).
 *   2. layout shell의 stable id = `"layout-<layout.id>"` (호출자가 hoisting 시 매칭).
 *   3. page는 layout shell의 ref 인스턴스. `ref = "layout-<layout.id>"`.
 *   4. slot_name으로 그룹핑된 page의 root elements를
 *      `descendants[slotName].children` (mode C — children replacement)으로 inject.
 *
 * layout_id 없으면 null 반환 (호출자가 일반 page 처리).
 */
export const convertPageLayout: ConvertPageLayoutFn = (
  page,
  layouts,
  pageElements,
  slotPathMap,
) => {
  if (!page.layout_id) return null;

  const layout = layouts.find((l) => l.id === page.layout_id);
  if (!layout) {
    console.warn(
      `[ADR-903 adapter] page ${page.id} references unknown layout ${page.layout_id}`,
    );
    return null;
  }

  // page root elements (parent_id == null)를 slot_name으로 그룹핑
  const pageRoots = pageElements.filter((e) => e.parent_id == null);
  const bySlotName = new Map<string, Element[]>();
  for (const el of pageRoots) {
    const slot = el.slot_name ?? "content"; // default slot
    const arr = bySlotName.get(slot) ?? [];
    arr.push(el);
    bySlotName.set(slot, arr);
  }

  // page elements 전체에 대해 idPath context 구축 (canonical node id segment용)
  const pageIdPathCtx = buildIdPathContext(pageElements);

  // 각 slot 그룹을 canonical CanonicalNode[]로 변환 → mode C children replacement.
  // descendants 키는 stable id path (resolver mode C 매칭 기준).
  // slotPathMap 미스 시 slot name 그대로 fallback (layout shell 에 매칭되는 slot
  // 이 없는 경우 — known broken case, P3 frameset UI 에서 보장 예정).
  const descendants: Record<string, { children: CanonicalNode[] }> = {};
  for (const [slotName, els] of bySlotName) {
    const sorted = [...els].sort(
      (a, b) => (a.order_num ?? 0) - (b.order_num ?? 0),
    );
    const slotPath = slotPathMap.get(slotName) ?? slotName;
    descendants[slotPath] = {
      children: sorted.map((el) =>
        convertElementToCanonical(el, pageElements, pageIdPathCtx.idSegmentMap),
      ),
    };
  }

  const refNode: RefNode = {
    id: page.id,
    type: "ref",
    ref: `layout-${layout.id}`, // layout shell stable id (호출자 hoisting 시 매칭)
    name: page.title,
    metadata: {
      type: "legacy-page",
      pageId: page.id,
      slug: page.slug ?? null,
      order_num: page.order_num ?? 0,
      parent_id: page.parent_id ?? null,
      layoutId: layout.id,
    },
    descendants,
  };

  return refNode;
};

// ─────────────────────────────────────────────
// Slot path computation (layout shell 내 slot name → stable id path)
// ─────────────────────────────────────────────

/**
 * Layout shell 의 모든 Slot type 의 stable id path 를 계산한다.
 *
 * `layoutIdPathMap` (`buildIdPathContext(layoutElements).idPathMap`) 이 이미
 * 각 element 의 full path 를 보유하므로 단순 lookup. resolver mode C 매칭의
 * path 키로 사용.
 *
 * 출력 형식: `{ slotName → "Box/Slot" }` (예: layout root="Box", slot type="Slot")
 *
 * 같은 slotName 이 여러 slot 에 등장하면 마지막이 이긴다.
 *
 * @param layoutElements - 한 layout 의 elements (호출자가 layout_id 로 필터링)
 * @param layoutIdPathMap - `buildIdPathContext(layoutElements).idPathMap`
 */
export function buildSlotPathMap(
  layoutElements: Element[],
  layoutIdPathMap: Map<string, string>,
): Map<string, string> {
  const slotPathMap = new Map<string, string>();
  for (const el of layoutElements) {
    if (!isLegacySlotTag(el.type)) continue;
    const fullPath = layoutIdPathMap.get(el.id) ?? el.id;
    const props = el.props as Partial<{ name: string }>;
    const slotName = props.name ?? el.slot_name ?? "content";
    slotPathMap.set(slotName, fullPath);
  }
  return slotPathMap;
}

// ─────────────────────────────────────────────
// Layout shell hoisting helper
// ─────────────────────────────────────────────

/**
 * Legacy Layout → canonical reusable FrameNode 변환.
 *
 * - layout stable id = `"layout-<layout.id>"` (`convertPageLayout`과 매칭)
 * - `reusable: true` 선언
 * - layout 안의 Slot element는 부모 컨테이너 slot 메타로 흡수
 *   (`convertElementWithSlotHoisting` 참조)
 *
 * @param layout - Legacy Layout 레코드
 * @param layoutElements - 해당 layout_id로 필터링된 Element 배열 (호출자 책임)
 */
export function convertLayoutToReusableFrame(
  layout: Layout,
  layoutElements: Element[],
): CanonicalNode {
  const idPathCtx = buildIdPathContext(layoutElements);
  const rootElements = layoutElements
    .filter((e) => e.parent_id == null)
    .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));

  return {
    id: `layout-${layout.id}`,
    type: "frame",
    reusable: true,
    name: layout.name,
    metadata: {
      type: "legacy-layout",
      layoutId: layout.id,
      slug: layout.slug ?? null,
      // ADR-111 P2 PR-E1: PageLayoutSelector canonical mode 에서 description 표시 보존
      description: layout.description ?? null,
    },
    children: rootElements.map((el) =>
      convertElementWithSlotHoisting(
        el,
        layoutElements,
        idPathCtx.idSegmentMap,
      ),
    ),
  };
}

// ─────────────────────────────────────────────
// Internal helpers (pure functions)
// ─────────────────────────────────────────────

/**
 * Element subtree → CanonicalNode 재귀 변환 (slot 흡수 없음, page subtree 전용).
 *
 * page의 slot children 변환에서 사용. Slot type가 page subtree 안에 존재하는
 * 경우(비정상)는 legacy-slot metadata로만 기록하고 구조 변환은 생략.
 *
 * DRY 인지: Stream 1 buildNode와 logic 중복. Phase 2 resolver 통합 시 단일화 예정.
 */
function convertElementToCanonical(
  element: Element,
  allElements: Element[],
  idSegmentMap: Map<string, string>,
): CanonicalNode {
  const childElements = allElements
    .filter((e) => e.parent_id === element.id)
    .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));

  if (isLegacySlotTag(element.type)) {
    // page subtree 안의 Slot은 비정상. metadata만 기록하고 frame으로 변환
    return {
      id: segId(element.id, idSegmentMap),
      type: "frame",
      name: element.componentName,
      props: { ...element.props },
      metadata: {
        type: "legacy-slot",
        slot_name: element.slot_name ?? null,
      },
      children: childElements.map((c) =>
        convertElementToCanonical(c, allElements, idSegmentMap),
      ),
    };
  }

  return {
    id: idSegmentMap.get(element.id) ?? element.id,
    type: tagToType(element.type),
    name: element.componentName,
    props: { ...element.props },
    children: childElements.map((c) =>
      convertElementToCanonical(c, allElements, idSegmentMap),
    ),
    ...getCanonicalSlotDeclaration(element),
    metadata: buildLegacyElementMetadata(element),
    ...buildCompositionExtensionField(element),
  };
}

/**
 * Slot 흡수 변환 — layout shell subtree 전용.
 *
 * Slot type element를 별도 노드로 만들지 않고
 * placeholder FrameNode(slot 메타 포함)로 변환.
 *
 * legacy 구조:
 *   container (Box)
 *     └── Slot (type="Slot", slot_name="main")
 *
 * canonical 구조:
 *   { type: "frame", placeholder: true, slot: [], metadata: {slotName: "main"} }
 *
 * 실제 content는 page가 `descendants[slotName].children`으로 inject.
 *
 * NOTE: legacy Slot element가 자식을 가지는 경우(default placeholder content)
 * P1 단계에서는 무시 (children: []). P3 frameset UI에서 처리 예정.
 */
function convertElementWithSlotHoisting(
  element: Element,
  allElements: Element[],
  idSegmentMap: Map<string, string>,
): CanonicalNode {
  if (isLegacySlotTag(element.type)) {
    const props = element.props as Partial<{ name: string }>;
    const slotName = props.name ?? element.slot_name ?? undefined ?? "content";
    return {
      // slot frame id 는 segment-only (resolver path traverse 와 정합).
      id: segId(element.id, idSegmentMap),
      type: "frame",
      placeholder: true,
      slot: [], // 추천 reusable IDs 미지정 (P3 UI에서 입력 예정)
      name: slotName,
      props: { ...element.props },
      metadata: {
        type: "legacy-slot-hoisted",
        slotName,
      },
      children: [],
    } as CanonicalNode;
  }

  const childElements = allElements
    .filter((e) => e.parent_id === element.id)
    .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0));

  return {
    id: idSegmentMap.get(element.id) ?? element.id,
    type: tagToType(element.type),
    name: element.componentName,
    props: { ...element.props },
    children: childElements.map((c) =>
      convertElementWithSlotHoisting(c, allElements, idSegmentMap),
    ),
    metadata: buildLegacyElementMetadata(element),
    ...buildCompositionExtensionField(element),
  };
}

// ─────────────────────────────────────────────
// Public bidirectional adapters (P3-A foundation)
// ─────────────────────────────────────────────

/**
 * Legacy Layout 객체 → Canonical FrameNode (reusable: true) 변환.
 * P3-A foundation 단계 read-through adapter.
 *
 * `convertLayoutToReusableFrame` 의 public wrapper — 기존 로직 재활용.
 * index.ts의 `hoistLayoutAsReusableFrame` export alias 에서 사용.
 *
 * @param layout - Legacy Layout 레코드
 * @param layoutElements - 해당 layout_id로 필터링된 Element 배열 (호출자 책임)
 */
export function legacyLayoutToCanonicalFrame(
  layout: Layout,
  layoutElements: Element[],
): FrameNode {
  return convertLayoutToReusableFrame(layout, layoutElements) as FrameNode;
}

/**
 * Canonical FrameNode (reusable: true) → Legacy Layout 객체 역변환.
 * P3-B/C/D 단계에서 store/UI 가 canonical → legacy 호환 surface 로 사용.
 * 데이터 손실 없는 round-trip 보장.
 *
 * 변환 정책:
 * - `node.id` → layout.id (`"layout-"` prefix 제거)
 * - `node.metadata.layoutId` 우선 사용 (legacy id 보존)
 * - `node.metadata.slug` → layout.slug
 * - `node.metadata.componentName` → (무시 — layout.name 우선)
 * - descendants 없음 → elements: [] (P3-D descendants 역변환은 별도 phase)
 *
 * @param node - canonical reusable FrameNode
 */
export function canonicalFrameToLegacyLayout(node: FrameNode): {
  layout: Layout;
  elements: Element[];
} {
  const meta = node.metadata as
    | { type: string; layoutId?: string; slug?: string; [k: string]: unknown }
    | undefined;

  // legacy layout.id: metadata.layoutId 우선, 없으면 node.id의 "layout-" prefix 제거
  const rawId = meta?.layoutId ?? node.id;
  const layoutId = rawId.startsWith("layout-") ? rawId.slice(7) : rawId;

  const layout: Layout = {
    id: layoutId,
    name: node.name ?? layoutId,
    project_id: (meta?.project_id as string | undefined) ?? "",
    description: (meta?.description as string | undefined) ?? undefined,
    slug: meta?.slug ?? undefined,
    order_num: (meta?.order_num as number | undefined) ?? undefined,
  };

  // P3-D 이전 단계에서는 descendants 역변환 미지원 — empty array 반환.
  // P3-D legacyOwnershipToCanonicalParent() 구현 시 역변환 추가 예정.
  return { layout, elements: [] };
}
