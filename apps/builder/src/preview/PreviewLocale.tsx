import { useEffect, useState, type ReactNode } from "react";
import { I18nProvider as AriaI18nProvider } from "@react-aria/i18n";
import { getLocaleConfig, getStoredLocale, LOCALE_STORAGE_KEY } from "../i18n";

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
