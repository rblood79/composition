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
    // 다시 시도 = 확인 호출 1 + 새 lazy 1 (둘 다 loader)
    expect(loader.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("loaded-panel")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("sibling")).toBeTruthy();
  });

  it("다시 시도도 즉시 실패하면 (브라우저가 실패를 기억) 앱을 새로고침한다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const reload = vi.fn();
    const location = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...location, reload },
    });
    try {
      const loader = vi.fn(async () => {
        throw new Error("chunk load failed");
      });
      const Panel = lazyPanel(loader);
      render(<Panel {...props} />);
      await flush();
      fireEvent.click(screen.getByRole("button", { name: "panel.retry" }));
      await flush();
      expect(reload).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("alert")).toBeTruthy();
    } finally {
      Object.defineProperty(window, "location", {
        configurable: true,
        value: location,
      });
    }
  });

  it("preload 뒤 열림은 Suspense 를 거치지 않는다 — 첫 렌더에 내용 (fallback 0)", async () => {
    const loader = vi.fn(async () => ({ default: Loaded }));
    const Panel = lazyPanel(loader);
    await Panel.preload();
    const { container } = render(<Panel {...props} />);
    // await 없이 — 동기 렌더 결과에 내용
    expect(container.textContent).toBe("loaded-panel");
    expect(container.querySelector("[aria-busy]")).toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
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
