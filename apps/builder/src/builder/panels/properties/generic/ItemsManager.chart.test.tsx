import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChartInitialProps,
  type ItemsManagerField,
} from "@composition/specs";
import { I18nProvider } from "@/i18n";
import {
  resetPanelFixture,
  seedPanelElements,
} from "../../../__tests__/panelFixture";
import { useStore } from "../../../stores";
import { ItemsManager } from "./ItemsManager";
import { resolveItemEditorIdentities } from "./itemsEditorIdentity";

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
beforeEach(resetPanelFixture);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  resetPanelFixture();
});
describe("Chart rows의 선택·수정 identity", () => {
  it("id 없는 기본 차트 선택은 key 경고나 문서 쓰기를 만들지 않으며 특정 행 삭제가 동작한다", async () => {
    const props = createChartInitialProps("area");
    seedPanelElements([
      {
        id: "chart",
        type: "Chart",
        props: { ...props },
        page_id: "page-1",
        parent_id: null,
      },
    ]);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const update = vi.spyOn(useStore.getState(), "updateElementProps");
    const ui = render(
      <I18nProvider>
        <ItemsManager elementId="chart" field={field} />
      </I18nProvider>,
    );
    expect(
      error.mock.calls.filter((args) => String(args[0]).includes("same key")),
    ).toHaveLength(0);
    expect(update).not.toHaveBeenCalled();
    expect(useStore.getState().elementsMap.get("chart")?.props.data).toEqual(
      props.data,
    );
    await act(async () => {
      fireEvent.click(ui.getAllByRole("button", { name: "Remove item" })[1]);
    });
    await waitFor(() =>
      expect(useStore.getState().elementsMap.get("chart")?.props.data).toEqual(
        props.data.filter((_, i) => i !== 1),
      ),
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
    seedPanelElements([
      {
        id: "chart",
        type: "Chart",
        props: { data: rows },
        page_id: "page-1",
        parent_id: null,
      },
    ]);
    await useStore
      .getState()
      .updateItem("chart", "data", identities[1].target, { value: 22 });
    expect(useStore.getState().elementsMap.get("chart")?.props.data).toEqual(
      rows.map((row, i) => (i === 1 ? { ...row, value: 22 } : row)),
    );
    await useStore.getState().removeItem("chart", "data", identities[4].target);
    expect(
      (useStore.getState().elementsMap.get("chart")?.props.data as unknown[])
        .length,
    ).toBe(4);
  });
});
