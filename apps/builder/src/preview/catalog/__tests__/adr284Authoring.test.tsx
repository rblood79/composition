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
  CATALOG_FILTER_CONTROLS,
  catalogControlFilterConnections,
  catalogFilterControlsOfType,
  catalogEditFilterCondition,
  catalogFilterCommand,
  catalogFilterConnections,
  catalogOrFilterCondition,
  catalogRemoveFilterCondition,
  catalogShareView,
  catalogSharedViewOf,
  catalogSortFollowCommand,
  catalogSplitSharedView,
  catalogUnreadFilterVariables,
  type CatalogFilterControlKind,
} from "../../../builder/catalogRuntime/viewAuthoring";
import { generateCodeView } from "../../../../../../packages/shared/src/codeView/generate";
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
  { id: "u1", name: "Kim", gender: "male", age: 31, joined: "2026-01-05" },
  { id: "u2", name: "Park", gender: "female", age: 24, joined: "2026-03-10" },
  { id: "u3", name: "Lee", gender: "male", age: 19, joined: "2026-05-20" },
];
const NAME = { id: "f-name", key: "name", type: "string" };
const GENDER = { id: "f-gender", key: "gender", type: "string" };
const AGE = { id: "f-age", key: "age", type: "number" };
const JOINED = { id: "f-joined", key: "joined", type: "date" };
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
          schema: [
            { id: "f-id", key: "id", type: "string" },
            NAME,
            GENDER,
            AGE,
            JOINED,
          ],
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
    field: { id: string; key: string; type?: string } = GENDER,
    control: { insert: true } | { nodeId: NodeId } = { insert: true },
    values: string[] = ["male", "female"],
  ) => {
    const { command, created } = catalogFilterCommand(
      graph(),
      {
        listId: list,
        field,
        kind,
        control,
        values,
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
    const created = h.add("SearchField", NAME);
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
    const created = h.add("RadioGroup");
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
    const select = h.add("Select");
    expect(itemsOf(select.controlId, "ListBoxItem")).toEqual([
      CATALOG_FILTER_ALL,
      "male",
      "female",
    ]);
    const tags = h.add("TagGroup");
    expect(itemsOf(tags.controlId, "Tag")).toEqual(["male", "female"]);
    expect(graph().getEntry(tags.variableId)).toMatchObject({
      valueType: "array",
    });
    expect(graph().getEntry(tags.ruleId)).toMatchObject({
      trigger: "onSelectionChange",
      actions: [{ value: "!event.keys" }],
    });
    const check = h.add("Checkbox");
    const date = h.add("DatePicker", {
      id: "f-id",
      key: "joined",
      type: "date",
    });
    const range = h.add("DateRangePicker", {
      id: "f-id",
      key: "joined",
      type: "date",
    });
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

describe("ADR-284 Phase 6 — the controls 「검색 추가」 makes show their variable", () => {
  it("a Clear button resetting the variables clears the TagGroup · Checkbox · RadioGroup (plants' Clear filters)", async () => {
    const h = await boundList(["GridList", "Button"]);
    const clear = h.ids[1] as NodeId;
    const tags = h.add("TagGroup");
    const check = h.add("Checkbox");
    const radio = h.add("RadioGroup");
    h.rule(clear, "onPress", [
      { opcode: "setState", variableId: tags.variableId, op: "reset" },
      { opcode: "setState", variableId: check.variableId, op: "reset" },
      { opcode: "setState", variableId: radio.variableId, op: "reset" },
    ] as never);
    await settle();
    const tagRows = () => [
      ...h.element(tags.controlId)!.querySelectorAll('[role="row"]'),
    ];
    const radios = () =>
      [
        ...h.element(radio.controlId)!.querySelectorAll('input[type="radio"]'),
      ] as HTMLInputElement[];
    const box = () =>
      h
        .element(check.controlId)!
        .querySelector('input[type="checkbox"]') as HTMLInputElement;
    act(() => {
      fireEvent.click(tagRows()[1]!);
    });
    await settle();
    act(() => {
      fireEvent.click(radios()[2]!);
    });
    await settle();
    act(() => {
      fireEvent.click(box());
    });
    await settle();
    expect(tagRows()[1]!.getAttribute("aria-selected")).toBe("true");
    expect(radios()[2]!.checked).toBe(true);
    expect(box().checked).toBe(true);
    act(() => {
      fireEvent.click(h.element(clear)!);
    });
    await settle();
    // (The variables back to their defaults — and the controls show them.)
    expect(tagRows().map((row) => row.getAttribute("aria-selected"))).toEqual([
      "false",
      "false",
    ]);
    expect(radios()[0]!.checked).toBe(true);
    expect(box().checked).toBe(false);
    expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
    h.view.unmount();
  });
});

describe("ADR-284 G3 — the control entry point, re-entry, edit, unlink", () => {
  it("「이 컨트롤로 거르기」 on a placed RadioGroup makes the same variable · rule · condition as 「검색 추가」", async () => {
    const a = await boundList();
    const fromList = a.add("RadioGroup");
    const listSide = {
      variable: a.graph().getEntry(fromList.variableId),
      rule: a.graph().getEntry(fromList.ruleId),
      condition: catalogFilterConnections(a.graph(), a.list)[0]!.condition,
    };
    a.view.unmount();

    const b = await boundList(["GridList", "RadioGroup"]);
    const radio = b.ids[1] as NodeId;
    const fromControl = b.add("RadioGroup", GENDER, { nodeId: radio });
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
    const created = h.add("SearchField", NAME);
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
        kind: "SearchField",
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

describe("ADR-284 G3 — a shared view (「N 개가 봅니다」 · 이 목록에서만) and the hand-made variable (§9.3-9)", () => {
  const rowsOf = (h: Awaited<ReturnType<typeof boundList>>, id: NodeId) =>
    [
      ...(h.element(id)?.querySelectorAll('[role="row"], [role="option"]') ??
        []),
    ]
      .map((item) => NAMES.exec(item.textContent ?? "")?.[0])
      .filter(Boolean);
  const bindUsers = (h: Awaited<ReturnType<typeof boundList>>, id: NodeId) =>
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
      ),
    );

  it("「이름 붙여 공유」: another list reads the same conditions; 「이 목록에서만」 gives it a copy — the shared view and its other reader stay", async () => {
    const h = await boundList(["GridList", "ListBox"]);
    const other = h.ids[1] as NodeId;
    bindUsers(h, other);
    const radio = h.add("RadioGroup");
    h.workspace.execute(
      catalogShareView(
        h.graph(),
        { listId: h.list, name: "People", otherIds: [other] },
        h.workspace.newId,
      ),
    );
    h.flush();
    await settle();
    const shared = catalogSharedViewOf(h.graph(), other)!;
    expect(shared.view.name).toBe("People");
    expect(shared.users.sort()).toEqual([h.list, other].sort());
    // (Both read the one condition: female narrows both.)
    const radios = [
      ...h.element(radio.controlId)!.querySelectorAll('input[type="radio"]'),
    ] as HTMLInputElement[];
    act(() => {
      fireEvent.click(radios[2]!);
    });
    await settle();
    expect(rowsOf(h, h.list)).toEqual(["Park"]);
    expect(rowsOf(h, other)).toEqual(["Park"]);
    // 「이 목록에서만」: the ListBox keeps its own copy; editing the shared view no longer reaches it.
    h.workspace.execute(catalogSplitSharedView(h.graph(), other));
    h.flush();
    expect(catalogSharedViewOf(h.graph(), other)).toBeUndefined();
    expect(catalogSharedViewOf(h.graph(), h.list)!.users).toEqual([h.list]);
    h.workspace.execute(
      catalogEditFilterCondition(h.graph(), h.list, radio.conditionId, {
        op: "notEquals",
      }),
    );
    h.flush();
    await settle();
    expect(rowsOf(h, h.list)).toEqual(["Kim", "Lee"]);
    expect(rowsOf(h, other)).toEqual(["Park"]);
    // (Undo of the split: the ListBox reads the shared view again.)
    h.workspace.undo();
    h.workspace.undo();
    h.flush();
    expect(catalogSharedViewOf(h.graph(), other)!.users.sort()).toEqual(
      [h.list, other].sort(),
    );
    h.view.unmount();
  });

  it("a control whose hand-made rule sets a variable no list reads is named; 「이 목록의 조건으로 연결」 reads that variable — no second variable or rule", async () => {
    const h = await boundList(["GridList", "RadioGroup"]);
    const radio = h.ids[1] as NodeId;
    // (The B habit: a variable and an onChange → Set state rule made by hand, no condition.)
    const made = h.add("RadioGroup", GENDER, { nodeId: radio });
    h.workspace.execute(
      catalogRemoveFilterCondition(h.graph(), h.list, made.conditionId),
    );
    h.flush();
    const unread = catalogUnreadFilterVariables(h.graph(), h.list);
    expect(unread).toEqual([
      {
        variableId: made.variableId,
        name: "genderFilter",
        controlId: radio,
        ruleId: made.ruleId,
      },
    ]);
    const project = () =>
      (
        h.graph().getEntry(h.graph().projectId) as unknown as {
          stateVariableIds: string[];
        }
      ).stateVariableIds.length;
    const variables = project();
    const rules = [...h.graph().referrersOf(radio)].length;
    const { command, created } = catalogFilterCommand(
      h.graph(),
      {
        listId: h.list,
        field: GENDER,
        kind: "RadioGroup",
        control: { nodeId: radio },
        values: [],
        allLabel: "전체",
        reuseVariableId: made.variableId,
      },
      h.workspace.newId,
    );
    h.workspace.execute(command);
    h.flush();
    expect(project()).toBe(variables);
    expect([...h.graph().referrersOf(radio)].length).toBe(rules);
    expect(created.ruleId).toBe(made.ruleId);
    expect(catalogUnreadFilterVariables(h.graph(), h.list)).toEqual([]);
    expect(catalogFilterConnections(h.graph(), h.list)[0]!.controls).toEqual([
      { nodeId: radio, ruleId: made.ruleId },
    ]);
    h.view.unmount();
  });
});

describe("ADR-284 Decision 11 — the running Preview reports its variables (the Builder's detail reads them)", () => {
  it("a variable write is reported once, in plain values", async () => {
    const h = await boundList();
    const created = h.add("RadioGroup");
    await settle();
    const reports: Record<string, unknown>[] = [];
    (
      h.session as unknown as {
        options: { reportState?: (values: Record<string, unknown>) => void };
      }
    ).options.reportState = (values) => reports.push({ ...values });
    act(() => {
      h.session.writeState({
        variableId: created.variableId,
        op: "set",
        value: "female",
      } as never);
      h.session.writeState({
        variableId: created.variableId,
        op: "set",
        value: "male",
      } as never);
    });
    await settle();
    expect(reports).toHaveLength(1);
    expect(reports[0]![created.variableId]).toBe("male");
    h.view.unmount();
  });
});

/**
 * 2026-10-27 사용자 보고 「검색 생성시 slider, combobox 가 누락」 · 「switch 도 누락」 — the controls
 * came from a 7-row hand table. They are now every RAC value state in the interaction registry
 * (breakdown §1 「손 표 금지」): each one places, writes its variable and narrows the list.
 */
describe("ADR-284 G8 follow-up — 「검색 추가」 offers every value control the registry has", () => {
  it("the controls are the registry's value states: Slider · NumberField · ComboBox (key + typed text) · Switch · ToggleButton …", () => {
    const ids = CATALOG_FILTER_CONTROLS.map((control) => control.id);
    for (const id of [
      "SearchField",
      "TextField",
      "TextArea",
      "ComboBox:input",
      "RadioGroup",
      "Select",
      "ComboBox",
      "Tabs",
      "TagGroup",
      "CheckboxGroup",
      "ToggleButtonGroup",
      "ListBox",
      "GridList",
      "Menu",
      "Table",
      "Tree",
      "Checkbox",
      "Switch",
      "ToggleButton",
      "NumberField",
      "Slider",
      "DatePicker",
      "DateField",
      "TimeField",
      "Calendar",
      "DateRangePicker",
      "RangeCalendar",
    ])
      expect(ids).toContain(id);
    // (Not a value: open · expansion · focus · sort · color; an Autocomplete filters its own list.)
    for (const id of [
      "Disclosure",
      "Popover",
      "ColorField",
      "ColorSlider",
      "Autocomplete",
      "Autocomplete:input",
    ])
      expect(ids).not.toContain(id);
    const shapeOf = (id: string) =>
      CATALOG_FILTER_CONTROLS.find((control) => control.id === id)!.shape;
    expect(shapeOf("Slider")).toBe("number");
    expect(shapeOf("NumberField")).toBe("number");
    expect(shapeOf("Switch")).toBe("check");
    expect(shapeOf("ComboBox")).toBe("key");
    expect(shapeOf("ComboBox:input")).toBe("text");
    expect(shapeOf("CheckboxGroup")).toBe("keys");
    expect(
      catalogFilterControlsOfType("ComboBox").map((control) => control.id),
    ).toEqual(["ComboBox:input", "ComboBox"]);
    // (Tabs pair a TabPanel per Tab · Tree nests · Table · CardView hold rows: only the control
    // the author made filters — 「이 컨트롤로 거르기」.)
    const insertable = (id: string) =>
      CATALOG_FILTER_CONTROLS.find((control) => control.id === id)!.insertable;
    // (A ToggleButton's key is its node id: a group of field values cannot be made.)
    expect(
      ["Tabs", "Tree", "Table", "CardView", "ToggleButtonGroup", "Menu"].map(
        insertable,
      ),
    ).toEqual([false, false, false, false, false, false]);
    expect(
      ["Slider", "ComboBox", "Switch", "CheckboxGroup"].map(insertable),
    ).toEqual([true, true, true, true]);
  });

  it("every control 「검색 추가」 places makes its control · variable · rule · condition in one step, and each starts skipped", async () => {
    const h = await boundList();
    const fieldFor = {
      text: NAME,
      key: GENDER,
      keys: GENDER,
      check: GENDER,
      number: AGE,
      date: JOINED,
      range: JOINED,
    } as const;
    for (const control of CATALOG_FILTER_CONTROLS.filter(
      (item) => item.insertable,
    )) {
      const depth = h.workspace.runtime.historyDepth?.undo ?? 0;
      const field = fieldFor[control.shape];
      const values =
        control.shape === "number"
          ? ["31", "24", "19"]
          : field === GENDER
            ? ["male", "female"]
            : [];
      const made = h.add(control.id, field, { insert: true }, values);
      expect(
        h.workspace.runtime.historyDepth?.undo,
        `${control.id}: one step`,
      ).toBe(depth + 1);
      const graph = h.graph();
      const node = graph.getEntry(made.controlId);
      expect(node?.kind, control.id).toBe("node");
      expect(
        definitionTypeName(graph, (node as NodeEntry).definitionId),
        control.id,
      ).toBe(control.type);
      expect(graph.getEntry(made.ruleId), control.id).toMatchObject({
        trigger: control.trigger,
        actions: [{ value: `!event.${control.arg}` }],
      });
    }
    await settle();
    // (Every control starts on the value that skips its condition: the list shows every row.)
    expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
    h.view.unmount();
  });

  it("Slider on a number field: spans the field's values, starts at the smallest (「이상」 — all rows), moving it narrows", async () => {
    const h = await boundList();
    const made = h.add("Slider", AGE, { insert: true }, ["31", "24", "19"]);
    const graph = h.graph();
    const slider = graph.getEntry(made.controlId) as NodeEntry;
    expect(slider.props.minValue).toMatchObject({ value: 19 });
    expect(slider.props.maxValue).toMatchObject({ value: 31 });
    expect(graph.getEntry(made.variableId)).toMatchObject({
      valueType: "number",
      defaultValue: 19,
    });
    const [connection] = catalogFilterConnections(graph, h.list);
    expect(connection!.condition).toMatchObject({
      op: "gte",
      value: `!var.${made.variableId}`,
    });
    await settle();
    expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
    const input = h
      .element(made.controlId)!
      .querySelector('input[type="range"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    act(() => {
      fireEvent.change(input, { target: { value: "24" } });
    });
    await settle();
    expect(h.shown()).toEqual(["Kim", "Park"]);
    h.view.unmount();
  });

  it("Switch: says what it turns on (「gender = male」), on narrows to that value, off shows all", async () => {
    const h = await boundList();
    const made = h.add("Switch");
    await settle();
    const element = h.element(made.controlId)!;
    expect(element.textContent).toContain("gender = male");
    const input = element.querySelector("input") as HTMLInputElement;
    act(() => {
      fireEvent.click(input);
    });
    await settle();
    expect(h.shown()).toEqual(["Kim", "Lee"]);
    act(() => {
      fireEvent.click(input);
    });
    await settle();
    expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
    h.view.unmount();
  });

  it("ComboBox: the chosen key (items 「전체」 + values, `equals` skipped by `all`) or the typed text (`contains`)", async () => {
    const h = await boundList();
    const picked = h.add("ComboBox");
    const typed = h.add("ComboBox:input", NAME, { insert: true }, []);
    const graph = h.graph();
    const items: string[] = [];
    const visit = (id: string) => {
      const node = graph.getEntry(id);
      if (node?.kind !== "node") return;
      if (definitionTypeName(graph, node.definitionId) === "ListBoxItem")
        items.push(String((node.props.id as { value?: unknown })?.value));
      node.children.forEach(visit);
      for (const override of node.descendantOverrides)
        if (override.kind === "fillSlot") override.childIds.forEach(visit);
    };
    visit(picked.controlId);
    expect(items).toEqual([CATALOG_FILTER_ALL, "male", "female"]);
    expect(graph.getEntry(picked.ruleId)).toMatchObject({
      trigger: "onSelectionChange",
    });
    expect(graph.getEntry(typed.ruleId)).toMatchObject({
      trigger: "onInputChange",
      actions: [{ value: "!event.value" }],
    });
    const conditions = Object.fromEntries(
      catalogFilterConnections(graph, h.list).map((connection) => [
        connection.condition.id,
        connection.condition,
      ]),
    ) as Record<string, ViewCondition>;
    expect(conditions[picked.conditionId]).toMatchObject({
      op: "equals",
      skip: CATALOG_FILTER_ALL,
    });
    expect(conditions[typed.conditionId]).toMatchObject({ op: "contains" });
    // (Each control shows its variable: the typed one's text, the picked one's key.)
    const props = (id: NodeId) => (graph.getEntry(id) as NodeEntry).props;
    expect(props(typed.controlId).inputValue).toMatchObject({
      value: { kind: "var", ref: `!var.${typed.variableId}` },
    });
    expect(props(picked.controlId).selectedKey).toMatchObject({
      value: { kind: "var", ref: `!var.${picked.variableId}` },
    });
    // (The code view writes the key RAC reports — `onSelectionChange(key)` — not a Set's first.)
    const code = generateCodeView({
      reader: graph,
      pageId: "project:page:home" as never,
      collections: [],
    }).code;
    expect(code).toMatch(/setGenderFilter\(keys \?\? ''\)/);
    expect(code).not.toMatch(/setGenderFilter\(\[\.\.\.keys\]\[0\]/);
    await settle();
    expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
    h.view.unmount();
  });
});
