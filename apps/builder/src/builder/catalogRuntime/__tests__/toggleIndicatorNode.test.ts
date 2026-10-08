// @vitest-environment jsdom
/**
 * Toggle indicator nodes (2026-10-04, user「1안」): Checkbox · Radio · Switch hold their indicator
 * box as a `CheckboxIndicator` / `RadioIndicator` / `SwitchIndicator` child before the Label, so the
 * Layers tree shows the DOM row (indicator element · label). Values stay in the toggle rule: the
 * node is sized from `size.indicator`, painted with the toggle's primitive and absorbed by the DOM.
 *
 * Oracle: the geometry before the node (main `6840c789c`, the Label carried the indicator inset as
 * `marginLeft` and the toggle painted its primitive at its own top-left) — every size. Three cases
 * change on purpose: an indicator taller than the label now sets the row height and the label is
 * centered against it (`align-items: center`, as the DOM's inline-flex row) — standalone Checkbox xl,
 * Switch sm · xl.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot } from "react-dom/client";
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
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import type { CatalogTextMeasure } from "../compositionRoot";
import { catalogDomRendersNode, renderCatalogDom } from "../domBinding";
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

/** Inserted palette type → the toggle under test (a Radio lives in a RadioGroup). */
const TOGGLES = {
  Checkbox: "checkbox",
  RadioGroup: "radio",
  Switch: "switch",
} as const;

/**
 * Per size: indicator box (rule `size.indicator`), toggle height, Label x / y. The Label x is the
 * old `marginLeft` inset (indicator + gap); `height` · `labelY` differ from it only where marked.
 */
const EXPECTED: Record<
  keyof typeof TOGGLES,
  Record<
    string,
    {
      box: [number, number];
      height: number;
      labelX: number;
      labelY: number;
      indicatorY: number;
    }
  >
> = {
  Checkbox: {
    sm: { box: [16, 16], height: 16, labelX: 22, labelY: 0, indicatorY: 0 },
    md: { box: [20, 20], height: 20, labelX: 28, labelY: 0, indicatorY: 0 },
    lg: { box: [24, 24], height: 24, labelX: 34, labelY: 0, indicatorY: 0 },
    // was height 28 · label y 0 (the 30px box overflowed the row)
    xl: { box: [30, 30], height: 30, labelX: 42, labelY: 1, indicatorY: 0 },
  },
  RadioGroup: {
    sm: { box: [16, 16], height: 16, labelX: 22, labelY: 0, indicatorY: 0 },
    md: { box: [20, 20], height: 20, labelX: 28, labelY: 0, indicatorY: 0 },
    lg: { box: [24, 24], height: 24, labelX: 34, labelY: 0, indicatorY: 0 },
    xl: { box: [30, 30], height: 30, labelX: 42, labelY: 1, indicatorY: 0 },
  },
  Switch: {
    // was height 24 · label y 4 (the track painted at y 0, above the padding)
    sm: { box: [32, 18], height: 26, labelX: 40, labelY: 5, indicatorY: 4 },
    md: { box: [36, 20], height: 28, labelX: 46, labelY: 4, indicatorY: 4 },
    lg: { box: [44, 24], height: 32, labelX: 56, labelY: 4, indicatorY: 4 },
    // was height 36 · label y 4
    xl: { box: [52, 30], height: 38, labelX: 66, labelY: 5, indicatorY: 4 },
  },
};

async function openToggle(owner: keyof typeof TOGGLES, size: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:toggle-indicator" as const,
        name: "Toggle indicator",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `toggle-indicator-${Math.random()}`),
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
          definitionId: catalogPaletteDefinitionId(library, owner),
          children: [],
          props: { size: { kind: "set", value: size } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: ["project:node:owner"],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const binding = TOGGLES[owner];
  const toggle = [...root.layoutInputs.values()].find(
    (record) => record.bindingId === binding,
  )!;
  const own = toggle.children.map((id) => root.layoutInputs.get(id)!);
  // ADR-256 Phase 3: a toggle drawn as RAC `*Field > *Button` holds its indicator and text in the
  // button (`button`) — the row the geometry below measures.
  const button = own.find((record) => record.bindingId === `${binding}button`);
  const kids = button
    ? button.children.map((id) => root.layoutInputs.get(id)!)
    : own;
  return { workspace, root, binding, toggle, button, kids };
}

const CASES = (Object.keys(TOGGLES) as (keyof typeof TOGGLES)[]).flatMap(
  (owner) => ["sm", "md", "lg", "xl"].map((size) => ({ owner, size })),
);

describe("toggle indicator node", () => {
  it.each(CASES)(
    "$owner $size: the indicator node holds the indicator box before the Label",
    async ({ owner, size }) => {
      const { workspace, root, binding, toggle, button, kids } =
        await openToggle(owner, size);
      expect(kids.map((record) => record.bindingId)).toEqual([
        `${binding}indicator`,
        "label",
      ]);
      const [indicator, label] = kids;
      const geometry = root.getGeometry([
        toggle.id,
        indicator.id,
        label.id,
        ...(button ? [button.id] : []),
      ]);
      // In the toggle's RAC button (the row) the parts' rects are the button's; the expected values
      // are the toggle's (the button sits at the toggle's padding).
      const offset = button ? geometry.get(button.id)! : { x: 0, y: 0 };
      const expected = EXPECTED[owner][size];
      const box = geometry.get(indicator.id)!;
      expect([box.width, box.height]).toEqual(expected.box);
      expect(offset.x + box.x).toBeCloseTo(0, 3);
      expect(offset.y + box.y).toBeCloseTo(expected.indicatorY, 3);
      expect(geometry.get(toggle.id)!.height).toBeCloseTo(expected.height, 3);
      expect(offset.x + geometry.get(label.id)!.x).toBeCloseTo(
        expected.labelX,
        3,
      );
      expect(offset.y + geometry.get(label.id)!.y).toBeCloseTo(
        expected.labelY,
        3,
      );
      workspace.dispose();
    },
  );

  it.each(Object.keys(TOGGLES) as (keyof typeof TOGGLES)[])(
    "%s: the DOM absorbs the indicator node (one RAC indicator element, no record element)",
    async (owner) => {
      const { workspace, root, kids } = await openToggle(owner, "md");
      const dom = [...root.domInputs.values()].find(
        (record) => record.sourceId === "project:node:owner",
      )!;
      const html = renderToStaticMarkup(renderCatalogDom(root, dom.id));
      expect(html).not.toContain(`data-catalog-id="${kids[0].id}"`);
      // The DOM-presence judgment (overlays · census) agrees with the render.
      expect(catalogDomRendersNode(root, kids[0].id)).toBe(false);
      // A Switch renders its `children` text (the Label child is bound to it), the others the Label.
      if (owner !== "Switch")
        expect(html).toContain(`data-catalog-id="${kids[1].id}"`);
      if (owner === "Checkbox")
        expect(html.match(/class="checkbox"/g)).toHaveLength(1);
      if (owner === "Switch")
        expect(html.match(/class="indicator"/g)).toHaveLength(1);
      workspace.dispose();
    },
  );

  it.each(Object.keys(TOGGLES) as (keyof typeof TOGGLES)[])(
    "%s: the indicator node paints the toggle's primitive; the toggle paints none",
    async (owner) => {
      const { workspace, root, toggle, kids } = await openToggle(owner, "md");
      const canvas = bindCatalogCanvas(root, root.pageRootRecords());
      const indicator = kids[0];
      const painted = getSkiaNode(indicator.id)!;
      expect(painted.children?.length ?? 0).toBeGreaterThan(0);
      expect(painted.elementId).toBe(indicator.id);
      const rect = root.getGeometry([indicator.id]).get(indicator.id)!;
      expect([painted.x, painted.y]).toEqual([rect.x, rect.y]);
      expect(getSkiaNode(toggle.id)!.children ?? []).toHaveLength(0);
      // The toggle's variant (its selected fill — the origin shows the selected display state)
      // reaches the indicator on a delta update: the indicator repaints with its owner
      // (`canvasBinding` update).
      if (owner !== "RadioGroup") {
        const paintOf = () => {
          const data = getSkiaNode(indicator.id)!;
          return JSON.stringify({ box: data.box, children: data.children });
        };
        const before = paintOf();
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id: "project:node:owner" as NodeId }],
            props: { variant: { kind: "set", value: "emphasized" } },
          }),
        );
        canvas.update();
        expect(paintOf()).not.toBe(before);
      }
      canvas.dispose();
      workspace.dispose();
    },
  );

  it("Checkbox: the indicator follows isSelected · isIndeterminate and paints the rule's indicator radius", async () => {
    // (2026-10-09) The origin shows the selected display state: an instance that authors
    // `isSelected` paints what it authored, as RAC does in the DOM; indeterminate paints the
    // selected box with its dash (`Checkbox.css` `[data-selected], [data-indeterminate]`); the box
    // radius is `size.indicator.boxRadius` (DOM `.checkbox` `--radius-sm`), not the toggle's own.
    const { workspace, root, kids } = await openToggle("Checkbox", "md");
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const indicator = kids[0];
    const set = (key: string, value: boolean) => {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: "project:node:owner" as NodeId }],
          props: { [key]: { kind: "set", value } },
        }),
      );
      canvas.update();
      const data = getSkiaNode(indicator.id)!;
      return {
        fill: JSON.stringify(data.box?.fillColor),
        lines:
          data.children?.filter((child) => child.type === "line").length ?? 0,
        radius: data.box?.borderRadius,
      };
    };
    const selected = set("isSelected", true);
    expect(selected.lines).toBe(2);
    expect(selected.radius).toBe(4);
    const unselected = set("isSelected", false);
    expect(unselected.lines).toBe(0);
    expect(unselected.fill).not.toBe(selected.fill);
    const indeterminate = set("isIndeterminate", true);
    expect(indeterminate.lines).toBe(1);
    expect(indeterminate.fill).toBe(selected.fill);
    expect(set("isSelected", true).lines).toBe(1);
    canvas.dispose();
    workspace.dispose();
  });

  it("Checkbox: invalid paints the box border — and a selected or indeterminate box — negative", async () => {
    // (2026-10-09) `Checkbox.css` `[data-invalid] .checkbox { border-color: var(--negative) }` and,
    // selected or indeterminate, `background: var(--negative)` (the check stays white).
    const { workspace, root, kids } = await openToggle("Checkbox", "md");
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    const set = (props: Record<string, boolean>) => {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: "project:node:owner" as NodeId }],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value },
            ]),
          ),
        }),
      );
      canvas.update();
      const box = getSkiaNode(kids[0].id)!.box!;
      return {
        fill: JSON.stringify(box.fillColor),
        stroke: JSON.stringify(box.strokeColor),
      };
    };
    const valid = set({ isSelected: false });
    const invalid = set({ isInvalid: true });
    expect(invalid.stroke).not.toBe(valid.stroke);
    expect(invalid.fill).toBe(valid.fill);
    const selected = set({ isSelected: true });
    expect(selected.fill).toBe(invalid.stroke);
    expect(selected.stroke).toBe(invalid.stroke);
    const indeterminate = set({ isSelected: false, isIndeterminate: true });
    expect(indeterminate.fill).toBe(invalid.stroke);
    const restored = set({ isInvalid: false, isIndeterminate: false });
    expect(restored).toEqual(valid);
    canvas.dispose();
    workspace.dispose();
  });

  it.each([
    ["sm", 16],
    ["md", 20],
    ["lg", 24],
    ["xl", 30],
  ] as const)(
    "Checkbox %s: the check and the dash are the DOM's lucide glyphs in the box's content area",
    async (size, box) => {
      // (2026-10-09) The DOM draws lucide `Check` (`M20 6 9 17l-5-5`) · `Minus` (`M5 12h14`),
      // viewBox 24, stroke 4, round caps, in the `.checkbox` content box: the 2px border inset, a
      // (box − 4) square (live: svg x 2 · width box − 4 · height box, `meet`).
      const { workspace, root, kids } = await openToggle("Checkbox", size);
      const canvas = bindCatalogCanvas(root, root.pageRootRecords());
      const k = (box - 4) / 24;
      const at = ([x, y]: readonly [number, number]) => [2 + x * k, 2 + y * k];
      const lines = () =>
        (getSkiaNode(kids[0].id)!.children ?? [])
          .filter((child) => child.type === "line")
          .map((child) => {
            const line = child.line!;
            return {
              from: [line.x1, line.y1],
              to: [line.x2, line.y2],
              width: line.strokeWidth,
              cap: line.strokeCap,
            };
          });
      const expectLines = (
        expected: readonly (readonly [number, number])[][],
      ) => {
        const actual = lines();
        expect(actual).toHaveLength(expected.length);
        actual.forEach((line, index) => {
          const [from, to] = expected[index].map(at);
          [...line.from, ...line.to].forEach((value, i) =>
            expect(value).toBeCloseTo([...from, ...to][i], 3),
          );
          expect(line.width).toBeCloseTo(4 * k, 3);
          expect(line.cap).toBe("round");
        });
      };
      expectLines([
        [
          [20, 6],
          [9, 17],
        ],
        [
          [9, 17],
          [4, 12],
        ],
      ]);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: "project:node:owner" as NodeId }],
          props: { isIndeterminate: { kind: "set", value: true } },
        }),
      );
      canvas.update();
      expectLines([
        [
          [5, 12],
          [19, 12],
        ],
      ]);
      canvas.dispose();
      workspace.dispose();
    },
  );

  it("Checkbox: a mounted DOM (the Preview) follows an isSelected edit", async () => {
    // RAC holds the selection uncontrolled (a Preview press toggles it): an authored change of the
    // default starts the element over, as the Tabs binding does with its default key (2026-10-09).
    const { workspace, root } = await openToggle("Checkbox", "md");
    const host = document.createElement("div");
    document.body.append(host);
    const mounted = createRoot(host);
    const render = () =>
      act(async () =>
        mounted.render(
          renderCatalogDom(
            root,
            [...root.domInputs.values()].find(
              (record) => record.sourceId === "project:node:owner",
            )!.id,
          ),
        ),
      );
    const selected = () =>
      host.querySelector(".react-aria-Checkbox")!.hasAttribute("data-selected");
    await render();
    expect(selected()).toBe(true);
    for (const value of [false, true]) {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: "project:node:owner" as NodeId }],
          props: { isSelected: { kind: "set", value } },
        }),
      );
      await render();
      expect(selected()).toBe(value);
    }
    act(() => mounted.unmount());
    host.remove();
    workspace.dispose();
  });

  it("Checkbox.css keeps the indeterminate dash (a stroked lucide Minus) stroked", () => {
    const sheet = readFileSync(
      resolve(
        __dirname,
        "../../../../../../packages/shared/src/components/styles/Checkbox.css",
      ),
      "utf8",
    );
    expect(sheet).not.toMatch(
      /\[data-indeterminate\]\s+svg\s*\{[^}]*stroke:\s*none/,
    );
  });

  it("the indicator position is not removable; the Label still is (hidden)", async () => {
    const { workspace, root, kids } = await openToggle("Checkbox", "md");
    const [indicator, label] = kids;
    const targetOf = (id: string) => workspace.positionOfRecord(id)!.target;
    let code: unknown;
    try {
      workspace.execute(removeTargets({ targets: [targetOf(indicator.id)] }));
    } catch (error) {
      code = (error as { code?: unknown }).code;
    }
    expect(code).toBe("OWNER_DRAWN_PART_NOT_REMOVABLE");
    expect(root.layoutInputs.has(indicator.id)).toBe(true);
    workspace.execute(removeTargets({ targets: [targetOf(label.id)] }));
    expect(root.layoutInputs.has(label.id)).toBe(false);
    workspace.dispose();
  });
});
