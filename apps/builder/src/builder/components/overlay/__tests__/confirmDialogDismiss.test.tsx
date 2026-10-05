// @vitest-environment jsdom
/**
 * 2026-10-05 감사 — Esc · 바깥 클릭으로 닫으면 `onDismiss` (기본 onCancel) 를 부른다. 취소 버튼이
 * 다른 선택지 (타입 변경 「유지」, 붙여넣기 「열 없이」) 일 때 닫기만 해도 그 선택지가 실행되던 결함.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { ConfirmDialog } from "../ConfirmDialog";

afterEach(cleanup);

function open(onDismiss?: () => void) {
  const onCancel = vi.fn();
  const onConfirm = vi.fn();
  render(
    <I18nProvider initialLocale="en-US">
      <ConfirmDialog
        isOpen
        title="Change type"
        message="3 rows"
        confirmLabel="Clear"
        cancelLabel="Keep"
        onConfirm={onConfirm}
        onCancel={onCancel}
        onDismiss={onDismiss}
      />
    </I18nProvider>,
  );
  return { onCancel, onConfirm };
}

describe("ConfirmDialog dismiss", () => {
  it("Escape calls onDismiss, not the cancel choice", () => {
    const onDismiss = vi.fn();
    const { onCancel, onConfirm } = open(onDismiss);
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("without onDismiss, Escape is a cancel", () => {
    const { onCancel } = open();
    fireEvent.keyDown(screen.getByRole("alertdialog"), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
