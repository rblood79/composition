/**
 * Translate a display label while preserving catalog-provided fallbacks.
 */
export function translateDisplayLabel(
  t: (key: string) => string,
  label: string,
): string {
  const key = `labels.${label}`;
  const translated = t(key);
  return translated === key ? label : translated;
}

export function translateKey(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
): string {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}
