import "fake-indexeddb/auto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
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

/** A document's structure: elements, their attributes (sorted) and text, in order. */
function normalize(html: string): string {
  const walk = (element: Element): string => {
    const control = ["input", "textarea"].includes(
      element.tagName.toLowerCase(),
    );
    const attributes = [...element.attributes]
      .filter(
        (attribute) =>
          attribute.name !== "data-catalog-id" &&
          attribute.name !== "style" &&
          !(control && attribute.name === "data-size"),
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
          expect(
            placeholder ? structure.replace(placeholder, "") : structure,
          ).toBe(fixture[`${type}/${name}`]);
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
