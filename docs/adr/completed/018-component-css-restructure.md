# ADR-018: 컴포넌트 CSS 구조 재작성 — react-aria-starter 패턴 기반

## Status

Complete (2026-03-07)

> **Phase 1** 완료: utilities.css 생성 + foundation.css/index.css 연결. Button.css 마이그레이션.
> **Phase 2** 완료: ToggleButton → `button-base` 적용. TagGroup/Link/Breadcrumbs/Toolbar는 패턴 불일치로 미적용 (hover 방식이 다름).
> **Phase 3** 완료: `.inset` 유틸리티 재설계 + 전체 Input 컴포넌트 적용. TextField, SearchField, NumberField, ComboBox, ColorField, DateField, TimeField의 Input/DateInput 상태 스타일을 `.inset`에 위임 (-249줄).
> **Phase 4** 스킵: `.indicator` 유틸리티가 Checkbox/Switch/Radio의 parent-state/child-visual 패턴과 구조적으로 불일치. Switch의 `.indicator` 클래스명도 유틸리티와 충돌. 유틸리티 재설계 ROI 낮음.
> **Phase 5** 불필요: Card.css는 이미 `[data-variant]`/`[data-size]`/`:where()` 셀렉터 사용. 나머지 복합/오버레이 컴포넌트(Dialog, Popover, Menu 등)는 3대 유틸리티 대상 아님.
>
> **최종 성과**: `.button-base` (Button, ToggleButton) + `.inset` (7개 Input 컴포넌트) 적용. 총 -249줄 CSS 감소, variant/state 중복 제거.

## Context

### 문제 정의

ADR-017에서 M3 토큰을 제거하고 시맨틱 토큰 + Tailwind로 전환하더라도, 컴포넌트 CSS **구조 자체**의 비효율은 그대로 남는다. react-aria-starter의 원본 CSS 패턴과 비교하면 composition 컴포넌트 CSS는 과도하게 비대하다.

**정량적 비교:**

| 지표          | react-aria-starter | composition 현재  | 배율     |
| ------------- | ------------------ | ----------------- | -------- |
| 총 CSS 라인   | 4,430줄 (56파일)   | 16,647줄 (82파일) | **3.5x** |
| Button.css    | 51줄               | 186줄             | 3.6x     |
| TextField.css | 44줄               | 286줄             | 6.5x     |
| Select.css    | 47줄               | 510줄             | 10.9x    |
| Popover.css   | 79줄               | 246줄             | 3.1x     |
| ListBox.css   | 351줄              | 534줄             | 1.5x     |
| Table.css     | 334줄              | 1,015줄           | 3.0x     |

**비대화 근본 원인: variant/state 조합 폭발**

composition Button은 7 variant × 3 state = 21개 셀렉터 블록이 명시적으로 선언되어 있다:

```css
/* composition 현재 — 각 variant마다 bg/color/border를 3번씩 반복 */
&[data-variant="primary"] {
  background: var(--primary); color: var(--on-primary); border-color: var(--primary);
  &[data-hovered] { background: var(--primary-hover); border-color: var(--primary-hover); }
  &[data-pressed] { background: var(--primary-pressed); border-color: var(--primary-pressed); }
}
&[data-variant="secondary"] {
  background: var(--secondary); color: var(--on-secondary); border-color: var(--secondary);
  &[data-hovered] { background: var(--secondary-hover); ... }
  &[data-pressed] { background: var(--secondary-pressed); ... }
}
/* ... tertiary, error, surface, outline, ghost 반복 */
```

반면 starter는 **단일 로컬 변수**(`--button-color`)로 모든 state를 자동 파생한다:

```css
/* Starter — 변수 1개만 바꾸면 모든 state가 자동 계산 */
.button-base {
  --button-color: var(--tint);
  --button-background: oklch(from var(--button-color) var(--lightness-100)...);
  --button-text: oklch(from var(--button-color) var(--lightness-1400)...);
  &:where([data-variant="secondary"]) {
    --button-color: var(--gray);
  }
}
```

### Starter 핵심 패턴

1. **utilities.css 3대 유틸리티**: `.button-base`, `.indicator`, `.inset`
   - `.button-base`: 버튼류 전체 (Button, ToggleButton, SegmentedControl 등)
   - `.indicator`: 인디케이터류 전체 (Checkbox, Radio, Switch thumb 등)
   - `.inset`: 입력 필드류 전체 (Input, TextArea, Select trigger 등)

2. **로컬 변수 파생 패턴**: `--button-color` 1개 → 8개 파생 변수 자동 계산
   - oklch relative color syntax: `oklch(from var(--button-color) var(--lightness-N) var(--chroma-N) h)`
   - Dark mode: lightness scale 값만 반전 → 파생 변수 자동 적응
   - Variant 추가: `--button-color: var(--새색상)` 한 줄이면 완료

3. **컴포넌트 CSS는 구조만**: 레이아웃/크기/간격만 정의, 시각적 스타일은 utility에 위임

4. **`:where()` specificity 제어**: `&:where([data-pressed])` — specificity 0으로 오버라이드 안전

### 추가 구조 이슈

#### Card.css 레거시 셀렉터 패턴

Card.css는 다른 컴포넌트와 달리 **클래스 기반 variant 셀렉터**를 사용 (`&.primary`, `&.elevated` 등). `[data-variant]` 기반이 아님.

```css
/* Card.css 현재 — 클래스 기반 (비표준) */
.react-aria-Card {
  &.primary { ... }     /* 다른 컴포넌트: [data-variant="primary"] */
  &.elevated { ... }
  &.outlined { ... }
}
```

→ utilities.css의 `[data-variant]` 셀렉터와 비호환. Phase 5에서 **Card.css 셀렉터를 `[data-variant]`로 전환** 필요. Card.tsx(L162)에서 `'data-variant': variant`로 DOM 속성을 전달하고 있음이 **코드베이스 검증으로 확인됨** (`packages/shared/src/components/Card.tsx:162`). 따라서 **CSS 변경만으로 완료** — React 컴포넌트 수정 불필요.

#### Publish 앱 cascade 연결

`apps/publish/src/styles/index.css`가 `@import '...packages/shared/src/components/index.css'`로 shared CSS를 가져옴. 새 `utilities.css`가 이 cascade에 포함되어야 Publish 앱에서도 동작. `foundation.css`에 연결하면 Builder/Publish 양쪽에서 자동 로드됨.

### 제약 조건 (Hard Constraints)

1. **ADR-017 선행 필수**: M3 토큰 제거 완료 후 진행 (ADR-017 정정: 107개 파일 대상, shared 55 + builder 52)
2. **CSS import 단일 경로 원칙**: starter의 `@import "./theme.css"` 패턴은 사용 불가 (Vite 중복 로딩)
3. **Preview/Builder 격리 유지**: Builder UI는 builder-system.css로 독립
4. **기존 variant/size 하위 호환**: data-variant, data-size 속성은 유지 (컴포넌트 인터페이스 변경 없음)
5. **Theme Studio 호환**: 사용자 테마 커스터마이징 가능해야 함
6. **Card.css 셀렉터 전환**: 클래스 기반 `.primary` → `[data-variant="primary"]` CSS만 전환 (Card.tsx:162에서 `'data-variant': variant` 전달 확인됨). `.sm`/`.md`/`.lg` 사이즈도 동일하게 `[data-size]` 전환 (Card.tsx에서 `'data-size': size` 전달 확인됨)

## Alternatives Considered

### 대안 A: Starter 완전 채택 (Full Starter Alignment)

- **설명**: starter CSS 56개 파일을 원본 그대로 도입. composition 전용 확장(size variant 등)만 별도 레이어로 추가.
- **장점**: 원본 유지 → 업스트림 업데이트 추적 용이, 코드량 최소
- **단점**: oklch relative color syntax 브라우저 호환성 이슈 (Safari 16.3 이하, Firefox 127 이하 미지원), composition 고유 기능(7 variant, 5 size) 삭제 또는 별도 관리
- **위험**: 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(H)

### 대안 B: 선택적 채택 — utilities 패턴 + 구조 단순화

- **설명**: starter의 `utilities.css` 3대 유틸리티(button-base, indicator, inset) 패턴을 도입하되, oklch 대신 composition 시맨틱 토큰으로 파생 변수 구현. 컴포넌트 CSS는 구조(레이아웃/크기)만 남기고 시각적 스타일은 utility에 위임.
- **장점**: 브라우저 호환성 문제 없음, 기존 variant/size 유지 가능, 점진적 마이그레이션
- **단점**: oklch 자동 파생 없이 수동 매핑 필요 (hover/pressed 색상)
- **위험**: 기술(L) / 성능(L) / 유지보수(M) / 마이그레이션(M)

### 대안 C: ADR-017만 (구조 변경 없음)

- **설명**: M3→시맨틱 토큰 치환만 수행. 컴포넌트 CSS 구조는 현행 유지.
- **장점**: 최소 변경, 최소 위험
- **단점**: 15,652줄 CSS 유지, variant/state 폭발 구조 그대로, 향후 컴포넌트 추가 시 동일 패턴 반복
- **위험**: 기술(L) / 성능(L) / 유지보수(H) / 마이그레이션(L)

### 대안 D: 하이브리드 — 신규 컴포넌트만 starter 패턴

- **설명**: 기존 컴포넌트는 ADR-017만 적용. 신규 추가 컴포넌트부터 starter 패턴 적용. 기존 컴포넌트는 시간날 때 순차 마이그레이션.
- **장점**: 즉시 위험 0, 자연스러운 전환
- **단점**: 두 가지 패턴 공존 → 일관성 부족, 전환 완료 시점 불명확
- **위험**: 기술(L) / 성능(L) / 유지보수(H) / 마이그레이션(L)

## Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH 수 |
| ---- | :--: | :--: | :------: | :----------: | :-----: |
| A    |  M   |  L   |    L     |      H       |    1    |
| B    |  L   |  L   |    M     |      M       |    0    |
| C    |  L   |  L   |    H     |      L       |    1    |
| D    |  L   |  L   |    H     |      L       |    1    |

대안 B만 HIGH 0개. 대안 A/C/D는 각 1개 HIGH.

## Decision

**대안 B 채택**: utilities 패턴 선택적 도입 + 구조 단순화

### 채택 근거

1. **HIGH 위험 0개** — 유일하게 모든 축 MEDIUM 이하
2. **starter의 핵심 장점만 수용**: 로컬 변수 파생 패턴으로 variant/state 폭발 해소
3. **oklch 미사용**: 브라우저 호환성 이슈 회피. `color-mix()` 기반 파생 (현재 이미 사용 중)
4. **기존 Public API 유지**: `data-variant`, `data-size` 속성 및 Props 인터페이스 그대로 → 외부 API 변경 없음. 단, 내부적으로 `className`에 utility 클래스(`button-base`, `indicator`, `inset`) 추가하는 .tsx 수정은 필요
5. **점진적 마이그레이션**: Tier별 순차 진행, 각 단계 독립 rollback 가능

### 핵심 구조 변경

#### 1. utilities.css 신규 생성

starter의 3대 유틸리티를 composition 시맨틱 토큰 기반으로 재구현:

```css
@layer utilities {
  /* 버튼류 공통 — --button-color 1개로 모든 state 파생 */
  .button-base {
    --button-color: var(--highlight-background);
    --button-bg: var(--button-color);
    --button-bg-hover: color-mix(in srgb, var(--button-color) 85%, black);
    --button-bg-pressed: color-mix(in srgb, var(--button-color) 75%, black);
    --button-text: var(--highlight-foreground);
    --button-border: var(--button-color);

    background: var(--button-bg);
    color: var(--button-text);
    border: 1px solid var(--button-border);
    outline: none;
    transition:
      background 200ms,
      border-color 200ms,
      color 200ms;

    &:where([data-hovered]) {
      background: var(--button-bg-hover);
    }
    &:where([data-pressed]) {
      background: var(--button-bg-pressed);
    }
    &:where([data-focus-visible]) {
      outline: 2px solid var(--focus-ring-color);
      outline-offset: 2px;
    }
    &:where([data-disabled]) {
      opacity: 0.38;
      pointer-events: none;
    }

    /* variant는 --button-color 1개만 변경 */
    &:where([data-variant="secondary"]) {
      --button-color: var(
        --button-background
      ); /* ADR-017 이후: --secondary 제거됨 */
    }
    &:where([data-variant="outline"]) {
      --button-bg: transparent;
      --button-text: var(--button-color);
      --button-bg-hover: color-mix(
        in srgb,
        var(--button-color) 8%,
        transparent
      );
    }
    &:where([data-variant="ghost"]) {
      --button-bg: transparent;
      --button-border: transparent;
      --button-text: var(--button-color);
    }
  }

  /* 인디케이터류 공통 — Checkbox, Radio, Switch */
  .indicator {
    --indicator-color: var(--border-color);
    /* ... indicator 파생 변수 ... */
  }

  /* 입력 필드류 공통 — Input, TextArea, Select trigger */
  .inset {
    --inset-bg: var(--field-background);
    --inset-border: var(--border-color);
    /* ... inset 파생 변수 ... */
  }
}
```

#### 2. 컴포넌트 CSS → 구조만 (시각 스타일 삭제)

```css
/* Button.css — After (구조만) */
@layer components {
  .react-aria-Button {
    border-radius: var(--radius-sm);
    font-size: var(--text-sm);
    padding: var(--spacing) var(--spacing-md);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);

    /* Size variants (구조적) */
    &[data-size="xs"] {
      font-size: var(--text-2xs);
      padding: var(--spacing-xs) var(--spacing-sm);
    }
    &[data-size="sm"] {
      padding: var(--spacing-sm) var(--spacing-md);
    }
    &[data-size="md"] {
      padding: var(--spacing-md) var(--spacing-lg);
      font-size: var(--text-base);
    }
    &[data-size="lg"] {
      padding: var(--spacing-lg) var(--spacing-xl);
      font-size: var(--text-lg);
    }
    &[data-size="xl"] {
      padding: var(--spacing-xl) var(--spacing-2xl);
      font-size: var(--text-xl);
    }
  }
}
```

#### 3. `:where()` specificity 제어 도입

starter 패턴: `&:where([data-pressed])` — specificity 0으로 컴포넌트별 오버라이드 안전

## Gates

| Gate | 시점                  | 조건                                                          | 실패 시 대안                      |
| ---- | --------------------- | ------------------------------------------------------------- | --------------------------------- |
| G1   | utilities.css 작성 후 | Storybook에서 Button/Input/Checkbox 3종 시각 일치 확인        | utilities.css 삭제, 기존 CSS 복원 |
| G2   | Tier 1 완료 후        | 7 variant × 5 size × 4 state 조합 스크린샷 비교               | 해당 컴포넌트만 revert            |
| G3   | Tier 2 완료 후        | Preview + Builder 전체 비주얼 리그레션 확인                   | 해당 Tier revert                  |
| G4   | Tier 3 완료 후        | Builder UI (inspector, sidebar, modal) 정상 동작 확인         | Builder CSS 별도 유지             |
| G5   | Tier 4 완료 후        | **Publish 앱** 전체 페이지 시각 확인 + Card variant 동작 확인 | Card 마이그레이션만 revert        |

## Implementation Phases

### 전제: ADR-017 완료 후 시작

> **참고**: ADR-017의 Phase 2 작업 범위가 64개에서 **107개 파일**(shared 55 + builder 52)로 정정되었음. ADR-017 완료까지의 소요가 초기 예상보다 크므로, ADR-018 착수 시점을 ADR-017 Phase 2 Tier 1~2(shared CSS) 완료 시점으로 앞당길 수도 있음. 단, builder Tier 3~4는 ADR-018과 병행 불가 (cascade 충돌 위험).

### Phase 1: utilities.css 기반 구축 (신규 3파일)

**목표**: starter의 3대 유틸리티를 composition 시맨틱 토큰 기반으로 구현

| 작업                | 파일                    | 설명                                              |
| ------------------- | ----------------------- | ------------------------------------------------- |
| utilities.css 생성  | `styles/utilities.css`  | `.button-base`, `.indicator`, `.inset` 3개 클래스 |
| foundation.css 연결 | `styles/foundation.css` | `@import "./utilities.css"` 추가                  |
| Gate G1 확인        | —                       | Storybook 시각 검증                               |

**예상 규모**: 신규 ~200줄

### Phase 2: Tier 1 컴포넌트 전환 — 버튼류 (7파일)

**목표**: `.button-base` 유틸리티 적용, variant/state 명시적 선언 제거

| 컴포넌트               | 현재 줄 수 | 예상 줄 수 | 감소율 |
| ---------------------- | :--------: | :--------: | :----: |
| Button.css             |    185     |    ~50     |  -73%  |
| ToggleButton.css       |    137     |    ~40     |  -71%  |
| Breadcrumbs.css        |    205     |    ~60     |  -71%  |
| Link.css               |    120     |    ~40     |  -67%  |
| Toolbar.css            |     43     |    ~20     |  -53%  |
| SegmentedControl.css\* |     —      |     —      |  신규  |
| TagGroup.css           |    210     |    ~70     |  -67%  |

**React 컴포넌트 변경**: 각 컴포넌트 `.tsx`에서 `className`에 utility 클래스 직접 추가.

- **방식**: 각 컴포넌트의 render에서 `className` prop에 utility 추가 (e.g. `<RAButton className={cn('button-base', className)}>`)
- **대상 컴포넌트**: Button, ToggleButton, Link, Breadcrumbs, Toolbar, TagGroup (총 6~7개 .tsx)
- **이유**: wrapper/HOC 불필요. 컴포넌트 내부에서 직접 추가가 가장 단순하고 추적 가능

### Phase 3: Tier 2 컴포넌트 전환 — 입력 필드류 (12파일)

**목표**: `.inset` 유틸리티 적용, 필드별 중복 Input 스타일 제거

| 컴포넌트                  | 현재 줄 수 | 예상 줄 수 | 감소율 |
| ------------------------- | :--------: | :--------: | :----: |
| base.css (Input/TextArea) |     47     |    ~20     |  -57%  |
| TextField.css             |    286     |    ~60     |  -79%  |
| NumberField.css           |    397     |    ~80     |  -80%  |
| SearchField.css           |    395     |    ~70     |  -82%  |
| ComboBox.css              |    486     |    ~100    |  -79%  |
| Select.css                |    510     |    ~80     |  -84%  |
| ColorField.css            |    195     |    ~45     |  -77%  |
| DateField.css             |    344     |    ~70     |  -80%  |
| TimeField.css             |    344     |    ~70     |  -80%  |
| DatePicker.css            |    235     |    ~50     |  -79%  |
| DateRangePicker.css       |    303     |    ~60     |  -80%  |
| ColorPicker.css           |    226     |    ~50     |  -78%  |

### Phase 4: Tier 3 컴포넌트 전환 — 인디케이터류 (스킵)

**결과**: `.indicator` 유틸리티가 대상 컴포넌트와 **구조적으로 불일치**하여 스킵.

**불일치 원인**:

1. **Parent-state/Child-visual 패턴**: `data-selected`/`data-pressed`는 부모 컴포넌트에, 시각 변경은 자식 요소(`.checkbox`/`.indicator`)에 적용. 유틸리티는 동일 요소에 state+visual 가정.
2. **클래스명 충돌**: Switch의 `.indicator` 클래스명이 유틸리티 `.indicator`와 충돌.
3. **패러다임 차이**: Slider/ProgressBar/Meter는 range/progress 시각화 — 선택 상태 기반이 아님.

**대안 검토**: 유틸리티를 parent-state/child-visual 패턴으로 재설계할 수 있으나, 대상 컴포넌트가 이미 잘 동작하고 있어 ROI 낮음.

### Phase 5: Tier 4 컴포넌트 전환 — 복합/오버레이류 + 레거시 패턴 (불필요)

**결과**: 추가 작업 불필요.

- **Card.css**: 이미 `[data-variant]`/`[data-size]`/`:where()` 셀렉터 사용 — ADR 작성 이후 별도로 마이그레이션 완료됨 (Card.tsx:162-168에서 모든 data-\* 속성 전달 확인)
- **복합/오버레이 컴포넌트** (Popover, Dialog, Menu, ListBox, Table, Tabs 등): 구조적 CSS만 포함 — `button-base`/`inset`/`indicator` 3대 유틸리티 적용 대상 아님

**Builder CSS 참고**: Builder 전용 CSS는 ADR-018 범위 밖 (builder-system.css 독립 유지).
**Theme Studio 제외**: ADR-017 단독 소유.

### Phase 6 (Optional): dead code 제거 + 문서화

- 미사용 CSS 셀렉터 제거 (variant 축소 포함)
- CSS_ARCHITECTURE.md 갱신
- 스타일 가이드 갱신

## 예상 최종 결과

| 지표                    | Before |        After         |   변화   |
| ----------------------- | :----: | :------------------: | :------: |
| 총 CSS 라인             | 16,647 |        ~6,500        | **-61%** |
| 파일 수                 |   82   | ~83 (+utilities.css) |    ±0    |
| variant 오버라이드 블록 | ~100+  |  ~15 (utilities 내)  | **-85%** |
| 컴포넌트별 평균 줄 수   |  ~203  |         ~79          | **-61%** |
| 새 컴포넌트 추가 비용   | ~200줄 |        ~40줄         | **-80%** |

## Consequences

### Positive

1. **CSS 61% 감소** (16,647 → ~6,500줄) — 번들 크기 + 파싱 시간 개선
2. **variant 추가 원가 1줄** — `--button-color: var(--새색상)` 한 줄로 variant 완성
3. **`:where()` specificity** — 컴포넌트별 오버라이드 안전, cascade 충돌 해소
4. **starter 업스트림 추적 용이** — 구조 유사성 회복
5. **Theme Studio 연동 단순화** — 로컬 변수 1개 변경으로 전체 테마 반영

### Negative

1. **React 컴포넌트 className 변경 필요** — `button-base`, `indicator`, `inset` 클래스 추가 (각 .tsx에서 직접)
2. **기존 variant 시각 미세 차이 가능** — `color-mix()` 파생 vs 명시적 토큰 차이
3. **마이그레이션 기간 중 2패턴 공존** — Phase 단위로 최소화하되 전환 완료까지 불가피
4. **Card.css 셀렉터 전환** — 클래스 기반(`.primary`) → `[data-variant]` 기반 전환 (CSS만 변경 — Card.tsx:162 `data-variant` 전달 확인됨). `.selected`/`.quiet` 셀렉터도 data-\* 전환 대상이나, Card.tsx에서 해당 속성 전달 여부는 구현 시 확인 필요

## 참조

- [react-aria-starter CSS](../../docs/react-aria/react-aria-starter/src/) — 원본 참조
- [ADR-017](017-css-override-ssot.md) — 선행 의존 (M3 제거 + Tailwind 통합)
- [CSS_ARCHITECTURE.md](../../features/completed/CSS_ARCHITECTURE.md) — 현행 ITCSS 구조
