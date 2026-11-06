// @vitest-environment jsdom
/**
 * 헤더 저장 상태 — 글자 대신 아이콘 + 우측 상단 dot. 상태 설명은 tooltip · aria-label · live region 이
 * 맡고, 자동 저장이 멈춘 상태는 색이 아니라 아이콘 모양으로도 구분한다.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { I18nProvider } from "@/i18n";
import type { CatalogSaveState } from "../../catalogRuntime/autosave";
import { SaveStatusButton } from "../SaveStatusButton";

afterEach(cleanup);

function renderStatus(state: CatalogSaveState, onRetry = vi.fn()) {
  const view = render(
    <I18nProvider initialLocale="en-US">
      <SaveStatusButton state={state} onRetry={onRetry} />
    </I18nProvider>,
  );
  return { ...view, button: screen.getByRole("button"), onRetry };
}

const LABELS: Record<CatalogSaveState, string> = {
  saved: "Saved",
  unsaved: "Unsaved changes",
  saving: "Saving…",
  failed: "Save failed — click to retry",
  conflict: "Another tab changed this project — autosave stopped",
  unsupported: "This project format cannot be saved — autosave stopped",
};
const STATES = Object.keys(LABELS) as CatalogSaveState[];

describe("SaveStatusButton", () => {
  it.each(STATES)("%s: 글자 없이 상태를 aria-label · live region 으로 낸다", (state) => {
    const { button, container } = renderStatus(state);
    expect(button.textContent).toBe("");
    expect(button.getAttribute("aria-label")).toBe(LABELS[state]);
    expect(button.getAttribute("data-save-state")).toBe(state);
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      LABELS[state],
    );
  });

  it.each(STATES)("%s: tooltip 이 뜨도록 disabled 로 두지 않는다", (state) => {
    const { button } = renderStatus(state);
    expect(button.hasAttribute("disabled")).toBe(false);
  });

  it.each(["saved", "unsaved", "saving"] as const)(
    "%s: 저장이 도는 상태는 Cloud",
    (state) => {
      const { button } = renderStatus(state);
      expect(button.querySelector(".lucide-cloud")).not.toBeNull();
      expect(button.querySelector(".lucide-cloud-off")).toBeNull();
    },
  );

  it.each(["failed", "conflict", "unsupported"] as const)(
    "%s: 저장이 멈춘 상태는 색과 별개로 CloudOff",
    (state) => {
      const { button } = renderStatus(state);
      expect(button.querySelector(".lucide-cloud-off")).not.toBeNull();
    },
  );

  it("dot 은 장식이라 접근성 트리에서 뺀다 · 저장됨은 dot 이 없다", () => {
    const saving = renderStatus("saving");
    const dot = saving.button.querySelector(".catalog-save-status-dot");
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
    saving.unmount();
    const saved = renderStatus("saved");
    expect(saved.button.querySelector(".catalog-save-status-dot")).toBeNull();
  });

  it("실패만 눌러서 다시 시도한다", () => {
    const failed = renderStatus("failed");
    fireEvent.click(failed.button);
    expect(failed.onRetry).toHaveBeenCalledTimes(1);
    failed.unmount();
    for (const state of STATES.filter((value) => value !== "failed")) {
      const other = renderStatus(state);
      fireEvent.click(other.button);
      expect(other.onRetry).not.toHaveBeenCalled();
      other.unmount();
    }
  });
});
