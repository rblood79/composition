/**
 * Locale message loader — one chunk per language (사용자 결정 2026-10-29 「언어별로 분리」).
 *
 * The Builder imports only this module; each locale's messages come in its own dynamic chunk.
 * `main.tsx` loads the stored locale before the first render, and the provider switches language
 * only after the new locale has loaded — so a rendered tree always has its messages synchronously
 * (`getLocaleMessages`). Results and in-flight loads are cached per locale.
 */
import type { LocaleMessages } from "./messages/shared";
import type { SupportedLocale } from "./types";

const LOADERS: Record<
  SupportedLocale,
  () => Promise<{ default: LocaleMessages }>
> = {
  "ko-KR": () => import("./messages/ko-KR"),
  "en-US": () => import("./messages/en-US"),
};

export const SUPPORTED_LOCALES = Object.keys(LOADERS) as SupportedLocale[];

const loaded = new Map<SupportedLocale, LocaleMessages>();
const pending = new Map<SupportedLocale, Promise<LocaleMessages>>();

/** The locale's messages when already loaded (synchronous — no fetch). */
export function getLocaleMessages(
  locale: SupportedLocale,
): LocaleMessages | undefined {
  return loaded.get(locale);
}

/** Load (once) and cache the locale's messages. A failed load is not cached, so it can retry. */
export function loadLocaleMessages(
  locale: SupportedLocale,
): Promise<LocaleMessages> {
  const ready = loaded.get(locale);
  if (ready) return Promise.resolve(ready);
  let inflight = pending.get(locale);
  if (!inflight) {
    inflight = LOADERS[locale]()
      .then((module) => {
        loaded.set(locale, module.default);
        return module.default;
      })
      .finally(() => pending.delete(locale));
    pending.set(locale, inflight);
  }
  return inflight;
}

/** Every locale — for features that search across languages (the component list). */
export function loadAllLocaleMessages(): Promise<LocaleMessages[]> {
  return Promise.all(SUPPORTED_LOCALES.map(loadLocaleMessages));
}
