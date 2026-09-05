import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

/**
 * `aria-label` 은 `id`/`class` 와 같은 **전 타입 공통 축**이다 —
 * `toRacProps` 의 allowlist(catalog `accepts`) 를 타지 않으므로 렌더러가 유일한 emit
 * 지점이고, 그래서 두 렌더 분기(cutover / generic) 모두를 여기서 본다.
 *
 * 계기 (2026-09-05): `role="progressbar"` 처럼 접근 가능한 이름이 필수인 컴포넌트를
 * 빌더에서 만들면 이름을 넣을 수단이 없었다.
 */
const ctx = {} as unknown as RenderContext;

describe("CanonicalNodeRenderer — aria-label 전 타입 공통 축", () => {
  it("cutover 분기: 사용자가 지정한 aria-label 이 DOM 에 실린다", () => {
    const node: ResolvedNode = {
      id: "btn-aria",
      type: "Button",
      props: { children: "OK", "aria-label": "저장하기" },
    };
    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Button"])}
      />,
    );
    expect(container.querySelector("button")?.getAttribute("aria-label")).toBe(
      "저장하기",
    );
  });

  it("generic 분기: cutover 대상이 아니어도 실린다", () => {
    const node: ResolvedNode = {
      id: "div-aria",
      type: "frame",
      props: { "aria-label": "본문 영역" },
    };
    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set()}
      />,
    );
    expect(
      container
        .querySelector('[data-canonical-id="div-aria"]')
        ?.getAttribute("aria-label"),
    ).toBe("본문 영역");
  });

  it("미지정이면 속성을 만들지 않는다 — 빈 문자열 aria-label 은 이름을 지운다", () => {
    const node: ResolvedNode = {
      id: "btn-plain",
      type: "Button",
      props: { children: "OK" },
    };
    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Button"])}
      />,
    );
    expect(container.querySelector("button")?.hasAttribute("aria-label")).toBe(
      false,
    );
  });
});
