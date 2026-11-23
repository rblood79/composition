import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogItemInsertChoices } from "../../../builder/catalogRuntime/itemInsert";
import {
  catalogCodeViewPlan,
  catalogCodeViewSession,
} from "../../../builder/catalogRuntime/codeViewEdit";
import { openAdr280Preview } from "./support/adr280Harness";
import { HOME, openAdr296 } from "./support/adr296Harness";

/**
 * S2 체크리스트 §9.3 (2026-11-23) — S2 `UnavailableMenuItemTrigger` (`Menu.tsx:1074-1091`): an item
 * marked unavailable opens a help popover (S2 `ContextualHelpPopover`) in place of its action, shows
 * an info glyph in the chevron's place and is described by it; available, it is a plain item.
 * Measurement: jsdom, the palette Menu + the Menu's 「+」 「UnavailableMenuItemTrigger」.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function openWithUnavailable() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview(["Menu"]);
  const root = h.workspace.root;
  const menu = [...root.canvasInputs.values()].find(
    (record) => root.typeOf(record) === "Menu",
  )!;
  h.workspace.execute(
    catalogItemInsertChoices(
      {
        graph: h.workspace.runtime.graph,
        readModel: h.workspace.readModel,
        newId: h.workspace.newId,
      },
      h.workspace.positionOfRecord(menu.id)!,
    )
      .find((choice) => choice.type === "UnavailableMenuItemTrigger")!
      .build(),
  );
  h.flush();
  await settle();
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const trigger = of("UnavailableMenuItemTrigger")[0]!;
  const open = async () => {
    // (The MenuTrigger has no element: its ActionButton 「Menu」.)
    const button = [...document.querySelectorAll("button")].find(
      (b) => b.textContent?.trim() === "Menu",
    )!;
    fireEvent.click(button);
    await waitFor(() =>
      expect(document.querySelector('[role="menu"]')).not.toBeNull(),
    );
    const items = [...document.querySelectorAll('[role="menuitem"]')];
    return items.find((item) => item.textContent?.includes("Unavailable"))!;
  };
  return { h, root, of, trigger, open };
}

describe("S2 §9.3 UnavailableMenuItemTrigger", () => {
  it("unavailable: the item opens its help (named by its title), is described by its info glyph, and shows no chevron", async () => {
    const { h, root, trigger, open } = await openWithUnavailable();
    // (The Canvas: the info glyph shows, the chevron does not, the help rests closed.)
    const glyphs = trigger.children.flatMap((id) =>
      (root.canvasInputs.get(id)?.children ?? []).map((child) =>
        root.canvasInputs.get(child)!,
      ),
    );
    const info = glyphs.find((g) => g?.props.iconName === "info");
    const chevron = glyphs.find((g) => g?.props.iconName === "chevron-right");
    expect(info).toBeDefined();
    expect(info!.hidden === true).toBe(false);
    expect(chevron?.hidden).toBe(true);
    const popover = trigger.children
      .map((id) => root.canvasInputs.get(id)!)
      .find((r) => root.typeOf(r) === "Popover")!;
    expect(popover.hidden).toBe(true);

    const item = await open();
    expect(item.getAttribute("aria-haspopup")).toBeTruthy();
    const described = item.getAttribute("aria-describedby") ?? "";
    const glyph = document.getElementById(described.split(" ")[0]!);
    expect(glyph).not.toBeNull();
    expect(glyph!.getAttribute("aria-label")).toBe(
      "Unavailable, expand for details",
    );
    expect(item.querySelector('[data-icon="chevron-right"]')).toBeNull();
    fireEvent.click(item);
    let help: Element | null = null;
    await waitFor(() => {
      help = [...document.querySelectorAll(".react-aria-Popover")].find(
        (element) => element.textContent?.includes("Permission required"),
      )!;
      expect(help).toBeTruthy();
    });
    const titleId = help!.getAttribute("aria-labelledby")!;
    expect(document.getElementById(titleId)?.textContent).toBe(
      "Permission required",
    );
    expect(help!.getAttribute("data-placement")).toBeTruthy();
    h.view.unmount();
  });

  it("available (isUnavailable off): a plain item — no popup, no glyph, no help", async () => {
    const { h, root, trigger, open } = await openWithUnavailable();
    h.workspace.execute(
      setFields({
        targets: [h.workspace.positionOfRecord(trigger.id)!.target],
        props: { isUnavailable: { kind: "set", value: false } } as never,
        label: "Unavailable",
      }),
    );
    h.flush();
    await settle();
    // (This item's glyph — the Canvas follows the trigger's edit, not only a fresh build.)
    const menuItem = trigger.children
      .map((id) => root.canvasInputs.get(id)!)
      .find((r) => root.typeOf(r) === "MenuItem")!;
    const info = menuItem.children
      .map((id) => root.canvasInputs.get(id)!)
      .find((r) => r.props.iconName === "info");
    expect(info).toBeDefined();
    expect(info!.hidden).toBe(true);
    const item = await open();
    expect(item.getAttribute("aria-haspopup")).toBeNull();
    expect(item.getAttribute("aria-describedby")).toBeNull();
    expect(item.querySelector('[data-icon="info"]')).toBeNull();
    h.view.unmount();
  });
});

describe("S2 §9.3 UnavailableMenuItemTrigger — code view", () => {
  it("writes <UnavailableMenuItemTrigger isUnavailable> around the item and its help, and reads it back (strict)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = await openAdr296();
    h.add("Menu");
    const root = h.workspace.root;
    const menu = [...root.canvasInputs.values()].find(
      (record) => root.typeOf(record) === "Menu",
    )!;
    h.workspace.execute(
      catalogItemInsertChoices(
        {
          graph: h.workspace.runtime.graph,
          readModel: h.workspace.readModel,
          newId: h.workspace.newId,
        },
        h.workspace.positionOfRecord(menu.id)!,
      )
        .find((choice) => choice.type === "UnavailableMenuItemTrigger")!
        .build(),
    );
    const code = h.code();
    expect(code).toMatch(
      /<UnavailableMenuItemTrigger isUnavailable=\{true\}>\s*<MenuItem/,
    );
    expect(code).toMatch(
      /import \{[^}]*UnavailableMenuItemTrigger[^}]*\} from '@composition\/shared\/components'/,
    );
    expect(code).toContain("Permission required");
    const data = h.dataOf();
    const session = catalogCodeViewSession(h.graph(), HOME, data)!;
    expect(
      catalogCodeViewPlan({
        reader: h.workspace.runtime.graph.commandReader,
        session,
        edited: session.baseline.code,
        changes: [],
        data,
        newId: h.workspace.newId,
        strict: true,
      }).rejected,
    ).toEqual([]);
  });
});
