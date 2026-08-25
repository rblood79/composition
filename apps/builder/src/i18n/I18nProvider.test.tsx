import { act, renderHook } from "@testing-library/react";
import { useLocale } from "@react-aria/i18n";
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
    expect(result.current.t("styles.modifiedCount", { count: 2 })).toBe(
      "2 modified",
    );
    expect(result.current.t("validation.minLength", { min: 3 })).toBe(
      "Must be at least 3 characters",
    );
    expect(result.current.t("messages.itemCount", { count: 1 })).toBe("1 item");
    expect(result.current.t("messages.itemCount", { count: 2 })).toBe(
      "2 items",
    );
    expect(result.current.t("missing.translation")).toBe("missing.translation");
    expect(result.current.t("labels.Width")).toBe("labels.Width");
    expect(result.current.t("datatable.tables")).toBe("Tables");
    expect(result.current.t("monitor.memoryUsage")).toBe("Memory Usage");
    expect(result.current.t("debugger.title")).toBe("⌨️ Shortcut Debugger");

    act(() => {
      result.current.setLocale("ko-KR");
    });

    expect(result.current.locale).toBe("ko-KR");
    expect(result.current.t("settings.title")).toBe("설정");
    expect(result.current.t("styles.layout.width")).toBe("너비");
    expect(result.current.t("workspace.movePanel", { panel: "노드" })).toBe(
      "노드 패널 이동",
    );
    expect(result.current.t("styles.modifiedCount", { count: 2 })).toBe("2개");
    expect(result.current.t("validation.minLength", { min: 3 })).toBe(
      "최소 3자 이상이어야 합니다",
    );
    expect(result.current.t("messages.itemCount", { count: 1 })).toBe("1개");
    expect(result.current.t("messages.itemCount", { count: 2 })).toBe("2개");
    expect(result.current.t("datatable.tables")).toBe("테이블");
    expect(result.current.t("monitor.memoryUsage")).toBe("메모리 사용량");
    expect(result.current.t("debugger.title")).toBe("⌨️ 단축키 디버거");
    expect(localStorage.getItem("composition-locale")).toBe("ko-KR");
    expect(document.documentElement.lang).toBe("ko-KR");
    expect(document.documentElement.dir).toBe("ltr");
  });

  it("restores the stored locale and synchronizes React Aria locale", () => {
    localStorage.setItem("composition-locale", "ko-KR");

    const { result } = renderHook(
      () => ({
        i18n: useI18n(),
        aria: useLocale(),
      }),
      { wrapper: ({ children }) => <I18nProvider>{children}</I18nProvider> },
    );

    expect(result.current.i18n.locale).toBe("ko-KR");
    expect(result.current.aria.locale).toBe("ko-KR");
    expect(document.documentElement.lang).toBe("ko-KR");

    act(() => {
      result.current.i18n.setLocale("en-US");
    });

    expect(result.current.i18n.locale).toBe("en-US");
    expect(result.current.aria.locale).toBe("en-US");
    expect(localStorage.getItem("composition-locale")).toBe("en-US");
    expect(document.documentElement.lang).toBe("en-US");
  });

  it("exposes only English and Korean with English as the fallback locale", () => {
    expect(Object.keys(localeConfigs)).toEqual(["en-US", "ko-KR"]);
    expect(DEFAULT_LOCALE).toBe("en-US");
    expect(localStorage.getItem("composition-locale")).toBeNull();
  });
});
