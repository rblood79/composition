// @vitest-environment jsdom
import type { ReactElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import type { Element } from "../../../types/core/store.types";
import { useStore } from "../../stores";
import { historyManager } from "../../stores/history";
import {
  resetPanelFixture,
  seedPanelElements,
} from "../../__tests__/panelFixture";
import { ElementAttributesSection } from "./ElementAttributesSection";

const toast = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock("../../stores/toast", () => ({ globalToast: toast }));

const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });

function makeElement(id: string, overrides: Partial<Element> = {}): Element {
  return {
    id,
    type: "Button",
    parent_id: null,
    page_id: "page-1",
    order_num: 0,
    props: {},
    ...overrides,
  } as Element;
}

const seed = (elements: Element[]) => {
  seedPanelElements(elements);
  useStore.setState({ currentPageId: "page-1" } as never);
  useStore.getState()._rebuildIndexes();
};

// ID 행 끝 28 열의 중복 검사/제거 액션 (2026-09-16 사용자 지시)
describe("ElementAttributesSection — ID 중복 검사 액션", () => {
  beforeEach(() => {
    resetPanelFixture();
    historyManager.setCurrentPage("page-1");
    toast.info.mockClear();
  });
  afterEach(() => cleanup());

  it("ID 행 끝에 아이콘 액션 하나 (접근 이름 = 툴팁)", () => {
    seed([makeElement("a", { customId: "button_1" })]);
    const { container } = renderWithI18n(<ElementAttributesSection elementId="a" />);
    const row = container.querySelector(".fieldset-row");
    expect(row?.querySelector(".fieldset-actions button")).toBe(
      screen.getByRole("button", { name: "Check ID uniqueness" }),
    );
  });

  it("고유하면 값을 바꾸지 않고 알림만", () => {
    seed([makeElement("a", { customId: "button_1" }), makeElement("b", { customId: "button_2" })]);
    renderWithI18n(<ElementAttributesSection elementId="a" />);
    fireEvent.click(screen.getByRole("button", { name: "Check ID uniqueness" }));
    expect(useStore.getState().elementsMap.get("a")?.customId).toBe("button_1");
    expect(toast.info).toHaveBeenCalledWith('ID "button_1" is unique', expect.anything());
  });

  it("중복이면 빈 번호로 옮기고 Undo 토스트", async () => {
    seed([makeElement("a", { customId: "button_1" }), makeElement("b", { customId: "button_1" })]);
    renderWithI18n(<ElementAttributesSection elementId="a" />);
    fireEvent.click(screen.getByRole("button", { name: "Check ID uniqueness" }));
    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("a")?.customId).toBe("button_2");
    });
    expect(toast.info).toHaveBeenCalledWith(
      'Duplicate ID — renamed to "button_2"',
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) }),
    );
  });

  it("비어 있으면 type_N 을 지정", async () => {
    seed([makeElement("a"), makeElement("b", { customId: "button_1" })]);
    renderWithI18n(<ElementAttributesSection elementId="a" />);
    fireEvent.click(screen.getByRole("button", { name: "Check ID uniqueness" }));
    await waitFor(() => {
      expect(useStore.getState().elementsMap.get("a")?.customId).toBe("button_2");
    });
    expect(toast.info).toHaveBeenCalledWith('ID set to "button_2"', expect.anything());
  });
});
