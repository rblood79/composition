// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n";
import { ContextMenuProvider, useContextMenu } from "./useContextMenu";

/**
 * ADR-200 Phase 2 — 오버레이가 `t()` 로 라벨을 만들므로 provider 하위에서
 * 렌더한다. 이 파일은 라벨 문자열을 읽지 않아 Phase 0 인벤토리에서 빠졌는데,
 * 표시 계층을 **마운트**하는 것만으로 훅 요구가 생긴다 (기준은 `label` 참조가
 * 아니라 컴포넌트 마운트).
 */
const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });

const request = {
  surface: "canvas-empty" as const,
  clientX: 120,
  clientY: 80,
  targetElementIds: [],
};

function ContextMenuHarness() {
  const { open, state } = useContextMenu();

  return (
    <>
      <div data-testid="menu-state">{state.isOpen ? "open" : "closed"}</div>
      <button
        data-testid="open-menu"
        onClick={() => {
          open(request);
        }}
      >
        Open
      </button>
      <div
        data-testid="outside"
        onContextMenu={(event) => {
          event.preventDefault();
          open({ ...request, clientX: 240 });
        }}
      />
    </>
  );
}

describe("ContextMenuProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("suppresses the builder-native menu through one capture listener", () => {
    renderWithI18n(
      <ContextMenuProvider>
        <div data-testid="surface" />
      </ContextMenuProvider>,
    );

    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    screen.getByTestId("surface").dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps editable native menus available", () => {
    renderWithI18n(
      <ContextMenuProvider>
        <input data-testid="input" />
      </ContextMenuProvider>,
    );

    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
    });
    screen.getByTestId("input").dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it("closes on outside pointerdown while allowing the next contextmenu through", () => {
    renderWithI18n(
      <ContextMenuProvider>
        <ContextMenuHarness />
      </ContextMenuProvider>,
    );

    fireEvent.click(screen.getByTestId("open-menu"));
    expect(screen.getByTestId("menu-state").textContent).toBe("open");

    const outside = screen.getByTestId("outside");
    fireEvent.pointerDown(outside, { button: 2 });
    expect(screen.getByTestId("menu-state").textContent).toBe("closed");

    fireEvent.contextMenu(outside);
    expect(screen.getByTestId("menu-state").textContent).toBe("open");
  });

  it("keeps Escape dismissal when the Popover is non-modal", async () => {
    renderWithI18n(
      <ContextMenuProvider>
        <ContextMenuHarness />
      </ContextMenuProvider>,
    );

    fireEvent.click(screen.getByTestId("open-menu"));
    const menu = await waitFor(() => screen.getByRole("menu"));
    fireEvent.keyDown(menu, { key: "Escape" });

    await waitFor(() =>
      expect(screen.getByTestId("menu-state").textContent).toBe("closed"),
    );
  });
});
