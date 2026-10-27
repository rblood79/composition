import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogFieldValues,
  catalogFilterCommand,
  catalogReferenceCountCommand,
  catalogReferenceValueCommand,
  catalogViewFields,
} from "../../../builder/catalogRuntime/viewAuthoring";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-284 G4 — references (Decision 4): a filter on a path through a reference field (「검색 추가」
 * on teamId.name), a row showing the row its reference points at (a Text keyed by the row's
 * `{teamId}` — `getItem`), and the reverse count (a user's orders: Orders grouped by `userId`, each
 * Users row's Text keyed by its `{id}`). Measured in the Preview.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const COLLECTIONS = [
  {
    id: "teams",
    name: "Teams",
    schema: [
      { id: "f-tid", key: "id", type: "string" },
      { id: "f-tname", key: "name", type: "string" },
    ],
    mockData: [
      { id: "t1", name: "Red" },
      { id: "t2", name: "Blue" },
    ],
    runtimeData: [],
    useMockData: true,
  },
  {
    id: "users",
    name: "Users",
    schema: [
      { id: "f-uid", key: "id", type: "string" },
      { id: "f-name", key: "name", type: "string" },
      {
        id: "f-team",
        key: "teamId",
        type: "reference",
        reference: { collectionId: "teams", keyField: "f-tid" },
      },
    ],
    mockData: [
      { id: "u1", name: "Kim", teamId: "t1" },
      { id: "u2", name: "Park", teamId: "t2" },
      { id: "u3", name: "Lee", teamId: "t1" },
    ],
    runtimeData: [],
    useMockData: true,
  },
  {
    id: "orders",
    name: "Orders",
    schema: [
      { id: "f-oid", key: "id", type: "string" },
      {
        id: "f-user",
        key: "userId",
        type: "reference",
        reference: { collectionId: "users", keyField: "f-uid" },
      },
    ],
    mockData: [
      { id: "o1", userId: "u1" },
      { id: "o2", userId: "u1" },
      { id: "o3", userId: "u2" },
    ],
    runtimeData: [],
    useMockData: true,
  },
];
const USERS = COLLECTIONS[1]!;

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function usersList() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["GridList"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: COLLECTIONS,
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
  const rows = () =>
    [...(h.element(list)?.querySelectorAll('[role="row"]') ?? [])].map((row) =>
      row.textContent?.replace(/\s+/g, " ").trim(),
    );
  const fields = catalogViewFields(USERS, COLLECTIONS);
  return { ...h, list, rows, fields };
}

describe("ADR-284 G4 — references in a view and in a row", () => {
  it("「검색 추가」 on teamId.name: the picker's items are the team names; choosing Red narrows to its users", async () => {
    const h = await usersList();
    const teamName = h.fields.find((field) => field.key === "teamId.name")!;
    expect(teamName.path).toEqual(["f-team", "f-tname"]);
    const values = catalogFieldValues(USERS.mockData, teamName);
    expect(values).toEqual(["Red", "Blue"]);
    const { command, created } = catalogFilterCommand(
      h.workspace.runtime.graph,
      {
        listId: h.list,
        field: teamName,
        kind: "RadioGroup",
        control: { insert: true },
        values,
        allLabel: "All",
      },
      h.workspace.newId,
    );
    h.workspace.execute(command);
    h.flush();
    await settle();
    const radios = [
      ...h.element(created.controlId)!.querySelectorAll('input[type="radio"]'),
    ] as HTMLInputElement[];
    act(() => {
      fireEvent.click(radios[1]!);
    });
    await settle();
    expect(
      h.rows().map((text) => /Kim|Park|Lee/.exec(text ?? "")?.[0]),
    ).toEqual(["Kim", "Lee"]);
    h.view.unmount();
  });

  it("a row shows its team's name (keyed by the row's teamId) and its order count (Orders grouped by userId)", async () => {
    const h = await usersList();
    const teamId = h.fields.find((field) => field.key === "teamId")!;
    h.workspace.execute(
      catalogReferenceValueCommand(
        h.workspace.runtime.graph,
        {
          listId: h.list,
          field: teamId,
          target: { collectionId: "teams", key: "name" },
        },
        h.workspace.newId,
      ).command,
    );
    h.workspace.execute(
      catalogReferenceCountCommand(
        h.workspace.runtime.graph,
        {
          listId: h.list,
          from: {
            collectionId: "orders",
            collectionName: "Orders",
            field: { id: "f-user", key: "userId", type: "reference" },
          },
          keyField: { id: "f-uid", key: "id" },
          text: "orders {count}",
        },
        h.workspace.newId,
      ).command,
    );
    h.flush();
    await settle();
    const rows = h.rows();
    // (After the row's own label — the Texts go at the end of the row's content.)
    expect(rows[0]).toMatch(/^Kim.*Red.*orders 2$/);
    expect(rows[0]).toContain("Red");
    expect(rows[0]).toContain("orders 2");
    expect(rows[1]).toContain("Blue");
    expect(rows[1]).toContain("orders 1");
    expect(rows[2]).toContain("Red");
    // (Lee has no orders: no group — a count of 0, not an empty text.)
    expect(rows[2]).toContain("orders 0");
    h.view.unmount();
  });
});
