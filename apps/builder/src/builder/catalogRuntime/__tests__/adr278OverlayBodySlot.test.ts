import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogDocument,
  DefinitionId,
  EntryId,
  LibraryDefinitionId,
  LibraryTemplateId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { LIBRARY_CONTRACT_VERSION } from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogValidationError } from "../../../../../../packages/shared/src/catalog/document/validation";
import {
  createComponent,
  insertNodes,
  swapInstance,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { EditTarget } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogLayerTreeStore } from "../layerTree";
import type { CatalogLayerNode } from "../layerTree";
import { newCatalogProjectDocument } from "../project";
import { catalogSlotCommands, catalogSlotInsertOptions } from "../slots";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-278 — an overlay origin's body is a slot (library contract 45): Dialog `content` ·
 * `actions`, Popover · Tooltip `content` (a region frame after the OverlayArrow), ContextualHelp
 * `content` · `footer`, Menu `Items`. Placed, the trigger instance owns the slot's default
 * content (2026-10-14); a fill is its own node — drawn (hidden) at the body position, opened by
 * the Preview's RAC overlay, listed by the Layers, moved by Swap to the slot of the same name.
 * A collection slot's fill list (a Menu's `Items`) offers the project's components whose root
 * fits (a MenuItem one), not the Library's item types only (review h2).
 */
const BODY = "project:node:home-body" as NodeId;
const DIALOG = "project:node:dialog" as NodeId;
const POPOVER = "project:node:popover" as NodeId;
const TOOLTIP = "project:node:tooltip" as NodeId;
const HELP = "project:node:help" as NodeId;
const MENU = "project:node:menu" as NodeId;
const FRAME = "project:node:frame" as NodeId;
const LISTBOX = "project:node:listbox" as NodeId;
const PROJECT = "project:project:adr278" as EntryId<"project">;
const T = (id: string) => `lib:template:${id}` as LibraryTemplateId;
const lib = (name: string) =>
  `lib:definition:origin-component-${name}` as LibraryDefinitionId;
const set = <V>(value: V) => ({ kind: "set" as const, value });

async function open() {
  const library = await buildCodeCatalogLibrary();
  const storage = new CatalogStorage(indexedDB, `adr278-${Math.random()}`);
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "ADR-278" }),
      library,
    ),
    storage,
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  // (The storage holds the project from its first revision — a round trip saves the steps.)
  await storage.create(workspace.runtime.graph.exportDocument(), library);
  const placeWith = (
    id: NodeId,
    definitionId: DefinitionId,
    descendantOverrides: NodeEntry["descendantOverrides"],
  ) =>
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id,
            definitionId,
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides,
          },
        ],
        rootIds: [id],
        newId: workspace.newId,
      }),
    );
  const place = (id: NodeId, definitionId: DefinitionId) =>
    placeWith(id, definitionId, []);
  place(DIALOG, lib("dialog"));
  place(POPOVER, lib("popover"));
  place(TOOLTIP, lib("tooltip"));
  place(HELP, lib("contextualhelp"));
  place(MENU, lib("menu"));
  place(LISTBOX, lib("listbox"));
  // A project component with a frame root — what a user draws as a dialog body.
  place(FRAME, "lib:definition:type-frame" as DefinitionId);
  workspace.execute(
    createComponent({
      id: FRAME,
      name: "Confirm body",
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  const nodeOf = (id: string) => graph.getEntry(id) as NodeEntry;
  const descendant = (
    ownerId: NodeId,
    path: string[],
  ): Extract<EditTarget, { kind: "descendant" }> => ({
    kind: "descendant",
    ownerId,
    address: { instances: [ownerId], templatePath: path.map(T) } as never,
  });
  const dialogContent = descendant(DIALOG, [
    "component-dialog",
    "component-dialog__modal",
    "component-dialog__2",
    "component-dialog__content-region",
  ]);
  const popoverContent = descendant(POPOVER, [
    "component-popover",
    "component-popover__overlay",
    "component-popover__content-region",
  ]);
  const menuItems = descendant(MENU, [
    "component-menu",
    "component-menu__popover",
    "component-menu__menu",
  ]);
  const tooltipContent = descendant(TOOLTIP, [
    "component-tooltip",
    "component-tooltip__overlay",
    "component-tooltip__content-region",
  ]);
  const labels = (target: EditTarget) =>
    catalogSlotInsertOptions(graph, target).map((option) => option.label);
  /** The instance's own content at a slot position (owned when placed). */
  const fillAt = (id: NodeId, last: string) =>
    nodeOf(id).descendantOverrides.find(
      (override) =>
        override.kind === "fillSlot" &&
        override.address.templatePath.at(-1) === T(last),
    ) as { childIds: readonly NodeId[] } | undefined;
  const fillText = (
    target: Extract<EditTarget, { kind: "descendant" }>,
    text: string,
  ) => {
    workspace.execute(
      catalogSlotCommands.fill(
        target,
        "lib:definition:text" as DefinitionId,
        workspace.newId,
        { children: set(text) },
      ),
    );
    return fillAt(
      target.ownerId,
      target.address.templatePath.at(-1)!.replace("lib:template:", ""),
    )!.childIds.at(-1)!;
  };
  return {
    workspace,
    placeWith,
    storage,
    library,
    graph,
    nodeOf,
    dialogContent,
    popoverContent,
    tooltipContent,
    menuItems,
    labels,
    fillAt,
    fillText,
    root: workspace.root,
  };
}

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});
async function mount(workspace: CatalogWorkspace, id: string) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(renderCatalogDom(workspace.root, id)));
  unmount = async () => act(async () => root.unmount());
  return host;
}
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
async function press(button: HTMLElement) {
  await act(async () => {
    for (const type of ["pointerdown", "pointerup"])
      button.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
        }),
      );
    button.click();
  });
  await settle();
}

/** Every Layers row, expanded all the way down. */
function allRows(store: CatalogLayerTreeStore): CatalogLayerNode[] {
  for (let depth = 0; depth < 12; depth += 1) {
    const rows = flatten(store.getSnapshot());
    const expandable = rows
      .filter((row) => row.hasChildren)
      .map((row) => row.id);
    const before = flatten(store.getSnapshot()).length;
    store.setExpanded(new Set(expandable));
    if (flatten(store.getSnapshot()).length === before) break;
  }
  return flatten(store.getSnapshot());
}
function flatten(rows: readonly CatalogLayerNode[]): CatalogLayerNode[] {
  return rows.flatMap((row) => [row, ...flatten(row.children ?? [])]);
}

describe("ADR-278 — overlay body = slot", () => {
  it("declares the body slots on the five overlay origins (contract 45 → 46 by ADR-279), the Popover's and Tooltip's in a region frame after the arrow", async () => {
    const { library } = await open();
    expect(LIBRARY_CONTRACT_VERSION).toBe(46);
    const slotOf = (id: string) => library.templates.get(T(id))?.slot;
    const slot = (name: string) => ({ name, required: false });
    expect(slotOf("component-dialog__content-region")).toEqual(slot("content"));
    expect(slotOf("component-dialog__actions-region")).toEqual(slot("actions"));
    expect(slotOf("component-popover__content-region")).toEqual(
      slot("content"),
    );
    expect(slotOf("component-tooltip__content-region")).toEqual(
      slot("content"),
    );
    expect(slotOf("component-contextualhelp__content")).toEqual(
      slot("content"),
    );
    expect(slotOf("component-contextualhelp__footer")).toEqual(slot("footer"));
    expect(slotOf("component-menu__menu")).toEqual(slot("Items"));
    const children = (id: string) =>
      library.templates
        .get(T(id))!
        .children.map((child) => child.replace("lib:template:", ""));
    expect(children("component-popover__overlay")).toEqual([
      "component-popover__arrow",
      "component-popover__content-region",
    ]);
    expect(children("component-popover__content-region")).toEqual([
      "component-popover__1",
      "component-popover__2",
    ]);
    expect(children("component-tooltip__overlay")).toEqual([
      "component-tooltip__arrow",
      "component-tooltip__content-region",
    ]);
    expect(children("component-tooltip__content-region")).toEqual([
      "component-tooltip__1",
    ]);
    // The region is a neutral frame: no rule of its own, a column keeping the overlay's gap.
    for (const id of [
      "component-popover__content-region",
      "component-tooltip__content-region",
    ]) {
      const region = library.templates.get(T(id))!;
      expect(region.definitionId).toBe("lib:definition:type-frame");
      expect(region.layout?.display).toBe("flex");
    }
  });

  it("refuses a contract 44 document (no conversion) — the policy of ADR-276 · 277", async () => {
    const { library } = await open();
    let code: string | undefined;
    try {
      new CatalogGraph(
        {
          ...newCatalogProjectDocument({ projectId: PROJECT, name: "old" }),
          libraryContractVersion: 44,
        } as unknown as CatalogDocument,
        library,
      );
    } catch (error) {
      code = (error as CatalogValidationError).code;
    }
    expect(code).toBe("UNSUPPORTED_LIBRARY_CONTRACT");
  });

  it("placed, the trigger instance owns each body's default content; without a fill the Preview shows the template's words", async () => {
    const { workspace, fillAt, nodeOf, root } = await open();
    const words = (ids: readonly NodeId[]) =>
      ids.map(
        (id) =>
          (nodeOf(id).props.children as { value?: unknown } | undefined)?.value,
      );
    expect(
      words(fillAt(DIALOG, "component-dialog__content-region")!.childIds),
    ).toEqual(["Dialog content goes here."]);
    // (An empty slot — the Dialog's `actions` — takes no override until filled.)
    expect(fillAt(DIALOG, "component-dialog__actions-region")).toBeUndefined();
    expect(
      words(fillAt(POPOVER, "component-popover__content-region")!.childIds),
    ).toEqual(["Popover Title", "Popover content goes here."]);
    expect(
      words(fillAt(TOOLTIP, "component-tooltip__content-region")!.childIds),
    ).toEqual(["Tooltip text"]);
    expect(
      fillAt(HELP, "component-contextualhelp__content")!.childIds.length,
    ).toBe(1);
    expect(
      fillAt(HELP, "component-contextualhelp__footer")!.childIds.length,
    ).toBe(1);
    expect(fillAt(MENU, "component-menu__menu")!.childIds.length).toBe(3);
    const host = await mount(workspace, root.recordsOfSource(POPOVER)[0]!);
    await press(host.querySelector("button")!);
    const popover = document.querySelector(".react-aria-Popover")!;
    expect(popover.querySelector(".react-aria-Heading")?.textContent).toBe(
      "Popover Title",
    );
    expect(popover.textContent).toContain("Popover content goes here.");
  });

  it("Dialog `content`: the fill is the instance's own node, drawn (hidden) at the body position, opened by the Preview's Modal, listed by the Layers, kept by storage", async () => {
    const {
      workspace,
      storage,
      library,
      graph,
      nodeOf,
      dialogContent,
      fillAt,
      fillText,
      root,
    } = await open();
    const fillId = fillText(dialogContent, "Confirm body text");
    const fill = fillAt(DIALOG, "component-dialog__content-region")!;
    // The template's description (owned when placed) stays first; the fill goes after it.
    expect(fill.childIds.length).toBe(2);
    expect(fill.childIds[1]).toBe(fillId);
    expect(nodeOf(fillId).props.children).toEqual(set("Confirm body text"));

    // Canvas record: the Text stands last under the content region, inside the hidden Modal.
    const [textRecord] = root.recordsOfSource(fillId);
    const record = root.canvasInputs.get(textRecord!)!;
    const region = root.canvasInputs.get(record.parentId)!;
    expect(root.typeOf(region)).toBe("frame");
    expect(region.children.at(-1)).toBe(record.id);
    let above = region;
    while (above && !above.hidden)
      above = root.canvasInputs.get(above.parentId)!;
    expect(above && root.typeOf(above)).toBe("Modal");

    // Preview: Open Dialog → the Modal's Dialog holds the fill.
    const host = await mount(workspace, root.recordsOfSource(DIALOG)[0]!);
    await press(host.querySelector("button")!);
    const modal = document.querySelector(".react-aria-Modal");
    expect(modal).not.toBeNull();
    expect(modal!.textContent).toContain("Confirm body text");

    // Layers: the fill is a row under the Dialog instance (Modal > Dialog > content > Text).
    const project = graph.getEntry(graph.projectId) as unknown as {
      pageIds: string[];
    };
    const store = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph,
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
      },
      project.pageIds[0] as never,
    );
    const rows = allRows(store);
    const textRow = rows.find(
      (row) =>
        row.position.target.kind === "node" &&
        row.position.target.id === fillId,
    );
    expect(
      textRow,
      rows.map((row) => `${row.depth}:${row.name}`).join(" / "),
    ).toBeDefined();
    const chain: string[] = [];
    for (let row = textRow; row; row = rows.find((r) => r.id === row!.parentId))
      chain.unshift(row.slot ? `${row.typeName}[${row.slot}]` : row.typeName);
    expect(chain.slice(-4)).toEqual([
      "Modal",
      "Dialog",
      "frame[content]",
      "Text",
    ]);
    store.dispose();

    // Storage: saved and loaded again, the fill is still the instance's.
    await workspace.runtime.save();
    const loaded = await storage.load(PROJECT, library);
    const dialog = loaded.entries[DIALOG] as NodeEntry;
    const kept = dialog.descendantOverrides.find(
      (override) =>
        override.kind === "fillSlot" &&
        override.address.templatePath.at(-1) ===
          T("component-dialog__content-region"),
    ) as { childIds: readonly NodeId[] };
    expect(kept.childIds).toEqual(fill.childIds);
    expect((loaded.entries[fillId] as NodeEntry).props.children).toEqual(
      set("Confirm body text"),
    );
  });

  it("Popover `content`: the fill shows in the Preview's opened Popover, inside the region after the arrow", async () => {
    const { workspace, popoverContent, fillText, root } = await open();
    fillText(popoverContent, "Popover body text");
    const host = await mount(workspace, root.recordsOfSource(POPOVER)[0]!);
    await press(host.querySelector("button")!);
    const popover = document.querySelector(".react-aria-Popover")!;
    expect(popover.textContent).toContain("Popover body text");
    const region = popover.querySelector(".react-aria-OverlayArrow + div");
    expect(region?.textContent).toContain("Popover body text");
  });

  it("Tooltip `content`: the fill shows in the Preview's opened Tooltip, inside the region after the arrow", async () => {
    const { workspace, tooltipContent, fillText, root } = await open();
    fillText(tooltipContent, "Tooltip body text");
    const host = await mount(workspace, root.recordsOfSource(TOOLTIP)[0]!);
    // A keyboard focus opens the tooltip at once (the hover path waits its warm-up delay).
    await act(async () => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
      );
      host.querySelector("button")!.focus();
    });
    await settle();
    const tooltip = document.querySelector(".react-aria-Tooltip")!;
    expect(tooltip.textContent).toContain("Tooltip body text");
    const region = tooltip.querySelector(".react-aria-OverlayArrow + div");
    expect(region?.textContent).toContain("Tooltip body text");
  });

  it("Swap Dialog → Popover: the `content` fill moves to the slot of the same name", async () => {
    const { workspace, nodeOf, dialogContent, fillAt, fillText } = await open();
    const fillId = fillText(dialogContent, "Confirm body text");
    workspace.execute(
      swapInstance({ id: DIALOG, definitionId: lib("popover") }),
    );
    expect(nodeOf(DIALOG).definitionId).toBe(lib("popover"));
    const moved = fillAt(DIALOG, "component-popover__content-region");
    expect(moved?.childIds).toContain(fillId);
  });

  it("a path patch's `displayState: open` shows a closed overlay (the Components page's body cell); the page instance stays closed without it", async () => {
    const { workspace, root, placeWith } = await open();
    const modalOf = (owner: NodeId) => {
      const under = (id: string): string[] => [
        id,
        ...root.canvasInputs.get(id)!.children.flatMap(under),
      ];
      const id = under(root.recordsOfSource(owner)[0]!).find(
        (record) => root.typeOf(root.canvasInputs.get(record)!) === "Modal",
      )!;
      return root.canvasInputs.get(id)!;
    };
    expect(modalOf(DIALOG).hidden).toBe(true);
    const OPEN = "project:node:dialog-open" as NodeId;
    placeWith(OPEN, lib("dialog"), [
      {
        kind: "patch",
        address: {
          instances: [OPEN],
          templatePath: [T("component-dialog"), T("component-dialog__modal")],
        },
        displayState: "open",
      },
    ]);
    const modal = modalOf(OPEN);
    expect(modal.hidden ?? false).toBe(false);
    expect(root.getGeometry([modal.id]).get(modal.id)!.width).toBeGreaterThan(0);
    expect(modalOf(DIALOG).hidden).toBe(true);
    const html = renderToStaticMarkup(renderCatalogDom(workspace.root, root.recordsOfSource(OPEN)[0]!));
    // (The DOM keeps RAC's closed overlay — `open` is a Canvas display state, no RAC prop.)
    expect(html).not.toContain("react-aria-Modal");
  });

  it("validation: a patch's displayState is one of the display state names", async () => {
    const { placeWith } = await open();
    const BAD = "project:node:dialog-bad" as NodeId;
    let code: string | undefined;
    try {
      placeWith(BAD, lib("dialog"), [
        {
          kind: "patch",
          address: {
            instances: [BAD],
            templatePath: [T("component-dialog"), T("component-dialog__modal")],
          },
          displayState: "ajar" as never,
        },
      ]);
    } catch (error) {
      code = (error as CatalogValidationError).code;
    }
    expect(code).toBe("DISPLAY_STATE_UNKNOWN");
  });

  it("Dialog `content` fill list: the Library's parts and the project's components (a frame-rooted one)", async () => {
    const { dialogContent, labels } = await open();
    const options = labels(dialogContent);
    expect(options).toContain("Text");
    expect(options).toContain("Confirm body");
  });

  it("Menu `Items` fill list: a MenuItem-rooted project component, not a frame-rooted one (review h2)", async () => {
    const { workspace, fillAt, menuItems, labels } = await open();
    // The placed Menu owns its items: a user makes a component of one.
    const item = fillAt(MENU, "component-menu__menu")!.childIds[0]!;
    workspace.execute(
      createComponent({ id: item, name: "Menu row", newId: workspace.newId }),
    );
    const options = labels(menuItems);
    expect(options).toContain("MenuItem");
    expect(options).toContain("Menu row");
    expect(options).not.toContain("Confirm body");
  });

  it("ListBox `Items` (a root slot) fill list: a ListBoxItem-rooted project component, not a frame-rooted one", async () => {
    const { workspace, fillAt, labels } = await open();
    const item = fillAt(LISTBOX, "component-listbox")!.childIds[0]!;
    workspace.execute(
      createComponent({ id: item, name: "List row", newId: workspace.newId }),
    );
    const options = labels({ kind: "node", id: LISTBOX });
    expect(options).toContain("ListBoxItem");
    expect(options).toContain("List row");
    expect(options).not.toContain("Confirm body");
  });
});
