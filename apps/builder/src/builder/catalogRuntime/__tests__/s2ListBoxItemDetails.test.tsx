// @vitest-environment jsdom
/**
 * S2 체크리스트 §4.1 ListBox 세부 (2026-11-22) — S2 Picker 항목 (`ComboBox.tsx` `listboxItem` · Menu.tsx
 * `description`) · `PickerSection`:
 *   - the description `neutral-subdued` (a standalone list's selected item keeps its on-accent text — its
 *     fill stays, 사용자 결정 2026-11-14; a picker's list draws no selection fill, so always);
 *   - the label ↔ description gap `space(1)` = 1;
 *   - a section brings S2's Divider (the Menu's way — 「+ Section」 adds a Separator, hidden first, last
 *     or before another; its place `5px` × the item's `edge-to-text`), which replaces the standalone
 *     section header's own lines;
 *   - the item's icon is S2's `currentColor` (`Menu.tsx` `icon` — a standalone list's selected item turns
 *     it on-accent with its label), and a picker's check mark is `baseColor('accent')` (`checkmark`).
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  AuthoredValue,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { resolveToken, type TokenRef } from "@composition/rendering";
import { catalogGlyphSize } from "../../../../../../packages/shared/src/catalog/runtime/boxModel";
import { renderCatalogDom } from "../domBinding";
import { catalogItemInsertChoices } from "../itemInsert";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(
  props: Record<string, AuthoredValue> = {},
  paletteType = "ListBox",
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-listbox-details" as EntryId<"project">,
        name: "S2 listbox details",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-listbox-details-${Math.random()}`),
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
  const render = async (recordId: string) => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.body.appendChild(document.createElement("div"));
    const reactRoot = createRoot(host);
    await act(async () => reactRoot.render(renderCatalogDom(root, recordId)));
    return async () => {
      await act(async () => reactRoot.unmount());
      host.remove();
      document.body.innerHTML = "";
    };
  };
  return { workspace, root, of, kids, box, insertChoice, render };
}

class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
(globalThis as Record<string, unknown>).IntersectionObserver ??= NoopObserver;

const generated = (file: string) =>
  readFileSync(
    resolve(
      __dirname,
      "../../../../../../packages/shared/src/components/styles/generated",
      file,
    ),
    "utf8",
  );
const color = (ref: string) => String(resolveToken(ref as TokenRef, "light"));

describe("S2 ListBox item details — description color · gap · section Divider", () => {
  it("the description is neutral-subdued; a standalone list's selected item keeps its on-accent text (Canvas)", async () => {
    const first = await open({ selectionMode: "single" });
    const items = first.of("ListBoxItem");
    const key = items[0]!.props.id as string;
    expect(typeof key).toBe("string");
    const { of, kids } = await open({
      selectionMode: "single",
      defaultSelectedKeys: [key],
    });
    // (An item label's color is derived — the item's paint, `derivedProps.color` — over its rest visual.)
    const colorOf = (item: { id: string }, slot: string) => {
      const part = kids(item.id).find((child) => child.props.slot === slot)!;
      return part.derivedProps?.color ?? part.visual.color;
    };
    const [selected, ...rest] = of("ListBoxItem");
    expect(selected!.derivedProps?._isSelected).toBe(true);
    expect(colorOf(selected!, "label")).toBe(color("{color.on-accent}"));
    expect(colorOf(selected!, "description")).toBe(color("{color.on-accent}"));
    for (const item of rest) {
      expect(colorOf(item, "label")).toBe(color("{color.neutral}"));
      expect(colorOf(item, "description")).toBe(
        color("{color.neutral-subdued}"),
      );
    }
  });

  it("the sheet colors the description the same way (standalone unselected · in a picker always)", () => {
    const sheet = generated("ListBox.css");
    expect(sheet).toMatch(
      /\.react-aria-ListBox:not\(\.react-aria-Popover \*\) \.react-aria-ListBoxItem:not\(\[data-selected\]\) \[slot="description"\] \{\s*color: var\(--fg-muted\);/,
    );
    expect(sheet).toMatch(
      /\.react-aria-ListBox:is\(\.react-aria-Popover \*\) \.react-aria-ListBoxItem \[slot="description"\] \{\s*color: var\(--fg-muted\);/,
    );
  });

  it("the label ↔ description gap is S2's space(1) — 1", async () => {
    const { of, kids, box } = await open();
    const item = of("ListBoxItem")[0]!;
    const label = kids(item.id).find((part) => part.props.slot === "label")!;
    const description = kids(item.id).find(
      (part) => part.props.slot === "description",
    )!;
    const labelBox = box(label.id);
    expect(box(description.id).y - (labelBox.y + labelBox.height)).toBe(1);
  });

  it("a new section brings S2's Divider — hidden while it ends the list, drawn before an item; 5 × edge-to-text", async () => {
    const { root, of, kids, box, insertChoice, render } = await open();
    const list = of("ListBox")[0]!;
    insertChoice(list.id, "ListBoxSection");
    const order = () => kids(list.id).map((part) => root.typeOf(part));
    expect(order()).toEqual([
      "ListBoxItem",
      "ListBoxItem",
      "ListBoxItem",
      "ListBoxSection",
      "Separator",
      "IllustratedMessage",
    ]);
    const divider = () => of("Separator")[0]!;
    expect(divider().hidden).toBe(true);
    insertChoice(list.id, "ListBoxItem");
    expect(order().slice(3, 6)).toEqual([
      "ListBoxSection",
      "Separator",
      "ListBoxItem",
    ]);
    expect(divider().hidden).toBeFalsy();
    const section = of("ListBoxSection")[0]!;
    const sectionBox = box(section.id);
    const dividerBox = box(divider().id);
    // (M: the item height 32 × 3/8 = 12 at the sides, 5 above and below a 2px line — S2 `separatorWrapper`.)
    expect(dividerBox.x - sectionBox.x).toBe(12);
    expect(dividerBox.y - (sectionBox.y + sectionBox.height)).toBe(5);
    expect(dividerBox.height).toBe(2);
    // The standalone section header draws no lines of its own now (the Divider separates).
    const header = kids(section.id).find(
      (part) => root.typeOf(part) === "Header",
    )!;
    expect(header.visual.borderTopWidth ?? 0).toBe(0);
    expect(header.visual.borderBottomWidth ?? 0).toBe(0);
    const done = await render(list.id);
    expect(
      document.querySelector('.react-aria-ListBox [role="separator"]'),
    ).not.toBeNull();
    await done();
    expect(generated("ListBox.css")).not.toMatch(
      /\.react-aria-ListBoxSection \.react-aria-Header \{[^}]*border-block/,
    );
  });
  it("a picker's selection check grows with its size — S2 Checkmark S · M 10 · L 12 · XL 14 at our M 16 (사용자 결정 11-22)", async () => {
    // (Its own key: the palette Select's first option.)
    const probe = await open({ isOpen: true }, "Select");
    const key = probe.of("ListBoxItem")[0]!.props.id as string;
    for (const [size, px] of [
      ["S", 16],
      ["M", 16],
      ["L", 19.2],
      ["XL", 22.4],
    ] as const) {
      const { root, of, kids, box, render } = await open(
        { isOpen: true, size, value: key },
        "Select",
      );
      const item = of("ListBoxItem")[0]!;
      const check = kids(item.id).find(
        (part) =>
          root.typeOf(part) === "Icon" && part.props.iconName === "check",
      )!;
      expect(check.hidden, size).toBeFalsy();
      // (The glyph every consumer draws — the Canvas icon paint, the layout input, the DOM binding.)
      expect(catalogGlyphSize(check), size).toBe(px);
      expect(box(check.id).width, size).toBe(px);
      const done = await render(of("Select")[0]!.id);
      // (The glyph is the wrapper's font size — its svg is `1em`, `Icon.tsx`.)
      const glyph = document.querySelector<HTMLElement>(
        '.react-aria-ListBoxItem .react-aria-Icon[slot="selection"]',
      );
      // (A value equal to the Icon's own step token stays that token — its device variable; its
      //  desktop value is the px.)
      const desktop = (css: string | undefined) => {
        const token = /^var\(--catalog-token-size-icon-(\w+)\)$/.exec(css ?? "");
        return token
          ? Number(resolveToken(`{size.icon.${token[1]}}` as TokenRef))
          : Number.parseFloat(css ?? "");
      };
      expect(
        [desktop(glyph?.style.fontSize), desktop(glyph?.style.width)],
        size,
      ).toEqual([px, px]);
      await done();
    }
  });

  it("a Menu's check mark keeps its 16 (the size steps are the ListBox item's)", async () => {
    const { of, root, kids } = await open({ isOpen: true, size: "XL" }, "Menu");
    const item = of("MenuItem")[0]!;
    const check = kids(item.id).find(
      (part) => root.typeOf(part) === "Icon" && part.props.iconName === "check",
    );
    expect(check?.visual).toMatchObject({ width: 16, height: 16 });
  });

  it("the item's icon takes the item's color — on-accent when selected (Canvas · DOM, S2 `icon` currentColor)", async () => {
    const first = await open({ selectionMode: "single" });
    const key = first.of("ListBoxItem")[0]!.props.id as string;
    const { root, of, kids, render } = await open({
      selectionMode: "single",
      defaultSelectedKeys: [key],
    });
    const iconOf = (item: { id: string }) =>
      kids(item.id).find(
        (part) => root.typeOf(part) === "Icon" && part.props.slot === "icon",
      )!;
    const [selected, ...rest] = of("ListBoxItem");
    expect(iconOf(selected!).derivedProps?.color).toBe(
      color("{color.on-accent}"),
    );
    for (const item of rest)
      expect(iconOf(item).derivedProps?.color).toBe(color("{color.neutral}"));
    // The DOM glyph inherits the item's color (the sheet's selected item is on-accent) — no resting
    // color inline.
    const done = await render(of("ListBox")[0]!.id);
    const glyphs = [
      ...document.querySelectorAll<HTMLElement>(
        '.react-aria-ListBoxItem .react-aria-Icon[slot="icon"]',
      ),
    ];
    expect(glyphs.length).toBe(3);
    for (const glyph of glyphs) expect(glyph.style.color).toBe("inherit");
    await done();
  });

  it("a picker's check mark is accent (Canvas · DOM, S2 `checkmark` baseColor('accent'))", async () => {
    const probe = await open({ isOpen: true }, "Select");
    const key = probe.of("ListBoxItem")[0]!.props.id as string;
    const { root, of, kids, render } = await open(
      { isOpen: true, value: key },
      "Select",
    );
    const check = kids(of("ListBoxItem")[0]!.id).find(
      (part) => root.typeOf(part) === "Icon" && part.props.iconName === "check",
    )!;
    const accent = color("{color.accent}").toLowerCase();
    const drawn = String(check.derivedProps?.color ?? check.visual.color);
    expect(drawn.toLowerCase().startsWith(accent.slice(0, 7))).toBe(true);
    const done = await render(of("Select")[0]!.id);
    const glyph = document.querySelector<HTMLElement>(
      '.react-aria-ListBoxItem .react-aria-Icon[slot="selection"]',
    );
    // (A template's token goes inline as its value in the root's mode — `catalogNodeTokenCss` turns
    //  only the document's own tokens into variables.)
    const rgb = (hex: string) =>
      `rgb(${[1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16)).join(", ")})`;
    expect(glyph?.style.color).toBe(rgb(accent));
    await done();
  });
});
