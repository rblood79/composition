// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { getPaletteItems } from "../../panels/components/paletteItems";

/**
 * ADR-322 G1 — a Cascader through the real composition root: its closed field (Select's parts) and
 * the start value's text on both consumers, the items not drawn, the DOM's names (label · value ·
 * help) by RAC props. Expected texts are written out by hand from the origin's items.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr322-g1" as EntryId<"project">,
        name: "ADR-322 G1",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr322-g1-${Math.random()}`),
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
          definitionId: catalogPaletteDefinitionId(library, "Cascader"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const records = () => [...root.canvasInputs.values()];
  const cascader = () => records().find((r) => r.sourceId === PLACED)!;
  const ofType = (type: string) =>
    records().filter((r) => root.typeOf(r) === type);
  const inField = (type: string) => {
    const field = cascader().id;
    return ofType(type).filter((r) => {
      for (let up = root.canvasInputs.get(r.parentId); up;) {
        if (up.id === field) return true;
        up = root.canvasInputs.get(up.parentId);
      }
      return false;
    });
  };
  const value = () => inField("SelectValue")[0]!;
  /** The value text the Canvas draws (the derived text, else the template's placeholder). */
  const canvasText = () => {
    const record = value();
    const derived = record.derivedProps?.children;
    return typeof derived === "string"
      ? derived
      : String(record.props.children ?? "");
  };
  const write = (props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(cascader().id)!.target],
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ) as never,
      }),
    );
  return { workspace, root, cascader, inField, value, canvasText, write };
}

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.replaceChildren();
});

/** The item RAC Autocomplete's input points at (`aria-activedescendant`). */
const virtualFocus = () => {
  const id = document.activeElement?.getAttribute("aria-activedescendant");
  return id ? document.getElementById(id)?.textContent : undefined;
};

async function dom(t: Awaited<ReturnType<typeof place>>) {
  await unmount?.();
  const host = document.createElement("div");
  document.body.append(host);
  const react = createRoot(host);
  await act(async () =>
    react.render(renderCatalogDom(t.root, t.cascader().id)),
  );
  unmount = async () => act(async () => react.unmount());
  const field = host.querySelector(".react-aria-Cascader") as HTMLElement;
  const button = field.querySelector("button") as HTMLButtonElement;
  const valueEl = field.querySelector(".react-aria-SelectValue") as HTMLElement;
  const label = field.querySelector(".react-aria-Label") as HTMLElement | null;
  return { host, field, button, valueEl, label };
}

describe("ADR-322 G1 — Cascader 등록 · 닫힌 필드", () => {
  it("the palette offers the Cascader beside the ComboBox", () => {
    const types = getPaletteItems().map((item) => item.type);
    expect(types.indexOf("Cascader")).toBe(types.indexOf("ComboBox") + 1);
  });

  it("the items are the hierarchy — no item is drawn or laid out on the Canvas", async () => {
    const t = await place();
    const items = t.inField("CascaderItem");
    // Electronics (Computers: Laptops · Desktops, Phones: Smartphones · Accessories),
    // Clothing (Men · Women), Books — 11 items.
    expect(items).toHaveLength(11);
    expect(items.every((item) => item.hidden === true)).toBe(true);
    t.workspace.dispose();
  });

  it("the trigger parts are Select's picker parts (field button corners · value · glyph)", async () => {
    const t = await place();
    const [button] = t.inField("Button");
    expect(button!.derivedProps?._pickerTrigger).toBe(true);
    expect(button!.derivedProps?.fieldButton).toBe("M");
    expect(t.value().derivedProps?._pickerValue).toBe(true);
    expect(t.value().derivedProps?._cascaderValue).toBe(true);
    // (The field rule's trigger delegation reaches the value through the Button — it fills the
    //  trigger (Select's `.react-aria-SelectValue` block), and the field's size reaches its Label.)
    expect(t.value().layout?.flexGrow).toBe("1");
    const [label] = t.inField("Label");
    expect(label!.props.size).toBe("M");
    t.write({ size: "L" });
    expect(t.inField("Label")[0]!.props.size).toBe("L");
    t.workspace.dispose();
  });

  it("the start value's text — Canvas = DOM: placeholder, the path, the leaf, a separator, undo", async () => {
    const t = await place();
    expect(t.canvasText()).toBe("Choose an option...");
    let view = await dom(t);
    expect(view.valueEl.textContent).toBe("Choose an option...");
    expect(view.valueEl.hasAttribute("data-placeholder")).toBe(true);

    t.write({ defaultValue: "laptops" });
    expect(t.canvasText()).toBe("Electronics / Computers / Laptops");
    view = await dom(t);
    expect(view.valueEl.textContent).toBe("Electronics / Computers / Laptops");
    expect(view.valueEl.hasAttribute("data-placeholder")).toBe(false);

    t.write({ displayMode: "leaf" });
    expect(t.canvasText()).toBe("Laptops");
    expect((await dom(t)).valueEl.textContent).toBe("Laptops");

    t.write({ displayMode: "path", separator: " › " });
    expect(t.canvasText()).toBe("Electronics › Computers › Laptops");

    // A key no single item carries is shown as stored (breakdown §4.2 — never matched to another).
    t.write({ defaultValue: "missing-key" });
    expect(t.canvasText()).toBe("missing-key");

    t.workspace.undo();
    t.workspace.undo();
    t.workspace.undo();
    expect(t.canvasText()).toBe("Electronics / Computers / Laptops");
    t.workspace.dispose();
  });

  it("an item's name edit reaches the value text", async () => {
    const t = await place();
    t.write({ defaultValue: "books" });
    expect(t.canvasText()).toBe("Books");
    const books = t
      .inField("CascaderItem")
      .find((item) => item.props.id === "books")!;
    t.workspace.execute(
      setFields({
        targets: [t.workspace.itemOfRecord(books.id)!.target],
        props: { label: { kind: "set", value: "Magazines" } } as never,
      }),
    );
    expect(t.canvasText()).toBe("Magazines");
    t.workspace.dispose();
  });

  it("DOM — RAC names the open Button by its value and label, the help by `aria-describedby`; no item element", async () => {
    const t = await place();
    t.write({ defaultValue: "men", description: "Pick one" });
    const view = await dom(t);
    expect(view.label?.textContent).toContain("Category");
    const labelledBy = view.button.getAttribute("aria-labelledby")!.split(" ");
    expect(labelledBy).toEqual([view.valueEl.id, view.label!.id]);
    const help = view.field.querySelector(
      '[slot="description"]',
    ) as HTMLElement;
    expect(help.textContent).toBe("Pick one");
    expect(view.button.getAttribute("aria-describedby")).toBe(help.id);
    expect(view.field.querySelector(".react-aria-CascaderItem")).toBeNull();
    expect(view.field.textContent).not.toContain("Electronics");
    t.workspace.dispose();
  });

  it("DOM — no visible label: the placeholder names the Button; disabled · invalid reach the field", async () => {
    const t = await place();
    t.write({ label: "", isDisabled: true, isInvalid: true });
    const view = await dom(t);
    expect(view.label).toBeNull();
    expect(view.button.getAttribute("aria-label")).toBe("Choose an option...");
    expect(view.button.disabled).toBe(true);
    expect(view.field.getAttribute("data-disabled")).toBe("true");
    expect(view.field.getAttribute("data-invalid")).toBe("true");
    t.workspace.dispose();
  });
});

describe("ADR-322 G2 — columns: open · move between levels · pick (RAC Menu + SubmenuTrigger)", () => {
  const menus = () => [...document.querySelectorAll('[role="menu"]')];
  const items = (menu: Element) =>
    [...menu.querySelectorAll('[role^="menuitem"]')].map((el) => ({
      text: el.textContent,
      role: el.getAttribute("role"),
      checked: el.getAttribute("aria-checked"),
      disabled: el.getAttribute("aria-disabled"),
      submenu: el.getAttribute("aria-haspopup"),
    }));
  /** Focus back in the search field (a closed level gives it back a frame later). */
  const waitSearchFocus = async () => {
    for (let i = 0; i < 50 && document.activeElement?.tagName !== "INPUT"; i++)
      await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(document.activeElement?.tagName).toBe("INPUT");
  };
  const waitMenus = async (count: number) => {
    for (let i = 0; i < 50 && menus().length !== count; i++)
      await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(menus()).toHaveLength(count);
  };

  it("keyboard: Enter opens the first level, → · → into the third, ↓ Enter picks — the value text, closed, focus back", async () => {
    const t = await place();
    const view = await dom(t);
    const user = userEvent.setup();
    expect(view.button.getAttribute("aria-haspopup")).toBe("true");
    expect(view.button.getAttribute("aria-expanded")).toBe("false");
    view.button.focus();
    await user.keyboard("{Enter}");
    await waitMenus(1);
    expect(view.button.getAttribute("aria-expanded")).toBe("true");
    expect(items(menus()[0]!).map((i) => [i.text, i.role, i.submenu])).toEqual([
      ["Electronics", "menuitem", "menu"],
      ["Clothing", "menuitem", "menu"],
      ["Books", "menuitemradio", null],
    ]);
    // (The search field takes focus on open — always there, 2026-11-28 사용자 결정; the first item
    //  has RAC Autocomplete's virtual focus, → goes into its level with real focus.)
    expect(document.activeElement?.tagName).toBe("INPUT");
    expect(virtualFocus()).toBe("Electronics");
    await user.keyboard("{ArrowRight}");
    await waitMenus(2);
    expect(document.activeElement?.textContent).toBe("Computers");
    await user.keyboard("{ArrowRight}");
    await waitMenus(3);
    expect(document.activeElement?.textContent).toBe("Laptops");
    await user.keyboard("{ArrowDown}{Enter}");
    await waitMenus(0);
    expect(view.valueEl.textContent).toBe("Electronics / Computers / Desktops");
    expect(view.valueEl.hasAttribute("data-placeholder")).toBe(false);
    // (RAC restores focus to the trigger after the popover's exit — a frame later.)
    for (let i = 0; i < 50 && document.activeElement !== view.button; i++)
      await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(document.activeElement).toBe(view.button);
    // Open again: the picked item's level shows it checked (RAC single selection).
    await user.keyboard("{Enter}");
    await waitMenus(1);
    await user.keyboard("{ArrowRight}");
    await waitMenus(2);
    await user.keyboard("{ArrowRight}");
    await waitMenus(3);
    expect(items(menus()[2]!).map((i) => [i.text, i.checked])).toEqual([
      ["Laptops", "false"],
      ["Desktops", "true"],
    ]);
    // (Each Escape closes one level and focus goes back to the search field; there, Escape closes
    //  the field's menu — RAC SearchField passes an empty field's Escape on.)
    await user.keyboard("{Escape}{Escape}");
    await waitMenus(1);
    await waitSearchFocus();
    await user.keyboard("{Escape}");
    await waitMenus(0);
    t.workspace.dispose();
  });

  it("pointer: a press opens, a leaf press picks; a branch does not pick", async () => {
    const t = await place();
    const view = await dom(t);
    const user = userEvent.setup();
    await user.click(view.button);
    await waitMenus(1);
    const books = [...menus()[0]!.querySelectorAll('[role^="menuitem"]')].find(
      (el) => el.textContent === "Books",
    ) as HTMLElement;
    await user.click(books);
    await waitMenus(0);
    expect(view.valueEl.textContent).toBe("Books");
    t.workspace.dispose();
  });

  it("an item whose key another item carries cannot be picked (Decision 4) — both items disabled", async () => {
    const t = await place();
    const desktops = t
      .inField("CascaderItem")
      .find((item) => item.props.id === "desktops")!;
    t.workspace.execute(
      setFields({
        targets: [t.workspace.itemOfRecord(desktops.id)!.target],
        props: { id: { kind: "set", value: "men" } } as never,
      }),
    );
    const view = await dom(t);
    const user = userEvent.setup();
    view.button.focus();
    await user.keyboard("{Enter}");
    await waitMenus(1);
    await user.keyboard("{ArrowRight}");
    await waitMenus(2);
    await user.keyboard("{ArrowRight}");
    await waitMenus(3);
    expect(items(menus()[2]!).map((i) => [i.text, i.disabled])).toEqual([
      ["Laptops", null],
      ["Desktops", "true"],
    ]);
    await user.keyboard("{Escape}{Escape}");
    await waitMenus(1);
    await waitSearchFocus();
    await user.keyboard("{Escape}");
    await waitMenus(0);
    // (Clothing › Men carries the same key — also disabled.)
    view.button.focus();
    await user.keyboard("{Enter}");
    await waitMenus(1);
    await user.keyboard("{ArrowDown}{ArrowRight}");
    await waitMenus(2);
    expect(items(menus()[1]!).map((i) => [i.text, i.disabled])).toEqual([
      ["Men", "true"],
      ["Women", null],
    ]);
    await user.keyboard("{Escape}{Escape}");
    t.workspace.dispose();
  });
});

describe("ADR-322 G3 — drill: one level at a time, the same answers as columns", () => {
  const rows = () =>
    [...document.querySelectorAll('[role="grid"] [role="row"]')].map((el) => ({
      text: el.textContent,
      selected: el.getAttribute("aria-selected"),
    }));
  const waitDialog = async (open: boolean) => {
    for (
      let i = 0;
      i < 50 && !!document.querySelector('[role="dialog"]') !== open;
      i++
    )
      await act(async () => new Promise((r) => setTimeout(r, 20)));
    expect(!!document.querySelector('[role="dialog"]')).toBe(open);
  };
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 40)));

  it("Enter → the first level (focus on its first row) · Enter goes in · ↓ Enter picks — the same path text; the mode does not change the value", async () => {
    const t = await place();
    t.write({ mode: "drill" });
    const view = await dom(t);
    const user = userEvent.setup();
    // (react-aria `useOverlayTrigger` gives a dialog trigger no `aria-haspopup` — RAC DialogTrigger's.)
    expect(view.button.getAttribute("aria-haspopup")).toBeNull();
    expect(view.button.getAttribute("aria-expanded")).toBe("false");
    view.button.focus();
    await user.keyboard("{Enter}");
    await waitDialog(true);
    await settle();
    expect(rows().map((r) => r.text)).toEqual([
      "Electronics",
      "Clothing",
      "Books",
    ]);
    // (The search field takes focus on open — always there, 2026-11-28 사용자 결정; Tab goes into the
    //  level's list.)
    expect(document.activeElement?.tagName).toBe("INPUT");
    await user.keyboard("{Tab}");
    expect(document.activeElement?.textContent).toBe("Electronics");
    await user.keyboard("{Enter}");
    await settle();
    expect(rows().map((r) => r.text)).toEqual(["Computers", "Phones"]);
    expect(document.activeElement?.textContent).toBe("Computers");
    await user.keyboard("{Enter}");
    await settle();
    expect(document.activeElement?.textContent).toBe("Laptops");
    await user.keyboard("{ArrowDown}{Enter}");
    await waitDialog(false);
    expect(view.valueEl.textContent).toBe("Electronics / Computers / Desktops");
    // Reopen: the picked item's level, its row selected; the back button goes one level up.
    view.button.focus();
    await user.keyboard("{Enter}");
    await waitDialog(true);
    await settle();
    expect(rows()).toEqual([
      { text: "Laptops", selected: "false" },
      { text: "Desktops", selected: "true" },
    ]);
    const back = document.querySelector(
      '[role="dialog"] button[aria-label="Back"]',
    ) as HTMLButtonElement;
    await user.click(back);
    await settle();
    expect(rows().map((r) => r.text)).toEqual(["Computers", "Phones"]);
    await user.keyboard("{Escape}");
    await waitDialog(false);
    // The same value in the columns mode reads the same.
    t.write({ mode: "columns" });
    expect(t.canvasText()).toBe("Choose an option...");
    t.workspace.dispose();
  });
});

describe("ADR-322 G5 — tree: only expanded branches are in the list (HC5)", () => {
  const rows = () =>
    [...document.querySelectorAll('[role="treegrid"] [role="row"]')].map(
      (el) => [el.textContent, el.getAttribute("aria-expanded")],
    );
  const settle = () => act(async () => new Promise((r) => setTimeout(r, 40)));

  it("a closed branch is expandable (aria-expanded false · →) and draws no child; → swaps its items in", async () => {
    const t = await place();
    t.write({ mode: "tree" });
    const view = await dom(t);
    const user = userEvent.setup();
    view.button.focus();
    await user.keyboard("{Enter}");
    for (let i = 0; i < 50 && !document.querySelector('[role="treegrid"]'); i++)
      await settle();
    await settle();
    expect(rows()).toEqual([
      ["Electronics", "false"],
      ["Clothing", "false"],
      ["Books", null],
    ]);
    // (The stand-in child of a closed branch is never a row.)
    expect(document.querySelectorAll('[role="treegrid"] [role="row"]')).toHaveLength(3);
    (document.querySelector('[role="treegrid"] [role="row"]') as HTMLElement).focus();
    await user.keyboard("{ArrowRight}");
    await settle();
    expect(rows()).toEqual([
      ["Electronics", "true"],
      ["Computers", "false"],
      ["Phones", "false"],
      ["Clothing", "false"],
      ["Books", null],
    ]);
    await user.keyboard("{Escape}");
    t.workspace.dispose();
  });
});
