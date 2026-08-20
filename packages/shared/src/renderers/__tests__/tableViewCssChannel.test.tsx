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

/**
 * TableView density → 자손 Column/Cell 세로 padding (2026-08-21).
 *
 * Spectrum `table.item.padding × density` — 행 높이는 size 축이 정하고 density 는 item
 * 내부 여백만 바꾼다. DOM 축은 `renderTableViewSubtree` 인라인이 정본이므로(자식은
 * className 비부여 — Table.css 의 `position:absolute` 누수 방어), 여기서 catalog
 * `Column/Cell.densities` 를 읽어 인라인 `padding: 8` 의 **세로 성분만** 교체한다.
 * Skia 는 같은 catalog 값을 applyImplicitStyles 가 주입해 읽는다(D3 symmetric).
 */
describe("TableView density — 자손 Column/Cell 인라인 padding", () => {
  /** 렌더 트리에서 특정 data-tableview-part 의 props 를 찾는다. */
  function findPart(node: unknown, part: string): Record<string, unknown> {
    if (Array.isArray(node)) {
      for (const child of node) {
        const hit = findPart(child, part);
        if (Object.keys(hit).length > 0) return hit;
      }
      return {};
    }
    if (!isValidElement(node)) return {};
    const props = node.props as Record<string, unknown>;
    if (props["data-tableview-part"] === part) return props;
    return findPart(props.children, part);
  }

  function renderTree(tableViewProps: Record<string, unknown> = {}) {
    const tv = makeElement(tableViewProps);
    const body: PreviewElement = { id: "tb", type: "TableBody", props: {} };
    const row: PreviewElement = { id: "row", type: "Row", props: {} };
    const cell: PreviewElement = {
      id: "cell",
      type: "Cell",
      props: { children: "Alice" },
    };
    const header: PreviewElement = { id: "th", type: "TableHeader", props: {} };
    const column: PreviewElement = {
      id: "col",
      type: "Column",
      props: { children: "Name" },
    };
    const context: RenderContext = {
      ...makeContext(tv),
      childrenByParent: new Map([
        [tv.id, [header, body]],
        [header.id, [column]],
        [body.id, [row]],
        [row.id, [cell]],
      ]),
    };
    return renderTableView(tv, context);
  }

  const cellPadding = (density?: string) => {
    const props = findPart(
      renderTree(density ? { density } : {}),
      "Cell",
    ) as Record<string, unknown>;
    return props.style as Record<string, unknown>;
  };

  it("compact/regular/spacious 가 세로 padding 만 바꾼다 (가로 8 고정)", () => {
    expect(cellPadding("compact")).toMatchObject({
      padding: 8,
      paddingTop: 4,
      paddingBottom: 4,
    });
    expect(cellPadding("spacious")).toMatchObject({
      padding: 8,
      paddingTop: 12,
      paddingBottom: 12,
    });
  });

  it("density 미지정이면 defaultDensity(regular=8) — 기존 인라인 상수와 같은 값", () => {
    expect(cellPadding()).toMatchObject({ paddingTop: 8, paddingBottom: 8 });
  });

  it("Column 도 같은 값을 받는다 — 한 표 안에서 header/body 여백이 갈리면 안 된다", () => {
    const col = findPart(
      renderTree({ density: "compact" }),
      "Column",
    ) as Record<string, unknown>;
    expect(col.style).toMatchObject({ paddingTop: 4, paddingBottom: 4 });
  });

  it("사용자 style 이 density 를 이긴다 — 주입 순서 계약", () => {
    const tv = makeElement({ density: "spacious" });
    const row: PreviewElement = { id: "row", type: "Row", props: {} };
    const cell: PreviewElement = {
      id: "cell",
      type: "Cell",
      props: { children: "Alice", style: { paddingTop: 2 } },
    };
    const context: RenderContext = {
      ...makeContext(tv),
      childrenByParent: new Map([
        [tv.id, [row]],
        [row.id, [cell]],
      ]),
    };
    const style = (
      findPart(renderTableView(tv, context), "Cell") as Record<string, unknown>
    ).style as Record<string, unknown>;
    expect(style.paddingTop).toBe(2);
    expect(style.paddingBottom).toBe(12);
  });

  it("root 에 data-density 를 방출한다", () => {
    const el = makeElement({ density: "compact" });
    expect(
      rootProps(renderTableView(el, makeContext(el)))["data-density"],
    ).toBe("compact");
  });
});
