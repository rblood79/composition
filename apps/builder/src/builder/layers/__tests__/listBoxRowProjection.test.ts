import { describe, expect, it } from "vitest";

import {
  LISTBOX_ROW_PROJECTION_WINDOW_LIMIT,
  buildListBoxRowProjectionGroup,
} from "../listBoxRowProjection";

describe("ListBox row projection model", () => {
  it("builds a Rows group with stable row projection ids from props.items", () => {
    const group = buildListBoxRowProjectionGroup({
      depth: 2,
      listBoxElement: {
        id: "listbox",
        type: "ListBox",
        parent_id: "body",
        page_id: "page-1",
        props: {
          items: [
            { id: "aardvark", label: "Aardvark" },
            { id: "cat", label: "Cat" },
          ],
        },
      } as never,
      treeChildren: [{ id: "anchor", type: "ref" }],
    });

    expect(group).toMatchObject({
      id: "projection:listbox-rows:listbox",
      name: "Rows",
      type: "Rows",
      parentId: "listbox",
      virtualChildType: "listbox-rows",
      children: [
        {
          id: "projection:listbox-row:listbox:aardvark",
          name: "Aardvark",
          type: "ListBoxItem",
          parentId: "projection:listbox-rows:listbox",
          virtualChildType: "listbox-row",
        },
        {
          id: "projection:listbox-row:listbox:cat",
          name: "Cat",
          type: "ListBoxItem",
          parentId: "projection:listbox-rows:listbox",
          virtualChildType: "listbox-row",
        },
      ],
    });
  });

  it("windows large data-bound collections instead of materializing every row", () => {
    const group = buildListBoxRowProjectionGroup({
      depth: 0,
      listBoxElement: {
        id: "listbox",
        type: "ListBox",
        parent_id: null,
        page_id: "page-1",
        props: {
          items: Array.from({ length: 10_000 }, (_, index) => ({
            id: `item-${index}`,
            label: `Item ${index}`,
          })),
        },
      },
      treeChildren: [{ id: "anchor", type: "ref" }],
    });

    expect(group?.children).toHaveLength(LISTBOX_ROW_PROJECTION_WINDOW_LIMIT);
  });

  it("uses dataBinding row data before props.items seed data", () => {
    const group = buildListBoxRowProjectionGroup({
      depth: 0,
      listBoxElement: {
        id: "listbox",
        type: "ListBox",
        parent_id: null,
        page_id: "page-1",
        dataBinding: {
          type: "collection",
          source: "static",
          config: {
            data: [{ id: "runtime-aardvark", label: "Runtime Aardvark" }],
          },
        },
        props: {
          items: [{ id: "seed-cat", label: "Seed Cat" }],
        },
      } as never,
      treeChildren: [{ id: "anchor", type: "ref" }],
    });

    expect(group?.children?.map((node) => node.id)).toEqual([
      "projection:listbox-row:listbox:runtime-aardvark",
    ]);
    expect(group?.children?.map((node) => node.name)).toEqual([
      "Runtime Aardvark",
    ]);
  });

  it("does not create a projection group for static ref children only", () => {
    expect(
      buildListBoxRowProjectionGroup({
        depth: 0,
        listBoxElement: {
          id: "listbox",
          type: "ListBox",
          parent_id: null,
          page_id: "page-1",
          props: {},
        },
        treeChildren: [{ id: "row-1", type: "ref", ref: "item-origin" }],
      }),
    ).toBeNull();
  });
});
