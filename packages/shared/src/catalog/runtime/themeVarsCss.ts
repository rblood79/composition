import type { ResolvedThemeSnapshot } from "./resolveThemeSnapshot";

/**
 * The theme's CSS variables as one style text (light + dark blocks). Theme colors (ADR-293 — the whole
 * Canvas color map) go inside `@media not (forced-colors: active)`: this text has no layer, so outside the
 * media it would beat the system colors `preview-system.css` declares for forced colors.
 */
export function catalogThemeVarsCss(snapshot: ResolvedThemeSnapshot): string {
  const block = (selector: string, dark: boolean, color: boolean) =>
    `${selector} {\n${snapshot.cssVars
      .filter((cssVar) => cssVar.isDark === dark && cssVar.color === color)
      .map((cssVar) => `  ${cssVar.name}: ${cssVar.value};`)
      .join("\n")}\n}\n`;
  return (
    block(":root", false, false) +
    block('[data-theme="dark"]', true, false) +
    `@media not (forced-colors: active) {\n${block(":root", false, true)}${block('[data-theme="dark"]', true, true)}}\n`
  );
}
