/**
 * ADR-296 Phase 6 · Decision 7 (사용자 결정 2 — ADR-286 Decision 8 reversed) — the site settings as
 * the files a reference app keeps them in: `index.html` (the document's language, title,
 * description, icons, app name, theme color, social image) and `site.config.ts` (search ·
 * redirects · access — a literal object, no secret). Both are the Site panel's `setSiteSettings`.
 */
import type {
  CatalogReader,
  CatalogSiteSettings,
  ProjectEntry,
} from "../../catalog/document/types";
import { CODE_VIEW_HELPERS_MODULE } from "../generate";
import type { CodeViewReader, CodeViewResult } from "../types";
import { CodeWriter } from "../writer";
import { codeViewPageNames } from "./names";

export const CODE_VIEW_HTML_PATH = "index.html";
export const CODE_VIEW_SITE_CONFIG_PATH = "site.config.ts";

type Reader = Pick<CatalogReader, "projectId" | "getEntry">;

const html = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/** The `index.html` lines each setting writes (in this order). */
export function codeViewHtmlHead(site: CatalogSiteSettings): string[] {
  const out: string[] = [];
  if (site.title !== undefined) out.push(`<title>${html(site.title)}</title>`);
  if (site.description !== undefined)
    out.push(`<meta name="description" content="${html(site.description)}" />`);
  if (site.favicon?.light)
    out.push(
      `<link rel="icon" href="${html(site.favicon.light)}" media="(prefers-color-scheme: light)" />`,
    );
  if (site.favicon?.dark)
    out.push(
      `<link rel="icon" href="${html(site.favicon.dark)}" media="(prefers-color-scheme: dark)" />`,
    );
  if (site.appIcon)
    out.push(`<link rel="apple-touch-icon" href="${html(site.appIcon)}" />`);
  if (site.appName !== undefined)
    out.push(
      `<meta name="application-name" content="${html(site.appName)}" />`,
    );
  if (site.themeColor !== undefined)
    out.push(`<meta name="theme-color" content="${html(site.themeColor)}" />`);
  if (site.socialImage)
    out.push(
      `<meta property="og:image" content="${html(site.socialImage)}" />`,
    );
  return out;
}

export function generateHtmlFile(input: {
  reader: CodeViewReader;
}): CodeViewResult {
  const reader = input.reader as unknown as Reader;
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  const site = project.site ?? {};
  const out = new CodeWriter();
  out.line("<!doctype html>");
  out.line(
    site.lang !== undefined ? `<html lang="${html(site.lang)}">` : "<html>",
  );
  out.in().line("<head>").in();
  out.line('<meta charset="utf-8" />');
  for (const line of codeViewHtmlHead(site)) out.line(line);
  out.out().line("</head>");
  out.line("<body>").in().line('<div id="root"></div>').out().line("</body>");
  out.out().line("</html>");
  return { ...out.done(), symbols: { variables: {}, fields: {} } };
}

/** `site.config.ts`'s object (search · redirects · access — protected pages by their names). */
export function codeViewSiteConfig(
  reader: Reader,
  site: CatalogSiteSettings,
): Record<string, unknown> {
  const names = codeViewPageNames(reader);
  const access =
    site.access?.kind === "sso" && site.access.protectedPageIds !== "all"
      ? {
          ...site.access,
          protectedPageIds: site.access.protectedPageIds.map(
            (id) => names.get(id) ?? id,
          ),
        }
      : site.access;
  return {
    ...(site.search ? { search: site.search } : {}),
    ...(site.redirects ? { redirects: site.redirects } : {}),
    ...(access ? { access } : {}),
  };
}

/** A JS literal of plain data, one property per line at the top level. */
function literalOf(value: unknown, depth = 0): string {
  const pad = (level: number) => "  ".repeat(level);
  if (Array.isArray(value))
    return value.length
      ? `[\n${value.map((item) => `${pad(depth + 1)}${literalOf(item, depth + 1)},`).join("\n")}\n${pad(depth)}]`
      : "[]";
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(
      ([, item]) => item !== undefined,
    );
    if (!entries.length) return "{}";
    if (depth >= 1)
      return `{${entries
        .map(([key, item]) => `${key}: ${literalOf(item, depth + 1)}`)
        .join(", ")}}`;
    return `{\n${entries
      .map(
        ([key, item]) =>
          `${pad(depth + 1)}${key}: ${literalOf(item, depth + 1)},`,
      )
      .join("\n")}\n${pad(depth)}}`;
  }
  if (typeof value === "string")
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  return String(value);
}

export function generateSiteConfigFile(input: {
  reader: CodeViewReader;
}): CodeViewResult {
  const reader = input.reader as unknown as Reader;
  const project = reader.getEntry(reader.projectId) as ProjectEntry;
  const out = new CodeWriter();
  out.line(`import {siteConfig} from '${CODE_VIEW_HELPERS_MODULE}';`);
  out.line();
  out.line(
    `export default siteConfig(${literalOf(codeViewSiteConfig(reader, project.site ?? {}))});`,
  );
  return { ...out.done(), symbols: { variables: {}, fields: {} } };
}
