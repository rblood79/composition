import { describe, expect, it } from "vitest";

import {
  LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
  LISTBOX_ORIGIN_ID,
} from "../../../components/listbox/listBoxTemplateOrigins";
import { useStore } from "../../../stores";
import { createElementsFromDefinition } from "../../utils/elementCreation";
import { createListBoxDefinition } from "../SelectionComponents";
import type { ComponentCreationContext } from "../../types";

function makeContext(): ComponentCreationContext {
  return {
    parentElement: null,
    pageId: "page-home",
    elements: [],
    doc: {
      version: "composition-1.0",
      children: [],
    },
  };
}

describe("createListBoxDefinition ADR-146 template anchor", () => {
  it("creates the page ListBox as a ref instance of the Components page origin", () => {
    const definition = createListBoxDefinition(makeContext());

    expect(definition.parent).toMatchObject({
      type: "ref",
      ref: LISTBOX_ORIGIN_ID,
      componentName: "ListBox",
      props: expect.objectContaining({
        orientation: "vertical",
        selectionMode: "single",
      }),
    });
  });

  it("creates a locked ref template anchor instead of a hidden local ListBoxItem child", () => {
    const definition = createListBoxDefinition(makeContext());
    const [anchor] = definition.children;

    expect(anchor).toMatchObject({
      type: "ref",
      ref: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      componentName: "ListBoxItem",
      metadata: expect.objectContaining({
        templateRole: "listbox-item-template-anchor",
        originRef: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
        locked: true,
        deleteDisabled: true,
        rowProjectionSource: "items",
      }),
    });
    expect(anchor.props?.style).not.toMatchObject({ display: "none" });
  });

  it("uses component names, not raw ref, for generated custom ids", () => {
    useStore.setState({ elements: [] });

    const definition = createListBoxDefinition(makeContext());
    const { parent, children } = createElementsFromDefinition(definition, {
      pageId: "page-home",
      layoutId: null,
    });

    expect(parent).toMatchObject({
      type: "ref",
      ref: LISTBOX_ORIGIN_ID,
      customId: "listbox_1",
    });
    expect(children[0]).toMatchObject({
      type: "ref",
      ref: LISTBOX_ITEM_DEFAULT_ORIGIN_ID,
      customId: "listboxitem_1",
    });
  });
});
