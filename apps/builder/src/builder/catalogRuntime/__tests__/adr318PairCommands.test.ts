import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  duplicateNodes,
  insertNodes,
  moveNodes,
  removeTargets,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { NodeParent } from "../../../../../../packages/shared/src/catalog/commands/context";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogItemInsertChoices } from "../itemInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-318 G6 — the commands keep a Resizable Group `Panel (Handle Panel)*` (breakdown §5.1): a
 * Panel's delete takes its Handle, a Handle alone is refused (delete · move · duplicate), the
 * Group's 「+」 and a Panel's duplicate bring a Handle, a Panel moved in its Group swaps places with
 * Panels (the Handles stay), a Panel does not leave its Group — each one step, one Undo.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;
const SHORT = { ResizablePanel: "P", ResizableHandle: "H" } as Record<
  string,
  string
>;

async function place() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr318-g6" as EntryId<"project">,
        name: "ADR-318 G6",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr318-g6-${Math.random()}`),
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
          id: PLACED,
          definitionId:
            "lib:definition:origin-component-resizablepanelgroup" as LibraryDefinitionId,
          children: [],
          props: {},
          visual: { width: { kind: "set", value: 600 } } as never,
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  /** The Group's slot list (owned nodes — the placed origin fills its 「Panels」 slot). */
  const slot = (): NodeParent => {
    const placed = graph.getEntry(PLACED);
    const fill =
      placed?.kind === "node"
        ? placed.descendantOverrides.find((o) => o.kind === "fillSlot")
        : undefined;
    if (!fill) throw new Error("no slot fill");
    return { kind: "descendant", ownerId: PLACED, address: fill.address };
  };
  const ids = (): NodeId[] => {
    const placed = graph.getEntry(PLACED);
    const fill =
      placed?.kind === "node"
        ? placed.descendantOverrides.find((o) => o.kind === "fillSlot")
        : undefined;
    return fill?.kind === "fillSlot" ? [...fill.childIds] : [];
  };
  const shape = () => {
    const root = workspace.root;
    const group = [...root.canvasInputs.values()].find(
      (r) => r.sourceId === PLACED,
    )!;
    return group.children
      .map((id) => SHORT[root.typeOf(root.canvasInputs.get(id)!)] ?? "?")
      .join("");
  };
  return { workspace, ids, shape, slot };
}

const refused = (run: () => void) => {
  try {
    run();
  } catch (error) {
    return `${(error as { code?: string }).code} ${String(error)}`;
  }
  return "";
};

describe("ADR-318 G6 — Resizable pair-keeping commands", () => {
  it("a Panel's delete takes its Handle (before it, else after it) — one Undo", async () => {
    const t = await place();
    expect(t.shape()).toBe("PHP");
    const [p1, , p2] = t.ids();
    t.workspace.execute(
      removeTargets({ targets: [{ kind: "node", id: p2! }] }),
    );
    expect(t.shape()).toBe("P");
    t.workspace.undo();
    expect(t.shape()).toBe("PHP");
    t.workspace.execute(
      removeTargets({ targets: [{ kind: "node", id: p1! }] }),
    );
    expect(t.shape()).toBe("P");
    expect(t.ids()).toEqual([p2]);
  });

  it("a Handle alone is not deleted · moved · duplicated", async () => {
    const t = await place();
    const [p1, h] = t.ids();
    const code = "REQUIRED_PART_NOT_REMOVABLE";
    expect(
      refused(() =>
        t.workspace.execute(
          removeTargets({ targets: [{ kind: "node", id: h! }] }),
        ),
      ),
    ).toContain(code);
    expect(
      refused(() =>
        t.workspace.execute(
          moveNodes({
            ids: [h!],
            parent: t.slot(),
            index: 0,
            newId: t.workspace.newId,
          }),
        ),
      ),
    ).toContain(code);
    expect(
      refused(() =>
        t.workspace.execute(
          duplicateNodes({ ids: [h!], newId: t.workspace.newId }),
        ),
      ),
    ).toContain(code);
    // (A Panel and its Handle deleted together are a pair.)
    t.workspace.execute(
      removeTargets({
        targets: [
          { kind: "node", id: p1! },
          { kind: "node", id: h! },
        ],
      }),
    );
    expect(t.shape()).toBe("P");
  });

  it("the Group's 「+」 adds a Handle and a Panel in one step", async () => {
    const t = await place();
    const position = t.workspace.positionOfRecord(
      [...t.workspace.root.canvasInputs.values()].find(
        (r) => r.sourceId === PLACED,
      )!.id,
    )!;
    const choices = catalogItemInsertChoices(
      {
        graph: t.workspace.runtime.graph,
        readModel: t.workspace.readModel,
        newId: t.workspace.newId,
      },
      position,
    );
    expect(choices.map((c) => c.type)).toEqual(["ResizablePanel"]);
    t.workspace.execute(choices[0]!.build());
    expect(t.shape()).toBe("PHPHP");
    t.workspace.undo();
    expect(t.shape()).toBe("PHP");
  });

  it("a Panel's duplicate brings a Handle before the copy", async () => {
    const t = await place();
    const [p1] = t.ids();
    t.workspace.execute(
      duplicateNodes({ ids: [p1!], newId: t.workspace.newId }),
    );
    expect(t.shape()).toBe("PHPHP");
  });

  it("a Panel moved in its Group swaps places with Panels; it does not leave the Group", async () => {
    const t = await place();
    const [p1, h, p2] = t.ids();
    t.workspace.execute(
      moveNodes({
        ids: [p2!],
        parent: t.slot(),
        index: 0,
        newId: t.workspace.newId,
      }),
    );
    expect(t.ids()).toEqual([p2, h, p1]);
    expect(
      refused(() =>
        t.workspace.execute(
          moveNodes({
            ids: [p1!],
            parent: { kind: "node", id: BODY },
            newId: t.workspace.newId,
          }),
        ),
      ),
      // (the nesting rule refuses a Panel outside a Group first — its owners are Groups)
    ).toContain("body>ResizablePanel");
  });
});
