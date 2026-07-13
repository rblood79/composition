# ADR-021: 테마 시스템 개편 — Tint + Tailwind 기반 인라인 테마 패널

## Status

Accepted (2026-03-09) — Phase A+B+C+D+E 구현 완료

## Scope

> **이 테마 시스템은 Builder UI가 아닌, 사용자 콘텐츠의 출력물에 적용된다.**

| 적용 대상                   | 설명                     | 테마 전달 방식                                         |
| --------------------------- | ------------------------ | ------------------------------------------------------ |
| **CSS Preview** (iframe)    | 실시간 미리보기          | postMessage → CSS 변수 (`--tint`, `--color-neutral-*`) |
| **Publish** (배포 앱)       | 최종 배포물              | 정적 CSS 파일 (빌드 시 생성)                           |
| **Skia/CanvasKit** (캔버스) | Builder 내 캔버스 렌더링 | TokenRef → `resolveToken()` → Float32Array (RGBA)      |

Builder UI 자체 테마(`builder-system.css`, `--builder-*`)는 이 ADR의 범위가 **아님**.

### 3가지 렌더링 경로에서의 테마 적용

```
ThemeConfig (사용자 설정)
    │
    ├─→ CSS Preview ────→ CSS 변수 주입 (postMessage → setThemeVars)
    │                     --tint, --color-neutral-*, data-theme 속성
    │                     oklch() relative color + color-mix() 자동 파생
    │
    ├─→ Publish ─────────→ 정적 CSS 생성 (generateThemeCSS → theme.css)
    │                     동일 CSS 변수 체계, data-theme 속성
    │
    └─→ Skia Canvas ────→ TokenRef 해석 (resolveToken → Float32Array)
                          specShapesToSkia() → colorValueToFloat32()
                          MutationObserver로 data-theme 변경 감지
```

**핵심: 동일 ThemeConfig에서 3가지 경로로 분기**

- CSS 경로 (Preview/Publish): `--tint` CSS 변수 → oklch 자동 스케일
- Skia 경로: `resolveToken('{color.accent}', 'light'|'dark')` → hex → RGBA Float32Array

## Context

### 문제 정의

현재 composition의 테마 시스템은 초기에 설계되어 다음 문제를 가진다:

1. **Theme Studio가 새 창(`window.open`)으로 분리됨** — Builder 워크플로우 단절
2. **ThemesPanel이 읽기 전용** — 토큰 목록만 표시, 편집 불가 → "Theme Studio 열기" 버튼이 유일한 인터랙션
3. **구 ThemeStudio가 Supabase CRUD 기반** — `DesignToken` 테이블에 개별 토큰 CRUD → 색상 하나 변경에 불필요한 DB 왕복 (실제 앱은 IndexedDB 기반)
4. **과도한 기능** — HCT Generator, Figma Import/Export, AI Theme Generator 등 사용되지 않는 서브 뷰 7개
5. **ADR-017/022 완료 후 토큰 이름 정합** — M3 → S2 토큰 전환 완료(`accent`/`neutral`/`negative` 등), 하지만 Theme Store/DB 스키마는 구 토큰 구조 유지
6. **현재 Tint System이 하드코딩** — `--tint: var(--blue)` 고정, 사용자가 Builder 내에서 변경 불가
7. **Skia colors.ts 값이 정적** — ADR-022로 토큰 이름은 S2 정합 달성, 하지만 `colors.ts` hex 값이 빌드타임 고정이라 Tint 변경이 Skia에 미반영

### Hard Constraints

- Preview iframe 격리 유지 (postMessage 통신)
- 기존 Tint Color System (`preview-system.css`) 보존 및 확장
- Tailwind v4 색상 체계(`--color-*`) 호환
- Light/Dark 모드 전환 유지
- Builder UI 테마(`builder-system.css`)와 사용자 콘텐츠 테마 분리 유지
- **Skia/CSS 색상 일치** — 캔버스와 Preview/Publish에서 동일 요소가 같은 색상으로 렌더링

### 현재 아키텍처

```
ThemesPanel (읽기 전용) → "Theme Studio 열기" → window.open('/theme/{projectId}')
  ↓
ThemeStudio (새 창) → Supabase DB (design_themes, design_tokens)
  ↓
injectThemeCSS() → <style id="design-theme-vars"> → Preview iframe (CSS만)
                                                      Skia는 별도 경로 (resolveToken)
```

**현재 색상 경로 분리 문제 (ADR-022 완료 후):**

| 경로        | 색상 소스                        | 토큰 이름 | 테마 변경 반영                  |
| ----------- | -------------------------------- | --------- | ------------------------------- |
| CSS Preview | `--tint` CSS 변수 (oklch 런타임) | S2 ✓      | `--tint: var(--blue)` 하드코딩  |
| Skia Canvas | `colors.ts` S2 토큰 (정적 hex)   | S2 ✓      | hex 값 고정 (accent=#2563eb 등) |
| Publish     | CSS 변수 (정적)                  | S2 ✓      | 빌드 시점 고정                  |

→ ADR-022로 **토큰 이름 불일치 해소**, 남은 문제는 **Tint 변경 시 Skia hex 값 미반영**

**현재 파일 구성:**

- `panels/themes/ThemesPanel.tsx` — 읽기 전용 패널
- `panels/themes/ThemeStudio.tsx` — 새 창 전용 (375줄, 7개 서브뷰)
- `panels/themes/components/` — AIThemeGenerator, HctThemeGenerator, FigmaImporter, TokenEditor, DarkModeGenerator, FigmaPluginExporter, ThemeExporter
- `stores/themeStore.ts` — UnifiedThemeStore (Supabase CRUD)
- `types/theme/index.ts` — DesignToken, DesignTheme 등 (420줄)
- `packages/specs/src/primitives/colors.ts` — Skia용 S2 색상 맵 (ADR-022 전환 완료, hex 정적)
- `packages/specs/src/renderers/utils/tokenResolver.ts` — S2 TokenRef → hex/CSSVar 변환 (ADR-022 전환 완료)
- `specShapeConverter.ts` — Spec → Float32Array (Skia 렌더링)

---

## 업계 리서치

### 주요 빌더 테마 시스템 비교

| 항목              | Webflow            | Framer       | Figma Variables | Squarespace     | shadcn/ui        | Radix Themes       | Penpot         | Plasmic                | Builder.io    | Wix Studio         | Pencil App            |
| ----------------- | ------------------ | ------------ | --------------- | --------------- | ---------------- | ------------------ | -------------- | ---------------------- | ------------- | ------------------ | --------------------- |
| **토큰 계층**     | Primitive→Semantic | Color Styles | Aliasing N계층  | 5색→10테마 파생 | Semantic (2계층) | 12-step scale      | 2계층          | CSS var + Plasmic 토큰 | Design Tokens | Site Theme (3계층) | Multi-axis Variable   |
| **색상 포맷**     | HEX                | UI Picker    | HEX             | UI Picker       | OKLCH            | CSS var + P3       | HEX            | HEX/CSS                | JSON          | HEX                | HEX (JSON 저장)       |
| **Light/Dark**    | Variable Modes     | Style 내장   | Mode 전환       | 10단계 밝기     | `.dark` class    | `.dark` class      | Variable Modes | Global Variants        | Targeting     | 자동 생성          | Theme Axis (N차원)    |
| **섹션별 테마**   | class 적용         | 컴포넌트별   | 프레임별 Mode   | 섹션별 테마     | 컨테이너 class   | `data-accent` prop | 프레임별       | Component variants     | Targeting     | 컴포넌트별         | Node 상속 체인        |
| **컴포넌트 레벨** | ✗                  | ✗            | ✗               | ✗               | ✗                | `color` prop       | ✗              | ✗                      | ✗             | ✗                  | `effectiveTheme` 상속 |
| **프리셋**        | 3종                | Light/Dark   | 없음            | 다수 큐레이션   | 5종 base         | 30색 프리셋        | 없음           | 프리셋 없음            | 없음          | 다수               | 없음                  |
| **편집 위치**     | 인라인 패널        | Assets 패널  | Variables 패널  | Site Styles     | globals.css      | Theme Provider     | 인라인 패널    | 인라인 패널            | Studio 패널   | 인라인 패널        | 인라인 패널           |
| **W3C DTCG**      | ✗                  | ✗            | 부분            | ✗               | ✗                | ✗                  | ✗              | ✗                      | ✓ 호환        | ✗                  | ✗                     |

### Pencil App 테마 아키텍처 (역설계 분석)

Pencil은 **다차원 테마 축(Multi-dimensional Theme Axes)** 패턴을 사용한다:

```typescript
// Pencil VariableManager 핵심 구조
class VariableManager {
  _themes: Map<string, string[]>; // 테마 축 정의 — { "Mode": ["Light", "Dark"], "Brand": ["A", "B"] }
  _variables: Map<string, Variable>; // 변수 — 테마 조합별 값 보유

  unsafeSetThemes(axisName, values); // 축 추가/수정 → undo/redo 연동
  unsafeAddVariable(name, type, values);
  getDefaultTheme(): Record<string, string>; // 각 축의 첫 번째 값
}

// 변수 값은 테마 조합별로 저장
interface Variable {
  type: "color" | "number" | "string";
  value: Array<{
    value: string;
    theme: Record<string, string>; // { "Mode": "Light", "Brand": "A" }
  }>;
}

// 노드별 테마 상속 체인
interface Node {
  theme: Record<string, string>; // 노드 직접 설정
  inheritedTheme: Record<string, string>; // 부모 체인에서 상속
  effectiveTheme: Record<string, string>; // theme ∪ inheritedTheme (merge)
  resolveVariables(): Record<string, string>; // effectiveTheme 기반 변수 해석
}
```

**Pencil 패턴의 장점:**

- **N차원 축** — Light/Dark뿐 아니라 Brand, Density 등 임의 축 추가 가능
- **노드별 테마 상속** — 부모 설정이 자식에게 자동 전파, 하위 노드에서 축별 오버라이드
- **undo/redo 내장** — 테마 변경이 히스토리 시스템과 통합

**한계:**

- 과도한 유연성 → 사용자 UX 복잡도 증가
- 축 × 값 조합 폭발 (3축 × 3값 = 27 조합)

### Radix Themes 12-step Semantic Scale

Radix Themes는 **단일 `accentColor` prop으로 12-step 시맨틱 스케일을 자동 생성**하는 패턴:

```tsx
// 1. 앱 레벨: 전역 accent 설정
<Theme accentColor="indigo" grayColor="slate" radius="medium">

// 2. 컴포넌트 레벨: 개별 accent 오버라이드
<Button color="crimson">Delete</Button>  // 이 버튼만 빨간색

// 3. 자동 생성되는 12-step scale:
// Step 1~2:  Backgrounds (subtle, component)
// Step 3~5:  Interactive (hover, active, selected)
// Step 6~8:  Borders (subtle, element, hover)
// Step 9~10: Solid (background, hover)
// Step 11~12: Text (low-contrast, high-contrast)
```

**composition Tint System + S2 토큰 대응 (ADR-022 기반):**

| Radix Step | 용도               | composition Tint 대응 | S2 Spec 토큰 (ADR-022)   | CSS 시맨틱 변수                 |
| ---------- | ------------------ | --------------------- | ------------------------ | ------------------------------- |
| 1          | App background     | —                     | —                        | —                               |
| 2          | Subtle background  | `--tint-200`          | `{color.accent-subtle}`  | `var(--color-primary-100)`      |
| 3~5        | Interactive        | `--tint-300~500`      | —                        | color-mix 자동 파생             |
| 6~8        | Borders            | `--tint-600~800`      | —                        | color-mix 자동 파생             |
| 9          | **Solid bg**       | `--tint-900`          | `{color.accent}`         | `--highlight-background` (기존) |
| 10         | Solid hover        | `--tint-1000`         | `{color.accent-hover}`   | color-mix 85%                   |
| —          | Solid pressed      | `--tint-1100`         | `{color.accent-pressed}` | color-mix 75%                   |
| —          | On accent text     | —                     | `{color.on-accent}`      | `--highlight-foreground`        |
| 11         | Low-contrast text  | `--tint-1100`         | —                        | `--focus-ring-color`            |
| 12         | High-contrast text | `--tint-1200`         | —                        | `--link-color`                  |

→ Radix 12-step 중 step 9~10 + on-accent이 S2 `accent` 계열과 직접 대응. Step 1~8, 11~12는 CSS `--tint-*` 변수로만 커버 (Spec 토큰 불필요).

### 핵심 인사이트

1. **인라인 편집이 표준** — Webflow, Framer, Figma, Penpot, Plasmic, Wix 모두 빌더 내 패널에서 테마 편집
2. **소수 색상 → 자동 파생이 트렌드** — Squarespace(5색→10테마), Radix(1색→12step), composition Tint(1색→16스케일)
3. **OKLCH가 대세** — shadcn/ui, Tailwind v4 모두 채택. composition 이미 사용 중
4. **CSS 변수 기반 전환** — 모든 시스템이 CSS 변수 교체로 테마 전환. DB 기반은 없음
5. **2계층 구조 보편화** — Primitive(원시) → Semantic(시맨틱) 참조 패턴
6. **컴포넌트 레벨 accent가 차별 포인트** — Radix의 `color` prop은 유일한 컴포넌트 단위 accent 오버라이드 → composition에 `data-accent` 속성으로 도입 가능
7. **W3C DTCG (2025.10 안정판)** — 벤더 중립 JSON 토큰 포맷 표준화. Builder.io가 선두 채택. 향후 Figma/Penpot 호환 고려 시 참조
8. **Pencil의 N차원 축은 과도** — 빌더 사용자에게는 Light/Dark + accent 선택 수준이 적정. 축 추가는 Advanced 옵션으로

---

## Alternatives Considered

### 대안 A: Theme Studio 리팩토링 (기존 DB 구조 유지)

- **설명**: ThemeStudio를 새 창에서 Builder 우측 패널로 이동. Supabase 토큰 DB 스키마 유지, UI만 인라인화.
- **위험**:
  - 기술: **L** — UI 이동만으로 기존 코드 대부분 재사용
  - 성능: **M** — DB 왕복이 여전히 존재 (색상 변경마다 Supabase CRUD)
  - 유지보수: **H** — Tint System과 DB 토큰 이중 관리 지속, CSS 변수 ↔ DB 동기화 복잡도 유지
  - 마이그레이션: **L** — 최소 변경

### 대안 B: CSS 변수 네이티브 테마 (DB 토큰 폐기)

- **설명**: Tint System + Tailwind 색상을 SSOT로. 테마 설정을 프로젝트 메타데이터(JSON)로 저장. ThemesPanel을 인라인 편집 패널로 교체.
- **위험**:
  - 기술: **M** — CSS 변수 주입 파이프라인 재설계 필요
  - 성능: **L** — DB 왕복 제거, CSS 변수 즉시 적용
  - 유지보수: **L** — 단일 소스(CSS 변수), 이중 관리 제거
  - 마이그레이션: **H** — 기존 ThemeStudio/Store/DB 스키마 전면 교체

### 대안 C: 하이브리드 (Tint CSS 우선 + DB 커스텀 토큰 유지)

- **설명**: 기본 테마는 CSS 변수(Tint + Tailwind)로 처리, 고급 커스텀 토큰만 DB에 저장. 인라인 패널에서 기본 편집, 고급 토큰은 별도 뷰.
- **위험**:
  - 기술: **M** — 두 시스템 경계 관리 필요
  - 성능: **L** — 기본 테마는 CSS만, 커스텀만 DB
  - 유지보수: **M** — 경계가 명확하면 관리 가능, 불명확하면 혼란
  - 마이그레이션: **M** — 기본 테마 부분만 전환, DB 일부 유지

### Risk Threshold Check

- 대안 A: 유지보수 HIGH → 신규 대안 검토 ✓ (대안 B, C 존재)
- 대안 B: 마이그레이션 HIGH → 위험 수용 근거 필요
- 대안 C: HIGH 없음, 전체 MEDIUM 이하

---

## Decision

**대안 B: CSS 변수 네이티브 테마** 선택

### 위험 수용 근거 (마이그레이션 HIGH)

1. **기존 ThemeStudio 사용률 극히 낮음** — 새 창 분리로 인해 실제 사용자 워크플로우에서 거의 미사용
2. **ADR-017/022로 M3→S2 전환 완료** — CSS 변수 + Spec 토큰이 S2 체계로 통일, DB 토큰은 구 구조 유지 → 정리 시점
3. **Tint System이 이미 SSOT 역할** — `preview-system.css`가 실질적 테마 엔진, DB 토큰은 중복
4. **단계적 마이그레이션으로 위험 완화** — Phase A(최소 기능)부터 점진 전환, 기존 코드는 Phase D에서 제거

### 설계 개요

#### 1. 테마 데이터 모델 (JSON in project metadata)

```typescript
interface ThemeConfig {
  // Accent Color
  tint: TintPreset | CustomTint;

  // Neutral Color (gray scale)
  neutral: NeutralPreset; // 'slate' | 'gray' | 'zinc' | 'neutral' | 'stone'

  // Semantic Overrides (선택)
  overrides?: {
    [key: string]: string; // e.g., '--highlight-background': '#custom'
  };

  // Dark Mode
  darkMode: {
    enabled: boolean;
    default: "light" | "dark" | "system";
  };

  // Border Radius Scale
  radiusScale: "none" | "sm" | "md" | "lg" | "xl";

  // Component-level Accent Overrides (Radix Themes 패턴)
  // 특정 컴포넌트 태그에 다른 accent 색상 적용
  componentOverrides?: {
    [tag: string]: TintPreset; // e.g., { "button-error": "red", "tag-success": "green" }
  };
}

type TintPreset =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "turquoise"
  | "cyan"
  | "blue"
  | "indigo"
  | "purple"
  | "pink";

interface CustomTint {
  type: "custom";
  hue: number; // 0-360
  chroma: number; // 0-0.4
}

type NeutralPreset = "slate" | "gray" | "zinc" | "neutral" | "stone";
```

#### 1.1. Accent Scale 매핑 (Radix 12-step → Tint System)

Tint System의 `--tint-100`~`--tint-1600` oklch 스케일을 Radix의 12-step 시맨틱 역할에 매핑:

```css
:root {
  /* 12-step semantic scale (자동 생성) */
  --accent-1: var(--tint-100); /* App background */
  --accent-2: var(--tint-200); /* Subtle background */
  --accent-3: var(--tint-300); /* Component background */
  --accent-4: var(--tint-400); /* Hover */
  --accent-5: var(--tint-500); /* Active/Selected */
  --accent-6: var(--tint-600); /* Subtle border */
  --accent-7: var(--tint-700); /* Element border */
  --accent-8: var(--tint-800); /* Border hover */
  --accent-9: var(--tint-900); /* Solid background (= --highlight-background) */
  --accent-10: var(--tint-1000); /* Solid hover */
  --accent-11: var(--tint-1100); /* Low-contrast text */
  --accent-12: var(--tint-1200); /* High-contrast text */
}

/* 컴포넌트 레벨 accent 오버라이드 (Radix color prop 패턴) */
[data-accent="red"] {
  --tint: var(--red);
}
[data-accent="green"] {
  --tint: var(--green);
}
[data-accent="purple"] {
  --tint: var(--purple);
}
/* ... 10개 프리셋 자동 생성 */
```

이 매핑은 기존 시맨틱 토큰과 호환:

- `--highlight-background` = `--accent-9` (기존 코드 변경 불필요)
- `--focus-ring-color` = `--accent-10`
- `--link-color` = `--accent-12`

#### 2. 테마 적용 파이프라인 (3경로 동시 반영)

```
ThemePanel (인라인 편집)
  ↓ Zustand store 업데이트 (즉시)
  ↓
ThemeConfig
  ├─→ generateThemeCSS() → CSS 변수 문자열
  │     ├─→ Preview iframe (postMessage → <style id="theme-vars">)
  │     └─→ Publish 빌드 시 정적 CSS 파일
  │
  ├─→ updateSkiaColors() → Spec TokenRef 색상 맵 갱신
  │     ├─→ colors.ts의 lightColors/darkColors 동적 업데이트
  │     ├─→ Tint → oklch 계산 → hex 변환 → Float32Array
  │     └─→ registryVersion++ → Skia 캐시 무효화 → 캔버스 재렌더링
  │
  └─→ 프로젝트 메타데이터에 JSON 저장 (비동기, Supabase projects 테이블)
```

**Skia-CSS 색상 일치 보장 (ADR-022 S2 토큰 기반):**

- `ThemeConfig.tint` → oklch 계산 → CSS `--tint` 변수 + S2 accent hex 동시 생성
- Neutral 프리셋 → Tailwind 색상 → CSS `--color-neutral-*` + S2 neutral/surface/border hex 동시 갱신
- Dark Mode 토글 → `data-theme` 속성 + `resolveToken()` theme 파라미터 동시 전환

**S2 토큰의 Tint 파생 분류 (ADR-022 기반):**

| 분류              | S2 토큰                                                                                                                                                                               | Tint 변경 시 | Neutral 변경 시 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | --------------- |
| **Tint 파생**     | `accent`, `accent-hover`, `accent-pressed`, `on-accent`, `accent-subtle`                                                                                                              | ✅ 갱신      | —               |
| **Neutral 파생**  | `neutral`, `neutral-subdued`, `neutral-subtle`, `neutral-hover`, `neutral-pressed`, `base`, `layer-1`, `layer-2`, `elevated`, `disabled`, `border`, `border-hover`, `border-disabled` | —            | ✅ 갱신         |
| **고정 (상태색)** | `negative`, `negative-*`, `informative`, `positive`, `notice` + subtle                                                                                                                | —            | —               |
| **특수**          | `transparent`, `white`, `black`                                                                                                                                                       | —            | —               |

→ `updateSkiaColors()` 구현 시 tint 파생(5개)과 neutral 파생(13개)만 동적 갱신하면 됨

#### 3. 인라인 Theme Panel UI 구성

```
┌─ Theme Panel ──────────────┐
│                            │
│ Accent Color               │
│ ┌──────────────────────┐   │
│ │ 🔴🟠🟡🟢🔵🟣  ···  │   │ ← 10개 Tint 프리셋 그리드
│ │ [Custom Color Picker] │   │ ← 커스텀 색상 (hue/chroma)
│ └──────────────────────┘   │
│                            │
│ Neutral Tone               │
│ [Slate ▾]                  │ ← 5개 프리셋 드롭다운
│                            │
│ Dark Mode                  │
│ [○ Light  ● Dark  ○ Auto] │ ← 3-way 토글
│                            │
│ Border Radius              │
│ [none|sm|md|lg|xl]         │ ← 5단계 슬라이더
│                            │
│ ─── Preview ───            │
│ ┌────────────────────┐     │
│ │  Button  [Input ]  │     │ ← 실시간 미니 프리뷰
│ │  Link    Card       │     │
│ └────────────────────┘     │
│                            │
│ ─── Advanced ───           │
│ [▸ Semantic Overrides]     │ ← 접을 수 있는 고급 섹션
└────────────────────────────┘
```

#### 4. CSS 생성 함수

```typescript
function generateThemeCSS(config: ThemeConfig): string {
  const lines: string[] = [":root {"];

  // 1. Tint 설정
  if (typeof config.tint === "string") {
    lines.push(`  --tint: var(--${config.tint});`);
  } else {
    lines.push(
      `  --tint: oklch(0.55 ${config.tint.chroma} ${config.tint.hue});`,
    );
  }

  // 2. Neutral 색상 매핑 (Tailwind 색상 참조)
  for (const step of [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]) {
    lines.push(
      `  --color-neutral-${step}: var(--color-${config.neutral}-${step});`,
    );
  }

  // 3. Border Radius Scale
  const radiusMap = {
    none: "0",
    sm: "0.25rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
  };
  lines.push(`  --radius-base: ${radiusMap[config.radiusScale]};`);

  // 4. Semantic Overrides
  if (config.overrides) {
    for (const [key, value] of Object.entries(config.overrides)) {
      lines.push(`  ${key}: ${value};`);
    }
  }

  lines.push("}");

  // 5. Dark Mode
  if (config.darkMode.enabled) {
    lines.push('[data-theme="dark"] {');
    // lightness scale 반전은 preview-system.css에 이미 정의됨
    // 추가 다크모드 오버라이드만 여기에
    lines.push("}");
  }

  return lines.join("\n");
}
```

#### 5. Tailwind v4 Neutral 색상 통합

현재 `shared-tokens.css`의 `--color-neutral-*`을 Tailwind 프리셋으로 교체 가능하게:

| Neutral 프리셋 | 특성             | 사용 예     |
| -------------- | ---------------- | ----------- |
| `slate`        | 청회색 (cool)    | 모던/테크   |
| `gray`         | 순수 회색        | 범용        |
| `zinc`         | 약간 따뜻한 회색 | 깔끔한 느낌 |
| `neutral`      | 완전 중립        | 미니멀      |
| `stone`        | 난색 회색 (warm) | 따뜻한 느낌 |

---

## Implementation Plan

### Phase A: 인라인 Theme Panel + 3경로 동시 반영 (최소 기능)

**목표**: ThemesPanel을 편집 가능한 인라인 패널로 교체, CSS Preview + Skia + Publish 동시 반영

**전제**: ADR-022 완료 — `colors.ts`/`tokenResolver.ts`가 S2 토큰 체계(`accent`/`neutral`/`negative` 등)로 전환 완료. 토큰 이름 변경 불필요, **hex 값의 동적 갱신만 구현**.

**작업 범위:**

1. `ThemePanel.tsx` 신규 작성 — Accent Color 프리셋 선택 + Dark Mode 토글
2. `themeConfigStore.ts` 신규 — `ThemeConfig` Zustand store (로컬 상태 우선)
3. `generateThemeCSS.ts` 신규 — ThemeConfig → CSS 변수 문자열 변환 (Preview/Publish용)
4. `updateSkiaColors.ts` 신규 — ThemeConfig → S2 색상 맵 동적 갱신 (Skia용)
   - Tint oklch → hex 변환 (`culori` 라이브러리)
   - Tint 파생 5개: `accent`, `accent-hover`, `accent-pressed`, `on-accent`, `accent-subtle`
   - `colors.ts`의 `lightColors`/`darkColors` 런타임 업데이트 (S2 키 그대로, 값만 교체)
   - `registryVersion++` → Skia 캐시 무효화 → 캔버스 자동 재렌더링
5. Preview iframe에 CSS 주입 (`postMessage` → `<style id="theme-vars">`)
6. 기존 ThemesPanel을 새 ThemePanel로 교체

**ADR-022 덕분에 범위 축소된 항목:**

- ~~ColorTokens 인터페이스 변경~~ → S2 전환 완료
- ~~COLOR_TOKEN_TO_CSS 매핑 변경~~ → S2 전환 완료
- ~~Spec TokenRef 일괄 변환~~ → S2 전환 완료

**변경 파일**: ~6개 신규, 2개 수정 (패널 레지스트리, colors.ts를 동적으로 전환)
**위험**: M → **L** (ADR-022로 토큰 정합 완료, oklch↔hex 변환만 남음)

### Phase B: Neutral Tone + Radius + 미니 프리뷰

**목표**: 전체 테마 커스터마이징 완성

**작업 범위:**

1. Neutral 프리셋 드롭다운 (5종 Tailwind gray scale)
2. `updateSkiaColors.ts` 확장 — Neutral 파생 13개 S2 토큰 동적 갱신:
   - `neutral`, `neutral-subdued`, `neutral-subtle`, `neutral-hover`, `neutral-pressed`
   - `base`, `layer-1`, `layer-2`, `elevated`, `disabled`
   - `border`, `border-hover`, `border-disabled`
3. Border Radius 스케일 선택 (5단계)
4. 인라인 미니 프리뷰 컴포넌트 (Button, Input, Card 샘플)
5. 커스텀 Tint 색상 피커 (hue/chroma 슬라이더)

**변경 파일**: ~4개 신규/수정
**위험**: L

### Phase C: IndexedDB 영속화 + Publish 통합

**목표**: ThemeConfig를 IndexedDB에 저장/복원, Publish 앱에서 정적 테마 적용

**전제**: composition는 IndexedDB 기반 로컬 저장. Supabase는 대시보드에서 사용자가 명시적으로 연동할 때만 접근.

**작업 범위:**

1. 프로젝트 IndexedDB에 `themeConfig` 키로 JSON 저장
2. 프로젝트 로딩 시 ThemeConfig 복원 → CSS 주입 + Skia 색상 맵 갱신
3. ThemeConfig 변경 시 IndexedDB 비동기 저장 (디바운스)
4. **Publish 빌드**: `generateThemeCSS(config)` → `theme.css` 정적 파일 생성
5. **Publish 런타임**: `theme_config` JSON 로드 → CSS 변수 적용 + `data-theme` 설정
6. (선택) 대시보드 Supabase 연동 시 ThemeConfig도 프로젝트 메타데이터에 포함하여 동기화

**변경 파일**: ~3개 수정 (Builder 로딩, Publish App, Publish 빌드)
**위험**: L (DB 마이그레이션 불필요, IndexedDB는 기존 패턴 재사용)

### Phase D: 레거시 정리

**목표**: 구 ThemeStudio 및 관련 코드 제거

**작업 범위:**

1. `ThemeStudio.tsx` + 7개 서브 컴포넌트 제거
2. `themeStore.ts` (UnifiedThemeStore) 제거 또는 축소
3. `/theme/:projectId` 라우트 제거
4. `types/theme/index.ts` 간소화 — `ThemeConfig` 중심으로
5. Supabase 관련 테마 서비스 코드 제거 (대시보드 연동과 무관한 구 CRUD)

**변경 파일**: ~15개 삭제, ~5개 수정
**위험**: M (삭제 범위 넓지만 Phase A-C에서 대체 완료 후 진행)

### Phase E (선택): 컴포넌트/섹션별 Accent 오버라이드 (Radix 패턴)

**목표**: Radix Themes의 `color` prop 패턴을 도입하여 컴포넌트/섹션 단위 accent 오버라이드

**작업 범위:**

1. `data-accent` 속성으로 Tint 오버라이드 (CSS 스코프 자동 전환)
   ```css
   /* preview-system.css에 추가 */
   [data-accent="red"] {
     --tint: var(--red);
   }
   [data-accent="green"] {
     --tint: var(--green);
   }
   /* ... 10개 프리셋 */
   ```
2. Inspector에 "Accent Color" 드롭다운 (요소 선택 시 해당 요소와 자식에만 적용)
3. 요소 `customProps`에 `accentColor` 저장 → Preview/Publish에서 `data-accent` 렌더링
4. Skia 경로: `data-accent` 감지 시 해당 서브트리의 TokenRef 색상 맵 오버라이드
5. 섹션(Container/Card) 단위로 다른 accent 적용 → 자식 요소 자동 상속 (CSS cascade)

**Radix 패턴과 차이:**

- Radix: React prop (`<Button color="red">`) → CSS class 주입
- composition: `data-accent` 속성 → CSS 변수 스코프 전환 (React 없이 순수 CSS)
- composition 장점: Preview/Publish 양쪽에서 동일 CSS로 동작, Skia도 동일 로직

**위험**: M (CSS 스코프 관리 복잡도, Skia 서브트리 색상 오버라이드 구현)

---

## Implementation Status (2026-03-09)

### Phase A: 구현 완료 ✅

| 파일                              | 작업       | 설명                                                                         |
| --------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| `stores/themeConfigStore.ts`      | **신규**   | ThemeConfig Zustand store — tint/darkMode/neutral/radiusScale + themeVersion |
| `utils/theme/tintToSkiaColors.ts` | **신규**   | Tint 프리셋 → lightColors/darkColors accent 5개 토큰 mutation (oklch→hex)    |
| `utils/theme/oklchToHex.ts`       | **신규**   | oklch → hex 변환 유틸리티                                                    |
| `panels/themes/ThemesPanel.tsx`   | **재작성** | 인라인 편집 패널 — TintGrid(10색) + Mode/Tone/Scale PropertySelect           |
| `panels/themes/ThemesPanel.css`   | **수정**   | TintSwatch + MiniPreview CSS                                                 |
| `panels/core/panelConfigs.ts`     | **수정**   | ThemesPanel 패널 등록                                                        |
| `main/BuilderCore.tsx`            | **수정**   | Preview iframe에 THEME_VARS postMessage 전송                                 |

### Phase B: 구현 완료 ✅

| 파일                                 | 작업     | 설명                                                                    |
| ------------------------------------ | -------- | ----------------------------------------------------------------------- |
| `utils/theme/neutralToSkiaColors.ts` | **신규** | Neutral 프리셋(5종) → lightColors/darkColors neutral 13개 토큰 mutation |
| `panels/themes/MiniThemePreview.tsx` | **신규** | CSS 변수 기반 미니 프리뷰 (inline `--mp-*` 변수로 즉시 반영)            |

### Phase C: 구현 완료 ✅

**설계 변경**: IndexedDB → **localStorage** 선택 (ThemeConfig은 ~100B JSON, DB 마이그레이션 불필요)

| 파일                                        | 작업     | 설명                                                                                        |
| ------------------------------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `stores/themeConfigStore.ts`                | **수정** | localStorage 영속화 (`composition-theme-config-{projectId}`) + `initThemeConfig(projectId)` |
| `utils/theme/generateThemeCSS.ts`           | **신규** | ThemeConfig → CSS 변수 문자열 (Publish/Export용)                                            |
| `main/BuilderCore.tsx`                      | **수정** | initThemeConfig 호출 + handlePublish/Preview themeCSS 통합                                  |
| `packages/shared/src/utils/export.utils.ts` | **수정** | generateStaticHtml에 `themeCSS` 파라미터 추가                                               |
| `apps/publish/src/App.tsx`                  | **수정** | sessionStorage에서 themeConfig 복원 → CSS 변수 주입                                         |

### 패치 내역

| 날짜       | 문제                                               | 원인                                                                          | 수정                                                                                            |
| ---------- | -------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 2026-03-05 | CSS Preview에 tint 변경 미반영                     | BuilderCore가 `cssVar` 필드 전송, Preview는 `name` 필드 기대                  | `cssVar` → `name` 변경                                                                          |
| 2026-03-05 | Neutral/Radius 변경 시 Tint 색상 초기화            | `setThemeVars`가 전체 배열 교체 (merge 아님)                                  | `name+isDark` 키 기반 merge 로직 추가                                                           |
| 2026-03-05 | Neutral/Radius 변경해도 Preview 무반응             | Neutral이 `var(--color-slate-50)` 전송 (Preview에 미정의)                     | NEUTRAL_PALETTES에서 hex 값 직접 전송                                                           |
| 2026-03-05 | MiniThemePreview가 Neutral/Radius 변경에 무반응    | Builder DOM의 전역 CSS 변수에 의존 (업데이트 안 됨)                           | Store 직접 구독 + inline `--mp-*` CSS 변수 계산                                                 |
| 2026-03-05 | 새로고침 시 CSS Preview 색상 초기화 (WebGL은 유지) | initThemeConfig이 iframe ready 전에 실행 → subscribe 미등록                   | iframe ready 시 즉시 현재 config 전송 + subscribe                                               |
| 2026-03-05 | Dark mode 전환 시 CSS Preview 무반응               | `SET_DARK_MODE` postMessage 미전송                                            | `sendThemeConfigToIframe` 헬퍼에 SET_DARK_MODE 추가                                             |
| 2026-03-05 | Dark mode가 Skia/WebGL에 미적용                    | `specShapesToSkia`에 `"light"` 하드코딩 + `setDarkMode`가 themeVersion 미증가 | `useResolvedSkiaTheme()` 도입, `skiaTheme` 전달, `themeVersion++` + `notifyLayoutChange()` 추가 |
| 2026-03-05 | Dark mode 시 Body 배경 미전환                      | BodyLayer backgroundColor fallback이 `0xffffff` 고정                          | `resolveSkiaTheme` 기반으로 `lightColors.base`/`darkColors.base` fallback 전환                  |

### 핵심 구현 파일 (최종)

| 파일                                 | 역할                                                                 |
| ------------------------------------ | -------------------------------------------------------------------- |
| `stores/themeConfigStore.ts`         | 중앙 상태 관리 + localStorage 영속화 + `resolveSkiaTheme()`          |
| `utils/theme/tintToSkiaColors.ts`    | Tint → Skia accent 색상 동기화 (lightColors/darkColors mutation)     |
| `utils/theme/neutralToSkiaColors.ts` | Neutral → Skia neutral 색상 동기화 (lightColors/darkColors mutation) |
| `utils/theme/oklchToHex.ts`          | oklch → hex 변환                                                     |
| `utils/theme/generateThemeCSS.ts`    | ThemeConfig → CSS 문자열 (Publish/Export)                            |
| `panels/themes/ThemesPanel.tsx`      | 인라인 테마 편집 UI                                                  |
| `panels/themes/MiniThemePreview.tsx` | CSS 변수 기반 미니 프리뷰                                            |
| `main/BuilderCore.tsx`               | iframe 동기화 + Publish/Preview 통합                                 |
| `sprites/ElementSprite.tsx`          | `skiaTheme` 전달 (`specShapesToSkia` 두 번째 인자)                   |
| `layers/BodyLayer.tsx`               | Dark mode 시 Body 배경 `{color.base}` 토큰 기반 전환                 |

### Phase E: 구현 완료 ✅

**목표**: Radix Themes `color` prop 패턴 — 컴포넌트/섹션별 accent 오버라이드

| 파일                               | 작업     | 설명                                                                  |
| ---------------------------------- | -------- | --------------------------------------------------------------------- |
| `preview-system.css`               | **수정** | `[data-accent="xxx"]` 10개 규칙 추가 (CSS cascade로 자식 자동 상속)   |
| `LayoutRenderers.tsx`              | **수정** | 7개 컨테이너 렌더러에 `data-accent` 속성 추가                         |
| `apps/publish/ElementRenderer.tsx` | **수정** | `accentColor` prop → `data-accent` 속성 렌더링                        |
| `utils/theme/tintToSkiaColors.ts`  | **수정** | `withAccentOverride()` — 동기 mutation+restore 패턴 (Skia 서브트리용) |
| `sprites/ElementSprite.tsx`        | **수정** | 부모 체인 accent 탐색 + `withAccentOverride` 래핑                     |
| `editors/PanelEditor.tsx`          | **수정** | "Accent Color" PropertySelect 추가 (10 tint + Default)                |
| `editors/CardEditor.tsx`           | **수정** | "Accent Color" PropertySelect 추가 (10 tint + Default)                |

---

## Gates

| Gate | 시점            | 조건                                                                                    | 위험 대응                     |
| ---- | --------------- | --------------------------------------------------------------------------------------- | ----------------------------- |
| G1   | Phase A 완료    | Tint 프리셋 10종 변경 시 **CSS Preview + Skia 캔버스** 동시 반영 확인                   | 실패 시 기존 ThemesPanel 복원 |
| G1.1 | Phase A 완료    | **Skia-CSS 색상 일치 검증**: S2 `accent` 토큰이 캔버스와 Preview에서 같은 색상 (ΔE < 2) | oklch→hex 변환 정밀도 검증    |
| G2   | Phase B 완료    | Neutral 5종 전환 시 전체 gray scale 일관 교체 확인 (3경로 모두)                         | shared-tokens.css 호환성 검증 |
| G3   | Phase C 완료    | 새로고침 후 테마 설정 복원 (IndexedDB) + **Publish 정적 CSS 정상** + Skia 색상 복원     | IndexedDB 키 충돌 방지 확인   |
| G4   | Phase D 시작 전 | Phase A-C 전체 안정화 2주 이상 운영                                                     | 조기 삭제 방지                |

---

## Consequences

### Positive

1. **워크플로우 통합** — 새 창 전환 없이 Builder 내에서 테마 편집 완료
2. **즉시 반영** — CSS 변수 교체로 DB 왕복 없이 실시간 프리뷰
3. **코드 대폭 감소** — ThemeStudio 7개 서브뷰 + UnifiedThemeStore + DB 서비스 제거 (~2,000줄+)
4. **Tint System 정합성** — ADR-017에서 도입한 Tint System을 사용자 인터페이스로 완성
5. **ADR-022 S2 토큰 활용** — S2 체계 전환 완료 기반으로 Skia 동적 갱신이 토큰 키 변경 없이 값만 교체하면 됨
6. **업계 표준 정렬** — Webflow/Framer/shadcn 수준의 인라인 테마 편집 UX
7. **Tailwind v4 통합** — Neutral 프리셋으로 Tailwind 색상 체계를 직접 활용

### Negative

1. **구 ThemeStudio 코드 폐기** — ThemeStudio 서브뷰 7개 + UnifiedThemeStore 제거 (Supabase 테마 테이블은 대시보드 연동과 무관)
2. **고급 토큰 기능 축소** — HCT 생성, Figma Import 등 제거 (사용률 미미하나 재도입 시 비용 발생)
3. **커스텀 색상 제한** — Tint 프리셋 10종 + 커스텀 hue/chroma로 범위 제한 (개별 토큰 세밀 제어 불가)

---

## References

### Phase D: 구현 완료 (2026-03-08)

#### 1차 (이전): ThemeStudio + 라우트 제거

- `ThemeStudio.tsx` + 7개 서브 컴포넌트 삭제
- `/theme/:projectId` 라우트 제거
- `themeStore.ts` Theme CRUD 메서드 제거

#### 2차 (2026-03-08): 레거시 서비스 슬림화

| 파일                      | 변경     | 상세                                                                             |
| ------------------------- | -------- | -------------------------------------------------------------------------------- |
| `useThemeManager.ts`      | **삭제** | BuilderCore에 직접 인라인 (loadActiveTheme, injectThemeCSS)                      |
| `hooks/index.ts`          | 수정     | useThemeManager export 제거                                                      |
| `BuilderCore.tsx`         | 수정     | useThemeManager → useUnifiedThemeStore 직접 사용                                 |
| `ThemeService.ts`         | 슬림화   | 14개 → 2개 메서드 (getActiveTheme, createTheme). Realtime/Supabase RPC/캐싱 제거 |
| `TokenService.ts`         | 슬림화   | 16개 → 6개 메서드. Realtime/검색/통계/W3C Import-Export 제거                     |
| `services/theme/index.ts` | 수정     | UpdateThemeInput export 제거                                                     |

**보존된 이유 (전체 삭제 불가)**:

- `themeStore.ts`: DesignToken/DesignVariable CRUD가 VariableBindingButton, designKitStore, useResolvedElement에서 활성 사용
- `tokenToCss.ts`: themeStore.injectThemeCSS + useThemeMessenger에서 사용
- `types/theme/index.ts`: 19+ 파일에서 타입 참조

---

## 구현 계획: Phase D 잔여 정리 (이전 계획 — 참조용)

### 현황 분석

Phase D 일부 완료:

- `ThemeStudio.tsx` 삭제 완료, `/theme` 라우트 제거 완료
- `themeStore.ts` (UnifiedThemeStore): Theme CRUD 메서드 제거 완료. 잔존 항목:
  - **Token 상태**: `tokens: DesignToken[]`, `designVariables: DesignVariable[]`
  - **Token 액션**: `loadTokens`, `createToken`, `updateToken`, `updateTokenValue`, `bulkUpsertTokens`, `loadActiveTheme`, `createTheme`
  - **ThemeService 의존**: `import { ThemeService }` — IndexedDB 기반 Theme CRUD
  - **TokenService 의존**: token CRUD 서비스
  - **tokensToCSS, formatCSSVars**: CSS 변수 생성 유틸 (themeConfigStore의 generateThemeCSS와 중복 가능)
- `ThemeService.ts`: IndexedDB 기반 Theme CRUD + Realtime 구독 활성 중
- `themeConfigStore.ts`: Phase A-C 완료. tint/darkMode/neutral/radiusScale + localStorage 영속화가 실질적 SSOT
- `types/theme/index.ts`: DesignTheme/DesignToken/DesignVariable 타입 정의 (~420줄)

### 변경 파일 목록

| 파일                                                         | 구분           | 변경 내용                                                                          |
| ------------------------------------------------------------ | -------------- | ---------------------------------------------------------------------------------- |
| `stores/themeStore.ts`                                       | 삭제 또는 축소 | token CRUD 사용처 없으면 전체 삭제. 사용처 있으면 최소 인터페이스로 축소           |
| `services/theme/ThemeService.ts`                             | 삭제 또는 축소 | themeStore 제거 시 함께 제거. 참조 코드가 남아있으면 최소화                        |
| `services/theme/TokenService.ts`                             | 삭제           | themeStore의 token CRUD와 함께 제거                                                |
| `services/theme/index.ts`                                    | 수정           | 삭제된 서비스 export 정리                                                          |
| `types/theme/index.ts`                                       | 수정           | DesignTheme/DesignToken/DesignVariable 미사용 시 제거, ThemeConfig 중심으로 간소화 |
| `stores/index.ts`                                            | 수정           | themeStore export 제거                                                             |
| `builder/stores/index.ts`                                    | 수정           | themeStore 참조 제거                                                               |
| `utils/theme/tokenToCss.ts`                                  | 삭제           | generateThemeCSS.ts로 대체 완료 시 제거                                            |
| `stores/designKitStore.ts`                                   | 수정           | themeStore 참조 확인 및 제거                                                       |
| `builder/panels/styles/components/VariableBindingButton.tsx` | 수정           | themeStore 참조 확인 및 대체/제거                                                  |
| `builder/workspace/canvas/sprites/useResolvedElement.ts`     | 수정           | themeStore 참조 확인 및 대체/제거                                                  |
| `builder/hooks/useThemeManager.ts`                           | 삭제 또는 수정 | themeConfigStore로 대체 완료 시 제거                                               |
| `builder/workspace/canvas/utils/cssVariableReader.ts`        | 수정           | `invalidateCSSVariableCache` 참조 확인 (themeStore에서 호출 중)                    |
| `main/BuilderCore.tsx`                                       | 수정           | themeStore 관련 초기화/구독 코드 제거                                              |

### 구현 순서

#### Step 1: 사용처 전수 조사

themeStore, ThemeService, TokenService의 실제 import/사용처를 검색하여 참조 그래프를 확정한다.

조사 대상:

1. `import.*themeStore` / `useThemeStore` — 직접 사용처
2. `import.*ThemeService` — 서비스 직접 호출
3. `import.*TokenService` — 토큰 서비스 직접 호출
4. `DesignTheme` / `DesignToken` / `DesignVariable` 타입 참조
5. `tokensToCSS` / `formatCSSVars` — CSS 변수 생성 유틸 사용처
6. `designVariables` — 디자인 변수 기능 사용 여부

**판정 기준**: themeConfigStore가 완전 대체하는 경우 → 삭제. 대체 불가 기능이 있으면 → 최소화 후 보존.

#### Step 2: DesignVariable/Token 기능 분리 판정

`VariableBindingButton.tsx`와 `useResolvedElement.ts`가 디자인 변수/토큰을 실제로 사용하는지 확인:

- **미사용**: themeStore 전체 삭제 진행
- **사용 중**: 디자인 변수 기능을 독립 모듈로 분리하거나, themeConfigStore에 통합 검토

#### Step 3: 안전 삭제 순서

참조 그래프 역순으로 삭제 (leaf → root):

1. `TokenService.ts` 삭제 (themeStore만 import)
2. `tokenToCss.ts` 삭제 (themeStore만 import, generateThemeCSS.ts로 대체)
3. `ThemeService.ts` 삭제 (themeStore만 import)
4. `themeStore.ts` 삭제
5. `useThemeManager.ts` 삭제
6. `types/theme/index.ts` 간소화 — ThemeConfig 관련 타입만 보존
7. 참조 파일들(stores/index.ts, BuilderCore.tsx 등)에서 import 정리

각 삭제 후 `pnpm type-check`로 참조 누락 없음을 검증한다.

#### Step 4: Supabase design_themes/design_tokens 참조 정리

IndexedDB 스키마(`lib/db.ts`)에서 themes/tokens 테이블 참조 확인:

- themeStore 삭제 후에도 IDB 스키마에 테이블 정의가 남아있을 수 있음
- 미사용 테이블 정의 제거 (데이터는 자연 소멸 — 새 프로젝트에서 미생성)
- Supabase design_themes/design_tokens 테이블은 대시보드 연동 범위이므로 이 Phase에서 DB 마이그레이션 불필요

### Gate 검증 항목

| Gate | 검증 내용                    | 통과 조건                                                      |
| ---- | ---------------------------- | -------------------------------------------------------------- |
| D-1  | themeStore 삭제 후 빌드 성공 | `pnpm type-check` + `pnpm build` 통과                          |
| D-2  | 테마 기능 정상 동작          | Tint 변경 → CSS Preview + Skia 동시 반영 (Phase A-C 회귀 없음) |
| D-3  | 새로고침 후 테마 복원        | localStorage에서 ThemeConfig 복원 → CSS/Skia 적용              |
| D-4  | VariableBindingButton 동작   | 디자인 변수 기능이 있었다면 대체 경로 정상 동작 확인           |

### 예상 위험 및 대응

| 위험                     | 등급  | 설명                                                                               | 대응                                                                                                       |
| ------------------------ | ----- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 숨겨진 themeStore 사용처 | **M** | 동적 import나 간접 참조로 전수 조사에서 누락될 수 있음                             | Step 1에서 grep 외에 `pnpm type-check`로 컴파일 타임 검증. 런타임은 수동 테스트(테마 변경, 프로젝트 로드). |
| DesignVariable 기능 의존 | **M** | VariableBindingButton이 디자인 변수를 실제 사용 중이면 삭제 불가                   | Step 2에서 판정 후, 사용 중이면 독립 모듈로 분리하여 themeStore 없이 동작하도록 리팩토링.                  |
| IDB 스키마 호환성        | **L** | 기존 프로젝트의 IDB에 themes/tokens 데이터 잔존 → 스키마 변경 시 마이그레이션 필요 | 테이블 정의만 제거, 데이터는 자연 소멸. IDB 버전 업그레이드 불필요 (미참조 테이블은 무해).                 |
| 삭제 범위 과대           | **L** | 약 10개 파일 삭제/수정으로 diff가 커짐                                             | leaf → root 순서로 하나씩 삭제 + 중간 type-check. 커밋을 step별로 분리하여 롤백 용이하게 유지.             |

---

### 내부 문서

- [ADR-017: CSS Override SSOT — M3 제거 + Tint System](017-css-override-ssot.md)
- [ADR-018: 컴포넌트 CSS 구조 재작성](018-component-css-restructure.md)
- [ADR-022: React Spectrum S2 색상 토큰 체계 전환](022-s2-color-token-migration.md) — ColorTokens S2 전환, Phase A 전제
- [preview-system.css](../../../packages/shared/src/components/styles/theme/preview-system.css) — Tint Color System 구현
- [shared-tokens.css](../../../packages/shared/src/components/styles/theme/shared-tokens.css) — Tailwind 색상 팔레트
- [Pencil 역설계 분석](../../docs/pencil-extracted/) — VariableManager, Node 테마 상속 체인

### 업계 참조

- [Radix Themes](https://www.radix-ui.com/themes/docs/theme/color) — 12-step semantic color scale, `accentColor` + `color` prop 패턴
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming) — OKLCH + CSS 변수 패턴
- [Tailwind CSS v4 Theme](https://tailwindcss.com/docs/theme) — `@theme` 디렉티브
- [Webflow Design Tokens](https://webflow.com/blog/theming-design-tokens) — Primitive + Semantic 2계층
- [Squarespace Color Themes](https://support.squarespace.com/hc/en-us/articles/205815278) — 5색 → 10테마 자동 파생
- [W3C Design Tokens Community Group](https://tr.designtokens.org/format/) — DTCG 표준 (2025.10 안정판)
- [Penpot Design Tokens](https://help.penpot.app/user-guide/design-tokens/) — 오픈소스 디자인 토큰
- [Plasmic](https://docs.plasmic.app/learn/style-tokens/) — CSS var + visual 토큰 편집
