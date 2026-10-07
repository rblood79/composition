import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogLabelSuffix } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A required field's Label shows its necessity indicator alike on the Canvas and in the DOM, by
 * one rule (RSP `necessityIndicator`): the field's own value, else the nearest Form's, else the
 * icon. Before, the DOM ignored the own value and the Form for Select · ComboBox · DatePicker ·
 * DateRangePicker (always the icon) and the Form for the two groups, and the Canvas drew none for
 * the two pickers.
 */
const BODY = "project:node:home-body" as NodeId;
const FORM = "project:node:form" as NodeId;
const FIELD = "project:node:field" as NodeId;
const FIELDS = [
  "textfield",
  "textarea",
  "numberfield",
  "searchfield",
  "colorfield",
  "datefield",
  "timefield",
  "datepicker",
  "daterangepicker",
  "select",
  "combobox",
  "checkboxgroup",
  "radiogroup",
];
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function place(
  type: string,
  own: Record<string, unknown>,
  form?: Record<string, unknown>,
) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:necessity" as EntryId<"project">,
        name: "Necessity",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `necessity-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const node = (
    id: NodeId,
    definitionId: string,
    props: Record<string, unknown>,
    children: NodeId[] = [],
  ) => ({
    kind: "node" as const,
    id,
    definitionId: definitionId as LibraryDefinitionId,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([key, value]) => [
        key,
        set(value as string | boolean),
      ]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  const field = node(FIELD, `lib:definition:origin-component-${type}`, own);
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: form
        ? [node(FORM, catalogTypeDefinitionId("Form"), form, [FIELD]), field]
        : [field],
      rootIds: [form ? FORM : FIELD],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const fieldRecord = [...root.canvasInputs.values()].find(
    (record) => record.sourceId === FIELD && root.typeOf(record) !== "Label",
  )!;
  const label = fieldRecord.children
    .map((id) => root.canvasInputs.get(id)!)
    .find((child) => root.typeOf(child) === "Label")!;
  const canvas = catalogLabelSuffix(
    label,
    (id) => root.canvasInputs.get(id),
    root.typeOf,
  ).trim();
  const html = renderToStaticMarkup(
    renderCatalogDom(root, root.recordsOfSource(form ? FORM : FIELD)[0]!),
  );
  const dom =
    /class="necessity-indicator[^"]*"[^>]*>([^<]*)</.exec(html)?.[1] ?? "";
  return { canvas, dom };
}

describe("field necessity indicator — one rule on the Canvas and in the DOM", () => {
  it.each(FIELDS)("%s: its own `label` indicator", async (type) => {
    const { canvas, dom } = await place(type, {
      isRequired: true,
      necessityIndicator: "label",
    });
    expect({ canvas, dom }).toEqual({
      canvas: "(required)",
      dom: "(required)",
    });
  });

  it.each(FIELDS)("%s: the Form's `label` indicator", async (type) => {
    const { canvas, dom } = await place(
      type,
      { isRequired: true },
      { necessityIndicator: "label" },
    );
    expect({ canvas, dom }).toEqual({
      canvas: "(required)",
      dom: "(required)",
    });
  });

  it.each(FIELDS)("%s: the icon when none is set", async (type) => {
    const { canvas, dom } = await place(type, { isRequired: true });
    expect({ canvas, dom }).toEqual({ canvas: "*", dom: "*" });
  });
});
