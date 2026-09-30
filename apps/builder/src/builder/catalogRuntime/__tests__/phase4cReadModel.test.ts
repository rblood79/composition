import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EditTarget,
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogCommand } from "../../../../../../packages/shared/src/catalog/commands/compose";
import {
  createComponent,
  duplicateNodes,
  insertNodes,
  removeTargets,
  setFields,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import { documentOf } from "../../../../../../packages/shared/src/catalog/commands/__tests__/fixture";
import type { CatalogPosition } from "../../../../../../packages/shared/src/catalog/resolution/positions";
import { CatalogRuntime } from "../controller";
import { CatalogReadModel } from "../readModel";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 4c read model: cached panel reads recompute only when an entry they read changed
 * (a row list: its parent, or a listed node's definition/enabled) and tell subscribers only when
 * the value differs. Contract: editing one leaf among 5k siblings recomputes no row list.
 */
const PAGE = "project:page:main" as EntryId<"page">;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  patch: Partial<NodeEntry> = {},
) =>
  ({
    kind: "node",
    id: id(name),
    definitionId,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...patch,
  }) as NodeEntry;
const text = (name: string, value: string) =>
  node(name, "lib:definition:text", {
    props: { children: { kind: "set", value } },
  });
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:r${++next}` as EntryId<K>;
};

async function open(nodes: NodeEntry[], roots: string[]) {
  const runtime = new CatalogRuntime(
    new CatalogGraph(documentOf(nodes, roots), await buildCodeCatalogLibrary()),
    new CatalogStorage(indexedDB, `adr248-phase4c-read-${Math.random()}`),
  );
  const model = new CatalogReadModel(runtime);
  const run = (command: CatalogCommand) => {
    const plan = command(runtime.graph);
    runtime.dispatch(plan.label, plan.ops);
    return plan;
  };
  return { runtime, model, run };
}

describe("ADR-248 Phase 4c read model", () => {
  it("5k siblings: a leaf edit recomputes no row list; a structural or row-field change recomputes once", async () => {
    const leaves = Array.from({ length: 5000 }, (_, index) =>
      text(`leaf${index}`, `Leaf ${index}`),
    );
    const { model, run } = await open(
      [
        node("frame", "lib:definition:type-frame", {
          children: leaves.map((leaf) => leaf.id),
        }),
        ...leaves,
      ],
      ["frame"],
    );
    const [frame] = model.pageRows(PAGE);
    const seen: (readonly CatalogPosition[])[] = [];
    model.subscribeRows({ position: frame }, (rows) => seen.push(rows));
    const rows = model.childRows(frame);
    expect(rows).toHaveLength(5000);
    const computed = model.stats.rows;
    run(
      setFields({
        targets: [{ kind: "node", id: id("leaf2500") }],
        props: { children: { kind: "set", value: "Edited" } },
      }),
    );
    expect(model.stats.rows).toBe(computed);
    expect(model.childRows(frame)).toBe(rows);
    expect(seen).toEqual([]);
    // A row field (enabled) changes the list once.
    run(
      setWholeField({
        targets: [{ kind: "node", id: id("leaf10") }],
        field: "enabled",
        value: false,
      }),
    );
    expect(model.stats.rows).toBe(computed + 1);
    expect(seen.at(-1)?.[10]).toMatchObject({ disabled: true });
    // A new child changes the parent: once more.
    run(
      insertNodes({
        parent: { kind: "node", id: id("frame") },
        entries: [text("extra", "Extra")],
        rootIds: [id("extra")],
        newId: allocator(),
      }),
    );
    expect(model.stats.rows).toBe(computed + 2);
    expect(seen.at(-1)).toHaveLength(5001);
  });

  it("instance rows follow the owner's overrides; a value-only override keeps the rows", async () => {
    const { model, run } = await open(
      [node("list", "lib:definition:origin-component-listbox")],
      ["list"],
    );
    const [listRow] = model.pageRows(PAGE);
    const [item1] = model.childRows(listRow);
    const itemRows: (readonly CatalogPosition[])[] = [];
    model.subscribeRows({ position: item1 }, (rows) => itemRows.push(rows));
    expect(model.childRows(item1)).toHaveLength(3);
    const label = model.childRows(item1)[1];
    run(
      setFields({
        targets: [label.target],
        props: { children: { kind: "set", value: "Mail" } },
      }),
    );
    expect(itemRows).toEqual([]);
    const description: EditTarget = model.childRows(item1)[2].target;
    run(removeTargets({ targets: [description] }));
    expect(itemRows.at(-1)?.map((row) => row.sourceId)).toEqual([
      "lib:template:component-listbox-item-default__icon" as TemplateId,
      "lib:template:component-listbox-item-default__label" as TemplateId,
    ]);
  });

  it("prop sources recompute only for their own records and notify on change", async () => {
    const { model, run } = await open(
      [text("a", "A"), text("b", "B")],
      ["a", "b"],
    );
    const a: EditTarget = { kind: "node", id: id("a") };
    const readings: unknown[] = [];
    model.subscribePropSource(a, "children", (reading) =>
      readings.push(reading.value),
    );
    expect(model.propSource(a, "children")).toMatchObject({
      value: "A",
      source: "own",
    });
    const computed = model.stats.props;
    run(
      setFields({
        targets: [{ kind: "node", id: id("b") }],
        props: { children: { kind: "set", value: "B2" } },
      }),
    );
    expect(model.stats.props).toBe(computed);
    run(
      setFields({
        targets: [a],
        props: { children: { kind: "set", value: "A2" } },
      }),
    );
    expect(readings).toEqual(["A2"]);
    expect(
      model.commonProp([a, { kind: "node", id: id("b") }], "children"),
    ).toEqual({ mixed: true, values: ["A2", "B2"] });
  });

  it("lists project components with their instance counts", async () => {
    const { model, run } = await open(
      [
        node("card", "lib:definition:type-frame", { children: [id("t")] }),
        text("t", "Title"),
      ],
      ["card"],
    );
    const counts: unknown[] = [];
    model.subscribeComponents((list) =>
      counts.push(list.map((item) => item.instanceCount)),
    );
    expect(model.components()).toEqual([]);
    const newId = allocator();
    const plan = run(createComponent({ id: id("card"), name: "Card", newId }));
    expect(model.components()).toMatchObject([
      { name: "Card", instanceCount: 1 },
    ]);
    run(duplicateNodes({ ids: plan.selectAfter!, newId }));
    expect(counts.at(-1)).toEqual([2]);
  });
});
