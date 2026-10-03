import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  runAutoPolicyEndpoints,
  useExecutionPolicyScheduler,
} from "../../panels/datatable/hooks/useExecutionPolicyScheduler";
import { useDataStore } from "../../stores/data";
import {
  readVariableOwnerPageIds,
  registerVariableOwnerPageSource,
} from "../../stores/utils/variableOwnerMigration";

/**
 * ADR-248 Phase 4e (gap audit F): the data store's execution policies run in the catalog Builder —
 * `auto` once when Preview opens (Compare Mode), `interval` by the scheduler CatalogBuilderCore
 * mounts — and the variable owner rule C reads the document's pages (a restorable source).
 */
type DataState = ReturnType<typeof useDataStore.getState>;
const initial = useDataStore.getState();
afterEach(() => {
  useDataStore.setState(initial, true);
  vi.useRealTimers();
});

function seed(executeApiEndpoint: (id: string) => Promise<unknown>) {
  const collection = (
    id: string,
    mode: string,
    intervalSec?: number,
  ): [string, unknown] => [
    id,
    { id, name: id, executionPolicy: { mode, intervalSec } },
  ];
  useDataStore.setState({
    collections: new Map([
      collection("c-auto", "auto"),
      collection("c-interval", "interval", 5),
      collection("c-manual", "manual"),
    ]),
    apiEndpoints: new Map([
      ["e-auto", { id: "e-auto", targetCollectionId: "c-auto" }],
      ["e-interval", { id: "e-interval", targetCollectionId: "c-interval" }],
      ["e-manual", { id: "e-manual", targetCollectionId: "c-manual" }],
    ]),
    loadingApis: new Set(),
    executeApiEndpoint,
  } as unknown as Partial<DataState>);
}

describe("ADR-248 Phase 4e data execution policies", () => {
  it("auto runs each auto collection's linked endpoint once", async () => {
    const execute = vi.fn(async () => undefined);
    seed(execute);
    await runAutoPolicyEndpoints();
    expect(execute.mock.calls).toEqual([["e-auto"]]);
  });

  it("interval polls its endpoint after each period", async () => {
    vi.useFakeTimers();
    const execute = vi.fn(async () => undefined);
    seed(execute);
    const view = renderHook(() => useExecutionPolicyScheduler());
    await vi.advanceTimersByTimeAsync(5000);
    expect(execute.mock.calls).toEqual([["e-interval"]]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(execute).toHaveBeenCalledTimes(2);
    view.unmount();
    await vi.advanceTimersByTimeAsync(10000);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("the owner page source is replaced and restored", () => {
    const before = readVariableOwnerPageIds();
    const restore = registerVariableOwnerPageSource(() => ["project:page:home"]);
    expect(readVariableOwnerPageIds()).toEqual(["project:page:home"]);
    restore();
    expect(readVariableOwnerPageIds()).toEqual(before);
  });
});
