import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addCollection,
  addComponentOutputProperty,
  addRecord,
  createComponent,
  insertNodes,
  setFields,
  setWholeField,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
  StateVariableEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * A bound collection inside a project component: the binding sits on the origin's template node
 * (the instance holds none), and every instance repeats its rows — not the origin template's
 * sample items. (The Canvas resolves through the same resolver; this harness's Builder root has no
 * row source — the live exercise covers it.) Its view reads the instance's variable
 * property (ADR-294 R6): two instances passing different values show different rows.
 * (Found by the ADR-294 G5 live — reproduced at `ea13b37c1`, before ADR-294.)
 */
afterEach(() => vi.restoreAllMocks());

const BODY = "project:node:home-body" as NodeId;
const USERS = [
  { id: "u1", name: "Kim", role: "admin" },
  { id: "u2", name: "Park", role: "editor" },
  { id: "u3", name: "Lee", role: "admin" },
];

const node = (
  id: NodeId,
  definitionId: string,
  children: NodeId[] = [],
  extra: Partial<NodeEntry> = {},
) =>
  ({
    kind: "node",
    id,
    definitionId,
    children,
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...extra,
  }) as unknown as NodeEntry;

async function open(shape: "root" | "child") {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const library: CatalogLibrary = await buildCodeCatalogLibrary();
  const h = await openAdr280Preview(["Button"]);
  const run = (command: Parameters<typeof h.workspace.execute>[0]) => {
    act(() => {
      h.workspace.execute(command);
    });
    h.flush();
  };
  run(
    addCollection({
      entry: {
        kind: "collection",
        id: "data:collection:users",
        name: "Users",
        schema: [
          { id: "f-id", key: "id", type: "string" },
          { id: "f-name", key: "name", type: "string" },
          { id: "f-role", key: "role", type: "string" },
        ],
        mockData: USERS,
        useMockData: true,
      } as never,
    }),
  );
  const list = "project:node:list" as NodeId;
  const frame = "project:node:frame" as NodeId;
  const bound = node(list, catalogPaletteDefinitionId(library, "ListBox"), [], {
    binding: {
      collectionId: "data:collection:users",
      fieldMap: {},
    } as NodeEntry["binding"],
  });
  run(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries:
        shape === "root"
          ? [bound]
          : [
              node(frame, catalogPaletteDefinitionId(library, "frame"), [list]),
              bound,
            ],
      rootIds: [shape === "root" ? list : frame],
      newId: h.workspace.newId,
    }),
  );
  run(
    createComponent({
      id: shape === "root" ? list : frame,
      name: "Picker",
      newId: h.workspace.newId,
    }),
  );
  const graph = () => h.workspace.runtime.graph;
  const project = graph().getEntry(graph().projectId);
  const definitionId = (
    project?.kind === "project" ? project.definitionIds.at(-1) : ""
  ) as EntryId<"definition">;
  const instances = () =>
    (graph().getEntry(BODY) as NodeEntry).children.filter(
      (id) => (graph().getEntry(id) as NodeEntry).definitionId === definitionId,
    ) as NodeId[];
  const options = (instance: NodeId) =>
    [...(h.element(instance)?.querySelectorAll('[role="option"]') ?? [])].map(
      (option) => option.textContent ?? "",
    );
  return { ...h, run, list, definitionId, instances, options };
}

describe("a bound collection inside a component — its instances repeat the rows", () => {
  for (const shape of ["root", "child"] as const)
    it(`the bound ListBox is the origin's ${shape}: the Preview options are the rows`, async () => {
      const h = await open(shape);
      const [instance] = h.instances();
      expect(h.options(instance!)).toEqual(["Kim", "Park", "Lee"]);
      h.view.unmount();
    });

  it("its view reads the instance's variable property: two instances, two row sets", async () => {
    const h = await open("root");
    const team = "project:stateVariable:team" as EntryId<"stateVariable">;
    h.run(
      addComponentOutputProperty({
        definitionId: h.definitionId,
        key: "team",
        name: "team",
        kind: "variable",
        variable: { id: team, valueType: "string", defaultValue: "admin" },
      }),
    );
    h.run(
      setWholeField({
        targets: [{ kind: "node", id: h.list }],
        field: "binding",
        value: {
          collectionId: "data:collection:users",
          fieldMap: {},
          view: {
            where: {
              id: "w",
              op: "and",
              items: [
                {
                  id: "w1",
                  fields: [["data:field:f-role"]],
                  op: "equals",
                  value: `!var.${team}`,
                },
              ],
            },
          },
        } as NodeEntry["binding"],
      }),
    );
    const second = "project:node:second" as NodeId;
    h.run(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          node(second, h.definitionId, [], {
            props: { team: { kind: "set", value: "editor" } },
          } as Partial<NodeEntry>),
        ],
        rootIds: [second],
        newId: h.workspace.newId,
      }),
    );
    const [first] = h.instances();
    h.run(
      setFields({
        targets: [{ kind: "node", id: first! }],
        props: { team: { kind: "set", value: "admin" } },
      }),
    );
    expect(h.options(first!)).toEqual(["Kim", "Lee"]);
    expect(h.options(second)).toEqual(["Park"]);
    h.view.unmount();
  });

  for (const shape of ["plain", "component"] as const)
    it(`a view reads an element variable (a search box's text) — ${shape}: typing narrows the rows`, async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const library = await buildCodeCatalogLibrary();
      const h = await openAdr280Preview(["Button"]);
      const run = (command: Parameters<typeof h.workspace.execute>[0]) => {
        act(() => {
          h.workspace.execute(command);
        });
        h.flush();
      };
      run(
        addCollection({
          entry: {
            kind: "collection",
            id: "data:collection:users",
            name: "Users",
            schema: [
              { id: "f-id", key: "id", type: "string" },
              { id: "f-name", key: "name", type: "string" },
              { id: "f-role", key: "role", type: "string" },
            ],
            mockData: USERS,
            useMockData: true,
          } as never,
        }),
      );
      const frame = "project:node:frame" as NodeId;
      const search = "project:node:search" as NodeId;
      const list = "project:node:list" as NodeId;
      const query = "project:stateVariable:query" as EntryId<"stateVariable">;
      run(
        insertNodes({
          parent: { kind: "node", id: BODY },
          entries: [
            node(frame, catalogPaletteDefinitionId(library, "frame"), [
              search,
              list,
            ]),
            node(search, catalogPaletteDefinitionId(library, "SearchField")),
            node(list, catalogPaletteDefinitionId(library, "ListBox"), [], {
              binding: {
                collectionId: "data:collection:users",
                fieldMap: {},
                view: {
                  where: {
                    id: "w",
                    op: "and",
                    items: [
                      {
                        id: "w1",
                        fields: [["data:field:f-name"]],
                        op: "contains",
                        value: `!var.${query}`,
                      },
                    ],
                  },
                },
              } as NodeEntry["binding"],
            }),
          ],
          rootIds: [frame],
          newId: h.workspace.newId,
        }),
      );
      run(
        addRecord({
          entry: {
            kind: "stateVariable",
            id: query,
            ownerId: frame,
            name: "query",
            valueType: "string",
            defaultValue: "",
          } as StateVariableEntry,
        }),
      );
      run(
        addRecord({
          entry: {
            kind: "interaction",
            id: "project:interaction:search" as EntryId<"interaction">,
            ownerId: search,
            trigger: "onChange",
            actions: [
              {
                opcode: "setState",
                variableId: query,
                op: "set",
                value: "!event.value",
              },
            ],
          } as InteractionEntry,
        }),
      );
      if (shape === "component")
        run(createComponent({ id: frame, name: "Search", newId: h.workspace.newId }));
      const graph = h.workspace.runtime.graph;
      const host =
        shape === "plain"
          ? frame
          : ((graph.getEntry(BODY) as NodeEntry).children.at(-1) as NodeId);
      const element = h.element(host)!;
      const options = () =>
        [...element.querySelectorAll('[role="option"]')].map(
          (option) => option.textContent ?? "",
        );
      expect(options()).toEqual(["Kim", "Park", "Lee"]);
      act(() => {
        fireEvent.change(element.querySelector("input")!, {
          target: { value: "pa" },
        });
      });
      h.flush();
      expect(options()).toEqual(["Park"]);
      h.view.unmount();
    });
});

