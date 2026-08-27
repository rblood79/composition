import type {
  CanvasKit,
  FillType,
  InputRect,
  InputRRect,
  Path,
  PathBuilder,
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

class PathSinkAdapter implements PathSink {
  constructor(private readonly target: PathBuilder) {}

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
  const builder = new ck.PathBuilder();
  try {
    build(new PathSinkAdapter(builder));
  } catch (error) {
    builder.delete();
    throw error;
  }
  return builder.detachAndDelete();
}
