---
title: "Catalog ↔ Layout Engine ↔ CSS 값 동기화"
impact: CRITICAL
impactDescription: 소스 간 수치 불일치 시 Skia/CSS 렌더링 차이 (오발 줄바꿈, 높이/폭 발산)
tags: [spec, catalog, layout, sync]
---

컴포넌트 수치(padding, fontSize, lineHeight, borderWidth 등)의 **정본은 catalog rule sizes** (`COMPONENT_RULES_TABLE[type].sizes`)입니다. 3개 소비 경로가 같은 값을 읽어야 합니다:

1. **Skia shapes** — `buildCatalogShapes(visual, props, size, ...)` 의 `size`(SizeSpec)
2. **Layout engine 내부 상수** — `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` 의 `BUTTON_SIZE_CONFIG` 등 (catalog 에서 **자동 파생**)
3. **Generated CSS** — `packages/specs/scripts/generate-css.ts` → `packages/shared/src/components/styles/generated/*.css`

과거 "3곳 수동 동일 유지" 체계는 catalog 파생 체계로 대체됐습니다 — **catalog rule 1곳 편집 + 파생 경로 재생성/확인** 이 현행 규칙입니다.

## Incorrect

```typescript
// ❌ layout engine 에 catalog 와 무관한 하드코딩 size map 신설 — 정본 fork
const MY_COMPONENT_SIZES = { md: { paddingX: 16 } }; // catalog rule 무시

// ❌ rule 무시 ad-hoc fallback — catalog 값과 발산
const gap = props.gap ?? 4; // TagList lg=6 인데 4 로 렌더된 실사례 (resolveTagListGap 로 수정됨)
```

## Correct

```typescript
// ✅ catalog rule 에서 파생 — engines/utils.ts:900
const BUTTON_SIZE_CONFIG = deriveSizeConfig(ruleSizesToSizeSpecMap("Button"));
// ruleSizesToSizeSpecMap (utils.ts:653): resolveSkiaRule(type) → rule.sizes → SizeSpec 변환
// deriveSizeConfig (utils.ts:619): TokenRef fontSize/lineHeight → resolveToken 으로 number 해소

// ✅ ADR-907 Layer D — 배치 코드와 높이 계산이 동일 resolver 심볼 공유
export function resolveTagListGap(sizeName: string): number {
  const tagListRule = resolveSkiaRule("TagList"); // catalog rule 이 gap 정본
  ...
}
```

## 동기화 대상 값 (Button 기준)

| 값                | catalog 정본                            | Layout engine 파생                                        | CSS                                  |
| ----------------- | --------------------------------------- | --------------------------------------------------------- | ------------------------------------ |
| paddingX/paddingY | `COMPONENT_RULES_TABLE.Button.sizes[s]` | `BUTTON_SIZE_CONFIG[s].paddingLeft/Right/paddingY` (파생) | generated Button CSS `[data-size]`   |
| fontSize          | `sizes[s].fontSize` (TokenRef)          | `BUTTON_SIZE_CONFIG[s].fontSize` (resolveToken 해소)      | `var(--text-*)`                      |
| lineHeight        | `sizes[s].lineHeight` (TokenRef)        | `BUTTON_SIZE_CONFIG[s].lineHeight` (resolveToken 해소)    | `var(--text-*--line-height)`         |
| borderWidth       | `sizes[s].borderWidth`                  | `BUTTON_SIZE_CONFIG[s].borderWidth`                       | border 선언                          |
| variant 색상      | `variants[v].fill` + `colors`           | (layout 무관)                                             | generate-css 가 rule 테이블에서 주입 |

`sizes[s].height: 0` 은 **sentinel** — 명시 높이 없음(콘텐츠 파생 높이) 의미입니다. 유효 높이 값으로 취급 금지.

## Button/ToggleButton 사이즈 레퍼런스

CSS height = lineHeight + paddingY × 2 + borderWidth × 2 (명시적 height 없음). catalog `Button.sizes` + `packages/specs/src/primitives/typography.ts` 의 line-height 토큰 기준:

| Size | fontSize 토큰               | lineHeight (px) | paddingY | borderWidth | **CSS height** |
| ---- | --------------------------- | --------------- | -------- | ----------- | -------------- |
| xs   | `{typography.text-2xs}` =10 | 16              | 1        | 1           | **20px**       |
| sm   | `{typography.text-xs}` =12  | 16              | 2        | 1           | **22px**       |
| md   | `{typography.text-sm}` =14  | 20              | 4        | 1           | **30px**       |
| lg   | `{typography.text-base}`=16 | 24              | 8        | 1           | **42px**       |
| xl   | `{typography.text-lg}` =18  | 28              | 12       | 1           | **54px**       |

### BUTTON_SIZE_CONFIG lineHeight 필수 규칙

`BUTTON_SIZE_CONFIG` / `TOGGLEBUTTON_SIZE_CONFIG`(utils.ts:900/915)에는 `lineHeight` 필드가 필수입니다. CSS Button 은 명시적 `line-height: var(--text-*--line-height)` 를 사용하므로, Skia 측 `estimateTextHeight()`(utils.ts:2013)에 이 값을 전달하지 않으면 font metrics 기반 `line-height: normal`(~1.2x)로 계산되어 CSS 와 높이가 불일치합니다.

```typescript
// calculateContentHeight() 내부 (utils.ts:2397-2399)
const configLineHeight = (sizeConfig as { lineHeight?: number }).lineHeight;
const effectiveLineHeight = resolvedLineHeight ?? configLineHeight;
const textHeight = estimateTextHeight(fontSize, effectiveLineHeight);
```

단일 진입점: `getButtonSizeConfig(tag, size)` (utils.ts:1043) — button/submitbutton/fancybutton → `BUTTON_SIZE_CONFIG`, togglebutton → `TOGGLEBUTTON_SIZE_CONFIG`.

## 체크리스트 — 수치 수정 시

- [ ] `packages/shared/src/catalog/generated/componentRulesTable.ts` 의 해당 rule sizes/variants 편집 (정본 1곳)
- [ ] variant 색상 변경 시 generated CSS 재생성: `pnpm --filter @composition/specs build` (generate:css 포함) → [spec-build-sync](spec-build-sync.md)
- [ ] layout engine 파생 경로 확인 — 해당 type 이 `deriveSizeConfig`/`resolveSkiaRule` 파생인지, ad-hoc 하드코딩이 남아있지 않은지 grep
- [ ] Skia ↔ CSS 시각 결과 확인 — `/cross-check`
- [ ] ADR-907 Layer D: 배치 코드와 `calculateContentHeight()` 분기가 동일 resolver 심볼을 호출하는지 확인

## 삭제된 심볼 — 참조 금지 (grep 확증 2026-07-07, 0건)

`UI_COMPONENT_DEFAULT_BORDER_RADIUS` / `INLINE_FORM_HEIGHTS` / `INLINE_FORM_INDICATOR_WIDTHS` / `ElementSprite.tsx` / `Pixi*.tsx` — 과거 문서의 해당 체크리스트 행은 무효.

## 참조

- `packages/shared/src/catalog/generated/componentRulesTable.ts` — 수치/색상 정본
- `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts` — deriveSizeConfig(:619) / ruleSizesToSizeSpecMap(:653) / BUTTON_SIZE_CONFIG(:900) / getButtonSizeConfig(:1043) / estimateTextHeight(:2013)
- `packages/specs/src/primitives/typography.ts` — fontSize/line-height 토큰 값
- [spec-build-sync](spec-build-sync.md) — 빌드/재생성 동기화
- `.claude/rules/canvas-rendering.md` §2.6 — Container style pipeline (ADR-907 Layer A~D)
