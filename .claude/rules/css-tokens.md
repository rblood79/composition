---
description: CSS 토큰 S2 + React Aria 하이브리드 네이밍 규칙 (ADR-022)
paths:
  - "**/*.css"
  - "**/theme/**"
  - "**/*theme*.ts"
  - "**/*Theme*.ts"
  - "**/*Theme*.tsx"
  - "**/*token*"
  - "**/*Token*"
---

# CSS 토큰 규칙 — S2 + React Aria Hybrid Naming (ADR-022)

> **SSOT 체인 연계 (CRITICAL)**: CSS는 [ssot-hierarchy.md](ssot-hierarchy.md) **D3(시각 스타일)의 direct consumer** — 일반 컴포넌트는 catalog binding 경유, 잔존 spec 3개(Frame/Group/Slot)는 CSSGenerator 경유([ADR-142](../../docs/adr/completed/142-starter-spec-component-system-cutover.md) Implemented, ADR-036 Superseded). Skia consumer와 **대등(symmetric)**. 수동 CSS가 SSOT(catalog 또는 잔존 spec)에서 파생 아닌 경우 D3 위반 (ADR-059로 해체 진행). `@sync` 주석으로 CSS↔CSS 참조는 consumer-to-consumer 금지 패턴.

## 시맨틱 변수 네이밍 규칙 (CRITICAL)

S2 + React Aria 혼합 패턴. 모든 컴포넌트 CSS에서 시맨틱 변수만 사용 필수.

### 네이밍 패턴: `--{카테고리}[-{변형}]`

| 카테고리                          | 용도              | 예시                                                                     |
| --------------------------------- | ----------------- | ------------------------------------------------------------------------ |
| `--bg-*`                          | Surface/배경      | `--bg`, `--bg-raised`, `--bg-overlay`, `--bg-muted`, `--bg-inset`        |
| `--fg-*`                          | Foreground/텍스트 | `--fg`, `--fg-emphasis`, `--fg-muted`, `--fg-disabled`, `--fg-on-accent` |
| `--border-*`                      | 테두리            | `--border`, `--border-hover`, `--border-pressed`, `--border-disabled`    |
| `--accent-*`                      | 강조/하이라이트   | `--accent`, `--accent-pressed`, `--accent-subtle`                        |
| `--focus-ring`                    | 포커스 인디케이터 |                                                                          |
| `--negative/positive/informative` | 상태 색상         | `--negative`, `--positive`, `--informative`, `--notice-subtle`           |

### Surface Elevation (배경 계층)

```
--bg          앱 전체 배경 (가장 낮은 레벨)
              ※ Spec TokenRef: {color.base}
--bg-raised   패널 헤더, section-header, popover/dropdown 컨테이너
              ※ Spec TokenRef: {color.raised}   — ADR-071에서 도입
              ※ popover-class (Menu/ListBox/Popover) 컨테이너 배경 표준
--bg-overlay  section-content, 모달, 카드 (가장 밝은/높은 레벨)
              ※ Spec TokenRef: {color.layer-1}
--bg-muted    중립 강조 배경 (swatch, hover row, 구분선 배경)
              ※ Spec TokenRef: {color.neutral-subtle}
--bg-emphasis 컨트롤 fill (switch track, slider track, scrollbar thumb)
              ※ Spec TokenRef: (미매핑)
--bg-inset    입력필드, 검색바, 모든 field 컨테이너 (안으로 들어간 영역)
              ※ 모든 field 컴포넌트(TextField, NumberField, SearchField, DateField,
                 TimeField, ComboBox, Select) 입력/컨테이너 영역 통일 배경
              ※ Spec TokenRef: {color.layer-2}
```

Light: `bg(gray-100) → raised(gray-100) → overlay(white) → muted(gray-200) → emphasis(gray-300) → inset(gray-50)`
Dark: `bg(zinc-900) → raised(zinc-850) → overlay(zinc-800) → muted(zinc-700) → emphasis(zinc-600) → inset(zinc-900)`

### 금지 패턴 (CRITICAL)

```
❌ background: var(--border);        → 테두리 변수를 배경에 사용 금지
❌ color: var(--accent);             → accent를 일반 텍스트에 사용 금지
❌ var(--color-gray-200)             → 원시 토큰 직접 사용 금지 (theme/ 정의 파일 제외)
❌ var(--gray-100)                   → 구 alias 사용 금지
❌ background: #fff / #1a1a1a        → 하드코딩 금지

✅ background: var(--bg-muted);      → 시맨틱 변수 사용
✅ color: var(--fg);                 → 시맨틱 변수 사용
✅ border-color: var(--border);      → 카테고리와 속성 일치
```

### 카테고리-속성 대응 규칙

| CSS 속성                          | 사용 가능 변수 카테고리                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `background` / `background-color` | `--bg-*`, `--accent-*`, `--notice-subtle`, `--negative/positive/informative`¹ |
| `color`                           | `--fg-*`, `--accent`, `--negative`, `--positive`, `--informative`             |
| `border-color` / `border`         | `--border-*`, `--accent`², `--focus-ring`³                                    |
| `outline` / `box-shadow (focus)`  | `--focus-ring`                                                                |

¹ 상태 색상을 배경에 사용: badge, indicator, drop-indicator 등 소규모 강조 요소에 허용
² `--accent`를 border에 사용: active/selected 상태 테두리 (예: 선택된 카드, editing 상태)
³ `--focus-ring`을 border에 사용: `:focus` 상태에서 outline 대신 border로 포커스 표시할 때

### 의도적 예외 (카테고리 교차 허용)

아래는 시각적/기술적 이유로 카테고리 교차 사용이 의도된 패턴:

| 패턴                                       | 위치                  | 이유                                 |
| ------------------------------------------ | --------------------- | ------------------------------------ |
| `background: var(--fg-on-accent)`          | 정렬 dot (inspector)  | CSS로 렌더링하는 작은 시각 indicator |
| `border-color: var(--bg-raised)`           | ColorPicker thumb     | 배경색과 동일한 cutout 효과          |
| `border-color: var(--fg-on-accent)`        | Select checkmark      | CSS border로 체크 아이콘 렌더링      |
| `background: var(--fg-muted)` (source dot) | `.source-dot.default` | 상태 표시 색상 indicator             |

### builder 테마의 accent 는 무채색 — `--accent-subtle` 로 강조 금지 (CRITICAL, 2026-07-26)

`[data-context="builder"]` 스코프에서 accent 계열은 **둘 다 회색**이다 (`packages/shared/src/components/styles/theme/builder-system.css`). 이름만 보고 유채색 강조를 기대하면 어긋난다.

| 토큰              | light                        | dark                         |
| ----------------- | ---------------------------- | ---------------------------- |
| `--accent-subtle` | `rgba(107,114,128,.15)`      | `rgba(161,161,170,.2)`       |
| `--accent`        | `--color-gray-700` (L 0.373) | `--color-zinc-200` (L 0.920) |

- ❌ **`--accent-subtle` 을 강조 배경으로 사용** — `--bg-overlay` 위에 얹으면 `--bg-muted`(gray-200, L 0.928) **보다 밝아서** 강조하려던 대상이 오히려 뒤로 물러난다 (Frame Preset 썸네일에서 required 슬롯 강조가 이렇게 뒤집혔다). "아주 연한 중립 wash" 로만 기대할 것.
- ✅ 강조는 **`--accent` 테두리** 또는 `background: var(--accent)` + `color: var(--fg-on-accent)` (`.list-item.applied` 가 이 어법). 무채색 chrome 이라 강조는 채도가 아니라 **명도**로 준다 — 테마에 따라 대비 방향이 뒤집히며 양쪽 다 성립한다.
- 카드 내부 도형/아이콘에 `currentColor` 를 쓰려면 **그 요소에 `color` 를 직접 선언**해야 한다. `.list-item.applied` / `.selected` 가 카드에 `color: var(--fg-on-accent)` 를 걸기 때문에, 상속에 맡기면 흰 선이 밝은 표면 위에 그려져 사라진다.

## 빌더 chrome 기하 — 표면 1종 · 크기 2티어 (CRITICAL, 2026-08-30)

색 토큰과 같은 규율이 **기하(표면·테두리·그림자·크기)** 에도 적용된다. 값을 규칙마다 손으로 쓰면 같은 요소가 자리마다 달라진다.

### Chrome island (떠 있는 표면)

좌/우 panel toggle rail · header viewport controls · header action group · contextual action bar · workspace panel frame 은 **하나의 디자인 요소**다. 정본: `builder-system.css` §Chrome island.

| 토큰                       | 용도                                              |
| -------------------------- | ------------------------------------------------- |
| `--chrome-surface`         | 표면색 (지면 `--bg-overlay` 위의 raised)          |
| `--chrome-border`          | `0` — **테두리 없음**. 분리는 그림자 단계로만     |
| `--chrome-radius`          | 모서리                                            |
| `--chrome-padding` / `-gap`| 안쪽 여백 · 항목 간격                             |
| `--chrome-shadow`          | 고도 1 — 컨트롤 island                            |
| `--chrome-shadow-floating` | 고도 2 — 자유 배치되는 panel frame                |

- ❌ chrome 표면에 `--bg-raised` / `--shadow-sm` **직접 사용** — 다시 갈린다
- ❌ chrome 에 `border` / `outline` 링 추가 (구 `--border-pressed` + placed outline = 링 2겹)
- ❌ 표면색 3종 분기 (`--bg-muted` / `--bg-overlay` 혼용)
- 게이트: `apps/builder/src/builder/styles/chromeIsland.static.test.ts`

### 컨트롤 크기 — 2티어뿐

| 토큰                | 값   | 대상                                                                          |
| ------------------- | ---- | ----------------------------------------------------------------------------- |
| `--control-size`    | 28px | 필드 · 탭 · 라벨 액션(`.control-button`) · 목록/트리 행 · 인라인 아이콘 버튼 · action bar 항목 |
| `--control-size-lg` | 32px | chrome island 버튼 · `panel-header` · `section-header` 행 · SearchField        |

**아이콘 전용 정사각 컨트롤의 기하 정본은 `styles/modules/builder-control-size.css` 한 파일**이다. 자리마다 크기를 바꿀 때는 `--icon-control-size` 만 다시 준다.

- ❌ **`padding × 2 + 아이콘` 으로 크기 만들기** — 크기가 규칙의 결과가 아니라 부작용이 된다. 실제로 같은 `.iconButton` 이 자리마다 20 / 24 / 32px 이었다
- ❌ 개별 규칙에서 `width` / `height` / `padding` 재선언 — 소유자는 기하 정본 파일 하나
- ❌ 세 번째 크기 도입 (`--text-xl` 같은 타이포 토큰을 상자 크기로 전용하는 것 포함)
- ❌ 자리 이름 토큰 부활 (`--inspector-control-size` / `--header-height`) — 이름이 자리를 가리키면 다른 자리의 컨트롤이 소비할 근거를 잃고, 그게 파생 크기가 생긴 경로다
- 게이트: `apps/builder/src/builder/styles/controlSize.static.test.ts`

**같은 선택자를 두 파일이 쓰지 않는다.** specificity 가 같으면 `@layer` 안에서는 import 순서가 판정하므로, 기하 선언은 정본 파일에만 두고 나머지 파일은 색·상태만 소유한다.

## 금지된 M3 토큰

```
CSS 변수: --primary, --on-primary, --secondary, --on-secondary,
--tertiary, --on-tertiary, --error, --on-error, --surface, --on-surface,
--outline, --outline-variant 및 모든 -container, -hover, -pressed 파생

Spec TokenRef: {color.primary}, {color.secondary}, {color.tertiary},
{color.error}, {color.surface}, {color.on-surface} 및 모든 M3 파생 토큰
```

## 금지된 구 시맨틱 변수 (리네이밍 완료)

```
--background-color → --bg
--text-color → --fg                 --text-color-placeholder → --fg-muted
--text-color-disabled → --fg-disabled   --text-color-hover → --fg-emphasis
--border-color → --border           --border-color-hover → --border-hover
--highlight-background → --accent   --highlight-foreground → --fg-on-accent
--highlight-overlay → --accent-subtle
--overlay-background → --bg-overlay --field-background → --bg-inset
--button-background → --bg-inset    --focus-ring-color → --focus-ring
--invalid-color → --negative        --info → --informative
--warning-container → --notice-subtle  --on-warning-container → --fg-on-notice
--success → --positive
```

## S2 Spec TokenRef 체계 (ADR-022)

| S2 TokenRef                  | CSS 변수 매핑                      | 용도                                                               |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------------------ |
| `{color.accent}`             | `--accent`                         | 주요 강조 배경                                                     |
| `{color.accent-hover}`       | `color-mix(--accent 85%, black)`   | accent hover                                                       |
| `{color.accent-pressed}`     | `color-mix(--accent 75%, black)`   | accent pressed                                                     |
| `{color.on-accent}`          | `--fg-on-accent`                   | accent 위 텍스트                                                   |
| `{color.accent-subtle}`      | `--accent-subtle`                  | 연한 accent 배경                                                   |
| `{color.neutral}`            | `--fg`                             | 기본 텍스트                                                        |
| `{color.neutral-subdued}`    | `--fg-muted`                       | 보조 텍스트                                                        |
| `{color.neutral-subtle}`     | `--bg-muted`                       | 연한 중립 배경                                                     |
| `{color.neutral-hover}`      | `color-mix(--bg-muted 85%, black)` | neutral 배경 hover                                                 |
| `{color.neutral-pressed}`    | `color-mix(--bg-muted 75%, black)` | neutral 배경 pressed                                               |
| `{color.negative}`           | `--negative`                       | 에러/파괴적 행동                                                   |
| `{color.negative-hover}`     | `color-mix(--negative 85%, black)` | negative hover                                                     |
| `{color.negative-pressed}`   | `color-mix(--negative 75%, black)` | negative pressed                                                   |
| `{color.on-negative}`        | `--color-white`                    | negative 위 텍스트                                                 |
| `{color.negative-subtle}`    | `--negative-subtle`                | 연한 에러 배경 (semantic-palette.css light red-100 / dark red-900) |
| `{color.informative}`        | `--informative`                    | 정보 상태 (light blue-600 / dark blue-500)                         |
| `{color.informative-subtle}` | `--informative-subtle`             | 연한 정보 배경                                                     |
| `{color.positive}`           | `--positive`                       | 성공 상태 (light green-600 / dark green-500)                       |
| `{color.positive-subtle}`    | `--positive-subtle`                | 연한 성공 배경                                                     |
| `{color.notice}`             | `--notice`                         | 경고 상태 (light orange-600 / dark orange-500)                     |
| `{color.notice-subtle}`      | `--notice-subtle`                  | 연한 경고 배경                                                     |
| `{color.negative-strong}`    | `--negative-strong`                | subtle 배경 위 텍스트 (light red-900 / dark red-200)               |
| `{color.positive-strong}`    | `--positive-strong`                | light green-900 / dark green-200                                   |
| `{color.informative-strong}` | `--informative-strong`             | light blue-900 / dark blue-200                                     |
| `{color.notice-strong}`      | `--notice-strong`                  | light orange-900 / dark orange-200                                 |
| `{color.base}`               | `--bg`                             | 앱 배경                                                            |
| `{color.raised}`             | `--bg-raised`                      | popover/dropdown 컨테이너 (ADR-071)                                |
| `{color.layer-1}`            | `--bg-overlay`                     | 오버레이/모달                                                      |
| `{color.layer-2}`            | `--bg-inset`                       | 입력 필드/카드                                                     |
| `{color.elevated}`           | `--color-white`                    | 떠있는 요소                                                        |
| `{color.disabled}`           | `--color-neutral-200`              | 비활성 배경                                                        |
| `{color.border}`             | `--border`                         | 기본 테두리                                                        |
| `{color.border-hover}`       | `--border-hover`                   | 테두리 hover                                                       |
| `{color.border-disabled}`    | `--border-disabled`                | 비활성 테두리                                                      |
| `{color.transparent}`        | `transparent`                      | 투명                                                               |
| `{color.white}`              | `--color-white`                    | 흰색                                                               |
| `{color.black}`              | `--color-black`                    | 검정                                                               |

### Named Color (글로벌 시맨틱 없는 색상)

**ADR-193 (2026-08-27)**: status(`--negative/--informative/--positive/--notice` +`-subtle`) 와 named hue(`--hue-{token}` +`-subtle`) 의 light/dark 팔레트 단계는 `packages/specs/src/primitives/semanticPaletteMap.ts` 표 하나가 정본이다 — Skia `colors.ts` 와 `theme/generated/semantic-palette.css` (`:root` / `[data-theme="dark"]`, `pnpm generate:palette`) 가 같은 표에서 파생. 매핑 파일 (`colorTokenToCss.ts` / `tokenResolver.ts`) 은 semantic var 이름만 고른다. `--indigo` 류 접두 없는 이름은 tint preset 이 점유하므로 named hue 는 `--hue-` 접두 필수. 게이트: `semanticAlias.symmetry.test.ts` (light+dark 전 토큰), `tailwindPalette.drift.test.ts` (생성 byte-diff 0 · hex 0 · ≤5KB).

| TokenRef                 | CSS 변수 매핑                        | 용도                                                                                                                                              |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `{color.purple}`         | `--hue-purple`                       | 보라 테마 (light purple-600 / dark 500)                                                                                                           |
| `{color.purple-hover}`   | `color-mix(--hue-purple 85%, black)` | purple hover — status·named hue 전 토큰의 `-hover`(85%)/`-pressed`(75%) 가 같은 규칙으로 루프 파생 (tokenResolver + colorTokenToCss, `7a0cef175`) |
| `{color.purple-pressed}` | `color-mix(--hue-purple 75%, black)` | purple pressed                                                                                                                                    |
| `{color.purple-subtle}`  | `--hue-purple-subtle`                | 연한 보라 (light 100 / dark 900)                                                                                                                  |
| `{color.gray}`           | `--hue-gray`                         | neutral-500 / dark neutral-400 (Badge gray)                                                                                                       |
| `{color.indigo}` 등 17종 | `--hue-{token}`                      | semanticPaletteMap 표 참조                                                                                                                        |

## Tint Color System (preview-system.css)

`--tint` 변수 하나로 전체 accent 색상 전환 (React Aria starter 패턴). 프리셋: `--red`, `--orange`, `--yellow`, `--green`, `--turquoise`, `--cyan`, `--blue`, `--indigo`, `--purple`, `--pink`. 자동 생성: `--tint-100` ~ `--tint-1600` (oklch relative color). ThemeStudio 오버라이드가 tint fallback보다 우선.

## Hover/Pressed 파생

`color-mix(in srgb, var(--accent) 85%, black)` = hover, `75%` = pressed. utilities.css `.button-base` 참조.
Skia 측 color-mix 처리: canvas-rendering.md의 color-mix 규칙 참조.

## Utility 클래스 (ADR-018)

컴포넌트에서 variant/state 색상 블록 대신 utility 클래스 사용 권장:

- `.button-base` — `--button-color` 설정 시 hover/pressed/disabled 자동 파생
- `.indicator` — `--indicator-color` 설정 시 selected/hover 자동 파생
- `.inset` — `--inset-bg`/`--inset-border` 설정 시 focus/invalid 자동 파생

## Dark Mode — Skia 적용 (ADR-021)

Skia dark mode 적용 상세: canvas-rendering.md 참조.

핵심 체크리스트:

- `specShapesToSkia()` 두 번째 인자에 `skiaTheme` 전달 (하드코딩 `"light"` 금지)
- `setDarkMode` 시 `themeVersion++` + `notifyLayoutChange()` 호출 필수 (누락 시 Skia 무반응)
