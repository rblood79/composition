// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "./SettingsPanel";

const { setThemeModeMock, setUiScaleMock } = vi.hoisted(() => ({
  setThemeModeMock: vi.fn(),
  setUiScaleMock: vi.fn(),
}));
// 배럴 전체를 교체하지 않는다 — 새 export 가 추가될 때마다 조용히 깨진다
// (PanelContents 도입 때 실제로 깨졌다). 실물을 깔고 무거운 것만 덮는다.
const componentMocks = vi.hoisted(() => ({
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
    <div
      data-units={units?.join(",")}
      data-unit-suffix={unitSuffix || undefined}
    >
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
vi.mock("../../components/panel/PanelHeader", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  PanelHeader: componentMocks.PanelHeader,
}));
vi.mock(
  "../../components/property/PropertyUnitInput",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    PropertyUnitInput: componentMocks.PropertyUnitInput,
  }),
);
vi.mock("../../components/panel/Section", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  Section: componentMocks.PropertySection,
}));
vi.mock("../../components/property/PropertySelect", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  PropertySelect: componentMocks.PropertySelect,
}));
vi.mock("../../components/property/PropertySwitch", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  PropertySwitch: componentMocks.PropertySwitch,
}));
vi.mock(
  "../../components/property/PropertySizeToggle",
  async (importOriginal) => ({
    ...(await importOriginal<object>()),
    PropertySizeToggle: componentMocks.PropertySizeToggle,
  }),
);

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

describe("SettingsPanel — Builder 환경 설정", () => {
  beforeEach(() => {
    setThemeModeMock.mockReset();
    setUiScaleMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("페이지 레이아웃 · toast 위치 (문서 값) 는 Settings 에 없다 — Site 패널 (2026-10-28)", () => {
    render(<SettingsPanel />);
    expect(screen.queryByLabelText("settings.pageGap")).toBeNull();
    expect(screen.queryByLabelText("settings.pageLayoutDirection")).toBeNull();
    expect(screen.queryByLabelText("settings.toastPlacement")).toBeNull();
  });

  it("Theme Mode를 변경하면 UI 테마 설정에 반영한다", () => {
    render(<SettingsPanel />);

    fireEvent.change(screen.getByLabelText("settings.themeMode"), {
      target: { value: "dark" },
    });

    expect(setThemeModeMock).toHaveBeenCalledWith("dark");
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
