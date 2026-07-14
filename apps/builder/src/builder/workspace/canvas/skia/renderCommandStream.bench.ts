/**
 * ADR-916 2-D 재평가 벤치 — render command stream + SpatialIndex 비용 분리 측정.
 *
 * breakdown 2-D 는 `renderCommands.ts` O(N) DFS + z-sort + boundsMap 생성 +
 * `syncSpatialIndex` 중복 패스를 Rust `commands.rs` 로 이관한다고 전제한다.
 * 본 벤치는 그 이관을 정당화하기 위해 **각 단계 비용을 분리 측정**한다
 * (2-C 교훈: 원안이 지목한 최적화 대상[detectChangedIds]이 실제 병목이
 *  아니었음 — 대상 확정 전 비용 분포 실측 필수).
 *
 * 측정 대상 (매 command stream 캐시 miss 프레임마다 실행되는 경로):
 *  1. buildRenderCommandStream 전체 — DFS + boundsMap + z-sort + syncSpatialIndex 통합 총비용.
 *  2. z-sort 기여분 — zIndex 있는 트리 vs 없는 트리의 build 차이로 분리.
 *  3. syncSpatialIndex 단독 — boundsMap 전체 재순회(items push) + batchUpdate(Float32Array + idMapper).
 *  4. commandChildrenMap 재구성 단독 — 캐시 히트 여부 무관 매 build 전 실행되는 Map 재구성 비용
 *     (skiaFramePipeline.ts:250-265 재현).
 *
 * 각 단계를 분리해 어느 것이 실제 프레임 예산(60fps=16.7ms)을 위협하는지,
 * Rust 이관 시 어느 단계가 가장 큰 정당화 근거를 갖는지 판정한다.
 *
 * 실행: apps/builder 에서
 *   pnpm exec vitest bench --run src/builder/workspace/canvas/skia/renderCommandStream.bench.ts
 */
import { bench, describe } from "vitest";

import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";
import type { SkiaNodeData } from "./nodeRenderers";
import { registerSkiaNode, clearSkiaRegistry } from "./useSkiaNode";
import { buildRenderCommandStream } from "./renderCommands";

// ── fixture ────────────────────────────────────────────────────────────────

const PAGE_ID = "body-root";

interface Fixture {
  rootIds: string[];
  childrenMap: Map<string, CanvasSceneNode[]>;
  layoutMap: Map<string, ComputedLayout>;
  pagePositions: Record<string, { x: number; y: number }>;
  /** syncSpatialIndex 재현용: build 로 산출된 boundsMap 형태의 items */
  nodeIds: string[];
}

function makeSceneNode(id: string, parentId: string | null): CanvasSceneNode {
  return {
    id,
    type: "Frame",
    props: {},
    parentId,
    parent_id: parentId,
    pageId: PAGE_ID,
    page_id: PAGE_ID,
    layoutId: null,
    sourceNode: {
      id,
      type: "Frame",
    } as unknown as CanvasSceneNode["sourceNode"],
  } as unknown as CanvasSceneNode;
}

function makeSkiaData(
  id: string,
  withZIndex: boolean,
  i: number,
): SkiaNodeData {
  return {
    type: "box",
    elementId: id,
    x: 0,
    y: 0,
    width: 120,
    height: 40,
    visible: true,
    // zIndex 있으면 sortChildElementsByZIndex 가 map+sort 경로 진입
    ...(withZIndex ? { zIndex: (i % 5) - 2 } : {}),
    box: {
      fillColor: new Float32Array([0.5, 0.5, 0.5, 1]),
      borderRadius: 0,
    },
  } as SkiaNodeData;
}

/**
 * width×depth 균형 트리 생성.
 * - 각 컨테이너가 `fanout` 자식을 가지도록 재귀 확장, 총 노드 ~target 까지.
 * - skiaNodeRegistry 에 실제 등록 (getSkiaNode 조회 경로 정확 모사).
 * - layoutMap 에 부모-상대 좌표 주입 (visitElement 의 layout 조회 경로 모사).
 */
function buildFixture(target: number, withZIndex: boolean): Fixture {
  clearSkiaRegistry();
  const childrenMap = new Map<string, CanvasSceneNode[]>();
  const layoutMap = new Map<string, ComputedLayout>();
  const nodeIds: string[] = [];
  const fanout = 5;

  let counter = 0;
  const rootId = `${PAGE_ID}`;
  registerSkiaNode(rootId, makeSkiaData(rootId, withZIndex, 0));
  layoutMap.set(rootId, {
    x: 0,
    y: 0,
    width: 1200,
    height: 3000,
    elementId: rootId,
  });
  nodeIds.push(rootId);

  // BFS 확장으로 균형 트리 구성
  const queue: string[] = [rootId];
  while (queue.length > 0 && counter < target) {
    const parent = queue.shift()!;
    const children: CanvasSceneNode[] = [];
    for (let f = 0; f < fanout && counter < target; f++) {
      counter++;
      const id = `el-${counter}`;
      const node = makeSceneNode(id, parent);
      children.push(node);
      registerSkiaNode(id, makeSkiaData(id, withZIndex, counter));
      layoutMap.set(id, {
        x: (f % 3) * 130,
        y: Math.floor(f / 3) * 50,
        width: 120,
        height: 40,
        elementId: id,
      });
      nodeIds.push(id);
      queue.push(id);
    }
    childrenMap.set(parent, children);
  }

  return {
    rootIds: [rootId],
    childrenMap,
    layoutMap,
    pagePositions: { [rootId]: { x: 0, y: 0 } },
    nodeIds,
  };
}

/**
 * syncSpatialIndex 의 순수 JS 부분(WASM 제외)을 재현.
 * 실제 함수는 private + WASM_FLAGS.SPATIAL_INDEX 게이트 + spatialIndex.batchUpdate
 * (WASM 미초기화 시 early-return). 벤치는 WASM 없는 node 환경이므로 batchUpdate
 * 내부 WASM 호출은 no-op 이 되지만, **JS 측 재직렬화 비용**(items push +
 * Float32Array 채우기 + idMapper 변환)이 이관 대상의 핵심이므로 그 부분만 재현한다.
 */
function replaySyncSpatialIndexJsCost(
  boundsMap: Map<
    string,
    { x: number; y: number; width: number; height: number }
  >,
): number {
  // (1) syncSpatialIndex: boundsMap 전체 순회 → items 배열
  const items: Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }> = [];
  for (const [id, bounds] of boundsMap) {
    if (bounds.width > 0 && bounds.height > 0) {
      items.push({
        id,
        x: bounds.x,
        y: bounds.y,
        w: bounds.width,
        h: bounds.height,
      });
    }
  }
  // (2) batchUpdate: items 전체 순회 → Float32Array (idMapper 는 여기선 Map 조회 근사)
  const idMap = new Map<string, number>();
  let nextNumId = 1;
  const data = new Float32Array(items.length * 5);
  for (let i = 0; i < items.length; i++) {
    const el = items[i];
    let numId = idMap.get(el.id);
    if (numId === undefined) {
      numId = nextNumId++;
      idMap.set(el.id, numId);
    }
    const offset = i * 5;
    data[offset] = numId;
    data[offset + 1] = el.x;
    data[offset + 2] = el.y;
    data[offset + 3] = el.w;
    data[offset + 4] = el.h;
  }
  return data.length;
}

/**
 * commandChildrenMap 재구성 (skiaFramePipeline.ts:250-265) 재현.
 * filteredChildrenMap(childIds) → renderNodesMap 조회 → 새 Map<parentId, CanvasSceneNode[]>.
 * 벤치는 childrenMap 이 이미 CanvasSceneNode[] 이므로, childIds 배열을 순회하며
 * renderNodesMap(=id→node) 조회로 새 배열 재구성하는 동형 비용을 측정한다.
 */
function replayChildrenMapRebuild(
  childrenMap: Map<string, CanvasSceneNode[]>,
  renderNodesMap: Map<string, CanvasSceneNode>,
): number {
  const out = new Map<string, CanvasSceneNode[]>();
  for (const [parentId, children] of childrenMap) {
    const rebuilt: CanvasSceneNode[] = [];
    for (const child of children) {
      const el = renderNodesMap.get(child.id);
      if (el) rebuilt.push(el);
    }
    out.set(parentId, rebuilt);
  }
  return out.size;
}

// ── 벤치 ─────────────────────────────────────────────────────────────────────

const SIZES = [500, 1000, 3000];

for (const size of SIZES) {
  describe(`ADR-916 2-D — command stream 비용 분리 (${size} 노드)`, () => {
    // fixture 는 registry 를 mutate 하므로 describe 별 1회 준비 후 재사용.
    // z-sort 분리를 위해 zIndex 유/무 두 fixture 를 유지.
    const fxNoZ = buildFixture(size, false);
    // withZIndex fixture 는 registry 를 덮어쓰므로, build 시점에 다시 세팅 필요.
    // → 각 bench 의 setup 에서 해당 fixture 의 registry 를 복원한다.

    const renderNodesMap = new Map<string, CanvasSceneNode>();
    for (const [, children] of fxNoZ.childrenMap) {
      for (const c of children) renderNodesMap.set(c.id, c);
    }

    // boundsMap 은 build 산출물 — syncSpatialIndex 재현 입력. 1회 build 로 확보.
    restoreRegistry(fxNoZ, false);
    const streamForBounds = buildRenderCommandStream(
      fxNoZ.rootIds,
      fxNoZ.childrenMap,
      fxNoZ.layoutMap,
      fxNoZ.pagePositions,
    );
    const boundsMap = streamForBounds.boundsMap;

    bench("① buildRenderCommandStream 전체 (zIndex 없음)", () => {
      restoreRegistry(fxNoZ, false);
      buildRenderCommandStream(
        fxNoZ.rootIds,
        fxNoZ.childrenMap,
        fxNoZ.layoutMap,
        fxNoZ.pagePositions,
      );
    });

    bench(
      "② buildRenderCommandStream 전체 (zIndex 있음 — z-sort 경로 활성)",
      () => {
        restoreRegistry(fxNoZ, true);
        buildRenderCommandStream(
          fxNoZ.rootIds,
          fxNoZ.childrenMap,
          fxNoZ.layoutMap,
          fxNoZ.pagePositions,
        );
      },
    );

    bench("③ syncSpatialIndex JS 재직렬화 단독 (items + Float32Array)", () => {
      replaySyncSpatialIndexJsCost(boundsMap);
    });

    bench("④ commandChildrenMap 재구성 단독", () => {
      replayChildrenMapRebuild(fxNoZ.childrenMap, renderNodesMap);
    });
  });
}

/** fixture 의 skia registry 를 지정 zIndex 모드로 복원 (bench 반복마다 동일 조건). */
function restoreRegistry(fx: Fixture, withZIndex: boolean): void {
  clearSkiaRegistry();
  for (let i = 0; i < fx.nodeIds.length; i++) {
    const id = fx.nodeIds[i];
    registerSkiaNode(id, makeSkiaData(id, withZIndex, i));
  }
}
