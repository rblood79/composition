import { describe, expect, it } from "vitest";
import { isValidElement } from "react";
import type { PreviewElement, RenderContext } from "../../types/renderer.types";
import { renderListBox } from "../SelectionRenderers";

function makeContext(template: PreviewElement): RenderContext {
  return {
    elements: [template],
    elementsById: new Map([[template.id, template]]),
    childrenByParent: new Map([["listbox", [template]]]),
    updateElementProps: () => {},
    batchUpdateElementProps: () => {},
    setElements: () => {},
    renderElement: () => null,
  };
}

describe("ADR-146 ListBox Preview ref template rendering", () => {
  it("uses a ListBoxItem ref template as the RAC dynamic collection render function", () => {
    const listBox: PreviewElement = {
      id: "listbox",
      type: "ListBox",
      dataBinding: {
        type: "collection",
        source: "static",
        config: {
          data: [{ id: "aardvark", label: "Aardvark" }],
        },
      },
      props: {},
    };
    const template: PreviewElement = {
      id: "template-anchor",
      type: "ListBoxItem",
      props: {
        children: "{label}",
        description: "{description}",
      },
      parent_id: "listbox",
    };

    const rendered = renderListBox(listBox, makeContext(template));

    expect(isValidElement(rendered)).toBe(true);
    const children = (rendered as { props: { children?: unknown } }).props
      .children;
    expect(typeof children).toBe("function");

    const row = (children as (item: Record<string, unknown>) => unknown)({
      id: "aardvark",
      label: "Aardvark",
      description: "Burrowing mammal",
    });

    expect(isValidElement(row)).toBe(true);
    expect((row as { props: { textValue?: unknown } }).props.textValue).toBe(
      "Aardvark",
    );
  });

  it("emits label/description as RAC Text slots (ADR-147)", () => {
    const listBox: PreviewElement = {
      id: "listbox",
      type: "ListBox",
      dataBinding: {
        type: "collection",
        source: "static",
        config: { data: [{ id: "aardvark", label: "Aardvark" }] },
      },
      props: {},
    };
    const template: PreviewElement = {
      id: "template-anchor",
      type: "ListBoxItem",
      props: { children: "{label}", description: "{description}" },
      parent_id: "listbox",
    };

    const rendered = renderListBox(listBox, makeContext(template));
    const renderItem = (rendered as { props: { children?: unknown } }).props
      .children as (item: Record<string, unknown>) => unknown;
    const row = renderItem({
      id: "aardvark",
      label: "Aardvark",
      description: "Burrowing mammal",
    });

    // ADR-147: ListBoxItem children 은 render-function (isSelected 기반 selection indicator).
    const slotFn = (row as { props: { children?: unknown } }).props.children;
    expect(typeof slotFn).toBe("function");

    const content = (slotFn as (rp: { isSelected: boolean }) => unknown)({
      isSelected: false,
    });
    const kids = (content as { props: { children?: unknown } }).props.children;
    const elements = (Array.isArray(kids) ? kids : [kids]).filter(
      isValidElement,
    ) as Array<{ props: Record<string, unknown> }>;

    const label = elements.find((el) => el.props.slot === "label");
    const description = elements.find((el) => el.props.slot === "description");
    expect(label?.props.children).toBe("Aardvark");
    expect(description?.props.children).toBe("Burrowing mammal");
  });

  it("Path 2(items[]) 행은 컨테이너 element.id 를 data-element-id 로 갖지 않는다 (ADR-154 responsive @media 전가 방지)", () => {
    // buildResponsiveElementCss 는 `@media { [data-element-id="{owner}"] { ...!important } }` 를
    //   emit 한다. items[] 행이 owner element.id 를 data-element-id 로 물려받으면, 컨테이너의
    //   responsive override(min-height/gap 등)가 모든 행에 매치되어 자식으로 전가된다.
    //   행은 owner id 를 갖지 않아야 하고, 클릭 매핑은 closest([data-element-id]) 가 상위
    //   ListBox 루트(owner)를 찾아 보존된다.
    const listBox: PreviewElement = {
      id: "listbox-owner",
      type: "ListBox",
      props: {
        items: [
          { id: "row-1", label: "Aardvark" },
          { id: "row-2", label: "Bee" },
        ],
      },
    };
    // 템플릿 자식/ dataBinding 없음 → hasValidTemplate=false → Path 2(items[]).
    const context: RenderContext = {
      elements: [listBox],
      elementsById: new Map([[listBox.id, listBox]]),
      childrenByParent: new Map(),
      updateElementProps: () => {},
      batchUpdateElementProps: () => {},
      setElements: () => {},
      renderElement: () => null,
    };

    const rendered = renderListBox(listBox, context);
    const children = (rendered as { props: { children?: unknown } }).props
      .children;
    const rows = (Array.isArray(children) ? children : [children]).filter(
      isValidElement,
    ) as Array<{ props: Record<string, unknown> }>;

    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.props["data-element-id"]).not.toBe("listbox-owner");
    }
  });

  it("passes the template anchor layout style to each ListBoxItem (ADR-147 layout edit)", () => {
    const listBox: PreviewElement = {
      id: "listbox",
      type: "ListBox",
      dataBinding: {
        type: "collection",
        source: "static",
        config: { data: [{ id: "aardvark", label: "Aardvark" }] },
      },
      props: {},
    };
    const template: PreviewElement = {
      id: "template-anchor",
      type: "ListBoxItem",
      props: {
        children: "{label}",
        description: "{description}",
        style: { flexDirection: "row", rowGap: 8, paddingLeft: 20 },
      },
      parent_id: "listbox",
    };

    const rendered = renderListBox(listBox, makeContext(template));
    const renderItem = (rendered as { props: { children?: unknown } }).props
      .children as (item: Record<string, unknown>) => unknown;
    const row = renderItem({ id: "aardvark", label: "Aardvark" });

    expect((row as { props: { style?: unknown } }).props.style).toMatchObject({
      flexDirection: "row",
      rowGap: 8,
      paddingLeft: 20,
    });
  });
});
