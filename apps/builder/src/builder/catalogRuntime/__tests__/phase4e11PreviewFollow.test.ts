// @vitest-environment jsdom
/**
 * ADR-248 4e-11 G3 previewFollow repairs: Preview defects the Phase 3 new Canvas followed (②) are
 * fixed in the product, and the Canvas reads the same catalog declaration.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogCalendarHeaderParts } from "../../../../../../packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogDocument,
  DefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  CatalogCompositionRoot,
  type CatalogTextMeasure,
} from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { renderToStaticMarkup } from "react-dom/server";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { TAILWIND_PALETTE } from "@composition/rendering";

const TAILWIND_NEUTRAL_600 = TAILWIND_PALETTE.neutral[600];

const GENERATED = resolve(
  __dirname,
  "../../../../../../packages/shared/src/components/styles/generated",
);
const blockOf = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
};

const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * font.fontSize * 0.5,
  exactWidth: text.length * font.fontSize * 0.5,
  minWidth: text.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

async function openOwner(
  type: string,
  props: Record<string, string> = {},
  definitionId?: string,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:follow" as const,
        name: "Follow",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-4e11-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: measure,
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" },
      entries: [
        {
          kind: "node",
          id: "project:node:owner",
          definitionId:
            definitionId ?? catalogPaletteDefinitionId(library, type),
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
          visual: {},
          sizing: { width: { kind: "set", value: 300 } },
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: ["project:node:owner"],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

/**
 * A standalone item origin directly on the page (the palette inserts it into a host; the G3 state
 * scenario lays the origin itself out, as `phase3Presence` does).
 */
async function openStandalone(definitionId: string) {
  const library = await buildCodeCatalogLibrary();
  const projectId = "project:project:standalone" as const;
  const pageId = "project:page:main" as const;
  const nodeId = "project:node:owner" as NodeId;
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 35,
    revision: 0,
    projectId,
    rootId: projectId,
    entries: {
      [projectId]: {
        kind: "project",
        id: projectId,
        name: "Standalone",
        pageIds: [pageId],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      [pageId]: {
        kind: "page",
        id: pageId,
        name: "Main",
        route: "/",
        children: [nodeId],
      },
      [nodeId]: {
        kind: "node",
        id: nodeId,
        definitionId: definitionId as DefinitionId,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
    },
  };
  const runtime = new CatalogRuntime(
    new CatalogGraph(document, library),
    new CatalogStorage(indexedDB, `adr248-4e11-standalone-${Math.random()}`),
  );
  return new CatalogCompositionRoot(
    runtime,
    await nodeLayoutEngine(),
    { width: 1000, height: 800 },
    undefined,
    undefined,
    measure,
  );
}

/**
 * button-min-width-68: the field trigger buttons are `.react-aria-Button` elements without a
 * `data-size`, so the generic Button sheet's default `min-width: 68px` reached them over the
 * catalog's icon-sized width. The owner's button delegation resets it (`min-width: unset`, like
 * NumberField's steppers); the Canvas trigger icon is the declared icon size.
 */
describe("field trigger buttons — no generic Button min-width", () => {
  it.each(["ComboBox", "DatePicker", "DateRangePicker", "SearchField"])(
    "%s button delegation resets min-width",
    (owner) => {
      const css = readFileSync(`${GENERATED}/${owner}.css`, "utf8");
      // (`0`: a button that is a Button instance — ADR-253, the ComboBox's FieldButton.)
      expect(blockOf(css, `.react-aria-${owner} .react-aria-Button`)).toMatch(
        /min-width: (unset|0);/,
      );
    },
  );

  it.each(["ComboBox", "DatePicker", "DateRangePicker"])(
    "%s Canvas trigger icon is the 18 icon box at md",
    async (owner) => {
      const workspace = await openOwner(owner, { size: "md" });
      const root = workspace.root;
      // (The glyph is the Icon inside the FieldButton instance — ADR-253.)
      const icons = [...root.layoutInputs.values()].filter(
        (record) => record.bindingId === "icon",
      );
      expect(icons.length).toBeGreaterThan(0);
      for (const icon of icons) {
        expect(root.getLayoutInput(icon.id)).not.toMatchObject({
          minWidth: "68px",
        });
        expect(root.getGeometry([icon.id]).get(icon.id)!.width).toBe(18);
      }
      workspace.dispose();
    },
  );
});

/**
 * calendar-header: the Calendar nav buttons are `.react-aria-Button` elements without a
 * `data-size`; `Calendar.css` sizes them (height × height + spacing-xs) but the generic Button
 * `min-width: 68px` won, wrapping the month heading onto two lines. The shared Calendar sheet
 * resets it; the Canvas header row reads the nav width without the floor.
 */
describe("Calendar nav buttons — no generic Button min-width", () => {
  it("the shared Calendar sheet resets min-width on the nav buttons", () => {
    const css = readFileSync(
      resolve(GENERATED, "../CalendarCommon.css"),
      "utf8",
    );
    const block = css.slice(
      css.indexOf(".react-aria-RangeCalendar .react-aria-Button {"),
    );
    expect(block.slice(0, block.indexOf("&["))).toContain("min-width: unset;");
  });

  it("the Canvas header row reads the sized nav width (md 30 + 4)", () => {
    expect(catalogCalendarHeaderParts("md")?.navWidth).toBe(34);
    expect(catalogCalendarHeaderParts("sm")?.navWidth).toBe(28);
  });
});

/**
 * group-size-not-propagated (사용자 결정 2026-09-30 — RSP propagates): a group's `size` reaches its
 * items, and an item's `size` its label (the old `override: true` propagation rules). The resolver
 * sets the child's resolved `size`, so the Canvas rule box and the DOM `data-size` read one value.
 */
describe("group size reaches the items", () => {
  const sizeOf = (
    workspace: CatalogWorkspace,
    bindingId: string,
  ): Array<{ size: unknown; height: number }> => {
    const root = workspace.root;
    const records = [...root.layoutInputs.values()].filter(
      (record) => record.bindingId === bindingId && !record.hidden,
    );
    const geometry = root.getGeometry(records.map((record) => record.id));
    return records.map((record) => ({
      size: record.props.size,
      height: geometry.get(record.id)!.height,
    }));
  };

  it("ToggleButtonGroup lg sizes its ToggleButtons lg", async () => {
    const workspace = await openOwner("ToggleButtonGroup", { size: "lg" });
    const items = sizeOf(workspace, "togglebutton");
    expect(items.length).toBe(2);
    for (const item of items) expect(item).toEqual({ size: "lg", height: 42 });
    workspace.dispose();
  });

  it.each(["RadioGroup", "CheckboxGroup"])(
    "%s lg sizes its items and their labels lg",
    async (owner) => {
      const workspace = await openOwner(owner, { size: "lg" });
      const item = owner === "RadioGroup" ? "radio" : "checkbox";
      const items = sizeOf(workspace, item);
      expect(items.length).toBeGreaterThan(0);
      for (const entry of items) expect(entry.size).toBe("lg");
      const root = workspace.root;
      // (An item's Label sits in its RAC button when it has one — ADR-256 Phase 3 CheckboxButton.)
      const labels = [...root.layoutInputs.values()].filter(
        (record) =>
          record.bindingId === "label" &&
          [item, `${item}button`].includes(
            root.layoutInputs.get(record.parentId)?.bindingId ?? "",
          ),
      );
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) expect(label.props.size).toBe("lg");
      // The DOM items carry the same size (the group composes them).
      const group = [...root.domInputs.values()].find(
        (record) => record.sourceId === "project:node:owner",
      )!;
      const html = renderToStaticMarkup(renderCatalogDom(root, group.id));
      const itemClass = `react-aria-${item === "radio" ? "Radio" : "Checkbox"}`;
      // (A Checkbox item's element is RAC `CheckboxField` — a `div` — ADR-256 Phase 3.)
      const tags =
        html.match(
          new RegExp(`<(?:label|div)[^>]*class="${itemClass}"[^>]*>`, "g"),
        ) ?? [];
      expect(tags.length).toBe(items.length);
      if (item === "checkbox")
        for (const tag of tags) expect(tag).toContain('data-size="lg"');
      // The group root carries `data-size` (the generated per-size blocks apply), and the Canvas
      // reads the same catalog size: lg items gap 16.
      expect(html).toMatch(
        new RegExp(
          `class="react-aria-${owner}"[^>]*data-size="lg"|data-size="lg"[^>]*class="react-aria-${owner}"`,
        ),
      );
      const boxes = [...root.layoutInputs.values()].filter(
        (record) => record.bindingId === item,
      );
      const geometry = root.getGeometry(boxes.map((record) => record.id));
      const [first, second] = boxes.map((record) => geometry.get(record.id)!);
      expect(second.y - (first.y + first.height)).toBe(16);
      workspace.dispose();
    },
  );
});

/**
 * slider-track-size-not-propagated: the Slider size reaches its track (the old `size → SliderTrack`
 * propagation): the typed SliderTrack takes the catalog track height (sm 4 · lg 12), and the DOM
 * `<SliderTrack>` carries `data-size` so the generated `SliderTrack.css` size blocks apply.
 */
describe("Slider size reaches the track", () => {
  it.each([
    ["sm", 4],
    ["lg", 12],
  ])("Slider %s track is %d tall in both consumers", async (size, height) => {
    const workspace = await openOwner("Slider", { size });
    const root = workspace.root;
    const track = [...root.layoutInputs.values()].find(
      (record) => record.bindingId === "slidertrack",
    )!;
    expect(track.props.size).toBe(size);
    expect(root.getGeometry([track.id]).get(track.id)!.height).toBe(height);
    const group = [...root.domInputs.values()].find(
      (record) => record.sourceId === "project:node:owner",
    )!;
    const html = renderToStaticMarkup(renderCatalogDom(root, group.id));
    expect(html).toMatch(
      new RegExp(
        `class="react-aria-SliderTrack"[^>]*data-size="${size}"|data-size="${size}"[^>]*class="react-aria-SliderTrack"`,
      ),
    );
    workspace.dispose();
  });
});

/**
 * numberfield-trigger-content-height: the NumberField group is 20/22/30/42/54 tall in both
 * consumers. Since ADR-253 the group only places its parts — the height is the Input instance's
 * box (the Input rule at the field's size) and the steppers are squares of that height.
 */
describe("NumberField group — per-size height", () => {
  it("generated CSS only places the group and sizes the steppers per size", () => {
    const css = readFileSync(`${GENERATED}/NumberField.css`, "utf8");
    const group = blockOf(css, ".react-aria-NumberField .react-aria-Group");
    expect(group).not.toMatch(/padding|border|background/);
    expect(
      blockOf(css, ".react-aria-NumberField .react-aria-Button"),
    ).toContain("width: var(--nf-btn-size);");
    expect(css).toContain("--nf-btn-size: 54px;");
  });

  it.each([
    ["xs", 20],
    ["sm", 22],
    ["md", 30],
    ["lg", 42],
    ["xl", 54],
  ])("NumberField %s trigger is %d tall", async (size, height) => {
    const workspace = await openOwner("NumberField", { size });
    const root = workspace.root;
    const trigger = [...root.layoutInputs.values()].find(
      (record) => record.bindingId === "group",
    )!;
    expect(root.getGeometry([trigger.id]).get(trigger.id)!.height).toBe(height);
    workspace.dispose();
  });
});

/**
 * pagination-wrap: `Table.css` styled its own page bar through `.react-aria-Pagination`, so the
 * standalone Pagination component wrapped (`flex-wrap: wrap`, text-sm). The Table's bar carries
 * `table-pagination` and the sheet is scoped to it; the Pagination keeps the catalog row.
 */
describe("Pagination — Table page bar sheet scoped to the Table", () => {
  it("Table.css no longer styles a bare .react-aria-Pagination", () => {
    const css = readFileSync(resolve(GENERATED, "../Table.css"), "utf8");
    expect(css).not.toMatch(/(^|\n)\s*\.react-aria-Pagination\s*\{/);
    expect(css).toContain(".react-aria-Pagination.table-pagination {");
  });

  it("the Canvas Pagination does not wrap its buttons", async () => {
    const workspace = await openOwner("Pagination");
    const root = workspace.root;
    const owner = [...root.layoutInputs.values()].find(
      (record) => record.sourceId === "project:node:owner",
    )!;
    expect(root.getLayoutInput(owner.id)).not.toMatchObject({
      flexWrap: "wrap",
    });
    workspace.dispose();
  });
});

/**
 * tree-chevron-shrink · orphan-tree-host: `Tree.css` sizes the chevron button 20 wide but it shrank
 * beside the full-width label (flex-shrink); a standalone TreeItem's Preview host (`RAC.Tree`)
 * lacked `data-composition-tree`, so `Tree.css` did not reach the row. The chevron keeps its width
 * (`flex-shrink: 0`), the orphan host carries the attribute, and the Canvas lays a standalone
 * TreeItem out as a level-1 row (the host is a Tree).
 */
describe("TreeItem chevron — Tree.css width in every host", () => {
  // A standalone TreeItem: the palette's origin item (label Text child), not the bare type.
  const labelInset = async (type: string) => {
    const workspace = await openOwner(
      type,
      {},
      type === "TreeItem"
        ? "lib:definition:origin-component-tree-item-default"
        : undefined,
    );
    const root = workspace.root;
    const item = [...root.layoutInputs.values()].find(
      (record) => record.bindingId === "treeitem" && !record.hidden,
    )!;
    // (The label sits in the row content — RAC TreeItemContent, ADR-256 Phase 5h.)
    const content = item.children
      .map((id) => root.layoutInputs.get(id)!)
      .find((record) => record.bindingId === "treeitemcontent")!;
    const label = content.children
      .map((id) => root.layoutInputs.get(id)!)
      .find((record) => record.bindingId === "text")!;
    // Geometry is parent-relative: the label's x in the content plus the content's in the row.
    const geometry = root.getGeometry([content.id, label.id]);
    const inset = geometry.get(content.id)!.x + geometry.get(label.id)!.x;
    return { workspace, root, inset };
  };

  it("Tree.css keeps the chevron from shrinking", () => {
    const css = readFileSync(resolve(GENERATED, "../Tree.css"), "utf8");
    const start = css.indexOf('.react-aria-Button[slot="chevron"] {');
    expect(css.slice(start, css.indexOf("}", start))).toContain(
      "flex-shrink: 0;",
    );
  });

  it.each(["Tree", "TreeItem"])(
    "%s row label starts after padding 8 + chevron 20 + gap 2",
    async (type) => {
      const { workspace, root, inset } = await labelInset(type);
      expect(inset).toBe(30);
      if (type === "TreeItem") {
        const owner = [...root.domInputs.values()].find(
          (record) => record.sourceId === "project:node:owner",
        )!;
        const html = renderToStaticMarkup(renderCatalogDom(root, owner.id));
        expect(html).toContain('data-composition-tree="true"');
        // The row keeps its authored width (the orphan sample's inline style).
        expect(html).toMatch(/role="row"[^>]*style="[^"]*width:300px/);
      }
      workspace.dispose();
    },
  );
});

/**
 * standalone-tag-slot · standalone-gridlistitem-slot: a standalone Tag / GridListItem renders in
 * its RAC host (TagGroup · GridList), but its children got no `slot` attribute (the Preview marked
 * slots only under a document collection) — `TagGroup.css` `.react-aria-Tag > [slot=avatar]` (16)
 * and the GridList description weight missed it. The orphan host counts as the collection, and the
 * Canvas reads the slot rules from the item's own rule.
 */
describe("standalone collection items — item slot roles", () => {
  it("TagGroup.css slot chips take the Tag's gap, no margin", () => {
    const css = readFileSync(resolve(GENERATED, "../TagGroup.css"), "utf8");
    for (const selector of [
      '> .react-aria-Icon[slot="icon"] {',
      '> .react-aria-Avatar[slot="avatar"] {',
    ]) {
      const start = css.indexOf(selector);
      expect(start).toBeGreaterThan(0);
      expect(css.slice(start, css.indexOf("}", start))).not.toContain(
        "margin-right",
      );
    }
  });

  it("a standalone Tag's avatar is the 16 slot chip in both consumers", async () => {
    const root = await openStandalone(
      "lib:definition:origin-component-tag-item-default",
    );
    const avatar = [...root.layoutInputs.values()].find(
      (record) => record.props.slot === "avatar" && !record.hidden,
    );
    if (avatar) {
      expect(root.getGeometry([avatar.id]).get(avatar.id)!.width).toBe(16);
      // Avatar → label: the Tag's flex gap 4 only (catalog `leadingAvatar.gap`), no slot margin.
      // (The label is the Tag's Text — no slot name since ADR-256 Phase 5d, as the reference.)
      const label = [...root.layoutInputs.values()].find(
        (record) =>
          record.bindingId === "text" &&
          record.parentId === avatar.parentId &&
          !record.hidden,
      )!;
      const boxes = root.getGeometry([avatar.id, label.id]);
      expect(
        boxes.get(label.id)!.x -
          (boxes.get(avatar.id)!.x + boxes.get(avatar.id)!.width),
      ).toBe(4);
      const owner = [...root.domInputs.values()].find(
        (record) => record.sourceId === "project:node:owner",
      )!;
      const html = renderToStaticMarkup(renderCatalogDom(root, owner.id));
      // Avatar consumes the resolved values inline (`UNLOADED_GENERATED_CSS` C): the slot role and
      // the 16 chip reach its element.
      expect(html).toMatch(/slot="avatar" style="width:16px;height:16px/);
      expect(html).not.toMatch(/slot="avatar" style="[^"]*margin-right/);
      // The Canvas circle is the 16 box too (not the Avatar size's 32).
      const canvas = bindCatalogCanvas(root, root.pageRootRecords());
      const paint = getSkiaNode(avatar.id)!;
      for (const child of paint.children ?? []) {
        expect(child.width).toBe(16);
        expect(child.height).toBe(16);
      }
      canvas.dispose();
    } else expect.fail("the Tag origin has an avatar child");
  });

  it("a disabled standalone GridListItem fades like the DOM [data-disabled]", async () => {
    const root = await openStandalone(
      "lib:definition:origin-component-gridlist-item-default--disabled",
    );
    const item = [...root.canvasInputs.values()].find(
      (record) => record.bindingId === "gridlistitem",
    )!;
    expect(item.visual.opacity).toBe(0.38);
    const css = readFileSync(`${GENERATED}/GridListItem.css`, "utf8");
    expect(css).toMatch(
      /\.react-aria-GridListItem\[data-disabled\] \{[^}]*opacity: 0\.38/,
    );
  });

  it("a standalone GridListItem's description keeps weight 400 and its slot", async () => {
    const root = await openStandalone(
      "lib:definition:origin-component-gridlist-item-default",
    );
    const description = [...root.canvasInputs.values()].find(
      (record) => record.props.slot === "description",
    )!;
    expect(description.visual.fontWeight).toBe(400);
    // `GridList.css` `[slot=description]` muted (`--fg-muted` = neutral-600).
    expect(description.visual.color).toBe(TAILWIND_NEUTRAL_600);
    const owner = [...root.domInputs.values()].find(
      (record) => record.sourceId === "project:node:owner",
    )!;
    const html = renderToStaticMarkup(renderCatalogDom(root, owner.id));
    expect(html).toContain('slot="description"');
  });
});

/**
 * taglist-wrapper: the catalog TagList is `height: 100%` (사용자 지시 2026-09-24) — the chip
 * wrapper fills what the TagGroup leaves under its label. The RAC TagGroup is the TagGroup node's
 * styled box (Codex Round 20 H1 — no outer div), so the wrapper's percentage resolves against the
 * authored height; the Canvas TagList takes the same 100%.
 */
describe("TagList — the catalog 100% height", () => {
  it("TagGroup.css does not stretch the RAC TagGroup (it is the node's own box)", () => {
    const css = readFileSync(resolve(GENERATED, "../TagGroup.css"), "utf8");
    expect(css).not.toMatch(/\.react-aria-TagGroup[^{]*\{[^}]*height: 100%;/);
  });

  it("a 130-tall TagGroup's TagList fills the space under its label", async () => {
    const library = await buildCodeCatalogLibrary();
    const workspace = await openOwner("TagGroup");
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" },
        entries: [
          {
            kind: "node",
            id: "project:node:sized",
            definitionId: catalogPaletteDefinitionId(library, "TagGroup"),
            children: [],
            props: {},
            visual: {},
            sizing: {
              width: { kind: "set", value: 220 },
              height: { kind: "set", value: 130 },
            },
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: ["project:node:sized"],
        newId: workspace.newId,
      }),
    );
    const root = workspace.root;
    const group = [...root.layoutInputs.values()].find(
      (record) => record.sourceId === "project:node:sized",
    )!;
    const list = group.children
      .map((id) => root.layoutInputs.get(id)!)
      .find((record) => record.bindingId === "taglist")!;
    const label = group.children
      .map((id) => root.layoutInputs.get(id)!)
      .find((record) => record.bindingId === "label")!;
    const boxes = root.getGeometry([group.id, list.id, label.id]);
    const gap = Number(group.visual.gap ?? 0);
    expect(boxes.get(list.id)!.height).toBeCloseTo(
      130 - boxes.get(label.id)!.height - gap,
      1,
    );
    workspace.dispose();
  });
});

describe("TagGroup size reaches the chips", () => {
  it("a sm TagGroup's Tags are sm (22 tall)", async () => {
    const workspace = await openOwner("TagGroup", { size: "sm" });
    const root = workspace.root;
    const tags = [...root.layoutInputs.values()].filter(
      (record) => record.bindingId === "tag" && !record.hidden,
    );
    expect(tags.length).toBeGreaterThan(0);
    const geometry = root.getGeometry(tags.map((record) => record.id));
    for (const tag of tags) {
      expect(tag.props.size).toBe("sm");
      expect(geometry.get(tag.id)!.height).toBe(22);
    }
    workspace.dispose();
  });
});
