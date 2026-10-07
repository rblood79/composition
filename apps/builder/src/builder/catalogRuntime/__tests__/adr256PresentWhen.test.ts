import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { REUSABLE_ORIGIN_TEMPLATES } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import { validateLibraryTemplate } from "../../../../../../packages/shared/src/catalog/document/validation";
import { catalogAbsentByValue } from "../../../../../../packages/shared/src/catalog/runtime/presence";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  detachInstances,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-256 Decision 7 · breakdown §1-1 — the limited presence condition. A binding never removes a
 * node by itself; an optional text part the origin declares `presentWhen: "nonEmptyText"` (a
 * field's Label · Description) is absent only while its final text is empty — `0`, `false` and a
 * space stay (no trim). The Canvas and the DOM read one predicate. FieldError has no condition (it
 * mounts so RAC's own validation message can show).
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(type: string, props: Record<string, string | boolean>) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr256-present" as EntryId<"project">,
        name: "Present",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr256-present-${Math.random()}`),
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
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, set(value)]),
          ),
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const part = (records: ReadonlyMap<string, CatalogConsumerNode>, t: string) =>
    [...records.values()].find((record) => workspace.root.typeOf(record) === t);
  const field = [...workspace.root.domInputs.values()].find(
    (record) => record.sourceId === FIELD,
  )!;
  const html = renderToStaticMarkup(renderCatalogDom(workspace.root, field.id));
  return { workspace, part, html };
}

const FIELDS = [
  "textfield",
  "textarea",
  "numberfield",
  "searchfield",
  "colorfield",
  "datefield",
  "timefield",
];

describe("ADR-256 Decision 7 — presentWhen: nonEmptyText", () => {
  it.each(FIELDS)(
    "%s: an empty label and description are absent on the Canvas and in the DOM",
    async (type) => {
      const { workspace, part, html } = await open(type, {
        label: "",
        description: "",
      });
      expect(part(workspace.root.canvasInputs, "Label")?.hidden).toBe(true);
      expect(part(workspace.root.canvasInputs, "Description")?.hidden).toBe(
        true,
      );
      expect(html).not.toContain("<label");
      expect(html).not.toContain('slot="description"');
    },
  );

  it.each([
    ["0", "0"],
    ["false", "false"],
    ["a space", " "],
  ])(
    "a label · description of %s stays (no trim, no truthiness)",
    async (_name, text) => {
      const { workspace, part, html } = await open("textfield", {
        label: text,
        description: text,
      });
      expect(part(workspace.root.canvasInputs, "Label")?.hidden).toBeFalsy();
      expect(
        part(workspace.root.canvasInputs, "Description")?.hidden,
      ).toBeFalsy();
      expect(html).toContain("<label");
      expect(html).toContain('slot="description"');
    },
  );

  it("FieldError has no value condition: its node is never value-absent", async () => {
    const { workspace, part } = await open("textfield", {
      isInvalid: true,
      errorMessage: "",
    });
    // (Whether RAC shows a message is RAC's: an empty authored message leaves its own
    // validation errors as the children — G2 checks that with a real validation error.)
    const error = part(workspace.root.domInputs, "FieldError")!;
    expect(error.presentWhen).toBeUndefined();
    expect(catalogAbsentByValue(error)).toBe(false);
  });

  it("the predicate judges the final text and keeps a node that holds children", () => {
    const node = (children: string[], text: unknown) =>
      ({
        presentWhen: "nonEmptyText",
        children,
        props: { children: text },
      }) as unknown as CatalogConsumerNode;
    expect(catalogAbsentByValue(node([], ""))).toBe(true);
    expect(catalogAbsentByValue(node([], undefined))).toBe(true);
    expect(catalogAbsentByValue(node([], "Prefix "))).toBe(false);
    expect(catalogAbsentByValue(node(["project:node:icon"], ""))).toBe(false);
    // No condition: an empty text node stays.
    expect(
      catalogAbsentByValue({
        children: [],
        props: { children: "" },
      } as unknown as CatalogConsumerNode),
    ).toBe(false);
  });

  it("only optional Label · Description positions (and a collection item's description Text, a TagGroup's error text, a Checkbox's label) declare it; an unknown value is refused", () => {
    const declared = REUSABLE_ORIGIN_TEMPLATES.filter(
      (template) => template.presentWhen,
    );
    expect(declared.length).toBeGreaterThan(0);
    for (const template of declared)
      if (template.definitionId === "lib:definition:text")
        // ADR-256 Phase 5c: a ListBox · GridList · Menu item's description (`Text slot="description"`).
        expect(template.props.slot).toBe("description");
      else if (template.id === "lib:template:component-checkbox__1")
        // ADR-256 Phase 5f: the reference's `<Checkbox slot="selection" />` has no label text.
        expect(template.definitionId).toBe("lib:definition:type-Label");
      else if (template.id === "lib:template:component-taggroup__error")
        // ADR-256 Phase 5d: the reference's `{errorMessage && <Text slot="errorMessage">}` — a
        // TagGroup has no validation, so its error part shows with its text.
        expect(template.definitionId).toBe(
          "lib:definition:origin-component-fielderror",
        );
      else
        expect(template.definitionId).toMatch(
          /origin-component-(label|description)$/,
        );
    const template = REUSABLE_ORIGIN_TEMPLATES.find(
      (item) => item.id === "lib:template:component-textfield__1",
    )!;
    let code: string | undefined;
    try {
      validateLibraryTemplate({ ...template, presentWhen: "truthy" });
    } catch (error) {
      code = (error as { code?: string }).code;
    }
    expect(code).toBe("PRESENT_WHEN_UNKNOWN");
  });

  it("a detached field keeps the condition on its own Label", async () => {
    const { workspace } = await open("textfield", { label: "" });
    workspace.execute(
      detachInstances({ ids: [FIELD], newId: workspace.newId }),
    );
    const graph = workspace.runtime.graph;
    const label = (graph.getEntry(FIELD) as NodeEntry).children
      .map((id) => graph.getEntry(id) as NodeEntry)
      .find((entry) => entry.definitionId.endsWith("origin-component-label"));
    expect(label?.presentWhen).toBe("nonEmptyText");
    const record = [...workspace.root.canvasInputs.values()].find(
      (item) => item.sourceId === label?.id,
    );
    expect(record?.hidden).toBe(true);
  });
});
