import { S2_TOUCH_MEDIA } from "@composition/rendering";
import type { ResolvedThemeSnapshot } from "./resolveThemeSnapshot";

/**
 * Preview 「터치」 보기 (ADR-295 사용자 결정 4 — 별도 토글): 이 속성이 있는 root 는 기기와 무관하게 터치 벌을
 * 쓴다. 미디어 블록과 같은 값을 더 높은 특이도로 싣는다.
 */
export const CATALOG_TOUCH_VIEW_ATTRIBUTE = "data-catalog-touch";

/** Builder → Preview: `{ type, touch: boolean }` — Compare Mode 의 「터치 크기로 미리보기」 토글. */
export const CATALOG_TOUCH_VIEW_MESSAGE = "CATALOG_TOUCH_VIEW";

/**
 * The theme's CSS variables as one style text (light + dark blocks). Theme colors (ADR-293 — the whole
 * Canvas color map) go inside `@media not (forced-colors: active)`: this text has no layer, so outside the
 * media it would beat the system colors `preview-system.css` declares for forced colors.
 *
 * The touch set (ADR-295 Decision 2) goes last — under S2's device condition and under the Preview's touch
 * view attribute — so it beats both the `:root` and the `[data-theme="dark"]` block.
 */
export function catalogThemeVarsCss(snapshot: ResolvedThemeSnapshot): string {
  const lines = (vars: readonly { name: string; value: string }[]) =>
    vars.map((cssVar) => `  ${cssVar.name}: ${cssVar.value};`).join("\n");
  const block = (selector: string, dark: boolean, color: boolean) =>
    `${selector} {\n${lines(
      snapshot.cssVars.filter(
        (cssVar) => cssVar.isDark === dark && cssVar.color === color,
      ),
    )}\n}\n`;
  const touch = lines(snapshot.touchCssVars);
  return (
    block(":root", false, false) +
    block('[data-theme="dark"]', true, false) +
    `@media not (forced-colors: active) {\n${block(":root", false, true)}${block('[data-theme="dark"]', true, true)}}\n` +
    catalogTouchVarsCss(touch)
  );
}

/** The touch set's two blocks (S2 device media · Preview touch view) for the given declarations. */
export function catalogTouchVarsCss(declarations: string): string {
  if (declarations === "") return "";
  return (
    `@media ${S2_TOUCH_MEDIA} {\n:root {\n${declarations}\n}\n}\n` +
    `:root[${CATALOG_TOUCH_VIEW_ATTRIBUTE}] {\n${declarations}\n}\n`
  );
}
