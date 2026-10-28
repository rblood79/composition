// @vitest-environment jsdom

import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPageLayoutSection } from "./SettingsPageLayoutSection";

const { changeLayoutMock, layoutView } = vi.hoisted(() => ({
  changeLayoutMock: vi.fn(),
  layoutView: {
    current: {} as Record<string, unknown>,
  },
}));
const FIXED_VIEW = {
  direction: "auto",
  gap: 80,
  columns: 3,
  autoFitZoom: 40,
  columnCount: 3,
  tierOverrideAvailable: false,
  hasTierOverride: false,
};

// ADR-248 4e-7: the page grid is the open catalog project's `pageLayout` (the hook over the
// workspace — its command is `phase4ePageLayout` tests'); here the Settings section's reads and
// writes.
vi.mock("./useCatalogPageLayout", () => ({
  useCatalogPageLayout: () => ({
    view: layoutView.current,
    change: changeLayoutMock,
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

describe("Settings — 페이지 레이아웃", () => {
  beforeEach(() => {
    layoutView.current = FIXED_VIEW;
    changeLayoutMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("Page Layout 변경은 catalog page layout 의 direction 으로 쓴다", () => {
    render(<SettingsPageLayoutSection />);
    fireEvent.change(screen.getByLabelText("settings.pageLayoutDirection"), {
      target: { value: "vertical" },
    });
    expect(changeLayoutMock).toHaveBeenCalledWith({
      kind: "direction",
      direction: "vertical",
    });
  });

  it("Page Gap 은 「80 PX」 단위 suffix 필드 (px 하나 · preset 없음) — px 붙은 commit 값을 숫자로 쓴다", () => {
    render(<SettingsPageLayoutSection />);
    const input = screen.getByLabelText("settings.pageGap");
    expect((input as HTMLInputElement).value).toBe("80px");
    expect(input.parentElement?.getAttribute("data-units")).toBe("px");
    expect(input.parentElement?.getAttribute("data-unit-suffix")).toBe("true");
    expect(screen.queryByLabelText("settings.pageGapPreset")).toBeNull();
    fireEvent.change(input, { target: { value: "40px" } });
    expect(changeLayoutMock).toHaveBeenCalledWith({ kind: "gap", gap: 40 });
  });

  it("열 수 칸 — Fixed 는 개수, `%` 는 Auto 의 기준 배율 (ADR-274)", () => {
    render(<SettingsPageLayoutSection />);
    const columns = screen.getByLabelText("settings.pageColumns");
    expect((columns as HTMLInputElement).value).toBe("3");
    expect(columns.parentElement?.getAttribute("data-units")).toBe(",%");
    const typed = (value: string) => {
      changeLayoutMock.mockReset();
      fireEvent.change(columns, { target: { value } });
      return changeLayoutMock.mock.calls[0]?.[0];
    };
    // `auto` 를 치면 저장된 배율 (부재 = 40) 의 Auto.
    expect(typed("auto")).toEqual({ kind: "autoFitZoom", percent: 40 });
    expect(typed("5")).toEqual({ kind: "columns", columns: 5 });
    expect(typed("30")).toEqual({ kind: "columns", columns: 24 });
    // 단위 메뉴로 `%` 를 고르면 지금 숫자 (개수 3) 가 실려 온다 — 개수가 아니라 Auto 로 읽는다.
    expect(typed("3%")).toEqual({ kind: "autoFitZoom", percent: 40 });
    expect(typed("60%")).toEqual({ kind: "autoFitZoom", percent: 60 });
    expect(typed("0")).toBeUndefined();
  });

  it("Auto 는 `40%` 로 보이고, 단위를 빼면 지금 그려진 열 수로 고정한다", () => {
    layoutView.current = {
      ...FIXED_VIEW,
      columns: "auto",
      autoFitZoom: 40,
      columnCount: 7,
    };
    render(<SettingsPageLayoutSection />);
    const columns = screen.getByLabelText("settings.pageColumns");
    expect((columns as HTMLInputElement).value).toBe("40%");
    fireEvent.change(columns, { target: { value: "50%" } });
    expect(changeLayoutMock).toHaveBeenLastCalledWith({
      kind: "autoFitZoom",
      percent: 50,
    });
    fireEvent.change(columns, { target: { value: "40" } });
    expect(changeLayoutMock).toHaveBeenLastCalledWith({
      kind: "columns",
      columns: 7,
    });
  });
});
