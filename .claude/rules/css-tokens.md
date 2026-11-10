---
description: CSS 토큰 S2 + React Aria 하이브리드 네이밍 규칙 (ADR-022)
paths:
  - "**/*.css"
  - "**/theme/**"
  - "**/*theme*.ts"
  - "**/*Theme*.ts"
  - "**/*Theme*.tsx"
  - "packages/rendering/src/**/*[tT]oken*"
  - "packages/shared/src/catalog/resolvers/*[tT]oken*"
---

# CSS 토큰 규칙 — S2 + React Aria Hybrid Naming (ADR-022)

- Typography 크기 샘플은 `TYPOGRAPHY_STEPS`의 키로 열거하고 값은 설치된 `typography` 맵에서 읽는다. **Why (2026-11-08):** 테마 resolver가 같은 맵에 `sans` 글꼴 문자열도 설치하므로 행간 키만 제외하고 숫자로 변환하면 Library 첫 진입·baseline 생성에서 `fontSize = NaN` 예외가 발생한다 (`phase4eTheme.test.tsx` 원복 RED → 수정 PASS).

- RAC 공유 선택 표시는 실제 indicator 자식에 `translate`·크기 전환을 선언하고, 모션 감소 규칙도 그 자식에 적용한다. **Why (2026-11-07):** SegmentedControl이 SharedElementTransition을 사용해도 indicator의 전환 시간이 0s여서 즉시 이동했다. 루트에만 적용한 reduced-motion은 자식 전환을 끄지 못한다.
- 복합 버튼의 Text가 owner 글꼴을 상속할 때 DOM binding도 명시적 `inherit`를 유지하고, 저작한 값은 보존한다. **Why (2026-11-07):** SegmentedControl 내용 Frame의 Text에서 bound 값을 삭제만 하면 기본 Text 스타일이 16px/20px로 복귀해 owner의 14px/18px 및 Canvas와 항목 폭이 달라졌다.

- Button의 `fillStyle`별 border 폭과 그 폭을 뺀 control padding은 같은 catalog 조건 트리에서 파생한다. DOM에는 저작한 border 제거만 인라인으로 쓴다. **Why (2026-11-02)**: 크기별 thin 토큰 고정으로 outline이 2px 대신 1px이었고, 파생된 fill 0px을 인라인으로 쓰면 quiet Select의 CSS 밑줄을 덮는다 (Builder 21조건 Canvas·Preview 두께/크기 및 reload 일치, 인접 field 회귀 통과).

> **SSOT 체인 연계**: CSS는 [ssot-hierarchy.md](ssot-hierarchy.md) **D3(시각 스타일)의 direct consumer** — 모든 컴포넌트가 catalog rule → `generate-css.ts` 경유 (Frame/Group/Slot 포함 — spec 파일은 ADR-248 에서 삭제, CSS 는 catalog rule 을 `generate-css.ts` 가 `renderers/CSSGenerator.ts` 로 생성; [ADR-142](../../docs/adr/completed/142-starter-spec-component-system-cutover.md) Implemented, ADR-036 Superseded). Skia consumer와 **대등(symmetric)**. 수동 CSS가 SSOT(catalog)에서 파생 아닌 경우 D3 위반 (ADR-059 로 해체 완료 — Implemented 2026-04-15). `@sync` 주석으로 CSS↔CSS 참조는 consumer-to-consumer 금지 패턴.

## 시맨틱 변수 네이밍 규칙

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
--bg-raised   Builder chrome 전용 (패널 헤더 · section-header) — 테마 토큰 `{color.raised}` 는 ADR-302 에서
              삭제 (사용자 컴포넌트는 `{color.layer-2}` · Popover 는 `--popover-background`)
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

### 금지 패턴

```
❌ background: var(--border);        → 테두리 변수를 배경에 사용 금지
❌ color: var(--accent);             → accent를 일반 텍스트에 사용 금지 (바탕 위 글자는 --accent-content, ADR-290)
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

**Spectrum Hub background layers 적용 (2026-11-10 사용자 요청)**: 이 표면이 Hub 의 **elevated** 다 — editing context 에서 canvas 위에 뜨는 toolbar · panel · popover. 그래서 팝오버 · 메뉴 · tooltip · Toast · Dialog · command palette 도 같은 토큰을 읽는다. 캔버스 바깥은 Hub 의 **pasteboard** (`--bg-pasteboard`) 이고 위에는 떠 있는 표면과 문서만 놓인다.

| 토큰                        | 용도                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--chrome-surface`          | 떠 있는 표면의 색 (Hub elevated) — light 흰색 · dark `--bg-raised`                                                                                                                                      |
| `--chrome-border`           | `0` — **테두리 없음**. 분리는 그림자로만                                                                                                                                                                |
| `--chrome-radius`           | 모서리 (`--radius-lg` 10 — 패널 · Toast) · 팝오버 · toolbar 는 `--chrome-radius-popover` · `--chrome-radius-toolbar` (안쪽 모서리 + 여백 = 12) · Dialog 는 `--chrome-radius-dialog` (`--radius-2xl` 16) |
| `--chrome-padding` / `-gap` | 안쪽 여백 · 항목 간격                                                                                                                                                                                   |
| `--chrome-shadow`           | 고도 하나 — Hub elevated 단 (`--shadow-md`). dark 는 1px 테두리 선을 그림자 고리로 더한다                                                                                                               |
| `--bg-pasteboard`           | 캔버스 바깥 (Hub pasteboard — light neutral-200 · dark zinc-950, 떠 있는 표면보다 어두운 단)                                                                                                            |

- ❌ chrome 표면 · 팝오버 · Dialog 에 `--bg-raised` / `--bg-overlay` / `--shadow-sm` / `--shadow-lg` / 직접 쓴 그림자 값 **사용** — 같은 층이 자리마다 다른 높이로 읽힌다 (종전: 패널 sm · 팝오버 lg · Dialog `0 18px 54px`)
- ❌ `--shadow-lg` 를 놓여 있는 표면에 — Hub 에서 가장 진한 단은 끌고 있는 대상의 것이다
- ❌ chrome 에 `border` / `outline` 링 추가 (구 `--border-pressed` + placed outline = 링 2겹). dark 의 테두리 선은 `--chrome-shadow` 안의 고리 하나다 — 크기가 바뀌지 않는다
- ❌ 뒤 가림막이 있는 Dialog 에 그림자 (Hub drop shadow — overlay 가 있으면 더하지 않는다)
- ❌ 표면색 3종 분기 (`--bg-muted` / `--bg-overlay` 혼용)
- 그림자 토큰의 dark 값은 `[data-builder-theme="dark"]` 에 건다 — 빌더 문서는 `data-theme` 을 세우지 않는다. **Why (2026-11-10)**: `builder-shadow-tokens.css` 의 dark 값이 `[data-theme="dark"]` 에 걸려 빌더 dark 에서도 light 값 (8% · 4%) 이 그려졌고, 패널 · toolbar 가 캔버스에 묻혔다 (스냅샷 69 화면 실측 — Hub 는 dark 에서 3 배).
- `--bg-raised` (gray-50) 는 떠 있는 표면이 아니라 그 안의 한 단 낮은 면이다 (section 머리글 · 표 머리글 · 읽기 전용 칸). **Why (2026-11-10)**: light 의 `--bg-raised` 를 흰색으로 올리면 Data 표의 읽기 전용 칸 · 머리글이 편집 칸과 같은 색이 된다 — 떠 있는 표면색은 `--chrome-surface` 로만 바꾼다. 패널 머리글 (제목 · 탭 행) 은 프레임과 같은 `--chrome-surface` 다.
- 게이트: `apps/builder/src/builder/styles/chromeIsland.static.test.ts`

### Spectrum Hub 개념의 빌더 적용 (2026-11-10 사용자 「전부 진행」)

사용자 컴포넌트 (catalog) 는 빌더와 분리돼 있으므로 (ADR-305) 아래는 빌더 chrome 에만 닿는다. Hub 의 **역할** 을 따르고 값은 빌더 사다리 (Tailwind gray · zinc) 에서 고른다.

- **모서리 단 = Hub rounding**: small 4 (`--radius-sm` — in-field 버튼 · 격자 칸) · medium 8 (`--radius-md` — 컨트롤 · 목록 행 · 메뉴 항목) · large 10 (`--radius-lg` — 패널 · Toast) · extra-large 16 (`--radius-2xl` — Dialog). 공유 토큰 (md 6 · lg 8) 을 `builder-system.css` 의 빌더 범위에서 다시 준다. ❌ 모서리 값 직접 쓰기 (`6px` · `8px`)
- **팝오버 모서리 = 항목 모서리 + 목록 여백 (사용자 결정 2026-11-10)**: `--chrome-radius-popover: calc(var(--radius-md) + var(--chrome-padding))` = 12. 팝오버 안의 행 (Select · ComboBox · 고르기 목록 · 메뉴 · 제안 목록) 은 `--radius-md`, 목록 여백은 `--spacing-xs`. Hub 는 안쪽 + 여백으로 바깥을 정하지 않고 (S2 는 Popover 10 · 항목 8 · 여백 8) 12 는 Hub 단에 없는 값이라 숫자가 아니라 식으로 둔다. **Why**: 첫 · 끝 항목이 모서리에 바로 붙어 hover 때 채워지는데, 목록 항목은 4 · 메뉴 항목은 8 · 제안 목록과 행 메뉴는 2 로 갈려 있었고 팝오버는 패널과 같은 10 이라 모서리 간격이 변과 달랐다. toolbar (rail · 뷰포트 컨트롤 · action group · 액션바 — 여백 `--chrome-padding` 4 + 버튼 8) 도 같은 식의 `--chrome-radius-toolbar` 다. 패널은 10 그대로 — 모서리에 닿는 것이 머리글 · 탭 줄이고 16 은 Dialog 단이다. ❌ 팝오버 · toolbar 에 `--chrome-radius` · 팝오버 행에 `--radius-sm` · `--radius-xs` (게이트 `chromeIsland.static.test.ts`)
- **컨트롤에는 그림자 없음** (Hub drop shadow — 그림자는 떠 있는 표면과 강조한 container 의 것). 선택 · 칩은 채움으로 가른다 (track `--bg-muted` 위 `--bg-overlay` pill · 선택 탭 `--bg-muted`). ❌ 패널 안 컨트롤에 `--shadow-sm`. 예외: 손잡이 · 색 견본 · 썸네일, 대시보드 카드 hover (Hub emphasized hover)
- **파랑은 역할 둘** (Hub attention hierarchy): `--focus-ring` = focus 표시 (인접 면 대비 3:1 — light blue-600 · dark blue-400), `--canvas-selection` / `-strong` = 캔버스 선택과 그것을 비추는 패널 표시 (page header · grid track · spacing 배지 — Skia 선택 테두리와 같은 파랑). **패널의 선택 표시는 무채** — `--accent` 테두리 + `--bg-muted` 채움, 진한 채움 위 글리프는 `--fg-on-accent`. ❌ 선택 · hover 에 `--color-primary-*` (light 고정 팔레트라 dark 에서 밝은 면이 뜬다) · `--focus-ring`
- **보조 글자 대비**: `--fg-muted` 는 놓이는 면 전부에서 4.5:1 (light gray-600 · dark zinc-300)
- **문구는 sentence case** (Hub grammar and mechanics): 표시 문구의 정본은 `apps/builder/src/i18n/messages/en-US.ts` 다. **binding 의 `label` 과 패널의 `label=` 문자열은 번역 조회 키** (`i18n/labels.ts` `semanticLabelKeys`) 라 고치면 번역이 끊긴다 — 키가 없는 라벨 (원문이 그대로 보인다) 만 원문을 sentence case 로 쓴다. 접두를 떼어 칩 글자를 만드는 라벨 (`Show …` · `Hide …`) 은 남은 글자가 키인지 본다 (`Show Value Label` → `Value Label`)

### 컨트롤 크기 — 2티어뿐

| 토큰                | 값   | 대상                                                                                           |
| ------------------- | ---- | ---------------------------------------------------------------------------------------------- |
| `--control-size`    | 28px | 필드 · 탭 · 라벨 액션(`.control-button`) · 목록/트리 행 · 인라인 아이콘 버튼 · action bar 항목 |
| `--control-size-lg` | 32px | chrome island 버튼 · `panel-header` · `section-header` 행 · SearchField                        |

**아이콘 전용 정사각 컨트롤의 기하 정본은 `styles/modules/builder-control-size.css` 한 파일**이다. 자리마다 크기를 바꿀 때는 `--icon-control-size` 만 다시 준다.

- ❌ **`padding × 2 + 아이콘` 으로 크기 만들기** — 크기가 규칙의 결과가 아니라 부작용이 된다. 실제로 같은 `.iconButton` 이 자리마다 20 / 24 / 32px 이었다
- ❌ 개별 규칙에서 `width` / `height` / `padding` 재선언 — 소유자는 기하 정본 파일 하나
- ❌ 세 번째 크기 도입 (`--text-xl` 같은 타이포 토큰을 상자 크기로 전용하는 것 포함)
- ❌ 자리 이름 토큰 부활 (`--inspector-control-size` / `--header-height`) — 이름이 자리를 가리키면 다른 자리의 컨트롤이 소비할 근거를 잃고, 그게 파생 크기가 생긴 경로다
- 게이트: `apps/builder/src/builder/styles/controlSize.static.test.ts`

**이 2티어는 빌더 chrome 의 크기다 — 사용자 컴포넌트의 크기와 무관하다 (ADR-295 Decision 8 · ADR-305).** 사용자 컴포넌트의 control 높이는 catalog 토큰 `{size.height.*}` (S2 값 — desktop S 24 · M 32 · L 40 · XL 48, 터치 기기 × 1.25) 이고 생성 CSS 는 그것을 `--catalog-token-*` 변수로 읽는다. **빌더 문서는 사용자 컴포넌트 시트 (생성 · 공유 수동) 를 싣지 않는다** (ADR-305) — 빌더 위젯 (CompactSelect · PropertySelect · Data RowForm · 토글 그룹 …) 은 `apps/builder/src/builder/styles/widgets/` 의 사본 (분리 직전 빌더 화면에 맞던 규칙 · catalog 토큰은 고정값으로 풀림 · 범위 `:where([data-document="builder"], …)`) 을 읽는다. 빌더 위젯 모양은 그 사본에서 고친다 — 사용자 시트와 서로 따라가지 않는다. 게이트: `styles/__tests__/chromeWidgetSheets.static.test.ts` (`pnpm test:css-boundary` — preflight · pre-push).

- **Why (2026-11-09, Data 표 선택 checkbox)**: 위젯 사본은 스냅샷에 찍힌 빌더 화면에서 쓰인 규칙만 옮겼다. 행 있는 Data 표 화면이 빠져 있어서 공용 Checkbox 의 상자 규칙 24 가 통째로 빠졌고, 선택 열에는 check 아이콘만 그려졌다. 같은 이유로 행 편집 Dialog · 표 메뉴의 규칙 13 도 빠져 있었다. 빌더에 새 화면 · 위젯을 들이면 `adr305-builder-snapshot.mjs` 화면 목록에도 넣는다. 게이트 (e) 는 빌더가 import 하는 공용 컴포넌트마다 위젯 시트에 `.react-aria-<Name>` 규칙이 있는지 본다.

- ❌ chrome CSS 에서 `var(--catalog-token-*)` 읽기 · 빌더 문서에 사용자 컴포넌트 시트 import (생성 시트 · `styles/index.css` 묶음) · `styles/widgets/` 에 기기 미디어 쿼리 (폭 · pointer — 사용자 선호 `forced-colors` · `prefers-reduced-motion` 만 허용)
- ❌ 사용자 컴포넌트 rule 에서 chrome 토큰 (`var(--radius-*)` · `var(--text-*)` · `--control-size*`) 읽기

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

## S2 Spec TokenRef 체계 (ADR-022 이름 · ADR-302 값)

이름 (TokenRef · CSS 변수) 은 ADR-022 그대로이고, **값은 alias 표 `packages/rendering/src/primitives/colorAliases.ts` 한 곳**이 정한다 — 역할마다 (축, light 단, dark 단). 축은 `accent` (tint · 사용자 hex) · `tone` (Tone) · status / named hue (Spectrum 고정 사다리) · `constant`. 단의 값은 Spectrum 사다리 (design-data — 기본 preset 은 표, 다른 tint · Tone 은 같은 모양으로 생성). 아래 표는 이름과 역할만 적는다 — 단은 alias 표를 본다.

| S2 TokenRef                                               | CSS 변수                                               | 역할                                                                                          |
| --------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `{color.accent}` · `-hover` · `-pressed`                  | `--accent` · `--accent-hover` · `--accent-pressed`     | on-accent 를 얹는 accent 면. hover · pressed = 사다리 다음 단 (design-data 상태 alias)        |
| `{color.accent-fill}` · `-hover`                          | `--accent-fill` · `--accent-fill-hover`                | S2 Button accent 면 (light 900 / dark 700 · hover 1000 / 600)                                 |
| `{color.on-accent}`                                       | `--fg-on-accent`                                       | accent 위 글자 — 두 모드 흰색                                                                 |
| `{color.accent-subtle}`                                   | `--accent-subtle`                                      | 연한 accent 배경                                                                              |
| `{color.accent-content}` · `-hover`                       | `--accent-content` · `--accent-content-hover`          | **바탕 위** accent — 글자 · 선 · track 채움 (ADR-290)                                         |
| `{color.selection-accent}` · `-hover`                     | `--selection-accent` · `--selection-accent-hover`      | Checkbox · Radio · Switch 선택 면 (S2 `accent-900`, dark 도 900)                              |
| `{color.focus-ring}`                                      | `--focus-ring`                                         | focus 표시 (design-data `focus-indicator-color`)                                              |
| `{color.neutral}`                                         | `--fg`                                                 | 기본 글자 (gray-800)                                                                          |
| `{color.neutral-subdued}`                                 | `--fg-muted`                                           | 보조 글자                                                                                     |
| `{color.gray-1000}`                                       | `--gray-1000`                                          | 색 면 (`<hue>-subtle`) 위 글자 — S2 Badge subtle · outline (hue 글자는 subtle 면 위 4.5 미달) |
| `{color.neutral-subtle}` · `neutral-hover` · `-pressed`   | `--bg-muted` · `--neutral-hover` · `--neutral-pressed` | **밝은 바탕** 중립 면과 그 상태 (다음 단)                                                     |
| `{color.neutral-fill}` · `-hover` · `-pressed`            | `--neutral-fill` · `--neutral-fill-hover` · `-pressed` | **진한 바탕** 중립 면 (Button primary) — S2 한 단 (ADR-293 결정 4)                            |
| `{color.on-neutral}`                                      | `--on-neutral`                                         | 진한 중립 면 위 글자                                                                          |
| `{color.negative}` · `-hover` · `-pressed`                | `--negative` · `--negative-hover` · `-pressed`         | 오류 · 파괴적 행동 글자                                                                       |
| `{color.negative-fill}` · `-hover`                        | `--negative-fill` · `--negative-fill-hover`            | S2 Button negative 면                                                                         |
| `{color.on-negative}`                                     | `--fg-on-negative`                                     | negative 면 위 글자                                                                           |
| `{color.<status>}` · `-subtle` · `-strong`                | `--<status>` · `--<status>-subtle` · `-strong`         | status 4 (negative · informative · positive · notice) 의 글자 · 연한 면 · 진한 글자           |
| `{color.<status>-background}` · `{color.<status>-visual}` | `--<status>-background` · `--<status>-visual`          | 정적 면 (Badge · InlineAlert · Toast) · 점 · 막대 (StatusLight · Meter) — S2 소비 지점        |
| `{color.base}`                                            | `--bg`                                                 | 앱 배경                                                                                       |
| `{color.pasteboard}`                                      | `--bg-pasteboard`                                      | 문서 바깥 (light gray-100 · dark gray-25)                                                     |
| `{color.layer-1}`                                         | `--bg-overlay`                                         | 오버레이 · 모달                                                                               |
| `{color.layer-2}`                                         | `--bg-inset`                                           | 입력 필드 · 카드 (옛 `{color.raised}` 자리 — ADR-302 사용자 결정 3)                           |
| `{color.elevated}`                                        | `--bg-elevated`                                        | 떠 있는 요소                                                                                  |
| `{color.disabled}`                                        | `--bg-disabled`                                        | 비활성 배경                                                                                   |
| `{color.border}` · `-hover` · `-disabled`                 | `--border` · `--border-hover` · `--border-disabled`    | 테두리                                                                                        |
| `{color.transparent}`                                     | `transparent`                                          | 투명                                                                                          |
| `{color.white}` · `{color.black}`                         | `--color-white` · `--color-black`                      | 팔레트 상수 (테마가 덮지 않는다)                                                              |

### Named Color (글로벌 시맨틱 없는 색상)

named hue (`--hue-{token}` + `-subtle`, hover · pressed 는 `--{token}-hover` · `--{token}-pressed`) 와 status 의 단은 alias 표가 정본이다 (ADR-302 — 옛 Tailwind 좌표 표는 삭제). 변수 목록은 `SEMANTIC_CSS_VARS` (alias 표가 만든다) 하나를 Skia seed · 생성 `semantic-palette.css` · 변환표 (`tokenResolver.ts` — shared `colorTokenToCss.ts` 는 그것을 읽는다, ADR-293) 가 같이 읽는다. `--indigo` 류 접두 없는 이름은 쓰지 않는다 (named hue 는 `--hue-` 접두). 게이트: `semanticAlias.symmetry.test.ts` (light+dark 전 토큰) · `tailwindPalette.drift.test.ts` (생성 byte-diff 0) · `adr302TwoAxis.static.test.ts` (G2 — 모든 `{color.*}` 가 alias 표, hover = pressed = 다음 단, 고정 hex 0).

## 테마 색은 resolver 한 곳 (ADR-293 · ADR-302)

catalog 가 `{color.X}` 로 읽는 테마 색은 `resolveThemeSnapshot` (`packages/shared/src/catalog/runtime/`) 이 preset 의 두 축 (accent = tint 또는 `color.accent` hex · tone = Tone) 과 델타에서 만든다 — 사다리 → alias 표 → 역할 두 벌 → 명시 델타 덮기. 기본 preset (blue · neutral) 은 seed (`colors.ts` ← 생성 `spectrumThemeColors.ts`), 다른 축은 생성 사다리 (`ladderGenerate.ts` — lazy chunk, `themeLadders.ts` 로더: 로드 전에는 seed + `THEME_LADDERS_PENDING`, 로드 뒤 Builder · Preview · Publish 가 다시 적용). 최종 `colors.light` / `colors.dark` 가 Canvas (Skia 맵) 와 Preview · Publish DOM 변수 (`cssVars` `color: true` → `applyCatalogPreviewTheme` 의 `@media not (forced-colors: active)` 블록) 에 **같은 객체**로 간다. 변수 이름은 생성 CSS 와 같은 표 하나 (`@composition/rendering` `colorTokenCssValue`).

- `preview-system.css` 는 테마 색을 계산하지 않는다 — 위 표의 변수를 선언하면 `generatedCssVarsDeclared.static.test.ts` 가 막는다. **폴백 없음** — 변환표의 `var(--X-hover, color-mix(…))` 폴백은 ADR-302 Phase 3 에서 지웠다 (값이 빠지면 보이게, G2 `2b`).
- 토큰 ↔ 변수 1:1 — 새 토큰에 기존 변수 (`--color-white` 등) 를 같이 쓰지 않는다. 팔레트 변수를 가리키는 토큰은 `white` · `black` 뿐 (`themeCssVarsCoverSkia.static.test.ts`). 팔레트 변수 (`--color-<family>-<step>`, ADR-191) 는 테마가 덮지 않는다.
- hover · pressed 는 그 면의 다음 단 (alias 표 — `neutral-subtle` → `neutral-hover/-pressed`, `neutral` → `neutral-fill-hover/-pressed`). 명시 델타 `<x>` 의 `<x>-hover` 는 사다리 값 그대로다 (혼합 파생 없음 — 사용자 결정 5 「override 한 값」).
- 대비: 생성 preset 은 전부 Hub 규칙을 지킨다 (G3 `adr302HubRules.test.ts` — 57 preset × 2 mode). 기본 preset (Spectrum 값) 에서 이미 미달인 항목은 「기본 preset 부채」 표와 같아야 한다.
- 값 대조: `apps/builder/tests/parity/themeColorParity.browser.test.ts` (tint 10 × Tone 5 × 모드 2 + 델타 — DOM 계산값 = Skia hex, `--tint-N` · `--tone-N` = snapshot 사다리).
- **Builder chrome 은 별도** (`builder-system.css`, `[data-context="builder"]`) — Builder 문서의 `:root` 에는 테마 색이 없다. `/` 랜딩 · Signin · Dashboard 는 `data-context="builder"`.

## accent 는 역할 둘 (ADR-290 이름 · ADR-302 값)

규칙 하나: **같은 상태에서 그 면 위에 on-accent 글자 · 아이콘을 얹으면 `{color.accent}`, surface 위에 바로 놓이는 글자 · 선 · 채움이면 `{color.accent-content}`.** dark 에서는 두 역할을 동시에 만족하는 단이 없다 (흰 글자를 얹을 면은 어둡고, 어두운 바탕 위 글자는 밝아야 한다).

- 단은 alias 표가 정하고 (Spectrum 소비 지점), 비기본 tint · 사용자 hex 는 생성 사다리의 같은 단 — 대비가 모자라면 생성기가 단을 옮긴다 (± 2 단, 그래도 안 되면 ± 2 단 안의 명도). 사용자 hex 는 색조 (c, h) 만 쓰고 명도는 사다리 모양을 따른다.
- 새 rule 이 accent 를 쓰면 `adr290AccentRoles.static.test.ts` 의 분류표에 넣는다.
- ❌ surface 위 글자 · 테두리 · focus 표시에 `var(--accent)` — `var(--accent-content)`. Builder chrome 과 같이 쓰는 sheet 는 `var(--accent-content, var(--accent))` (builder-system 에는 그 변수가 없다).

## 두 축 사다리 변수 — `--tint-N` · `--tone-N` (ADR-302 Phase 3)

resolver 가 accent 사다리 16 단 (`--tint-100` ~ `--tint-1600`) 과 tone 사다리 13 단 (`--tone-25` ~ `--tone-1000`) 을 모드별 값으로 싣는다 — Canvas 역할 색과 같은 사다리. Spectrum dark 사다리는 명도가 뒤집혀 있어 같은 단이 두 모드에서 같은 역할이다. DOM 전용 색 (`preview-system.css` — `--link` = tint-1200 · `--fg-base` = tone-800 · `--fg-disabled` = tone-400 · `--bg-emphasis` = tone-300 …) 이 이 변수를 읽는다.

- ❌ `preview-system.css` 에 `--tint` · `--tint-N` · `--tone-N` 선언 · `oklch(from var(--tint) …)` 상대색 — resolver 값을 덮거나 둘째 파생이 된다 (G2 `2b`).
- ❌ 테마 경로에서 Tailwind 단 (`--color-neutral-N`) 읽기 — 팔레트 (ADR-191) 와 테마 사다리가 섞인다 (ADR-302 R7).
- Themes 패널 Tone 견본 · 미니 프리뷰도 같은 생성 사다리 (`useToneLadders` → `toneLadder`).
- Skia 측 color-mix 처리: canvas-rendering.md의 color-mix 규칙 참조. `.button-base` 의 `color-mix` 는 `--button-color-hover` 가 없을 때만 (테마 색 변환표가 아니다).

## Utility 클래스 (ADR-018)

컴포넌트에서 variant/state 색상 블록 대신 utility 클래스 사용 권장:

- `.button-base` — `--button-color` 설정 시 hover/pressed/disabled 자동 파생
- `.indicator` — `--indicator-color` 설정 시 selected/hover 자동 파생
- `.inset` — `--inset-bg`/`--inset-border` 설정 시 focus/invalid 자동 파생

## Dark Mode — Skia 적용 (ADR-021)

Skia dark mode 적용 상세: canvas-rendering.md 참조.

핵심 체크리스트:

- `specShapesToSkia()` 두 번째 인자 `theme` 에 현재 테마 전달 (하드코딩 `"light"` 금지)
- 다크 모드 · 테마 전환은 문서의 활성 테마가 정본이다 — `workspace.applyTheme` 이 테마 key 변화를 보고 `install()` (토큰 맵 `installThemeMaps` + 패널 store `applyResolvedTheme` 의 `themeVersion` +1) 뒤 Canvas root 를 다시 만든다. store 를 직접 바꾸는 setter 는 없다 (옛 `setTint` · `setDarkMode` 계열은 2026-10-27 삭제)

- **Why (2026-11-05, Select)**: `/publish`도 Builder 번들을 읽으므로 `builder-system`의 전역 Select 상태 선택자는 catalog를 제외해야 한다. 누출 당시 Compare는 32px/0px border였지만 Preview는 34px/1px였고, Disabled 색상도 덮였다. 의미 토큰의 light/dark 값과 상태 트리를 두 소비자에 함께 연결한다. (2026-11-10 ADR-305 뒤: `/publish` 는 별도 문서라 빌더 번들을 싣지 않고, 빌더 문서의 `[data-catalog-id]` 요소는 0 이다 — 빌더 chrome 시트 · 위젯 사본의 `[data-catalog-id]` 제외는 전부 지웠다 — 특이도를 싣던 맨 `:not` 28 곳도 빌더 스냅샷 69 화면 × 4 변형 Δ 0 확인 뒤 삭제.)
