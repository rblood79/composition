import "fake-indexeddb/auto";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderCatalogDom } from "../domBinding";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
  setLibraryDefault,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogBuiltinOrigins } from "../layouts";
import { originSampleId } from "../originView";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-253 Phase 2 (G2): a TextField's Label is an instance of the Label origin. The field's
 * `label` prop is the Label's text; the Label origin's style is what every such Label draws.
 */
const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
const LABEL_ORIGIN =
  "lib:definition:origin-component-label" as LibraryDefinitionId;
const TEXTFIELD =
  "lib:definition:origin-component-textfield" as LibraryDefinitionId;
const set = <T>(value: T) => ({ kind: "set" as const, value });

async function open(fields: Partial<NodeEntry> = {}) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr253-label" as EntryId<"project">,
        name: "ADR-253 label",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr253-label-${Math.random()}`),
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
          definitionId: TEXTFIELD,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
          ...fields,
        },
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  /** The field's Label record, as the Canvas and the DOM read it. */
  const label = () => {
    const field = [...workspace.root.canvasInputs.values()].find(
      (record) => record.sourceId === FIELD,
    )!;
    const record = field.children
      .map((id) => workspace.root.canvasInputs.get(id)!)
      .find((child) => child.definitionId === "lib:definition:type-Label")!;
    return { record, dom: workspace.root.domInputs.get(record.id)! };
  };
  return { workspace, library, label };
}

describe("ADR-253 Phase 2 — a TextField's Label is an instance of the Label origin", () => {
  it("the library registers the Label origin and the field's label position is its instance", async () => {
    const { library, label } = await open();
    const origin = library.definitions.get(LABEL_ORIGIN);
    expect(origin).toMatchObject({ name: "Label", mode: "composite" });
    expect(
      library.templates.get("lib:template:component-textfield__1")
        ?.definitionId,
    ).toBe(LABEL_ORIGIN);
    // The drawn record is the origin's template root, reached through the field's position.
    const { record } = label();
    expect(record.sourceId).toBe("lib:template:component-textfield__1");
    expect(record.collapsedSourceIds).toEqual(["lib:template:component-label"]);
  });

  it("the Components page draws the Label origin (a base part, before the palette origins)", async () => {
    const { workspace, library } = await open();
    const origins = catalogBuiltinOrigins(library);
    expect(origins[0]).toMatchObject({ id: LABEL_ORIGIN, name: "Label" });
    workspace.showDefinition(LABEL_ORIGIN);
    const sample = [...workspace.root.canvasInputs.values()].find(
      (record) => record.sourceId === originSampleId(LABEL_ORIGIN),
    );
    expect(sample?.definitionId).toBe("lib:definition:type-Label");
    expect(sample?.props.children).toBe("Label");
  });

  it("the field's `label` prop is the Label's text, and the field's size sizes the Label", async () => {
    const { workspace, label } = await open({
      props: { label: set("Email"), size: set("lg") },
    });
    expect(label().record.props.children).toBe("Email");
    const large = label().record.visual.fontSize;
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: FIELD }],
        props: { label: set("Name"), size: set("sm") },
      }),
    );
    expect(label().record.props.children).toBe("Name");
    expect(label().dom.props.children).toBe("Name");
    expect(Number(label().record.visual.fontSize)).toBeLessThan(Number(large));
  });

  it("the Label origin's style reaches the field's Label (Canvas and DOM records)", async () => {
    const { workspace, label } = await open();
    expect(label().record.visual.color).not.toBe("#ff0000");
    for (const [key, value] of [
      ["color", "#ff0000"],
      ["fontWeight", 800],
    ] as const)
      workspace.execute(
        setLibraryDefault({
          definitionId: LABEL_ORIGIN,
          scope: "visual",
          key,
          write: set(value),
          newId: workspace.newId,
        }),
      );
    expect(label().record.visual).toMatchObject({
      color: "#ff0000",
      fontWeight: 800,
    });
    expect(label().dom.visual).toMatchObject({
      color: "#ff0000",
      fontWeight: 800,
    });
  });

  /**
   * G2 — the DOM draws the field's Label from the Label node (RAC composition inside the field).
   * The document's structure is the frozen field DOM oracle's (`adr253FieldPartsDom.test.ts`) and
   * the reference example's (`adr256FieldNodeTree.test.ts`); here, the Label element is the Label
   * node's own. (The shared TextField that was this test's oracle left the Preview in ADR-256
   * Phase 2 and was deleted.)
   */
  describe("DOM", () => {
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
      "size xl": { size: "xl" },
      disabled: { isDisabled: true },
      "read only": { isReadOnly: true },
    };
    for (const [name, authored] of Object.entries(CASES))
      it(`${name}: the Label element is the Label node's`, async () => {
        const { workspace } = await open({
          props: Object.fromEntries(
            Object.entries(authored).map(([key, value]) => [key, set(value)]),
          ),
        });
        const field = [...workspace.root.domInputs.values()].find(
          (record) => record.sourceId === FIELD,
        )!;
        const actual = renderToStaticMarkup(
          renderCatalogDom(workspace.root, field.id),
        );
        // The Label element is the Label node's own (its record id marks it).
        const marked = /<label[^>]*data-catalog-id="([^"]*)"/.exec(actual)?.[1];
        if (authored.label === "") expect(actual).not.toContain("<label");
        else
          expect(
            marked?.endsWith("::lib:template:component-textfield__1"),
          ).toBe(true);
      });

    it("the Label origin's style is the Label element's inline style", async () => {
      const { workspace } = await open();
      workspace.execute(
        setLibraryDefault({
          definitionId: LABEL_ORIGIN,
          scope: "visual",
          key: "color",
          write: set("#ff0000"),
          newId: workspace.newId,
        }),
      );
      const field = [...workspace.root.domInputs.values()].find(
        (record) => record.sourceId === FIELD,
      )!;
      const html = renderToStaticMarkup(
        renderCatalogDom(workspace.root, field.id),
      );
      expect(/<label[^>]*style="[^"]*color:\s*#ff0000/.test(html)).toBe(true);
    });
  });
});
