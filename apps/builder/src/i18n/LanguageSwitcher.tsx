/**
 * Language Switcher Component
 *
 * Allows users to switch between supported locales
 */

import { useMemo } from "react";
import { Globe } from "lucide-react";
import { PropertySelect } from "../builder/components/property/PropertySelect";
import { useI18n } from "./useI18n";
import { localeConfigs } from "./locales";
import type { SupportedLocale } from "./types";

export interface LanguageSwitcherProps {
  /**
   * Display label for the select
   * @default "Language"
   */
  label?: string;
  /**
   * Show globe icon
   * @default true
   */
  showIcon?: boolean;
  /**
   * Additional className
   */
  className?: string;
}

/**
 * Language Switcher Component
 *
 * Renders a select dropdown for switching languages
 *
 * @example
 * ```tsx
 * <LanguageSwitcher label="언어" />
 * ```
 */
export function LanguageSwitcher({
  label,
  showIcon = true,
  className,
}: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useI18n();

  const options = useMemo(
    () =>
      Object.values(localeConfigs).map((config) => ({
        value: config.locale,
        label: config.name,
      })),
    [],
  );

  const handleSelectionChange = (value: string) => {
    if (value in localeConfigs) {
      setLocale(value as SupportedLocale);
    }
  };

  const effectiveLabel = label || t("settings.language");

  return (
    <PropertySelect
      label={effectiveLabel}
      value={locale}
      onChange={handleSelectionChange}
      options={options}
      icon={showIcon ? Globe : undefined}
      className={className}
    />
  );
}
