---
title: Token Reference Format
impact: HIGH
impactDescription: 테마 일관성, 디자인 시스템 통합 — S2 TokenRef 단일 체계
tags: [spec, token, design-system]
---

catalog rule / 잔존 spec 에서 색상, 간격 등의 값은 **토큰 참조 형식** `{category.name}` 을 사용합니다. 색상 토큰은 **S2 체계만** 허용 — M3 계열(`{color.primary}`, `{color.on-surface}` 등)과 `--primary` 류 CSS 변수는 금지 (정본: `.claude/rules/css-tokens.md`).

## Incorrect

```tsx
// ❌ 하드코딩된 값
variants: {
  accent: {
    fill: { default: { base: "#3b82f6" } }, // 하드코딩
    colors: { text: "white" },              // 하드코딩
  },
},

// ❌ CSS 변수 직접 사용
const background = "var(--accent)";

// ❌ 금지된 M3 토큰 (css-tokens.md)
fill: { default: { base: "{color.primary}" } },
colors: { text: "{color.on-primary}" },
```

## Correct

```tsx
// ✅ S2 TokenRef — catalog rule (COMPONENT_RULES_TABLE) 실제 형식
variants: {
  accent: {
    fill: {
      default: {
        base: "{color.accent}",
        hover: "{color.accent-hover}",
        pressed: "{color.accent-pressed}",
      },
      outline: { base: "{color.transparent}" },
    },
    colors: {
      text: "{color.on-accent}",
      border: "{color.accent}",
    },
  },
},
sizes: {
  md: {
    fontSize: "{typography.text-sm}",
    lineHeight: "{typography.text-sm--line-height}",
    borderRadius: "{radius.md}",
  },
},
```

## 토큰 카테고리

| 카테고리     | 형식             | 예시 (S2)                                           |
| ------------ | ---------------- | --------------------------------------------------- |
| 색상         | `{color.*}`      | `{color.accent}`, `{color.neutral}`, `{color.base}` |
| 간격         | `{spacing.*}`    | `{spacing.md}`                                      |
| 타이포그래피 | `{typography.*}` | `{typography.text-sm}`, `{typography.text-base}`    |
| 반경         | `{radius.*}`     | `{radius.sm}`, `{radius.md}`, `{radius.full}`       |
| 그림자       | `{shadow.*}`     | `{shadow.sm}`, `{shadow.focus}`                     |

## 토큰 해석

`packages/specs/src/renderers/utils/tokenResolver.ts`:

```tsx
// 테마별 실제 값으로 변환 (lightColors/darkColors — primitives/colors.ts)
resolveToken("{color.accent}", "light"); // → "#2563eb" (blue-600)
resolveToken("{color.accent}", "dark"); // → "#3b82f6" (blue-500)
resolveToken("{radius.md}"); // → 6
resolveToken("{typography.text-md}"); // → 16

// CSS 변수로 변환 (tokenToCSSVar — tokenResolver.ts:178)
tokenToCSSVar("{color.accent}"); // → "var(--accent)"
tokenToCSSVar("{color.on-accent}"); // → "var(--fg-on-accent)"
tokenToCSSVar("{color.neutral}"); // → "var(--fg)"
tokenToCSSVar("{color.accent-hover}"); // → "color-mix(in srgb, var(--accent) 85%, black)"
tokenToCSSVar("{spacing.md}"); // → "var(--spacing-md)"
tokenToCSSVar("{shadow.md}"); // → "var(--shadow-md)"

// 숫자/색상 토큰 해석 (Skia Shape 변환 시)
// specShapeConverter.ts 의 resolveNum() / resolveColor() 가
// Shape 의 fontSize, radius, fill 등이 TokenRef 일 때 자동 분기 처리
```

역방향 변환도 존재: `cssVarToTokenRef("var(--spacing-md)")` → `{spacing.md}` (tokenResolver.ts, ADR-082 P1).

## 주의사항

- Shape 의 `fill`, `fontSize`, `radius` 등은 TokenRef(`"{category.name}"`) 또는 직접 값(string/number)일 수 있음 — 변환기(`specShapeConverter.ts`)가 자동 분기. 생성기 단계에서 TokenRef 를 number 로 강제 캐스팅 게이트 금지
- `resolveToken()` 없이 TokenRef 를 숫자 연산에 직접 사용 금지 — 문자열 연결로 NaN 전파 (`.claude/rules/canvas-rendering.md` §2)
- fill 계열 토큰은 `FillTokenSpec` 구조 안에서만 선언 (ADR-908) — `background*` 개별 필드 금지 → [spec-shape-rendering](spec-shape-rendering.md) §4

## 참조

- `.claude/rules/css-tokens.md` — S2 TokenRef ↔ CSS 변수 매핑 정본 (금지 M3 토큰 목록 포함)
- `packages/specs/src/primitives/colors.ts` — lightColors/darkColors 정의
- `packages/specs/src/primitives/typography.ts` / `radius.ts` / `shadows.ts` — 수치 토큰 정의
- `packages/specs/src/renderers/utils/tokenResolver.ts` — resolveToken / resolveColor / tokenToCSSVar / cssVarToTokenRef
- `apps/builder/src/builder/workspace/canvas/skia/specShapeConverter.ts` — resolveNum() / resolveColor() (Skia 측)
