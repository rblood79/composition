// @vitest-environment jsdom
/**
 * S2 1.8.0 Form context (`FormContext` · `useFormProps`): a field takes the nearest Form's
 * `labelPosition` · `labelAlign` · `necessityIndicator` · `isRequired` · `isDisabled` for each key
 * it did not set itself. Before, the field origin's own `labelPosition: "top"` hid the Form's on
 * both the Canvas and the DOM, and the Canvas read no Form value but the necessity indicator.
 */
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
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
import { readPropSource } from "../../../../../../packages/shared/src/catalog/resolution/fieldSource";
import { renderCatalogDom } from "../domBinding";
import { catalogSemanticContracts } from "../editContract";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const FORM = "project:node:form" as NodeId;
const FRAME = "project:node:frame" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
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

async function open(
  form: Record<string, unknown>,
  fields: Record<string, { type: string; props?: Record<string, unknown> }>,
) {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:form-context" as EntryId<"project">,
        name: "Form context",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `form-context-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
    },
  );
  const ids = Object.keys(fields) as NodeId[];
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node(FORM, catalogTypeDefinitionId("Form"), form, [FRAME]),
        // (A layout frame between: S2's context reaches through any element.)
        node(FRAME, catalogTypeDefinitionId("frame"), {}, ids),
        ...ids.map((id) =>
          node(
            id,
            `lib:definition:origin-component-${fields[id].type}`,
            fields[id].props ?? {},
          ),
        ),
      ],
      rootIds: [FORM],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const field = (id: NodeId) =>
    [...root.canvasInputs.values()].find(
      (record) => record.sourceId === id && root.typeOf(record) !== "Label",
    )!;
  const part = (id: NodeId, type: string) =>
    field(id)
      .children.map((child) => root.canvasInputs.get(child)!)
      .find((child) => root.typeOf(child) === type)!;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(root, root.recordsOfSource(FORM)[0]!),
    );
  const box = (id: string) => root.getGeometry([id]).get(id)!;
  const editForm = (props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [
          workspace.positionOfRecord(root.recordsOfSource(FORM)[0]!)!.target,
        ],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            set(value as string | boolean),
          ]),
        ),
      }),
    );
  const formRecord = () =>
    root.recordsOfSource(FORM).map((id) => root.canvasInputs.get(id)!)[0]!;
  const panel = (id: NodeId, key: string) =>
    readPropSource(
      workspace.root.runtime.graph,
      workspace.positionOfRecord(field(id).id)!.target,
      key,
    );
  return { field, part, html, box, editForm, formRecord, panel };
}

const TEXT = "project:node:text" as NodeId;
const OWN = "project:node:own" as NodeId;
const BOXES = "project:node:boxes" as NodeId;

describe("S2 Form context", () => {
  it("the Design panel offers the Form's Required and Disabled", () => {
    const form = catalogSemanticContracts(
      catalogTypeDefinitionId("Form") as never,
      "Form",
    );
    expect(form.isRequired).toMatchObject({ kind: "boolean" });
    expect(form.isDisabled).toMatchObject({ kind: "boolean" });
  });

  it("a field that sets none takes the Form's label position · align (Canvas and DOM)", async () => {
    const { field, part, html, box, panel } = await open(
      { labelPosition: "side", labelAlign: "end" },
      { [TEXT]: { type: "textfield" } },
    );
    expect(field(TEXT).props).toMatchObject({
      labelPosition: "side",
      labelAlign: "end",
    });
    // The Design panel shows the Form's value as where it comes from.
    expect(panel(TEXT, "labelPosition")).toMatchObject({
      value: "side",
      source: "form",
    });
    // The side label column (176) on the Canvas, its text at the end.
    expect(box(part(TEXT, "Label").id).width).toBe(176);
    expect(part(TEXT, "Label").visual.textAlign).toBe("end");
    expect(html()).toMatch(
      /class="react-aria-TextField"[^>]*data-label-position="side"|data-label-position="side"[^>]*class="react-aria-TextField"/,
    );
  });

  it("a field's own value wins over the Form's", async () => {
    const { field, box, part, panel } = await open(
      { labelPosition: "side" },
      { [OWN]: { type: "textfield", props: { labelPosition: "top" } } },
    );
    expect(field(OWN).props.labelPosition).toBe("top");
    expect(panel(OWN, "labelPosition")).toMatchObject({
      value: "top",
      source: "own",
    });
    expect(box(part(OWN, "Label").id).width).not.toBe(176);
  });

  it("Required · Disabled reach every field (a group too), and follow the Form's edits", async () => {
    const { field, html, editForm, formRecord } = await open(
      { isRequired: true, isDisabled: true, necessityIndicator: "label" },
      { [TEXT]: { type: "textfield" }, [BOXES]: { type: "checkboxgroup" } },
    );
    for (const id of [TEXT, BOXES])
      expect(field(id).props).toMatchObject({
        isRequired: true,
        isDisabled: true,
        necessityIndicator: "label",
      });
    expect(html()).toMatch(
      /<input[^>]*disabled=""[^>]*required=""|<input[^>]*required=""[^>]*disabled=""/,
    );
    // The form itself draws no disabled state (S2): only its fields dim — not twice.
    expect(formRecord().visual.opacity).toBeUndefined();
    editForm({ isDisabled: false, isRequired: false });
    for (const id of [TEXT, BOXES])
      expect(field(id).props).toMatchObject({
        isRequired: false,
        isDisabled: false,
      });
  });
});
