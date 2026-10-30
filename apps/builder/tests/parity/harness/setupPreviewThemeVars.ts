/**
 * ADR-293 — Preview · Publish 의 테마 색은 resolver snapshot 이 싣는다 (`preview-system.css` 는 계산하지
 * 않는다 — 폴백도 없다). CSS 만 싣는 chart browser 테스트 문서도 Preview 와 같은 텍스트
 * (`catalogThemeVarsCss`, 기본 테마) 를 싣는다. 글꼴 · `data-theme` 는 건드리지 않는다 — dark 블록은
 * `[data-theme="dark"]` 라 각 테스트가 정한 모드를 따른다.
 */
import { catalogThemeVarsCss } from "../../../../../packages/shared/src/catalog/runtime/themeVarsCss";
import { DEFAULT_BASE_TYPOGRAPHY } from "../../../../../packages/shared/src/catalog/runtime/fontDefaults";
import { resolveThemeSnapshot } from "../../../../../packages/shared/src/catalog/runtime/resolveThemeSnapshot";
import { createThemeDefinition } from "../../../../../packages/shared/src/theme/themesCollection";

const style = document.createElement("style");
style.id = "harness-theme-vars";
style.textContent = catalogThemeVarsCss(
  resolveThemeSnapshot(createThemeDefinition("harness", "Harness"), {
    baseTypographySeed: DEFAULT_BASE_TYPOGRAPHY,
  }),
);
document.head.append(style);
