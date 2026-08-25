// @vitest-environment jsdom

import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useViewportSyncStore } from "../stores";
import { ZoomControls } from "../../ZoomControls";
import { DotBackground } from "../../components/DotBackground";
import {
  getViewportPresentationSnapshot,
  resetViewportPresentation,
  subscribeViewportPresentation,
  subscribeViewportPresentationZoom,
  useViewportPresentationZoom,
} from "./viewportPresentation";
import { ViewportController } from "./ViewportController";
import { I18nProvider } from "@/i18n";

describe("viewportPresentation", () => {
  afterEach(() => {
    cleanup();
    resetViewportPresentation();
    useViewportSyncStore.getState().reset();
  });

  it("publishes the controller zoom to presentation consumers without writing the canonical mirror", () => {
    useViewportSyncStore.getState().setViewportSnapshot({
      panOffset: { x: 11, y: 22 },
      zoom: 1,
    });
    const controller = new ViewportController();
    const { result } = renderHook(() => useViewportPresentationZoom());

    act(() => {
      controller.setPosition(40, 60, 1.25);
    });

    expect(result.current).toBe(1.25);
    expect(getViewportPresentationSnapshot()).toEqual({
      x: 40,
      y: 60,
      scale: 1.25,
    });
    expect(useViewportSyncStore.getState()).toMatchObject({
      panOffset: { x: 11, y: 22 },
      zoom: 1,
    });
  });

  it("notifies presentation subscribers only when the transient state changes", () => {
    const controller = new ViewportController();
    const listener = vi.fn();
    const unsubscribe = subscribeViewportPresentation(listener);

    controller.setPosition(0, 0, 1.5);
    controller.setPosition(0, 0, 1.5);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("does not notify zoom presentation subscribers for pan-only frames", () => {
    const controller = new ViewportController();
    const listener = vi.fn();
    const unsubscribe = subscribeViewportPresentationZoom(listener);

    controller.setPosition(0, 0, 1.5);
    controller.setPosition(40, 60, 1.5);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("renders the transient controller zoom in the toolbar without a canonical store update", () => {
    const controller = new ViewportController();
    render(
      <I18nProvider initialLocale="en-US">
        <ZoomControls />
      </I18nProvider>,
    );

    act(() => {
      controller.setPosition(40, 60, 1.25);
    });

    expect(
      (screen.getByLabelText("Zoom level") as HTMLInputElement).value,
    ).toBe("125%");
    expect(useViewportSyncStore.getState().zoom).toBe(1);
  });

  it("updates the dot background from transient viewport presentation", () => {
    const controller = new ViewportController();
    const { container } = render(<DotBackground />);

    act(() => {
      controller.setPosition(40, 60, 1.25);
    });

    const background = container.querySelector<HTMLDivElement>(
      ".dot-background--base",
    );
    expect(background?.style.getPropertyValue("--dot-gap")).toBe("20px");
    expect(background?.style.getPropertyValue("--dot-tx")).toBe("16px");
    expect(background?.style.getPropertyValue("--dot-ty")).toBe("16px");
    expect(useViewportSyncStore.getState().zoom).toBe(1);
  });
});
