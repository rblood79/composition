import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  NodeEntry,
  NodeId,
  StateVariableEntry,
  ViewCondition,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands/structure";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands/fields";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import {
  CATALOG_FILTER_ALL,
  catalogControlFilterConnections,
  catalogEditFilterCondition,
  catalogFilterCommand,
  catalogFilterConnections,
  catalogOrFilterCondition,
  catalogRemoveFilterCondition,
  catalogSortFollowCommand,
  type CatalogFilterControlKind,
} from "../../../builder/catalogRuntime/viewAuthoring";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-284 G3 — 「검색 추가」 · 「이 컨트롤로 거르기」 make one filter in one action: the control, a
 * page variable, the rule (When the value changes → Set state), the list's condition (Decision
 * B-7 defaults). Measured in the Preview: typing · choosing in the control the action made
 * narrows the bound list. Both entry points give the same variable · rule · condition; Undo once
 * takes all of it; re-entering finds the connection (no second variable or rule).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const ROWS = [
  { id: "u1", name: "Kim", gender: "male" },
  { id: "u2", name: "Park", gender: "female" },
  { id: "u3", name: "Lee", gender: "male" },
];
const NAME = { id: "f-name", key: "name", type: "string" };
const GENDER = { id: "f-gender", key: "gender", type: "string" };
const NAMES = /Kim|Park|Lee/;

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function boundList(types: readonly string[] = ["GridList"]) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(types);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "users",
          name: "Users",
          schema: [{ id: "f-id", key: "id", type: "string" }, NAME, GENDER],
          mockData: ROWS,
          runtimeData: [],
          useMockData: true,
        },
      ],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  const list = h.ids[0] as NodeId;
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: list }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  h.flush();
  await settle();
  const graph = () => h.workspace.runtime.graph;
  const shown = () =>
    [
      ...(h.element(list)?.querySelectorAll('[role="row"], [role="option"]') ??
        []),
    ]
      .map((item) => NAMES.exec(item.textContent ?? "")?.[0])
      .filter(Boolean);
  const add = (
    kind: CatalogFilterControlKind,
    field = GENDER,
    control: { insert: true } | { nodeId: NodeId } = { insert: true },
  ) => {
    const { command, created } = catalogFilterCommand(
      graph(),
      {
        listId: list,
        field,
        kind,
        control,
        values: ["male", "female"],
        allLabel: "전체",
      },
      h.workspace.newId,
    );
    expect(h.workspace.execute(command)).toBeTruthy();
    h.flush();
    return created;
  };
  return { ...h, list, graph, shown, add };
}

/** A document part without its ids (the two entry points' parts compared). */
const shape = (value: unknown): unknown =>
  JSON.parse(
    JSON.stringify(value)
      .replace(
        /project:(node|stateVariable|interaction):[A-Za-z0-9-]+/g,
        "<$1>",
      )
      .replace(/filter-[0-9a-f]{8}/g, "<condition>"),
  );

describe("ADR-284 G3 — 「검색 추가」 makes the filter in one action", () => {
  it("text: a SearchField before the list · a string variable · onChange → Set state · `contains` — typing narrows the list", async () => {
    const h = await boundList();
    const depth = h.workspace.runtime.historyDepth?.undo;
    const created = h.add("text", NAME);
    await settle();
    const graph = h.graph();
    const control = graph.getEntry(created.controlId) as NodeEntry;
    expect(control.definitionId).toBe(
      catalogPaletteDefinitionId(graph.library, "SearchField"),
    );
    const page = graph.getEntry(graph.ownerOf(h.list)!);
    expect(
      (page as { children: readonly string[] }).children.indexOf(
        created.controlId,
      ),
    ).toBe(
      (page as { children: readonly string[] }).children.indexOf(h.list) - 1,
    );
    expect(graph.getEntry(created.variableId)).toMatchObject({
      kind: "stateVariable",
      name: "nameFilter",
      valueType: "string",
      defaultValue: "",
    });
    expect(graph.getEntry(created.ruleId)).toMatchObject({
      ownerId: created.controlId,
      trigger: "onChange",
      actions: [
        {
          opcode: "setState",
          variableId: created.variableId,
          op: "set",
          value: "!event.value",
        },
      ],
    });
    const [connection] = catalogFilterConnections(graph, h.list);
    expect(connection).toMatchObject({
      condition: {
        id: created.conditionId,
        fields: [["data:field:f-name"]],
        op: "contains",
        value: `!var.${created.variableId}`,
      },
      variable: { id: created.variableId },
      controls: [{ nodeId: created.controlId, ruleId: created.ruleId }],
    });
    expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
    const input = h.element(created.controlId)!.querySelector("input")!;
    act(() => {
      fireEvent.change(input, { target: { value: "pa" } });
    });
    await settle();
    expect(h.shown()).toEqual(["Park"]);
    // (One action = one history entry: Undo takes the control, variable, rule and condition.)
    if (depth !== undefined)
      expect(h.workspace.runtime.historyDepth.undo).toBe(depth + 1);
    act(() => {
      h.workspace.undo();
    });
    h.flush();
    const after = h.workspace.runtime.graph;
    expect(after.getEntry(created.controlId)).toBeUndefined();
    expect(after.getEntry(created.variableId)).toBeUndefined();
    expect(after.getEntry(created.ruleId)).toBeUndefined();
    expect(catalogFilterConnections(after, h.list)).toEqual([]);
    h.view.unmount();
  });

  it("radio: items = 「전체」 + the field's values · `equals` skipped by `all` — choosing narrows, 「전체」 shows all", async () => {
    const h = await boundList();
    const created = h.add("radio");
    await settle();
    const radios = [
      ...h.element(created.controlId)!.querySelectorAll('input[type="radio"]'),
    ] as HTMLInputElement[];
    expect(radios.map((radio) => radio.value)).toEqual([
      CATALOG_FILTER_ALL,
      "male",
      "female",
    ]);
    expect(
      h.element(created.controlId)!.textContent?.replace(/\s+/g, ""),
    ).toContain("전체malefemale");
    // (「전체」 starts chosen — the variable's default, on the Canvas and in the Preview.)
    expect(radios[0]!.checked).toBe(true);
    const [connection] = catalogFilterConnections(h.graph(), h.list);
    expect(connection!.condition).toMatchObject({
      op: "equals",
      skip: CATALOG_FILTER_ALL,
    });
    expect(h.graph().getEntry(created.variableId)).toMatchObject({
      defaultValue: CATALOG_FILTER_ALL,
    });
    act(() => {
      fireEvent.click(radios[2]!);
    });
    await settle();
    expect(h.shown()).toEqual(["Park"]);
    act(() => {
      fireEvent.click(radios[0]!);
    });
    await settle();
    expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
    h.view.unmount();
  });

  it("select · tags · check · date · range: each kind's items, variable and condition (Decision B-7)", async () => {
    const h = await boundList();
    const graph = () => h.graph();
    const itemsOf = (controlId: NodeId, type: string) => {
      const ids: string[] = [];
      const visit = (id: string) => {
        const node = graph().getEntry(id);
        if (node?.kind !== "node") return;
        if (definitionTypeName(graph(), node.definitionId) === type)
          ids.push(
            String(
              node.props.id && "value" in node.props.id
                ? node.props.id.value
                : "",
            ),
          );
        node.children.forEach(visit);
        for (const override of node.descendantOverrides)
          if (override.kind === "fillSlot") override.childIds.forEach(visit);
      };
      visit(controlId);
      return ids;
    };
    const select = h.add("select");
    expect(itemsOf(select.controlId, "ListBoxItem")).toEqual([
      CATALOG_FILTER_ALL,
      "male",
      "female",
    ]);
    const tags = h.add("tags");
    expect(itemsOf(tags.controlId, "Tag")).toEqual(["male", "female"]);
    expect(graph().getEntry(tags.variableId)).toMatchObject({
      valueType: "array",
    });
    expect(graph().getEntry(tags.ruleId)).toMatchObject({
      trigger: "onSelectionChange",
      actions: [{ value: "!event.keys" }],
    });
    const check = h.add("check");
    const date = h.add("date", { id: "f-id", key: "joined", type: "date" });
    const range = h.add("range", { id: "f-id", key: "joined", type: "date" });
    const conditions = Object.fromEntries(
      catalogFilterConnections(graph(), h.list).map((connection) => [
        connection.condition.id,
        connection.condition,
      ]),
    ) as Record<string, ViewCondition>;
    expect(conditions[select.conditionId]).toMatchObject({
      op: "equals",
      skip: CATALOG_FILTER_ALL,
    });
    expect(conditions[tags.conditionId]).toMatchObject({ op: "oneOf" });
    expect(conditions[check.conditionId]).toMatchObject({
      op: "equals",
      value: "male",
      enabled: `!var.${check.variableId}`,
    });
    expect(conditions[date.conditionId]).toMatchObject({
      op: "equals",
      value: `!var.${date.variableId}`,
    });
    expect(conditions[range.conditionId]).toMatchObject({
      op: "between",
      value: [`!var.${range.variableId}.start`, `!var.${range.variableId}.end`],
    });
    // (Every name is its own: genderFilter · genderFilter2 …)
    expect(
      [select, tags, check].map(
        (made) =>
          (graph().getEntry(made.variableId) as StateVariableEntry).name,
      ),
    ).toEqual(["genderFilter", "genderFilter2", "genderFilter3"]);
    // (With all of them in place the list still shows every row: each skips at its default.)
    await settle();
    expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
    h.view.unmount();
  });
});

describe("ADR-284 G3 — the control entry point, re-entry, edit, unlink", () => {
  it("「이 컨트롤로 거르기」 on a placed RadioGroup makes the same variable · rule · condition as 「검색 추가」", async () => {
    const a = await boundList();
    const fromList = a.add("radio");
    const listSide = {
      variable: a.graph().getEntry(fromList.variableId),
      rule: a.graph().getEntry(fromList.ruleId),
      condition: catalogFilterConnections(a.graph(), a.list)[0]!.condition,
    };
    a.view.unmount();

    const b = await boundList(["GridList", "RadioGroup"]);
    const radio = b.ids[1] as NodeId;
    const fromControl = b.add("radio", GENDER, { nodeId: radio });
    expect(fromControl.controlId).toBe(radio);
    const controlSide = {
      variable: b.graph().getEntry(fromControl.variableId),
      rule: b.graph().getEntry(fromControl.ruleId),
      condition: catalogFilterConnections(b.graph(), b.list)[0]!.condition,
    };
    expect(shape(controlSide)).toEqual(shape(listSide));
    // (The control finds its connection — the list it narrows.)
    expect(
      catalogControlFilterConnections(b.graph(), radio).map(
        (connection) => connection.listId,
      ),
    ).toEqual([b.list]);
    b.view.unmount();
  });

  it("re-entry edits the connection (no new variable · rule); 「또는」 wraps it; unlink drops only the condition", async () => {
    const h = await boundList();
    const created = h.add("text", NAME);
    // (Re-entry edits: the project's variables and the control's rules stay as many.)
    const count = (_kind: string) =>
      (
        h.graph().getEntry(h.graph().projectId) as unknown as {
          stateVariableIds: string[];
        }
      ).stateVariableIds.length +
      [...h.graph().referrersOf(created.controlId)].length;
    const variablesBefore = count("variables");
    h.workspace.execute(
      catalogEditFilterCondition(h.graph(), h.list, created.conditionId, {
        op: "startsWith",
      }),
    );
    h.flush();
    expect(count("variables")).toBe(variablesBefore);
    const [connection] = catalogFilterConnections(h.graph(), h.list);
    expect(connection!.condition.op).toBe("startsWith");
    expect(connection!.controls).toEqual([
      { nodeId: created.controlId, ruleId: created.ruleId },
    ]);
    const input = h.element(created.controlId)!.querySelector("input")!;
    act(() => {
      fireEvent.change(input, { target: { value: "a" } });
    });
    await settle();
    // (`startsWith` a: none — `contains` would have kept Park.)
    expect(h.shown()).toEqual([]);

    h.workspace.execute(
      catalogOrFilterCondition(
        h.graph(),
        h.list,
        created.conditionId,
        "second",
      ),
    );
    h.flush();
    const list = h.graph().getEntry(h.list) as NodeEntry;
    expect(list.binding!.view!.where.items[0]).toMatchObject({
      op: "or",
      items: [{ id: created.conditionId }, { id: "second" }],
    });

    h.workspace.execute(
      catalogRemoveFilterCondition(h.graph(), h.list, created.conditionId),
    );
    h.workspace.execute(
      catalogRemoveFilterCondition(h.graph(), h.list, "second"),
    );
    h.flush();
    await settle();
    expect(catalogFilterConnections(h.graph(), h.list)).toEqual([]);
    // (The variable, the rule and the control stay — deleting them is their own action.)
    expect(h.graph().getEntry(created.variableId)).toBeDefined();
    expect(h.graph().getEntry(created.ruleId)).toBeDefined();
    expect(h.graph().getEntry(created.controlId)).toBeDefined();
    expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
    h.view.unmount();
  });

  it("a condition on a project variable finds the page rules that set it (outside the reference index)", async () => {
    const h = await boundList(["GridList", "Button"]);
    const button = h.ids[1] as NodeId;
    act(() => {
      h.session.receive({
        type: "CATALOG_DATA",
        version: 1,
        collections: [],
        variables: [
          { id: "g", name: "g", type: "string", defaultValue: "all" },
        ],
        apiEndpoints: [],
      } as never);
    });
    const list = h.graph().getEntry(h.list) as NodeEntry;
    h.workspace.execute(
      catalogBindingCommand([{ kind: "node", id: h.list }], {
        ...list.binding!,
        view: {
          where: {
            id: "where",
            op: "and",
            items: [
              {
                id: "g",
                fields: [["data:field:f-gender"]],
                op: "equals",
                value: "!var.data:variable:g",
                skip: "all",
              },
            ],
          },
        },
      }),
    );
    h.rule(button, "onPress", {
      opcode: "setState",
      variableId: "data:variable:g",
      op: "set",
      value: "female",
    });
    const [connection] = catalogFilterConnections(h.graph(), h.list);
    expect(connection!.controls.map((control) => control.nodeId)).toEqual([
      button,
    ]);
    h.view.unmount();
  });

  it("a list without a binding is refused whole — nothing is left half made", async () => {
    const h = await boundList(["GridList", "ListBox"]);
    const unbound = h.ids[1] as NodeId;
    const before = h.graph().revision;
    const { command } = catalogFilterCommand(
      h.graph(),
      {
        listId: unbound,
        field: NAME,
        kind: "text",
        control: { insert: true },
        values: [],
        allLabel: "전체",
      },
      h.workspace.newId,
    );
    expect(() => h.workspace.execute(command)).toThrow();
    expect(h.graph().revision).toBe(before);
    void insertNodes;
    h.view.unmount();
  });
});

describe("ADR-284 G3 — 「정렬 따라가기」 and the Table that keeps its own sort (사용자 결정 2)", () => {
  const pressName = async (
    h: Awaited<ReturnType<typeof boundList>>,
    tableId: NodeId,
  ) => {
    const header = [
      ...(h.element(tableId)?.querySelectorAll('[role="columnheader"]') ?? []),
    ].find((cell) => /Name/.test(cell.textContent ?? "")) as HTMLElement;
    act(() => {
      fireEvent.pointerDown(header, { button: 0, pointerType: "mouse" });
      fireEvent.pointerUp(header, { button: 0, pointerType: "mouse" });
      fireEvent.click(header);
    });
    await settle();
  };
  const listOrder = (h: Awaited<ReturnType<typeof boundList>>, id: NodeId) =>
    [
      ...(h.element(id)?.querySelectorAll('[role="row"], [role="option"]') ??
        []),
    ]
      .map((item) => NAMES.exec(item.textContent ?? "")?.[0])
      .filter(Boolean);

  it("without a sort variable a bound Table's header press is ADR-257's runtime sort — the GridList keeps its order", async () => {
    const h = await boundList(["GridList", "Table"]);
    const tableId = h.ids[1] as NodeId;
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: tableId }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
      ),
    );
    // (The author's switch only — Columns sortable, no sort variable: ADR-257 as it was.)
    const columns: NodeId[] = [];
    const visit = (id: string) => {
      const node = h.graph().getEntry(id);
      if (node?.kind !== "node") return;
      if (definitionTypeName(h.graph(), node.definitionId) === "Column")
        columns.push(id as NodeId);
      node.children.forEach(visit);
      for (const override of node.descendantOverrides)
        if (override.kind === "fillSlot") override.childIds.forEach(visit);
    };
    visit(tableId);
    expect(columns.length).toBeGreaterThan(0);
    h.workspace.execute(
      setFields({
        targets: columns.map((id) => ({ kind: "node" as const, id })),
        props: { allowsSorting: { kind: "set", value: true } },
      }),
    );
    h.flush();
    await settle();
    await pressName(h, tableId);
    expect(listOrder(h, tableId)).toEqual(["Kim", "Lee", "Park"]);
    // (The GridList is not the Table's: its order stays the data's.)
    expect(listOrder(h, h.list)).toEqual(["Kim", "Park", "Lee"]);
    h.view.unmount();
  });

  it("「정렬 따라가기」 is one step: the variable · the Table's onSortChange rule · both views' sort · sortable Columns", async () => {
    const h = await boundList(["GridList", "Table"]);
    const tableId = h.ids[1] as NodeId;
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: tableId }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
      ),
    );
    h.flush();
    const depth = h.workspace.runtime.historyDepth.undo;
    const { command, created } = catalogSortFollowCommand(
      h.graph(),
      { tableId, followerIds: [h.list] },
      h.workspace.newId,
    );
    h.workspace.execute(command);
    h.flush();
    await settle();
    expect(h.workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(h.graph().getEntry(created.variableId)).toMatchObject({
      name: "tableSort",
      valueType: "object",
    });
    expect(h.graph().getEntry(created.ruleId)).toMatchObject({
      ownerId: tableId,
      trigger: "onSortChange",
      actions: [{ value: "!event.descriptor" }],
    });
    for (const id of [tableId, h.list])
      expect((h.graph().getEntry(id) as NodeEntry).binding!.view!.sort).toEqual(
        { variableId: created.variableId },
      );
    await pressName(h, tableId);
    expect(listOrder(h, tableId)).toEqual(["Kim", "Lee", "Park"]);
    expect(listOrder(h, h.list)).toEqual(["Kim", "Lee", "Park"]);
    // (Another writer of the variable — a rule elsewhere: the Table's rows and arrow follow it,
    // not the Table's last press.)
    const written = h.session.readVariable({
      variableId: created.variableId,
    } as never)!.value as { column: string };
    act(() => {
      h.session.writeState({
        variableId: created.variableId,
        op: "set",
        value: { column: written.column, direction: "descending" },
      } as never);
    });
    await settle();
    expect(listOrder(h, tableId)).toEqual(["Park", "Lee", "Kim"]);
    expect(listOrder(h, h.list)).toEqual(["Park", "Lee", "Kim"]);
    const header = [
      ...(h.element(tableId)?.querySelectorAll('[role="columnheader"]') ?? []),
    ].find((cell) => /Name/.test(cell.textContent ?? ""))!;
    expect(header.getAttribute("aria-sort")).toBe("descending");
    h.workspace.undo();
    h.flush();
    expect(h.graph().getEntry(created.variableId)).toBeUndefined();
    expect(
      (h.graph().getEntry(h.list) as NodeEntry).binding!.view?.sort,
    ).toBeUndefined();
    h.view.unmount();
  });
});
