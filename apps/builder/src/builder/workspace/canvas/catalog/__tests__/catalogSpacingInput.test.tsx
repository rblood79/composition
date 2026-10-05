// @vitest-environment jsdom
/**
 * 2026-10-05 감사 — RAC NumberField 는 화살표 증감 때도 onChange 를 부른다. 간격 인라인 입력은
 * 화살표로 값을 올리는 동안 열려 있고, Enter / blur 에서 한 번 commit 한다.
 */
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { CatalogSpacingInput } from "../CatalogSpacingInput";
import type { SpacingBand } from "../../interaction/spacingGeometry";

const band = {
  kind: "padding",
  side: "top",
  rect: { x: 0, y: 0, width: 100, height: 8 },
} as unknown as SpacingBand;

afterEach(cleanup);

function open() {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <I18nProvider initialLocale="en-US">
      <CatalogSpacingInput
        band={band}
        startValue={8}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    </I18nProvider>,
  );
  const input = view.getByRole("textbox") as HTMLInputElement;
  return { input, onCommit, onCancel };
}

const flush = () => act(() => Promise.resolve());

describe("CatalogSpacingInput", () => {
  it("arrow keys step the value without closing; Enter commits once", async () => {
    const { input, onCommit, onCancel } = open();
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp" });
    await flush();
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    await flush();
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(10);
  });

  it("a typed value commits on blur; an unchanged blur cancels", async () => {
    const typed = open();
    fireEvent.change(typed.input, { target: { value: "12" } });
    fireEvent.blur(typed.input);
    await flush();
    expect(typed.onCommit).toHaveBeenCalledWith(12);
    cleanup();
    const unchanged = open();
    fireEvent.blur(unchanged.input);
    await flush();
    expect(unchanged.onCommit).not.toHaveBeenCalled();
    expect(unchanged.onCancel).toHaveBeenCalledTimes(1);
  });
});
