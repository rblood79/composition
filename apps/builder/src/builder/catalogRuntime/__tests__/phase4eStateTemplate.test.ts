import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogTextOf } from "../canvasText";
import { CatalogCompositionRoot } from "../compositionRoot";
import { newCatalogProjectDocument } from "../project";
import { catalogVariableCommands } from "../stateVariables";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e-6 `{{ name }}` over the catalog document (ADR-214): the Canvas shows each template at
 * its variables' defaults — the element variables of the nodes above it, its page's, the
 * project's; an unknown name stays as written. The record keeps the written text (the text editor
 * edits that), and a variable edit re-resolves the readers.
 */
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
  text?: string,
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: text === undefined ? {} : { children: { kind: "set", value: text } },
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:state" as EntryId<"project">,
        name: "State",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-4e6-state-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const entries = [
    node("box", "lib:definition:type-frame", [id("count"), id("greet")]),
    node("count", "lib:definition:heading", [], "Count: {{ count }}"),
    node("greet", "lib:definition:heading", [], "Hi {{ who }} {{ nope }}"),
  ];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: [id("box")],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId);
  const pageId = (
    project?.kind === "project" ? project.pageIds[0] : undefined
  ) as EntryId<"page">;
  const record = (name: string) =>
    workspace.root.domInputs.get(workspace.root.recordsOfSource(id(name))[0]!)!;
  const variable = (name: string) => {
    const project = graph.getEntry(graph.projectId);
    for (const variableId of project?.kind === "project"
      ? project.stateVariableIds
      : []) {
      const entry = graph.getEntry(variableId);
      if (entry?.kind === "stateVariable" && entry.name === name)
        return entry as StateVariableEntry;
    }
    throw new Error(name);
  };
  return { workspace, pageId, record, variable };
}

describe("ADR-248 4e-6 state templates on the Canvas", () => {
  it("resolves element and page variables at their defaults; unknown names stay written", async () => {
    const { workspace, pageId, record, variable } = await open();
    expect(record("count").props.children).toBe("Count: {{ count }}");
    workspace.execute(
      catalogVariableCommands.add(id("box"), "count", workspace.newId),
    );
    workspace.execute(
      catalogVariableCommands.setType(variable("count"), "number"),
    );
    workspace.execute(catalogVariableCommands.setDefault(variable("count"), 3));
    expect(record("count").props.children).toBe("Count: 3");
    expect(record("count").templateProps?.children).toBe("Count: {{ count }}");
    expect(catalogTextOf(record("count"), "children")).toBe(
      "Count: {{ count }}",
    );
    // A text edit (a value step) resolves the new text.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("count") }],
        props: { children: { kind: "set", value: "N={{ count }}" } },
      }),
    );
    expect(record("count").props.children).toBe("N=3");
    workspace.undo();
    workspace.execute(
      catalogVariableCommands.add(pageId, "who", workspace.newId),
    );
    workspace.execute(
      catalogVariableCommands.setDefault(variable("who"), "Ann"),
    );
    expect(record("greet").props.children).toBe("Hi Ann {{ nope }}");
    // A rename leaves the old name unresolved; undo brings it back.
    workspace.execute(catalogVariableCommands.rename(variable("count"), "n"));
    expect(record("count").props.children).toBe("Count: {{ count }}");
    workspace.undo();
    expect(record("count").props.children).toBe("Count: 3");
  });

  it("an element variable is seen only below its owner; project variables come from the source", async () => {
    const { workspace, record, variable } = await open();
    workspace.execute(
      catalogVariableCommands.add(id("count"), "who", workspace.newId),
    );
    workspace.execute(
      catalogVariableCommands.setDefault(variable("who"), "Own"),
    );
    expect(record("greet").props.children).toBe("Hi {{ who }} {{ nope }}");
    let defaults = "Bo";
    const root = new CatalogCompositionRoot(
      workspace.runtime,
      await nodeLayoutEngine(),
      { width: 1000, height: 800 },
      undefined,
      undefined,
      undefined,
      undefined,
      {
        state: {
          projectVariables: () => [
            { id: "v1", name: "nope", type: "string", defaultValue: defaults },
          ],
        },
      },
    );
    const greet = () =>
      root.domInputs.get(root.recordsOfSource(id("greet"))[0]!)!.props.children;
    expect(greet()).toBe("Hi {{ who }} Bo");
    defaults = "Cy";
    expect(greet()).toBe("Hi {{ who }} Bo");
    root.refreshState(new Set(["nope"]));
    expect(greet()).toBe("Hi {{ who }} Cy");
  });
});
