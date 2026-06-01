## Overview

### Reference Boundary

**reference baseline, not runtime SSOT.**

본 문서는 `packages/react-aria-starter/src` 의 CSS 에서 추출한 **단일 공통** token/패턴
reference 다. composition 의 시각 정본이 아니라, 시각 정본을 저작할 때 참조하는 입력
가이드다.

- 본 문서의 top-level section 은 Google DESIGN.md spec
  (`google-labs-code/design.md`, alpha)의 생성 툴 출력 포맷을 따른다. composition 확장
  섹션(Motion / Mapping / Appendix)은 같은 포맷으로 Components 뒤, Do's and Don'ts 앞에
  둔다. YAML hex-token front matter layer 는 미채택한다. composition 은 OKLCH
  relative-color 모델과 light/dark adaptation 을 쓰며, 본 문서는 runtime 계약이 아니다.
- ADR-142 runtime D3 시각 SSOT = **theme/tokens root collection** (+ `PrimitiveBinding`
  - canonical 문서). 본 문서는 그 저작의 입력일 뿐 런타임 계약으로 승격하지 않는다.
- **컴포넌트별 design.md 생성 금지** — starter 디자인 분석의 유일 문서는 본 파일
  하나다 (`src/` 하위 컴포넌트별 문서 추가는 중복 SSOT 를 만든다).
- starter 는 upstream 스냅샷이다 (`UPSTREAM.md`). `src/` 원본은 수정하지 않는다.

### 역할

- starter 56개 CSS 의 token/패턴을 **중복 제거**해 한 곳에 정규화한 reference.
- ADR-142 의 spec 이행(theme/tokens 저작 / `PrimitiveBinding` 작성 / reusable 문서)에서
  **필수 선행 입력**으로 쓰인다 — Colors / Typography / Layout / Elevation & Depth /
  Shapes / Components / Motion / Mapping / Appendix / Do's and Don'ts 를 spec 이행 전 확정
  입력으로 제공한다.
- **정본 아님**: 본 문서는 런타임이 import 하지 않는다. 시각 정본은 theme/tokens root
  collection 이다.

### starter 스타일링 원칙

- 모든 컴포넌트는 `.react-aria-{ComponentName}` 단일 루트 클래스로 시작.
- 상태는 클래스 토글이 아닌 **`[data-*]` 속성**으로 표현 (React Aria 가 DOM 에 주입).
- 색상 하드코딩 없음 — 컴포넌트 CSS 에 hex 색상 0건, 모두 `var(--*)` 토큰 사용.
- CSS Nesting 적극 사용 (`&[data-*]`). 빌드 시 Lightning CSS / PostCSS Nesting 으로 평탄화.

### token ↔ 런타임 주입 변수 구분 (CRITICAL)

`var(--*)` 참조 중 일부는 **design token 이 아니라 React Aria 가 런타임에 주입하는
레이아웃 변수**다. 본 문서의 token 표는 후자를 포함하지 않는다.

- design token: `theme.css` / `utilities.css` 가 정의 — Colors / Typography / Layout /
  Elevation & Depth / Shapes / Components / Motion / Mapping 의 대상.
- 런타임 주입 변수 (토큰 아님): `--trigger-width`, `--visual-viewport-height`,
  `--origin`, `--page-height`, `--percent`, `--start`, `--size`, `--tab-panel-width/height`,
  `--tree-item-level`, `--table-row-level`, `--disclosure-panel-height` 등. RAC 가 style
  속성으로 주입 → D1/런타임 영역, theme/tokens 대상 아님.

## Colors

정의 원천은 `theme.css` (전역) + `utilities.css` (유틸 진입점)이다. starter 의 color
모델은 hex 단일값이 아니라 OKLCH relative color + semantic token + light/dark adaptation
조합이다.

### Color (OKLCH)

모든 색상은 **OKLCH** 색공간의 `oklch(from … l c h)` relative color 로 파생된다.
한 base hue → 16단계 스케일: `oklch(from {base} {lightness-N} {chroma-N} h)`.

**Base hue 11종** — `--tint` 하나만 바꾸면 전 컴포넌트 강조색이 전환된다 (기본 `--indigo`).

| 토큰          | OKLCH                 | 토큰       | OKLCH                           |
| ------------- | --------------------- | ---------- | ------------------------------- |
| `--gray`      | `oklch(0.5 0 0)`      | `--green`  | `oklch(0.5 .121 155)`           |
| `--red`       | `oklch(0.6 .181 27)`  | `--blue`   | `oklch(0.5 .220 266)`           |
| `--orange`    | `oklch(0.7 .150 54)`  | `--indigo` | `oklch(1 .250 284)` ← 기본 tint |
| `--yellow`    | `oklch(0.8 .129 74)`  | `--purple` | `oklch(0.7 .223 302)`           |
| `--turquoise` | `oklch(0.5 .081 205)` | `--pink`   | `oklch(0.6 .178 348)`           |
| `--cyan`      | `oklch(0.4 .142 244)` |            |                                 |

> base 색상의 lightness 채널은 실제 밝기가 아니라 **chroma 배수(multiplier)**로만 쓰인다.
> 실제 밝기는 `--lightness-N` 이 결정한다.

**16단계 스케일** — `--tint-100`~`--tint-1600`, `--gray-100`~`--gray-1600` 이
`--lightness-N` × `--chroma-N` 조합으로 자동 생성. **lightness 는 라이트/다크에서 의미가
반전된다:**

| 단계   | Light L      | Dark L         |     | 단계    | Light L        | Dark L      |
| ------ | ------------ | -------------- | --- | ------- | -------------- | ----------- |
| `-100` | 98.1% (밝음) | 29.7% (어두움) |     | `-1000` | 51.9%          | 67.0%       |
| `-500` | 79.2%        | 51.9%          |     | `-1600` | 16.7% (어두움) | 100% (밝음) |

→ `--gray-100` 은 라이트에서 "거의 흰색", 다크에서 "거의 검정". 시맨틱 토큰
(`--text-color: var(--gray-1200)`)이 코드 변경 없이 양 테마에서 대비를 유지한다.
**chroma** 는 저명도 구간에서 채도를 낮춘다 (`--chroma-100 = calc(l*c*0.5)` …
`--chroma-600~1600 = c`). `--gray-50` 은 스케일 밖 특수값 (Light `#ffffff`, Dark
`oklch(22% 0 0)`).

### Semantic

컴포넌트 CSS 는 원시 스케일 대신 아래 시맨틱 토큰을 우선 사용.

| 토큰                                       | 값                                            | 토큰                               | 값                               |
| ------------------------------------------ | --------------------------------------------- | ---------------------------------- | -------------------------------- |
| `--focus-ring-color`                       | `--tint-1000`                                 | `--border-color`                   | `--gray-400`                     |
| `--text-color`                             | `--gray-1200`                                 | `--border-color-hover`             | `--gray-500`                     |
| `--text-color-hover`                       | `--gray-1300`                                 | `--border-color-disabled`          | `--gray-300`                     |
| `--text-color-disabled`                    | `--gray-600`                                  | `--field-background`               | `--gray-50`                      |
| `--text-color-placeholder`                 | `--gray-1000`                                 | `--field-text-color`               | `--gray-1400`                    |
| `--link-color` / `-secondary` / `-pressed` | `--tint-1200` / `--gray-1200` / `--tint-1300` | `--button-background` / `-pressed` | `--tint-100` / `--tint-200`      |
| `--highlight-background` / `-pressed`      | `oklch(from --tint 55%/50% c h)`              | `--highlight-foreground`           | `white`                          |
| `--highlight-background-invalid`           | `oklch(from --red …)`                         | `--highlight-overlay`              | `--tint-1000 / 15%`              |
| `--invalid-color`                          | `oklch(from --red --lightness-1000 c h)`      | `--background-color`               | Light `#f8f8f8` / Dark `#1b1b1b` |
| `--highlight-hover` / `-pressed`           | `rgb(0 0 0 / .07)` / `.15` (다크 흰색)        | `--overlay-background` / `-border` | `--gray-50` / `rgb(0 0 0 / .06)` |

> `--highlight-background*` 은 라이트/다크 **동일 값** — 흰색 전경(`--highlight-foreground`)과의
> 대비를 양 테마에서 보장하기 위함.

**적응 (adaptation)**:

- **다크 모드** `@media (prefers-color-scheme: dark)` — `--lightness-N` 반전 + shadow
  레시피 교체.
- **고대비 모드** `@media (forced-colors: active)` — 전 시맨틱 토큰을 시스템 색상
  (`Canvas`/`ButtonText`/`Highlight`/`GrayText`/`LinkText`/`Field` 등)으로 교체.

> ⚠️ **발견**: `--border-color-pressed` 는 `theme.css` 의 `forced-colors` 블록에서만
> 정의되고(`:root` light/dark 미정의), 컴포넌트 CSS 참조 0건이다 — 고대비 모드 전용
> 미사용 토큰. theme/tokens 저작 시 채택 보류 후보(Do's and Don'ts).

### State Token Naming

`{prop}` / `{prop}-hover` / `{prop}-pressed` / `{prop}-disabled` 접미사 규칙:

- 텍스트: `--text-color` / `-hover` / `-disabled` / `-placeholder`
- 테두리: `--border-color` / `-hover` / `-disabled` (`-pressed` 는 고대비 전용·미사용)
- 버튼 배경: `--button-background` / `-pressed`
- 강조 배경: `--highlight-background` / `-pressed` / `-invalid`
- 중립 오버레이: `--highlight-hover` / `-pressed` (배경 위 hover/pressed 음영)

### States

- hover/pressed 는 유틸 패턴(Components / Utilities)의 진입점 변수(`--button-color` 등)나
  시맨틱 `-hover` / `-pressed` 토큰으로 파생.
- pressed micro-interaction: `[data-pressed]` 시 `scale: 0.9` (indicator, segmented-control item).
- disabled: `-disabled` 토큰 + box-shadow 제거.

## Typography

| 토큰             | 값              | 200dpi+ | 비고          |
| ---------------- | --------------- | ------- | ------------- |
| `--font-size`    | 0.875rem (14px) | 17px    | 본문 기본     |
| `--font-size-sm` | 0.75rem (12px)  | 15px    | 설명·에러·kbd |
| `--font-size-lg` | 1rem (16px)     | 20px    | 강조          |

font-family `system-ui` 고정, font-weight 본문 normal · Label/Button 등 `500`,
line-height `1.5`.

## Layout

### Spacing System

`--spacing: 0.25rem` (4px) 기준, `--spacing-1`~`--spacing-10` = `N × --spacing`.
주요: `-1`(4) `-2`(8) `-3`(12, 수평 패딩) `-4`(16, 아이콘) `-8`(32, **컨트롤 높이
표준** → field-height).

> 고해상도 모바일(`@media (min-resolution: 200dpi)`)에서 `--spacing` 자체가
> `0.25rem × 1.25` 로 확대 → 전 간격 동시 스케일.

### group-seam — 그룹 컨트롤 이음

인접 컨트롤을 하나의 단위로 시각 결합하는 패턴. **바깥 컨테이너가 border/radius/
overflow 를 소유하고, 안쪽 항목은 테두리 없이 flush** 배치된다.

- **SegmentedControl**: `border-radius: 9999px` pill 컨테이너 + 절대배치
  `.react-aria-SelectionIndicator`(z-index:-1)가 선택 항목 뒤에서 `translate`/`width`
  200ms transition 으로 슬라이드. 항목 자체는 테두리 없음.
- **InputGroup**: `.react-aria-Group` flex 컨테이너 + `border-radius: var(--radius)` +
  `overflow: hidden` + `[data-focus-within]` 단일 outline. 내부 Input/Button 은 테두리·
  배경 없이 flush.
- **ToggleButtonGroup**: 같은 계열 — 그룹이 단일 외곽, 항목은 seam 으로 연결.

### overlay-size — 오버레이 표면 치수

Popover / Modal / ColorArea / ColorWheel 등 오버레이·표면은 고정 px 치수
(관측 100·150·200·250·300·500px)를 쓴다 — **토큰화되지 않은 영역**. theme/tokens 저작
시 별도 판정 필요(Do's and Don'ts).

### field-height — 컨트롤 높이 표준

표준 컨트롤 높이 = `--spacing-8` (32px). Button / Input / ComboBox / Date\* / ListBox·
Menu·Tree item / ToggleButton / SegmentedControl item 등에 적용.

> ⚠️ **발견**: `InputGroup.css` · `Separator.css` · `Table.css`(2곳)는 `var(--spacing-8)`
> 대신 리터럴 `32px` 를 하드코딩 — 동일 값의 비일관 표현(중복 요소). theme/tokens 저작
> 시 control-height 단일 규칙으로 정규화.

## Elevation & Depth

라이트/다크에서 서로 다른 box-shadow 레시피를 쓰는 물리적 입체 표현.

- `--popover-shadow`: Light `0 8px 20px rgba(0 0 0/.12)` / Dark `… /.5`. 팝오버는
  `filter: drop-shadow(var(--popover-shadow))` 로 적용.
- `.button-base` / `.indicator` / `.inset`: 다중 inset shadow 레시피(Components /
  Utilities). 라이트/다크에서 하이라이트·그림자 방향이 반전.
- 흰색/검정 alpha 오버레이(`rgb(255 255 255/.N)`, `rgb(0 0 0/.N)`)는 specular highlight·
  inner shadow 용 — 토큰화 안 됨, 레시피는 `utilities.css`(Components / Utilities).

## Shapes

### Border Radius Scale

| 토큰          | 값   | 용도                           |
| ------------- | ---- | ------------------------------ |
| `--radius-sm` | 6px  | 작은 인디케이터(checkbox), kbd |
| `--radius`    | 8px  | **기본** — 버튼·입력·카드      |
| `--radius-lg` | 10px | 팝오버·오버레이                |
| `--radius-xl` | 16px | 대형 표면                      |

완전 둥근 형태(`9999px`)는 토큰이 아니라 반복 리터럴이다 → **pill 패턴**.

### pill — 완전 둥근 형태

- `border-radius: 9999px`. 컴포넌트 CSS 에 **18곳** (토큰 아님, 리터럴 반복).
- 사용처: 원형 day cell(Calendar / RangeCalendar 범위 끝) · 둥근 트랙(Meter /
  ProgressBar / Slider) · pill 컨테이너(SegmentedControl / SearchField / TagGroup 태그) ·
  아이콘 버튼(Button) · 스와치(ColorSwatch / ColorSwatchPicker) · ToggleButton.
- 정규화 제안: `radius` 스케일에 "full/pill" 단계로 흡수 가능.

## Components

상태(hover / pressed / focus-visible / disabled)는 클래스가 아니라 RAC 가 주입하는
`[data-*]` 속성으로 트리거되고, 시맨틱 토큰 네이밍 규칙으로 표현된다.

### Utilities (`utilities.css`, `@layer utilities`)

컴포넌트가 className 으로 직접 사용하는 3개 공통 시각 패턴. 각 패턴은 `--{name}-color`
류 **로컬 진입점 변수**를 노출 → 컴포넌트가 1줄 오버라이드로 변형.

**`.button-base` — 볼록한 버튼형 표면**

- 진입점: `--button-color` (기본 `--tint`).
- 파생: `--button-background/-gradient/-border/-highlight/-shadow/-text` 를 base color 의
  스케일 단계에서 자동 생성. inset shadow 4겹(하단 그림자 + 테두리 + 상단 specular
  하이라이트 + 내부 그라데이션).
- 상태: `[data-pressed]`(배경 1단계 진하게) / `[data-focus-visible]`(포커스 링) /
  `[data-selected]`(강조 배경 + 흰 전경) / `[data-disabled]`(그림자 제거).
- variant: `[data-variant=secondary]`(`--button-color: --gray`) / `[data-variant=quiet]`
  (배경 없음, hover 시만 표시).
- transition: `background, color, scale, box-shadow` / 200ms.

**`.indicator` — 작은 컨트롤 인디케이터**

- 진입점: `--indicator-color` (기본 `--gray`).
- checkbox / radio / switch thumb / slider thumb 의 공통 표면.
- `[data-selected]` / `[data-indeterminate]` 부모 하위에서 `--highlight-background` 로 전환.
- `[data-pressed]` 시 `scale: 0.9`, `[data-invalid]` 시 `--invalid-color`.

**`.inset` — 오목한 입력 영역**

- 진입점: `--inset-background`(기본 `--field-background`) / `--inset-border`.
- 입력 필드 / 슬라이더·프로그레스 트랙 공통.
- `.inset.track` 변형: 더 얕은 inset (트랙 전용).
- 상태: `[data-hovered/pressed]`(테두리 진하게) / `[data-invalid]` / `[data-disabled]`.

### focus-visible

`[data-focus-visible]` → `outline: 2px solid var(--focus-ring-color)` + `outline-offset`:

| 컨텍스트              | offset | 비고                               |
| --------------------- | ------ | ---------------------------------- |
| 기본                  | `2px`  | 버튼·인디케이터 등                 |
| 입력 필드 (`.inset`)  | `-1px` | 안으로 들어간 영역 — inset outline |
| SegmentedControl item | `4px`  | pill 컨테이너 외곽 여유            |

### `[data-*]` 상태 속성 (빈도순)

`[data-selected]`(41) · `[data-focus-visible]`(41) · `[data-pressed]`(36) ·
`[data-disabled]`(33) · `[data-drop-target]`(15) · `[data-hovered]`(11) ·
`[data-empty]`(9) · `[data-invalid]`(8) · `[data-entering]`/`[data-exiting]`(7/7) ·
`[data-focus-within]`(5) · `[data-dragging]`(5) · 그 외 `[data-expanded]` /
`[data-indeterminate]` / `[data-placeholder]` / `[data-sort-direction]` /
`[data-selection-mode]` / `[data-current]` / `[data-has-child-items]`.

## Motion

- 표준 transition **200ms** — 전체 CSS 에 36회(컴포넌트 CSS 34회 + `utilities.css` 2회).
  **토큰화되어 있지 않음**(리터럴 반복) — de-facto 표준값.
- 그 외: 300ms(5) / 400ms(4) / 250ms(1) / 150ms(1).
- `@keyframes`: `modal-fade` / `modal-zoom` / `sheet-slide` / `sheet-blur` /
  `progress-fill` / `slide-in` / `slide-out`.
- 오버레이 진입/이탈: `[data-entering]` / `[data-exiting]` + `--origin`(런타임 주입)별
  방향 transform.

### De-facto Standards

토큰이 없으나 사실상 표준값으로 반복되는 항목 — theme/tokens 저작 시 토큰화 검토 대상:

- transition duration `200ms` (36회).
- border-width `1px` / focus-outline `2px`.
- 흰색/검정 alpha 오버레이(specular highlight·inner shadow 레시피, `utilities.css`).

## Mapping

starter 의 token/패턴을 composition 시맨틱으로 번역하고 ADR-142 의 어느 SSOT 로
반영되는지 기록한다. **composition 시맨틱 측 정의는 `.claude/rules/css-tokens.md` 가
정본** — 본 표는 그것을 참조하며 재정의하지 않는다.

| starter rule (DESIGN.md section set)      | composition 시맨틱 (css-tokens.md)         | ADR-142 반영 대상                                        |
| ----------------------------------------- | ------------------------------------------ | -------------------------------------------------------- |
| `--text-color` / `-hover` / `-disabled`   | `--fg` / `--fg-emphasis` / `--fg-disabled` | theme/tokens root collection                             |
| `--background-color`                      | `--bg`                                     | theme/tokens root collection                             |
| `--overlay-background`                    | `--bg-overlay`                             | theme/tokens root collection                             |
| `--field-background`                      | `--bg-inset`                               | theme/tokens root collection                             |
| `--border-color` / `-hover` / `-disabled` | `--border` / `-hover` / `-disabled`        | theme/tokens root collection                             |
| `--highlight-background` (accent)         | `--accent`                                 | theme/tokens root collection                             |
| `--focus-ring-color`                      | `--focus-ring`                             | theme/tokens root collection                             |
| radius 스케일                             | radius 토큰                                | theme/tokens root collection                             |
| spacing 스케일                            | spacing 토큰                               | theme/tokens root collection                             |
| typography                                | typography 토큰                            | theme/tokens root collection                             |
| focus-visible 전역 규칙                   | focus 상태 규칙                            | theme/tokens (generic 렌더러 상태 CSS)                   |
| `.button-base` 유틸                       | 버튼 시각 패턴                             | theme/tokens + `PrimitiveBinding`(Button)                |
| `.indicator` 유틸                         | 인디케이터 패턴                            | theme/tokens + `PrimitiveBinding`(Checkbox/Radio/Switch) |
| `.inset` 유틸                             | 입력 inset 패턴                            | theme/tokens + `PrimitiveBinding`(field 계열)            |
| pill (`9999px`)                           | radius full/pill 단계                      | theme/tokens root collection                             |
| group-seam                                | 그룹 컨테이너 구조 규칙                    | reusable canonical 문서 (그룹 컴포넌트)                  |
| field-height (`--spacing-8`)              | control-height 규칙                        | theme/tokens + `PrimitiveBinding`                        |
| overlay-size                              | (판정 보류 — Do's and Don'ts)              | 별도 판정                                                |
| motion: transition/keyframes/enter-exit   | motion 규칙                                | theme/tokens + generic 렌더러 상태 CSS                   |

> "반영 대상" 열은 theme/tokens 항목 / `PrimitiveBinding` / reusable canonical 문서 중
> 하나 — ADR-142 의 "결과 반영은 `componentCatalog` / `PrimitiveBinding` / reusable
> canonical 문서로만" 원칙과 정합한다.

## Appendix

### Source Inventory

`packages/react-aria-starter/src` 의 CSS 총 **56개** = 토큰/유틸 2 + 컴포넌트 54.

- **토큰/유틸 (2)**: `theme.css`, `utilities.css` — 본 문서의 token/utility 정의 원천.
- **컴포넌트 CSS (54)** — 각 1파일, 상단에서 `theme.css` / `utilities.css` 를 `@import`.
  대형(>5KB): `ListBox` `Table` `GridList` `Tree`. 중형(2~5KB): `Menu` `Slider` `Tabs`
  `RangeCalendar` `ProgressBar` `TagGroup` `Toast`. 그 외 소형 다수.
- **스토리 전용 (2, 디자인 시스템 아님)**: `stories/styles.css`, `.storybook/preview.css`.

## Do's and Don'ts

### Do

- starter 업데이트로 다시 들어올 항목은 theme/tokens 가 starter 에서 가져온다.
- Colors 의 OKLCH 모델 / 시맨틱 색상 / 상태 색상 네이밍을 채택한다.
- Typography / Layout / Elevation & Depth / Shapes 의 token scale 을 채택한다.
- Components 의 utility 패턴(button-base / indicator / inset), focus-visible, `[data-*]`
  상태 속성을 채택한다.
- Motion / Mapping / Appendix 는 생성 툴 포맷과 같은 top-level 확장 섹션으로 유지한다.

### Don't

- composition 시맨틱 변수 체계(`--bg-*` / `--fg-*` / `--border-*` / `--accent-*`)를
  starter upstream 명칭(`--text-color`, `--gray-N`, `--field-background`)으로 대체하지
  않는다. Mapping 표를 거친다.
- S2 TokenRef 체계(`{color.accent}` 등), tint preset system 을 starter 명칭으로 덮지 않는다.
- 금지된 M3 토큰은 채택하지 않는다.
- design.md 를 runtime D3 SSOT 나 런타임 계약으로 승격하지 않는다.
- `packages/react-aria-starter/src` 하위에 컴포넌트별 design.md 를 추가하지 않는다.

> **upstream 갱신 시**: 본 문서는 `UPSTREAM.md` §Update Flow 에 맞춰 재생성한다. starter
> 스냅샷이 바뀌면 Google DESIGN.md top-level section set 과 composition 확장(Motion /
> Mapping / Appendix)의 token/패턴을 재추출하고 Mapping 표를 갱신한다. 본 문서는 그 시점
> 외에는 freeze 상태를 유지한다(ADR-142 Phase 0 산출물).
