import type { CatalogReader } from "./types";

/**
 * The site's language (`ProjectEntry.site.lang`) — none set: the environment's (`navigator.language`,
 * what RAC and the Canvas read then — `CatalogCompositionRoot.environmentLocale`), else `"en"`.
 */
export function catalogSiteLanguage(
  reader: Pick<CatalogReader, "projectId" | "getEntry">,
): string {
  const project = reader.getEntry(reader.projectId);
  return (
    (project?.kind === "project" && project.site?.lang) ||
    (typeof navigator !== "undefined" && navigator.language) ||
    "en"
  );
}

/**
 * A template node's props in `language` (a library origin's `localizedProps` — its literal texts
 * in the site's language; English and any language without a text keep `props`).
 */
export function catalogTemplateProps<
  P extends Readonly<Record<string, unknown>>,
>(
  template: { readonly props: P; readonly localizedProps?: unknown },
  language: string,
): P {
  const localized = template.localizedProps as
    Readonly<Record<string, Readonly<Record<string, string>>>> | undefined;
  if (!localized) return template.props;
  const lang = language.split("-")[0] ?? "en";
  let props: Record<string, unknown> | undefined;
  for (const [key, texts] of Object.entries(localized)) {
    const text = texts[lang];
    if (text === undefined || !(key in template.props)) continue;
    props ??= { ...template.props };
    props[key] = text;
  }
  return (props as P | undefined) ?? template.props;
}
