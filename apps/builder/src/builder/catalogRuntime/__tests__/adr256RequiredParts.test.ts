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
  createComponent,
  detachInstances,
  insertNodes,
  moveNodes,
  removeTargets,
  setFields,
  ungroupNodes,
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
    // Phase 1 review m3: an explicit detach on the required trigger is refused at the command
    // (Properties hides the choice; a property paste or the AI reaches setFields directly).
    const detach = (target: ReturnType<typeof select.target>) =>
      code(() =>
        workspace.execute(
          setFields({
            targets: [target],
            props: { slot: { kind: "set", value: false } },
          }),
        ),
      );
    expect(detach(select.target("Button"))).toBe("REQUIRED_PART_NOT_REMOVABLE");
    expect(detach(select.target("Description"))).toBe("ok");
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

  /**
   * Phase 1 review — the check is the command's result: an owner that held a part before still
   * holds one after. The paths the review found past the old check (a part below a part, a hidden
   * wrapper of a template part, a move to another owner of the same type, every twin at once, an
   * ungroup of the part itself).
   */
  describe("judged on the command's result (Phase 1 review h2 · m1 · m2 · m4)", () => {
    const placeOrigin = async (name: string) => {
      const opened = await open();
      const id = opened.workspace.newId("node") as NodeId;
      opened.workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [node(id, `lib:definition:origin-component-${name}`)],
          rootIds: [id],
          newId: opened.workspace.newId,
        }),
      );
      const typeOf = (nodeId: string) =>
        definitionTypeName(
          opened.graph,
          (opened.graph.getEntry(nodeId) as NodeEntry).definitionId,
        );
      const owned = (type: string, under: string = id): NodeId[] => {
        const out: NodeId[] = [];
        const walk = (at: string) => {
          for (const child of (opened.graph.getEntry(at) as NodeEntry)
            .children) {
            if (typeOf(child) === type) out.push(child);
            walk(child);
          }
        };
        walk(under);
        return out;
      };
      return { ...opened, id, typeOf, owned };
    };

    it("a detached Slider's only thumb (inside the track) is kept", async () => {
      const { workspace, id, owned } = await placeOrigin("slider");
      workspace.execute(detachInstances({ ids: [id], newId: workspace.newId }));
      const [thumb] = owned("SliderThumb");
      expect(thumb).toBeTruthy();
      expect(
        code(() =>
          workspace.execute(
            removeTargets({ targets: [{ kind: "node", id: thumb! }] }),
          ),
        ),
      ).toBe("REQUIRED_PART_NOT_REMOVABLE");
    });

    it("hiding a ComboBox's control wrapper (it holds the Input) is refused", async () => {
      const { workspace, graph, library, id } = await placeOrigin("combobox");
      const origin = library.definitions.get(
        "lib:definition:origin-component-combobox",
      ) as { templateRootId: LibraryTemplateId };
      const root = templates.get(origin.templateRootId)!;
      const wrapper = root.children.find(
        (child) =>
          definitionTypeName(graph, templates.get(child)!.definitionId) ===
          "Group",
      )!;
      expect(wrapper).toBeTruthy();
      expect(
        code(() =>
          workspace.execute(
            removeTargets({
              targets: [
                {
                  kind: "descendant",
                  ownerId: id,
                  address: {
                    instances: [id],
                    templatePath: [origin.templateRootId, wrapper],
                  },
                },
              ],
            }),
          ),
        ),
      ).toBe("REQUIRED_PART_NOT_REMOVABLE");
    });

    it("hiding a project component's control wrapper (it holds the Input) is refused (repair check RV-H1)", async () => {
      const { workspace, graph, id, owned } = await placeOrigin("combobox");
      workspace.execute(detachInstances({ ids: [id], newId: workspace.newId }));
      const [wrapper] = owned("Group");
      expect(wrapper).toBeTruthy();
      workspace.execute(
        createComponent({ id, name: "My combo", newId: workspace.newId }),
      );
      const instance = (graph.getEntry(BODY) as NodeEntry).children.find(
        (child) => child !== id && !String(child).includes("home"),
      )!;
      expect(
        (graph.getEntry(instance) as NodeEntry).definitionId.startsWith(
          "project:",
        ),
      ).toBe(true);
      expect(
        code(() =>
          workspace.execute(
            removeTargets({
              targets: [
                {
                  kind: "descendant",
                  ownerId: instance,
                  address: {
                    instances: [instance],
                    templatePath: [id, wrapper!],
                  },
                },
              ],
            }),
          ),
        ),
      ).toBe("REQUIRED_PART_NOT_REMOVABLE");
    });

    it("an extra Button moved out of a Select instance is allowed: its template trigger stays (repair check RV-M1)", async () => {
      const { workspace, library } = await open();
      const select = library.definitions.get(
        "lib:definition:origin-component-select",
      ) as { templateRootId: LibraryTemplateId };
      const ids = ["a", "b"].map((name) => `project:node:${name}` as NodeId);
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: ids.map((nodeId) =>
            node(nodeId, "lib:definition:origin-component-select"),
          ),
          rootIds: ids,
          newId: workspace.newId,
        }),
      );
      const [a, b] = ids as [NodeId, NodeId];
      // The extra Button sits in the Select's first option (its nearest Button owner is the Select).
      const atRoot = (owner: NodeId) => ({
        kind: "descendant" as const,
        ownerId: owner,
        address: {
          instances: [owner],
          templatePath: [
            select.templateRootId,
            "lib:template:component-select__listbox" as LibraryTemplateId,
            "lib:template:component-select__item-1" as LibraryTemplateId,
          ],
        },
      });
      const extra = "project:node:extra" as NodeId;
      expect(
        code(() =>
          workspace.execute(
            insertNodes({
              parent: atRoot(a),
              entries: [node(extra, "lib:definition:origin-component-button")],
              rootIds: [extra],
              newId: workspace.newId,
            }),
          ),
        ),
      ).toBe("ok");
      expect(
        code(() =>
          workspace.execute(
            moveNodes({ ids: [extra], parent: atRoot(b), newId: workspace.newId }),
          ),
        ),
      ).toBe("ok");
    });

    it("a part moved to another owner of the same type, or every twin deleted at once, is refused", async () => {
      const { workspace } = await open();
      const id = (name: string) => `project:node:${name}` as NodeId;
      const tabs = (name: string, lists: string[]) => [
        node(id(name), "lib:definition:type-Tabs", lists.map(id)),
        ...lists.map((list) => node(id(list), "lib:definition:type-TabList")),
      ];
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [...tabs("a", ["a-list"]), ...tabs("b", ["b-1", "b-2"])],
          rootIds: [id("a"), id("b")],
          newId: workspace.newId,
        }),
      );
      expect(
        code(() =>
          workspace.execute(
            moveNodes({
              ids: [id("a-list")],
              parent: { kind: "node", id: id("b") },
              newId: workspace.newId,
            }),
          ),
        ),
      ).toBe("REQUIRED_PART_NOT_REMOVABLE");
      expect(
        code(() =>
          workspace.execute(
            removeTargets({
              targets: [
                { kind: "node", id: id("b-1") },
                { kind: "node", id: id("b-2") },
              ],
            }),
          ),
        ),
      ).toBe("REQUIRED_PART_NOT_REMOVABLE");
      // One twin at a time stays allowed (the other keeps the owner working).
      expect(
        code(() =>
          workspace.execute(
            removeTargets({ targets: [{ kind: "node", id: id("b-1") }] }),
          ),
        ),
      ).toBe("ok");
    });

    it("ungrouping a Disclosure's header is refused; ungrouping a frame around it is not", async () => {
      const { workspace } = await open();
      const id = (name: string) => `project:node:${name}` as NodeId;
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [
            node(id("disclosure"), "lib:definition:type-Disclosure", [
              id("wrap"),
            ]),
            node(id("wrap"), "lib:definition:type-frame", [id("header")]),
            node(id("header"), "lib:definition:type-DisclosureHeader", [
              id("title"),
            ]),
            node(id("title"), "lib:definition:text"),
          ],
          rootIds: [id("disclosure")],
          newId: workspace.newId,
        }),
      );
      const ungroup = (name: string) =>
        code(() =>
          workspace.execute(
            ungroupNodes({ ids: [id(name)], newId: workspace.newId }),
          ),
        );
      expect(ungroup("header")).toBe("REQUIRED_PART_NOT_REMOVABLE");
      expect(ungroup("wrap")).toBe("ok");
    });
  });
});
