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
 * style are not structure (what the parts draw is judged by the Canvas ↔ DOM comparison).
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
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const LABEL_ORIGIN =
  "lib:definition:origin-component-label" as LibraryDefinitionId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

/** A document's structure: elements, their attributes (sorted) and text, in order. */
function normalize(html: string): string {
  const walk = (element: Element): string => {
    const attributes = [...element.attributes]
      .filter(
        (attribute) =>
          attribute.name !== "data-catalog-id" && attribute.name !== "style",
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
        expect(structure).toBe(fixture[`${type}/${name}`]);
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
});
