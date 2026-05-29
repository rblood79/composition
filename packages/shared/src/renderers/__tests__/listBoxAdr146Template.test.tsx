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
