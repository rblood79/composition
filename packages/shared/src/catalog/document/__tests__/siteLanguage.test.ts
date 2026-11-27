import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogSiteLanguage } from "../templateLocalizedProps";

/**
 * The language the page's own texts read (i18n 감사 2026-11-28): the site's, else the environment's —
 * the same fallback RAC and the Canvas take (`CatalogCompositionRoot.environmentLocale`), so a page
 * without a site language never draws English texts beside Korean RAC words.
 */
const reader = (lang?: string) => ({
  projectId: "project:project:p" as never,
  getEntry: () =>
    ({ kind: "project", site: lang ? { lang } : undefined }) as never,
});

afterEach(() => vi.unstubAllGlobals());

describe("catalogSiteLanguage", () => {
  it("the site's language when set", () => {
    vi.stubGlobal("navigator", { language: "ko-KR" });
    expect(catalogSiteLanguage(reader("en"))).toBe("en");
  });

  it("none set: the environment's (navigator.language), else English", () => {
    vi.stubGlobal("navigator", { language: "ko-KR" });
    expect(catalogSiteLanguage(reader())).toBe("ko-KR");
    vi.stubGlobal("navigator", undefined);
    expect(catalogSiteLanguage(reader())).toBe("en");
  });
});
