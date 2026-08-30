/**
 * ADR-200 후속 — 실제 빌더에서 조건을 만들 수 없었던 두 문구를 고정한다.
 *
 * DataTable 패널의 나머지 문구는 라이브로 두 locale 을 다 봤지만, 이 둘은 브라우저에서
 * 재현이 안 됐다:
 *  - 감지 결과 "형식 인식 불가" — 응답이 객체도 배열도 아니어야 나온다. 실제 API 를
 *    그 모양으로 만들 수단이 없다.
 *  - Import 실패 알림 — `createDataTable` 이 실제로 실패해야 나온다.
 *
 * 둘 다 store 를 가짜로 두면 정확히 그 분기로 들어가므로 여기서 잠근다. 확인하는 것은
 * 문구의 한국어 표현이 아니라 **활성 locale 의 카탈로그에서 왔는가** 다 — 그래서 기대값을
 * `localizedStrings` 에서 읽고, 키가 빠졌을 때의 무의미한 통과(= t 가 키를 그대로 반환)를
 * 막기 위해 두 locale 의 결과가 서로 다른지도 함께 본다.
 */
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const executeApiEndpoint = vi.fn();
const createDataTable = vi.fn();
const updateApiEndpoint = vi.fn(async () => {});

vi.mock("../../../stores/data", () => ({
  useDataStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ executeApiEndpoint, createDataTable, updateApiEndpoint }),
}));

import type { ReactNode } from "react";
import { ApiEndpointEditor } from "./ApiEndpointEditor";
import { I18nProvider } from "@/i18n";
import type { SupportedLocale } from "@/i18n";
import { localizedStrings } from "@/i18n/translations";
import type { ApiEndpoint } from "../../../../types/builder/data.types";

const LOCALES: SupportedLocale[] = ["ko-KR", "en-US"];

/** 카탈로그가 그 locale 에서 내놓는 값 — 기대값의 출처를 코드가 아니라 카탈로그로 둔다. */
function catalog(
  locale: SupportedLocale,
  key: string,
  params?: Record<string, string | number | boolean>,
): string {
  const message = localizedStrings[locale][key];
  return typeof message === "function" ? message(params) : (message ?? key);
}

const ENDPOINT = {
  id: "api-1",
  project_id: "project-1",
  name: "items",
  method: "GET",
  baseUrl: "https://example.test",
  path: "/items",
  headers: [],
  queryParams: [],
  bodyType: "none",
  bodyTemplate: "",
  responseMapping: {},
  targetCollection: "items_api",
  timeout: 30000,
} as unknown as ApiEndpoint;

function renderEditor(locale: SupportedLocale, activeTab: "response" | "run") {
  return render(
    <ApiEndpointEditor
      endpoint={ENDPOINT}
      onClose={() => {}}
      activeTab={activeTab}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      ),
    },
  );
}

/**
 * RAC `Button` 은 `onPress` 를 쓴다 — click 만으로는 안 눌리는 환경이 있어
 * pointer 쌍까지 같이 보낸다. 평범한 `<button onClick>` 에도 무해하다.
 */
function press(element: Element): void {
  fireEvent.pointerDown(element, { button: 0, pointerId: 1 });
  fireEvent.pointerUp(element, { button: 0, pointerId: 1 });
  fireEvent.click(element);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ApiEndpointEditor — 라이브로 못 만든 분기의 locale 해소", () => {
  it("응답이 객체도 배열도 아니면 '형식 인식 불가' 를 그 locale 로 세운다", async () => {
    const seen: Partial<Record<SupportedLocale, string>> = {};

    for (const locale of LOCALES) {
      // 배열도 객체도 아닌 응답 — 실제 API 로는 만들 수 없던 모양이다.
      executeApiEndpoint.mockResolvedValue(42);

      const { container } = renderEditor(locale, "response");
      press(container.querySelector(".field-with-action button")!);

      const result = await waitFor(() => {
        const node = container.querySelector(".detect-result");
        expect(node).not.toBeNull();
        return node!;
      });

      const expected = catalog(locale, "datatable.detectUnknownShape");
      expect(result.textContent, locale).toBe(expected);
      // ⚠ 접두사가 톤을 정한다 — 카탈로그로 옮기면서 이게 빠지면 색이 전부 같아진다.
      expect(result.className, locale).toContain("warning");

      seen[locale] = result.textContent ?? "";
      cleanup();
    }

    // 키가 빠져 `t` 가 키를 그대로 돌려주면 두 locale 이 같아진다 — 그 통과를 막는다.
    expect(seen["ko-KR"]).not.toBe(seen["en-US"]);
    expect(seen["ko-KR"]).not.toContain("datatable.");
  });

  it("DataTable 생성이 실패하면 Import 실패 알림을 그 locale 로 띄운다", async () => {
    const seen: Partial<Record<SupportedLocale, string>> = {};

    for (const locale of LOCALES) {
      executeApiEndpoint.mockResolvedValue([
        { id: 1, name: "first" },
        { id: 2, name: "second" },
      ]);
      createDataTable.mockRejectedValue(new Error("quota exceeded"));
      const alerted = vi.fn();
      vi.stubGlobal("alert", alerted);

      const { container } = renderEditor(locale, "run");

      // "run" 탭은 열리자마자 한 번 실행한다 — 컬럼이 잡혀야 Import 가 뜬다.
      const importButton = await waitFor(() => {
        const node = container.querySelector(".import-section button");
        expect(node).not.toBeNull();
        return node!;
      });
      press(importButton);

      await waitFor(() => expect(alerted).toHaveBeenCalledTimes(1));

      const expected = catalog(locale, "datatable.importFailed", {
        message: "quota exceeded",
      });
      expect(alerted.mock.calls[0][0], locale).toBe(expected);
      // 실패 사유가 문구 안에 실려야 사용자가 무엇이 잘못됐는지 안다.
      expect(alerted.mock.calls[0][0], locale).toContain("quota exceeded");

      seen[locale] = String(alerted.mock.calls[0][0]);
      vi.unstubAllGlobals();
      cleanup();
    }

    expect(seen["ko-KR"]).not.toBe(seen["en-US"]);
    expect(seen["ko-KR"]).not.toContain("datatable.");
  });
});
