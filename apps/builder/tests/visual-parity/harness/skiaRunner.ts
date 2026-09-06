/**
 * ADR-198 Phase 1 — Skia leg 러너 (test-only)
 *
 * `productionLeg.browser.test.ts` 에 있던 체인을 그대로 옮겨온 것이다. 옮긴 이유는
 * 하나 — Phase 1 의 identity 테스트가 케이스 3개에 대해 같은 체인을 돌려야 하는데,
 * 테스트 파일 안에 갇혀 있으면 두 번째 소비자가 체인을 복제하게 되고 그 순간
 * "테스트 전용 Skia 경로" 가 생겨 HC3 가 깨진다.
 *
 * ## 체인 (전부 프로덕션 export — 자체 렌더/자체 레이아웃 0)
 *
 *   CompositionDocument (fixture 1개)
 *     → buildCanonicalSceneModel        scene/canonicalSceneModel.ts:174
 *     → buildSceneSnapshot              scene/buildSceneSnapshot.ts:285
 *     → buildPageLayoutPublisherInput   renderers/rendererInput.ts:50
 *     → useLayoutPublisher              hooks/useLayoutPublisher.ts:52   (실 React hook)
 *         └ getCachedPageLayout → calculateFullTreeLayout (WASM) → publishLayoutMapsBatch
 *     → StoreRenderBridge.sync          skia/StoreRenderBridge.ts:1152
 *         └ buildNodeForElement → buildSpecNodeData / buildBoxNodeData → registerSkiaNode
 *     → createSkiaRendererInput         renderers/rendererInput.ts:461
 *     → buildSkiaFrameContent           skia/skiaFramePipeline.ts:80
 *     → exportToImage                   skia/export.ts:40  (ck.MakeSurface → PNG)
 *
 * `useLayoutPublisher` 는 `renderHook` 으로 **실제 hook 을 실행**한다 — hook body 를
 * 테스트에 복제하면 그 순간 "테스트 전용 레이아웃 경로" 가 되어 HC3 위반이다.
 *
 * ## nodeOrder / geometry 의 출처
 *
 * 둘 다 **프로덕션 산출물**에서 뽑는다. 별도 traversal 을 새로 쓰지 않는다:
 *
 * - `nodeOrder` — `buildCanonicalSceneModel` 의 `sceneNodes` (프로덕션 traversal
 *   순서) 중 실제로 렌더에 도달한 것만. 도달 여부는 `treeBoundsMap` 키 존재로 본다.
 * - `geometry` — `content.sharedScene.treeBoundsMap` (프로덕션 bounds). 페이지
 *   원점을 빼서 아티보드 상대로 정규화한다 — Preview leg 이 iframe 상대 좌표를
 *   내므로 두 leg 의 좌표계를 맞추기 위함이다.
 */

import { renderHook } from "@testing-library/react";
import type { CanvasKit } from "canvaskit-wasm";
import type { CompositionDocument } from "@composition/shared";

import { buildCanonicalSceneModel } from "@/builder/workspace/canvas/scene/canonicalSceneModel";
import { buildSceneSnapshot } from "@/builder/workspace/canvas/scene/buildSceneSnapshot";
import {
  buildPageLayoutPublisherInput,
  createSkiaRendererInput,
  type LayoutPublisherInput,
  type SkiaRendererInput,
} from "@/builder/workspace/canvas/renderers";
import { useLayoutPublisher } from "@/builder/workspace/canvas/hooks/useLayoutPublisher";
import { StoreRenderBridge } from "@/builder/workspace/canvas/skia/StoreRenderBridge";
import {
  clearSkiaRegistry,
  getRegistryVersion,
} from "@/builder/workspace/canvas/skia/useSkiaNode";
import { buildSkiaFrameContent } from "@/builder/workspace/canvas/skia/skiaFramePipeline";
import { FrameContentCache } from "@/builder/workspace/canvas/skia/frameContentCache";
import { exportToImage } from "@/builder/workspace/canvas/skia/export";
import { getSharedLayoutMap } from "@/builder/workspace/canvas/layout/engines/fullTreeLayout";
import type { CanvasLayoutNode } from "@/builder/workspace/canvas/layout/layoutNode";
import type { Page } from "@/types/builder/unified.types";

import { environmentChecksum, stableChecksum } from "./identity";
import type { EnvironmentManifest, LegResult, Rect } from "./types";

export interface SkiaLegOptions {
  pageId: string;
  width: number;
  height: number;
  projectId?: string;
}

export interface SkiaLegRaw {
  png: Uint8Array;
  pixels: Uint8Array;
  /** 발행된 layout 노드 수 (`getSharedLayoutMap().size`) */
  layoutNodeCount: number;
  /** 프로덕션 traversal 순서의 canonical node id — 렌더 도달분만 */
  nodeOrder: string[];
  /** canonical node id → 아티보드 상대 박스 */
  geometry: Record<string, Rect>;
}

/** 흰 배경 — export/readback 양쪽에서 같은 값을 쓴다. */
const BACKGROUND: [number, number, number, number] = [0xff, 0xff, 0xff, 0xff];

/** `useLayoutPublisher` 를 실제 React hook 으로 실행한다 (effect 동기 flush). */
function publishViaHook(
  pages: Array<{ pageId: string; input: LayoutPublisherInput }>,
): void {
  const { unmount } = renderHook(() => useLayoutPublisher(pages, [], 1));
  unmount();
}

/** 프로덕션 renderable 을 SW surface 에 그리고 RGBA 를 읽는다. */
function readContentPixels(
  ck: CanvasKit,
  renderable: { renderSkia: (canvas: never, bounds: DOMRect) => void },
  width: number,
  height: number,
): Uint8Array {
  const surface = ck.MakeSurface(width, height);
  if (!surface) throw new Error("MakeSurface 실패");
  try {
    const canvas = surface.getCanvas();
    canvas.clear(ck.Color(...BACKGROUND));
    renderable.renderSkia(canvas as never, new DOMRect(0, 0, width, height));
    surface.flush();
    const image = surface.makeImageSnapshot();
    if (!image) throw new Error("makeImageSnapshot 실패");
    const px = image.readPixels(0, 0, {
      width,
      height,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
    }) as Uint8Array | null;
    image.delete();
    if (!px) throw new Error("readPixels 실패");
    return new Uint8Array(px);
  } finally {
    surface.delete();
  }
}

/**
 * canonical fixture → 프로덕션 체인 → PNG + RGBA + nodeOrder/geometry.
 *
 * 각 단계가 프로덕션 export 다. 중간 산출물을 손으로 만들지 않는다.
 */
export function runSkiaLeg(
  ck: CanvasKit,
  doc: CompositionDocument,
  opts: SkiaLegOptions,
): SkiaLegRaw {
  const { pageId, width, height } = opts;
  const pages: Page[] = [
    {
      id: pageId,
      title: `ADR-198 ${pageId}`,
      project_id: opts.projectId ?? "adr198",
      slug: pageId,
    },
  ];

  // 케이스 간 registry 누수 차단 (G4 resource lifecycle 예고편)
  clearSkiaRegistry();

  // 1) canonical → scene model (프로덕션 단일 traversal 진입점)
  const model = buildCanonicalSceneModel(doc);

  // 2) scene snapshot — visible page 판정/pageSnapshots 생산
  const sceneSnapshot = buildSceneSnapshot({
    containerSize: { height: height * 4, width: width * 4 },
    currentPageId: pageId,
    elements: model.sceneNodes,
    elementsMap: model.sceneNodesMap,
    layoutVersion: 1,
    pageHeight: height,
    pageIndex: model.pageIndex,
    pagePositions: { [pageId]: { x: 0, y: 0 } },
    pagePositionsVersion: 1,
    pageWidth: width,
    pages,
    panOffset: { x: 0, y: 0 },
    selectedElementIds: [],
    source: "canonical",
    zoom: 1,
  });

  // 3) layout publisher input (프로덕션 builder)
  const elementById = new Map<string, CanvasLayoutNode>(
    model.sceneNodesMap as unknown as Map<string, CanvasLayoutNode>,
  );
  const publisherInput = buildPageLayoutPublisherInput({
    dirtyElementIds: new Set<string>(),
    elementById,
    pageHeight: height,
    pageId,
    pagePositionVersion: 1,
    pageWidth: width,
    panOffset: { x: 0, y: 0 },
    sceneSnapshot,
    wasmLayoutReady: true,
    zoom: 1,
  });
  if (!publisherInput) {
    throw new Error(
      "buildPageLayoutPublisherInput null — pageSnapshot.bodyElement 미해결 " +
        '(fixture 의 body 노드가 소문자 "body" 인지 확인)',
    );
  }

  // 4) 실 hook 실행 → getCachedPageLayout → calculateFullTreeLayout(WASM) → publish
  publishViaHook([{ pageId, input: publisherInput }]);

  const shared = getSharedLayoutMap();
  if (!shared) {
    throw new Error(
      "getSharedLayoutMap null — useLayoutPublisher 가 발행하지 못했다 (WASM 준비/시그니처 확인)",
    );
  }

  // 5) Skia node registry 채우기 — 프로덕션 `StoreRenderBridge.sync`.
  //    renderCommands.visitElement 는 `getSkiaNode(id)` 가 비면 즉시 return 하므로
  //    이 단계 없이는 boundsMap 이 비어 buildSkiaFrameContent 가 null 을 준다.
  const bridge = new StoreRenderBridge();
  bridge.sync(
    model.sceneNodesMap,
    shared,
    "light",
    model.sceneChildrenByParent,
    sceneSnapshot.sceneVersion,
    true,
    1,
  );
  const registryVersion = getRegistryVersion();

  // 6) renderer input (프로덕션 builder)
  const rendererInput: SkiaRendererInput = createSkiaRendererInput({
    childrenMap: model.sceneChildrenByParent,
    dirtyElementIds: new Set<string>(),
    documentRevision: 1,
    editMode: "page",
    elements: model.sceneNodes,
    renderNodesMap: model.sceneNodesMap,
    sceneChildrenByParent: model.sceneChildrenByParent,
    sceneNodes: model.sceneNodes,
    sceneNodesMap: model.sceneNodesMap,
    pageIndex: model.pageIndex,
    pagePositions: { [pageId]: { x: 0, y: 0 } },
    pagePositionsVersion: 1,
    pages,
    sceneSnapshot,
    framePositions: {},
    framePositionsVersion: 1,
    frameAreas: [],
    frameElementScopes: model.frameElementScopes,
  });

  // 7) 프로덕션 content node (SkiaRenderable)
  const content = buildSkiaFrameContent(
    {
      aiState: {
        cleanupExpiredFlashes: () => {},
        flashAnimations: new Map(),
        generatingNodes: new Map(),
      },
      registryVersion,
      pagePosVersion: 1,
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
      ck,
      fontMgr: undefined,
      rendererInput,
      // 1회성 빌드라 재사용할 이전 프레임이 없다 — 새 캐시가 맞다.
    },
    new FrameContentCache(),
  );
  if (!content) {
    throw new Error(
      "buildSkiaFrameContent null — sharedLayoutMap 발행 후에도 빈 씬 (visiblePageIds/bodyElement 확인)",
    );
  }

  // 8) 프로덕션 offscreen export (ck.MakeSurface → PNG)
  const png = exportToImage(ck, content.contentNode, {
    width,
    height,
    format: "png",
    backgroundColor: ck.Color4f(1, 1, 1, 1),
  });

  // 같은 씬을 같은 방식으로 한 번 더 그려 RGBA 를 읽는다 — PNG 디코더 의존 없이
  // liveness/좌표를 판정하기 위함이며, 그리는 경로는 위와 동일한 renderSkia 다.
  const pixels = readContentPixels(ck, content.contentNode, width, height);

  // 9) nodeOrder / geometry — 프로덕션 산출물에서 추출
  const treeBounds = content.sharedScene.treeBoundsMap;
  const pageOrigin = treeBounds.get(pageId);
  const originX = pageOrigin?.x ?? 0;
  const originY = pageOrigin?.y ?? 0;

  const nodeOrder: string[] = [];
  const geometry: Record<string, Rect> = {};
  for (const sceneNode of model.sceneNodes) {
    const box = treeBounds.get(sceneNode.id);
    if (!box) continue; // 렌더에 도달하지 않은 노드
    const canonicalId = sceneNode.sourceNode.id;
    nodeOrder.push(canonicalId);
    geometry[canonicalId] = {
      x: box.x - originX,
      y: box.y - originY,
      width: box.width,
      height: box.height,
    };
  }

  return {
    png,
    pixels,
    layoutNodeCount: shared.size,
    nodeOrder,
    geometry,
  };
}

/**
 * `LegResult` 래퍼 — identity 층(L0)이 소비하는 형태.
 *
 * `paintedNodeCount` 는 **scene/registry 기준 노드 수**다 (칠해진 픽셀이 아니라).
 * identity 는 픽셀과 무관하게 성립해야 하기 때문이다 — 현재 Skia leg 은 백색
 * 프레임을 내지만(원인 미규명, §7) 그것이 "같은 문서를 봤는가" 의 답을 바꾸지는
 * 않는다.
 */
export function runSkiaLegResult(
  ck: CanvasKit,
  doc: CompositionDocument,
  opts: SkiaLegOptions,
  env: EnvironmentManifest,
): LegResult {
  const raw = runSkiaLeg(ck, doc, opts);
  return {
    legId: "skia",
    fixtureChecksum: stableChecksum(doc),
    environmentChecksum: environmentChecksum(env),
    nodeOrder: raw.nodeOrder,
    geometry: raw.geometry,
    pixels: raw.pixels,
    png: raw.png,
    paintedNodeCount: raw.nodeOrder.length,
    consoleErrors: [],
  };
}
