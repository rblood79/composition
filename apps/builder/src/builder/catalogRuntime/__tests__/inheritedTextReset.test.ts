// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { CatalogCompositionRoot } from "../compositionRoot";
import { catalogPaletteDefinitionId } from "../paletteInsert";

const BODY = "project:node:home-body" as NodeId;
const FIELD = "project:node:field" as NodeId;

async function placeText(size = "M") {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:inherited-text-reset" as EntryId<"project">,
        name: "Inherited text reset",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `inherited-text-reset-${Math.random()}`),
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
          definitionId: catalogPaletteDefinitionId(library, "Text"),
          children: [],
          props: {
            size: { kind: "set", value: size },
          },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [FIELD],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const value = [...root.canvasInputs.values()].find(
    (record) => record.bindingId === "text",
  )!;
  return { workspace, value };
}

describe("own typography reset resolves current inheritance", () => {
  const values = {
    fontFamily: ["Inter", "Menlo", "Arial"],
    letterSpacing: [1, 2, 4],
    fontStyle: ["normal", "italic", "oblique"],
    textTransform: ["uppercase", "lowercase", "capitalize"],
    wordBreak: ["normal", "keep-all", "break-all"],
    overflowWrap: ["normal", "break-word", "anywhere"],
    textAlign: ["left", "right", "center"],
  };
  for (const [key, [initial, ownValue, latest]] of Object.entries(values)) {
    it(`${key}: Reset, Undo and Redo agree with a rebuilt document`, async () => {
      const { workspace, value } = await placeText();
      const root = workspace.root;
      const own = workspace.itemOfRecord(value.id)!.target;
      const parent = workspace.itemOfRecord(value.parentId)!.target;
      const write = (target: typeof own, value: string | number) =>
        workspace.execute(
          setFields({
            targets: [target],
            visual: { [key]: { kind: "set", value } },
          }),
        );
      write(parent, initial);
      write(own, ownValue);
      write(parent, latest);
      workspace.execute(
        setFields({ targets: [own], visual: { [key]: { kind: "remove" } } }),
      );
      expect(root.canvasInputs.get(value.id)?.inheritedText?.[key]).toBe(
        latest,
      );
      workspace.undo();
      expect(root.canvasInputs.get(value.id)?.visual[key]).toBe(ownValue);
      workspace.redo();
      const rebuilt = new CatalogCompositionRoot(
        workspace.runtime,
        await nodeLayoutEngine(),
        { width: 400, height: 800 },
      );
      expect(root.canvasInputs.get(value.id)?.inheritedText).toEqual(
        rebuilt.canvasInputs.get(value.id)?.inheritedText,
      );
    });
  }
});
