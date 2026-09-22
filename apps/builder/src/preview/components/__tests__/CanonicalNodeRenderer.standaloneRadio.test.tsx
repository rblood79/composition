import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getCatalogCutoverTypes, type ResolvedNode } from "@composition/shared";

import type { RenderContext } from "../../types/index";
import { CanonicalNodeRenderer } from "../CanonicalNodeRenderer";

/**
 * ADR-233 R7 (리뷰 h1) — RadioGroup 밖 Radio 가 Preview 를 죽이지 않는다.
 *
 * Radio origin (`component-radio`) 과 상태 변형 (`component-radio--selected` …) 은 Components body
 * 직계에 놓인다. RAC `Radio` 는 RadioGroup 문맥이 없으면 `state.isDisabled` 를 읽다 throw 하고
 * (`TypeError: … reading 'isDisabled'`), React 가 위 트리를 언마운트해 Preview 전체가 빈 화면이 된다.
 * Skia 는 RAC 를 쓰지 않아 그대로 그리므로 "한쪽은 그림 / 한쪽은 크래시" (ListBoxItem 선례 —
 * `CanonicalNodeRenderer.orphanCollectionItem.test.tsx`).
 *
 * 수리 계약 (ADR-233 Decision): 조상 RadioGroup 이 없으면 render-only RAC `RadioGroup`
 * (`display: contents`) 으로 감싼다. 선택 표현은 RAC 계약 그대로 — 그룹 `value` = 유효 selected 면
 * 그 Radio 의 value, 아니면 null. production 경로 (`getCatalogCutoverTypes()` — catalog primitive
 * 반환 경로) 로 검증한다: 호스트 표 등록만으로는 rendererMap fallback 에만 적용된다 (리뷰 round 2).
 */

const ctx = {
  childrenByParent: new Map(),
  renderElement: () => null,
} as unknown as RenderContext;

afterEach(cleanup);

function renderProduction(node: ResolvedNode) {
  return render(
    <CanonicalNodeRenderer
      node={node}
      renderContext={ctx}
      cutoverPrimitives={getCatalogCutoverTypes()}
    />,
  );
}

function radioNode(
  id: string,
  props: Record<string, unknown>,
  metadata?: Record<string, unknown>,
): ResolvedNode {
  return {
    id,
    type: "Radio",
    props: { value: "radio", children: "Radio", ...props },
    ...(metadata ? { metadata } : {}),
  } as ResolvedNode;
}

describe("ADR-233 — 독립 Radio (RadioGroup 밖) Preview 렌더", () => {
  it("default Radio 가 production catalog 경로에서 throw 없이 렌더되고 선택되지 않는다", () => {
    const { container } = renderProduction(radioNode("component-radio", {}));
    const radio = container.querySelector(".react-aria-Radio");
    expect(radio).not.toBeNull();
    expect(radio!.hasAttribute("data-selected")).toBe(false);
    expect(container.textContent).toContain("Radio");
  });

  it("isSelected Radio 는 호스트 value 로 data-selected 가 붙는다", () => {
    const { container } = renderProduction(
      radioNode("radio-selected-prop", { isSelected: true }),
    );
    const radio = container.querySelector(".react-aria-Radio");
    expect(radio?.hasAttribute("data-selected")).toBe(true);
  });

  it("Selected 상태 변형 origin (metadata.variant) 은 data-selected", () => {
    const { container } = renderProduction(
      radioNode(
        "component-radio--selected",
        {},
        { variant: "selected", variantOf: "component-radio" },
      ),
    );
    const radio = container.querySelector(".react-aria-Radio");
    expect(radio?.hasAttribute("data-selected")).toBe(true);
  });

  it("Disabled 상태 변형 origin 은 data-disabled 이고 선택되지 않는다", () => {
    const { container } = renderProduction(
      radioNode(
        "component-radio--disabled",
        {},
        { variant: "disabled", variantOf: "component-radio" },
      ),
    );
    const radio = container.querySelector(".react-aria-Radio");
    expect(radio?.hasAttribute("data-disabled")).toBe(true);
    expect(radio?.hasAttribute("data-selected")).toBe(false);
  });

  it("호스트는 display:contents — 박스를 만들지 않는다", () => {
    const { container } = renderProduction(radioNode("component-radio", {}));
    const host = container.querySelector(
      '[role="radiogroup"]',
    ) as HTMLElement | null;
    expect(host).not.toBeNull();
    expect(host!.style.display).toBe("contents");
  });

  it("RadioGroup 안 Radio 는 호스트를 만들지 않는다 (radiogroup 1개)", () => {
    const group = {
      id: "rg-1",
      type: "RadioGroup",
      props: { value: "b", label: "Group" },
      children: [
        radioNode("rg-1__a", { value: "a", children: "A" }),
        radioNode("rg-1__b", { value: "b", children: "B" }),
      ],
    } as ResolvedNode;
    const { container } = renderProduction(group);
    expect(container.querySelectorAll('[role="radiogroup"]')).toHaveLength(1);
    expect(container.querySelectorAll(".react-aria-Radio")).toHaveLength(2);
  });
});
