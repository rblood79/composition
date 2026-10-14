import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  resolveCatalogContextEntry,
  resolveCatalogTextEditRecord,
} from "../canvasPick";
import { catalogTextKey } from "../canvasText";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { catalogHasOwnText } from "../textBinding";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-14 (사용자 「radioGroup, checkbox Group 선택영역의 빈공간에 더블클릭했을때 전체영역으로
 * label편집창으로 된다」): a double click on a field's · group's own area (not on a part) entered
 * nothing and edited its `label` — the text its Label part draws (`{label}`) — over the whole box.
 * It edits nothing there now; a double click on the Label part edits that part (its text writes the
 * group's `label`), and an element that paints its own text (a Button) still edits it.
 */
const OWNER = "project:node:owner" as NodeId;

async function open(origin: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:group-text" as EntryId<"project">,
        name: "Group text",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `group-text-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: OWNER,
          definitionId: `lib:definition:origin-component-${origin}`,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [OWNER],
      newId: workspace.newId,
    }),
  );
  const records = workspace.root.domInputs;
  const top = [...records.values()].find((r) => r.sourceId === OWNER)!;
  const hasText = (id: string) =>
    catalogHasOwnText(library, records, id, catalogTextKey);
  /** The Canvas double click (no editing context, `picked` under the pointer): the text it edits. */
  const doubleClick = (picked: string) =>
    resolveCatalogContextEntry(records, picked, undefined)
      ? "enters"
      : resolveCatalogTextEditRecord(records, picked, top.id, hasText);
  const under = (id: string): string[] => {
    const record = records.get(id);
    return record ? [id, ...record.children.flatMap(under)] : [];
  };
  const label = under(top.id).find(
    (id) => workspace.root.typeOf(records.get(id)!) === "Label",
  );
  return { top, doubleClick, label };
}

describe("a double click on a field's own area does not edit the text its Label part draws", () => {
  it.each([
    "radiogroup",
    "checkboxgroup",
    "textfield",
    "checkbox",
    "select",
  ])("%s: its own area edits nothing", async (origin) => {
    const { top, doubleClick, label } = await open(origin);
    expect(label, origin).toBeDefined();
    expect(doubleClick(top.id), origin).toBeUndefined();
  });

  it("a Button still edits the text it paints", async () => {
    const { top, doubleClick } = await open("button");
    expect(doubleClick(top.id)).toBe(top.id);
  });
});
