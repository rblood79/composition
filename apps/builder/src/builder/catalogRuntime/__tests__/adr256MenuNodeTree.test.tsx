// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Keyboard, Menu, MenuItem, Text } from "react-aria-components/Menu";
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
  for (const cleanup of cleanups.splice(0)) cleanup();
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
