# composition CSS Architecture - ITCSS

**Date:** 2025-11-08 (초판) / 2026-03-06 (최종 갱신)
**Version:** 3.2 (ActionIconButton 도입 — builder 전용 아이콘 버튼)

---

## 📊 Overview

composition uses **ITCSS (Inverted Triangle CSS)** architecture for scalable and maintainable styling. The CSS is organized in layers of increasing specificity, from generic to explicit.

---

## 🏗️ Directory Structure

```
src/builder/styles/
├── index.css                    # Master entry point
├── 1-theme/                     # Layer 1: Design Tokens
│   ├── builder-system.css       # Builder UI tokens (160 lines)
│   ├── preview-system.css       # Preview tokens (511 lines)
│   └── shared-tokens.css        # Shared tokens (151 lines)
├── 2-base/                      # Layer 2: Base styles
│   ├── reset.css                # (Future) CSS reset
│   └── animations.css           # (Future) Global animations
├── 3-utilities/                 # Layer 3: Utility classes
│   ├── layout.css               # (Future) Flexbox/Grid helpers
│   └── spacing.css              # (Future) Spacing utilities
├── 4-layout/                    # Layer 4: Layout structures
│   ├── grid.css                 # (Future) Main grid system
│   ├── header.css               # (Future) Header layout
│   └── panels.css               # (Future) Panel layouts
└── 5-modules/                   # Layer 5: Feature modules
    ├── main.css                 # (Future) Main workspace
    ├── sidebar.css              # (Future) Sidebar module
    ├── inspector.css            # (Future) Inspector module
    └── theme-studio.css         # (Future) ThemeStudio module
```

---

## 📐 ITCSS Layer Hierarchy

### **Layer 1: Theme (1-theme/)**

**Purpose:** CSS variables and design tokens
**Specificity:** Lowest (`:root`)
**Files:**

- `builder-system.css` - Builder UI variables
- `preview-system.css` - Preview component variables
- `shared-tokens.css` - Typography, spacing, colors

**Example:**

```css
@layer builder-system {
  :root {
    --builder-header-bg: var(--color-gray-950);
    --builder-sidebar-bg: #fff;
  }
}
```

---

### **Layer 2: Base (2-base/)**

**Purpose:** CSS reset and base element styles
**Specificity:** Element selectors (`body`, `h1`, `a`)
**Planned Files:**

- `reset.css` - Normalize/reset
- `animations.css` - Keyframes

**Example:**

```css
@layer base {
  body {
    font-family: var(--font-sans);
    line-height: 1.5;
  }
}
```

---

### **Layer 3: Utilities (3-utilities/)**

**Purpose:** Reusable utility classes
**Specificity:** Single-purpose classes
**Planned Files:**

- `layout.css` - `.flex-col-sm`, `.grid-2col`
- `spacing.css` - Margin/padding helpers

**Example:**

```css
@layer utilities {
  .flex-col-sm {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }
}
```

---

### **Layer 4: Layout (4-layout/)**

**Purpose:** Major structural layouts
**Specificity:** Structural classes
**Planned Files:**

- `grid.css` - Main grid system
- `header.css` - Header layout
- `panels.css` - Sidebar/Inspector panels

**Example:**

```css
@layer layout {
  .builder-grid {
    display: grid;
    grid-template-areas:
      "header header header"
      "sidebar main inspector";
  }
}
```

---

### **Layer 5: Modules (5-modules/)**

**Purpose:** Feature-specific modules
**Specificity:** Highest (module-specific)
**Planned Files:**

- `main.css` - Workspace module
- `sidebar.css` - Sidebar module
- `inspector.css` - Inspector module
- `theme-studio.css` - ThemeStudio module

**Example:**

```css
@layer builder-system {
  .inspector {
    border-left: 1px solid var(--color-border);
  }
}
```

---

## 🔄 CSS Layer Order (Cascade Priority)

```css
@layer dashboard; /* Lowest priority */
@layer builder-system; /* Builder UI */
@layer preview-system; /* Preview components */
@layer shared-tokens; /* Common tokens */
@layer base; /* Base styles */
@layer components; /* React Aria components */
@layer utilities; /* Highest priority */
```

**Note:** Later layers override earlier layers, regardless of source order.

**Important:** 수동 CSS(`Select.css`, `ComboBox.css` 등)와 자동 생성 CSS(`generated/*.css`) 모두 `@layer components` 안에 있어야 한다. Unlayered CSS는 layered CSS를 항상 이기므로, generated CSS가 `@layer` 밖에 있으면 수동 CSS의 nested selector override(`.react-aria-Select .react-aria-Button`)가 specificity와 무관하게 실패한다.

---

## 🎨 Theme System Architecture

### **Builder System Tokens (`--builder-*`)**

**Purpose:** Builder UI (header, sidebar, inspector)
**Not affected by:** User theme changes
**Dark mode:** `[data-builder-theme="dark"]`

**Key Tokens:**

```css
--builder-header-bg
--builder-sidebar-bg
--builder-inspector-bg
--builder-canvas-bg
--builder-error-bg
--builder-modal-bg
--builder-spinner-track
```

---

### **Preview Semantic Tokens (ADR-017) + Tint System**

**Purpose:** Preview iframe components — M3 토큰 제거 후 시맨틱 토큰 단일 체계
**Customizable by:** AI Theme System
**Dark mode:** `[data-theme="dark"]`

#### Tint Color System (React Aria starter 패턴)

`--tint` 변수 하나로 전체 accent 색상 전환:

```css
:root {
  /* 프리셋 (oklch base colors) */
  --blue: oklch(0.5 0.22049 266.315);
  --indigo: oklch(1 0.25049 284.23);
  --purple: oklch(0.7 0.223324 302);
  /* ... red, orange, yellow, green, cyan, turquoise, pink */

  /* 이 한 줄로 테마 색상 전환 */
  --tint: var(--blue);

  /* 자동 생성되는 16단계 tint 스케일 (oklch relative color) */
  --tint-100 ~ --tint-1600
}
```

**시맨틱 토큰 → tint 매핑:**

| Semantic Token           | Tint Fallback                              |
| ------------------------ | ------------------------------------------ |
| `--highlight-background` | `oklch(from var(--tint) 55% c h)`          |
| `--highlight-bg-pressed` | `oklch(from var(--tint) 50% c h)`          |
| `--focus-ring-color`     | `var(--tint-1000)`                         |
| `--link-color`           | `var(--tint-1200)`                         |
| `--link-color-pressed`   | `var(--tint-1300)`                         |
| `--highlight-overlay`    | `oklch(from var(--tint-1000) l c h / 15%)` |

**다크모드**: lightness 스케일이 자동 반전 (light: 98%→17%, dark: 30%→100%). `--highlight-background`는 고정 55% lightness로 양쪽 모드에서 동일 대비 유지.

**ThemeStudio 오버라이드**: `--color-highlight-background` 등 토큰이 설정되면 tint fallback보다 우선 적용.

#### Semantic Token Catalog

| Category  | Token                            | Description                                        |
| --------- | -------------------------------- | -------------------------------------------------- |
| Highlight | `--highlight-background`         | Primary accent (buttons, links)                    |
| Highlight | `--highlight-foreground`         | Text on primary accent                             |
| Highlight | `--highlight-background-pressed` | Primary pressed state                              |
| Text      | `--text-color`                   | Default text                                       |
| Text      | `--text-color-secondary`         | Secondary text                                     |
| Text      | `--text-color-disabled`          | Disabled text                                      |
| Text      | `--text-color-placeholder`       | Placeholder text                                   |
| Border    | `--border-color`                 | Default border                                     |
| Border    | `--border-color-hover`           | Border hover state                                 |
| Border    | `--border-color-disabled`        | Disabled border                                    |
| Surface   | `--bg-inset`                     | Input/select/field 배경 (모든 field 컴포넌트 통일) |
| Surface   | `--bg-overlay`                   | Elevated surfaces                                  |
| Surface   | `--bg-raised`                    | 패널 헤더, section-header                          |
| Feedback  | `--invalid-color`                | Error/validation                                   |
| Palette   | `--color-white`, `--color-black` | Fixed colors                                       |
| Surface   | `--color-white`                  | White (surface, on-primary)                        |
| Surface   | `--color-neutral-*`              | Neutral palette (100–900)                          |
| Palette   | `--color-purple-600`             | Tertiary accent                                    |
| Special   | `transparent`                    | Spec TokenRef용 투명 색상                          |

**Hover/Pressed 파생 패턴:**

```css
/* hover: base 85% + black 15% */
color-mix(in srgb, var(--highlight-background) 85%, black)
/* pressed: base 75% + black 25% */
color-mix(in srgb, var(--highlight-background) 75%, black)
```

> **Note:** M3 토큰 (`--primary`, `--on-surface`, `--surface-container` 등 38개)은 ADR-017에 의해 제거됨. 새 코드에서 사용 금지. 상세: `.claude/rules/css-tokens.md`

---

### **Shared Tokens (Fixed)**

**Purpose:** Common design tokens — Typography, spacing, radius, color palettes
**Not customizable:** AI Theme System 영향 없음
**Source:** Tailwind v4 standards

**Color Palettes (shared-tokens.css):**

| Palette                                         | Range  | 용도                                |
| ----------------------------------------------- | ------ | ----------------------------------- |
| `--color-white/black`                           | —      | 기본 흑백                           |
| `--color-primary-*`                             | 50-950 | Tailwind Blue 기반, tint fallback용 |
| `--color-neutral-*`                             | 50-950 | Gray scale                          |
| `--color-tertiary-*`                            | 50-900 | Tailwind Purple 기반                |
| `--color-error-*`                               | 50-900 | Red                                 |
| `--color-success-*`                             | 50-900 | Green                               |
| `--color-warning-*`                             | 50-900 | Orange                              |
| `--color-info-*`                                | 50-900 | Blue (HSL)                          |
| `--color-blue/green/red/orange/yellow/purple-*` | 50-900 | Tailwind standard palettes          |

> **Note:** `--color-primary-*`, `--color-blue-*` 등은 Preview iframe에서 Tailwind 없이도 동작하도록 shared-tokens.css에 정적 값으로 정의됨.

---

## 📦 Component CSS Organization

### **Utility Classes (ADR-018 — `utilities.css`)**

**Location:** `packages/shared/src/components/styles/utilities.css`
**Layer:** `@layer utilities` (specificity 0 via `:where()`)
**Loaded via:** `foundation.css` `@import`

3개 utility 클래스로 variant/state 색상 자동 파생:

| Class          | Custom Properties                 | Used by                                   |
| -------------- | --------------------------------- | ----------------------------------------- |
| `.button-base` | `--button-color`, `--button-text` | Button, ToggleButton, Link, Breadcrumbs   |
| `.indicator`   | `--indicator-color`               | Checkbox, RadioGroup, Switch              |
| `.inset`       | `--inset-bg`, `--inset-border`    | TextField, NumberField, Select, DateField |

```css
/* 사용 예: Button.css */
@layer components {
  .react-aria-Button {
    /* 구조: layout, sizing */
    display: inline-flex;
    height: 32px;
  }
  &[data-variant="primary"] {
    --button-color: var(--highlight-background);
    --button-text: var(--highlight-foreground);
    /* hover/pressed/disabled 자동 파생 (.button-base) */
  }
}
```

### **ActionIconButton (Builder 전용 아이콘 버튼)**

**Location:** `apps/builder/src/builder/components/ui/ActionIconButton.tsx` + `.css`
**Purpose:** 패널 헤더, 툴바 등 builder UI 아이콘 버튼 전용 컴포넌트

**배경:** 공유 `Button`(`packages/shared`)은 `.button-base` 클래스가 자동 적용되어 `color-mix()` hover/pressed 파생이 발생하지만, 아이콘 버튼은 투명 배경 + 미세한 tint만 필요. `variant="ghost"`는 Button.css에 미정의 → primary fallback 문제.

**해결:** `.action-icon-button` 자체 클래스로 `.button-base` 우회:

```css
.action-icon-button {
  background: transparent;
  /* hover: text-color 8% tint, pressed: 12% tint */
  &[data-hovered] {
    background: color-mix(in srgb, var(--text-color) 8%, transparent);
  }
  &[data-pressed] {
    background: color-mix(in srgb, var(--text-color) 12%, transparent);
  }
  &[data-disabled] {
    opacity: 0.38;
    pointer-events: none;
  }
}
```

**기능:** React Aria `Button` 래퍼 + 내장 tooltip 지원 (`tooltip` prop: 텍스트, `shortcutId` prop: 단축키 표시)

**사용 위치:** 패널 헤더 (StylesPanel, PropertiesPanel, HistoryPanel), 상단 바 (BuilderHeader undo/redo), 사이드바 PanelNav (tooltip CSS 재사용)

> **규칙:** builder 아이콘 버튼에는 공유 `Button variant="ghost"` 대신 `ActionIconButton` 사용 필수.

---

### **React Aria Components**

**Location:** `packages/shared/src/components/styles/`
**Count:** 70+ component files
**Pattern:** `data-variant`/`data-size` 속성 셀렉터 + utility 클래스 조합

```css
/* Button.css — 구조만 유지, 색상은 .button-base가 처리 */
@layer components {
  .react-aria-Button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  &[data-variant="primary"] {
    --button-color: var(--highlight-background);
  }
}
```

### **CSS Import Chain (v2.2 — 단일 경로 원칙)**

> **규칙**: 각 CSS 파일은 **한 가지 경로**로만 로드되어야 함. CSS `@import` 체인과 JS `import` 체인이 동일 파일을 로드하면 Vite가 별도 `<style>` 태그를 생성하여 중복 발생.

```
apps/builder/src/index.css (CSS @import chain — theme + builder styles only)
├── @import "tailwindcss"
├── @import theme.css → CSS 변수 (preview-system, shared-tokens, builder-system)
└── @import builder/styles/index.css → 빌더 전용 레이아웃/모듈 CSS

packages/shared/src/components/index.tsx (JS import chain — foundation only)
└── import './styles/foundation.css'
    ├── theme.css (CSS 변수)
    ├── base.css, animations.css
    ├── utilities.css (ADR-018: .button-base, .indicator, .inset)
    ├── forms.css, overlays.css, collections.css
    └── orphan CSS (ActionList, CalendarCommon, Group, SortIcon 등)

Individual component .tsx files (JS import — component CSS)
└── import './styles/Button.css'  ← 각 컴포넌트가 자기 CSS만 로드
```

**Preview/Publish 전용 경로 (`styles/index.css`):**

```
packages/shared/src/components/styles/index.css (preview iframe + publish)
├── @import theme.css → CSS 변수 (preview-system + tint system, shared-tokens, builder-system)
├── @import base.css, animations.css
├── @import utilities.css (ADR-018: .button-base, .indicator, .inset)
├── @import forms.css, overlays.css, collections.css
└── @import 70+ component CSS files (전체 cascade)
```

**중요**: `styles/index.css`(전체 cascade)는 **preview iframe**과 **publish 앱** 전용. Builder는 사용하지 않음.

---

## 🚀 Migration Status

### **✅ Completed (Phase 0-3)**

- [x] PostCSS configuration (postcss-import, postcss-nested)
- [x] Theme separation (3 files: builder, preview, shared)
- [x] Hardcoded color removal (17 → 0 colors)
- [x] @layer conflicts resolved
- [x] Dashboard CSS scoped
- [x] ITCSS directory structure created
- [x] Master index.css entry point

### **✅ Completed (Phase 5 — CSS 중복 로딩 해결, 2026-03-04)**

- [x] `1-theme/` 중복 디렉토리 삭제 (마스터 theme에 병합)
- [x] `Signin.tsx`, `AIPanel.tsx` 등 중복 CSS import 제거
- [x] `theme.css` 내 `@layer` 이중 선언 제거
- [x] `index.css` @import chain을 theme-only로 변경 (480KB → 172KB)
- [x] `foundation.css` 신규 생성 (기반 + orphan CSS 17개)
- [x] `index.tsx` 벌크 CSS import를 foundation-only로 변경
- [x] 동일 파일 중복 `<style>` 태그 0건 달성

### **✅ Completed (ADR-017 — M3 토큰 제거, 2026-03-04)**

- [x] Phase 1: theme 파일 M3 섹션 삭제 (preview-system.css, builder-system.css)
- [x] Phase 2 Tier 1: 자동화 스크립트 → 107파일 2,636건 치환 (M3 → 시맨틱 토큰)
- [x] Phase 2 Tier 2: 저빈도 토큰 수동 치환 + 포커스 셀렉터 정규화 (15파일)
- [x] Phase 2 Tier 3-4: Builder CSS 52파일 M3 치환
- [x] Phase 3: Spec 토큰 시스템 전환 (colors.ts, tokenResolver.ts, CSSGenerator.ts)
- [x] Phase 4: Theme Studio TSX 확인 (M3 참조 없음, M3ColorSystemGuide 삭제)
- [x] Phase 5: 문서화 + `.claude/rules/css-tokens.md` M3 금지 규칙

### **🔄 In Progress (ADR-018 — Component CSS 재구조화)**

- [x] Phase 1: `utilities.css` 생성 (`.button-base`, `.indicator`, `.inset`)
- [x] Button.css: `.button-base` 적용 + variant/state 블록 제거 (186→97줄, -48%)
- [x] Card.css: dead class 셀렉터 → `[data-variant]`/`[data-size]`/`[data-selected]` 수정
- [ ] Phase 2-5: 나머지 컴포넌트 (대부분 이미 CSS custom property 패턴 사용, 효과 제한적)

### **⏳ Phase 4: 보류 (Deferred)**

> **상태**: 보류 — Tailwind v4 + tv() 패턴 도입으로 유틸리티 추출 방식이 변경됨. ADR-002 참조.
> **판단 근거**: inspector.css 유틸리티 추출보다 tv() 기반 컴포넌트 스타일링이 우선. @layer 커버리지는 95%로 충분.

- [ ] ~~Extract utilities from inspector.css (425 duplicates → 35 utilities)~~ → tv() 패턴으로 대체 검토
- [ ] Migrate main/sidebar/inspector to modules/ (낮은 우선순위)
- [ ] Create base reset.css (Tailwind preflight로 대체 가능)
- [ ] ~~Create layout grid.css~~ → Tailwind grid 유틸리티 사용
- [x] ~~Consolidate @import chains~~ → Phase 5에서 해결 (단일 경로 원칙)
- [ ] Bundle size optimization (30% target) — 현재 측정 미실시

---

## 📊 Performance Metrics

### **Before Refactoring (Phase 0)**

- **Total Files:** 105 CSS files
- **Total Lines:** 15,716 lines
- **Hardcoded Colors:** 27 instances
- **Duplicate Code:** 425 flexbox declarations
- **@layer Coverage:** 85% (17 files missing)

### **After Phase 1-3**

- **Total Files:** 108 CSS files (+3 theme files)
- **Total Lines:** ~15,900 lines (+184 for modular theme)
- **Hardcoded Colors:** 0 instances ✅
- **@layer Coverage:** 95% (main, sidebar, inspector added)
- **Theme Files:** 658 lines → 822 lines (3 modular files)

### **After Phase 5 (CSS Dedup)**

- **`index.css` `<style>` 크기:** 480KB → 172KB (-64%)
- **중복 `<style>` 태그:** 3건 (index+components+개별) → 0건
- **동일 파일 중복 로딩:** 0건 ✅
- **theme.css 소량 중복:** ~5KB (index.css + foundation.css 양쪽 — 의도적, CSS 변수 조기 로드용)

### **Target (Phase 4)**

- **Total Files:** 80 files (-24%)
- **Total Lines:** 11,000 lines (-30%)
- **Duplicate Code:** 35 utilities (-92%)
- **@layer Coverage:** 100%

---

## 🔧 Build Configuration

### **vite.config.ts**

```typescript
import postcssImport from "postcss-import";
import postcssNested from "postcss-nested";

export default defineConfig({
  css: {
    postcss: {
      plugins: [
        postcssImport(), // Resolve @import
        postcssNested(), // Nested selectors
      ],
    },
  },
});
```

---

## 🎯 Best Practices

### **DO:**

- ✅ Use `--builder-*` tokens for Builder UI
- ✅ Use semantic tokens for Preview components (`--highlight-background`, `--text-color`, `--border-color` 등)
- ✅ Use utility classes (`.button-base`, `.indicator`, `.inset`) for color state derivation
- ✅ Use `color-mix()` for hover/pressed states (85%/75% with black)
- ✅ Use `data-variant`/`data-size` attribute selectors (not class selectors)
- ✅ Use `:where()` for zero-specificity utility overrides
- ✅ Wrap styles in appropriate `@layer`
- ✅ Use CSS variables for all colors

### **DON'T:**

- ❌ Use M3 tokens (`--primary`, `--on-surface`, `--surface-container` 등) — ADR-017에 의해 제거됨
- ❌ Use hardcoded colors (`#ffffff`, `rgba(...)`)
- ❌ Duplicate variant/state color blocks — utility 클래스 사용
- ❌ Mix Builder and Preview tokens
- ❌ Use `@apply` directive (Tailwind v4 doesn't support)
- ❌ Skip `@layer` declarations
- ❌ **CSS `@import`와 JS `import`로 동일 CSS를 이중 로드**
- ❌ **`index.css`에서 component CSS를 `@import`** — component CSS는 각 .tsx의 JS import로만 로드

---

## 📚 Related Documentation

- [ADR-002: Styling Approach](../../adr/completed/002-styling-approach.md) - ITCSS + tailwind-variants 결정 배경
- [ADR-017: CSS Override SSOT](../../adr/completed/017-css-override-ssot.md) - M3 토큰 제거, 시맨틱 토큰 단일화
- [ADR-018: Component CSS Restructure](../../adr/completed/018-component-css-restructure.md) - utilities.css 패턴, CSS 61% 감소
- [CSS_SUPPORT_MATRIX.md](../../CSS_SUPPORT_MATRIX.md) - CSS Level 3 지원 현황 (88%)
- [CLAUDE.md](../../../CLAUDE.md) - 프로젝트 가이드라인

---

## 🔄 Update History

| Version | Date       | Changes                                                                                                   |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| 3.2     | 2026-03-06 | ActionIconButton 도입 + `.action-tooltip` CSS. PanelNav tooltip 추가 (React Aria Button + TooltipTrigger) |
| 3.1     | 2026-03-04 | Tint Color System 도입 (oklch relative color), shared-tokens 팔레트 완성, Card.css/Button.css 수정        |
| 3.0     | 2026-03-04 | ADR-017: M3 토큰 제거 + 시맨틱 토큰 카탈로그. ADR-018: utilities.css 도입, Best Practices 갱신            |
| 2.2     | 2026-03-04 | Phase 5: CSS 중복 로딩 해결 — import chain 단일화, foundation.css, 1-theme/ 삭제                          |
| 2.1     | 2026-02-19 | Phase 4 상태 명시 (보류/대체), 미존재 참조 문서 정리, 날짜 보정                                           |
| 2.0     | 2025-11-08 | Phase 1-3 complete: Theme separation, hardcoded color removal, ITCSS structure                            |
| 1.0     | 2025-11-08 | Initial baseline documentation                                                                            |

---

**현재 상태**: Phase 1-3 + Phase 5 + ADR-017 완료. Tint Color System 도입. ADR-018 Button/Card 완료, 나머지 보류. ActionIconButton 도입으로 builder 패널/헤더 아이콘 버튼이 `.button-base` 우회.
