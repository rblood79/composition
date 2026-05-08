/**
 * ADR-907 Phase 3 Wave C-2 — renderGridList data-layout delegation contract.
 *
 * 목적: `renderGridList` 가 `data-layout` 속성을 **명시적으로 전달하지 않음**을
 * runtime 확증. `layout` prop 만 전달하고, data-layout 은 react-aria-components
 * `GridList` (리포트 `GridList.mjs:198`) 가 자동 방출함에 위임한다.
 *
 * 회귀 방어:
 *  - renderGridList 가 `data-layout={layout}` 을 수동 추가하면 RAC 가 방출하는
 *    속성과 중복되어 DOM 에 attr 가 덮어쓰일 가능성이 있고, 향후 RAC 내부 구현
 *    변경 시 drift 가 발생할 수 있다.
 *  - 본 테스트는 renderGridList 반환 React element 의 root props key 집합에
 *    `"data-layout"` 이 없음을 확증한다.
 *
 * ADR-906 G2 흡수 — 기존 ADR-906 의 data-layout 관련 Gate 를 ADR-907 Phase 3
 * 로 편입.
 */

import { describe, it, expect } from "vitest";
import { isValidElement } from "react";
import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import { renderGridList } from "../SelectionRenderers";

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

function makeGridListElement(
  layout: "stack" | "grid" = "grid",
  columns?: number,
): PreviewElement {
  return {
    id: "gl-contract",
    type: "GridList",
    props: {
      layout,
      columns,
      items: [],
    },
  };
}

describe("ADR-907 Phase 3 Wave C-2 — renderGridList data-layout delegation", () => {
  it("layout='grid' 시 root props 에 data-layout key 없음 (RAC 자동 방출 위임)", () => {
    const element = makeGridListElement("grid", 3);
    const context = makeContext(element);
    const result = renderGridList(element, context);

    expect(isValidElement(result)).toBe(true);
    if (!isValidElement(result)) return;

    const propKeys = Object.keys(result.props as Record<string, unknown>);
    expect(propKeys).not.toContain("data-layout");
  });

  it("layout='stack' 시 root props 에 data-layout key 없음", () => {
    const element = makeGridListElement("stack");
    const context = makeContext(element);
    const result = renderGridList(element, context);

    expect(isValidElement(result)).toBe(true);
    if (!isValidElement(result)) return;

    const propKeys = Object.keys(result.props as Record<string, unknown>);
    expect(propKeys).not.toContain("data-layout");
  });

  it("root props 에 `layout` 프로퍼티는 명시 전달 (RAC 가 이를 기반으로 data-layout 방출)", () => {
    const element = makeGridListElement("grid", 2);
    const context = makeContext(element);
    const result = renderGridList(element, context);

    expect(isValidElement(result)).toBe(true);
    if (!isValidElement(result)) return;

    const props = result.props as Record<string, unknown>;
    expect(props.layout).toBe("grid");
  });

  it("root props 에 `columns` 프로퍼티 명시 전달 (RAC grid 모드용)", () => {
    const element = makeGridListElement("grid", 3);
    const context = makeContext(element);
    const result = renderGridList(element, context);

    if (!isValidElement(result)) return;
    const props = result.props as Record<string, unknown>;
    expect(props.columns).toBe(3);
  });
});
