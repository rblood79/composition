import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

/**
 * D3 대칭 정합 — Body infrastructure class/default box는 generated CSS가 소유하고,
 * canonical DOM에는 authored override만 inline으로 남는지 검증한다 (viewport 높이는
 * `data-body-viewport-fill` + generated CSS `height:100vh` — inline 0).
 *
 * 주입/보존 규칙 자체(모든 분기)는 렌더러 독립적인
 * `packages/shared/src/utils/__tests__/bodyArtboardStyle.test.ts` 가 커버한다. 본 파일은
 * "helper 결과가 실제 DOM style 로 도달하는가"라는 wiring 만 확인한다.
 */

const ctx = {} as unknown as RenderContext;

// canonical page shell 의 runtime type 은 소문자 "body" 인데 ComponentTag
// vocabulary 에는 "Body" 만 등재 — vocabulary 정리 전까지 fixture 에서 cast.
const BODY_TYPE = "body" as ResolvedNode["type"];

describe("CanonicalNodeRenderer — body DOM presentation wiring", () => {
  it("legacy 기본값과 대소문자 class 중복을 제거하고 CSS viewport fill을 요청한다", () => {
    const node: ResolvedNode = {
      id: "body-1",
      type: BODY_TYPE,
      props: {
        className: "react-aria-body react-aria-Body",
        style: {
          display: "block",
          fontFamily: `"Pretendard", "Inter Variable", system-ui, sans-serif`,
          overflow: "auto",
        },
      },
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
    expect(body!.className).toBe("react-aria-Body");
    expect(body!.getAttribute("style")).toBeNull();
    expect(body!.hasAttribute("data-body-viewport-fill")).toBe(false);
  });

  it("사용자 minHeight/width는 inline으로 보존하고 viewport fill은 끈다", () => {
    const node: ResolvedNode = {
      id: "body-2",
      type: BODY_TYPE,
      props: {
        style: { display: "block", minHeight: "500px", width: "320px" },
      },
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
    expect(body!.style.width).toBe("320px");
    expect(body!.style.display).toBe("");
    expect(body!.hasAttribute("data-body-viewport-fill")).toBe(false);
    expect(body!.className).toBe("react-aria-Body");
  });
});
