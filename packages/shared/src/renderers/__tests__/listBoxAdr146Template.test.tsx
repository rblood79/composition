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
});
