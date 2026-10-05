// @vitest-environment jsdom
/**
 * 2026-10-05 감사 — 폴더를 처음 연결할 때 연결 중에 나간 상태 (충돌 · 오류) 를 헤더 버튼이 보인다
 * (버튼이 연결 뒤에 mount 돼 그 이벤트를 놓치고 「동기화됨」 을 그리던 결함).
 */
import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/assets/projectDirectoryLink", () => ({
  pickAndConnectProjectDirectory: async (projectId: string) => {
    const state = { projectId, status: "conflict", directoryName: "site" };
    window.dispatchEvent(
      new CustomEvent("composition:directory-link", { detail: state }),
    );
    return state;
  },
  resumeProjectDirectoryLink: async () => undefined,
}));

import { I18nProvider } from "@/i18n";
import { useCatalogProjectFiles } from "../useCatalogProjectFiles";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider initialLocale="en-US">{children}</I18nProvider>
);

describe("folder link state on first connect", () => {
  it("the header button shows the conflict sent while connecting", async () => {
    const { result } = renderHook(
      () =>
        useCatalogProjectFiles({
          workspace: undefined,
          routeId: "p1",
          reopen: () => {},
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.connectFolder();
    });
    render(
      <I18nProvider initialLocale="en-US">
        {result.current.directoryLink}
      </I18nProvider>,
    );
    const button = screen.getByRole("button");
    expect(button.getAttribute("data-status")).toBe("conflict");
  });
});
