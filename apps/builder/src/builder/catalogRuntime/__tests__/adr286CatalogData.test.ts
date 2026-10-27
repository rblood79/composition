import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogProjectContent } from "../../../../../../packages/shared/src/catalog/runtime/exchange";
import { useDataStore } from "../../stores/data";
import {
  bindCatalogDataStore,
  catalogProjectVariableDefs,
} from "../catalogDataStore";
import * as codeView from "../codeView";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-286 Phase 0 RED (G0) — data definitions (collection · endpoint · project variable) live in
 * the catalog document: one write (a command), one history entry, one save, one project file. The
 * data store's `applyDataChange` (the AI · agent · panel entry, op vocabulary kept) is the input.
 */
const ROUTE = "adr286";
const BODY = "project:node:home-body" as NodeId;
const TEXT = "project:node:greeting" as NodeId;

async function open() {
  let graph: CatalogGraph | undefined;
  graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: `project:project:${ROUTE}` as EntryId<"project">,
      name: "ADR-286",
    }),
    await buildCodeCatalogLibrary(),
  );
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr286-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      // The Builder's wiring (CatalogBuilderCore): `{{ }}` reads the document's project variables.
      root: { state: { projectVariables: () => catalogProjectVariableDefs(graph!) } },
    },
  );
  useDataStore.getState().reset();
  bindCatalogDataStore(workspace);
  return workspace;
}

const kinds = (workspace: CatalogWorkspace, kind: string) =>
  Object.values(workspace.runtime.graph.exportDocument().entries).filter(
    (entry) => (entry.kind as string) === kind,
  );

describe("ADR-286 G0 — data definitions in the document", () => {
  it(
    "RED 1: collection 추가 직후 (Undo 전) 정의가 graph · 같은 step 의 저장 묶음 · 내보낸 document 에 있고, Undo 한 번에 셋 다 원상",
    async () => {
      const workspace = await open();
      const pending = workspace.runtime.pendingCount;
      await useDataStore.getState().applyDataChange({
        ops: [
          {
            op: "create_collection",
            name: "users",
            schema: [{ key: "name", type: "string" }],
            rows: [{ name: "Ada" }],
          },
        ],
        origin: "user",
      });
      expect(kinds(workspace, "collection")).toHaveLength(1);
      expect(workspace.runtime.pendingCount).toBe(pending + 1);
      expect(
        [...workspace.runtime.dirtyIds].some((id) =>
          id.startsWith("data:collection:"),
        ),
      ).toBe(true);
      const document = catalogProjectContent(workspace.runtime.graph)
      .document as { entries: Record<string, { kind: string }> };
      expect(
        Object.values(document.entries).some(
          (entry) => (entry.kind as string) === "collection",
        ),
      ).toBe(true);
      workspace.undo();
      await workspace.runtime.settled();
      expect(kinds(workspace, "collection")).toHaveLength(0);
      expect(useDataStore.getState().collections.size).toBe(0);
    },
  );

  it(
    "RED 3: 코드 보기 입력 = catalog reader (DataTable[] 가 아니다)",
    async () => {
      const workspace = await open();
      await useDataStore.getState().applyDataChange({
        ops: [
          {
            op: "create_collection",
            name: "users",
            schema: [{ key: "name", type: "string" }],
            rows: [{ name: "Ada" }],
          },
        ],
        origin: "user",
      });
      const read = codeView.catalogCodeViewData as unknown as (
        reader: unknown,
      ) => { collections: { name: string }[] };
      expect(
        read(workspace.runtime.graph).collections.map((c) => c.name),
      ).toEqual(["users"]);
    },
  );

  it(
    "RED 6: 프로젝트 변수 시작값 변경 step 에서 {{ }} 를 읽는 Canvas record 가 After (consume plan)",
    async () => {
      const workspace = await open();
      await useDataStore.getState().applyDataChange({
        ops: [
          {
            op: "define_variable",
            definition: {
              name: "greeting",
              type: "string",
              defaultValue: "Before",
            },
          },
        ],
        origin: "user",
      });
      const text: NodeEntry = {
        kind: "node",
        id: TEXT,
        definitionId: "lib:definition:text" as NodeEntry["definitionId"],
        children: [],
        props: { children: { kind: "set", value: "{{ greeting }}" } },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      };
      workspace.execute(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [text],
          rootIds: [TEXT],
          newId: workspace.newId,
        }),
      );
      const shown = () =>
        workspace.root
          .recordsOfSource(TEXT)
          .map((id) => workspace.root.canvasInputs.get(id)?.props.children)[0];
      expect(shown()).toBe("Before");
      const variable = [...useDataStore.getState().variables.values()][0]!;
      await useDataStore.getState().applyDataChange({
        ops: [
          {
            op: "define_variable",
            variableId: variable.id,
            definition: {
              name: "greeting",
              type: "string",
              defaultValue: "After",
            },
          },
        ],
        origin: "user",
      });
      expect(shown()).toBe("After");
      workspace.undo();
      expect(shown()).toBe("Before");
    },
  );
});
