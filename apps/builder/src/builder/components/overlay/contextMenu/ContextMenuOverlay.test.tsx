// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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

  it("dismisses on an outside pointer without relying on a window listener", async () => {
    const onClose = vi.fn();

    render(
      <ContextMenuOverlay
        isOpen
        onClose={onClose}
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
    const underlay = screen.getByTestId("underlay");
    fireEvent.pointerDown(underlay);
    fireEvent.click(underlay);

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
