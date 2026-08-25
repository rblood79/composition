import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider } from "./I18nProvider";
import { useI18n } from "./useI18n";
import { DEFAULT_LOCALE, localeConfigs } from "./locales";

function TestProvider({ children }: { children: ReactNode }) {
  return <I18nProvider initialLocale="en-US">{children}</I18nProvider>;
}

describe("I18nProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
    document.documentElement.dir = "";
  });

  it("provides translations and persists locale changes", () => {
    const { result } = renderHook(() => useI18n(), {
      wrapper: TestProvider,
    });

    expect(result.current.locale).toBe("en-US");
    expect(result.current.t("settings.title")).toBe("Settings");
    expect(result.current.t("header.logo")).toBe("composition logo");
    expect(result.current.t("header.emptyHistory")).toBe("0/0");
    expect(result.current.t("zoom.level")).toBe("Zoom level");
    expect(result.current.t("workspace.movePanel", { panel: "Nodes" })).toBe(
      "Move Nodes panel",
    );
    expect(result.current.t("datatable.tables")).toBe("Tables");
    expect(result.current.t("monitor.memoryUsage")).toBe("Memory Usage");
    expect(result.current.t("debugger.title")).toBe("⌨️ Shortcut Debugger");

    act(() => {
      result.current.setLocale("ko-KR");
    });

    expect(result.current.locale).toBe("ko-KR");
    expect(result.current.t("settings.title")).toBe("설정");
    expect(result.current.t("labels.Width")).toBe("너비");
    expect(result.current.t("datatable.tables")).toBe("테이블");
    expect(result.current.t("monitor.memoryUsage")).toBe("메모리 사용량");
    expect(result.current.t("debugger.title")).toBe("⌨️ 단축키 디버거");
    expect(localStorage.getItem("composition-locale")).toBe("ko-KR");
    expect(document.documentElement.lang).toBe("ko-KR");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("exposes only English and Korean with English as the fallback locale", () => {
    expect(Object.keys(localeConfigs)).toEqual(["en-US", "ko-KR"]);
    expect(DEFAULT_LOCALE).toBe("en-US");
    expect(localStorage.getItem("composition-locale")).toBeNull();
  });
});
