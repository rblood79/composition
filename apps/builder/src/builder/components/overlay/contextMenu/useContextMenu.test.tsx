// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ContextMenuProvider } from "./useContextMenu";

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
});
