import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { WorkspaceStatusIndicator } from "./WorkspaceStatusIndicator";

vi.mock("@/i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

/** The floating header (`.panel-dock-chrome > .header`) at y 4–44, as the panel workspace draws it. */
function mountHeader(bottom: number) {
  const chrome = document.createElement("div");
  chrome.className = "panel-dock-chrome";
  const header = document.createElement("header");
  header.className = "header";
  header.getBoundingClientRect = () =>
    ({ left: 4, top: 4, right: 1496, bottom, width: 1492, height: bottom - 4 }) as DOMRect;
  chrome.append(header);
  document.body.append(chrome);
}

it("sits below the floating header and the ruler strip, not under the header's centre toolbar", () => {
  mountHeader(44);
  render(<WorkspaceStatusIndicator isCanvasReady isContextLost />);
  const pill = screen.getByText("workspace.canvasRecovering");
  // 44 (header bottom) + 20 (ruler strip) + 8.
  expect(pill.style.top).toBe("72px");
});

it("renders nothing while the canvas is ready and its context alive", () => {
  mountHeader(44);
  const { container } = render(
    <WorkspaceStatusIndicator isCanvasReady isContextLost={false} />,
  );
  expect(container.firstChild).toBeNull();
});
