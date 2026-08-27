import { describe, expect, it, vi } from "vitest";
import type {
  CanvasKit,
  FillType,
  InputRect,
  InputRRect,
  Path,
} from "canvaskit-wasm";
import { buildPath, type PathSink } from "./buildPath";

const RECT = [0, 0, 20, 20] as unknown as InputRect;
const RRECT = [0, 0, 20, 20, 2, 2, 2, 2, 2, 2, 2, 2] as unknown as InputRRect;
const FILL = 1 as unknown as FillType;

class RecordingPathTarget {
  readonly calls: string[] = [];
  readonly delete = vi.fn();

  moveTo(x: number, y: number): unknown {
    this.calls.push(`moveTo:${x},${y}`);
    return this;
  }

  lineTo(x: number, y: number): unknown {
    this.calls.push(`lineTo:${x},${y}`);
    return this;
  }

  quadTo(x1: number, y1: number, x2: number, y2: number): unknown {
    this.calls.push(`quadTo:${x1},${y1},${x2},${y2}`);
    return this;
  }

  cubicTo(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ): unknown {
    this.calls.push(`cubicTo:${x1},${y1},${x2},${y2},${x},${y}`);
    return this;
  }

  arcToTangent(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radius: number,
  ): unknown {
    this.calls.push(`arcToTangent:${x1},${y1},${x2},${y2},${radius}`);
    return this;
  }

  addRect(rect: InputRect): unknown {
    expect(rect).toBe(RECT);
    this.calls.push("addRect");
    return this;
  }

  addRRect(rrect: InputRRect): unknown {
    expect(rrect).toBe(RRECT);
    this.calls.push("addRRect");
    return this;
  }

  addCircle(cx: number, cy: number, radius: number): unknown {
    this.calls.push(`addCircle:${cx},${cy},${radius}`);
    return this;
  }

  addOval(oval: InputRect): unknown {
    expect(oval).toBe(RECT);
    this.calls.push("addOval");
    return this;
  }

  addArc(oval: InputRect, startDeg: number, sweepDeg: number): unknown {
    expect(oval).toBe(RECT);
    this.calls.push(`addArc:${startDeg},${sweepDeg}`);
    return this;
  }

  setFillType(fill: FillType): unknown {
    expect(fill).toBe(FILL);
    this.calls.push("setFillType");
    return undefined;
  }

  close(): unknown {
    this.calls.push("close");
    return { not: "the sink" };
  }
}

class RecordingPathBuilder extends RecordingPathTarget {
  readonly detachAndDelete: ReturnType<typeof vi.fn<() => Path>>;

  constructor(path: Path) {
    super();
    this.detachAndDelete = vi.fn(() => path);
  }
}

function exerciseAllMutators(sink: PathSink): void {
  expect(sink.moveTo(1, 2)).toBe(sink);
  expect(sink.lineTo(3, 4)).toBe(sink);
  expect(sink.quadTo(5, 6, 7, 8)).toBe(sink);
  expect(sink.cubicTo(9, 10, 11, 12, 13, 14)).toBe(sink);
  expect(sink.arcToTangent(15, 16, 17, 18, 19)).toBe(sink);
  expect(sink.addRect(RECT)).toBe(sink);
  expect(sink.addRRect(RRECT)).toBe(sink);
  expect(sink.addCircle(20, 21, 22)).toBe(sink);
  expect(sink.addOval(RECT)).toBe(sink);
  expect(sink.addArc(RECT, 23, 24)).toBe(sink);
  expect(sink.setFillType(FILL)).toBe(sink);
  expect(sink.close()).toBe(sink);
}

describe("buildPath", () => {
  it("PathBuilder가 있으면 모든 mutator를 순서대로 위임하고 완성 Path를 반환한다", () => {
    const completedPath = { kind: "immutable-path" } as unknown as Path;
    let builder: RecordingPathBuilder | undefined;
    const captureBuilder = (created: RecordingPathBuilder): void => {
      builder = created;
    };
    let pathBuilderConstructCount = 0;
    class PathBuilder extends RecordingPathBuilder {
      constructor() {
        super(completedPath);
        pathBuilderConstructCount += 1;
        captureBuilder(this);
      }
    }
    const PathConstructor = vi.fn();
    const ck = {
      Path: PathConstructor,
      PathBuilder,
    } as unknown as CanvasKit;

    const result = buildPath(ck, exerciseAllMutators);

    expect(result).toBe(completedPath);
    expect(pathBuilderConstructCount).toBe(1);
    expect(PathConstructor).not.toHaveBeenCalled();
    expect(builder?.calls).toEqual([
      "moveTo:1,2",
      "lineTo:3,4",
      "quadTo:5,6,7,8",
      "cubicTo:9,10,11,12,13,14",
      "arcToTangent:15,16,17,18,19",
      "addRect",
      "addRRect",
      "addCircle:20,21,22",
      "addOval",
      "addArc:23,24",
      "setFillType",
      "close",
    ]);
    expect(builder?.detachAndDelete).toHaveBeenCalledTimes(1);
    expect(builder?.delete).not.toHaveBeenCalled();
  });

  it("PathBuilder callback이 throw하면 builder를 delete하고 원래 오류를 다시 던진다", () => {
    const completedPath = {} as Path;
    let builder: RecordingPathBuilder | undefined;
    const captureBuilder = (created: RecordingPathBuilder): void => {
      builder = created;
    };
    class PathBuilder extends RecordingPathBuilder {
      constructor() {
        super(completedPath);
        captureBuilder(this);
      }
    }
    const ck = { PathBuilder } as unknown as CanvasKit;
    const error = new Error("build failed");

    expect(() =>
      buildPath(ck, () => {
        throw error;
      }),
    ).toThrow(error);
    expect(builder?.delete).toHaveBeenCalledTimes(1);
    expect(builder?.detachAndDelete).not.toHaveBeenCalled();
  });

  it("PathBuilder가 없으면 0.40 Path를 한 번 생성해 동일 sink 계약으로 반환한다", () => {
    let path: RecordingPathTarget | undefined;
    const capturePath = (created: RecordingPathTarget): void => {
      path = created;
    };
    let pathConstructCount = 0;
    class PathConstructor extends RecordingPathTarget {
      constructor() {
        super();
        pathConstructCount += 1;
        capturePath(this);
      }
    }
    const ck = { Path: PathConstructor } as unknown as CanvasKit;

    const result = buildPath(ck, (sink) => {
      expect(sink.moveTo(1, 2)).toBe(sink);
      expect(sink.close()).toBe(sink);
      expect(sink.setFillType(FILL)).toBe(sink);
    });

    expect(pathConstructCount).toBe(1);
    expect(result).toBe(path);
    expect(path?.calls).toEqual(["moveTo:1,2", "close", "setFillType"]);
    expect(path?.delete).not.toHaveBeenCalled();
  });
});
