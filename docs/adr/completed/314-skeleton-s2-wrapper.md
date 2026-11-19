# ADR-314: Skeleton 을 S2 래퍼로 — 요소 없는 로딩 context · 감싼 내용이 스스로 로딩 모양 · SkeletonCollection

## Status

Implemented — 2026-11-18 (G6 — 사용자 「확인했다」, 샘플 프로젝트 「Skeleton 샘플」 · 아래 Live Exercise). Accepted — 2026-11-18 (승격 근거: 사용자 `/execute-adr 314` 호출 + [reviews/314.md](../reviews/314.md) round 2 종결 — pending 0 · HIGH 0)

> **종결 (2026-11-18 — G6)**: 사용자가 실제 Builder 의 샘플 프로젝트 (Skeleton 기본 · `Skeleton > Card` Loading 켬 · 끔 · 데이터 연결한 Skeleton · CardView + SkeletonCollection) 를 확인했다 (「확인했다」). Phase 0 ~ 5 모두 닫힘. `components/Skeleton.tsx` (import 0) 도 사용자 승인으로 지웠다.

> **Phase 5 종결 (2026-11-18 — G5, 종결 G6 은 사용자 확인 대기)**: 사용자 결정 4 — 수동 `Skeleton.css` (1,189 줄) · 컴포넌트 11 곳의 자기 로딩 분기 (`isLoading` · `skeleton*Count`) · Skeleton 내보내기 · `createDefaultSkeletonProps` 삭제, 낡은 `generated/Skeleton.css` (생성 대상 아님) 도 지움. Builder chrome Button 두 곳 (`Signin` · dashboard) 은 RAC `isPending` 으로. `components/Skeleton.tsx` (import 0) 는 G6 뒤 사용자 승인으로 삭제. 사용자 결정 5 — 번들 Phase 0 대비 Builder initial JS gzip +818 · Preview +150 (CSS −2,034), ADR-201 Δ 상한 안. frame — production · Skeleton + Text 200 (로딩 요소 203) · 같은 문서 `isLoading` 끔 / 켬 교대 3 쌍 · 중앙값 p95 비율 1x 1.00 · 4x 1.00 (≤ 1.2). Canvas — 켬 상태 2 초 동안 렌더 카운터 변화 0 (정지 프레임). 회귀 새 실패 0. 상세 [breakdown §7](../design/314-skeleton-s2-wrapper-breakdown.md).

> **Phase 4 종결 (2026-11-18 — G4)**: `SkeletonCollection` = 요소 없는 container (CardView 안 · 자식은 Card 템플릿 하나, 팔레트 원본) — S2 처럼 그 안은 늘 로딩 중인 Skeleton (`skeletonContext.ts` · 상속 host). CardView 가 `loadingState` 를 받는다 (`LOADING_STATE_TYPES` + binding 의 파생 칸 — owner 연결의 조회 또는 반복 run). DOM 은 `loading` · `loadingMore` 동안 카드 run 뒤 · sentinel 앞에 템플릿을 RAC `skeleton` 컬렉션 노드로 (`createLeafComponent` — S2 와 같은 기구, 행이 아님), 자리 항목이 있으면 sentinel 스피너 없음. 반복 수는 가상 grid 면 RAC `GridLayout` 이 직접, 그 밖은 그려진 grid 를 잰 순수 계산 (`skeletonRepeat.ts` — 설치본 `GridLayout` · `WaterfallLayout` 과 같은 입력 4 경우씩 대조 일치, 내용 높이 CardView 는 정책). Canvas 는 템플릿 1 개 (로딩 모양). 실제 요청 보류 Preview 의 네 상태 × (owner · run) 확인, 원복 RED 7/7. Phase 0 의 CardView sentinel 스피너 결함도 닫힘. 상세 [breakdown §7](../design/314-skeleton-s2-wrapper-breakdown.md).

> **Phase 3 종결 (2026-11-18 — G3)**: 로딩 모양의 D3 값은 `catalog/rule/skeletonLook.ts` 한 곳 — S2 `loadingStyle` 의 gradient (`gray-100` 33% · `light-dark(gray-25, gray-300)` · `gray-100` 66%) · `background-size: 300%` · 글자 radius `sm` · StatusLight 점 `gray-200` · 움직임 2 초 `ease-in-out` (색은 alias 표 tone 행 셋 `skeleton` · `skeleton-highlight` · `skeleton-status-light`). 생성 CSS `generated/CatalogSkeleton.css` (Preview · Publish 의 `styles/index.css`) 와 Canvas (`canvasBinding.ts` `withSkeletonLook` — 정지 프레임: 300% 그림의 끝은 `gray-100` 한 색이라 움직임의 시작 · 움직임 줄이기 모두 그 색) 가 같은 상수를 읽는다. 모양 셋 — 글자 (Text · Link · Meter 값 · StatusLight 글자: DOM 은 S2 `SkeletonText` inline span, Canvas 는 `getRectsForRange` 줄 상자) · 감싼 요소 (Icon `sm` · Badge · Meter track · Image · Avatar 원: 요소에 gradient + 자손 숨김 — Canvas 파생 `_skeletonHidden`) · StatusLight 점. 움직임은 S2 와 같은 Web Animations (`startTime = 0` 동기 · 움직임 줄이기면 없음 — `skeletonAnimation.ts`). breakdown 대비 바뀐 것: 조건 트리에 `isSkeleton` 가지를 두지 않았다 — 모양이 참여 rule 의 칠이 아니라 S2 처럼 공용 `loadingStyle` 하나라서 (8 rule 에 같은 가지를 복제하지 않음). 같이 고친 것: Phase 2 의 form 비활성이 Link · Tabs · Disclosure · 날짜 · Color 조작기까지 닿던 것을 S2 `useFormProps` 를 부르는 17 종으로 좁힘 (`CATALOG_SKELETON_DISABLED_TYPES` — Canvas 에서 Link 가 흐려졌다) · Meter 값 (`MeterValue`, S2 `<Text>`) 을 참여에 더함 · 공용 Icon 이 `ref` · `inert` 를 DOM 에 넘김. 원복 RED 7/7. 상세 [breakdown §7](../design/314-skeleton-s2-wrapper-breakdown.md).

> **Phase 2 종결 (2026-11-18 — G2)**: 전달 = record 단계 판정 하나 (`skeletonContext.ts` — 부모 사슬의 가장 가까운 Skeleton, Button 계열 · `SkeletonWrapper` 대응 (Icon · Badge · MeterTrack) 에서 끊김) → 참여 9 종의 파생 `isSkeleton` (Canvas) · DOM `data-skeleton` + S2 가 거는 곳의 `inert`. form 비활성은 로딩 중 Skeleton 을 ADR-281 상속 host 로 (`isDisabled` — Canvas · DOM `Provider` · guard 한 기구, S2 「Skeleton always wins」). breakdown §3.2 의 resolver `applySkeletonContext` 대신 — 부모 사슬이 instance · slot · 반복 행 · overlay 를 이미 펼쳐 경로별 분기가 필요 없다. 테스트 6 · 원복 RED 5/5 · live (Publish — Text 2 · Badge `inert`, Image 는 표시만). 반복 행 경로는 반증 케이스 없음 (LOW deferred). 상세 [breakdown §7](../design/314-skeleton-s2-wrapper-breakdown.md).

> **Phase 1 종결 (2026-11-18 — G1)**: Skeleton = 요소 없는 container — rule `display: contents` · binding `isLoading` + `dataBinding` (`size` 삭제 · contract 71, 사용자 결정 1) · leaf 목록에서 뺌 · `catalogSkeletonIdle` 삭제 (`isLoading: false` = 내용이 보통 모양) · DOM 렌더러는 자식만 (Fragment) · 원본 `component-skeleton` = 루트 slot `Content` + 표본 내용 Image 160×120 + 제목 · 본문 Text (S2 문서 예시, 결정 2) · 빈 Skeleton 은 Canvas 만 점선 자리 48 (`catalogEmptySkeleton`, 결정 3). 원복 RED 3/3 (DOM 렌더러 · 빈 자리 · 루트 slot). 회귀 새 실패 0 (shared · builder unit · palette 대칭 browser — 실패 목록 = HEAD). live (Chrome, 새 프로젝트): 팔레트로 놓기 → Canvas 상자 = 내용 합 · Publish DOM 에 Skeleton 요소 0 · 내용 행이 body 직계 · Image 160×120 · 제목 x 176 (Canvas 비율 같음) · Design 패널 Data · Loading 만 · Loading 끄기 → 내용 유지 · 내용 삭제 → 점선 자리 (선택 390×48) · Undo 2 → 복원 · Skeleton 을 고른 채 Badge 넣기 → Skeleton 안. 꺼내기 (자식을 밖으로 끌기) 는 live 미exercise. 상세 [breakdown §7](../design/314-skeleton-s2-wrapper-breakdown.md).

> **Phase 0 종결 (2026-11-18 — G0)**: S2 참여 표 줄 번호 = breakdown §2 와 차이 0. F9 — shared 12 파일의 자기 로딩 (`<Skeleton componentVariant>`) 은 catalog 문서에서 닿지 않는다 (`isLoading` 을 받는 binding 은 Skeleton 뿐 · `toRacProps` 가 미선언 prop 을 버리고 delegating renderer 는 `isLoading` 을 넘기지 않음). 닿는 곳은 catalog 밖 Builder chrome 둘 (`Signin.tsx:197` · `dashboard/index.tsx:357` 의 Button `isLoading` → `componentVariant="button"`). **옛 `size` 는 문서 검증을 통과하지 못한다** — accepts 에서 지우면 `size` 를 작성한 Skeleton 이 든 프로젝트는 `PROP_NOT_ACCEPTED` (`graph.ts:1869`) 로 열리지 않는다 (본문의 「빈 래퍼로 열림」 전제 정정 — 사용자 결정 1 에 반영). Skeleton 인용 테스트는 15 파일 (11 + helper 2 + browser 2): Phase 1 에서 고칠 것 4 + 조건부 1. CardView 의 가상 스크롤 waterfall 은 거절돼 비가상으로 그려진다 — 실제 경로 = flex wrap · `CatalogWaterfallGrid` · `CatalogGridLayout` (RAC `GridLayout` 상속 — type `skeleton` 을 RAC 가 그대로 처리). 번들 기준선 (production closure gzip) Builder 1,580,802 · Preview 171,660 B. 상세 [breakdown §7](../design/314-skeleton-s2-wrapper-breakdown.md).

- 사용자 요청: `/create-adr` (2026-11-18).
- 방향을 정한 사용자 원문 (2026-11-18 대화 순서대로):
  - 「남은 것은 아직 S2 와 구조를 대조하지 않은 9종 (Text · Keyboard · Skeleton 등) 과 정해 주셔야 할 결정 대기 6건 시작해」
  - Skeleton 대조 결과 (S2 는 자식을 감싸는 context 래퍼 · 우리는 자식 없는 자리표시 상자) 에 대한 선택 질문에 「S2 래퍼로 전환 (별도 ADR)」
  - 같은 대화의 기준 「전부 S2 로」 (기본값 결정 7-5) · 「이번엔 구조만, 기능은 별도 작업」 (Image · ActionBar 기능 잔여)
- 사용자가 이미 답한 확인 항목: 전환 방향 = S2 래퍼 (자리표시 상자 유지 아님) · 별도 ADR 로 진행.
- 분리 근거: 기존 ADR 의 분리가 아니다 — S2 마이그레이션 체크리스트 ([S2_MIGRATION_CHECKLIST_2026-11.md](../../explanation/research/S2_MIGRATION_CHECKLIST_2026-11.md) §5) 의 마지막 미완 행을 사용자가 별도 ADR 로 지정했다. 선행 결정과의 관계는 [breakdown §1](../design/314-skeleton-s2-wrapper-breakdown.md).
- 아래의 새 이름 (조건 `isSkeleton` · 노드 type `SkeletonCollection`) 은 제안이고 아직 구현되지 않았다. 코드 인용은 main `eed6e7c93` · 설치본 `@react-spectrum/s2` 1.8.2 기준이다.
- 리뷰 round 1 (2026-11-18, [reviews/314.md](../reviews/314.md)) 반영: h1 — CardView 는 지금 collection 의 로딩을 받지 않는다는 실측 (F15) 과 자리 항목의 연결 경로 (nesting · DOM · 반복 수 — F16) 를 더하고, 로딩 원천을 owner · 반복 run 의 조회 상태로 정함 (Decision 7 · R8 · G4 · breakdown §3.4) / m2 — `loading` 과 `loadingMore` 를 나눈 상태 표 (Decision 7 · G4 · breakdown §3.4) / l3 — G5 frame time 의 합격 기준을 대조군 대비 배율로 고정. 수리 검증 round 2 (2026-11-18) — h1 · m2 · l3 fixed · HIGH 0 · 새 MEDIUM 1 (m4 — waterfall 의 자리 수를 `GridLayout` 과 같게 요구) → 기준을 배치 종류별로 나눠 반영 (F16 · Decision 7 · R8 · G4 · breakdown §3.4). **설계 리뷰 종결 (실행자 선언 — round 2 가 「정정 반영 뒤 실행자가 종결 판단 · round 3 불필요」 로 기록)**: pending 0. 제품 구현 · live 는 검증 전이다.

## Context

### 도메인

세 domain 에 모두 닿는다 — 각 domain 의 권위를 그대로 따른다 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md)).

- **D1 (DOM · 접근성)**: S2 `Skeleton` 은 DOM 요소를 내지 않는다. 로딩 중인 글자 · 링크 · 감싼 요소에 `inert` 가 붙고 form 컴포넌트는 비활성이 된다. 지금 우리 Skeleton 은 `div role="status"` 를 낸다 — RAC · S2 어디에도 없는 DOM 이다.
- **D2 (Props)**: S2 표면은 `children` · `isLoading` 둘뿐이다. 지금 binding 의 `size` 는 S2 · design-data · v3 어디에도 없다.
- **D3 (시각)**: 로딩 모양 (gradient · 글자 줄 상자 · 모서리) 의 값은 S2 설치본이 정본이고, Canvas 와 Preview/Publish 가 같은 rule 에서 읽어야 한다. 지금 DOM 의 실효 스타일은 catalog 가 아니라 수동 CSS 다.

### 실측

| #   | 사실                                                                                                                                                                                                                                                                                                                                                                                                                                  | 근거                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | S2 `Skeleton` = `<SkeletonContext.Provider value={isLoading}>{children}</…>` — 요소 없음, prop 은 `children` · `isLoading` (필수)                                                                                                                                                                                                                                                                                                     | S2 `Skeleton.tsx` `Skeleton`                                                                                                                                                         |
| F2  | 로딩 모양은 감싼 컴포넌트가 스스로 낸다 — Text · Link (글자 줄 상자 + `inert`) · Icon · Badge · Meter track (`SkeletonWrapper` — gradient + 자식 숨김 + `inert`) · Image (Avatar 는 Image 를 쓴다) · StatusLight (점 `gray-200`) · Card (메뉴 비활성 · 일러스트 상자)                                                                                                                                                                 | S2 `Content.tsx:131` · `Link.tsx:132` · `Icon.tsx:128` · `Badge.tsx:241` · `Meter.tsx:158` · `Image.tsx:274` · `Card.tsx:426`                                                        |
| F3  | form 컴포넌트는 Skeleton 안에서 비활성 — 자기 `isDisabled` 보다 우선. Button · ActionButton · ToggleButton 은 자기 내용의 context 를 끊는다 (버튼 안 글자 · 아이콘은 로딩 모양이 아님)                                                                                                                                                                                                                                                | S2 `Form.tsx` `useFormProps` · `Button.tsx:462` · `ActionButton.tsx:385` · `ToggleButton.tsx:123`                                                                                    |
| F4  | Heading · Header · Content · Footer · Keyboard 는 참여하지 않는다 — `useSkeletonText` 를 부르는 것은 `Text` 와 `Link` 뿐                                                                                                                                                                                                                                                                                                              | S2 `Content.tsx`                                                                                                                                                                     |
| F5  | 로딩 값: gradient `gray-100` 33% → `light-dark(gray-25, gray-300)` → `gray-100` 66% · `background-size: 300%` · 자식 `visibility: hidden` · 글자 `box-decoration-break: clone` + radius `sm` · 움직임 2 초 `ease-in-out` 무한 (모든 요소 `startTime = 0` 으로 동기 · 움직임 줄이기면 끔)                                                                                                                                              | S2 `Skeleton.tsx` `loadingStyle` · `SkeletonText` · `useLoadingAnimation`                                                                                                            |
| F6  | `SkeletonCollection` = collection 안의 자리 항목 (type `skeleton`) — 함수 자식을 `<Skeleton isLoading>` 으로 감싼다. S2 예제는 `loading` · `loadingMore` 둘 다에서 이것을 렌더한다 (`loading` 은 항목을 비우고, `loadingMore` 는 기존 카드를 둔 채 뒤에). CardView 는 이 항목이 있으면 빈 상태를 그리지 않는다                                                                                                                        | S2 `SkeletonCollection.tsx` · `CardView.tsx:305 · 332` · `references/components/CardView.md:433`                                                                                     |
| F7  | 우리 Skeleton = 자식 없는 internal leaf (`div role="status"`) — `size` · `isLoading` · `dataBinding` 을 받고, `isLoading: false` 면 노드를 숨긴다                                                                                                                                                                                                                                                                                     | `Skeleton.binding.ts` · `nestingRules.ts:326 · 485` · `presence.ts:2424` `catalogSkeletonIdle`                                                                                       |
| F8  | DOM 실효 스타일은 수동 `styles/Skeleton.css` 1,189 줄 (`index.css:41` 로 로드) 이고 생성 CSS `generated/Skeleton.css` 는 로드되지 않는다. `Skeleton.tsx` 539 줄은 `componentVariant` 31 종을 갖는다                                                                                                                                                                                                                                   | `componentRulesTable.ts:12102` 주석 · `components/Skeleton.tsx`                                                                                                                      |
| F9  | shared 컴포넌트 12 파일이 자기 `isLoading` 에서 `<Skeleton componentVariant>` 를 쓴다. catalog DOM registry 는 그중 Badge · Breadcrumbs · ListBox · Tabs · Tree 를 가져온다 — catalog 문서에서 이 경로에 닿는지는 미확인                                                                                                                                                                                                              | `components/{Tabs,Link,Slider,ListBox,…}.tsx` · `domRegistry.runtime.ts:3 · 7 · 30 · 46 · 54`                                                                                        |
| F10 | 엔진은 `display: contents` (상자 없는 노드) 를 지원하고, 요소 없는 RAC 컴포넌트를 이 방식으로 둔 선례가 있다 (Autocomplete — 자기 상자 = 자식의 합, 선택용)                                                                                                                                                                                                                                                                           | `packages/engine/src/tree.rs:8131` · `componentRulesTable.ts:1113` · `stateStyles.ts:124`                                                                                            |
| F11 | 조상의 값을 자손 record 에 읽는 시점 전달이 이미 있다 — Form context (두 consumer 가 한 record 를 읽음)                                                                                                                                                                                                                                                                                                                               | `resolver.ts:1802` `applyFormContext` · `document/formContext.ts`                                                                                                                    |
| F12 | Canvas 글자는 범위의 줄 상자를 구할 수 있다 (밑줄 그리기가 사용)                                                                                                                                                                                                                                                                                                                                                                      | `nodeRendererText.ts:985` `paragraph.getRectsForRange`                                                                                                                               |
| F13 | collection 에 연결한 Skeleton 은 collection 의 로딩을 `isLoading` 으로 받는다 (Preview · Publish — Canvas 는 작성값)                                                                                                                                                                                                                                                                                                                  | `resolver.ts:2068` · `preview/catalog/__tests__/loadingState.test.tsx`                                                                                                               |
| F14 | 문서 contract 는 70 이다. Skeleton 을 인용하는 테스트는 11 파일                                                                                                                                                                                                                                                                                                                                                                       | `document/types.ts:178`                                                                                                                                                              |
| F15 | CardView 는 collection 의 로딩을 받지 않는다 — 로딩 전달 대상 목록에 없고 (Table · ListBox · GridList · Tree · Menu · Select · ComboBox · Skeleton), 리뷰의 Preview 프로브에서 요청 보류 중 CardView `loadingState` 는 `undefined` 였다. nesting 은 Card 만 받고 DOM 도 Card 자식만 그린다. 끝의 「더 보기」 sentinel 은 이미 있다                                                                                                    | `resolver.ts:390 · 2069` · `componentTraits.ts:466` · `delegatedDom.runtime.ts:3886 · 3931` · [reviews/314.md](../reviews/314.md) H1                                                 |
| F16 | S2 의 자리 수는 RAC `GridLayout` · `WaterfallLayout` 이 낸다 — type `skeleton` 항목을 `GridLayout` 은 지금 행 끝까지 반복하고 화면을 채울 때까지 행을 더하고, `WaterfallLayout` 은 모든 열에 하나 이상 둔 뒤 화면을 채운다 (Virtualizer 안에서 — 같은 입력에 수가 다름: 리뷰 round 2 프로브 1 개 · 2 개). 우리 CardView 의 배치 경로는 셋이다 — 가상 스크롤 아님 (flex wrap) · `CatalogWaterfallGrid` · 가상 스크롤 (ADR-310 Phase 8) | `react-stately` `layout/GridLayout.js:60 ~ 115` · `layout/WaterfallLayout.js:98 ~ 112` · `delegatedDom.runtime.ts:3898 · 3924` · `waterfall.components.tsx` · `virtualListLayout.ts` |

### Hard constraints

- **HC1 (D1)**: Skeleton 은 Preview · Publish DOM 에 요소를 내지 않는다 — 감싼 자식은 Skeleton 부모의 flex · grid 항목으로 배치된다.
- **HC2 (D2)**: Skeleton 의 보이는 prop 은 `isLoading` 과 composition 확장 `dataBinding` 뿐이다 — `d2S2Alignment.static.test.ts` 통과.
- **HC3 (배치 불변)**: `isLoading` 을 켜고 끌 때 모든 자손의 위치 · 크기 차이가 0 이다 (S2 가 Skeleton 을 두는 이유 — 내용이 나타날 때 배치가 흔들리지 않음).
- **HC4 (D3 대칭)**: 참여 컴포넌트의 로딩 모양은 catalog rule 한 곳에서 나오고 Canvas 와 Preview 의 결과가 같다 — 값은 `d3S2Alignment.static.test.ts` 로 설치본과 대조한다.
- **HC5 (성능)**: Canvas 는 로딩 모양을 정지 프레임으로 그린다 (계속 다시 그리지 않음 — frame time 기준 유지). 번들은 ADR-201 상한 안.
- **HC6 (문서)**: 문서 변환 코드를 쓰지 않는다 (사용자 원칙 2026-11-18). 옛 문서의 자식 없는 Skeleton 은 아무것도 그리지 않는 래퍼가 된다.

### Soft constraints

- 사용자는 비개발자다 — 「실제 내용을 넣고 Skeleton 으로 감싼다」 는 저작 모델이 패널 · Layers 에서 그대로 읽혀야 한다.
- 요소 없는 노드의 Canvas 선택 · 빈 상태 표시는 Autocomplete 선례 하나뿐이다.

## Alternatives Considered

업계 패턴: 자리표시 방식은 둘로 갈린다. **감싸기** — S2 (`Skeleton isLoading > 실제 컴포넌트`, 표본 데이터로 실제 배치를 재현) · Chakra UI (`Skeleton isLoaded > children`) · Ant Design (`Skeleton loading > children`) · MUI (자식을 주면 자식 크기를 따름). **독립 도형** — shadcn/ui (`div` 에 크기 class) · MUI · Chakra · Ant Design 의 `text` · `circular` · `avatar` · `paragraph` 프리셋. 지금 우리 구현은 독립 도형 쪽이다.

### 대안 A: 지금 그대로 (자식 없는 자리표시 상자) + 차이 기록

- 설명: `div role="status"` leaf 와 수동 CSS 를 유지하고 체크리스트에 「S2 대응 없음」 으로 남긴다.
- 위험: 기술(L) / 성능(L) / 유지보수(M) / 마이그레이션(L)
- 유지보수 M — D1 · D2 · D3 세 곳의 차이 (없는 DOM · 없는 prop · catalog 밖 수동 CSS 1,189 줄) 가 남고, 사용자가 자리표시 상자의 크기를 실제 내용에 손으로 맞춰야 한다 (HC3 을 보장할 수단이 없다).

### 대안 B: 자식을 받는 래퍼 + DOM 요소 (`div`)

- 설명: Skeleton 을 container 로 바꾸되 DOM 에 `div` 를 내고, 로딩 모양은 자손이 낸다.
- 위험: 기술(L) / 성능(L) / 유지보수(M) / 마이그레이션(M)
- 구현은 가장 단순하다 (상자가 있어 선택 · 빈 상태 표시가 기존 container 와 같다). 그러나 HC1 위반 — 감싼 자식이 Skeleton 부모의 flex · grid 항목이 아니게 되어 S2 코드와 배치가 달라지고, Code 보기에서 가져온 S2 예시가 다르게 놓인다.

### 대안 C: 요소 없는 래퍼 + 읽는 시점 context 전달 + rule 조건 하나 (S2 그대로)

- 설명: Skeleton 은 `display: contents` 노드 (DOM 은 요소 없음) 이고, resolver 가 가장 가까운 Skeleton 의 `isLoading` 을 자손 record 에 전달한다 (버튼 내용에서 끊김 — F3). 참여 컴포넌트는 rule 의 조건 `isSkeleton` 가지에서 로딩 모양을 읽는다 — 생성 CSS 와 Canvas 가 같은 가지를 쓴다. 자리표시 상자 모드 · `size` · 수동 CSS 는 없앤다. `SkeletonCollection` 을 collection 의 자리 항목으로 추가한다.
- 위험: 기술(M) / 성능(L) / 유지보수(L) / 마이그레이션(M)
- 기술 M — 요소 없는 노드의 선택 · 빈 상태 (선례 Autocomplete 1), Canvas 의 글자 줄 상자 (F12 로 가능), instance · slot · 반복 항목을 지나는 전달. 마이그레이션 M — 옛 자리표시 Skeleton 이 빈 래퍼가 된다 (HC6).

### 대안 D: C + 자식 없는 Skeleton 은 지금의 자리표시 상자 (두 모드)

- 설명: 자식이 있으면 S2 래퍼, 없으면 지금의 상자를 그린다 (MUI · Chakra 가 두 모드를 같이 제공).
- 위험: 기술(M) / 성능(L) / 유지보수(M) / 마이그레이션(L)
- 옛 문서가 그대로 보인다. 그러나 한 type 에 뜻이 둘이다 — 「자식 없는 Skeleton」 이 S2 에서는 아무것도 없는 것이고 우리에서는 상자다. `size` · `role="status"` · 수동 CSS (또는 그 rule 이관) 가 남아 HC1 · HC2 가 자식 없는 경우에 깨진다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ |
| ---- | :--: | :--: | :------: | :----------: | :---: |
| A    |  L   |  L   |    M     |      L       |   0   |
| B    |  L   |  L   |    M     |      M       |   0   |
| C    |  M   |  L   |    L     |      M       |   0   |
| D    |  M   |  L   |    M     |      L       |   0   |

HIGH 이상인 대안이 없다 — 루프 추가 없이 판정한다.

## Decision

**대안 C 를 채택한다.**

1. **Skeleton = 요소 없는 container.** 자식을 받고 DOM 에 요소를 내지 않는다. Canvas 는 `display: contents` 로 배치하고 자기 상자 (자식의 합) 는 선택에만 쓴다.
2. **prop 은 `isLoading` 과 `dataBinding`.** (2026-11-19 사용자 재제기로 `dataBinding` 삭제 — 「Skeleton 에서도 · 자식에서도 같은 collection 을 두 번 고르는 것은 불편, 자식의 data 를 같이 쓰면 된다」. Preview 의 Skeleton 은 안쪽 (다음 Skeleton · SkeletonCollection 전까지) 에 연결된 노드의 collection 중 하나라도 `loading` 이면 로딩, 연결된 노드가 있고 모두 아니면 로딩 아님, 없으면 작성 `isLoading` — resolver `skeletonContentLoading` · `resolution/skeletonOwner.ts`, 행 갱신 영역은 그 Skeleton 으로 넓힌다 — `planBindingOwners`.) `size` 를 지운다. `isLoading: false` 면 감싼 내용이 보통 모양으로 보인다 (지금의 「노드를 숨김」 을 대체). collection 연결 시 로딩을 받는 동작 (F13) 은 그대로다.
3. **로딩 여부는 resolver 가 자손에 전달한다.** 가장 가까운 Skeleton 의 `isLoading` 이 자손 record 의 한 필드가 되고, Button 계열은 자기 내용에서 끊는다. 두 consumer 가 같은 record 를 읽는다.
4. **로딩 모양은 감싼 컴포넌트의 rule 이 낸다.** 참여 범위는 S2 그대로 — Text · Link · Icon · Image (Avatar) · StatusLight · Badge · Meter · Card. Heading 등은 참여하지 않는다 (F4). 값은 S2 설치본 (F5).
5. **form 컴포넌트는 Skeleton 안에서 비활성**이고 로딩 중인 요소는 `inert` 다 (자기 `isDisabled` 보다 우선).
6. **움직임은 Preview · Publish 에서만** — S2 의 2 초 동기 움직임, 움직임 줄이기 설정이면 끔. Canvas 는 정지 프레임.
7. **`SkeletonCollection`** 을 CardView 의 자리 항목으로 추가한다 — 감싼 Card 템플릿을 로딩 모양으로 그린다. 로딩의 원천은 그 CardView 의 조회 상태다 (owner 연결이면 그 조회, 반복 항목이면 그 run — collection 전역 상태가 아님): CardView 가 `loadingState` 를 받게 하고 자리 항목이 그것을 읽는다. `loading` = 자리 항목만 (화면을 채움) · `loadingMore` = 기존 카드 뒤에 자리 항목 · 그 밖 (`idle` · `error` …) = 없음. 반복 수는 배치 종류의 RAC 기준을 따른다 — grid 는 `GridLayout`, waterfall 은 `WaterfallLayout` (같은 입력에서 수가 다르다) — 가상 스크롤이든 아니든 같은 결과. 일반 Skeleton 의 연결 동작 (F13 — `loading` 만) 은 그대로다.
8. **수동 `Skeleton.css` · `componentVariant` 는 Skeleton 노드의 근거에서 뺀다.** 파일 삭제는 도달 경로 조사 (F9) 뒤 사용자 승인으로.

위험 수용 근거: C 의 기술 M 은 선례가 있는 기구 셋 (`display: contents` · 읽는 시점 context · 조건 트리) 의 조합이라 새 기구가 없다. 마이그레이션 M 은 사용자 원칙 (문서 변환 없음) 안에서 「옛 자리표시 상자가 보이지 않게 됨」 으로 한정된다.

기각 사유:

- **A**: 사용자가 전환을 결정했다. 세 domain 의 차이와 수동 CSS 가 남는다.
- **B**: HC1 위반 — 요소 하나가 감싼 내용의 배치를 S2 와 다르게 만든다.
- **D**: 한 type 에 뜻이 둘이 되고, 자식 없는 경우에 HC1 · HC2 가 깨진다. 옛 문서 호환은 이 저장소의 지금 단계에서 요구가 아니다 (HC6).

> 구현 상세: [314-skeleton-s2-wrapper-breakdown.md](../design/314-skeleton-s2-wrapper-breakdown.md)

### 사용자 결정 5건

execute-adr 가 해당 Phase 에 닿을 때 묻는다.

1. **옛 문서의 자리표시 Skeleton** (Phase 1) — contract 를 올리지 않고 빈 래퍼로 열리게 둘지 (권고 — Phase 0 에서 남은 `size` 값이 문서 검증을 통과하는지 확인한 경우), contract 71 로 옛 프로젝트를 열지 않을지. → **확정 2026-11-18: contract 71** (Phase 0 실측 — `size` 는 검증을 통과하지 못한다 · 저장소 관행 = prop 삭제 시 contract 올림).
2. **팔레트에서 놓을 때의 기본 내용** (Phase 1) — 표본 내용 (Image + Text 두 줄 — S2 문서 예시, 권고) 인지 빈 래퍼인지. → **확정 2026-11-18: 표본 내용** → **2026-11-19 사용자 재제기로 변경: 빈 래퍼** (사용자 「기본 frame 이 따라 들어오는데 불필요」 — 실제 내용 (Table 등) 을 감싸는 용도라 표본을 매번 지워야 했다. 놓은 Skeleton 은 결정 3 의 점선 자리로 보이고, 고른 채 넣는 내용이 그 안에 들어간다. `component-skeleton` = 루트 slot `Content` 만).
3. **빈 Skeleton 의 Canvas 표시** (Phase 1) — 편집용 점선 자리 (Canvas 전용, 권고) 인지 Layers 로만 선택하는지. → **확정 2026-11-18: 편집용 점선 자리**.

> **후속 (2026-11-19, 사용자 결정 「S2 와 맞게」)**: Table 의 Column · Cell 원본이 가진 글자 Text (`Column > frame > Text` · `Cell > Text` — 같은 날 `2e449e6a7` 로 노드가 됨) 는 Skeleton 참여자가 아니다 — S2 `TableView.tsx` 는 그 글자를 `Text` 가 아닌 `span` (`columnHeaderText` · `cellContent`) 으로 그린다. 판정 `skeletonContext.ts` `tablePartWords` (Cell 의 첫 Text · Column 내용 frame 의 첫 Text), 회귀 `adr314SkeletonContext.test.tsx`, live `adr314-skeleton-derived-loading-live.mjs` (표 안 로딩 글자 0).
4. **수동 `Skeleton.css` · `Skeleton.tsx` 의 `componentVariant` 삭제** (Phase 5) — 도달 경로 조사 결과를 보고 승인. → **확정 2026-11-18: 삭제** (사용자 「수동 css삭제」 — Builder chrome 의 Button `isLoading` 두 곳은 Phase 5 에서 함께 정리).
5. **번들 상한 초과 시** (Phase 5) — 초과분 수용인지 범위 축소인지 (삭제가 승인되면 순감 예상). → **확정 2026-11-18: 번들 상한 안** (사용자 「번들 상한」 — Phase 5 에서 기준선 대비 Δ 를 재고 상한 안을 확인).

## Risks

| ID  | 위험                                                                                                                                                   | 심각도 | 대응                                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | --------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 요소 없는 노드의 선택 · 끌어 놓기 · 빈 상태가 기존 container 흐름과 달라 편집이 막힌다                                                                 |  MED   | Phase 1 에서 Autocomplete 경로 재사용 · live 에서 삽입 · 자식 넣기 · 꺼내기 · 삭제 (G1)                                           |
| R2  | 전달이 instance · slot · 반복 항목 · overlay 에서 끊겨 일부 자손만 로딩 모양이 된다                                                                    |  MED   | Phase 2 검사가 네 경로를 각각 덮는다 (G2)                                                                                         |
| R3  | 로딩 모양이 배치를 바꾼다 (글자 줄 상자 · 숨김 방식이 크기에 영향)                                                                                     |  MED   | HC3 검사 — 참여 8 종의 `isLoading` 켬 · 끔 geometry 차이 0 (G3)                                                                   |
| R4  | Canvas 글자 줄 상자가 Preview 와 다르다 (여러 줄 · 말줄임 · 정렬)                                                                                      |  MED   | `/cross-check` — 한 줄 · 여러 줄 · 말줄임 세 경우 (G3)                                                                            |
| R5  | 수동 CSS 를 빼면 shared 컴포넌트의 자기 로딩 경로 (F9) 가 깨진다                                                                                       |  MED   | Phase 0 도달 조사 → 닿는 경로가 있으면 그 컴포넌트를 범위에 넣거나 삭제 범위에서 뺀다 (G0)                                        |
| R6  | 옛 문서의 자리표시 Skeleton 이 사라져 화면이 비어 보인다                                                                                               |  LOW   | 사용자 결정 1 · CHANGELOG Breaking 표기                                                                                           |
| R7  | Preview 의 움직임이 많은 요소에서 frame 을 떨어뜨린다                                                                                                  |  LOW   | S2 와 같은 Web Animations 동기 방식 · 로딩 요소 200 개에서 frame time 측정 (G5)                                                   |
| R8  | CardView 의 로딩 전달 · 자리 항목 연결 · 반복 수가 배치 경로 셋 (flex wrap · waterfall · 가상 스크롤) 과 조회 단위 둘 (owner · 반복 run) 에서 어긋난다 |  MED   | Phase 4 가 경로 셋 × 상태 둘을 각각 검사 · 반복 수는 grid = RAC `GridLayout` · waterfall = RAC `WaterfallLayout` 결과와 대조 (G4) |

잔존 HIGH 위험 없음.

## Gates

HIGH 위험은 없지만 phase 종결 조건으로 둔다. 집행은 로컬 검사 (vitest · `pnpm codex:preflight`) 와 live 확인이다.

| Gate | 시점    | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 실패 시 대안                                                                                                  |
| ---- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| G0   | Phase 0 | 참여 컴포넌트 표 (설치본 줄 번호) · F9 도달 경로 · 옛 `size` 값의 문서 검증 결과 · 번들 기준선 · Skeleton 인용 테스트 11 의 처리 분류 · CardView 배치 경로 셋의 자리 항목 진입점과 RAC `GridLayout` · `WaterfallLayout` 반복 규칙이 breakdown 에 고정                                                                                                                                                                                                            | 미확인 항목을 Phase 0 에 남기고 다음 Phase 착수 보류                                                          |
| G1   | Phase 1 | DOM 에 Skeleton 요소 0 · 감싼 자식이 Skeleton 부모의 항목으로 배치 (Canvas = Preview 위치) · `d2S2Alignment` 통과 · 삽입 · 자식 넣기 · 꺼내기 · 삭제 · Undo                                                                                                                                                                                                                                                                                                      | 선택 · 빈 상태만 막히면 사용자 결정 3 재질문                                                                  |
| G2   | Phase 2 | 전달이 직접 자손 · instance · slot · 반복 항목에 닿고 Button 내용에서 끊김 · form 컴포넌트 비활성 · `inert` (원복 RED 각 1)                                                                                                                                                                                                                                                                                                                                      | 끊기는 경로를 수리 — 전달 자리를 record 구축으로                                                              |
| G3   | Phase 3 | 참여 8 종 `isLoading` 켬 · 끔 geometry 차이 0 · Canvas = Preview (`/cross-check` — 기준은 실제 브라우저 `getBoundingClientRect` · 글자 한 줄 · 여러 줄 · 말줄임) · `d3S2Alignment` 통과 · 수동 CSS 가 Skeleton 노드에 주는 값 0                                                                                                                                                                                                                                  | 차이가 나는 종을 수리, 값 차이는 분류 목록에 사유                                                             |
| G4   | Phase 4 | 실제 collection 요청을 보류한 Preview 에서 (작성값 주입 아님) CardView 가 `loadingState` 를 받음 · `loading` = 자리 항목만 · `loadingMore` = 기존 카드 유지 + 뒤에 자리 항목 · 응답 뒤 · 오류 때 자리 항목 0 · 빈 상태와 겹치지 않음 — owner 연결 · 반복 run 각각, 배치 경로 셋 각각. 반복 수 = 같은 입력의 RAC 결과 — grid 는 `GridLayout`, waterfall 은 `WaterfallLayout` (원복 RED 각 1) · 내용 높이 CardView 의 수는 자체 정책 기대값. Canvas 는 템플릿 1 개 | 가상 스크롤 아님 + grid 만 먼저 닫고 나머지 경로를 Phase 4 안에서 이어 닫음 (범위 축소는 결정 지점 ④ 로 질문) |
| G5   | Phase 5 | 번들 ADR-201 상한 안 (또는 사용자 결정 5) · Canvas 가 로딩 모양 때문에 계속 다시 그리지 않음 · 로딩 요소 200 개 Preview frame time p95 ≤ 대조군 p95 × 1.2 — 대조군은 같은 문서의 `isLoading` 끔, 교대 3 쌍의 중앙값 (production build · 보이는 탭 · CPU throttle 4x 병기 · 합성 문서는 규모 근거로만) · 회귀 새 실패 0                                                                                                                                           | 움직임을 묶음 단위로 줄임                                                                                     |
| G6   | 종결    | 실제 builder 에서 Skeleton 삽입 → 내용 감싸기 → `isLoading` 켬 · 끔 → collection 연결 → Publish 확인 + 사용자 확인                                                                                                                                                                                                                                                                                                                                               | 사용자 지적을 수리한 뒤 재확인                                                                                |

### Live Exercise

- **2026-11-18 · Chrome MCP (dev 5173, 사용자 Chrome) + 사용자 확인 「확인했다」**: dev 핸들로 새 프로젝트 「Skeleton 샘플」 을 만들었다 (팔레트 넣기 · 지우기 · 데이터 연결 명령 — 사용자 편집과 같은 `workspace.execute`). 1 Skeleton 기본 (Image + 제목 · 본문) · 2 `Skeleton > Card` Loading 켬 · 2-b Loading 끔 · 3 `Skeleton > Card` + People collection 연결 · 4 CardView + SkeletonCollection + 연결 (원격 endpoint = 로컬 2.5 초 지연 서버, 6 개씩 3 쪽). Builder Canvas: 1 · 2 로딩 모양 (그림 상자 · 글자 줄 상자 · 비활성 Action) · 2-b 보통 카드 · Layers 의 Skeleton > Card · CardView > SkeletonCollection > Card. 사용자가 같은 프로젝트로 Builder · Publish 를 확인했다.
- **2026-11-18 · Playwright (headed Chrome, dev 5173) — 같은 구성의 Publish**: 0.8 초 (요청 보류 중) — 로딩 모양 요소 21 · Web Animation 21 · `inert` Card 6 (2 · 3 · CardView 자리 4) · 2-b 보통 · CardView 카드 행 0. 4.3 초 (응답 뒤) — 3 은 보통 카드로 · 1 · 2 는 그대로 · CardView 카드 6 (김하늘 …) + 미리 부른 다음 쪽의 자리 4. 오류 0.
- **Phase 별 live** (상세 [breakdown §7](../design/314-skeleton-s2-wrapper-breakdown.md)): Phase 1 Chrome MCP (놓기 · Publish DOM 요소 0 · Loading 끄기 · 빈 자리 · Undo · 고른 채 넣기) · Phase 2 Publish DOM (`inert`) · Phase 3 Canvas 모양 + Publish 움직임 대조 · Phase 4 Playwright 요청 보류 네 상태 5/5 · Phase 5 production frame (교대 3 쌍 p95 비율 1.00) · Canvas 정지 (렌더 카운터 0).

## Consequences

### Positive

- Skeleton 이 세 domain 에서 S2 와 같아진다 — 요소 없음 · prop 둘 · 로딩 값은 catalog rule. S2 체크리스트 §5 가 전부 닫힌다.
- 자리표시의 크기를 손으로 맞출 필요가 없다 — 실제 내용이 자기 자리표시다 (HC3).
- 수동 CSS 1,189 줄과 `componentVariant` 31 종이 Skeleton 노드의 근거에서 빠진다 (삭제 승인 시 번들 순감).
- collection 로딩 자리 (`SkeletonCollection`) 가 생겨 CardView 가 S2 의 로딩 화면을 낼 수 있다.

### Negative

- 옛 문서의 자리표시 Skeleton 은 보이지 않게 된다 (Breaking — 변환 없음).
- 요소 없는 노드가 하나 더 생긴다 — Canvas 선택 · 빈 상태 표시를 Autocomplete 와 같은 경로로 유지해야 한다.
- 참여 컴포넌트 8 종의 rule 에 `isSkeleton` 가지가 늘고, resolver 의 조상 전달이 하나 더 는다.
- Skeleton 을 인용하는 테스트 11 파일 (`s2SkeletonDropZone` · `loadingState` 등) 의 계약이 바뀐다.
