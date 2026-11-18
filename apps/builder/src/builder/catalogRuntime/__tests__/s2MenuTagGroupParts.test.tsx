// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { REUSABLE_ORIGIN_TEMPLATES } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  AuthoredValue,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogDerivedConditionalVisual } from "../../../../../../packages/shared/src/catalog/runtime/libraryVisual";
import { renderCatalogDom } from "../domBinding";
import { colorTokenCssValue } from "@composition/rendering";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { bindCatalogCanvas } from "../canvasBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { catalogItemInsertChoices } from "../itemInsert";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 정렬 — 메뉴 · 태그 묶음 (2026-11-18): Disclosure's title row (`DisclosureHeader`), a Menu
 * item's S2 grid (selection mark · icon · label over description · keyboard · chevron, the parts'
 * S2 margins), a section's `Header > Heading + Text` and its Divider, and the Menu's empty state —
 * 「No results」 (사용자 결정 「S2 대로 글자 한 줄」).
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(
  paletteType: string,
  props: Record<string, AuthoredValue> = {},
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-menu-tag" as EntryId<"project">,
        name: "S2 menu tag",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-menu-tag-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: ROOT,
          definitionId: catalogPaletteDefinitionId(library, paletteType),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [ROOT],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const kids = (id: string) =>
    root.canvasInputs
      .get(id)!
      .children.map((child) => root.canvasInputs.get(child)!);
  const box = (id: string) => root.getGeometry([id]).get(id)!;
  const render = async (recordId: string) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () => reactRoot.render(renderCatalogDom(root, recordId)));
    return {
      host,
      done: async () => {
        await act(async () => reactRoot.unmount());
        host.remove();
        // (An overlay's portal content goes too — the next test's queries read the document.)
        document.body.innerHTML = "";
      },
    };
  };
  const insertChoice = (recordId: string, type: string) =>
    workspace.execute(
      catalogItemInsertChoices(
        {
          graph: workspace.runtime.graph,
          readModel: workspace.readModel,
          newId: workspace.newId,
        },
        workspace.positionOfRecord(recordId)!,
      )
        .find((choice) => choice.type === type)!
        .build(),
    );
  return { workspace, root, of, kids, box, render, insertChoice };
}

// jsdom has no observers (RAC collections' load-more sentinel reads one).
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
const observerGlobals = globalThis as Record<string, unknown>;
observerGlobals.IntersectionObserver ??= NoopObserver;
observerGlobals.ResizeObserver ??= NoopObserver;

/** Polls the DOM until `find` returns something (a lazy chunk · an opening overlay). */
async function settled<T>(find: () => T | null | undefined): Promise<T | null> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const found = find();
    if (found) return found;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
  }
  return null;
}

const template = (id: string) =>
  REUSABLE_ORIGIN_TEMPLATES.find((node) => node.id === id)!;

describe("S2 Disclosure — DisclosureHeader", () => {
  it("the title Heading sits in the DisclosureHeader row, filling it (Canvas and DOM)", async () => {
    expect(template("lib:template:component-disclosure").children[0]).toBe(
      "lib:template:component-disclosure__header",
    );
    const { of, kids, box, render } = await open("Disclosure");
    const header = of("DisclosureHeader")[0]!;
    const heading = kids(header.id)[0]!;
    expect(heading.bindingId).toBe("heading");
    // (S2 `headingStyle` flexGrow 1: the heading — and its trigger — fill the row.)
    expect(box(heading.id).width).toBe(box(header.id).width);
    const disclosure = of("Disclosure")[0]!;
    const view = await render(disclosure.id);
    const row = view.host.querySelector(
      ".react-aria-Disclosure > .react-aria-DisclosureHeader",
    );
    expect(row?.firstElementChild?.tagName).toBe("H3");
    expect(row?.querySelector('button[slot="trigger"]')).not.toBeNull();
    await view.done();
  });
});

describe("S2 Menu — item grid, section, divider, empty state", () => {
  it("an item is S2's grid: the parts' columns, the label over its description, S2 margins", async () => {
    const { workspace, of, kids } = await open("Menu", {
      isOpen: true,
      selectionMode: "multiple",
    });
    const item = of("MenuItem")[0]!;
    expect(item.layout).toMatchObject({
      display: "grid",
      gridTemplateColumns: "auto auto minmax(0, 1fr) auto auto",
      columnGap: "0px",
    });
    const parts = kids(item.id);
    const checkbox = parts.find(
      (part) => workspace.root.typeOf(part) === "Checkbox",
    )!;
    const label = parts.find((part) => part.props.slot === "label")!;
    // (M: text-to-control = 14 × 10/14.)
    expect(checkbox.layout).toMatchObject({
      gridColumnStart: "1",
      gridRowStart: "1",
      marginRight: "10px",
    });
    expect(label.layout).toMatchObject({
      gridColumnStart: "3",
      gridRowStart: "1",
    });
    // (The template order: the description before the keyboard — S2's example order.)
    expect(
      template("lib:template:component-menu-item-default").children,
    ).toEqual([
      "lib:template:component-menu-item-default__icon",
      "lib:template:component-menu-item-default__label",
      "lib:template:component-menu-item-default__description",
      "lib:template:component-menu-item-default__shortcut",
      "lib:template:component-menu-item-default__chevron",
    ]);
  });

  it("a new section is Header > Heading + Text and brings S2's Divider, hidden while it ends the menu", async () => {
    const { root, of, kids, insertChoice, render } = await open("Menu", {
      isOpen: true,
    });
    const menu = of("Menu")[0]!;
    insertChoice(menu.id, "MenuSection");
    const section = of("MenuSection")[0]!;
    const header = kids(section.id).find(
      (part) => root.typeOf(part) === "Header",
    )!;
    const [heading, ...rest] = kids(header.id);
    expect(heading!.bindingId).toBe("heading");
    expect(heading!.visual).toMatchObject({ fontSize: 14, fontWeight: 700 });
    // S2 `sectionHeader` is `color: 'neutral'` (light `--fg` #292929), not the description's subdued
    // gray — the Canvas paints it so, and the generated CSS (Header's Heading selector) says the same.
    expect(heading!.visual.color).toBe("#292929");
    const selectors = (
      COMPONENT_RULES_TABLE.Header.structure as unknown as {
        composition: {
          staticSelectors: Record<string, Record<string, string>>;
        };
      }
    ).composition.staticSelectors;
    expect(selectors[".react-aria-Heading"]!.color).toBe(
      colorTokenCssValue("neutral"),
    );
    // (No description text — its Text is absent.)
    expect(rest.filter((part) => !part.hidden)).toEqual([]);
    const divider = () => of("Separator")[0]!;
    expect(divider()).toBeDefined();
    const order = () => kids(menu.id).map((part) => root.typeOf(part));
    expect(order()).toEqual([
      "MenuItem",
      "MenuItem",
      "MenuItem",
      "MenuSection",
      "Separator",
      "Text",
    ]);
    expect(divider().hidden).toBe(true);
    // An item after the section: the Divider is between them, drawn.
    insertChoice(menu.id, "MenuItem");
    expect(order().slice(3, 6)).toEqual([
      "MenuSection",
      "Separator",
      "MenuItem",
    ]);
    expect(divider().hidden).toBeFalsy();
    const trigger = of("MenuTrigger")[0]!;
    const view = await render(trigger.id);
    expect(
      document.querySelector('.react-aria-Menu [role="separator"]'),
    ).not.toBeNull();
    await view.done();
  });

  it("the empty state is one line of text — 「No results」 — at the control height, edge-to-text inset", async () => {
    const { workspace, root, of, box } = await open("Menu", { isOpen: true });
    const empty = () =>
      of("Text").find(
        (text) => root.typeOf(root.canvasInputs.get(text.parentId)!) === "Menu",
      )!;
    expect(empty().props.children).toBe("No results");
    expect(empty().hidden).toBe(true);
    workspace.execute(
      removeTargets({
        targets: of("MenuItem").map(
          (item) => workspace.positionOfRecord(item.id)!.target,
        ),
      }),
    );
    expect(empty().hidden).toBeFalsy();
    expect(box(empty().id).height).toBe(32);
    expect(empty().visual).toMatchObject({ paddingLeft: 12, paddingRight: 12 });
  });
});

describe("S2 SideNav — the icon in its link, the panel's content · footer", () => {
  it("an item's icon is its link's first part (S2 `treeRowLink`), beside the text on both consumers", async () => {
    const { root, of, kids, box, render } = await open("SideNav");
    const link = of("SideNavItemLink")[0]!;
    const [icon, text] = kids(link.id);
    expect(root.typeOf(icon!)).toBe("Icon");
    expect(root.typeOf(text!)).toBe("Text");
    const iconBox = box(icon!.id);
    const textBox = box(text!.id);
    // (the icon's end margin — 8 — before the text, one centred row)
    expect(textBox.x).toBe(iconBox.x + iconBox.width + 8);
    expect(textBox.y + textBox.height / 2).toBeCloseTo(
      iconBox.y + iconBox.height / 2,
    );
    const nav = of("SideNav")[0]!;
    const view = await render(nav.id);
    // (The SideNav's DOM is a lazy chunk.)
    expect(
      await settled(() =>
        view.host.querySelector(
          ".react-aria-SideNavItemLink > .react-aria-Icon",
        ),
      ),
    ).not.toBeNull();
    await view.done();
  });

  it("the panel holds its nav in a content box and a quiet ActionButton in its footer (S2)", async () => {
    const { workspace, root, of, kids, box, render } =
      await open("SideNavPanel");
    const panel = of("SideNavPanel")[0]!;
    const [content, footer] = kids(panel.id);
    expect(kids(content!.id).map((part) => root.typeOf(part))).toEqual([
      "SideNav",
    ]);
    const button = kids(footer!.id)[0]!;
    expect(root.typeOf(button)).toBe("ActionButton");
    expect(button.props).toMatchObject({ slot: "collapse", isQuiet: true });
    // (S2 footer `margin: 4` top · bottom · start; the content grows.)
    // (Geometry is parent-relative.)
    expect(box(footer!.id).x).toBe(4);
    expect(box(button.id).width).toBe(box(button.id).height);
    expect(box(content!.id).height).toBeGreaterThan(box(footer!.id).height);
    // (S2 `isInSideNavPanel`: the nav grows in the content box — a tall panel's nav fills it.)
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(panel.id)!.target],
        visual: { height: set(600) },
      } as never),
    );
    const nav = kids(content!.id)[0]!;
    expect(box(nav.id).height).toBe(box(content!.id).height);
    expect(box(content!.id).height).toBeGreaterThan(400);
    // (…and its 160 minimum is unset there: a narrow panel's nav keeps to the panel.)
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(panel.id)!.target],
        visual: { width: set(120) },
      } as never),
    );
    expect(box(nav.id).width).toBeLessThanOrEqual(120);
    const view = await render(panel.id);
    const collapse = await settled(() =>
      view.host.querySelector<HTMLButtonElement>('button[slot="collapse"]'),
    );
    expect(collapse?.getAttribute("aria-label")).toBe("Collapse side panel");
    await view.done();
  });
});

describe("S2 TagGroup — the Tag's content box, the action group", () => {
  it("a Tag's icon · avatar · text sit in its content box (S2 `TagWrapper`); the Tag keeps its name", async () => {
    const { root, of, kids, render } = await open("TagGroup");
    const tag = of("Tag")[0]!;
    const content = kids(tag.id)[0]!;
    expect(root.typeOf(content)).toBe("frame");
    expect(kids(content.id).some((part) => root.typeOf(part) === "Text")).toBe(
      true,
    );
    const group = of("TagGroup")[0]!;
    const view = await render(group.id);
    // (Not the maxRows mirror's chip — RAC's row.)
    const chip = view.host.querySelector("[role=row].react-aria-Tag");
    expect(chip?.getAttribute("aria-label")).toBe("Chocolate");
    // (The maxRows mirror measures the same chip texts — read through the content box.)
    const mirror = [
      ...view.host.querySelectorAll("[aria-hidden=true] .react-aria-Tag"),
    ].map((element) => element.textContent);
    expect(mirror).toContain("Chocolate");
    await view.done();
  });

  it("`groupActionLabel` adds S2's action button after the tags (and after Show all) on both consumers", async () => {
    const { workspace, root, of, box, render } = await open("TagGroup", {
      groupActionLabel: "Clear all",
    });
    const group = of("TagGroup")[0]!;
    const list = of("TagList")[0]!;
    const tags = of("Tag");
    const names = () =>
      (root.tagActionInputs.get(list.id) ?? []).map((action) => action.text);
    // (Every tag fits one row at the page width: no Show all — the action follows the last tag.)
    expect(names()).toEqual(["Clear all"]);
    const action = root.tagActionInputs.get(list.id)![0]!;
    const last = box(tags[tags.length - 1]!.id);
    expect(box(action.id).y).toBe(last.y);
    expect(box(action.id).x).toBeGreaterThan(last.x + last.width);
    const edit = (props: Record<string, AuthoredValue>, width?: number) =>
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(group.id)!.target],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          ...(width ? { visual: { width: set(width) } } : {}),
        }),
      );
    // A narrow group of one row: Show all, then the action (S2 `ActionGroup` order).
    edit({ maxRows: 1 }, 30);
    expect(names()).toEqual(["Show all (4)", "Clear all"]);
    const [showAll, after] = root.tagActionInputs.get(list.id)!;
    const reading = (rect: { x: number; y: number }) => [rect.y, rect.x];
    expect(reading(box(after!.id)) > reading(box(showAll!.id))).toBe(true);
    // No label, no button.
    edit({ groupActionLabel: "" });
    expect(names()).toEqual(["Show all (4)"]);
    edit({ groupActionLabel: "Clear all", maxRows: 0 });
    expect(names()).toEqual(["Clear all"]);
    // The Canvas draws it (a box, no record); a new label rebinds.
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const drawn = () =>
      getSkiaNode(root.tagActionInputs.get(list.id)![0]!.id)?.text?.content;
    expect(drawn()).toBe("Clear all");
    edit({ groupActionLabel: "Remove all" });
    expect(canvas.update()).toMatchObject({ status: "rebind-required" });
    canvas.dispose();
    const again = bindCatalogCanvas(root, root.pageRootRecords());
    expect(drawn()).toBe("Remove all");
    again.dispose();
    edit({ groupActionLabel: "Clear all" });
    // The DOM: the button in the 「Actions」 group; its press is the rule's `onGroupAction`.
    const pressed: string[] = [];
    const reactRoot = document.body.appendChild(document.createElement("div"));
    const view = createRoot(reactRoot);
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    await act(async () =>
      view.render(
        renderCatalogDom(root, group.id, {
          runtime: {
            revisionOf: () => 0,
            handlersOf: (id): Record<string, () => void> =>
              id === group.id
                ? {
                    onGroupAction: () => {
                      pressed.push("group");
                    },
                  }
                : {},
            overrideOf: () => undefined,
            subscribe: () => () => {},
          },
        }),
      ),
    );
    const actions = reactRoot.querySelector("[role=group].tag-actions");
    expect(actions?.getAttribute("aria-label")).toContain("Actions");
    const button = [...actions!.querySelectorAll("button")].find(
      (element) => element.textContent === "Clear all",
    )!;
    expect(button).toBeDefined();
    // S2's quiet ActionButton at the group's size — the generated ActionButton sheet draws it.
    expect({
      className: button.className,
      quiet: button.hasAttribute("data-quiet"),
      size: button.getAttribute("data-size"),
    }).toEqual({
      className: "react-aria-ActionButton",
      quiet: true,
      size: "M",
    });
    await act(async () => button.click());
    expect(pressed).toEqual(["group"]);
    await act(async () => view.unmount());
    reactRoot.remove();
    // Without a label the DOM has no such button either.
    edit({ groupActionLabel: "" });
    const plain = await render(group.id);
    expect(
      [...plain.host.querySelectorAll("button")].some(
        (element) => element.textContent === "Clear all",
      ),
    ).toBe(false);
    await plain.done();
  });
});

describe("S2 disabledKeys — Menu · TagGroup · SideNav", () => {
  it.each([
    ["Menu", "Menu", "MenuItem", "item-2"],
    ["TagGroup", "TagGroup", "Tag", "mint"],
    ["SideNav", "SideNav", "SideNavItem", "item-3"],
  ] as const)(
    "%s: the named item is disabled on the Canvas and in RAC",
    async (palette, owner, itemType, key) => {
      const { workspace, root, of, render } = await open(
        palette,
        palette === "Menu" ? { isOpen: true } : {},
      );
      const item = () =>
        of(itemType).find((entry) => String(entry.props.id) === key)!;
      expect(item().derivedProps?.isDisabled).toBeFalsy();
      const ownerRecord = of(owner)[0]!;
      workspace.execute(
        setFields({
          targets: [workspace.positionOfRecord(ownerRecord.id)!.target],
          props: { disabledKeys: set([key]) },
        }),
      );
      expect(item().derivedProps?.isDisabled).toBe(true);
      // (…drawn so: the Menu item dims as its rule's `[data-disabled]` (0.38), a Tag's · SideNav
      //  row's text takes the disabled color — the Preview's values.)
      if (itemType === "MenuItem")
        expect(catalogDerivedConditionalVisual(root, item()).opacity).toBe(
          0.38,
        );
      else {
        const textOf = (entry: {
          children: readonly string[];
        }): string | undefined => {
          for (const id of entry.children) {
            const child = root.canvasInputs.get(id);
            if (!child) continue;
            if (root.typeOf(child) === "Text")
              return String(child.derivedProps?.color ?? child.visual.color);
            const found = textOf(child);
            if (found) return found;
          }
          return undefined;
        };
        const other = of(itemType).find(
          (entry) =>
            String(entry.props.id) !== key && entry.id.includes("root"),
        )!;
        expect(textOf(item())).not.toBe(textOf(other));
      }
      const host = palette === "Menu" ? of("MenuTrigger")[0]! : of(owner)[0]!;
      const view = await render(host.id);
      // (RAC's own element of that item — its key's row · option · item.)
      const named = (element: Element) =>
        element.getAttribute("data-key") === key ||
        element.getAttribute("data-catalog-id") ===
          (item() as { id: string }).id;
      const element = await settled(() =>
        [...document.querySelectorAll("[data-catalog-id], [data-key]")].find(
          (candidate) =>
            named(candidate) &&
            /menuitem|row|treeitem|gridcell/.test(
              candidate.getAttribute("role") ?? "",
            ),
        ),
      );
      expect(element?.hasAttribute("data-disabled")).toBe(true);
      await view.done();
      void root;
    },
  );
});
