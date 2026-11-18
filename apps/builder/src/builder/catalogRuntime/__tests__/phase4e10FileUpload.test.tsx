// @vitest-environment jsdom
/**
 * ADR-248 4e-10 G3 FileUpload: the file trigger is the self-composed `.react-aria-FileTrigger`
 * button (the root, no wrapper since 2026-09-10), so the rule's box — size height/padding, variant
 * fill/border — is that button's box in both consumers (generated CSS and the Canvas layout input).
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DropZone } from "../../../../../../packages/shared/src/components/DropZone";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { NodeEntry } from "../../../../../../packages/shared/src/catalog/document/types";
import { openStylesFixture } from "../../panels/styles/__tests__/support/catalogStylesFixture";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import type { CatalogTextMeasure } from "../compositionRoot";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const GENERATED = resolve(
  __dirname,
  "../../../../../../packages/shared/src/components/styles/generated",
);
const blockOf = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`);
  return start < 0 ? "" : css.slice(start, css.indexOf("}", start));
};

describe("FileTrigger — rule box on the trigger button", () => {
  it("generated CSS carries the size box and the variant paint", () => {
    const css = readFileSync(`${GENERATED}/FileTrigger.css`, "utf8");
    const md = blockOf(css, '.react-aria-FileTrigger[data-size="M"]');
    // (The Button's M box — user 2026-10-25 「FILETRIGGER 의 size 모두 button 의 size 와 동일하게」.)
    expect(md).toContain("padding: 4px 12px;");
    expect(md).not.toContain("height: 40px;");
    // (ADR-297 Phase 3: the variant paint is the tree's `:where` block)
    expect(css).toContain(
      '.react-aria-FileTrigger:where([data-variant="default"])',
    );
    expect(blockOf(css, ".react-aria-FileTrigger")).not.toContain(
      "display: inline-block;",
    );
  });

  it("the Canvas layout input carries the same box", async () => {
    const fixture = await openStylesFixture([
      { id: "ft", type: "FileTrigger" },
    ]);
    const input = fixture.workspace.root.getLayoutInput(fixture.recordOf("ft"));
    expect(input).toMatchObject({
      display: "inline-flex",
      paddingLeft: "12px",
      paddingRight: "12px",
      paddingTop: "4px",
      paddingBottom: "4px",
    });
    expect(input).not.toHaveProperty("height");
  });
});

/**
 * A rule-backed text leaf the layout kept on one line paints on one line — at its fractional
 * max-content box (CSS does not wrap a box sized to its own max-content), like a plain text leaf
 * (`textWraps`). Only a leaf the layout wrapped paints wrapped.
 */
describe("rule-backed text — the layout's wrap decision", () => {
  // Fractional advances: the box is the exact max-content, which a paragraph laid out at that
  // width may wrap on a sub-pixel.
  const measure: CatalogTextMeasure = (text, font, maxWidth) => {
    const width = text.length * 7.13;
    const line = font.fontSize * (font.lineHeight || 1.2);
    if (maxWidth === undefined || maxWidth + 0.5 >= width)
      return { width, exactWidth: width, minWidth: 40, height: line };
    return { width: maxWidth, height: 2 * line };
  };
  async function open(sizing: NodeEntry["sizing"]) {
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:wrap" as const,
          name: "Wrap",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `adr248-4e10-wrap-${Math.random()}`),
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
            id: "project:node:ft",
            definitionId: catalogPaletteDefinitionId(library, "FileTrigger"),
            children: [],
            props: { children: { kind: "set", value: "Select files" } },
            visual: {},
            sizing,
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: ["project:node:ft"],
        newId: workspace.newId,
      }),
    );
    return workspace;
  }
  const textOf = (data: SkiaNodeData | undefined): SkiaNodeData["text"] =>
    data?.text ??
    (data?.children ?? []).map(textOf).find((text) => text !== undefined);

  it("kept on one line → painted unwrapped", async () => {
    const workspace = await open({});
    const record = workspace.root.recordsOfSource("project:node:ft")[0]!;
    expect(workspace.root.textWraps(record)).toBe(false);
    const canvas = bindCatalogCanvas(
      workspace.root,
      workspace.root.pageRootRecords(),
    );
    expect(textOf(getSkiaNode(record))).toMatchObject({
      content: "Select files",
      whiteSpace: "nowrap",
    });
    canvas.dispose();
    workspace.dispose();
  });

  it("wrapped by the layout → painted wrapped", async () => {
    const workspace = await open({ width: { kind: "set", value: 90 } });
    const record = workspace.root.recordsOfSource("project:node:ft")[0]!;
    expect(workspace.root.textWraps(record)).toBe(true);
    const canvas = bindCatalogCanvas(
      workspace.root,
      workspace.root.pageRootRecords(),
    );
    expect(textOf(getSkiaNode(record))?.whiteSpace).not.toBe("nowrap");
    canvas.dispose();
    workspace.dispose();
  });
});

/**
 * ADR-248 4e-10 G3 DateRangePicker xs: the catalog's `[slot="end"] { flex: 1 }` delegation grows
 * the DOM end DateInput into the trigger's free space (basis 0, min-content floor). The Canvas end
 * DateInput (an instance of the DateInput origin with `slot: "end"` — ADR-253) grows the same way.
 */
describe("DateRangePicker — the end input's catalog grow", () => {
  it("the end DateInput grows into the trigger's free space", async () => {
    const measure: CatalogTextMeasure = (text, font) => ({
      width: text.length * font.fontSize * 0.5,
      exactWidth: text.length * font.fontSize * 0.5,
      minWidth: text.length * font.fontSize * 0.5,
      height: font.fontSize * (font.lineHeight || 1.2),
    });
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:range" as const,
          name: "Range",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `adr248-4e10-range-${Math.random()}`),
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
            id: "project:node:range",
            definitionId: catalogPaletteDefinitionId(
              library,
              "DateRangePicker",
            ),
            children: [],
            props: { size: { kind: "set", value: "XS" } },
            visual: {},
            sizing: { width: { kind: "set", value: 400 } },
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: ["project:node:range"],
        newId: workspace.newId,
      }),
    );
    const root = workspace.root;
    const records = [...root.layoutInputs.values()];
    // (the field's own pair — its Popover's TimeFields stay hidden off a time granularity)
    const inputs = records.filter(
      (record) =>
        record.bindingId === "dateinput" &&
        root.canvasInputs.get(record.parentId!)?.bindingId === "group" &&
        !root.canvasInputs
          .get(root.canvasInputs.get(record.parentId!)!.parentId!)
          ?.bindingId?.startsWith("timefield"),
    );
    expect(inputs.map((record) => record.props.slot)).toEqual(["start", "end"]);
    expect(root.getLayoutInput(inputs[0]!.id)).not.toMatchObject({
      flexGrow: 1,
    });
    const input = inputs[1]!;
    expect(root.getLayoutInput(input.id)).toMatchObject({ flexGrow: 1 });
    const wrapper = root.layoutInputs.get(input.parentId)!;
    const siblings = wrapper.children;
    const geometry = root.getGeometry([wrapper.id, ...siblings]);
    const box = geometry.get(input.id)!;
    const next = geometry.get(siblings[siblings.indexOf(input.id) + 1]!)!;
    // The end input fills up to the trigger button (the DOM's start · – · grown end); the room before the
    //   button is the box's gap (XS 2xs = 2) — the input has no end padding, the button no margin
    //   (2026-11-14 — as a DatePicker's, 사용자 「margin 은 완료된 패턴을 참고」).
    expect(
      (root.getLayoutInput(input.id) as Record<string, unknown>).paddingRight,
    ).toBe("0px");
    expect(next.x - (box.x + box.width)).toBeCloseTo(2, 1);
    const outer = geometry.get(wrapper.id)!;
    expect(next.x + next.width).toBeGreaterThan(outer.x + outer.width - 10);
    workspace.dispose();
  });
});

/**
 * ADR-248 4e-10 G3 FileUpload — DropZone content (사용자 결정 A 2026-10-02): the icon, label and
 * description follow the catalog delegation (`--icon-size` · label at the DropZone font · description
 * text-xs · line-height 1.5 · centered) as flex items of the DropZone column (gap 12). The Canvas
 * measures them (CSS `min-height: auto` keeps a declared-height DropZone at its content) and paints
 * them; the FileUpload template's DropZone fits its content.
 */
describe("DropZone content — its S2 IllustratedMessage in both consumers", () => {
  // 7 px per character, words break at spaces.
  const measure: CatalogTextMeasure = (text, font, maxWidth) => {
    const char = font.fontSize / 2;
    const line = font.fontSize * (font.lineHeight || 1.2);
    const width = text.length * char;
    const words = text.split(" ");
    const minWidth = Math.max(...words.map((word) => word.length)) * char;
    if (maxWidth === undefined || maxWidth + 0.5 >= width)
      return { width, exactWidth: width, minWidth, height: line };
    let lines = 1;
    let used = 0;
    for (const word of words) {
      const need = (used ? used + 1 : 0) + word.length;
      if (need * char <= maxWidth || !used) used = need;
      else {
        lines += 1;
        used = word.length;
      }
    }
    return { width: maxWidth, height: lines * line };
  };
  async function open(type: string, sizing: NodeEntry["sizing"] = {}) {
    const library = await buildCodeCatalogLibrary();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:dropzone" as const,
          name: "DropZone",
        }),
        library,
      ),
      new CatalogStorage(indexedDB, `adr248-4e10-dz-${Math.random()}`),
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
            id: "project:node:subject",
            definitionId: catalogPaletteDefinitionId(library, type),
            children: [],
            props: {},
            visual: {},
            sizing,
            descendantOverrides: [],
          } as NodeEntry,
        ],
        rootIds: ["project:node:subject"],
        newId: workspace.newId,
      }),
    );
    const root = workspace.root;
    const zone = [...root.layoutInputs.values()].find(
      (record) => record.bindingId === "dropzone",
    )!;
    return { workspace, root, zone };
  }

  it("a declared-height DropZone keeps its content height when its column is short (min-height: auto)", async () => {
    const { root, workspace } = await open("FileUpload", {
      width: { kind: "set", value: 220 },
      height: { kind: "set", value: 130 },
    });
    const zone = [...root.layoutInputs.values()].find(
      (record) => record.bindingId === "dropzone",
    )!;
    // (S2 마이그레이션 2026-11-18: its content is S2's IllustratedMessage — a child node.)
    const message = [...root.layoutInputs.values()].find(
      (record) => record.parentId === zone.id,
    )!;
    expect(root.typeOf(message)).toBe("IllustratedMessage");
    const content = root.getGeometry([message.id]).get(message.id)!;
    expect(content.height).toBeGreaterThan(0);
    const box = root.getGeometry([zone.id]).get(zone.id)!;
    // padding 24 × 2 + border 2 × 2 + the message (picture 96 + heading + description lines)
    expect(box.height).toBeCloseTo(52 + content.height, 0);
    workspace.dispose();
  });

  it("the palette DropZone composes nothing of its own — its S2 IllustratedMessage draws the picture and words, centered", async () => {
    const { root, workspace, zone } = await open("DropZone");
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const data = getSkiaNode(zone.id)!;
    // (No composed icon · text: S2 `DropZone > IllustratedMessage`, 2026-11-18.)
    expect(
      (data.children ?? []).filter(
        (child) => child.type === "icon_path" || child.text !== undefined,
      ),
    ).toEqual([]);
    const message = [...root.canvasInputs.values()].find(
      (record) => record.parentId === zone.id,
    )!;
    expect(root.typeOf(message)).toBe("IllustratedMessage");
    const zoneBox = root.getGeometry([zone.id]).get(zone.id)!;
    const box = root.getGeometry([message.id]).get(message.id)!;
    // Centered on the zone's horizontal axis (S2 `justifyContent: center`).
    expect(box.x + box.width / 2).toBeCloseTo(zoneBox.width / 2, 0);
    canvas.dispose();
    workspace.dispose();
  });
});
