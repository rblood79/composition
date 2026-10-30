# ADR-295 설계 breakdown — D3 값 정렬 (S2 style macro 값 · scale · 글자 식)

> 본문: [../295-d3-token-values-s2-style-macro-scale.md](../295-d3-token-values-s2-style-macro-scale.md). 이 문서는 구현 상세 (분리 4 질문 · 인벤토리 · S2 값 표 · Phase · 파일 · 게이트 절차) 만 담는다. `docs/adr/evidence/` 는 gitignore 라 실측 결론은 여기 §6 에 둔다.

## 1. 분리 4 질문 lock-in (adr-writing.md §Fork)

이 ADR 은 두 이웃과 경계를 맞춘다 — 후속 「토큰 모델 A」 (패널 입력기 + 노드 토큰 참조 저장, 시안 [docs/design/styles-token-model/](../../design/styles-token-model/canvas.json)) 와 선행 ADR-293 (색 토큰 단일 생성).

| #   | 질문                           | 답                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | base / 응용                    | **295 = base** (토큰 **값** 층 — rule · 테마 · 두 leg 가 읽는 숫자). A = 응용 (그 값을 노드가 **이름으로 참조** 하는 저장 · 입력기). 값이 먼저 안정돼야 참조를 저장한다 — 사용자 원문 「저장소의 token 값도 … 교체 되어야」 가 값 층을 먼저 가리킨다.                                                                                                                                                                                                               |
| 2   | schema 직교성                  | 295 는 `ThemeSnapshot` 출력 (typography · size · cssVars) 과 rule 값만 바꾸고 **문서 스키마 무변경**. A 는 노드 typed field 에 토큰 참조 값 축을 더한다 (문서 스키마 변경). 직교 — A 가 295 의 specialization 이 아니라 소비자.                                                                                                                                                                                                                                     |
| 3   | 선행 전제 reverse 검증         | ADR-227 「size · spacing 은 테마 밖 (density)」 — grep: `resolveThemeSnapshot.ts` 의 맵 7 에 size 없음 (F4). 295 는 size 를 **테마** 에 넣지 않고 **시스템 scale** 에 넣으므로 227 의 전제를 뒤집지 않는다. 293 과의 의존: 293 이 `cssVars` 에 `kind` · media 구조를 만들고 295 가 그 위에 `scale` · 글자 · 높이 변수를 얹는다 — 293 → 295 가 자연 순서이며 거꾸로 가면 295 가 그 구조를 먼저 만들고 293 이 색을 얹는다 (어느 쪽도 가능, 먼저 가는 쪽이 구조 소유). |
| 4   | 판독에 전제 검증을 미루지 않음 | 위 1 ~ 3 은 ADR 작성 시점 (2026-10-30) 에 코드 grep 으로 확인. 사용자 confirm = `/create-adr` 입력 (같은 대화에서 「값 정렬 ADR 을 A 와 별도로, 값 정렬 먼저」 권고 직후).                                                                                                                                                                                                                                                                                          |

겹침 표 (293 · 290 과):

| 파일                                                             | 293          | 290                     | 295                                                     |
| ---------------------------------------------------------------- | ------------ | ----------------------- | ------------------------------------------------------- |
| `packages/shared/src/catalog/runtime/resolveThemeSnapshot.ts`    | 색 전체 출력 | accent 역할 토큰        | typography 단계 → px 두 벌 · size 맵 · scale            |
| `packages/shared/src/catalog/runtime/themeMaps.ts`               | —            | —                       | `size` · touch 맵 추가                                  |
| `packages/shared/src/components/styles/theme/preview-system.css` | 색 식 제거   | forced-colors media     | `--scale` · `--font-base` media 블록                    |
| `packages/shared/src/components/styles/theme/shared-tokens.css`  | —            | —                       | **무변경** (chrome 정적 값, Decision 8) — 머리말 주석만 |
| `packages/shared/src/catalog/generated/componentRulesTable.ts`   | —            | `{color.accent}` 재분류 | 리터럴 586 참조화                                       |

## 2. 인벤토리 (2026-10-30 실측 — Phase 0 이 재확인 · 보강)

### 2a. rule 값 종류 (`componentRulesTable.ts`)

| 키                  | 토큰 참조 | px 리터럴 | 295 처리                                             |
| ------------------- | --------: | --------: | ---------------------------------------------------- |
| fontSize            |       419 |         2 | 토큰 유지 (값이 단계 → px 로 바뀜) · 리터럴 2 참조화 |
| borderRadius        |       347 |        74 | 리터럴 74 참조화 (Decision 1 표의 단)                |
| lineHeight          |        98 |        24 | 토큰은 식 결과 · 리터럴 24 참조화                    |
| borderWidth         |        56 |         0 | 그대로                                               |
| height              |         0 |       389 | `{size.height.*}` 참조화 (scale 받음)                |
| minHeight           |         0 |         7 | 같음                                                 |
| iconSize            |         0 |        92 | `{size.icon.*}` 참조화 (scale 받음)                  |
| minWidth            |         0 |        13 | scale 받음 — 참조화 또는 `INTENTIONAL_LITERAL`       |
| paddingX / paddingY |         0 | 167 / 105 | px 고정 축 — 사용자 결정 1                           |
| gap / iconGap       |         4 |   174 / 8 | px 고정 축 — 사용자 결정 1                           |

typography 참조 분포: text-sm 114 · text-base 110 · text-lg 77 · text-xs 76 · text-2xs 19 · text-xl 13 · text-2xl 4 · text-3xl 3 · text-md 1 (**미정의 토큰 — Phase 0 에서 정리**) · text-4xl 1 · text-5xl 1. 행간 참조: xs 23 · sm 22 · base 20 · lg 16 · 2xs 8 · xl 3 · 2xl 3 · 3xl 3.
radius 참조 분포: none 164 · md 51 · full 50 · sm 37 · lg 31 · xl 12 · xs 9 · 2xl 1.
size 키: XS 35 · S 102 · M 130 · L 101 · XL 58 · XXL 3.

### 2b. 컴포넌트 높이 현황 (rule `height`)

| 컴포넌트           | XS                             | S   | M   | L   | XL  | S2 (desktop)                     |
| ------------------ | ------------------------------ | --- | --- | --- | --- | -------------------------------- |
| TextField · Select | 18                             | 22  | 30  | 42  | 54  | 20 · 24 · 32 · 40 · 48           |
| TagGroup (row)     | —                              | 24  | 32  | 40  | —   | 24 · 32 · 40 (**이미 S2**)       |
| Button             | 0 (파생 — M = 20 + 8 + 2 = 30) |     |     |     |     | 24 · 32 · 40 · 48 (`min-height`) |
| Switch track       | —                              | 21  | 29  | 41  | —   | Phase 0 추출                     |

### 2c. 테마 · 두 leg 경로

- 설치: `resolveThemeSnapshot` (`packages/shared/src/catalog/runtime/resolveThemeSnapshot.ts:56-72` 출력) → `installThemeSnapshot` → Skia `themeMaps.ts:62-68` 맵 7 교체 · DOM `cssVars` (Preview `THEME_VARS` replace · Publish 가 그대로 싣는다).
- Skia 글자: `packages/rendering/src/primitives/typography.ts:14-32` 정적 맵 (`text-sm 14` · `text-sm--line-height 20`) 을 테마 설치가 덮는다 · `resolveSpecFontSize.ts:25-37`.
- 엔진: `compositionRoot.ts:708-752` 숫자 입력.
- DOM: `shared-tokens.css:28-59` (text · 행간) · `:86-114` (spacing · radius) · 생성 CSS (`packages/rendering/scripts/generate-css.ts`) 가 rule 의 height · padding 을 px 로 낸다.
- 패널: `propertyUnitPresets.ts:21-50` (손으로 적은 5단).

### 2d. S2 설치본 (1.8.1) — 추출 대상과 위치

| 축            | 위치                                                                                | 값 (desktop)                                                                                                                                                                                      |
| ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| spacing       | `style/spectrum-theme.ts:353-392` `generateSpacing([…])`                            | 0 · 2 · 4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 36 · 40 · 44 · 48 · 56 · 64 · 80 · 96 (rem · scale 안 받음)                                                                                         |
| radius        | `:523` · `style/dist/spectrum-theme.mjs`                                            | sm 4 · default 8 · lg 10 · xl 16 · full 9999 · pill `calc(self(height)/2)`                                                                                                                        |
| border        | `:516-521`                                                                          | 0 · 1 · 2 · 4                                                                                                                                                                                     |
| 글자 단계     | `:636-676` (이름 → 토큰, 단계 번호는 토큰 패키지 `fontSizeToken` 출처 — round 3 l2) | ui-xs −2 · ui-sm −1 · ui 0 · ui-lg 1 · ui-xl 2 · ui-2xl 3 · ui-3xl 4? (추출) · heading-xs 2 · heading-sm 3 · heading 4 · heading-lg 6 · heading-xl 8 · body-sm 0 · body 1 · body-lg 2 · body-xl 3 |
| 글자 식       | `:701, 978-983`                                                                     | `round(base × pow(1.125, 단계) / 16 × 1rem, 1px)`                                                                                                                                                 |
| 행간 식       | `:702-706`                                                                          | `round(1em × (1.15 + (1 − (min(32, fs) − 10) / 22) × 0.15), 2px)`                                                                                                                                 |
| scale · base  | `dist/private/Provider.css`                                                         | `:root` 1 · 14 / `@media not ((hover: hover) and (pointer: fine))` 1.25 · 17                                                                                                                      |
| size()        | `:467, 492`                                                                         | `calc(px/16 rem × var(--s2-scale))` — 높이 · 아이콘 · inset                                                                                                                                       |
| 컴포넌트 높이 | `dist/private/{TextField,Button,Select,…}.css`                                      | TextField 1.25 · 1.5 · 2 · 2.5 · 3 rem × scale                                                                                                                                                    |

식 결과 (desktop base 14, 1px 반올림): ui −2 → 11 · −1 → 12 · 0 → 14 · 1 → 16 · 2 → 18 · 3 → 20; heading 2 → 18 · 3 → 20 · 4 → 22 · 6 → 28 · 8 → 36. touch (base 17): 0 → 17 · −1 → 15 · 1 → 19 · 2 → 22 · 3 → 24. 행간 (desktop): 11 → 14 · 12 → 16 · 14 → 18 · 16 → 20 · 18 → 22 · 20 → 24 · 22 → 26 · 28 → 32 (손계산 34 는 오류 — §6.0 추출기 정정) · 36 → 42. **이 숫자는 손계산 — G0 추출기와 브라우저 computed style 로 재확인한 뒤에만 토큰 표에 쓴다.**

## 3. Phase

### Phase 0 — 인벤토리 · 추출기 · RED (G0)

- `apps/builder/scripts/s2-token-extract.mjs` (신규): 설치본 소스 · CSS 를 파싱해 §2d 표를 JSON 으로 — **컴포넌트 · 축마다 값의 형** (고정 · 배율 `size()` · 글자 상대 `fontRelative` · 컨트롤 상대 `self(height)`) 도 같이 (Decision 3, 리뷰 H1). Button padding-inline `calc(var(--F, var(--M)) / 2)` · Button 아이콘 gap `text-to-visual` (default 6/14 em · touch 8/17 em — **조건부 식은 두 식 모두**, round 2 H1) · Switch 라벨 gap `text-to-control` 10/14 em 처럼 CSS 에서 식을 읽는다 (`.agent/runs/<date>-adr295/s2-values.json`). 브라우저 (Playwright) 로 S2 Provider 아래 글자 단계별 computed `font-size` · `line-height` · TextField 높이를 desktop · touch (pointer 에뮬레이션) 두 조건에서 읽어 식 결과와 대조.
- §2a · 2b 를 스크립트 (`rule-literal-inventory.mjs`) 로 재집계 — 손 집계와 차이 나면 스크립트가 정본.
- 22 페이지 fixture (`apps/builder/scripts/perfAppFixture.mjs` `app-pages` — 생성기 산출, 사용자 프로젝트에 든 것도 같은 생성기: `CANVAS_RUST_DECISION_2026-10.md:66`. 「실문서」 가 아니다 — round 3 m2) 에서 명시 `sizing.height` 없는 요소 **수 상한** · rule 높이를 쓰는 type 목록만 → R4 는 unproven 으로 두고 사용자 결정 6 에 그 한계를 같이 적는다 (비율 · 평균 Δpx 인용 금지, measurement-validity Q1).
- **G1 · G2 하니스 확정** (round 3 m3 — 설계 종결 조건이 아니라 Phase 0 산출물): 팔레트 전수 Skia ↔ DOM 픽셀 두 arm 을 재는 파일은 없다 (`vitest.visual-parity.config.ts` 부재 · `vitest.adr248-g3.browser.config.ts` 의 `propAxisCanvasDom` 은 box 1 CSS px 허용 · `paletteBaseCanvas` 는 Canvas old/new PNG). 기존 `propAxisCanvasDom` 을 팔레트 전수 + 픽셀 비교 (ADR-248 G3 의 approved-difference 방식) 로 넓히고 touch arm 은 `installThemeMaps(touch snapshot)` + `forceTouch` 로 두 번째 벌 — 또는 신규 파일. 이름 · 위치 · 비교 조건 (DPR 1 · `shot.width === rect.width`) 을 여기 적은 뒤 G1 · G2 가 그 이름을 쓴다.
- radius 파생 경로 RED (리뷰 H2): `resolveThemeSnapshot` 에 seed 8 · 10 · 16 을 넣고 preset radiusScale = md 로 호출하면 최종 맵이 6 · 8 · 12 인 것을 테스트로 고정 → Phase 1 이 `RADIUS_BASE_PX` 한 표 파생으로 GREEN.
- 빌더 안 생성 시트 소비처 목록 (리뷰 M3 · round 2): `builder-components.css` 가 import 하는 generated 시트 (Slider · ToggleButton · ToggleButtonGroup · Input · DateInput · TextField · NumberField · SearchField · CheckboxGroup · RadioGroup · Select · ComboBox · Form · FileTrigger · DropZone · DateField · TimeField · DatePicker …) 와 그 시트를 쓰는 빌더 위젯 (`CompactSelect` · `PropertySelect` · Data RowForm 의 ComboBox · Input · `ImportPreview` · `ApiEndpointEditor`) — `data-size` 유무 포함. 그 시트들의 **모든 size 블록 치수를 빌더 root 변수값으로 푼 계산값** 을 `builder-consumed-generated-baseline.json` 으로 뜬다 (Decision 9 게이트 (c) 의 295 전 기준 · G5 비교 대상). 실측 2026-10-30: base 블록은 `font-size: var(--text-sm)` · radius 8 · gap 6 · icon 18 · ToggleButton padding 4/12 · line-height 20 등 리터럴 혼재.
- RED: 토큰 표 값을 바꾸면 깨지는 기존 테스트 목록 (`typography.ts` 상수 테스트 · parity golden · `adr248-g3` 비교) — 바뀌는 것이 정상인 테스트와 결함을 가르는 테스트를 분리.
- 산출: §6 에 대조표 (축 · 저장소 값 · rule 리터럴 · S2 값 · Δ).

### Phase 1 — 토큰 표 · 글자 단계 · 행간 식 (G1)

- **`shared-tokens.css` 는 건드리지 않는다** (Decision 8 — 빌더 chrome 정적 값). 값은 **`radiusScaleToSkia.ts` `RADIUS_BASE_PX` 한 표** (S2: xs 2 · sm 4 · md 8 · lg 10 · xl 16 · 2xl 24 — 3xl · 4xl 는 사용자 결정 5) 에서 — `radiusSeed` 는 그 표에서 파생 (리뷰 H2: `resolveThemeSnapshot.ts:179-182` 가 seed 뒤에 preset 파생을 spread 하므로 seed 만 바꾸면 덮인다), `typographySeed` 는 단계 표 + 식, `typographySeed` 는 단계 표 + 식 (`resolveThemeSnapshot.ts:212, 260` 이 내는 `--radius-*` · `--text-*` cssVars 가 Preview · Publish root 에서 파일 값을 덮는다). `shared-tokens.css` 머리말에 두 층의 관계를 적는다.
- `resolveThemeSnapshot.ts`: `typography` 맵을 단계 표 (`FONT_STEPS`: text-2xs −2 … text-xl 3 · 제목 단계) + 식으로 생성 (desktop · touch 두 벌). 행간은 식 (사용자 결정 2).
- `packages/rendering/src/primitives/typography.ts`: 정적 상수 → 같은 식의 desktop 결과로 재생성 (seed) — 손 상수 금지.
- 패널 preset (`propertyUnitPresets.ts`): 라벨 XS ~ XL → 토큰 이름 매핑만 두고 값은 토큰 표에서 파생. **표시 · commit 값의 oracle 은 활성 테마 resolver snapshot** (Decision 5, round 3 h1 · round 4): `PropertyUnitInput.runtime.ts` `getCssVariableValue` (`:126-134`, `getComputedStyle(document.documentElement)`) · `panels/styles/utils/cssLengthPx.ts` `resolveCssLengthPx` (`:6-16`) 의 `var(--…)` 분기를 `cssVarToTokenRef` → `resolveToken` (`specPresetResolver.ts` `resolveToNumber` 와 같은 길) 로 바꾼다 — `BorderSection.tsx:227-230` 의 radius preset 과 `LayoutSection.tsx` 의 spacing preset 이 같은 함수를 지난다. 기대값은 고정 8 이 아니라 현재 테마 (preset radiusScale · 명시 델타) 의 해석값. RED: 빌더 root `--radius-md` 를 6 으로 두고 snapshot 이 8 일 때 preset M commit 이 6 이면 FAIL.
- G1: Phase 0 에서 확정한 하니스로 팔레트 전수 before/after 픽셀 · 치수 → §6 · preset commit 값 == snapshot 해석값 (radius · spacing 5단 × radiusScale 2 값) · 사용자 confirm.

### Phase 2 — scale · touch 두 벌 (G2)

- `resolveThemeSnapshot.ts`: `scale` · `fontBase` (시스템 상수 2 벌) · `size` 맵 (height XS ~ XL · icon) × scale · `touch` 블록.
- `themeMaps.ts`: `size` · `touchTypography` · `touchSize` 맵 (Skia 는 desktop 만 읽되 Preview 터치 보기용으로 touch 맵도 설치).
- `preview-system.css` · `cssVars`: `--catalog-token-scale` · `--catalog-token-font-base` · `--catalog-token-font-size-<단계>` · `--catalog-token-size-height-<S>` (이름은 Decision 9 — ADR Decision 6 · 이 절 · Decision 9 가 같은 표기, round 3 l1) 를 `:root` 와 `@media not ((hover: hover) and (pointer: fine))` 두 블록으로.
- `generate-css.ts`: 모든 치수 — 토큰 참조 · 배율 · 상대 형 · **고정 형까지** — 를 **`--catalog-token-*` 변수** 로 emit (Decision 9 — `--catalog-token-radius-md` · `--catalog-token-size-height-M` · 상대 형과 고정 형은 컴포넌트 · 축 · size 별 해석 숫자 변수). 생성 시트의 `var(--radius-*)` · `var(--text-*)` 0건 · 치수 px 리터럴 0건 (정적 게이트).
- `theme-seed.generated.css`: `--catalog-token-*` desktop · touch 두 블록을 **Preview · Publish 기본 시트에만** (`styles/index.css` · publish) — `THEME_VARS` 가 덮는다. 빌더 root 에는 싣지 않는다 (round 2 M3).
- `builder-catalog-vars.css` (신규, chrome 소유 · 손으로 쓴 고정값 · desktop 한 벌 · 미디어 쿼리 0): 생성 시트가 참조하는 `--catalog-token-*` 전부를 295 전 값으로 선언. `builder-components.css` 가 생성 시트 앞에 import. 생성 시트는 고정 형 치수까지 변수로 emit (위 generate-css 항목 — 빌더가 읽는 리터럴이 남으면 사용자 결정 1 이 빌더까지 움직인다).
- `builderCatalogVars.static.test.ts` (신규): (a) 빌더 import 생성 시트의 `--catalog-token-*` ⊆ 빌더 시트 선언 · (b) 빌더 root 시트 `pointer: fine` · `hover: hover` 0 · 생성 시트 치수 리터럴 0 · (c) 빌더 변수값으로 푼 생성 시트 계산값 == Phase 0 기준 JSON. RED: 빌더 시트에서 변수 하나를 지우거나 touch 블록을 넣으면 FAIL.
- `reservedPrefix.static.test.ts`: chrome CSS (`components/styles/*` · 패널 로컬 CSS · `builder-system.css`) 안 `var(--catalog-token-` 0건.
- Publish (`apps/publish`): cssVars 두 블록 적용 확인 (설치 경로는 293 과 공유).

- Preview 「터치」 보기 토글 (사용자 결정 4) — `THEME_VARS` 에 `forceTouch` 로 두 번째 블록 강제.
- ADR-293 게이트 (a) 의 허용 목록 (`--catalog-*` 통째) 을 상태 변수 접두 (`CatalogStates.css` 생성 집합 — `--catalog-hover-` · `--catalog-selected-` · `--catalog-selected-pressed-` …) 로 좁히고, `--catalog-token-*` 는 resolver `cssVars` ∪ `builder-catalog-vars.css` 선언에 있을 때만 통과 (round 3 m1 — 접두 공유가 값 충돌은 아니고 검사 오분류가 문제).
- G2: Phase 0 에서 확정한 하니스로 desktop · touch 두 arm Δ 0.

### Phase 3 — rule 리터럴 참조화 · 정적 게이트 (G3 · G4)

> **하위 커밋 (2026-10-30 실행 판단 — 사후 보고)**: 3a 행간 식 + control 높이 토큰 (같은 커밋 — 아래 첫 항목) · 3b 남은 리터럴 참조화 (radius · iconSize · minHeight · fontSize — minWidth 는 높이 비례 형이라 3c 로) + ratchet + `d3S2Alignment` · 3c 값의 형 (`{ ofHeight }` · `{ em }` · `touch`) + padding · gap 정렬 (사용자 결정 1) + 컴포넌트 글자 매핑 (G4 c) · 3d 숨은 사본 (`collectionItemMetrics`) · spacing 맵 판정 · `paletteBaseCanvas` 은퇴. 3a 기록은 §6.3.

- **행간 식 (사용자 결정 2) 도 이 Phase 의 커밋에서** (2026-10-30 순서 변경 — §6.1): `PRE_PHASE3_LINE_HEIGHT` · `getLabelLineHeight` 의 표를 지우고 `s2LineHeight` 로, field · stepper · Calendar · toggle 의 높이를 S2 control 높이 토큰으로 묶는 것과 같은 커밋. 컴포넌트별 글자 매핑 (Heading · Dialog 제목 · AvatarGroup 라벨 …) 도 G4 (c) oracle 로 여기서.

- `componentRulesTable.ts`: height · minHeight · iconSize · radius 리터럴 · lineHeight 리터럴 → 토큰 참조, padding · gap · inset 은 Phase 0 형 표대로 (`{ ofHeight }` · `{ em: [px, 기준] }` · 고정 숫자) 와 S2 의 `touch:` 조건이 있는 자리는 `touch` override (`{ em: [6, 14], touch: { em: [8, 17] } }` — round 2 H1) — codemod 스크립트 + 표 대조, 손 편집 · 손 분류 금지. S2 단에 없는 값은 `INTENTIONAL_LITERAL` (사유) 등재. rule 값 타입 (`packages/shared/src/catalog/types.ts`) 에 상대 형 2 와 `touch` 조건부를 더한다.
- `componentRulesTable.static.test.ts`: 리터럴 ratchet (389 · 7 · 92 · 74 · 24 → 0) + 축 allowlist.
- `d3S2Alignment.static.test.ts` (신규, `apps/builder/src/builder/catalogRuntime/__tests__/`): 토큰 표 · 단계 · 상수 · 높이 5단 == 추출기 결과.
- padding · gap 값 정렬 (사용자 결정 1) 은 여기서 컴포넌트별로.

### Phase 4 — live · 문서 (G5 · G6)

- Chrome MCP (별도 서버 5174, 사용자 5173 금지): Canvas · Preview desktop · Preview 터치 · Publish (pointer: coarse 에뮬레이션) 시나리오 → `### Live Exercise`.
- 테마 전환 비용 · 번들.
- 문서: ssot-hierarchy D3 절 (「값 정본 = S2 설치본, 이름 = 저장소」) · css-tokens.md (2티어 컨트롤 크기 28/32 는 **빌더 chrome** — 사용자 컴포넌트의 scale 과 무관함을 명시) · style-ssot.md · ADR-227 F8 각주 · CHANGELOG · README.

추정 규모: ~18 파일 (shared 6 · rendering 3 · builder 5 · publish 1 · 스크립트 2 · 테스트 1+) — Phase 0 이 재집계.

## 4. 라벨 → 토큰 → 값 (Decision 5 · 사용자 결정 3)

| 라벨  | spacing            | radius        | 본문 글자            | 제목 글자 (안 — 결정 3) |
| ----- | ------------------ | ------------- | -------------------- | ----------------------- |
| XS    | xs 4               | xs 2 (결정 5) | text-xs = ui-sm 12   | heading-xs 18           |
| S     | sm 8               | sm 4          | text-sm = ui 14      | heading-sm 20           |
| M     | md 12              | md 8          | text-base = ui-lg 16 | heading 22              |
| L     | lg 16              | lg 10         | text-lg = ui-xl 18   | heading-lg 28           |
| XL    | xl 24              | xl 16         | text-xl = ui-2xl 20  | heading-xl 36           |
| 그 밖 | 2 · 32 · 48 … 숫자 | None 0 · Full | 2xs 11 숫자          | —                       |

## 5. 사용자 결정 7건 — 묻는 시점

| #   | 결정                          | 시점                                        |
| --- | ----------------------------- | ------------------------------------------- |
| 1   | padding · gap 값 S2 정렬 범위 | Phase 0 대조표 뒤                           |
| 2   | 행간 식 도입 (행간 ↓)         | Phase 1 착수 전 (G1 before/after 보고 확정) |
| 3   | 제목 라벨 매핑                | Phase 1                                     |
| 4   | Preview 터치 보기 형태        | Phase 2                                     |
| 5   | radius xs 2 · 2xl 24 유지     | Phase 1                                     |
| 6   | 기존 문서 레이아웃 변화 수용  | Phase 0 R4 수치 뒤                          |
| 7   | Canvas desktop 고정           | Phase 2                                     |

결정 기록 (2026-10-30): 1 전부 S2 식 · 2 행간 식 도입 · 3 본문 + 제목 두 묶음 · 5 xs 2 · 2xl 24 유지 / 3xl · 4xl 삭제 · 6 수용 · 4 별도 토글 (Compare Mode 「터치 크기로 미리보기」) · 7 Canvas desktop 고정. Phase 2 중 추가: record 글자 크기의 터치 경로 = 「토큰 출처를 기억」 (§6.2).

## 6. 실측 기록 (Phase 별로 채운다)

### 6.0 Phase 0 (2026-10-30, G0 종결)

**산출물** (스크립트는 저장소, 원자료는 `.agent/runs/2026-10-30-adr295/` 로컬):

| 산출물              | 위치                                                                                                                      | 내용                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S2 추출기           | `apps/builder/scripts/adr295-s2-token-extract.mjs` + `adr295-s2-probe/`                                                   | (1) 설치본 style macro (CJS — MJS 빌드는 `properties` import 누락으로 throw) 를 가짜 MacroContext 로 실행 · `fontSize` 단계 (MJS export) · `generateSpacing` · `Provider.css` · `style-utils.ts` `controlSize` · `controlBorderRadius` (2) probe 페이지 (S2 컴포넌트 22 가족 × size) 를 vite 로 빌드해 Playwright desktop · touch 에서 computed |
| oracle (게이트용)   | `apps/builder/src/builder/catalogRuntime/__tests__/fixtures/adr295-s2-oracle.json`                                        | tokens + 가족별 대표 상자 치수 (desktop · touch). G4 (a) · (c) 가 읽는다                                                                                                                                                                                                                                                                        |
| rule 재집계         | `apps/builder/scripts/adr295-rule-literal-inventory.ts`                                                                   | `COMPONENT_RULES_TABLE` import 후 전수 walk                                                                                                                                                                                                                                                                                                     |
| 빌더 생성 시트 기준 | `apps/builder/scripts/adr295-builder-generated-baseline.mjs` → `fixtures/adr295-builder-consumed-generated-baseline.json` | `builder-components.css` 가 싣는 생성 시트 33 의 치수 선언 1,193 을 빌더 root 변수 (`theme.css` 의 `:root`) 로 푼 값 — Decision 9 게이트 (c) 의 295 전 기준                                                                                                                                                                                     |
| fixture 규모        | `apps/builder/scripts/adr295-fixture-scale.mjs`                                                                           | `app-pages` (perf-baseline 의 격리 프로젝트 · 별도 dev 서버)                                                                                                                                                                                                                                                                                    |
| radius 한 표 게이트 | `apps/builder/src/utils/theme/__tests__/resolveThemeSnapshot.test.ts` 「ADR-295 R9」                                      | 최종 snapshot radius · `--radius-*` = `resolveRadiusTokens(scale)` (5 배율) · seed = `RADIUS_BASE_PX`. 원복 RED: seed `md 6 → 8` 만 바꾸면 1 FAIL (복원 확인)                                                                                                                                                                                   |

**측정 조건**: Chromium (Playwright 1.64 headless) · DPR 1 · viewport 1200×900. touch = `newContext({ hasTouch: true })` → `(hover: hover) and (pointer: fine)` false · `--s2-scale` 1.25 · `--s2-font-size-base` 17. CDP `Emulation.setEmulatedMedia` 의 pointer · hover feature 는 Chromium 이 무시한다 (첫 실행에서 touch arm 이 desktop 과 같았다 — 측정 조건 함정).

**글자 · 행간 식 = 브라우저**: S2 글자 이름 39 × (desktop · touch) 를 식 (`round(base × 1.125^단계)` · 행간 `round(fs × (1.15 + (1 − (min(32, fs) − 10) / 22) × 0.15), 2px)`) 으로 계산한 값과 macro 클래스를 실은 요소의 computed 가 **78/78 일치**. §2d 의 손계산 (desktop) 도 전부 맞았다.

**토큰 (desktop)**: spacing 0 · 2 · 4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 36 · 40 · 44 · 48 · 56 · 64 · 80 · 96 · radius sm 4 · default 8 · lg 10 · xl 16 · full 9999 · pill `calc(self(height) / 2)` · border 0 · 1 · 2 · 4 · `text-to-visual` 6/14 em (touch 8/17 em) · `text-to-control` 10/14 em (touch 같음) · `edge-to-text` 높이 × 3/8 · `pill` 높이 / 2.

**새로 확인한 값의 형 — size 단계 배율 (Decision 3 보강)**: S2 control 모서리는 `round(radius × 1.125^size단계, 1px)` (`style-utils.ts` `controlBorderRadius` — XS −2 · S −1 · M 0 · L 1 · XL 2) 이고 기기 scale 을 받지 않는다. default control (field · ActionButton · TagGroup · Badge) XS 6 · S 7 · M 8 · L 9 · XL 10, sm control (Checkbox 상자) 4 · 4 · 5 · 5. 저장소 field 모서리 `FIELD_BUTTON_CORNERS` · field `sizes` (S 7 · M 8 · L 9 · XL 10, 사용자 2026-10-30) 는 이미 이 값이다 — Decision 4 의 「radius 리터럴은 가장 가까운 S2 단으로」 를 그대로 적용하면 7 · 9 가 8 · 10 으로 깨진다. Phase 3 codemod 는 이 자리를 「control radius 형」 (size 단계 배율) 으로 선언한다 (형 5 종).

**rule 재집계 (스크립트 정본 — F1 손 집계와 차이)**:

| 키            | 토큰 참조 | px 리터럴 | 그 밖 (문자열) | F1 손 집계 대비                                                 |
| ------------- | --------: | --------: | -------------: | --------------------------------------------------------------- |
| fontSize      |       419 |         5 |              0 | 리터럴 2 → 5                                                    |
| borderRadius  |       355 |        74 |              0 | 토큰 347 → 355                                                  |
| lineHeight    |        98 |        24 |              0 | 같음                                                            |
| height        |         0 |   **389** |             51 | 리터럴 389 중 **201 이 `0`** (파생 높이 표지) — 참조화 대상 188 |
| minHeight     |         0 |         7 |              2 | 같음                                                            |
| iconSize      |         0 |        92 |              0 | 같음                                                            |
| paddingX / Y  |         0 | 167 / 111 |              0 | paddingY 105 → 111                                              |
| gap / iconGap |         4 |   178 / 8 |         39 / 0 | gap 174 → 178                                                   |

`{typography.text-md}` (미정의 토큰) 참조 1 은 그대로 남아 있다 — Phase 1 에서 정리.

**컴포넌트 대조 (desktop, S2 → 저장소 rule)** — 높이 · padding 은 S2 대표 상자, 저장소는 rule `sizes`:

| 가족                                                                  | 축              | S2 (S · M · L · XL)                                                | 저장소 rule                                                | 형 (S2)                    |
| --------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------ | ---------------------------------------------------------- | -------------------------- |
| TextField · Select · ComboBox · NumberField · SearchField · DateField | 높이            | 24 · 32 · 40 · 48 (touch 30 · 40 · 50 · 60) — 공개 size 에 XS 없음 | 22 · 30 · 42 · 54 (XS 18 · 20)                             | 기기 배율                  |
| 같음 (SearchField 제외)                                               | paddingX        | 9 · 12 · 15 · 18                                                   | 8 · 12 · 16 · 24                                           | 컨트롤 상대 (h × 3/8)      |
| 같음                                                                  | 모서리          | 7 · 8 · 9 · 10                                                     | 7 · 8 · 9 · 10 (XS `r.sm` 4 vs S2 XS 6)                    | size 단계 배율             |
| SearchField                                                           | 모서리          | pill                                                               | `r.sm` · `md` · `lg` · `xl` (4 · 6 · 8 · 12)               | 컨트롤 상대                |
| DateField · Checkbox · Radio                                          | 글자            | 12 · 14 · 16 · 18                                                  | 14 · 16 · 18 · 20 (한 단 위)                               | 글자 단계                  |
| Button                                                                | 높이            | 24 · 32 · 40 · 48 (`min-height`)                                   | 파생 (M = 20 + 8 + 2 = 30)                                 | 기기 배율                  |
| Button                                                                | paddingX        | 12 · 16 · 20 · 24                                                  | 8 · 12 · 16 · 24                                           | 컨트롤 상대 (h / 2)        |
| Button · ActionButton · Picker · TagGroup · Badge                     | 아이콘-글자 gap | 5.14 · 6 · 6.86 · 7.71 (touch 7.06 · 8 · 8.94 · 10.35)             | Button 6 · 8 · 10 · 12                                     | 글자 상대 + touch override |
| ActionButton · ToggleButton                                           | 높이 · padX     | XS 20 · 24 · 32 · 40 · 48 · padX 7.5 · 9 · 12 · 15 · 18            | ToggleButton 파생 · padX 4 · 8 · 12 · 16 · 24              | 기기 배율 · 컨트롤 상대    |
| TagGroup (tag)                                                        | 높이 · 모서리   | 24 · 32 · 40 · 모서리 7 · 8 · 9                                    | 24 · 32 · 40 · `r.sm` · `md` · `md` (4 · 6 · 6)            | 기기 배율 · size 단계 배율 |
| Badge                                                                 | 모서리          | 7 · 8 · 9 · 10 (pill 아님)                                         | `r.full`                                                   | size 단계 배율             |
| Checkbox · Radio · Switch                                             | 라벨 gap        | 8.57 · 10 · 11.43 · 12.86                                          | Checkbox · Radio 6 · 8 · 10 · 12 · Switch 8 · 10 · 12 · 14 | 글자 상대 (10/14 em)       |
| Checkbox · Switch · Radio                                             | indicator 높이  | 14 · 16 · 18 · 20 (touch × 1.25)                                   | indicator part rule (별도)                                 | 기기 배율                  |
| Meter · ProgressBar                                                   | track 높이      | 4 · 6 · 8 · 10                                                     | 4 · 8 · 12 · 16                                            | 기기 배율                  |
| Slider                                                                | track 높이      | 4 (모든 size)                                                      | 4 · 8 · 12 · 16                                            | 기기 배율                  |
| Tabs                                                                  | tab 높이        | 48 (size 없음)                                                     | 21 · 29 · 41                                               | 기기 배율                  |
| 행간 (모든 글자)                                                      | lineHeight      | 식 — 12 → 16 · 14 → 18 · 16 → 20 · 18 → 22                         | 고정 16 · 20 · 24 · 28                                     | 글자 크기의 함수           |

**fixture 규모 (`app-pages` — 합성물, 규모 전용)**: 22 페이지 · 문서 노드 3,339 · 명시 `sizing.height` **0**. rule 기본값을 쓰는 컴포넌트 instance 811 (frame 789 · Text 1,551 · body 22 · Image 67 · Icon 99 제외) 은 높이 · padding 변경이, Text 1,551 은 행간 식이 닿는 **상한**이다. 분포 (비율 · 평균 Δpx) 는 인용하지 않는다 — R4 unproven 그대로.

**토큰 값을 바꾸면 깨지는 기존 테스트** (Phase 1 · 3 에서 갱신 — 값 단언, 구조 불변식 아님): `tokenResolver.test.ts:110-112` (radius md 6 · lg 8 · xl 12) · `tokenSnapshot.test.ts.snap` (radius · typography 맵) · `tokenConsumerDrift.test.ts.snap` C2 (C1 매핑은 불변식) · `typography.test.ts` (행간 golden) · `typographyCssParity.test.ts:64-69` (대표값 — 72-89 전수 대조는 불변식) · `resolveThemeSnapshot.test.ts:52-55 · 234 · 292` · `phase4eTheme.test.tsx:210` · `specPresetResolver.test.ts` (radius 12 / 6) · `slotRoles.test.ts:219` (text-3xl 30) · `phase4e11PreviewFollow` · `buttonIntrinsicHeight` · `adr253FieldPartsDom` · `phase3Presence` (rule 높이 20 · 22 · 30 · 42 · 54) · `toggleIndicatorNode` · `adr251ItemsNode` (라벨 행간) · `adr248CatalogRealDom.browser` (높이 · 행간 · frozen DOM PNG 9). `paletteBaseCanvas.browser` (ADR-248 G0 frozen PNG — 옛 Canvas oracle) 는 295 뒤 전부 FAIL 이 정상이라 295 기준에서 **은퇴 대상** (ADR-248 cutover 판정용).

**숨은 사본 (drift 위험)**: `packages/rendering/src/renderers/utils/collectionItemMetrics.ts:374-395` GridList 카드 radius 리터럴 12 · 8 · 8 — 토큰을 거치지 않아 테스트는 통과하고 값만 갈린다. Phase 3 참조화 목록에 넣는다.

**Phase 2 허용 목록 보강**: 빌더 생성 시트가 참조하는 런타임 상태 변수는 `--catalog-hover-*` · `--catalog-selected-*` · `--catalog-selected-pressed-*` 외에 `--catalog-disabled-*` · `--catalog-focus-visible-*` · `--catalog-pressed-*` · `--catalog-selected-hover-*` 도 있다 (기준 JSON `unresolvedExternal`). ADR-293 게이트 (a) 를 좁힐 때 이 접두 전부가 상태 변수 집합이다.

**G1 · G2 하니스 확정**: 신규 파일 `apps/builder/tests/adr248-g3/adr295PaletteSymmetry.browser.test.ts` (기존 `vitest.adr248-g3.browser.config.ts` 가 디렉터리로 포함 — DPR 1 · 1440×900). 기존 두 파일은 oracle 이 달라 넓히지 않는다 (`propAxisCanvasDom` = 고정 CASES 상자 ≤ 1px · `paletteBaseCanvas` = frozen 옛 Canvas PNG). 대상 = 팔레트 전수 `getPaletteItems()` (`paletteItems.ts:318` — PALETTE_ORDER 69 + creationVariants) → `catalogPaletteDefinitionId`. Skia = `MakeWebGLCanvasSurface` + `executeRenderCommands` (paletteBaseCanvas 와 같은 길), DOM = element screenshot (`adr248CatalogRealDom.browser.test.ts:739-781` 처럼 frameHost transform 끔 · `shot.width === rect.width && devicePixelRatio === 1`). 비교 = pixelmatch (threshold 0.1 · 글자 영역 마스크) + 상자 ≤ 1px. arm 마다 `installThemeMaps(snapshot)` (`Object.assign` 금지 — 앞 arm 키가 남는다) + `:root` 변수 교체, touch arm 은 touch snapshot 의 변수를 `:root` 에 직접 (미디어 쿼리 경로는 sanity case 1). **G1 before** 는 값이 바뀌기 전 커밋을 별도 worktree (그 lockfile · 엔진 빌드) 에서 같은 파일로 잰다 — Phase 1 첫 단계가 하니스를 만들고 before 를 뜬 뒤 값을 바꾼다.

### 6.1 Phase 1 (2026-10-30, G1)

**순서 변경 (사용자 결정 2026-10-30 「행간 식은 Phase 3 와 함께」)**: 행간을 S2 식으로 바꾸면 줄 상자가 줄어 (14px 20 → 18) 「줄 20 + padding 8 + border 2 = 30」 과 우연히 같던 높이 리터럴 (field `height: 30` · NumberField 증감 `--nf-btn-size: 30px` …) 과 2px 어긋난다 (Input 28 · 증감 버튼 30 · prefix Group 28 — unit 99 실패 중 확인). 그래서 Phase 1 은 radius · 글자 **크기** · 변수 · preset 만, 행간 식 (사용자 결정 2) 은 높이를 S2 control 높이에 묶는 Phase 3 커밋으로 옮겼다. 행간은 `PRE_PHASE3_LINE_HEIGHT` (본문 사다리의 지금 값) 가 그때까지 유지 — 제목 묶음 (`text-heading-*`) 은 쓰는 rule 이 없어 처음부터 식.

**변경**:

| 영역                         | 파일                                                                                                                                       | 내용                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| radius 한 표                 | `packages/rendering/src/primitives/radius.ts` · `packages/shared/src/catalog/runtime/radiusScaleToSkia.ts`                                 | S2 값 (xs 2 · sm 4 · md 8 · lg 10 · xl 16 · 2xl 24, 3xl · 4xl 삭제) · `RADIUS_BASE_PX` = rendering 표에서 파생 (의존 방향상 표는 rendering — shared 가 rendering 을 import)                                                                                                 |
| 글자 단계                    | `packages/rendering/src/primitives/typography.ts` · `types/token.types.ts`                                                                 | `TYPOGRAPHY_STEPS` + `s2FontSize` · `s2LineHeight` · `s2TypographyTokens` (package export). 본문 2xs 11 · xs 12 · sm 14 · base 16 · lg 18 · xl 20 · 2xl 22 · 3xl 25 · 4xl 28 · 5xl 36, 제목 묶음 `text-heading-xs` ~ `3xl` 18 · 20 · 22 · 28 · 36 · 43 · 55 (사용자 결정 3) |
| DOM 변수                     | `resolveThemeSnapshot.ts`                                                                                                                  | 글자 변수를 **전 키** emit (종전: 델타만 — seed 가 chrome 정적 값과 같았기에 가능했다) · 행간 비율은 정확한 분수 (`calc(16 / 12)`, 소수 4자리 반올림이 줄 상자를 15.98 로 줄였다)                                                                                           |
| preset oracle                | `PropertyUnitInput.runtime.ts` · `panels/styles/utils/cssLengthPx.ts`                                                                      | 토큰 preset (radius · typography · border) 의 표시 · commit = `resolveToken` (활성 테마 snapshot). spacing 은 제외 — rendering `spacing` 맵 (md 16 · lg 24 · xl 32) 이 CSS `--spacing-*` (md 12 · lg 16 · xl 24) 와 295 전부터 달라 쓰지 않는다 (Phase 3 판정)              |
| 글자 토큰을 상자로 쓰던 자리 | `manualBoxRules.ts` (`CALENDAR_HEADER.nav` · `GROUP_ITEM_INDICATORS`) · `CalendarCommon.css` · `Radio.css` · `Switch.css` · `Checkbox.css` | 값이 바뀐 글자 토큰 (2xl ~ 5xl) 을 상자 크기로 쓰던 자리를 그 전 px 로 고정 — Calendar 월 폭은 DOM 만 바뀌어 Canvas (`CalendarGrid` iconSize) 와 갈렸고, Checkbox · Switch 는 DOM 만 커졌다 (G1 새 비대칭 8 → 0). S2 control 크기 정렬은 Phase 3                            |

**G1 before/after** (`adr295PaletteSymmetry.browser.test.ts`, Chromium · DPR 1 · 1440×900 · 기본 테마. before = 같은 작업 트리에서 Phase 1 값 파일 12 개만 HEAD 로 되돌려 측정 후 복원 · cmp 확인. 원자료 `.agent/runs/2026-10-30-adr295/g1/`):

- 팔레트 247 조합 · 노드 1,223: 상자 무변화 215 · 변화 24. **Canvas ↔ DOM 새 비대칭 0** (기존 24 그대로 — Separator · Autocomplete · Section · Pagination · Skeleton · Select · DropZone · Keyboard · Menu · ContextualHelp, Phase 2 G2 대상).
- 상자 변화 = 글자 크기 변화뿐: XS size (2xs 10 → 11) 의 폭 +2 ~ 8 (Badge · Button · ToggleButton(Group) · ButtonGroup · Link · field Label · DateInput), AvatarGroup XL −5 (2xl 24 → 22). 높이 변화 0.
- 스크린샷 226 중 픽셀 변화 66, 실행 간 잡음 (after ↔ after2) 14 = Icon 5 (기본 글리프가 실행마다 다르다) · chart 9. 잡음을 뺀 변화: radius (ListBox · GridList · DropZone · TagGroup · Table · Tree · DisclosureGroup · FileUpload · ColorArea), XS 글자 (field · Button 계열), Text XXL · XXXL · IllustratedMessage L (2xl · 3xl).
- 수리 1 (측정 도구): `screenshot({ save: false })` 는 base64 문자열을 돌려줘 첫 측정의 PNG 226 장이 전부 비어 있었다 (「픽셀 변화 0」 이 거짓 통과) — 크기 검사를 넣고 다시 쟀다.

**live (Chrome MCP, 별도 dev 서버 5175 · 새 프로젝트 `adr295-live`)**: Canvas TextField · Input 모서리 8 (field 7 · 8 · 9 · 10 그대로) · 행간 유지 (20/14) · Design 패널 Radius 메뉴 「XS · 2 · S · 4 · M · 8 · L · 10 · XL · 16」 (종전 chrome 값 2 · 4 · 6 · 8 · 12) → L 선택 → 문서 `responsive.mobile.visual.radius = 10` (현재 breakpoint mobile) · Publish 탭 ListBox `border-radius 16px` · `--radius-md 8px` · `--radius-lg 10px` · `--radius-xl 16px` · `--text-2xs 11px` · `--text-2xl 22px` · `--text-sm--line-height calc(20 / 14)`.

**관찰 (295 무관, 기존)**: Publish 의 Input 높이 31 — layer 밖 리셋 `input { line-height: inherit }` 가 `@layer components` 의 행간 규칙을 이겨 부모 1.5 (21px) 를 상속 (G1 하니스 DOM leg 는 30). `adr248CatalogGeometryDelta` case 2 (`subtreeNodeVisits` 4 ≠ 1) · `chromeIsland.static` 은 HEAD 값에서도 같은 실패.

**테스트 갱신 (값 단언)**: rendering — `typography.test` (S2 식 · 단계) · `typographyCssParity` (독립 oracle 을 chrome CSS 에서 S2 설치본 computed 로 — 글자 크기 전수 · 제목 행간) · `tokenResolver` · `cssVarToTokenRef` · `tokenSnapshot` snapshot. shared — `slotRoles` (text-3xl 25). builder — `resolveThemeSnapshot` · `tokenConsumerDrift` snapshot · `specPresetResolver` · `phase4eTheme` · `avatarGroupLabelNode` · `illustratedMessageNodeTree` · `calendarWidth` (DOM sheet 30px).

### 6.2 Phase 2 (2026-10-30, G2)

**변경**:

| 영역                                                       | 파일                                                                                                                                                                                                                                                                | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 생성 CSS 이름 공간                                         | `packages/rendering/src/renderers/CSSGenerator.ts` (`withCatalogTokenVars`)                                                                                                                                                                                         | 생성 시트의 `var(--radius-*)` · `var(--text-*)` → `var(--catalog-token-<원 이름>)` (rule 문자열 선언 포함, 102 시트). 이름은 ADR 예시 (`--catalog-token-font-size-sm`) 대신 원 이름에 접두만 — 행간 짝 (`--text-sm--line-height`) 을 기계적으로 옮기기 위해                                                                                                                                                                                                                                                                                   |
| 빌더 고정값                                                | `styles/builder-catalog-vars.css` (신규) · `builder-components.css`                                                                                                                                                                                                 | `--catalog-token-*` 를 295 전 chrome 값 (글자 10 · 12 · 14 … · radius 6 · 8 · 12 …) 으로 — desktop 한 벌 · 미디어 쿼리 0 · 생성 시트보다 앞                                                                                                                                                                                                                                                                                                                                                                                                   |
| 기기 두 벌                                                 | `rendering/primitives/device.ts` (신규) · `resolveThemeSnapshot.ts`                                                                                                                                                                                                 | `S2_DEVICE` (scale 1 / 1.25 · font.base 14 / 17) · `S2_CONTROL_HEIGHT` (20 · 24 · 32 · 40 · 48 × scale — rule 참조는 Phase 3) · snapshot `device.{desktop,touch}` · DOM `--catalog-token-scale` · `-font-base` · `-size-height-*` · 글자. 터치 벌은 **별도 배열 `touchCssVars`** — `cssVars` 에 섞으면 `isDark` 만 보고 `:root` 에 쓰는 소비자 (G3 하니스 3곳) 가 터치 값을 desktop 위에 덮었다 (propAxis 8건 새 실패로 발견). 테마가 명시한 글자 크기는 터치에서 17/14 비율, 행간은 Phase 3 까지 단계별 px 그대로 (`PRE_PHASE3_LINE_HEIGHT`) |
| DOM 두 블록                                                | `themeVarsCss.ts`                                                                                                                                                                                                                                                   | 터치 벌을 `@media not ((hover: hover) and (pointer: fine))` 와 `:root[data-catalog-touch]` 두 블록으로, 맨 끝에 (같은 특이도의 `[data-theme=dark]` 를 이긴다)                                                                                                                                                                                                                                                                                                                                                                                 |
| 첫 프레임                                                  | `theme/generated/theme-seed.generated.css` (`generate-css.ts` 가 생성 · `--check`) · `styles/index.css`                                                                                                                                                             | 기본 테마의 `--catalog-token-*` desktop · 터치 (`@layer preview-system`) — Preview · Publish 만                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 터치 보기 (결정 4)                                         | `compareMode.ts` (`previewTouch`) · `BuilderHeader.tsx` (Compare Mode 그룹의 손 아이콘 토글) · `CatalogPreviewFrame.tsx` · `catalogPreviewApp.ts`                                                                                                                   | `CATALOG_TOUCH_VIEW` 메시지 → Preview root `data-catalog-touch`                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| record 글자의 터치 경로 (사용자 결정 「토큰 출처를 기억」) | `resolution/resolver.ts` (`catalogResolvedTokenRef` · `copyResolvedTokenRefs`) · `runtime/deviceTypography.ts` (신규) · `domBinding.runtime.ts` (공통 · rule 실행기 두 자리) · `document/rulePartRules.ts` · `document/manualBoxRules.ts` · `codeCatalogLibrary.ts` | resolver 가 `applyValues` · `applyWrites` 에서 토큰으로 푼 키의 ref 를 values 객체별로 기록 (instance root · 표 칸 사본도 이어받음). part rule 컴파일러의 `font-size: var(--text-*)` · 손 part rule (`ownerTextParts` · `itemLabelFontParts` · ListBox · GridList · Calendar · Breadcrumbs) 은 글자 토큰을 참조로 남기고 library 가 토큰 값으로 바꾼다. DOM 은 record 값이 그 토큰의 설치값과 같을 때만 `var(--catalog-token-text-*)` (짝 행간 비율이면 행간 변수도) — 리터럴 · 사용자 px · Icon 글리프는 px                                  |
| 글자 토큰을 상자로 쓰던 남은 자리                          | `Switch.css` · `Checkbox.css` · `Radio.css`                                                                                                                                                                                                                         | xs ~ xl 도 px 고정 (터치에서 DOM 상자만 1.2배) — Phase 1 은 2xl ~ 5xl                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| StatusLight DOM                                            | `components/StatusLight.tsx`                                                                                                                                                                                                                                        | 글자 px 표 (12 · 14 · 16 · 18) → rule `fontSize` 토큰 변수                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**게이트 · RED** (원복은 bash 백업 · trap 복원 · cmp):

- `builderCatalogVars.static.test.ts` (신규 5): (a) 커버리지 — 변수 하나 삭제 → (a) · (c) FAIL · (b) 미디어 쿼리 0 — touch 블록 추가 → FAIL · (c) Phase 0 기준 JSON (1,193 선언) 과 계산값 동일 — radius-md 8 → FAIL · 생성 시트에 chrome 토큰 이름 0 · chrome CSS 에 `var(--catalog-token-` 0. 계산은 Phase 0 스크립트와 공용 모듈 (`scripts/adr295BuilderGeneratedSheets.mjs`).
- ADR-293 게이트 (a) (`generatedCssVarsDeclared.static.test.ts`): `--catalog-` 통째 허용 → 상태 변수 접두 7 (`CatalogStates.css` 집합과 대조). 생성 시트에 `var(--catalog-token-bogus)` → 좁힌 게이트 FAIL / 295 전 게이트는 통과 (경계 테스트가 넓히기를 막는다).
- G2 (`adr295PaletteSymmetry.browser.test.ts` 가 게이트로): 1 CSS px 를 넘는 비대칭이 알려진 목록 밖에서 0 (목록에 있는데 대칭이 되어도 FAIL). touch arm 은 production 과 같게 — Canvas leg = 터치 맵에서 빌드한 library + 터치 맵, DOM leg = desktop library + desktop 맵으로 만든 record + CSS 터치 벌. 같은 맵으로 두 leg 를 만들면 record 에 굳은 px 가 같이 커져 DOM 결함을 못 본다 (measurement-validity #3 — 첫 측정이 그래서 0 이었다). Checkbox 상자 px 고정 원복 → touch 4 FAIL · DOM 글자 변환 끄기 → touch 120 FAIL.

**G2 결과** (Chromium · DPR 1 · 1440×900):

- desktop: 263 통과 · Phase 1 (`after`) 대비 상자 변화 0 · 비대칭 24 (295 전부터 — `KNOWN_ASYMMETRIC`: Separator · Skeleton · Section · Keyboard · Image 의 Canvas 폭 0 · Select 2px · Pagination · DropZone · Menu/ContextualHelp trigger 줄 상자 · Autocomplete).
- touch: 263 통과 · 비대칭 = 24 + touch 만 14 (`KNOWN_TOUCH_ASYMMETRIC`): Card · CardView · DateRangePicker 13 = 행간이 **다른 단계** 토큰의 비율로 빌드 때 숫자가 됨 (Text 기본 text-base 행간 · Card 글자 px 리터럴 + 토큰 행간) — Phase 3 행간 식 · 리터럴 참조화로 닫는다. ColorSlider M 1 = DOM Label 글자가 px 로 남음 (record 출처는 있음 — 렌더 경로 추적 미완). 경과: 첫 측정 154 → 토큰 출처 (정의) 55 → part rule · 손 part rule 26 → rule 실행기 경로 14.

**live (Chrome MCP, 별도 dev 서버 5175 · 프로젝트 `adr295-live`)**: 빌더 root `--catalog-token-text-sm 14px` · `radius-md 6px` (chrome 고정값) · 빌더 Input 글자 12 · 모서리 8 (변화 없음). Compare Mode 켜면 헤더에 손 아이콘 토글 (「터치 크기로 미리보기」). 끔: Preview Text 14 · 12 · Label 14 · Input 14 · 변수 scale 1 · height-M 32 · radius-md 8. 켬: root `data-catalog-touch` · Text 17 · 15 · Label 17 · Input 17 · scale 1.25 · height-M 40 · radius-md 8 (기기 무관) · 행간 20 / 16 유지 (Phase 3). 다시 끄면 원래 값. Canvas 는 그대로 desktop. Publish 탭 (헤더 Preview 버튼): `#runtime-theme-vars` 에 S2 터치 미디어 블록 · scale 1.25, 기본 시트에 seed layer, Text inline `var(--catalog-token-text-sm)` (터치 속성 조건에서 17 · 15). 실제 pointer: coarse 기기 · 에뮬레이션 확인은 Phase 4 (CDP 는 pointer 미디어를 바꾸지 못한다 — §6.0).

**관찰**:

- `generated/Image.css` 등 2 장은 옛 spec 시대 생성물로 어디서도 import 되지 않는다 (생성 목록 102 밖) — 이번 이름 변경 대상 밖. 삭제는 별도 승인. → 2026-10-30 사용자 승인으로 삭제 (§6.3).
- `paletteBaseCanvas.browser` 는 HEAD 에서도 FAIL (ADR-248 frozen 옛 Canvas PNG — 은퇴 대상, §6.0) 이고 실행하면 추적 파일 `docs/adr/design/248-phase3-palette-base-canvas.json` 을 다시 쓴다.
- `propAxisCanvasDom` 5 (Select · Tree · Table) 는 HEAD 와 같은 실패.

### 6.3 Phase 3a (2026-10-30, 행간 식 + control 높이)

**옛 생성 파일 삭제 (사용자 승인 2026-10-30)**: 생성기가 더는 내지 않는 `generated/Image.css` (미로드 E) · `generated/Label.css` (skipCSSGeneration — 주석뿐, `styles/index.css` 가 import) 를 지우고 import 한 줄과 로드 인벤토리 게이트 (생성 103 · index 82 · 미로드 21) 를 맞췄다.

**변경**:

| 영역                       | 파일                                                                                                                 | 내용                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 행간 식 (사용자 결정 2)    | `rendering/primitives/typography.ts`                                                                                 | `PRE_PHASE3_LINE_HEIGHT` · `FONT_SIZE_TO_LINE_HEIGHT` 삭제 — 모든 `--line-height` 토큰 · `getLabelLineHeight` = `s2LineHeight` (14 → 18 · 16 → 20 · 18 → 22)                                                                                                                                                                                                                 |
| control 높이 토큰          | `rendering/primitives/device.ts` · `tokenResolver.ts` · `shared/runtime/{resolveThemeSnapshot,themeMaps}.ts`         | `{size.height.<S>}` — Skia `size` 맵 (테마 설치가 교체, `touchThemeSnapshot` 은 × 1.25) · DOM `var(--catalog-token-size-height-<S>)` (chrome 이름 없음 — 처음부터 catalog 이름) · `cssVarToTokenRef` 역변환                                                                                                                                                                  |
| control 상자               | `componentRulesTable.ts` (Input · DateInput · Button · ToggleButton · Tag)                                           | `minHeight: "{size.height.<S>}"` + paddingY = S2 가운데 (높이 − 줄 − 테두리 × 2) / 2 (XS 2 · S 3 · M 6 · L 9 · XL 12) — desktop 20 · 24 · 32 · 40 · 48                                                                                                                                                                                                                       |
| S2 padding 식 한 곳        | `rendering/renderers/utils/controlPadding.ts` (`s2ControlPaddingY`) · `CSSGenerator.ts` (`controlPaddingBlock`)      | 생성 CSS 는 식을 변수로 (`calc((var(--…-size-height-M) - var(--…-text-sm) * var(--…-text-sm--line-height) - 2 * var(--border-width-thin)) / 2)`) — 터치 8 · 빌더 고정값 4 가 저절로. Canvas 정의 (`resolveCatalogRuleCanvasBox` · Button 정의 · TextArea rows 높이 · prefix 상자) 는 같은 식을 설치된 맵에서. rule 숫자 paddingY 는 desktop 결과 — 식과 갈리면 생성이 멈춘다 |
| 증감 버튼 · 범위 상자      | NumberField `--nf-btn-size` · DateRangePicker Group                                                                  | control 높이 토큰. field 안 버튼 · 범위 안 DateInput 은 `min-height: 0` (S2 에서 Button · control 이 아닌 자리 — 배치, ADR-253 게이트의 배치 집합에 `min-height` 추가)                                                                                                                                                                                                       |
| 행간 리터럴 참조화 (19)    | Tag · MeterValue · ProgressBarValue · SliderOutput · Column · Cell                                                   | 옛 행간 px → 짝 행간 토큰 (Column · Cell 글자 16 → `text-base`). Table 행 S2 32 · 40 · 48 유지 — density paddingY 6 · 10 · 14                                                                                                                                                                                                                                                |
| 토큰 출처 (Phase 2 확장)   | `ruleDefinition.ts` · `codeCatalogLibrary.ts` · `rulePartRules.ts` · `deviceTypography.ts` · `domBinding.runtime.ts` | minHeight · part rule 의 width · height 를 토큰 값으로 → DOM `catalogDeviceControlCss` (높이 변수 + padding 식) · `catalogDeviceRowsHeightCss` (TextArea rows = (rows − 1) × 줄 + 높이). Disclosure 제목 · 패널 글자도 size 토큰 참조                                                                                                                                        |
| 옛 값에 묶인 리터럴        | Tree 행 내용 paddingY · Calendar 월/연 trigger 시작 8 · TextArea side 라벨 위치                                      | Tree: max(4, (32 − 줄) / 2) · Calendar: 사용자 값 8 상수 (종전 「Button paddingY × 2」) · side 라벨: 4 · 7 · 10 · 13 (per-size `--catalog-token-field-side-label-offset-*` fallback)                                                                                                                                                                                         |
| 빌더 고정 (Decision 8 · 9) | `builder-catalog-vars.css`                                                                                           | `--catalog-token-size-height-*` 20 · 22 · 30 · 42 · 54 (295 전 한 줄 상자) · side 라벨 3 · 5 · 9 · 13 · `--catalog-token-drp-group-min-height: auto`. 게이트 (c) 는 calc · 행간 비율을 계산값으로 비교 (`normalizedEntries`), 새 선언은 효과 없는 `min-height` (빌더 control 높이 · `0` · `auto`) 만 허용                                                                    |

**G2 두 arm (`adr295PaletteSymmetry`, Chromium · DPR 1)**:

- desktop 263/263 — 새 비대칭 0. 295 전부터의 목록에서 Menu@S 가 대칭이 되어 뺐다 (23).
- touch 263/263 — 알려진 터치 차이 14 → 2: Card · CardView · DateRangePicker S ~ XL 12 가 행간 식으로 닫혔다. 남은 것 DateRangePicker XS (구분 글자의 다른 단계 행간 비율) · ColorSlider M (Phase 2 부터).
- 경과 (터치 arm 새 비대칭): 50 (Button min-height 를 Canvas 정의가 버림 — Button 전용 정의 빌더) → 30 (DOM 이 record 의 desktop px 를 inline — 토큰 출처를 minHeight · padding 으로 확장) → 25 (증감 버튼 · TextArea · Tag 행간 리터럴) → 0.
- 과정에서 드러난 Phase 2 잔여 결함 2: Disclosure 제목 · TagGroup 라벨의 DOM 글자가 터치에서 안 커졌다 — 옛 고정 행간 20 이 두 leg 높이를 같게 가려 Phase 2 측정에 안 보였다.

**높이 변화 (desktop, Canvas = DOM)**: Button · ToggleButton(Group) · ButtonGroup S 22 → 24 · M 30 → 32 · L 42 → 40 · XL 54 → 48. field 입력칸 · 증감 버튼 · DateRangePicker 상자 같은 값. Text 줄 M 24 → 20 · Label 20 → 18. Tag 30 → 32. 남은 S2 차이 (3b · 3c): Select trigger L · XL 44 · 54 (chevron 아이콘 24 · 28 이 줄보다 큼 — 아이콘 크기는 3b) · ComboBox · picker 안 버튼 크기 (22 = 옛 30 − 8 리터럴, 3c) · toggle indicator (S2 14 · 16 · 18 · 20, 3c).

**회귀**: type-check PASS · rendering 1,320 · shared 2,037 · builder unit 7,145 (chromeIsland.static 1 — HEAD 와 같음) · parity 1,000 (GeometryDelta case 2 — HEAD 와 같음) · G3 (propAxisCanvasDom 5 Select · Tree · Table · paletteBaseCanvas — HEAD 와 같음). 값 단언 갱신 ~25 파일 (높이 30 → 32 · 행간 20 → 18 · padding 4 → 6 — 불변식 테스트 (Table 행 32 · 40 · 48, Tag 한 줄 상자 = control 높이) 는 식으로 바꿨다).

**live (Chrome MCP, 별도 dev 서버 5175 · 프로젝트 `adr295-live`)**: 팔레트로 Button 추가 → Canvas 68 × 32 · Input 32 · padding 6 · 행간 18. 빌더 root `--catalog-token-size-height-M 30px` · side 라벨 5px · drp `auto` (고정값). Compare Mode Preview: Input · Button 32 · padding 6 · 행간 18 · min-height 32. 「터치 크기로 미리보기」 켬: Input · Button 40 · padding 8 · 행간 22 · 글자 17 · Label 22 (S2 터치 값), Canvas Button 32 그대로. 끔: 32 로 복귀. 콘솔 오류 0. 추가한 Button 은 삭제 명령으로 정리.

### 6.4 Phase 3b (2026-10-30, 리터럴 참조화 · G3 ratchet · G4)

**S2 추출기 보강**: `adr295-s2-token-extract.mjs` 가 `iconStyle({ size })` (설치본 macro — XS 14 · S 16 · M 18 · L 20 · XL 22, rem × `--s2-scale`) 와 probe 가족별 보이는 svg 치수 (`iconTable` — Button · ActionButton · ToggleButton 아이콘 · Picker · ComboBox · Disclosure chevron · NumberField 증감 · SearchField 글리프 · DatePicker 달력 · Tag 지우기 · IllustratedMessage) 를 낸다. 기존 tokens · componentTable 은 바이트 같음 (fixture 는 추가만).

**판단 — ui-icon 표는 옮기지 않는다**: S2 ui-icon (Chevron S 10 · M 10 · L 12 · XL 14 · 증감 8 · 10 · 12 · 12 · 지우기 8 · 8 · 10 …) 은 아이콘마다 여백 없는 전용 글리프의 상자다. 저장소는 lucide (24 격자 · 여백 2) 로 그리므로 상자 크기를 옮기면 글리프가 절반으로 줄어든다. 그래서 S2 의 **공개 아이콘 단** (`iconStyle`) 만 토큰으로 두고, 컨트롤 안 워크플로 아이콘 자리와 Icon 컴포넌트가 참조한다. ui-icon 자리 (Breadcrumb · Disclosure · Tree · TreeItem · Tag) 는 사유와 함께 리터럴.

**변경**:

| 영역          | 파일                                                                                                                                                    | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 아이콘 토큰   | `rendering/primitives/device.ts` (`S2_ICON_SIZE` · `s2SizeTokens`) · `tokenResolver.ts` · `shared/runtime/resolveThemeSnapshot.ts`                      | `{size.icon.<S>}` — size 맵 `icon.<S>` (× scale, 터치 17.5 · 20 · 22.5 · 25 · 27.5) · DOM `--catalog-token-size-icon-<S>` (seed 두 벌)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| rule          | `componentRulesTable.ts`                                                                                                                                | iconSize → `{size.icon.<S>}`: Button · ToggleButton · Select · ComboBox · SearchField · NumberField · DatePicker · DateRangePicker · FileTrigger · Icon (값: L 24 → 20 · XL 28 → 22 · Icon 16 · 18 · 24 · 36 · 48 → 14 · 16 · 18 · 20 · 22 · NumberField · DatePicker XS 10 → 14 · DatePicker M 16 → 18 · SearchField S 14 → 16). radius 0 → `{radius.none}` (CardView · DateField · IllustratedMessage · TimeField · ToggleButtonGroup) · InlineAlert 10 → `{radius.lg}` · Popover 16 → `{radius.xl}`. TagList minHeight 22 · 30 · 42 → `{size.height.S · M · L}` (Tag 의 control 높이 24 · 32 · 40) |
| 생성 CSS      | `CSSGenerator.ts` (`iconPinVar`)                                                                                                                        | `--icon-size: var(--catalog-token-<컴포넌트>-icon-size-<S>, var(--catalog-token-size-icon-<S>))` — 컴포넌트 고정 변수는 빌더 root 만 선언 (295 전 px, Decision 8 · 9), Preview · Publish 는 S2 단                                                                                                                                                                                                                                                                                                                                                                                                     |
| 정의 · 소비자 | `ruleDefinition.ts` · `codeCatalogLibrary.ts` (`iconValue`) · `library.ts` · `rulePartRules.ts` · `manualBoxRules.ts` · rendering `resolveSpecIconSize` | 아이콘 단을 library 토큰 값으로 (출처 기억). `typeof iconSize === "number"` 로 거르던 자리 (Disclosure chevron · ContextualHelp 아이콘 · Button 자식 scale · glyph 정의 · TagGroup 의 TagList minHeight · rendering 4) 를 토큰도 받게 — 걸렀다면 조용히 기본값으로 떨어진다                                                                                                                                                                                                                                                                                                                           |
| DOM 터치      | `deviceTypography.ts` (`catalogDeviceGlyphSize` · width/height 의 `{size.icon}`) · `domBinding.runtime.ts` · `components/Icon.tsx` · `presence.ts`      | 글리프 크기 = 기기 변수 · svg 는 inline `1em` (Tree chevron · Calendar nav 시트의 고정 svg px 를 이긴다). 색을 바꾼 글리프 사본 (`withInheritedIconColor` · 시트 색 글리프) 이 토큰 출처를 잃던 것을 `copyResolvedTokenRefs` 로. Tree 잎 항목의 숨은 chevron 상자 하한 = 설치된 `{size.icon.S}`                                                                                                                                                                                                                                                                                                       |
| 빌더 고정     | `builder-catalog-vars.css`                                                                                                                              | `--catalog-token-size-icon-*` (S2 desktop) + 컴포넌트 고정 변수 47 (295 전 rule px). 게이트 (c) 통과                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

**G3 ratchet** (`packages/shared/src/catalog/__tests__/componentRulesTable.static.test.ts`): fontSize · borderRadius · lineHeight · minHeight · iconSize 의 px 리터럴은 `INTENTIONAL_LITERAL` 의 값 그대로 (등재 없음 · 값 drift · 낡은 등재 모두 FAIL). 등재 = control 모서리 7 · 8 · 9 · 10 (11 컴포넌트 — S2 `controlBorderRadius`, d3S2Alignment 가 대조) · Dialog 16 (빌더가 시트를 같이 읽어 `{radius.xl}` 이면 고정값 12) · ui-icon 자리 5 · 달력 칸 폭 4 · swatch · thumb 4 · 일러스트 2 · Toast · ListBoxItem 아이콘 · ListBoxItem minHeight 32 (paddingY 4 ↔ S2 식 6 — 3c) · Slot placeholder · Chart 축 글자. 나머지 키 (height 389 · minWidth 13 · paddingX 167 · paddingY 111 · gap 178 · iconGap 8) 는 상한 — 3c · 3d 가 내린다. **원복 RED**: Button L 아이콘을 24 로 · ColorField M 모서리를 6 으로 되살리면 3 FAIL (복원 cmp 일치).

**G4** (`apps/builder/src/builder/catalogRuntime/__tests__/d3S2Alignment.static.test.ts`, oracle = 추출기 fixture): (a) radius · border · spacing 단 · 기기 두 벌 · 글자 단계 × 행간 식 (두 벌) · control 높이 5단 · 아이콘 5단 = 설치본 · (c) field 모서리 S ~ XL = S2 control 모서리 · TextField · Picker · ComboBox · Button 높이 (두 벌) = `{size.height}` 의 기기 값 · Input · Button minHeight 토큰 · Button · ToggleButton 아이콘 (desktop) = S2 svg · 터치 아이콘 차이 표 (S2 control 안 아이콘은 글자 상대 18/14 em → 22, 우리 × 1.25 → 22.5 — 3c 의 `{ em }` 형). (b) 최종 snapshot radius 는 `resolveThemeSnapshot.test.ts` 「ADR-295 R9」 가 같은 표로. **원복 RED**: `S2_ICON_SIZE.L` 20 → 24 면 3 FAIL.

**G2 두 arm**: desktop 263/263 · touch 263/263 (알려진 목록 변화 없음). 경과 (터치): 36 (DOM root 에 아이콘 변수 없음 — snapshot cssVars 미생성) → 5 (Tree chevron · Calendar nav — 시트 고정 svg px · 색 사본의 출처 손실) → 3 (Tree 잎 chevron 상자 하한 16 고정) → 0. desktop 첫 측정 25 도 같은 변수 미생성.

**값 변화 (desktop)**: Select · ComboBox 트리거 L · XL 44 · 54 → 40 · 48 (3a 의 남은 차이 닫힘). Button · ToggleButton 아이콘 L · XL 24 · 28 → 20 · 22. Icon 컴포넌트 XS ~ XL 16 · 18 · 24 · 36 · 48 → 14 · 16 · 18 · 20 · 22 (S2 `iconStyle`). TagList 빈 틀 22 · 30 · 42 → 24 · 32 · 40.

**회귀**: type-check PASS · rendering 1,320 · shared 2,049 · builder unit (chromeIsland 1 — 기존) · parity (GeometryDelta case 2 — 기존) · G3 (propAxisCanvasDom 5 Select · Tree · Table · paletteBaseCanvas — 3a 와 같은 목록). 값 단언 갱신 9 파일.

**live (Chrome MCP, 5175 · `adr295-live`)**: 팔레트 Select 추가 → Canvas M 390 × 56 · XL 390 × 80 (트리거 48). Compare Mode Preview XL: 트리거 48 · 아이콘 22 (`var(--catalog-token-size-icon-XL)` · svg 1em). 「터치 크기로 미리보기」: 트리거 60 · 아이콘 27.5 · 글자 22, 끄면 48. 빌더 root `--catalog-token-size-icon-L 20px` · `--catalog-token-button-icon-size-L 24px` · `--catalog-token-select-icon-size-XL 28px` (고정값). 콘솔 오류 0 (토글 이후 추적). 추가한 Select 는 삭제 명령으로 지움.

**3c 로 넘긴 것**: minWidth (TextField 1.5 × · SearchField 3 × 높이 — `{ ofHeight }` 형) · ListBoxItem minHeight · Button 계열 터치 아이콘 `{ em }` 형 · ComboBox · picker 안 버튼 상자 · toggle indicator · padding · gap.

### 6.5 Phase 3c-1 (2026-10-30, 컨트롤 아이콘의 값의 형)

> **3c 분할 (실행 판단 — 사후 보고)**: 3c 를 셋으로 나눈다 — 3c-1 아이콘의 형 (이 절) · 3c-2 생성 시트에서 사라지는 선언의 빌더 고정 (minWidth · ListBoxItem) + field 안 버튼 상자 · toggle indicator · 3c-3 padding · gap 정렬 (사용자 결정 1) + 컴포넌트 글자 매핑 (G4 c). 3c-2 는 다시 3c-2a (§6.6) · 3c-2b (toggle indicator) 로 나눴다.

**발견 — S2 control 아이콘의 형은 `{ em }` 이 아니라 행간**: S2 `Button.tsx` · `ActionButton.tsx` 의 아이콘은 `size: '1lh'` (그 글자의 행간 상자) 이다. desktop 은 글자 11 · 12 · 14 · 16 · 18 의 행간 14 · 16 · 18 · 20 · 22 로 아이콘 단과 같은 값이라 3b 의 `{size.icon}` 로도 맞았지만, 터치는 글자 13 · 15 · 17 · 19 · 22 의 행간 16 · 18 · 22 · 24 · 26 이라 × 1.25 (17.5 · 20 · 22.5 · 25 · 27.5) 와 갈렸다 (3b 「알려진 터치 차이 표」). SearchField 글리프도 같은 `1lh` (oracle 16 · 18 · 20 · 22 → 18 · 22 · 24 · 26). DatePicker 달력 아이콘은 글자 크기 `1em` (12 · 14 · 16 · 18 → 15 · 17 · 19 · 22) — 3b 가 `{size.icon}` (M 18) 로 둔 것이 S2 (M 14) 와 달랐다. 그래서 새 형 (`{ em }` 객체) 대신 **이미 두 벌인 글자 · 행간 토큰을 참조** 한다 — 기기 두 벌 · 토큰 출처 · 빌더 고정이 그대로 따라온다.

**변경**:

| 영역        | 파일                                                                                           | 내용                                                                                                                                                                                                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rule        | `componentRulesTable.ts`                                                                       | iconSize: Button · ToggleButton · FileTrigger · SearchField → `{typography.<그 크기 글자>--line-height}` (S2 `1lh`) · DatePicker · DateRangePicker → `{typography.<글자>}` (S2 `1em` — desktop M 18 → 14). Select · ComboBox chevron · NumberField 증감은 ui-icon 자리라 3b 그대로 |
| 생성 CSS    | rendering `tokenResolver.ts` (`tokenToCSSLength` · `ICON_SIZE_TOKEN_REF`) · `CSSGenerator.ts`  | 행간 토큰은 CSS 에서 단위 없는 비율이라 길이 자리에서는 `calc(var(--…-text-sm) * var(--…-text-sm--line-height))`. 컴포넌트 고정 변수 (3b) 뒤의 fallback 이라 빌더는 295 전 px                                                                                                      |
| 정의        | `codeCatalogLibrary.ts` (part visual 의 token 변환) · `rulePartRules.ts` (Button 의 Icon 자식) | 글자 · 행간 ref 도 library token 값으로 (출처 기억) — `ICON_SIZE_TOKEN_REF` 한 술어                                                                                                                                                                                                |
| DOM 터치    | `deviceTypography.ts` (`catalogDeviceLength`)                                                  | 글리프 · 부품 변 (`width` · `height`) 의 기기 길이: size 토큰 → 변수, 글자 → 글자 변수, 행간 → 글자 × 행간 비율                                                                                                                                                                    |
| Canvas      | `presence.ts` (`treeChevronIcon`)                                                              | Tree 잎 항목의 숨은 chevron 상자 하한 = Button rule 의 S 아이콘 토큰 (3b 는 `{size.icon.S}` 고정 — 터치 arm Tree S · M · L 이 Canvas 20 · DOM 18 로 갈렸다)                                                                                                                        |
| 게이트 도구 | `apps/builder/scripts/adr295BuilderGeneratedSheets.mjs` (`substitute`)                         | 변수 fallback 을 괄호 짝까지 읽는다 — `var(pin, calc(var(--text-sm) * var(--text-sm--line-height)))` 의 행간 변수가 다시 `calc()` 를 들어 한 단계 정규식이 pin 을 못 풀었다 (빌더 값은 18px 그대로였다). 개정 뒤 게이트 (c) 전 entry 통과 = 옛 치환기 결과와 같다                  |

**G4** (`d3S2Alignment`): 「Button 아이콘의 터치 차이 표」 를 지우고 Button · ToggleButton · SearchField (`1lh`) · DatePicker (`1em`) 의 iconSize ref = 그 크기 글자 토큰 · desktop · touch 두 벌 = S2 svg 를 단언. **원복 RED**: Button M 을 `{size.icon.M}` 로 되살리면 1 FAIL (복원 cmp 일치).

**G2 두 arm**: desktop 263/263 · touch 263/263. 경과 (터치): 3 (Tree chevron 상자 하한) → 0.

**회귀**: type-check PASS · rendering 1,320 · shared 2,049 · builder unit (chromeIsland 1 — 기존) · parity (GeometryDelta case 2 — 기존) · G3 (propAxisCanvasDom 5 · paletteBaseCanvas — 3b 와 같은 목록). 값 단언 갱신 1 파일 (`mixedButtonText` DOM 아이콘 식).

**live (Chrome MCP, 5175 · `adr295-live`)**: 팔레트 Button 추가 + Properties 아이콘 선택. Compare Mode Preview: 버튼 32 · 아이콘 18 (inline `calc(var(--catalog-token-text-sm) * var(--catalog-token-text-sm--line-height))`). 「터치 크기로 미리보기」: 버튼 40 · 아이콘 22 · 글자 17 (S2 터치 값 — 3b 는 22.5), 끄면 32 · 18. 빌더 root 고정값 `--catalog-token-button-icon-size-M 18px` · `-L 24px` · `--catalog-token-search-field-icon-size-S 14px`. 새로고침 (아이콘 Button hydration) 뒤 콘솔 오류 0. 추가한 Button 은 삭제 명령으로 지움.

**3c-2 로 넘긴 것 (실측 근거)**:

- **minWidth**: S2 TextField · SearchField 에는 min-width 가 없다 (1.5 × · 3 × 는 Spectrum 1). 지우면 생성 시트에서 선언이 사라지는데, 빌더 위젯이 같은 시트를 읽어 게이트 (c) 가 막는다 — 사라지는 선언을 빌더만 유지하는 길이 필요하다. ProgressBar 48 은 S2 `bar-utils.ts` `minWidth: 48` (`size()` — 터치 60).
- **ListBoxItem**: S2 메뉴 항목 (`menuitem` = `control({wrap, icon})`) 은 테두리 없이 label padding 7 (= (32 − 18) / 2) · description 사이 2 — 우리 생성기 식 (테두리 포함 6) 과 리터럴 4 둘 다 아니다. ListBox 시트는 빌더 chrome 과 공유 (위와 같은 문제).
- **Button minWidth**: S2 `control()` 은 `minWidth: controlSize()` (= 높이) 를 준다 — 2026-10-14 결정 「S2 Button 에 min-width 없음」 의 전제와 다르다. 지금 padding 으로는 보이는 차이가 없어 (아이콘만 Button M = 12 + 18 + 12 = 42 > 32) 이번엔 두고 보고만 한다.

### 6.6 Phase 3c-2a (2026-10-30, 사라지는 선언의 빌더 고정 · 최소 폭 · field 버튼 · 메뉴 항목)

> **3c-2 분할 (실행 판단 — 사후 보고)**: toggle 표시 상자 (Checkbox · Radio · Switch) 는 빌더 chrome 과 공유하는 수동 시트 (`Checkbox.css` · `Radio.css` · `Switch.css`) · Skia primitive (`checkbox` · `radio` · `switch_toggle`) · indicator part rule 을 함께 바꿔야 해서 3c-2b 로 뗀다. 이 절은 3c-2a.

**S2 실측 (설치본 1.8.1)**:

- TextField · SearchField 에 min-width 없음 (1.5 × · 3 × 높이는 Spectrum 1). 막대 (ProgressBar · Meter) 는 `bar-utils.ts` `minWidth: 48` (`size()`).
- field 안 버튼: ComboBox · DatePicker `inputButton` 의 `size` · `width` = S 16 · M 20 · L 24 · XL 32 (`size()` — 터치 × 1.25). 우리 값 16 · 18 · 22 · 34 · 46 은 「옛 높이 − 4 · 4 · 8 · 8 · 8」 리터럴이었다.
- `controlSize('sm')` = S 14 · M 16 · L 18 · XL 20 — Checkbox 상자 · Radio 고리 · Switch track 높이 (3c-2b 가 쓴다).
- 메뉴 항목 (`menuitem` = `control({wrap, icon})`) 은 테두리 없이 control 높이 M 안에 label 을 가운데 — (32 − 18) / 2 = 7, description 사이 2.

**변경**:

| 영역       | 파일                                                                                                                                                               | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 토큰       | rendering `device.ts` (`S2_CONTROL_HEIGHT_SM` · `S2_FIELD_BUTTON_SIZE` · `S2_BAR_MIN_WIDTH`) · `resolveThemeSnapshot.ts` · `tokenResolver.ts` (`cssVarToTokenRef`) | size 맵에 `height-sm.<S>` · `field-button.<S>` (XS 14 — S2 에 없어 XS field 20 의 여백 3) · `bar.min-width`. DOM 변수는 size 맵 키 전부 (`--catalog-token-size-<family>-<key>`, desktop · touch 두 벌)                                                                                                                                                                                                                               |
| rule       | `componentRulesTable.ts`                                                                                                                                           | TextField · SearchField minWidth 삭제 · ProgressBar minWidth `{size.bar.min-width}` · ComboBox · DatePicker · DateRangePicker 버튼 정사각형 `var(--catalog-token-size-field-button-<S>)`, offset · 입력칸 끝 공간은 그 값의 `calc` (안쪽 여백 2 · 2 · 4 · 4 · 4 · 끝 공간 +4 · 8 · 12 · 16 · 24 는 그대로 — 3c-3) · ListBoxItem `minHeight {size.height.M}` · `borderWidth {border.width.none}` · paddingY 7 (생성기의 S2 가운데 식) |
| 생성기     | `CSSGenerator.ts`                                                                                                                                                  | size `minWidth` 토큰 → 변수 (`minHeight` 와 같은 길)                                                                                                                                                                                                                                                                                                                                                                                 |
| field 접두 | `fieldPrefix.ts` (`buttonOverlayInset`)                                                                                                                            | offset 이 `calc(0px − 정사각형 − 안쪽 여백)` 이라 안쪽 여백을 식에서 읽는다                                                                                                                                                                                                                                                                                                                                                          |
| DOM 터치   | `deviceTypography.ts` (`catalogDeviceLength` · `catalogDeviceControlCss`)                                                                                          | size 맵의 모든 족 → 기기 변수. 단 field 버튼 정사각형은 desktop px 로 둔다 — 아래 live 발견                                                                                                                                                                                                                                                                                                                                          |
| 빌더 고정  | `builder-catalog-vars.css` · 신규 `builder-catalog-pins.css` (+ `builder-components.css` import)                                                                   | field 버튼 고정값 16 · 18 · 22 · 34 · 46 (식이 295 전 offset · 끝 공간을 돌려준다) · bar 48. 생성 시트에서 **사라진** 선언 (TextField · SearchField min-width) 은 같은 선택자로 고정 시트가 유지 — `:not(:where(.publish-app *))` (specificity 0) 로 같은 탭의 `/publish` 경로 (빌더 번들이 시트를 같이 싣는다) 를 뺀다                                                                                                              |
| 게이트     | `adr295BuilderGeneratedSheets.mjs` (`pinFiles`) · `builderCatalogVars.static.test.ts` (c) · 신규 (d)                                                               | 고정 시트 선언은 같은 조건 · 선택자의 생성 블록 하나를 덮어쓴다 (없거나 둘이면 throw). (d) 생성 시트만으로 같은 값이면 낡은 고정 · 미디어 쿼리 · `var(` 0 · `/publish` 제외 접미 · 생성 시트 뒤 · `CatalogStates` 앞                                                                                                                                                                                                                 |
| G4         | 추출기 (`fieldButton` · `barMinWidth`) · oracle fixture (그 두 키만 추가 — 나머지 diff 0) · `d3S2Alignment`                                                        | 세 족 두 벌 = 설치본 · field 버튼 변수 · ProgressBar 토큰 · TextField · SearchField 최소 폭 없음 · ListBoxItem (32 − 18) / 2                                                                                                                                                                                                                                                                                                         |
| ratchet    | `componentRulesTable.static.test.ts`                                                                                                                               | minWidth 상한 13 → 0 · ListBoxItem minHeight 32 등재 삭제                                                                                                                                                                                                                                                                                                                                                                            |

**원복 RED**: ComboBox M 버튼 22px + ListBoxItem paddingY 4 → G4 1 FAIL · 고정 시트에서 SearchField M 빼기 → 게이트 (c) 1 FAIL (복원 cmp 일치).

**G2 두 arm**: 263/263. **하니스 사각 (기록)**: 터치 arm 의 Canvas 는 터치 맵으로 field 버튼 25 · offset −29, DOM 은 inline 20 · −24 인데 263/263 그대로였다 — G2 비교가 field 버튼 상자를 잡지 못한다. 3c-3 (margin · padding 기기 식) 에서 같이 본다.

**회귀**: type-check PASS · rendering 전량 · shared 2,049 · builder unit (chromeIsland 1 — 기존) · parity (GeometryDelta case 2 — 기존) · G3 (propAxisCanvasDom 5 · paletteBaseCanvas — 기존 목록). 값 단언 갱신: `adr253FieldPartsDom` (버튼 20 · 32 · 끝 공간 32 · 56) · `resolveContainerStylesFallback` · `collectionItemMetrics` · `triggerIconSizeScale`.

**live (Chrome MCP, 5175 · `adr295-live`)**: 팔레트 ComboBox 추가. Preview (Compare Mode): 버튼 20 · 안쪽 여백 4 · 입력칸 32 · 끝 공간 32 · 메뉴 항목 50 (7 + 18 + 2 + 16 + 7, 테두리 0) · TextField 최소 폭 없음. 「터치 크기로 미리보기」: 입력칸 40 · 버튼 20 가운데 · 메뉴 항목 60 (위아래 9 — S2 터치). Canvas 화면도 항목 ~50 · 버튼 안쪽 4. 빌더 root: field 버튼 M 22px · TextField M 최소 폭 45 · SearchField L 126 (295 전), `.publish-app` 안은 최소 폭 없음. 새로고침 뒤 콘솔 오류 0. ComboBox 는 삭제 명령으로 지움.

**live 발견 2**:

- **같은 탭 `/publish` 경로가 빌더 번들의 시트를 싣는다** (`main.tsx` 가 `builder-components.css` 를 전역으로 — ADR-235): 고정 시트가 Preview 버튼의 publish 화면에도 TextField 최소 폭 45 를 줬다 → `.publish-app` 제외로 수리 · (d) 가 단언. 같은 경로에서 빌더 chrome 의 `[data-size="M"]` 규칙이 ComboBox Input 행간을 21 (`--text-base--line-height`) 로 바꾸는 것도 보였다 (입력칸 35) — 이 phase 와 무관한 기존 누수라 보고만 한다.
- **터치에서 field 버튼만 커지면 field 끝을 1px 넘는다**: 정사각형은 기기 변수 (25) 인데 offset · 끝 공간은 다른 키 · 다른 record 의 inline px (−24 · 32). margin · padding 을 기기 식으로 inline 하는 것은 3c-3 의 몫이라, 이번엔 DOM 정사각형도 desktop px (`catalogDeviceControlCss` 가 field-button 족을 건너뜀) — 터치에서 세 값이 같이 desktop, 3c-3 에서 함께 기기 식으로.

**3c-2b 로 넘긴 것**: toggle 표시 상자 — S2 `controlSize('sm')` 14 · 16 · 18 · 20 (우리 Checkbox · Radio 16 · 20 · 24 · 30 — 수동 시트가 `--text-base/xl/2xl/3xl` 을 상자 크기로 읽는다) · Checkbox 모서리 `controlBorderRadius('sm')` 4 · 4 · 5 · 5 · Switch track 폭 `fontRelative(26)` · thumb. Meter 최소 폭 48 (S2 `bar-utils` 는 Meter 도 — 빌더 시트에 새 선언이라 고정이 필요).

### 6.7 Phase 3d (2026-10-30, 진행 중 — 3c-2b · 3c-3 과 병렬)

> **병렬 (실행 판단 — 사후 보고)**: 3d 의 정리 2 건 (`paletteBaseCanvas` 은퇴 · 숨은 사본) 은 3c-2b · 3c-3 과 파일이 겹치지 않아 먼저 · 따로 한다. spacing 맵 판정은 3c-3 결과 뒤.

- **`paletteBaseCanvas` 은퇴** (사용자 삭제 승인 2026-10-30): `apps/builder/tests/adr248-g3/paletteBaseCanvas.browser.test.ts` 삭제 — ADR-248 G0 의 frozen 옛 Canvas PNG 와 비교해 295 뒤로는 항상 FAIL 이었다 (§6.0). ADR-248 증거 (`248-phase3-palette-base-canvas.json` · PNG 폴더 · `adr248-g3-old-defect-ledger.mjs`) 는 완료 ADR 이 인용해 남긴다. `.codex/tests/workflow.test.mjs` 의 G3 config 선택 예시는 `propAxisCanvasDom` 경로로. 이후 G3 회귀 목록은 `propAxisCanvasDom` 의 기존 실패만.
- **숨은 사본 (`collectionItemMetrics`)** (worktree 에이전트 `a86bfe0d0` + 사용자 삭제 승인 2026-10-30): 화면에 쓰이던 손 사본은 GridList 카드의 label ↔ description 간격 하나 — `gridlist_card` 가 rule `GridListItem.sizes.*.gap` 을 읽는다 (값 2 그대로, 원복 RED: 사본 값 고정 → 새 단언 `38 ≠ 42` FAIL). rule 과 이미 갈린 나머지 사본 (ListBoxItem paddingY 4 ↔ rule 7 · GridListItem padding 16 · 12 / radius 8 / border 1 ↔ rule 12 · 8 / none / none — §6.0 의 「radius 12 · 8 · 8」) 은 테스트 전용 resolver (`resolveListBoxSpacingMetric` · `resolveGridListSpacingMetric`) 만 읽어 화면에 닿지 않았다 → 함수와 테스트 파일 2 개 (`ListBox.spacing.test.ts` · `GridList.spacing.test.ts`) 삭제, rendering index 의 소비처 0 re-export 20 삭제, `style-ssot.md` §8 인용 정정. rendering 105 파일 · 1,279 pass · G2 263/263 (에이전트 실행) · `docs:stale-symbols` 0.

### 6.8 Phase 3c-2b (2026-10-30, toggle 표시 상자)

**S2 실측 (설치본 1.8.1)**: Checkbox `box` = `controlSize('sm')` · 테두리 2 · `controlBorderRadius('sm')` (4 · 4 · 5 · 5). Radio `circle` = `controlSize('sm')` · 선택 테두리 `calc((self(height) − (4 / 16) * 1rem) / 2)` (흰 점 4, rem 이라 터치도 4). Switch `track` = 높이 `controlSize('sm')` · 폭 `fontRelative(26)` (26 / 14 em) · 테두리 2, `handle` = 높이 full 을 perspective 로 줄여 끔 track − 8 · 켬 track − 6, 켬 위치는 `translateX(trackWidth − 100% − 4px)` (끝에서 3). `bar()` = minWidth 48 · maxWidth 768 (Meter · ProgressBar).

**경계 발견**: 수동 시트 (`Checkbox.css` · `Radio.css` · `Switch.css`) 는 빌더 chrome 과 공유하고, 게이트 「chrome CSS 는 `--catalog-token-*` 를 읽지 않는다」 가 기기 변수를 막는다. 그래서 catalog 값은 rule 의 선택자 (`*_INDICATOR_SELECTORS` → `rootSelectors`) 로 생성 시트에 싣는다 — RAC 버튼을 넣은 선택자라 수동 시트의 그룹 위임 (`[data-radio-size] .react-aria-Radio .indicator`) 보다 specificity 가 같거나 높고, 생성 시트가 뒤에 실린다. 빌더는 생성 toggle 시트를 싣지 않아 chrome (DataGrid Checkbox S · PropertySwitch 기본) 은 수동 시트의 295 전 px 그대로.

**변경**:

| 영역      | 파일                                                                                                                                                                                                                                   | 내용                                                                                                                                                                                                                                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| rule      | `componentRulesTable.ts`                                                                                                                                                                                                               | Checkbox `indicator {boxSize: {size.height-sm.<S>}, boxRadius: 4 · 4 · 5 · 5}` · Radio `{boxSize: 토큰, dotSize: 4}` · Switch `{trackHeight: 토큰, trackWidthEm: 26/14, thumbInset: 4, thumbInsetSelected: 3}` + 셋의 `rootSelectors` (상수 한 묶음에서 rule 값과 DOM 선택자를 같이 만든다). Meter `minWidth {size.bar.min-width}` · `maxWidth 768` |
| 타입      | `catalog-style.types.ts` · rendering `spec.types.ts`                                                                                                                                                                                   | indicator 의 토큰 · em · inset 필드, `IndicatorSpec.thumbSizeSelected` · `thumbOffsetSelected`                                                                                                                                                                                                                                                      |
| Canvas    | `rulePartRules.ts` (`catalogToggleIndicatorMetrics` — 설치 맵으로 px) · `ruleShapes.ts` (toggle primitive 에 풀린 indicator) · `skiaPrimitives.ts` (Switch 켬 thumb 크기 · 끝 여백) · `manualBoxRules.ts` (그룹 항목 최소 높이 = 토큰) | indicator 노드 상자 (part rule) 와 primitive 가 같은 함수                                                                                                                                                                                                                                                                                           |
| DOM       | 생성 `Checkbox.css` · `Radio.css` · `Switch.css` · `Meter.css`                                                                                                                                                                         | 상자 = `var(--catalog-token-size-height-sm-<S>)`, Switch 폭 = `calc(var(--catalog-token-text-*) * 26 / 14)`                                                                                                                                                                                                                                         |
| 빌더 고정 | `builder-catalog-pins.css` · 게이트 (c)                                                                                                                                                                                                | Meter 새 선언을 초기값 (`auto` · `none`) 으로 — (c) 는 초기값으로 고정한 새 min · max 폭을 효과 없음으로 읽는다                                                                                                                                                                                                                                     |
| G4        | 추출기 `barMaxWidth` · oracle (그 키만 추가) · `d3S2Alignment`                                                                                                                                                                         | rule 의 형 (토큰 · 글자 × em) 을 두 기기 맵으로 푼 값 = S2 probe computed (Checkbox · Radio · Switch 상자 · Switch 폭 0.05 안) · Checkbox 모서리 · 막대 폭                                                                                                                                                                                          |

**원복 RED**: Switch em 26/14 → 28/14 → G4 1 FAIL · 생성 Checkbox 선택자 제거 → G2 Checkbox · CheckboxGroup 전 size FAIL (복원 cmp 일치).

**G2 두 arm**: 263/263.

**회귀**: type-check PASS · rendering 1,279 · shared 2,049 · builder unit (chromeIsland 1 — 기존 · `phase4eG5LeafScope` 1 은 시간 초과로 재실행 PASS). 값 단언 갱신: `toggleIndicatorXlCatalog` · `toggleIndicatorNode` (손계산 기대값 — 행 높이 = 글자 줄 16 · 18 · 20 · 22, 상자 y 1, Switch 폭 글자 × 26 / 14) · `adr251ItemsNode` · `adr253OriginOverrideChannel`.

**live (Chrome MCP, 5175 · `adr295-live`)**: 팔레트 Checkbox · Switch · RadioGroup 을 body 에 각각. Canvas 16 · 26×16 · 16. Preview (Compare Mode) desktop: Checkbox 16 · 모서리 4 · Switch 26×16 · 켬 thumb 10 · 이동 9 · 끔 thumb 8 · 안쪽 4 · Radio 16 · 선택 고리 6 (흰 점 4). 「터치 크기로 미리보기」: Checkbox 20 · Switch 31.57×20 (S2 probe 31.56) · thumb 12 · Radio 20 · 선택 고리 8. 빌더 문서 probe: Checkbox S 16 · 기본 20 · Switch 36×20 · Meter 최소 폭 없음 (295 전). 새로고침 뒤 콘솔 오류 0. 세 요소는 삭제 명령으로 지움.

**live 측정 함정 (기록)**: 팔레트 클릭은 선택된 요소 안에 넣는다 — 첫 시도에서 Radio 가 Switch · Checkbox 안에 들어가 Switch 의 `[data-selected] .indicator` 칠이 Radio 고리를 검게 칠했다 (이 phase 와 무관). 각 삽입 전에 body 를 고른다.

**3c-3 로 넘긴 것**: toggle 의 라벨 gap (S2 `text-to-control` 10 / 14 em) · 글자 매핑 (Checkbox · Radio 글자가 S2 보다 한 단 위 — G4 c) · Checkbox 체크 글리프 크기 (S2 는 한 단 작은 ui-icon, 우리는 상자 비례 — 두 consumer 같음).

### 6.9 Phase 3c-3a (2026-10-31, 여백 · 간격의 값의 형)

> **분할 (실행 판단 — 사후 보고)**: 3c-3 을 둘로 나눈다 — 3c-3a 는 값의 형 (`ofHeight` · `em` · `touch`) 과 높이가 이미 토큰인 가족 (Button · ToggleButton · Tag · Input · DateInput · toggle 3 종) + Checkbox · Radio · DateField 글자 매핑 + field 버튼의 터치 식 (3c-2a 에서 넘긴 것), 3c-3b 는 Badge (높이 토큰 없음) · Select 트리거의 터치 식 · SearchField · 남은 리터럴의 `INTENTIONAL_LITERAL` 분류.

**값의 형 구현**: rule 은 Decision 3 의 형을 그대로 쓴다 — `ofHeight(1, 2)` (S2 `pill`) · `ofHeight(3, 8)` (`edge-to-text`) · `em(6, 14, [8, 17])` (`text-to-visual`, 터치 계수 override) · `em(10, 14)` (`text-to-control`). 형마다 길이 ref 하나 `{length.<기준 토큰>*a/b[~c/d][±px]}` (기준 = 그 size 블록의 `{size.height.<S>}` · `{typography.text-*}`) 를 모든 소비자가 읽는다.

| 소비자                          | 읽는 법                                                                                                                                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas · 엔진 · 패널 (숫자)     | 표가 로드될 때 `defineRuleLengthForms` 가 형 자리를 getter 로 바꾼다 — 설치된 맵 (Canvas 는 desktop, G2 터치 arm 은 터치 벌) 의 `resolveToken`. 숫자를 읽는 기존 소비처 (`typeof size.paddingX === "number"` …) 는 그대로 — 문자열 · 객체로 바꾸면 그 검사가 기본값으로 조용히 빠진다 |
| 생성 CSS                        | `var(<컴포넌트 고정 변수>, <식>)` — 식은 기기 변수 위 (`calc(var(--catalog-token-size-height-M) * 1 / 2)`, 터치 계수는 `--catalog-token-size-device-touch` (단위 없는 0 · 1) 로 섞는다). 고정 변수는 빌더 root 만 선언 (295 전 px — 3b 아이콘과 같은 길)                              |
| library · resolver · DOM inline | 정의 (`ruleDefinition` box · `codeCatalogLibrary` button 계열 · part rule 의 delegation `gap` · 패딩 변) 가 ref 를 token 값으로 → resolver 가 출처를 기억 (`catalogResolvedTokenRef`) → `catalogDeviceControlCss` 가 아직 그 값인 inline px 를 같은 식으로                            |

field 버튼 (ComboBox · DatePicker · DateRangePicker): 정사각형 `{size.field-button.<S>}` · 입력칸 끝 공간 `{length.size.field-button.<S>*1/1+N}` · 시작 offset (정사각형 − 안쪽 여백 — DOM 이 정사각형 변수에서 다시 만든다) 이 함께 기기 식. 끝 공간의 상수 4 · 8 · 12 · 16 · 24 (옛 Input 여백) 는 그대로 — S2 ComboBox 끝 여백 (4 · 5.5) 과의 대조는 3c-3b.

**값 (desktop · 터치 = S2 probe)**: Button 여백 10 · 12 · 16 · 20 · 24 (터치 × 1.25) · 간격 4.71 · 5.14 · 6 · 6.86 · 7.71 (터치 8/17 em — M 8) · ToggleButton 여백 7.5 · 9 · 12 · 15 · 18 · field 입력 상자 (Input · DateInput) 여백 같은 값 · Tag 같은 값 · Checkbox · Radio · Switch 라벨 간격 글자 × 10/14 (M 10, 터치 12.14) · Checkbox · Radio · DateField 글자 S2 한 단 아래 (12 · 14 · 16 · 18). Select 트리거 시작 여백 = S2 Picker `edge-to-text` (Select delegation `--select-btn-pad-start` 7.5 · 9 · 12 · 15 · 18 — Button 의 `pill` 을 받지 않게, desktop px · 터치 식은 3c-3b).

**빌더 고정**: 빌더가 싣는 생성 시트 4 (ToggleButton · Input · DateInput · DateField) 의 새 변수 · 글자는 `builder-catalog-vars.css` (고정 변수 25 · 터치 flag 0) · `builder-catalog-pins.css` (DateField 글자 · Select `--select-btn-pad-start: 0`). Select 트리거의 새 `padding-left` 는 빌더에서 builder-system layer (`form-controls.css` `padding: 0`) 가 이기는 자리라 게이트 (c) 가 그 한 키만 0 으로 허용.

**게이트**: G4 `d3S2Alignment` 「3c-3」 — 형을 두 기기 토큰 표로 푼 값 (resolveToken 아님) = S2 probe (Button · ActionButton · TextField · DateField · TagGroup · Checkbox · Switch, 0.02 안) + 글자 매핑. RadioGroup 의 probe `rootGap` 12 는 그룹 간격이라 Radio 라벨 간격 행은 없다. codemod `apps/builder/scripts/adr295-spacing-forms-codemod.mjs` (표 한 장 → rule 리터럴 교체, 1회).

**원복 RED**: 터치 계수 제거 (`em(6, 14)`) → G4 1 FAIL (Button S 터치 간격 S2 7.06) · Button `ofHeight(3, 8)` → G4 1 FAIL · DOM 기기 식 (`catalogDeviceSpacingCss`) 끔 → G2 터치 arm 55 FAIL (Button · Card · Checkbox · Switch · Menu …). 복원 cmp 일치.

**G2 두 arm**: desktop 263/263 · touch 263/263 (3c-2a 의 field 버튼 터치 사각도 이번에 잡혀 고쳤다 — 14 FAIL → 0).

**회귀**: type-check PASS · rendering 1,279 · shared 2,049 · builder unit (chromeIsland 1 — 기존 · `phase4eG5LeafScope` 시간 초과 재실행 PASS). 값 단언 갱신 11 파일 (Button 여백 · 간격, field 상자 여백, toggle 라벨 x, Select 트리거 시작, Checkbox 글자).

**live (Chrome MCP, 5175 · `adr295-live`)**: 팔레트 Button · Switch 를 body 에. Canvas: Button 여백 16 · 간격 6 (라벨 x 17 = 16 + 테두리) · Switch 라벨 x 36 (track 26 + 10) · Input 여백 12. Preview desktop: Button 75.59 (Canvas 75.58) · 여백 16 · 간격 6 · Switch 간격 10 · Input 12 — inline 은 기기 식. 「터치 크기로 미리보기」: Button 여백 20 · 간격 8 · Switch 간격 12.14 · Input 15 (S2 probe 20 · 8 · 12.14 · 15). 빌더 root: `--catalog-token-input-padding-x-M` 12 · `--catalog-token-toggle-button-gap-M` 8 · 터치 flag 0 (295 전). 콘솔 오류 0. 두 요소는 삭제 명령으로 지움.

- G1 before/after: §6.1
- G2 두 arm: §6.2 · Phase 3a §6.3 · Phase 3b §6.4
- G4 (b) 최종 snapshot (preset 5 × 델타) · (c) 컴포넌트별 desktop/touch vs S2 computed: §6.4 (c 의 padding · gap 은 3c)
- G5 빌더 chrome before/after Δ (패널 표면 + 위젯 CompactSelect · PropertySelect · Data RowForm, desktop · pointer: coarse 두 조건): (미작성)
- Decision 9 게이트 (a) 커버리지 · (b) pointer 쿼리 0 · (c) 계산값 == 기준 JSON · RED: §6.2
- G3 ratchet 원복 RED: §6.4
- G5 live: (미작성)
