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

async function open(type: string, size: string, bindingId = "button") {
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
          // (No size: a component that takes none — the Dialog.)
          props: size ? { size: { kind: "set", value: size } } : {},
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
      item.bindingId === bindingId &&
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
  // (The document value — a closed overlay body has no Canvas node.)
  const visualRadii = buttons.map((button) => button.visual.radius ?? null);
  return { html, radii, visualRadii, count: buttons.length };
}

/**
 * Each field's own buttons' Canvas radius before the change (measured 2026-10-28 on this test's
 * `open`, the arrays are per button — a NumberField stepper's own corners stay its template's;
 * Select · NumberField at S · M · L · XL re-measured 2026-10-30 after the field box corner 7 · 8 · 9 ·
 * 10). The change must leave every one as it was: each is its Button's own size corner (a ComboBox ·
 * date picker button is size S at every field size).
 */
const FIELD_BUTTON_RADII_BEFORE: ReadonlyArray<[string, string, unknown[]]> = [
  ["Select", "XS", [4]],
  ["Select", "S", [7]],
  ["Select", "M", [8]],
  ["Select", "L", [9]],
  ["Select", "XL", [10]],
  ["NumberField", "XS", [0, [0, 4, 4, 0]]],
  ["NumberField", "S", [0, [0, 7, 7, 0]]],
  ["NumberField", "M", [0, [0, 8, 8, 0]]],
  ["NumberField", "L", [0, [0, 9, 9, 0]]],
  ["NumberField", "XL", [0, [0, 10, 10, 0]]],
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
      // (The DOM: no inline corner over the sheet's `[data-field-button]` block — the rule's pill
      //  went inline and beat it in the Preview, 2026-10-30 live.)
      for (const tag of html.match(/<button[^>]*data-field-button[^>]*>/g) ?? [])
        expect(tag).not.toMatch(/border(-[a-z]+)*-radius:\s*9999px/);
    },
  );

  // The Popover component's trigger (2026-10-30 — 사용자 「popover 컴포넌트의 클릭하는 버튼
  // border-radius: S, M, L 모두 8px」): its template Button's own `radius: 8` beats the pill.
  it.each(["S", "M", "L"])(
    "the Popover at %s: its trigger Button is 8 (Canvas · DOM)",
    async (size) => {
      const { html, radii } = await open("Popover", size);
      expect(radii).toEqual([8]);
      expect(html).toMatch(
        /class="[^"]*react-aria-Button[^"]*"[^>]*border-radius:8px/,
      );
    },
  );

  // The Menu component's trigger (2026-10-30 — 사용자 「menu 컴포넌트의 클릭하는 버튼
  // border-radius: 8px」): its template Button's own `radius: 8` at every size.
  it.each(["XS", "S", "M", "L", "XL"])(
    "the Menu at %s: its trigger Button is 8 (Canvas · DOM)",
    async (size) => {
      const { html, radii } = await open("Menu", size);
      expect(radii).toEqual([8]);
      expect(html).toMatch(
        /class="[^"]*react-aria-Button[^"]*"[^>]*border-radius:8px/,
      );
    },
  );

  // The Tooltip component's trigger (2026-10-30 — 사용자 「tooltip 의 버튼 border-radius 8px」).
  it.each(["S", "M", "L"])(
    "the Tooltip at %s: its trigger Button is 8 (Canvas · DOM)",
    async (size) => {
      const { html, radii } = await open("Tooltip", size);
      expect(radii).toEqual([8]);
      expect(html).toMatch(
        /class="[^"]*react-aria-Button[^"]*"[^>]*border-radius:8px/,
      );
    },
  );

  // ToggleButton (2026-10-30 — 사용자 「ToggleButton, ToggleButtonGroup S:7, M:8, L:9, XL:10」).
  it.each([
    ["S", 7],
    ["M", 8],
    ["L", 9],
    ["XL", 10],
  ] as const)("a ToggleButton at %s is %i (Canvas)", async (size, radius) => {
    const { radii } = await open("ToggleButton", size, "togglebutton");
    expect(radii).toEqual([radius]);
  });

  // ToggleButtonGroup (2026-10-30 — 「ToggleButtonGroup 에 border-radius 불필요, ToggleButton 에」):
  // the group box has no corner; its ToggleButtons keep theirs.
  it.each([
    ["S", 7],
    ["M", 8],
    ["L", 9],
    ["XL", 10],
  ] as const)(
    "a ToggleButtonGroup at %s: no corner of its own, its ToggleButtons %i",
    async (size, radius) => {
      const group = await open("ToggleButtonGroup", size, "togglebuttongroup");
      expect(group.count).toBe(1);
      expect(group.radii.every((value) => !value)).toBe(true);
      const { radii } = await open("ToggleButtonGroup", size, "togglebutton");
      expect(radii.length).toBeGreaterThan(0);
      expect(radii.every((value) => value === radius)).toBe(true);
    },
  );

  // Pagination's page buttons (2026-10-30 — 사용자 「pagination 의 button S:7, M:8, L:9, XL:10」):
  // the Button's own size corner (its template buttons are size S), DOM `data-field-button`.
  it.each(["S", "M", "L"])(
    "the Pagination at %s: its buttons are 7 (size S) · data-field-button",
    async (size) => {
      const { html, radii } = await open("Pagination", size);
      expect(radii).toEqual([7, 7, 7, 7, 7]);
      expect(html.match(/data-field-button="S"/g)).toHaveLength(5);
      for (const tag of html.match(/<button[^>]*data-field-button[^>]*>/g)!)
        expect(tag).toMatch(/border-radius:7px/);
    },
  );

  // Dialog · Popover bodies (2026-10-30 — 사용자 「dialog · popover border-radius: size 상관없이 16px」).
  it.each([
    ["Dialog", "dialog", [""]],
    ["Popover", "popover", ["S", "M", "L"]],
  ] as const)("the %s body is 16 at every size it takes", async (type, binding, sizes) => {
    for (const size of sizes) {
      const { visualRadii, count } = await open(type, size, binding);
      expect(count).toBe(1);
      expect(visualRadii).toEqual([16]);
    }
  });

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
      "border-radius: 8px",
    );
  });
});
