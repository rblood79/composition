/**
 * Card 슬롯 부품의 스타일 채널 계약 — ADR-171 Phase 6 2a
 *
 * 이 4종은 회귀로 클래스를 잃은 적이 있다. ADR-912 cutover 시점의 계약은
 * `{Type}.binding.ts` 주석대로 "generic fallback 유지 → `react-aria-{Type}` className +
 * data-size 보존" 이었는데, 2026-06-24 에 자식 미렌더(Heading/Image 누락)를 고치려고
 * `renderFacetDeclaration.ts` 에 delegating 등록하면서 live path 가 전용 렌더러로 바뀌었고,
 * 그 렌더러가 `card-header` 같은 kebab 클래스를 하드코딩해 `react-aria-CardHeader` 가 사라졌다.
 *
 * 증상이 조용했던 이유: `.card-*` 를 잡는 CSS 는 저장소 전체 0건이라 **아무것도 깨지지 않았다**.
 * 대신 생성 CSS(`.react-aria-CardHeader`)가 영구 미매칭이 되어 DOM 스타일 공급원이 인라인
 * 하나로 줄었고, 그 상태를 ADR-171 Phase 2 가 "selector 가 DOM 에 없는 dead CSS" 로 판정했다.
 * 즉 **아무 테스트도 red 가 되지 않는 형태의 채널 소실**이라 가드가 필요하다.
 *
 * 여기서 잠그는 것은 클래스 이름 하나가 아니라 **생성 CSS 와 렌더러가 같은 selector 를 본다**는
 * 계약이다. 클래스 규약 자체는 레퍼런스에서 오지 않는다 — S2 Card 는 `style()` 매크로라 클래스가
 * 없고 SWC 는 `<sp-card>` 커스텀 엘리먼트다. `react-aria-{Type}` 은 RAC 에서 온 composition
 * house convention 이고, CSS 생성기·`Card.tsx`·`CanonicalNodeRenderer` generic fallback 이
 * 모두 그것을 쓴다.
 */

import { describe, it, expect } from "vitest";
import { isValidElement } from "react";
import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import {
  renderCardPreview,
  renderCardHeader,
  renderCardContent,
  renderCardFooter,
} from "../LayoutRenderers";

type RenderFn = (element: PreviewElement, context: RenderContext) => unknown;

const CARD_SLOTS: Array<{ type: string; render: RenderFn }> = [
  { type: "CardPreview", render: renderCardPreview as RenderFn },
  { type: "CardHeader", render: renderCardHeader as RenderFn },
  { type: "CardContent", render: renderCardContent as RenderFn },
  { type: "CardFooter", render: renderCardFooter as RenderFn },
];

function makeContext(el: PreviewElement): RenderContext {
  return {
    elements: [el],
    elementsById: new Map([[el.id, el]]),
    childrenByParent: new Map(),
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: () => null,
  };
}

function rootProps(node: unknown): Record<string, unknown> {
  if (!node || typeof node !== "object" || !isValidElement(node)) {
    throw new Error("renderer 가 React element 를 반환하지 않았다");
  }
  return (node.props ?? {}) as Record<string, unknown>;
}

describe("ADR-171 Phase 6 2a — Card 슬롯 클래스 채널 계약", () => {
  describe.each(CARD_SLOTS)("$type", ({ type, render }) => {
    it(`root 에 react-aria-${type} 클래스를 부여 (생성 CSS selector 와 일치)`, () => {
      const element: PreviewElement = { id: `test-${type}`, type, props: {} };
      const cls = rootProps(render(element, makeContext(element)))
        .className as string;
      expect(cls.split(/\s+/)).toContain(`react-aria-${type}`);
    });

    it("생성 CSS 의 size 축이 매칭되도록 data-size 를 부여 (기본 md)", () => {
      const element: PreviewElement = { id: `test-${type}`, type, props: {} };
      expect(
        rootProps(render(element, makeContext(element)))["data-size"],
      ).toBe("md");

      const sized: PreviewElement = {
        id: `test-${type}-lg`,
        type,
        props: { size: "lg" },
      };
      expect(rootProps(render(sized, makeContext(sized)))["data-size"]).toBe(
        "lg",
      );
    });

    it("사용자 className 을 덮어쓰지 않고 병기", () => {
      const element: PreviewElement = {
        id: `test-${type}-user`,
        type,
        props: { className: "my-card-bit" },
      };
      const cls = rootProps(render(element, makeContext(element)))
        .className as string;
      expect(cls.split(/\s+/)).toEqual(
        expect.arrayContaining([`react-aria-${type}`, "my-card-bit"]),
      );
    });
  });
});
