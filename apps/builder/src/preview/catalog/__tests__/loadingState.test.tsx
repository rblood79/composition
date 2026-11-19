import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { catalogPaletteInsertPlan } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * `useAsyncList`'s `loadingState` beside its `items` (the reference passes both from one list —
 * `<TableView loadingState={list.loadingState}>` · `<Skeleton isLoading={list.isLoading}>`): a
 * component bound to a collection gets the collection's load state from the session. A Table
 * shows S2's progress circle in its empty body while loading; a bound Skeleton's `isLoading` is true
 * only while loading (ADR-314: the Skeleton has no element — its content stays, the record's
 * `isLoading` is what changes). The Canvas loads nothing: the authored value stays. Measurement:
 * jsdom + a `fetch` stub the test answers.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

function pendingServer() {
  const answers: ((rows: unknown[] | Error) => void)[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(
    () =>
      new Promise((resolve, reject) => {
        answers.push((rows) =>
          rows instanceof Error
            ? reject(rows)
            : resolve(
                new Response(JSON.stringify(rows), {
                  headers: { "content-type": "application/json" },
                }),
              ),
        );
      }),
  );
  return answers;
}

async function boundPreview(types: readonly string[] = ["Skeleton"]) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(types);
  const [skeleton] = h.ids as [NodeId];
  // (2026-11-19 사용자 결정: the Skeleton takes no collection of its own — it follows the load of
  //  the content bound inside it. The palette puts a Table inside the selected Skeleton.)
  const skeletonRecord = [...h.workspace.root.domInputs.values()].find(
    (record) => record.sourceId === skeleton,
  )!;
  h.workspace.selectRecords([skeletonRecord.id]);
  const plan = catalogPaletteInsertPlan(
    {
      graph: h.workspace.runtime.graph,
      records: h.workspace.root.domInputs,
      selection: () => h.workspace.session.getSnapshot().selection,
      itemOfRecord: (identity) => h.workspace.itemOfRecord(identity),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" as NodeId }),
      newId: h.workspace.newId,
    },
    "Table",
  );
  if (!plan.command || plan.relocated) throw new Error("Table not inside");
  h.workspace.execute(plan.command);
  const table = [...h.workspace.root.domInputs.values()].find(
    (record) => h.workspace.root.typeOf(record) === "Table",
  )!.sourceId as NodeId;
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
          ],
          mockData: [],
          runtimeData: [],
          useMockData: false,
        },
      ],
      variables: [],
      apiEndpoints: [
        {
          id: "list",
          name: "listUsers",
          baseUrl: "https://api.example.test",
          path: "/users",
          method: "GET",
          targetCollection: "Users",
        },
      ],
    });
  });
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: table }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  h.flush();
  const progress = () =>
    h.element(table)?.querySelectorAll('[role="progressbar"]').length ?? 0;
  // (ADR-314: the Skeleton draws no element — its Preview record's `isLoading` is the state, and its
  //  wrapped content stays in the DOM either way.)
  const loadingOf = (id: NodeId) =>
    [...h.session.root!.domInputs.values()].find(
      (record) => record.sourceId === id,
    )?.props.isLoading === true;
  const skeletonShown = () => loadingOf(skeleton);
  const contentShown = () => h.element(table) !== null;
  return { ...h, skeleton, table, progress, skeletonShown, contentShown, loadingOf };
}

describe("loadingState — a bound component follows its collection's load", () => {
  it("while a load runs the Table's empty body shows the progress circle and the Skeleton is loading; after it, neither", async () => {
    const answers = pendingServer();
    const h = await boundPreview();
    // (Idle: nothing loads — the Skeleton around the bound Table is not loading, no circle.)
    expect(h.skeletonShown()).toBe(false);
    expect(h.contentShown()).toBe(true);
    expect(h.progress()).toBe(0);
    let done: Promise<void> | undefined;
    act(() => {
      done = h.session.reload("users");
    });
    await settle();
    expect(h.skeletonShown()).toBe(true);
    expect(h.contentShown()).toBe(true);
    expect(h.progress()).toBe(1);
    await act(async () => {
      answers[0]!([{ id: "u1", name: "Kim" }]);
      await done;
    });
    await settle();
    expect(h.skeletonShown()).toBe(false);
    expect(h.progress()).toBe(0);
    expect(h.element(h.table)?.textContent).toContain("Kim");
    h.view.unmount();
  });

  it("a failed load ends the loading too (S2 `error`)", async () => {
    const answers = pendingServer();
    const h = await boundPreview();
    let done: Promise<void> | undefined;
    act(() => {
      done = h.session.reload("users");
    });
    await settle();
    expect(h.skeletonShown()).toBe(true);
    await act(async () => {
      answers[0]!(new Error("offline"));
      await done?.catch(() => {});
    });
    await settle();
    expect(h.skeletonShown()).toBe(false);
    expect(h.progress()).toBe(0);
    h.view.unmount();
  });

  it("a Skeleton with no bound content keeps its authored isLoading while other data loads", async () => {
    const answers = pendingServer();
    const h = await boundPreview(["Skeleton", "Skeleton"]);
    const other = h.ids[1] as NodeId;
    expect(h.loadingOf(other)).toBe(true);
    let done: Promise<void> | undefined;
    act(() => {
      done = h.session.reload("users");
    });
    await settle();
    expect(h.skeletonShown()).toBe(true);
    expect(h.loadingOf(other)).toBe(true);
    await act(async () => {
      answers[0]!([{ id: "u1", name: "Kim" }]);
      await done;
    });
    await settle();
    expect(h.skeletonShown()).toBe(false);
    expect(h.loadingOf(other)).toBe(true);
    h.view.unmount();
  });

  it("the Canvas loads nothing: the Skeleton keeps its authored isLoading", async () => {
    pendingServer();
    const h = await boundPreview();
    const record = h.workspace.root.recordsOfSource(h.skeleton)[0]!;
    expect(h.workspace.root.domInputs.get(record)?.props.isLoading).toBe(true);
    h.view.unmount();
  });
});
