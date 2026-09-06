import { Profiler } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ZoomControls } from "./ZoomControls";
import {
  publishViewportPresentation,
  resetViewportPresentation,
} from "./canvas/viewport/viewportPresentation";
import { zoomViewportAtContainerCenter } from "./canvas/viewport/viewportActions";
vi.mock("../../i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock("../hooks", () => ({ formatShortcut: () => "" }));
vi.mock("./canvas/viewport/viewportActions", () => ({
  zoomViewportAtContainerCenter: vi.fn(),
  applyViewportState: vi.fn(),
  computeFillViewport: vi.fn(),
  computeFitViewport: vi.fn(),
}));
afterEach(() => {
  cleanup();
  resetViewportPresentation();
  vi.clearAllMocks();
});
it("updates the displayed zoom without a React commit and unsubscribes on unmount", () => {
  const onRender = vi.fn();
  const { unmount } = render(
    <Profiler id="zoom" onRender={onRender}>
      <ZoomControls />
    </Profiler>,
  );
  const input = screen.getByRole("textbox") as HTMLInputElement;
  onRender.mockClear();
  act(() => publishViewportPresentation({ x: 0, y: 0, scale: 1.25 }));
  expect(input.value).toBe("125%");
  expect(onRender).not.toHaveBeenCalled();
  unmount();
  act(() => publishViewportPresentation({ x: 0, y: 0, scale: 2 }));
  expect(input.value).toBe("125%");
});
it("preserves typed text during presentation changes and restores current zoom after invalid input", () => {
  render(<ZoomControls />);
  const input = screen.getByRole("textbox") as HTMLInputElement;
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "bad" } });
  act(() => publishViewportPresentation({ x: 0, y: 0, scale: 1.5 }));
  expect(input.value).toBe("bad");
  fireEvent.blur(input);
  expect(input.value).toBe("150%");
  expect(zoomViewportAtContainerCenter).not.toHaveBeenCalled();
});
it("commits typed percentage and uses the latest presentation zoom for arrow keys", () => {
  render(<ZoomControls />);
  const input = screen.getByRole("textbox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "175%" } });
  fireEvent.blur(input);
  expect(zoomViewportAtContainerCenter).toHaveBeenLastCalledWith(1.75);
  act(() => publishViewportPresentation({ x: 0, y: 0, scale: 2 }));
  fireEvent.keyDown(input, { key: "ArrowUp", shiftKey: true });
  expect(zoomViewportAtContainerCenter).toHaveBeenLastCalledWith(2.1);
});

it("cancels typed zoom with Escape", () => {
  render(<ZoomControls />);
  const input = screen.getByRole("textbox") as HTMLInputElement;
  act(() => input.focus());
  fireEvent.change(input, { target: { value: "175%" } });
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input.value).toBe("100%");
  expect(zoomViewportAtContainerCenter).not.toHaveBeenCalled();
});

it("commits Enter once through blur", () => {
  render(<ZoomControls />);
  const input = screen.getByRole("textbox") as HTMLInputElement;
  act(() => input.focus());
  fireEvent.change(input, { target: { value: "175%" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(zoomViewportAtContainerCenter).toHaveBeenCalledExactlyOnceWith(1.75);
});
