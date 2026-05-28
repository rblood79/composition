import { describe, expect, it } from "vitest";

import { LISTBOX_ITEM_DEFAULT_ORIGIN_ID } from "../../../components/listbox/listBoxTemplateOrigins";
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
});
