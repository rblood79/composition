// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContextMenuProvider, useContextMenu } from "./useContextMenu";

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
    render(
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
    render(
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
    render(
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
    render(
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
