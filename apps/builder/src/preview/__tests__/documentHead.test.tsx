// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyCatalogDocumentHead,
  catalogWebManifest,
  useCatalogDocumentHead,
  type CatalogDocumentHeadSession,
} from "../../../../../packages/shared/src/catalog/runtime/documentHead";

/**
 * ADR-286 Decision 8 — the Preview and the published page write the site's `<head>` (title ·
 * description · favicon · `lang`) from the document. Before, both kept their `index.html` title
 * ("composition Preview" · "composition Published App") and no icon whatever the Site panel said.
 */
const LIGHT = `asset:sha256-${"a".repeat(64)}` as const;
const DARK = `asset:sha256-${"b".repeat(64)}` as const;
const resolve = (url: string) => `blob:${url.slice(-4)}`;
const fallback = {
  title: "composition Preview",
  lang: "ko-KR",
  dir: "ltr" as const,
};
const icons = () =>
  [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')].map(
    (link) => [link.getAttribute("href"), link.media],
  );
const description = () =>
  document.head
    .querySelector('meta[name="description"]')
    ?.getAttribute("content");

beforeEach(() => {
  document.head.innerHTML = "";
  document.title = fallback.title;
  document.documentElement.lang = "en";
});

describe("applyCatalogDocumentHead", () => {
  it("writes the site's title · description · lang and a light · dark favicon pair", () => {
    applyCatalogDocumentHead(
      document,
      {
        title: "Acme",
        description: "Acme site",
        lang: "en",
        favicon: { light: LIGHT, dark: DARK },
        robots: "index",
      },
      fallback,
      resolve,
    );
    expect(document.title).toBe("Acme");
    expect(description()).toBe("Acme site");
    expect(document.documentElement.lang).toBe("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(icons()).toEqual([
      ["blob:aaaa", "(prefers-color-scheme: light)"],
      ["blob:bbbb", "(prefers-color-scheme: dark)"],
    ]);
  });

  it("one favicon serves both schemes; an unset site falls back and removes what it wrote", () => {
    applyCatalogDocumentHead(
      document,
      {
        title: "Acme",
        description: "x",
        favicon: { dark: DARK },
        robots: "index",
      },
      fallback,
      resolve,
    );
    expect(icons()).toEqual([["blob:bbbb", ""]]);

    applyCatalogDocumentHead(document, undefined, fallback, resolve);
    expect(document.title).toBe("composition Preview");
    expect(document.documentElement.lang).toBe("ko-KR");
    expect(description()).toBeUndefined();
    expect(icons()).toEqual([]);
  });

  it("an RTL site language sets dir", () => {
    applyCatalogDocumentHead(
      document,
      { lang: "ar", favicon: {}, robots: "index" },
      fallback,
      resolve,
    );
    expect(document.documentElement.dir).toBe("rtl");
  });

  it("the page's own icon steps aside while the site has one and comes back without", () => {
    const appIcon = document.createElement("link");
    appIcon.rel = "icon";
    appIcon.href = "/appIcon.svg";
    document.head.appendChild(appIcon);
    applyCatalogDocumentHead(
      document,
      { favicon: { light: LIGHT }, robots: "index" },
      fallback,
      resolve,
    );
    expect(icons()).toEqual([["blob:aaaa", ""]]);
    applyCatalogDocumentHead(document, undefined, fallback, resolve);
    expect(icons()).toEqual([["/appIcon.svg", ""]]);
  });

  it("the installed app: apple-touch-icon · theme-color, removed with the setting", () => {
    const head = { appIcon: LIGHT, themeColor: "#123456", favicon: {}, robots: "index" as const };
    applyCatalogDocumentHead(document, head, fallback, resolve);
    const touch = () =>
      document.head.querySelector('link[rel="apple-touch-icon"]')?.getAttribute("href");
    const theme = () =>
      document.head.querySelector('meta[name="theme-color"]')?.getAttribute("content");
    expect([touch(), theme()]).toEqual(["blob:aaaa", "#123456"]);
    applyCatalogDocumentHead(document, undefined, fallback, resolve);
    expect([touch(), theme()]).toEqual([undefined, undefined]);
  });

  it("skips a favicon whose bytes are not ready yet", () => {
    applyCatalogDocumentHead(
      document,
      { favicon: { light: LIGHT }, robots: "index" },
      fallback,
      () => null,
    );
    expect(icons()).toEqual([]);
  });
});

describe("useCatalogDocumentHead", () => {
  afterEach(() => {
    document.head.innerHTML = "";
  });

  it("follows the session's document and page (page title over the site's)", () => {
    const entries: Record<string, unknown> = {
      p: {
        kind: "project",
        id: "p",
        pageIds: ["a", "b"],
        site: { title: "Acme", lang: "en" },
      },
      a: { kind: "page", id: "a", route: "/" },
      b: { kind: "page", id: "b", route: "/m", meta: { title: "Members" } },
    };
    const listeners = new Set<() => void>();
    let version = 0;
    let pageId = "a";
    const session = {
      graph: { projectId: "p", getEntry: (id: string) => entries[id] },
      get pageId() {
        return pageId;
      },
      getVersion: () => version,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    } as unknown as CatalogDocumentHeadSession;
    const emit = () => {
      version += 1;
      for (const listener of listeners) listener();
    };
    function Probe() {
      useCatalogDocumentHead(session);
      return null;
    }
    render(<Probe />);
    expect(document.title).toBe("Acme");
    expect(document.documentElement.lang).toBe("en");

    act(() => {
      pageId = "b";
      emit();
    });
    expect(document.title).toBe("Members");

    act(() => {
      entries.p = { ...(entries.p as object), site: { lang: "ko" } };
      pageId = "a";
      emit();
    });
    expect(document.title).toBe("composition Preview");
    expect(document.documentElement.lang).toBe("ko");
  });
});

describe("catalogWebManifest", () => {
  it("names the app (app name, else the title), opens the published address standalone", () => {
    const icons = [{ src: "data:image/png;base64,x", sizes: "192x192", type: "image/png" }];
    const startUrl = "https://acme.example/app/?project=https://cdn.example/site.json";
    expect(
      catalogWebManifest(
        { title: "Acme", lang: "ko", themeColor: "#123456", favicon: {}, robots: "index" },
        startUrl,
        icons,
      ),
    ).toEqual({
      id: startUrl,
      name: "Acme",
      short_name: "Acme",
      lang: "ko",
      start_url: startUrl,
      scope: "https://acme.example/app/",
      display: "standalone",
      theme_color: "#123456",
      background_color: "#123456",
      icons,
    });
    expect(
      catalogWebManifest(
        { title: "Acme", appName: "Acme App", favicon: {}, robots: "index" },
        startUrl,
        [],
      ).name,
    ).toBe("Acme App");
  });
});
