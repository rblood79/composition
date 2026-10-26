import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataCollectionId,
  EntryId,
  InteractionEntry,
  NodeId,
  ViewQuery,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogInteractionsCommand } from "../../../builder/catalogRuntime/interactions";
import { catalogSortFollowCommand } from "../../../builder/catalogRuntime/viewAuthoring";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-284 G0 — the data layer's four gaps, each as the reference examples use it (연구 §2):
 * ① a local (mock) list filtered by a control · ② a Table's sort followed by another component
 * showing the same data · ③ a variable the query endpoint reads loads again when it changes ·
 * ④ one drop runs two list commands (kanban `update` + `moveBefore`). Each is RED until its phase.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const USERS = "data:collection:users" as DataCollectionId;
const ROWS = [
  { id: "u1", name: "Kim", gender: "male" },
  { id: "u2", name: "Park", gender: "female" },
  { id: "u3", name: "Lee", gender: "male" },
];
const NAMES = /Kim|Park|Lee/;

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function usersPreview(
  types: readonly string[],
  data: {
    useMockData: boolean;
    endpoint?: { path: string; queryParams?: { key: string; value: string }[] };
    variables?: {
      id: string;
      name: string;
      type: "string" | "object";
      defaultValue: unknown;
    }[];
  },
) {
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
            { id: "f-name", key: "name", type: "string" },
            { id: "f-gender", key: "gender", type: "string" },
          ],
          mockData: ROWS,
          runtimeData: [],
          useMockData: data.useMockData,
        },
      ],
      variables: data.variables ?? [],
      apiEndpoints: data.endpoint
        ? [
            {
              id: "list",
              name: "listUsers",
              baseUrl: "https://api.example.test",
              method: "GET",
              targetCollection: "Users",
              responseMapping: { dataPath: "items" },
              ...data.endpoint,
            },
          ]
        : [],
    });
  });
  return h;
}

function bind(
  h: Awaited<ReturnType<typeof usersPreview>>,
  ids: NodeId[],
  view?: ViewQuery,
) {
  h.workspace.execute(
    catalogBindingCommand(
      ids.map((id) => ({ kind: "node" as const, id })),
      {
        ...catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
        ...(view ? { view } : {}),
      },
    ),
  );
  h.flush();
}

function shown(h: Awaited<ReturnType<typeof usersPreview>>, id: NodeId) {
  return [
    ...(h.element(id)?.querySelectorAll('[role="option"], [role="row"]') ?? []),
  ]
    .map((item) => NAMES.exec(item.textContent ?? "")?.[0])
    .filter(Boolean);
}

describe("ADR-284 G0 — RED until the data view phases", () => {
  // ① 현재 2 — `setFilterText` only reloads an API; a mock list did not change (the user's 「무반응」).
  // Phase 1: the binding's built-in view holds the condition (gender = the variable, "all"
  // skips) and a rule writes the variable.
  it("① a mock GridList filtered by a control's rule shows only the matching rows", async () => {
    const h = await usersPreview(["GridList", "Button"], {
      useMockData: true,
      variables: [
        { id: "gender", name: "gender", type: "string", defaultValue: "all" },
      ],
    });
    const [list, button] = h.ids as [NodeId, NodeId];
    bind(h, [list], {
      where: {
        id: "where",
        op: "and",
        items: [
          {
            id: "gender",
            fields: [["data:field:f-gender"]],
            op: "equals",
            value: "!var.data:variable:gender",
            skip: "all",
          },
        ],
      },
    });
    await settle();
    expect(shown(h, list)).toEqual(["Kim", "Park", "Lee"]);
    h.rule(button, "onPress", {
      opcode: "setState",
      variableId: "data:variable:gender",
      op: "set",
      value: "female",
    });
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    await settle();
    expect(shown(h, list)).toEqual(["Park"]);
    h.view.unmount();
  });

  // ② 현재 3 — the sort was the Table's runtime state (ADR-257): a GridList on the same data kept
  // its order. Phase 3: 「정렬 따라가기」 puts the sort in a variable both read through one view —
  // the Table's header press (its rule) writes it.
  it("② a Table's sort is followed by a GridList showing the same data", async () => {
    const h = await usersPreview(["Table", "GridList"], {
      useMockData: true,
    });
    const [tableId, list] = h.ids as [NodeId, NodeId];
    bind(h, [tableId, list]);
    const { command } = catalogSortFollowCommand(
      h.workspace.runtime.graph,
      { tableId, followerIds: [list] },
      h.workspace.newId,
    );
    h.workspace.execute(command);
    h.flush();
    await settle();
    const press = async () => {
      const header = [
        ...(h.element(tableId)?.querySelectorAll('[role="columnheader"]') ??
          []),
      ].find((cell) => /Name/.test(cell.textContent ?? "")) as HTMLElement;
      act(() => {
        fireEvent.pointerDown(header, { button: 0, pointerType: "mouse" });
        fireEvent.pointerUp(header, { button: 0, pointerType: "mouse" });
        fireEvent.click(header);
      });
      await settle();
      return header;
    };
    const header = await press();
    expect(shown(h, tableId)).toEqual(["Kim", "Lee", "Park"]);
    expect(shown(h, list)).toEqual(["Kim", "Lee", "Park"]);
    // (The arrow is the variable's: the header shows the sort the rule wrote.)
    expect(header.getAttribute("aria-sort")).toBe("ascending");
    await press();
    expect(shown(h, tableId)).toEqual(["Park", "Lee", "Kim"]);
    expect(shown(h, list)).toEqual(["Park", "Lee", "Kim"]);
    h.view.unmount();
  });

  // ③ 현재 3 — `writeState` did not call `loadRouted`: an endpoint reading `{{ gender }}` loaded
  // once with the default. Phase 2: a written variable a request reads loads it again.
  it("③ an endpoint reading a variable loads again when a rule writes it", async () => {
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      urls.push(`${url.pathname}${url.search}`);
      const gender = url.searchParams.get("gender");
      return new Response(
        JSON.stringify({
          items: ROWS.filter((row) => row.gender === gender),
        }),
        { headers: { "content-type": "application/json" } },
      );
    });
    const h = await usersPreview(["ListBox", "Button"], {
      useMockData: false,
      endpoint: {
        path: "/users",
        queryParams: [{ key: "gender", value: "{{ gender }}" }],
      },
      variables: [
        {
          id: "gender",
          name: "gender",
          type: "string",
          defaultValue: "male",
        },
      ],
    });
    const [list, button] = h.ids as [NodeId, NodeId];
    bind(h, [list]);
    await settle();
    expect(urls).toEqual(["/users?gender=male"]);
    h.rule(button, "onPress", {
      opcode: "setState",
      variableId: "data:variable:gender",
      op: "set",
      value: "female",
    });
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    await settle();
    expect(urls).toEqual(["/users?gender=male", "/users?gender=female"]);
    expect(shown(h, list)).toEqual(["Park"]);
    h.view.unmount();
  });

  // ④ 현재 7 — one rule was one action (ADR-158): a drop that changes the card's column and its
  // place needs two. Phase 1 opens `actions[]` and runs it in order; Phase 5 wires the drop.
  it("④ one rule runs `update` then `moveBefore` (kanban drop)", async () => {
    // (The card's new fields come from a value reference — a literal is a scalar; Phase 5's
    // drop gives the dropped column.)
    const h = await usersPreview(["GridList", "Button"], {
      useMockData: true,
      variables: [
        {
          id: "moved",
          name: "moved",
          type: "object",
          defaultValue: { gender: "female" },
        },
      ],
    });
    const [list, button] = h.ids as [NodeId, NodeId];
    bind(h, [list]);
    await settle();
    const owner = { ownerId: button };
    const rule = {
      kind: "interaction",
      id: h.workspace.newId("interaction") as EntryId<"interaction">,
      ownerId: button,
      trigger: "onPress",
      actions: [
        {
          opcode: "update",
          collectionId: USERS,
          key: "u3",
          value: "!var.data:variable:moved",
        },
        { opcode: "moveBefore", collectionId: USERS, key: "u1", keys: "u3" },
      ],
    } as unknown as InteractionEntry;
    h.workspace.execute(catalogInteractionsCommand(owner, [rule], "Rules"));
    h.flush();
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    await settle();
    expect(shown(h, list)).toEqual(["Lee", "Kim", "Park"]);
    expect(
      (
        h.session.collectionItems("users") as { id: string; gender: string }[]
      ).find((row) => row.id === "u3")?.gender,
    ).toBe("female");
    h.view.unmount();
  });
});
