import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

/**
 * D3 대칭 정합(2026-07-15): canonical body 노드는 Skia 아트보드(페이지 프레임 높이)를 채우지만,
 * canonical DOM 경로는 body 를 중첩 <div> 로 렌더하며 element.props.style(height 無)만 얹어
 * display:block content-fit 로 collapse → Skia body 박스(예 844) vs DOM(예 96) 비대칭.
 * body 배경/테두리가 있으면 Builder↔Preview 가 시각적으로 갈리므로(대칭 위반),
 * viewport(=preview iframe=device frame=Skia artboard) 기준 min-height:100vh 로 정합한다.
 *
 * 라이브 실측(Chrome MCP): %-height 는 상위 frame 이 auto height 라 cascade 가 0 처리되어
 * body=96 유지, 100vh 는 body=844 로 fill → 100vh 필수. 콘텐츠 좌표는 layout map 공유로 불변.
 */

const ctx = {} as unknown as RenderContext;

// canonical page shell 의 runtime type 은 소문자 "body" 인데 ComponentTag
// vocabulary 에는 "Body" 만 등재 — vocabulary 정리 전까지 fixture 에서 cast.
const BODY_TYPE = "body" as ResolvedNode["type"];

describe("CanonicalNodeRenderer — body 아트보드 정합(min-height:100vh)", () => {
  it("height/minHeight 미지정 body 노드에 min-height:100vh 를 주입한다", () => {
    const node: ResolvedNode = {
      id: "body-1",
      type: BODY_TYPE,
      props: { style: { display: "block" } },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set()}
      />,
    );

    const body = container.querySelector(
      "[data-canonical-id='body-1']",
    ) as HTMLElement | null;
    expect(body).not.toBeNull();
    expect(body!.style.minHeight).toBe("100vh");
    // 기존 스타일은 보존
    expect(body!.style.display).toBe("block");
  });

  it("사용자가 minHeight 를 명시하면 100vh 주입을 skip(의도 보존)한다", () => {
    const node: ResolvedNode = {
      id: "body-2",
      type: BODY_TYPE,
      props: { style: { display: "block", minHeight: "500px" } },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set()}
      />,
    );

    const body = container.querySelector(
      "[data-canonical-id='body-2']",
    ) as HTMLElement | null;
    expect(body!.style.minHeight).toBe("500px");
  });

  it("사용자가 height 를 명시하면 100vh 주입을 skip 한다", () => {
    const node: ResolvedNode = {
      id: "body-3",
      type: BODY_TYPE,
      props: { style: { display: "block", height: "600px" } },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set()}
      />,
    );

    const body = container.querySelector(
      "[data-canonical-id='body-3']",
    ) as HTMLElement | null;
    expect(body!.style.minHeight).toBe("");
    expect(body!.style.height).toBe("600px");
  });

  it("body 가 아닌 일반 컨테이너(frame)에는 100vh 를 주입하지 않는다", () => {
    const node: ResolvedNode = {
      id: "frame-1",
      type: "frame",
      props: { style: { display: "block" } },
    };

    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set()}
      />,
    );

    const frame = container.querySelector(
      "[data-canonical-id='frame-1']",
    ) as HTMLElement | null;
    expect(frame).not.toBeNull();
    expect(frame!.style.minHeight).toBe("");
  });
});
