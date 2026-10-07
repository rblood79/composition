import { useEffect, type ReactNode } from "react";
import { useLocale } from "@react-aria/i18n";

/**
 * The Preview's document language: the browser's locale, as the published page has it (publish
 * wraps no `I18nProvider` — RAC reads `navigator.language` and follows `languagechange`) and as
 * the Canvas root measures (`locale: navigator.language`). A date field without its own `locale`
 * so formats alike in the Canvas, the Preview and the published page. The Builder UI's language
 * setting is the Builder's chrome, not the document's (2026-10-07 — the Preview took it and drew
 * date segments in en-US beside a ko-KR Canvas).
 */
export function PreviewLocale({ children }: { children: ReactNode }) {
  // (No provider above: RAC's default locale.)
  const { locale, direction } = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  return children;
}
