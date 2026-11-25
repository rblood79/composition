import { useLocale } from "react-aria-components/I18nProvider";

/** A strings table's entry for `locale`'s language (S2 intl — `strings` by language, English otherwise). */
export function catalogLocalized<T>(
  strings: Readonly<Record<string, T>>,
  locale: string,
): T {
  return strings[locale.split("-")[0] ?? "en"] ?? strings.en!;
}

/** `catalogLocalized` in the site's language (RAC `useLocale`). */
export function useCatalogLocalized<T>(
  strings: Readonly<Record<string, T>>,
): T {
  return catalogLocalized(strings, useLocale().locale);
}
