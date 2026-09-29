import { describe, expect, it } from "vitest";
import type { InstanceAddress } from "../../document/types";
import { resolveCatalogNode } from "../../resolution/resolver";
import { editItems } from "../items";
import { code, graphOf, node, run, snapshot, undo } from "./fixture";

/**
 * ADR-248 Phase 4b collection item commands: the edit starts from the list the target shows
 * (own value, template value, defaults) and writes the whole list back as one prop edit.
 */
const LIST = { kind: "node", id: "project:node:list" } as const;
const items = (graph: ReturnType<typeof graphOf>, id = "project:node:list") =>
  resolveCatalogNode(graph, id as never).props.items;

describe("ADR-248 Phase 4b collection item commands", () => {
  it("adds, updates, moves and removes items starting from the default list", () => {
    const graph = graphOf([node("list", "lib:definition:listbox")], ["list"]);
    const initial = snapshot(graph);
    const added = run(
      graph,
      editItems({
        target: LIST,
        key: "items",
        edit: { kind: "add", item: { id: "a", label: "Alpha" } },
      }),
    );
    expect(added.result.impact.structural).toBe(false);
    expect(items(graph)).toEqual([
      { id: "d1", label: "Default" },
      { id: "a", label: "Alpha" },
    ]);
    run(
      graph,
      editItems({
        target: LIST,
        key: "items",
        edit: {
          kind: "update",
          id: "a",
          patch: { label: "A", isDisabled: true },
        },
      }),
    );
    run(
      graph,
      editItems({
        target: LIST,
        key: "items",
        edit: { kind: "move", id: "a", index: 0 },
      }),
    );
    expect(items(graph)).toEqual([
      { id: "a", label: "A", isDisabled: true },
      { id: "d1", label: "Default" },
    ]);
    run(
      graph,
      editItems({
        target: LIST,
        key: "items",
        edit: { kind: "remove", id: 1 },
      }),
    );
    expect(items(graph)).toEqual([{ id: "a", label: "A", isDisabled: true }]);
    expect(
      code(() =>
        editItems({
          target: LIST,
          key: "items",
          edit: { kind: "remove", id: "zzz" },
        })(graph),
      ),
    ).toBe("ITEM_NOT_FOUND");
    undo(graph, added.result.inverse);
    // The add's inverse drops the whole own value: the default list shows again.
    expect(snapshot(graph)).toBe(initial);
  });

  it("edits rows inside a section; section rows stay flat", () => {
    const graph = graphOf([node("list", "lib:definition:listbox")], ["list"]);
    run(
      graph,
      editItems({
        target: LIST,
        key: "items",
        edit: {
          kind: "add",
          item: { id: "s", type: "section", header: "S", items: [] },
        },
      }),
    );
    for (const id of ["x", "y"])
      run(
        graph,
        editItems({
          target: LIST,
          key: "items",
          edit: { kind: "add", section: "s", item: { id, label: id } },
        }),
      );
    run(
      graph,
      editItems({
        target: LIST,
        key: "items",
        edit: { kind: "update", section: "s", id: "y", patch: { label: "Y" } },
      }),
    );
    run(
      graph,
      editItems({
        target: LIST,
        key: "items",
        edit: { kind: "remove", section: "s", id: "x" },
      }),
    );
    expect(items(graph)).toEqual([
      { id: "d1", label: "Default" },
      {
        id: "s",
        type: "section",
        header: "S",
        items: [{ id: "y", label: "Y" }],
      },
    ]);
    expect(
      code(() =>
        editItems({
          target: LIST,
          key: "items",
          edit: {
            kind: "add",
            section: "s",
            item: { id: "z", items: [] },
          },
        })(graph),
      ),
    ).toBe("SECTION_ROWS_ARE_FLAT");
    expect(
      code(() =>
        editItems({
          target: LIST,
          key: "items",
          edit: { kind: "add", section: "d1", item: { id: "z" } },
        })(graph),
      ),
    ).toBe("SECTION_NOT_FOUND");
  });

  it("edits the items an instance's template position shows (a path patch)", () => {
    const graph = graphOf([node("pick", "lib:definition:picker")], ["pick"]);
    const address: InstanceAddress = {
      instances: ["project:node:pick"],
      templatePath: ["lib:template:pickRoot", "lib:template:list"],
    };
    run(
      graph,
      editItems({
        target: { kind: "descendant", ownerId: "project:node:pick", address },
        key: "items",
        edit: { kind: "add", item: { id: "p", label: "Picked" } },
      }),
    );
    const list = resolveCatalogNode(graph, "project:node:pick").children[0]
      .children[1];
    expect(list.props.items).toEqual([
      { id: "d1", label: "Default" },
      { id: "p", label: "Picked" },
    ]);
  });
});
