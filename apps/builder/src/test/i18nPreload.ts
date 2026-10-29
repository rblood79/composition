import { loadAllLocaleMessages } from "../i18n/loadMessages";

/**
 * The Builder loads one locale chunk before its first render (`main.tsx`). Unit tests render
 * `I18nProvider` directly, so both locales are loaded once here — the provider then reads them
 * synchronously (no Suspense), as the app does.
 */
await loadAllLocaleMessages();
