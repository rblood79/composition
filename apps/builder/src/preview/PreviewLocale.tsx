import { useEffect, useState, type ReactNode } from "react";
import { I18nProvider as AriaI18nProvider } from "@react-aria/i18n";
// `../i18n` barrel 이 아니라 `locales` 직접 — barrel 은 translations(302 KB)·labels 를 끌고 와 Preview initial
// 을 키운다 (2026-09-16 ADR-202 승격 판정: Properties i18n 키가 Preview 공유 locale 청크로 +5.6 KB gzip).
// Preview 는 t() 를 한 번도 쓰지 않는다 — 가드 previewI18nImport.static.test.
import {
  getLocaleConfig,
  getStoredLocale,
  LOCALE_STORAGE_KEY,
} from "../i18n/locales";

export function PreviewLocale({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState(getStoredLocale);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOCALE_STORAGE_KEY) setLocale(getStoredLocale());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getLocaleConfig(locale).direction;
  }, [locale]);

  return <AriaI18nProvider locale={locale}>{children}</AriaI18nProvider>;
}
