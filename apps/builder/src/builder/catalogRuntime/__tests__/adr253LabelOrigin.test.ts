import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
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
});
