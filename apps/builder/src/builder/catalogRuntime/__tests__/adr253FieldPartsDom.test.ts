import "fake-indexeddb/auto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { cssVarColor } from "../../../../../../packages/shared/src/catalog/runtime/rulePaint";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
  setLibraryDefault,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogSubpartOwnerType } from "../subpart";
import { catalogRuleShapes } from "../ruleShapes";
import { catalogAuthoredVisual } from "../../../../../../packages/shared/src/catalog/runtime/libraryVisual";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-253 Phase 3 (G3 — DOM 구조 대조): a field's parts are drawn from its part nodes (instances
 * of the part origins), and the document the Preview renders is the one the field composed from
 * its own props before.
 *
 * Oracle: `fixtures/adr253-field-dom.json` — the same catalog documents rendered by the build
 * before Phase 3 (main `1d66260dd`; written there with `ADR253_WRITE_DOM=1`). Structure =
 * elements, their attributes and text, in order; generated ids, the catalog markers and inline
 * style are not structure (what the parts draw is judged by the Canvas ↔ DOM comparison). Nor is
 * the `data-size` of a field's control: the Input node's element carries the field's size for the
 * Input rule's own sheet (before, the field's sheet sized it through variables).
 */
const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures/adr253-field-dom.json",
);
const TYPES = [
  "textfield",
  "textarea",
  "numberfield",
  "searchfield",
  "colorfield",
  "select",
  "combobox",
  "datefield",
  "timefield",
  "datepicker",
  "daterangepicker",
  "checkboxgroup",
  "radiogroup",
  "meter",
  "progressbar",
  "slider",
  "taggroup",
] as const;
const CASES: Record<string, Record<string, string | boolean>> = {
  default: {},
  required: { isRequired: true },
  "required, label indicator": {
    isRequired: true,
    necessityIndicator: "label",
  },
  "optional, label indicator": { necessityIndicator: "label" },
  "no label": { label: "" },
  description: { description: "Help text" },
  invalid: { isInvalid: true, errorMessage: "Not valid" },
  "side label": { labelPosition: "side" },
  "size sm": { size: "sm" },
  "size xl": { size: "xl" },
  disabled: { isDisabled: true },
  "read only": { isReadOnly: true },
  quiet: { isQuiet: true },
};
/**
 * Cases whose document differs from the fixture on purpose (Phase 3 — FieldError · Description):
 * the Preview did not render these fields' `description` · `errorMessage` at all (the Select ·
 * ComboBox binding and the groups' never passed them). They are part nodes now, drawn like every
 * other field's.
 */
const SHOWN_SINCE: Record<
  string,
  { selector: string; text: string; node: RegExp }
> = {
  "select/description": {
    selector: '[slot="description"]',
    text: "Help text",
    node: /component-select__description$/,
  },
  "select/invalid": {
    selector: ".react-aria-FieldError",
    text: "Not valid",
    node: /component-select__error$/,
  },
  "combobox/description": {
    selector: '[slot="description"]',
    text: "Help text",
    node: /component-combobox__description$/,
  },
  "combobox/invalid": {
    selector: ".react-aria-FieldError",
    text: "Not valid",
    node: /component-combobox__error$/,
  },
  "checkboxgroup/description": {
    selector: '[slot="description"]',
    text: "Help text",
    node: /component-checkboxgroup__description$/,
  },
  "radiogroup/description": {
    selector: '[slot="description"]',
    text: "Help text",
    node: /component-radiogroup__description$/,
  },
};
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const LABEL_ORIGIN =
  "lib:definition:origin-component-label" as LibraryDefinitionId;
const DESCRIPTION_ORIGIN =
  "lib:definition:origin-component-description" as LibraryDefinitionId;
const FIELD_ERROR_ORIGIN =
  "lib:definition:origin-component-fielderror" as LibraryDefinitionId;
const INPUT_ORIGIN =
  "lib:definition:origin-component-input" as LibraryDefinitionId;
/** Fields whose control is their Input node (an instance of the Input origin). */
const INPUT_TYPES = ["textfield", "textarea", "colorfield"] as const;
/**
 * The ColorField's Input node has a placeholder (`#000000`, drawn on the Canvas); the Preview's
 * own composition left it out. The node's element shows it.
 */
const INPUT_PLACEHOLDER_SINCE: Record<string, string> = {
  colorfield: " placeholder=#000000",
  numberfield: " placeholder=0",
};
/** Side label hint indent at md: the label column (11rem = 176) + the field's own md gap. */
const SIDE_INDENT: Record<string, number> = {
  textfield: 182,
  textarea: 182,
  numberfield: 182,
  searchfield: 184,
  select: 182,
  combobox: 182,
  datefield: 182,
  timefield: 182,
  datepicker: 180,
  daterangepicker: 180,
};
/** Fields whose Description · FieldError are part nodes. */
const HINT_TYPES = [
  "textfield",
  "textarea",
  "numberfield",
  "searchfield",
  "colorfield",
  "select",
  "combobox",
  "datefield",
  "timefield",
  "datepicker",
  "daterangepicker",
  "checkboxgroup",
  "radiogroup",
] as const;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const BUTTON_NODE_MARKS = [
  "data-variant",
  "data-fill-style",
  "data-size",
  "data-static-color",
];
/**
 * Fields whose control is a wrapper around part nodes (the Group of a NumberField): an Input
 * instance and Button instances. A Button's glyph is its Icon node — the Canvas glyph — where the
 * shared component drew its own svg, so the glyph markup is left out of the structure on both
 * sides and asserted on its own.
 */
const WRAPPED_TYPES = ["numberfield", "combobox", "searchfield", "select"];
const withoutGlyphs = (structure: string) =>
  structure
    .replace(/<svg [^>]*>(?:<(?:path|circle) [^>]*><\/>)*<\/>/g, "")
    .replace(/<div class=react-aria-Icon><\/>/g, "")
    // (A SearchField's leading glyph: the component's own wrapper before, the Icon node now.)
    .replace(/<span aria-hidden=true class=search-icon><\/>/g, "")
    // (A Select's trigger glyph: the component's own chevron wrapper before, the Icon node now.)
    .replace(/<span aria-hidden=true class=select-chevron><\/>/g, "");

/** A document's structure: elements, their attributes (sorted) and text, in order. */
function normalize(html: string): string {
  const walk = (element: Element): string => {
    const control = ["input", "textarea"].includes(
      element.tagName.toLowerCase(),
    );
    // A Button node's element carries the Button rule's marks (`button-base` · `data-*`): what
    // its sheet reads, as an Input's `data-size`.
    const button = element.tagName.toLowerCase() === "button";
    const attributes = [...element.attributes]
      .filter(
        (attribute) =>
          attribute.name !== "data-catalog-id" &&
          attribute.name !== "style" &&
          !(control && attribute.name === "data-size") &&
          !(button && BUTTON_NODE_MARKS.includes(attribute.name)),
      )
      .map((attribute) =>
        [
          "id",
          "for",
          "aria-labelledby",
          "aria-describedby",
          "aria-controls",
        ].includes(attribute.name)
          ? attribute.name
          : button && attribute.name === "class"
            ? `class=${attribute.value.replace(" button-base", "")}`
            : `${attribute.name}=${attribute.value}`,
      )
      .sort();
    const content = [...element.childNodes].map((child) =>
      child.nodeType === 1 ? walk(child as Element) : child.textContent,
    );
    return `<${element.tagName.toLowerCase()} ${attributes.join(" ")}>${content.join("")}</>`;
  };
  const host = document.createElement("div");
  host.innerHTML = html;
  return [...host.children].map(walk).join("\n");
}

/** The field with the case's props (a prop the field does not take is left out), as the DOM. */
async function render(
  type: string,
  authored: Record<string, string | boolean>,
) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr253-parts" as EntryId<"project">,
        name: "ADR-253 parts",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr253-parts-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
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
          definitionId:
            `lib:definition:origin-component-${type}` as LibraryDefinitionId,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  for (const [key, value] of Object.entries(authored))
    try {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { [key]: set(value) },
        }),
      );
    } catch {
      return undefined;
    }
  const field = [...workspace.root.domInputs.values()].find(
    (record) => record.sourceId === FIELD,
  )!;
  const html = renderToStaticMarkup(
    renderCatalogDom(workspace.root, field.id, {
      // A fixed day: the date fields' segments are the same in every run.
      today: () => undefined,
    }),
  );
  return { html, workspace, field };
}

/** Where the Canvas draws an Input node's text in its box: the start x and the end padding. */
function inputTextBand(workspace: CatalogWorkspace, id: string) {
  const root = workspace.root;
  const node = root.canvasInputs.get(id)!;
  const box = root.getGeometry([id]).get(id) as {
    width: number;
    height: number;
  };
  const text = catalogRuleShapes({
    node,
    rect: { width: box.width, height: box.height },
    rule: workspace.runtime.graph.library.rules.get("Input" as never)!,
    type: "Input",
    authoredVisual: catalogAuthoredVisual(root, node),
  }).find((shape) => shape.type === "text") as unknown as {
    x: number;
    paddingRight?: number;
  };
  return { x: text.x, paddingRight: text.paddingRight };
}

describe("ADR-253 Phase 3 — a field's DOM is the document it composed from its props before", () => {
  const write = process.env.ADR253_WRITE_DOM === "1";
  const fixture: Record<string, string> =
    !write && existsSync(FIXTURE)
      ? (JSON.parse(readFileSync(FIXTURE, "utf8")) as Record<string, string>)
      : {};
  const written: Record<string, string> = {};

  for (const type of TYPES)
    for (const [name, authored] of Object.entries(CASES))
      it(`${type} — ${name}`, async () => {
        const rendered = await render(type, authored);
        // The field does not take the case's prop: no such document.
        if (!rendered) {
          if (!write) expect(fixture[`${type}/${name}`]).toBeUndefined();
          return;
        }
        const structure = normalize(rendered.html);
        if (write) {
          written[`${type}/${name}`] = structure;
          return;
        }
        const shown = SHOWN_SINCE[`${type}/${name}`];
        if (!shown) {
          const placeholder = INPUT_PLACEHOLDER_SINCE[type];
          if (placeholder) expect(structure).toContain(placeholder);
          const glyphless = WRAPPED_TYPES.includes(type)
            ? withoutGlyphs
            : (text: string) => text;
          expect(
            glyphless(
              placeholder ? structure.replace(placeholder, "") : structure,
            ),
          ).toBe(glyphless(fixture[`${type}/${name}`]));
          return;
        }
        // The hint the Preview left out before: the part node's element, described to the control.
        expect(structure).not.toBe(fixture[`${type}/${name}`]);
        const host = document.createElement("div");
        host.innerHTML = rendered.html;
        const hint = host.querySelector(shown.selector)!;
        expect(hint?.textContent).toBe(shown.text);
        expect(hint.getAttribute("data-catalog-id")).toMatch(shown.node);
        const describedBy = [...host.querySelectorAll("[aria-describedby]")]
          .flatMap((element) =>
            element.getAttribute("aria-describedby")!.split(" "),
          )
          .filter(Boolean);
        expect(describedBy).toContain(hint.id);
      });

  it.runIf(write)("writes the fixture (the build before Phase 3)", () => {
    writeFileSync(FIXTURE, `${JSON.stringify(written, null, 1)}\n`);
  });

  /** The Label element is the field's Label node (an instance of the Label origin). */
  for (const type of TYPES)
    it.skipIf(write)(
      `${type} — its Label element is its Label node`,
      async () => {
        const rendered = (await render(type, {}))!;
        const { workspace, field } = rendered;
        const label = field.children
          .map((id) => workspace.root.domInputs.get(id)!)
          .find((child) => child.bindingId === "label")!;
        expect(label.collapsedSourceIds).toEqual([
          "lib:template:component-label",
        ]);
        // Its resolved font is the element's inline style (the Canvas reads the same record).
        const tag = new RegExp(
          `<(?:label|span)[^>]*data-catalog-id="${label.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`,
        ).exec(rendered.html)?.[0];
        expect(tag).toBeDefined();
        expect(tag).toMatch(/font-weight:\s*500/);
        expect(tag).toContain(`font-size:${label.visual.fontSize}px`);
      },
    );

  /** The Label rule sizes the Label at its field's size (no field rule declares a Label font). */
  for (const type of TYPES)
    it.skipIf(write)(`${type} — its size sizes its Label`, async () => {
      const large = await render(type, { size: "lg" });
      const label = large!.field.children
        .map((id) => large!.workspace.root.canvasInputs.get(id)!)
        .find((child) => child.bindingId === "label")!;
      expect(label.props.size).toBe("lg");
      expect(label.visual.fontSize).toBe(16);
      expect(
        Number(label.visual.lineHeight) * Number(label.visual.fontSize),
      ).toBeCloseTo(24, 5);
      expect(label.visual.fontWeight).toBe(500);
    });

  /**
   * The Label origin is the one place every field's Label takes its style from: an edit there
   * reaches each field's Label on the Canvas and in the DOM, a second edit as well (a value-only
   * step), and a style written on one field's Label stays that Label's.
   */
  for (const type of TYPES)
    it.skipIf(write)(
      `${type} — its Label follows the Label origin, its own style on top`,
      async () => {
        const { workspace, field } = (await render(type, {}))!;
        const label = () => {
          const record = workspace.root.domInputs
            .get(field.id)!
            .children.map((id) => workspace.root.domInputs.get(id)!)
            .find((child) => child.bindingId === "label")!;
          return {
            dom: record,
            canvas: workspace.root.canvasInputs.get(record.id)!,
          };
        };
        const originColor = (value: string) =>
          workspace.execute(
            setLibraryDefault({
              definitionId: LABEL_ORIGIN,
              scope: "visual",
              key: "color",
              write: set(value),
              newId: workspace.newId,
            }),
          );
        for (const color of ["#ff0000", "#0000ff"]) {
          originColor(color);
          expect(label().canvas.visual.color).toBe(color);
          expect(label().dom.visual.color).toBe(color);
        }
        const html = () =>
          renderToStaticMarkup(
            renderCatalogDom(workspace.root, field.id, {
              today: () => undefined,
            }),
          );
        expect(html()).toMatch(
          /<(label|span)[^>]*style="[^"]*color:\s*#0000ff/,
        );
        // The Label's style is its own to edit (the Styles panel's target), its text the field's.
        const graph = workspace.runtime.graph;
        const records = workspace.root.domInputs;
        expect(
          catalogSubpartOwnerType(graph, records, label().dom.id, "style"),
        ).toBeNull();
        expect(
          catalogSubpartOwnerType(graph, records, label().dom.id, "all"),
        ).not.toBeNull();
        workspace.execute(
          setFields({
            targets: [workspace.itemOfRecord(label().dom.id)!.target],
            visual: { color: set("#00aa00") },
          }),
        );
        expect(label().canvas.visual.color).toBe("#00aa00");
        expect(html()).toMatch(
          /<(label|span)[^>]*style="[^"]*color:\s*#00aa00/,
        );
        // The origin edited again: the Label that wrote its own color keeps it.
        originColor("#123456");
        expect(label().canvas.visual.color).toBe("#00aa00");
      },
    );

  /**
   * The hint parts (FieldError · Description): instances of their origins. The Canvas shows the
   * Description while the field has one and the FieldError while the field is invalid with a
   * message — the DOM leaves both to RAC inside the field's context.
   */
  for (const type of HINT_TYPES)
    it.skipIf(write)(
      `${type} — its Description · FieldError are part nodes`,
      async () => {
        const { workspace, field } = (await render(type, {}))!;
        const part = (binding: string) => {
          const record = workspace.root.canvasInputs
            .get(field.id)!
            .children.map((id) => workspace.root.canvasInputs.get(id)!)
            .find((child) => child.bindingId === binding)!;
          return record;
        };
        const write = (props: Record<string, string | boolean>) =>
          workspace.execute(
            setFields({
              targets: [{ kind: "node", id: FIELD }],
              props: Object.fromEntries(
                Object.entries(props).map(([key, value]) => [key, set(value)]),
              ),
            }),
          );
        expect(part("description").collapsedSourceIds).toEqual([
          "lib:template:component-description",
        ]);
        expect(part("fielderror").collapsedSourceIds).toEqual([
          "lib:template:component-fielderror",
        ]);
        // At rest: neither shows.
        expect(part("description").hidden).toBe(true);
        expect(part("fielderror").hidden).toBe(true);
        write({ description: "Help text" });
        expect(part("description").hidden).toBeUndefined();
        expect(part("description").props.children).toBe("Help text");
        // Invalid without a message: nothing to show (RAC renders its own errors at run time).
        write({ isInvalid: true });
        expect(part("fielderror").hidden).toBe(true);
        write({ errorMessage: "Not valid" });
        expect(part("fielderror").hidden).toBeUndefined();
        expect(part("fielderror").props.children).toBe("Not valid");
        // Each is sized by its own rule at the field's size (md = text-xs).
        for (const binding of ["description", "fielderror"]) {
          expect(part(binding).props.size).toBe("md");
          expect(part(binding).visual.fontSize).toBe(12);
        }
        write({ size: "lg" });
        for (const binding of ["description", "fielderror"])
          expect(part(binding).visual.fontSize).toBe(14);
        // The origins are the one place their style comes from; the part's own style stays on top.
        for (const [origin, binding] of [
          [DESCRIPTION_ORIGIN, "description"],
          [FIELD_ERROR_ORIGIN, "fielderror"],
        ] as const) {
          for (const color of ["#ff0000", "#0000ff"]) {
            workspace.execute(
              setLibraryDefault({
                definitionId: origin,
                scope: "visual",
                key: "color",
                write: set(color),
                newId: workspace.newId,
              }),
            );
            expect(part(binding).visual.color).toBe(color);
            expect(
              workspace.root.domInputs.get(part(binding).id)!.visual.color,
            ).toBe(color);
          }
          expect(
            catalogSubpartOwnerType(
              workspace.runtime.graph,
              workspace.root.domInputs,
              part(binding).id,
              "style",
            ),
          ).toBeNull();
          expect(
            catalogSubpartOwnerType(
              workspace.runtime.graph,
              workspace.root.domInputs,
              part(binding).id,
              "all",
            ),
          ).not.toBeNull();
        }
        write({ description: "", isInvalid: false });
        expect(part("description").hidden).toBe(true);
        expect(part("fielderror").hidden).toBe(true);
        // The DOM: the same nodes' elements, with the origin's color.
        write({ description: "Help text", isInvalid: true });
        const html = renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id, {
            today: () => undefined,
          }),
        );
        for (const binding of ["description", "fielderror"]) {
          const id = part(binding).id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          expect(html).toMatch(
            new RegExp(
              `<span[^>]*data-catalog-id="${id}"[^>]*style="[^"]*color:\\s*#0000ff`,
            ),
          );
        }
      },
    );

  /**
   * The control (Input): an instance of the Input origin, drawn in the DOM by its own node — a RAC
   * Input inside the field's context. Its box is the Input rule's sheet at the field's size
   * (`data-size`); the element's inline style carries only what the document wrote.
   */
  for (const type of INPUT_TYPES)
    it.skipIf(write)(`${type} — its control is its Input node`, async () => {
      const rendered = (await render(type, {}))!;
      const { workspace, field } = rendered;
      const input = () =>
        workspace.root.canvasInputs
          .get(field.id)!
          .children.map((id) => workspace.root.canvasInputs.get(id)!)
          .find((child) => child.ruleId === "Input")!;
      const element = (html: string) => {
        const host = document.createElement("div");
        host.innerHTML = html;
        return host.querySelector<HTMLElement>(
          `[data-catalog-id="${input().id}"]`,
        )!;
      };
      const html = () =>
        renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id, {
            today: () => undefined,
          }),
        );
      expect(input().collapsedSourceIds).toEqual([
        "lib:template:component-input",
      ]);
      // The element: the control RAC wires to the field (id ← the Label's `for`), sized by the
      // rule's sheet — no resolved box inline.
      const control = element(html());
      expect(control.tagName).toBe(type === "textarea" ? "TEXTAREA" : "INPUT");
      expect(control.getAttribute("data-size")).toBe("md");
      expect(control.getAttribute("style") ?? "").not.toMatch(
        /padding|border|background|font-size/,
      );
      // The Input rule sizes it at the field's size (no field rule declares an Input shape).
      expect(input().props.size).toBe("md");
      expect(input().visual).toMatchObject({
        paddingY: 4,
        paddingX: 12,
        fontSize: 14,
        radius: 6,
        borderWidth: 1,
      });
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { size: set("lg") },
        }),
      );
      expect(input().props.size).toBe("lg");
      expect(input().visual).toMatchObject({
        paddingY: 8,
        paddingX: 16,
        fontSize: 16,
        radius: 8,
      });
      expect(
        Number(input().visual.lineHeight) * Number(input().visual.fontSize),
      ).toBeCloseTo(24, 5);
      expect(element(html()).getAttribute("data-size")).toBe("lg");
      // The Input origin is the one place its style comes from — a second edit as well — and it
      // reaches the element as inline style over the sheet.
      for (const color of ["#ff0000", "#0000ff"]) {
        workspace.execute(
          setLibraryDefault({
            definitionId: INPUT_ORIGIN,
            scope: "visual",
            key: "borderColor",
            write: set(color),
            newId: workspace.newId,
          }),
        );
        expect(input().visual.borderColor).toBe(color);
        expect(
          workspace.root.domInputs.get(input().id)!.visual.borderColor,
        ).toBe(color);
      }
      expect(element(html()).getAttribute("style")).toMatch(
        /border-color:\s*#0000ff/,
      );
      // Its style is its own to edit; its text (placeholder · type) is the field's.
      const graph = workspace.runtime.graph;
      const records = workspace.root.domInputs;
      expect(
        catalogSubpartOwnerType(graph, records, input().id, "style"),
      ).toBeNull();
      expect(
        catalogSubpartOwnerType(graph, records, input().id, "all"),
      ).not.toBeNull();
      workspace.execute(
        setFields({
          targets: [workspace.itemOfRecord(input().id)!.target],
          visual: { borderColor: set("#00aa00") },
        }),
      );
      expect(input().visual.borderColor).toBe("#00aa00");
      expect(element(html()).getAttribute("style")).toMatch(
        /border-color:\s*#00aa00/,
      );
      workspace.execute(
        setLibraryDefault({
          definitionId: INPUT_ORIGIN,
          scope: "visual",
          key: "borderColor",
          write: set("#123456"),
          newId: workspace.newId,
        }),
      );
      expect(input().visual.borderColor).toBe("#00aa00");
    });

  /**
   * A NumberField's control: the Group (the wrapper node — placement only) holds an instance of the
   * Input origin and two instances of the Button origin, each drawn in the DOM by its own node
   * inside the field's RAC context. The steppers keep what that context gives them (their slot's
   * press handlers, disabled at the value's limit or with the field).
   */
  it.skipIf(write)(
    "numberfield — its Group holds an Input instance and two Button instances",
    async () => {
      const { workspace, field } = (await render("numberfield", {}))!;
      const records = workspace.root.canvasInputs;
      const typeOf = (id: string) =>
        workspace.runtime.graph.getDefinition(
          records.get(id)!.definitionId as LibraryDefinitionId,
        )!.name;
      const wrapper = () =>
        records
          .get(field.id)!
          .children.map((id) => records.get(id)!)
          .find((child) => typeOf(child.id) === "SelectTrigger")!;
      const parts = () => wrapper().children.map((id) => records.get(id)!);
      const html = () =>
        renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id, {
            today: () => undefined,
          }),
        );
      const host = () => {
        const element = document.createElement("div");
        element.innerHTML = html();
        return element;
      };
      const rect = (id: string) =>
        workspace.root.getGeometry([id]).get(id) as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      // The wrapper paints nothing; its parts are the origins' instances.
      expect(wrapper().visual).toMatchObject({
        fill: "transparent",
        borderWidth: 0,
        paddingX: 0,
        paddingY: 0,
      });
      expect(parts().map((part) => typeOf(part.id))).toEqual([
        "Input",
        "Button",
        "Button",
      ]);
      expect(parts().map((part) => part.collapsedSourceIds)).toEqual([
        ["lib:template:component-input"],
        ["lib:template:component-button"],
        ["lib:template:component-button"],
      ]);
      const [input, decrement, increment] = parts();
      // Canvas: the Input fills the Group; a stepper is as wide as the control is high and
      // overlaps its neighbour's border by 1px; its glyph (an Icon node) is centered in it.
      const group = rect(wrapper().id);
      expect(group.height).toBe(30);
      expect(rect(input.id)).toMatchObject({ height: 30 });
      for (const stepper of [decrement, increment]) {
        expect(rect(stepper.id)).toMatchObject({ width: 30, height: 30 });
        expect(stepper.props).toMatchObject({
          variant: "secondary",
          size: "md",
        });
        const glyph = records.get(stepper.children[0]!)!;
        expect(typeOf(glyph.id)).toBe("Icon");
        expect(glyph.visual.iconSize).toBe(18);
        // (A record's box is from its parent's.)
        const icon = rect(glyph.id);
        expect(icon).toMatchObject({ x: 6, width: 18 });
        expect(icon.y * 2 + icon.height).toBe(30);
      }
      expect(rect(decrement.id).x).toBe(
        rect(input.id).x + rect(input.id).width - 1,
      );
      expect(rect(increment.id).x + 30).toBe(group.width);
      // The square corners on the touching sides are written on the template positions.
      expect(input.visual).toMatchObject({
        radius: 6,
        radiusTopRight: 0,
        radiusBottomRight: 0,
      });
      expect(decrement.visual.radius).toBe(0);
      expect(increment.visual).toMatchObject({
        radiusTopLeft: 0,
        radiusBottomLeft: 0,
      });
      // DOM: the Group's children are those nodes' elements, in order.
      const groupElement = host().querySelector(".react-aria-Group")!;
      expect(
        [...groupElement.children].map((child) =>
          child.getAttribute("data-catalog-id"),
        ),
      ).toEqual(parts().map((part) => part.id));
      const stepperElements = () => [
        ...host().querySelectorAll<HTMLElement>(".react-aria-Group > button"),
      ];
      expect(stepperElements().map((button) => button.slot)).toEqual([
        "decrement",
        "increment",
      ]);
      for (const button of stepperElements()) {
        expect(button.getAttribute("data-variant")).toBe("secondary");
        expect(button.getAttribute("data-size")).toBe("md");
        expect(button.querySelector(".react-aria-Icon svg")).not.toBeNull();
      }
      // Their paint is the Button rule's sheet (hover · pressed · disabled change it): no rest
      // color inline.
      for (const button of stepperElements())
        expect(button.getAttribute("style") ?? "").not.toMatch(
          /background-color|border-color|(^|;)color:/,
        );
      // RAC's context reaches them (nothing the document did not write is passed): the value 0 is
      // the minimum — decrease is disabled, increase is not; a disabled field disables both.
      expect(
        stepperElements().map((button) => button.hasAttribute("disabled")),
      ).toEqual([true, false]);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { minValue: set(-5) as never, isDisabled: set(false) },
        }),
      );
      expect(
        stepperElements().map((button) => button.hasAttribute("disabled")),
      ).toEqual([false, false]);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { isDisabled: set(true) },
        }),
      );
      expect(
        stepperElements().map((button) => button.hasAttribute("disabled")),
      ).toEqual([true, true]);
      // A disabled field fades once, at its root (as the Canvas draws it): its steppers keep
      // their rest paint and do not fade again.
      for (const button of stepperElements()) {
        expect(button.getAttribute("style")).toMatch(
          /background-color:\s*#fafafa/,
        );
        expect(button.getAttribute("style")).toMatch(/opacity:\s*1(;|$)/);
      }
      expect(parts().map((part) => part.visual.opacity)).toEqual([
        undefined,
        undefined,
        undefined,
      ]);
      // The field's size reaches the parts through the wrapper.
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { size: set("xl"), isDisabled: set(false) },
        }),
      );
      expect(parts().map((part) => part.props.size)).toEqual([
        "xl",
        "xl",
        "xl",
      ]);
      expect(rect(parts()[1]!.id)).toMatchObject({ width: 54, height: 54 });
      expect(records.get(parts()[1]!.children[0]!)!.visual.iconSize).toBe(28);
      expect(rect(parts()[0]!.id).height).toBe(54);
      // The origins are where their style comes from: the Button origin's reaches the steppers,
      // the Input origin's the value — on the Canvas and in the DOM.
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "fill",
          write: set("#ff0000"),
          newId: workspace.newId,
        }),
      );
      workspace.execute(
        setLibraryDefault({
          definitionId: INPUT_ORIGIN,
          scope: "visual",
          key: "borderColor",
          write: set("#0000ff"),
          newId: workspace.newId,
        }),
      );
      expect(
        parts().map((part) => part.visual.fill ?? part.visual.borderColor),
      ).toEqual(["#0000ff", "#ff0000", "#ff0000"]);
      for (const button of stepperElements())
        expect(button.getAttribute("style")).toMatch(
          /--button-color:\s*#ff0000/,
        );
      expect(
        host()
          .querySelector(".react-aria-Group > input")!
          .getAttribute("style"),
      ).toMatch(/border-color:\s*#0000ff/);
      // The Input's text (placeholder · type) is the field's; its style and a stepper's are their
      // own; the wrapper stays the field's.
      const graph = workspace.runtime.graph;
      const dom = workspace.root.domInputs;
      expect(
        catalogSubpartOwnerType(graph, dom, parts()[0]!.id, "style"),
      ).toBeNull();
      expect(catalogSubpartOwnerType(graph, dom, parts()[0]!.id, "all")).toBe(
        "NumberField",
      );
      expect(
        catalogSubpartOwnerType(graph, dom, parts()[1]!.id, "style"),
      ).toBeNull();
      expect(catalogSubpartOwnerType(graph, dom, wrapper().id, "style")).toBe(
        "NumberField",
      );
    },
  );

  /**
   * A ComboBox's control: the container (the wrapper node — placement only) holds an instance of
   * the Input origin, which draws the box with room for the button at its end, and an instance of
   * the FieldButton origin (an instance of the Button origin with the field button's shape) laid
   * over that room. Both are drawn in the DOM by their own nodes inside the ComboBox's context.
   */
  it.skipIf(write)(
    "combobox — its container holds an Input instance and a FieldButton instance",
    async () => {
      const { workspace, field } = (await render("combobox", {}))!;
      const records = workspace.root.canvasInputs;
      const typeOf = (id: string) =>
        workspace.runtime.graph.getDefinition(
          records.get(id)!.definitionId as LibraryDefinitionId,
        )!.name;
      const wrapper = () =>
        records
          .get(field.id)!
          .children.map((id) => records.get(id)!)
          .find((child) => typeOf(child.id) === "SelectTrigger")!;
      const parts = () => wrapper().children.map((id) => records.get(id)!);
      const host = () => {
        const element = document.createElement("div");
        element.innerHTML = renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id, {
            today: () => undefined,
          }),
        );
        return element;
      };
      const rect = (id: string) =>
        workspace.root.getGeometry([id]).get(id) as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      expect(wrapper().visual).toMatchObject({
        fill: "transparent",
        borderWidth: 0,
        paddingX: 0,
      });
      expect(parts().map((part) => typeOf(part.id))).toEqual([
        "Input",
        "Button",
      ]);
      expect(parts().map((part) => part.collapsedSourceIds)).toEqual([
        ["lib:template:component-input"],
        ["lib:template:component-fieldbutton", "lib:template:component-button"],
      ]);
      const [input, button] = parts();
      // Canvas: the Input is the whole control; the button is a square 4px inside its end.
      const group = rect(wrapper().id);
      expect(rect(input.id)).toMatchObject({
        x: 0,
        width: group.width,
        height: 30,
      });
      expect(input.visual).toMatchObject({ paddingX: 12, paddingRight: 34 });
      // (The end padding keeps the text clear of the button; its start stays the Input's own.)
      expect(inputTextBand(workspace, input.id)).toEqual({
        x: 12,
        paddingRight: 34,
      });
      expect(rect(button.id)).toMatchObject({
        x: group.width - 26,
        y: 4,
        width: 22,
        height: 22,
      });
      expect(button.visual).toMatchObject({
        fill: "var(--accent-subtle)",
        borderWidth: 0,
        radius: 4,
      });
      const glyph = records.get(button.children[0]!)!;
      expect(glyph.props.iconName).toBe("chevron-down");
      expect(rect(glyph.id)).toMatchObject({ x: 2, y: 2, width: 18 });
      // The field's `placeholder` and `iconName` reach the parts (template bindings).
      expect(input.props.placeholder).toBe("Type or select...");
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { placeholder: set("Pick one"), iconName: set("search") },
        }),
      );
      expect(parts()[0]!.props.placeholder).toBe("Pick one");
      expect(records.get(parts()[1]!.children[0]!)!.props.iconName).toBe(
        "search",
      );
      // DOM: the container's children are those nodes' elements; the Input is the combobox RAC
      // wires, the button its trigger. The button's authored fill is the sheet's own variable,
      // so its hover and pressed colors derive from it.
      const container = host().querySelector(
        ".combobox-container:not(template *)",
      )!;
      expect(
        [...container.children].map((child) =>
          child.getAttribute("data-catalog-id"),
        ),
      ).toEqual(parts().map((part) => part.id));
      const inputElement = container.querySelector("input")!;
      expect(inputElement.getAttribute("role")).toBe("combobox");
      expect(inputElement.getAttribute("placeholder")).toBe("Pick one");
      expect(inputElement.getAttribute("data-size")).toBe("md");
      const buttonElement = container.querySelector("button")!;
      expect(buttonElement.getAttribute("aria-haspopup")).toBe("listbox");
      const style = buttonElement.getAttribute("style")!;
      expect(style).toMatch(/--button-color:\s*var\(--accent-subtle\)/);
      expect(style).toMatch(/--button-color-hover:\s*initial/);
      expect(style).not.toMatch(/background-color|border-color/);
      // (The sheet gives every Button a border: the one the FieldButton removes is written out.)
      expect(style).toMatch(/border-width:\s*0(;|$)/);
      // The field's size reaches the parts.
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { size: set("xl") },
        }),
      );
      expect(parts().map((part) => part.props.size)).toEqual(["xl", "xl"]);
      expect(rect(parts()[1]!.id)).toMatchObject({
        width: 46,
        height: 46,
        y: 4,
      });
      expect(parts()[0]!.visual.paddingRight).toBe(70);
      // The FieldButton origin is where the button's shape comes from; it is itself an instance
      // of the Button origin, whose style reaches it under the FieldButton's own.
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-fieldbutton" as LibraryDefinitionId,
          scope: "visual",
          key: "fill",
          write: set("#ff0000"),
          newId: workspace.newId,
        }),
      );
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "color",
          write: set("#00aa00"),
          newId: workspace.newId,
        }),
      );
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "fill",
          write: set("#0000ff"),
          newId: workspace.newId,
        }),
      );
      expect(parts()[1]!.visual).toMatchObject({
        fill: "#ff0000",
        color: "#00aa00",
      });
      const edited = host()
        .querySelector(".combobox-container:not(template *) button")!
        .getAttribute("style")!;
      expect(edited).toMatch(/--button-color:\s*#ff0000/);
      expect(edited).toMatch(/--button-text:\s*#00aa00/);
      // Edit axes: the Input's text is the field's, its style and the button's are their own.
      const graph = workspace.runtime.graph;
      const dom = workspace.root.domInputs;
      expect(
        catalogSubpartOwnerType(graph, dom, parts()[0]!.id, "style"),
      ).toBeNull();
      expect(catalogSubpartOwnerType(graph, dom, parts()[0]!.id, "all")).toBe(
        "ComboBox",
      );
      expect(
        catalogSubpartOwnerType(graph, dom, parts()[1]!.id, "style"),
      ).toBeNull();
    },
  );

  /**
   * A Select's control: RAC's trigger is the Button itself, so the trigger node is an instance of
   * the Button origin (secondary) — its paint and states are the Button rule's — holding the value
   * (RAC `SelectValue`, the field's own sub-part) and the glyph (an Icon node). The field places
   * it: full width, a smaller end padding beside the glyph, the value ↔ glyph gap.
   */
  it.skipIf(write)(
    "select — its trigger is a Button instance holding the value and the glyph",
    async () => {
      const { workspace, field } = (await render("select", {}))!;
      const records = workspace.root.canvasInputs;
      const typeOf = (id: string) =>
        workspace.runtime.graph.getDefinition(
          records.get(id)!.definitionId as LibraryDefinitionId,
        )!.name;
      const trigger = () =>
        records
          .get(field.id)!
          .children.map((id) => records.get(id)!)
          .find((child) => typeOf(child.id) === "Button")!;
      const parts = () => trigger().children.map((id) => records.get(id)!);
      const host = () => {
        const element = document.createElement("div");
        element.innerHTML = renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id, {
            today: () => undefined,
          }),
        );
        return element;
      };
      const rect = (id: string) =>
        workspace.root.getGeometry([id]).get(id) as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      expect(trigger().collapsedSourceIds).toEqual([
        "lib:template:component-button",
      ]);
      expect(trigger().props).toMatchObject({ variant: "secondary" });
      expect(parts().map((part) => typeOf(part.id))).toEqual([
        "SelectValue",
        "Icon",
      ]);
      // Canvas: the trigger fills the field; the value fills the trigger up to the glyph, 4px
      // before it; the glyph sits 8px inside the end (the Button's own padding at the start).
      const width = rect(field.id).width;
      expect(rect(trigger().id)).toMatchObject({ x: 0, width });
      expect(trigger().visual).toMatchObject({
        width: "100%",
        minWidth: 0,
        paddingX: 12,
        paddingRight: 8,
        gap: 4,
        borderWidth: 1,
      });
      const [value, glyph] = parts();
      expect(rect(glyph.id)).toMatchObject({
        x: width - 1 - 8 - 18,
        width: 18,
        height: 18,
      });
      expect(rect(value.id)).toMatchObject({
        x: 13,
        width: width - 13 - 4 - 18 - 8 - 1,
      });
      expect(value.visual.fontSize).toBe(14);
      // (The value keeps its own weight: it does not take the trigger Button's 500.)
      expect(value.visual.fontWeight).toBe(400);
      // The field's `placeholder` and `iconName` reach the parts (template bindings).
      expect(value.props).toMatchObject({
        placeholder: "Choose an option...",
        children: "Choose an option...",
      });
      expect(glyph.props.iconName).toBe("chevron-down");
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { placeholder: set("Pick one"), iconName: set("search") },
        }),
      );
      expect(parts()[0]!.props).toMatchObject({
        placeholder: "Pick one",
        children: "Pick one",
      });
      expect(parts()[1]!.props.iconName).toBe("search");
      // DOM: the trigger element is the Button node's (RAC wires it as the Select's trigger); its
      // children are the value (RAC `SelectValue` — RAC writes the placeholder) and the glyph.
      const button = () => host().querySelector(".react-aria-Select > button")!;
      expect(button().getAttribute("data-catalog-id")).toBe(trigger().id);
      expect(button().getAttribute("aria-haspopup")).toBe("listbox");
      expect(button().className).toContain("button-base");
      expect(button().getAttribute("data-variant")).toBe("secondary");
      expect(
        [...button().children].map((child) =>
          child.getAttribute("data-catalog-id"),
        ),
      ).toEqual(parts().map((part) => part.id));
      const valueElement = button().querySelector(".react-aria-SelectValue")!;
      expect(valueElement.textContent).toBe("Pick one");
      expect(valueElement.hasAttribute("data-placeholder")).toBe(true);
      // (Its color is the trigger's, the placeholder paint the field sheet's: nothing inline.)
      expect(valueElement.getAttribute("style")).not.toMatch(/(^|;)\s*color:/);
      expect(valueElement.getAttribute("style")).toMatch(/font-weight:\s*400/);
      const style = button().getAttribute("style")!;
      expect(style).toMatch(/(^|;)width:\s*100%/);
      expect(style).toMatch(/padding-right:\s*8px/);
      expect(style).toMatch(/column-gap:\s*4px/);
      // (A Button's rest paint is its sheet's: hover, pressed and focus are the Button rule's.)
      expect(style).not.toMatch(/background-color|border-color|opacity/);
      // A disabled field: RAC disables the trigger; the root fades once.
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { isDisabled: set(true) },
        }),
      );
      expect(button().hasAttribute("disabled")).toBe(true);
      expect(button().getAttribute("style")).toMatch(/opacity:\s*1(;|$)/);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { isDisabled: set(false) },
        }),
      );
      // The field's size reaches the trigger, and through it the glyph; the value follows the
      // field's size.
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { size: set("xl") },
        }),
      );
      expect(trigger().props.size).toBe("xl");
      expect(trigger().visual).toMatchObject({
        paddingX: 24,
        paddingRight: 16,
      });
      expect(parts()[0]!.visual.fontSize).toBe(18);
      expect(parts()[1]!.visual.iconSize).toBe(28);
      // The Button origin is where the trigger's shape comes from.
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "fill",
          write: set("#0000ff"),
          newId: workspace.newId,
        }),
      );
      expect(trigger().visual.fill).toBe("#0000ff");
      expect(button().getAttribute("style")).toMatch(
        /--button-color:\s*#0000ff/,
      );
      // Edit axes: the trigger is its own (an instance); the value's style is the field's.
      const graph = workspace.runtime.graph;
      const dom = workspace.root.domInputs;
      expect(
        catalogSubpartOwnerType(graph, dom, trigger().id, "style"),
      ).toBeNull();
      expect(
        catalogSubpartOwnerType(graph, dom, trigger().id, "all"),
      ).toBeNull();
      expect(catalogSubpartOwnerType(graph, dom, parts()[0]!.id, "style")).toBe(
        "Select",
      );
    },
  );

  /**
   * A SearchField's control: the container (the wrapper node — placement only) holds the search
   * glyph (an Icon node laid over the Input's start), an instance of the Input origin (the box —
   * rounded here) and the clear button, an instance of the Button origin laid over the Input's
   * end. The clear button shows while the field has a value (RAC's `data-empty`).
   */
  it.skipIf(write)(
    "searchfield — its container holds the glyph, an Input instance and a Button instance",
    async () => {
      const { workspace, field } = (await render("searchfield", {}))!;
      const records = workspace.root.canvasInputs;
      const typeOf = (id: string) =>
        workspace.runtime.graph.getDefinition(
          records.get(id)!.definitionId as LibraryDefinitionId,
        )!.name;
      const wrapper = () =>
        records
          .get(field.id)!
          .children.map((id) => records.get(id)!)
          .find((child) => typeOf(child.id) === "SelectTrigger")!;
      const parts = () => wrapper().children.map((id) => records.get(id)!);
      const host = () => {
        const element = document.createElement("div");
        element.innerHTML = renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id, {
            today: () => undefined,
          }),
        );
        return element;
      };
      const rect = (id: string) =>
        workspace.root.getGeometry([id]).get(id) as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
      const layoutRecord = (id: string) =>
        workspace.root.layoutInputs.get(id) as { hidden?: boolean };
      expect(parts().map((part) => typeOf(part.id))).toEqual([
        "Icon",
        "Input",
        "Button",
      ]);
      expect(parts().map((part) => part.collapsedSourceIds)).toEqual([
        undefined,
        ["lib:template:component-input"],
        ["lib:template:component-button"],
      ]);
      const [glyph, input, clear] = parts();
      // Canvas: the Input is the whole control, rounded, with room at both ends; the glyph sits
      // 8px inside its start, over it.
      const group = rect(wrapper().id);
      expect(rect(input.id)).toMatchObject({
        x: 0,
        width: group.width,
        height: 30,
      });
      expect(input.visual).toMatchObject({
        radius: 9999,
        paddingLeft: 32,
        paddingRight: 32,
      });
      // (Its text starts after that padding, clear of the glyph — as the DOM `padding-left` does.)
      expect(inputTextBand(workspace, input.id)).toEqual({
        x: 32,
        paddingRight: 32,
      });
      expect(rect(glyph.id)).toMatchObject({
        x: 8,
        y: 7,
        width: 16,
        height: 16,
      });
      expect(glyph.visual).toMatchObject({ iconSize: 16, zIndex: 1 });
      // An empty field shows no clear button (RAC `data-empty`); with a value it is a 16px
      // circle 8px inside the Input's end.
      expect(layoutRecord(clear.id).hidden).toBe(true);
      expect(input.derivedProps).toBeUndefined();
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { value: set("abc"), placeholder: set("Find") },
        }),
      );
      // The Canvas draws the value in the Input's text (the DOM input shows it over the
      // placeholder); emptied, the placeholder is back.
      expect(parts()[1]!.derivedProps).toEqual({ placeholder: "abc" });
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { value: set("") },
        }),
      );
      expect(parts()[1]!.derivedProps).toBeUndefined();
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { value: set("abc") },
        }),
      );
      expect(parts()[1]!.derivedProps).toEqual({ placeholder: "abc" });
      const shown = parts()[2]!;
      expect(layoutRecord(shown.id).hidden).not.toBe(true);
      expect(rect(shown.id)).toMatchObject({
        x: group.width - 24,
        y: 7,
        width: 16,
        height: 16,
      });
      expect(shown.visual).toMatchObject({
        fill: "var(--fg-muted)",
        radius: 9999,
        borderWidth: 0,
      });
      expect(records.get(shown.children[0]!)!.visual.iconSize).toBe(12);
      expect(parts()[1]!.props.placeholder).toBe("Find");
      // DOM: the container's children are those nodes' elements; the Input is the searchbox RAC
      // wires (its `type` is RAC's), the Button the clear button RAC labels.
      const container = host().querySelector(".searchfield-container")!;
      expect(
        [...container.children].map((child) =>
          child.getAttribute("data-catalog-id"),
        ),
      ).toEqual(parts().map((part) => part.id));
      const inputElement = container.querySelector("input")!;
      expect(inputElement.getAttribute("type")).toBe("search");
      expect(inputElement.getAttribute("placeholder")).toBe("Find");
      expect(inputElement.getAttribute("value")).toBe("abc");
      expect(inputElement.getAttribute("style")).toMatch(
        /border-radius:\s*9999px/,
      );
      const clearElement = container.querySelector("button")!;
      expect(clearElement.getAttribute("aria-label")).toBeTruthy();
      expect(clearElement.getAttribute("style")).toMatch(
        /--button-color:\s*var\(--fg-muted\)/,
      );
      // The field's sheet hides the clear button while the input is empty (`[data-empty]`, RAC's
      // run state): an inline display would keep it shown.
      expect(clearElement.getAttribute("style")).not.toMatch(
        /(^|;)\s*display:/,
      );
      // The Canvas reads the same color: `--fg-muted` is the `neutral-subdued` token's variable.
      expect(cssVarColor("var(--fg-muted)", "light")).toMatch(
        /^#[0-9a-f]{6}$/i,
      );
      expect(cssVarColor("var(--fg-muted)", "dark")).toMatch(/^#[0-9a-f]{6}$/i);
      expect(
        container.querySelector(".react-aria-Icon")!.getAttribute("style"),
      ).toMatch(/z-index:\s*1/);
      // The field's size reaches the parts.
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { size: set("xl") },
        }),
      );
      expect(parts()[1]!.props.size).toBe("xl");
      expect(parts()[1]!.visual).toMatchObject({
        paddingLeft: 52,
        paddingRight: 52,
      });
      expect(rect(parts()[0]!.id)).toMatchObject({ x: 16, width: 22 });
      expect(rect(parts()[2]!.id)).toMatchObject({ width: 24, height: 24 });
      // The Input origin and the Button origin reach them (the Button's own shape stays).
      workspace.execute(
        setLibraryDefault({
          definitionId: INPUT_ORIGIN,
          scope: "visual",
          key: "borderColor",
          write: set("#0000ff"),
          newId: workspace.newId,
        }),
      );
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "color",
          write: set("#00aa00"),
          newId: workspace.newId,
        }),
      );
      expect(parts()[1]!.visual.borderColor).toBe("#0000ff");
      expect(parts()[2]!.visual).toMatchObject({
        color: "#00aa00",
        fill: "var(--fg-muted)",
      });
      const graph = workspace.runtime.graph;
      const dom = workspace.root.domInputs;
      expect(catalogSubpartOwnerType(graph, dom, parts()[1]!.id, "all")).toBe(
        "SearchField",
      );
      expect(
        catalogSubpartOwnerType(graph, dom, parts()[1]!.id, "style"),
      ).toBeNull();
    },
  );

  /**
   * A Button's paint is its rule's sheet, which changes it by state: the rest colors go inline
   * only when the document wrote them, or while the document disables the Button (the Canvas
   * draws a disabled Button at its rest paint, faded).
   */
  it.skipIf(write)(
    "button — its rest paint is the sheet's, inline only when authored or disabled",
    async () => {
      const style = async (authored: Record<string, string | boolean>) => {
        const { html } = (await render("button", authored))!;
        const host = document.createElement("div");
        host.innerHTML = html;
        return host.querySelector("button")!.getAttribute("style") ?? "";
      };
      const paint = /background-color|border-color|(^|;)color:/;
      expect(await style({})).not.toMatch(paint);
      expect(await style({ variant: "secondary" })).not.toMatch(paint);
      expect(await style({ fillStyle: "outline" })).not.toMatch(paint);
      expect(await style({ isDisabled: true })).toMatch(
        /background-color:\s*#171717/,
      );
      // An origin override is the document's: inline over the sheet.
      const { workspace, field } = (await render("button", {}))!;
      workspace.execute(
        setLibraryDefault({
          definitionId:
            "lib:definition:origin-component-button" as LibraryDefinitionId,
          scope: "visual",
          key: "fill",
          write: set("#ff0000"),
          newId: workspace.newId,
        }),
      );
      const host = document.createElement("div");
      host.innerHTML = renderToStaticMarkup(
        renderCatalogDom(workspace.root, field.id, { today: () => undefined }),
      );
      const overridden = host.querySelector("button")!.getAttribute("style")!;
      // (As the sheet's own variable: its hover and pressed colors derive from it.)
      expect(overridden).toMatch(/--button-color:\s*#ff0000/);
      expect(overridden).toMatch(/--button-color-hover:\s*initial/);
      expect(overridden).not.toMatch(/background-color|border-color/);
    },
  );

  /**
   * An Input's height is its content: one line box + padding + border — with or without text
   * (the DOM `<input>` keeps its line box when it has no value and no placeholder).
   */
  it.skipIf(write)(
    "textfield — its Input keeps its line box without a placeholder",
    async () => {
      const { workspace, field } = (await render("textfield", {}))!;
      const height = () => {
        const input = workspace.root.canvasInputs
          .get(field.id)!
          .children.map((id) => workspace.root.canvasInputs.get(id)!)
          .find((child) => child.ruleId === "Input")!;
        return workspace.root.getGeometry([input.id]).get(input.id)!.height;
      };
      expect(height()).toBe(30);
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { placeholder: set("") },
        }),
      );
      expect(height()).toBe(30);
    },
  );

  /** A TextArea's Input node is its `<textarea rows>`: the field's `rows`, on both sides. */
  it.skipIf(write)("textarea — its rows size its Input node", async () => {
    const { workspace, field } = (await render("textarea", {}))!;
    const input = () =>
      workspace.root.canvasInputs
        .get(field.id)!
        .children.map((id) => workspace.root.canvasInputs.get(id)!)
        .find((child) => child.ruleId === "Input")!;
    const rows = () =>
      /<textarea[^>]*rows="(\d+)"/.exec(
        renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id, {
            today: () => undefined,
          }),
        ),
      )?.[1];
    // 3 rows × 20 + padding 8 + border 2.
    expect(input().visual.height).toBe(70);
    expect(rows()).toBe("3");
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: { rows: set(5) },
      }),
    );
    expect(input().visual.height).toBe(110);
    expect(rows()).toBe("5");
  });

  /**
   * A side label field places its hints under the control: the label column's width plus the
   * field's gap, as the field's rule declares (`margin-inline-start: calc(label width + gap)`).
   * The Canvas lays the part out with it and the DOM element carries it (the text reset would
   * otherwise win over the field's stylesheet).
   */
  for (const [type, indent] of Object.entries(SIDE_INDENT))
    it.skipIf(write)(
      `${type} — side label: its hints are indented under the control`,
      async () => {
        const { workspace, field } = (await render(type, {
          labelPosition: "side",
          description: "Help text",
          isInvalid: true,
          errorMessage: "Not valid",
        }))!;
        const html = renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id, {
            today: () => undefined,
          }),
        );
        for (const binding of ["description", "fielderror"]) {
          const part = workspace.root.canvasInputs
            .get(field.id)!
            .children.map((id) => workspace.root.canvasInputs.get(id)!)
            .find((child) => child.bindingId === binding)!;
          expect(part.layout.marginLeft).toBe(`${indent}px`);
          expect(part.layout.flexBasis).toBe("100%");
          const id = part.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          expect(html).toMatch(
            new RegExp(
              `<span[^>]*data-catalog-id="${id}"[^>]*style="[^"]*margin-left:${indent}px`,
            ),
          );
        }
      },
    );
});
