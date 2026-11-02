import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Table from "../../../../../../../packages/shared/src/components/Table.components";

// jsdom은 스크롤 viewport가 없다. 데이터 요청과 실제 Table 행 소비를 검증한다.
vi.mock(
  "../../../../../../../packages/shared/src/components/tableVirtualRows",
  () => ({
    useTableVirtualRows: (_element: unknown, count: number) => ({
      items: Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 38,
        size: 38,
        end: (index + 1) * 38,
      })),
      totalSize: count * 38,
      measureElement: () => {},
    }),
  }),
);
const columns = [{ key: "id" as const, label: "Id" }];
const props = {
  columns,
  apiUrlKey: "users",
  endpointPath: "/users",
  enableAsyncLoading: true,
  itemsPerPage: 5,
};

describe("Table consumer — async source changes", () => {
  it("reloads the same URL for a new service and ignores its predecessor", async () => {
    let finish!: (rows: { id: string; name: string }[]) => void;
    const first = vi.fn(
      () =>
        new Promise<{ id: string; name: string }[]>((resolve) => {
          finish = resolve;
        }),
    );
    const next = vi.fn(async () => [{ id: "fresh row", name: "fresh row" }]);
    const view = render(<Table {...props} apiConfig={{ users: first }} />);
    await waitFor(() => expect(first).toHaveBeenCalledTimes(1));
    view.rerender(<Table {...props} apiConfig={{ users: next }} />);
    await waitFor(() => expect(view.getByText("fresh row")).toBeTruthy());
    await act(async () => {
      finish([{ id: "stale row", name: "stale row" }]);
    });
    expect(view.queryByText("stale row")).toBeNull();
    expect(view.getByText("fresh row")).toBeTruthy();
    view.rerender(<Table {...props} apiConfig={{ users: next }} />);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("reloads mapping and params without column-detection request loops", async () => {
    const service = vi.fn(async () => [{ id: "one", name: "row" }]);
    const view = render(
      <Table
        {...props}
        columns={[]}
        apiConfig={{ users: service }}
        apiParams={{ filter: "first" }}
      />,
    );
    await waitFor(() =>
      expect(view.getAllByText("row").length).toBeGreaterThan(0),
    );
    view.rerender(
      <Table
        {...props}
        columns={[]}
        apiConfig={{ users: service }}
        apiParams={{ filter: "second" }}
        dataMapping={{ idKey: "name" }}
      />,
    );
    await waitFor(() => expect(service).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(view.getAllByText("row").length).toBeGreaterThan(0),
    );
    expect(service).toHaveBeenLastCalledWith("/users", {
      filter: "second",
      page: 1,
      limit: 5,
    });
  });
});
