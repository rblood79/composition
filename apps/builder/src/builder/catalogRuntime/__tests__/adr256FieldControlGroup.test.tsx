// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act, render } from "@testing-library/react";
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
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { bindCatalogCanvas } from "../canvasBinding";
import { renderCatalogDom } from "../domBinding";
import { catalogSpacingBands } from "../canvasSpacing";
import { catalogDrawnBoxModel } from "../drawnBoxModel";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 6b (G2) — a field's control box is a RAC `Group` node (`NumberField > Group >
 * Button + Input + Button`). Beyond the structure (`adr253FieldPartsDom` · `adr256FieldNodeTree`):
 * a stepper Button in the Group draws the field's state — a mounted Preview repaints it when the
 * field is disabled, as a fresh render does.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const cleanups: Array<() => void> = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0).reverse()) cleanup();
});

async function open(type: string) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-control-group" as EntryId<"project">,
        name: "Control group",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr256-control-group-${Math.random()}`),
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
          id: FIELD,
          definitionId: `lib:definition:origin-component-${type}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  cleanups.push(() => act(() => workspace.dispose()));
  return workspace;
}

describe("ADR-256 Phase 6b — a field's control box is a RAC Group node", () => {
  it("a NumberField's stepper in its Group repaints with the field's disabled state (mounted = fresh)", async () => {
    const workspace = await open("numberfield");
    const root = workspace.root;
    const field = root.recordsOfSource(FIELD)[0]!;
    const group = [...root.domInputs.values()].find(
      (record) => record.parentId === field && root.typeOf(record) === "Group",
    )!;
    expect(group).toBeTruthy();
    const stepper = group.children.find(
      (id) => root.domInputs.get(id)!.bindingId === "button",
    )!;
    // (Longhand by longhand: jsdom folds a parsed `margin-*` set with a `calc()` into a shorthand it
    //  cannot expand, but keeps the ones React sets one by one — the same values, two spellings.)
    const sides = ["top", "right", "bottom", "left"];
    const topLevelParts = (value: string) => {
      const parts: string[] = [];
      let depth = 0;
      let part = "";
      for (const char of value.trim()) {
        if (char === "(") depth++;
        if (char === ")") depth--;
        if (char === " " && depth === 0) {
          if (part) parts.push(part);
          part = "";
        } else part += char;
      }
      if (part) parts.push(part);
      return parts;
    };
    const styleIn = (container: ParentNode) =>
      (
        container.querySelector<HTMLElement>(
          `[data-catalog-id="${CSS.escape(stepper)}"]`,
        )?.style.cssText ?? ""
      )
        .split(/;(?![^(]*\))/)
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .flatMap((declaration) => {
          const at = declaration.indexOf(":");
          const name = declaration.slice(0, at).trim();
          const value = declaration.slice(at + 1).trim();
          if (name !== "margin" && name !== "padding")
            return [`${name}: ${value}`];
          const [top, right = top, bottom = top, left = right] =
            topLevelParts(value);
          return [top, right, bottom, left].map(
            (part, index) =>
              `${name}-${sides[index]}: ${part === "0" ? "0px" : part}`,
          );
        })
        .sort()
        .join("; ");
    const fresh = () => {
      const element = document.createElement("div");
      element.innerHTML = renderToStaticMarkup(renderCatalogDom(root, field));
      return styleIn(element);
    };
    const view = render(renderCatalogDom(root, field));
    cleanups.push(() => view.unmount());
    const enabled = styleIn(view.container);
    expect(enabled).toBe(fresh());
    act(() => {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { isDisabled: { kind: "set", value: true } },
        }),
      );
    });
    const disabled = fresh();
    // (2026-11-09: the disabled stepper's paint is the sheet's `[data-disabled]` block — no paint
    //  inline in either state, so the mounted element follows by its state attribute.)
    expect(disabled).toBe(enabled);
    expect(styleIn(view.container)).toBe(disabled);
    expect(
      view.container
        .querySelector(`[data-catalog-id="${CSS.escape(stepper)}"]`)!
        .getAttribute("data-disabled"),
    ).toBe("true");
  });

  // (2026-11-14, 사용자 「DateRangePicker 를 DatePicker 와 같은 방식으로」) The range Group is the field's
  //   box (S2 `FieldGroup` — `CATALOG_BOXED_FIELDS`): the Input rule's box on both consumers.
  it("a DateRangePicker's Group draws the Input rule's box on the Canvas", async () => {
    const workspace = await open("daterangepicker");
    const root = workspace.root;
    const field = root.recordsOfSource(FIELD)[0]!;
    const group = [...root.canvasInputs.values()].find(
      (record) => record.parentId === field && root.typeOf(record) === "Group",
    )!;
    // (No copy of the box paint on the record — the Input rule draws it, `fieldBoxShapeInput`.)
    expect(group.visual.fill).toBeUndefined();
    expect(group.visual.borderColor).toBeUndefined();
    const canvas = bindCatalogCanvas(root, root.pageRootRecords());
    cleanups.push(() => canvas.dispose());
    const box = getSkiaNode(group.id)?.box;
    // The light theme's field surface and border (a value the Canvas cannot read paints black).
    const [r, g, b, alpha] = box!.fillColor;
    expect(alpha).toBeGreaterThan(0);
    expect(Math.min(r!, g!, b!)).toBeGreaterThan(0.9);
    expect(box?.strokeWidth).toBe(2);
    expect(Math.max(...box!.strokeColor!.slice(0, 3))).toBeGreaterThan(0.5);
  });

  it("the DOM range Group is the field box (the Input sheet paints it and its states)", async () => {
    const workspace = await open("daterangepicker");
    const root = workspace.root;
    const field = root.recordsOfSource(FIELD)[0]!;
    const group = [...root.domInputs.values()].find(
      (record) => record.parentId === field && root.typeOf(record) === "Group",
    )!;
    const groupElement = () => {
      const element = document.createElement("div");
      element.innerHTML = renderToStaticMarkup(renderCatalogDom(root, field));
      return element.querySelector<HTMLElement>(
        `[data-catalog-id="${CSS.escape(group.id)}"]`,
      )!;
    };
    expect(groupElement().classList.contains("react-aria-FieldBox")).toBe(true);
    expect(groupElement().style.borderColor).toBe("");
    expect(groupElement().style.backgroundColor).toBe("");
    const target = workspace.positionOfRecord(group.id)!.target;
    act(() => {
      workspace.execute(
        setFields({
          targets: [target],
          visual: { fill: { kind: "set", value: "#ff0000" } },
        }),
      );
    });
    expect(groupElement().style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("the range row: start input at its content width, the dash, the end input filling, the button — the box's gap between, no margins", async () => {
    const workspace = await open("daterangepicker");
    const root = workspace.root;
    const field = root.recordsOfSource(FIELD)[0]!;
    const group = [...root.canvasInputs.values()].find(
      (record) => record.parentId === field && root.typeOf(record) === "Group",
    )!;
    const [start, dash, end, button] = group.children.map(
      (id) => root.canvasInputs.get(id)!,
    );
    expect([start, dash, end, button].map((part) => root.typeOf(part!))).toEqual([
      "DateInput",
      "Text",
      "DateInput",
      "Button",
    ]);
    const rect = (id: string) => root.getGeometry([id]).get(id)!;
    const input = (id: string) =>
      root.getLayoutInput(id) as Record<string, unknown>;
    // M: start padding = the Input's `edge-to-text` 12, end padding S2 4, gap 4.
    expect(input(group.id)).toMatchObject({
      paddingLeft: "12px",
      paddingRight: "4px",
      columnGap: "4px",
    });
    for (const part of [start!, end!])
      expect(input(part.id)).toMatchObject({
        paddingLeft: "0px",
        paddingRight: "0px",
        borderLeft: "0px",
      });
    expect(input(start!.id)).toMatchObject({ flexGrow: 0, flexBasis: "auto" });
    expect(input(end!.id)).toMatchObject({ flexGrow: 1 });
    for (const part of [start!, dash!, end!, button!])
      expect(
        ["marginLeft", "marginRight"].map((key) => input(part.id)[key] ?? "0px"),
      ).toEqual(["0px", "0px"]);
    const g = rect(group.id);
    expect(rect(start!.id).x).toBe(2 + 12);
    expect(rect(dash!.id).x).toBe(rect(start!.id).x + rect(start!.id).width + 4);
    expect(rect(end!.id).x).toBe(rect(dash!.id).x + rect(dash!.id).width + 4);
    expect(rect(button!.id).x).toBe(rect(end!.id).x + rect(end!.id).width + 4);
    expect(rect(button!.id).x + rect(button!.id).width).toBe(g.width - 2 - 4);
  });
});

describe("S2 NumberField — its control Group is the box, edited directly", () => {
  it("a padding written on the Group reaches the Canvas layout and the DOM box", async () => {
    const workspace = await open("numberfield");
    const root = () => workspace.root;
    const field = root().recordsOfSource(FIELD)[0]!;
    const groupOf = () =>
      [...root().domInputs.values()].find(
        (record) =>
          record.parentId === field && root().typeOf(record) === "Group",
      )!;
    act(() => {
      workspace.execute(
        setFields({
          targets: [
            {
              kind: "descendant",
              ownerId: FIELD,
              address: {
                instances: [FIELD],
                templatePath: [
                  "lib:template:component-numberfield",
                  "lib:template:component-numberfield__2",
                ],
              },
            } as never,
          ],
          visual: {
            paddingLeft: { kind: "set", value: 30 },
            paddingRight: { kind: "set", value: 30 },
          },
        }),
      );
    });
    const layout = root().getLayoutInput(groupOf().id) as Record<
      string,
      unknown
    >;
    expect([layout.paddingLeft, layout.paddingRight]).toEqual(["30px", "30px"]);
    const host = document.createElement("div");
    host.innerHTML = renderToStaticMarkup(renderCatalogDom(root(), field));
    const box = host.querySelector<HTMLElement>(".react-aria-FieldBox")!;
    expect([box.style.paddingLeft, box.style.paddingRight]).toEqual([
      "30px",
      "30px",
    ]);
  });

  it("S2's stepper spacing is the parts' own layout — the Group's gap · end padding, the Input's end padding — and an authored value wins on both sides", async () => {
    const workspace = await open("numberfield");
    const root = () => workspace.root;
    const field = root().recordsOfSource(FIELD)[0]!;
    const child = (type: string) =>
      [...root().domInputs.values()].find(
        (record) =>
          root().typeOf(record) === type &&
          (type === "Group"
            ? record.parentId === field
            : root().typeOf(root().domInputs.get(record.parentId)!) ===
              "Group"),
      )!;
    const layoutOf = (type: string) =>
      root().getLayoutInput(child(type).id) as Record<string, unknown>;
    // (Read the inline declaration itself: jsdom folds a unitless `padding-*: 0` set into a shorthand
    //  that misreads the side written after it.)
    const inline = (element: HTMLElement, property: string) =>
      new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+)`)
        .exec(element.getAttribute("style") ?? "")?.[1]
        ?.trim();
    const dom = () => {
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(renderCatalogDom(root(), field));
      return {
        box: host.querySelector<HTMLElement>(".react-aria-FieldBox")!,
        input: host.querySelector<HTMLElement>("input")!,
        buttons: [...host.querySelectorAll<HTMLElement>("button")],
      };
    };
    // Defaults (md): S2 stepper gap 4, end margin 4, the Input no end padding (사용자 2026-11-13 — the
    // gap is the room) — no margins.
    expect([
      layoutOf("Group").columnGap,
      layoutOf("Group").paddingRight,
      layoutOf("Input").paddingRight,
    ]).toEqual(["4px", "4px", "0px"]);
    let view = dom();
    expect([
      inline(view.box, "column-gap"),
      inline(view.box, "padding-right"),
      inline(view.input, "padding-right"),
    ]).toEqual(["4px", "4px", "0"]);
    for (const button of view.buttons)
      expect(button.style.marginLeft || "0px").toBe("0px");
    // Authored on the Group (gap 12 · end 10) and the Input (end 2): both consumers take them.
    const target = (path: string[]) =>
      ({
        kind: "descendant",
        ownerId: FIELD,
        address: { instances: [FIELD], templatePath: path },
      }) as never;
    act(() => {
      workspace.execute(
        setFields({
          targets: [
            target([
              "lib:template:component-numberfield",
              "lib:template:component-numberfield__2",
            ]),
          ],
          visual: {
            gap: { kind: "set", value: 12 },
            paddingRight: { kind: "set", value: 10 },
          },
        }),
      );
      workspace.execute(
        setFields({
          targets: [
            target([
              "lib:template:component-numberfield",
              "lib:template:component-numberfield__2",
              "lib:template:component-numberfield__2_1",
            ]),
          ],
          visual: { paddingRight: { kind: "set", value: 2 } },
        }),
      );
    });
    expect([
      layoutOf("Group").columnGap,
      layoutOf("Group").paddingRight,
      layoutOf("Input").paddingRight,
    ]).toEqual(["12px", "10px", "2px"]);
    view = dom();
    expect([
      inline(view.box, "column-gap"),
      inline(view.box, "padding-right"),
      inline(view.input, "padding-right"),
    ]).toEqual(["12px", "10px", "2px"]);
  });

  it("the drawn box model — Styles values, spacing handles — is the box the layout draws, not the record's empty one", async () => {
    const workspace = await open("numberfield");
    const root = workspace.root;
    const field = root.recordsOfSource(FIELD)[0]!;
    const group = [...root.domInputs.values()].find(
      (record) => record.parentId === field && root.typeOf(record) === "Group",
    )!;
    const input = [...root.domInputs.values()].find(
      (record) =>
        record.parentId === group.id && root.typeOf(record) === "Input",
    )!;
    // (md: start 12 · end 4 · gap 4 · border 2 — what the record alone gives as 0; the Input's end 0.)
    const box = catalogDrawnBoxModel(root, group);
    expect([box.padding, box.gap, box.borderWidth, box.display]).toEqual([
      { top: 0, right: 4, bottom: 0, left: 12 },
      4,
      2,
      "flex",
    ]);
    expect(catalogDrawnBoxModel(root, input).padding).toEqual({
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    // The spacing handles of the Group read the same values.
    const bounds = (id: string) => {
      const g = root.getGeometry([id]).get(id);
      return g ? { x: g.x, y: g.y, width: g.width, height: g.height } : undefined;
    };
    const bands = catalogSpacingBands(
      group,
      root.domInputs,
      bounds,
      {},
      (record) => catalogDrawnBoxModel(root, record),
    );
    const valueOf = (kind: string, side?: string) =>
      bands.find(
        (band) => band.kind === kind && (side === undefined || band.side === side),
      )?.value;
    expect([
      valueOf("padding", "left"),
      valueOf("padding", "right"),
      valueOf("gap"),
    ]).toEqual([12, 4, 4]);
  });
});
