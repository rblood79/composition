import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;

/**
 * FileUpload `isDisabled` (ADR-201 D2 — 「DropZone/FileTrigger Button 양쪽 비활성」, S2 체크리스트 §4.1
 * 2026-11-23): its DropZone and the FileTrigger's Button are disabled with it — on the Canvas (their
 * paint) and in the DOM (the Button's RAC `isDisabled` · the DropZone's) — from one derived value.
 * Before, only the DOM DropZone was (the intake context): the Button stayed pressable and both drew
 * enabled on the Canvas.
 */
async function fixture() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:fileupload-disabled" as EntryId<"project">,
        name: "fileupload disabled",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `fileupload-disabled-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    catalogPaletteInsertCommand(
      {
        graph: workspace.runtime.graph,
        records: workspace.root.domInputs,
        selection: () => [],
        itemOfRecord: (id) => workspace.itemOfRecord(id),
        pageContent: () => ({ kind: "node", id: BODY }),
        newId: workspace.newId,
      },
      "FileUpload",
      {},
    )!,
  );
  const root = () => workspace.root;
  const of = (type: string) =>
    [...root().canvasInputs.values()].filter((r) => root().typeOf(r) === type);
  const disabled = () =>
    ["DropZone", "Button"].map((type) => [
      type,
      of(type).map((r) => r.derivedProps?.isDisabled === true),
    ]);
  const write = (value: boolean) =>
    workspace.execute(
      setFields({
        targets: [
          { kind: "node", id: of("FileUpload")[0]!.sourceId as NodeId },
        ],
        props: { isDisabled: { kind: "set", value } },
      }),
    );
  return { of, disabled, write };
}

describe("FileUpload isDisabled reaches its DropZone and FileTrigger Button", () => {
  it("derives isDisabled on both, follows an edit back off, and the result is a fresh root's", async () => {
    const f = await fixture();
    expect(f.of("Button").length).toBe(1);
    expect(f.disabled()).toEqual([
      ["DropZone", [false]],
      ["Button", [false]],
    ]);
    f.write(true);
    expect(f.disabled()).toEqual([
      ["DropZone", [true]],
      ["Button", [true]],
    ]);
    f.write(false);
    expect(f.disabled()).toEqual([
      ["DropZone", [false]],
      ["Button", [false]],
    ]);
  });
});
