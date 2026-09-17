// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../stores";
import { readPageLayoutSettings } from "../../stores/utils/pageLayoutStorage";
import { SettingsPanel } from "./SettingsPanel";

const {
  alignPagesToScreenMock,
  sendDarkModeMock,
  setThemeModeMock,
  setUiScaleMock,
} = vi.hoisted(() => ({
  alignPagesToScreenMock: vi.fn(),
  sendDarkModeMock: vi.fn(),
  setThemeModeMock: vi.fn(),
  setUiScaleMock: vi.fn(),
}));

vi.mock("../../workspace/canvas/viewport/pageLayoutActions", () => ({
  alignPagesToScreen: alignPagesToScreenMock,
}));

// 배럴 전체를 교체하지 않는다 — 새 export 가 추가될 때마다 조용히 깨진다
// (PanelContents 도입 때 실제로 깨졌다). 실물을 깔고 무거운 것만 덮는다.
vi.mock("../../components", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../components")>()),
  PanelHeader: () => null,
  PropertyUnitInput: ({
    label,
    onChange,
    units,
    unitSuffix,
    value,
  }: {
    label: string;
    onChange: (value: string) => void;
    units?: string[];
    unitSuffix?: boolean;
    value: string;
  }) => (
    <div data-units={units?.join(",")} data-unit-suffix={unitSuffix || undefined}>
      <input
        aria-label={label}
        type="text"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </div>
  ),
  PropertySection: ({ children }: { children: ReactNode }) => <>{children}</>,
  PropertySelect: ({
    label,
    onChange,
    options,
    value,
  }: {
    label: string;
    onChange: (value: string) => void;
    options: ReadonlyArray<{ label: string; value: string }>;
    value: string;
  }) => (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  PropertySwitch: () => null,
  PropertySizeToggle: ({
    label,
    onChange,
    options,
    value,
  }: {
    label: string;
    onChange: (value: string) => void;
    options: ReadonlyArray<{ id: string; label: string }>;
    value: string;
  }) => (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("@/builder/hooks", () => ({
  useThemeMessenger: () => ({ sendDarkMode: sendDarkModeMock }),
}));

vi.mock("@/i18n", () => ({
  LanguageSwitcher: () => null,
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("../../../stores/uiStore", () => {
  const state = {
    setThemeMode: setThemeModeMock,
    setUiScale: setUiScaleMock,
    themeMode: "light",
    uiScale: 100,
  };

  return {
    useUiStore: (selector: (value: typeof state) => unknown) => selector(state),
  };
});

describe("SettingsPanel page layout synchronization", () => {
  beforeEach(() => {
    alignPagesToScreenMock.mockReset();
    sendDarkModeMock.mockReset();
    setThemeModeMock.mockReset();
    setUiScaleMock.mockReset();
    useStore.setState({
      pageGap: 80,
      pageLayoutDirection: "auto",
    } as never);
  });

  afterEach(() => {
    cleanup();
  });

  it("Page Layout 변경값을 저장한 뒤 Canvas page 위치를 다시 정렬한다", () => {
    const observedDirections: string[] = [];
    alignPagesToScreenMock.mockImplementation(() => {
      observedDirections.push(useStore.getState().pageLayoutDirection);
    });
    render(<SettingsPanel />);

    fireEvent.change(screen.getByLabelText("settings.pageLayout"), {
      target: { value: "vertical" },
    });

    expect(useStore.getState().pageLayoutDirection).toBe("vertical");
    expect(observedDirections).toEqual(["vertical"]);
    // 새로고침 후에도 유지 — localStorage (액션바 설정과 같은 채널)
    expect(readPageLayoutSettings().direction).toBe("vertical");
  });

  it("Page Gap 변경값을 저장한 뒤 Canvas page 위치를 다시 정렬한다", () => {
    const observedGaps: number[] = [];
    alignPagesToScreenMock.mockImplementation(() => {
      observedGaps.push(useStore.getState().pageGap);
    });
    render(<SettingsPanel />);

    fireEvent.change(screen.getByLabelText("settings.pageGap"), {
      target: { value: "120" },
    });

    expect(useStore.getState().pageGap).toBe(120);
    expect(observedGaps).toEqual([120]);
    expect(readPageLayoutSettings().gap).toBe(120);
  });

  it("Page Gap 은 「80 PX」 단위 suffix 필드 (px 하나 · preset 없음) — px 붙은 commit 값을 숫자로 저장한다", () => {
    const observedGaps: number[] = [];
    alignPagesToScreenMock.mockImplementation(() => {
      observedGaps.push(useStore.getState().pageGap);
    });
    render(<SettingsPanel />);

    const input = screen.getByLabelText("settings.pageGap");
    expect((input as HTMLInputElement).value).toBe("80px");
    expect(input.parentElement?.getAttribute("data-units")).toBe("px");
    expect(input.parentElement?.getAttribute("data-unit-suffix")).toBe("true");
    expect(screen.queryByLabelText("settings.pageGapPreset")).toBeNull();

    fireEvent.change(input, { target: { value: "40px" } });

    expect(useStore.getState().pageGap).toBe(40);
    expect(observedGaps).toEqual([40]);
  });

  it("Theme Mode를 변경하면 토글 선택값과 dark mode 동기화를 유지한다", () => {
    render(<SettingsPanel />);

    fireEvent.change(screen.getByLabelText("settings.themeMode"), {
      target: { value: "dark" },
    });

    expect(setThemeModeMock).toHaveBeenCalledWith("dark");
    expect(sendDarkModeMock).toHaveBeenCalledWith(true);
  });

  it("UI Scale은 S/M/L로 표시하고 실제 scale 값은 숫자로 저장한다", () => {
    render(<SettingsPanel />);

    const scaleSelect = screen.getByLabelText("settings.uiScale");
    expect(
      Array.from(scaleSelect.querySelectorAll("option")).map((option) => [
        option.value,
        option.textContent,
      ]),
    ).toEqual([
      ["80", "S"],
      ["100", "M"],
      ["120", "L"],
    ]);

    fireEvent.change(scaleSelect, {
      target: { value: "80" },
    });

    expect(setUiScaleMock).toHaveBeenCalledWith(80);
  });
});
