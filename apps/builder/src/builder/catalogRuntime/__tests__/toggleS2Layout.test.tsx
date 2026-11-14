// @vitest-environment jsdom
/**
 * (2026-11-15, 사용자 「toggle 레이아웃 차이 3개 진행」) S2 1.8.2 `Checkbox.tsx` · `Switch.tsx` · `RadioGroup.tsx`:
 * ① a Radio's · a grouped Checkbox's help text starts in its label's column (the indicator + `text-to-control`);
 * ② the button ↔ help text distance is `field height − 1lh` (a Checkbox · Switch) or the group row gap
 *   1 · 1 · 2 · 2 (a Radio, a grouped Checkbox);
 * ③ the indicator sits on the label's first line — `(1lh − box) / 2` from the top of a top-aligned row
 *   (S2 `CenterBaseline`).
 * The Canvas boxes here; the DOM's inline margins for the derived channel and the sheet for the rest.
 */
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { resolveToken, ruleLengthCss } from "@composition/rendering";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogToggleItemHelpRefs } from "../../../../../../packages/shared/src/catalog/rule/toggleLayout";
import { catalogBindingKeepsOneLine } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const FIELD = "project:node:toggle" as NodeId;
const FONT = { S: "text-xs", M: "text-sm", L: "text-base", XL: "text-lg" };
type Size = keyof typeof FONT;
const px = (ref: string) => resolveToken(ref as never, "light") as number;
const lineOf = (size: Size) => px(`{typography.${FONT[size]}--line-height}`);
const boxOf = (size: Size) => px(`{size.height-sm.${size}}`);
const textToControl = (size: Size) =>
  (px(`{typography.${FONT[size]}}`) * 10) / 14;

async function open(origin: string, size: Size = "M") {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:toggle-s2" as const,
        name: "toggle S2 layout",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `toggle-s2-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: FIELD,
          definitionId: `lib:definition:origin-component-${origin}`,
          children: [],
          props: {
            description: { kind: "set", value: "Help" },
            size: { kind: "set", value: size },
          },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter(
      (record) => root.typeOf(record) === type,
    );
  /** The first item of `type` given its own help text (a group item has none by default). */
  const withHelp = (type: string) => {
    const [item] = of(type);
    workspace.execute(
      setFields({
        targets: [workspace.itemOfRecord(item.id)!.target],
        props: { description: { kind: "set", value: "Item help" } } as never,
      }),
    );
    return of(type)[0];
  };
  /** An item's indicator · button · help text boxes (relative to the item). */
  const boxes = (item: ReturnType<typeof of>[number]) => {
    const parts = [...root.canvasInputs.values()];
    const child = (parent: string, test: (type: string) => boolean) =>
      parts.find(
        (record) => record.parentId === parent && test(root.typeOf(record)),
      )!;
    const button = child(item.id, (type) => type.endsWith("Button"));
    const indicator = child(button.id, (type) => type.endsWith("Indicator"));
    const help = child(item.id, (type) => type === "Description");
    const geometry = root.getGeometry([button.id, indicator.id, help.id]);
    return {
      button: geometry.get(button.id)!,
      indicator: geometry.get(indicator.id)!,
      help: geometry.get(help.id)!,
      helpId: help.id,
    };
  };
  const domOf = (id: string) => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(
      renderCatalogDom(
        root,
        [...root.domInputs.values()].find(
          (record) => record.sourceId === FIELD,
        )!.id,
      ),
    );
    return host.querySelector(`[data-catalog-id="${id}"]`) as HTMLElement;
  };
  return { workspace, of, withHelp, boxes, domOf };
}

describe("toggle S2 field layout", () => {
  it.each(["checkbox", "switch"] as const)(
    "a standalone %s: help text under the indicator, field height − 1lh below the button; the indicator on the first line",
    async (origin) => {
      const { workspace, of, boxes } = await open(origin);
      try {
        const type = origin === "checkbox" ? "Checkbox" : "Switch";
        const { button, indicator, help } = boxes(of(type)[0]);
        expect(help.x).toBeCloseTo(button.x, 1);
        expect(help.y - (button.y + button.height)).toBeCloseTo(
          px("{size.height.M}") - lineOf("M"),
          1,
        );
        // (geometry is parent-relative — the indicator in its button)
        expect(indicator.y).toBeCloseTo(
          (lineOf("M") - boxOf("M")) / 2,
          1,
        );
        // ⓐ (2026-11-15): no block padding — S2's field has none (the Switch's old `paddingY: 4`).
        expect(button.y).toBe(0);
      } finally {
        workspace.dispose();
      }
    },
  );

  it.each([
    ["M", 1],
    ["L", 2],
  ] as const)(
    "a Radio's help text (%s): in its label's column, the group row gap %s below — Canvas and DOM",
    async (size, gap) => {
      const { workspace, withHelp, boxes } = await open(
        "radiogroup",
        size,
      );
      try {
        const { button, help } = boxes(withHelp("Radio"));
        expect(help.x - button.x).toBeCloseTo(
          boxOf(size) + textToControl(size),
          1,
        );
        expect(help.y - (button.y + button.height)).toBeCloseTo(gap, 1);
      } finally {
        workspace.dispose();
      }
    },
  );

  it.each([
    ["M", 1],
    ["L", 2],
  ] as const)(
    "a grouped Checkbox's help text (%s): in its label's column, %s below — Canvas and the DOM inline",
    async (size, gap) => {
      const { workspace, withHelp, boxes, domOf } = await open(
        "checkboxgroup",
        size,
      );
      try {
        const { button, help, helpId } = boxes(withHelp("Checkbox"));
        const start = boxOf(size) + textToControl(size);
        expect(help.x - button.x).toBeCloseTo(start, 1);
        expect(help.y - (button.y + button.height)).toBeCloseTo(gap, 1);
        // (the DOM writes the same refs as their device formulas — the touch set scales them)
        const refs = catalogToggleItemHelpRefs({ _toggleItemHelp: size })!;
        expect(px(refs.marginLeft)).toBeCloseTo(start, 1);
        expect(px(refs.marginTop)).toBeCloseTo(gap - textToControl(size), 1);
        // (jsdom's style object drops a `calc()` over `var()` — the attribute keeps it)
        const inline = domOf(helpId).getAttribute("style") ?? "";
        expect(inline).toContain(`margin-left:${ruleLengthCss(refs.marginLeft)}`);
        expect(inline).toContain(`margin-top:${ruleLengthCss(refs.marginTop)}`);
      } finally {
        workspace.dispose();
      }
    },
  );

  // ⓑ (2026-11-15): S2's label wraps in its `1fr` column — the toggle templates' `whiteSpace: normal`
  //   over the Label binding's one line, read by the DOM inline and the Canvas layout alike.
  it.each([
    ["checkbox", "Checkbox"],
    ["switch", "Switch"],
    ["radiogroup", "Radio"],
  ] as const)("a %s label wraps — the record, the Canvas layout rule and the DOM", async (origin, type) => {
    const { workspace, of, domOf } = await open(origin);
    try {
      const [item] = of(type);
      const label = of("Label").find((record) => {
        let parent = workspace.root.canvasInputs.get(record.parentId);
        while (parent && parent.id !== item.id)
          parent = workspace.root.canvasInputs.get(parent.parentId);
        return !!parent;
      })!;
      expect(label.visual.whiteSpace).toBe("normal");
      expect(catalogBindingKeepsOneLine(label)).toBe(false);
      expect(catalogBindingKeepsOneLine({ ...label, visual: {} })).toBe(true);
      expect(domOf(label.id).style.whiteSpace).toBe("normal");
    } finally {
      workspace.dispose();
    }
  });

  it("the sheet rows the button from the top and puts the indicator and the help text in place", () => {
    for (const [name, button, prefix] of [
      ["Checkbox", "CheckboxButton", "cb"],
      ["Radio", "RadioButton", "radio"],
      ["Switch", "SwitchButton", "sw"],
    ]) {
      const css = readFileSync(
        resolve(
          process.cwd(),
          `../../packages/shared/src/components/styles/generated/${name}.css`,
        ),
        "utf8",
      );
      expect(css).toMatch(
        new RegExp(`\\.react-aria-${button} \\{[^}]*align-items: flex-start`),
      );
      // (the indicator keeps its size beside a long label — the Canvas part rule's `flexShrink: 0`)
      expect(css).toMatch(
        new RegExp(`margin-top: var\\(--${prefix}-mark-top\\);\\s*flex-shrink: 0`),
      );
      expect(css).toContain(`margin-top: var(--${prefix}-help-top)`);
    }
  });
});
