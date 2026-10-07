import { act, render } from "@testing-library/react";
import { useLocale } from "@react-aria/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCALE_STORAGE_KEY } from "../../i18n/locales";
import { PreviewLocale } from "../PreviewLocale";

/**
 * The Preview shows the document as it is published: RAC's locale is the browser's
 * (`navigator.language` — publish wraps no provider, and the Canvas root measures in the same),
 * not the Builder UI's language setting. A date field without its own `locale` formats alike in
 * the three.
 */
function Probe() {
  const { locale } = useLocale();
  return <span data-testid="locale">{locale}</span>;
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.removeItem(LOCALE_STORAGE_KEY);
});

describe("Preview locale", () => {
  it("is the browser's locale, not the Builder UI language", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "en-US");
    const view = render(
      <PreviewLocale>
        <Probe />
      </PreviewLocale>,
    );
    // The browser's language changes (RAC follows `languagechange`).
    vi.spyOn(navigator, "language", "get").mockReturnValue("ko-KR");
    act(() => {
      window.dispatchEvent(new Event("languagechange"));
    });
    expect(view.getByTestId("locale").textContent).toBe("ko-KR");
    expect(document.documentElement.lang).toBe("ko-KR");
  });
});
