// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteAppSection } from "./SitePageSections";

const { changeToastMock } = vi.hoisted(() => ({
  changeToastMock: vi.fn(),
}));
// The app toast placement moved from Settings (2026-10-28); the page grid stays in Settings.
vi.mock("./useCatalogToastPlacement", () => ({
  useCatalogToastPlacement: () => ({
    value: "bottom end",
    change: changeToastMock,
  }),
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

describe("Site 패널 — 앱", () => {
  beforeEach(() => {
    changeToastMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("toast 위치 — 위 · 아래와 정렬 두 칸이 S2 placement 하나로 쓰인다", () => {
    render(<SiteAppSection />);
    fireEvent.change(screen.getByLabelText("settings.toastPlacement"), {
      target: { value: "top" },
    });
    expect(changeToastMock).toHaveBeenLastCalledWith("top end");
    fireEvent.change(screen.getByLabelText("settings.toastAlign"), {
      target: { value: "center" },
    });
    expect(changeToastMock).toHaveBeenLastCalledWith("bottom");
  });
});
