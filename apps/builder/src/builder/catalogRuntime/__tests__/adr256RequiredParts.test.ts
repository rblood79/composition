import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { REUSABLE_ORIGIN_TEMPLATES } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import type {
  DefinitionId,
  EntryId,
  LibraryTemplateId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  moveNodes,
  removeTargets,
} from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Decision 5 — a part RAC needs for its owner to work (G0 ⑨: without it the owner loses
 * its role) cannot be deleted or moved out of its owner; reordering inside, deleting the whole
 * owner, and optional parts stay allowed.
 */
const PROJECT = "project:project:adr256-required" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const templates = new Map(REUSABLE_ORIGIN_TEMPLATES.map((t) => [t.id, t]));

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Required" }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-required-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  return { workspace, graph: workspace.runtime.graph, library };
}
const node = (
  id: NodeId,
  definitionId: string,
  children: NodeId[] = [],
): NodeEntry => ({
  kind: "node",
  id,
  definitionId: definitionId as DefinitionId,
  children,
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const code = (run: () => unknown) => {
  try {
    run();
    return "ok";
  } catch (error) {
    return (error as { code?: string }).code ?? (error as Error).message;
  }
};

describe("ADR-256 Decision 5 — required parts", () => {
  it("an instance's required template part is not hidden; an optional one is", async () => {
    const { workspace, graph, library } = await open();
    const place = (name: string) => {
      const id = workspace.newId("node") as NodeId;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [node(id, `lib:definition:origin-component-${name}`)],
          rootIds: [id],
          newId: workspace.newId,
        }),
      );
      const origin = library.definitions.get(
        `lib:definition:origin-component-${name}` as `lib:definition:${string}`,
      ) as { templateRootId: LibraryTemplateId };
      const root = templates.get(origin.templateRootId)!;
      const partOf = (type: string) =>
        root.children.find(
          (child) =>
            definitionTypeName(graph, templates.get(child)!.definitionId) ===
            type,
        )!;
      const target = (type: string) => ({
        kind: "descendant" as const,
        ownerId: id,
        address: {
          instances: [id],
          templatePath: [origin.templateRootId, partOf(type)],
        },
      });
      return { id, target };
    };
    const select = place("select");
    expect(
      code(() =>
        workspace.execute(
          removeTargets({ targets: [select.target("Button")] }),
        ),
      ),
    ).toBe("REQUIRED_PART_NOT_REMOVABLE");
    expect(
      code(() =>
        workspace.execute(
          removeTargets({ targets: [select.target("Description")] }),
        ),
      ),
    ).toBe("ok");
    const field = place("textfield");
    expect(
      code(() =>
        workspace.execute(removeTargets({ targets: [field.target("Input")] })),
      ),
    ).toBe("REQUIRED_PART_NOT_REMOVABLE");
    // Deleting the whole owner takes its parts with it.
    expect(
      code(() =>
        workspace.execute(
          removeTargets({ targets: [{ kind: "node", id: select.id }] }),
        ),
      ),
    ).toBe("ok");
  });

  it("an owned required part is not deleted or moved out; it moves inside its owner", async () => {
    const { workspace } = await open();
    const id = (name: string) => `project:node:${name}` as NodeId;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node(id("tabs"), "lib:definition:type-Tabs", [
            id("wrap"),
            id("panel"),
          ]),
          node(id("wrap"), "lib:definition:type-frame", [id("list")]),
          node(id("list"), "lib:definition:type-TabList", [id("tab")]),
          node(id("tab"), "lib:definition:type-Tab"),
          node(id("panel"), "lib:definition:type-TabPanel"),
        ],
        rootIds: [id("tabs")],
        newId: workspace.newId,
      }),
    );
    const remove = (name: string) =>
      code(() =>
        workspace.execute(
          removeTargets({ targets: [{ kind: "node", id: id(name) }] }),
        ),
      );
    // The TabList, or the frame around it, is the Tabs' only list.
    expect(remove("list")).toBe("REQUIRED_PART_NOT_REMOVABLE");
    expect(remove("wrap")).toBe("REQUIRED_PART_NOT_REMOVABLE");
    // Out of the Tabs: refused (the nesting owners check already ties a TabList to its Tabs).
    // Inside the Tabs (out of the frame): allowed.
    expect(
      code(() =>
        workspace.execute(
          moveNodes({
            ids: [id("list")],
            parent: { kind: "node", id: BODY },
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("NESTING_NOT_ALLOWED");
    expect(
      code(() =>
        workspace.execute(
          moveNodes({
            ids: [id("list")],
            parent: { kind: "node", id: id("tabs") },
            index: 0,
            newId: workspace.newId,
          }),
        ),
      ),
    ).toBe("ok");
    // The panel is optional (RAC keeps the tablist without it).
    expect(remove("panel")).toBe("ok");
    expect(remove("tabs")).toBe("ok");
  });

  it("a part with no nesting owner (a DialogTrigger's Button) is still kept in its owner", async () => {
    const { workspace } = await open();
    const id = (name: string) => `project:node:${name}` as NodeId;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node(id("trigger"), "lib:definition:type-DialogTrigger", [
            id("open"),
            id("dialog"),
          ]),
          node(id("open"), "lib:definition:type-Button"),
          node(id("dialog"), "lib:definition:type-Dialog"),
        ],
        rootIds: [id("trigger")],
        newId: workspace.newId,
      }),
    );
    const move = () =>
      code(() =>
        workspace.execute(
          moveNodes({
            ids: [id("open")],
            parent: { kind: "node", id: BODY },
            newId: workspace.newId,
          }),
        ),
      );
    expect(move()).toBe("REQUIRED_PART_NOT_REMOVABLE");
    // A second Button beside it (a swap in progress) lets the first one go.
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: id("trigger") },
        entries: [node(id("other"), "lib:definition:type-Button")],
        rootIds: [id("other")],
        newId: workspace.newId,
      }),
    );
    expect(move()).toBe("ok");
  });
});
