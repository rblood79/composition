/**
 * ADR-286 Decision 8 — the Preview and the published page write the site's `<head>` from the
 * document: the shown page's title (else the site's) · description · favicon (light · dark) and
 * the site language on `<html lang>`. What each page holds is `siteHead` (`siteMeta.ts`); this
 * module only puts it on a `Document` — with the installed app's icon (`apple-touch-icon`), theme
 * color and, on an installable published page, a Web App Manifest. Unset values fall back to what the page had before (the
 * `index.html` title, the visitor's locale) — a site with no settings looks as it did.
 */
import { useLocale } from "@react-aria/i18n";
import { useEffect, useState } from "react";
import { resolveAssetUrl, subscribeAssetUrls } from "../../utils/assetRef";
import type { EntryId } from "../document/types";
import { siteHead, type CatalogPageHead } from "./siteMeta";

/** One manifest icon (a PNG made from the site's app icon). */
export interface CatalogManifestIcon {
  src: string;
  sizes: string;
  type: string;
}

/** The sizes Chrome's install wants (192 for the shortcut, 512 for the splash · store). */
const MANIFEST_ICON_SIZES = [192, 512] as const;

/** What the hook reads from a Preview · publish session (`CatalogPreviewSession`). */
export interface CatalogDocumentHeadSession {
  readonly graph?: {
    projectId: EntryId<"project">;
    getEntry(id: string): unknown;
  };
  readonly pageId?: EntryId<"page">;
  getVersion(): number;
  subscribe(listener: () => void): () => void;
}

export interface CatalogDocumentHeadFallback {
  title: string;
  lang: string;
  dir: "ltr" | "rtl";
}

const OWNED = "data-catalog-head";
const parkedIcons = new WeakMap<Document, HTMLLinkElement[]>();

function directionOf(lang: string): "ltr" | "rtl" {
  try {
    const locale = new Intl.Locale(lang) as Intl.Locale & {
      getTextInfo?: () => { direction?: string };
      textInfo?: { direction?: string };
    };
    const info = locale.getTextInfo?.() ?? locale.textInfo;
    if (info?.direction) return info.direction === "rtl" ? "rtl" : "ltr";
    // Engines without text info: the scripts RAC's `isRTL` lists.
    const script = locale.maximize().script ?? "";
    return /^(Arab|Hebr|Thaa|Syrc|Nkoo|Adlm|Rohg|Mand|Samr)$/.test(script)
      ? "rtl"
      : "ltr";
  } catch {
    return "ltr";
  }
}

/** One `<meta name>` · `<link rel>` this module owns: written while `value` is set, else removed. */
function ownedElement(
  doc: Document,
  tag: "meta" | "link",
  key: "name" | "rel",
  name: string,
  value: string | undefined,
): void {
  const valueKey = tag === "meta" ? "content" : "href";
  let element = doc.head.querySelector(`${tag}[${key}="${name}"][${OWNED}]`);
  if (!value) return element?.remove();
  if (!element) {
    element = doc.createElement(tag);
    element.setAttribute(key, name);
    element.setAttribute(OWNED, "");
    doc.head.appendChild(element);
  }
  if (element.getAttribute(valueKey) !== value)
    element.setAttribute(valueKey, value);
}

/** Puts `head` on `doc` (an unset `head` or value restores `fallback` and drops what it wrote). */
export function applyCatalogDocumentHead(
  doc: Document,
  head: CatalogPageHead | undefined,
  fallback: CatalogDocumentHeadFallback,
  resolve: (url: string) => string | null,
): void {
  const title = head?.title || fallback.title;
  if (doc.title !== title) doc.title = title;
  const root = doc.documentElement;
  const lang = head?.lang || fallback.lang;
  const dir = head?.lang ? directionOf(head.lang) : fallback.dir;
  if (root.lang !== lang) root.lang = lang;
  if (root.dir !== dir) root.dir = dir;

  ownedElement(doc, "meta", "name", "description", head?.description);
  ownedElement(doc, "meta", "name", "theme-color", head?.themeColor);
  ownedElement(
    doc,
    "link",
    "rel",
    "apple-touch-icon",
    (head?.appIcon && resolve(head.appIcon)) || undefined,
  );

  // Two icons answer the browser's color scheme; one icon serves both.
  const light = head?.favicon.light && resolve(head.favicon.light);
  const dark = head?.favicon.dark && resolve(head.favicon.dark);
  const icons: Array<[string, string]> =
    light && dark
      ? [
          [light, "(prefers-color-scheme: light)"],
          [dark, "(prefers-color-scheme: dark)"],
        ]
      : light || dark
        ? [[(light || dark) as string, ""]]
        : [];
  const current = [
    ...doc.head.querySelectorAll<HTMLLinkElement>(`link[rel="icon"][${OWNED}]`),
  ];
  const same =
    current.length === icons.length &&
    current.every(
      (link, index) =>
        link.getAttribute("href") === icons[index][0] &&
        link.media === icons[index][1],
    );
  if (same) return;
  for (const link of current) link.remove();
  // The page's own icons (the Builder's app icon on `/publish`) step aside while the site has
  // one — the browser would pick either — and come back when it has none.
  const parked = parkedIcons.get(doc) ?? [];
  if (icons.length) {
    for (const link of doc.head.querySelectorAll<HTMLLinkElement>(
      `link[rel~="icon"]:not([${OWNED}])`,
    )) {
      parked.push(link);
      link.remove();
    }
    parkedIcons.set(doc, parked);
  } else {
    for (const link of parked) doc.head.appendChild(link);
    parkedIcons.delete(doc);
  }
  for (const [href, media] of icons) {
    const link = doc.createElement("link");
    link.rel = "icon";
    link.href = href;
    if (media) link.media = media;
    link.setAttribute(OWNED, "");
    doc.head.appendChild(link);
  }
}

/**
 * The Web App Manifest of an installable published site (Chrome · Edge · Android install):
 * name (the app name, else the site · page title), the app icon PNGs, `standalone` window and
 * the theme color. `startUrl` is the published page's own address — the app opens there.
 */
export function catalogWebManifest(
  head: CatalogPageHead,
  startUrl: string,
  icons: readonly CatalogManifestIcon[],
): Record<string, unknown> {
  const name = head.appName || head.title || "";
  return {
    id: startUrl,
    name,
    short_name: name,
    ...(head.lang ? { lang: head.lang } : {}),
    start_url: startUrl,
    scope: new URL(".", startUrl).href,
    display: "standalone",
    ...(head.themeColor
      ? { theme_color: head.themeColor, background_color: head.themeColor }
      : {}),
    icons,
  };
}

/** The app icon drawn into each manifest size (fit, centered, transparent margin) as PNG. */
async function manifestIcons(src: string): Promise<CatalogManifestIcon[]> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return MANIFEST_ICON_SIZES.map((size) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const width = image.naturalWidth || size;
    const height = image.naturalHeight || size;
    const scale = Math.min(size / width, size / height);
    canvas
      .getContext("2d")
      ?.drawImage(
        image,
        (size - width * scale) / 2,
        (size - height * scale) / 2,
        width * scale,
        height * scale,
      );
    // data: — the browser keeps the installed app's icons after this page (and its blob: URLs) is gone.
    return {
      src: canvas.toDataURL("image/png"),
      sizes: `${size}x${size}`,
      type: "image/png",
    };
  });
}

/**
 * `<link rel="manifest">` while the site has an app icon — rebuilt when what it holds changes.
 * `dispose` drops the link and its blob.
 */
function manifestWriter(doc: Document, startUrl: string) {
  let key: string | undefined;
  let url: string | undefined;
  let generation = 0;
  const drop = () => {
    doc.head.querySelector(`link[rel="manifest"][${OWNED}]`)?.remove();
    if (url) URL.revokeObjectURL(url);
    url = undefined;
  };
  return {
    write(head: CatalogPageHead | undefined, resolve: (url: string) => string | null) {
      const icon = head?.appIcon && resolve(head.appIcon);
      const next =
        head && icon
          ? JSON.stringify([icon, head.appName, head.title, head.lang, head.themeColor])
          : undefined;
      if (next === key) return;
      key = next;
      const own = ++generation;
      if (!head || !icon) return drop();
      void manifestIcons(icon).then(
        (icons) => {
          if (own !== generation) return;
          drop();
          url = URL.createObjectURL(
            new Blob([JSON.stringify(catalogWebManifest(head, startUrl, icons))], {
              type: "application/manifest+json",
            }),
          );
          ownedElement(doc, "link", "rel", "manifest", url);
        },
        (error: unknown) => {
          console.warn("[site] app icon could not be drawn for the manifest", error);
        },
      );
    },
    dispose() {
      generation += 1;
      key = undefined;
      drop();
    },
  };
}

/**
 * Keeps `document`'s head on the session's shown page — again when the document or the page
 * changes and when a favicon's bytes become ready. Owns `<html lang · dir>`: with no site
 * language they are the visitor's locale (RAC's), as before.
 */
export function useCatalogDocumentHead(
  session: CatalogDocumentHeadSession | undefined,
  options: {
    /** The published page's address when it is installable (a manifest names it as `start_url`). */
    manifestStartUrl?: string;
  } = {},
): void {
  const { manifestStartUrl } = options;
  const { locale, direction } = useLocale();
  const [title] = useState(() => document.title);
  useEffect(() => {
    const fallback = { title, lang: locale, dir: direction };
    const manifest = manifestStartUrl
      ? manifestWriter(document, manifestStartUrl)
      : undefined;
    const apply = () => {
      const graph = session?.graph;
      const pageId = session?.pageId;
      const head = graph && pageId ? siteHead(graph, pageId) : undefined;
      applyCatalogDocumentHead(document, head, fallback, resolveAssetUrl);
      manifest?.write(head, resolveAssetUrl);
    };
    apply();
    const unsubscribeSession = session?.subscribe(apply);
    const unsubscribeAssets = subscribeAssetUrls(apply);
    return () => {
      unsubscribeSession?.();
      unsubscribeAssets();
      manifest?.dispose();
    };
  }, [session, title, locale, direction, manifestStartUrl]);
}
