import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CollectionEntry,
  DataCollectionId,
  EntryId,
  NodeEntry,
  NodeId,
  ProjectVariableEntry,
  ProjectVariableId,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import {
  setDataEntries,
  setProjectVariable,
} from "../../../../../../packages/shared/src/catalog/commands/data";
import { catalogBindingKey } from "../../../../../../packages/shared/src/catalog/runtime/stateTemplate";
import { reduceDataOps } from "../../stores/utils/dataChange";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogProjectVariableDefs } from "../catalogDataRead";
import { CatalogCompositionRoot } from "../compositionRoot";
import { newCatalogProjectDocument } from "../project";
import { catalogVariableCommands } from "../stateVariables";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-288 Phase 0 G0 — RED (`it.fails`): what the document does today that the ADR changes.
 * ① a variable rename leaves `{{ old }}` written in a Text · ② a project variable's type change
 * keeps a default of the old type · ④ a column head opens the field panel · ⑤ renaming a page
 * variable onto a project variable's name passes the conflict check and captures the page's
 * `{{ a }}` · ⑥ there is no rename that rewrites a prop and leaves a `binding.key` of the same
 * name (different resolution) alone. ③ (a saved layout holding an unregistered panel id) is a
 * fact, not a RED — `panelWorkspaceLayoutV4.test.ts` ("duplicate zone/row/rail …") shows the
 * normalizer drops unknown ids; `panelWorkspaceLayoutV4.unknownPanel.test.ts` pins the two ids.
 * Each case turns GREEN in Phase 1 (①②⑤⑥) · Phase 4 (④) and then loses `.fails` — ① ② ⑤ ⑥ did
 * on 2026-10-28 (`renameVariable` · `variableDefaultForType`).
 */
const PROJECT = "project:project:adr288" as EntryId<"project">;
const PAGE = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (name: string, text?: string): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: "lib:definition:heading" as NodeEntry["definitionId"],
  children: [],
  props: text === undefined ? {} : { children: { kind: "set", value: text } },
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const projectVariable = (
  raw: string,
  name: string,
  defaultValue: unknown,
  valueType: ProjectVariableEntry["valueType"] = "string",
): ProjectVariableEntry => ({
  kind: "projectVariable",
  id: `data:variable:${raw}` as ProjectVariableId,
  name,
  valueType,
  defaultValue,
  persist: false,
});

async function open(texts: Record<string, string>) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-288" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr288-red-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const entries = Object.entries(texts).map(([name, text]) => node(name, text));
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: entries.map((entry) => entry.id),
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  // The Canvas root with the document's project variables as its `{{ }}` source (what the Builder
  // wires at boot — the workspace's own root has no project variable source).
  const root = new CatalogCompositionRoot(
    workspace.runtime,
    await nodeLayoutEngine(),
    { width: 1000, height: 800 },
    undefined,
    undefined,
    undefined,
    undefined,
    { state: { projectVariables: () => catalogProjectVariableDefs(graph) } },
  );
  const record = (name: string) =>
    root.domInputs.get(root.recordsOfSource(id(name))[0]!)!;
  const stateVariable = (name: string): StateVariableEntry => {
    const project = graph.getEntry(graph.projectId);
    for (const variableId of project?.kind === "project"
      ? project.stateVariableIds
      : []) {
      const entry = graph.getEntry(variableId);
      if (entry?.kind === "stateVariable" && entry.name === name) return entry;
    }
    throw new Error(name);
  };
  const nodeEntry = (name: string) => graph.getEntry(id(name)) as NodeEntry;
  return { workspace, graph, root, record, stateVariable, nodeEntry };
}

describe("ADR-288 G0 RED", () => {
  it.fails(
    "① renaming a project variable rewrites the Text that reads it",
    async () => {
      const { workspace, record, root } = await open({
        greet: "{{ greeting }}",
      });
      workspace.execute(
        setProjectVariable({ entry: projectVariable("g", "greeting", "Hi") }),
      );
      root.refreshState();
      expect(record("greet").props.children).toBe("Hi");
      workspace.execute(
        setProjectVariable({ entry: projectVariable("g", "hello", "Hi") }),
      );
      root.refreshState();
      // Today: the Text keeps `{{ greeting }}` (unresolved — shown as written).
      expect(record("greet").templateProps?.children).toBe("{{ hello }}");
      expect(record("greet").props.children).toBe("Hi");
    },
  );

  it("② a project variable String → Number does not keep the String default", () => {
    const variables = new Map([
      [
        "g",
        {
          id: "v1",
          name: "g",
          project_id: "p",
          type: "string",
          defaultValue: "hi",
          persist: false,
          scope: "global",
          owner: { kind: "project" },
          created_at: "",
          updated_at: "",
        },
      ],
    ]) as never;
    const result = reduceDataOps(
      new Map(),
      [
        {
          op: "define_variable",
          variableId: "v1",
          definition: {
            name: "g",
            type: "number",
            defaultValue: "hi",
            persist: false,
          },
        },
      ],
      { projectId: "p", variables },
    );
    // Today the reducer stores whatever default it is given — `"hi"` on a Number variable.
    expect(result.variables.get("g")?.defaultValue).not.toBe("hi");
  });

  it("④ the column head no longer opens the field panel (a popover instead)", () => {
    const source = readFileSync(
      resolve(__dirname, "../../panels/datatable/grid/DataGrid.components.tsx"),
      "utf8",
    );
    expect(source).not.toContain("openFieldPanel");
    expect(source).toMatch(/ColumnEditorPopover|DialogTrigger/);
  });

  it("⑤ a page variable may not take a project variable's name that the page already reads", async () => {
    const { workspace, record, root, stateVariable } = await open({
      text: "{{ a }}",
    });
    workspace.execute(
      setProjectVariable({ entry: projectVariable("a", "a", "GLOBAL") }),
    );
    workspace.execute(catalogVariableCommands.add(PAGE, "x", workspace.newId));
    workspace.execute(
      catalogVariableCommands.setDefault(stateVariable("x"), "LOCAL"),
    );
    root.refreshState();
    expect(record("text").props.children).toBe("GLOBAL");
    // Today: `catalogVariableNameConflict` looks at state variables only — the rename passes and
    // the page's `{{ a }}` now reads the page value.
    expect(() =>
      workspace.execute(
        catalogVariableCommands.rename(stateVariable("x"), "a"),
      ),
    ).toThrow();
    root.refreshState();
    expect(record("text").props.children).toBe("GLOBAL");
  });

  it("⑥ renaming an element variable rewrites the node's prop but not its binding.key of the same name", async () => {
    const { workspace, graph, stateVariable, nodeEntry } = await open({
      item: "{{ a }}",
    });
    const collection: CollectionEntry = {
      kind: "collection",
      id: "data:collection:c1" as DataCollectionId,
      name: "Users",
      schema: [],
      mockData: [],
      useMockData: true,
    };
    workspace.execute(setDataEntries({ puts: [collection] }));
    workspace.execute(
      setProjectVariable({ entry: projectVariable("a", "a", "GLOBAL") }),
    );
    workspace.execute(
      catalogVariableCommands.add(id("item"), "a", workspace.newId),
    );
    workspace.execute(
      catalogVariableCommands.setDefault(stateVariable("a"), "LOCAL"),
    );
    workspace.execute(
      catalogBindingCommand([{ kind: "node", id: id("item") }], {
        collectionId: collection.id,
        fieldMap: {},
        key: "{{ a }}",
      }),
    );
    const source = {
      projectVariables: () => catalogProjectVariableDefs(graph),
    };
    expect(nodeEntry("item").binding?.key).toBe("{{ a }}");
    expect(catalogBindingKey(graph, "{{ a }}", id("item"), source)).toBe(
      "GLOBAL",
    );
    workspace.execute(catalogVariableCommands.rename(stateVariable("a"), "b"));
    // Phase 1: the prop (element chain) follows, the key (page · project) does not.
    const props = nodeEntry("item").props.children;
    expect(props?.kind === "set" ? props.value : props).toBe("{{ b }}");
    expect(nodeEntry("item").binding?.key).toBe("{{ a }}");
  });
});
