/**
 * ToastContainer 렌더 — store 토스트 1건은 화면에 1개, 컨테이너를 두 번 마운트하면 2개
 * (정적 계약이 막는 이유를 동작으로 보인다).
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n";
import { ToastContainer } from "../ToastContainer";
import { useToastStore } from "../../../stores/toast";

describe("ToastContainer", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [], lastShownMap: new Map() });
    useToastStore
      .getState()
      .showToast("warning", "hello", { duration: 0, bypassCooldown: true });
  });

  afterEach(() => {
    cleanup();
    useToastStore.getState().dismissAll();
  });

  it("store 토스트 1건 → 화면 1개", () => {
    render(
      <I18nProvider initialLocale="en">
        <ToastContainer />
      </I18nProvider>,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByText("hello")).toBeTruthy();
  });

  it("컨테이너를 두 번 마운트하면 같은 토스트가 두 번 뜬다 (그래서 하나만 둔다)", () => {
    render(
      <I18nProvider initialLocale="en">
        <ToastContainer />
        <ToastContainer />
      </I18nProvider>,
    );
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });
});
