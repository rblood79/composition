---
title: "Spec ↔ Builder ↔ CSS 값 동기화"
impact: CRITICAL
impactDescription: 세 소스 간 값 불일치 시 WebGL/CSS 렌더링 차이 발생
tags: [spec, layout, sync]
---

컴포넌트 수치(padding, fontSize, borderWidth 등)는 **3곳에서 동일하게** 유지해야 합니다:

1. `@composition/specs` — ComponentSpec (예: `ButtonSpec.sizes.md.paddingX`)
2. Builder 내부 상수 (예: `BUTTON_SIZE_CONFIG`)
3. CSS 토큰 (예: `Button.css`의 `--spacing-*`)

## Incorrect

```typescript
// ❌ Spec과 Builder 상수 값 불일치
// packages/specs/src/components/Button.spec.ts
md: { paddingX: 24 }

// apps/builder/.../engines/utils.ts
md: { paddingLeft: 16, paddingRight: 16 }  // 불일치!
```

## Correct

```typescript
// ✅ 세 소스 동일한 값
// packages/specs/src/components/Button.spec.ts
md: { paddingX: 24 }

// apps/builder/.../engines/utils.ts
md: { paddingLeft: 24, paddingRight: 24, borderWidth: 1 }  // 일치

// CSS: --spacing-xl = 24px, border: 1px solid  // 일치
```

## 동기화 대상 값

| Spec 값                               | Builder 내부 상수                                              | CSS 토큰                                                   |
| ------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- |
| `ButtonSpec.sizes[size].paddingX`     | `BUTTON_SIZE_CONFIG[size].paddingLeft/Right`                   | `Button.css [data-size] padding (좌우)`                    |
| `ButtonSpec.sizes[size].paddingY`     | `BUTTON_SIZE_CONFIG[size].paddingY`                            | `Button.css [data-size] padding (상하)`                    |
| `ButtonSpec.sizes[size].fontSize`     | `BUTTON_SIZE_CONFIG[size].fontSize`                            | `Button.css [data-size] font-size`                         |
| N/A (CSS 파생)                        | `BUTTON_SIZE_CONFIG[size].lineHeight`                          | `Button.css [data-size] line-height`                       |
| `fontFamily.sans` (typography.ts)     | `measureTextWidth()` 기본 폰트                                 | `body { font-family }`                                     |
| CSS base `border: 1px solid`          | `BUTTON_SIZE_CONFIG[size].borderWidth` (=1)                    | `Button.css base: border`                                  |
| `ButtonSpec.variants[v].border`       | `PixiButton specDefaultBorderWidth` (=1)                       | `Button.css border-color`                                  |
| `ButtonSpec.sizes[size].borderRadius` | `UI_COMPONENT_DEFAULT_BORDER_RADIUS[size]` (ElementSprite.tsx) | `Button.css [data-size] border-radius`                     |
| `spec.sizes[size].height`             | `INLINE_FORM_HEIGHTS[type][size]` (engines/utils.ts)           | N/A (Skia에서 Yoga finalHeight 사용, spec height는 참조용) |
| `spec indicator size`                 | `INLINE_FORM_INDICATOR_WIDTHS[type][size]` (engines/utils.ts)  | N/A                                                        |

## Button/ToggleButton 사이즈 레퍼런스 테이블

CSS height = lineHeight + paddingY x 2 + borderWidth x 2 (명시적 height 없음)

| Size | fontSize | lineHeight (px) | paddingY | borderWidth | **CSS height** | CSS 토큰 참조                 |
| ---- | -------- | --------------- | -------- | ----------- | -------------- | ----------------------------- |
| xs   | 10       | 16              | 1        | 1           | **20px**       | `--text-2xs`, `--spacing-3xs` |
| sm   | 12       | 16              | 2        | 1           | **22px**       | `--text-xs`, `--spacing-2xs`  |
| md   | 14       | 20              | 4        | 1           | **30px**       | `--text-sm`, `--spacing-xs`   |
| lg   | 16       | 24              | 8        | 1           | **42px**       | `--text-base`, `--spacing-sm` |
| xl   | 18       | 28              | 12       | 1           | **54px**       | `--text-lg`, `--spacing-md`   |

### lineHeight 계산 (shared-tokens.css)

CSS `line-height`는 unitless ratio로 정의되어 있으며, `fontSize x ratio`로 px 환산:

| Size | CSS line-height token      | ratio                 | px  |
| ---- | -------------------------- | --------------------- | --- |
| xs   | `--text-2xs--line-height`  | `1/0.625 = 1.6`       | 16  |
| sm   | `--text-xs--line-height`   | `1/0.75 = 1.333`      | 16  |
| md   | `--text-sm--line-height`   | `1.25/0.875 = 1.4286` | 20  |
| lg   | `--text-base--line-height` | `1.5/1 = 1.5`         | 24  |
| xl   | `--text-lg--line-height`   | `1.75/1.125 = 1.556`  | 28  |

### BUTTON_SIZE_CONFIG lineHeight 필수 규칙

`BUTTON_SIZE_CONFIG`와 `TOGGLEBUTTON_SIZE_CONFIG`에는 `lineHeight` 필드가 필수.
CSS Button은 명시적 `line-height: var(--text-*--line-height)`를 사용하므로,
WebGL `estimateTextHeight()`에 이 값을 전달하지 않으면 font metrics 기반
`line-height: normal`(~1.2x)로 계산되어 CSS와 높이가 불일치함.

```typescript
// calculateContentHeight() 내부
const effectiveLineHeight = resolvedLineHeight ?? configLineHeight;
const textHeight = estimateTextHeight(fontSize, effectiveLineHeight);
```

## parseBoxModel 기본값

`parseBoxModel()`은 폼 요소(`button`, `input`, `select`)에 inline style이 없을 때
`BUTTON_SIZE_CONFIG` 기본값을 적용합니다. inline style이 있으면 해당 값을 우선 사용합니다.

- `calculateContentWidth()` → 순수 텍스트 너비만 반환 (padding/border 미포함)
- `parseBoxModel()` → padding/border 기본값 제공 (BUTTON_SIZE_CONFIG 또는 inline)
- `BlockEngine` → `contentWidth + padding + border` = 정확한 한 번 계산

## Skia Spec Shapes 렌더링 주의사항

`ElementSprite.tsx`의 Spec shapes 렌더링 경로에서 시각 전용 속성(`borderRadius`, `borderColor` 등)을 읽을 때는
반드시 `convertStyle()`의 반환값을 사용해야 합니다. `style.borderRadius`는 UI 패널에서 CSS 문자열
(`"12px"`)로 저장되므로, `typeof === 'number'` 직접 체크 시 항상 `0`이 됩니다.

```typescript
// ❌ 금지: raw style 직접 typeof 체크
const br = typeof style.borderRadius === "number" ? style.borderRadius : 0;

// ✅ 필수: convertStyle() 반환값 사용
const { borderRadius: convertedBorderRadius } = convertStyle(style);
const br =
  typeof convertedBorderRadius === "number"
    ? convertedBorderRadius
    : (convertedBorderRadius?.[0] ?? 0);
```

> Yoga가 변환하는 레이아웃 속성(width, height, padding)과 달리, `borderRadius`는 시각 전용이므로 Yoga를 거치지 않고 CSS 문자열 형태로 남아 있다.

### Spec Shapes 높이 및 Fill 통합 (2026-02-12 추가)

**specHeight = finalHeight**: `ElementSprite.tsx`에서 spec shapes에 전달하는 높이는 항상 Yoga 계산 높이(`finalHeight`)를 사용합니다. 이전의 `Math.min(sizeSpec.height, finalHeight)` 패턴은 제거되었습니다.

```typescript
// ✅ 항상 Yoga 높이 사용
const specHeight = finalHeight;

// ❌ 금지: spec 고정 높이 혼합
const specHeight = Math.min(sizeSpec.height || finalHeight, finalHeight);
```

**gradient fill 이전**: spec shapes가 외부 box 데이터를 클리어하므로, gradient fill이 손실될 수 있습니다. 반드시 `boxData.fill`을 `specNode.box.fill`로 이전한 후 클리어:

```typescript
// ✅ gradient fill 보존
if (boxData.fill && specNode.box) {
  specNode.box.fill = boxData.fill;
}
boxData.fill = undefined; // spec shapes가 시각 담당하므로 클리어
```

**maxWidth safety clamp**: `containerWidth - padding * 2`가 1 미만이면 `containerWidth`로 폴백하여 padding=0 시 음수 maxWidth 방지.

### Size별 기본 borderRadius

`ElementSprite.tsx`의 `UI_COMPONENT_DEFAULT_BORDER_RADIUS` 상수는 Spec radius 토큰 값을 미러링한다.
`style.borderRadius`가 설정되지 않은 UI 컴포넌트는 `element.props.size`에 따라 기본값을 적용한다:

| size   | Spec 토큰     | radius 값 |
| ------ | ------------- | --------- |
| xs, sm | `{radius.sm}` | 4px       |
| md     | `{radius.md}` | 6px       |
| lg, xl | `{radius.lg}` | 8px       |

```typescript
// ✅ Spec 토큰 기반 size별 기본 borderRadius
const UI_COMPONENT_DEFAULT_BORDER_RADIUS: Record<string, number> = {
  xs: 4,
  sm: 4,
  md: 6,
  lg: 8,
  xl: 8,
};
const size = String(props?.size || "md");
const defaultBorderRadius = UI_COMPONENT_DEFAULT_BORDER_RADIUS[size] ?? 6;

// ❌ 금지: 하드코딩된 기본값
const effectiveBorderRadius = isUIComponent ? 6 : 0;
```

## 체크리스트

값 수정 시 반드시 확인:

- [ ] `packages/specs/src/components/[Component].spec.ts`
- [ ] `apps/builder/.../engines/utils.ts` (`BUTTON_SIZE_CONFIG` 등 내부 상수)
- [ ] `apps/builder/.../canvas/ui/Pixi[Component].tsx` (이벤트 레이어 전용, alpha=0)
- [ ] `apps/builder/.../sprites/ElementSprite.tsx` (Skia 폴백 — `convertStyle()` 사용 필수)
- [ ] CSS 파일의 토큰/변수
- [ ] `pnpm --filter @composition/specs build` 실행
- [ ] `apps/builder/.../skia/specShapeConverter.ts` (색상/크기 변환)
- [ ] `apps/builder/.../layout/engines/utils.ts` (`INLINE_FORM_HEIGHTS`, `INLINE_FORM_INDICATOR_WIDTHS`)
- [ ] spec shapes의 모든 시각 속성이 `props.style?.X` 오버라이드를 지원하는지 확인
- [ ] 배경 roundRect의 height가 `'auto'`인지 확인 (고정 높이 금지)

## 참조

- [spec-build-sync](spec-build-sync.md) — 빌드 동기화 필수
- `docs/COMPONENT_SPEC.md` §4.7.4.0, §4.7.4.5~4.7.4.6
