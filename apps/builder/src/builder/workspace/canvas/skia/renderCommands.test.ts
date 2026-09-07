// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  Canvas,
  CanvasKit,
  SkPicture,
  FontMgr,
  FontCollection,
} from "canvaskit-wasm";
import { skiaFontManager } from "./fontManager";
import type { CanvasSceneNode } from "../scene/canvasSceneNode";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import { setDragVisualOffset } from "./nodeRendererTree";
import { setEditingElementId } from "./nodeRendererState";
import {
  getNodePictureCacheSize,
  setVolatileNodeIds,
  storeNodePicture,
  canPrepareColdNodePicture,
} from "./nodePictureCache";
import {
  buildDamageRenderCommandSequence,
  buildRenderCommandStream,
  executeRenderCommands,
  prepareColdPictures,
} from "./renderCommands";
import {
  beginPagePositionPresentation,
  publishPagePositionPresentation,
  resetPagePositionPresentation,
} from "../interaction/pagePositionPresentation";
import type { SkiaNodeData } from "./nodeRenderers";
import type { ComputedLayout } from "../layout/engines/LayoutEngine";

function makeElement(
  id: string,
  overrides: Partial<CanvasSceneNode> = {},
): CanvasSceneNode {
  return {
    id,
    type: "Box",
    page_id: "page-1",
    parent_id: null,
    order_num: 0,
    props: {},
    deleted: false,
    ...overrides,
  } as CanvasSceneNode;
}

function registerNode(id: string, overrides: Partial<SkiaNodeData> = {}): void {
  registerSkiaNode(id, {
    elementId: id,
    height: 100,
    type: "container",
    visible: true,
    width: 100,
    x: 0,
    y: 0,
    ...overrides,
  } as SkiaNodeData);
}

function elementCommandIds(commands: unknown[]): string[] {
  return commands
    .map((command) =>
      typeof command === "object" && command !== null
        ? (command as { elementId?: unknown }).elementId
        : undefined,
    )
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

describe("buildRenderCommandStream drag top layer", () => {
  afterEach(() => {
    setDragVisualOffset(null, 0, 0, true);
    clearSkiaRegistry();
  });

  it("renders the dragged subtree after all page roots", () => {
    const page1Body = makeElement("page-1-body", {
      type: "body",
      page_id: "page-1",
    });
    const page2Body = makeElement("page-2-body", {
      type: "body",
      page_id: "page-2",
    });
    const source = makeElement("source-card", {
      parent_id: page1Body.id,
      page_id: "page-1",
    });

    registerNode(page1Body.id);
    registerNode(page2Body.id);
    registerNode(source.id);
    setDragVisualOffset(source.id, 900, 0, true);

    const stream = buildRenderCommandStream(
      [page1Body.id, page2Body.id],
      new Map([[page1Body.id, [source]]]),
      new Map([
        [
          source.id,
          { x: 24, y: 32, width: 160, height: 120 } as ComputedLayout,
        ],
      ]),
      {
        [page1Body.id]: { x: 0, y: 0 },
        [page2Body.id]: { x: 900, y: 0 },
      },
    );

    expect(elementCommandIds(stream.commands)).toEqual([
      page1Body.id,
      page2Body.id,
      source.id,
    ]);
  });
});

describe("executeRenderCommands scroll-aware culling", () => {
  afterEach(() => {
    clearSkiaRegistry();
    resetPagePositionPresentation();
  });

  const stubCk = {
    LTRBRect: () => ({}),
    ClipOp: { Intersect: 0 },
  } as unknown as CanvasKit;

  function makeRecordingCanvas() {
    const translates: Array<[number, number]> = [];
    const events: string[] = [];
    let saveCount = 0;
    let restoreCount = 0;
    const canvas = {
      save() {
        saveCount++;
        events.push("save");
      },
      restore() {
        restoreCount++;
        events.push("restore");
      },
      saveLayer() {
        events.push("saveLayer");
      },
      concat() {},
      clipRect() {},
      clipPath() {},
      drawRect() {
        events.push("drawRect");
      },
      translate(x: number, y: number) {
        translates.push([x, y]);
      },
    } as unknown as Canvas;
    return {
      canvas,
      translates,
      events,
      get saveCount() {
        return saveCount;
      },
      get restoreCount() {
        return restoreCount;
      },
    };
  }

  function makeMaskCanvasKit() {
    class MockPaint {
      setAntiAlias(): void {}
      setStyle(): void {}
      setColor(): void {}
      setAlphaf(): void {}
      setStrokeWidth(): void {}
      setStrokeCap(): void {}
      setStrokeJoin(): void {}
      setBlendMode(): void {}
      setPathEffect(): void {}
      setShader(): void {}
      setImageFilter(): void {}
      setColorFilter(): void {}
    }

    return {
      Paint: MockPaint,
      PaintStyle: { Fill: 0 },
      StrokeCap: { Butt: 0 },
      StrokeJoin: { Miter: 0 },
      BlendMode: {
        SrcOver: 0,
        DstIn: 1,
        Multiply: 2,
      },
      BLACK: Float32Array.of(0, 0, 0, 1),
      TileMode: { Clamp: 0, Repeat: 1 },
      Shader: {
        MakeLinearGradient: () => ({ delete() {} }),
      },
      LTRBRect: (...args: number[]) => args,
      ClipOp: { Intersect: 0 },
    } as unknown as CanvasKit;
  }

  function buildScrolledPageStream(childY: number) {
    const body = makeElement("scroll-body", { type: "body" });
    const child = makeElement("below-fold-child", { parent_id: body.id });

    registerNode(body.id, {
      width: 800,
      height: 600,
      clipChildren: true,
      scrollOffset: { scrollTop: 1000, scrollLeft: 0 },
    });
    registerNode(child.id, { width: 100, height: 100 });

    return buildRenderCommandStream(
      [body.id],
      new Map([[body.id, [child]]]),
      new Map([
        [
          child.id,
          { x: 0, y: childY, width: 100, height: 100 } as ComputedLayout,
        ],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );
  }

  const viewport = { x: 0, y: 0, width: 800, height: 600 } as DOMRect;

  it("renders a child scrolled into the viewport", () => {
    // 스크롤 전 y=1400 (뷰포트 밖) → scrollTop=1000 반영 시 400 (뷰포트 안)
    const stream = buildScrolledPageStream(1400);
    const { canvas, translates } = makeRecordingCanvas();

    executeRenderCommands(stubCk, canvas, stream.commands, viewport);

    expect(translates).toContainEqual([0, 1400]);
  });

  it("still culls a child that remains outside the viewport after scroll", () => {
    // y=2400 → scrollTop=1000 반영해도 1400 (뷰포트 밖) → 컬링 유지
    const stream = buildScrolledPageStream(2400);
    const { canvas, translates } = makeRecordingCanvas();

    executeRenderCommands(stubCk, canvas, stream.commands, viewport);

    expect(translates).not.toContainEqual([0, 2400]);
  });

  it("does not restore a clip layer that was not saved for zero-size children", () => {
    const body = makeElement("zero-clip-body", { type: "body" });
    const owner = makeElement("zero-clip-owner", { parent_id: body.id });
    const child = makeElement("zero-clip-child", { parent_id: owner.id });

    registerNode(body.id, { width: 800, height: 600 });
    registerNode(owner.id, {
      width: 0,
      height: 100,
      clipChildren: true,
    });
    registerNode(child.id, { width: 10, height: 10 });

    const stream = buildRenderCommandStream(
      [body.id],
      new Map([
        [body.id, [owner]],
        [owner.id, [child]],
      ]),
      new Map([
        [owner.id, { x: 0, y: 0, width: 0, height: 100 } as ComputedLayout],
        [child.id, { x: 0, y: 0, width: 10, height: 10 } as ComputedLayout],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );
    const recording = makeRecordingCanvas();

    executeRenderCommands(stubCk, recording.canvas, stream.commands, {
      x: 0,
      y: 0,
      width: 800,
      height: 600,
    } as DOMRect);

    // body, owner, child element saves only; the zero-width clip opens no save.
    expect(recording.saveCount).toBe(3);
    expect(recording.restoreCount).toBe(3);
  });

  it("applies mask before restoring blend and element layers", () => {
    const body = makeElement("mask-stack-body", { type: "body" });
    const maskImage = {
      type: "gradient",
      mode: "alpha",
      gradient: {
        type: "linear-gradient",
        start: [0, 0],
        end: [100, 0],
        colors: [Float32Array.of(0, 0, 0, 0), Float32Array.of(1, 1, 1, 1)],
        positions: [0, 1],
      },
    } as NonNullable<SkiaNodeData["maskImage"]>;

    registerNode(body.id, {
      width: 100,
      height: 100,
      blendMode: "multiply",
      effects: [{ type: "opacity", value: 0.5 }],
      maskImage,
    });

    const stream = buildRenderCommandStream([body.id], new Map(), new Map(), {
      [body.id]: { x: 0, y: 0 },
    });
    const recording = makeRecordingCanvas();

    executeRenderCommands(
      makeMaskCanvasKit(),
      recording.canvas,
      stream.commands,
      { x: 0, y: 0, width: 100, height: 100 } as DOMRect,
    );

    expect(recording.events).toEqual([
      "save",
      "saveLayer",
      "saveLayer",
      "saveLayer",
      "drawRect",
      "restore",
      "restore",
      "restore",
      "restore",
    ]);
  });

  it("applies transient page position only at the page root", () => {
    const body = makeElement("presented-body", { type: "body" });
    const child = makeElement("presented-child", { parent_id: body.id });

    registerNode(body.id, { width: 800, height: 600 });
    registerNode(child.id, { width: 100, height: 100 });

    const stream = buildRenderCommandStream(
      [body.id],
      new Map([[body.id, [child]]]),
      new Map([
        [child.id, { x: 12, y: 18, width: 100, height: 100 } as ComputedLayout],
      ]),
      { [body.id]: { x: 10, y: 20 } },
    );
    const canonical = { "page-1": { x: 10, y: 20 } };
    beginPagePositionPresentation(canonical, ["page-1"], "desktop");
    publishPagePositionPresentation([
      { pageId: "page-1", position: { x: 50, y: 75 } },
    ]);

    const { canvas, translates } = makeRecordingCanvas();
    executeRenderCommands(
      stubCk,
      canvas,
      stream.commands,
      viewport,
      undefined,
      undefined,
      new Map([[body.id, "page-1"]]),
    );

    expect(translates).toContainEqual([50, 75]);
    expect(translates).toContainEqual([12, 18]);
  });
});

describe("buildRenderCommandStream clip-aware hit bounds", () => {
  afterEach(() => {
    setDragVisualOffset(null, 0, 0, true);
    clearSkiaRegistry();
  });

  /**
   * ListBox maxHeight:300 + 내용 350 형태의 최소 재현.
   * owner 는 clipChildren(overflow auto/hidden) 로 300 만 그리므로,
   * 300~350 구간은 화면에 없다 → 히트 대상이 되면 안 된다.
   */
  function buildClippedOwnerStream(): ReturnType<
    typeof buildRenderCommandStream
  > {
    const body = makeElement("clip-body", { type: "body" });
    const owner = makeElement("clip-owner", { parent_id: body.id });
    const rows = makeElement("clip-rows", { parent_id: owner.id });
    const belowFold = makeElement("clip-below-fold", { parent_id: owner.id });

    registerNode(body.id, { width: 390, height: 844 });
    registerNode(owner.id, { width: 390, height: 300, clipChildren: true });
    registerNode(rows.id, { width: 390, height: 350 });
    registerNode(belowFold.id, { width: 390, height: 40 });

    return buildRenderCommandStream(
      [body.id],
      new Map([
        [body.id, [owner]],
        [owner.id, [rows, belowFold]],
      ]),
      new Map<string, ComputedLayout>([
        [owner.id, { x: 0, y: 100, width: 390, height: 300 } as ComputedLayout],
        [rows.id, { x: 0, y: 0, width: 390, height: 350 } as ComputedLayout],
        [
          belowFold.id,
          { x: 0, y: 350, width: 390, height: 40 } as ComputedLayout,
        ],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );
  }

  it("keeps boundsMap unclipped (오버레이/측정 기하는 요소 원본 박스 유지)", () => {
    const stream = buildClippedOwnerStream();

    expect(stream.boundsMap.get("clip-rows")).toEqual({
      x: 0,
      y: 100,
      width: 390,
      height: 350,
    });
  });

  it("clips hit bounds to the nearest clipping ancestor", () => {
    const stream = buildClippedOwnerStream();

    // owner 는 y 100~400 만 그린다 → 자식 히트 영역도 400 에서 잘린다.
    expect(stream.hitBoundsMap.get("clip-rows")).toEqual({
      x: 0,
      y: 100,
      width: 390,
      height: 300,
    });
  });

  it("drops fully clipped descendants from hit bounds", () => {
    const stream = buildClippedOwnerStream();

    // y 450~490 은 clip rect(100~400) 와 교차 0 → 히트 대상 제외
    expect(stream.boundsMap.has("clip-below-fold")).toBe(true);
    expect(stream.hitBoundsMap.has("clip-below-fold")).toBe(false);
  });

  it("leaves the clipping owner itself unclipped", () => {
    const stream = buildClippedOwnerStream();

    // clipChildren 은 자식에만 적용 — owner 자신의 박스는 그대로 히트 가능
    expect(stream.hitBoundsMap.get("clip-owner")).toEqual({
      x: 0,
      y: 100,
      width: 390,
      height: 300,
    });
  });

  it("clips hit bounds under a scrolled clipping ancestor", () => {
    const body = makeElement("scroll-clip-body", { type: "body" });
    const child = makeElement("scroll-clip-child", { parent_id: body.id });

    registerNode(body.id, {
      width: 800,
      height: 600,
      clipChildren: true,
      scrollOffset: { scrollTop: 500, scrollLeft: 0 },
    });
    registerNode(child.id, { width: 100, height: 200 });

    const stream = buildRenderCommandStream(
      [body.id],
      new Map([[body.id, [child]]]),
      new Map([
        [child.id, { x: 0, y: 400, width: 100, height: 200 } as ComputedLayout],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );

    // 스크롤 반영 절대 y = 400 - 500 = -100 → clip rect(0~600) 과 교차 0~100
    expect(stream.boundsMap.get(child.id)).toEqual({
      x: 0,
      y: -100,
      width: 100,
      height: 200,
    });
    expect(stream.hitBoundsMap.get(child.id)).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  });

  it("exempts the drag top-layer subtree from ancestor clipping", () => {
    const body = makeElement("drag-clip-body", { type: "body" });
    const owner = makeElement("drag-clip-owner", { parent_id: body.id });
    const dragged = makeElement("drag-clip-child", { parent_id: owner.id });

    registerNode(body.id, { width: 390, height: 844 });
    registerNode(owner.id, { width: 390, height: 100, clipChildren: true });
    registerNode(dragged.id, { width: 100, height: 100 });
    setDragVisualOffset(dragged.id, 0, 0, true);

    const stream = buildRenderCommandStream(
      [body.id],
      new Map([
        [body.id, [owner]],
        [owner.id, [dragged]],
      ]),
      new Map<string, ComputedLayout>([
        [owner.id, { x: 0, y: 0, width: 390, height: 100 } as ComputedLayout],
        [
          dragged.id,
          { x: 0, y: 200, width: 100, height: 100 } as ComputedLayout,
        ],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );

    // top-layer 재방문은 clip save/restore 밖에서 그려진다 → 히트 영역도 클립 미적용
    expect(stream.hitBoundsMap.get(dragged.id)).toEqual({
      x: 0,
      y: 200,
      width: 100,
      height: 100,
    });
  });
});

describe("ADR-189 damage command selection", () => {
  afterEach(() => {
    clearSkiaRegistry();
  });

  function buildWideSiblingStream(count: number) {
    const body = makeElement(`damage-body-${count}`, { type: "body" });
    const children: CanvasSceneNode[] = [];
    const layout = new Map<string, ComputedLayout>();
    registerNode(body.id, { width: count * 12, height: 100 });
    for (let index = 0; index < count; index += 1) {
      const child = makeElement(`damage-child-${count}-${index}`, {
        parent_id: body.id,
      });
      children.push(child);
      registerNode(child.id, { type: "box", width: 10, height: 10 });
      layout.set(child.id, {
        x: index * 12,
        y: 0,
        width: 10,
        height: 10,
      } as ComputedLayout);
    }
    return {
      body,
      target: children[children.length - 1]!,
      stream: buildRenderCommandStream(
        [body.id],
        new Map([[body.id, children]]),
        layout,
        { [body.id]: { x: 0, y: 0 } },
      ),
    };
  }

  it.each([50, 500, 5_000])(
    "N=%i에서도 교차 sibling과 조상 command만 구성한다",
    (count) => {
      const { body, target, stream } = buildWideSiblingStream(count);
      const sequence = buildDamageRenderCommandSequence(stream, [
        body.id,
        target.id,
      ]);

      expect(sequence).not.toBeNull();
      expect(elementCommandIds(sequence!.commands)).toEqual([
        body.id,
        target.id,
      ]);
      expect(sequence!.elementCount).toBe(2);
      expect(sequence!.commands.length).toBeLessThan(10);
      expect(sequence!.commands.length).toBeLessThan(stream.commands.length);
    },
  );

  it("hit bounds 밖 paint contributor가 있으면 full fallback을 요구한다", () => {
    const body = makeElement("damage-unsafe-body", { type: "body" });
    const target = makeElement("damage-safe-target", { parent_id: body.id });
    const shadowSibling = makeElement("damage-shadow-sibling", {
      parent_id: body.id,
    });
    registerNode(body.id, { width: 400, height: 200 });
    registerNode(target.id, { type: "box", width: 80, height: 40 });
    registerNode(shadowSibling.id, {
      type: "box",
      width: 80,
      height: 40,
      box: {
        fillColor: Float32Array.of(1, 1, 1, 1),
        borderRadius: 0,
        shadows: [
          {
            type: "drop-shadow",
            color: Float32Array.of(0, 0, 0, 0.4),
            dx: -40,
            dy: 0,
            sigmaX: 8,
            sigmaY: 8,
            inner: false,
          },
        ],
      },
    });
    const stream = buildRenderCommandStream(
      [body.id],
      new Map([[body.id, [target, shadowSibling]]]),
      new Map([
        [target.id, { x: 0, y: 0, width: 80, height: 40 } as ComputedLayout],
        [
          shadowSibling.id,
          { x: 100, y: 0, width: 80, height: 40 } as ComputedLayout,
        ],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );

    expect(stream.damageUnsafeElementIds).toEqual(new Set([shadowSibling.id]));
    expect(buildDamageRenderCommandSequence(stream, [body.id, target.id])).toBe(
      null,
    );
  });
});

describe("executeRenderCommands 노드 Picture 캐시 (ADR-153 Phase 3)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setEditingElementId(null);
    setVolatileNodeIds(null);
    clearSkiaRegistry(); // clearNodePictureCache 포함
  });

  function makePictureStubCk() {
    let recordCount = 0;
    class StubPictureRecorder {
      constructor() {
        recordCount++;
      }
      beginRecording(): Canvas {
        return {
          save() {},
          restore() {},
          saveLayer() {},
          concat() {},
          clipRect() {},
          clipPath() {},
          translate() {},
        } as unknown as Canvas;
      }
      finishRecordingAsPicture(): unknown {
        return { __stubPicture: true, delete() {} };
      }
      delete() {}
    }
    const ck = {
      LTRBRect: () => ({}),
      ClipOp: { Intersect: 0 },
      PictureRecorder: StubPictureRecorder,
    } as unknown as CanvasKit;
    return { ck, recordCount: () => recordCount };
  }

  function makePictureCanvas() {
    const drawnPictures: unknown[] = [];
    const canvas = {
      save() {},
      restore() {},
      saveLayer() {},
      concat() {},
      clipRect() {},
      clipPath() {},
      translate() {},
      drawPicture(p: unknown) {
        drawnPictures.push(p);
      },
    } as unknown as Canvas;
    return { canvas, drawnPictures };
  }

  const viewport = { x: 0, y: 0, width: 800, height: 600 } as DOMRect;

  /** body(container) + leaf(box 타입, box 데이터 없음 → renderBox no-op) 최소 씬 */
  function buildLeafStream() {
    const body = makeElement("pic-body", { type: "body" });
    const leaf = makeElement("pic-leaf", { parent_id: body.id });

    registerNode(body.id, { width: 800, height: 600 });
    registerNode(leaf.id, { type: "box", width: 100, height: 100 });

    return buildRenderCommandStream(
      [body.id],
      new Map([[body.id, [leaf]]]),
      new Map([
        [leaf.id, { x: 10, y: 20, width: 100, height: 100 } as ComputedLayout],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );
  }

  it("self-draw 블록이 있는 요소만 selfSpans 에 등재된다", () => {
    const stream = buildLeafStream();
    expect(stream.selfSpans.has("pic-leaf")).toBe(true);
    // container 는 DRAW 커맨드가 없어 record 단위가 아니다
    expect(stream.selfSpans.has("pic-body")).toBe(false);
  });

  it("cold 준비 후 실제 draw는 같은 Picture를 재생하고 추가 기록하지 않는다", () => {
    const stream = buildLeafStream();
    const { ck, recordCount } = makePictureStubCk();
    const work = prepareColdPictures(
      ck,
      stream.commands,
      stream.selfSpans,
      stream.boundsMap,
      viewport,
    );
    const first = work.next();
    expect(recordCount()).toBe(0);
    expect(first.done).toBe(false);
    first.value!();
    expect(work.next().done).toBe(true);
    const { canvas, drawnPictures } = makePictureCanvas();
    executeRenderCommands(
      ck,
      canvas,
      stream.commands,
      viewport,
      undefined,
      stream.selfSpans,
    );
    expect(recordCount()).toBe(1);
    expect(drawnPictures).toHaveLength(1);
    expect(
      prepareColdPictures(
        ck,
        stream.commands,
        stream.selfSpans,
        stream.boundsMap,
        viewport,
      ).next().done,
    ).toBe(true);
  });

  it("FontCollection 준비와 첫 Picture 기록은 별도 작업이다", () => {
    const stream = buildLeafStream();
    const { ck, recordCount } = makePictureStubCk();
    const fonts = vi
      .spyOn(skiaFontManager, "getFontCollection")
      .mockReturnValue({} as FontCollection);
    const work = prepareColdPictures(
      ck,
      stream.commands,
      stream.selfSpans,
      stream.boundsMap,
      viewport,
      {} as FontMgr,
    );
    work.next().value!();
    expect(fonts).toHaveBeenCalledOnce();
    expect(recordCount()).toBe(0);
    work.next().value!();
    expect(recordCount()).toBe(1);
  });

  it("viewport 밖 또는 volatile 노드는 사전 기록하지 않는다", () => {
    const stream = buildLeafStream();
    const { ck, recordCount } = makePictureStubCk();
    const outside = new DOMRect(2000, 2000, 10, 10);
    expect(
      prepareColdPictures(
        ck,
        stream.commands,
        stream.selfSpans,
        stream.boundsMap,
        outside,
      ).next().done,
    ).toBe(true);
    setVolatileNodeIds(new Set(["pic-leaf"]));
    expect(
      prepareColdPictures(
        ck,
        stream.commands,
        stream.selfSpans,
        stream.boundsMap,
        viewport,
      ).next().done,
    ).toBe(true);
    expect(recordCount()).toBe(0);
  });

  it("캐시 용량이 차면 사전 준비가 기존 Picture를 퇴거시키지 않는다", () => {
    const stream = buildLeafStream();
    const { ck, recordCount } = makePictureStubCk();
    for (let i = 0; i < 1024; i++) {
      storeNodePicture(
        `filled-${i}`,
        {},
        1,
        1,
        { delete() {} } as SkPicture,
        null,
      );
    }
    expect(canPrepareColdNodePicture("pic-leaf")).toBe(false);
    expect(
      prepareColdPictures(
        ck,
        stream.commands,
        stream.selfSpans,
        stream.boundsMap,
        viewport,
      ).next().done,
    ).toBe(true);
    expect(recordCount()).toBe(0);
    expect(getNodePictureCacheSize()).toBe(1024);
  });

  it("miss → record 1회, 이후 동일 내용 재실행은 replay (재기록 0)", () => {
    const stream = buildLeafStream();
    const { ck, recordCount } = makePictureStubCk();

    const first = makePictureCanvas();
    executeRenderCommands(
      ck,
      first.canvas,
      stream.commands,
      viewport,
      undefined,
      stream.selfSpans,
    );
    expect(recordCount()).toBe(1);
    expect(first.drawnPictures).toHaveLength(1);

    const second = makePictureCanvas();
    executeRenderCommands(
      ck,
      second.canvas,
      stream.commands,
      viewport,
      undefined,
      stream.selfSpans,
    );
    expect(recordCount()).toBe(1); // 재기록 없음
    expect(second.drawnPictures).toHaveLength(1); // replay
  });

  it("노드 재등록(내용 변경) 시에만 해당 노드가 재기록된다", () => {
    const stream = buildLeafStream();
    const { ck, recordCount } = makePictureStubCk();

    executeRenderCommands(
      ck,
      makePictureCanvas().canvas,
      stream.commands,
      viewport,
      undefined,
      stream.selfSpans,
    );
    expect(recordCount()).toBe(1);

    // 내용 변경 = 새 데이터 객체 등록 → 스트림 재빌드 (production 흐름과 동일)
    registerNode("pic-leaf", { type: "box", width: 100, height: 100 });
    const leaf = makeElement("pic-leaf", { parent_id: "pic-body" });
    const rebuilt = buildRenderCommandStream(
      ["pic-body"],
      new Map([["pic-body", [leaf]]]),
      new Map([
        [leaf.id, { x: 10, y: 20, width: 100, height: 100 } as ComputedLayout],
      ]),
      { "pic-body": { x: 0, y: 0 } },
    );

    executeRenderCommands(
      ck,
      makePictureCanvas().canvas,
      rebuilt.commands,
      viewport,
      undefined,
      rebuilt.selfSpans,
    );
    expect(recordCount()).toBe(2); // 재기록 1회 (변경 노드 한정)
  });

  it("위치만 바뀐 재빌드는 재기록하지 않는다 (위치-불변 키)", () => {
    const stream = buildLeafStream();
    const { ck, recordCount } = makePictureStubCk();

    executeRenderCommands(
      ck,
      makePictureCanvas().canvas,
      stream.commands,
      viewport,
      undefined,
      stream.selfSpans,
    );
    expect(recordCount()).toBe(1);

    // 같은 노드 데이터, 위치만 이동한 스트림 (드래그/이동 시나리오)
    const leaf = makeElement("pic-leaf", { parent_id: "pic-body" });
    const moved = buildRenderCommandStream(
      ["pic-body"],
      new Map([["pic-body", [leaf]]]),
      new Map([
        [
          leaf.id,
          { x: 300, y: 240, width: 100, height: 100 } as ComputedLayout,
        ],
      ]),
      { "pic-body": { x: 0, y: 0 } },
    );

    const replay = makePictureCanvas();
    executeRenderCommands(
      ck,
      replay.canvas,
      moved.commands,
      viewport,
      undefined,
      moved.selfSpans,
    );
    expect(recordCount()).toBe(1); // 이동만으로는 re-record 0건
    expect(replay.drawnPictures).toHaveLength(1);
  });

  it("volatile 노드는 캐시 우회 + 기존 항목 폐기, 해제 후 재기록된다", () => {
    const stream = buildLeafStream();
    const { ck, recordCount } = makePictureStubCk();

    executeRenderCommands(
      ck,
      makePictureCanvas().canvas,
      stream.commands,
      viewport,
      undefined,
      stream.selfSpans,
    );
    expect(recordCount()).toBe(1);
    expect(getNodePictureCacheSize()).toBe(1);

    setVolatileNodeIds(new Set(["pic-leaf"]));
    const during = makePictureCanvas();
    executeRenderCommands(
      ck,
      during.canvas,
      stream.commands,
      viewport,
      undefined,
      stream.selfSpans,
    );
    expect(during.drawnPictures).toHaveLength(0); // direct draw (replay 아님)
    expect(recordCount()).toBe(1); // record 도 안 함
    expect(getNodePictureCacheSize()).toBe(0); // 기존 항목 폐기

    setVolatileNodeIds(null);
    executeRenderCommands(
      ck,
      makePictureCanvas().canvas,
      stream.commands,
      viewport,
      undefined,
      stream.selfSpans,
    );
    expect(recordCount()).toBe(2); // 최종 상태로 재기록
  });

  it("텍스트 편집 중인 요소는 record/replay 모두 우회한다", () => {
    const stream = buildLeafStream();
    const { ck, recordCount } = makePictureStubCk();

    setEditingElementId("pic-leaf");
    const editing = makePictureCanvas();
    executeRenderCommands(
      ck,
      editing.canvas,
      stream.commands,
      viewport,
      undefined,
      stream.selfSpans,
    );
    expect(editing.drawnPictures).toHaveLength(0);
    expect(recordCount()).toBe(0);
  });

  it("selfSpans 미전달(tree fallback 경로) 시 캐시가 개입하지 않는다", () => {
    const stream = buildLeafStream();
    const { ck, recordCount } = makePictureStubCk();

    const direct = makePictureCanvas();
    executeRenderCommands(ck, direct.canvas, stream.commands, viewport);
    expect(direct.drawnPictures).toHaveLength(0);
    expect(recordCount()).toBe(0);
  });
});
