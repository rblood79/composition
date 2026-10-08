// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { Button } from "react-aria-components/Button";
import { Menu, MenuItem, MenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogItemInsertChoices } from "../itemInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 후속 4 — a Menu is the reference's (react-aria.adobe.com Menu): `MenuTrigger > Button +
 * Popover > Menu > MenuItem`. The palette Menu's origin is that tree (the trigger is a Button
 * node, its look the Button's); a Menu node is RAC's `Menu` — the open list — wherever it stands:
 * in its trigger's closed Popover, or open in an Autocomplete (`Autocomplete > SearchField +
 * Menu`, G0 example 4) where typing filters its items.
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

const node = (
  id: string,
  definitionId: string,
  props: Record<string, unknown> = {},
  children: string[] = [],
): NodeEntry =>
  ({
    kind: "node",
    id,
    definitionId,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, set(value)]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(entries: NodeEntry[]) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-menu-trigger" as EntryId<"project">,
        name: "Menu trigger",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-menu-trigger-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const record = (sourceId: string) =>
    [...root.domInputs.values()].find((r) => r.sourceId === sourceId)!;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const mount = () => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    const view = render(renderCatalogDom(root, record(ROOT).id));
    cleanups.push(() => view.unmount());
    return view;
  };
  return { workspace, root, record, of, mount };
}

const placed = (props: Record<string, unknown> = {}) =>
  open([node(ROOT, "lib:definition:origin-component-menu", props)]);

/** Tag · role · aria-haspopup of a tree (the trigger's and the menu's own parts). */
function structure(element: Element): string {
  const walk = (at: Element): string => {
    const attributes = [...at.attributes]
      .filter((attribute) => /^(role|aria-haspopup)$/.test(attribute.name))
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .sort();
    const content = [...at.childNodes].map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${at.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return walk(element);
}

describe("ADR-256 후속 4 — the palette Menu is MenuTrigger > Button + Popover > Menu", () => {
  it("its origin is the reference tree; the Canvas shows the trigger Button, the menu rests in the closed Popover", async () => {
    const { root, of } = await placed();
    const trigger = of("MenuTrigger")[0]!;
    expect(trigger).toBeDefined();
    expect(
      trigger.children.map((id) => root.typeOf(root.canvasInputs.get(id)!)),
    ).toEqual(["Button", "Popover"]);
    const popover = of("Popover")[0]!;
    const menu = of("Menu")[0]!;
    expect(menu.parentId).toBe(popover.id);
    expect(of("MenuItem")).toHaveLength(3);
    expect(trigger.hidden ?? false).toBe(false);
    expect(of("Button")[0]!.hidden ?? false).toBe(false);
    expect(popover.hidden).toBe(true);
  });

  it("Preview: the Button opens the Popover's Menu (RAC MenuTrigger) — the reference structure", async () => {
    const { mount } = await placed();
    const view = mount();
    const button = view.getByRole("button");
    expect(button.getAttribute("aria-haspopup")).toBe("true");
    expect(view.queryByRole("menu")).toBeNull();
    fireEvent.click(button);
    await waitFor(() => expect(view.queryByRole("menu")).not.toBeNull());
    const menu = view.getByRole("menu");
    expect(
      menu.closest(".react-aria-Popover")?.getAttribute("data-trigger"),
    ).toBe("MenuTrigger");
    expect(menu.getAttribute("aria-labelledby")).toBe(button.id);
    expect(
      view.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Menu Item 1", "Menu Item 2", "Menu Item 3"]);
    const reference = render(
      createElement(
        MenuTrigger,
        null,
        createElement(Button, null, "Menu"),
        createElement(
          Popover,
          null,
          createElement(
            Menu,
            null,
            ...[1, 2, 3].map((n) =>
              createElement(
                MenuItem,
                { key: n, id: String(n) },
                `Menu Item ${n}`,
              ),
            ),
          ),
        ),
      ),
    );
    cleanups.push(() => reference.unmount());
    const referenceButton = reference.getAllByRole("button").at(-1)!;
    expect(structure(button)).toBe(structure(referenceButton));
  });

  it("the origin's Selection Mode reaches the Menu (Multiple: menuitemcheckbox)", async () => {
    const { mount } = await placed({ selectionMode: "multiple" });
    const view = mount();
    fireEvent.click(view.getByRole("button"));
    await waitFor(() => expect(view.queryByRole("menu")).not.toBeNull());
    expect(view.getAllByRole("menuitemcheckbox")).toHaveLength(3);
  });

  it('the Design "+" on the placed Menu adds a MenuItem to the Popover\'s Menu', async () => {
    const { workspace, of } = await placed();
    const position = workspace.positionOfRecord(of("MenuTrigger")[0]!.id)!;
    const choices = catalogItemInsertChoices(
      {
        graph: workspace.runtime.graph,
        readModel: workspace.readModel,
        newId: workspace.newId,
      },
      position,
    );
    const item = choices.find((choice) => choice.type === "MenuItem");
    expect(item).toBeDefined();
    workspace.execute(item!.build());
    expect(of("MenuItem")).toHaveLength(4);
    expect(of("MenuItem").every((r) => r.parentId === of("Menu")[0]!.id)).toBe(
      true,
    );
  });
});

describe("ADR-256 후속 4 — a Menu in an Autocomplete is the open list (G0 example 4)", () => {
  const LABELS = ["Inbox", "Starred", "Archive"];
  const entries = () => [
    node(ROOT, "lib:definition:type-Autocomplete", {}, [
      "project:node:search",
      "project:node:menu",
    ]),
    node("project:node:search", "lib:definition:origin-component-searchfield"),
    node(
      "project:node:menu",
      "lib:definition:type-Menu",
      {},
      LABELS.map((label) => `project:node:${label}`),
    ),
    ...LABELS.flatMap((label) => [
      node(`project:node:${label}`, "lib:definition:type-MenuItem", {}, [
        `project:node:${label}-text`,
      ]),
      node(`project:node:${label}-text`, "lib:definition:text", {
        slot: "label",
        children: label,
      }),
    ]),
  ];

  it("Preview: RAC Menu in place (no trigger), filtered by the text field", async () => {
    const { mount } = await open(entries());
    const view = mount();
    expect(
      view
        .queryAllByRole("button")
        .filter((b) => b.getAttribute("aria-haspopup")),
    ).toEqual([]);
    const items = () =>
      view.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items()).toEqual(LABELS);
    const input = view.container.querySelector("input")!;
    await act(async () => {
      fireEvent.change(input, { target: { value: "AR" } });
    });
    expect(items()).toEqual(["Starred", "Archive"]);
  });

  it("Canvas: the Menu and its items show (an open list, not a trigger)", async () => {
    const { of } = await open(entries());
    expect(of("Menu")[0]!.hidden ?? false).toBe(false);
    expect(of("MenuItem").map((r) => r.hidden ?? false)).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe("ADR-256 후속 4 — an edit of the trigger reaches the Preview", () => {
  it("the Button's label is the Button node's own", async () => {
    const { workspace, of, mount } = await placed();
    const button = of("Button")[0]!;
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(button.id)!.target],
        props: { children: set("Actions") },
      }),
    );
    const view = mount();
    expect(view.getByRole("button").textContent).toBe("Actions");
  });
});

describe("ADR-256 후속 6 — a Menu's \"+\" (submenu · item fields · no item in an item)", () => {
  const choicesAt = (
    workspace: CatalogWorkspace,
    recordId: string,
  ) =>
    catalogItemInsertChoices(
      {
        graph: workspace.runtime.graph,
        readModel: workspace.readModel,
        newId: workspace.newId,
      },
      workspace.positionOfRecord(recordId)!,
    );

  it("adds a SubmenuTrigger (MenuItem + Popover > Menu > MenuItem) that opens its submenu in the Preview", async () => {
    const { workspace, of, mount } = await placed();
    const submenu = choicesAt(workspace, of("MenuTrigger")[0]!.id).find(
      (choice) => choice.type === "SubmenuTrigger",
    );
    expect(submenu).toBeDefined();
    workspace.execute(submenu!.build());
    const { root } = workspace;
    const trigger = of("SubmenuTrigger")[0]!;
    expect(
      trigger.children.map((id) => root.typeOf(root.canvasInputs.get(id)!)),
    ).toEqual(["MenuItem", "Popover"]);
    const view = mount();
    fireEvent.click(view.getByRole("button"));
    await waitFor(() => expect(view.queryByRole("menu")).not.toBeNull());
    const opener = view
      .getAllByRole("menuitem")
      .find((item) => item.textContent?.includes("Submenu"))!;
    expect(opener.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.click(opener);
    let opened = "";
    await waitFor(() => {
      const found = document.querySelector(
        `[role=menu][aria-labelledby="${opener.id}"]`,
      );
      expect(found).not.toBeNull();
      opened = found!.textContent ?? "";
    });
    expect(opened).toBe("Item 1");
  });

  it("a MenuItem the \"+\" adds shows its label only — no `{shortcut}` · `{description}` placeholder", async () => {
    const { workspace, of, mount } = await placed();
    const add = choicesAt(workspace, of("MenuTrigger")[0]!.id).find(
      (choice) => choice.type === "MenuItem",
    )!;
    workspace.execute(add.build());
    const view = mount();
    fireEvent.click(view.getByRole("button"));
    await waitFor(() => expect(view.queryByRole("menu")).not.toBeNull());
    const added = view.getAllByRole("menuitem").at(-1)!;
    expect(added.textContent).toBe("Item 4");
    expect(added.querySelector("kbd")).toBeNull();
  });

  it("a MenuItem offers no MenuItem inside it (a submenu is a SubmenuTrigger)", async () => {
    const { workspace, of } = await placed();
    const types = choicesAt(workspace, of("MenuItem")[0]!.id).map(
      (choice) => choice.type,
    );
    expect(types).not.toContain("MenuItem");
  });
});
