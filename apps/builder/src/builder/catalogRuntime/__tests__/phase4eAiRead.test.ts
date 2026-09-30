import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { setAiReadHost } from "../../../services/ai/aiReadHost";
import { buildBuilderContext } from "../../../services/ai/builderContext";
import { readCompilerState } from "../../../services/ai/compiler/builderHost";
import { getAiToolReadModel } from "../../../services/ai/tools/canonicalToolReadModel";
import { getSelectionTool } from "../../../services/ai/tools/getSelection";
import type { ToolTranslate } from "../../../types/integrations/ai.types";
import { createCatalogAiReadHost } from "../aiHost";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-5 AI read model: with the catalog read host installed, the AI tools read the
 * open workspace — its element rows (ids = record identities, parents, pages, resolved props), the
 * session page and selection — and the compiler context carries each element's edit contract and
 * the creation parent (the palette's rule). An edit shows on the next read.
 */
const PROJECT = "project:project:ai" as EntryId<"project">;
const HOME = "project:page:home";
const BODY = "project:node:home-body" as NodeId;
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  children: NodeId[] = [],
  props: NodeEntry["props"] = {},
): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props,
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const t: ToolTranslate = (key) => key;

let uninstall: (() => void) | undefined;
afterEach(() => {
  uninstall?.();
  uninstall = undefined;
});

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "AI" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-ai-${Math.random()}`),
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
        node("list", "lib:definition:type-frame", [id("a")]),
        node("a", "lib:definition:text", [], {
          children: { kind: "set", value: "Hello" },
        }),
      ],
      rootIds: [id("list")],
      newId: (kind: EntryKind) => `project:${kind}:r${++n}` as never,
    }),
  );
  uninstall = setAiReadHost(createCatalogAiReadHost(workspace));
  const record = (name: string | NodeId) =>
    workspace.root.recordsOfSource(
      name.startsWith("project:") ? (name as NodeId) : id(name),
    )[0];
  return { workspace, record };
}

describe("ADR-248 Phase 4e-5 AI read model", () => {
  it("the tool read model is the workspace's element rows, page and selection", async () => {
    const { workspace, record } = await open();
    workspace.selectRecords([record("a")]);
    const model = getAiToolReadModel();
    const a = model.elementsById.get(record("a"))!;
    expect(a).toMatchObject({
      parent_id: record("list"),
      page_id: HOME,
    });
    expect(a.props.children).toBe("Hello");
    expect(model.elementsById.get(record("list"))!.parent_id).toBe(
      record(BODY),
    );
    expect(
      model.childrenByParent.get(record("list"))!.map((e) => e.id),
    ).toEqual([record("a")]);
    expect(model.state).toMatchObject({
      currentPageId: HOME,
      selectedElementId: record("a"),
      selectedElementIds: [record("a")],
    });
    // An edit shows on the next read.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("a") }],
        props: { children: { kind: "set", value: "Bye" } },
      }),
    );
    expect(
      getAiToolReadModel().elementsById.get(record("a"))!.props.children,
    ).toBe("Bye");
  });

  it("the builder context and the get_selection tool read the selection", async () => {
    const { workspace, record } = await open();
    workspace.selectRecords([record("a")]);
    const context = buildBuilderContext({
      ...getAiToolReadModel(),
      collections: [],
      openDataEditor: null,
    });
    expect(context.currentPageId).toBe(HOME);
    expect(context.selectedElement).toMatchObject({
      id: record("a"),
      parent_id: record("list"),
    });
    expect(context.elements.map((e) => e.id)).toContain(record("list"));
    const result = await getSelectionTool.execute({}, t);
    expect(result.success).toBe(true);
    expect(JSON.stringify(result.data)).toContain(record("a"));
  });

  it("the compiler context: each element's edit contract, the creation parent, the selection", async () => {
    const { workspace, record } = await open();
    workspace.selectRecords([record("a")]);
    const { context, identity } = readCompilerState();
    expect(context.selectedId).toBe(record("a"));
    // A Text holds no Frame: the new element goes to its container.
    expect(context.parentId).toBe(record("list"));
    const a = context.nodes.find((entry) => entry.id === record("a"))!;
    expect(a.props.map((field) => field.name)).toContain("children");
    expect(identity).toContain(HOME);
    workspace.session.clearSelection();
    expect(readCompilerState().context.parentId).toBe(record(BODY));
  });

  it("without a host the old stores are read (empty here)", async () => {
    await open();
    uninstall?.();
    uninstall = undefined;
    expect(getAiToolReadModel().elements).toEqual([]);
  });
});
