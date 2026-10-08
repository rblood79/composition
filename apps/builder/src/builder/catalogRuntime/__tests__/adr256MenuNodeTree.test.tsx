// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Keyboard,
  Menu,
  MenuItem,
  SubmenuTrigger,
  Text,
} from "react-aria-components/Menu";
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
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 5g (G2) — a MenuItem's parts are the reference's (react-aria.adobe.com Menu, G0
 * example 2): `MenuItem > (Text[label] + Text[description] + Keyboard)` — the shortcut is RAC
 * `Keyboard` in the item's `KeyboardContext` (the item's `aria-describedby`), not a Text with a
 * slot name no context gives. An author's mark shown while the item is selected (the reference's
 * Check) follows RAC's `isSelected` and stands in for the sheet's glyph.
 */
const BODY = "project:node:home-body" as NodeId;
const MENU = "project:node:menu" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

const node = (
  id: string,
  definitionId: string,
  props: Record<string, unknown> = {},
  children: string[] = [],
  extra: Partial<NodeEntry> = {},
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
    ...extra,
  }) as NodeEntry;

const ROWS = [
  ["copy", "Copy", "Copy the selected text", "⌘C"],
  ["cut", "Cut", "Cut the selected text", "⌘X"],
  ["paste", "Paste", "Paste the copied text", "⌘V"],
] as const;

const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(entries: NodeEntry[], rootId: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-menu" as EntryId<"project">,
        name: "Menu",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-menu-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.root.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries,
      rootIds: [rootId as NodeId],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  const root = workspace.root;
  const record = (sourceId: string) =>
    [...root.domInputs.values()].find((r) => r.sourceId === sourceId)!;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  return { workspace, root, record, of };
}

/** The author's menu (G0 example 2 assembly): MenuItem > Text[label] + Text[description] + Keyboard. */
function authoredMenu(selectionMode = "none"): NodeEntry[] {
  const entries: NodeEntry[] = [];
  const items: string[] = [];
  for (const [id, label, description, shortcut] of ROWS) {
    const item = `project:node:${id}`;
    items.push(item);
    entries.push(
      node(item, "lib:definition:type-MenuItem", {}, [
        `${item}-label`,
        `${item}-description`,
        `${item}-shortcut`,
      ]),
      node(`${item}-label`, "lib:definition:text", {
        slot: "label",
        children: label,
      }),
      node(`${item}-description`, "lib:definition:text", {
        slot: "description",
        children: description,
      }),
      node(`${item}-shortcut`, "lib:definition:type-Keyboard", {
        children: shortcut,
      }),
    );
  }
  return [
    node(
      MENU,
      "lib:definition:type-Menu",
      { label: "Edit", selectionMode },
      items,
    ),
    ...entries,
  ];
}

/** Decision 11 structure of a menu: tag · role · slot · aria links as positions · text. */
function menuStructure(menu: Element): string {
  const all = [...menu.querySelectorAll("*")];
  const position = (id: string) => {
    const index = all.findIndex((element) => element.id === id);
    return index < 0 ? "outside" : `#${index}`;
  };
  const LINKS = new Set(["aria-labelledby", "aria-describedby"]);
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter(
        (attribute) =>
          /^(role|slot)$/.test(attribute.name) || LINKS.has(attribute.name),
      )
      .map((attribute) =>
        LINKS.has(attribute.name)
          ? `${attribute.name}=${attribute.value.split(" ").map(position).join(",")}`
          : `${attribute.name}=${attribute.value}`,
      )
      .sort();
    const content = [...element.childNodes].map((child) =>
      child.nodeType === 1
        ? walk(child as Element)
        : (child.textContent ?? "").trim(),
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return [...menu.children].map(walk).join("");
}

function reference(): Element {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    createElement(
      Menu,
      { "aria-label": "Edit" },
      ...ROWS.map(([id, label, description, shortcut]) =>
        createElement(
          MenuItem,
          { key: id, id, textValue: label },
          createElement(Text, { slot: "label" }, label),
          createElement(Text, { slot: "description" }, description),
          createElement(Keyboard, null, shortcut),
        ),
      ),
    ),
  );
  return host.querySelector("[role=menu]")!;
}

async function openMenu(
  root: Parameters<typeof renderCatalogDom>[0],
  id: string,
) {
  const view = render(renderCatalogDom(root, id));
  cleanups.push(() => view.unmount());
  fireEvent.click(view.getByRole("button", { name: "Edit" }));
  await waitFor(() => expect(view.queryByRole("menu")).not.toBeNull());
  return view;
}

describe("ADR-256 Phase 5g — MenuItem parts are the reference's (example 2)", () => {
  it("Text[label] + Text[description] + Keyboard: the reference structure, the shortcut describes the item", async () => {
    const { root, record } = await open(authoredMenu(), MENU);
    const view = await openMenu(root, record(MENU).id);
    const menu = view.getByRole("menu");
    expect(menuStructure(menu)).toBe(menuStructure(reference()));
    // (RAC's `KeyboardContext`: the item is described by its description and its shortcut.)
    const first = view.getAllByRole("menuitem")[0]!;
    const described = first.getAttribute("aria-describedby")!.split(" ");
    expect(
      described.map((id) => document.getElementById(id)?.tagName.toLowerCase()),
    ).toContain("kbd");
    expect(menu.querySelector("kbd")!.className).toBe("react-aria-Keyboard");
  });

  it("the MenuItem origin's shortcut is a Keyboard: absent while its text is empty, a kbd once written", async () => {
    const ITEM = "project:node:item";
    const { workspace, root, record, of } = await open(
      [
        node(MENU, "lib:definition:type-Menu", { label: "Edit" }, [ITEM]),
        node(ITEM, "lib:definition:origin-component-menu-item-default"),
      ],
      MENU,
    );
    const keyboard = () => of("Keyboard")[0]!;
    expect(of("Keyboard")).toHaveLength(1);
    expect(keyboard().presentWhen).toBe("nonEmptyText");
    expect(of("Text").some((text) => text.props.slot === "shortcut")).toBe(
      false,
    );
    const write = (text: string) =>
      workspace.root.execute(
        setFields({
          targets: [workspace.positionOfRecord(keyboard().id)!.target],
          props: { children: set(text) },
        }),
      );
    write("");
    const empty = await openMenu(root, record(MENU).id);
    expect(empty.getByRole("menu").querySelector("kbd")).toBeNull();
    empty.unmount();
    write("⌘S");
    const written = await openMenu(root, record(MENU).id);
    const kbd = written.getByRole("menu").querySelector("kbd")!;
    expect(kbd.className).toBe("react-aria-Keyboard");
    expect(kbd.textContent).toBe("⌘S");
  });

  it("an author's mark shown while selected (the reference's Check): RAC's isSelected, in place of the glyph", async () => {
    const entries = authoredMenu("multiple");
    const first = entries.find((entry) => entry.id === "project:node:copy")!;
    const mark = node(
      "project:node:copy-check",
      "lib:definition:type-Icon",
      { iconName: "check" },
      [],
      { showWhen: { all: ["isSelected"] } } as Partial<NodeEntry>,
    );
    (first.children as string[]).unshift(mark.id);
    const { root, record, of } = await open([...entries, mark], MENU);
    // (The Canvas: the item rests unselected — no mark.)
    expect(of("Icon").find((icon) => icon.sourceId === mark.id)?.hidden).toBe(
      true,
    );
    const view = await openMenu(root, record(MENU).id);
    // (RAC: a multiple-selection menu's items are `menuitemcheckbox`.)
    const items = () => view.getAllByRole("menuitemcheckbox");
    expect(items()[0]!.hasAttribute("data-selection-mark")).toBe(true);
    expect(items()[1]!.hasAttribute("data-selection-mark")).toBe(false);
    const marked = () =>
      items()[0]!.querySelector(`[data-catalog-id="${record(mark.id).id}"]`);
    expect(marked()).toBeNull();
    fireEvent.click(items()[0]!);
    await waitFor(() =>
      expect(items()[0]!.getAttribute("aria-checked")).toBe("true"),
    );
    expect(marked()).not.toBeNull();
  });
});

/**
 * The reference's submenu (react-aria.adobe.com Menu, Submenus): `SubmenuTrigger > MenuItem + Popover
 * > Menu`, the item showing `ChevronRight` while it has a submenu.
 */
function submenuEntries(chevron: (item: string) => NodeEntry[]): NodeEntry[] {
  const item = (id: string, label: string, extra: NodeEntry[] = []) => [
    node(id, "lib:definition:type-MenuItem", {}, [
      `${id}-label`,
      ...extra.map((entry) => entry.id),
    ]),
    node(`${id}-label`, "lib:definition:text", {
      slot: "label",
      children: label,
    }),
    ...extra,
  ];
  const share = "project:node:share";
  return [
    node(MENU, "lib:definition:type-Menu", { label: "Edit" }, [
      "project:node:cut",
      "project:node:submenu",
    ]),
    ...item("project:node:cut", "Cut", chevron("project:node:cut")),
    node("project:node:submenu", "lib:definition:type-SubmenuTrigger", {}, [
      share,
      "project:node:submenu-popover",
    ]),
    ...item(share, "Share", chevron(share)),
    node(
      "project:node:submenu-popover",
      "lib:definition:type-Popover",
      { hideArrow: true, offset: -2, crossOffset: -4 },
      ["project:node:submenu-menu"],
    ),
    node("project:node:submenu-menu", "lib:definition:type-Menu", {}, [
      "project:node:sms",
      "project:node:instagram",
    ]),
    ...item("project:node:sms", "SMS"),
    ...item("project:node:instagram", "Instagram"),
  ];
}
const chevronNode = (item: string): NodeEntry[] => [
  node(
    `${item}-chevron`,
    "lib:definition:type-Icon",
    { iconName: "chevron-right", size: "xs" },
    [],
    { showWhen: { all: ["hasSubmenu"] } } as Partial<NodeEntry>,
  ),
];

/** A menu's own structure (not its submenus' popovers): tag · role · aria-haspopup · text. */
function itemStructure(menu: Element): string {
  const walk = (element: Element): string => {
    if (element.matches("div.react-aria-Icon"))
      return [...element.children].map(walk).join("");
    const attributes = [...element.attributes]
      .filter((attribute) => /^(role|slot|aria-haspopup)$/.test(attribute.name))
      .map((attribute) => `${attribute.name}=${attribute.value}`)
      .sort();
    const content =
      element.tagName === "svg"
        ? []
        : [...element.childNodes].map((child) =>
            child.nodeType === 1
              ? walk(child as Element)
              : (child.textContent ?? "").trim(),
          );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  return [...menu.children].map(walk).join("");
}

describe("ADR-256 Phase 5g — a submenu is the reference's SubmenuTrigger > MenuItem + Popover > Menu", () => {
  it("the item opens its Popover's Menu; only the trigger item shows the chevron (hasSubmenu)", async () => {
    const { root, record, of } = await open(submenuEntries(chevronNode), MENU);
    // (The Canvas: the submenu rests in the menu's closed popover.)
    expect(of("SubmenuTrigger").every((r) => r.hidden === true)).toBe(true);
    const reference = render(
      createElement(
        Menu,
        { "aria-label": "Edit" },
        createElement(
          MenuItem,
          { id: "cut", textValue: "Cut" },
          createElement(Text, { slot: "label" }, "Cut"),
        ),
        createElement(
          SubmenuTrigger,
          null,
          createElement(
            MenuItem,
            { id: "share", textValue: "Share" },
            createElement(Text, { slot: "label" }, "Share"),
            createElement("svg", { "aria-hidden": "true" }),
          ),
          createElement(
            Popover,
            null,
            createElement(
              Menu,
              { "aria-label": "Share" },
              createElement(
                MenuItem,
                { id: "sms", textValue: "SMS" },
                createElement(Text, { slot: "label" }, "SMS"),
              ),
              createElement(
                MenuItem,
                { id: "instagram", textValue: "Instagram" },
                createElement(Text, { slot: "label" }, "Instagram"),
              ),
            ),
          ),
        ),
      ),
    );
    cleanups.push(() => reference.unmount());
    const referenceMenu = itemStructure(reference.getByRole("menu"));
    const referenceShare = reference.getAllByRole("menuitem")[1]!;
    fireEvent.click(referenceShare);
    const submenuOf = async (item: Element) => {
      let found: Element | null = null;
      await waitFor(() => {
        found = document.querySelector(
          `[role=menu][aria-labelledby="${item.id}"]`,
        );
        expect(found).not.toBeNull();
      });
      return found! as Element;
    };
    const referenceOpened = await submenuOf(referenceShare);
    const referenceSubmenu = itemStructure(referenceOpened);
    // (RAC's SubmenuTrigger places it: `end top` — the reference passes no placement.)
    const referencePlacement = referenceOpened
      .closest(".react-aria-Popover")
      ?.getAttribute("data-placement");
    reference.unmount();

    const view = await openMenu(root, record(MENU).id);
    expect(itemStructure(view.getByRole("menu"))).toBe(referenceMenu);
    const share = view.getAllByRole("menuitem")[1]!;
    expect(share.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.click(share);
    // (RAC names the submenu by its trigger item.)
    const submenu = await submenuOf(share);
    expect(itemStructure(submenu)).toBe(referenceSubmenu);
    expect(
      submenu.closest(".react-aria-Popover")?.getAttribute("data-placement"),
    ).toBe(referencePlacement);
    expect(referencePlacement).toBeTruthy();
  });

  it("the MenuItem origin holds the chevron: shown in a SubmenuTrigger, absent in a plain item", async () => {
    const entries = submenuEntries(() => []).map((entry) =>
      entry.id === "project:node:share" || entry.id === "project:node:cut"
        ? ({
            ...entry,
            definitionId: "lib:definition:origin-component-menu-item-default",
            children: [],
          } as NodeEntry)
        : entry,
    );
    const { root, record, of } = await open(
      entries.filter(
        (entry) =>
          entry.id !== "project:node:share-label" &&
          entry.id !== "project:node:cut-label",
      ),
      MENU,
    );
    const chevrons = of("Icon").filter(
      (icon) => icon.props.iconName === "chevron-right",
    );
    expect(chevrons).toHaveLength(2);
    const view = await openMenu(root, record(MENU).id);
    const [cut, share] = view.getAllByRole("menuitem");
    const glyphs = (item: Element) =>
      item.querySelectorAll(
        chevrons.map((c) => `[data-catalog-id="${c.id}"]`).join(","),
      ).length;
    expect(glyphs(cut!)).toBe(0);
    expect(glyphs(share!)).toBe(1);
  });
});

/**
 * ADR-256 Phase 5 Round 12 (Codex read m5) — RAC's SubmenuTrigger reads `children[0]` as its item
 * and `children[1]` as the submenu's Popover: an authored order the other way (a move, a paste)
 * broke the whole menu. The DOM gives RAC its item and Popover in that order; without a Popover
 * yet (the author is still assembling), the item is a plain item.
 */
describe("ADR-256 Phase 5 Round 12 — a SubmenuTrigger whatever its children's order", () => {
  const withSubmenuChildren = (children: string[]) =>
    submenuEntries(chevronNode).map((entry) =>
      entry.id === "project:node:submenu"
        ? ({ ...entry, children: children as NodeId[] } as NodeEntry)
        : entry,
    );

  it("Popover first: the item still opens its submenu", async () => {
    const { root, record } = await open(
      withSubmenuChildren([
        "project:node:submenu-popover",
        "project:node:share",
      ]),
      MENU,
    );
    const view = await openMenu(root, record(MENU).id);
    const share = view.getAllByRole("menuitem")[1]!;
    expect(share.textContent).toContain("Share");
    expect(share.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.click(share);
    await waitFor(() =>
      expect(
        document.querySelector(`[role=menu][aria-labelledby="${share.id}"]`),
      ).not.toBeNull(),
    );
  });

  it("no Popover yet: the item is drawn as a plain item", async () => {
    const { root, record } = await open(
      withSubmenuChildren(["project:node:share"]).filter(
        (entry) =>
          ![
            "project:node:submenu-popover",
            "project:node:submenu-menu",
            "project:node:sms",
            "project:node:sms-label",
            "project:node:instagram",
            "project:node:instagram-label",
          ].includes(entry.id),
      ),
      MENU,
    );
    const view = await openMenu(root, record(MENU).id);
    const items = view.getAllByRole("menuitem");
    expect(items.map((item) => item.textContent)).toEqual(["Cut", "Share"]);
    expect(items[1]!.hasAttribute("aria-haspopup")).toBe(false);
  });
});
