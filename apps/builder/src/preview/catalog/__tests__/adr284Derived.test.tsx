import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  NodeId,
  ViewConditionGroup,
  ViewQuery,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { removeTargets } from "../../../../../../packages/shared/src/catalog/commands/structure";
import { catalogViewUsers } from "../../../../../../packages/shared/src/catalog/commands/views";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogEditFilterCondition,
  catalogFilterCommand,
  catalogGroupColumnsCommand,
  catalogGroupListCommand,
  catalogResultCountCommand,
} from "../../../builder/catalogRuntime/viewAuthoring";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-284 G4 — derived views made in one action: 「결과 수 표시」 (a Text reading a count over the
 * list's view), 「묶기로 목록 만들기」 (a ListBox of groups with their counts), 「묶기로 열 만들기」
 * (kanban columns with counts). The list's built-in view is promoted to a shared view the derived
 * view reads (review round 3 M2): a condition added to the list later reaches the count, Undo once
 * takes the derived view and the promotion, and no condition is copied. Measured in the Preview.
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

async function boundList() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["GridList"]);
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
  // (「검색 추가」 — a gender radio, so a choice narrows the list's view.)
  const { command, created } = catalogFilterCommand(
    graph(),
    {
      listId: list,
      field: GENDER,
      kind: "radio",
      control: { insert: true },
      values: ["male", "female"],
      allLabel: "전체",
    },
    h.workspace.newId,
  );
  h.workspace.execute(command);
  h.flush();
  await settle();
  const choose = async (index: number) => {
    const radios = [
      ...h.element(created.controlId)!.querySelectorAll('input[type="radio"]'),
    ] as HTMLInputElement[];
    act(() => {
      fireEvent.click(radios[index]!);
    });
    await settle();
  };
  const text = (id: NodeId) => h.element(id)?.textContent?.trim();
  const names = (id: NodeId) =>
    [
      ...(h.element(id)?.querySelectorAll('[role="row"], [role="option"]') ??
        []),
    ]
      .map((item) => NAMES.exec(item.textContent ?? "")?.[0])
      .filter(Boolean);
  /** Every condition in the document (built-in and shared views) — a copy would add some. */
  const conditions = () => {
    let count = 0;
    const visit = (group: ViewConditionGroup) =>
      group.items.forEach((item) =>
        "items" in item ? visit(item) : (count += 1),
      );
    for (const entry of Object.values(graph().exportDocument().entries)) {
      if (entry.kind === "view") visit((entry as ViewQuery).where);
      if (entry.kind === "node" && entry.binding?.view)
        visit(entry.binding.view.where);
    }
    return count;
  };
  return {
    ...h,
    list,
    graph,
    choose,
    text,
    names,
    conditions,
    filter: created,
  };
}

describe("ADR-284 G4 — 「결과 수 표시」 · the promoted view (review round 3 M2)", () => {
  it("a Text before the list counts its view; a choice · a later condition reach it; one Undo takes it and the promotion; no condition copied", async () => {
    const h = await boundList();
    const before = h.conditions();
    const { command, created } = catalogResultCountCommand(
      h.graph(),
      { listId: h.list, viewName: "Users view", text: "{count}개" },
      h.workspace.newId,
    );
    const depth = h.workspace.runtime.historyDepth.undo;
    expect(h.workspace.execute(command)).toBeTruthy();
    expect(h.workspace.runtime.historyDepth.undo).toBe(depth + 1);
    h.flush();
    await settle();
    const binding = () => {
      const entry = h.graph().getEntry(h.list);
      return entry?.kind === "node" ? entry.binding : undefined;
    };
    // (Promoted: the list reads a shared view; the count reads that view — the conditions moved, not copied.)
    expect(binding()?.viewId).toBeTruthy();
    expect(binding()?.view).toBeUndefined();
    expect(h.conditions()).toBe(before);
    expect(h.text(created.textId)).toBe("3개");
    await h.choose(2);
    expect(h.names(h.list)).toEqual(["Park"]);
    expect(h.text(created.textId)).toBe("1개");
    // (A condition changed on the list after: the count follows — it reads the list's view.)
    h.workspace.execute(
      catalogEditFilterCondition(h.graph(), h.list, h.filter.conditionId, {
        op: "notEquals",
      }),
    );
    h.flush();
    await settle();
    expect(h.names(h.list)).toEqual(["Kim", "Lee"]);
    expect(h.text(created.textId)).toBe("2개");
    h.workspace.undo();
    h.workspace.undo();
    h.flush();
    await settle();
    expect(h.element(created.textId)).toBeFalsy();
    expect(h.graph().getEntry(created.viewId)).toBeUndefined();
    expect(binding()?.viewId).toBeUndefined();
    expect(binding()?.view?.where.items).toHaveLength(1);
    h.view.unmount();
  });
});

describe("ADR-284 G4 — a derived view goes with the last node reading it", () => {
  it("deleting the result count's Text deletes its count view (the list's view keeps one reader); Undo restores both", async () => {
    const h = await boundList();
    const { command, created } = catalogResultCountCommand(
      h.graph(),
      { listId: h.list, viewName: "Users view", text: "{count}개" },
      h.workspace.newId,
    );
    h.workspace.execute(command);
    const listView = () => {
      const entry = h.graph().getEntry(h.list);
      return entry?.kind === "node" ? entry.binding!.viewId! : undefined;
    };
    const source = listView()!;
    expect(catalogViewUsers(h.graph(), source)).toHaveLength(2);
    expect(
      h.workspace.execute(
        removeTargets({ targets: [{ kind: "node", id: created.textId }] }),
      ),
    ).toBeTruthy();
    expect(h.graph().getEntry(created.viewId)).toBeUndefined();
    expect(catalogViewUsers(h.graph(), source)).toEqual([h.list]);
    h.workspace.undo();
    expect(h.graph().getEntry(created.viewId)).toBeTruthy();
    expect(catalogViewUsers(h.graph(), source)).toHaveLength(2);
    h.view.unmount();
  });
});

describe("ADR-284 결정 3 — 「적용 조건 수 표시」", () => {
  it("a Text before the list counts the view's applied conditions: 「전체」 is none, a choice is one", async () => {
    const h = await boundList();
    const { command, created } = catalogResultCountCommand(
      h.graph(),
      {
        listId: h.list,
        viewName: "Users view",
        text: "조건 {applied}개",
        aggregate: "applied",
      },
      h.workspace.newId,
    );
    expect(h.workspace.execute(command)).toBeTruthy();
    h.flush();
    await settle();
    expect(h.text(created.textId)).toBe("조건 0개");
    await h.choose(2);
    expect(h.names(h.list)).toEqual(["Park"]);
    expect(h.text(created.textId)).toBe("조건 1개");
    await h.choose(0);
    expect(h.text(created.textId)).toBe("조건 0개");
    h.view.unmount();
  });
});

describe("ADR-284 G4 — 「묶기로 목록 만들기」 · 「묶기로 열 만들기」", () => {
  it("a ListBox of the list's groups with their counts, following the list's view", async () => {
    const h = await boundList();
    const { command, created } = catalogGroupListCommand(
      h.graph(),
      { listId: h.list, viewName: "Users view", field: GENDER },
      h.workspace.newId,
    );
    expect(h.workspace.execute(command)).toBeTruthy();
    h.flush();
    await settle();
    const groups = () =>
      [...h.element(created.listId)!.querySelectorAll('[role="option"]')].map(
        (option) => option.textContent?.trim(),
      );
    expect(groups()).toEqual(["male2", "female1"]);
    await h.choose(2);
    expect(groups()).toEqual(["female1"]);
    h.view.unmount();
  });

  it("「모든 값」: a value the list's choice empties stays with 0", async () => {
    const h = await boundList();
    const { command, created } = catalogGroupListCommand(
      h.graph(),
      {
        listId: h.list,
        viewName: "Users view",
        field: GENDER,
        emptyGroups: true,
      },
      h.workspace.newId,
    );
    h.workspace.execute(command);
    h.flush();
    await settle();
    await h.choose(2);
    expect(
      [...h.element(created.listId)!.querySelectorAll('[role="option"]')].map(
        (option) => option.textContent?.trim(),
      ),
    ).toEqual(["male0", "female1"]);
    h.view.unmount();
  });

  it("kanban columns: a heading with the value's count over a list of its rows; an empty column says 0", async () => {
    const h = await boundList();
    const { command, created } = catalogGroupColumnsCommand(
      h.graph(),
      {
        listId: h.list,
        viewName: "Users view",
        field: GENDER,
        values: ["male", "female"],
      },
      h.workspace.newId,
    );
    expect(h.workspace.execute(command)).toBeTruthy();
    h.flush();
    await settle();
    const [male, female] = created.columns;
    expect(h.text(male!.headingId)).toBe("male · 2");
    expect(h.text(female!.headingId)).toBe("female · 1");
    expect(h.names(male!.listId)).toEqual(["Kim", "Lee"]);
    expect(h.names(female!.listId)).toEqual(["Park"]);
    // (The list's choice reaches the columns — they read its view; male empties to 0, not gone.)
    await h.choose(2);
    expect(h.names(male!.listId)).toEqual([]);
    expect(h.text(male!.headingId)).toBe("male · 0");
    expect(h.text(female!.headingId)).toBe("female · 1");
    h.view.unmount();
  });
});
