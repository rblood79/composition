/**
 * TableView catalog CSS 채널 회귀 lock — ADR-151 후속 (2026-07-17)
 *
 * 배경: catalog(COMPONENT_RULES_TABLE.TableView)는 양 채널에 width:100% 를 선언하는데
 * DOM 채널이 이중 단절돼 있었다 — (1) generated/TableView.css 가 index.css 에 미import,
 * (2) renderTableView root 가 `react-aria-TableView` 클래스 미부여 raw div. Skia 는
 * catalog containerStyles 를 소비해 flex 부모에서 350×80 vs DOM 179.4×106 발산.
 *
 * lock 대상:
 *   A. renderTableView root 에 react-aria-TableView 클래스 부여 (+ user className 병합)
 *   B. data-variant 방출 (variant prop + legacy isQuiet 정규화)
 *   C. element.props.style root 전달 (ADR-907 Layer C 동형)
 *   D. index.css 가 generated/TableView.css 를 import
 */

import { describe, it, expect } from "vitest";
import { isValidElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import { renderTableView } from "../LayoutRenderers";

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

function makeElement(props: Record<string, unknown> = {}): PreviewElement {
  return {
    id: "test-TableView",
    type: "TableView",
    props,
  };
}

function rootProps(node: unknown): Record<string, unknown> {
  if (!isValidElement(node)) throw new Error("root 가 React element 가 아님");
  return node.props as Record<string, unknown>;
}

describe("ADR-151 후속 — TableView catalog CSS 채널", () => {
  it("root 에 react-aria-TableView 클래스를 부여한다", () => {
    const el = makeElement();
    const props = rootProps(renderTableView(el, makeContext(el)));
    expect(props.className).toBe("react-aria-TableView");
  });

  it("user className 은 base 클래스 뒤에 병합한다", () => {
    const el = makeElement({ className: "custom-x" });
    const props = rootProps(renderTableView(el, makeContext(el)));
    expect(props.className).toBe("react-aria-TableView custom-x");
  });

  it("data-variant 를 방출한다 (default + legacy isQuiet → quiet)", () => {
    const el = makeElement();
    expect(
      rootProps(renderTableView(el, makeContext(el)))["data-variant"],
    ).toBe("default");
    const quiet = makeElement({ isQuiet: true });
    expect(
      rootProps(renderTableView(quiet, makeContext(quiet)))["data-variant"],
    ).toBe("quiet");
  });

  it("element.props.style 을 root 에 전달한다 (사용자 값이 잔여 inline 을 이긴다)", () => {
    const el = makeElement({ style: { padding: 99, overflow: "visible" } });
    const style = rootProps(renderTableView(el, makeContext(el))).style as
      | Record<string, unknown>
      | undefined;
    expect(style?.padding).toBe(99);
    expect(style?.overflow).toBe("visible");
  });

  it("구 inline 상수(display/border/borderRadius)를 root style 에 하드코딩하지 않는다", () => {
    const el = makeElement();
    const style = rootProps(renderTableView(el, makeContext(el))).style as
      | Record<string, unknown>
      | undefined;
    expect(style?.display).toBeUndefined();
    expect(style?.border).toBeUndefined();
    expect(style?.borderRadius).toBeUndefined();
  });

  it("index.css 가 generated/TableView.css 를 import 한다", () => {
    const indexCss = readFileSync(
      join(__dirname, "../../components/styles/index.css"),
      "utf-8",
    );
    expect(indexCss).toContain('@import "./generated/TableView.css"');
  });
});
