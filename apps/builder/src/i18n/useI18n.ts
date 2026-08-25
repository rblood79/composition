/**
 * useI18n Hook
 *
 * Custom hook to access I18n context
 */

import { useContext } from "react";
import { I18nContext } from "./I18nProvider";
import type { I18nContextValue } from "./types";

/**
 * Use I18n context
 *
 * Provides access to locale, translations, and formatting functions
 *
 * @throws Error if used outside I18nProvider
 * @returns I18n context value
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { t, locale, setLocale, formatDate, formatCurrency } = useI18n();
 *
 *   return (
 *     <div>
 *       <p>{t('common.save')}</p>
 *       <p>{formatCurrency(1000)}</p>
 *       <p>Current locale: {locale}</p>
 *       <button onClick={() => setLocale('en-US')}>Switch to English</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }

  return context;
}

/**
 * Read the I18n context when a component also supports isolated unit renders.
 */
export function useOptionalI18n(): I18nContextValue | null {
  return useContext(I18nContext);
}
