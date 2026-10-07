---
title: Visual Single Source of Truth (Catalog)
impact: HIGH
impactDescription: D3 시각 스타일 단일 소스 — Skia ↔ DOM/CSS 대등(symmetric) consumer 정합 보장
tags: [spec, catalog, architecture, ssot]
---

D3(시각 스타일)의 SSOT 는 **catalog** 입니다 — `COMPONENT_RULES_TABLE`(변형/크기/fill 색상) + `bindings/*.binding.ts`(D2 props surface + `skiaPrimitive` 키). Builder(Skia)와 Preview/Publish(DOM+CSS)는 이 단일 소스에서 파생되는 **대등한(symmetric) consumer** 이며, 어느 한쪽이 다른 쪽의 기준이 아닙니다. 대칭 = **시각 결과의 동일성** (구현 방법 자유). 정본 규칙: `.claude/rules/ssot-hierarchy.md` (ADR-063).

## Incorrect

```tsx
// ❌ 렌더러별 독립 스타일 정의 — DOM 과 Skia 가 서로 다른 소스에서 색을 읽음
// (a) 수동 CSS 에 하드코딩
.react-aria-Button { background: #2563eb; }
// (b) Skia 생성기에 하드코딩
const bg = "#2563eb";

// ❌ M3 토큰 + legacy background 개별 필드 — 이중 금지 패턴
//    ({color.primary} 계열 토큰은 금지 — css-tokens.md / background* 필드는 ADR-908 로 타입 삭제)
variants: {
  primary: {
    background: "{color.primary}",
    backgroundHover: "{color.primary-hover}",
    text: "{color.on-primary}",
  },
},

// ❌ "CSS 가 기준, Skia 가 따라간다" 언어/구현 — 대칭 위반
// ❌ @sync 주석으로 CSS ↔ CSS consumer-to-consumer 참조
```

## Correct

```tsx
// ✅ catalog rule 단일 정의 — S2 TokenRef + ADR-908 FillTokenSpec
// packages/shared/src/catalog/generated/componentRulesTable.ts (직접 편집 정본)
export const COMPONENT_RULES_TABLE: ComponentRulesTable = {
  Button: {
    defaultVariant: "primary",
    defaultSize: "md",
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
    sizes: {/* fontSize/lineHeight/paddingX... TokenRef + number */},
  },
};
```

두 consumer 는 같은 테이블에서 파생됩니다:

```
COMPONENT_RULES_TABLE
 ├─ DOM/CSS  : packages/rendering/scripts/generate-css.ts 가 getComponentRulesTable() 로
 │             variant 색상을 주입 → packages/shared/src/components/styles/generated/*.css
 │             (DOM binding: packages/shared/src/catalog/runtime/delegatedDom.tsx)
 └─ Skia     : resolveComponentRule() (packages/shared/src/catalog/resolvers/resolveComponentRule.ts)
               → builder ruleVariantToVisual() → buildCatalogShapes() (generic box+text)
               → 비-box 도형은 binding.skiaPrimitive → skiaPrimitives.ts
```

- fill 은 `FillTokenSpec`(fillStyle × state 2축, ADR-908) 구조 — consumer 는 `resolveFillTokens()` / 주입된 `visual.fill` 경유로만 접근 (`variant.background*` 직접 access 금지, 타입 삭제됨)
- TokenRef 는 S2 체계만 사용 (`{color.accent}` / `{color.neutral}` 등) — 매핑 정본: `.claude/rules/css-tokens.md`

## 컴포넌트당 spec 파일 — 0개 (ADR-248 으로 패키지 삭제)

Frame · Group · Slot 에 남아 있던 마지막 spec 3개와 `packages/specs` 패키지는 ADR-248 Publish 후속 (2026-10-04, `ddc5fc603`) 에서 삭제됐다. 세 타입도 catalog 입력이다 — `COMPONENT_RULES_TABLE` 의 `frame` · `Group` · `Slot` 키 + `componentCatalog.ts` entry, Canvas 는 `canvasBinding.ts` 의 `containerWithAuthoredPaint` 가 그린다. Group 은 RAC ARIA semantic (D1 — `role="group"`) 이고 시각 책임을 더하지 않는다 (ADR-130).

옛 spec 경로의 공용 코드 (`buildCatalogShapes` · `skiaPrimitives` · primitives · `generate-css.ts`) 는 `packages/rendering` 으로 옮겨졌다. 그 외 124개 spec 은 ADR-912 로 삭제 완료 — 시각 수정은 catalog rule 을 직접 편집한다. `COMPONENT_RULES_TABLE` 은 build-time 생성물이 아니라 **직접 편집 정본** 이다 (ADR-912 1A-(a) 위상 전환, generate-rules.ts 삭제됨). **어떤 컴포넌트에도 spec 파일을 새로 만들지 않는다.**

## Self-Rendering 레이아웃 연계

레이아웃은 rule 값을 따로 복사해 두지 않는다 — catalog resolver 가 푼 record 를 `catalogBoxModel` → `styleOf` (`catalogRuntime/compositionRoot.ts`) 가 그대로 읽는다 (옛 `BUTTON_SIZE_CONFIG` 파생 상수는 2026-10-05 삭제). 수치 동기화 상세: [spec-value-sync](spec-value-sync.md).

## 참조

- `packages/shared/src/catalog/generated/componentRulesTable.ts` — COMPONENT_RULES_TABLE (직접 편집 정본)
- `packages/shared/src/catalog/bindings/` — PrimitiveBinding (D2 props + skiaPrimitive)
- `packages/shared/src/catalog/resolvers/resolveComponentRule.ts` — 런타임 rule resolver
- `packages/rendering/src/renderers/buildCatalogShapes.ts` — Skia generic 생성기
- `packages/rendering/scripts/generate-css.ts` — DOM CSS 생성기
- `.claude/rules/ssot-hierarchy.md` — 3-Domain 분할 정본 (ADR-063)
- [spec-shape-rendering](spec-shape-rendering.md) / [spec-value-sync](spec-value-sync.md) / [spec-build-sync](spec-build-sync.md)
