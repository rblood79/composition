/**
 * ADR-296 Phase 6 — the site files read back: `index.html` and `site.config.ts` → the Site panel's
 * `setSiteSettings` (only the settings that changed). A line or key outside the closed shape is
 * refused; the regenerated file must mean what was written (compared setting by setting).
 */
import {
  setSiteSettings,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands";
import type {
  CatalogSiteSettings,
  ProjectEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import { codeViewPageNames } from "../../../../../packages/shared/src/codeView/files/names";
import {
  generateHtmlFile,
  generateSiteConfigFile,
} from "../../../../../packages/shared/src/codeView/files/site";
import { structuredLiteralOf } from "../../../../../packages/shared/src/codeView/inverse";
import type { Reject } from "./codeViewEdit";

const unescape = (text: string) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

type HtmlSettings = Pick<
  CatalogSiteSettings,
  | "lang"
  | "title"
  | "description"
  | "favicon"
  | "appIcon"
  | "appName"
  | "themeColor"
  | "socialImage"
>;
const HTML_KEYS = [
  "lang",
  "title",
  "description",
  "favicon",
  "appIcon",
  "appName",
  "themeColor",
  "socialImage",
] as const;

/** `index.html`'s settings (undefined + a refusal for a line outside its shape). */
function htmlSettings(text: string, reject: Reject): HtmlSettings | undefined {
  const out: Record<string, unknown> = {};
  const favicon: { light?: string; dark?: string } = {};
  let ok = true;
  let offset = 0;
  const fixed = new Set([
    "<!doctype html>",
    "<head>",
    '<meta charset="utf-8" />',
    "</head>",
    "<body>",
    '<div id="root"></div>',
    "</body>",
    "</html>",
  ]);
  for (const raw of text.split("\n")) {
    const at = offset;
    offset += raw.length + 1;
    const line = raw.trim();
    if (!line || fixed.has(line)) continue;
    const attr = (name: string) =>
      new RegExp(`${name}="([^"]*)"`).exec(line)?.[1];
    let match: RegExpExecArray | null;
    if (line === "<html>") continue;
    if ((match = /^<html lang="([^"]*)">$/.exec(line)))
      out.lang = unescape(match[1]!);
    else if ((match = /^<title>([\s\S]*)<\/title>$/.exec(line)))
      out.title = unescape(match[1]!);
    else if (/^<meta name="description" content="[^"]*" \/>$/.test(line))
      out.description = unescape(attr("content")!);
    else if (
      /^<link rel="icon" href="[^"]*" media="\(prefers-color-scheme: (light|dark)\)" \/>$/.test(
        line,
      )
    )
      favicon[/dark\)/.test(line) ? "dark" : "light"] = unescape(attr("href")!);
    else if (/^<link rel="apple-touch-icon" href="[^"]*" \/>$/.test(line))
      out.appIcon = unescape(attr("href")!);
    else if (/^<meta name="application-name" content="[^"]*" \/>$/.test(line))
      out.appName = unescape(attr("content")!);
    else if (/^<meta name="theme-color" content="[^"]*" \/>$/.test(line))
      out.themeColor = unescape(attr("content")!);
    else if (/^<meta property="og:image" content="[^"]*" \/>$/.test(line))
      out.socialImage = unescape(attr("content")!);
    else {
      reject(at, "outsideVocabulary", line);
      ok = false;
    }
  }
  if (favicon.light || favicon.dark) out.favicon = favicon;
  return ok ? (out as HtmlSettings) : undefined;
}

/** Equal values whatever their keys' order (an author writes `{sitemap, index}` too). */
const stable = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(stable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([, item]) => item !== undefined)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, stable(item)]),
        )
      : value;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(stable(a) ?? null) === JSON.stringify(stable(b) ?? null);

export function planCodeViewHtml(input: {
  reader: CatalogReader;
  edited: string;
  reject: Reject;
}): CatalogCommand[] {
  const settings = htmlSettings(input.edited, input.reject);
  if (!settings) return [];
  const site =
    (input.reader.getEntry(input.reader.projectId) as ProjectEntry).site ?? {};
  const patch: Record<string, unknown> = {};
  for (const key of HTML_KEYS)
    if (!same(settings[key], site[key])) patch[key] = settings[key];
  return Object.keys(patch).length
    ? [setSiteSettings({ patch: patch as never, label: "Code" })]
    : [];
}

export function compareHtmlFile(
  final: CatalogReader,
  edited: string,
  reject: Reject,
): void {
  const mine = htmlSettings(edited, () => undefined);
  const theirs = htmlSettings(
    generateHtmlFile({ reader: final as never }).code,
    () => undefined,
  );
  if (mine && theirs && !same(mine, theirs))
    reject(0, "notInCode", "index.html");
}

/** `site.config.ts`'s object (undefined + a refusal outside `export default siteConfig({…});`). */
function siteConfigOf(
  reader: CatalogReader,
  text: string,
  reject: Reject,
): Partial<CatalogSiteSettings> | undefined {
  const body = text
    .replace(/^\s*import \{siteConfig\} from '@composition\/code';\s*/, "")
    .trim();
  const match = /^export default siteConfig\(([\s\S]*)\);?$/.exec(body);
  const value = match
    ? structuredLiteralOf(match[1]!.trim())?.value
    : undefined;
  if (!match || !value || typeof value !== "object" || Array.isArray(value)) {
    reject(0, "outsideVocabulary", "site.config.ts");
    return undefined;
  }
  const config = value as Record<string, unknown>;
  for (const key of Object.keys(config))
    if (!["search", "redirects", "access"].includes(key)) {
      reject(0, "outsideVocabulary", key);
      return undefined;
    }
  // (Protected pages by their names → the pages.)
  const access = config.access as CatalogSiteSettings["access"] | undefined;
  if (access?.kind === "sso" && Array.isArray(access.protectedPageIds)) {
    const ids = new Map(
      [...codeViewPageNames(reader)].map(([id, name]) => [name, id]),
    );
    const pages = (access.protectedPageIds as readonly string[]).map(
      (name) => ids.get(name) ?? name,
    );
    config.access = { ...access, protectedPageIds: pages as never };
  }
  return config as Partial<CatalogSiteSettings>;
}

export function planCodeViewSiteConfig(input: {
  reader: CatalogReader;
  edited: string;
  reject: Reject;
}): CatalogCommand[] {
  const config = siteConfigOf(input.reader, input.edited, input.reject);
  if (!config) return [];
  const site =
    (input.reader.getEntry(input.reader.projectId) as ProjectEntry).site ?? {};
  const patch: Record<string, unknown> = {};
  for (const key of ["search", "redirects", "access"] as const)
    if (!same(config[key], site[key])) patch[key] = config[key];
  return Object.keys(patch).length
    ? [setSiteSettings({ patch: patch as never, label: "Code" })]
    : [];
}

export function compareSiteConfigFile(
  final: CatalogReader,
  edited: string,
  reject: Reject,
): void {
  const mine = siteConfigOf(final, edited, () => undefined);
  const theirs = siteConfigOf(
    final,
    generateSiteConfigFile({ reader: final as never }).code,
    () => undefined,
  );
  if (mine && theirs && !same(mine, theirs))
    reject(0, "notInCode", "site.config.ts");
}
