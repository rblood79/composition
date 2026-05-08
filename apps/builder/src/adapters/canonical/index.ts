/**
 * @fileoverview Legacy → Canonical Document Adapter — ADR-903 P1.
 *
 * read-through 변환:
 *   elements[] + pages[] + layouts[] → CompositionDocument (canonical doc tree)
 *
 * 변환 책임 분담:
 *  - type → type rename: tagRename.ts (Stream 1 본 모듈)
 *  - componentRole/masterId/overrides/descendants → reusable/ref:
 *      componentRoleAdapter.ts (Stream 2)
 *  - type="Slot" + slot_name + Page.layout_id → slot 메타 + descendants[path].children + page ref:
 *      slotAndLayoutAdapter.ts (Stream 3)
 *  - parent_id/source array order → tree order: 본 파일 buildTree() 함수
 *
 * 저장 포맷 미변경 (Phase 5에서 전환). Phase 2 resolver는 본 adapter 결과만 소비.
 *
 * **P3-A 신규 surface** (foundation phase):
 *  - `selectCanonicalReusableFrames` — reusable frame 목록 추출
 *  - `createReusableFrameNode` — reusable FrameNode 생성 factory
 *  - `CanonicalPageRef` — page 노드 canonical 표현 타입
 *  - `extractSlotMetaFromNode` — FrameNode slot schema → SlotMeta[]
 *  - `hoistLayoutAsReusableFrame` — legacy Layout → FrameNode (alias)
 *  - `SlotMeta` — slot 메타 타입 (shared 미수록 → 본 파일 정의)
 */

import type {
  CanonicalNode,
  CompositionDocument,
  CompositionExtension,
  FrameNode,
  RefNode,
  SerializedDataBinding,
  SerializedEventHandler,
} from "@composition/shared";
import type { Element } from "@/types/builder/unified.types";
import type { Layout } from "@/types/builder/layout.types";
import type {
  ConvertComponentRoleFn,
  ConvertPageLayoutFn,
  LegacyAdapterInput,
} from "./types";
import { isLegacySlotTag, tagToType } from "./tagRename";
import { buildIdPathContext, segId } from "./idPath";
import { buildLegacyElementMetadata } from "./legacyMetadata";
import {
  convertLayoutToReusableFrame,
  buildSlotPathMap,
  legacyLayoutToCanonicalFrame,
} from "./slotAndLayoutAdapter";
import { getCanonicalSlotDeclaration } from "./slotDeclaration";
import {
  snapshotThemesFromConfig,
  type ThemeConfigInput,
} from "./themesAdapter";
import { sortElementsBySource } from "../../builder/utils/elementOrdering";

// ADR-110 Phase 2 ts-3.1: applyCanonicalThemes re-export (BuilderCore entry 용)
export { applyCanonicalThemes } from "./themesAdapter";
export type { ThemeConfigSetters } from "./themesAdapter";

// ADR-110 Phase 2 ts-3.2: resolveCanonicalVariable re-export (consumer 용)
export { resolveCanonicalVariable } from "./variablesAdapter";
import {
  snapshotVariablesFromTokens,
  type ResolvedTokenMap,
} from "./variablesAdapter";
import { isComponentOriginMirrorElement } from "./componentSemanticsMirror";

// ─────────────────────────────────────────────
// P3-A 신규 타입 surface
// ─────────────────────────────────────────────

/**
 * Slot 메타 정보 — FrameNode.slot 속성에서 추출.
 *
 * `@composition/shared` 에 미수록 → P3-A 단계에서 본 파일에 정의.
 * 추후 shared 패키지로 이동 예정 (ADR-903 P3-C NodesPanel UI 연동 시).
 */
export interface SlotMeta {
  name: string;
  required: boolean;
  description?: string;
}

/**
 * Page 노드의 canonical 표현 (결정 P3-1 옵션 C).
 *
 * - layout 있는 page → `RefNode` + `descendants` (slot children 포함)
 * - 독립 page (layout 없음) → `FrameNode` + `metadata.type: "page"`
 *
 * 본 타입은 layout 있는 page의 RefNode에 page 메타 필드를 명시적으로 확장한다.
 * `metadata.type: "page"` 는 독립 page FrameNode 를 판별하는 discriminator.
 */
export type CanonicalPageRef = RefNode & {
  descendants?: Record<
    string,
    { children?: CanonicalNode[]; [key: string]: unknown }
  >;
  metadata?: {
    type: "page" | "legacy-page";
    slug?: string;
    pageId?: string;
    layoutId?: string;
    [key: string]: unknown;
  };
};

export interface LegacyAdapterDeps {
  convertComponentRole: ConvertComponentRoleFn;
  convertPageLayout: ConvertPageLayoutFn;
  /**
   * ADR-110 Phase 1 — themes read-only snapshot 주입 (선택).
   *
   * 전달 시: `doc.themes = snapshotThemesFromConfig(getThemeConfig())` 주입.
   * 미전달 시: `doc.themes = undefined` (BC — 기존 동작 유지).
   */
  getThemeConfig?: () => ThemeConfigInput;
  /**
   * ADR-110 Phase 1 — variables read-only snapshot 주입 (선택).
   *
   * 전달 시: `doc.variables = snapshotVariablesFromTokens(getVariables())` 주입.
   * 미전달 시: `doc.variables = undefined` (BC — 기존 동작 유지).
   */
  getVariables?: () => ResolvedTokenMap;
}

export function legacyToCanonical(
  input: LegacyAdapterInput,
  deps: LegacyAdapterDeps,
): CompositionDocument {
  const { elements, pages, layouts } = input;
  const {
    convertComponentRole,
    convertPageLayout,
    getThemeConfig,
    getVariables,
  } = deps;

  // 1. id path 컨텍스트 구축 (UUID → stable path remap)
  const idPathCtx = buildIdPathContext(elements);

  // 2. element → CanonicalNode 변환 (tree traversal)
  const childrenByParent = indexChildrenByParent(elements);

  function buildNode(element: Element): CanonicalNode {
    const baseType = tagToType(element.type);

    // componentRole 분기: master → reusable / instance → ref
    const roleResult = convertComponentRole(element, {
      idPathMap: idPathCtx.idPathMap,
    });

    // 자식 노드 (재귀)
    const childElements = childrenByParent.get(element.id) ?? [];
    childElements.splice(
      0,
      childElements.length,
      ...sortElementsBySource(childElements),
    );
    const canonicalChildren = childElements.map(buildNode);

    // Slot type 특수 처리: container의 slot 메타로 변환되어야 하지만,
    // standalone Slot element는 부모 컨테이너 slot 메타로 흡수되어야 한다.
    // P1 단계에서는 Slot element를 일반 frame으로 변환 + metadata 보존.
    // (실제 흡수는 Stream 3이 page composition 단계에서 처리)
    if (isLegacySlotTag(element.type)) {
      const slotName =
        (element.props.name as string | undefined) ?? element.slot_name ?? null;
      return {
        id: segId(element.id, idPathCtx.idSegmentMap),
        type: "frame",
        name: element.componentName,
        props: { ...element.props },
        metadata: {
          type: "legacy-slot",
          slot_name: element.slot_name,
          ...(slotName ? { slotName } : {}),
        },
        children: canonicalChildren,
      };
    }

    const nodeProps = roleResult.ref
      ? (roleResult.rootOverrides?.props ?? {})
      : { ...element.props };

    const node: CanonicalNode = {
      id: segId(element.id, idPathCtx.idSegmentMap),
      type: roleResult.ref ? "ref" : baseType,
      name: element.componentName,
      props: nodeProps,
      ...(roleResult.reusable ? { reusable: true } : {}),
      ...(roleResult.ref
        ? ({
            ref: roleResult.ref,
            ...(roleResult.descendantsRemapped
              ? { descendants: roleResult.descendantsRemapped }
              : {}),
          } satisfies Partial<RefNode>)
        : {}),
      children: canonicalChildren,
      ...getCanonicalSlotDeclaration(element),
      // legacy Element.props + top-level fields 를 metadata 로 보존 (ADR-111).
      // adapter/export quarantine 전용 payload이며 runtime props source 가 아니다.
      metadata: buildLegacyElementMetadata(element),
      // ADR-116 Phase 5 G7 본격 cutover (2026-05-01): events/dataBinding 을
      // `x-composition` namespaced extension 으로 분리. extension 이 단일 SSOT.
      // exportLegacyDocument 와 canonicalNodeToElement 는 extension 에서 복원.
      ...buildCompositionExtensionField(element),
    };

    return node;
  }

  // 3. Page 단위 ref 인스턴스 변환 (Stream 3).
  // layout 별 slotPathMap (slot name → stable id path) 사전 계산.
  // resolver mode C 매칭은 stable id path 기준 (P2 contract).
  const layoutSlotPathMaps = new Map<string, Map<string, string>>();
  for (const layout of layouts) {
    const layoutElements = elements.filter((e) => e.layout_id === layout.id);
    const layoutIdPathMap = buildIdPathContext(layoutElements).idPathMap;
    layoutSlotPathMaps.set(
      layout.id,
      buildSlotPathMap(layoutElements, layoutIdPathMap),
    );
  }

  const pageNodes: CanonicalNode[] = [];
  for (const page of pages) {
    const pageElements = elements.filter((e) => e.page_id === page.id);
    const slotPathMap = page.layout_id
      ? (layoutSlotPathMaps.get(page.layout_id) ?? new Map())
      : new Map();
    const pageRef = convertPageLayout(page, layouts, pageElements, slotPathMap);
    if (pageRef) {
      pageNodes.push(pageRef);
    } else {
      // layout_id 없는 page: pageElements를 그대로 root children으로 묶음
      const pageRootElements = sortElementsBySource(
        pageElements.filter((e) => e.parent_id == null),
        pageElements,
      );
      pageNodes.push({
        id: page.id,
        type: "frame",
        name: page.title,
        metadata: {
          type: "legacy-page",
          pageId: page.id,
          slug: page.slug,
          parent_id: page.parent_id ?? null,
        },
        children: pageRootElements.map(buildNode),
      });
    }
  }

  // 4. Reusable nodes (componentRole === "master") 추출 — top-level reusable로 승격
  // master elements는 buildNode에서 reusable: true가 세팅되며, ordering은
  // master 먼저 / page 먼저 정책: reusable masters를 앞에 배치하여 ref 해석 시
  // 선행 정의가 보장됨 (resolver가 순서 의존 없이도 동작해야 하지만, 직렬화
  // 가독성 + diff 안정성을 위해 masters first).
  const reusableMasters: CanonicalNode[] = elements
    .filter(isComponentOriginMirrorElement)
    .map(buildNode);

  // 5. Layout shells → canonical reusable FrameNodes.
  // page refs (Stream 3 convertPageLayout)가 ref: "layout-<id>"로 참조하므로
  // layout frames가 먼저 정의되어야 ref 해석 시 선행 정의 보장.
  const layoutFrames: CanonicalNode[] = layouts.map((layout) => {
    const layoutElements = elements.filter((e) => e.layout_id === layout.id);
    return convertLayoutToReusableFrame(layout, layoutElements);
  });

  // ADR-110 Phase 1: themes read-only snapshot 주입 (opt-in)
  // call-time 직렬화 — subscribe 기반 아님 (R4 대응: stale snapshot 방지)
  const themesSnapshot = getThemeConfig
    ? snapshotThemesFromConfig(getThemeConfig())
    : undefined;

  // ADR-110 Phase 1: variables read-only snapshot 주입 (opt-in)
  // call-time 직렬화 — subscribe 기반 아님 (R4 대응: stale snapshot 방지)
  const variablesSnapshot = getVariables
    ? snapshotVariablesFromTokens(getVariables())
    : undefined;

  return {
    version: "composition-1.0",
    ...(themesSnapshot !== undefined ? { themes: themesSnapshot } : {}),
    ...(variablesSnapshot !== undefined
      ? { variables: variablesSnapshot }
      : {}),
    children: [...layoutFrames, ...reusableMasters, ...pageNodes],
  };
}

/**
 * ADR-116 Phase 5 G7 본격 cutover (2026-05-01) — element.events / element.dataBinding
 * 가 정의된 경우 `x-composition` extension field 를 spread 가능한 partial 객체로
 * 반환. 양쪽 미정의 시 빈 객체 반환 (extension key 자체 노출 회피).
 *
 * **schema 가정** (`SerializedEventHandler` / `SerializedDataBinding` Phase 0
 * placeholder, Phase 5 G7 closure 시점에 schema 확정):
 * - `element.events` (legacy `unknown[]`) → `x-composition.events: SerializedEventHandler[]`
 *   로 cast (kind/actionRef 외 임의 키 허용 — `[k: string]: unknown`).
 * - `element.dataBinding` (legacy `DataBinding`) → `x-composition.dataBinding:
 *   SerializedDataBinding` 로 cast (type/source/config schema 그대로 호환).
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

function indexChildrenByParent(
  elements: Element[],
): Map<string | null, Element[]> {
  const map = new Map<string | null, Element[]>();
  for (const el of elements) {
    const parent = el.parent_id ?? null;
    const arr = map.get(parent) ?? [];
    arr.push(el);
    map.set(parent, arr);
  }
  return map;
}

// ─────────────────────────────────────────────
// P3-A 신규 surface functions
// ─────────────────────────────────────────────

/**
 * Canonical document tree 의 reusable frame 노드 추출.
 * P3-B Stores 해체 시 `layouts[]` 별도 store 대체 selector.
 *
 * @param doc - canonical CompositionDocument
 */
export function selectCanonicalReusableFrames(
  doc: CompositionDocument,
): FrameNode[] {
  return doc.children.filter(
    (n): n is FrameNode => n.type === "frame" && n.reusable === true,
  );
}

/**
 * Canonical FrameNode 신규 생성 (reusable: true).
 * 결정 P3-1 권고에 따라 layout shell 은 `frame + reusable: true`.
 *
 * @param name - 프레임 이름
 * @param children - 자식 노드 배열 (기본값: [])
 * @param slot - slot 선언 (`false` = slot 비활성화, `string[]` = 추천 reusable ID 목록)
 */
export function createReusableFrameNode(
  name: string,
  children: CanonicalNode[] = [],
  slot?: false | string[],
): FrameNode {
  return {
    id: crypto.randomUUID(),
    type: "frame",
    reusable: true,
    name,
    children,
    ...(slot !== undefined && { slot }),
  };
}

/**
 * FrameNode 의 slot schema 속성 추출 + 메타 정규화.
 * P3-C UI 재설계 시 NodesPanel slot 표시에 사용.
 *
 * - `frame.slot === false` 또는 미정의 → 빈 배열 반환
 * - `frame.slot: string[]` → 각 슬롯 이름을 `SlotMeta` 로 변환
 *
 * `required` 필드는 P3-C NodesPanel UI 에서 ADR-903 §3.8 추천 component ID 목록
 * 흡수 시점에 확장 예정. 현재는 모두 `false` (non-required).
 *
 * @param frame - canonical FrameNode
 */
export function extractSlotMetaFromNode(frame: FrameNode): SlotMeta[] {
  if (frame.slot === false || frame.slot === undefined) return [];
  return frame.slot.map((slotName) => ({
    name: slotName,
    required: false,
  }));
}

/**
 * Legacy Layout 을 canonical reusable FrameNode 로 hoist.
 * P3-B Stores 해체 시 `layouts[]` → canonical document children 변환에 사용.
 *
 * `legacyLayoutToCanonicalFrame` 의 export alias — 호출자 의미 명확화.
 *
 * @param legacyLayout - Legacy Layout 레코드
 * @param elements - 해당 layout_id로 필터링된 Element 배열 (호출자 책임)
 */
export function hoistLayoutAsReusableFrame(
  legacyLayout: Layout,
  elements: Element[],
): FrameNode {
  return legacyLayoutToCanonicalFrame(legacyLayout, elements);
}

/**
 * Legacy element ownership marker (`{ page_id, layout_id }`) → canonical 부모 노드 id 변환.
 *
 * P3-D 진입 시 factory ownership 제거 → 기존 IndexedDB 의 `layout_id` 기반 elements
 * 가 `getByLayout()` 소멸 후 읽기 불가 = 사용자 데이터 손실 위험. 본 함수가 변환
 * 어댑터로 동작하여 데이터 손실 방지.
 *
 * 변환 규칙:
 * - `{ page_id: <X>, layout_id: null }` → page node id `<X>` 반환
 * - `{ page_id: null, layout_id: <Y> }` → reusable frame node id `<Y>` 반환
 * - `{ page_id: null, layout_id: null }` → null (무소속 — orphan)
 * - 둘 다 non-null = invalid → null + dev warn
 *
 * Sub-Gate G3-A 의 `legacyOwnershipToCanonicalParent()` 구현 hard precondition.
 * P3-D 진입 전 이 함수가 존재하고 테스트 통과 상태임을 Gate 통과 조건으로 검증한다.
 *
 * @param ownership - Legacy element ownership marker
 * @param doc - Canonical document tree (parent lookup 용)
 * @returns Canonical parent node id 또는 null (orphan)
 */
export function legacyOwnershipToCanonicalParent(
  ownership: { page_id?: string | null; layout_id?: string | null },
  doc: CompositionDocument,
): string | null {
  const { page_id, layout_id } = ownership;

  // invalid: 둘 다 non-null
  if (page_id != null && layout_id != null) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[ADR-903 legacyOwnershipToCanonicalParent] invalid ownership — both page_id and layout_id non-null",
        ownership,
      );
    }
    return null;
  }

  // page 인스턴스 (ref or frame + metadata.type:"page" or "legacy-page")
  if (page_id != null) {
    const pageNode = doc.children.find((n) => n.id === page_id);
    return pageNode?.id ?? null;
  }

  // layout shell (frame + reusable: true)
  if (layout_id != null) {
    // layout shell id convention: "layout-<layout_id>"
    const conventionalId = `layout-${layout_id}`;
    const frameNode = doc.children.find(
      (n) =>
        n.type === "frame" &&
        n.reusable === true &&
        (n.id === conventionalId || n.id === layout_id),
    );
    return frameNode?.id ?? null;
  }

  // orphan
  return null;
}

/**
 * ADR-903 P3-E E-6 — legacy `layout_id` 만 알 때 canonical reusable frame node id 변환.
 *
 * `legacyOwnershipToCanonicalParent({ layout_id: ... }, doc)` 의 wrapper.
 * `utils/element/elementUtils.ts` 등 `lib/` + `utils/` 영역의 `layout_id` 매칭을
 * 0건으로 유지하기 위한 indirection (G3-E grep 정합 보장).
 *
 * @param layoutId - Legacy layout id
 * @param doc - Canonical CompositionDocument
 * @returns Canonical reusable frame node id 또는 null (frame 미존재)
 */
export function frameNodeIdForLegacyLayout(
  layoutId: string,
  doc: CompositionDocument,
): string | null {
  return legacyOwnershipToCanonicalParent({ layout_id: layoutId }, doc);
}

/**
 * ADR-903 P3-D-5 step 3 — Legacy ownership 비교 helper (canonical-aware indirection).
 *
 * **Why**: drag drop / element filter 등 다수 caller 가 `el.layout_id === otherLayoutId`
 * 또는 `a.layout_id === b.layout_id && a.page_id === b.page_id` 패턴 사용.
 * P3-D-5 의 단계적 canonical 전환을 위해 단일 진입점으로 추출.
 *
 * **현재 단계 (step 3)**: doc parameter 추가했으나 logic 은 legacy fallback 우선.
 * 다음 단계 (step 4) 에서 doc 활용 canonical lookup 을 본 함수 내부에 추가하면
 * 모든 caller 자동 적용.
 *
 * @param a - element 1 (page_id + layout_id 있음)
 * @param b - element 2 (page_id + layout_id 있음)
 * @param doc - Canonical document (optional, step 4 에서 활용)
 * @returns 같은 ownership 이면 true
 */
export function sameLegacyOwnership(
  a: { page_id?: string | null; layout_id?: string | null },
  b: { page_id?: string | null; layout_id?: string | null },
  doc?: CompositionDocument | null,
): boolean {
  // ADR-903 P3-D-5 step 5c: doc 활용 시 canonical parent ID 비교
  if (doc) {
    const parentA = legacyOwnershipToCanonicalParent(a, doc);
    const parentB = legacyOwnershipToCanonicalParent(b, doc);
    return parentA === parentB;
  }
  // legacy fallback (doc 없거나 caller 미주입)
  return a.page_id === b.page_id && a.layout_id === b.layout_id;
}

/**
 * ADR-903 P3-D-5 step 3 — Layout membership helper (canonical-aware indirection).
 *
 * **Why**: BuilderCore 등에서 `el.layout_id === currentLayoutId` 패턴 사용.
 * 단일 진입점 추출 — 다음 단계에서 doc 활용 canonical lookup 으로 전환.
 *
 * @param el - element (layout_id 있음)
 * @param layoutId - 비교 대상 layout id
 * @param doc - Canonical document (optional, step 4 에서 활용)
 * @returns el 이 해당 layout 에 속하면 true
 */
/**
 * ADR-903 P3-D-5 step 5c — canonical document tree 의 descendants 순회 (DFS).
 * targetId 가 root 자신 또는 root 의 자손이면 true.
 */
function isCanonicalDescendantOf(
  targetId: string,
  root: CanonicalNode,
): boolean {
  if (root.id === targetId) return true;
  if (!root.children) return false;
  for (const child of root.children) {
    if (isCanonicalDescendantOf(targetId, child)) return true;
  }
  return false;
}

export function belongsToLegacyLayout(
  el: { id?: string; layout_id?: string | null },
  layoutId: string | null | undefined,
  doc?: CompositionDocument | null,
): boolean {
  if (!layoutId) return false;
  // ADR-903 P3-D-5 step 5c: doc 활용 시 layout frame descendants 확인
  if (doc && el.id) {
    const layoutFrameId = legacyOwnershipToCanonicalParent(
      { page_id: null, layout_id: layoutId },
      doc,
    );
    if (!layoutFrameId) return false;
    const layoutFrame = doc.children.find((n) => n.id === layoutFrameId);
    if (!layoutFrame) return false;
    return isCanonicalDescendantOf(el.id, layoutFrame);
  }
  // legacy fallback (doc 없거나 el.id 없음)
  return el.layout_id === layoutId;
}

/**
 * ADR-903 P3-D-5 step 5 — Page 의 layout 식별 helper (canonical-aware).
 *
 * **Why**: workflowEdges.computeLayoutGroups 등에서 `page.layout_id` 직접 참조.
 * doc 전달 시 canonical reusable frame 의 후손인 page 식별 → layout id 반환.
 *
 * @param page - page 객체 (id + layout_id)
 * @param doc - Canonical document (optional, step 5d 에서 활성화)
 * @returns layout id 또는 null
 */
export function getLegacyPageLayoutId(
  page: { id?: string; layout_id?: string | null },
  doc?: CompositionDocument | null,
): string | null {
  // ADR-903 P3-D-5 step 5d: doc 활용 시 canonical reusable frame descendants 검색
  if (doc && page.id) {
    for (const node of doc.children) {
      if (node.type !== "frame" || !node.reusable) continue;
      if (isCanonicalDescendantOf(page.id, node)) {
        // layout id 추출 — frame.id convention "layout-<layoutId>" 또는 그대로
        return node.id.startsWith("layout-")
          ? node.id.slice("layout-".length)
          : node.id;
      }
    }
    // canonical 에서 layout binding 못 찾음 → legacy fallback
  }
  return page.layout_id ?? null;
}
