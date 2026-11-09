// @vitest-environment jsdom
/**
 * 2026-11-09 — 글꼴 업로드 영역은 RAC DropZone + FileTrigger + Button. 옛 `div role="button"` 은 클릭만 받아
 * Enter · Space 로 열리지 않았다.
 */
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { FontUploadZone } from "../components/FontUploadZone";

afterEach(cleanup);
const wrap = ({ children }: { children: ReactNode }) => (
  <I18nProvider initialLocale="en-US">{children}</I18nProvider>
);

describe("FontUploadZone — RAC DropZone · FileTrigger", () => {
  it("영역 안 native button 이 파일 입력 (글꼴 형식 · 여러 개) 을 연다 · 가득 차면 비활성", () => {
    const { container, rerender } = render(
      <FontUploadZone onUpload={vi.fn()} />,
      { wrapper: wrap },
    );
    const zone = container.querySelector(".font-upload-zone")!;
    const button = zone.querySelector("button.font-upload-trigger")!;
    expect(button).not.toBeNull();
    const input = zone.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toBe(".woff2,.woff,.ttf,.otf");
    expect(input.multiple).toBe(true);
    const click = vi.spyOn(input, "click");
    button.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    button.dispatchEvent(
      new KeyboardEvent("keyup", { key: "Enter", bubbles: true }),
    );
    expect(click).toHaveBeenCalled();
    expect(zone.querySelector("[role=button]:not(button)")).toBeNull();

    rerender(<FontUploadZone onUpload={vi.fn()} disabled />);
    expect(
      container
        .querySelector(".font-upload-zone")!
        .hasAttribute("data-disabled"),
    ).toBe(true);
    expect(
      (
        container.querySelector(
          "button.font-upload-trigger",
        ) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});
