// @vitest-environment jsdom
/**
 * (2026-11-09) S2 draws the date fields' box with the TextField's `FieldGroup` (`@react-spectrum/s2`
 * src/DateField.tsx · DatePicker.tsx · DateRangePicker.tsx → Field.tsx `fieldGroupStyles`): 2px border,
 * the field fill, focus within darkens the border (no accent outline). The DateInput rule and the
 * DateRangePicker's range Group take the Input rule's values — they kept a 1px box with an accent focus
 * outline after the Input moved to S2 (3ca03f661).
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import { bindCatalogCanvas } from "../canvasBinding";
import type { CatalogTextMeasure } from "../compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * font.fontSize * 0.5,
  exactWidth: text.length * font.fontSize * 0.5,
  minWidth: text.length * font.fontSize * 0.5,
  height: font.fontSize * (font.lineHeight || 1.2),
});

const OWNER = "project:node:owner" as NodeId;

/** A node entry of `definitionId` with set props. */
const nodeEntry = (
  id: string,
  definitionId: string,
  children: string[] = [],
  props: Record<string, unknown> = {},
) =>
  ({
    kind: "node",
    id,
    definitionId,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        { kind: "set", value },
      ]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as NodeEntry;

/** A workspace whose home body holds `entries` (roots: the first). */
async function openWorkspace(
  entries: (library: CatalogLibrary) => NodeEntry[],
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:field-box" as const,
        name: "Field box",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `field-box-${Math.random()}`),
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
      entries: entries(library),
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  return workspace;
}

async function openPalette(type: string, props: Record<string, unknown> = {}) {
  const workspace = await openWorkspace((library) => [
    nodeEntry(OWNER, catalogPaletteDefinitionId(library, type), [], props),
  ]);
  const root = workspace.root;
  const record = (id: string) => root.layoutInputs.get(id)!;
  const kids = (id: string) => record(id).children.map(record);
  const ofBinding = (binding: string) =>
    [...root.layoutInputs.values()].filter(
      (entry) => entry.bindingId === binding,
    );
  return { workspace, root, record, kids, ofBinding };
}

/** The painted box of a record: fill · stroke (0..255) · stroke width · radius. */
function paintedBox(id: string) {
  const b = (getSkiaNode(id) as { box?: Record<string, unknown> } | undefined)
    ?.box;
  const rgba = (c: unknown) =>
    c
      ? Array.from(c as Float32Array).map((v) => Math.round(v * 255))
      : undefined;
  return (
    b && {
      fill: rgba(b.fillColor),
      stroke: rgba(b.strokeColor),
      strokeWidth: b.strokeWidth,
      radius: b.borderRadius,
    }
  );
}

async function fieldBox(type: string, part: string) {
  const { workspace, root } = await openPalette(type);
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const record = [...root.layoutInputs.values()].find(
    (r) => root.typeOf(r) === part,
  )!;
  const out = paintedBox(record.id);
  canvas.dispose();
  workspace.dispose();
  return out;
}

describe("date field box = the TextField's S2 FieldGroup", () => {
  it("Canvas: a DateField's DateInput and a DateRangePicker's Group paint the Input's box", async () => {
    const input = await fieldBox("TextField", "Input");
    expect(input?.strokeWidth).toBe(2);
    expect(await fieldBox("DateField", "DateInput")).toEqual(input);
    expect(await fieldBox("DatePicker", "DateInput")).toEqual(input);
    expect(await fieldBox("DateRangePicker", "Group")).toEqual(input);
  });

  it("generated sheets: the Input's border and focus — no accent outline", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const sheet = (name: string) =>
      readFileSync(
        resolve(
          __dirname,
          `../../../../../../packages/shared/src/components/styles/generated/${name}.css`,
        ),
        "utf8",
      );
    for (const name of ["DateInput", "DateRangePicker"]) {
      const css = sheet(name);
      expect(css, name).toMatch(
        /var\(--border-width-thick\) solid var\(--neutral-outline\)/,
      );
      expect(css, name).not.toMatch(/2px solid var\(--accent-content\)/);
      expect(css, name).toMatch(/border-color: var\(--neutral-content-hover\)/);
    }
  });

  // (2026-11-09) A disabled S2 field paints disabled colors — the box border and the Label — with no
  //   dim (S2 `field()` · `FieldGroup` carry no opacity). The date fields dimmed their root 0.38, which
  //   also hid that their Label never took the disabled color; the range Group dimmed once more.
  it("disabled: no dim — the box border and the Label in the disabled color, as a TextField", async () => {
    const disabled = async (type: string, part: string) => {
      const { workspace, root } = await openPalette(type, { isDisabled: true });
      const canvas = bindCatalogCanvas(root, root.pageRootRecords());
      const own = root.recordsOfSource(OWNER)[0]!;
      const record = [...root.layoutInputs.values()].find(
        (r) => root.typeOf(r) === part,
      )!;
      const label = [...root.canvasInputs.values()].find(
        (r) => root.typeOf(r) === "Label",
      )!;
      const out = {
        dim: (
          getSkiaNode(own) as
            { effects?: { type: string; value?: unknown }[] } | undefined
        )?.effects?.find((effect) => effect.type === "opacity")?.value,
        stroke: paintedBox(record.id)?.stroke,
        label: label.derivedProps?.color ?? label.visual.color,
      };
      canvas.dispose();
      workspace.dispose();
      return out;
    };
    const textField = await disabled("TextField", "Input");
    expect(textField.dim).toBeUndefined();
    for (const [type, part] of [
      ["DateField", "DateInput"],
      ["TimeField", "DateInput"],
      ["DatePicker", "DateInput"],
      ["DateRangePicker", "Group"],
    ] as const)
      expect(await disabled(type, part), type).toEqual(textField);
  });

  it("disabled sheets: the root's disabled color, no dim; the range Group's disabled border", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const sheet = (name: string) =>
      readFileSync(
        resolve(
          __dirname,
          `../../../../../../packages/shared/src/components/styles/generated/${name}.css`,
        ),
        "utf8",
      );
    for (const name of [
      "DateField",
      "TimeField",
      "DatePicker",
      "DateRangePicker",
    ]) {
      const css = sheet(name);
      expect(css, name).not.toMatch(/opacity: 0\.38/);
      expect(css, name).toMatch(
        new RegExp(
          `\\.react-aria-${name}:where\\(\\[data-disabled\\]\\) \\{\\s*color: var\\(--fg-disabled\\)`,
        ),
      );
    }
    expect(sheet("DateRangePicker")).toMatch(
      /\.react-aria-Group:where\(\[data-disabled\]\) \{\s*border-color: var\(--fg-disabled\)/,
    );
  });

  // S2 draws the keyboard ring on the `FieldGroup` (the box) only — the field root (`field()`) has none.
  //   RAC DatePicker · DateRangePicker set `data-focus-visible` on the root with `within: true`, so a root
  //   ring outlined the whole field (Label included) around the box's own ring.
  it("focus sheets: no ring on the field root; the box (DateInput · range Group) rings", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const sheet = (name: string) =>
      readFileSync(
        resolve(
          __dirname,
          `../../../../../../packages/shared/src/components/styles/generated/${name}.css`,
        ),
        "utf8",
      );
    for (const name of [
      "DateField",
      "TimeField",
      "DatePicker",
      "DateRangePicker",
    ]) {
      expect(sheet(name), name).not.toMatch(
        new RegExp(`\\.react-aria-${name}:where\\(\\[data-focus-visible\\]\\)`),
      );
    }
    expect(sheet("DateInput")).toMatch(
      /:where\(\[data-focus-visible\]\) \{\s*outline: var\(--focus-ring-width\) solid var\(--focus-ring\)/,
    );
    // The range box rings (and darkens) when the keyboard is in a date input — not when its calendar
    //   Button has focus (S2 `shouldTurnOffFocusRing`: the Button rings itself).
    const range = sheet("DateRangePicker");
    expect(range).toMatch(
      /\.react-aria-Group:where\(\[data-focus-visible\]:not\(:has\(\.react-aria-Button\[data-focused\]\)\)\) \{\s*outline: var\(--focus-ring-width\) solid var\(--focus-ring\);\s*outline-offset: var\(--focus-ring-offset\)/,
    );
    expect(range).toMatch(
      /\.react-aria-Group:where\(\[data-focus-within\]:not\(:has\(\.react-aria-Button\[data-focused\]\)\)\) \{\s*border-color: var\(--neutral-content-hover\)/,
    );
    expect(range).not.toMatch(/\.react-aria-Group:where\(\[data-focus-within\]\)/);
  });
});
