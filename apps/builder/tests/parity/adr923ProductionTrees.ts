/**
 * ADR-923 round 29 (r29m1) — **production 생성 형태**의 트리 (인벤토리 테스트의 입력 SSOT).
 *
 * 입력 집합은 수동 creator 목록이 아니라 **팔레트 (`getPaletteItems`) × creation facet
 * (`resolveComponentEntryRuntime(type).creation.mode`)** 에서 파생한다 — `useElementCreator` 의
 * palette-add 가 같은 두 SSOT 를 같은 우선순위 (reusableOrigin > complex > none) 로 소비한다.
 *
 * - `reusableOrigin` (Toolbar · Form · IconButton · InlineAlert · Card): `useElementCreator` 와 같은
 *   형태의 `type:"ref"` instance. leaf 로 흉내내면 origin 트리 (Card > CardPreview/CardHeader/… ·
 *   Form > FormField …) 가 통째로 빠진다 (round 29 판독).
 * - `complex`: production 진입점 `ComponentFactory.createComplexComponent`. store 기록
 *   (`addElementsToStore`) 만 호출측 테스트가 `vi.mock` 으로 stub 한다 — 트리 형태는 그대로.
 * - `none`: `getDefaultProps(type)` 단일 요소 (`useElementCreator` else 분기).
 *
 * 세 arm 전부 production 과 같이 **origin 이 seed 된 문서 위에서 ref 를 해석**한다: origin 시드는
 * hydration 진입점 `normalizeMainDocument` (ListBox · GridList · Menu 템플릿 origin + reusable 5) 그대로,
 * 해석은 `resolveCanonicalRefTree` (canonicalSceneModel `resolveSceneGraph` 와 같은 호출). complex 트리도
 * 이 단계를 지난다 — ListBox/GridList factory 의 parent 는 `type:"ref"` (origin 참조) 라 해석 전에는
 * production 형태가 아니다.
 *
 * 호출측 계약: `vi.mock("@/builder/factories/utils/elementCreation", …)` 로 `addElementsToStore`
 * 를 no-op 으로 두고, `useStore.setState({ elements: [] })` 로 customId 생성 입력을 비운다.
 */
import type { CompositionDocument } from "@composition/shared";
import { ComponentFactory } from "@/builder/factories/ComponentFactory";
import { resolveComponentEntryRuntime } from "@/builder/factories/entryUniverse";
import { getPaletteItems } from "@/builder/panels/components/paletteItems";
import { getReusableCompositeOriginId } from "@/builder/components/reusableCompositeOrigins";
import { normalizeMainDocument } from "@/adapters/canonical/mainDocumentNormalization";
import { canonicalDocumentToElements } from "@/builder/stores/canonical/canonicalElementsView";
import { resolveCanonicalRefTree } from "@/builder/utils/canonicalRefResolution";
import {
  COMPONENT_MASTER_ID_MIRROR_FIELD,
  COMPONENT_ROLE_MIRROR_FIELD,
} from "@/adapters/canonical/componentSemanticsMirror";
import { getDefaultProps } from "@/types/builder/unified.types";
import type { Element } from "@/types/core/store.types";

export type CreationArm = "palette:ref" | "palette:complex" | "palette:none";

export interface ProductionTree {
  /** `${arm} ${type}` — ratchet 키의 접두사 (arm 이 바뀌면 키가 바뀐다 = 손실 없는 키) */
  name: string;
  arm: CreationArm;
  type: string;
  root: Element;
  /** root 포함, parent_id 로 연결된 전체 서브트리 */
  elements: Element[];
}

export function emptyDocument(): CompositionDocument {
  return { version: "composition-1.0", children: [] };
}

/** 팔레트 type → creation facet mode (production SSOT 두 개의 파생). */
export function paletteCreationFacets(): Record<
  string,
  "reusableOrigin" | "complex" | "none"
> {
  const out: Record<string, "reusableOrigin" | "complex" | "none"> = {};
  for (const item of getPaletteItems()) {
    out[item.type] = resolveComponentEntryRuntime(item.type).creation.mode;
  }
  return out;
}

let originElementsCache: Element[] | null = null;

/**
 * production hydration 과 같은 origin seed (`normalizeMainDocument`: ListBox · GridList · Menu 템플릿
 * origin + reusable composite 5) 를 빈 문서에 적용한 legacy Element 목록 — 1회 캐시.
 */
export function seededOriginElements(): Element[] {
  if (originElementsCache) return originElementsCache;
  const doc = normalizeMainDocument(emptyDocument());
  originElementsCache = canonicalDocumentToElements(doc);
  return originElementsCache;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** `useElementCreator` reusable 분기와 같은 형태의 ref instance. */
export function createRefInstance(
  type: string,
  pageId: string,
  parentId: string | null = null,
): Element {
  const originId = getReusableCompositeOriginId(type);
  if (!originId) throw new Error(`${type}: reusable origin 없음`);
  return {
    id: `ref-${type.toLowerCase()}-${pageId}`,
    type: "ref",
    ref: originId,
    [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
    [COMPONENT_MASTER_ID_MIRROR_FIELD]: originId,
    customId: `${type.toLowerCase()}_1`,
    componentName: type,
    props: {},
    page_id: pageId,
    parent_id: parentId,
    created_at: nowIso(),
    updated_at: nowIso(),
  } as unknown as Element;
}

/**
 * 트리 (root + 자손) 를 seed 된 origin 요소와 함께 production 해석기 `resolveCanonicalRefTree` 에
 * 통과시켜 root 서브트리 (resolved root + synthetic 자손) 를 돌려준다. origin 요소 자체 (Components
 * 페이지) 는 결과에 포함하지 않는다. ref 가 없는 트리는 그대로 통과한다.
 */
export function resolveProductionSubtree(
  rootId: string,
  elements: Element[],
): { root: Element; elements: Element[] } {
  const all = [...elements, ...seededOriginElements()];
  const elementsMap = new Map(all.map((el) => [el.id, el] as const));
  const resolved = resolveCanonicalRefTree({
    elements: all,
    elementsMap,
  });
  const root = resolved.elementsMap.get(rootId);
  if (!root) throw new Error(`${rootId}: resolved root 없음`);
  const out: Element[] = [root];
  const queue = [root.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    for (const child of resolved.childrenMap.get(id) ?? []) {
      out.push(child);
      queue.push(child.id);
    }
  }
  return { root, elements: out };
}

async function complexTree(
  type: string,
  pageId: string,
): Promise<ProductionTree> {
  const result = await ComponentFactory.createComplexComponent(
    type,
    null,
    pageId,
    [],
    null,
    emptyDocument(),
  );
  const { root, elements } = resolveProductionSubtree(result.parent.id, [
    result.parent,
    ...result.children,
  ]);
  return {
    name: `palette:complex ${type}`,
    arm: "palette:complex",
    type,
    root,
    elements,
  };
}

function simpleTree(type: string, pageId: string): ProductionTree {
  const root = {
    id: `simple-${type.toLowerCase()}-${pageId}`,
    type,
    customId: `${type.toLowerCase()}_1`,
    props: getDefaultProps(type),
    page_id: pageId,
    parent_id: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  } as unknown as Element;
  return {
    name: `palette:none ${type}`,
    arm: "palette:none",
    type,
    root,
    elements: [root],
  };
}

function refTree(type: string, pageId: string): ProductionTree {
  const instance = createRefInstance(type, pageId);
  const { root, elements } = resolveProductionSubtree(instance.id, [instance]);
  return {
    name: `palette:ref ${type}`,
    arm: "palette:ref",
    type,
    root,
    elements,
  };
}

/** 팔레트 type 하나를 production 생성 형태로. */
export async function paletteCreationTree(
  type: string,
  pageId: string,
): Promise<ProductionTree> {
  const mode = resolveComponentEntryRuntime(type).creation.mode;
  if (mode === "reusableOrigin") return refTree(type, pageId);
  if (mode === "complex") return complexTree(type, pageId);
  return simpleTree(type, pageId);
}

/** 팔레트 전수 (표시 순서 그대로). */
export async function allPaletteCreationTrees(
  pageIdPrefix: string,
): Promise<ProductionTree[]> {
  const trees: ProductionTree[] = [];
  let i = 0;
  for (const item of getPaletteItems()) {
    trees.push(await paletteCreationTree(item.type, `${pageIdPrefix}-${i++}`));
  }
  return trees;
}

// ── production 진입점 layout 실행 (wasm 경계 batch + 결과 box) ──
import { vi } from "vitest";
import {
  calculateFullTreeLayout,
  resetPersistentTree,
} from "@/builder/workspace/canvas/layout/engines/fullTreeLayout";
import { PersistentLayoutTree } from "@/builder/workspace/canvas/layout/engines/persistentLayoutTree";
import type { CanvasLayoutNode } from "@/builder/workspace/canvas/layout/layoutNode";
import type { ComputedLayout } from "@/builder/workspace/canvas/layout/engines/LayoutEngine";

export interface LayoutRun {
  /** elementId → 결과 box (calculateFullTreeLayout 반환) */
  layout: Map<string, ComputedLayout>;
  /** elementId → wasm 경계로 직렬화된 style (`PersistentLayoutTree.buildFull(batch)` 인자) */
  batch: Map<string, { type: string; style: Record<string, unknown> }>;
}

let runSeq = 0;

/**
 * 트리 (root + parent_id 로 연결된 자손) 를 production 진입점 `calculateFullTreeLayout` 으로 돌린다.
 * batch 는 `buildTreeBatch` JSON 사영 (elementId 소실) 한 단계 앞의 `buildFull(batch)` 인자에서 잡는다.
 */
export function layoutTree(
  rootId: string,
  elements: Element[],
  availW: number,
  availH: number,
  pageIdPrefix = "adr923-layout",
): LayoutRun {
  const pageId = `${pageIdPrefix}-${runSeq++}`;
  const elementsMap = new Map<string, CanvasLayoutNode>();
  const childrenMap = new Map<string, string[]>();
  for (const el of elements) {
    elementsMap.set(el.id, {
      ...el,
      page_id: el.id === rootId ? pageId : null,
    } as unknown as CanvasLayoutNode);
    childrenMap.set(el.id, []);
  }
  for (const el of elements) {
    if (el.parent_id && childrenMap.has(el.parent_id)) {
      childrenMap.get(el.parent_id)!.push(el.id);
    }
  }
  const getChild = (id: string): CanvasLayoutNode[] =>
    (childrenMap.get(id) ?? []).map((cid) => elementsMap.get(cid)!);
  const spy = vi.spyOn(PersistentLayoutTree.prototype, "buildFull");
  resetPersistentTree(pageId);
  try {
    const layout = calculateFullTreeLayout(
      rootId,
      elementsMap,
      childrenMap,
      availW,
      availH,
      getChild,
    );
    if (!layout) throw new Error(`${rootId}: calculateFullTreeLayout null`);
    const raw = spy.mock.calls.at(-1)?.[1];
    if (!raw) throw new Error(`${rootId}: buildFull 미호출`);
    const batch = new Map<
      string,
      { type: string; style: Record<string, unknown> }
    >();
    for (const n of raw) {
      batch.set(n.elementId, {
        type: elementsMap.get(n.elementId)?.type ?? n.elementId,
        style: n.style,
      });
    }
    return { layout, batch };
  } finally {
    spy.mockRestore();
    resetPersistentTree(pageId);
  }
}
