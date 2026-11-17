// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { catalogRuleShapes } from "../ruleShapes";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * S2 1.8.2 `FieldErrorIcon` (`Field.tsx` — TextField · TextArea · NumberField · ComboBox · ColorField
 * put it after the input in their `FieldGroup`; DateField · TimeField · DatePicker · DateRangePicker
 * through `InvalidIndicator`): an invalid, enabled field draws the alert glyph — `1lh`, start margin
 * `fontRelative(6)`, end margin `fontRelative(-2)` — in its box after the input. Not a node: the input
 * keeps its room (end padding), the Canvas draws it there and the DOM puts the glyph element over it.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place(origin: string, props: Record<string, unknown> = {}) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:field-error" as EntryId<"project">,
        name: "FieldErrorIcon",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `field-error-${Math.random()}`),
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
          id: PLACED,
          definitionId:
            `lib:definition:origin-component-${origin}` as LibraryDefinitionId,
          children: [],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [
              key,
              { kind: "set", value: value as never },
            ]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const owner = () =>
    [...root.domInputs.values()].find((record) => record.sourceId === PLACED)!;
  const inputs = () =>
    [...root.canvasInputs.values()].filter((record) =>
      ["Input", "DateInput"].includes(root.typeOf(record)),
    );
  const marked = () =>
    inputs().filter(
      (record) => typeof record.derivedProps?._fieldErrorIcon === "number",
    );
  const set = (values: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(owner().id)!.target],
        props: Object.fromEntries(
          Object.entries(values).map(([key, value]) => [
            key,
            { kind: "set", value: value as never },
          ]),
        ),
      }),
    );
  const html = () => {
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(renderCatalogDom(root, owner().id));
    return host;
  };
  return { root, inputs, marked, set, html };
}

const FIELDS = [
  "textfield",
  "textarea",
  "numberfield",
  "combobox",
  "colorfield",
  "datefield",
  "timefield",
  "datepicker",
  "daterangepicker",
];

describe("S2 FieldErrorIcon — an invalid field's alert glyph in its box", () => {
  it.each(FIELDS)(
    "%s: invalid → the last input keeps the glyph's room, both consumers draw it there",
    async (origin) => {
      const { root, inputs, marked, set, html } = await place(origin);
      expect(marked()).toEqual([]);
      expect(html().querySelector("[data-field-error-icon]")).toBeNull();
      const before = root.getDrawnLayoutStyle(inputs().at(-1)!.id);

      set({ isInvalid: true });
      const [input] = marked();
      expect(marked()).toHaveLength(1);
      // (the last input — a DateRangePicker's end)
      expect(input!.id).toBe(inputs().at(-1)!.id);
      // M: `1lh` of the control font (14 × 18/14), start 6, end −2 → room 22.
      expect(input!.derivedProps!._fieldErrorIcon).toBe(18);
      const own = Number.parseFloat(String(before?.paddingRight ?? 0));
      const end = Number(input!.derivedProps!._fieldErrorIconEnd);
      expect(end).toBeCloseTo(own - 2, 2);
      expect(
        Number.parseFloat(
          String(root.getDrawnLayoutStyle(input!.id)?.paddingRight),
        ),
      ).toBeCloseTo(own + 22, 2);

      // Canvas: the glyph at the input's end room.
      const record = root.canvasInputs.get(input!.id)!;
      const rect = root.getGeometry([input!.id]).get(input!.id)!;
      const glyph = catalogRuleShapes({
        type: root.typeOf(record),
        node: record,
        rule: root.runtime.graph.library.rules.get(record.ruleId!)!,
        rect: { x: 0, y: 0, width: rect.width, height: rect.height },
        authoredVisual: {},
        theme: "light",
      } as never).find(
        (shape) =>
          shape.type === "icon_font" &&
          (shape as { iconName?: string }).iconName === "triangle-alert",
      ) as { x: number; fontSize: number } | undefined;
      expect(glyph?.fontSize).toBe(18);
      expect(glyph!.x).toBeCloseTo(rect.width - end - 9, 2);

      // DOM: the glyph right after the input, taking no room of its own.
      const icon = html().querySelector<HTMLElement>(
        "[data-field-error-icon]",
      )!;
      expect(icon).not.toBeNull();
      // (a date field's RAC DateInput keeps its hidden form input after it)
      let previous = icon.previousElementSibling;
      while (previous && !previous.hasAttribute("data-catalog-id"))
        previous = previous.previousElementSibling;
      expect(previous?.getAttribute("data-catalog-id")).toBe(input!.id);
      expect(icon.style.width).toBe("18px");
      expect(icon.style.marginInlineEnd).toBe(`${end}px`);
      // Start margin = −(end + size) − the box's gap: net room 0 (jsdom folds the `calc`).
      const gap = Number.parseFloat(icon.parentElement!.style.columnGap || "0");
      expect(icon.style.marginInlineStart).toBe(`calc(${-(end + 18) - gap}px)`);

      // Disabled: no glyph (S2 `!isDisabled`), and back to valid: none.
      set({ isDisabled: true });
      expect(marked()).toEqual([]);
      expect(html().querySelector("[data-field-error-icon]")).toBeNull();
      set({ isDisabled: false, isInvalid: false });
      expect(marked()).toEqual([]);
      expect(
        Number.parseFloat(
          String(root.getDrawnLayoutStyle(input!.id)?.paddingRight ?? 0),
        ),
      ).toBeCloseTo(own, 2);
    },
  );

  it("SearchField draws none (S2 SearchField has no FieldErrorIcon)", async () => {
    const { marked, html } = await place("searchfield", { isInvalid: true });
    expect(marked()).toEqual([]);
    expect(html().querySelector("[data-field-error-icon]")).toBeNull();
  });
});
