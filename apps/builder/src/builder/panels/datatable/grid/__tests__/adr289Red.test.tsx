// @vitest-environment jsdom
/**
 * ADR-289 Phase 0 G0 — RED (`it.fails`): what the grid does today that the ADR changes.
 * ① `Insert ▾ → Insert row` writes `insert_rows` at once — there is no row form (`role=dialog`
 *    「Add a row to …」) · ② a `required` column is never checked — the empty row passes ·
 * ③ a boolean column's default `"true"` lands in the new row as the string `"true"` ·
 * ④ with rows selected the bar has Delete only — no Copy.
 * Each case turns GREEN in Phase 1 (① ② ③ — the form · `resolveFieldDefault`, done 2026-10-29) ·
 * Phase 3 (④, done 2026-10-29) and then loses `.fails` — the file stays as G0's record.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { applyDataChange } = vi.hoisted(() => ({
  applyDataChange: vi.fn(async () => ({})),
}));

vi.mock("../../../../stores/data", () => ({
  useDataStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({ applyDataChange, collections: new Map() }),
    { getState: () => ({ applyDataChange, collections: new Map() }) },
  ),
}));
vi.mock("../../../../stores/toast", () => ({
  globalToast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}));

import type { ReactNode } from "react";
import { I18nProvider } from "@/i18n";
import type { DataTable } from "../../../../../types/builder/data.types";
import {
  DataUsageSourceContext,
  type DataUsageSource,
} from "../../usage/dataUsageSource";
import { DataGrid } from "../DataGrid";

const table: DataTable = {
  id: "c1",
  name: "Users",
  project_id: "p",
  schema: [
    { id: "f-id", key: "id", type: "number" },
    { id: "f-name", key: "name", type: "string", required: true },
    { id: "f-active", key: "active", type: "boolean", defaultValue: "true" },
  ],
  mockData: [
    { id: 1, name: "Ann", active: true },
    { id: 2, name: "Bob", active: false },
  ],
  useMockData: true,
} as unknown as DataTable;

const USAGE: DataUsageSource = {
  useCollectionUsage: () => new Map(),
  useFieldUsage: () => [],
};
const wrap = (node: ReactNode) => (
  <I18nProvider initialLocale="en-US">
    <DataUsageSourceContext.Provider value={USAGE}>
      {node}
    </DataUsageSourceContext.Provider>
  </I18nProvider>
);

type Op = { op: string; rows?: Record<string, unknown>[] };
const insertedRows = () =>
  (applyDataChange.mock.calls as unknown as [{ ops: Op[] }][])
    .flatMap(([change]) => change.ops)
    .filter((op) => op.op === "insert_rows")
    .flatMap((op) => op.rows ?? []);

const press = async (el: Element) => {
  await act(async () => {
    fireEvent.pointerDown(el, { pointerType: "mouse", button: 0 });
    fireEvent.pointerUp(el, { pointerType: "mouse", button: 0 });
    fireEvent.click(el);
  });
};

async function insertRow(getByRole: ReturnType<typeof render>["getByRole"]) {
  fireEvent.click(getByRole("button", { name: "Insert" }));
  const item = await waitFor(() =>
    getByRole("menuitem", { name: /Insert row/ }),
  );
  await press(item);
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ADR-289 Phase 0 RED — the grid today", () => {
  // ① turned GREEN in Phase 1 (2026-10-29) — the form; kept here as the gate's record.
  it(
    "① Insert row opens a row form (role=dialog) instead of writing insert_rows at once",
    async () => {
      const { getByRole, queryByRole } = render(
        wrap(<DataGrid table={table} virtualized={false} />),
      );
      await insertRow(getByRole);
      expect(queryByRole("dialog", { name: /Users/ })).not.toBeNull();
      expect(applyDataChange).not.toHaveBeenCalled();
    },
  );

  // ② ③ turned GREEN in Phase 1 (2026-10-29) — the form judges `required` on the stored value and
  // applies the default through `resolveFieldDefault` (typed).
  it("② a required column (name) is never written empty by Insert row", async () => {
    const { getByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    await insertRow(getByRole);
    const dialog = getByRole("dialog", { name: /Users/ });
    await press(within(dialog).getByRole("button", { name: "Save" }));
    expect(within(dialog).getByRole("alert").textContent).toBe("Required.");
    expect(applyDataChange).not.toHaveBeenCalled();
    expect(insertedRows().some((row) => row.name === null)).toBe(false);
  });

  it('③ a boolean column\'s default "true" reaches the new row as a boolean', async () => {
    const { getByRole } = render(
      wrap(<DataGrid table={table} virtualized={false} />),
    );
    await insertRow(getByRole);
    const dialog = getByRole("dialog", { name: /Users/ });
    const name = within(dialog)
      .getByRole("group", { name: "name" })
      .querySelector("textarea")!;
    fireEvent.change(name, { target: { value: "Cy" } });
    await press(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(applyDataChange).toHaveBeenCalled());
    expect(insertedRows()[0]?.active).toBe(true);
  });

  // ④ turned GREEN in Phase 3 (2026-10-29) — the selection bar's Copy ▾.
  it(
    "④ selecting rows offers Copy (CSV · JSON) next to Delete",
    async () => {
      const { container, getByRole } = render(
        wrap(<DataGrid table={table} virtualized={false} />),
      );
      const first = container.querySelectorAll(
        '.datagrid-cell-select .react-aria-Checkbox input[type="checkbox"]',
      )[0] as HTMLInputElement;
      await act(async () => {
        fireEvent.click(first);
      });
      await waitFor(() =>
        expect(getByRole("button", { name: "Delete 1 rows" })).toBeTruthy(),
      );
      expect(getByRole("button", { name: /Copy/ })).toBeTruthy();
    },
  );
});
