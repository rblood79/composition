/**
 * 2026-11-24 (사용자 「overlays - popover들의 padding 값들이 모두 각각 다른데 레퍼런스와 비교해봐」): each S2
 * popover's inset is the S2 component's own — the Popover's `padding` (`default` 8 · `none` 0) and
 * the box inside it:
 *
 * - Popover (`Popover.tsx:316-330`): 8 · free content.
 * - ContextualHelp (`ContextualHelp.tsx:38-41 · 59`): none · 24 (268 wide).
 * - Menu (`Menu.tsx:187-192 · 681`): none · the menu 8.
 * - Picker · ComboBox (`Picker.tsx:248 · 449`, `ComboBox.tsx:762 · 798`): none · the list 8.
 * - DatePicker's calendar (`DatePicker.tsx:296-305`): none · 24 / 16.
 *
 * The record's box (`catalogBoxModel` — the Canvas geometry and the Design panel read it) must be
 * that inset, as the DOM's sheet draws it.
 *
 * Dialogs (사용자 「dialog, alert dialog, custom dialog, fullscreen dialog, sheet … padding값이 일정하지가
 * 않다」): S2's dialog inset is 32 at every `size` (`Dialog.tsx:146-160 · 224-237`, `CustomDialog.tsx:50-57`,
 * `FullscreenDialog.tsx:92-95` — `sm` and up), the title → body 16 (header `marginBottom`), the body →
 * buttons 32 (the footer row's `paddingTop` — the gap 16 + the ButtonGroup's 16). Sheet (no S2
 * counterpart) takes the S2 Dialog's.
 */
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBoxModel } from "../../../../../../packages/shared/src/catalog/runtime/boxModel";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;

/** Places the palette `type` and returns its records. */
async function placed(type: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:s2-popover-padding" as EntryId<"project">,
        name: "S2 popover padding",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `s2-popover-padding-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const definitionId = catalogPaletteDefinitionId(
    library,
    type,
  ) as LibraryDefinitionId;
  const id = `project:node:placed-${type}` as NodeId;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id,
          definitionId,
          children: [],
          props: catalogCreationProps(
            workspace.runtime.graph,
            definitionId,
            type,
            {},
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  return { root, records: [...root.canvasInputs.values()], workspace };
}

/** `top right bottom left` of the record's box padding. */
const pad = (record: Parameters<typeof catalogBoxModel>[0]) => {
  const box = catalogBoxModel(record).padding;
  return box ? `${box.top} ${box.right} ${box.bottom} ${box.left}` : "0";
};

/** The Popover's padding and its first box's padding (`top right bottom left`). */
async function popoverInsets(type: string) {
  const { root, records } = await placed(type);
  const popover = records.find((item) => root.typeOf(item) === "Popover")!;
  const inner = records.find(
    (item) =>
      item.parentId === popover.id && root.typeOf(item) !== "OverlayArrow",
  )!;
  return { popover: pad(popover), inner: pad(inner) };
}

describe("S2 popovers — the Popover's inset and the box inside it", () => {
  it.each([
    ["Popover", { popover: "8 8 8 8", inner: "0" }],
    ["ContextualHelp", { popover: "0 0 0 0", inner: "24 24 24 24" }],
    ["ActionMenu", { popover: "0 0 0 0", inner: "8 8 8 8" }],
    ["Select", { popover: "0 0 0 0", inner: "8 8 8 8" }],
    ["ComboBox", { popover: "0 0 0 0", inner: "8 8 8 8" }],
    ["DatePicker", { popover: "0 0 0 0", inner: "24 16 24 16" }],
    ["DateRangePicker", { popover: "0 0 0 0", inner: "24 16 24 16" }],
  ])("%s", async (type, expected) => {
    expect(await popoverInsets(type)).toEqual(expected);
  });
});

describe("S2 dialogs — the dialog's inset and the title → body gap", () => {
  it.each([
    ["Dialog", "Dialog"],
    ["AlertDialog", "Dialog"],
    ["CustomDialog", "Dialog"],
    ["FullscreenDialog", "Dialog"],
    ["Sheet", "SheetContent"],
  ])("%s", async (type, body) => {
    const { root, records } = await placed(type);
    const box = records.find((item) => root.typeOf(item) === body)!;
    expect(pad(box)).toBe("32 32 32 32");
    // FullscreenDialog's header row → content is S2's grid row 32 (`gridTemplateRows` `sm`).
    expect(box.visual.gap).toBe(
      type === "FullscreenDialog" ? 32 : 16,
    );
    // Its own ButtonGroup: 16 more above (a FullscreenDialog's sits in its header row — none).
    const buttons = records.find(
      (item) =>
        item.parentId === box.id && root.typeOf(item) === "ButtonGroup",
    );
    if (["Dialog", "AlertDialog", "Sheet"].includes(type))
      expect(buttons!.layout).toMatchObject({ marginTop: "16px" });
    else expect(buttons).toBeUndefined();
  });
});

describe("S2 Dialog — `size` is the Modal's width (S 400 · M 480 · L 640 · XL 960, `Modal.tsx`)", () => {
  it("the palette Dialog is M: its Modal 480", async () => {
    const { root, records } = await placed("Dialog");
    const modal = records.find((item) => root.typeOf(item) === "Modal")!;
    expect(modal.props.size).toBe("M");
  });
});

describe("S2 FullscreenDialog's title row — a row, a column on mobile (2026-11-24 「모바일에서는 column 이 되어야 짤리지 않는다」)", () => {
  it("desktop: row · mobile: column, the buttons at the end (the library template's breakpoint layer)", async () => {
    const { workspace } = await placed("FullscreenDialog");
    const rows = () => {
      const root = workspace.root;
      const records = [...root.canvasInputs.values()];
      const dialog = records.find((item) => root.typeOf(item) === "Dialog")!;
      const header = records.find(
        (item) => item.parentId === dialog.id && root.typeOf(item) === "frame",
      )!;
      const buttons = records.find(
        (item) =>
          item.parentId === header.id && root.typeOf(item) === "ButtonGroup",
      )!;
      return { header, buttons };
    };
    expect(rows().header.layout).toMatchObject({ flexDirection: "row" });
    expect(rows().buttons.layout.alignSelf).toBeUndefined();
    workspace.setBreakpoint("mobile");
    expect(rows().header.layout).toMatchObject({
      flexDirection: "column",
      alignItems: "flex-start",
    });
    expect(rows().buttons.layout).toMatchObject({ alignSelf: "flex-end" });
  });
});
