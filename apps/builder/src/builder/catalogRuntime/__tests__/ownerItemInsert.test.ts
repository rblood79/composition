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
import { catalogItemInsertChoices } from "../itemInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * 2026-10-09 (사용자 「Tabs 의 경우 컴퍼넌트 상단 프러퍼티에 "+" 가 없고 tablist 에 slot "+" 가 있다,
 * Taggroup 도 Tags 에 "+" 가 있다」): a Tabs · TagGroup takes its items with its own "+" too, as a
 * CheckboxGroup (its items wrapper) and a Select (its Popover's ListBox) do — the "+" adds them in
 * its TabList · TagList, the same command as the list's own "+".
 */
const BODY = "project:node:home-body" as NodeId;
const OWNER = "project:node:owner" as NodeId;

async function open(origin: string) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:owner-insert" as EntryId<"project">,
        name: "Owner insert",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `owner-insert-${Math.random()}`),
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
  const root = workspace.root;
  const of = (type: string) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const choices = (type: string) =>
    catalogItemInsertChoices(
      {
        graph: workspace.runtime.graph,
        readModel: workspace.readModel,
        newId: workspace.newId,
      },
      workspace.positionOfRecord(of(type)[0]!.id)!,
    );
  return { workspace, of, choices };
}

describe("owner '+' — a Tabs · TagGroup adds its items in its list", () => {
  it.each([
    ["tabs", "Tabs", "TabList", "Tab"],
    ["taggroup", "TagGroup", "TagList", "Tag"],
  ])(
    "%s: the owner offers the list's item and adds it there",
    async (origin, owner, list, item) => {
      const { workspace, of, choices } = await open(origin);
      expect(choices(owner).map((choice) => choice.type)).toEqual(
        choices(list).map((choice) => choice.type),
      );
      expect(choices(owner).map((choice) => choice.type)).toContain(item);
      const before = of(item).length;
      workspace.execute(
        choices(owner)
          .find((choice) => choice.type === item)!
          .build(),
      );
      expect(of(item)).toHaveLength(before + 1);
      const added = of(item).at(-1)!;
      expect(
        workspace.root.typeOf(workspace.root.canvasInputs.get(added.parentId)!),
      ).toBe(list);
      if (item === "Tab")
        // (A Tab comes with its TabPanel — the list's "+" adds both.)
        expect(of("TabPanel")).toHaveLength(before + 1);
    },
  );
});

describe("owner '+' — a Table · TableView adds columns and rows", () => {
  it.each([
    ["table", "Table"],
    ["tableview", "TableView"],
  ])(
    "%s: the owner offers Insert Column (TableHeader) and Insert Row (TableBody)",
    async (origin, owner) => {
      const { workspace, of, choices } = await open(origin);
      expect(choices(owner).map((choice) => choice.type)).toEqual([
        ...choices("TableHeader").map((choice) => choice.type),
        ...choices("TableBody").map((choice) => choice.type),
      ]);
      expect(choices(owner).map((choice) => choice.type)).toEqual([
        "Column",
        "Row",
      ]);
      const columns = of("Column").length;
      const rows = of("Row").length;
      for (const type of ["Column", "Row"])
        workspace.execute(
          choices(owner)
            .find((choice) => choice.type === type)!
            .build(),
        );
      expect([of("Column").length, of("Row").length]).toEqual([
        columns + 1,
        rows + 1,
      ]);
      const parentType = (type: string) =>
        workspace.root.typeOf(
          workspace.root.canvasInputs.get(of(type).at(-1)!.parentId)!,
        );
      expect([parentType("Column"), parentType("Row")]).toEqual([
        "TableHeader",
        "TableBody",
      ]);
    },
  );
});
