// @vitest-environment jsdom
/**
 * ADR-242 HC4 — lazy 패널 chunk 로드 실패는 그 패널 안에서 끝난다: 오류 + 다시 시도, 다시 시도가
 * 성공하면 내용. 형제 (다른 패널 · Canvas) 는 렌더를 잃지 않는다.
 */
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentType } from "react";
import { lazyPanel } from "./lazyPanel";
import type { PanelProps } from "./types";

vi.mock("../../../i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const Loaded: ComponentType<PanelProps> = () => <div>loaded-panel</div>;
const props = { isActive: true } as PanelProps;

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("lazyPanel 로드 실패 경계 (ADR-242 HC4)", () => {
  it("로드 실패 → 그 패널 안 오류 + 다시 시도, 형제는 그대로", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let attempt = 0;
    const loader = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("chunk load failed");
      return { default: Loaded };
    });
    const Panel = lazyPanel(loader);
    render(
      <>
        <div>sibling</div>
        <Panel {...props} />
      </>,
    );
    await flush();
    expect(screen.getByText("sibling")).toBeTruthy();
    const error = screen.getByRole("alert");
    expect(error.textContent).toContain("panel.loadFailed");
    expect(screen.queryByText("loaded-panel")).toBeNull();

    // 다시 시도 → 새 로드 → 내용
    fireEvent.click(screen.getByRole("button", { name: "panel.retry" }));
    await flush();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(screen.getByText("loaded-panel")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("sibling")).toBeTruthy();
  });

  it("성공 로드는 한 번 — 다시 mount 해도 loader 를 다시 부르지 않는다", async () => {
    const loader = vi.fn(async () => ({ default: Loaded }));
    const Panel = lazyPanel(loader);
    const first = render(<Panel {...props} />);
    await flush();
    expect(screen.getByText("loaded-panel")).toBeTruthy();
    first.unmount();
    render(<Panel {...props} />);
    await flush();
    expect(screen.getByText("loaded-panel")).toBeTruthy();
    expect(loader).toHaveBeenCalledTimes(1);
  });
});
