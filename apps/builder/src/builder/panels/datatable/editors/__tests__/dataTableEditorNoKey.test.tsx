// @vitest-environment jsdom
/**
 * ADR-325 사용자 결정 1 — an API table without a key field: its rows are keyed by their place in
 * each answer, so an edit in the running app is lost when the rows load again. The table editor
 * says so to the author; a key field (or an `id` · `key` · `value` column) or a table on its own
 * rows says nothing.
 */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  apiEndpoints: new Map<string, unknown>(),
}));
vi.mock("../../../../stores/data", () => ({
  useDataStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ apiEndpoints: state.apiEndpoints, apiRuns: new Map() }),
}));
vi.mock("../../grid/DataGrid", () => ({ DataGrid: () => null }));

import { I18nProvider } from "@/i18n";
import type { DataTable } from "../../../../../types/builder/data.types";
import { DataTableEditor } from "../DataTableEditor";

afterEach(() => {
  cleanup();
  state.apiEndpoints = new Map();
});

const table = (patch: Partial<DataTable>): DataTable =>
  ({
    id: "c1",
    name: "Orders",
    project_id: "p",
    schema: [{ id: "f-name", key: "name", type: "string" }],
    mockData: [{ name: "a" }],
    useMockData: false,
    ...patch,
  }) as DataTable;
const notice = (dataTable: DataTable) => {
  const { container } = render(
    <I18nProvider initialLocale="en-US">
      <DataTableEditor dataTable={dataTable} onClose={() => {}} />
    </I18nProvider>,
  );
  return [...container.querySelectorAll(".datatable-editor-status")]
    .map((element) => element.textContent ?? "")
    .find((text) => text.startsWith("No key field"));
};

describe("ADR-325 사용자 결정 1 — the Data panel says a keyless API table loses its edits", () => {
  it("an API table without a key field: said", () => {
    state.apiEndpoints = new Map([
      ["e1", { id: "e1", targetCollectionId: "c1" }],
    ]);
    expect(notice(table({}))).toContain("Key field");
  });

  it("a key field · an id column · no API · its own rows: nothing", () => {
    state.apiEndpoints = new Map([
      ["e1", { id: "e1", targetCollectionId: "c1" }],
    ]);
    expect(notice(table({ keyField: "f-name" }))).toBeUndefined();
    expect(
      notice(
        table({ schema: [{ id: "f-id", key: "id", type: "string" }] as never }),
      ),
    ).toBeUndefined();
    expect(notice(table({ useMockData: true }))).toBeUndefined();
    state.apiEndpoints = new Map();
    expect(notice(table({}))).toBeUndefined();
  });
});
