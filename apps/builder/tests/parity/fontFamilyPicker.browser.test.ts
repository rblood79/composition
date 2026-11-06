import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { I18nProvider } from "@/i18n";
import { loadAllLocaleMessages } from "@/i18n/loadMessages";
import { FontFamilyPicker } from "@/builder/panels/fonts/FontFamilyPicker";
import "@/builder/components/styles/index.css";
import "@/builder/panels/themes/ThemesPanel.css";

it.each(["theme", "element"] as const)(
  "%s 긴 서체명을 줄이고 전체 값·선택 이름은 보존한다",
  async (scope) => {
    await loadAllLocaleMessages();
    const fullName =
      "LongFontFamilyNameForTypographyPickerOverflowVerification";
    const host = document.createElement("div");
    host.className = "panel themes-panel";
    host.style.width = "240px";
    const section = document.createElement("div");
    section.className = "section";
    const content = document.createElement("div");
    content.className = "section-content";
    section.append(content);
    host.append(section);
    document.body.append(host);
    const root = createRoot(content);
    try {
      await act(async () =>
        root.render(
          createElement(I18nProvider, {
            initialLocale: "en-US",
            children: createElement(FontFamilyPicker, {
              scope,
              label: scope === "theme" ? "Font" : undefined,
              value: fullName,
              onChange: () => {},
            }),
          }),
        ),
      );
      const value = host.querySelector<HTMLElement>(".font-picker-value")!;
      expect(value.textContent).toBe(fullName);
      expect(value.title).toBe(fullName);
      expect(value.scrollWidth).toBeGreaterThan(value.clientWidth);
      expect(getComputedStyle(value).textOverflow).toBe("ellipsis");
      expect(getComputedStyle(value).whiteSpace).toBe("nowrap");
      expect(value.getBoundingClientRect().right).toBeLessThanOrEqual(
        host.getBoundingClientRect().right,
      );
      expect(host.querySelector("legend")?.textContent).toBe(
        scope === "theme" ? "Font" : undefined,
      );
      await userEvent.click(
        host.querySelector<HTMLButtonElement>(".font-picker-trigger")!,
      );
      const item = document.querySelector<HTMLElement>(
        `.font-picker-item[data-key="${fullName}"]`,
      )!;
      const text = item.querySelector("span")!;
      expect(item.getAttribute("data-key")).toBe(fullName);
      expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
      expect(getComputedStyle(text).textOverflow).toBe("ellipsis");
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  },
);
