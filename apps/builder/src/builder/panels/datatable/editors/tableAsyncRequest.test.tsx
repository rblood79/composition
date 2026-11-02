// @vitest-environment jsdom
import { StrictMode, type ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTableAsyncRequest } from "../../../../../../../packages/shared/src/components/tableAsyncRequest";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const mapResponse = (response: unknown, mapping?: { idKey?: string }) => ({
  items: (response as Record<string, unknown>[]).map((row) => ({
    id: row[mapping?.idKey ?? "id"],
  })),
  total: (response as unknown[]).length,
});
const base = {
  enabled: true,
  path: "/rows",
  customUrl: undefined,
  params: { filter: "a" },
  mapping: undefined,
  pageSize: 5,
  mode: "pagination",
  mapResponse,
};

describe("Table async request lifetime", () => {
  it("changes service, mapping and params while keeping equivalent inline props stable", async () => {
    const first = vi.fn(async () => [{ id: "old", key: "mapped" }]);
    const next = vi.fn(async () => [{ id: "new", key: "new-mapped" }]);
    const view = renderHook((props) => useTableAsyncRequest(props), {
      initialProps: { ...base, service: first, mapping: { idKey: "id" } },
    });
    const original = view.result.current.requestPage;
    view.rerender({
      ...base,
      service: first,
      params: { filter: "a" },
      mapping: { idKey: "id" },
    });
    expect(view.result.current.requestPage).toBe(original);
    await act(async () =>
      expect((await view.result.current.requestPage(1))?.items).toEqual([
        { id: "old" },
      ]),
    );
    view.rerender({
      ...base,
      service: next,
      params: { filter: "b" },
      mapping: { idKey: "key" },
    });
    await act(async () =>
      expect((await view.result.current.requestPage(1))?.items).toEqual([
        { id: "new-mapped" },
      ]),
    );
    expect(next).toHaveBeenCalledWith("/rows", {
      filter: "b",
      page: 1,
      limit: 5,
    });
  });

  it("keeps client sorting local and sends the latest sort on the next request", async () => {
    const service = vi.fn(async () => [{ id: "one" }]);
    const view = renderHook(
      (sort) => useTableAsyncRequest({ ...base, service, sort }),
      { initialProps: { sortBy: "id", desc: false } },
    );
    const request = view.result.current.requestPage;
    view.rerender({ sortBy: "name", desc: true });
    expect(view.result.current.requestPage).toBe(request);
    expect(service).not.toHaveBeenCalled();
    await act(async () => {
      await view.result.current.requestPage(2);
    });
    expect(service).toHaveBeenCalledWith("/rows", {
      filter: "a",
      sortBy: "name",
      desc: true,
      page: 2,
      limit: 5,
    });
  });

  it("discards a late service response without blocking the new source", async () => {
    let finish!: (rows: { id: string }[]) => void;
    const stale = vi.fn(
      () =>
        new Promise<{ id: string }[]>((resolve) => {
          finish = resolve;
        }),
    );
    const fresh = vi.fn(async () => [{ id: "fresh" }]);
    const view = renderHook(
      (service) => useTableAsyncRequest({ ...base, service }),
      { initialProps: stale },
    );
    let old!: ReturnType<typeof view.result.current.requestPage>;
    act(() => {
      old = view.result.current.requestPage(1);
    });
    view.rerender(fresh);
    await act(async () =>
      expect((await view.result.current.requestPage(1))?.items).toEqual([
        { id: "fresh" },
      ]),
    );
    await act(async () => {
      finish([{ id: "stale" }]);
      expect(await old).toBeUndefined();
    });
    expect(view.result.current.loading).toBe(false);
  });

  it("aborts custom fetches on source change and survives StrictMode", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, options) => {
        signals.push(options.signal);
        return new Promise(() => {});
      }),
    );
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const view = renderHook(
      (path) =>
        useTableAsyncRequest({
          ...base,
          service: undefined,
          customUrl: "https://example.test",
          path,
        }),
      { initialProps: "/first", wrapper },
    );
    act(() => {
      void view.result.current.requestPage(1);
    });
    expect(signals[0].aborted).toBe(false);
    view.rerender("/second");
    expect(signals[0].aborted).toBe(true);
    expect(view.result.current.loading).toBe(false);
    act(() => {
      void view.result.current.requestPage(1);
    });
    view.unmount();
    expect(signals[1].aborted).toBe(true);
  });
});
