import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogTextMeasure } from "../compositionRoot";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e-9 (live G3): an insert measures its new records before they are committed. A date
 * input's segment row reads its owner (the DateRangePicker past the SelectTrigger wrapper) — it read
 * the committed records only, so an inserted range picker measured one date as a DateField
 * (live 66 × 17) until a rebuild (170.69 × 20, the range pair the old app drew).
 */
const measure: CatalogTextMeasure = (text, font) => ({
  width: text.length * 7,
  exactWidth: text.length * 7,
  minWidth: text.length * 7,
  height: font.fontSize * font.lineHeight,
});

describe("ADR-248 4e-9 incremental date segments", () => {
  it.each([
    "lib:definition:origin-component-daterangepicker",
    "lib:definition:origin-component-datepicker",
  ])("an inserted %s lays out like a rebuilt root", async (definitionId) => {
    const workspace = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:seg" as const,
          name: "Segments",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr248-4e9-seg-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 1920, height: 1080 },
        autosaveSchedule: () => {},
        textMeasure: measure,
        locale: "ko-KR",
      },
    );
    const id = "project:node:picker" as NodeId;
    const entry: NodeEntry = {
      kind: "node",
      id,
      definitionId: definitionId as NodeEntry["definitionId"],
      children: [],
      props: {},
      visual: {},
      sizing: {
        width: { kind: "set", value: 220 },
        height: { kind: "set", value: 130 },
      },
      placement: { kind: "absolute", x: 30, y: 30 },
      descendantOverrides: [],
    };
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: "project:node:home-body" as NodeId },
        entries: [entry],
        rootIds: [id],
        newId: workspace.newId,
      }),
    );
    const boxes = () => {
      const root = workspace.root;
      const geometry = root.getGeometry(root.canvasInputs.keys());
      const out: unknown[] = [];
      const walk = (record: string) => {
        out.push([
          root.typeOf(root.canvasInputs.get(record)!),
          geometry.get(record),
        ]);
        for (const child of root.canvasInputs.get(record)?.children ?? [])
          walk(child);
      };
      walk(root.recordsOfSource(id)[0]!);
      return out;
    };
    const incremental = boxes();
    // A breakpoint round trip assembles the root from the document.
    workspace.setBreakpoint("tablet");
    workspace.setBreakpoint("desktop");
    expect(incremental).toEqual(boxes());
  });
});
