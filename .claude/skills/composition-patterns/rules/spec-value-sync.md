---
title: "Catalog ↔ Canvas ↔ CSS 값 동기화"
impact: CRITICAL
impactDescription: 소스 간 수치 불일치 시 Skia/CSS 렌더링 차이 (오발 줄바꿈, 높이/폭 발산)
tags: [spec, catalog, layout, sync]
---

컴포넌트 수치(padding, fontSize, lineHeight, borderWidth 등)의 **정본은 catalog rule sizes** (`COMPONENT_RULES_TABLE[type].sizes`)입니다. 소비 경로는 둘이고 같은 값을 읽어야 합니다:

1. **Canvas** — catalog resolver 가 rule 을 노드의 `visual` · `layout` 으로 풀고, 그 resolved record 를 레이아웃 (`catalogBoxModel` → `styleOf`, `compositionRoot.ts`) 과 Skia shapes (`ruleShapes.ts` · `buildCatalogShapes`) 가 같이 읽는다
2. **Generated CSS** — `packages/specs/scripts/generate-css.ts` → `packages/shared/src/components/styles/generated/*.css`

옛 레이아웃 엔진 내부 파생 상수 (`engines/utils.ts` 의 `BUTTON_SIZE_CONFIG` · `deriveSizeConfig` · `getButtonSizeConfig` · `calculateContentHeight`) 는 2026-10-05 옛 TS 레이아웃 파이프라인과 함께 삭제됐다 — 레이아웃이 rule 값을 따로 복사해 두는 곳은 없다. **catalog rule 1곳 편집 + 두 경로 확인** 이 현행 규칙입니다.

## Incorrect

```typescript
// ❌ 레이아웃 · 렌더 쪽에 catalog 와 무관한 하드코딩 size map 신설 — 정본 fork
const MY_COMPONENT_SIZES = { md: { paddingX: 16 } }; // catalog rule 무시

// ❌ rule 무시 ad-hoc fallback — catalog 값과 발산
const gap = props.gap ?? 4; // TagList lg=6 인데 4 로 렌더된 실사례
```

## Correct

```typescript
// ✅ resolved record 의 값을 읽는다 — 레이아웃과 Skia 가 같은 record
const paddingX = node.visual.paddingX ?? node.visual.padding; // catalogBoxModel (boxModel.ts)
```

## 동기화 대상 값 (Button 기준)

| 값                | catalog 정본                            | Canvas (레이아웃 · Skia)               | CSS                                  |
| ----------------- | --------------------------------------- | -------------------------------------- | ------------------------------------ |
| paddingX/paddingY | `COMPONENT_RULES_TABLE.Button.sizes[s]` | resolved `visual.paddingX/Y`           | generated Button CSS `[data-size]`   |
| fontSize          | `sizes[s].fontSize` (TokenRef)          | resolved `visual.fontSize` (토큰 해소) | `var(--text-*)`                      |
| lineHeight        | `sizes[s].lineHeight` (TokenRef)        | resolved `visual.lineHeight`           | `var(--text-*--line-height)`         |
| borderWidth       | `sizes[s].borderWidth`                  | resolved `visual.borderWidth`          | border 선언                          |
| variant 색상      | `variants[v].fill` + `colors`           | rule paint (레이아웃 무관)             | generate-css 가 rule 테이블에서 주입 |

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

### lineHeight 는 텍스트 측정까지 간다

CSS Button 은 명시적 `line-height: var(--text-*--line-height)` 를 쓴다. Canvas 의 텍스트 leaf 측정 (`textLeaf` → `catalogTextMeasure`) 은 resolved `visual.lineHeight` (없으면 상속 줄 높이) 를 읽는다 — 이 값이 빠지면 font metrics 기반 `line-height: normal`(~1.2x) 로 재어 CSS 와 높이가 갈린다. 필수 바인딩은 값이 없으면 `CATALOG_TEXT_METRIC_REQUIRED` 로 throw 한다.

## 체크리스트 — 수치 수정 시

- [ ] `packages/shared/src/catalog/generated/componentRulesTable.ts` 의 해당 rule sizes/variants 편집 (정본 1곳)
- [ ] variant 색상 변경 시 generated CSS 재생성: `pnpm --filter @composition/specs build` (generate:css 포함) → [spec-build-sync](spec-build-sync.md)
- [ ] 레이아웃 · 렌더 쪽에 같은 값을 하드코딩한 곳이 남아 있지 않은지 grep
- [ ] Skia ↔ CSS 시각 결과 확인 — `/cross-check`

## 삭제된 심볼 — 참조 금지

- 2026-07-07 grep 확증: `UI_COMPONENT_DEFAULT_BORDER_RADIUS` / `INLINE_FORM_HEIGHTS` / `INLINE_FORM_INDICATOR_WIDTHS` / `ElementSprite.tsx` / `Pixi*.tsx`
- 2026-10-05 삭제: `BUTTON_SIZE_CONFIG` / `TOGGLEBUTTON_SIZE_CONFIG` / `deriveSizeConfig` / `ruleSizesToSizeSpecMap` / `getButtonSizeConfig` / `estimateTextHeight` / `calculateContentHeight` (builder `engines/utils.ts`)

## 참조

- `packages/shared/src/catalog/generated/componentRulesTable.ts` — 수치/색상 정본
- `apps/builder/src/builder/catalogRuntime/boxModel.ts` — `catalogBoxModel` (resolved record → 엔진 상자)
- `apps/builder/src/builder/catalogRuntime/compositionRoot.ts` — `styleOf` · `textLeaf`
- `packages/specs/src/primitives/typography.ts` — fontSize/line-height 토큰 값
- [spec-build-sync](spec-build-sync.md) — 빌드/재생성 동기화
