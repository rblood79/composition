/**
 * ADR-916 2-C 재평가 벤치 — scene dirty detection 성능 근거 확보.
 *
 * breakdown 2-C 는 `detectChangedIds` O(N) → generation counter + dirty
 * bitfield O(1) 을 주장한다. 본 벤치는 그 주장을 뒷받침할 실측이 없다는
 * 재평가 발견을 검증하기 위해, live scene 경로의 프레임당 재계산 비용을
 * 노드 규모별로 측정한다.
 *
 * 측정 대상 (매 store sync / 매 pan·zoom·layout 변경마다 실행되는 경로):
 *  1. detectChangedIds 로직 (Map 참조 비교 O(N)) — StoreRenderBridge private
 *     메서드의 순수 로직 재현 (동일 알고리즘, synthetic map 제외).
 *  2. buildSceneStructureSnapshot 전체 — depthMap / pageDataMap / pageFrames /
 *     projection signature. 이 중 createResolvedProjectionSignature 가 전체
 *     elements 를 stableSerialize + hashString 한다 (O(N) 직렬화).
 *
 * 실행: pnpm --filter builder vitest bench sceneDirtyDetection
 */
import { bench, describe } from "vitest";

import type { CanvasSceneNode } from "./canvasSceneNode";
import { buildSceneStructureSnapshot } from "./buildSceneSnapshot";
import type { BuildSceneStructureInput } from "./sceneSnapshotTypes";
import { createEmptyPageIndex } from "../../../stores/utils/elementIndexer";
import type { Page } from "../../../../types/core/store.types";

// ── fixture 생성 ────────────────────────────────────────────────────────────

const PAGE_ID = "page-1";

function makeNode(index: number, parentId: string | null): CanvasSceneNode {
  const id = `el-${index}`;
  return {
    id,
    type: index % 3 === 0 ? "Frame" : index % 3 === 1 ? "Button" : "TextField",
    props: {
      style: { display: "flex", width: "120px", height: "40px" },
      children: `Node ${index}`,
    },
    parentId,
    parent_id: parentId,
    pageId: PAGE_ID,
    page_id: PAGE_ID,
    layoutId: null,
    layout_id: null,
    // sourceNode 는 signature 직렬화 대상 아님 (createNodeProjectionSignature 는
    // id/type/props/parentId/pageId/layoutId/projection/ref/reusable/deleted 만
    // 참조). 최소 유효값으로 채운다.
    sourceNode: {
      id,
      type: "Frame",
    } as unknown as CanvasSceneNode["sourceNode"],
  };
}

/**
 * body 1개 + 나머지를 얕은 트리(body 직속 자식 위주 + 일부 2-depth)로 구성.
 * 실전 catalog 컨테이너 트리 규모를 근사.
 */
function makeScene(nodeCount: number): {
  elements: CanvasSceneNode[];
  elementsMap: Map<string, CanvasSceneNode>;
} {
  const elements: CanvasSceneNode[] = [];
  const body = makeNode(0, null);
  body.type = "Body";
  elements.push(body);

  for (let i = 1; i < nodeCount; i += 1) {
    // 4개마다 직전 노드를 부모로(2-depth 이상 유발), 그 외는 body 직속.
    const parentId = i % 4 === 0 && i > 1 ? `el-${i - 1}` : body.id;
    elements.push(makeNode(i, parentId));
  }

  const elementsMap = new Map(elements.map((el) => [el.id, el] as const));
  return { elements, elementsMap };
}

function makeInput(nodeCount: number): BuildSceneStructureInput {
  const { elements, elementsMap } = makeScene(nodeCount);

  const pageIndex = createEmptyPageIndex();
  for (const el of elements) {
    if (!pageIndex.elementsByPage.has(PAGE_ID)) {
      pageIndex.elementsByPage.set(PAGE_ID, new Set());
    }
    pageIndex.elementsByPage.get(PAGE_ID)!.add(el.id);
    if (el.parentId === null || el.type === "Body") {
      const roots = pageIndex.rootsByPage.get(PAGE_ID) ?? [];
      roots.push(el.id);
      pageIndex.rootsByPage.set(PAGE_ID, roots);
    }
  }

  const pages: Page[] = [{ id: PAGE_ID, title: "Page 1" } as Page];

  return {
    containerSize: { width: 1440, height: 900 },
    currentPageId: PAGE_ID,
    elements,
    elementsMap,
    layoutVersion: 1,
    pageHeight: 900,
    pageIndex,
    pagePositions: { [PAGE_ID]: { x: 0, y: 0 } },
    pagePositionsVersion: 1,
    pageWidth: 1440,
    pages,
    panOffset: { x: 0, y: 0 },
    source: "canonical",
    zoom: 1,
  };
}

/**
 * StoreRenderBridge.detectChangedIds 순수 로직 재현 (synthetic map 제외).
 * 참조 비교 O(N) — 프레임당 store sync 마다 실행되는 경로.
 */
function detectChangedIds(
  prev: Map<string, CanvasSceneNode>,
  next: Map<string, CanvasSceneNode>,
): Set<string> {
  const changed = new Set<string>();
  for (const [id, el] of next) {
    const p = prev.get(id);
    if (!p || p !== el) changed.add(id);
  }
  for (const id of prev.keys()) {
    if (!next.has(id)) changed.add(id);
  }
  return changed;
}

// ── 벤치 ────────────────────────────────────────────────────────────────────

for (const nodeCount of [500, 1000, 3000]) {
  describe(`scene dirty detection — ${nodeCount} nodes`, () => {
    const input = makeInput(nodeCount);
    const { elementsMap } = makeScene(nodeCount);

    // no-change 시나리오 (동일 참조 다수 + 1개 변경) — 실전 편집 1요소 갱신.
    const nextMap = new Map(elementsMap);
    const firstId = nextMap.keys().next().value as string;
    const changedNode = { ...nextMap.get(firstId)! };
    nextMap.set(firstId, changedNode);

    bench("detectChangedIds (Map 참조 비교 O(N))", () => {
      detectChangedIds(elementsMap, nextMap);
    });

    bench("buildSceneStructureSnapshot (전체 — signature 포함)", () => {
      buildSceneStructureSnapshot(input);
    });
  });
}
