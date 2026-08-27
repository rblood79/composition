import type {
  CanvasKit,
  FillType,
  InputRect,
  InputRRect,
  Path,
} from "canvaskit-wasm";

export interface PathSink {
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  quadTo(x1: number, y1: number, x2: number, y2: number): this;
  cubicTo(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ): this;
  arcToTangent(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radius: number,
  ): this;
  addRect(rect: InputRect): this;
  addRRect(rrect: InputRRect): this;
  addCircle(cx: number, cy: number, radius: number): this;
  addOval(oval: InputRect): this;
  addArc(oval: InputRect, startDeg: number, sweepDeg: number): this;
  setFillType(fill: FillType): this;
  close(): this;
}

interface MutablePathLike {
  moveTo(x: number, y: number): unknown;
  lineTo(x: number, y: number): unknown;
  quadTo(x1: number, y1: number, x2: number, y2: number): unknown;
  cubicTo(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ): unknown;
  arcToTangent(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radius: number,
  ): unknown;
  addRect(rect: InputRect): unknown;
  addRRect(rrect: InputRRect): unknown;
  addCircle(cx: number, cy: number, radius: number): unknown;
  addOval(oval: InputRect): unknown;
  addArc(oval: InputRect, startDeg: number, sweepDeg: number): unknown;
  setFillType(fill: FillType): unknown;
  close(): unknown;
}

// canvaskit-wasm 0.40.0에는 PathBuilder 타입이 없으므로 Phase 3 version bump 전까지
// 이 파일 안에서만 0.42.0의 필요한 표면을 구조적으로 표현한다.
interface PathBuilderLike extends MutablePathLike {
  detachAndDelete(): Path;
  delete(): void;
}

class PathSinkAdapter implements PathSink {
  constructor(private readonly target: MutablePathLike) {}

  moveTo(x: number, y: number): this {
    this.target.moveTo(x, y);
    return this;
  }

  lineTo(x: number, y: number): this {
    this.target.lineTo(x, y);
    return this;
  }

  quadTo(x1: number, y1: number, x2: number, y2: number): this {
    this.target.quadTo(x1, y1, x2, y2);
    return this;
  }

  cubicTo(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ): this {
    this.target.cubicTo(x1, y1, x2, y2, x, y);
    return this;
  }

  arcToTangent(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radius: number,
  ): this {
    this.target.arcToTangent(x1, y1, x2, y2, radius);
    return this;
  }

  addRect(rect: InputRect): this {
    this.target.addRect(rect);
    return this;
  }

  addRRect(rrect: InputRRect): this {
    this.target.addRRect(rrect);
    return this;
  }

  addCircle(cx: number, cy: number, radius: number): this {
    this.target.addCircle(cx, cy, radius);
    return this;
  }

  addOval(oval: InputRect): this {
    this.target.addOval(oval);
    return this;
  }

  addArc(oval: InputRect, startDeg: number, sweepDeg: number): this {
    this.target.addArc(oval, startDeg, sweepDeg);
    return this;
  }

  setFillType(fill: FillType): this {
    this.target.setFillType(fill);
    return this;
  }

  close(): this {
    // 0.42.0 런타임은 선언과 달리 builder를 반환한다. ownership 신호로 쓰지 않는다.
    this.target.close();
    return this;
  }
}

/** 완성된 immutable Path를 반환한다. delete 책임은 caller 또는 scope.track에 있다. */
export function buildPath(
  ck: CanvasKit,
  build: (sink: PathSink) => void,
): Path {
  const PathBuilder = (
    ck as CanvasKit & {
      PathBuilder?: new () => PathBuilderLike;
    }
  ).PathBuilder;

  if (typeof PathBuilder === "function") {
    const builder = new PathBuilder();
    try {
      build(new PathSinkAdapter(builder));
    } catch (error) {
      builder.delete();
      throw error;
    }
    return builder.detachAndDelete();
  }

  const path = new ck.Path();
  try {
    build(new PathSinkAdapter(path));
    return path;
  } catch (error) {
    path.delete();
    throw error;
  }
}
