// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogCompositionRoot } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  detachInstances,
  insertNodes,
  moveNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Phase 2 review (round 6): (1) G2 — a layout frame the author puts around a field's parts
 * keeps them in the field's RAC context: the DOM draws the same control and the Canvas derives the
 * same values. (2) Decision 7 — a value-conditioned part's presence follows its final text on
 * every path (an edit, a variable refresh). (3) A node-tree field's Description is judged by its
 * own text, not the field's `description` prop.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const WRAP = "project:node:wrap" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
const entry = (id: string, definitionId: string, props = {}) =>
  ({
    kind: "node",
    id,
    definitionId,
    children: [],
    props,
    visual: {},
    sizing: {},
    descendantOverrides: [],
  }) as unknown as NodeEntry;

async function open(type: string, props: Record<string, unknown>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-wrap" as EntryId<"project">,
        name: "Wrap",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-wrap-${Math.random()}`),
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
        entry(
          FIELD,
          `lib:definition:origin-component-${type}`,
          Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
        ),
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const part = (t: string) =>
    [...workspace.root.canvasInputs.values()].find(
      (record) => workspace.root.typeOf(record) === t,
    )!;
  const html = () =>
    renderToStaticMarkup(
      renderCatalogDom(
        workspace.root,
        [...workspace.root.domInputs.values()].find(
          (record) => record.sourceId === FIELD,
        )!.id,
      ),
    );
  return { workspace, part, html };
}

const CONTROL: Record<string, string> = {
  textfield: "Input",
  textarea: "Input",
  numberfield: "Group",
  searchfield: "Group",
  colorfield: "Input",
  datefield: "DateInput",
  timefield: "DateInput",
};

/** The control the DOM draws: RAC's elements, not the wrapper's `div`. */
const control = (html: string) => ({
  spinbuttons: (html.match(/role="spinbutton"/g) ?? []).length,
  textarea: (html.match(/<textarea/g) ?? []).length,
  inputs: (html.match(/<input/g) ?? []).length,
  groups: (html.match(/role="group"/g) ?? []).length,
  buttons: (html.match(/<button/g) ?? []).length,
  label: (html.match(/<label/g) ?? []).length,
  necessity: html.includes("necessity-indicator") || html.includes("*"),
});

describe("ADR-256 Phase 2 review — a field's parts inside a layout frame", () => {
  it.each(Object.keys(CONTROL))(
    "%s: a frame around the control and the Label keeps the field's control (DOM and Canvas)",
    async (type) => {
      const { workspace, part, html } = await open(type, {
        label: "Field",
        isRequired: true,
        isQuiet: true,
      });
      workspace.execute(
        detachInstances({ ids: [FIELD], newId: workspace.newId }),
      );
      const moved = [part(CONTROL[type]!), part("Label")];
      const derived = () =>
        Object.fromEntries(
          [...workspace.root.canvasInputs.values()]
            .filter((record) => record.id !== FIELD)
            .map((record) => [
              record.sourceId,
              { derived: record.derivedProps, hidden: record.hidden },
            ]),
        );
      const before = { dom: control(html()), canvas: derived() };
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: FIELD },
          entries: [entry(WRAP, "lib:definition:type-frame")],
          rootIds: [WRAP],
          newId: workspace.newId,
        }),
      );
      workspace.execute(
        moveNodes({
          ids: moved.map((record) => record.sourceId as NodeId),
          parent: { kind: "node", id: WRAP },
          newId: workspace.newId,
        }),
      );
      expect(control(html())).toEqual(before.dom);
      const after = derived();
      for (const [id, values] of Object.entries(before.canvas))
        if (id !== WRAP) expect(after[id], id).toEqual(values);
    },
  );
});

describe("ADR-256 Phase 2 review — presence follows the final text on every path", () => {
  it.each([
    ["", "Name", false],
    ["Name", "", true],
  ] as const)(
    "a field label %j → %j: the Canvas Label is hidden = %s, as the DOM",
    async (start, end, hidden) => {
      const { workspace, part, html } = await open("textfield", {
        label: start,
      });
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: FIELD }],
          props: { label: set(end) },
        }),
      );
      expect(part("Label").hidden === true).toBe(hidden);
      expect(html().includes("<label")).toBe(!hidden);
    },
  );

  it("a variable refresh that fills the label shows the Canvas Label", async () => {
    const { workspace } = await open("textfield", { label: "{{ title }}" });
    let value = "";
    const root = new CatalogCompositionRoot(
      workspace.runtime,
      await nodeLayoutEngine(),
      { width: 1200, height: 800 },
      undefined,
      undefined,
      undefined,
      undefined,
      {
        state: {
          projectVariables: () => [
            {
              id: "v1",
              name: "title",
              type: "string",
              defaultValue: value,
            },
          ],
        },
      },
    );
    const label = () =>
      [...root.canvasInputs.values()].find(
        (record) => root.typeOf(record) === "Label",
      )!;
    expect(label().hidden).toBe(true);
    value = "Name";
    root.refreshState(new Set(["title"]));
    expect(label().props.children).toBe("Name");
    expect(label().hidden).toBeUndefined();
  });

  it("a node-tree field's Description is judged by its own text, not the field's prop", async () => {
    const { workspace, part, html } = await open("textfield", {
      label: "Field",
      description: "",
    });
    workspace.execute(
      detachInstances({ ids: [FIELD], newId: workspace.newId }),
    );
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: part("Description").sourceId as NodeId }],
        props: { children: set("Authored hint") },
      }),
    );
    expect(html()).toContain("Authored hint");
    expect(part("Description").hidden).toBeUndefined();
    const fresh = new CatalogCompositionRoot(
      workspace.runtime,
      await nodeLayoutEngine(),
      { width: 1200, height: 800 },
    );
    const hint = [...fresh.canvasInputs.values()].find(
      (record) => fresh.typeOf(record) === "Description",
    )!;
    expect(hint.hidden).toBeUndefined();
  });
});
