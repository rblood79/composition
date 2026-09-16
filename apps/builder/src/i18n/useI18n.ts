/**
 * useI18n Hook
 *
 * Custom hook to access I18n context
 */

import { useCallback, useContext } from "react";
import { I18nContext } from "./I18nProvider";
import { semanticLabelKeys, translateKey } from "./labels";
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

/**
 * 의미 라벨 (「Fill」 · 「Border Width」 …) 번역 — `semanticLabelKeys` 표의 키로 번역하고, 표에
 * 없거나 번역이 없으면 라벨 그대로. Provider 밖 (격리 unit 렌더) 이면 항상 원문.
 */
export function localizeSemanticLabel(
  i18n: Pick<I18nContextValue, "t"> | null,
  label: string,
): string {
  return i18n
    ? translateKey(i18n.t, semanticLabelKeys[label] ?? label, label)
    : label;
}

/**
 * `localizeSemanticLabel` 의 훅 형태 — 패널 절·행 컴포넌트가 legend 를 번역하는 한 함수.
 * `t` 가 같으면 같은 함수 (memo 자식에 prop 으로 넘겨도 안정).
 */
export function useSemanticLabel(): (label: string) => string {
  const i18n = useOptionalI18n();
  const t = i18n?.t;
  return useCallback(
    (label: string) => localizeSemanticLabel(t ? { t } : null, label),
    [t],
  );
}
