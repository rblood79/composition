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

식 결과 (desktop base 14, 1px 반올림): ui −2 → 11 · −1 → 12 · 0 → 14 · 1 → 16 · 2 → 18 · 3 → 20; heading 2 → 18 · 3 → 20 · 4 → 22 · 6 → 28 · 8 → 36. touch (base 17): 0 → 17 · −1 → 15 · 1 → 19 · 2 → 22 · 3 → 24. 행간 (desktop): 11 → 14 · 12 → 16 · 14 → 18 · 16 → 20 · 18 → 22 · 20 → 24 · 22 → 26 · 28 → 34 · 36 → 42. **이 숫자는 손계산 — G0 추출기와 브라우저 computed style 로 재확인한 뒤에만 토큰 표에 쓴다.**

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

## 6. 실측 기록 (Phase 별로 채운다)

- Phase 0 대조표: (미작성)
- G1 before/after: (미작성)
- G2 두 arm: (미작성)
- G4 (b) 최종 snapshot (preset 5 × 델타) · (c) 컴포넌트별 desktop/touch vs S2 computed: (미작성)
- G5 빌더 chrome before/after Δ (패널 표면 + 위젯 CompactSelect · PropertySelect · Data RowForm, desktop · pointer: coarse 두 조건): (미작성)
- Decision 9 게이트 (a) 커버리지 · (b) pointer 쿼리 0 · (c) 계산값 == 기준 JSON · RED: (미작성)
- G3 ratchet 원복 RED: (미작성)
- G5 live: (미작성)
