# Spectrum 개념 대비 composition 세부 대조 — 누락 · 개선 (2026-11)

> [SPECTRUM_COVERAGE_GAP_2026-10.md](SPECTRUM_COVERAGE_GAP_2026-10.md) 의 거친 판정을 현재 코드로 다시 확인한 세부판. 기준은 [SPECTRUM_HUB_CONCEPTS_2026-10.md](SPECTRUM_HUB_CONCEPTS_2026-10.md) (Hub 정리본) + 설치된 `@react-spectrum/s2` 1.8.2 · RAC 1.22.1 · design-data 3.8.2. 코드는 2026-11-07 main `03ead111a` + 작업 트리. 이 문서는 사실 기록이다 — 착수는 `/create-adr` 로 따로 정한다.

## 0. 방법과 한계

- 6 영역으로 나눠 항목마다 `제공 / 부분 / 미제공 / 해당 없음` 을 `파일:행` 근거로 판정했다. 항목 468개의 상세 표는 `.agent/runs/2026-11-07-spectrum-check/spectrum-check-{1..6}-*.md` (로컬 전용) 에 있다.
- 이 문서에 실은 항목은 영역별 보고의 핵심 근거를 코드에서 다시 확인한 것이다 (grep · 해당 행 판독). 상세 표의 나머지 행은 표본 확인만 했다.
- **전부 코드 판독이다. 브라우저 실측은 없다.** Canvas 픽셀 · Preview computed style · RTL · forced-colors 의 실제 화면은 확인하지 않았다.
- 값 판정은 Hub 서술이 아니라 S2 설치본 기준이다 (ADR-295). 둘이 다른 곳은 따로 적었다 (§6).
- 작업 트리가 다른 세션에서 바뀌는 중이라 행 번호는 몇 행 어긋날 수 있다.
- 같은 날의 deep-research 검증 (웹 출처 26, 주장 25 중 20 통과) 은 attention hierarchy · 선택 상태 · object style · 토큰 계층 · design-data 지침 층만 덮었다. 결과는 같은 폴더 `deep-research-result.json`.

## 1. 집계

| 영역                                                       | 항목 | 제공 | 부분 | 미제공 | 해당 없음 |
| ---------------------------------------------------------- | ---- | ---- | ---- | ------ | --------- |
| 1. design tokens · color · grays · background layers       | 52   | 17   | 28   | 4      | 3         |
| 2. typography · spacing · containers · object styles       | 70   | 26   | 31   | 9      | 4         |
| 3. getting-started · attention hierarchy · states · motion | 73   | 42   | 18   | 5      | 8         |
| 4. inclusivity · i18n · bidi · brand · icon · illustration | 86   | 25   | 36   | 15     | 10        |
| 5a. app frame (사용자 문서용)                              | 62   | 11   | 18   | 29     | 4         |
| 6. content — 빌더 UI / 기본 문구 / 사용자 문구 지원        | 138  | 38   | 70   | 20     | 10        |

컴포넌트 범위 (영역 5b):

| 기준                  | 전체 | 제공 | 작업 트리에만 | 다른 형태 | 부분 | 미제공 |
| --------------------- | ---- | ---- | ------------- | --------- | ---- | ------ |
| S2 export             | 138  | 97   | 8             | 15        | 2    | 13     |
| design-data component | 93   | 53   | 4             | 13        | 3    | 20     |
| Hub 페이지            | 68   | 48   | 4             | 2         | 4    | 10     |

catalog 규모는 등록 type 178 · 팔레트 85 항목이다 (10-30 의 「129 키」 는 낡았다).

## 2. 10-30 뒤 해소된 것

| 10-30 판정                                      | 지금                                                                                                                                     |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 패널이 hex · px 를 commit                       | 토큰 참조를 commit (ADR-298, `apps/builder/src/builder/catalogRuntime/panelTokens.ts:44-47`)                                             |
| light layer-1 = layer-2                         | 기본 Tone 은 S2 값 (`packages/rendering/src/primitives/colors.ts:103-104`). 비기본 Tone 4종에는 남음                                     |
| 행간 옛 고정값 · 서체 Pretendard                | 행간 S2 식 (`primitives/typography.ts:33-36`) · Adobe Clean + CJK locale 서체 (`primitives/spectrumFonts.ts:3-11`)                       |
| spacing 이 CSS 와 Skia 에서 다른 값             | 한 표 (`primitives/spacing.ts:12-30`). control 여백은 S2 의 이름 붙은 형                                                                 |
| Popover 테두리가 모든 모드                      | light 투명 · dark 만 (`primitives/colors.ts:91,180`) — S2 와 일치                                                                        |
| 상태 7축이 DOM 선택자로만 · Canvas focus ring 0 | `paint` 조건 트리 하나를 두 소비자가 읽음 (ADR-297). `catalogStateOutline` 있음 (`catalog/runtime/rulePaint.ts:434-470`)                 |
| 아이콘 lucide 24 고정                           | S2 5단 14 ~ 22 + 터치 1.25 (`primitives/device.ts:40-46`). 글리프는 Search · Cross · Asterisk 만 S2                                      |
| toast 는 message 한 줄                          | Variant · Timeout · Action label 있음. Toast = S2 Toast                                                                                  |
| SideNav · ActionButton(Group) 없음              | 커밋됨 (`c7c88e9c4` · `8586c64bd`)                                                                                                       |
| ActionBar 등 7종 없음                           | **작업 트리에만** 있음 (untracked binding 7 — ActionBar · LabeledValue · LinkButton · RangeSlider · SegmentedControl · SelectBox(Group)) |

## 3. 누락 (미제공)

### 3.1 값 · 토큰

- **pasteboard 층** — S2 `backgroundColor` 5 값 중 유일하게 없다 (`@react-spectrum/s2/style/spectrum-theme.ts:812`, 저장소 검색 0건).
- **browsing / editing context** 개념 · 프리셋 축 없음.
- **Card 기본 shadow · hover 승급** — Card rule 에 boxShadow 0건 (`componentRulesTable.ts` Card 구간). S2 는 `emphasized` → hover · focus · selected 때 `elevated` (`s2/src/Card.tsx:111-126`).
- **Card `density`** (S2 compact · regular · spacious) — binding 에 없다.
- **type style 가족 선택** — 패널 preset 은 크기만 (`propertyUnitPresets.ts:76-94`). Title · Detail 스타일 없음.
- **CJK weight 대체 · body/heading 별 CJK 행간** — 행간 분기는 Label rule 하나. S2 는 `spectrum-theme.ts:586-613, 713-734`.
- border 4 토큰, dragged shadow 적용처 (설치본도 `dragged` 사용처가 없어 낮음).

### 3.2 동작 · attention

- **attention 경고 · 안내 장치** 없음 (검색 0 파일).
- **불결정 ProgressCircle 이 돌지 않는다** — 정지한 호 (`packages/shared/src/components/ProgressCircle.tsx:183-195`). S2 는 회전 keyframes.
- **motion 편집 수단** 없음. S2 에도 motion 토큰이 없어 제안은 보류.

### 3.3 접근성 · 국제화 · 아이콘

- **접근성 검사 · 경고 없음** — alt · Aria Label 입력 칸은 있지만 비어 있어도 알리지 않는다. Publish 경고는 「대상 없는 규칙」 하나. 대비 함수 `meetsWCAG_AA` 는 호출 0 (`apps/builder/src/utils/color/colorUtils.ts:302`).
- **구조 landmark** — page Body 가 `div`. `main` · skip link · h1 개수/수준 검사 0건.
- **320px 확인 수단** — 프레임은 1920 · 768 · 390 (`canvasBreakpoints.ts:21-23`).
- **Canvas RTL** — 엔진에 방향 축 없음. Site 언어 목록에 RTL 언어가 없어 드러나지 않을 뿐이다 (`SitePanel.tsx:45`).
- **방향 아이콘 mirroring** 0건 (S2 는 chevron 을 뒤집는다).
- **pseudo-locale · locale 별 콘텐츠** 없음.
- **Illustration 자산** — 설치본의 linear · gradient 그림 import 0건. lucide 글리프를 96 · 160 으로 키워 stroke 가 8 · 13px 가 된다 (`bindings/Illustration.binding.ts:8-35`).
- **화면 낭독기용 숨김 텍스트** 컴포넌트 없음.

### 3.4 app frame · 컴포넌트 · 지침

- **header 컴포넌트 없음** — layout 프리셋의 빈 `header` slot 만 (`presetDefinitions.ts:143-160`, 하한 60 · 규격 56). S2 설치본에도 header export 가 없어 근거는 design-data guideline 뿐이다.
- **SideNav 의 빠진 부분** — mobile overlay (768), hamburger variant, 단계별 최소 폭 200/240, end section. 항목 `href` 는 문자열이고 page 를 고르는 편집기 · 페이지 트리에서 항목을 만드는 명령이 없다. publish `PageNav.tsx` 는 catalog 밖 220px 고정.
- **zone C** — `renderActionBar` 가 없어 ActionBar 는 단독 노드로만 놓인다.
- **없는 S2 컴포넌트 13** — CollectionCardPreview · AssetCard · UserCard · ProductCard · CloseButton · CustomDialog · FullscreenDialog · DialogContainer · ImageCoordinator · UnavailableMenuItemTrigger · SkeletonCollection · EditableCell · TableFooter.
- **design-only 7** (alert-banner · coach-mark · rating · steplist · tag-field 등) 전부 없음.
- **지침 층 없음** — `PanelMeta` · `PropContract` (`packages/shared/src/catalog/types.ts:209-255`) 에 설명 필드 0. `documentBlocks` 를 읽는 코드 0. 팔레트 카테고리 설명 문자열은 있으나 화면에 나오지 않는다 (10-30 의 「부분」 을 미제공으로 정정).

### 3.5 콘텐츠

- **사용자 문구 지원 (표면 C) 전체** — 문구 lint · 오류 메시지 템플릿 · 글자 수 안내 · alt 작성 안내 0건.
- **기본 문구가 영어뿐** — origin 기본 문구에 한글 0자. 한국어 빌더에서 놓아도 "Text Field" · "Enter text..." 가 들어간다.
- **onboarding** — coach mark · tour · 빈 캔버스 안내 0건.
- **alert banner** 없음 — 저장 실패 · 충돌 · 자동 저장 중지가 헤더 아이콘 tooltip 뿐이다 (`SaveStatusButton.tsx:34-50`).
- **배포 페이지의 emoji · 원시 오류** — "⏳ Loading data…" · "❌ Error: {message}" (`packages/shared/src/i18n/componentStrings.ts:79-87`).
- sample-data 성별 2값 (`packages/sample-data/src/generators.ts:314`).

## 4. 개선 (부분)

### 4.1 S2 와 다른 기본값 · 선택 칠

| 대상                                    | composition                                          | S2 설치본                                |
| --------------------------------------- | ---------------------------------------------------- | ---------------------------------------- |
| Badge 기본 variant                      | `accent` (`bindings/Badge.binding.ts:36`)            | `neutral` (`s2/src/Badge.tsx:207`)       |
| InlineAlert 기본 variant                | `informative` (`bindings/InlineAlert.binding.ts:37`) | `neutral` (`s2/src/InlineAlert.tsx:212`) |
| Tree `selectionStyle`                   | `highlight` (`bindings/Tree.binding.ts:72`)          | `checkbox`                               |
| ButtonGroup `align`                     | `end`                                                | `start`                                  |
| DatePicker `hideTimeZone`               | `true`                                               | `false`                                  |
| Tabs 선택 표시선                        | `var(--accent)` (`document/manualBoxRules.ts:977`)   | `neutral` (`s2/src/Tabs.tsx:352`)        |
| Tree · GridList 선택 항목               | `{color.accent-subtle}`                              | gray-900 7% 혼합                         |
| Table 행 (checkbox 방식)                | accent                                               | gray-900 7%                              |
| Card 선택                               | accent                                               | gray-1000 테두리                         |
| Badge 글자색 (notice · orange · celery) | `{color.white}`                                      | black (`s2/src/Badge.tsx:96-105`)        |

- ListBox 선택 칠 accent 는 사용자 결정 (2026-10-13) 이라 바꾸려면 재확인이 먼저다. Pagination 현재 페이지가 accent Button 인 것은 Hub 의 「내비게이션 선택 accent」 Don't 에 해당한다 (S2 에 Pagination 은 없다).
- Tree `isEmphasized` 가 선택 칠을 바꾸지 않는다 — prop 은 노출돼 있고 rule 의 두 variant 값이 같다.

### 4.2 값

- **색 값 두 벌** — neutral 역할 · surface · Button fill 은 S2 hex, status 4 · named hue 19 · 옛 `accent` / `neutral` / `border` 는 Tailwind 단 (`primitives/semanticPaletteMap.ts:46-108`). ADR-295 가 색을 범위 밖으로 둬서 남았다. Badge 글자색 차이의 원인이기도 하다.
- **container 치수** — Card padding 4 · 8 · 16 · 24 · 32 vs S2 8 · 12 · 16 · 20 · 24, Card radius, Dialog padding 16 ~ 56 vs S2 32 고정.
- **weight** — Heading 600 vs S2 800, Button 500 vs S2 bold.
- **Heading 크기가 본문 사다리** (12 ~ 25). `text-heading-*` 토큰은 rule 소비 0.
- 본문 행간 (Text · Paragraph · Code 가 ui 식, S2 body · code 는 1.5), Code 서체 리터럴, Modal · Sheet · Tooltip shadow (S2 는 없음), Tooltip radius 4 vs 8, ProgressBar track radius.
- **SearchField pill** — 그려지는 radius 는 full 이다 (template 작성값 `radius: 9999`). 정본이 rule 이 아니라 template 리터럴이라는 점만 개선 대상.
- 비기본 Tone 4종에서 layer 구분이 무너진다 (`neutralToSkiaColors.ts:90-93, 119-122`).
- 테마 색 재정의가 두 모드에 같은 hex 를 쓴다. `darkMode: "system"` 은 runtime 에 있는데 패널은 스위치뿐이다.
- `raised` 는 S2 에 없는 여섯 번째 층인데 Fill 피커에 S2 층과 구분 없이 나온다.
- `--gray-25` 별칭이 neutral-50 이다 (S2 gray-25 는 `#ffffff` / `#111111`).

### 4.3 상태 · motion

- disabled 를 opacity 0.38 로 표현하는 rule 이 남아 있다 (S2 는 색 토큰). Button · 필드 · toggle 은 이미 색이다.
- Styles 패널에 상태 선택 UI 가 없다 — `stateRules` 모델 · 두 소비자 · Code view 편집은 있다.
- Canvas 의 hover · pressed · focus 는 상태 샘플 (`displayState`) 에서만 그린다.
- reduced-motion — 생성기가 archetype 4종에만 블록을 낸다 (`CSSGenerator.ts:1261-1275`). 실제 빈 곳은 ProgressBar indeterminate keyframes 와 Badge `isPulsing` 둘. Preview iframe 에는 전역 규칙이 없고 Publish 에는 있어 두 화면이 다르다.
- motion 리터럴 혼재 (`200ms` · `150ms ease` · `130ms ease-in-out`), focus ring 색 변수 혼재 (`--focus-ring` vs `var(--accent)`).
- `forcedColors` 가지 — rule 표 3회 vs S2 207회. 생성 시트의 `forced-color-adjust: auto` 는 CSS 기본값이라 효과가 없다.

### 4.4 접근성 · 국제화 · 아이콘

- 논리 속성 — 생성 시트 논리 92 · 물리 34 (13 시트), 수동 시트 논리 24 · 물리 56, DOM inline 물리 21.
- frame `locale` 에 ar-AE · he-IL 이 있는데 `I18nProvider` 만 감싸고 `dir` 은 쓰지 않는다 (live 미확인).
- 바인딩 행 템플릿 숫자가 `en-US` 고정 (`collections/fieldTemplate.ts:117`), Table 정렬이 브라우저 locale (`tableSort.ts:58`).
- 단독 Icon 의 svg 가 항상 `aria-hidden` 이다. S2 Icon 은 `aria-label` 이 있으면 `role="img"`.
- 글자 토큰이 px 다 (S2 는 rem) — 브라우저 기본 글꼴 크기 설정이 반영되지 않는다.
- chevron · check 등 UI 글리프는 lucide 그대로다.

### 4.5 option 범위

S2 대응이 있는 primitive 104 중 45 type 에 차이가 있다. 대응 형태가 없는 누락: Accordion `density` · `isQuiet`, Card · CardView `density` · `selectionStyle` · `loadingState`, Tabs `labelBehavior`, Dialog `isKeyboardDismissDisabled`, Popover `padding` · `placement` (22 값 중 8), ColorSwatchPicker `density` · `rounding`, Column `showDivider`, Cell `isSticky`, page 루트 `background`. 저장소에만 있는 `XS` 가 12 type 에 있다.

### 4.6 문구 (빌더 UI)

- **toggle** 24건 ("Toggle Navigator Panel" 등). 같은 파일에 맞는 형 "Show rulers" · "Turn on" 이 있다.
- **sentence case** — EN catalog Title Case 352 vs sentence case 1,092. binding label 363 vs 26.
- **한국어 종결 어미 혼재** — 합니다체 275 · 「~하세요」 63 · 한다체 10. 조사 앞 띄어쓰기 70건, 「을(를)」 병기 12건, 같은 개념 두 표기 (테이블 52 vs 표 11).
- **오류 문구** — 표본 42개 중 다음 행동이 있는 것 19개. 예외 문자열을 그대로 넣는 문구 14건. 로그인 화면에 환경 변수 이름이 나온다.
- **첫 화면 · dashboard 가 i18n 밖** (`App.tsx:166,179`), 하드코딩 `aria-label` 40곳, 프로젝트 삭제가 브라우저 `confirm()` (`dashboard/index.tsx:554`).
- 동사 불일치 (Delete 73 · Remove 37 · Clear 20), `&` 4건, 필드 라벨 끝 colon 14건, 상태 기호 "✗".

## 5. 게이트 사각

값이 S2 와 달라도 지금 게이트가 잡지 못하는 방향이다.

| 사각                                | 근거                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| 기본값                              | `d2S2Alignment.static.test.ts` 는 키 · `options` 값만 본다. Badge · InlineAlert 기본값이 통과한다 |
| variant · size 값 집합              | 선택지가 rule 키에서 오고 게이트는 `contract.options` 만 본다 — `XS` 12 type                      |
| S2 가 선언하는데 binding 에 없는 키 | 테스트가 아니라 `deferredReferenceProps.ts` 의 줄어들기만 하는 목록 (380행)                       |
| container padding · radius          | G3 는 「S2 spacing 단 위의 숫자면 통과」. `d3S2Alignment` 에 Card 없음                            |
| weight                              | 대조 게이트 밖                                                                                    |
| 색                                  | ADR-295 범위 밖                                                                                   |
| 선택 칠의 중립 / accent             | 대조 없음                                                                                         |
| reduced-motion 블록                 | 생성기가 archetype 4종만 — 정적 게이트 없음                                                       |
| 문구                                | `sharedActionVocabulary.static.test.ts` 는 문구가 통째로 같을 때만                                |

## 6. Hub 서술과 설치본이 다른 곳

- Calendar 단일 선택: Hub 는 「대개 gray-800」, 설치본은 accent-900. composition 은 accent 라 설치본 기준 제공.
- border: Hub 는 「2px 기본, 1px 는 밀도 높은 곳」, 설치본은 밀도와 무관한 곳에도 1px.
- shadow: Hub 는 4 스타일, 설치본 style macro 는 3개 (emphasized · elevated · dragged).
- static color palette · reusable structure 토큰 (`container-padding-*`) 은 Hub · design-data 에 있고 설치본 macro 에는 없다.
- SideNav 접기 버튼 이름: Hub 「Show / Hide menu labels」, 설치본 문자열은 「Expand / Collapse side panel」. composition 은 설치본과 같다.

## 7. 정해 주셔야 할 것

1. **기본값 · 선택 칠 정렬** (§4.1) — 기존 문서의 모양이 바뀐다. ListBox 선택 칠은 10-13 결정과 충돌한다.
2. ~~색 값을 S2 로 옮길지~~ → **결정 (2026-11-07)**: 테마 색 토큰은 accent 와 tone 두 축에서 결정된다 (§9.6). 남은 물음은 status · named hue 의 처리와 Tone 팔레트의 출처다.
3. **지침 층** (§3.4) — catalog 에 설명 자리를 둘지, design-data 를 빌드 때 고정해 연결할지.
4. **접근성 검사** (§3.3) 와 **attention · 문구 lint** (§3.2 · §3.5) 를 같은 Audit 표면으로 묶을지.
5. **RTL** — 언어 목록에 RTL 을 넣기 전에 Canvas 방향 축이 먼저다.
6. **기본 문구의 locale** — origin 기본 문구를 빌더 언어를 따르게 할지, 사이트 언어를 따르게 할지.
7. **Adobe Clean (Typekit)** 을 사용자 사이트 기본 서체로 싣는 조건 확인.

## 8. 확인하지 못한 것

- 브라우저 실측 전부.
- 작업 트리의 새 컴포넌트 7종이 실제로 그려지는지.
- Tailwind 단 status · hue 색의 layer 별 대비 계산.
- `validation.*` · `messages.*` · `errors.*` · `debugger.*` 메시지 66건의 「소비 0」 은 검색 상한이다.
- design-data 93 스키마의 `options` 단위 대조.
- disabled opacity rule 수 — 보고는 39개, rule 표의 `0.38` 은 14회다. 상수 경유가 있어 개수는 확정하지 않았다.

## 9. catalog theme 층 대조 (2026-11-07 추가 — 사용자 지시 「color · typo · spacing 은 catalog theme 부터」)

대상: 문서 `ThemeEntry` · `TokenEntry` (`document/types.ts`), resolver `runtime/resolveThemeSnapshot.ts` · `neutralToSkiaColors.ts` · `tintToSkiaColors.ts` · `radiusScaleToSkia.ts`, seed 맵 `packages/rendering/src/primitives/{colors,typography,spacing,radius,border,shadows,device}.ts`, Themes 패널 (`panels/themes/`). S2 값은 설치본 `@react-spectrum/s2/style/dist/spectrum-theme.mjs` 의 `baseColors` · 역할 ref · `fontWeight` · `boxShadow` 에서 읽었다.

### 9.1 값이 S2 와 같은 것 (default Tone 에서)

base · layer-1 · layer-2 · elevated · disabled · disabled-content · border-disabled · neutral-content (gray-800) · neutral-subdued (gray-700) · field-placeholder (gray-600) · selection-accent · accent-fill (blue-900/1000) · focus-ring (blue-800) · overlay-backdrop (transparent-black-500 = 0.44) · popover 배경 (layer-2). 글자 크기 · 행간 식, control 높이 5단, 아이콘 5단, spacing 9단, radius sm/md/lg/xl/full, border 0/1/2, 그림자 3단 (dark ×3 포함 전 레이어 일치). 이 범위는 `d3S2Alignment` 게이트가 잡는다 (색은 제외).

### 9.2 값이 다른 것 — 색

| 토큰 (rule 사용 수)                 | composition seed (light / dark)                        | S2 1.8.2 (light / dark)                                   |
| ----------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| `neutral` (158 — 글자 기본)         | Tailwind neutral-900 `#171717` / neutral-100           | body = gray-800 `#292929` / `#dbdbdb`                     |
| Heading 글자                        | `{color.neutral}`                                      | heading = gray-900 `#131313` / `#f2f2f2`                  |
| detail · code 글자 역할             | 없음 (전부 `neutral`)                                  | detail gray-600 `#717171` · code gray-800                 |
| `neutral-subtle` (57)               | Tailwind neutral-200 `#e5e5e5` / neutral-700 `#404040` | gray-100 `#e9e9e9` / gray-300 `#393939`                   |
| `border` (25) · `border-hover`      | Tailwind neutral-300 `#d4d4d4` / neutral-400           | S2 에 범용 border 역할 없음 (컴포넌트마다 gray-300 · 400) |
| `negative` (23)                     | Tailwind red-500 `#fb2c36` / red-400                   | negative-900 `#d73220` / negative-800 `#df3422`           |
| `informative` (21)                  | Tailwind blue-600 `#155dfc` / blue-500                 | informative-900 `#3b63fb` / 800 `#4069fd`                 |
| `positive` (21)                     | Tailwind green-600 `#00a63e` / green-500               | positive-900 `#05834e` / 800 `#068850`                    |
| `notice` (17)                       | Tailwind orange-600 `#f54900` / orange-500             | notice-900 `#c24e00` (바탕) · notice-600 (visual) / 900   |
| `*-subtle` (status 4 · hue 19)      | Tailwind 100 / 900                                     | S2 200 / 300 (예: negative-subtle `#ffebe8` / `#57110a`)  |
| named hue 19 (Badge 등 각 6 ~ 9)    | Tailwind 500 ~ 700 (purple `#9810fa` …)                | S2 bg 900 (purple-900 `#9a47e2` …)                        |
| `accent` (8) · `accent-subtle` (13) | tint hue 의 oklch 대비 탐색 (ADR-290) — S2 hex 와 다름 | accent-900 `#3b63fb` · accent-200 `#e5f0fe`               |
| `pasteboard`                        | **없음**                                               | gray-100 `#e9e9e9` / gray-25 `#111111`                    |
| `raised` (7)                        | Tailwind gray-50 `#f9fafb` — Spectrum 역할 없음        | —                                                         |

- 색 seed 두 벌 (S2 hex ↔ Tailwind 단) 의 원인은 `colors.ts` 가 `semanticPaletteMap.ts` (Tailwind 좌표) 와 S2 손 값을 섞어 두고, `neutralToSkiaColors.ts` `DEFAULT_SURFACE_KEYS` 에 `neutral` · `neutral-subtle` · `neutral-hover/pressed` · `border` · `border-hover` 가 **없어** default Tone 에서도 Tailwind 단이 남는 것이다. Badge 글자색이 S2 와 반대인 것 (§4.1) 도 같은 뿌리다.
- **Tone ≠ neutral 이면 S2 역할값이 전부 사라진다**: `LIGHT_MAP` 이 layer-1 = layer-2 = 50, `DARK_MAP` 이 layer-1 = layer-2 = elevated = 800 이라 Tone 을 바꾸면 field 바탕 (`layer-2`, 20 rule) 과 section 바탕 (`layer-1`, 19 rule) 이 같은 색이 되고, dark 에서는 elevated 까지 한 값이다. S2 는 base gray-25 · layer-1 gray-50 · layer-2/elevated gray-75 로 가른다.

### 9.3 값이 다른 것 — 글자

- **heading 사다리 소비 0**: `text-heading-xs … 3xl` 7단 (S2 heading step 2 ~ 12, 사용자 결정 3) 이 `typography.ts` 에 있지만 rule · manualBoxRules · origin library 어디서도 읽지 않는다. Heading rule 은 ui 사다리 (M = `text-base` 16px · 600) 다. S2 heading M = step 4 (22px) · extra-bold 800 (CJK 700) · gray-900.
- **weight 역할 없음**: S2 `fontWeight.heading` 800 · `title` 700 · `detail` 500 (CJK bold 500 · extra-bold 700 분기) ↔ composition `fontWeight` 맵은 normal/medium/semibold/bold 상수이고 rule 리터럴 400 ×15 · 500 ×17 · 600 ×7 · 700 ×3. Title · Detail · Body type 없음 (Text · Paragraph · Heading · Code · Kbd · Label 뿐).
- **역할 글자색 없음**: S2 `font()` 매크로는 heading/body/detail/code 색을 함께 정하지만 composition 은 전부 `{color.neutral}`.
- **CJK 행간**: S2 는 ui · heading · title · detail 의 `:lang(ja, ko, zh)` 행간을 `line-height-200` 로 올리고 body 1.7 — composition `localeTypography` 는 Label 1개 rule (1.5) 뿐. 사이트 기본 언어가 ko 인데 Text · Button 등은 Latin 식 (14 → 18).
- letter-spacing · text-transform: theme 축 · rule 사용 0 (S2 heading/detail letter-spacing · detail uppercase 가 있다).
- Themes 「Size 14/16/18 · Line Height」 는 root 상속값 (`base-font-size`) 만 바꾼다 — 컴포넌트 단계 기준 (`--catalog-token-font-base` 14, S2 `--s2-font-size-base`) 을 바꾸는 손잡이는 없다.
- 서체 locale: ja · zh 분기 ✓, ar · he 없음 (RTL 과 같은 줄).

### 9.4 spacing · radius · border

- spacing 9단은 S2 단 안이고 한 표 ✓. S2 18단 중 20 · 28 · 36 · 44 · 56 · 64 · 80 · 96 은 이름이 없어 rule 이 리터럴로 쓴다 — rule 의 `{spacing.*}` 참조는 19회뿐이고 나머지 padding · gap 은 숫자다 (ADR-295 「S2 고정 값」 분류). 상대 간격 4종 (`pill` · `edge-to-text` · `text-to-*`) 은 rule 에 16회 ✓. Hub 의 layout spacing ↔ component spacing 구분은 없다 (단일 표 — S2 도 같다).
- radius: S2 4단 ✓ + 저장소 xs 2 · 2xl 24. 테마 Radius scale (×0 ~ ×2) 은 composition 확장 — `none` 도 `full` 은 그대로라 pill 버튼은 둥근 채다.
- border: S2 `border-width-400` (4px) 없음.

### 9.5 theme 모델 자체

- **dark 2벌이 아니다**: 토큰 override (`color.<key>`) 는 light · dark 에 같은 값 (`resolveThemeSnapshot.ts` 머리말 「§6 유보」). Spectrum 은 모든 색 토큰이 light/dark 쌍이다.
- **`system` 색 모드**: `ThemePreset.darkMode` 에 있으나 Themes 패널 토글은 light ↔ dark 뿐 (UI 0). `prefersDark()` 는 테마 상태 계산 때 `matches` 1회 — `change` listener 없어 OS 전환이 Preview · Publish 에 닿지 않는다 (코드 판독).
- **노드별 테마**: `NodeThemeOverride { mode, tint }` 가 타입 · resolver · 검증에 있으나 빌더 패널 UI 0. S2 Provider 의 `colorScheme` · `background` (layer 선언 → `auto` static color 대비) 중첩에 해당하며, background layer 를 컨테이너가 선언하는 개념은 없다.
- **새 이름 토큰 불가**: Themes 「Tokens」 는 seed 키 select 만 (hover/pressed 제외) — `color.brand-2` 같은 사용자 토큰은 resolver 가 받아도 UI 가 없다. 값 입력은 hex6 텍스트뿐.
- Styles 색 피커 Theme 팔레트 (`THEME_PALETTE_GROUPS`) 20개 — named hue 19 · `on-accent` · `disabled` 는 토큰은 있지만 고를 수 없다.
- 게이트: `d3S2Alignment` 는 치수만, `themeColorParity` 는 DOM = Skia 만 — 색 seed 가 S2 와 갈려도 잡는 게이트가 없다 (ADR-295 가 색을 범위 밖으로 둔 결과).

### 9.6 결정 (2026-11-07) — 테마 색 토큰은 accent 와 tone 으로 결정된다

사용자 결정 원문: 「accent 와 tone 으로 theme color token 이 결정되어야 한다」.

색 토큰 172 키를 실행값으로 갈랐다 (2026-11-07 재집계 — `resolveThemeSnapshot` 을 tint 10 × Tone 5 = 50 조합, light · dark 로 실행해 키마다 값이 바뀌는지 판정. 사용자 hex 5종도 실행). 처음 표 (합 160) 는 코드를 읽어 분류한 것이라 이 표로 교체했다.

| 실측 결과                | 토큰                                                                                                                                                                                                                                                                  | 키      | rule 참조 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------- |
| accent 축만 따름         | accent · -hover · -pressed · accent-subtle · accent-fill(-hover) · chart-accent 1 ~ 4                                                                                                                                                                                 | 10      | 29        |
| accent · tone 둘 다 따름 | accent-content(-hover) · selection-accent(-hover)                                                                                                                                                                                                                     | 4       | 25        |
| tone 축만 따름           | neutral 계열 16 (neutral · -subtle · -hover · -pressed · -subdued · -content(-hover) · -fill(-hover · -pressed) · -surface(-hover) · -outline(-hover) · on-neutral · field-placeholder) · base · layer-1 · layer-2 · elevated · disabled · border(-hover · -disabled) | 24      | 432       |
| 고정 — accent 쪽         | `focus-ring` (모든 tint 에서 `#4b75ff` / `#4069fd`) · `on-accent` (`ON_ACCENT` `#ffffff` — ADR-290 이 accent 를 이 값 기준으로 탐색)                                                                                                                                  | 2       | 7         |
| 고정 — tone 쪽           | raised · popover-outline · popover-background · collection-item-focus · picker-\* 6 · disabled-content                                                                                                                                                                | 11      | 31        |
| 고정 — status            | negative · informative · positive · notice (+subtle · strong · hover · pressed · strong-hover · strong-pressed) 28 · selection-negative(-hover) · negative-fill(-hover) · on-negative 5                                                                               | 33      | 111       |
| 고정 — named hue         | 19 hue × (기본 · subtle · hover · pressed)                                                                                                                                                                                                                            | 76      | 174       |
| 고정 — chart-categorical | 1 ~ 8                                                                                                                                                                                                                                                                 | 8       | 8         |
| 고정 — 상수              | transparent (332) · white (28) · black (4) · overlay-backdrop (2)                                                                                                                                                                                                     | 4       | 366       |
| **합**                   | 축을 따름 38 · 고정 134                                                                                                                                                                                                                                               | **172** | **1183**  |

읽는 법:

- 키 수로는 고정이 78 % 지만 그 대부분은 status · named hue 109 키다. rule 참조는 축을 따르는 키가 486 (41 %), 상수가 366 (31 %), status · named hue 가 285 (24 %), 나머지 고정이 46 (4 %) 이다. 172 키 중 64 키는 rule 참조가 없다.
- **처음 표와 달라진 것**: `selection-accent` · `accent-fill` 은 「고정」 이 아니라 축을 따른다 — tint = blue 일 때만 S2 hex 이고 다른 9 tint 와 사용자 hex 에서는 파생된다. `DEFAULT_SURFACE_KEYS` 19 중 18 도 Tone 을 따르며, `disabled-content` 만 어느 Tone 에서도 바뀌지 않는다. `on-accent` 는 축 출력이 아니다.
- **축을 따라도 기본값이 사다리 밖인 것**: default Tone (`neutral`) 에서 tone 키 24 중 18 은 값이 Tailwind neutral 사다리에 없다 (S2 hex 로 덮음). 기본 테마만 축의 다른 함수로 계산되는 셈이다. accent 쪽은 tint = blue 의 `selection-accent` · `accent-fill` 이 같은 경우다.
- **층 붕괴**: 비기본 Tone 4종 전부에서 light `layer-1` = `layer-2`, dark `layer-1` = `layer-2` = `elevated` 다 (Tone `neutral` 만 층이 갈린다).
- 범위: 사용자 hex 는 5종만 실행했고 (바뀐 키 14 = 위 accent 쪽 14 와 같음), 문서 token 델타 · `NodeThemeOverride` 는 넣지 않았다. 원자료: `.agent/runs/2026-11-07-spectrum-check/color-axis-recount.json`.

결정에 맞추려면 resolver 가 한 파이프라인이 된다: **tone → gray 사다리 → 역할 map (S2 역할 ref: base 25 · layer-1 50 · layer-2 25|75 · pasteboard 100|25 · elevated 25|75 · neutral 800 · subdued 700 · disabled 100 · 400 · border …)**, **accent → (c, h) → tone 바탕에 대해 역할 탐색** (focus-ring · selection · fill 포함), seed 맵 `colors.ts` 는 손 값이 아니라 기본 preset 의 resolver 결과. 게이트는 「모든 `{color.*}` 가 두 축 함수의 출력」 을 정적으로 본다.

남은 결정 2개:

1. **status 4 · named hue 19** — hue 는 고정이므로 「고정 (c, h) + tone 바탕 대비 탐색 (accent 와 같은 식)」 으로 갈지, Spectrum 단계값 그대로 둘지.
2. **Tone 팔레트의 출처** — Tailwind 5종 (25 · 75 단 없음) 을 유지할지, S2 gray 13단을 기본 Tone 으로 넣고 역할 map 을 S2 ref 로 할지. 전자는 layer 역할을 Tailwind 단에 다시 배정해야 하고, 후자는 Tone 5종을 S2 단 모양으로 다시 만들어야 한다.

**결정 보강 (2026-11-07, 사용자 원문)**: 「accent (초기값) · tone (초기값) 으로 Spectrum Hub 의 color token 들이 나와야 한다. 이유 → theme 에서 accent · tone 변경만으로 Spectrum Hub 의 규칙을 지키면서 다양한 theme color 를 쉽게 제공하기 위함이다.」

이 문장이 위 남은 결정 2개를 다음과 같이 정한다:

| 항목                                                                   | 정해진 것                                                                                                                                                                                                                                                                                                                                | 근거                                                                                       |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 기본 preset 의 값                                                      | tint · Tone 초기값에서 resolver 출력 = Spectrum 토큰 값 (design-data 3.8.2) 과 **동일** — gray 13단 · blue 16단 · status 4 · named hue 사다리 · 역할 alias map 전부                                                                                                                                                                      | 「초기값으로 Hub 의 color token 들이 나와야 한다」                                         |
| 결정 2 (Tone 팔레트 출처)                                              | 기본 Tone = Spectrum gray 13단 (25 ~ 1000). Tailwind neutral 은 기본값이 될 수 없다. 다른 Tone 4종도 같은 모양 (13단 · 같은 역할 map) 으로 다시 만든다 — Tailwind 11단 표는 출처에서 빠진다                                                                                                                                              | 기본값이 Hub 값이어야 하고, 축을 바꿔도 「규칙」 (사다리 · 역할 map · 대비) 이 유지돼야 함 |
| 결정 1 (status · named hue)                                            | 기본 preset 에서는 Spectrum 단 값 그대로 (negative = red-900 등). Tone 을 바꾸면 그 Tone 바탕에 대해 Hub 의 대비 규칙 (글자 4.5 · 활성 non-text 3:1, 단별 목표 대비) 을 만족해야 한다 — 값을 고정해 두고 검사만 할지, accent 와 같은 식으로 바탕에 맞춰 다시 탐색할지는 ADR 이 정한다. 어느 쪽이든 **초기값에서는 Hub 값과 같아야** 한다 | 「규칙을 지키면서 다양한 theme color」                                                     |
| accent 쪽 고정 2 (`focus-ring` · `on-accent`)                          | accent 축에서 파생 — 초기값에서는 Hub 의 `focus-indicator-color` = blue-800, 흰 글자                                                                                                                                                                                                                                                     | 「accent 변경만으로」                                                                      |
| tone 쪽 고정 11 (raised · picker-\* · popover-\* · disabled-content …) | tone 축에서 파생 (Hub 역할이 있으면 그 alias, 없으면 사다리 단 지정) — `raised` 는 Hub 역할이 없으므로 제거 또는 layer 역할로 흡수                                                                                                                                                                                                       | 「tone 변경만으로」                                                                        |
| 게이트                                                                 | 정적 1: 기본 preset `resolveThemeSnapshot` 의 모든 `{color.*}` 가 design-data 토큰 값과 같다 (oracle fixture — `adr295-s2-oracle.json` 과 같은 방식). 정적 2: 모든 `{color.*}` 가 두 축 함수의 출력이다. 실행 3: 50 preset 전부에서 Hub 대비 규칙 PASS                                                                                   | 기본값 동일 + 규칙 유지 두 조건을 각각 잰다                                                |

ADR 이 새로 정할 것은 **비기본 축의 사다리 생성 방식** 하나다 — Hub 는 Leonardo (key color + 단별 목표 대비) 로 만들고, composition 은 ADR-290 oklch 탐색을 쓴다. 기본값에서 Hub 값을 그대로 내려면 기본 사다리는 표 (design-data 값) 로 두고, 축이 바뀔 때만 같은 단별 목표 대비로 생성하는 구성이 가장 단순하다. 그때 「같은 목표 대비」 는 Hub colors 페이지의 단별 대비 (blue 1.06 ~ 19.5:1) 를 그대로 쓴다.

### 9.7 세 토큰 체계 대조 (2026-11-07 — Hub colors · grays / S2 1.8.2 설치본 / composition theme)

> 2026-11-07 사용자 정정 두 번: ① S2 는 style macro 다 (§9.8) · ② 토큰이 실제로 있는 곳은 Spectrum Hub (design-data) 와 composition 둘이고 composition 은 S2 를 참고해 토큰화한 것이다 — 두 토큰 체계의 재조사 대조표는 **§9.9** 가 정본이다. 아래 §9.7 표는 값 대조 기록으로만 남긴다.

Hub 는 로컬 정리본 §1 · §2 + 페이지 재조회, S2 는 `style/dist/spectrum-theme.mjs` 의 `baseColors` · 역할 map, composition 은 `resolveThemeSnapshot` 실행값 (blue · neutral).

#### 구조

| 층               | Spectrum Hub                                                                              | S2 1.8.2                                                                                                               | composition                                                                                                                                                                     |
| ---------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| gray 원시 사다리 | neutral gray 11단 25 ~ 1000, theme 마다 한 벌, gray-25 = 기본 배경, dark theme 하나       | `gray-25 · 50 · 75 · 100 ~ 1000` 13단, light/dark 2벌                                                                  | Tone 5종 (Tailwind slate · gray · zinc · neutral · stone) 11단 50 ~ 950 → `--color-neutral-N`; 25 · 75 없음; S2 gray 값은 손 hex 19개 (`DEFAULT_SURFACE_KEYS`, default Tone 만) |
| hue 원시 사다리  | 15 hue × 16단 100 ~ 1600 (Leonardo, key color + 목표 대비; blue 1.06 ~ 19.5:1)            | 18 hue × 16단 100 ~ 1600, light/dark 2벌                                                                               | Tailwind 26 family × 11단 50 ~ 950 (light = dark 한 hex) + accent 한 hue 의 `--tint-100 ~ 1600` 16단 (oklch 상대색, DOM 전용)                                                   |
| 의미 별칭 사다리 | 없음 (static · categorical palette 언급)                                                  | `accent · informative · negative · notice · positive-color-100 ~ 1600` = hue 별칭 (blue · blue · red · orange · green) | 없음 — status 는 `semanticPaletteMap` 의 (family, step) 좌표 한 쌍                                                                                                              |
| 투명 · 오버레이  | static white / black                                                                      | `transparent-white · black 25 ~ 1000`, `overlay-25 ~ 1000` (`--s2-container-bg` 기준 lch)                              | `white` · `black` · `transparent` · `overlay-backdrop` 1개                                                                                                                      |
| 역할 (alias)     | background layer 5 · gray 역할 (배경 25 ~ 75 · 낮은 대비 100 ~ 300 · 높은 대비 800 ~ 900) | `color` 11 · `backgroundColor` 60+ · `borderColor` 2 · `outlineColor` focus-ring · `fill`                              | `lightColors` 172 키 (이름 기준 분류: accent 11 · neutral 계열 30 · surface 5 · chart 16 · 상수 3 · status/hue 107)                                                             |
| component 층     | 3층 (global → alias → component)                                                          | 토큰 층 없음 — 컴포넌트마다 `style({...})` 호출 안의 역할 이름 + 조건 (§9.8)                                           | 별도 층 없음 — `picker-*` · `popover-*` · `field-placeholder` · `collection-item-focus` 가 alias 맵 안                                                                          |

#### 역할 값 (light / dark)

| 역할                                       | Hub 지침                         | S2 ref → hex                                                                                | composition (default Tone) → hex                                                          | 판정               |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------ |
| base                                       | gray-25 기본 배경                | gray-25 `#ffffff` / `#111111`                                                               | 같음                                                                                      | ✓                  |
| layer-1 · layer-2 · elevated               | background layer 25 · 50 · 75    | gray-50 `#f8f8f8` / `#1b1b1b` · gray-25 / gray-75 `#ffffff` / `#222222` · gray-25 / gray-75 | 같음 (Tone ≠ neutral 이면 layer-1 = layer-2)                                              | ✓ / Tone 깨짐      |
| pasteboard                                 | 〃                               | gray-100 / gray-25                                                                          | 없음                                                                                      | 누락               |
| raised                                     | —                                | —                                                                                           | Tailwind gray-50 `#f9fafb` / `#202023`                                                    | Spectrum 역할 없음 |
| 본문 글자                                  | gray-800 · 900 높은 대비         | body gray-800 `#292929` / `#dbdbdb`                                                         | `neutral` (158 rule) Tailwind `#171717` / `#f5f5f5`; `neutral-content` (8) `#292929`      | 다름               |
| 제목 글자                                  | 〃                               | heading gray-900 `#131313` / `#f2f2f2`                                                      | `{color.neutral}`                                                                         | 다름               |
| 보조 글자                                  | —                                | neutral-subdued gray-700 `#505050`; detail gray-600 `#717171`                               | `neutral-subdued` ✓ (default 만); detail 없음                                             | ✓ / 누락           |
| disabled 글자 · 배경                       | —                                | gray-400 `#c6c6c6` / `#444444`; gray-100 `#e9e9e9` / `#2c2c2c`                              | 같음                                                                                      | ✓                  |
| 낮은 대비 배경                             | gray-100 → 200 → 300             | neutral-subtle gray-100 / gray-300 `#e9e9e9` / `#393939`                                    | `neutral-subtle` Tailwind `#e5e5e5` / `#404040`                                           | 다름               |
| 테두리                                     | gray-300 (text field)            | 범용 역할 없음                                                                              | `border` Tailwind `#d4d4d4` / `#404040`                                                   | 다름               |
| 진한 버튼                                  | gray-800                         | neutral bg gray-800                                                                         | `neutral-fill` 같음                                                                       | ✓                  |
| accent 배경                                | brand key color                  | accent-900 `#3b63fb` / accent-800 `#4069fd`                                                 | `accent` 탐색 `#3660f0`; `accent-fill` `#3b63fb` / `#345bf8` (tint = blue 일 때만 S2 hex) | 파랑 2종           |
| focus ring                                 | 활성 3:1                         | blue-800 `#4b75ff` / `#4069fd`                                                              | 같은 값 고정 (tint 무관)                                                                  | 값 ✓ · 축 ✗        |
| negative · informative · positive · notice | —                                | 900 / 800 (`#d73220` · `#3b63fb` · `#05834e` · `#c24e00`)                                   | Tailwind 500 ~ 600 / 400 ~ 500 (`#fb2c36` · `#155dfc` · `#00a63e` · `#f54900`)            | 다름               |
| status subtle                              | two-tone 배경 100                | 200 / 300 (negative `#ffebe8` / `#571107`)                                                  | Tailwind 100 / 900 (`#ffe2e2` / `#82181a`)                                                | 다름               |
| named hue 배경                             | static palette · 흰/검 글자 규칙 | 900 (purple `#9a47e2` / `#ad69e9`); yellow 400 / 1100                                       | Tailwind 600 / 500 (purple `#9810fa` / `#ad46ff`); yellow 500 / 400                       | 다름 (팔레트 자체) |
| gray badge                                 | —                                | gray-500 `#8f8f8f` / gray-600 `#8a8a8a`                                                     | Tailwind neutral-500 `#737373` / 400 `#a1a1a1`                                            | 다름               |
| chart categorical                          | categorical palette              | S2 없음                                                                                     | Spectrum 8색 hex                                                                          | ✓                  |

#### 생성 · 상태 · 대비

| 항목            | Hub                                                 | S2                                                                                                                | composition                                                                                   |
| --------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 값의 생성       | Leonardo: key color + 목표 대비 → 16단              | `@adobe/spectrum-tokens` JSON (Hub 와 같은 출처) → style macro 가 빌드 시 `light-dark(hex, hex)` 로 인라인 (§9.8) | Tailwind 복사 + S2 손 hex + accent 만 oklch 탐색 (ADR-290)                                    |
| hover · pressed | gray 100 → 200 → 300 진행                           | `nextColorStop` = 같은 사다리 다음 단                                                                             | accent · status · hue = 검정 85 % / 75 % 혼합; neutral = Tone 단계; `neutral-fill-hover` 손값 |
| 대비 보장       | 글자 4.5 · 활성 non-text 3:1 · 토큰이 layer 위 보장 | 값에 내장                                                                                                         | `accent` · `accent-content` 만 탐색; 나머지 검사 없음                                         |
| light / dark    | 모든 토큰 2벌 · dark 하나                           | `light-dark()` 2벌                                                                                                | preset 파생 2벌 · override 1값 · Tailwind 1값                                                 |
| 테마 축         | brand key color                                     | colorScheme light · dark · auto, accent 고정                                                                      | tint 10 + hex, Tone 5, light · dark (system 타입만), 노드 themeOverride (UI 0)                |
| 금지            | 자기 색 · 함수 변형 · 색만의 의미                   | —                                                                                                                 | 사용자 hex 허용 (accent 만 탐색)                                                              |

결론: Hub 의 「gray 사다리 + hue 사다리 → alias map」 이 §9.6 결정 (accent · tone 두 축) 과 같은 모양이다. composition 에 없는 것은 Spectrum 모양의 gray 13단 · hue 16단 사다리와 alias 가 사다리 단을 가리키는 map 이고, 그 map 은 S2 `backgroundColor` · `color` 역할 표로 이미 코드에 있다.

### 9.8 정정 — S2 는 토큰 체계가 아니라 style macro 다 (2026-11-07, 사용자 지적 「react-spectrum(s2) 는 style-macro 이다」)

§9.7 은 S2 를 Hub · composition 과 나란한 「세 번째 토큰 체계」 로 두었는데, 설치본 (`@react-spectrum/s2/style/`) 을 읽으면 그렇지 않다. 출처는 둘이고 소비 방식이 둘이다.

| 단계          | S2 style macro (설치본 1.8.2)                                                                                                                                                                                                                                                                                                                                                         | composition                                                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 값의 출처     | `style/tokens.ts` 가 `@adobe/spectrum-tokens/dist/json/variables.json` 을 import — design-data 와 같은 저장소 (`adobe/spectrum-design-data`) 의 패키지. `colorToken()` 이 `sets.light.value` / `sets.dark.value` 를, 별칭 토큰은 `ref` 를 읽는다. 패키지 의존은 빌드 때 풀려 설치본에는 JSON 이 없다 (`dist/spectrum-theme.mjs` 에 값이 박혀 있음)                                    | `packages/rendering/src/primitives/colors.ts` 손 hex + `generated/tailwindPalette.ts` + resolver 파생                                                                                              |
| 사다리 → 역할 | `spectrum-theme.ts` `baseColors` = `colorScale('gray' · 18 hue · accent-color …)` + `simpleColorScale('transparent-*')` + `generateOverlayColorScale()`; `createTheme({properties: {backgroundColor: {accent: weirdColorToken(...), base: colorToken('background-base-color'), …}}})` 가 속성마다 허용 이름 → 토큰을 **macro 실행 시점** 에 고정                                      | `resolveThemeSnapshot(preset)` 이 **실행 시점** 에 tone · tint 입력으로 역할 값을 계산 → `cssVars` (DOM) · `installThemeMaps` (Skia)                                                               |
| 출력          | `style({...})` 는 빌드 때 atomic class 로 컴파일 — 값은 `#292929` 또는 `light-dark(#292929, #dbdbdb)` **인라인**, `rgb(from … / N%)` 로 불투명도. 토큰용 CSS 변수는 없다 (`--s2-container-bg` 하나 — overlay · `autoStaticColor` 의 lch 식 기준, Provider 가 base/layer-1/layer-2 로 설정, Card · Popover · Modal 도 자기 값을 설정). 사용자 정의 `--var` 는 `type` 선언 뒤 참조 가능 | 역할 변수 `--<role>` (`var(--accent)`, `lightColors` 172 키) + `--color-neutral-N` 11 + `--tint-N` 16 을 `:root` light/dark 블록으로 내고 생성 CSS 가 `var()` 로 참조; Skia 는 map 직접 읽음       |
| 상태          | `baseColor('gray-100')` → `{default, isHovered: 'gray-100:hovered', isFocusVisible: ':focused', isPressed: ':pressed'}`; `:hovered` 접미는 `nextColorStop` = **같은 사다리 다음 단** (`gray-100` → `gray-200`). 사다리 밖 이름은 「does not support states」 오류                                                                                                                     | `*-hover` · `*-pressed` 토큰을 resolver 가 미리 계산 (accent · status = 검정 85 % / 75 % 혼합, neutral = Tone 단계) — 소비자는 상태별 토큰 이름을 고른다                                           |
| 조건          | 객체 키 = 조건: `default` · `isHovered` · `isSelected` · `isEmphasized` · `forcedColors` · `touch` · breakpoint · `colorScheme`. **같은 층의 조건은 배타적이고 순서가 우선순위** (마지막 일치가 이김), CSS 조건마다 `@layer _.a, _.b …` 우선순위를 올려 specificity 충돌 없이 보장                                                                                                    | ADR-297 `paint` 조건 트리 — 키 순서 = 우선순위, Canvas 는 평가 (`resolveCatalogPaint`), CSS 는 cascade 로 compile (`compileConditionTree`) — **같은 모양** (`.claude/rules/ssot-hierarchy.md` §D3) |
| light / dark  | `light-dark()` 한 선언 + `color-scheme` (Provider `colorScheme` light · dark · `light dark`, `setColorScheme()`). 토큰은 항상 2벌, 선택은 브라우저                                                                                                                                                                                                                                    | `:root` light 블록 / dark 블록 두 벌 (`darkMode` preset), `system` 은 `prefersDark()` 1회 읽기                                                                                                     |
| 테마 축       | 없음 — accent 는 `accent-color-*` = blue 별칭으로 JSON 에 고정, gray 사다리도 고정. 바꾸려면 spectrum-tokens 를 바꿔 다시 빌드                                                                                                                                                                                                                                                        | tint 10 + hex · Tone 5 · darkMode 3 — 실행 시점 입력                                                                                                                                               |
| 색 함수       | `color('gray-800')` · `color('accent-900/50')` · `lightDark(a, b)` · `colorMix(a, b, %)` (srgb) · `linearGradient()` · `focusRing()` · `autoStaticColor(bg)` (lch 밝기 49.44 기준 흑/백 자동)                                                                                                                                                                                         | 없음 — 토큰 이름만 (`{color.accent}`), 혼합은 resolver 안에서만 (ADR-297: 소비자 쪽 color-mix · opacity 파생 금지)                                                                                 |

**§9.7 에 대한 정정 세 가지**:

1. 「세 토큰 체계」 가 아니라 **출처 둘** (spectrum-tokens JSON ⟷ composition seed) 과 **소비 둘** (S2 빌드 시 인라인 ⟷ composition 실행 시 변수) 이다. design-data 3.8.2 의 light primitive 337 중 S2 에 같은 이름이 있는 301 은 값이 전부 같고 (36 은 `transparent-neutral*` 로 S2 에 그 이름이 없음, dark · alias 는 미대조), 비교의 실체는 「spectrum-tokens 값 ↔ composition 값」 과 「style macro 방식 ↔ resolver 방식」 둘이다.
2. §9.7 결론의 「S2 `backgroundColor` · `color` 역할 표를 가져온다」 는 **표의 내용** (역할 → 사다리 단) 만 옮길 수 있다는 뜻이다. S2 의 표는 macro 실행 시점에 고정되고 테마 입력이 없으므로, composition 이 §9.6 결정 (accent · tone 축) 을 지키려면 그 표를 `resolveThemeSnapshot` 의 **실행 시점 함수** (tone → gray 사다리 → 역할, accent (c,h) → 역할) 로 옮겨야 한다. 표를 S2 처럼 상수로 복사하면 Tone 축이 다시 죽는다 (지금 `DEFAULT_SURFACE_KEYS` 19 개가 그 상태).
3. **composition 이 이미 S2 와 같은 모양으로 둔 것**: 조건 트리 (ADR-297 = style macro 조건 순서) · 치수 식 (ADR-295 = `size()` · `space()` · `fontRelative()` 의 `scale` 배율 · rem · em 형). 색만 아직 「값 복사」 단계라 §9.6 의 ADR 대상이 색으로 좁혀진다.

**가져올 수 있는 것 / 없는 것**:

- 가져올 것 — `nextColorStop` 규칙 (hover · pressed = 같은 사다리 다음 단; composition 의 검정 혼합 85 % / 75 % 를 대체할 후보), `autoStaticColor` (lch 밝기 기준 흑/백 자동 — Hub 「yellow · orange 위 검정 글자」 규칙의 일반형, `ON_ACCENT` 고정값 대체 후보), `baseColor()` 모양의 상태 묶음 이름 (`{color.gray-100:hovered}` 같은 참조 — 토큰 이름 수를 `*-hover` · `*-pressed` 셋에서 하나로 줄인다), `light-dark()` 한 선언 (생성 CSS 의 light/dark 두 블록을 하나로 — Skia 는 영향 없음).
- 못 가져올 것 — 빌드 시 인라인 자체 (테마 축이 실행 시점 입력이라 CSS 변수가 필요), `@adobe/spectrum-tokens` 직접 import (설치돼 있지 않고 설치해도 Tone 5 · tint 10 의 값은 거기 없다 — Tone 팔레트 출처 결정 (§9.6 남은 물음 2) 에서 「S2 gray 13단을 default Tone 으로」 를 고르면 그 JSON 의 gray 값만 seed 로 복사).

### 9.9 두 토큰 체계 대조 — Spectrum 토큰 데이터 ↔ composition catalog 토큰 (2026-11-07 재조사)

사용자 정정: 「실제 토큰이 존재하는 것은 Spectrum Hub 와 composition 이다. composition 은 S2 를 참고해서 토큰화한 것이다.」 — 비교 대상은 **Spectrum 토큰 데이터** (Hub 가 보여 주는 `spectrum-design-data` 3.8.2, design-data MCP `tokenCount` 2523 — S2 의 `tokens.ts` 가 import 하는 `@adobe/spectrum-tokens` 와 같은 데이터) 와 **composition 토큰** (`TokenEntry` · `LibraryToken` · `{category.key}` TokenRef · seed 맵) 둘이다. S2 style macro 는 Spectrum 토큰의 소비 방식일 뿐이고 (§9.8), composition 이 참고한 것은 그 소비 방식의 역할 이름 · 치수 식이다.

출처: Spectrum 은 design-data MCP (`design-data-primer` · `design-data-query` · `design-tokens` guideline) 실측, composition 은 `packages/shared/src/catalog/document/types.ts` (`TokenEntry` 1292 · `LibraryToken` 1735 · `TokenType` 342 · `ThemePreset` 343) · `libraryTokenScale.ts` · `packages/rendering/src/renderers/utils/tokenResolver.ts` (`tokenToCSSVar` 372) · `primitives/*.ts` · `apps/builder/src/builder/panels/themes/themeTokenEditor.ts` (`THEME_TOKEN_CATEGORIES`).

#### A. 토큰 모델 (데이터의 모양)

| 항목        | Spectrum 토큰 데이터 (3.8.2)                                                                                                                                                                                                                                                                                                         | composition 토큰                                                                                                                                                                                                                                                                                                                | 차이                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 토큰 한 개  | JSON 객체 — `name` (분류 객체) · `$schema` (타입) · `value` 또는 `$ref` · `uuid` · `conceptId` · `set_schema` · `private` · `description` · `lifecycle.deprecatedIn`                                                                                                                                                                 | `TokenEntry { id, name, tokenType, value, source }` (문서) · `LibraryToken { id, tokenType, value, source, ref? }` (라이브러리) · seed 맵의 키 = 값 (`colors.ts` 등)                                                                                                                                                            | Spectrum 은 토큰이 **데이터 레코드** (식별자 · 분류 · 수명 · 설명), composition 은 **이름 → 값 한 쌍**                                     |
| 이름        | 분류 필드의 조합 (`property` · `colorFamily` · `colorRole` · `variant` · `state[]` · `object` · `structure` · `anatomy` · `role` · `size` · `shape` · `scaleIndex` · `scale` · `colorScheme`) 에서 문자열을 만든다 — `legacyKey` 가 옛 평문 이름 (`negative-subdued-background-color-default`)                                       | 평문 한 줄 `{category.key}` — category 8 (`color` · `typography` · `radius` · `size` · `border` · `spacing` · `shadow` · `focus`), key 는 t-shirt (`text-sm` · `md`) · S2 역할 이름 (`accent-subtle` · `layer-1`) · S2 크기 글자 (`height.M`) 혼합                                                                              | Spectrum 이름은 **읽는 순서가 규칙** (무엇을 전달 → 무엇에 → 언제 — `accent-background-color-hover`), composition 은 category 뒤에 자유 키 |
| 타입        | `$schema` 로 — `color` · `color-set` · `alias` · `dimension` · `multiplier` · `font-size` · `font-weight` · `scale-set` … (색 · light 조회 493건: color 344 · alias 149)                                                                                                                                                             | `TokenType` 5 (`color` · `length` · `number` · `string` · `boolean`) — 문서 저장용. 카테고리는 TokenRef 접두가 대신                                                                                                                                                                                                             | Spectrum 은 타입이 **값의 의미** (배율 · 글자 크기), composition 은 **직렬화 형**                                                          |
| 값          | 리터럴 (`rgb(233, 233, 233)` · `8px` · `0.5`) 또는 **alias** (`$ref` → uuid, 사슬 허용: `accent-content-color-default` → `accent-color-900` → `blue-900`)                                                                                                                                                                            | 리터럴만 (`#e9e9e9` · 12 · `"0 2px 8px …"`). 파생 관계는 **코드** 에 (`resolveThemeSnapshot` · `semanticPaletteMap` 의 (family, step) 좌표 · hover/pressed `color-mix`) — 데이터로는 안 보인다                                                                                                                                  | composition 에 **alias 토큰 타입이 없다** — 「이 역할은 저 단을 가리킨다」 가 저장되지 않는다                                              |
| 모드 (set)  | `set_schema` 로 한 토큰이 여러 값: `color-set` = `colorScheme` light · dark, `scale-set` = `scale` desktop · mobile. 같은 `conceptId` 로 묶임                                                                                                                                                                                        | 색: `lightColors` · `darkColors` 두 맵 (키 동일) → `cssVars` light/dark 두 블록; 치수: `S2_DEVICE` desktop · touch 두 벌 설치 (`s2TypographyTokens(base)` · `s2ControlHeights(scale)`); **문서 override (`TokenEntry.value`) 는 모드 구분 없이 한 값** (§6 유보)                                                                | 모드가 Spectrum 은 토큰 안에, composition 은 맵 밖에                                                                                       |
| 계층        | primitive (`private: true` — light 조회에서 color-palette 337건) → semantic (`color-aliases` 95 (light 조회) · `semantic-color-palette` accent/informative/negative/notice/positive-color-N · layout alias `corner-radius role=control size=m`) → component-specific (`name.component` = `tabs` · `date-picker`, `description` 동반) | 2층 — seed 역할 (`{color.accent-subtle}` · `{radius.md}`) + 노드의 리터럴. primitive 사다리는 토큰이 아니다 (`tailwindPalette.ts` 생성 표 · `--color-neutral-N` · `--tint-N` 은 DOM CSS 변수만, Skia 맵 · TokenRef 없음). component 토큰 층 없음 — `picker-*` · `popover-*` · `collection-item-focus` 가 역할 맵 안에 섞여 있음 | composition 은 **primitive 층과 component 층이 없고** semantic 층 하나에 셋이 섞임                                                         |
| 수명 · 메타 | `lifecycle.deprecatedIn` (`negative-subdued-*` 13.0.0) · `description` · `private` · `uuid` 안정 식별자 · `conceptId`                                                                                                                                                                                                                | 없음 — 이름이 곧 식별자, 이름을 바꾸면 rule 의 `{color.X}` 참조가 끊김 (게이트 `colorTokenCssNames` 로만 잡힘)                                                                                                                                                                                                                  | 이름 변경 · 폐기 이력을 데이터가 못 담는다                                                                                                 |
| 사용자 확장 | 없음 (Adobe 가 소유; 플랫폼 토큰 층은 구현체 쪽)                                                                                                                                                                                                                                                                                     | `source: "user-defined"` 토큰 · 테마 delta (`ThemeDefinition.tokens` = seed 와 다른 값만, ADR-143) · preset 축 (`tint` 10 + hex · `neutral` 5 · `radius` 5 · `darkMode` 3)                                                                                                                                                      | composition 에만 있는 것 — **테마 축이 실행 시점 입력**                                                                                    |
| 소비        | 플랫폼 구현체가 변환 (S2: `tokens.ts` → `style()` 빌드 시 인라인)                                                                                                                                                                                                                                                                    | DOM: `tokenToCSSVar` → `var(--accent)` · `var(--spacing-md)` · `var(--text-sm)` · `var(--radius-md)` · `var(--catalog-token-size-height-M)` · `var(--shadow-sm)` · `var(--border-width-thin)` · `--focus-ring*`; Skia: `installThemeMaps` 의 맵 직접 읽기                                                                       | composition 은 변수 소비 (테마 축 때문에 필요)                                                                                             |

#### B. 축별 사다리 대조 (값)

| 축                        | Spectrum 토큰 (desktop / light 기준)                                                                                                                                                                                                                                                                     | composition 토큰                                                                                                                                                                                                                                                              | 대응 · 공백                                                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 색 primitive              | `colorFamily` 21: gray 13단 (25 ~ 1000) + 18 hue 16단 (100 ~ 1600) + `transparent-neutral` · `transparent-neutral-inverse`; 전부 `private: true`, `color-set` light/dark                                                                                                                                 | 토큰 없음 — Tone 5 × 11단 (Tailwind 50 ~ 950) 과 accent `--tint-100 ~ 1600` 은 CSS 변수 · seed 좌표일 뿐                                                                                                                                                                      | **primitive 토큰 층 공백** — §9.6 결정의 「tone → gray 사다리」 가 들어갈 자리                                                                                                                                                 |
| 색 semantic (별칭 사다리) | `accent-color-N` · `informative-color-N` · `negative-color-N` · `notice-color-N` · `positive-color-N` (alias → hue 단)                                                                                                                                                                                   | 없음 — status 4 는 `semanticPaletteMap` 의 (family, step) 좌표 한 쌍                                                                                                                                                                                                          | 사다리 전체를 별칭으로 두는 층 공백 (§9.6 남은 물음 1)                                                                                                                                                                         |
| 색 역할                   | `color-aliases` (light 조회 95): `{colorRole}-{content · background · border · visual}-color-{state}` (`accent-content-color-default` → `accent-color-900`; `neutral-content-color-default` · `neutral-subdued-content-color-default`; `background-layer-1-color` …), `object` background 68 · visual 25 | `lightColors` 172 키 (이름 기준 분류: accent 11 · neutral 계열 30 · surface 5 · chart 16 · 상수 3 · status/hue 107)                                                                                                                                                           | 역할 이름은 S2 macro 이름 (`accent-subtle` · `neutral-subdued` · `layer-1`) 을 따랐고 Spectrum 토큰 이름 (`accent-background-color-default`) 은 아니다 — 매핑표가 없다                                                         |
| spacing                   | 15단 `spacing-25 … 1000` = 1 · 2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 80 · 96                                                                                                                                                                                                           | 9단 `{spacing.2xs … 4xl}` = 2 · 4 · 8 · 12 · 16 · 24 · 32 · 40 · 48                                                                                                                                                                                                           | 값은 부분집합 (50 ~ 700 중 85 · 350 제외); 1 · 6 · 20 · 64 · 80 · 96 없음. 이름 체계 다름 (숫자 ↔ t-shirt)                                                                                                                     |
| corner-radius             | primitive 11단 `corner-radius-0 … 800` = 0 · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 16, `1000` = multiplier 0.5 (full); alias: `default` size s/m/l/xl → 4 · 8 · 10 · 16, `control` size s/m/l/xl → 3 · 4 · 5 · 6, `container` size xs ~ xl → 6 · 7 · 8 · 9 · 10, `none` · `full`                              | `{radius.none/xs/sm/md/lg/xl/2xl/full}` = 0 · 2 · 4 · 8 · 10 · 16 · 24 · 9999                                                                                                                                                                                                 | `sm/md/lg/xl` = Spectrum `default` s/m/l/xl ✓ (ADR-295). `xs` 2 · `2xl` 24 는 Spectrum 에 없는 값; `control` · `container` 역할 사다리 없음                                                                                    |
| font-size                 | `font-size-25 … 1500` scale-set 18단: 10 · 11 · 12 · 14 · 16 · 18 · 20 · 22 · 25 · 28 · 32 · 36 · 40 · 45 · 51 · 58 · 65 · 73 (mobile 별도)                                                                                                                                                              | `TYPOGRAPHY_STEPS` 18 키 = `s2FontSize(step)` 14 × 1.125^step 반올림 (실측): `text-2xs` 11 · `xs` 12 · `sm` 14 · `base` · `md` 16 · `lg` 18 · `xl` 20 · `2xl` 22 · `3xl` 25 · `4xl` 28 · `5xl` 36 · `heading-xs … 3xl` 18 · 20 · 22 · 28 · 36 · 45 · 58 (touch 17 기준 두 벌) | 서로 다른 값 12 개가 모두 Spectrum 단과 같다. **10 · 32 · 40 · 51 · 65 · 73 여섯 단이 없다** (`text-4xl` 28 다음이 `5xl` 36 이라 32 를 건너뜀); 이름 다름 (`font-size-100` ↔ `text-sm`); `heading-*` 7 키는 rule 소비 0 (§9.3) |
| line-height               | `line-height-font-size-N` scale-set (100 → 18 / 22 mobile)                                                                                                                                                                                                                                               | `{typography.<key>--line-height}` = `s2LineHeight` (14 → 18, 17 → 22)                                                                                                                                                                                                         | 값 ✓ · 토큰 단위 ✓ (글자 단계마다 하나)                                                                                                                                                                                        |
| font-weight               | `font-weight` weight light · regular · medium · bold · extra-bold · black (값은 이름)                                                                                                                                                                                                                    | 토큰 없음 — rule 리터럴 400 · 500 · 600 · 700 (§9.3)                                                                                                                                                                                                                          | **공백** — 역할 (heading = extra-bold · title = bold · detail = medium) 도 없음                                                                                                                                                |
| component-height          | `component-height-N` scale-set (100 → 32 / 40 mobile)                                                                                                                                                                                                                                                    | `{size.height.XS … XL}` 20 · 24 · 32 · 40 · 48 (× 1.25 touch)                                                                                                                                                                                                                 | ✓ (ADR-295) — Spectrum 은 숫자 단 (`100`), composition 은 S2 글자 (`M`)                                                                                                                                                        |
| focus                     | `focus-indicator thickness` 2px · side 4px                                                                                                                                                                                                                                                               | `{focus.ring.default}` · `{focus.ring.inset}` → `--focus-ring` · `-width` · `-offset` · `-inset-offset` (DOM 전용 4 키)                                                                                                                                                       | 개념 ✓, 데이터 모양 다름 (Spectrum 은 두께만 토큰, 색은 `focus-indicator-color` 별도)                                                                                                                                          |
| shadow                    | `shadow` property + `blur` · `shadow-color` 분해 토큰 (`drop-shadow` 지침 emphasized · elevated · dragged)                                                                                                                                                                                               | `{shadow.sm/md/lg/inset}` 합성 문자열 (S2 값 그대로, dark ×3)                                                                                                                                                                                                                 | 값 ✓, Spectrum 은 분해 (x · y · blur · color), composition 은 합성 1 문자열                                                                                                                                                    |
| border-width              | `border-width-100 · 200 · 400` = 1 · 2 · 4                                                                                                                                                                                                                                                               | `{border.width.none/thin/thick/hairline}` 0 · 1 · 2 · 0.5                                                                                                                                                                                                                     | 1 · 2 일치; `none` 0 · `hairline` 0.5 는 Spectrum 토큰에 없음; 4 없음                                                                                                                                                          |
| icon                      | `icons.tokens.json` — light 색 조회에 56건 (`icon` 필드가 있는 색 토큰, 크기 토큰은 미조회)                                                                                                                                                                                                              | `{size.icon.XS … XL}` 14 ~ 22                                                                                                                                                                                                                                                 | 아이콘 **종류별** 색 토큰 층 없음                                                                                                                                                                                              |

#### C. 이름 규칙 대조 (같은 결정을 어떻게 부르는가)

| 결정                 | Spectrum 이름 (읽는 순서: 전달 → 대상 → 조건 → 단)                                                                                                                  | composition 이름                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 강조 배경, 기본 상태 | `accent-background-color-default` (→ `accent-color-900` → `blue-900`)                                                                                               | `{color.accent}` (값 직접)                                                              |
| 강조 배경, hover     | `accent-background-color-hover` (→ `accent-color-1000`)                                                                                                             | `{color.accent-hover}` (resolver 가 검정 15 % 혼합)                                     |
| 본문 글자            | `neutral-content-color-default` (→ gray-800)                                                                                                                        | `{color.neutral}` (Tailwind neutral-900)                                                |
| 보조 글자            | `neutral-subdued-content-color-default` (→ gray-700)                                                                                                                | `{color.neutral-subdued}`                                                               |
| 배경 층              | `background-layer-1-color` · `background-layer-2-color` · `background-base-color` · `background-pasteboard-color`                                                   | `{color.layer-1}` · `{color.layer-2}` · `{color.base}` (pasteboard 없음, `raised` 추가) |
| 부정 색 사다리 단    | `negative-color-300` (alias → red-300)                                                                                                                              | 없음 (`negative-subtle` 가 Tailwind red-100 좌표)                                       |
| 기본 모서리 M        | `corner-radius` state default size m (→ `corner-radius-500` 8px; legacyKey 없음 — 같은 8px 의 `role container size m` 이 legacy `corner-radius-medium-size-medium`) | `{radius.md}` 8                                                                         |
| 컨트롤 모서리 M      | `corner-radius` role control size m (→ `corner-radius-100` 4px; legacy `corner-radius-small-size-medium`)                                                           | 없음 — rule 이 `{radius.sm}` 을 직접 고름                                               |
| 글자 크기 기본       | `font-size-100` (14 / mobile 17 ×)                                                                                                                                  | `{typography.text-sm}`                                                                  |
| 글자 굵기 제목       | `font-weight` weight extra-bold                                                                                                                                     | 없음 (리터럴 600)                                                                       |
| 컨트롤 높이 M        | `component-height-100`                                                                                                                                              | `{size.height.M}`                                                                       |
| 간격 8               | `spacing-100`                                                                                                                                                       | `{spacing.sm}`                                                                          |
| 컴포넌트 전용        | `tabs indicator thickness` (`tab-selection-indicator-thickness`, description 동반)                                                                                  | 없음 — rule 리터럴                                                                      |

#### D. 결론 — composition 토큰 체계가 Spectrum 과 다른 점 (구조)

1. **층이 하나다.** Spectrum 은 primitive (private) → semantic (alias) → component 세 층이고 각 층이 데이터다. composition 은 semantic 역할 층만 토큰이고, primitive 사다리는 CSS 변수 · 생성 표로, component 전용 값은 rule 리터럴로 흩어져 있다. §9.6 결정 (accent · tone 두 축) 은 **primitive 층 (tone → gray 사다리 · accent → hue 사다리) 을 토큰으로 두고 semantic 역할이 그 단을 가리키는 alias** 가 되면 자연히 Spectrum 모양이 된다.
2. **alias 가 데이터가 아니라 코드다.** Spectrum 의 `$ref` 사슬 (`accent-content-color-default` → `accent-color-900` → `blue-900`) 이 composition 에서는 `resolveThemeSnapshot` · `semanticPaletteMap` 안에 있어 패널 · 게이트 · 문서가 「이 역할이 어느 단에서 오는가」 를 읽을 수 없다. alias 토큰 타입 (`value` 대신 `ref`) 하나가 §9.6 의 「축으로 판정」 을 데이터로 만든다 — `LibraryToken.ref` 가 이미 그 모양의 절반이다.
3. **모드가 토큰 밖에 있다.** Spectrum 은 한 토큰이 `color-set` · `scale-set` 로 여러 값을 갖고, composition 은 맵 두 벌 + 문서 override 한 값이다. §6 유보 (override 가 light/dark 한 값) 는 이 구조 차이의 결과다.
4. **치수 값은 대부분 Spectrum 사다리 안에 있다** (§9.1 · B 표) — spacing · radius default · font-size · line-height · component-height · shadow 의 값이 Spectrum 단과 같다. 다만 단이 빠진 곳이 있고 (font-size 6단 · spacing 6단), 사다리 밖 값도 있으며 (`radius.xs` 2 · `radius.2xl` 24 · `hairline` 0.5), `control` · `container` radius 역할은 없다. 색은 Tailwind 좌표라 값이 다르고 font-weight 는 토큰이 없다.
5. **composition 에만 있는 것은 지켜야 한다** — 테마 축 (tint · tone · radius · darkMode) 이 실행 시점 입력이라는 점, `user-defined` 토큰, 테마 delta 저장. Spectrum 토큰 데이터는 이것이 없으므로 (Adobe 고정) 「Spectrum 모양으로 간다」 는 **데이터 모양** (층 · alias · set) 을 따르는 것이지 값을 상수로 복사하는 것이 아니다 (§9.8 정정 2).

### 9.10 개념의 출발점 — Hub 가 먼저인가 S2 가 먼저인가 (2026-11-07 조사)

**Hub 도 S2 도 출발점이 아니다.** 공통 상류는 Spectrum 디자인 시스템과 그 토큰 데이터이고, S2 는 그 데이터를 소비하는 구현, Hub 는 나중에 공개된 문서 화면이다. AI resource guide 페이지는 Hub · S2 의 선후를 적지 않는다 — 공식 데이터셋으로 Spectrum Design Data 를 들고, React Spectrum · Spectrum Web Components 는 별도 플랫폼 자료로 나열할 뿐이다. 아래 선후는 npm 공개일과 설치본으로 판단했다.

| 시점       | 대상                                                                                    | 근거                                      |
| ---------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| 2020-01-08 | `@adobe/spectrum-tokens` 첫 npm 공개 (현재 15.6.0, 저장소 `adobe/spectrum-design-data`) | `npm view`                                |
| 2024-08-09 | `@react-spectrum/s2` 첫 npm 공개 (nightly)                                              | `npm view`                                |
| 2025-12-16 | `@react-spectrum/s2` 1.0.0                                                              | `npm view`                                |
| 2026-05-30 | `@adobe/design-data-mcp` 1.0.0                                                          | `npm view`                                |
| 2026-09-30 | Spectrum Hub Release 1.0 공개                                                           | `SPECTRUM_HUB_CONCEPTS_2026-10.md` 머리말 |

- S2 → 토큰: `style/tokens.ts` 가 `@adobe/spectrum-tokens/dist/json/variables.json` 을 import 한다. 값 대조: design-data 3.8.2 light primitive 301 건이 S2 값과 전부 같다 (dark · alias 미대조).
- Hub → 데이터: Hub 지침 문장은 design-data 의 `documentBlocks` 와 같다 (`SPECTRUM_HUB_CONCEPTS_2026-10.md`, button 대조).
- 확인하지 못한 것: npm 공개일은 패키지의 나이일 뿐이다. Spectrum 2 디자인 결정이 내부에서 언제 어디서 먼저 정해졌는지는 공개 자료로 알 수 없다.
- composition 에 주는 뜻: 토큰 대조의 기준은 design-data 다. D2 정본 순서 (S2 → design-data → v3) 는 prop 표면의 순서라 이 조사로 바뀌지 않는다.

### 9.11 현재 resolver 출력의 Hub 규칙 검사 (2026-11-07 — light/dark 생성 · 대비 · 배경 층)

사용자 질문: 「light · dark 값이 Hub 문서처럼 같이 생성되는가 / 생성된 값이 Hub 의 대비 규칙을 모두 지키는가 / 배경 층 base · layer-1 · layer-2 · pasteboard · elevated 등 필요 항목을 만족하는가」. §9.6 재집계의 50 preset (tint 10 × Tone 5) × light · dark 출력에 WCAG 2.x 대비식을 적용했다. 검사 기준은 Hub colors · grays · background-layers 페이지 (로컬 정리본 §1 ~ 3) — 작은 글자 4.5:1 · 활성 non-text 3:1 · gray 25/50/75 는 배경 층 전용 · 100 ~ 300 은 낮은 대비 허용 · 층 표 (light: elevated 25 + 그림자 · layer-2 25 · layer-1 50 · pasteboard 100 · base 25 / dark: 75 · 75 · 50 · 25 · 25). 같은 검사식을 Spectrum 자체 값에도 돌려 기준이 맞는지 확인했다 (Spectrum 은 body/subdued/detail · 900 계열 글자 · 흰 글자 on accent-900 light / accent-800 dark 가 전부 4.5 이상 — 검사식은 Spectrum 을 통과시킨다). 원자료: `.agent/runs/2026-11-07-spectrum-check/color-contrast-check.txt`.

#### (1) light · dark 가 같이 생성되는가 — 부분적으로만

| 키                                                                                    | 50 preset 에서 light = dark    | 판정                                                                                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `accent` · `accent-hover` · `accent-pressed`                                          | 50 / 50 (항상 같은 hex)        | ✗ — Spectrum 은 accent-900 light `#3b63fb` / dark `#5681ff` 두 값. ADR-290 탐색이 흰 글자 기준이라 바탕 (light/dark) 을 보지 않는다 |
| `on-accent` · `on-negative` · chart-categorical 8 · chart-accent 4 · overlay-backdrop | 50 / 50                        | ✗ (chart 는 Spectrum 도 단일값일 수 있어 보류)                                                                                      |
| `accent-fill(-hover)`                                                                 | 45 / 50 (tint = blue 만 두 값) | ✗ — blue 만 S2 두 값, 나머지 tint 는 한 값                                                                                          |
| `field-placeholder`                                                                   | 40 / 50                        | ✗ — default Tone 만 두 값                                                                                                           |
| `accent-content` · `selection-accent` · tone 키 24 · status · named hue               | 0 / 50                         | ✓ 두 값                                                                                                                             |

결론: tone 축과 status · hue 는 두 벌이고, *_accent 축의 중심 토큰 3개 (`accent` · hover · pressed) 와 on-_ 가 한 값**이다. Hub 는 모든 색에 light · dark variant 를 둔다.

#### (2) 대비 규칙 — 지키지 못하는 쌍 (100 = 50 preset × 2 mode)

| 검사 (Hub 규칙)                                                                                    | 실패                                              | 예 (blue · neutral)                         | Spectrum 같은 쌍                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `on-negative` 글자 on `negative` 바탕 ≥ 4.5                                                        | **100 / 100**                                     | light 3.81 · dark 2.89                      | white / red-900 light 4.81, red-800 dark 4.51                                                                                                                                                        |
| `negative` · `positive` · `notice` 를 글자로 base · layer-1 · layer-2 · elevated · raised 위 ≥ 4.5 | **50 / 100** (light 전부)                         | negative 3.81 · positive 3.22 · notice 3.60 | 900 계열 4.79 ~ 4.81                                                                                                                                                                                 |
| `informative` 글자 on layer-1 · layer-2 · elevated · raised (dark) ≥ 4.5                           | 40 ~ 50 / 100                                     | dark layer-2 3.89                           | blue-900 dark / layer-2 4.53                                                                                                                                                                         |
| `on-accent` on `selection-accent` ≥ 4.5                                                            | 50 / 100 (dark 전부)                              | dark 3.51                                   | S2 는 배경에 dark accent-**800** (4.51) — composition 이 dark 에 900 (`#5681ff`) 을 썼다                                                                                                             |
| `accent` · `accent-fill` 면 on layer-1 · layer-2 ≥ 3 (활성 non-text)                               | 27 ~ 31 / 100 (dark, red · orange 등 어두운 tint) | red·slate dark 2.75                         | accent-800 dark / layer-2 3.53                                                                                                                                                                       |
| `border` on base · layer ≥ 3                                                                       | 100 / 100 (1.4 ~ 1.8)                             | light 1.48                                  | gray-300 / base 1.40 — **Hub 도 resting border 는 낮은 대비 허용**. 위반 아님. 다만 Hub 가 3:1 을 요구하는 **active border 역할 토큰이 composition 에 없다** (`border-hover` light 2.58 · dark 3.98) |

통과한 것: `neutral` · `neutral-subdued` · `neutral-content` · `accent-content` 글자 on 모든 층 (light 5.35 ~ 17.9) · `on-accent` on `accent` · `accent-fill` (4.81 ~ 5.25) · `on-neutral` on `neutral-fill` (13 ~ 14.6) · `focus-ring` on base (3.97 light · 4.19 dark — Spectrum 과 같은 값) · `field-placeholder` on base (4.88 / 5.47) — 100 / 100.

원인은 두 가지다 — **status 4 가 Tailwind 500 ~ 600 단** 이라 Spectrum 900 단보다 밝고 (light 에서 글자 · on-* 둘 다 실패), **accent 가 모드별로 안 갈려** 어두운 tint 의 dark 면 대비가 모자란다. §9.6 결정 보강 (초기값 = Hub 값 · 축 변경 시 규칙 유지) 을 구현하면 두 원인이 사라진다.

#### (3) 배경 층 — 필요 항목 대조

| Hub 층               | Spectrum light / dark                  | composition (default Tone neutral)                 | 비기본 Tone 4종 (slate · gray · zinc · stone) |
| -------------------- | -------------------------------------- | -------------------------------------------------- | --------------------------------------------- |
| base                 | gray-25 `#ffffff` / `#111111`          | ✓ 같음                                             | Tailwind 50 / 900                             |
| layer-1              | gray-50 `#f8f8f8` / `#1b1b1b`          | ✓ 같음                                             | light = layer-2 (**층 붕괴 40 / 40**)         |
| layer-2              | gray-25 / gray-75 `#222222`            | ✓ 같음                                             | dark = layer-1 = elevated (**40 / 40**)       |
| elevated             | gray-25 + 그림자 / gray-75 + 그림자    | ✓ 같음 (그림자는 shadow 토큰 별도)                 | 〃                                            |
| pasteboard           | gray-100 `#e9e9e9` / gray-25 `#111111` | **없음 (100 / 100)**                               | 없음                                          |
| (Hub 에 없음) raised | —                                      | `#f9fafb` / `#202023` Tailwind 고정 — Tone 과 무관 | 〃                                            |

dark 에서 layer-2 = elevated 인 것은 Spectrum 표와 같으므로 결함이 아니다. 결함은 pasteboard 부재 (전 preset) · 비기본 Tone 의 층 붕괴 (전 preset) · `raised` 가 Hub 역할 밖인 것 셋이다.

#### 종합

| 질문                            | 답                                                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| light · dark 가 같이 생성되는가 | 부분 — tone · status · hue 는 두 벌, accent 중심 3 키 · on-* 는 한 값                                                                                         |
| Hub 대비 규칙을 모두 지키는가   | 아니오 — status 글자 · on-negative (light 전부) · selection-accent dark · 어두운 tint 의 dark accent 면이 실패. neutral · accent-content · focus-ring 은 통과 |
| 배경 층 필요 항목을 만족하는가  | default Tone 만 base · layer-1 · layer-2 · elevated 가 Spectrum 과 같고, pasteboard 는 전부 없음, 비기본 Tone 은 층이 무너짐                                  |

검사 범위: 50 preset × 2 mode 의 resolver 출력. 사용자 hex · 문서 델타 · `NodeThemeOverride` · 생성 CSS 의 color-mix 파생 (hover/pressed 가 DOM 에서 var() 로 다시 섞이는 경로) 은 넣지 않았다. 대비식은 WCAG 2.x 상대 휘도 (Hub 도 같은 기준).
