import { describe, expect, it } from "vitest";
import { useStore } from "../../elements";

describe("ADR-146 ListBox template anchor deletion guard", () => {
  it("does not remove locked template anchor elements", async () => {
    const listBox = {
      id: "listbox",
      type: "ListBox",
      parent_id: null,
      page_id: "page-1",
      order_num: 0,
      props: {},
    };
    const anchor = {
      id: "listbox-template-anchor",
      type: "ref",
      ref: "component-listbox-item-default",
      parent_id: "listbox",
      page_id: "page-1",
      order_num: 1,
      props: {},
      metadata: {
        templateRole: "listbox-item-template-anchor",
        locked: true,
        deleteDisabled: true,
      },
    };

    useStore.setState({
      currentPageId: "page-1",
      elements: [listBox, anchor] as never,
      elementsMap: new Map([
        ["listbox", listBox as never],
        ["listbox-template-anchor", anchor as never],
      ]),
      childrenMap: new Map([["listbox", [anchor as never]]]),
    } as never);

    await useStore.getState().removeElement("listbox-template-anchor");

    expect(useStore.getState().elementsMap.get("listbox-template-anchor")).toBe(
      anchor,
    );
  });
});
