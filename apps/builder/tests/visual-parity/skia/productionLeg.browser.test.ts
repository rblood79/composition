/**
 * ADR-198 Phase 0 — G0 Skia leg 파일럿 (프로덕션 경로)
 *
 * doctor.browser.test.ts 가 "CanvasKit 이 이 host 에서 살아 있다" 를 증명했다면,
 * 이 파일은 **canonical `CompositionDocument` 하나가 프로덕션 함수 체인만 거쳐
 * `ck.MakeSurface` PNG 에 도달하는가** 를 증명한다. HC2(one fixture authority) +
 * HC3(production consumer paths) 의 Skia 쪽 절반이다.
 *
 * ## 체인 (전부 프로덕션 export — 자체 렌더/자체 레이아웃 0)
 *
 *   CompositionDocument (fixture 1개)
 *     → buildCanonicalSceneModel        scene/canonicalSceneModel.ts:176
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
 * ## Phase 0 에서 실측으로 드러난 계약 3개 (Phase 1 fixture 작성 전 필독)
 *
 * 1. **Skia node registry 없이는 아무것도 안 그려진다.** `renderCommands.visitElement`
 *    (renderCommands.ts:1392) 가 `getSkiaNode(id)` 부재 시 즉시 return 하므로,
 *    layout 발행만으로는 `buildSkiaFrameContent` 가 빈 boundsMap → null 을 준다.
 *    `StoreRenderBridge.sync` 가 필수 단계다.
 * 2. **catalog 배경 채널은 hex6 전용.** `#2F6FEDFF`(hex8) 을 넣으면
 *    `hexStringToNumber` 채널이 밀려 `0.435,0.929,1,0` 으로 읽힌다
 *    (buildSpecNodeData.ts:1720 주석의 실측 계약).
 * 3. **컨테이너 타입마다 배경 도달 여부가 다르다.** 같은 `props.style.backgroundColor`
 *    에 대해 `Card`/`Toolbar` 는 alpha 1 로 칠해지고, `frame`/`Group` 은
 *    `fill=0,0,0,0` 으로 남는다 (Frame.spec 이 layout 컨테이너라 배경 shape 을
 *    만들지 않음). Phase 6 매트릭스는 이 차이를 타입별로 명시해야 하며, 그전까지
 *    파일럿은 배경이 실제로 도달하는 타입을 쓴다.
 *
 * ## fixture 계약
 *
 * 텍스트 0 (폰트 의존 배제), transition/animation 0 (wall-clock 미독출 — HC5),
 * 중첩 컨테이너 + border/radius + 단색 fill 만.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { CanvasKit } from "canvaskit-wasm";
import type { CompositionDocument } from "@composition/shared";

import {
  createPilotDocument,
  fixtureChecksum,
  FIXTURE_ARTBOARD,
  FIXTURE_PAGE_ID,
} from "../harness/fixture";
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";
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
import { exportToImage } from "@/builder/workspace/canvas/skia/export";
import { getSharedLayoutMap } from "@/builder/workspace/canvas/layout/engines/fullTreeLayout";
import type { CanvasLayoutNode } from "@/builder/workspace/canvas/layout/layoutNode";
import type { Page } from "@/types/builder/unified.types";

import { byteDiff, pixelVariance, pixelAt, rgbaHash } from "../harness/pixels";

// ── fixture 상수 ─────────────────────────────────────────────────────────

const PAGE_ID = FIXTURE_PAGE_ID;
const PAGE_W = FIXTURE_ARTBOARD.width;
const PAGE_H = FIXTURE_ARTBOARD.height;

/** body 배경 — 흰색. */
const BG: [number, number, number, number] = [0xff, 0xff, 0xff, 0xff];
/** 바깥 box fill — 파랑. */
const OUTER: [number, number, number, number] = [0x2f, 0x6f, 0xed, 0xff];
/** 안쪽 box fill — 자홍. */
const INNER: [number, number, number, number] = [0xd9, 0x26, 0x4f, 0xff];

const PAGES: Page[] = [
  {
    id: PAGE_ID,
    title: "ADR-198 pilot",
    project_id: "adr198",
    slug: "adr198",
  },
];

// ── 프로덕션 체인 ────────────────────────────────────────────────────────

interface SkiaLegResult {
  png: Uint8Array;
  pixels: Uint8Array;
  layoutNodeCount: number;
}

/**
 * canonical fixture → 프로덕션 체인 → PNG + RGBA.
 *
 * 각 단계가 프로덕션 export 다. 중간 산출물을 손으로 만들지 않는다.
 */
function runSkiaLeg(ck: CanvasKit, doc: CompositionDocument): SkiaLegResult {
  // 케이스 간 registry 누수 차단 (G4 resource lifecycle 예고편)
  clearSkiaRegistry();

  // 1) canonical → scene model (프로덕션 단일 traversal 진입점)
  const model = buildCanonicalSceneModel(doc);

  // 2) scene snapshot — visible page 판정/pageSnapshots 생산
  const sceneSnapshot = buildSceneSnapshot({
    containerSize: { height: PAGE_H * 4, width: PAGE_W * 4 },
    currentPageId: PAGE_ID,
    elements: model.sceneNodes,
    elementsMap: model.sceneNodesMap,
    layoutVersion: 1,
    pageHeight: PAGE_H,
    pageIndex: model.pageIndex,
    pagePositions: { [PAGE_ID]: { x: 0, y: 0 } },
    pagePositionsVersion: 1,
    pageWidth: PAGE_W,
    pages: PAGES,
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
    pageHeight: PAGE_H,
    pageId: PAGE_ID,
    pagePositionVersion: 1,
    pageWidth: PAGE_W,
    panOffset: { x: 0, y: 0 },
    sceneSnapshot,
    wasmLayoutReady: true,
    zoom: 1,
  });
  if (!publisherInput) {
    throw new Error(
      "buildPageLayoutPublisherInput null — pageSnapshot.bodyElement 미해결 (fixture 의 Body 노드 확인)",
    );
  }

  // 4) 실 hook 실행 → getCachedPageLayout → calculateFullTreeLayout(WASM) → publish
  publishViaHook([{ pageId: PAGE_ID, input: publisherInput }]);

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
    pagePositions: { [PAGE_ID]: { x: 0, y: 0 } },
    pagePositionsVersion: 1,
    pages: PAGES,
    sceneSnapshot,
    framePositions: {},
    framePositionsVersion: 1,
    frameAreas: [],
    frameElementScopes: model.frameElementScopes,
  });

  // 7) 프로덕션 content node (SkiaRenderable)
  const content = buildSkiaFrameContent({
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
  });
  if (!content) {
    throw new Error(
      "buildSkiaFrameContent null — sharedLayoutMap 발행 후에도 빈 씬 (visiblePageIds/bodyElement 확인)",
    );
  }

  // 8) 프로덕션 offscreen export (ck.MakeSurface → PNG)
  const png = exportToImage(ck, content.contentNode, {
    width: PAGE_W,
    height: PAGE_H,
    format: "png",
    backgroundColor: ck.Color4f(1, 1, 1, 1),
  });

  // 같은 씬을 같은 방식으로 한 번 더 그려 RGBA 를 읽는다 — PNG 디코더 의존 없이
  // liveness/좌표를 판정하기 위함이며, 그리는 경로는 위와 동일한 renderSkia 다.
  const pixels = readContentPixels(ck, content.contentNode);

  return { png, pixels, layoutNodeCount: shared.size };
}

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
): Uint8Array {
  const surface = ck.MakeSurface(PAGE_W, PAGE_H);
  if (!surface) throw new Error("MakeSurface 실패");
  try {
    const canvas = surface.getCanvas();
    canvas.clear(ck.Color(...BG));
    renderable.renderSkia(canvas as never, new DOMRect(0, 0, PAGE_W, PAGE_H));
    surface.flush();
    const image = surface.makeImageSnapshot();
    if (!image) throw new Error("makeImageSnapshot 실패");
    const px = image.readPixels(0, 0, {
      width: PAGE_W,
      height: PAGE_H,
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

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

// ── 테스트 ───────────────────────────────────────────────────────────────

describe("ADR-198 Phase 0 — G0 Skia leg (프로덕션 경로)", () => {
  let ck: CanvasKit;

  beforeAll(async () => {
    await initCompositionEngineWasm();
    ck = await initCanvasKit();
  }, 120_000);

  it("canonical fixture 1개가 프로덕션 체인만 거쳐 PNG 에 도달한다 (HC2/HC3)", () => {
    const { png, pixels, layoutNodeCount } = runSkiaLeg(
      ck,
      createPilotDocument(),
    );

    // PNG 실체
    expect(png.length).toBeGreaterThan(0);
    expect(Array.from(png.slice(0, 4))).toEqual(PNG_MAGIC);

    const variance = pixelVariance(pixels);

    console.log(
      `[ADR-198 P0-skia] png=${png.length}B layoutNodes=${layoutNodeCount} ` +
        `hash=${rgbaHash(pixels)} variance=${variance.toFixed(1)} ` +
        `bg(4,4)=${pixelAt(pixels, PAGE_W, 4, 4).join(",")} ` +
        `outer(30,30)=${pixelAt(pixels, PAGE_W, 30, 30).join(",")} ` +
        `inner(60,60)=${pixelAt(pixels, PAGE_W, 60, 60).join(",")}`,
    );
  });

  /**
   * **현재 이 leg 은 백색 프레임을 낸다.** 통합 fixture(`harness/fixture.ts`)로
   * 프로덕션 체인을 다 태워도 `variance = 0`, `outer(30,30) = 255,255,255,255`.
   *
   * `it.fails` 로 두는 이유: 통과시키려고 입력을 바꾸면(컨테이너를 `Card` 로, 색을
   * hex6 로) 게이트가 유리한 입력만 재는 도구가 된다 (measurement-validity §1 Q2).
   * 반대로 red 로 두면 스위트를 commit 할 수 없다. `it.fails` 는 **ratchet** 이다 —
   * 칠해지기 시작하는 순간 이 테스트가 실패해서 기록 갱신을 강제한다.
   *
   * **아직 규명되지 않은 것 (Phase 1 이 받는다)**:
   *
   * - Skia 가 왜 비는가. 후보는 (a) `frame` 이 layout 컨테이너라 배경 shape 미생성,
   *   (b) catalog 배경 채널 hex6 전용이라 hex8 alpha 밀림 — 둘 다 백색을 만든다.
   *   이를 가르려던 축약 probe 는 네 조합 모두 `none` 을 반환해 **계측기가 무효**였고
   *   폐기했다. 근거 없는 원인 주장을 남기지 않는다.
   * - 이게 제품 발산인지 fixture 형태 문제인지. 같은 통합 fixture 에서
   *   **Preview leg 도 page 노드만 렌더한다**(`previewLeg.browser.test.ts` 실측:
   *   `outer=false inner=false`). 더 단순한 형태(page frame > frame > frame,
   *   `Body`/`legacy-page` 없음)에서는 Preview 가 3/3 을 칠했다. 즉 지금 갈리는
   *   변수는 **두 leg 을 동시에 만족하는 문서 형태가 아직 없다는 것** 이고,
   *   그건 Phase 1 (fixture and result contracts) 의 산출물이다.
   *
   * 요약: 두 leg 모두 PNG 에 도달하지만 **같은 fixture 에서 둘 다 비어 있어**
   * G0 의 "two PNGs from one checksum" 은 아직 충족되지 않았다.
   */
  it.fails(
    "[미해결 기록] fixture 의 fill 색이 Skia 좌표에 찍힌다 — 현재 실패",
    () => {
      const { pixels } = runSkiaLeg(ck, createPilotDocument());

      expect(pixelAt(pixels, PAGE_W, 4, 4)).toEqual(BG);
      expect(pixelAt(pixels, PAGE_W, 30, 30)).toEqual(OUTER);
      expect(pixelAt(pixels, PAGE_W, 60, 60)).toEqual(INNER);
    },
  );

  it("[미해결 기록] Skia leg 의 현재 liveness 를 0 으로 명시 고정", () => {
    const { pixels } = runSkiaLeg(ck, createPilotDocument());
    const variance = pixelVariance(pixels);

    console.log(
      `[ADR-198 P0-skia] 미해결: variance=${variance.toFixed(1)} ` +
        `outer(30,30)=${pixelAt(pixels, PAGE_W, 30, 30).join(",")}`,
    );

    // 결정성 테스트는 백색 프레임에서도 통과한다 — HC11 liveness 가 없으면
    // 이 leg 은 "건강하고 결정적" 으로 보인다. R11 이 겨냥한 바로 그 상태.
    expect(variance).toBe(0);
  });

  it("결정성: 10회 연속 해시 동일 + 서로 간 maxByte 0 (HC5/G2)", () => {
    const first = runSkiaLeg(ck, createPilotDocument()).pixels;
    const baseHash = rgbaHash(first);
    const hashes = new Set<string>([baseHash]);
    let worstMaxByte = 0;

    for (let i = 1; i < 10; i++) {
      const next = runSkiaLeg(ck, createPilotDocument()).pixels;
      hashes.add(rgbaHash(next));
      worstMaxByte = Math.max(worstMaxByte, byteDiff(first, next).maxByte);
    }

    console.log(
      `[ADR-198 P0-skia] 10-run: distinct=${hashes.size} hash=${baseHash} worstMaxByte=${worstMaxByte}`,
    );
    expect(hashes.size).toBe(1);
    expect(worstMaxByte).toBe(0);
  });
});
