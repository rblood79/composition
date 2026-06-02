import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

// 리프 Button 의 generic 렌더 경로는 renderContext 를 사용하지 않는다(자식 재귀 없음).
const ctx = {} as unknown as RenderContext;

describe("CanonicalNodeRenderer — ADR-142 catalog generic 경로 (#3)", () => {
  it("cutover 된 Button 을 toRacProps → RAC Button 으로 렌더한다 (data-* + 텍스트 + 마커 on button)", () => {
    const node: ResolvedNode = {
      id: "btn-1",
      type: "Button",
      props: { children: "OK", variant: "secondary", size: "lg" },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Button"])}
      />,
    );

    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn?.textContent).toBe("OK");
    // variant/size → data-* (theme 가 값 적용)
    expect(btn?.getAttribute("data-variant")).toBe("secondary");
    expect(btn?.getAttribute("data-size")).toBe("lg");
    // type default "button"
    expect(btn?.getAttribute("type")).toBe("button");
    // generic 경로는 마커를 RAC primitive 에 직접 부착 (legacy 는 wrapper div)
    expect(btn?.getAttribute("data-canonical-id")).toBe("btn-1");
    // RAC Button 기본 className → generated CSS selector 매칭 가능
    expect(btn?.className).toContain("react-aria-Button");
  });

  // ADR-912 1A-(b): cutover 경로의 props.style override 상실 seam 닫기 검증.
  it("cutover 된 Button 의 props.style override 가 DOM 인라인 style 로 반영된다 (toReactStyle)", () => {
    const node: ResolvedNode = {
      id: "btn-2",
      type: "Button",
      props: {
        children: "Styled",
        variant: "primary",
        size: "md",
        style: { fontSize: "20px", color: "rgb(255, 0, 0)" },
      },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Button"])}
      />,
    );

    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    // override 가 인라인 style 로 적용 (이전엔 cutover 경로가 style 누락 → 상실)
    expect(btn?.style.fontSize).toBe("20px");
    expect(btn?.style.color).toBe("rgb(255, 0, 0)");
    // base 색/size 는 generated CSS(data-*) 채널 — override 와 별도로 data-* 유지
    expect(btn?.getAttribute("data-variant")).toBe("primary");
    expect(btn?.getAttribute("data-size")).toBe("md");
  });

  it("props.style 부재 시 cutover Button 에 빈 인라인 style 을 강제하지 않는다", () => {
    const node: ResolvedNode = {
      id: "btn-3",
      type: "Button",
      props: { children: "Plain", variant: "primary", size: "md" },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Button"])}
      />,
    );

    const btn = container.querySelector("button");
    // toReactStyle 이 override 없을 때 undefined → 인라인 style 미주입.
    expect(btn?.getAttribute("style")).toBeNull();
  });
});
