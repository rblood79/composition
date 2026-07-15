import { describe, expect, it } from "vitest";

import { buildBoxNodeData } from "../buildBoxNodeData";
import type { CanvasSceneNode } from "../../scene/canvasSceneNode";
import type { ComputedLayout } from "../../layout/engines/LayoutEngine";

/**
 * Phase 2 — box(div) 경로 border-style 배선 회귀 테스트.
 *
 * 확정 결함: buildBoxNodeData 가 box.strokeStyle 키를 방출하지 않아, 렌더러가
 * 8종 style 을 지원함에도 div 의 dashed/dotted 등이 solid 로만 그려졌다. 수정:
 * style.borderStyle → box.strokeStyle emit. "none" 은 stroke 자체를 억제(DOM 대칭).
 */
const layout: ComputedLayout = {
  x: 0,
  y: 0,
  width: 100,
  height: 50,
} as unknown as ComputedLayout;

function build(style: Record<string, unknown>) {
  const element = {
    id: "n1",
    props: { style },
  } as unknown as CanvasSceneNode;
  return buildBoxNodeData({ element, layout });
}

describe("buildBoxNodeData — border-style 배선 (Phase 2)", () => {
  it("style.borderStyle=dashed → box.strokeStyle=dashed", () => {
    const node = build({
      borderColor: "#ff0000",
      borderWidth: 2,
      borderStyle: "dashed",
    });
    expect(node?.box?.strokeStyle).toBe("dashed");
    expect(node?.box?.strokeWidth).toBe(2);
    expect(node?.box?.strokeColor).toBeDefined();
  });

  it("확장 style(double 등)도 box.strokeStyle 로 통과", () => {
    const node = build({
      borderColor: "#00ff00",
      borderWidth: 4,
      borderStyle: "double",
    });
    expect(node?.box?.strokeStyle).toBe("double");
  });

  it("style.borderStyle=solid → strokeStyle 키 생략(렌더러 기본값) + stroke 유지", () => {
    const node = build({
      borderColor: "#0000ff",
      borderWidth: 1,
      borderStyle: "solid",
    });
    expect(node?.box?.strokeStyle).toBeUndefined();
    expect(node?.box?.strokeColor).toBeDefined();
    expect(node?.box?.strokeWidth).toBe(1);
  });

  it("style.borderStyle=none → stroke 억제 (DOM border-style:none 대칭)", () => {
    const node = build({
      borderColor: "#ff0000",
      borderWidth: 2,
      borderStyle: "none",
    });
    expect(node?.box?.strokeColor).toBeUndefined();
    expect(node?.box?.strokeWidth).toBeUndefined();
    expect(node?.box?.strokeStyle).toBeUndefined();
  });
});
