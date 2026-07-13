# ADR-017: React-Aria CSS Override SSOT — M3 제거 + Tailwind 통합

## Status

Implemented (2026-03-04)

> Phase 1~4 전체 완료. M3 토큰 38개 제거, 107개 CSS 파일 시맨틱 치환, Tint Color System 도입, Spec 토큰 전환, Theme Studio 확인.

## Context

### 문제 정의

composition의 모든 react-aria 컴포넌트에서 CSS 스타일이 다수 파일에 걸쳐 중복 선언되어 cascade 오버라이드가 과도하게 발생하고 있다. 근본 원인은 **M3 컬러 시스템이 기존 시맨틱 토큰 위에 불필요하게 중첩**된 것이다.

**정량적 문제 범위:**

| 심각도 | 컴포넌트                                      | 오버라이드 파일 수 | 비고                              |
| ------ | --------------------------------------------- | :----------------: | --------------------------------- |
| 심각   | Button                                        |        15개        | 가장 많은 파일에서 재정의         |
| 심각   | FieldError                                    |        13개        | 거의 모든 필드 컴포넌트에서       |
| 심각   | Label                                         |        11개        | base.css + 개별 필드 CSS          |
| 높음   | Popover                                       |        9개         | 복합 컴포넌트에서 중첩 오버라이드 |
| 높음   | Input / TextArea                              |        8개         | 대표 분석 사례                    |
| 중간   | Dialog, Group, Heading                        |       각 5개       | 복합 컴포넌트 내부 오버라이드     |
| 중간   | CheckboxGroup, SearchField, ListBox, Checkbox |       3~4개        | 날짜/색상 관련 복합 컴포넌트      |

**영향 범위**: shared CSS 79개 파일 + Builder CSS 14개 파일 = **총 93개 CSS 파일** (이 중 M3 토큰 실참조: shared 55개 + builder 52개 = **107개**)

> **참고**: builder 52개에는 ITCSS 레이어 7개(`4-layout/`, `5-modules/`)뿐 아니라 패널 CSS(`panels/styles/components/` 15개, `panels/themes/styles/` 11개, `panels/datatable/` 4개, 기타 패널/오버레이 15개)가 포함됨. 초기 분석에서 builder 7개로 과소평가되었으나 코드베이스 전수 조사로 정정.

### 근본 원인: 토큰 시스템 이중 구조

`preview-system.css`에 **두 시스템이 병존**하고 있다:

```
Lines 8-65:   원본 theme.css 시맨틱 토큰 (→ Tailwind 색상 참조)   ← 현재도 사용 중
Lines 66-144: M3 역할 토큰 (→ Tailwind 색상 참조)                 ← 위에 덮어씌운 것
```

**진화 이력:**

1. `react-aria-starter/src/theme.css` 도입 → ~20개 시맨틱 토큰 (`--text-color`, `--border-color`, `--field-background` 등)
2. M3 컬러 시스템 추가 → 38개 역할 토큰 (`--primary`, `--surface-container`, `--on-surface` 등)
3. 컴포넌트 CSS가 M3 토큰으로 전환 → 기존 시맨틱 토큰과 혼재
4. 결과: **동일한 Tailwind 색상을 가리키는 두 변수 체계가 동시 존재**

```css
/* 같은 Tailwind 색상을 두 변수가 가리킴 */
--text-color: var(--color-neutral-900); /* 원본 시맨틱 */
--on-surface: var(--color-neutral-900); /* M3 추가본 */

--border-color: var(--color-neutral-300); /* 원본 시맨틱 */
--outline-variant: var(--color-neutral-400); /* M3 추가본 */

--field-background: var(--color-neutral-50); /* 원본 시맨틱 */
--surface-container: var(--color-surface-100); /* M3 추가본 */
```

### M3의 과도한 복잡도

| 항목            | 원본 theme.css  |                    M3 추가분                     |
| --------------- | :-------------: | :----------------------------------------------: |
| 시맨틱 토큰 수  |    **~20개**    |                     **38개**                     |
| Surface 단계    | gray scale 직접 |       5단계 (lowest/low/기본/high/highest)       |
| 역할별 토큰     |      없음       | 4역할 × 6토큰 (primary/secondary/tertiary/error) |
| 다크모드 재매핑 |      ~20개      |               38개 추가 (총 ~58개)               |
| 변수 체인 깊이  |       2단       |                       3단                        |

**M3 38개 중 실사용 고빈도는 ~10개** (`--primary`, `--on-surface`, `--outline-variant`, `--surface-container`, `--error` 등). 나머지 ~28개는 저빈도 또는 미사용.

### 구조적 문제

#### 1. 포커스 셀렉터 비일관성

| 패턴             | 파일 수 | 대표 파일                                                           |
| ---------------- | :-----: | ------------------------------------------------------------------- |
| `[data-focused]` |  11개   | base.css, TextField.css, ComboBox.css, SearchField.css 등           |
| `:focus`         |  12개   | ComponentSearch.css, ColorPicker.css, NumberField.css, Table.css 등 |
| `:focus-visible` |   3개   | ChatInput.css, Form.css, ListBox.css                                |
| **혼재**         |   1개   | ListBox.css (`:focus` + `[data-focused]` 동시 사용)                 |

#### 2. Layer 교차 오버라이드

- Builder CSS 14개 파일이 `@layer builder-system`에서 component 스타일을 재정의
- Layer 우선순위: `components` < `builder-system` → builder가 무조건 이김

#### 3. 복합 컴포넌트 확산

- DatePicker, ColorPicker 등이 하위 컴포넌트(Button, Calendar, Input, Popover) 스타일을 부모 CSS에서 재정의
- 한 컴포넌트(예: Button)의 스타일 변경이 15개 파일에 영향

### Hard Constraints

| 제약 조건                                  | 근거                      |
| ------------------------------------------ | ------------------------- |
| Canvas 60fps, 초기 로드 < 3s, 번들 < 500KB | 성능 기준                 |
| react-aria-components 코어 기술 변경 불가  | ADR-002                   |
| `data-*` + CSS 셀렉터 패턴 유지            | 현재 표준 (Phase 4 이후)  |
| `@layer` cascade 구조 유지 (ITCSS)         | ADR-002, CSS_ARCHITECTURE |
| CSS 단일 경로 원칙 (import chain)          | Phase 5 해결              |
| Builder ↔ Preview iframe 격리              | ADR-004                   |
| 레이아웃 무영향 (color/bg/border만 변경)   | 안정성                    |

---

## Research

### preview-system.css 이중 구조 분석

현재 `preview-system.css`는 두 토큰 체계를 모두 정의:

**원본 시맨틱 토큰 (L8-65) — 이미 Tailwind 매핑 완료:**

```css
--text-color: var(--color-text-primary, var(--color-neutral-900));
--border-color: var(--color-border-base, var(--color-neutral-300));
--field-background: var(--color-field-background, var(--color-neutral-50));
--highlight-background: var(
  --color-highlight-background,
  var(--color-primary-600)
);
--highlight-foreground: var(--color-highlight-foreground, var(--color-white));
--invalid-color: var(--color-invalid, var(--color-error-400));
--button-background: var(--color-button-background, var(--color-neutral-50));
--overlay-background: var(--color-overlay-background, var(--color-neutral-50));
```

**M3 역할 토큰 (L66-144) — 같은 Tailwind 색상을 다른 이름으로:**

```css
--primary: var(--color-primary-600, #6750a4);
--on-surface: var(--color-neutral-900, #1d1b20);
--outline-variant: var(--color-neutral-400, #cac4d0);
--surface-container: var(--color-surface-100, #f3edf7);
```

→ M3 토큰을 제거해도 원본 시맨틱 토큰이 동일한 Tailwind 색상을 가리키므로 **시각적 변화 없음**.

### M3 → 시맨틱/Tailwind 매핑 테이블

| M3 토큰 (제거)                | → 대체                                                                                                            | 근거                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `--primary`                   | `--highlight-background`                                                                                          | 이미 동일 Tailwind 색상 참조          |
| `--on-primary`                | `--highlight-foreground`                                                                                          | 이미 동일                             |
| `--primary-hover/pressed`     | `--highlight-background-hover/pressed` (없으면 `color-mix(in srgb, var(--highlight-background) 85%, black)` 파생) | 시맨틱 토큰 우선, 없는 경우 color-mix |
| `--on-surface`                | `--text-color`                                                                                                    | 둘 다 `--color-neutral-900`           |
| `--on-surface-variant`        | `--text-color-placeholder`                                                                                        | 둘 다 `--color-neutral-700`           |
| `--outline-variant`           | `--border-color`                                                                                                  | 동일 역할                             |
| `--outline`                   | `--border-color-hover`                                                                                            | 동일 역할                             |
| `--surface-container`         | `--field-background`                                                                                              | 동일 역할                             |
| `--surface-container-high`    | `--overlay-background`                                                                                            | 동일 역할                             |
| `--error`                     | `--invalid-color`                                                                                                 | 동일 역할                             |
| `--on-error`                  | `var(--color-white)`                                                                                              | Tailwind 직접                         |
| `--secondary`                 | `--button-background` 또는 Tailwind 직접                                                                          | 저빈도                                |
| `--tertiary`                  | Tailwind 직접 (`--color-purple-600`)                                                                              | 저빈도, Tabs/Badge 전용               |
| `--surface-container-lowest`  | `var(--color-white)`                                                                                              | Tailwind 직접                         |
| `--surface-container-low`     | `var(--color-neutral-50)`                                                                                         | Tailwind 직접                         |
| `--surface-container-highest` | `var(--color-neutral-200)`                                                                                        | Tailwind 직접                         |
| `--primary-container`         | `var(--color-primary-100)`                                                                                        | Tailwind 직접, 저빈도                 |
| `--inverse-*` (3개)           | Tailwind 직접                                                                                                     | Toast/Snackbar 전용, 저빈도           |
| `--surface-tint`              | 제거                                                                                                              | 미사용                                |

### builder-system.css 현황

Builder CSS는 이미 **시맨틱 토큰 + `--gray-*`/`--blue-*` (Tailwind alias)** 기반:

```css
--text-color: var(--gray-750); /* 시맨틱 — 유지 */
--border-color: var(--gray-300); /* 시맨틱 — 유지 */
--primary: var(--blue-400); /* M3 — --highlight-background로 전환 */
--surface-container: var(--gray-50); /* M3 — --field-background로 전환 */
```

M3 섹션(`Lines 81-136`)만 제거하면 됨. 시맨틱 토큰 섹션은 그대로 유지.

### Adobe 공식 React Aria 스타터 비교

| 항목                      | react-aria-starter (CSS)      | react-aria-tailwind-starter |
| ------------------------- | ----------------------------- | --------------------------- |
| 토큰 체계                 | `theme.css` ~20개 시맨틱 토큰 | Tailwind 유틸리티 직접      |
| M3 토큰                   | **없음**                      | **없음**                    |
| base.css                  | **없음** — 컴포넌트 자체 완결 | 없음                        |
| 복합 컴포넌트 하위 재정의 | **하지 않음**                 | **하지 않음**               |

→ Adobe 공식 스타터에는 M3가 없다. composition의 M3는 자체 추가한 레이어.

### 업계 참조

- **Radix UI / shadcn/ui**: `--input`, `--ring`, `--border` 등 간결한 시맨틱 토큰. M3 미사용.
- **Material Web Components**: M3 사용하지만 자체 토큰 체계와 혼용하지 않음 (단일 체계).
- **React Aria Components 공식 가이드**: `theme.css` 시맨틱 토큰 기반. M3 언급 없음.

---

## Alternatives Considered

### 대안 A: M3 제거 + theme.css 시맨틱 복귀 + Tailwind 통합

M3 역할 토큰 38개를 제거하고, 원본 `theme.css` 시맨틱 토큰 ~20개 + Tailwind 색상 직접 참조로 통합. 컴포넌트 CSS에서 M3 토큰을 시맨틱 토큰 또는 Tailwind로 치환.

```css
/* Before (M3) */
.react-aria-Input {
  border-color: var(--outline-variant);
  background: var(--surface-container);
  color: var(--on-surface);
}
.react-aria-Input[data-focused] {
  outline-color: var(--primary);
}

/* After (시맨틱 + Tailwind) */
.react-aria-Input {
  border-color: var(--border-color);
  background: var(--field-background);
  color: var(--text-color);
}
.react-aria-Input[data-focused] {
  outline-color: var(--highlight-background);
}
```

추가로:

1. `:focus` → `[data-focused]` 전면 정규화 (12개 파일)
2. 복합 컴포넌트 하위 오버라이드 경량화

| 축           | 등급       | 근거                                                                                                                     |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| 기술         | **LOW**    | 이미 존재하는 시맨틱 토큰으로 복귀. 새 기술 없음                                                                         |
| 성능         | **LOW**    | 변수 체인 3단→2단 감소, CSS 번들 감소 (M3 정의 제거)                                                                     |
| 유지보수     | **LOW**    | 토큰 체계 단일화 (시맨틱 ~20개). Adobe 공식 패턴 정렬                                                                    |
| 마이그레이션 | **MEDIUM** | 107개 파일 find-and-replace 성격. 레이아웃 미영향. 단계적 적용 가능. 자동화 스크립트로 Tier 1 고빈도 토큰 일괄 치환 권장 |

### 대안 B: M3 제거 + 시맨틱 토큰도 제거 + Tailwind만 사용

컴포넌트가 Tailwind 색상 변수를 직접 참조. 시맨틱 레이어 없음.

```css
.react-aria-Input {
  border-color: var(--color-neutral-300);
  background: var(--color-neutral-50);
  color: var(--color-neutral-900);
}
```

| 축           | 등급       | 근거                                                                                                                      |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| 기술         | **LOW**    | 단순한 변수 참조                                                                                                          |
| 성능         | **LOW**    | 최소 체인 (1단)                                                                                                           |
| 유지보수     | **HIGH**   | 시맨틱 의미 상실. `neutral-300`이 "보더"인지 "배경"인지 코드에서 추론 불가. 다크모드 전환 시 모든 컴포넌트 개별 수정 필요 |
| 마이그레이션 | **MEDIUM** | 107개 파일 변경                                                                                                           |

### 대안 C: M3 유지 + 컴포넌트 변수 계층 추가 (기존 ADR-017 v1)

M3를 유지한 채 `--input-*`, `--btn-*` 등 컴포넌트 레벨 변수를 추가.

| 축           | 등급       | 근거                                                                                |
| ------------ | ---------- | ----------------------------------------------------------------------------------- |
| 기술         | **LOW**    | CSS 변수 표준                                                                       |
| 성능         | **LOW**    | 변수 추가                                                                           |
| 유지보수     | **MEDIUM** | 근본 원인(이중 토큰 체계) 미해결. 시맨틱 + M3 + 컴포넌트 = **3계층 변수**로 더 복잡 |
| 마이그레이션 | **MEDIUM** | 107개 파일 단계적 변경                                                              |

### 대안 D: Status Quo 유지

| 축           | 등급     | 근거                                         |
| ------------ | -------- | -------------------------------------------- |
| 기술         | **LOW**  | 변경 없음                                    |
| 성능         | **LOW**  | 변경 없음                                    |
| 유지보수     | **HIGH** | 이중 토큰, 88파일 오버라이드, 세대 혼재 지속 |
| 마이그레이션 | **LOW**  | 변경 없음                                    |

---

## Risk Threshold Check

| 대안                        | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH 이상 |
| --------------------------- | :--: | :--: | :------: | :----------: | :-------: |
| A: M3 제거 + 시맨틱 복귀    |  L   |  L   |    L     |      M       |   **0**   |
| B: Tailwind만 사용          |  L   |  L   |  **H**   |      M       |     1     |
| C: M3 유지 + 변수 계층 추가 |  L   |  L   |    M     |      M       |     0     |
| D: Status Quo               |  L   |  L   |  **H**   |      L       |     1     |

- 대안 B, D에 HIGH 존재
- 대안 A가 C보다 근본적 (이중 토큰 해소) + 유지보수 LOW (C는 MEDIUM)
- **대안 A가 모든 축에서 가장 균형 잡힌 프로필**

---

## Decision

**대안 A: M3 제거 + theme.css 시맨틱 복귀 + Tailwind 통합** 채택.

### 채택 근거

1. **근본 원인 해소**: 이중 토큰 체계 (시맨틱 + M3) → 단일 체계 (시맨틱)로 축소. 토큰 수 38+20 → ~20.

2. **이미 존재하는 토큰으로 복귀**: `preview-system.css`의 시맨틱 토큰(L8-65)은 현재도 사용 중. M3 섹션(L66-144)만 제거하면 됨. 새 토큰 체계를 발명하는 것이 아니라 **불필요한 중복 레이어를 제거**하는 것.

3. **Adobe 공식 패턴 정렬**: react-aria-starter의 `theme.css`가 원본. M3는 composition에서 자체 추가한 것이므로 제거해도 공식 패턴에서 벗어나지 않음.

4. **레이아웃 무영향**: color/background/border-color만 변경. width/height/padding/margin/flex/grid 일절 미접촉.

5. **`--input-*`, `--btn-*` 등 컴포넌트 변수 계층 불필요**: 시맨틱 토큰 ~20개가 충분히 간결하므로 추가 indirection 불필요.

6. **마이그레이션 = find-and-replace**: `--on-surface` → `--text-color`, `--outline-variant` → `--border-color` 등 기계적 치환. 총 107개 파일(shared 55 + builder 52) 대상이나 Tier 1 고빈도 토큰은 자동화 스크립트(`sed`/`codemod`)로 일괄 처리 가능.

### 자기 검증

- "M3를 제거하면 디자인 시스템이 약해지지 않나?" → M3의 실사용 고빈도 토큰 ~10개는 모두 시맨틱 토큰에 1:1 매핑됨. 시맨틱 의미는 유지.
- "다크모드가 깨지지 않나?" → `preview-system.css`의 `[data-theme="dark"]` 섹션에서 시맨틱 토큰도 이미 다크 값을 정의하고 있음 (L196-227). M3 다크 섹션(L229-312)만 제거.
- "Theme Studio가 동작하지 않나?" → 오히려 개선됨. M3는 38개 토큰을 일일이 설정해야 하지만, starter의 `--tint` 패턴은 **변수 1개로 전체 테마 전환** 가능. Phase 4에서 구현.

---

## Gates

잔존 HIGH 위험 없음. MEDIUM 마이그레이션 위험에 대한 안전장치:

### 검증 전략

**현황**: `@chromatic-com/storybook`이 설치되어 있으나, **실제 Stories 파일이 0개** (Storybook config만 존재). Playwright는 루트 의존성만 있고 `playwright.config.ts` 미존재. CSS 토큰 리팩터링의 리그레션을 자동 감지할 수단이 현재 없음.

**최소 비용 검증 전략 (Phase 2 시작 전 준비):**

| 방법                               | 비용 | 커버리지 |                         채택                         |
| ---------------------------------- | :--: | :------: | :--------------------------------------------------: |
| Storybook Stories 생성 + Chromatic |  중  |   높음   | **Phase 2 시작 전 Tier 1 컴포넌트 5종 Stories 생성** |
| Playwright 스크린샷 비교           |  고  |   높음   |                  Phase 5 (Optional)                  |
| 수동 시각 확인                     |  저  |   낮음   |                 나머지 컴포넌트 임시                 |

**Phase 2 시작 전 필수 준비 (Gate G0에 포함):**

1. **핵심 컴포넌트 5종 Storybook Stories 생성**: Button(7 variant × 5 size × 4 state), Input, Checkbox, Card, Select
2. Chromatic baseline 스냅샷 촬영 (M3 제거 **전**)
3. Phase 1 완료 후 Chromatic diff 확인 → G1 통과 기준으로 사용
4. Phase 2 각 Tier 완료 후 Chromatic diff ≤ threshold → G2~G4 통과 기준

> **Builder UI 검증**: Builder 패널은 Storybook으로 격리 테스트 불가 (Store 의존). Builder는 `pnpm dev` 실행 후 수동 확인. 단, Chromatic이 커버하는 shared 컴포넌트가 Builder에서도 동일하게 사용되므로 shared 검증이 Builder 간접 검증 역할.

### Publish 앱 영향 분석

**코드베이스 검증 결과:**

- Publish 앱은 M3 토큰을 **직접 사용하지 않음** — `index.css`와 `PageNav.css` 모두 하드코딩된 hex 값 사용
- `apps/publish/src/styles/index.css`가 `@import '...packages/shared/src/components/index.css'`로 shared CSS 전체를 가져옴 → M3 토큰 제거는 **자동 전파**
- `builder-system.css`의 Builder 선택자(`.inspector`, `.sidebar` 등)가 Publish에 불필요하게 로드되는 구조 (별도 이슈, ADR-017 범위 외)
- `PageNav.css`가 `[data-theme="dark"]`가 아닌 `prefers-color-scheme: dark`로 다크모드 처리 — 테마 시스템과 불일치 (별도 이슈)

**Publish 검증 범위 (G4)**: shared 컴포넌트 렌더링이 Publish에서도 정상인지 확인. Publish 전용 CSS는 M3 미사용이므로 영향 없음.

### Tier별 롤백 독립성 분석

|          Tier           | 독립 롤백 가능? | 조건                                                                                                  |                     혼재 상태 위험                     |
| :---------------------: | :-------------: | ----------------------------------------------------------------------------------------------------- | :----------------------------------------------------: |
|   1~2 (shared 55파일)   |     **예**      | theme 파일(Phase 1)이 유지되면 시맨틱 토큰 정의가 존재하므로 치환된 CSS 정상 동작                     |                          없음                          |
| 3 (Builder ITCSS 7파일) |     **예**      | builder-system.css M3 제거가 Phase 1에서 완료되므로, Tier 3 revert 시 M3 토큰이 **미정의** 상태가 됨  | **있음** — Tier 3 revert 시 Phase 1도 함께 revert 필요 |
| 4 (Builder 패널 45파일) |    **부분**     | Tier 1 자동화 스크립트가 builder 패널에도 적용되므로, Tier 4만 revert하면 Tier 1 치환분도 되돌려야 함 |    **있음** — Tier 4는 Tier 1과 한 번에 적용/revert    |

**롤백 전략:**

- **안전한 롤백 단위**: Phase 1 + Phase 2 전체를 하나의 git branch로 관리
- **부분 롤백이 필요한 경우**: `git revert` 대신 `git checkout -- <파일>` 로 개별 파일 복원
- **최악의 경우**: Phase 1(theme 파일) revert → 모든 M3 토큰 정의 복원 → Phase 2 치환분은 양쪽 토큰이 동시 존재하므로 시각적 문제 없음 (단, 코드 비일관)

### Gate 테이블

| Gate | 시점                  | 통과 조건                                                                                      | 검증 방법                 | 실패 시 대안                           |
| ---- | --------------------- | ---------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------- |
| G0   | Phase 2 시작 전       | ① 자동화 스크립트 dry-run 0건 잔여 ② 핵심 5종 Storybook Stories 생성 ③ Chromatic baseline 촬영 | 스크립트 + Chromatic      | 스크립트 수정 / Stories 추가           |
| G1   | Phase 1 + Tier 1 완료 | M3 정의 제거 + Tier 1 자동화 치환을 **단일 브랜치에서 연속 적용** 후 Chromatic diff ≤ 0%       | Chromatic                 | 브랜치 전체 revert                     |
| G2   | Phase 2 Tier 1~2 완료 | shared 55개 파일 Chromatic diff ≤ threshold (color 차이만 허용)                                | Chromatic                 | 해당 파일만 revert                     |
| G3   | Phase 2 Tier 3 완료   | Builder ITCSS 레이어 7파일 + `pnpm dev` Builder 수동 확인                                      | 수동 (Builder Store 의존) | Phase 1 + Tier 3 함께 revert           |
| G4   | Phase 2 Tier 4 완료   | Builder 패널 전체 + **Publish 앱** 수동 확인 (M3 미사용이므로 영향 최소)                       | 수동 + Publish `pnpm dev` | Tier 1 스크립트분 + Tier 4 함께 revert |
| G5   | Phase 3 완료          | Canvas Button/Input/Card 렌더링 색상이 Preview와 일치                                          | 수동 (Canvas 비교)        | colors.ts만 revert                     |
| G6   | Phase 4 완료          | Theme Studio 기본 테마 생성/적용 동작 확인                                                     | 수동                      | Theme Studio 변경만 revert             |
| G7   | `:focus` 정규화 완료  | 12개 파일 `:focus` 제거 + `[data-focused]` 통일 + `:focus-visible` 3파일                       | Chromatic + 수동          | 해당 파일만 revert                     |

---

## Consequences

### Positive

1. **토큰 체계 단일화** — 시맨틱 ~20개 + Tailwind 직접 참조. M3 38개 제거
2. **변수 체인 단축** — 3단(M3→Tailwind→hex) → 2단(시맨틱→Tailwind)
3. **다크모드 간소화** — 재매핑 대상 ~58개 → ~20개
4. **컴포넌트 변수 계층 불필요** — `--input-*`, `--btn-*` 등 추가 indirection 없이 해결
5. **Adobe 공식 패턴 정렬** — react-aria-starter theme.css 원형 복귀
6. **오버라이드 감소** — 시맨틱 토큰이 base.css에서 통일되므로 개별 컴포넌트 중복 선언 감소
7. **포커스 일관성** — `:focus`(12파일) → `[data-focused]` 전면 통일
8. **번들 감소** — M3 정의(light+dark ~150줄) 제거
9. **Canvas/Preview 색상 통일** — Spec과 CSS가 동일한 Tailwind 색상 사용 (현재 M3 보라 vs Tailwind 파랑 불일치 해소)
10. **`--tint` 기반 테마 전환** — 변수 1개로 전체 색상 변경 가능 (M3는 38개 세팅 필요). Theme Studio/AI Theme 연동 대폭 단순화

### Negative

1. **Spec 전체 TokenRef 치환 필요** — 모든 `*Spec.ts` 파일의 `{color.primary}` → `{color.highlight-background}` 등 일괄 변경 + 테스트 갱신
2. **Theme Studio 후속 작업** — M3 토큰 기반 UI를 시맨틱 토큰 기반으로 전환 필요
3. **AI Theme Generator 수정** — M3 역할(primary/secondary/tertiary/error) 기반 생성 로직 변경 필요
4. **HCT 색상 공간 미지원** — M3 HCT 기반 색상 생성 도구 비활성화 (oklch 또는 Tailwind 팔레트로 대체 가능)
5. **107 CSS 파일 + Spec 파일 변경** — find-and-replace 성격이나 총량이 많음. Tier 1 고빈도 토큰은 자동화 스크립트로 일괄 치환 권장
6. **Publish 앱 간접 영향** — `apps/publish/`가 shared CSS를 `@import`하므로 변경 자동 전파. Publish 시각 확인 필요 (G3)

---

## Implementation Phases

### Phase 1: theme 파일 정리 (2파일)

**변경 대상**: `preview-system.css`, `builder-system.css`

| 작업               | 상세                                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| preview-system.css | M3 섹션(L66-190, L229-335) 제거. 시맨틱 토큰(L8-65, L196-228)과 shadow/overlay 유지 |
| builder-system.css | M3 섹션(L81-136, L186-241) 제거. 시맨틱 토큰 + gray/blue alias 유지                 |

> **정정**: base.css(47줄)에는 1세대 토큰 정의가 존재하지 않음 — 컴포넌트 공통 스타일(Input/TextArea/Label/FieldError)만 포함. Phase 1 대상에서 제외.

#### 다크모드 섹션 상세 치환 계획

**preview-system.css 다크모드** (`[data-theme="dark"]`, L196-335):

| 줄 범위  | 내용                                                                            | 조치     |
| -------- | ------------------------------------------------------------------------------- | -------- |
| L196-228 | 시맨틱 토큰 다크 값 (`--background-color`, `--text-color`, `--border-color` 등) | **유지** |
| L229-261 | M3 Primary/Secondary/Tertiary/Error Role (Dark)                                 | **제거** |
| L263-289 | M3 Surface/Background/Outline/Inverse Role (Dark)                               | **제거** |
| L291-312 | Highlight 색상 (Dark) — 시맨틱 토큰 (`--highlight-background` 등)               | **유지** |
| L314-334 | Shadow System + Overlay (Dark)                                                  | **유지** |

→ 결과: 다크모드에서 M3 역할 토큰 제거(L229-289, ~60줄) + 시맨틱 토큰/Shadow/Overlay 유지

**builder-system.css 다크모드** (`[data-builder-theme="dark"]`, L144-241):

| 줄 범위  | 내용                                                | 조치     |
| -------- | --------------------------------------------------- | -------- |
| L157-184 | 시맨틱 토큰 + Button/Field + Highlight (Dark)       | **유지** |
| L186-192 | M3 Primary (Blue - Dark)                            | **제거** |
| L194-200 | M3 Secondary (Dark)                                 | **제거** |
| L202-206 | M3 Error (Dark) — hover/pressed 누락 상태           | **제거** |
| L208-221 | M3 Surface/Outline (Dark)                           | **제거** |
| L223-240 | Info/Warning/Success (Dark) — Builder 전용, M3 아님 | **유지** |

→ 결과: Builder 다크모드에서 M3 역할 토큰 제거(L186-221, ~36줄) + Builder 전용(Info/Warning/Success) 유지

> **주의**: Preview는 `[data-theme="dark"]`, Builder는 `[data-builder-theme="dark"]`로 **독립된 선택자**를 사용. 각각 별도로 처리해야 하며 서로 영향 없음.
> **Known Bug — builder-system.css 토큰 누락 (ADR-017 이전 기존 결함)**
>
> `builder-system.css`에서 **8개 M3 토큰이 라이트/다크 모두 정의 누락**:
>
> | 누락 토큰                                                                                                                        | 사용 파일 수 | 대표 소비자                                                            |
> | -------------------------------------------------------------------------------------------------------------------------------- | :----------: | ---------------------------------------------------------------------- |
> | `--tertiary`, `--tertiary-hover`, `--tertiary-pressed`, `--on-tertiary`, `--tertiary-container`, `--on-tertiary-container` (6개) |     35개     | Button, Checkbox, Radio, Switch, Badge, Tabs, Table 등                 |
> | `--error-hover`, `--error-pressed` (2개)                                                                                         |     6개      | Button(error variant), Checkbox, Radio, TagGroup, Switch, ToggleButton |
>
> **영향**: Builder UI 내 shared 컴포넌트가 tertiary/error variant의 hover/pressed 색상을 표현 못 함. CSS 변수 미정의 → 해당 속성이 `initial`로 리셋 → 상태 피드백 부재. `var(--xxx, fallback)` 패턴도 미사용.
>
> **해결 전략**: 별도 수정 **불필요**. ADR-017 Phase 2 완료 시 모든 컴포넌트 CSS가 M3 토큰을 참조하지 않게 되므로 자연 해소. Phase 1과 Phase 2 사이 과도기에는 오히려 더 많은 토큰이 미정의 상태가 되므로, **Phase 1 + Phase 2 Tier 1(자동화)은 단일 브랜치에서 연속 적용** 필수 (G1 Gate 참조).

**Gate G1**: Phase 1과 Phase 2 Tier 1을 **단일 브랜치에서 연속 적용** 후 Storybook 시각적 일치 확인. Phase 1만 적용하면 M3 토큰 정의가 제거되어 컴포넌트 CSS의 M3 참조가 미정의 상태가 되므로, **Tier 1 자동화 치환까지 완료한 상태**에서 검증.

### Phase 2: 컴포넌트 CSS M3 토큰 치환 (107파일)

각 컴포넌트 CSS에서 M3 토큰 → 시맨틱/Tailwind 치환. M3 토큰 실참조 파일: shared 55개 + builder 52개 = **107개**. 우선순위:

> **자동화 필수**: Tier 1 고빈도 토큰 8개는 `sed` 스크립트로 일괄 치환. **접두사 충돌 방지를 위해 반드시 longest-first 순서**로 실행.

**Tier 1 — 고빈도 토큰 일괄 치환 (자동화 스크립트, 전체 107파일 대상):**

> **접두사 충돌 분석 결과** (코드베이스 전수 조사):
>
> | Base 토큰             | 충돌 가능 접두사 토큰                                                                                            | 조치                          |
> | --------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------- |
> | `--primary`           | `--primary-hover`(13회), `--primary-pressed`(24회), `--primary-container`(48회), `--on-primary-container`        | longest-first 순서로 해소     |
> | `--error`             | `--error-hover`(4회), `--error-pressed`(16회), `--error-container`(24회), `--on-error-container`                 | longest-first 순서로 해소     |
> | `--secondary`         | `--secondary-hover`(5회), `--secondary-pressed`(12회), `--secondary-container`(24회), `--on-secondary-container` | longest-first 순서로 해소     |
> | `--outline`           | `--outline-variant`(87회)                                                                                        | `--outline-variant` 먼저 치환 |
> | `--surface-container` | `--surface-container-high`(82회), `--surface-container-highest`(59회), `--surface-container-low`(14회)           | longest-first 순서로 해소     |
> | `--on-surface`        | `--on-surface-variant`                                                                                           | `--on-surface-variant` 먼저   |

**치환 순서 (longest-first — 이 순서를 반드시 준수):**

| 순서 | M3 토큰 (길이순 내림차)       | → 치환 대상                                                  | 비고               |
| :--: | ----------------------------- | ------------------------------------------------------------ | ------------------ |
|  1   | `--on-primary-container`      | `var(--color-primary-900)`                                   | Tier 2, 저빈도     |
|  2   | `--on-secondary-container`    | `var(--color-neutral-900)`                                   | Tier 2, 저빈도     |
|  3   | `--on-error-container`        | `var(--color-error-900)`                                     | Tier 2, 저빈도     |
|  4   | `--surface-container-highest` | `var(--color-neutral-200)`                                   | Tier 2             |
|  5   | `--surface-container-lowest`  | `var(--color-white)`                                         | Tier 2             |
|  6   | `--surface-container-high`    | `--overlay-background`                                       | Tier 2 (82회)      |
|  7   | `--surface-container-low`     | `var(--color-neutral-50)`                                    | Tier 2             |
|  8   | `--primary-container`         | `var(--color-primary-100)`                                   | Tier 2 (48회)      |
|  9   | `--secondary-container`       | `var(--color-neutral-100)`                                   | Tier 2 (24회)      |
|  10  | `--error-container`           | `var(--color-error-100)`                                     | Tier 2 (24회)      |
|  11  | `--on-surface-variant`        | `--text-color-placeholder`                                   | **Tier 1**         |
|  12  | `--outline-variant`           | `--border-color`                                             | **Tier 1** (87회)  |
|  13  | `--primary-hover`             | `color-mix(in srgb, var(--highlight-background) 85%, black)` | Tier 2             |
|  14  | `--primary-pressed`           | `--highlight-background-pressed`                             | Tier 2 (24회)      |
|  15  | `--secondary-hover`           | `color-mix(in srgb, var(--button-background) 85%, black)`    | Tier 2             |
|  16  | `--secondary-pressed`         | `color-mix(in srgb, var(--button-background) 75%, black)`    | Tier 2             |
|  17  | `--error-hover`               | `color-mix(in srgb, var(--invalid-color) 85%, black)`        | Tier 2             |
|  18  | `--error-pressed`             | `color-mix(in srgb, var(--invalid-color) 75%, black)`        | Tier 2             |
|  19  | `--tertiary-hover`            | `color-mix(in srgb, var(--color-purple-600) 85%, black)`     | Tier 2             |
|  20  | `--tertiary-pressed`          | `color-mix(in srgb, var(--color-purple-600) 75%, black)`     | Tier 2             |
|  21  | `--on-surface`                | `--text-color`                                               | **Tier 1**         |
|  22  | `--surface-container`         | `--field-background`                                         | **Tier 1** (57회)  |
|  23  | `--on-primary`                | `--highlight-foreground`                                     | **Tier 1**         |
|  24  | `--on-secondary`              | `var(--color-white)`                                         | Tier 2             |
|  25  | `--on-error`                  | `var(--color-white)`                                         | Tier 2             |
|  26  | `--on-tertiary`               | `var(--color-white)`                                         | Tier 2             |
|  27  | `--outline`                   | `--border-color-hover`                                       | **Tier 1** (42회)  |
|  28  | `--primary`                   | `--highlight-background`                                     | **Tier 1** (256회) |
|  29  | `--secondary`                 | `--button-background`                                        | Tier 2 (98회)      |
|  30  | `--tertiary`                  | `var(--color-purple-600)`                                    | Tier 2 (89회)      |
|  31  | `--error`                     | `--invalid-color`                                            | **Tier 1** (135회) |

```bash
# 자동화 스크립트 (longest-first 순서 — 접두사 충돌 안전)
#!/bin/bash
TARGETS=(packages/shared/src/components/styles apps/builder/src)
# Phase 1: 긴 토큰부터 (접두사 충돌 방지)
declare -A REPLACEMENTS=(
  # 순서 1~10: 복합 토큰 (longest-first)
  ["--on-primary-container"]="--color-primary-900"
  ["--on-secondary-container"]="--color-neutral-900"
  ["--on-error-container"]="--color-error-900"
  ["--surface-container-highest"]="--color-neutral-200"
  ["--surface-container-lowest"]="--color-white"
  ["--surface-container-high"]="--overlay-background"
  ["--surface-container-low"]="--color-neutral-50"
  ["--primary-container"]="--color-primary-100"
  ["--secondary-container"]="--color-neutral-100"
  ["--error-container"]="--color-error-100"
  # 순서 11~12: variant 토큰
  ["--on-surface-variant"]="--text-color-placeholder"
  ["--outline-variant"]="--border-color"
  # 순서 21~31: base 토큰 (shortest-last)
  ["--on-surface"]="--text-color"
  ["--surface-container"]="--field-background"
  ["--on-primary"]="--highlight-foreground"
  ["--outline"]="--border-color-hover"
  ["--primary"]="--highlight-background"
  ["--error"]="--invalid-color"
)
# dry-run 모드로 먼저 실행하여 G0 Gate 통과 확인
```

> **G0 Gate 검증**: 위 스크립트를 `--dry-run` 모드로 실행하여, 치환 후 `grep -r 'var(--primary\|--secondary\|--tertiary\|--error\|--on-surface\|--outline\|--surface-container)' --include="*.css"` 결과가 **0건**인지 확인. 잔여 M3 토큰이 있으면 스크립트 수정 후 재실행.

**Tier 2 — 저빈도 토큰 개별 치환:**

| M3 토큰                    | → 치환 대상                                            | 사용처                   |
| -------------------------- | ------------------------------------------------------ | ------------------------ |
| `--secondary`              | `--button-background` 또는 `var(--color-neutral-600)`  | Button secondary variant |
| `--on-secondary`           | `--text-color` 또는 `var(--color-white)`               | Button secondary 텍스트  |
| `--tertiary`               | `var(--color-purple-600)`                              | Tabs, Badge accent       |
| `--surface-container-high` | `--overlay-background` 또는 `var(--color-neutral-200)` | Dialog, Card elevated    |
| `--surface-container-low`  | `var(--color-neutral-50)`                              | Subtle backgrounds       |
| `--primary-container`      | `var(--color-primary-100)`                             | Selected states          |
| `--error-container`        | `var(--color-error-100)`                               | Error backgrounds        |
| `--on-error`               | `var(--color-white)`                                   | Error text               |
| `--inverse-*`              | Tailwind 직접                                          | Toast/Snackbar           |

**Tier 3 — Builder ITCSS 레이어 CSS 정리 (7파일):**

builder-system.css의 M3 섹션 제거 후, ITCSS 레이어(`4-layout/`, `5-modules/`) 내 잔여 M3 토큰 치환:

- `4-layout/canvas.css`
- `4-layout/header.css`
- `4-layout/footer.css`
- `5-modules/panel-nav.css`
- `5-modules/panel-container.css`
- `5-modules/error-loading.css`
- `5-modules/themes/index.css`

**Tier 4 — Builder 패널 CSS 정리 (45파일):**

Builder 패널별 CSS에서 M3 토큰 잔여 참조를 시맨틱/Tailwind로 치환. Tier 1 자동화 스크립트 적용 후 잔여분만 수동 처리:

| 그룹                        | 파일 수 | 대표 파일                                                              |
| --------------------------- | :-----: | ---------------------------------------------------------------------- |
| `panels/styles/components/` |   15    | FillSection, ColorInputModeSelector, GradientStopList, ScrubInput 등   |
| `panels/themes/styles/`     |   11    | ThemeStudio, AIThemeGenerator, HctThemeGenerator, DarkModeGenerator 등 |
| `panels/themes/components/` |    1    | M3ColorSystemGuide.css (M3 제거 후 파일 자체 삭제 또는 대폭 축소)      |
| `panels/datatable/`         |    4    | DataTablePanel, ApiEndpointEditor, DataTableCreator, ColumnSelector    |
| 기타 패널/오버레이/컴포넌트 |   14    | HistoryPanel, EventsPanel, FontManagerPanel, Toast, AddPageDialog 등   |

> **참고**: `M3ColorSystemGuide.css`는 M3 컬러 시스템 가이드 UI 전용이므로 M3 제거 후 파일 자체를 삭제하거나, 시맨틱 토큰 가이드로 재작성해야 함.

#### Theme Studio 작업 경계 (ADR-017 ↔ ADR-018)

Theme Studio CSS **12파일(~3,536줄)**은 **ADR-017이 단독 소유**. ADR-018의 utilities 패턴은 Builder CSS에 적용하지 않으므로 **경계 충돌 없음**.

|  소유   | 파일                                                                | ADR-017 작업                                            | ADR-018 작업 |
| :-----: | ------------------------------------------------------------------- | ------------------------------------------------------- | :----------: |
|   017   | `ThemesPanel.css`                                                   | M3 토큰 치환 (Tier 1 자동화)                            |     없음     |
|   017   | `ThemeStudio.css` (445줄)                                           | M3 토큰 치환 — 가장 밀도 높음 (40+ M3 참조)             |     없음     |
|   017   | `ThemeEditor.css`, `TokenEditor.css`                                | M3 토큰 치환                                            |     없음     |
|   017   | `AIThemeGenerator.css`, `DarkModeGenerator.css`                     | M3 토큰 치환                                            |     없음     |
|   017   | `FigmaImporter.css`, `FigmaPluginExporter.css`, `ThemeExporter.css` | M3 토큰 치환                                            |     없음     |
|   017   | `_common.css`                                                       | import 전용 (M3 미참조)                                 |     없음     |
|   017   | `ThemePreview.css`                                                  | M3 토큰 치환                                            |     없음     |
| **017** | **`HctThemeGenerator.css`** (581줄)                                 | M3 토큰 치환 + **M3 HCT 전용 기능 처리** (Phase 4 연계) |     없음     |
| **017** | **`M3ColorSystemGuide.css`** (281줄)                                | **파일 삭제** 또는 시맨틱 가이드로 재작성               |     없음     |

> **M3 강결합 파일 2개 주의**:
>
> - `HctThemeGenerator.css/tsx`: M3 HCT 색공간 기반 테마 생성 전용. Phase 2 Tier 4에서 CSS 토큰 치환 후, Phase 4에서 TSX 로직을 oklch/Tailwind 팔레트 기반으로 전환.
> - `M3ColorSystemGuide.css/tsx`: M3 역할 토큰 시각 가이드 UI. Phase 2 Tier 4에서 **파일 삭제** (or 시맨틱 토큰 가이드로 재작성).

**Gate G2**: 각 Tier 완료 시 해당 영역 Storybook/Builder 시각 확인.
**Gate G3**: Tier 3+4 완료 후 Builder Inspector/Sidebar/Header + **Publish 앱** 외관 확인.

### Phase 3: Spec 토큰 시스템 전환 (Canvas/Skia 렌더링) — 완료

**문제**: Spec의 `colors.ts`가 M3 기본 보라 팔레트(`#6750a4`)를 사용하고, CSS는 Tailwind 파랑(`--blue-400`)을 사용 → **Canvas와 Preview가 다른 색상**으로 렌더링.

**실제 구현 (계획과 차이점):**

계획에서는 ColorTokens 이름 자체를 시맨틱(`highlight-background` 등)으로 변경하려 했으나, 실제로는 **M3 토큰 이름을 유지**하고 hex 값만 Tailwind로 교체하는 접근을 채택. 이유:

1. 50+ Spec 파일의 TokenRef 문자열을 일괄 변경하는 리스크 회피
2. `COLOR_TOKEN_TO_CSS` 매핑 테이블이 M3 이름 → CSS 변수 변환을 이미 담당

**변경 완료:**

| 파일                                         | 작업                                                            |
| -------------------------------------------- | --------------------------------------------------------------- |
| `specs/src/primitives/colors.ts`             | M3 hex 값 → Tailwind hex 값으로 교체 (light/dark)               |
| `specs/src/renderers/utils/tokenResolver.ts` | `COLOR_TOKEN_TO_CSS` 매핑 테이블 추가 (M3 이름 → CSS 변수 변환) |
| `specs/src/types/token.types.ts`             | `ColorTokens`에 `transparent` 추가                              |

**Patch (2026-03-04): SelectIcon 색상 불일치 수정 + transparent 토큰 추가**

SelectIcon.spec.ts에서 CSS 변수명(`field-background`, `text-color`)을 TokenRef 키로 사용하여 `resolveToken()`이 `undefined` 반환 → Skia에서 검정색 렌더링 버그 발생. 수정:

| 파일                           | 작업                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `SelectIcon.spec.ts`           | `{color.field-background}` → `{color.surface-container}`, `{color.text-color}` → `{color.on-surface-variant}` |
| `colors.ts` + `token.types.ts` | `transparent: "transparent"` 추가 (Label, Description 등 5개 Spec에서 사용)                                   |
| `tokenResolver.ts`             | `COLOR_TOKEN_TO_CSS`에 `transparent: "transparent"` 추가                                                      |
| `specShapeConverter.ts`        | `colorValueToFloat32()` 안전 처리: `"transparent"` / `undefined` / `null` → `TRANSPARENT` (alpha=0) 반환      |

> **교훈**: Spec TokenRef 키는 반드시 `ColorTokens` 인터페이스에 정의된 이름만 사용. CSS 변수명(`--field-background`)과 ColorTokens 키(`surface-container`)는 다름. `.claude/rules/css-tokens.md`에 매핑 가이드 추가됨.

**결과**: Canvas(Skia)와 Preview(CSS)가 **동일한 Tailwind 색상**을 렌더링.

**Gate G4**: Canvas에서 Button/Input/Card/Select 렌더링 색상이 Preview와 일치하는지 확인. ✅ 완료

### Phase 4: Theme Studio / 테마 변경 기능

react-aria-starter `theme.css`의 `--tint` 패턴 도입으로 **단일 변수 테마 전환** 가능:

```css
/* theme.css 패턴 — --tint 1개로 전체 색상 변경 */
:root {
  --tint: var(--blue); /* 기본 테마 */
}

/* 사용자 테마 변경 시 */
[data-theme-color="green"] {
  --tint: var(--green);
}
[data-theme-color="purple"] {
  --tint: var(--purple);
}
```

**변경 대상 (5파일):**

| 파일                                                     | 작업                                          |
| -------------------------------------------------------- | --------------------------------------------- |
| `builder/panels/themes/ThemeStudio.tsx`                  | UI를 시맨틱 토큰 기반으로 전환                |
| `builder/panels/themes/components/AIThemeGenerator.tsx`  | AI 테마 생성 출력을 시맨틱 토큰 형식으로 변경 |
| `builder/panels/themes/components/HctThemeGenerator.tsx` | HCT 색공간 → Tailwind 팔레트 또는 oklch 전환  |
| `services/theme/ThemeGenerationService.ts`               | M3 역할 기반 생성 → 시맨틱 토큰 기반으로 변경 |
| `services/theme/HctThemeService.ts`                      | HCT 서비스 → Tailwind 팔레트 파생으로 대체    |

추가:

- `--tint` 기반 팔레트 파생 검토 (oklch 브라우저 지원 확인 후 결정)

> **전제**: Theme Studio **CSS 토큰 치환**은 Phase 2 Tier 4에서 완료 (12파일, "Theme Studio 작업 경계" 참조). Phase 4는 **TSX 기능 로직** 전환만 담당.

**Gate G5**: 기본 테마 생성/적용 동작 확인.

### Cross-Phase (Phase 1~3 병행): 포커스 셀렉터 정규화 (15파일)

각 Phase 작업 시 해당 파일의 포커스 셀렉터 정규화를 함께 수행.

**`:focus` → `[data-focused]` 전환 (12파일):**

| 파일                  | Phase와 병행 |
| --------------------- | :----------: |
| ComponentSearch.css   |   Phase 2    |
| ColorPicker.css       |   Phase 2    |
| NumberField.css       |   Phase 2    |
| DateField.css         |   Phase 2    |
| TimeField.css         |   Phase 2    |
| ActionList.css        |   Phase 2    |
| ChatInput.css         |   Phase 2    |
| EventPalette.css      |   Phase 2    |
| Form.css              |   Phase 2    |
| ListBox.css           |   Phase 2    |
| Table.css             |   Phase 2    |
| ToggleButtonGroup.css |   Phase 2    |

**`:focus-visible` → `[data-focus-visible]` 전환 (3파일):**

| 파일          | Phase와 병행 | 비고                                                |
| ------------- | :----------: | --------------------------------------------------- |
| ChatInput.css |   Phase 2    | `:focus-visible` 사용 중                            |
| Form.css      |   Phase 2    | `:focus-visible` 사용 중                            |
| ListBox.css   |   Phase 2    | `:focus` + `[data-focused]` + `:focus-visible` 혼재 |

> **결정**: `:focus-visible`도 `[data-focus-visible]`로 통일. React Aria는 `data-focus-visible` 속성을 자동 제공하므로 CSS pseudo-class 대신 사용.

**Gate G7**: 15개 파일에서 `:focus`/`:focus-visible` 제거, `[data-focused]`/`[data-focus-visible]` 통일 확인.

### Phase 5 (Optional): 문서화 + 규칙

1. CSS_ARCHITECTURE.md에 시맨틱 토큰 카탈로그 추가
2. `.claude/rules/`에 `css-tokens.md` 규칙 추가 (M3 토큰 사용 금지)
3. `:focus`/`:focus-visible` 사용 금지 규칙 (`[data-focused]`/`[data-focus-visible]` 통일)
4. CLAUDE.md에서 `tv()` 참조 제거, 현재 표준 반영
5. **`docs/reference/schemas/M3_COMPONENT_TEMPLATE.css` 삭제** — M3 토큰 예시 템플릿. M3 제거 후 불필요

---

## 시맨틱 토큰 카탈로그 (Phase 1 레퍼런스)

### 유지 대상 (~20개, preview-system.css 원본)

| 토큰                             | Tailwind 기본값 (light)    | 용도                |
| -------------------------------- | -------------------------- | ------------------- |
| `--text-color`                   | `var(--color-neutral-900)` | 기본 텍스트         |
| `--text-color-base`              | `var(--color-neutral-900)` | 기본 텍스트 (alias) |
| `--text-color-hover`             | `var(--color-neutral-950)` | 텍스트 hover        |
| `--text-color-disabled`          | `var(--color-neutral-500)` | 비활성 텍스트       |
| `--text-color-placeholder`       | `var(--color-neutral-700)` | placeholder         |
| `--border-color`                 | `var(--color-neutral-300)` | 기본 보더           |
| `--border-color-hover`           | `var(--color-neutral-400)` | 보더 hover          |
| `--border-color-pressed`         | `var(--color-neutral-500)` | 보더 pressed        |
| `--border-color-disabled`        | `var(--color-neutral-100)` | 비활성 보더         |
| `--field-background`             | `var(--color-neutral-50)`  | 필드 배경           |
| `--field-text-color`             | `var(--color-neutral-900)` | 필드 텍스트         |
| `--button-background`            | `var(--color-neutral-50)`  | 버튼 기본 배경      |
| `--button-background-pressed`    | `var(--color-neutral-100)` | 버튼 pressed        |
| `--overlay-background`           | `var(--color-neutral-50)`  | Popover/Dialog 배경 |
| `--highlight-background`         | `var(--color-primary-600)` | 주요 액션 (CTA)     |
| `--highlight-background-pressed` | `var(--color-primary-700)` | 주요 액션 pressed   |
| `--highlight-foreground`         | `var(--color-white)`       | 주요 액션 텍스트    |
| `--highlight-background-invalid` | `var(--color-error-600)`   | 에러 강조           |
| `--invalid-color`                | `var(--color-error-400)`   | 에러 상태           |
| `--focus-ring-color`             | `var(--color-primary-400)` | 포커스 링           |
| `--background-color`             | `var(--color-white)`       | 페이지 배경         |
| `--link-color`                   | `var(--color-primary-500)` | 링크                |

### 제거 대상 (M3 38개)

`--primary`, `--on-primary`, `--primary-container`, `--on-primary-container`, `--primary-hover`, `--primary-pressed`, `--secondary` (6개), `--tertiary` (6개), `--error` (6개 중 시맨틱 대체분 제외), `--surface`, `--on-surface`, `--surface-variant`, `--on-surface-variant`, `--surface-container-*` (5개), `--background`, `--on-background`, `--outline`, `--outline-variant`, `--inverse-*` (3개), `--scrim`, `--surface-tint`

---

## 관련 문서

- [ADR-002: Styling Approach](002-styling-approach.md) — ITCSS + CSS 변수 기반
- [CSS_ARCHITECTURE.md](../../features/completed/CSS_ARCHITECTURE.md) — CSS Import Chain, Layer 구조
- [react-aria-starter/src/theme.css](../../../packages/react-aria-starter/src/theme.css) — 원본 시맨틱 토큰 체계
- [CSS_SUPPORT_MATRIX.md](../../CSS_SUPPORT_MATRIX.md) — CSS Level 3 지원 현황
