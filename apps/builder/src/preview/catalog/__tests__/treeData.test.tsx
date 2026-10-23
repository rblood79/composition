import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataCollectionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * `useTreeData({initialItems, getKey, getChildren})` — a bound Tree whose binding names the field
 * that holds an item's children (`fieldMap.children` — the reference's `getChildren`) shows every
 * level: each child row is the same item template again, inside its parent's TreeItem (the
 * reference's `<Collection items={item.children}>` with the same render function). The tree's
 * edits are the list's with a parent: `insert(parentKey, index, …)` · `append(parentKey, …)` ·
 * `prepend(parentKey, …)` · `move(key, toParentKey, index)`; a key anywhere in the tree works for
 * `insertBefore` · `insertAfter` · `moveBefore` · `moveAfter` · `update` · `remove`.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const FILES = "data:collection:files" as DataCollectionId;
const ITEMS = [
  {
    id: "docs",
    name: "Docs",
    children: [
      { id: "a", name: "Alpha" },
      { id: "b", name: "Beta" },
    ],
  },
  { id: "img", name: "Images" },
];

async function treePreview(children = true) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Tree", "Button"]);
  const [tree, button] = h.ids as [NodeId, NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "files",
          name: "Files",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
            { id: "f-children", key: "children", type: "array" },
          ],
          mockData: ITEMS,
          useMockData: true,
        },
      ],
      variables: [],
      apiEndpoints: [],
    });
  });
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: tree }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "files",
        name: "Files",
        ...(children ? { fieldMap: { children: "f-children" } } : {}),
      })!,
    ),
  );
  h.flush();
  // (Every parent open — `expand` per key.)
  const expand = (key: string) => {
    h.rule(h.ids[1] as NodeId, "onPress", {
      opcode: "capability",
      targetId: tree,
      capabilityId: "expand",
      value: key,
    } as never);
  };
  /** The tree's rows as `level:key` (RAC's row key = the item's key), in order. */
  const rows = () =>
    [...(h.element(tree)?.querySelectorAll('[role="row"]') ?? [])].map(
      (row) => `${row.getAttribute("aria-level")}:${row.getAttribute("data-key")}`,
    );
  const press = () =>
    act(() => {
      fireEvent.click(h.element(button)!);
    });
  return { ...h, tree, button, expand, rows, press };
}

describe("useTreeData — a bound Tree shows every level", () => {
  it("fieldMap.children nests each item's children inside its row (open parent)", async () => {
    const h = await treePreview();
    expect(h.rows()).toEqual(["1:docs", "1:img"]);
    h.expand("docs");
    h.press();
    expect(h.rows()).toEqual(["1:docs", "2:a", "2:b", "1:img"]);
    h.view.unmount();
  });

  it("without the children role the tree stays one level (the old rows)", async () => {
    const h = await treePreview(false);
    expect(h.rows()).toEqual(["1:docs", "1:img"]);
    h.view.unmount();
  });
});

describe("useTreeData — a row's text is its item's (`<Text>{item.name}</Text>`)", () => {
  it("each bound row shows its item's label (the name field), every level; the starter's sample text gives way", async () => {
    const h = await treePreview();
    h.expand("docs");
    h.press();
    const texts = () =>
      [...(h.element(h.tree)?.querySelectorAll('[role="row"]') ?? [])].map(
        (row) => row.textContent?.trim(),
      );
    expect(texts()).toEqual(["Docs", "Alpha", "Beta", "Images"]);
    h.view.unmount();
  });

  it("an unbound Tree keeps the starter's sample text", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr280Preview(["Tree"]);
    const tree = h.ids[0] as NodeId;
    expect(
      [...(h.element(tree)?.querySelectorAll('[role="row"]') ?? [])].map(
        (row) => row.textContent?.trim(),
      ),
    ).toEqual(["Node 1", "Node 2"]);
    h.view.unmount();
  });
});

describe("useTreeData — edits with a parent", () => {
  it("insert(parentKey, index) · append(parentKey) · move(key, toParentKey, index) · a nested key's remove · update", async () => {
    const h = await treePreview();
    const names = () => {
      const walk = (items: readonly Record<string, unknown>[]): unknown[] =>
        items.map((item) =>
          Array.isArray(item.children) && item.children.length
            ? [item.name, walk(item.children as Record<string, unknown>[])]
            : item.name,
        );
      return walk(
        h.session.collectionItems("files") as Record<string, unknown>[],
      );
    };
    act(() => {
      expect(
        h.session.insert("files", { index: 0 }, { name: "New" }, "docs").ok,
      ).toBe(true);
      expect(h.session.append("files", { name: "Gamma" }, "img").ok).toBe(true);
    });
    expect(names()).toEqual([
      ["Docs", ["New", "Alpha", "Beta"]],
      ["Images", ["Gamma"]],
    ]);
    act(() => {
      // (A key anywhere — `b` is Docs's child — to the top, first.)
      expect(h.session.move("files", ["b"], { index: 0 }, null).ok).toBe(true);
    });
    expect(names()).toEqual([
      "Beta",
      ["Docs", ["New", "Alpha"]],
      ["Images", ["Gamma"]],
    ]);
    act(() => {
      expect(h.session.move("files", ["a"], { index: 0 }, "img").ok).toBe(true);
      expect(h.session.update("files", "img", { name: "Pictures" }).ok).toBe(
        true,
      );
      expect(h.session.remove("files", ["Gamma"]).ok).toBe(false);
    });
    expect(names()).toEqual([
      "Beta",
      ["Docs", ["New"]],
      ["Pictures", ["Alpha", "Gamma"]],
    ]);
    // (An unknown parent is reported.)
    expect(
      h.session.insert("files", { index: 0 }, { name: "X" }, "nope").ok,
    ).toBe(false);
    h.view.unmount();
  });

  it("a rule's toParentKey reaches the session; parentKey · toParentKey pass the document check", async () => {
    const h = await treePreview();
    h.rule(h.button, "onPress", {
      opcode: "move",
      collectionId: FILES,
      key: "a",
      toParentKey: "img",
      toIndex: 0,
    });
    h.press();
    const img = (
      h.session.collectionItems("files") as Record<string, unknown>[]
    ).find((item) => item.id === "img")!;
    expect(
      (img.children as Record<string, unknown>[]).map((item) => item.name),
    ).toEqual(["Alpha"]);
    // (`append` · `insert` · `prepend` take a parent too — the stored rule reopens the same.)
    for (const action of [
      { opcode: "append", value: "!event.formData", parentKey: "img" },
      { opcode: "insert", index: 0, value: "!event.formData", parentKey: "img" },
      { opcode: "prepend", value: "!event.formData", parentKey: "!event.key" },
    ] as const)
      expect(() =>
        h.rule(h.button, "onPress", { collectionId: FILES, ...action }),
      ).not.toThrow();
    expect(() =>
      h.rule(h.button, "onPress", {
        opcode: "move",
        collectionId: FILES,
        key: "a",
        toIndex: 0,
        parent: "img",
      } as never),
    ).toThrow();
    h.view.unmount();
  });
});
