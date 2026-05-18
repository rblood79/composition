# React Aria Starter — 디자인 시스템 레퍼런스

> 본 문서는 `packages/react-aria-starter/src` 의 CSS 스타일에서 추출한 디자인 시스템 정의이다.
> 이 패키지는 **upstream React Aria starter 스냅샷** 이며 (`UPSTREAM.md` 참조), composition
> 제품 커스터마이징의 소스가 아니라 **참조 baseline** 이다. 본 문서도 그 스냅샷이 표현하는
> 디자인 언어를 기록한 것이지, composition 의 SSOT (D3 = `packages/specs`) 가 아니다.
>
> - 정본(SSOT): `theme.css` (토큰) + `utilities.css` (조합 유틸) + 컴포넌트별 `*.css`
> - 토큰 모델: OKLCH relative color + `@media (prefers-color-scheme)` 양방향
> - 컴포넌트 56개 CSS / `.react-aria-*` 클래스 + `[data-*]` 상태 속성 컨벤션

---

## 1. 아키텍처 개요

| 레이어       | 파일                                           | 역할                                                                                    |
| ------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| **토큰**     | `theme.css`                                    | 색상 스케일, 시맨틱 색상, 타이포·간격·radius 스케일                                     |
| **유틸리티** | `utilities.css`                                | `.button-base` / `.indicator` / `.inset` — 컴포넌트 공통 시각 패턴 (`@layer utilities`) |
| **컴포넌트** | `Button.css` … `Tree.css` (53개)               | 각 컴포넌트 1파일, 상단에서 `theme.css` (49개) / `utilities.css` (16개) `@import`       |
| **스토리**   | `stories/styles.css`, `.storybook/preview.css` | Storybook 데모 전용 (디자인 시스템 아님)                                                |

스타일링 원칙:

- **CSS Nesting** 적극 사용 (`&[data-*]`, 중첩 셀렉터). 빌드 시 Lightning CSS / PostCSS Nesting 으로 평탄화 가능.
- 모든 컴포넌트는 `.react-aria-{ComponentName}` 단일 루트 클래스로 시작.
- 상태는 클래스가 아닌 **`[data-*]` 속성** 으로 표현 (React Aria 가 DOM 에 주입).
- 하드코딩 색상 금지 — `var(--*)` 토큰만 사용 (drop-shadow alpha 등 극소수 예외).

---

## 2. 색상 시스템 (OKLCH)

### 2.1 색상 모델

모든 색상은 **OKLCH** 색공간에서 `oklch(from … l c h)` relative color 문법으로 파생된다.
한 개의 base hue 에서 16단계 스케일을 생성하는 구조:

```
base color  →  oklch(from {base} {lightness-N} {chroma-N} h)  →  {color}-100 … {color}-1600
```

### 2.2 테마(base) 색상 — 11종

`--tint` 하나만 바꾸면 전 컴포넌트 강조색이 전환된다 (기본값 `--indigo`).

| 토큰          | OKLCH                  | 용도             |
| ------------- | ---------------------- | ---------------- |
| `--gray`      | `oklch(0.5 0 0)`       | 중립 스케일 base |
| `--red`       | `oklch(0.6 .181 27)`   | 에러/파괴        |
| `--orange`    | `oklch(0.7 .150 54)`   | —                |
| `--yellow`    | `oklch(0.8 .129 73.8)` | —                |
| `--turquoise` | `oklch(0.5 .081 205)`  | —                |
| `--cyan`      | `oklch(0.4 .142 244)`  | —                |
| `--green`     | `oklch(0.5 .121 155)`  | 성공             |
| `--blue`      | `oklch(0.5 .220 266)`  | —                |
| `--indigo`    | `oklch(1 .250 284)`    | **기본 tint**    |
| `--purple`    | `oklch(0.7 .223 302)`  | —                |
| `--pink`      | `oklch(0.6 .178 348)`  | —                |

> base 색상의 lightness 채널은 실제 밝기가 아니라 **chroma 의 배수(multiplier)** 로만 쓰인다.
> 실제 밝기는 스케일 단계의 `--lightness-N` 이 결정한다.

### 2.3 16단계 스케일 — `--tint-N`, `--gray-N`

`--tint-100`~`--tint-1600`, `--gray-100`~`--gray-1600` 이 `--lightness-N` × `--chroma-N` 조합으로 자동 생성된다.

**Lightness 스케일은 라이트/다크에서 의미가 반전된다:**

| 단계    | Light 모드 L        | Dark 모드 L         |
| ------- | ------------------- | ------------------- |
| `-100`  | 98.1% (가장 밝음)   | 29.7% (가장 어두움) |
| `-500`  | 79.2%               | 51.9%               |
| `-1000` | 51.9%               | 67.0%               |
| `-1600` | 16.7% (가장 어두움) | 100% (가장 밝음)    |

→ `--gray-100` 은 라이트에서 "거의 흰색", 다크에서 "거의 검정". 따라서 시맨틱 토큰
(`--text-color: var(--gray-1200)` 등)은 코드를 바꾸지 않고도 양 테마에서 올바른 대비를 유지한다.

**Chroma 스케일** 은 저명도 구간에서 채도를 낮춘다 (`--chroma-100 = calc(l * c * 0.5)` … `--chroma-600~1600 = c`) — 밝은 톤일수록 채도를 줄여 색이 들뜨지 않게 한다.

`--gray-50` 은 스케일 밖의 특수 값 (Light `#ffffff`, Dark `oklch(22% 0 0)`).

### 2.4 시맨틱 색상

컴포넌트 CSS 는 원시 스케일(`--gray-N`) 대신 아래 시맨틱 토큰을 우선 사용한다.

| 토큰                                       | 값                                            | 용도                        |
| ------------------------------------------ | --------------------------------------------- | --------------------------- |
| `--focus-ring-color`                       | `--tint-1000`                                 | 포커스 링                   |
| `--text-color`                             | `--gray-1200`                                 | 기본 텍스트                 |
| `--text-color-hover`                       | `--gray-1300`                                 | hover 텍스트                |
| `--text-color-disabled`                    | `--gray-600`                                  | 비활성 텍스트               |
| `--text-color-placeholder`                 | `--gray-1000`                                 | placeholder                 |
| `--field-text-color`                       | `--gray-1400`                                 | 입력 필드 텍스트            |
| `--link-color` / `-secondary` / `-pressed` | `--tint-1200` / `--gray-1200` / `--tint-1300` | 링크                        |
| `--border-color` / `-hover` / `-disabled`  | `--gray-400` / `-500` / `-300`                | 테두리                      |
| `--field-background`                       | `--gray-50`                                   | 입력 필드 배경              |
| `--button-background` / `-pressed`         | `--tint-100` / `--tint-200`                   | 버튼 배경                   |
| `--highlight-background` / `-pressed`      | `oklch(from --tint 55%/50% c h)`              | 선택 강조 배경              |
| `--highlight-background-invalid`           | `oklch(from --red …)`                         | 에러 강조 배경              |
| `--highlight-foreground`                   | `white`                                       | 강조 배경 위 텍스트         |
| `--highlight-overlay`                      | `--tint-1000 / 15%`                           | 강조 오버레이               |
| `--highlight-hover` / `-pressed`           | `rgb(0 0 0 / 0.07)` / `0.15` (다크: 흰색)     | 중립 hover/pressed 오버레이 |
| `--invalid-color`                          | `oklch(from --red …)`                         | 에러 텍스트/테두리          |
| `--overlay-background` / `-border`         | `--gray-50` / `rgb(0 0 0 / 0.06)`             | 팝오버·모달 표면            |
| `--background-color`                       | Light `#f8f8f8` / Dark `#1b1b1b`              | 앱 배경                     |

> `--highlight-background*` 은 라이트/다크에서 **동일 값** — 위에 얹히는 흰색 전경(`--highlight-foreground`)과의 대비를 양 테마에서 보장하기 위함.

---

## 3. 타이포그래피

| 토큰             | 값                | 비고                  |
| ---------------- | ----------------- | --------------------- |
| `--font-size`    | `0.875rem` (14px) | 본문 기본 — 39회 사용 |
| `--font-size-sm` | `0.75rem` (12px)  | 설명·에러·kbd — 17회  |
| `--font-size-lg` | `1rem` (16px)     | 강조 — 4회            |

- font-family 는 `system-ui` 고정 (`font: var(--font-size) system-ui` 단축 패턴).
- font-weight: 본문 normal, Label / Button 등은 `500`.
- line-height: `1.5` (`preview.css` 의 `:root`).
- **고해상도 모바일 대응**: `@media (min-resolution: 200dpi)` 에서 폰트 1단계 키움
  (14→17 / 12→15 / 16→20px) — 터치 타깃 확대용.

---

## 4. 간격 · 모서리 (Spacing & Radius)

### 4.1 간격 스케일 — 4px 기준

`--spacing: 0.25rem` (4px) 기준, `--spacing-1`~`--spacing-10` = `N × --spacing`.

| 토큰          | px  | 사용 빈도 | 대표 용도                                    |
| ------------- | --- | --------- | -------------------------------------------- |
| `--spacing-1` | 4   | 44        | gap, 미세 패딩                               |
| `--spacing-2` | 8   | 46        | gap, 패딩                                    |
| `--spacing-3` | 12  | 26        | 수평 패딩                                    |
| `--spacing-4` | 16  | 44        | 아이콘 크기, gap                             |
| `--spacing-8` | 32  | 25        | **컨트롤 높이 표준** (Button/Input `height`) |

> 고해상도 모바일(`200dpi+`)에서 `--spacing` 자체가 `0.25rem × 1.25` 로 확대 → 전 간격 동시 스케일.

### 4.2 Radius 스케일

| 토큰          | 값   | 사용 빈도 | 용도                           |
| ------------- | ---- | --------- | ------------------------------ |
| `--radius-sm` | 6px  | 10        | 작은 인디케이터(checkbox), kbd |
| `--radius`    | 8px  | 40        | **기본** — 버튼·입력·카드      |
| `--radius-lg` | 10px | 4         | 팝오버·오버레이                |
| `--radius-xl` | 16px | 1         | 대형 표면                      |

원형 요소는 `9999px` (아이콘 전용 버튼 등).

---

## 5. 입체감 (Elevation)

라이트/다크 모드에서 서로 다른 box-shadow 레시피를 쓰는 **물리적 입체 표현** 이 특징.

- **`--popover-shadow`**: Light `0 8px 20px rgba(0 0 0 / .12)` / Dark `… / .5`. 팝오버는
  `filter: drop-shadow(var(--popover-shadow))` 로 적용 (말풍선 화살표까지 그림자 포함).
- **`.button-base`** (아래 §6.1): inset shadow 4겹 — 하단 그림자 + 테두리 + 상단 specular
  하이라이트 + 내부 그라데이션. 라이트/다크에서 하이라이트·그림자 방향이 반전된다.
- **`.indicator`** / **`.inset`**: 동일하게 다중 inset shadow 로 볼록(indicator)/오목(inset) 효과.

---

## 6. 유틸리티 패턴 (`utilities.css`, `@layer utilities`)

컴포넌트가 직접 import 하여 className 으로 사용하는 3개 공통 시각 패턴. 각 패턴은
`--{name}-color` 같은 **로컬 변수 진입점** 을 노출 → 컴포넌트가 1줄 오버라이드로 변형.

### 6.1 `.button-base` — 볼록한 버튼형 표면

- 진입점: `--button-color` (기본 `--tint`).
- 파생: background / gradient / border / highlight / shadow / text 를 base color 의
  스케일 단계에서 자동 생성.
- 상태 분기: `[data-pressed]` (배경 1단계 진하게), `[data-focus-visible]` (포커스 링),
  `[data-selected]` (강조 배경 + 흰 전경), `[data-disabled]` (그림자 제거).
- variant: `[data-variant=secondary]` (gray 기반), `[data-variant=quiet]` (배경 없음, hover 시만 표시).
- transition: `background, color, scale, box-shadow` / `200ms`.

### 6.2 `.indicator` — 작은 컨트롤 인디케이터

- 진입점: `--indicator-color` (기본 `--gray`).
- checkbox / radio / switch thumb / slider thumb 의 공통 표면.
- `[data-selected]` / `[data-indeterminate]` 부모 하위에서 `--highlight-background` 로 전환.
- `[data-pressed]` 시 `scale: 0.9` 눌림 효과, `[data-invalid]` 시 `--invalid-color`.

### 6.3 `.inset` — 오목한 입력 영역

- 진입점: `--inset-background` (기본 `--field-background`), `--inset-border`.
- 입력 필드 / 슬라이더·프로그레스 트랙 공통.
- `.inset.track` 변형: 더 얕은 inset (트랙 전용).
- 상태: `[data-hovered/pressed]` (테두리 진하게), `[data-invalid]` (`--invalid-color`), `[data-disabled]`.

---

## 7. 컴포넌트 컨벤션

### 7.1 클래스 네이밍

- 루트: `.react-aria-{ComponentName}` (예: `.react-aria-Button`, `.react-aria-ListBox`).
- 일부 파일은 다른 컴포넌트 클래스를 루트로 공유 — `ColorPicker.css`/`Popover.css` →
  `.react-aria-Popover`, `CommandPalette.css`/`Menu.css` → `.react-aria-Menu`,
  `InputGroup.css` → `.react-aria-Group`, `SegmentedControl.css` → `.react-aria-SelectionIndicator`.
- 비-`react-aria` 헬퍼 클래스: `.field-description`, `.field-Button`, `.button-base`, `.indicator`, `.inset`.

### 7.2 상태 — `[data-*]` 속성

상태는 CSS 클래스 토글이 아니라 React Aria 가 주입하는 data 속성으로 표현. 빈도순 주요 속성:

| 속성                                 | 빈도  | 의미                                                                                                                                                             |
| ------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `[data-selected]`                    | 41    | 선택됨                                                                                                                                                           |
| `[data-focus-visible]`               | 41    | 키보드 포커스 (포커스 링 트리거)                                                                                                                                 |
| `[data-pressed]`                     | 36    | 눌림                                                                                                                                                             |
| `[data-disabled]`                    | 33    | 비활성                                                                                                                                                           |
| `[data-hovered]`                     | 11    | 호버                                                                                                                                                             |
| `[data-drop-target]`                 | 15    | 드래그 드롭 대상                                                                                                                                                 |
| `[data-empty]`                       | 9     | 빈 컬렉션                                                                                                                                                        |
| `[data-invalid]`                     | 8     | 유효성 실패                                                                                                                                                      |
| `[data-entering]` / `[data-exiting]` | 7 / 7 | 진입/이탈 애니메이션                                                                                                                                             |
| `[data-focus-within]`                | 5     | 하위 포커스                                                                                                                                                      |
| `[data-dragging]`                    | 5     | 드래그 중                                                                                                                                                        |
| 그 외                                | —     | `[data-expanded]`, `[data-indeterminate]`, `[data-placeholder]`, `[data-sort-direction]`, `[data-selection-mode]`, `[data-current]`, `[data-has-child-items]` 등 |

### 7.3 컨트롤 치수 표준

- 컨트롤 높이: `--spacing-8` (32px) — Button, Input min-height 공통.
- 수평 패딩: `--spacing-3` (12px).
- 아이콘: Button 내 svg `4.5 × --spacing` (18px), 필드 버튼 svg `--spacing-4` (16px).
- TextArea: `min-height: 64px`, 패딩 `--spacing-2 --spacing-3`.

### 7.4 폼 구조 (`Form.css`)

- `.react-aria-Form`: `flex-column`, `gap: --spacing-6` (24px).
- `.react-aria-Label`: block, weight 500, `margin-bottom: --spacing-2`.
- `.react-aria-FieldError`: `--font-size-sm`, `--invalid-color`.
- `.field-description`: `--font-size-sm`, `[data-invalid]` 부모에서 자동 숨김.

---

## 8. 모션 (Motion)

- 표준 transition: **200ms** (36회) — hover/pressed/focus 상태 변화.
- 그 외: 300ms (5) / 400ms (4) / 250ms (1) / 150ms (1).
- `@keyframes`: `modal-fade`, `modal-zoom`, `sheet-slide`, `sheet-blur`,
  `progress-fill`, `slide-in`, `slide-out`.
- 오버레이 진입/이탈: `[data-entering]` / `[data-exiting]` + `--origin` 변수로 방향별
  transform (Popover 는 placement(top/bottom/left/right)별 8px 슬라이드 + opacity).
- `will-change: scale` — scale 애니메이션 요소에 명시.

---

## 9. 접근성 · 적응

- **다크 모드**: `@media (prefers-color-scheme: dark)` — `--lightness-N` 반전 + shadow 레시피 교체.
- **고대비 모드**: `@media (forced-colors: active)` — 전 시맨틱 토큰을 시스템 색상
  (`Canvas`, `ButtonText`, `Highlight`, `GrayText`, `LinkText`, `Field` 등)으로 교체.
  `forced-color-adjust: none` 으로 커스텀 표면은 보존, 색상만 시스템 위임.
- **포커스 표시**: `[data-focus-visible]` 에 `outline: 2px solid var(--focus-ring-color)` +
  `outline-offset: 2px` (입력 필드는 `-1px` inset).
- **고해상도 모바일**: `@media (min-resolution: 200dpi)` — 폰트·간격 1.25배 확대.
- `-webkit-tap-highlight-color: transparent` — 모바일 탭 하이라이트 제거.

---

## 10. 파일 인벤토리

**토큰/유틸 (2)**: `theme.css`, `utilities.css`

**컴포넌트 CSS (53)** — 크기순 상위:
`utilities.css` 의존 없이도 `theme.css` 만 import 하는 컴포넌트가 다수.

| 규모         | 파일                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 대형 (>5KB)  | `ListBox.css`, `Table.css`, `GridList.css`, `Tree.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 중형 (2~5KB) | `Menu.css`, `Slider.css`, `Tabs.css`, `RangeCalendar.css`, `ProgressBar.css`, `TagGroup.css`, `Toast.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 소형         | `Calendar`, `Checkbox`, `DateField`, `Disclosure`, `Switch`, `RadioGroup`, `Modal`, `Sheet`, `NumberField`, `SearchField`, `DateRangePicker`, `Tooltip`, `SegmentedControl`, `ToggleButtonGroup`, `Popover`, `ColorSlider`, `InputGroup`, `Meter`, `Button`, `ToggleButton`, `Select`, `DropZone`, `ColorPicker`, `ComboBox`, `Link`, `Breadcrumbs`, `Toolbar`, `ColorThumb`, `CheckboxGroup`, `DatePicker`, `CommandPalette`, `Separator`, `Dialog`, `ColorArea`, `ColorSwatch`, `ColorSwatchPicker`, `ColorWheel`, `ColorField`, `TextField`, `DisclosureGroup`, `Content`, `TimeField` |

**스토리 전용 (2)**: `stories/styles.css`, `.storybook/preview.css` — 디자인 시스템 아님.

---

## 11. composition 연계 주의

> 본 패키지는 upstream 스냅샷이다 (`UPSTREAM.md`). 본 문서의 토큰 네이밍
> (`--text-color`, `--field-background`, `--gray-N` 등)은 **upstream 원본 명칭** 으로,
> composition 의 시맨틱 변수 체계(`--bg-*` / `--fg-*` / `--border-*`,
> `.claude/rules/css-tokens.md`)와 **다르다**. composition 제품 CSS 는 후자를 사용한다.
>
> - composition D3(시각 스타일) SSOT 는 `packages/specs` 이며, 본 starter CSS 가 아니다.
> - 이 starter 의 디자인 언어를 composition 에 반영할 때는 `theme.css` 토큰 →
>   composition 시맨틱 변수 매핑을 거쳐 Spec 으로 내재화한다 (직접 복사 금지).
> - upstream 갱신 시 본 문서도 `UPSTREAM.md` §Update Flow 4단계에 맞춰 재생성한다.
