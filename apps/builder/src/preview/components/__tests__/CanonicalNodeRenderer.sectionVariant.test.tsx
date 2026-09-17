import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

const ctx = {} as unknown as RenderContext;

/**
 * generic fallback 경로의 `data-variant` — 부재 = catalog defaultVariant 명시 (2026-09-17).
 *
 * Skia 는 variant prop 이 없으면 catalog `defaultVariant` 로 그린다. DOM 이 prop 있을 때만
 * `data-variant` 를 내면 생성 CSS 의 `[data-variant="default"]` 블록 (Section 은 fill alpha 0 →
 * `background: transparent`) 이 안 걸려 base 블록 `var(--bg)` (흰색) 이 남는다 — 색 있는 부모 위에서
 * Skia 투명 / DOM 흰색으로 갈린다. `data-size` 가 이미 같은 규칙 (부재 = catalog defaultSize).
 */
describe("CanonicalNodeRenderer — generic fallback data-variant", () => {
  it("Section: variant 부재면 catalog defaultVariant 를 data-variant 로 낸다", () => {
    const node: ResolvedNode = {
      id: "section-1",
      type: "Section",
      props: { style: { display: "flex" } },
    };
    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Section"])}
      />,
    );
    const el = container.querySelector(".react-aria-Section");
    expect(el).not.toBeNull();
    expect(el?.getAttribute("data-size")).toBe("md");
    expect(el?.getAttribute("data-variant")).toBe("default");
  });

  it("Section: 명시 variant 는 그대로", () => {
    const node: ResolvedNode = {
      id: "section-2",
      type: "Section",
      props: { variant: "accent" },
    };
    const { container } = render(
      <CanonicalNodeRenderer
        node={node}
        renderContext={ctx}
        cutoverPrimitives={new Set(["Section"])}
      />,
    );
    expect(
      container.querySelector(".react-aria-Section")?.getAttribute("data-variant"),
    ).toBe("accent");
  });
});
