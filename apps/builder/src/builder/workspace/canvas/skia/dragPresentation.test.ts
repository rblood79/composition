import type { Canvas, CanvasKit, Image as SkImage } from "canvaskit-wasm";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDragPresentationNode,
  buildDragPresentationPlan,
  collectDragPictureDependencies,
} from "./dragPresentation";
import type { RenderCommand, RenderCommandStream } from "./renderCommands";
import { setDragVisualOffset } from "./nodeRendererTree";
import { clearNodePictureCache, setVolatileNodeIds } from "./nodePictureCache";
import { drainPendingWasmDisposals } from "./deferredDisposal";

function elementCommands(elementId: string): RenderCommand[] {
  return [
    {
      type: 0,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      elementId,
      visible: true,
    },
    { type: 4, hasBlend: false, effectLayerCount: 0 },
  ];
}

function makeStream(trailingCommand = false): RenderCommandStream {
  const commands = [
    ...elementCommands("background"),
    ...elementCommands("drag-root"),
  ];
  if (trailingCommand) commands.push(...elementCommands("unexpected-tail"));
  return {
    commands,
    subtreeSpans: new Map([["drag-root", { start: 2, end: 4 }]]),
    topLayerElementIds: new Set(["drag-root"]),
    subtreeBuildContextByElement: new Map([
      ["drag-root", { parentElementId: null }],
    ]),
  } as unknown as RenderCommandStream;
}

function makeCanvasKitStub() {
  let recordCount = 0;
  const pictureDelete = vi.fn();
  const recordingCanvas = {
    save() {},
    restore() {},
    translate() {},
    concat() {},
    clipRect() {},
    clipPath() {},
    saveLayer() {},
  } as unknown as Canvas;

  class StubPictureRecorder {
    constructor() {
      recordCount += 1;
    }
    beginRecording() {
      return recordingCanvas;
    }
    finishRecordingAsPicture() {
      return { delete: pictureDelete };
    }
    delete() {}
  }

  class StubPaint {
    setAlphaf() {}
    setAntiAlias() {}
    setStyle() {}
    setColor() {}
    setStrokeWidth() {}
    setStrokeCap() {}
    setStrokeJoin() {}
    setBlendMode() {}
    setPathEffect() {}
    setShader() {}
    setImageFilter() {}
    setColorFilter() {}
    delete() {}
  }

  const ck = {
    PictureRecorder: StubPictureRecorder,
    Paint: StubPaint,
    LTRBRect: () => new Float32Array(4),
    PaintStyle: { Fill: 0 },
    StrokeCap: { Butt: 0 },
    StrokeJoin: { Miter: 0 },
    BlendMode: { SrcOver: 0 },
    BLACK: new Float32Array(4),
  } as unknown as CanvasKit;
  return { ck, recordCount: () => recordCount, pictureDelete };
}

afterEach(() => {
  setDragVisualOffset(null, 0, 0, true);
  setVolatileNodeIds(null);
  clearNodePictureCache();
  drainPendingWasmDisposals();
});

describe("retained drag subtree presentation", () => {
  it("image mask를 subtree picture의 SkImage 의존성으로 수집한다", () => {
    const maskImage = {} as SkImage;
    const resolveImage = vi.fn(() => maskImage);
    const commands = [
      {
        ...elementCommands("drag-root")[0],
        maskImage: {
          type: "image",
          imageUrl: "https://example.com/mask.png",
          mode: "alpha",
        },
      },
      elementCommands("drag-root")[1],
    ] as RenderCommand[];

    const dependencies = collectDragPictureDependencies(
      commands,
      0,
      commands.length,
      resolveImage,
    );

    expect(resolveImage).toHaveBeenCalledWith("https://example.com/mask.png");
    expect(dependencies.imageRefs).toEqual([maskImage]);
    expect(dependencies.elementIds).toEqual(new Set(["drag-root"]));
  });

  it("top-layer drag spans가 command tail일 때 정적 background 경계를 만든다", () => {
    setDragVisualOffset("drag-root", 10, 20, true);

    expect(buildDragPresentationPlan(makeStream(), 7)).toMatchObject({
      registryVersion: 7,
      backgroundCommandEnd: 2,
      roots: [{ elementId: "drag-root", start: 2, end: 4 }],
    });
  });

  it("drag span 뒤에 command가 남으면 full-content 폴백한다", () => {
    setDragVisualOffset("drag-root", 10, 20, true);

    expect(buildDragPresentationPlan(makeStream(true), 7)).toBeNull();
  });

  it("pointer delta 변경은 subtree를 다시 record하지 않고 picture translate만 바꾼다", () => {
    const { ck, recordCount } = makeCanvasKitStub();
    const translations: Array<[number, number]> = [];
    const drawPicture = vi.fn();
    const canvas = {
      save() {},
      restore() {},
      saveLayer() {},
      translate(dx: number, dy: number) {
        translations.push([dx, dy]);
      },
      drawPicture,
    } as unknown as Canvas;

    setDragVisualOffset("drag-root", 10, 20, true);
    const plan = buildDragPresentationPlan(makeStream(), 7);
    expect(plan).not.toBeNull();
    const node = buildDragPresentationNode(ck, plan!, undefined, new Map());

    node.renderSkia(canvas, { x: 0, y: 0, width: 800, height: 600 } as DOMRect);
    setDragVisualOffset("drag-root", 30, 40, true);
    node.renderSkia(canvas, { x: 0, y: 0, width: 800, height: 600 } as DOMRect);

    expect(recordCount()).toBe(1);
    expect(drawPicture).toHaveBeenCalledTimes(2);
    expect(translations).toEqual([
      [10, 20],
      [30, 40],
    ]);
  });

  it("animation volatile descendant가 있으면 retained picture를 다시 record한다", () => {
    const { ck, recordCount } = makeCanvasKitStub();
    const canvas = {
      save() {},
      restore() {},
      saveLayer() {},
      translate() {},
      drawPicture() {},
    } as unknown as Canvas;

    setDragVisualOffset("drag-root", 10, 20, true);
    const plan = buildDragPresentationPlan(makeStream(), 7)!;
    const node = buildDragPresentationNode(ck, plan, undefined, new Map());
    node.renderSkia(canvas, {} as DOMRect);

    setVolatileNodeIds(new Set(["drag-root"]));
    node.renderSkia(canvas, {} as DOMRect);

    expect(recordCount()).toBe(2);
  });
});
