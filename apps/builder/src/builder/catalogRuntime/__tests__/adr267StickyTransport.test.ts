import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { resolveToken } from "@composition/rendering";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-267 1-a — `position: sticky` reaches the engine end to end: the real code catalog library
 * (built and validated — `buildCodeCatalogLibrary`), the resolver, `styleOf`. A standalone ListBox's
 * section header carries the ListBox rule's nested block (`top: calc(-1 * hairline)`), the Header
 * rule's own root box is sticky without insets.
 */
const BODY = "project:node:home-body" as NodeId;
const LIST = "project:node:list" as NodeId;

async function openWith(definitionId: string, popover = false) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr267" as EntryId<"project">,
        name: "Sticky",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr267-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const entry = (id: NodeId, definition: string): NodeEntry =>
    ({
      kind: "node",
      id,
      definitionId: definition,
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    }) as NodeEntry;
  let parent: NodeId = BODY;
  if (popover) {
    const pop = "project:node:pop" as NodeId;
    workspace.root.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [entry(pop, "lib:definition:type-Popover")],
        rootIds: [pop],
        newId: workspace.newId,
      }),
    );
    parent = pop;
  }
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: parent },
      entries: [entry(LIST, definitionId)],
      rootIds: [LIST],
      newId: workspace.newId,
    }),
  );
  const section = workspace.newId("node");
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: LIST },
      entries: [
        entry(section, "lib:definition:origin-component-listbox-section"),
      ],
      rootIds: [section],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const header = () =>
    [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === "Header",
    )!;
  return { root, header, workspace, entry };
}

const hairline = Number(resolveToken("{border.width.hairline}" as never));

describe("ADR-267 1-a — sticky transport", () => {
  it("a standalone ListBox's section header: position sticky + the rule's numeric top", async () => {
    const { root, header } = await openWith("lib:definition:type-ListBox");
    const input = root.getLayoutInput(header().id)!;
    expect(input.position).toBe("sticky");
    expect(input.insetTop).toBe(`${-hairline}px`);
    expect(hairline).toBeGreaterThan(0);
    // Its paint order over the items it is stuck on (the block's `z-index: 2`).
    expect(header().derivedProps?._stickyZIndex).toBe(2);
  });

  it("the nested block's top is the value the engine receives (changing it changes the input)", async () => {
    const block = (
      COMPONENT_RULES_TABLE as unknown as Record<
        string,
        {
          structure: {
            composition: {
              rootSelectors: Record<
                string,
                { nested: Record<string, Record<string, string>> }
              >;
            };
          };
        }
      >
    ).ListBox.structure.composition.rootSelectors[
      "&:not(.react-aria-Popover *)"
    ].nested[".react-aria-ListBoxSection .react-aria-Header"];
    const before = block.top;
    block.top = "7px";
    try {
      const { root, header } = await openWith("lib:definition:type-ListBox");
      expect(root.getLayoutInput(header().id)!.insetTop).toBe("7px");
      block.top = "calc(10% + 1px)";
      await expect(openWith("lib:definition:type-ListBox")).rejects.toThrow(
        /CATALOG_STICKY_INSET_UNRESOLVED/,
      );
    } finally {
      block.top = before;
    }
  });

  it("the Header rule's own root box is sticky without insets; a picker's list (Popover) takes no section insets", async () => {
    const { root, header } = await openWith("lib:definition:type-ListBox", true);
    const input = root.getLayoutInput(header().id)!;
    expect(input.position).toBe("sticky");
    expect(input.insetTop).toBeUndefined();
    expect(root.getStickyConstraints().has(header().id)).toBe(false);
  });

  it("the engine gives the section header's constraints with the ListBox as its scroll container", async () => {
    const { root, header } = await openWith("lib:definition:type-ListBox");
    const constraints = root.getStickyConstraints().get(header().id);
    expect(constraints?.top).toBeCloseTo(-hairline);
    const owner = constraints?.owner;
    expect(owner && root.typeOf(root.canvasInputs.get(owner)!)).toBe(
      "ListBox",
    );
  });

  it("the Canvas node data carries the constraints and the header's paint order over its items", async () => {
    const { root, header } = await openWith("lib:definition:type-ListBox");
    const scene = new CatalogCanvasScene(root);
    try {
      scene.sync();
      const data = getSkiaNode(header().id)!;
      expect(data.sticky?.top).toBeCloseTo(-hairline);
      expect(data.zIndex).toBe(2);
      const item = [...root.canvasInputs.values()].find(
        (record) => root.typeOf(record) === "ListBoxItem",
      )!;
      expect(getSkiaNode(item.id)?.sticky).toBeUndefined();
    } finally {
      scene.dispose();
    }
  });

  it("an edit that only moves a stuck header's limit (its section grew) redraws it — the patched stream matches a fresh bind", async () => {
    const { root, workspace, entry } = await openWith(
      "lib:definition:type-ListBox",
    );
    const set = <T,>(value: T) => ({ kind: "set" as const, value });
    workspace.root.execute(
      setFields({
        targets: [{ kind: "node", id: LIST }],
        sizing: { height: set(60) },
      }),
    );
    const second = workspace.newId("node");
    workspace.root.execute(
      insertNodes({
        parent: { kind: "node", id: LIST },
        entries: [
          entry(second, "lib:definition:origin-component-listbox-section"),
        ],
        rootIds: [second],
        newId: workspace.newId,
      }),
    );
    const listId = [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === "ListBox",
    )!.id;
    const firstHeader = [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === "Header",
    )!.id;
    const firstItem = [...root.canvasInputs.values()].find(
      (record) =>
        root.typeOf(record) === "ListBoxItem" &&
        root.canvasInputs.get(record.parentId)?.children[0] !== undefined &&
        root.typeOf(root.canvasInputs.get(record.parentId)!) ===
          "ListBoxSection",
    )!;
    const scene = new CatalogCanvasScene(root);
    try {
      scene.sync();
      // Scrolled until the first header is pushed up by its section's end.
      expect(scene.scrollBy(listId, 0, 70)).toBe(true);
      scene.sync();
      const pushed = scene.stream.boundsMap.get(firstHeader)!.y;
      expect(pushed).toBeLessThan(4);
      // The section grows (its item's height): the header's limit moves, its own rect does not.
      workspace.root.execute(
        setFields({
          targets: [workspace.positionOfRecord(firstItem.id)!.target],
          sizing: { height: set(80) },
        }),
      );
      scene.sync();
      const patched = scene.stream.boundsMap.get(firstHeader)!;
      const patchedHit = scene.stream.hitBoundsMap.get(firstHeader);
      expect(patched.y).not.toBe(pushed);
      scene.rebuild();
      expect(patched).toEqual(scene.stream.boundsMap.get(firstHeader));
      expect(patchedHit).toEqual(scene.stream.hitBoundsMap.get(firstHeader));
    } finally {
      scene.dispose();
    }
  });
});
