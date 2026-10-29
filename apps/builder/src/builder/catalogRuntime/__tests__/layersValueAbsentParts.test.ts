import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogLayerTreeStore, type CatalogLayerNode } from "../layerTree";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A field part whose text is a parent prop (`{description}` · `{errorMessage}`) and is empty has no
 * element in the DOM and no box on the Canvas: the Layers tree does not list it either. A part
 * hidden by a state (a valid field's error message) stays listed — the state can change.
 */
const PROJECT = "project:project:layers-absent" as EntryId<"project">;
const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;
const CHECKBOX = "project:node:cb" as NodeId;
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:a${++next}` as EntryId<K>;
};

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Layers" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `layers-value-absent-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: CHECKBOX,
          definitionId: "lib:definition:origin-component-checkbox",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [CHECKBOX],
      newId: allocator(),
    }),
  );
  const tree = new CatalogLayerTreeStore(
    {
      readModel: workspace.readModel,
      graph: workspace.runtime.graph,
      subscribeSteps: (listener) => workspace.runtime.subscribeSteps(listener),
      absentByValue: (position) => workspace.rowAbsentByValue(position),
    },
    HOME,
  );
  tree.connect();
  const record = (id: NodeId) => workspace.root.recordsOfSource(id)[0];
  tree.setExpanded(new Set([record(BODY), record(CHECKBOX)]));
  const checkboxRow = (): CatalogLayerNode =>
    tree.getSnapshot()[0].children![0];
  const set = (props: Record<string, string>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: CHECKBOX }],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set", value },
          ]),
        ),
      }),
    );
  return { checkboxRow, set };
}

const typeNames = (row: CatalogLayerNode) =>
  (row.children ?? []).map((child) => child.typeName);

describe("Layers — parts absent by an empty parent prop", () => {
  it("lists a Checkbox's Description · FieldError only while their text prop has a value", async () => {
    const { checkboxRow, set } = await open();
    expect(typeNames(checkboxRow())).toEqual(["CheckboxButton"]);

    set({ description: "Help" });
    expect(typeNames(checkboxRow())).toEqual(["CheckboxButton", "Description"]);

    // A message on a valid field: hidden by the state (not invalid), still listed.
    set({ errorMessage: "Required" });
    expect(typeNames(checkboxRow())).toEqual([
      "CheckboxButton",
      "Description",
      "FieldError",
    ]);

    set({ description: "", errorMessage: "" });
    expect(typeNames(checkboxRow())).toEqual(["CheckboxButton"]);
  });
});
