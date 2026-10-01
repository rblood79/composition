import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import { collectDocumentColors } from "../../panels/styles/hooks/useDocumentColors";
import { catalogFillLayers } from "../authoredStyle";
import { catalogDocumentColorSources } from "../documentColors";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const id = (name: string) => `project:node:${name}` as NodeId;
const frame = (name: string, visual: NodeEntry["visual"] = {}): NodeEntry => ({
  kind: "node",
  id: id(name),
  definitionId: "lib:definition:type-frame" as NodeEntry["definitionId"],
  children: [],
  props: {},
  visual,
  sizing: {},
  descendantOverrides: [],
});

describe("ADR-248 Phase 4e color picker Document palette (catalog)", () => {
  it("collects the colors the author wrote — visual, responsive layers and fills — by frequency", async () => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:colors" as EntryId<"project">,
          name: "Colors",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr248-doc-colors-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
      },
    );
    let next = 0;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" as NodeId },
        entries: [
          frame("a", { backgroundColor: { kind: "set", value: "#ff0000" } }),
          frame("b", { color: { kind: "set", value: "#ff0000" } }),
          frame("c", { borderColor: { kind: "set", value: "var(--accent)" } }),
        ],
        rootIds: [id("a"), id("b"), id("c")],
        newId: <K extends EntryKind>(kind: K) =>
          `project:${kind}:dc${++next}` as EntryId<K>,
      }),
    );
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: id("c") }],
        breakpoint: "mobile",
        visual: { color: { kind: "set", value: "#00ff00" } },
      }),
    );
    workspace.execute(
      setWholeField({
        targets: [{ kind: "node", id: id("b") }],
        field: "fills",
        value: catalogFillLayers([
          {
            type: "color",
            id: "f1",
            enabled: true,
            opacity: 1,
            blendMode: "normal",
            color: "#0000FFFF",
          } as { type: string },
        ]),
      }),
    );
    expect(
      collectDocumentColors(
        catalogDocumentColorSources(workspace.runtime.graph),
      ),
    ).toEqual(["#FF0000FF", "#0000FFFF", "#00FF00FF"]);
  });
});
