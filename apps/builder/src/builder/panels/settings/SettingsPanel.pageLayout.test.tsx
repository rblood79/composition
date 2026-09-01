// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useStore } from "../../stores";
import type { PropertyUnitPreset } from "../../components/property/propertyUnitPresets";
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

vi.mock("../../components", () => ({
  PanelHeader: () => null,
  PropertyUnitInput: ({
    label,
    onChange,
    presetAriaLabel,
    presets = [],
    value,
  }: {
    label: string;
    onChange: (value: string) => void;
    presetAriaLabel: string;
    presets?: readonly PropertyUnitPreset[];
    value: string;
  }) => (
    <div>
      <input
        aria-label={label}
        type="text"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      <select
        aria-label={presetAriaLabel}
        defaultValue=""
        onChange={(event) => {
          const preset = presets.find(
            (candidate) => candidate.id === event.currentTarget.value,
          );
          if (preset) onChange(preset.value);
        }}
      >
        <option value="">—</option>
        {presets.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
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
  });

  it("Page Gap preset 선택값을 저장한 뒤 Canvas page 위치를 다시 정렬한다", () => {
    const observedGaps: number[] = [];
    alignPagesToScreenMock.mockImplementation(() => {
      observedGaps.push(useStore.getState().pageGap);
    });
    render(<SettingsPanel />);

    fireEvent.change(screen.getByLabelText("settings.pageGapPreset"), {
      target: { value: "sm" },
    });

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
