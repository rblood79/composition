import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

/**
 * Background(fills) canonical Preview 회귀 테스트 (2026-07-15).
 *
 * canonical 전환 때 CanonicalNodeRenderer 가 `fills: []` 하드코딩으로
 * (1) canonical node 의 fills 를 버리고, (2) truthy 빈 배열이
 * adaptStyleWithFills 의 delete 분기를 타서 사용자 style.background* 까지
 * 능동 소거하던 결함의 재발 차단. fills 는 canonical 1차 필드에서 운반된다.
 */

const ctx = {} as unknown as RenderContext;

// canonical page shell 계열이 아닌 일반 컨테이너로 generic div 경로를 태운다.
const FRAME_TYPE = "frame" as ResolvedNode["type"];

function renderNode(node: ResolvedNode) {
  return render(
    <CanonicalNodeRenderer
      node={node}
      renderContext={ctx}
      cutoverPrimitives={new Set()}
    />,
  );
}

describe("CanonicalNodeRenderer — canonical fills 배경 렌더", () => {
  it("canonical node.fills 의 color fill 을 backgroundColor 로 렌더한다", () => {
    const node: ResolvedNode = {
      id: "frame-fill",
      type: FRAME_TYPE,
      props: { style: { display: "block" } },
      fills: [
        {
          id: "fill-1",
          type: "color",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
          color: "#112233FF",
        },
      ],
    };

    const { container } = renderNode(node);
    const el = container.querySelector(
      "[data-canonical-id='frame-fill']",
    ) as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.style.backgroundColor).toBe("rgb(17, 34, 51)");
  });

  it("fills 미보유 node 의 style.backgroundColor 를 보존한다 (빈 배열 소거 회귀)", () => {
    const node: ResolvedNode = {
      id: "frame-style-bg",
      type: FRAME_TYPE,
      props: { style: { display: "block", backgroundColor: "#ABCDEF" } },
    };

    const { container } = renderNode(node);
    const el = container.querySelector(
      "[data-canonical-id='frame-style-bg']",
    ) as HTMLElement | null;
    expect(el).not.toBeNull();
    expect(el!.style.backgroundColor).toBe("rgb(171, 205, 239)");
  });

  it("fills 가 style.backgroundColor 보다 우선한다", () => {
    const node: ResolvedNode = {
      id: "frame-priority",
      type: FRAME_TYPE,
      props: { style: { display: "block", backgroundColor: "#000000" } },
      fills: [
        {
          id: "fill-1",
          type: "color",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
          color: "#FF0000FF",
        },
      ],
    };

    const { container } = renderNode(node);
    const el = container.querySelector(
      "[data-canonical-id='frame-priority']",
    ) as HTMLElement | null;
    expect(el!.style.backgroundColor).toBe("rgb(255, 0, 0)");
  });
});
