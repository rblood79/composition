import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

/**
 * D3 대칭 정합 — canonical body 노드가 Skia 아트보드 높이를 채우도록 `resolveBodyArtboardStyle`
 * (shared 단일 소스, publish `ElementRenderer` 와 공유)을 이 렌더 경로에 배선했는지 검증한다.
 *
 * 주입/보존 규칙 자체(모든 분기)는 렌더러 독립적인
 * `packages/shared/src/utils/__tests__/bodyArtboardStyle.test.ts` 가 커버한다. 본 파일은
 * "helper 결과가 실제 DOM style 로 도달하는가"라는 wiring 만 확인한다.
 */

const ctx = {} as unknown as RenderContext;

// canonical page shell 의 runtime type 은 소문자 "body" 인데 ComponentTag
// vocabulary 에는 "Body" 만 등재 — vocabulary 정리 전까지 fixture 에서 cast.
const BODY_TYPE = "body" as ResolvedNode["type"];

describe("CanonicalNodeRenderer — body 아트보드 정합 wiring", () => {
  it("height 미지정 body 노드의 DOM style 에 min-height:100vh 가 도달한다", () => {
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
    expect(body!.style.display).toBe("block"); // 기존 스타일 보존
  });

  it("사용자가 minHeight 를 명시하면 렌더 결과에 100vh 를 주입하지 않는다", () => {
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
});
