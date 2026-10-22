import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * `useAsyncList`'s `loadingState` beside its `items` (the reference passes both from one list —
 * `<TableView loadingState={list.loadingState}>` · `<Skeleton isLoading={list.isLoading}>`): a
 * component bound to a collection gets the collection's load state from the session. A Table
 * shows S2's progress circle in its empty body while loading; a bound Skeleton is there only while
 * loading. The Canvas loads nothing: the authored value stays. Measurement: jsdom + a `fetch`
 * stub the test answers.
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

async function boundPreview() {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["Skeleton", "Table"]);
  const [skeleton, table] = h.ids as [NodeId, NodeId];
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
      [
        { kind: "node", id: skeleton },
        { kind: "node", id: table },
      ],
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
  const skeletonShown = () => !!h.element(skeleton);
  return { ...h, skeleton, table, progress, skeletonShown };
}

describe("loadingState — a bound component follows its collection's load", () => {
  it("while a load runs the Table's empty body shows the progress circle and the Skeleton is there; after it, neither", async () => {
    const answers = pendingServer();
    const h = await boundPreview();
    // (Idle: nothing loads — a bound Skeleton is not there, the Table shows no circle.)
    expect(h.skeletonShown()).toBe(false);
    expect(h.progress()).toBe(0);
    let done: Promise<void> | undefined;
    act(() => {
      done = h.session.reload("users");
    });
    await settle();
    expect(h.skeletonShown()).toBe(true);
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

  it("the Canvas loads nothing: a bound Skeleton keeps its authored isLoading", async () => {
    pendingServer();
    const h = await boundPreview();
    const record = h.workspace.root.recordsOfSource(h.skeleton)[0]!;
    expect(h.workspace.root.domInputs.get(record)?.props.isLoading).toBe(true);
    h.view.unmount();
  });
});
