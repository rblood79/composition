// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  AuthoredValue,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogLinkOutGlyph } from "../../../../../../packages/shared/src/catalog/document/itemLinks";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { catalogRuleShapes } from "../ruleShapes";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 정렬 — 선택 부품 묶음 (2026-11-18, 사용자 「노드로 늘 둠」 · 「이번에 넣음」): S2 ListView ·
 * TableView · CardView draw an item's selection Checkbox for `selectionMode !== 'none'` and the
 * `checkbox` style. Here the origin holds it as a node (as the Tree's · ListBox's) and both
 * consumers hide it otherwise; a ListView item's `hasChildItems` draws S2's chevron at its end.
 */
const BODY = "project:node:home-body" as NodeId;
const ROOT = "project:node:root" as NodeId;
const set = <T,>(value: T) => ({ kind: "set" as const, value });

async function open(paletteType: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-selection" as EntryId<"project">,
        name: "S2 selection parts",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-selection-${Math.random()}`),
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
          props: {},
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
  const edit = (recordId: string, props: Record<string, AuthoredValue>) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(recordId)!.target],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [key, set(value)]),
        ),
      }),
    );
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
      },
    };
  };
  return { workspace, root, of, edit, render };
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

const MODES = [
  // [selectionMode, selectionStyle, shown] — S2 `selectionMode !== 'none' && selectionBehavior === 'toggle'`
  ["none", "checkbox", false],
  ["single", "checkbox", true],
  ["multiple", "checkbox", true],
  ["multiple", "highlight", false],
] as const;

describe("S2 ListView (GridList) — the item's selection Checkbox", () => {
  it("is a node of every item, there only while the GridList selects with checkboxes (Canvas = DOM)", async () => {
    const { root, of, edit, render } = await open("GridList");
    const owner = of("GridList")[0]!;
    const items = of("GridListItem");
    expect(items.length).toBeGreaterThan(0);
    const checkboxes = () =>
      of("Checkbox").filter(
        (record) =>
          record.props.slot === "selection" &&
          root.typeOf(root.canvasInputs.get(record.parentId)!) ===
            "GridListItem",
      );
    // Every item of the origin carries one (its first child — S2's `checkmark` column).
    expect(checkboxes()).toHaveLength(items.length);
    for (const [mode, style, shown] of MODES) {
      const name = `${mode} · ${style}`;
      // (Edited from another value — the incremental step re-judges the items' parts.)
      edit(owner.id, { selectionMode: mode, selectionStyle: style });
      expect(
        checkboxes().map((record) => record.hidden === true),
        name,
      ).toEqual(items.map(() => !shown));
      const { host, done } = await render(owner.id);
      expect(
        host.querySelectorAll('[role="row"] [slot="selection"]').length,
        name,
      ).toBe(shown ? items.length : 0);
      await done();
    }
  });
});

describe("S2 ListView (GridList) — hasChildItems draws the chevron", () => {
  it("at the item's end in both consumers, and a new-tab link draws none (S2 `hasChildItems && !isLinkOut`)", async () => {
    const { workspace, root, of, edit, render } = await open("GridList");
    const owner = of("GridList")[0]!;
    const item = of("GridListItem")[0]!;
    const before = root.getGeometry([item.id]).get(item.id)!;
    const chevrons = async () => {
      const record = root.canvasInputs.get(item.id)!;
      const box = root.getGeometry([item.id]).get(item.id)!;
      const canvas = catalogRuleShapes({
        node: record,
        rect: { width: box.width, height: box.height },
        rule: workspace.runtime.graph.library.rules.get(
          "GridListItem" as never,
        )!,
        type: "GridListItem",
        authoredVisual: {},
      })
        .filter((shape) => shape.type === "icon_font")
        .map((shape) => (shape as { iconName?: string }).iconName);
      const { host, done } = await render(owner.id);
      const el = host.querySelector(`[data-catalog-id="${item.id}"]`)!;
      const dom = el.querySelectorAll(
        ":scope > .link-out svg, :scope > [role=gridcell] > .link-out svg",
      ).length;
      await done();
      return { canvas, dom, width: box.width };
    };
    expect(await chevrons()).toEqual({
      canvas: [],
      dom: 0,
      width: before.width,
    });
    edit(item.id, { hasChildItems: true });
    expect(await chevrons()).toEqual({
      canvas: ["chevron-right"],
      dom: 1,
      width: before.width,
    });
    // The label stops before the glyph (the end padding grew by the glyph and its gap).
    const glyph = catalogLinkOutGlyph("GridListItem", "M");
    const label = of("Text").find((text) => text.parentId === item.id)!;
    const labelBox = root.getGeometry([label.id]).get(label.id)!;
    expect(labelBox.x + labelBox.width).toBeLessThanOrEqual(
      before.width - 12 - glyph.size - glyph.gap + 0.5,
    );
    // A new-tab link: the link-out glyph wins, hidden or not.
    edit(item.id, { href: "https://x.test", target: "_blank" });
    expect((await chevrons()).canvas).toEqual(["external-link"]);
    edit(owner.id, { hideLinkOutIcon: true });
    expect(await chevrons()).toMatchObject({ canvas: [], dom: 0 });
  });
});

describe("S2 TableView — the selection column", () => {
  const TABLE_MODES = [
    // [selectionMode, selectionStyle, column shown, select-all shown] — S2 adds the column for
    // `selectionMode !== 'none'` + checkbox, its header Checkbox for `multiple` only.
    ["none", "checkbox", false, false],
    ["single", "checkbox", true, false],
    ["multiple", "checkbox", true, true],
    ["multiple", "highlight", false, false],
  ] as const;

  it("the origin's selection Column · Cell are there only while the Table selects with checkboxes (Canvas = DOM)", async () => {
    const { root, of, edit, render } = await open("Table");
    const table = of("Table")[0]!;
    const selection = (type: "Column" | "Cell") =>
      of(type).filter((part) =>
        of("Checkbox").some(
          (box) => box.parentId === part.id && box.props.slot === "selection",
        ),
      );
    expect(selection("Column")).toHaveLength(1);
    expect(selection("Cell")).toHaveLength(of("Row").length);
    const headerBox = () =>
      of("Checkbox").find(
        (box) => box.parentId === selection("Column")[0]!.id,
      )!;
    for (const [mode, style, shown, selectAll] of TABLE_MODES) {
      const name = `${mode} · ${style}`;
      edit(table.id, { selectionMode: mode, selectionStyle: style });
      expect(
        [...selection("Column"), ...selection("Cell")].map(
          (part) => part.hidden === true,
        ),
        name,
      ).toEqual(
        [...selection("Column"), ...selection("Cell")].map(() => !shown),
      );
      expect(headerBox().hidden === true, name).toBe(!selectAll);
      const tracks = String(
        root.canvasInputs.get(of("Row")[0]!.id)!.derivedProps?._tableTracks,
      );
      expect(tracks.startsWith("40px "), name).toBe(shown);
      const { host, done } = await render(table.id);
      expect(
        host.querySelectorAll('tbody [role="row"] [slot="selection"]').length,
        name,
      ).toBe(shown ? of("Row").length : 0);
      expect(
        host.querySelectorAll('thead [slot="selection"]').length,
        name,
      ).toBe(selectAll ? 1 : 0);
      await done();
    }
  });
});

describe("S2 CardView — CardCheckbox · SelectionIndicator", () => {
  it("each Card's selection Checkbox is there only while the CardView selects with checkboxes, at the card's spacing (Canvas = DOM)", async () => {
    const { root, of, edit, render } = await open("CardView");
    const view = of("CardView")[0]!;
    const cards = of("Card");
    expect(cards.length).toBeGreaterThan(0);
    // (S2 `CardCheckbox`: a plate `frame` in the Card around the selection Checkbox)
    const plates = () =>
      of("frame").filter(
        (frame) =>
          root.typeOf(root.canvasInputs.get(frame.parentId)!) === "Card",
      );
    const checkboxes = () =>
      of("Checkbox").filter(
        (box) =>
          box.props.slot === "selection" &&
          plates().some((plate) => plate.id === box.parentId),
      );
    expect(checkboxes()).toHaveLength(cards.length);
    for (const [mode, style, shown] of MODES) {
      const name = `${mode} · ${style}`;
      edit(view.id, { selectionMode: mode, selectionStyle: style });
      expect(
        [...checkboxes(), ...plates()].map((box) => box.hidden === true),
        name,
      ).toEqual([...cards, ...cards].map(() => !shown));
      const { host, done } = await render(view.id);
      expect(
        host.querySelectorAll('[role="row"] [slot="selection"]').length,
        name,
      ).toBe(shown ? cards.length : 0);
      await done();
    }
    // S2 `CardCheckbox`: top · start = the card's spacing (its padding at its size — M 16).
    edit(view.id, { selectionMode: "multiple", selectionStyle: "checkbox" });
    const box = plates()[0]!;
    expect(box.fillLayout).toMatchObject({
      insetTop: "16px",
      insetLeft: "16px",
    });
    const card = root.canvasInputs.get(box.parentId)!;
    const cardBox = root.getGeometry([card.id]).get(card.id)!;
    const placed = root.getGeometry([box.id]).get(box.id)!;
    // (inside the card's border — the absolute box's insets are from its padding box)
    const border = Number(card.visual.borderWidth ?? 0);
    expect([placed.x, placed.y]).toEqual([16 + border, 16 + border]);
    expect(placed.x + placed.width).toBeLessThan(cardBox.width);
    // The Checkbox sits in its plate's 4px padding (S2 `padding: 4`), its own fill its own: a
    // selected card's box is drawn checked (the plate's backdrop is the frame's, not the Checkbox's).
    const inner = checkboxes()[0]!;
    const innerBox = root.getGeometry([inner.id]).get(inner.id)!;
    expect([innerBox.x, innerBox.y]).toEqual([4, 4]);
    expect(inner.visual.backgroundColor).toBeUndefined();
  });

  it("a selected Card keeps its fill and border (S2) — its SelectionIndicator covers it (Canvas = DOM)", async () => {
    const { root, of, edit, render, workspace } = await open("CardView");
    const view = of("CardView")[0]!;
    edit(view.id, { selectionMode: "multiple" });
    const card = of("Card")[0]!;
    const indicator = () =>
      of("SelectionIndicator").find((node) => node.parentId === card.id)!;
    expect(indicator().hidden).toBe(true);
    const restFill = root.canvasInputs.get(card.id)!.visual.backgroundColor;
    edit(view.id, { defaultSelectedKeys: [String(card.props.id)] });
    expect(indicator().hidden).toBeUndefined();
    // (no accent fill or border — the rule's paint has no selected branch but the tertiary border's
    // going: S2 `Card.tsx` changes only the shadow)
    const paint = COMPONENT_RULES_TABLE.Card.variants;
    for (const [variant, { paint: tree }] of Object.entries(paint))
      for (const [key, branches] of Object.entries(
        tree as Record<string, Record<string, unknown>>,
      ))
        expect(branches.isSelected, `${variant}.${key}`).toEqual(
          variant === "tertiary" && key === "borderColor"
            ? { default: "{color.transparent}" }
            : undefined,
        );
    const selected = root.canvasInputs.get(card.id)!;
    expect(selected.visual.backgroundColor).toEqual(restFill);
    expect(String(selected.visual.borderColor ?? "")).not.toMatch(/accent/);
    // The indicator covers the card: its box, a 2px border, above the preview.
    const cardBox = root.getGeometry([card.id]).get(card.id)!;
    const box = root.getGeometry([indicator().id]).get(indicator().id)!;
    // (its padding box — inside the card's border, as an absolute box's insets are)
    const border = Number(selected.visual.borderWidth ?? 0);
    expect([box.x, box.y, box.width, box.height]).toEqual([
      border,
      border,
      cardBox.width - 2 * border,
      cardBox.height - 2 * border,
    ]);
    expect(indicator().visual).toMatchObject({ borderWidth: 2, zIndex: 2 });
    const { host, done } = await render(view.id);
    const dom = host.querySelector<HTMLElement>(
      `[data-catalog-id="${indicator().id}"]`,
    );
    expect(dom).not.toBeNull();
    expect(dom!.style.pointerEvents).toBe("none");
    await done();
    void workspace;
  });
});
