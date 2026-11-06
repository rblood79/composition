import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import {
  DEFAULT_BASE_TYPOGRAPHY,
  FONT_REGISTRY_STORAGE_KEY,
  saveRegistryAndNotify,
} from "../../../fonts/customFonts";
import { FontFamilyPicker } from "../FontFamilyPicker";

afterEach(() => localStorage.clear());

function renderPicker(scope: "element" | "theme", value = "Inter") {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <I18nProvider initialLocale="en-US">
      <FontFamilyPicker
        label={scope === "theme" ? "Font" : undefined}
        scope={scope}
        value={value}
        inheritedFamily="Pretendard"
        onChange={onChange}
      />
    </I18nProvider>,
  );
  return { user, onChange };
}

describe("공용 폰트 선택창의 Theme·Design 경계", () => {
  it("Design은 폰트 선택만 제공하고 등록·관리 진입점이 없다", async () => {
    const { user, onChange } = renderPicker("element");
    await user.click(screen.getByRole("button", { name: "Font Family" }));
    expect(
      screen.queryByRole("button", { name: /Add fonts|Manage fonts/ }),
    ).toBeNull();
    await user.click(screen.getByRole("option", { name: "Pretendard" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("Pretendard");
  });

  it("Theme에서만 추가 모달을 열고 등록 진입만으로 서체는 변경하지 않는다", async () => {
    const { user, onChange } = renderPicker("theme");
    expect(screen.getByText("Font").tagName).toBe("LEGEND");
    await user.click(screen.getByRole("button", { name: "Font Family" }));
    await user.click(screen.getByRole("button", { name: "Add fonts" }));
    expect(
      await screen.findByRole("dialog", { name: "Manage fonts" }),
    ).toBeTruthy();
    expect(screen.queryByRole("listbox", { name: "Font Family" })).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["theme", "element"] as const)(
    "%s 복원은 자기 범위의 기본값을 전달한다",
    async (scope) => {
      const { user, onChange } = renderPicker(scope);
      await user.click(screen.getByRole("button", { name: "Font Family" }));
      const options = screen.getAllByRole("option");
      await user.click(
        options.find((option) => option.getAttribute("data-key") === "reset")!,
      );
      expect(onChange).toHaveBeenCalledExactlyOnceWith(
        scope === "theme" ? DEFAULT_BASE_TYPOGRAPHY.fontFamily : "",
      );
    },
  );

  it("기존 fallback 체인을 선택 상태로 표시하고 열기만 하면 저장값을 유지한다", async () => {
    const chain = "'Inter', -apple-system, system-ui, sans-serif";
    const { user, onChange } = renderPicker("theme", chain);
    const trigger = screen.getByRole("button", { name: "Font Family" });
    expect(trigger.textContent).toBe("Inter");
    await user.click(trigger);
    const inter = screen.getByRole("option", { name: "Inter" });
    expect(inter.getAttribute("aria-selected")).toBe("true");
    expect(inter.getAttribute("data-key")).toBe(chain);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("외부에서 등록한 폰트를 열린 목록에 반영하며 기존 선택은 바꾸지 않는다", async () => {
    const { user, onChange } = renderPicker("element");
    await user.click(screen.getByRole("button", { name: "Font Family" }));
    await act(async () => {
      saveRegistryAndNotify({
        version: 2,
        faces: [
          {
            id: "picker-uploaded",
            family: "Shared uploaded font",
            weight: "400",
            style: "normal",
            source: {
              type: "remote-url",
              url: "https://fonts.test/uploaded.woff2",
            },
            createdAt: "2026-11-06T00:00:00Z",
            updatedAt: "2026-11-06T00:00:00Z",
          },
        ],
      });
    });
    const list = screen.getByRole("listbox", { name: "Font Family" });
    const uploaded = within(list).getByRole("option", {
      name: "Shared uploaded font",
    });
    expect(localStorage.getItem(FONT_REGISTRY_STORAGE_KEY)).toContain(
      "Shared uploaded font",
    );
    expect(onChange).not.toHaveBeenCalled();
    await user.click(uploaded);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("Shared uploaded font");
  });
});
