/**
 * ADR-194 Phase 1 — `PathShape` → SkiaNodeData `path` 노드 변환 계약.
 *
 * G1: fill / stroke / evenodd / bbox(offset 포함) 4축.
 *
 * bbox 가 필수인 이유 (R9): `renderCommands.ts` 의 AABB 컬링은
 * `cmd.width > 0 || cmd.height > 0` 일 때만 동작하고, 노드 좌표계 원점에서
 * 재는 extent 로 판정한다. `d` 만 있는 노드는 0 크기로 취급돼 컬링·Picture 캐시
 * 키가 무너진다. 따라서 converter 는 `x + width` / `y + height` 를 노드
 * width/height 로 실어 실제 그려지는 영역의 **상위집합** AABB 를 만든다.
 */
import { describe, it, expect } from "vitest";
import { specShapesToSkia } from "./specShapeConverter";
import type { Shape } from "@composition/specs";

const TRIANGLE = "M 0 0 L 10 0 L 5 8 Z";

describe("specShapesToSkia — PathShape (ADR-194 Phase 1)", () => {
  it("fill 만 있는 path 는 fillColor 를 싣고 strokeColor 는 비운다", () => {
    const root = specShapesToSkia(
      [{ type: "path", d: TRIANGLE, width: 10, height: 8, fill: "#ff0000" }],
      "light",
      100,
      100,
    );
    const node = root.children?.[0];
    expect(node?.type).toBe("path");
    expect(node?.path?.d).toBe(TRIANGLE);
    expect(node?.path?.fillColor).toBeInstanceOf(Float32Array);
    expect(Array.from(node!.path!.fillColor!)).toEqual([1, 0, 0, 1]);
    expect(node?.path?.strokeColor).toBeUndefined();
  });

  it("stroke 만 있는 path 는 strokeColor/strokeWidth/cap/join 을 싣는다", () => {
    const root = specShapesToSkia(
      [
        {
          type: "path",
          d: TRIANGLE,
          width: 10,
          height: 8,
          stroke: "#0000ff",
          strokeWidth: 3,
          strokeCap: "square",
          strokeJoin: "bevel",
        },
      ],
      "light",
      100,
      100,
    );
    const node = root.children?.[0];
    expect(Array.from(node!.path!.strokeColor!)).toEqual([0, 0, 1, 1]);
    expect(node?.path?.strokeWidth).toBe(3);
    expect(node?.path?.strokeCap).toBe("square");
    expect(node?.path?.strokeJoin).toBe("bevel");
    expect(node?.path?.fillColor).toBeUndefined();
  });

  it("fillRule evenodd 를 그대로 운반한다 (기본은 미지정)", () => {
    const evenodd = specShapesToSkia(
      [
        {
          type: "path",
          d: TRIANGLE,
          width: 10,
          height: 8,
          fill: "#000000",
          fillRule: "evenodd",
        },
      ],
      "light",
      100,
      100,
    );
    expect(evenodd.children?.[0]?.path?.fillRule).toBe("evenodd");

    const nonzero = specShapesToSkia(
      [{ type: "path", d: TRIANGLE, width: 10, height: 8, fill: "#000000" }],
      "light",
      100,
      100,
    );
    expect(nonzero.children?.[0]?.path?.fillRule).toBeUndefined();
  });

  it("bbox — 노드 width/height 는 offset 을 포함한 원점 기준 extent (R9 컬링)", () => {
    const root = specShapesToSkia(
      [
        {
          type: "path",
          d: TRIANGLE,
          x: 40,
          y: 25,
          width: 10,
          height: 8,
          fill: "#000000",
        },
      ],
      "light",
      200,
      200,
    );
    const node = root.children?.[0];
    // 노드 자체는 부모 좌표계 원점에 서고(라인 shape 동형), 그려지는 위치는 offset 이 만든다.
    expect(node?.x).toBe(0);
    expect(node?.y).toBe(0);
    expect(node?.path?.offsetX).toBe(40);
    expect(node?.path?.offsetY).toBe(25);
    // AABB 는 [0,0,50,33] — 실제 그려지는 [40,25,50,33] 의 상위집합이라 오컬링이 없다.
    expect(node?.width).toBe(50);
    expect(node?.height).toBe(33);
    expect(node!.width > 0 || node!.height > 0).toBe(true);
  });

  it("offset 미지정 시 0 이고 width/height 는 bbox 그대로", () => {
    const root = specShapesToSkia(
      [{ type: "path", d: TRIANGLE, width: 10, height: 8, fill: "#000000" }],
      "light",
      100,
      100,
    );
    const node = root.children?.[0];
    expect(node?.path?.offsetX).toBe(0);
    expect(node?.path?.offsetY).toBe(0);
    expect(node?.width).toBe(10);
    expect(node?.height).toBe(8);
  });
});
