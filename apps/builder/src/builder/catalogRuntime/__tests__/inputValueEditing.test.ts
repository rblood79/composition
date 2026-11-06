import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { resolveCatalogTextEditRecord } from "../canvasPick";
import { catalogTextKey, catalogBoundTextCommand } from "../canvasText";
import { catalogTextBinding } from "../textBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { bindCatalogCanvas } from "../canvasBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import type { SkiaNodeData } from "../../workspace/canvas/skia/nodeRendererTypes";
import { renderToStaticMarkup } from "react-dom/server";
import { renderCatalogDom } from "../domBinding";

const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;
function paintedText(node: SkiaNodeData): SkiaNodeData["text"] {
  return node.text ?? node.children?.map(paintedText).find(Boolean);
}

it.each([
  ["TextArea", "first line\nsecond line"],
  ["ColorField", "#336699"],
])(
  "%s empty Input edits the owner value and survives storage reload",
  async (type, value) => {
    const library = await buildCodeCatalogLibrary();
    const document = newCatalogProjectDocument({
      projectId: "project:project:field-value" as EntryId<"project">,
      name: "field value",
    });
    const storage = new CatalogStorage(
      indexedDB,
      `field-value-${Math.random()}`,
    );
    await storage.create(document, library);
    const engine = await nodeLayoutEngine();
    const workspace = new CatalogWorkspace(
      new CatalogGraph(document, library),
      storage,
      {
        engine,
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
            definitionId:
              `lib:definition:origin-component-${type.toLowerCase()}` as LibraryDefinitionId,
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
    const input = () =>
      [...workspace.root.domInputs.values()].find(
        (n) => n.bindingId === "input",
      )!;
    const records = workspace.root.domInputs;
    expect(catalogTextKey(input())).toBe("value");
    expect(input().derivedProps?.value).toBe("");
    expect(
      resolveCatalogTextEditRecord(
        records,
        input().id,
        input().id,
        (id) => !!catalogTextKey(records.get(id)),
      ),
    ).toBe(input().id);
    const bound = catalogTextBinding(library, records, input(), "value")!;
    expect(bound.source.bindingId).toBe(type.toLowerCase());
    // Owner discovery shares the renderer's boundary: layout wrappers are transparent,
    // but a nearer field must never leak its input edit to an outer TextArea/ColorField.
    const wrapper = {
      ...bound.source,
      id: "layout-wrapper",
      parentId: bound.source.id,
      bindingId: undefined,
      ruleId: "frame",
    };
    const wrappedInput = { ...input(), parentId: wrapper.id };
    const wrapped = new Map(records);
    wrapped.set(wrapper.id, wrapper);
    wrapped.set(wrappedInput.id, wrappedInput);
    expect(
      catalogTextBinding(library, wrapped, wrappedInput, "value")?.source.id,
    ).toBe(bound.source.id);
    wrapped.set(wrapper.id, {
      ...wrapper,
      bindingId: "textfield",
      ruleId: "TextField",
    });
    expect(
      catalogTextBinding(library, wrapped, wrappedInput, "value"),
    ).toBeUndefined();
    const item = workspace.itemOfRecord(input().id)!;
    const target = workspace.itemOfRecord(bound.source.id)!.target;
    const command = catalogBoundTextCommand(
      workspace.runtime.graph,
      item,
      "value",
      { target, prop: bound.prop },
      "",
      value,
    );
    expect(command).toBeDefined();
    workspace.execute(command!);
    expect(workspace.root.domInputs.get(bound.source.id)!.props.value).toBe(
      value,
    );
    expect(input().derivedProps?.value).toBe(value);
    expect(input().visual.whiteSpace).toBe(
      type === "TextArea" ? "pre-wrap" : undefined,
    );
    const canvas = bindCatalogCanvas(
      workspace.root,
      workspace.root.pageRootRecords(),
    );
    const painted = paintedText(getSkiaNode(input().id)!);
    expect(painted?.content).toBe(
      type === "ColorField" ? value.toUpperCase() : value,
    );
    expect(painted?.whiteSpace).toBe(
      type === "TextArea" ? "pre-wrap" : undefined,
    );
    expect(() =>
      renderToStaticMarkup(renderCatalogDom(workspace.root, bound.source.id)),
    ).not.toThrow();
    canvas.dispose();
    expect(input().derivedProps?.placeholder).toBe(
      type === "ColorField" ? value.toUpperCase() : value,
    );
    await workspace.autosave.retry();
    expect(workspace.autosave.getSnapshot().state).toBe("saved");
    const loaded = await storage.load(document.projectId, library);
    workspace.dispose();
    const restored = new CatalogWorkspace(
      new CatalogGraph(loaded, library),
      storage,
      {
        engine,
        viewport: { width: 1200, height: 800 },
        autosaveSchedule: () => {},
      },
    );
    expect(
      [...restored.root.domInputs.values()].find(
        (n) => n.bindingId === "input",
      )!.derivedProps?.value,
    ).toBe(value);
    restored.dispose();
  },
);
