/**
 * ToastContainer — store 토스트를 S2 `ToastRegion` (빌더 skin) 으로 그린다.
 * - store 토스트 1건은 화면에 1개, 컨테이너를 두 번 마운트하면 2개 (정적 계약이 막는 이유를 동작으로 보인다)
 * - store → region: 추가 · 해제가 그대로 따라간다
 * - region → store: 닫기 버튼으로 닫으면 store 에서도 빠진다
 * - 자리는 빌더 설정 (uiStore `toastPlacement`) — 앱 토스트 자리 (Site 패널) 와 따로
 * - S2 variant: success → positive · warning → neutral, 쌓이면 S2 stack (뒤 조각 · 「Show all」)
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { I18nProvider } from "@/i18n";
import { ToastContainer } from "../ToastContainer";
import { useToastStore } from "../../../stores/toast";
import { useUiStore } from "../../../../stores/uiStore";

const renderContainer = (count = 1) =>
  render(
    <I18nProvider initialLocale="en-US">
      {Array.from({ length: count }, (_, index) => (
        <ToastContainer key={index} />
      ))}
    </I18nProvider>,
  );

describe("ToastContainer", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [], lastShownMap: new Map() });
    useToastStore
      .getState()
      .showToast("warning", "hello", { duration: 0, bypassCooldown: true });
  });

  afterEach(() => {
    act(() => useToastStore.getState().dismissAll());
    cleanup();
  });

  it("store 토스트 1건 → 화면 1개 (S2 region · warning = neutral)", async () => {
    renderContainer();
    const toast = await screen.findByRole("alertdialog");
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    expect(toast.textContent).toContain("hello");
    expect(toast.className).toContain("builder-toast");
    expect(toast.getAttribute("data-variant")).toBe("neutral");
    expect(document.querySelector(".builder-toast-region")).toBeTruthy();
  });

  it("store 에서 빠지면 화면에서도, 닫기 버튼으로 닫으면 store 에서도 빠진다", async () => {
    renderContainer();
    await screen.findByRole("alertdialog");
    act(() => {
      useToastStore.getState().showToast("success", "saved", {
        duration: 0,
        bypassCooldown: true,
      });
    });
    // S2 stack: 새 토스트가 위 (alertdialog), 앞의 것은 뒤에 겹친 조각 + 「Show all」
    await waitFor(() =>
      expect(document.querySelectorAll(".builder-toast-behind")).toHaveLength(1),
    );
    const saved = screen.getByRole("alertdialog");
    expect(saved.textContent).toContain("saved");
    expect(saved.getAttribute("data-variant")).toBe("positive");
    expect(saved.textContent).toContain("Show all");

    // store → region
    const hello = useToastStore
      .getState()
      .toasts.find((toast) => toast.message === "hello")!;
    act(() => useToastStore.getState().dismissToast(hello.id));
    await waitFor(() =>
      expect(document.querySelectorAll(".builder-toast-behind")).toHaveLength(0),
    );
    expect(screen.getByRole("alertdialog").textContent).not.toContain(
      "Show all",
    );

    // region → store
    const close = screen
      .getByRole("alertdialog")
      .querySelector<HTMLButtonElement>(".builder-toast-close")!;
    fireEvent.click(close);
    await waitFor(() =>
      expect(useToastStore.getState().toasts).toHaveLength(0),
    );
  });

  it("컨테이너를 두 번 마운트하면 같은 토스트가 두 번 뜬다 (그래서 하나만 둔다)", async () => {
    renderContainer(2);
    await waitFor(() =>
      expect(screen.getAllByRole("alertdialog")).toHaveLength(2),
    );
  });
  it("자리는 빌더 설정 (Settings 「Toast placement」 — uiStore) 을 따른다 · 기본 bottom (S2 기본)", async () => {
    act(() => useUiStore.getState().resetUiSettings());
    renderContainer();
    await screen.findByRole("alertdialog");
    const region = () =>
      document.querySelector<HTMLElement>(".builder-toast-region")!;
    expect(region().dataset.placement).toBe("bottom");
    expect(region().dataset.align).toBe("center");
    act(() => useUiStore.getState().setToastPlacement("top end"));
    await waitFor(() => expect(region().dataset.placement).toBe("top"));
    expect(region().dataset.align).toBe("end");
    act(() => useUiStore.getState().resetUiSettings());
  });
});
