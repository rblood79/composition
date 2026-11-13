// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
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
import { catalogBoxModel } from "../boxModel";
import { CatalogCanvasGestures } from "../canvasGesture";
import { pickTopmostRecord } from "../canvasPick";
import { CatalogCanvasScene } from "../canvasScene";
import { renderCatalogDom } from "../domBinding";
import { catalogSubpartOwnerType } from "../subpart";
import {
  catalogDrawnFieldBoxVisual,
  catalogDrawnBoxDelta,
  catalogDrawnBoxModel,
} from "../drawnBoxModel";
import { catalogEffectiveStyle } from "../effectiveStyle";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * The drawn box model (2026-11-13, 사용자 「hover 한 gap · padding 손잡이가 0 — 전체적인 버그」):
 * the Styles panel and the Canvas spacing handles read the box the layout draws, for every record
 * — a part rule's border, a group's items gap, a frame's gap longhand — and a page body keeps its
 * own padding (its layout input is split into viewport · content boxes; the drawn style is the
 * whole one).
 */
const BODY = "project:node:home-body" as NodeId;
const NODE = "project:node:drawn" as NodeId;
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(origin: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:drawn-box" as EntryId<"project">,
        name: "Drawn box",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `drawn-box-${Math.random()}`),
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
          id: NODE,
          definitionId: `lib:definition:origin-component-${origin}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [NODE],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  return workspace;
}

function gesturesOf(workspace: CatalogWorkspace) {
  const scene = new CatalogCanvasScene(workspace.root);
  return new CatalogCanvasGestures({
    get records() {
      return workspace.root.domInputs;
    },
    graph: workspace.runtime.graph,
    bounds: (record) => scene.stream.boundsMap.get(record),
    pick: (x, y) =>
      pickTopmostRecord(scene.stream, x, y, scene.stream.hitBoundsMap.keys()),
    selection: () => workspace.session.getSnapshot().selection,
    itemOfRecord: (record) => workspace.itemOfRecord(record),
    editingContext: () => workspace.session.getSnapshot().editingContext,
    selectRecords: (ids, options) => workspace.selectRecords(ids, options),
    breakpoint: () => workspace.session.getSnapshot().breakpoint,
    execute: (command) => {
      workspace.execute(command);
      scene.sync();
    },
    newId: workspace.newId,
    guideLines: () => ({ x: [], y: [] }),
    reflow: () => {},
  });
}

const recordOf = (workspace: CatalogWorkspace, type: string) =>
  [...workspace.root.domInputs.values()].find(
    (record) => workspace.root.typeOf(record) === type,
  )!;

describe("catalogDrawnBoxModel — the box the layout draws", () => {
  it("reads a part rule's border the record does not hold (Disclosure 1px)", async () => {
    const workspace = await open("disclosure");
    const disclosure = recordOf(workspace, "Disclosure");
    expect(catalogBoxModel(disclosure).borderWidth ?? 0).toBe(0);
    expect(catalogDrawnBoxModel(workspace.root, disclosure).borderWidth).toBe(
      1,
    );
  });

  it("reads a group's items gap from its rule (CheckboxItems 12)", async () => {
    const workspace = await open("checkboxgroup");
    const items = recordOf(workspace, "CheckboxItems");
    expect(catalogDrawnBoxModel(workspace.root, items).gap).toBe(12);
  });

  it("keeps a page body's own box — padding · display · gap — not its viewport box's (block, 0)", async () => {
    const workspace = await open("checkbox");
    act(() => {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: BODY }],
          visual: {
            paddingTop: { kind: "set", value: 24 },
            paddingLeft: { kind: "set", value: 24 },
            gap: { kind: "set", value: 20 },
          },
          layout: {
            display: { kind: "set", value: "flex" },
            flexDirection: { kind: "set", value: "column" },
          },
        }),
      );
    });
    const body = workspace.root.domInputs.get(workspace.root.recordsOfSource(BODY)[0]!)!;
    const drawn = catalogDrawnBoxModel(workspace.root, body);
    const own = catalogBoxModel(body);
    expect([drawn.padding?.top, drawn.padding?.left]).toEqual([24, 24]);
    expect([drawn.display, drawn.flexDirection, drawn.gap]).toEqual([
      "flex",
      "column",
      20,
    ]);
    expect(drawn.padding).toEqual({
      top: own.padding?.top ?? 0,
      right: own.padding?.right ?? 0,
      bottom: own.padding?.bottom ?? 0,
      left: own.padding?.left ?? 0,
    });
  });

  it("is undefined where nothing differs from the record's own", async () => {
    const workspace = await open("checkbox");
    const checkbox = workspace.root.domInputs.get(workspace.root.recordsOfSource(NODE)[0]!)!;
    expect(catalogDrawnBoxDelta(workspace.root, checkbox)).toBeUndefined();
  });
});

/**
 * Phase 2 (2026-11-13): a placement the Canvas lays over a record from its sheet — a Tree chevron's
 * level indent (`Tree.css`), a ListBox item's icon inset (`ListBox.css` `:has([slot=icon])`) — is a
 * default; the DOM inlines what the author wrote over it, so the Canvas layout takes it too.
 */
describe("a sheet placement yields to the authored value", () => {
  const writePaddingLeft = (workspace: CatalogWorkspace, id: string) => {
    workspace.selectRecords([id]);
    const target = workspace.session.getSnapshot().selection[0]!.target;
    act(() => {
      workspace.execute(
        setFields({
          targets: [target],
          visual: { paddingLeft: { kind: "set", value: 30 } },
        }),
      );
    });
  };
  const inputOf = (workspace: CatalogWorkspace, id: string) =>
    workspace.root.getLayoutInput(id) as Record<string, unknown>;

  it("a Tree chevron's start padding", async () => {
    const workspace = await open("tree");
    const chevron = [...workspace.root.domInputs.values()].find(
      (record) =>
        workspace.root.typeOf(record) === "Button" &&
        record.props.slot === "chevron",
    )!;
    expect(inputOf(workspace, chevron.id).paddingLeft).not.toBe("30px");
    writePaddingLeft(workspace, chevron.id);
    expect(inputOf(workspace, chevron.id).paddingLeft).toBe("30px");
  });

  it("a ListBox item's icon inset", async () => {
    const workspace = await open("listbox");
    const item = [...workspace.root.domInputs.values()].find(
      (record) =>
        workspace.root.typeOf(record) === "ListBoxItem" &&
        inputOf(workspace, record.id).paddingLeft === "34px",
    )!;
    writePaddingLeft(workspace, item.id);
    expect(inputOf(workspace, item.id).paddingLeft).toBe("30px");
  });
});

/**
 * 2026-11-13 (사용자 「ComboBox · DatePicker 의 Group Layout 탭 사용 안 됨」): a field's control Group
 * is its own style's owner — the Styles panel edits it, the Canvas lays the write, the DOM inlines it.
 */
describe("a field's control Group is edited directly", () => {
  it.each(["combobox", "datepicker"])("%s", async (origin) => {
    const workspace = await open(origin);
    const root = workspace.root;
    const field = root.recordsOfSource(NODE)[0]!;
    const group = [...root.domInputs.values()].find(
      (record) => record.parentId === field && root.typeOf(record) === "Group",
    )!;
    expect(
      catalogSubpartOwnerType(
        workspace.runtime.graph,
        root.domInputs,
        group.id,
        "style",
      ),
    ).toBeNull();
    workspace.selectRecords([group.id]);
    const target = workspace.session.getSnapshot().selection[0]!.target;
    act(() => {
      workspace.execute(
        setFields({
          targets: [target],
          visual: { paddingLeft: { kind: "set", value: 30 } },
        }),
      );
    });
    const input = workspace.root.getLayoutInput(group.id) as Record<
      string,
      unknown
    >;
    expect(input.paddingLeft).toBe("30px");
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      renderCatalogDom(workspace.root, field),
    );
    const box = host.querySelector(
      `[data-catalog-id="${group.id}"]`,
    ) as HTMLElement;
    expect(box.getAttribute("style") ?? "").toMatch(/padding-left:\s*30px/);
  });
});

/**
 * 2026-11-13 (사용자 「select 의 button 은 Layout 탭 값은 반영되지만 overlay 가 없다」): the Canvas
 * spacing handles show on any selected box that lays children out — a Select's trigger Button — not
 * only on the structural containers (ADR-222's first scope).
 */
describe("spacing handles on a box with children", () => {
  it("a Select's trigger Button", async () => {
    const workspace = await open("select");
    const gestures = gesturesOf(workspace);
    const root = workspace.root;
    const field = root.recordsOfSource(NODE)[0]!;
    const trigger = [...root.domInputs.values()].find(
      (record) => record.parentId === field && root.typeOf(record) === "Button",
    )!;
    workspace.selectRecords([trigger.id]);
    expect(gestures.spacingOwner()?.id).toBe(trigger.id);
    const bands = gestures.spacingBands();
    expect(bands.filter((band) => band.kind === "padding")).toHaveLength(4);
  });
});

/**
 * 2026-11-13 전수 감사 (사용자 「동일한 문제가 다른 컴포넌트에서도」): a part the Styles panel edits
 * takes the write on both consumers — the Canvas layout input and the DOM element's inline style.
 */
describe("an editable part's write reaches both consumers", () => {
  it.each([
    ["checkboxgroup", "CheckboxItems"],
    ["radiogroup", "RadioItems"],
  ])("%s › %s", async (origin, type) => {
    const workspace = await open(origin);
    const root = workspace.root;
    const part = [...root.domInputs.values()].find(
      (record) => root.typeOf(record) === type,
    )!;
    workspace.selectRecords([part.id]);
    const target = workspace.session.getSnapshot().selection[0]!.target;
    act(() => {
      workspace.execute(
        setFields({
          targets: [target],
          visual: { paddingLeft: { kind: "set", value: 30 } },
        }),
      );
    });
    expect(
      (root.getLayoutInput(part.id) as Record<string, unknown>).paddingLeft,
    ).toBe("30px");
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      renderCatalogDom(workspace.root, workspace.root.recordsOfSource(NODE)[0]!),
    );
    const element = host.querySelector(
      `[data-catalog-id="${part.id}"]`,
    ) as HTMLElement;
    expect(element.getAttribute("style") ?? "").toMatch(
      /padding-left:\s*30px/,
    );
    // (Only the write — the group sheet's orientation box stays the sheet's.)
    expect(element.getAttribute("style") ?? "").not.toMatch(/flex-direction/);
  });
});

/**
 * 2026-11-13 전수 감사 — the handles and the panel read one "has a box" predicate: a node with no
 * element of its own (a trigger · `TreeItemContent`) gets no spacing handles; a Gap handle's write
 * drops the main-axis longhand the panel wrote (it beat `visual.gap` in the layout); the room the
 * Canvas adds for a part it draws (a link-out glyph) is not the record's padding.
 */
describe("handles and drawn values after the audit", () => {
  it("no spacing handles on a node with no element (TreeItemContent)", async () => {
    const workspace = await open("tree");
    const gestures = gesturesOf(workspace);
    const content = recordOf(workspace, "TreeItemContent");
    workspace.selectRecords([content.id]);
    expect(gestures.spacingOwner()).toBeUndefined();
  });

  it("a Gap handle's value drops the authored main-axis longhand", async () => {
    const workspace = await open("select");
    const gestures = gesturesOf(workspace);
    const root = workspace.root;
    const field = root.recordsOfSource(NODE)[0]!;
    const trigger = [...root.domInputs.values()].find(
      (record) => record.parentId === field && root.typeOf(record) === "Button",
    )!;
    workspace.selectRecords([trigger.id]);
    const target = workspace.session.getSnapshot().selection[0]!.target;
    act(() => {
      workspace.execute(
        setFields({
          targets: [target],
          layout: { columnGap: { kind: "set", value: "20px" } },
        }),
      );
    });
    expect(
      (root.getLayoutInput(trigger.id) as Record<string, unknown>).columnGap,
    ).toBe("20px");
    const gap = gestures.spacingBands().find((band) => band.kind === "gap")!;
    const [x, y] = [
      gap.rect.x + gap.rect.width / 2,
      gap.rect.y + gap.rect.height / 2,
    ];
    gestures.beginSpacing(x, y, 1);
    gestures.finish();
    const click = gestures.takeSpacingClick()!;
    act(() => {
      workspace.execute(gestures.spacingValueCommand(click, 8)!);
    });
    expect(
      (workspace.root.getLayoutInput(trigger.id) as Record<string, unknown>)
        .columnGap,
    ).toBe("8px");
  });

  it("a link-out item's glyph room is not its padding", async () => {
    const workspace = await open("menu");
    const item = recordOf(workspace, "MenuItem");
    workspace.selectRecords([item.id]);
    const target = workspace.session.getSnapshot().selection[0]!.target;
    act(() => {
      workspace.execute(
        setFields({
          targets: [target],
          props: {
            href: { kind: "set", value: "https://example.com" },
            target: { kind: "set", value: "_blank" },
          },
        }),
      );
    });
    const root = workspace.root;
    const drawn = (root.getLayoutInput(item.id) as Record<string, unknown>)
      .paddingRight;
    const record = root.domInputs.get(item.id)!;
    const own = catalogBoxModel(record).padding?.right ?? 0;
    // (The layout gives the glyph its room; the panel's value stays the item's own.)
    expect(Number.parseFloat(String(drawn))).toBeGreaterThan(Number(own));
    expect(catalogDrawnBoxModel(root, record).padding?.right).toBe(own);
  });
});

/**
 * 2026-11-13 (사용자 「DateRangePicker 의 Group 안 Button 에 margin-inline-start · margin-left — margin 은
 * 쓰지 않기로 했다」): S2's `text-to-control` room before the button is the end input's end padding
 * (a layout value of an object), not the button's margin — on the Canvas layout and the DOM inline.
 */
describe("DateRangePicker — no margin on the button", () => {
  it("no margin: the box's gap is the room before the button (the end DateInput has no end padding)", async () => {
    const workspace = await open("daterangepicker");
    const root = workspace.root;
    const end = [...root.domInputs.values()].find(
      (record) =>
        root.typeOf(record) === "DateInput" && record.props.slot === "end",
    )!;
    const button = [...root.domInputs.values()].find(
      (record) =>
        root.typeOf(record) === "Button" &&
        root.typeOf(root.domInputs.get(record.parentId)!) === "Group",
    )!;
    const input = (id: string) =>
      root.getLayoutInput(id) as Record<string, unknown>;
    // (2026-11-14 — as a DatePicker's: the input has no end padding, the box's gap is the room before
    //  the button and the end input fills the row up to it.)
    expect([input(end.id).paddingLeft, input(end.id).paddingRight]).toEqual([
      "0px",
      "0px",
    ]);
    expect(Number.parseFloat(String(input(button.id).marginLeft ?? "0"))).toBe(
      0,
    );
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      renderCatalogDom(workspace.root, root.recordsOfSource(NODE)[0]!),
    );
    const style = (id: string) =>
      (host.querySelector(`[data-catalog-id="${id}"]`) as HTMLElement)
        ?.getAttribute("style") ?? "";
    // (Inline margins are the reset's zeros — none holds the room, no `margin-inline-start`.)
    expect(style(button.id)).not.toMatch(/margin-inline|margin-left:\s*[^0]/);
    // (The DOM lays the same end padding: 0.)
    expect(style(end.id)).toMatch(/padding-right:\s*0(px)?(;|$)/);
  });
});

/**
 * 2026-11-13 (사용자 「ComboBox 는 NumberField 처럼 S2 구조로 (margin 제외), DatePicker 는 DateRangePicker
 * 에서 구분 글자 · 둘째 DateInput 만 뺀 것」): the control Group is the S2 `FieldGroup` box and the
 * button sits inside it after the value — no margin on either consumer; the value's end padding is
 * S2's `text-to-control` room.
 */
describe("ComboBox · DatePicker — S2 box, no margin on the button", () => {
  const dom = (workspace: CatalogWorkspace) => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      renderCatalogDom(workspace.root, workspace.root.recordsOfSource(NODE)[0]!),
    );
    return (id: string) =>
      host.querySelector(`[data-catalog-id="${id}"]`) as HTMLElement | null;
  };
  const groupButton = (workspace: CatalogWorkspace) =>
    [...workspace.root.domInputs.values()].find(
      (record) =>
        workspace.root.typeOf(record) === "Button" &&
        workspace.root.typeOf(workspace.root.domInputs.get(record.parentId)!) ===
          "Group",
    )!;

  for (const [origin, valueType, end] of [
    ["combobox", "Input", "0px"],
    ["datepicker", "DateInput", "0px"],
  ] as const)
    it(`${origin}: the Group is the box; the button follows the value with no margin`, async () => {
      const workspace = await open(origin);
      const root = workspace.root;
      const group = recordOf(workspace, "Group");
      const value = recordOf(workspace, valueType);
      const button = groupButton(workspace);
      const rect = (id: string) => root.getGeometry([id]).get(id)!;
      const input = (id: string) =>
        root.getLayoutInput(id) as Record<string, unknown>;
      // Canvas: the box (border 2 · `edge-to-text` 12) holds the value with its box laid down, then the
      // button square, then the box's end padding (md 4).
      expect(rect(group.id).height).toBe(32);
      expect(input(value.id)).toMatchObject({
        paddingLeft: "0px",
        paddingRight: end,
      });
      expect(Number.parseFloat(String(input(button.id).marginLeft ?? "0"))).toBe(
        0,
      );
      expect(rect(group.id).width - (rect(button.id).x + rect(button.id).width)).toBe(
        2 + 4,
      );
      // DOM: the Input rule's sheet draws the Group (`FieldBox`), no inline margin holds the room.
      const element = dom(workspace);
      expect(element(group.id)?.className).toContain("react-aria-FieldBox");
      expect(element(button.id)?.getAttribute("style") ?? "").not.toMatch(
        /margin-inline|margin-left:\s*[^0]/,
      );
    });

  // (사용자 2026-11-13 「numberfield-group-input 의 padding-right 제거」: the box's gap is the room.)
  it("numberfield: the Input has no end padding — the box's gap (md 4) before the decrement", async () => {
    const workspace = await open("numberfield");
    const root = workspace.root;
    const value = recordOf(workspace, "Input");
    const decrement = groupButton(workspace);
    const rect = (id: string) => root.getGeometry([id]).get(id)!;
    expect(root.getLayoutInput(value.id)).toMatchObject({
      paddingRight: "0px",
    });
    expect(rect(decrement.id).x).toBe(
      rect(value.id).x + rect(value.id).width + 4,
    );
    const element = dom(workspace)(value.id);
    expect(element?.style.paddingRight).toBe("0px");
  });

  it("datepicker quiet: the Group shows the quiet state, the DateInput lays its box down", async () => {
    const workspace = await open("datepicker");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: NODE }],
        props: { isQuiet: { kind: "set", value: true } },
      }),
    );
    const root = workspace.root;
    const group = recordOf(workspace, "Group");
    const value = recordOf(workspace, "DateInput");
    expect(root.canvasInputs.get(group.id)!.derivedProps?.isQuiet).toBe(true);
    expect(root.canvasInputs.get(value.id)!.derivedProps?.isQuiet).not.toBe(
      true,
    );
    expect(dom(workspace)(group.id)?.getAttribute("data-quiet")).toBe("true");
  });
});

/**
 * 2026-11-13 (사용자 「SearchField 는 NumberField 처럼 S2 구조로 — margin 제외」): S2 SearchField is
 * `Label + FieldGroup(SearchIcon + Input + ClearButton)` — the Group is the pill box, its parts sit in it
 * with no margin: the box's start padding is `pill` less the glyph's `fontRelative(-2)`, the Input's start
 * padding `text-to-visual`, the clear button the control height wide at the box's end.
 */
describe("SearchField — S2 box, no margins", () => {
  it("the Group holds the glyph · Input · clear button in a row, gap 8 (M: 2 + 12 + 18 + 8 = text at 40)", async () => {
    const workspace = await open("searchfield");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: NODE }],
        props: { value: { kind: "set", value: "abc" } },
      }),
    );
    const root = workspace.root;
    const group = recordOf(workspace, "Group");
    const kids = group.children.map((id) => root.domInputs.get(id)!);
    expect(kids.map((kid) => root.typeOf(kid))).toEqual([
      "Icon",
      "Input",
      "Button",
    ]);
    const [glyph, value, clear] = kids as [
      (typeof kids)[0],
      (typeof kids)[0],
      (typeof kids)[0],
    ];
    const rect = (id: string) => root.getGeometry([id]).get(id)!;
    const input = (id: string) =>
      root.getLayoutInput(id) as Record<string, unknown>;
    expect(rect(group.id).height).toBe(32);
    expect(input(group.id)).toMatchObject({
      paddingLeft: "12px",
      paddingRight: "12px",
    });
    expect(rect(glyph.id)).toMatchObject({ x: 14, width: 18 });
    expect(input(value.id)).toMatchObject({
      paddingLeft: "0px",
      paddingRight: "0px",
    });
    expect(rect(value.id).x).toBe(40);
    expect(rect(clear.id).x).toBe(rect(value.id).x + rect(value.id).width + 8);
    // One cross glyph: the Button origin's own `{icon}` position, filled by the clear button's `icon`
    // (사용자 2026-11-13 「searchField-group-button 안에 icon 이 두 개」 — not a second Icon child).
    const icons = clear.children
      .map((id) => root.domInputs.get(id)!)
      .filter((child) => root.typeOf(child) === "Icon");
    expect(icons.map((icon) => icon.props.iconName)).toEqual(["s2-cross"]);
    expect(rect(clear.id)).toMatchObject({ width: 32, height: 28 });
    // (The box's end padding 12 — 사용자 2026-11-13 「searchfield-group 에 padding-right 12」 — then the border.)
    expect(rect(clear.id).x + 32).toBe(rect(group.id).width - 2 - 12);
    for (const part of [glyph, value, clear])
      expect(
        Number.parseFloat(String(input(part.id).marginLeft ?? "0")),
      ).toBe(0);
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      renderCatalogDom(workspace.root, root.recordsOfSource(NODE)[0]!),
    );
    const element = (id: string) =>
      host.querySelector(`[data-catalog-id="${id}"]`) as HTMLElement | null;
    expect(element(group.id)?.className).toContain("react-aria-FieldBox");
    for (const part of [glyph, value, clear])
      expect(element(part.id)?.getAttribute("style") ?? "").not.toMatch(
        /margin-inline|margin-left:\s*[^0]/,
      );
    expect(element(clear.id)?.querySelectorAll(".react-aria-Icon").length).toBe(1);
  });
});

describe("field button glyphs — XS 12 · S 14 · M 16 · L 18 · XL 20 (사용자 2026-11-13)", () => {
  const PX: Record<string, number> = { XS: 12, S: 14, M: 16, L: 18, XL: 20 };
  for (const [origin, icon] of [
    ["numberfield", "minus"],
    ["numberfield", "plus"],
    ["combobox", "chevron-down"],
    ["select", "chevron-down"],
    ["datepicker", "calendar"],
    ["daterangepicker", "calendar"],
  ] as const)
    it(`${origin}: the ${icon} glyph on the Canvas and in the DOM`, async () => {
      for (const [size, expected] of Object.entries(PX)) {
        const workspace = await open(origin);
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: NODE }],
            props: { size: { kind: "set", value: size } },
          }),
        );
        const root = workspace.root;
        const glyph = [...root.domInputs.values()].find(
          (record) =>
            root.typeOf(record) === "Icon" && record.props.iconName === icon,
        )!;
        expect(glyph.visual).toMatchObject({ iconSize: expected });
        expect(root.getGeometry([glyph.id]).get(glyph.id)).toMatchObject({
          width: expected,
          height: expected,
        });
        const host = document.createElement("div");
        host.innerHTML = renderToStaticMarkup(
          renderCatalogDom(root, root.recordsOfSource(NODE)[0]!),
        );
        expect(
          host
            .querySelector(`[data-catalog-id="${glyph.id}"]`)
            ?.getAttribute("style"),
        ).toContain(
          // (The DOM writes the device formula — the Canvas reads the same `{length.size.unit*n/1}`.)
          `font-size:calc(var(--catalog-token-size-unit) * ${expected} / 1)`,
        );
      }
    });
});

describe("SearchField — the browser's own clear button is hidden (S2)", () => {
  it("the generated sheet hides `::-webkit-search-cancel-button` (사용자 2026-11-13 「x 가 두 개」)", () => {
    const sheet = readFileSync(
      join(
        dirname(fileURLToPath(import.meta.url)),
        "../../../../../../packages/shared/src/components/styles/generated/SearchField.css",
      ),
      "utf8",
    );
    expect(sheet).toMatch(
      /\.react-aria-SearchField \.react-aria-Input::-webkit-search-cancel-button \{\s*display: none;/,
    );
  });
});

describe("a field box's corner — the one it draws (사용자 2026-11-13 「combobox-group border-radius」)", () => {
  // The Styles panel's effective value (`catalogStylesHost` `effectiveOf`): the record with the drawn
  // corner over it.
  const panelRadius = (
    workspace: Awaited<ReturnType<typeof open>>,
    record: NodeEntry | ReturnType<typeof recordOf>,
  ) =>
    catalogEffectiveStyle({
      ...record,
      visual: {
        ...record.visual,
        ...catalogDrawnFieldBoxVisual(workspace.root, record as never),
      },
    } as never).borderRadius;
  for (const [origin, inputType, groupRadius] of [
    ["numberfield", "Input", undefined],
    ["combobox", "Input", undefined],
    ["datepicker", "DateInput", undefined],
    ["searchfield", "Input", "9999px"],
  ] as const)
    it(`${origin}: the Group shows the box's radius, the ${inputType} in it none`, async () => {
      // The Input rule's corner per size (S 7 · M 8 · XL 10) — what the box draws.
      for (const [size, radius] of [
        ["S", "7px"],
        ["M", "8px"],
        ["XL", "10px"],
      ] as const) {
        const workspace = await open(origin);
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: NODE }],
            props: { size: { kind: "set", value: size } },
          }),
        );
        expect(panelRadius(workspace, recordOf(workspace, "Group"))).toBe(
          groupRadius ?? radius,
        );
        expect(panelRadius(workspace, recordOf(workspace, inputType))).toBe(
          "0px",
        );
      }
    });
  it("an authored Group radius wins (the Canvas draws it too)", async () => {
    const workspace = await open("combobox");
    workspace.selectRecords([recordOf(workspace, "Group").id]);
    const target = workspace.session.getSnapshot().selection[0]!.target;
    act(() => {
      workspace.execute(
        setFields({
          targets: [target],
          visual: { radius: { kind: "set", value: 3 } },
        }),
      );
    });
    expect(panelRadius(workspace, recordOf(workspace, "Group"))).toBe("3px");
  });
});
