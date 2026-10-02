import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createChartInitialProps,
  type ItemsManagerField,
} from "@composition/specs";
import { I18nProvider } from "@/i18n";
import {
  openStylesFixture,
  type StylesFixture,
} from "../../styles/__tests__/support/catalogStylesFixture";
import { CATALOG_ITEMS_SOURCE } from "../catalog/catalogItemsSource";
import { ItemsManager } from "./ItemsManager";
import { resolveItemEditorIdentities } from "./itemsEditorIdentity";

/**
 * ADR-248 4e-9 C: the Chart rows editor over the catalog Properties items source (the old store's
 * item actions went with the old store).
 */
const field: ItemsManagerField = {
  type: "items-manager",
  key: "data",
  label: "Rows",
  itemsKey: "data",
  itemTypeName: "ChartRow",
  defaultItem: { category: "New", value: 0 },
  labelKey: "category",
  itemSchema: [{ key: "category", type: "string", label: "Category" }],
};

const rowsOf = (fixture: StylesFixture) =>
  fixture.workspace.readModel.propSource(
    { kind: "node", id: fixture.nodeOf("chart").id },
    "data",
  ).value as unknown[];

const wrapperOf =
  (fixture: StylesFixture) =>
  ({ children }: { children: ReactNode }) => (
    <I18nProvider>{fixture.wrapper({ children })}</I18nProvider>
  );

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Chart rows의 선택·수정 identity", () => {
  it("id 없는 기본 차트 선택은 key 경고나 문서 쓰기를 만들지 않으며 특정 행 삭제가 동작한다", async () => {
    const props = createChartInitialProps("area");
    const fixture = await openStylesFixture(
      [{ id: "chart", type: "Chart", props: { data: props.data } }],
      { select: "chart" },
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const revision = fixture.graph.revision;
    const ui = render(
      <ItemsManager elementId={fixture.recordOf("chart")} field={field} />,
      { wrapper: wrapperOf(fixture) },
    );
    expect(
      error.mock.calls.filter((args) => String(args[0]).includes("same key")),
    ).toHaveLength(0);
    expect(fixture.graph.revision).toBe(revision);
    expect(rowsOf(fixture)).toEqual(props.data);
    await act(async () => {
      fireEvent.click(ui.getAllByRole("button", { name: "Remove item" })[1]!);
    });
    await waitFor(() =>
      expect(rowsOf(fixture)).toEqual(props.data.filter((_, i) => i !== 1)),
    );
  });

  it("중복·누락·숫자 ID는 개별 위치를 편집하고 고유 문자열 ID 계약은 유지한다", async () => {
    const rows = [
      { id: "same", category: "A", value: 1 },
      { id: "same", category: "B", value: 2 },
      { category: "C", value: 3 },
      { id: 0, category: "D", value: 4 },
      { id: "unique", category: "E", value: 5 },
    ];
    const identities = resolveItemEditorIdentities(rows);
    expect(new Set(identities.map((x) => x.key)).size).toBe(5);
    expect(identities.map((x) => x.target)).toEqual([0, 1, 2, 3, "unique"]);
    const fixture = await openStylesFixture(
      [{ id: "chart", type: "Chart", props: { data: rows } }],
      { select: "chart" },
    );
    const record = fixture.recordOf("chart");
    const actions = renderHook(
      () => CATALOG_ITEMS_SOURCE.useActions(record, "data"),
      { wrapper: wrapperOf(fixture) },
    ).result;

    act(() => actions.current.update(identities[1]!.target, { value: 22 }));
    expect(rowsOf(fixture)).toEqual(
      rows.map((row, i) => (i === 1 ? { ...row, value: 22 } : row)),
    );
    act(() => actions.current.remove(identities[4]!.target));
    expect(rowsOf(fixture)).toHaveLength(4);
  });
});
