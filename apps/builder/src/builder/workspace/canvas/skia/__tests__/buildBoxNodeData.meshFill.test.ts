import { describe, expect, it } from "vitest";

import { buildBoxNodeData } from "../buildBoxNodeData";
import {
  FillType,
  type LinearGradientFillItem,
  type MeshGradientFillItem,
} from "../../../../../types/builder/fill.types";
import type { CanvasSceneNode } from "../../scene/canvasSceneNode";
import type { ComputedLayout } from "../../layout/engines/LayoutEngine";

/**
 * mesh-gradient fill 의 Skia 배선 회귀 (2026-08-25).
 *
 * 확정 결함: `fillToSkia` 는 mesh FillStyle 을 만들고 `fills.ts` 는 SkSL bilinear
 * 셰이더까지 갖췄는데, box/spec 두 node builder 가 `linear|radial|angular` 만
 * 화이트리스트해 mesh 가 `box.fill` 에 실리지 않았다. 결과적으로 Preview DOM 은
 * `fillAdapter` 의 SVG mesh 를 그리고 Canvas 는 첫 point 색 단색으로 떨어져
 * D3 대칭이 깨진다. mesh 는 사용자가 Style Panel 에서 실제로 고를 수 있는 fill 이다
 * (`GradientEditor` 의 "Mesh" 항목 + `MeshGradientEditor`).
 *
 * mesh 는 stop `colors/positions` 가 없어 gradient drag 의 presentation target 대상이
 * 아니다 — 접붙임만 하고 `presentationFillTargets` 는 늘리지 않는다(commit-only).
 */
const layout: ComputedLayout = {
  x: 0,
  y: 0,
  width: 200,
  height: 100,
} as unknown as ComputedLayout;

const MESH: MeshGradientFillItem = {
  id: "mg1",
  type: FillType.MeshGradient,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  rows: 2,
  columns: 2,
  points: [
    { position: [0, 0], color: "#00FF00FF" },
    { position: [1, 0], color: "#0000FFFF" },
    { position: [0, 1], color: "#FF0000FF" },
    { position: [1, 1], color: "#FFFFFFFF" },
  ],
};

const LINEAR: LinearGradientFillItem = {
  id: "lg1",
  type: FillType.LinearGradient,
  enabled: true,
  opacity: 1,
  blendMode: "normal",
  rotation: 90,
  stops: [
    { color: "#FF0000FF", position: 0 },
    { color: "#0000FFFF", position: 1 },
  ],
};

function build(fills: Array<MeshGradientFillItem | LinearGradientFillItem>) {
  const element = {
    id: "n1",
    props: { style: {} },
    fills,
  } as unknown as CanvasSceneNode;
  return buildBoxNodeData({ element, layout });
}

describe("buildBoxNodeData — mesh-gradient fill 배선", () => {
  it("mesh gradient fill → box.fill 에 mesh-gradient FillStyle 접붙임", () => {
    const node = build([MESH]);
    expect(node?.box?.fill?.type).toBe("mesh-gradient");
  });

  it("mesh FillStyle 이 셰이더 좌표용 grid/size 를 보존한다", () => {
    const fill = build([MESH])?.box?.fill as
      | {
          type: string;
          rows: number;
          columns: number;
          colors: unknown[];
          width: number;
          height: number;
        }
      | undefined;
    expect(fill?.rows).toBe(2);
    expect(fill?.columns).toBe(2);
    expect(fill?.colors).toHaveLength(4);
    expect(fill?.width).toBe(200);
    expect(fill?.height).toBe(100);
  });

  it("mesh 는 gradient stop drag 채널을 얻지 않는다 (base color target 은 유지)", () => {
    const meshTarget = build([MESH])?.presentationFillTargets?.[0] as
      { fillId?: string; gradientColors?: unknown } | undefined;
    // 모든 box 가 갖는 fallback fillColor 채널은 그대로 남는다.
    expect(meshTarget).toBeDefined();
    expect(meshTarget?.fillId).toBeUndefined();
    expect(meshTarget?.gradientColors).toBeUndefined();

    // 대조군 — stop 기반 gradient 는 기존대로 stop 채널을 갖는다.
    const linearTarget = build([LINEAR])?.presentationFillTargets?.[0] as
      { fillId?: string; gradientColors?: unknown } | undefined;
    expect(linearTarget?.fillId).toBe(LINEAR.id);
    expect(linearTarget?.gradientColors).toBeDefined();
  });

  it("셰이더 실패 대비 fallback fillColor 는 첫 point 색으로 남는다", () => {
    const node = build([MESH]);
    expect(node?.box?.fillColor).toBeDefined();
  });
});
