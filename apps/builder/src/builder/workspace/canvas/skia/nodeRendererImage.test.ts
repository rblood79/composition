import { beforeEach, describe, expect, it } from "vitest";
import type { CanvasKit, Canvas } from "canvaskit-wasm";
import { renderImage } from "./nodeRendererImage";
import type { SkiaNodeData } from "./nodeRendererTypes";

/**
 * renderImage — 로드된 이미지 경로의 배경 fill 계약 (2026-08-14 fix)
 *
 * DOM oracle: `.react-aria-Image` 배경(사용자 지정 또는 muted 기본)은 이미지 **뒤**에
 * 항상 그려진다. 구 Skia 는 skImage 로드 경로에서 `drawImageRect` 만 호출해 배경이
 * 통째로 빠졌다 (object-fit contain/none 여백·투명 PNG 에서 가시 발산).
 *
 * 계약: box.fillColor alpha > 0 이면 drawImageRect **전에** 배경 rect, alpha 0
 * (transparent 배경) 이면 배경 skip.
 */

class MockPaint {
  color: Float32Array | unknown = null;
  setAntiAlias(): void {}
  setStyle(): void {}
  setColor(c: unknown): void {
    // 풀 재사용으로 draw 후 색이 리셋될 수 있어 스냅샷 복사
    this.color = c instanceof Float32Array ? Float32Array.from(c) : c;
  }
  setStrokeWidth(): void {}
  setStrokeCap(): void {}
  setStrokeJoin(): void {}
  setBlendMode(): void {}
  setPathEffect(): void {}
  setShader(): void {}
  setImageFilter(): void {}
  setColorFilter(): void {}
  delete(): void {}
}

interface DrawOp {
  op: "drawRect" | "drawImageRect";
  color?: Float32Array;
}

class MockPath {
  moveTo(): void {}
  lineTo(): void {}
  close(): void {}
  delete(): void {}
}

function makeMockCk(): CanvasKit {
  return {
    Paint: MockPaint,
    Path: MockPath,
    PaintStyle: { Fill: 0, Stroke: 1 },
    StrokeCap: { Butt: 0 },
    StrokeJoin: { Miter: 0 },
    BlendMode: { SrcOver: 0 },
    BLACK: Float32Array.of(0, 0, 0, 1),
    ClipOp: { Intersect: 1 },
    LTRBRect: (l: number, t: number, r: number, b: number) => [l, t, r, b],
    Color: (r: number, g: number, b: number, a: number) =>
      Float32Array.of(r / 255, g / 255, b / 255, a),
  } as unknown as CanvasKit;
}

function makeRecordingCanvas(ops: DrawOp[]): Canvas {
  return {
    save(): void {},
    restore(): void {},
    clipRect(): void {},
    clipRRect(): void {},
    clipPath(): void {},
    drawRect(_rect: unknown, paint: MockPaint): void {
      ops.push({
        op: "drawRect",
        color:
          paint.color instanceof Float32Array
            ? Float32Array.from(paint.color)
            : undefined,
      });
    },
    drawImageRect(): void {
      ops.push({ op: "drawImageRect" });
    },
    drawPath(): void {},
  } as unknown as Canvas;
}

function makeLoadedNode(
  fillColor: Float32Array,
  deleted = false,
): SkiaNodeData {
  return {
    type: "image",
    elementId: "img-1",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    visible: true,
    box: { fillColor, borderRadius: 0 },
    image: {
      skImage: {
        width: () => 40,
        height: () => 40,
        isDeleted: () => deleted,
      } as unknown as NonNullable<SkiaNodeData["image"]>["skImage"],
      contentX: 50,
      contentY: 10,
      contentWidth: 80,
      contentHeight: 80,
    },
  } as SkiaNodeData;
}

describe("renderImage — 로드 경로 배경 fill", () => {
  let ops: DrawOp[];
  let ck: CanvasKit;

  beforeEach(() => {
    ops = [];
    ck = makeMockCk();
  });

  it("box.fillColor alpha > 0 이면 이미지 전에 배경 rect 를 그린다", () => {
    const fill = Float32Array.of(1, 0, 0, 1);
    renderImage(ck, makeRecordingCanvas(ops), makeLoadedNode(fill));

    const kinds = ops.map((o) => o.op);
    expect(kinds).toEqual(["drawRect", "drawImageRect"]);
    expect(Array.from(ops[0].color!)).toEqual([1, 0, 0, 1]);
  });

  it("alpha 0 (transparent) 이면 배경 skip — 이미지만", () => {
    const fill = Float32Array.of(0, 0, 0, 0);
    renderImage(ck, makeRecordingCanvas(ops), makeLoadedNode(fill));

    expect(ops.map((o) => o.op)).toEqual(["drawImageRect"]);
  });

  /**
   * 노드 데이터는 SkImage 를 핸들로 보관한다. specShapeConverter 경로는 참조를
   * 소유하지 않은 채 핸들만 실으므로 그 사이 캐시 퇴거가 일어나면 폐기된 핸들이
   * 남는다. 폐기 핸들에 `.width()` 를 부르면 WASM 이 크래시하므로 placeholder 로
   * 떨어져야 한다.
   */
  it("폐기된 SkImage 핸들이면 그리지 않고 placeholder 로 떨어진다", () => {
    const fill = Float32Array.of(1, 0, 0, 1);
    const node = makeLoadedNode(fill, true);
    (node.image as NonNullable<SkiaNodeData["image"]>).skImage!.width =
      (): number => {
        throw new Error("Cannot pass deleted object as a pointer");
      };

    expect(() => renderImage(ck, makeRecordingCanvas(ops), node)).not.toThrow();
    expect(ops.map((o) => o.op)).not.toContain("drawImageRect");
    // placeholder 배경 rect 는 그려진다
    expect(ops.map((o) => o.op)).toContain("drawRect");
  });
});
