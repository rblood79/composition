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
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import {
  catalogAncestorVariables,
  catalogNextVariableName,
  catalogOwnVariables,
  catalogParseVariableValue,
  catalogVariableCommands,
  catalogVariableNameConflict,
  catalogVariableOwner,
  catalogVariableUsageCount,
} from "../stateVariables";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 State section: a node's (or, for a page body, its page's) state variables —
 * add, rename (unique on the visibility chain), type (default reset), default, delete (the
 * interactions that set it go too) — each one history step.
 */
const PROJECT = "project:project:state" as EntryId<"project">;
const PAGE = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (name: string, children: NodeId[] = []): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: "lib:definition:type-frame",
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "State" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-state-${Math.random()}`),
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
      entries: [node("outer", [id("inner")]), node("inner"), node("side")],
      rootIds: [id("outer"), id("side")],
      newId: (kind) => `project:${kind}:k${++n}` as never,
    }),
  );
  return { workspace, graph: workspace.runtime.graph };
}

describe("ADR-248 Phase 4e-4 State section", () => {
  it("a page body edits its page's variables; names stay unique on the chain only", async () => {
    const { workspace, graph } = await open();
    expect(catalogVariableOwner(graph, BODY)).toBe(PAGE);
    expect(catalogVariableOwner(graph, id("inner"))).toBe(id("inner"));

    workspace.execute(
      catalogVariableCommands.add(
        PAGE,
        catalogNextVariableName(graph, PAGE),
        workspace.newId,
      ),
    );
    const [pageVar] = catalogOwnVariables(graph, PAGE);
    expect(pageVar).toMatchObject({ name: "state1", valueType: "string" });
    // A descendant sees it, and cannot take its name; its next name skips it.
    expect(catalogAncestorVariables(graph, id("inner"))).toEqual([pageVar]);
    expect(catalogVariableNameConflict(graph, id("inner"), "state1")).toEqual(
      pageVar,
    );
    expect(catalogNextVariableName(graph, id("inner"))).toBe("state2");

    workspace.execute(
      catalogVariableCommands.add(id("inner"), "open", workspace.newId),
    );
    // Its own variables are not listed as visible from ancestors.
    expect(catalogAncestorVariables(graph, id("inner"))).toEqual([pageVar]);
    // The page sees a descendant's name as taken (it would shadow); a sibling branch does not.
    expect(catalogVariableNameConflict(graph, PAGE, "open")?.ownerId).toBe(
      id("inner"),
    );
    expect(catalogVariableNameConflict(graph, id("side"), "open")).toBe(
      undefined,
    );
    expect(catalogOwnVariables(graph, id("outer"))).toEqual([]);
  });

  it("type resets the default; default parses per type; delete; undo restores", async () => {
    const { workspace, graph } = await open();
    workspace.execute(
      catalogVariableCommands.add(id("outer"), "count", workspace.newId),
    );
    const current = () => catalogOwnVariables(graph, id("outer"))[0];
    workspace.execute(catalogVariableCommands.setType(current(), "number"));
    expect(current()).toMatchObject({ valueType: "number", defaultValue: 0 });
    expect(catalogParseVariableValue("number", "abc")).toBe(undefined);
    workspace.execute(
      catalogVariableCommands.setDefault(
        current(),
        catalogParseVariableValue("number", "3")!,
      ),
    );
    expect(current().defaultValue).toBe(3);
    workspace.execute(catalogVariableCommands.rename(current(), "total"));
    expect(current().name).toBe("total");

    // The code library declares no triggers yet (4e-4e Interactions), so no setter exists here;
    // removeRecords' setter removal is covered by the shared command tests.
    const variable: StateVariableEntry = current();
    expect(catalogVariableUsageCount(graph, variable.id)).toBe(0);
    const revision = graph.revision;
    workspace.execute(catalogVariableCommands.remove(variable.id));
    expect(graph.revision).toBe(revision + 1);
    expect(catalogOwnVariables(graph, id("outer"))).toEqual([]);
    workspace.undo();
    expect(current()).toEqual(variable);
  });
});
