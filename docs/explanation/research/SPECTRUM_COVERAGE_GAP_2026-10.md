# Spectrum 개념 대비 composition 제공 현황 · 미제공 기능 제안 (2026-10)

> 기준: [SPECTRUM_HUB_CONCEPTS_2026-10.md](SPECTRUM_HUB_CONCEPTS_2026-10.md) (spectrum.adobe.com Hub 1.0 정리). 코드 대조는 2026-10-30 main `cee6043f9` + 작업 트리. 조사 4갈래 (값 · 동작/접근성/i18n · 구성/콘텐츠/컴포넌트 · 외부 빌더 사례) 의 근거를 표본 grep 으로 다시 확인했다. 앞 절 (§1 ~ §3) 은 사실, §4 는 제안이다. 제안은 ADR 이 아니다 — 착수는 `/create-adr` 로 따로 정한다.

## 1. 한눈에 보기

| 영역          | 제공                                                                           | 부분                                                                                                                                       | 미제공                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 값 · 토큰     | drop shadow 3-layer · dark ×3 · light/dark + 다중 테마 · forced-colors 시트    | 토큰 tier · font-size (295 Phase 1) · line-height · spacing · density · radius/border · gray · background layer · 색 팔레트 · static color | S2 아이콘 규격 (lucide 사용) · two-tone · static 팔레트 · pasteboard · concentric radius                                   |
| 동작          | Button pending (Canvas+DOM)                                                    | 상태 7축 (DOM 만, Canvas 는 쉬는 상태) · motion (리터럴, reduced-motion 일부)                                                              | 상태별 스타일 편집 · dragged 전용 shadow · motion 토큰                                                                     |
| 국제화        | 숫자 · 날짜 locale 형식 (Canvas+DOM)                                           | RTL (문서 `dir` 만) · 크롬/콘텐츠 언어 구분 · CJK `keep-all` · tabular 숫자 (일부 rule)                                                    | Canvas RTL (엔진 방향 상수 ROW/COLUMN 뿐) · 다국어 콘텐츠 · 텍스트 확장 미리보기 · CJK 행간                                |
| 접근성 저작   | —                                                                              | alt · aria-label 입력 칸 · Nav→`<nav>` · Footer→`<footer>`                                                                                 | 대비 검사 UI (`meetsWCAG_AA` 미사용) · page Body 의 `main` landmark · h1/heading 검사 · skip link · 320px 확인 · a11y lint |
| 구성          | —                                                                              | layout 프리셋 10종 (빈 slot) · container 스타일 (Card variant + Styles 직접)                                                               | app frame (header · SideNav) · attention hierarchy 안내 · emphasized container                                             |
| 콘텐츠        | 필드 검증 · FieldError · 빈 상태 IllustratedMessage · InlineAlert · toast 액션 | 빌더 크롬 문구 (sentence case 혼재)                                                                                                        | 문구 lint · 오류 메시지 템플릿 · alert banner · onboarding (coach mark)                                                    |
| 컴포넌트 지침 | —                                                                              | 팔레트 카테고리 설명 한 줄                                                                                                                 | 컴포넌트 usage · content standards 표시                                                                                    |
| 컴포넌트 범위 | catalog 129 키                                                                 | AlertDialog · ActionMenu · NotificationBadge · Toast 는 다른 형태로 대응                                                                   | S2 대비 ~20종 (§3.4) · Spectrum design-only 7종                                                                            |

## 2. 값 · 토큰 (D3)

| #   | 축                      | 판정   | 근거                                                                                                                                                                                                                                      |
| --- | ----------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V1  | 토큰 3 tier · 이름      | 부분   | primitive = Tailwind 팔레트, semantic = `{color.*}` (`colors.ts:29-82`). S2 구조 토큰 (`container-padding-*` · `base-padding-*`) 0건. 패널은 hex · px 를 commit — semantic 키는 Themes 패널에서만 보인다 (`ThemeTokensSection.tsx:36-43`) |
| V2  | 글자                    | 부분   | 크기 = S2 식 (`typography.ts:17-28`, 295 Phase 1). 행간은 옛 고정값 (`:61-72`, 295 Phase 3). Heading rule 은 본문 사다리 + 600 (S2 = ExtraBold). Title · Detail · Component style 없음. weight 100~900 전부 노출. 서체 Pretendard         |
| V3  | spacing                 | 부분   | CSS `--spacing-md/lg/xl` = 12 · 16 · 24 (`shared-tokens.css:90-94`) ↔ Skia `spacing` md · lg · xl = 16 · 24 · 32 (`spacing.ts:18-20`) — 같은 이름, 다른 값 (295 §6.1, Phase 3 판정 대기). container padding 은 rule 리터럴                |
| V4  | density                 | 부분   | `densities` 채널은 TabList · Column · Cell · ToggleButtonGroup 4 rule 뿐. container (Card · toolbar) padding density 없음                                                                                                                 |
| V5  | radius · border         | 부분   | radius = S2 (`radius.ts:20-29`, 295 Phase 1). concentric 0건. border 토큰 0 · 0.5 · 1 · 2 (4 없음, `border.ts:19-26`)                                                                                                                     |
| V6  | shadow                  | 제공   | 3-layer 값 · dark ×3 일치 (`shadows.ts:54-81`). emphasized-hover 이름만 없음 (값 = elevated). Popover 테두리는 모든 모드                                                                                                                  |
| V7  | gray · background layer | 부분   | Tailwind 50~950 별칭. light layer-1 = layer-2 (S2 는 gray-50 / gray-25). pasteboard 0건. 295 는 색 범위 밖                                                                                                                                |
| V8  | 색 팔레트               | 부분   | Tailwind 11단 + accent tint 16단 하나. staticColor 는 8 컴포넌트 prop. static 팔레트 · two-tone 0건. categorical 8색                                                                                                                      |
| V9  | dark · forced-colors    | 제공   | `themeVarsCss.ts:5,17` · 생성 시트 103/105 (대부분 `forced-color-adjust: auto` 한 줄). Canvas 는 해당 없음                                                                                                                                |
| V10 | 아이콘 · illustration   | 미제공 | 사용자 Icon = lucide 24 · stroke 2 (`Icon.tsx`). S2 workflow icon set 은 설치본에 있으나 미사용. Illustration 은 크기 48/96/160 만 S2, 그림 자산 없음                                                                                     |

## 3. 동작 · 접근성 · 구성 · 콘텐츠

### 3.1 동작

- 상태 7축 (`types.ts:414-421`) 은 DOM 선택자로만 나간다 (`stateStyles.ts`). Canvas 는 쉬는 상태만 그리고 (`presence.ts:3098`), Components page 의 `displayState` 만 예외. focus ring 을 Canvas 가 그리는 코드 0건. Styles 패널은 기본 상태만 편집.
- motion: duration · easing 토큰 0건, rule 리터럴 (`"all 150ms ease"`). reduced-motion 은 archetype 4종만 자동 생성 — transition 이 있는 생성 시트 25개 중 6개 (DateInput · DateRangePicker · Disclosure · Input · Pagination · Tab) 누락.
- dragged = `opacity: 0.6` 뿐 (S2 는 전용 shadow).

### 3.2 국제화

- RTL: Site 언어 → `<html lang dir>` (`documentHead.ts:45-61`). 기본 언어 목록에 RTL 언어 없음 (`SitePanel.tsx:45`). 엔진 방향 상수 ROW/COLUMN 만, Canvas rtl 0건. 생성 CSS 논리 속성 39 · 물리 속성 28 혼재. 아이콘 미러링 0건.
- 다국어 콘텐츠 (locale 별 텍스트) · pseudo-locale · 텍스트 확장 검사 0건. 크롬 언어와 사이트 언어는 분리돼 있다 (`PreviewLocale.tsx:7-16`).
- 숫자 · 날짜 locale 형식은 Canvas 와 DOM 이 같은 글자를 쓴다 (`numberFormatProps.ts`, `dateLocaleProps.ts`).

### 3.3 접근성 저작

- 입력 칸: Image `alt` · Avatar alt · 필요할 때만 보이는 Aria Label (`ariaLabelNeed.ts`). 경고 · 배지 없음.
- 대비 함수 `meetsWCAG_AA` (`colorUtils.ts:302`) 는 호출처 0. 테마 accent 명도만 자동 보정 (ADR-290), 그 경고는 UI 에 안 나온다 (`resolveThemeSnapshot.ts:114`).
- page Body 가 `div` → `main` landmark 없음 (`domBinding.runtime.ts:2242`). h1 규칙 · skip link · focus order · F6 0건. mobile 프레임 390 (320 확인 수단 없음). Publish 경고는 상호작용 대상 미지정뿐.

### 3.4 구성 · 콘텐츠 · 컴포넌트

- attention hierarchy: 경고 장치 0건. 기본값이 S2 와 다른 곳 — Badge `accent` (S2 `neutral`, `Badge.binding.ts:36`) · InlineAlert `informative` (S2 `neutral`). origin 중 ButtonGroup 두 번째 버튼 · Pagination 현재 페이지가 accent.
- container: Card variant 로 배경 · 테두리. Card 기본 shadow 없음 (S2 Card = emphasized, hover elevated).
- app frame: layout 프리셋 10종 (`presetDefinitions.ts`) 은 빈 slot. 새 프로젝트는 빈 페이지 하나. 페이지 트리 (`route` + `parentId`) 는 있지만 메뉴와 잇는 연결 없음. publish 에 catalog 밖 `PageNav.tsx` 가 따로 있다.
- 컴포넌트 지침: `PanelMeta` · `PropContract` 에 설명 필드 없음. design-data `documentBlocks` 미사용.
- 문구: 사용자 문구 검사 0건. 빌더 크롬은 혼재 — "Show rulers" (맞음) · "Toggle Navigator Panel" · "Date & Time" · "Preview URL:" (어긋남), binding 라벨 Title Case 327 vs sentence case 21.
- 오류 · 빈 상태: 필드 검증 · FieldError · description · IllustratedMessage 빈 상태 · InlineAlert 5 variant · Dialog alertdialog 제공. toast 는 Interactions 액션 (message 한 줄, variant 없음). alert banner 0건.
- S2 에 있고 catalog 에 없는 것: ActionBar · ActionButton (단독) · ActionButtonGroup · CloseButton · CustomDialog · FullscreenDialog · DialogContainer · LabeledValue · RangeSlider · SegmentedControl · SelectBox(Group) · **SideNav · SideNavPanel** · SkeletonCollection · Asset/User/Product Card · EditableCell · TableFooter. LinkButton 은 Button `href` 부재. design-only 7종 (alert-banner · coach-mark · rating · steplist · tag-field …) 전부 없음.

## 4. 외부 사례에서 본 제공 형태

| 형태                        | 쓰는 곳                                      | 사례                                                                                           |
| --------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 실시간 등급                 | 색 입력기 안                                 | Figma (AA/AAA + 가장 가까운 통과 색으로 한 번에 수정) · Webflow (Fail/AA/AAA + 통과 범위 표시) |
| 스캔 → 목록 → 요소로 이동   | 구조 a11y · 토큰 lint                        | Webflow Audit panel · Wix Accessibility Wizard · Figma Check designs (규칙 기반, 제안 + Apply) |
| 입력 제약                   | 토큰 강제                                    | Builder.io `styleStrictMode`                                                                   |
| mode · locale 전환 토글     | 테마 · density · 다국어                      | Figma/Webflow/Plasmic mode (부모 상속 Auto) · Framer locale 전환 + RTL 레이아웃 자동 반전      |
| 속성 패널 설명 + 문서 링크  | 컴포넌트 지침                                | Figma component description · Webflow prop tooltip                                             |
| 상태 드롭다운 → 캔버스 고정 | hover · pressed · focus · focus-visible 편집 | Webflow States                                                                                 |
| 연결 유지 layout            | app shell                                    | Framer Layout Templates (대부분 builder 는 연결 끊긴 사본)                                     |
| 빈 칸 (어느 제품에도 없음)  | —                                            | 강조 · 위계 lint · builder 본체의 문구 lint · reduced-motion · 텍스트 확장 미리보기            |

출처 URL 은 조사 원문 (같은 날 세션) 에 있다 — 주요 1차 출처: help.figma.com 39592284074263 (Check designs) · 360041003774 (contrast) · help.webflow.com 33961313088531 (Audit) · 33961301727251 (States) · framer.com/updates/right-to-left-layout-direction · builder.io/c/docs/design-tokens · react-spectrum.adobe.com/.well-known/skills/spectrum-audit.

## 5. 제안 — 미제공 기능을 어떻게 제공할까

원칙: 기능 하나 = catalog · Canvas · Design/Properties · Interactions · Code 다섯 표면 동시 (사용자 원칙 10-30). 새 어휘보다 S2 · RAC 표면을 그대로 노출 (D2 정본 순서). 규칙 검사는 LLM 없이 결정적으로 (Figma Check designs 선례).

### 5.1 묶음과 순서

| 순서 | 묶음                                    | 내용                                                                                                                                                                                                                                                                                                               | 형태 (외부 선례)                          | 근거 · 범위                                                 |
| ---- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------- |
| 1    | **S2 기본값 · 값 정렬 마무리**          | Badge · InlineAlert 기본 variant `neutral` · Card 기본 emphasized shadow (+ hover elevated) · `emphasized-hover` shadow 이름 · border 4 토큰 · spacing Skia/CSS 불일치 해소 · 행간 식 · padding/gap 식. `d2S2Alignment` 게이트를 **기본값**까지 넓힌다                                                             | 값 교체 (시각 결과 변화 → 사용자 확인)    | 대부분 ADR-295 Phase 3. 기본값 3건은 295 밖 — 작은 별도 ADR |
| 2    | **App frame + SideNav**                 | S2 `SideNav` · `SideNavPanel` (RAC `NavigationTree`) catalog 등록 → 항목은 페이지 트리에서 파생 + 덮어쓰기만 저장 · `selectedRoute` = 현재 page route · layout 에 App frame 프리셋 가족 (header 56 · side nav 160/200/240 · 768 이하 overlay) · page Body `main` landmark · skip link · publish `PageNav.tsx` 흡수 | 연결 유지 layout (Framer)                 | 새 ADR. 사용자 제안 10-30                                   |
| 3    | **접근성 저작 1단계**                   | (a) 색 입력기에 대비 등급 + 가장 가까운 통과 색 (`meetsWCAG_AA` 재사용, 배경 = 조상 fill 해석) (b) Audit 패널 — alt 누락 · heading 건너뜀 · h1 0개/2개+ · icon-only 이름 없음 · label 없는 field · 320px 넘침 → 목록에서 요소로 이동 (c) Publish 때 같은 목록을 경고로                                             | 실시간 등급 + 스캔 목록 (Figma · Webflow) | 새 ADR. 검사는 catalog resolved tree 를 읽는 순수 함수      |
| 4    | **상태 편집 · 미리보기**                | Styles 패널 상태 드롭다운 (hover · pressed · focus-visible · selected · disabled) → 선택한 노드를 Canvas 가 그 상태로 그림 (`displayState` 를 Components page 밖으로 확장) · Canvas focus ring · dragged shadow                                                                                                    | 상태 드롭다운 (Webflow States)            | 새 ADR. 상태 7축은 이미 catalog 에 있다                     |
| 5    | **attention · 문구 lint** (3 의 확장)   | 같은 Audit 패널에 규칙 추가: 페이지당 high attention (accent 버튼 · emphasized · gradient · elevated container) 2개 이상 · 버튼 라벨 4단어/20자 초과 · Title Case · 버튼·제목 끝 구두점 · `&` · 필드 라벨 끝 colon · Spectrum word list 의 Avoid 단어. 각 항목에 Hub 지침 한 줄 링크                               | 어느 제품에도 없음 — 차별점               | 3 과 같은 엔진. 빌더 크롬 문구 정리는 별도 (아래 결정 ③)    |
| 6    | **컴포넌트 지침 표시**                  | design-data `documentBlocks` (purpose · guideline · do-dont) 를 빌드 때 JSON 으로 고정 → 팔레트 hover 와 Properties 머리에 purpose 한 줄 + 펼치는 Do/Don't. prop 단위는 `PropContract` 에 help 필드                                                                                                                | 설명 + 링크 (Figma · Webflow)             | 라이선스 확인 필요 (spectrum-design-data 저장소)            |
| 7    | **motion 토큰 · reduced-motion 게이트** | duration · easing 을 theme 토큰으로 · 생성 시트에 transition 이 있으면 reduced-motion 블록 필수 (생성기 규칙 + 정적 게이트, 누락 6건)                                                                                                                                                                              | 사이트 설정 (Framer)                      | 작은 ADR. Hub 에 값 없음 → S2 style macro 값                |
| 8    | **RTL · 다국어**                        | (a) RTL: 엔진 방향 축 + Canvas 반전 · 생성 CSS 물리→논리 속성 · 아이콘 미러링 표 (Hub bidi 규칙) · 언어 목록에 ar/he (b) pseudo-locale 미리보기 토글 (Hub 텍스트 확장 표로 글자 늘림) (c) locale 별 콘텐츠 = primary 상속 + 차이만 저장                                                                            | 레이아웃 자동 반전 (Framer) · locale 전환 | (a)(c) 큰 ADR 각각. (b) 는 작고 어느 빌더 본체에도 없음     |
| 9    | **색 · 배경 층 · 아이콘**               | gray 25/75 단 · layer-1/2 S2 값 · Canvas 바깥 = pasteboard (editing context) · static 팔레트 · two-tone. 아이콘: S2 workflow icon set (설치본 `@react-spectrum/s2/icons/*`, 20px · 1.5 stroke) 도입 여부                                                                                                           | 값 교체                                   | 295 가 색을 제외 → 새 ADR. 아이콘은 시각 결과가 크게 바뀐다 |
| 10   | **빠진 컴포넌트**                       | 우선: SideNav (2 와 함께) · ActionButton/Group · ActionBar · SegmentedControl · RangeSlider · LinkButton (Button `href`) · CloseButton · LabeledValue · Toast 노드 (variant · action) · alert banner. 다음: SelectBoxGroup · FullscreenDialog · coach mark (S2 미export → design-data 스키마 기준)                 | `/component-design` 경로                  | 컴포넌트마다 등록 경로. 묶음 ADR 1개로 목록 고정            |

### 5.2 정해 주셔야 할 것

1. **순서**: 위 표 순서 (기본값 → app frame → a11y → 상태 → lint → 지침 → motion → RTL → 색 → 컴포넌트) 로 갈지, 고객 가치 (대량 데이터 · 필터 화면) 기준으로 다시 정할지.
2. **시각 결과가 바뀌는 것** — Badge/InlineAlert 기본값, Card shadow, gray/layer 값, 아이콘 세트 교체는 기존 사용자 문서의 모양을 바꾼다. 개발 단계라 마이그레이션 없이 바꿀지 (메모리 10-14 「마이그레이션 코드 금지」 와 맞음).
3. **빌더 크롬 문구**: Spectrum 문구 규칙 (sentence case · Show/Hide · & 금지) 을 빌더 자체 UI 에도 적용할지. binding 라벨 327개가 대상이다.
4. **App frame 연결 방식**: 페이지 트리 파생 + 덮어쓰기 (추천) vs 생성 때 사본.
5. **다국어 콘텐츠 (8c)** 를 지금 범위에 넣을지 — 데이터 모델이 바뀌는 큰 작업이다.
