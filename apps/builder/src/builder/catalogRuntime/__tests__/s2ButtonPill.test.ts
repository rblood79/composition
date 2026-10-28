// @vitest-environment jsdom
/**
 * S2 Button shape (2026-10-28 — 사용자 「Button 모서리를 S2 처럼 완전히 둥글게」): S2 `Button` is
 * `control({shape: 'pill'})` (Button.tsx) — a pill at every size. A field's own buttons are not S2
 * Buttons (Picker trigger · NumberField steppers · ComboBox · DatePicker · SearchField field
 * buttons keep the field's corner), but here they are instances of the Button origin, whose rule
 * owns their shape (ADR-253). So the Button rule says both: pill, and — for a button a field owns
 * (`fieldButton`, presence) — the size's former corner. DOM `data-field-button`, Canvas the same
 * rule's `containerVariants`.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const OWNER = "project:node:owner" as NodeId;

async function open(type: string, size: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:button-pill" as const,
        name: "Button pill",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `button-pill-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: catalogPaletteDefinitionId(library, type),
          children: [],
          props: { size: { kind: "set", value: size } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const owner = [...root.domInputs.values()].find(
    (item) => item.sourceId === OWNER,
  )!;
  // The owner's own buttons (a picker's calendar nav buttons are the calendar's — not counted).
  const buttons = [...root.domInputs.values()].filter(
    (item) =>
      item.bindingId === "button" &&
      item.props.slot !== "previous" &&
      item.props.slot !== "next" &&
      // (Its records: the owner itself, or a position under it — the identity names the owner.)
      item.id.includes(OWNER),
  );
  const html = renderToStaticMarkup(renderCatalogDom(root, owner.id));
  const canvas = bindCatalogCanvas(root, root.pageRootRecords());
  const radii = buttons.map((button) => {
    const value = (
      getSkiaNode(button.id) as unknown as {
        box?: { borderRadius?: number | number[] };
      }
    ).box?.borderRadius;
    return value ?? null;
  });
  canvas.dispose();
  return { html, radii, count: buttons.length };
}

/**
 * Each field's own buttons' Canvas radius before the change (measured 2026-10-28 on this test's
 * `open`, the arrays are per button — a NumberField stepper's own corners stay its template's). The
 * change must leave every one as it was: each is its Button's own size corner (a ComboBox ·
 * date picker button is size S at every field size).
 */
const FIELD_BUTTON_RADII_BEFORE: ReadonlyArray<[string, string, unknown[]]> = [
  ["Select", "XS", [4]],
  ["Select", "S", [4]],
  ["Select", "M", [6]],
  ["Select", "L", [8]],
  ["Select", "XL", [12]],
  ["NumberField", "XS", [0, [0, 4, 4, 0]]],
  ["NumberField", "S", [0, [0, 4, 4, 0]]],
  ["NumberField", "M", [0, [0, 6, 6, 0]]],
  ["NumberField", "L", [0, [0, 8, 8, 0]]],
  ["NumberField", "XL", [0, [0, 12, 12, 0]]],
  ["ComboBox", "XS", [4]],
  ["ComboBox", "S", [4]],
  ["ComboBox", "M", [4]],
  ["ComboBox", "L", [4]],
  ["ComboBox", "XL", [4]],
  ["SearchField", "S", [null]],
  ["SearchField", "M", [null]],
  ["SearchField", "L", [null]],
  ["SearchField", "XL", [null]],
  ["DatePicker", "XS", [4]],
  ["DatePicker", "S", [4]],
  ["DatePicker", "M", [4]],
  ["DatePicker", "L", [4]],
  ["DatePicker", "XL", [4]],
  ["DateRangePicker", "XS", [4]],
  ["DateRangePicker", "S", [4]],
  ["DateRangePicker", "M", [4]],
  ["DateRangePicker", "L", [4]],
  ["DateRangePicker", "XL", [4]],
];

describe("S2 Button shape — a pill; a field's own button keeps its corner", () => {
  it.each(["S", "M", "L", "XL"])(
    "a Button at %s is a pill (Canvas 9999 · no data-field-button)",
    async (size) => {
      const { html, radii } = await open("Button", size);
      expect(radii).toEqual([9999]);
      expect(html).not.toContain("data-field-button");
    },
  );

  it.each(FIELD_BUTTON_RADII_BEFORE)(
    "%s at %s: its buttons keep their corner %j (Canvas) and carry data-field-button (DOM)",
    async (type, size, radii) => {
      const { html, radii: after } = await open(type, size);
      expect(after).toEqual(radii);
      expect(html).toContain("data-field-button=");
    },
  );

  it("the generated sheet: sizes are pills, and a field's button takes the size's corner after them", () => {
    const css = readFileSync(
      resolve(
        __dirname,
        "../../../../../../packages/shared/src/components/styles/generated/Button.css",
      ),
      "utf8",
    );
    const sizeBlock = css.indexOf('.react-aria-Button[data-size="M"]');
    const fieldBlock = css.indexOf('.react-aria-Button[data-field-button="M"]');
    expect(sizeBlock).toBeGreaterThan(-1);
    expect(fieldBlock).toBeGreaterThan(sizeBlock);
    expect(css.slice(sizeBlock, css.indexOf("}", sizeBlock))).toContain(
      "border-radius: var(--radius-full)",
    );
    expect(css.slice(fieldBlock, css.indexOf("}", fieldBlock))).toContain(
      "border-radius: var(--radius-md)",
    );
  });
});
