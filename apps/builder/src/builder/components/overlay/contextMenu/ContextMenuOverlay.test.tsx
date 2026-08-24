// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenuOverlay } from "./ContextMenuOverlay";

describe("ContextMenuOverlay", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens RAC Menu at the virtual anchor and runs an action", async () => {
    const onClose = vi.fn();
    const run = vi.fn();

    render(
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
            label: "Copy",
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

    render(
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
            label: "Copy",
            icon: Icon,
            run: vi.fn(),
          },
          // 아이콘 없는 이웃도 자리를 받아야 라벨이 어긋나지 않는다
          { kind: "action", id: "paste", label: "Paste", run: vi.fn() },
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
    render(
      <ContextMenuOverlay
        isOpen
        onClose={vi.fn()}
        request={{
          surface: "canvas-element",
          clientX: 0,
          clientY: 0,
          targetElementIds: ["card"],
        }}
        items={[{ kind: "action", id: "copy", label: "Copy", run: vi.fn() }]}
      />,
    );

    await waitFor(() => expect(screen.getByRole("menu")).toBeTruthy());
    expect(document.querySelectorAll(".context-menu-item-icon")).toHaveLength(
      0,
    );
  });

  it("does not render a modal underlay", async () => {
    render(
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
