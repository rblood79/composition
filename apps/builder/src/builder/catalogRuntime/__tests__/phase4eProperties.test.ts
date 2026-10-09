import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EditTarget,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import {
  catalogEditContract,
  catalogSemanticPatchCommand,
} from "../editContract";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 Properties: the edit contract of a catalog target (reusable contract or the
 * shown type's accepts, value sources from the read model) and its patch command (one step over
 * every target, `undefined` back to the inherited value). A parent prop reaches its sub-parts at
 * read time — no write-time propagation (the old ADR-048 child patches).
 */
const PROJECT = "project:project:properties" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  props: NodeEntry["props"] = {},
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children: [],
  props,
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Properties" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-props-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  let n = 0;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node("icon", "lib:definition:origin-component-iconbutton", {
          label: { kind: "set", value: "Save" },
        }),
        node("field", "lib:definition:origin-component-textfield"),
        node("a", "lib:definition:text"),
        node("b", "lib:definition:text"),
      ],
      rootIds: [id("icon"), id("field"), id("a"), id("b")],
      newId: (kind) => `project:${kind}:t${++n}` as never,
    }),
  );
  const contract = (target: EditTarget) =>
    catalogEditContract(workspace.runtime.graph, workspace.readModel, target);
  const field = (target: EditTarget, key: string) =>
    contract(target).fields.find((item) => item.key === key)!;
  const patch = (targets: EditTarget[], values: Record<string, unknown>) =>
    catalogSemanticPatchCommand(
      targets,
      values,
      (key) => workspace.readModel.propSource(targets[0], key).value,
    );
  return { workspace, contract, field, patch };
}
const on = (name: string): EditTarget => ({ kind: "node", id: id(name) });

describe("ADR-248 Phase 4e-4 Properties", () => {
  it("a reusable origin instance shows its declared contract with value sources", async () => {
    const { contract, field } = await open();
    const icon = contract(on("icon"));
    expect(icon.fields.map((item) => item.key)).toEqual([
      "label",
      "icon",
      "variant",
      "size",
      "staticColor",
      "isDisabled",
    ]);
    expect(field(on("icon"), "label")).toMatchObject({
      origin: "semantic",
      isOverridden: true,
      currentValue: "Save",
      baseValue: "Button",
    });
    expect(field(on("icon"), "icon")).toMatchObject({
      isOverridden: false,
      currentValue: "star",
    });
    // Variant and size options come from the shown type's theme rule.
    expect(field(on("icon"), "size").options?.length).toBeGreaterThan(0);
  });

  it("an edit is one step over every target; back to the inherited value removes the own write", async () => {
    const { workspace, field, patch } = await open();
    const revision = workspace.runtime.graph.revision;
    workspace.execute(patch([on("a"), on("b")], { children: "Both" })!);
    expect(workspace.runtime.graph.revision).toBe(revision + 1);
    expect(field(on("a"), "children")).toMatchObject({
      isOverridden: true,
      currentValue: "Both",
    });
    expect(field(on("b"), "children").currentValue).toBe("Both");
    // Unchanged: no command.
    expect(patch([on("a")], { children: "Both" })).toBeUndefined();
    workspace.execute(patch([on("a")], { children: undefined })!);
    expect(field(on("a"), "children").isOverridden).toBe(false);
    workspace.undo();
    expect(field(on("a"), "children").currentValue).toBe("Both");
  });

  it("a parent prop reaches its sub-parts at read time (no child writes)", async () => {
    const { workspace, field, patch } = await open();
    expect(field(on("field"), "size").currentValue).toBe("M");
    const root = () =>
      workspace.root.domInputs.get(
        workspace.root.recordsOfSource(id("field"))[0],
      )!;
    const labelSize = () =>
      workspace.root.domInputs.get(root().children[0])!.visual.fontSize;
    const before = labelSize();
    const { result } = workspace.execute(patch([on("field")], { size: "L" })!);
    // Only the instance changed; its Label shows the larger size.
    expect([...result.changedIds]).toEqual([id("field")]);
    expect(labelSize()).not.toBe(before);
  });

  it("an instance prop bound into its template re-resolves the template records (Canvas follows)", async () => {
    const { workspace, patch } = await open();
    const scene = new CatalogCanvasScene(workspace.root);
    const label = () => {
      const records = workspace.root.domInputs;
      const root = records.get(workspace.root.recordsOfSource(id("icon"))[0])!;
      return root.children
        .map((child) => records.get(child)!)
        .find((record) => record.props.slot === "label")?.props.children;
    };
    expect(label()).toBe("Save");
    workspace.execute(patch([on("icon")], { label: "Go" })!);
    expect(label()).toBe("Go");
    expect(scene.sync().kind).not.toBe("unchanged");
    workspace.undo();
    expect(label()).toBe("Save");
  });

  it("an instance descendant is edited through its owner (the position's contract and patch)", async () => {
    const { workspace, contract, field, patch } = await open();
    const [iconRow] = workspace.readModel
      .pageRows("project:page:home" as EntryId<"page">)
      .flatMap((row) => workspace.readModel.childRows(row))
      .filter((row) => row.sourceId === id("icon"));
    const [inner] = workspace.readModel.childRows(iconRow);
    expect(inner.target.kind).toBe("descendant");
    const inside = contract(inner.target);
    expect(inside.fields.length).toBeGreaterThan(0);
    // The contract is the position's own definition (the deepest template on its path).
    expect(
      inner.target.kind === "descendant" &&
        inner.target.address.templatePath.length,
    ).toBeGreaterThan(1);
    expect(inside.type).toBe(
      definitionTypeName(workspace.runtime.graph, inner.definitionId),
    );
    const key = inside.fields[0].key;
    const next =
      typeof inside.fields[0].currentValue === "boolean"
        ? !inside.fields[0].currentValue
        : "Changed";
    const { result } = workspace.execute(
      patch([inner.target], { [key]: next })!,
    );
    expect([...result.changedIds]).toEqual([id("icon")]);
    expect(field(inner.target, key)).toMatchObject({
      isOverridden: true,
      currentValue: next,
    });
  });
});
