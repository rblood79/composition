// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import type { Canvas, CanvasKit } from "canvaskit-wasm";
import type { CanvasSceneNode } from "../scene/canvasSceneNodeTypes";
import { clearSkiaRegistry, registerSkiaNode } from "./useSkiaNode";
import { setScrollNode } from "./propertyNodes";
import { setDragVisualOffset } from "./nodeRendererTree";
import { setEditingElementId } from "./nodeRendererState";
import {
  getNodePictureCacheSize,
  setVolatileNodeIds,
} from "./nodePictureCache";
import {
  buildDamageRenderCommandSequence,
  buildRenderCommandStream,
  executeRenderCommands,
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
    });
    setScrollNode(body.id, { scrollTop: 1000, scrollLeft: 0 });
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
    });
    setScrollNode(body.id, { scrollTop: 500, scrollLeft: 0 });
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
        return {
          __stubPicture: true,
          delete() {},
          approximateBytesUsed: () => 0,
        };
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

// ADR-269 Phase 1 (r1 H1): the stream is recorded once; after it only the owner's property node
// changes (a scroll). The executor must close what each CHILDREN_BEGIN opened — no state recorded
// at record time may restore a different frame, and the scrollbar is the table's.
describe("ADR-269 — 기록 뒤 스크롤 위치만 바뀐 스트림의 실행", () => {
  afterEach(() => clearSkiaRegistry());
  const viewport = { x: 0, y: 0, width: 800, height: 600 } as DOMRect;

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
  const ck = {
    Paint: MockPaint,
    PaintStyle: { Fill: 0 },
    StrokeCap: { Butt: 0 },
    StrokeJoin: { Miter: 0 },
    BlendMode: { SrcOver: 0 },
    BLACK: Float32Array.of(0, 0, 0, 1),
    LTRBRect: (...args: number[]) => args,
    RRectXY: (rect: number[]) => rect,
    ClipOp: { Intersect: 0 },
  } as unknown as CanvasKit;

  /** save/restore depth at every translate — a sibling must not inherit a frame left open. */
  function recordingCanvas() {
    let depth = 0;
    let saves = 0;
    let restores = 0;
    const translates: Array<{ x: number; y: number; depth: number }> = [];
    const rrects: number[][] = [];
    const canvas = {
      save() {
        depth += 1;
        saves += 1;
      },
      restore() {
        depth -= 1;
        restores += 1;
      },
      saveLayer() {
        depth += 1;
        saves += 1;
      },
      concat() {},
      clipRect() {},
      clipPath() {},
      drawRect() {},
      drawRRect(rect: number[]) {
        rrects.push(rect);
      },
      translate(x: number, y: number) {
        translates.push({ x, y, depth });
      },
    } as unknown as Canvas;
    return {
      canvas,
      translates,
      rrects,
      get balance() {
        return saves - restores;
      },
    };
  }

  /** body > owner (clip 200×100) > tall (150×300) · body > sibling (y 200) after the owner. */
  function ownerAndSibling(prefix: string) {
    const body = makeElement(`${prefix}-body`, { type: "body" });
    const owner = makeElement(`${prefix}-owner`, { parent_id: body.id });
    const tall = makeElement(`${prefix}-tall`, { parent_id: owner.id });
    const sibling = makeElement(`${prefix}-sibling`, { parent_id: body.id });
    registerNode(body.id, { width: 800, height: 600 });
    registerNode(owner.id, { width: 200, height: 100, clipChildren: true });
    registerNode(tall.id, { width: 150, height: 300 });
    registerNode(sibling.id, { width: 100, height: 50 });
    const record = () =>
      buildRenderCommandStream(
        [body.id],
        new Map([
          [body.id, [owner, sibling]],
          [owner.id, [tall]],
        ]),
        new Map([
          [owner.id, { x: 0, y: 0, width: 200, height: 100 } as ComputedLayout],
          [tall.id, { x: 0, y: 0, width: 150, height: 300 } as ComputedLayout],
          [
            sibling.id,
            { x: 0, y: 200, width: 100, height: 50 } as ComputedLayout,
          ],
        ]),
        { [body.id]: { x: 0, y: 0 } },
      );
    return { owner: owner.id, record };
  }

  it.each([
    [0, 150],
    [150, 0],
  ])(
    "offset %i 로 기록 → %i 로 실행: save − restore 0 · 형제는 스크롤 frame 을 물려받지 않는다",
    (from, to) => {
      const { owner, record } = ownerAndSibling(`h1-${from}-${to}`);
      setScrollNode(owner, { scrollTop: from, scrollLeft: 0 });
      const stream = record();
      setScrollNode(owner, { scrollTop: to, scrollLeft: 0 });
      const run = recordingCanvas();
      executeRenderCommands(ck, run.canvas, stream.commands, viewport);
      expect(run.balance).toBe(0);
      // The scroll the executor applied is the table's, not the recorded one.
      const scrolls = run.translates.filter((t) => t.x === 0 && t.y < 0);
      expect(scrolls.map((t) => t.y)).toEqual(to ? [-to] : []);
      // body (0,0) · owner (0,0) · … · sibling (0,200): owner and sibling sit at the same depth.
      const ownerMove = run.translates[1]!;
      const siblingMove = run.translates.find((t) => t.y === 200)!;
      expect([ownerMove.x, ownerMove.y]).toEqual([0, 0]);
      expect(siblingMove.depth).toBe(ownerMove.depth);
    },
  );

  it("중첩 scroll 안쪽만 바뀜: 안쪽 frame 만 열고 닫는다", () => {
    const body = makeElement("h1n-body", { type: "body" });
    const outer = makeElement("h1n-outer", { parent_id: body.id });
    const inner = makeElement("h1n-inner", { parent_id: outer.id });
    const leaf = makeElement("h1n-leaf", { parent_id: inner.id });
    registerNode(body.id, { width: 800, height: 600 });
    registerNode(outer.id, { width: 300, height: 200, clipChildren: true });
    registerNode(inner.id, { width: 200, height: 100, clipChildren: true });
    registerNode(leaf.id, { width: 100, height: 400 });
    const stream = buildRenderCommandStream(
      [body.id],
      new Map([
        [body.id, [outer]],
        [outer.id, [inner]],
        [inner.id, [leaf]],
      ]),
      new Map([
        [outer.id, { x: 0, y: 0, width: 300, height: 200 } as ComputedLayout],
        [inner.id, { x: 10, y: 10, width: 200, height: 100 } as ComputedLayout],
        [leaf.id, { x: 0, y: 0, width: 100, height: 400 } as ComputedLayout],
      ]),
      { [body.id]: { x: 0, y: 0 } },
    );
    setScrollNode(inner.id, { scrollTop: 40, scrollLeft: 0 });
    const run = recordingCanvas();
    executeRenderCommands(ck, run.canvas, stream.commands, viewport);
    expect(run.balance).toBe(0);
    expect(run.translates.filter((t) => t.y === -40)).toHaveLength(1);
  });

  it("scrollbar thumb 은 테이블의 위치에서 (높이 100 · 내용 300 · offset 150 → thumbY 50)", () => {
    const { owner, record } = ownerAndSibling("h1-bar");
    const bar = (thumbY: number) => ({
      width: 200,
      height: 100,
      scrollbar: {
        vertical: { trackHeight: 100, thumbHeight: 100 / 3, thumbY },
      },
    });
    setScrollNode(owner, { scrollTop: 0, scrollLeft: 0, bar: bar(0) });
    const stream = record();
    // What `canvasBinding` writes on a scroll (`catalogScrollbar(200, 100, range 200, 150)`).
    setScrollNode(owner, { scrollTop: 150, scrollLeft: 0, bar: bar(50) });
    const run = recordingCanvas();
    executeRenderCommands(ck, run.canvas, stream.commands, viewport);
    // track (0 … 100) then thumb (50 … 50 + 100/3) at x = 200 − 8 − 2.
    expect(run.rrects).toEqual([
      [190, 0, 198, 100],
      [190, 50, 198, 50 + 100 / 3],
    ]);
  });

  it("짝이 어긋난 실행은 dev 에서 멈춘다 (CHILDREN_END 만 · CHILDREN_BEGIN 만)", () => {
    const { record, owner } = ownerAndSibling("h1-pair");
    setScrollNode(owner, { scrollTop: 30, scrollLeft: 0 });
    const stream = record();
    const commands = Array.from(
      { length: stream.commands.length },
      (_, i) => stream.commands[i]!,
    );
    const begin = commands.findIndex((c) => c.type === 2);
    const end = commands.findIndex((c) => c.type === 3);
    const run = recordingCanvas();
    expect(() =>
      executeRenderCommands(
        ck,
        run.canvas,
        commands,
        viewport,
        undefined,
        undefined,
        undefined,
        undefined,
        { start: end },
      ),
    ).toThrow(/CHILDREN_END without/);
    expect(() =>
      executeRenderCommands(
        ck,
        run.canvas,
        commands,
        viewport,
        undefined,
        undefined,
        undefined,
        undefined,
        { end: begin + 1 },
      ),
    ).toThrow(/CHILDREN_BEGIN without/);
  });
});
