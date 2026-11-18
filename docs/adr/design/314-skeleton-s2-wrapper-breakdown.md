# ADR-314 breakdown — Skeleton 을 S2 래퍼로

> 본문: [314-skeleton-s2-wrapper.md](../completed/314-skeleton-s2-wrapper.md). 코드 인용은 main `eed6e7c93` · 설치본 `@react-spectrum/s2` 1.8.2 기준. 새 이름 (`isSkeleton` · `SkeletonCollection`) 은 제안이다.

## 1. 선행 결정과의 관계 (fork 4 질문)

이 ADR 은 기존 ADR 의 분리가 아니다 — S2 체크리스트 §5 의 미완 행을 사용자가 별도 ADR 로 지정했다 (2026-11-18 「S2 래퍼로 전환 (별도 ADR)」).

1. **base / 응용**: 단독 ADR. 기존 기구를 쓰는 쪽이다 — ADR-248 (catalog runtime) · ADR-256 Phase 6g (`display: contents`) · ADR-297 (조건 트리) · ADR-310 (collection 로딩 · 반복 항목).
2. **schema 직교성**: 문서 스키마 변경 없음. Skeleton 노드가 자식을 갖게 되고 (`NodeEntry.children`) prop `size` 가 빠진다. `SkeletonCollection` 은 새 definition 하나.
3. **선행 전제 방향**: 위 네 ADR 은 이 ADR 을 모른다. 이 ADR 이 그 기구를 바꾸지 않으면 방향 반전은 없다 — 조건 트리에 조건 하나 (`isSkeleton`) 를 더하는 것은 `isStandalone` (2026-11-18) 과 같은 확장이다.
4. **판독**: 전제 검증은 위 1 ~ 3 과 본문 Status 의 사용자 원문으로 닫는다.

## 2. S2 참여 표 (Phase 0 에서 줄 번호 재확인)

| S2 컴포넌트                                    | 로딩 때                                                                                                          | 우리 대응                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Text (`Content.tsx:131`)                       | 글자를 `span` 으로 감싸 줄 상자마다 gradient (`box-decoration-break: clone` · radius `sm`) · 글자 투명 · `inert` | binding `text` 의 record                  |
| Link (`Link.tsx:132`)                          | Text 와 같은 글자 처리 · 요소 `inert` · 스타일 가지 `isSkeleton` (값 Phase 0)                                    | Link                                      |
| Icon (`Icon.tsx:128`)                          | `SkeletonWrapper` — gradient · 자식 숨김 · `inert` · radius `sm`                                                 | Icon (아이콘 종류는 S2 정렬 대상 아님)    |
| Image (`Image.tsx:274`)                        | gradient + 움직임 · 오류 표시 · 드러내기 없음                                                                    | Image · Avatar (S2 Avatar 는 Image 를 씀) |
| StatusLight (`StatusLight.tsx:150`)            | 점 fill `gray-200` · 글자는 Text 처리                                                                            | StatusLight                               |
| Badge (`Badge.tsx:241`)                        | `SkeletonWrapper` 로 전체 상자                                                                                   | Badge                                     |
| Meter (`Meter.tsx:158`)                        | `SkeletonWrapper` 로 track (fill 숨김) · 라벨 · 값은 Text 처리                                                   | Meter                                     |
| Card (`Card.tsx:426 · 699`)                    | ActionMenu 비활성 · 일러스트 상자 `SkeletonWrapper` · context 를 자식에 다시 제공                                | Card · CardPreview                        |
| form (`Form.tsx` `useFormProps`)               | `isDisabled = true` (자기 값보다 우선)                                                                           | `CATALOG_FORM_FIELDS` (`formContext.ts`)  |
| Button · ActionButton · ToggleButton           | 내용에 `SkeletonContext = null` — 버튼 안 글자 · 아이콘은 로딩 모양 아님. 버튼 자신은 form 규칙으로 비활성       | Button 계열                               |
| Heading · Header · Content · Footer · Keyboard | 참여 없음                                                                                                        | 그대로                                    |

`SkeletonWrapper` 는 context 를 `null` 로 바꿔 감싼 요소 안쪽이 다시 로딩 모양을 내지 않게 한다 (Badge 안 Text 는 숨겨질 뿐).

## 3. 설계

### 3.1 노드 · binding

- `Skeleton.binding.ts`: `accepts` = `isLoading` (boolean · 기본 true · section `state`) · `dataBinding`. `size` 삭제. `source` 는 요소 없는 container (렌더러가 자식만 낸다).
- `nestingRules.ts`: Skeleton 을 leaf 목록 두 곳 (`:326` · `:485`) 에서 빼고 container 로.
- rule `Skeleton`: `variants` · `sizes` 의 상자 값 삭제, `containerStyles.display: "contents"` (Autocomplete 선례 `componentRulesTable.ts:1113`).
- `presence.ts` `catalogSkeletonIdle` 삭제 — `isLoading: false` 는 「숨김」 이 아니라 「보통 모양」 이다.
- `d2Provenance.ts`: `Skeleton.dataBinding` = `composition`.
- origin template: 사용자 결정 2 (표본 내용 또는 빈 래퍼).

### 3.2 전달

- resolver 에 `applySkeletonContext` — `applyFormContext` (`resolver.ts:1802`) 와 같은 자리. 가장 가까운 Skeleton 조상의 해석된 `isLoading` 을 자손 record 의 파생 필드로 둔다.
- 끊김: Button · ActionButton · ToggleButton · LinkButton 의 자손, `SkeletonWrapper` 대응 컴포넌트 (Icon · Badge · Meter track · Card 일러스트) 의 자손.
- form 비활성: `CATALOG_FORM_FIELDS` 의 record 에 `isDisabled = true` (Form context 뒤에 적용 — S2 「Skeleton always wins」).
- 파생 필드를 더할 때 따를 것: 증분 rebuild 의 버릴 목록 · canvasBinding seeds (메모리 `feedback-new-record-field-needs-incremental-rebuild-drop` · `feedback-canvas-binding-new-invalidation-needs-seed`).
- 덮어야 할 경로: 직접 자손 · instance (원본 안 Skeleton / instance 를 감싼 Skeleton) · slot 채움 · 반복 항목 (ADR-310 `repeat`) · overlay 본체 (Skeleton 밖에 그려지는 Popover — S2 는 portal 이라도 React context 가 닿는다).

### 3.3 로딩 모양

- `conditionTree.ts` 에 조건 `isSkeleton` (선택자 `[data-skeleton]`) 추가.
- 공용 값: gradient 세 지점 · `background-size: 300%` · 자식 숨김 — 한 상수로 두고 참여 rule 의 `isSkeleton` 가지가 참조.
- 글자: Canvas 는 `getRectsForRange` 줄 상자마다 둥근 상자 (radius `sm`), 글자는 그리지 않음. DOM 은 S2 와 같은 `span` 감싸기.
- Canvas 정지 프레임의 gradient 위치는 한 값으로 고정 (움직임 시작 위치).
- Preview · Publish 움직임: S2 `useLoadingAnimation` 과 같은 Web Animations (2000 ms · `ease-in-out` · 무한 · `startTime = 0`), `prefers-reduced-motion` 이면 없음.
- `packages/rendering` CSS 생성기가 새 조건 · 값을 내는지 확인 (`CSSGenerator.containerStyles.test.ts` 의 키 검사).

### 3.4 SkeletonCollection

(리뷰 round 1 h1 · m2 반영 — [reviews/314.md](../reviews/314.md).)

**노드 · 연결**

- 새 definition `SkeletonCollection` — CardView 의 자식, 자식은 Card 템플릿 하나. 템플릿은 `isSkeleton` 으로 그린다 (§3.2 의 전달 — `SkeletonCollection` 이 Skeleton 조상과 같은 원천).
- nesting: `componentTraits.ts:466` `CardView.children` 에 `SkeletonCollection` 추가, `SkeletonCollection` 의 자식은 `Card`.
- DOM: `delegatedDom.runtime.ts` `cardview` 의 `ownsChild` · `cards` 거르기 (`:3886 ~ 3893`) 가 자리 항목을 받고, 순서는 S2 와 같이 카드 run → 자리 항목 → 「더 보기」 sentinel (`:3931`).

**로딩 원천** (지금 CardView 는 로딩을 받지 않는다 — 본문 F15)

- `resolver.ts:390` `LOADING_STATE_TYPES` 에 CardView 추가 — owner 연결이면 그 조회의 `loadingState`, 연결 없는 CardView 는 반복 run 의 상태 (`runsLoadingState` — `resolver.ts:1021`, ADR-310 Decision 11) 가 CardView record 의 `loadingState` 가 된다.
- 자리 항목은 부모 CardView record 의 `loadingState` 를 읽는다. collection 전역 상태를 따로 읽지 않는다 — 같은 collection 을 다른 조건으로 조회하는 두 CardView 가 서로의 로딩을 그리지 않게.
- CardView 가 받은 `loadingState` 를 RAC GridList 에 넘길지 (빈 상태 · `aria-busy`) 는 Table 의 처리 (`domBinding.runtime.ts:3026`) 를 따라 Phase 4 에서 정한다.

**상태 표**

| CardView `loadingState`                    | 카드                  | 자리 항목                                                 | 빈 상태  |
| ------------------------------------------ | --------------------- | --------------------------------------------------------- | -------- |
| `loading`                                  | 없음 (S2 예제와 같음) | 있음 — 화면을 채움 (수는 아래 「반복 수」)                | 안 그림  |
| `loadingMore`                              | 기존 카드 유지        | 있음 — 기존 카드 뒤 (수는 아래 「반복 수」 — 배치 종류별) | 안 그림  |
| `idle` · `error` · `sorting` · `filtering` | 그대로                | 없음                                                      | 규칙대로 |
| Canvas (요청 없음)                         | 표본 카드             | 템플릿 1 개 (편집 대상 — 반복 없음)                       | —        |

- 일반 Skeleton 의 연결 (F13) 은 `loading` 일 때만 `isLoading` 이다 — 이 표와 별개로 그대로 둔다.
- Canvas 에서 템플릿을 숨기는 수단은 Phase 4 에서 기존 표시 기구를 조사해 정한다.

**반복 수** (본문 F16 — 리뷰 round 2 m4 반영)

배치 종류마다 기준이 다르다. 같은 입력 (화면 420 × 100 · 카드 200 × 200 · 간격 10 · 기존 카드 1) 에서 설치본 `GridLayout` 은 자리 항목 1 개, `WaterfallLayout` 은 2 개를 낸다 (리뷰 프로브 `.agent/runs/2026-11-18-adr314-review-round2/layout-probe.mjs` — 로컬).

| 배치                  | 기준 (설치본 `react-stately` 3.51.0)                     | 끝나는 조건                                                                   |
| --------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------- |
| grid (flex wrap 포함) | `GridLayout` (`layout/GridLayout.js:60 ~ 115`)           | 지금 행 끝까지 반복 → 화면 높이를 채울 때까지 행을 더함                       |
| waterfall             | `WaterfallLayout` (`layout/WaterfallLayout.js:98 ~ 112`) | 모든 열에 자리 항목이 하나 이상 → 화면 높이를 채울 때까지 가장 짧은 열에 더함 |

- 가상 스크롤 (ADR-310 Phase 8): RAC layout 이 type `skeleton` 항목을 직접 펼친다 — 우리 layout 감싸개 (`virtualListLayout.ts` · `virtualGrid.ts`) 가 그 항목을 지나가게만 한다.
- 가상 스크롤 아님: 배치 종류를 받는 순수 계산을 둔다. grid 입력 = 폭 · 높이 · 카드 크기 · 간격 · 기존 카드 수. waterfall 입력은 여기에 열별 누적 높이 (기존 카드 높이에서 — `waterfall.ts:32 ~ 54` 의 최단 열 배치와 같은 값) 와 자리 카드 높이가 더해진다.
- 높이가 내용에 따르는 CardView 는 채울 화면이 없다 — 이것은 S2 규칙이 아니라 composition 정책이다: grid 는 지금 행 끝 + 한 행, waterfall 은 모든 열에 하나씩.
- 검사: grid 계산 = 같은 입력의 `GridLayout` 자리 항목 수 · waterfall 계산 = 같은 입력의 `WaterfallLayout` 자리 항목 수와 위치 (각각 독립 기준). 내용 높이 정책은 설치본 대조가 아니라 자체 기대값으로 검사한다.

### 3.5 정리

- `domRegistry.runtime.ts:42 · 106` 의 `skeleton: Skeleton` 을 새 렌더러로.
- `ruleShapes.ts:134` 의 box 그리기 목록에서 Skeleton 삭제.
- `resolver.ts:398` `LOADING_STATE_TYPES` 의 Skeleton 은 유지 (F13).
- 수동 `styles/Skeleton.css` · `components/Skeleton.tsx` · shared 12 파일의 `<Skeleton componentVariant>` — F9 도달 조사 뒤 사용자 결정 4.

## 4. Phase

| Phase | 내용                                                                                                                                                   |  Gate   | 추정 파일                          |
| :---: | ------------------------------------------------------------------------------------------------------------------------------------------------------ | :-----: | ---------------------------------- |
|   0   | 인벤토리 — 참여 표 줄 번호 · F9 도달 경로 · 옛 `size` 문서 검증 · 번들 기준선 · 테스트 11 분류 · `GridLayout` skeleton 처리                            |   G0    | 문서만                             |
|   1   | 래퍼 구조 — binding · nesting · rule · template · DOM 렌더러 · presence · 패널 · 선택 · 빈 상태 (사용자 결정 1 · 2 · 3)                                |   G1    | shared 8 ~ 10 · builder 4          |
|   2   | 전달 — `applySkeletonContext` · 끊김 · form 비활성 · `inert`                                                                                           |   G2    | shared 4 ~ 6                       |
|   3   | 로딩 모양 — 조건 `isSkeleton` · 참여 8 종 rule · Canvas 글자 줄 상자 · 생성 CSS · Preview 움직임                                                       |   G3    | shared 6 · builder 4 · rendering 2 |
|   4   | `SkeletonCollection` — CardView 로딩 전달 (`LOADING_STATE_TYPES` · run) · nesting · DOM · 상태 표 (`loading` · `loadingMore`) · 반복 수 (배치 경로 셋) |   G4    | shared 8 ~ 10 · builder 3          |
|   5   | 정리 (사용자 결정 4 · 5) · 체크리스트 §5 · `catalog-subparts.md` · CHANGELOG · 번들 · frame · live                                                     | G5 · G6 | 문서 + 삭제 범위                   |

각 Phase 는 커밋 가능한 상태로 닫는다. Phase 1 뒤에는 Skeleton 이 감싸기만 하고 로딩 모양이 없다 — Phase 3 까지는 사용자-가시 변경을 CHANGELOG 에 「진행 중」 으로 적는다.

## 5. 검사 계획

- 구조 (G1): DOM 에 `.react-aria-Skeleton` 0 · 자식 위치 Canvas = Preview · `d2S2Alignment`.
- 전달 (G2): 경로 다섯 (직접 · instance 안 · instance 밖 · slot · 반복 항목) 각각 record 의 파생 필드 · Button 내용 끊김 · form `isDisabled` · DOM `inert`. 원복 RED 각 1.
- 모양 (G3): 참여 8 종 × (`isLoading` 켬 · 끔) geometry 차이 0 · 글자 한 줄 · 여러 줄 · 말줄임 `/cross-check` · `d3S2Alignment`.
- collection (G4): `loadingState.test.tsx` 방식 (jsdom + 답을 보류한 `fetch` stub — 작성값 주입 아님) 으로 `loading` · `loadingMore` · 응답 뒤 · 오류 네 상태 × (owner 연결 · 반복 run). 반복 수는 grid = RAC `GridLayout` · waterfall = RAC `WaterfallLayout` 대조. 리뷰 프로브 (`.agent/runs/2026-11-18-adr314-review-round1/adr314ReviewProbe.test.tsx` — 로컬) 의 「CardView `loadingState` undefined」 가 Phase 4 의 RED 다.
- 성능 (G5): Canvas 다시 그리기 횟수 (정지 상태 0) · Preview 로딩 요소 200 개 frame time (CPU throttle 4x 병기).
- 기존 테스트 11 파일: Phase 0 에서 「계약 바뀜 (고침)」 · 「무관」 으로 분류.

## 6. 범위 밖

- Image 의 `ImageCoordinator` · `renderError` (체크리스트의 Image 기능 잔여 — 별도 작업).
- shared 컴포넌트 자기 `isLoading` 의 S2 대응 (S2 Button `isPending` 등) — F9 조사에서 catalog 문서가 닿는 경로가 나오면 사용자에게 범위를 묻는다 (결정 지점 ④).
- 빌더 chrome 의 로딩 표시 (`dashboard/index.tsx` `ProjectCardSkeleton` — 자체 구현).

## 7. 기록

### Phase 0 — 인벤토리 (2026-11-18, G0)

- **S2 참여 표**: 설치본 1.8.2 줄 번호 = §2 와 차이 0 — `Content.tsx:131` · `Link.tsx:132` (스타일 가지 `isSkeleton` :157) · `Icon.tsx:128` · `Badge.tsx:241` · `Meter.tsx:158` · `Image.tsx:274` · `StatusLight.tsx:150` (`isSkeleton: 'gray-200'` :126) · `Card.tsx:426 · 699` · `Form.tsx:45 ~ 63` · 끊김 `Button.tsx:462 · 583` · `ActionButton.tsx:385` · `ToggleButton.tsx:123`.
- **F9 도달**: shared 12 파일 (Badge · Breadcrumbs · Button · Checkbox · Link · ListBox · ProgressBar · Slider · Switch · Table.components · Tabs · Tree, + chart `windowTrack`) 의 자기 로딩은 catalog 문서에서 닿지 않는다. `isLoading` 을 accepts 에 가진 binding 은 Skeleton 하나이고, generic 경로는 `toRacProps` (`outputs/toRacProps.ts:98 ~ 136`) 가 미선언 prop 을 버리며, delegating renderer (Breadcrumbs · ListBox · Tabs · Tree · ProgressBar · Slider · Switch · Checkbox) 는 `isLoading` 을 넘기지 않는다. `delegatedDom.runtime.ts:534 · 580` 의 `isLoading` 은 RAC `*LoadMoreItem` 의 prop (자식 = ProgressCircle). catalog 밖에서 닿는 곳: Builder chrome `auth/Signin.tsx:197` · `dashboard/index.tsx:357` 의 공유 Button `isLoading` → `Button.tsx:133` `<Skeleton componentVariant="button">` (`Skeleton.css:168 ~ 190`). → 사용자 결정 4 (Phase 5) 의 판단 재료: 삭제하면 이 두 화면을 고쳐야 한다.
- **옛 `size`**: accepts 에서 지우면 문서 로드가 실패한다 — `createCatalogGraph` → `validateView` → `validatePropWrites` (`graph.ts:1869` `PROP_NOT_ACCEPTED`). 본문 HC6 의 「옛 Skeleton 은 빈 래퍼로 열림」 은 `size` 를 작성하지 않은 Skeleton 에만 맞다. 로드 시 drop (`s2PropAlignment.ts` `dropOf`) 은 문서 변환 코드라 쓰지 않는다 (사용자 원칙 2026-10-14). 저장소 관행은 prop 삭제 = `LIBRARY_CONTRACT_VERSION` 올림 (68 Chart `size` 선례).
- **번들 기준선**: `vite build` + `adr209-bundle-closure.mjs` — Builder initial JS gzip **1,580,802 B** · Preview **171,660 B** (main `eed6e7c93` + 문서만 dirty). 판정은 이 기준선과의 Δ (ADR-313 과 같은 방식). 원 수치 `.agent/runs/2026-11-18-adr314-phase0/bundle-{builder,preview}.json` (로컬).
- **Skeleton 인용 테스트 15 파일** (본문 F14 의 11 + helper 2 + browser 2):

| 파일                                                                                                                                                                                                     | 분류                                                              |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `s2SkeletonDropZone.test.tsx`                                                                                                                                                                            | 고침 Phase 1 — 요소 · 「숨김」 단언                               |
| `loadingState.test.tsx`                                                                                                                                                                                  | 고침 Phase 1 — 판정을 요소 유무에서 record `isLoading` 으로       |
| `componentRulesTable.static.test.ts`                                                                                                                                                                     | 고침 Phase 1 — `INTENTIONAL_LITERAL` 의 Skeleton height 항목 삭제 |
| `adr295PaletteSymmetry.browser.test.ts`                                                                                                                                                                  | 고침 Phase 1 — `KNOWN_ASYMMETRIC` 의 `Skeleton@S · M · L`         |
| `s2VariantRemoval.test.ts`                                                                                                                                                                               | 조건부 Phase 1 — rule `variants.default` 를 남기면 그대로         |
| `generatedCssLoadInventory.static.test.ts`                                                                                                                                                               | 고침 Phase 3 ~ 5 — 수동 CSS 범주 B · 집계                         |
| `cutoverMarkerPassthrough.test.tsx`                                                                                                                                                                      | 조건부 Phase 5 — 사용자 결정 4 로 `componentVariant` 를 지우면    |
| 나머지 8 (`useResetStyles` · `paletteOracle` · `adr302RulePairs` · `componentCatalog` · `propSectionConsistency` · `sizePassthroughContract` · `referenceCapabilities.static` · `adr297RealPaintParity`) | 무관 (주석만 낡는 것은 그 Phase 에서 정리)                        |

- **CardView 배치 경로**: 세 경로 모두 `delegatedDom.runtime.ts` `cardview` 렌더러 하나가 자식을 만든다 — 거르기 `ownsChild` (:3887) · `cards` (:3891), 카드 run (:3930) → sentinel (:3932). 자리 항목 자리 = 그 사이. 가상 스크롤은 CardView `layout: "waterfall"` 이면 `{ refused: "waterfall" }` (`virtualListLayout.ts:79`) 라 비가상으로 그린다 — 실제 경로 = ① flex wrap ② `CatalogWaterfallGrid` ③ 가상 grid `CatalogGridLayout extends GridLayout` (`catalogVirtualizer.components.tsx:33`). ③ 은 RAC 가 type `skeleton` 을 펼친다 (`GridLayout.js:60 ~ 120` — 끝 2 항목 안 skeleton · 마지막 loader 순서를 지금 자식 순서가 만족) → 감싸개 수정 없음. `WaterfallLayout` 은 코드에서 쓰이지 않는다 — waterfall 반복 수는 ② 의 순수 계산을 설치본 `WaterfallLayout` 과 대조하는 oracle 로만 쓴다 (G4 그대로). ② 의 배치 (`waterfall.ts:57 ~ 68`) 는 RAC sentinel 의 `position: relative` 상자를 항목으로 센다 — 자리 항목 수 계산에 반영. type `skeleton` 컬렉션 노드를 만드는 수단 (`createLeafComponent`) 은 shared 에 없다 (Phase 4).
- **같이 찾은 결함 (Phase 4 에서 닫음)**: CardView 가 `LOADING_STATE_TYPES` 밖이라 `catalogLoadMoreItem` 의 스피너 판정 (`owner.props.loadingState === "loadingMore"`, :534) 이 늘 거짓 — 지금 CardView sentinel 은 `loadingMore` 중에도 스피너가 없다.

### Phase 1 — 래퍼 구조 (2026-11-18, G1)

- **사용자 결정** (2026-11-18, 셋 다 권고안): 1 = contract 71 (Phase 0 실측 — 옛 `size` 는 검증 실패) · 2 = 표본 내용 · 3 = Canvas 편집용 점선 자리.
- **구현**:
  - binding (`Skeleton.binding.ts`) — `isLoading` · `dataBinding` 만 (`size` 삭제). rule (`componentRulesTable.ts`) — Autocomplete · MenuTrigger 와 같은 요소 없는 container (`display: contents` · `skipCSSGeneration`), `variants.default` 는 빈 칠로 남김 (`s2VariantRemoval` 계약).
  - `nestingRules.ts` — `DOM_LEAF_TYPES` · `HTML_PHRASING_CHILD_TYPES` 에서 뺌. `presence.ts` `catalogSkeletonIdle` 와 그 두 호출 (Canvas `catalogHiddenAtRest` · DOM `renderNode`) 삭제.
  - DOM — `domBinding.runtime.ts` `bindings.skeleton` = 자식만 (Fragment), `domRegistry.runtime.ts` `INTERNAL_RENDERERS.skeleton` (공유 `Skeleton.tsx`) 삭제. Canvas — `canvasBinding.ts` `skeleton` (자식 있으면 칠 없는 container), `ruleShapes.ts` box 목록에서 뺌.
  - 빈 Skeleton (결정 3) — `elementless.ts` `catalogEmptySkeleton` 판정 하나를 엔진 입력 (`compositionRoot.ts` `recordStyle` → `CATALOG_EMPTY_SKELETON_STYLE` block · 100% · 48px) 과 Canvas 칠 (점선 1px · 모서리 4) 이 읽는다. DOM 은 없음.
  - 원본 (결정 2) — `componentCatalog.ts` `PALETTE_REUSABLE_ORIGIN_TYPES` 에 Skeleton, `reusableOriginLibrary.ts` `component-skeleton` = `Skeleton[slot Content] > frame (row · gap 16) > Image (160 × 120 · shrink 0) + frame (column · gap 16 · grow) > Text XL 「Placeholder title」 + Text 본문`. 루트 slot 은 live 에서 찾은 결함의 수리 — slot 없이는 Skeleton 을 고른 채 넣은 Badge 가 「cannot be placed inside Skeleton」 으로 body 에 갔다 (Form 원본과 같은 모양).
  - contract 71 (`document/types.ts`) — 테스트 fixture 의 `libraryContractVersion: 70` 32 파일을 71 로, `adr313DataContract` 의 고정값은 「70 이상」.
- **테스트**: `s2SkeletonDropZone.test.tsx` 의 Skeleton 절 다시 씀 (7 — 패널 · 요소 없음 · Loading 끔 · Canvas 상자 = 내용 · 증분 · 팔레트 넣기 · 빈 자리) · `loadingState.test.tsx` (판정 = Preview record `isLoading` + 내용 유지) · `componentRulesTable.static` (Skeleton height 리터럴 항목 삭제) · `adr295PaletteSymmetry.browser` (`Skeleton@S · M · L` → `Skeleton` — Autocomplete 와 같은 요소 없는 노드).
- **원복 RED 3/3**: DOM 렌더러 + 빈 자리 엔진 입력 되돌림 → 2 실패 · 원본 루트 slot 제거 → 팔레트 넣기 실패. 복원 `cmp` 확인.
- **회귀**: shared 실패 6 파일 = HEAD (`eed6e7c93` worktree) 의 실패 목록 안 (HEAD 는 `randomUndo` 하나 더) · builder unit 실패 = HEAD 목록 + 전체 실행에서만 나는 5 초 timeout 2 (단독 실행 통과) · palette 대칭 browser HEAD 53 실패 = 지금 53 (Skeleton 목록 수정 뒤). type-check PASS.
- **live** (Chrome MCP, dev 5173, 새 프로젝트 「ADR314 live 2」): 위 본문 Status 의 Phase 1 인용 블록. 처음 만든 「ADR314 live」 는 확인 도중 저장소에서 사라졌다 (대시보드 목록도 그 사이 정리됨 — 이 변경에는 삭제 경로가 없다: `CatalogStorage.remove` 는 대시보드 삭제만 부른다).
- **남은 것 (다음 Phase)**: 감싼 내용의 로딩 모양 (Phase 3) · 전달 (Phase 2) — 지금 `isLoading` 은 Skeleton record 에만 있다. 꺼내기는 live 미exercise (일반 `moveNodes`).

### Phase 2 — 전달 (2026-11-18, G2)

- **설계 변경 (§3.2 대비)**: resolver 의 `applySkeletonContext` 대신 **record 단계의 판정 하나** — `runtime/skeletonContext.ts` `catalogInLoadingSkeleton` (record 부모 사슬에서 가장 가까운 Skeleton 의 `isLoading`, 끊김 집합에서 멈춤). 부모 사슬은 instance · slot 채움 · 반복 행 · overlay 를 이미 펼친 해석 결과라 경로별 분기가 필요 없다. `applyFormContext` 처럼 props 에 쓰면 accepts 검사 · 작성값 판정에 섞이므로 파생 값 (`derivedProps`) 으로 둔다 — quiet · field button 과 같은 채널.
- **참여 · 끊김 · inert** (설치본 S2 1.8.2): 참여 = Text · Link · Icon · Image · Avatar · StatusLight · Badge · MeterTrack · Card (`CATALOG_SKELETON_PARTICIPANTS`) — record 파생 `isSkeleton: true` (`presence.ts` `catalogDerivedProps`). 끊김 = Button · LinkButton · ActionButton · ToggleButton (S2 `[SkeletonContext, null]`) · Icon · Badge · MeterTrack (`SkeletonWrapper` 안쪽). `inert` = Text · Link · Icon · Badge · MeterTrack · Card (Image · StatusLight 는 S2 도 inert 없음).
- **form 비활성** — 로딩 중인 Skeleton 을 ADR-281 조상 상속 host 로 둔다 (`inheritedProps.ts` `catalogHostInherited` — `{ isDisabled: true }`, 로딩이 아니면 아무것도). 그래서 Canvas 파생 `isDisabled` · DOM RAC `Provider` · dispatcher guard 가 한 기구로 따른다 (S2 「Skeleton always wins」 = 상속의 OR). Button 은 내용은 끊기지만 자신은 비활성 (S2 Button 도 `useFormProps`).
- **증분** — Skeleton 의 `isLoading` 이 바뀌면 `catalogHostInheritedChanged` 가 자손 전부를 다시 계획 (`catalogInheritedReceivers`). 원본 instance 는 instance 재해석이 먼저 덮어 이 기구를 거치지 않는다 — 소유 자식을 가진 Skeleton 의 반증 케이스로 고정.
- **DOM** — `domBinding.components.tsx` `catalogSkeletonMarked`: 파생 `isSkeleton` 인 요소에 `data-skeleton="true"` (Phase 3 의 조건 선택자) + 위 집합이면 `inert`. `showWhen` 문 앞에서 표시.
- **테스트**: `adr314SkeletonContext.test.tsx` 6 — 소유 자식 증분 · 원본 slot 내용 (Text 파생 + DOM `inert`) · `isLoading` 끔 / 다시 켬 · instance (Card + template Text, Footer Button 안 글자는 끊김) · Button (내용 끊김 + 자신 비활성) · TextField (Canvas `isDisabled` + DOM `<input disabled>`).
- **원복 RED 5/5**: 파생 끔 → 3 · 끊김 끔 → 2 · form host 끔 → 2 · DOM 표시 끔 → 1 · 증분 예외 끔 → 1 (소유 자식 케이스 — 처음 RED 가 안 나 반증 케이스를 더했다). 복원 `cmp`.
- **회귀**: shared 실패 6 파일 · builder unit 실패 12 = HEAD (`eed6e7c93`) 목록 그대로 (새 실패 0). type-check PASS.
- **반복 행 경로**: 별도 반증 케이스 없음 — 판정이 record 부모 사슬만 읽어 행 record 도 같은 길이다 (LOW deferred).
- **live** (Chrome, 「ADR314 live 2」 — Skeleton 표본 + 안에 넣은 Badge → Publish): Skeleton 요소 0 · `[data-skeleton]` 4 = Image (inert 아님) · Text 2 (inert) · Badge (inert). Canvas 는 아직 보통 모양 (로딩 모양은 Phase 3).

### Phase 3 — 로딩 모양 (2026-11-18, G3)

- **설계 변경 (§3.3 대비)**: 조건 트리에 `isSkeleton` 을 더해 참여 8 rule 마다 가지를 두는 대신, **공용 모양 하나** — `catalog/rule/skeletonLook.ts` (`CATALOG_SKELETON_LOOK` 값 · `CATALOG_SKELETON_LOOK_OF` 참여 → 모양). S2 도 모양을 참여 컴포넌트의 style macro 가지가 아니라 `loadingStyle` 한 class (`'L'` layer) 로 얹는다 — rule 8 개에 같은 가지를 복제하면 값이 여덟 곳이 된다. 두 consumer: 생성 CSS `generated/CatalogSkeleton.css` (`generate-css.ts` · `styles/index.css` 가 `CatalogStates.css` 뒤에 로드) 와 Canvas `canvasBinding.ts` `withSkeletonLook`.
- **값** (설치본 1.8.2): gradient `gray-100 33% · light-dark(gray-25, gray-300) · gray-100 66%` · `background-size: 300%` · 자손 `visibility: hidden` · 글자 `box-decoration-break: clone` + radius `sm` · Icon radius `sm` (`useSkeletonIcon`) · StatusLight 점 `gray-200` · 움직임 `backgroundPosition` 100% → 0%, 2000 ms, `ease-in-out`, 무한, `startTime = 0`. 색은 alias 표 tone 행 셋 (`skeleton` 100/100 · `skeleton-highlight` 25/300 · `skeleton-status-light` 200/200 — `colorAliases.ts` · `tokenResolver.ts` 변수 `--skeleton*`). 게이트 `d3S2Alignment.static.test.ts` 「ADR-314 Skeleton loading look」 (설치본 원문 대조) · `adr302TwoAxis` 분류표 (`skeletonHighlight` 범위 25 ~ 300).
- **Canvas 정지 프레임**: 300% 그림이 상자에 보이는 것은 1/3 — 움직임 시작 (`background-position` 100% → 그림의 66.7 ~ 100%) 도 움직임 없음 (0% → 0 ~ 33.3%) 도 `gray-100` 한 색이다. 그래서 Canvas 는 `fill` 한 색 (다시 그리지 않음 — HC5).
- **모양 셋**:
  - 글자 (Text · Link · MeterValue · StatusLight 글자): DOM 은 S2 `SkeletonText` 와 같은 inline span (`skeletonAnimation.ts` `catalogSkeletonText` — Text binding · Link 렌더 · 글자를 품은 요소는 `catalogSkeletonMarked`), 호스트는 `-webkit-text-fill-color: transparent` (`:has(> [data-skeleton-look="text"])`). Canvas 는 `text.skeleton` → `nodeRendererText.ts` `drawSkeletonLines` — 줄마다 `getRectsForRange(Tight)` 합집합의 둥근 상자, 글자는 그리지 않음 (paragraph 는 그대로라 배치 불변), 말줄임 줄은 상자 끝까지 (DOM span 의 inline 상자가 호스트에서 잘리는 것과 같게).
  - 감싼 요소 (Icon · Badge · MeterTrack · Image · Avatar): DOM 은 요소에 `data-skeleton-look` (box · icon) + 움직임 ref (`catalogSkeletonRef` — 요소 자신의 ref 와 합침). Canvas 는 그 요소를 `fill` 상자 하나로 (모서리: Icon `sm` · Avatar 원 · 나머지 자기 것, 테두리 유지) · 안쪽 그림 (glyph · 글자 · 그림) 을 버림. 자손 record 는 파생 `_skeletonHidden` (`skeletonContext.ts` `catalogSkeletonHidden` — 감싼 요소가 끊김이라 Badge 안 Icon 은 Badge 가 숨긴다) → `hiddenNode` (배치는 그대로).
  - StatusLight: DOM 은 root 에 `data-skeleton-dot` (`> svg` 의 `fill` — svg 의 inline fill 을 이기려 `!important`) + 글자 span. Canvas 는 점 상자 `fill` = `gray-200` + 글자 줄 상자.
- **같이 고친 것**:
  - Phase 2 의 form 비활성 범위: S2 에서 Skeleton 이 비활성으로 만드는 것은 `useFormProps` 를 부르는 컴포넌트뿐 (설치본 grep — Button · LinkButton · ActionButton · ToggleButton · Checkbox · CheckboxGroup · Switch · RadioGroup · TextField · TextArea · NumberField · SearchField · Picker · ComboBox · Slider · RangeSlider · ColorField). Phase 2 는 상속 수신자 전부 (Link · Tabs · Disclosure · 날짜 · Calendar · Color 조작기 포함) 를 비활성으로 만들어 Canvas 에서 Link 가 disabled 투명도로 흐려졌다. → host 값에 `skeleton: true` 를 싣고 (`inheritedProps.ts`) 수신 판정 `catalogInheritedTakes` · DOM `catalogProviderValues(…, CATALOG_SKELETON_DISABLED_TYPES)` 가 그 17 종만 받게. Skeleton 밖 · 안의 진짜 비활성 (frame 등) 은 그대로 모두에 닿는다 (`catalogMergeInherited` · `catalogAncestorInherited`).
  - `MeterValue` 를 참여에 더함 (S2 `Meter.tsx:156` `<Text>{valueText}</Text>`) — Text 처럼 `inert`.
  - DOM 표시 위치: 값 gate · slot scope 같은 component 요소에 clone 하면 표시가 DOM 까지 가지 않아 (`.value` span 에 표시 없음) 노드 자신의 요소 (`renderNode` 결과) 에 붙이도록 옮김.
  - 공용 `Icon` 이 `ref` · `inert` 를 감싼 요소에 넘김 (움직임이 Icon 에만 없었다 · Phase 2 의 `inert` 도 Icon 에서 빠져 있었다).
- **테스트**: `adr314SkeletonLook.test.tsx` 10 — Canvas (글자 줄 상자 · 감싼 상자 모서리 · 자손 숨김 · StatusLight 점 · Link 비활성 아님 · 켬/끔 geometry 같음 HC3) · DOM (표시 · 끔에서 0 · 생성 sheet = 상수 · index 로드) · 움직임 (look 요소 수 = 움직임 수 · `startTime 0` · unmount 에서 cancel · 움직임 줄이기면 0). Phase 2 테스트의 열기 helper 는 `__tests__/support/adr314Skeleton.ts` 로 옮김.
- **원복 RED 7/7**: Canvas 모양 끔 → 4 · 글자 span 끔 → 1 · 자손 숨김 끔 → 1 · form 범위 끔 → 1 · Icon ref 끔 → 1 · sheet 로드 끔 → 1 · S2 값 (33 → 34) → 1. 복원 `cmp`.
- **회귀**: type-check PASS. shared 실패 = HEAD 목록 (`generatedCssLoadInventory` 는 HEAD 도 135 ≠ 131 — 지금 136, 생성 파일 하나 더. Phase 5 에서 집계를 고침) · builder unit 실패 = HEAD 12 + 전체 실행에서만 나는 `adr282LibraryOriginUnlock` 시간 초과 1 (단독 7/7 통과). 새 실패 0.
- **live** (Chrome, dev 5173, 「ADR314 live 2」): Canvas — Image 상자 · 제목 · 본문 줄 상자 (mobile 5 줄) · Badge 상자가 회색으로. Publish — `--skeleton` `#e9e9e9` · `--skeleton-highlight` `#ffffff` 해석 · look 요소 4 개 모두 Web Animation `startTime 0` · 2000 ms · running · 감싼 요소 자손 `visibility: hidden` · 글자 span radius 4. 대조 (`/cross-check` — 기준 = Publish `getClientRects`): 한 줄 — 제목 Canvas ≈ 146.8 × 23.2 / DOM 145.3 × 24, 본문 높이 ≈ 18.2 / DOM 19 · 여러 줄 (390 폭) — 줄바꿈 위치 같음, 줄 폭 Canvas 192.5 · 197.8 · 175 · 201.8 · 123 / DOM 193.6 · 198.7 · 175.7 · 203.2 · 122.9 (Canvas 값은 스크린샷 환산이라 ±1.4 px 정밀도).
- **확인 못 한 것**: 말줄임 줄은 live 로 만들지 않았다 (Canvas 는 상자 끝까지 · DOM 은 호스트에서 잘림 — 코드상 같은 결과, LOW deferred). 움직임 줄이기는 jsdom 만.
- **Card 일러스트 상자** (S2 `Card.tsx:699` — 일러스트를 `SkeletonWrapper` 로): 우리 Card 에 일러스트 부품이 없어 대상 없음.

### Phase 4 — SkeletonCollection (2026-11-18, G4)

- **노드 · 등록**: `SkeletonCollection` = 요소 없는 container (binding `SkeletonCollection.binding.ts` — accepts 없음 · S2 `children` 만, rule `display: contents` · `skipCSSGeneration`). nesting `componentTraits.ts` — `CardView.children` 에 `SkeletonCollection`, `SkeletonCollection` 은 `owners: [CardView]` · `children: [Card]`. 팔레트 원본 `component-skeletoncollection` = 루트 slot `Card` + Card 원본 instance 하나 (`skeleton-card` · 폭 100%) — CardView 를 고른 채 놓으면 그 안에 들어간다 (`PALETTE_REUSABLE_ORIGIN_TYPES`, collections).
- **로딩 원천**: `resolver.ts` `LOADING_STATE_TYPES` 에 CardView — owner 연결이면 그 조회, 연결 없이 Card 가 자기 데이터를 반복하면 run 의 상태 (`runsLoadingState`). CardView binding 에 `loadingState` (`LOADING_STATE_PROP` — 파생 · 패널 비노출, Table 과 같은 칸 — 이것이 없으면 record 가 값을 버린다: Phase 4 의 첫 RED 원인). Phase 0 의 「CardView sentinel 스피너가 `loadingMore` 에도 없음」 결함도 같은 수정으로 닫힘.
- **context**: `skeletonContext.ts` — 부모 사슬에서 `SkeletonCollection` 을 만나면 로딩 중 (S2 `<Skeleton isLoading>{children()}</Skeleton>`) · 감싼 요소 숨김도 같이. `inheritedProps.ts` — SkeletonCollection 은 늘 Skeleton host (`isDisabled` + `skeleton`). 그래서 템플릿 Card 의 글자 · 그림은 Phase 3 의 로딩 모양, Footer Button 글자는 끊김, Button 은 비활성.
- **DOM** (`delegatedDom.runtime.ts` `cardview`): `loadingState` 가 `loading` · `loadingMore` 이고 SkeletonCollection 에 Card 템플릿이 있으면 카드 run 뒤 · sentinel 앞에 `skeleton` 항목 (`skeletonCollection.components.tsx` `CatalogSkeletonItem` — `react-aria/CollectionBuilder` `createLeafComponent` + `CollectionNode` type `skeleton`, S2 와 같은 기구). 항목은 GridList 의 행이 아니다 (키보드 · 선택이 건너뜀). 템플릿 Card 는 부모가 CardView 가 아니라 단독 Card 로 그려진다 (S2 Card 도 skeleton 이면 `div` + `inert`). 자리 항목이 있으면 sentinel 스피너는 없다 (`catalogLoadMoreItem` `quiet` — S2 layout 이 loader 높이 0). 그 밖 상태 (`idle` · `error` · `sorting` · `filtering`) 는 항목 0. 빈 상태: CardView 는 빈 상태를 그리지 않아 겹칠 것이 없다.
- **반복 수** (`skeletonRepeat.ts` — 설치본 `react-stately` 3.51.0 의 규칙을 옮긴 순수 계산):
  - 가상 스크롤 grid: 항목 하나 — RAC `GridLayout` (우리 `CatalogGridLayout`) 이 직접 반복한다. waterfall 은 가상화되지 않는다 (`virtualListLayout.ts` 거절).
  - 그 밖 (grid · flex wrap · `CatalogWaterfallGrid`): `CatalogSkeletonFill` 이 그려진 grid 를 잰다 — 첫 항목 앞 숨은 표시 (`data-skeleton-measure`) 의 다음 형제 = 템플릿 상자, 부모 = grid. 열 = grid track 수 (아니면 flex 한 줄에 들어가는 템플릿 폭 수) · 템플릿 높이 · 행 간격 · waterfall 은 카드들의 열 높이 (`catalogWaterfallLanes` — `CatalogWaterfallGrid` 와 같은 배치). 높이를 정한 CardView 는 그 높이를 채우고, 내용 높이 CardView 는 composition 정책 (grid = 지금 행 끝 + 한 행 · waterfall = 모든 열에 하나 — RAC 의 반복을 채울 높이 0 으로).
- **테스트**: `adr314SkeletonCollection.test.tsx` 14 — 실제 요청을 보류한 Preview (`fetch` stub, 작성값 주입 아님): `loading` = 자리 항목만 · 응답 뒤 0 · `loadingMore` = 기존 카드 유지 + 뒤에 자리 항목 · 스피너 없음 · 응답 뒤 0 · 오류 뒤 0 · run 의 로딩 (CardView 연결 없음, Card 가 자기 데이터) · Builder 템플릿 1 개 + 로딩 모양 (Footer Button 글자 끊김). 반복 수 = 설치본 RAC (grid → `GridLayout`, waterfall → `WaterfallLayout`, 같은 입력 4 경우씩 — 리뷰 프로브의 420 × 100 · 카드 200 · 간격 10 · 기존 1 → 1 · 2 포함) · 내용 높이 정책 자체 기대값.
- **원복 RED 7/7**: `LOADING_STATE_TYPES` 의 CardView 끔 → 4 · binding `loadingState` 끔 → 4 · 자리 항목 끔 → 4 · grid 행 추가 조건 → 3 · waterfall 「모든 열」 조건 → 2 · SkeletonCollection context 끔 → 1 · 스피너 숨김 끔 → 1. 복원 `cmp`.
- **같이 고친 것 (회귀가 잡음)**: SkeletonCollection 에 `owners: [CardView]` 를 두자 팔레트 원본을 page 에 놓을 수 없어 Library page · Code 보기 왕복 (`adr301Expansion`) 이 깨졌다 → owner 제약 없이 (Skeleton 처럼 어디든 — CardView 밖에서는 DOM 에 아무것도 없음) · 고정 표 갱신 (`componentTraits` · `componentCatalog` · `adr310CollectionTypeTable` · `adr256CardS2` · `phase3G3Census` 182 · `adr301Expansion` — Card 원본을 품어 CardView 처럼 펼쳐짐, `SkeletonCollection(Card(…))` 모양 테스트).
- **회귀**: type-check PASS · shared 실패 6 파일 · builder unit 실패 12 = HEAD 목록 그대로 (새 실패 0).
- **live** (Playwright headed Chrome, dev 5173 — `apps/builder/scripts/adr314-g4-skeleton-collection-live.mjs`: 원격 collection 의 응답을 스크립트가 붙잡는 로컬 서버 · 4 행씩 2 쪽): ① 첫 요청 보류 중 — 카드 행 0 · 자리 항목 4 (grid 2 열 · 내용 높이 정책 = 행 끝 2 + 한 행 2, 기대값 4) · look 요소 12 · Web Animation 12 · ② 첫 응답 — 카드 4 (RAC sentinel 이 한 화면 앞서 다음 쪽을 바로 부름 — 자리 항목은 `loadingMore` 의 것, 카드 뒤) · ③ `loadingMore` — 카드 4 유지 + 그 뒤 자리 항목 4 · 스피너 0 · ④ 마지막 응답 — 자리 항목 0 · 카드 8. 오류 0. 화면 (스크린샷): S2 처럼 그림 상자 · 제목 · 설명 줄 상자 · 비활성 Action 버튼, 밝은 띠 움직임. Builder (Chrome MCP · dev 핸들): 팔레트로 CardView 를 고른 채 넣은 SkeletonCollection 이 옮김 없이 CardView 안 · grid 넷째 칸 (203, 360 · 187 × 344) · 템플릿 Card 파생 `isSkeleton`.
- **확인 못 한 것**: 가상 스크롤 CardView 의 자리 항목 (RAC `GridLayout` 이 반복 — LOW deferred) · waterfall 의 실제 반복 수 (순수 계산은 설치본 `WaterfallLayout` 과 대조 일치, live 는 grid 만).

### Phase 5 — 정리 · 번들 · frame (2026-11-18, G5)

- **삭제 (사용자 결정 4 「수동 css삭제」)**: 수동 `styles/Skeleton.css` (1,189 줄) 와 `styles/index.css` 의 import · 컴포넌트 11 곳의 자기 로딩 분기 (`isLoading` · `skeleton*Count` → `<Skeleton componentVariant>` — ProgressBar · Link · Slider · Checkbox · Switch · Badge · Tabs · Tree · Breadcrumbs · ListBox · Table) · `components/list.ts` · `index.ts` 의 Skeleton 내보내기 · `unified.types.ts` 의 `createDefaultSkeletonProps` (+ `DEFAULT_PROPS_MAP` 행). Phase 0 F9 대로 이 분기들은 catalog 문서에서 닿지 않았다. 생성기가 더는 만들지 않는 낡은 `generated/Skeleton.css` (Phase 1 의 `display: contents` 뒤 생성 대상 아님) 도 지웠다.
- **Builder chrome 의 Button**: `Button.tsx` 의 `isLoading` · `loadingLabel` (자리표시 Skeleton) 을 지우고 쓰던 두 곳 (`auth/Signin.tsx` · `dashboard/index.tsx`) 을 RAC `isPending` (진행 원 · 누르기 막음 — 이미 있던 경로) 으로.
- **원본 삭제 (사용자 승인 2026-11-18 「원본 파일 삭제해도된다」)**: `components/Skeleton.tsx` (539 줄, import 0) 를 지웠다 — type-check · `src/components` 테스트 29 파일 318 통과 · `docs:stale-symbols` 0.
- **테스트 갱신**: `Tree.styleScope.test.tsx` · `cutoverMarkerPassthrough.test.tsx` (Skeleton 분기 기대 제거) · `generatedCssLoadInventory.static.test.ts` (생성 135 · index 로드 117 · 미로드 18 — HEAD 에서 이미 어긋나 실패 중이던 값을 실측으로).
- **번들 (G5, 사용자 결정 5 「번들 상한」)**: production closure gzip, Phase 0 (`eed6e7c93`) → 지금 — Builder initial JS 1,580,802 → 1,581,620 (+818 · raw −620) · Preview initial JS 171,660 → 171,810 (+150) · Preview initial CSS 66,345 → 64,311 (−2,034) · lazy chart chunk ±7. ADR-201 Δ 상한 (Builder +4,096 · Preview +3,584) 안. 절대 상한 1,435,351 은 기준선에서 이미 넘어 있어 이 ADR 의 비교 대상이 아니다.
- **frame (G5)**: `apps/builder/scripts/adr314-g5-skeleton-frame.mjs` — production build (`perf:build-dist` · harness 핸들), 새 프로젝트에 Skeleton + Text 200 (로딩 요소 203 · Web Animation 203 — 표본 내용 포함), 같은 문서의 `isLoading` 끔 / 켬을 교대 3 쌍, Publish 의 보이는 탭에서 3 초 rAF 간격. 중앙값 p95: 1x 대조 9.2 · 로딩 9.2 (1.00) · 4x 대조 9.2 · 로딩 9.2 (1.00) — 판정 ≤ 1.2 통과. 표시 주기 ~120 Hz (p50 8.3). 문서는 합성 (규모 근거만).
- **Canvas 정지 (G5 · HC5)**: 같은 하니스 `--canvas-only` (dev 5173 — 렌더 카운터는 dev 에만): `isLoading` 켬 상태로 2 초 — 렌더 카운터 변화 0 (`execCalls` 3 → 3). Canvas 는 정지 프레임이라 움직임 때문에 다시 그리지 않는다.
- **문서**: S2 체크리스트 §5 Skeleton [x] · 부록의 SkeletonCollection 대응 · `rac-s2-integrations.md` Skeleton 행 ✅ · 읽는 중 상태 행에 CardView.
- **build 경고**: production build 의 esbuild `Unexpected "*"` (`style.css:1789`) 는 `ApiEndpointEditor.css` (2026-10-29) 의 주석 — HEAD 와 같은 파일, 이번 변경과 무관.
