// @vitest-environment jsdom
import type { ReactElement } from "react";
import { I18nProvider } from "@/i18n";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenuOverlay } from "./ContextMenuOverlay";

/**
 * ADR-200 Phase 0 — 표시 계층이 `t()` 로 라벨을 해소하게 되므로 provider 하위에서
 * 렌더한다. 훅 도입(Phase 2~4)보다 먼저 옮겨 두어 그 phase 가 빨간 테스트 없이
 * 시작한다 (design breakdown §5-2).
 */
const renderWithI18n = (ui: ReactElement) =>
  render(ui, { wrapper: I18nProvider });

describe("ContextMenuOverlay", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens RAC Menu at the virtual anchor and runs an action", async () => {
    const onClose = vi.fn();
    const run = vi.fn();

    renderWithI18n(
      <ContextMenuOverlay
        isOpen
        onClose={onClose}
        request={{
          surface: "canvas-element",
          clientX: 120,
          clientY: 80,
          targetElementIds: ["card"],
        }}
        items={[
          {
            kind: "action",
            id: "copy",
            labelKey: "contextMenu.copy",
            run,
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("menu")).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "Copy" })).toBeTruthy();
    });

    const anchor = document.querySelector(".context-menu-anchor");
    expect(anchor).toHaveProperty("style.left", "120px");
    expect(anchor).toHaveProperty("style.top", "80px");

    screen.getByRole("menuitem", { name: "Copy" }).click();
    expect(run).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("reserves the icon column per menu so labels share one start line", async () => {
    const Icon = () => <svg data-testid="copy-icon" />;

    renderWithI18n(
      <ContextMenuOverlay
        isOpen
        onClose={vi.fn()}
        request={{
          surface: "canvas-element",
          clientX: 0,
          clientY: 0,
          targetElementIds: ["card"],
        }}
        items={[
          {
            kind: "action",
            id: "copy",
            labelKey: "contextMenu.copy",
            icon: Icon,
            run: vi.fn(),
          },
          // 아이콘 없는 이웃도 자리를 받아야 라벨이 어긋나지 않는다
          {
            kind: "action",
            id: "paste",
            labelKey: "contextMenu.paste",
            run: vi.fn(),
          },
        ]}
      />,
    );

    await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy());
    expect(document.querySelectorAll(".context-menu-item-icon")).toHaveLength(
      2,
    );
    expect(screen.getByTestId("copy-icon")).toBeTruthy();
  });

  it("omits the icon column entirely when no item declares an icon", async () => {
    renderWithI18n(
      <ContextMenuOverlay
        isOpen
        onClose={vi.fn()}
        request={{
          surface: "canvas-element",
          clientX: 0,
          clientY: 0,
          targetElementIds: ["card"],
        }}
        items={[
          {
            kind: "action",
            id: "copy",
            labelKey: "contextMenu.copy",
            run: vi.fn(),
          },
        ]}
      />,
    );

    await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy());
    expect(document.querySelectorAll(".context-menu-item-icon")).toHaveLength(
      0,
    );
  });

  it("does not render a modal underlay", async () => {
    renderWithI18n(
      <ContextMenuOverlay
        isOpen
        onClose={vi.fn()}
        request={{
          surface: "canvas-empty",
          clientX: 120,
          clientY: 80,
          targetElementIds: [],
        }}
        items={[]}
      />,
    );

    await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy());
    expect(screen.queryByTestId("underlay")).toBeNull();
  });
});
