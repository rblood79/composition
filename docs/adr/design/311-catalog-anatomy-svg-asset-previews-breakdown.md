# ADR-311 구현 설계 — Anatomy SVG 미리보기와 자산 이력

> 상태: Proposed · 2026-11-15. [ADR 본문](../311-catalog-anatomy-svg-asset-previews.md)이 결정 정본이다.
> 아래 타입·경로·명령·성능 목표는 구현 계획이며, 존재하거나 통과한 기능으로 해석하지 않는다.

## 1. 범위와 전제

- 사용자 요청으로 하나의 신규 ADR을 작성한다. 기존 ADR의 잔여 작업 분리·통합은 없다.
- Base/응용: ADR-248 graph/runtime 및 기존 catalog rendering이 base, 311은 anatomy SVG 미리보기 응용이다. 의존 방향을 바꾸지 않는다.
- Schema: 신규 형식은 빌드 manifest·런타임 파생 preview 입력이다. `CatalogGraph` schema와 직교하며 새로운 저장 entry kind를 만들지 않는다.
- ADR-304/306은 향후 preset/Chart 항목 공급자다. 이 ADR이 그 구현을 흡수하지 않으며 고정 개수 90을 schema로 만들지 않는다.
- 사용자 확정: RAC anatomy + catalog 기하 + 자체 anatomy 가이드/hover, 네 kind 확장, 목록과 산출물 버전 추적. Blocks/Templates의 제품 활성화 2건만 본문의 사용자 결정으로 남긴다.
- 이번 작성 단계는 아래 Phase 실행·리뷰 라운드·commit/push를 포함하지 않는다.

## 2. 현재 구현과 확인 근거

기준 HEAD: `0a02d3a70` (2026-11-15 작성 시). 세션 중 선행 작업이 main에 반영될 수 있으므로 구현 G0에서 다시 고정한다.

| 경로 / 심볼                                                                                            | 관찰                                                                                | 재사용 / 보강                                              |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `apps/builder/src/builder/panels/components/paletteItems.ts` / `getPaletteItems`, `PALETTE_CATEGORIES` | category·label·icon·creationVariants를 catalog와 overlay에서 파생                   | 실행 결과를 inventory 입력으로 사용; TS 정규식 파싱 제거   |
| `apps/builder/src/builder/panels/components/ComponentList.tsx` / `ComponentItem`                       | RAC Button + 16px icon + label, 최근/즐겨찾기/검색/Section                          | 삽입과 section ID 유지, SVG slot 추가                      |
| `apps/builder/src/builder/panels/components/CatalogComponentsPanel.tsx`                                | `catalogPaletteInsertPlan` → command runner                                         | presentation과 activation 분리                             |
| `apps/builder/src/builder/components/styles/list-group.css`                                            | `auto-fill minmax(80px, 1fr)`                                                       | 기존 공통 class를 전역 변경하지 않음                       |
| `packages/shared/src/components/styles/ComponentList.css`                                              | 별도 3열 선언도 공존                                                                | 새 chrome scoped selector로 최종 cascade를 명확히 함       |
| `apps/builder/src/builder/catalogRuntime/ruleShapes.ts` / `catalogRuleShapes`, `catalogRuleNodeData`   | Shape 생성 뒤 텍스트 보정·outline·ellipsis·정렬 추가                                | 필요한 공통 처리를 SVG 앞에서도 이용 가능하도록 분리       |
| `packages/rendering/src/renderers/buildCatalogShapes.ts`                                               | catalog visual/paint/props/size에서 기본 도형 생성                                  | 기하 정본 재사용                                           |
| `packages/rendering/src/renderers/composeCatalogShapes.ts`                                             | prepend/base/append 순서                                                            | 순서 보존                                                  |
| `packages/rendering/src/types/shape.types.ts`                                                          | Shape에 token·auto·container·image·conic gradient 포함                              | 해소 책임을 나누고 벡터 출력 coverage 명시                 |
| `apps/builder/src/builder/workspace/canvas/skia/specShapeConverter.ts`                                 | Shape → SkiaNodeData; border/shadow target 2-pass, token 해소                       | target 해소·순수 계산만 공통화, CanvasKit 객체 의존 금지   |
| `apps/builder/src/builder/catalogRuntime/canvasBinding.ts`                                             | scene·children·합성 paint·배치 맵 구성                                              | SVG 장면에 필요한 실제 경계 inventory                      |
| `packages/shared/src/catalog/runtime/compositionRoot.ts`                                               | layout과 상태 파생을 소유                                                           | fixture graph의 계산 경로 재사용, live workspace 변경 금지 |
| `apps/builder/src/builder/panels/navigator/catalog/CatalogNavigatorPanel.tsx`                          | Layouts tab은 `usage="layout"`을 전달                                               | 기존 tab과 정의 정체성 유지                                |
| `packages/shared/src/catalog/commands/project.ts` / `createLayout`, `applyLayout`                      | layout definition과 Slot 기반 명령                                                  | 카드의 layout 활성화도 이 경로 사용                        |
| `docs/design/component-illustrations/generate.py`, `validate.py`, `manifest.json`                      | 90종 static, 8 category, Chart 7 변형·Slot 포함, Toast 제외; ID 중심 inventory 검사 | 비교 기준으로 보존, 새 버전 계약과 재생성 검증 도입        |

2026-11-15 세션의 실제 브라우저 관찰: Components 패널 폭 228px에서 2열·카드 102×100px. Nexvyn Action Button hover에서 idle opacity 1→0 / pending 0→1, Saving 표시를 확인했다. Builder에서는 패널 열기·치수 확인·닫기만 했으며 문서 삽입은 하지 않았다. 전체 90종 적용 성능·모든 Nexvyn 도면 동작은 **UNVERIFIED**다.

### 2.1 Nexvyn 갤러리 실측 (2026-11-15)

조건: Chrome, viewport 1800px, `ui.nexvyn.dev/components`, 카드 66개 (Blocks 32 · Components 34). DOM·computed style·stylesheet 규칙을 읽었고 코드는 가져오지 않았다. 소스 구조는 `component-card.tsx` · `diagram-parts.tsx` 를 요약으로만 확인했다.

| 항목        | Nexvyn 관찰                                                                                                                                                                                                      | Composition 적용                                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Grid        | `grid` · gap 16px · 폭 640px 미만 1열 / 이상 2열 / 896px 이상 3열. 카드 391×260 (63개), 세로 2칸 391×536 (2개), 2×2 797×536 (1개)                                                                                | 패널 폭 container query 로 열 수 결정. 큰 카드 (span) 는 도입하지 않음                                                                                 |
| 도면 크기   | `viewBox 0 0 220 140`, CSS `scale` 1.25 (62개) · 1.1 (3개) → 275×175px. 높이 44 인 banner 를 46 단위로 그림 — 거의 실제 크기                                                                                     | 내보내기는 300×300 유지 (제약 1). inline 은 같은 장면을 가로형 3:2 (세로형 3:4) 로 잘라 실제 크기 근처로 그림 (§3.3)                                   |
| 삽입 방식   | inline SVG, `aria-hidden`, `pointer-events: none`, 카드 전체가 링크                                                                                                                                              | inline SVG, 카드 = 기존 RAC Button, SVG 는 장식                                                                                                        |
| 요소 수     | SVG 당 최소 19 · 중앙값 48 · 최대 217, 합계 3,533 (문서 전체 4,229). `rect` 894 · `line` 943 · `g` 815 · `text` 393 · `path` 188                                                                                 | SVG 당 상한과 패널 합계 상한을 둠 (§6)                                                                                                                 |
| ID          | SVG 66개에 `id` 76개 (clipPath 54 · gradient 4 · mask 2 · filter 1)                                                                                                                                              | `defs` 를 최소화하고 mount 별 prefix 치환 유지 (§3.4)                                                                                                  |
| 색          | `currentColor` (글자색 80%) + CSS 변수, 가이드·손잡이는 accent. 선 굵기 0.5 ~ 1.5 단위, `vector-effect` 없음 (배율 고정이라 불필요)                                                                              | inline 은 chrome token — 구조선·치수선·손잡이 = `--canvas-selection-strong`, 숫자 = `--focus-ring`. 내보내기는 고정 무채색. 선 굵기는 화면 기준 (§3.3) |
| 본체        | idle = `fill-transparent` + `stroke-current` (속 빈 윤곽선), 글자는 35% 불투명. hover = 같은 도형에 실제 칠, stroke 투명                                                                                         | 도형 한 벌, 상태별 칠만 교체. 글자는 막대 (제약 2)                                                                                                     |
| 가이드 어휘 | 외곽 + 모서리 손잡이 4 (62/66) · 여백 점선 (scaffold, 1 ~ 6) · 치수선 (중앙값 2, 최대 6) · 숫자와 사양 메모 글자 (중앙값 5, 최대 13)                                                                             | 같은 네 가지. 숫자·메모는 layout 값·토큰 이름에서 생성, chrome 글자 층에만                                                                             |
| 메모 내용   | `44` · `w-full` · `ps 16 · pe 48 · py 12` · `r4 · gap 8` 처럼 치수와 간격 약어 1 ~ 2줄, 글자 12 단위 (화면 15px)                                                                                                 | 치수 숫자 + rule 의 TokenRef 이름. Tailwind 약어는 쓰지 않음                                                                                           |
| Hover       | 부모 `.group:hover` · `:focus-visible` CSS 만. hover 화면에는 칠해진 본체만 남고 가이드·치수·메모가 모두 사라짐 (스크린샷 확인). 치수선 dash offset · 숫자 accent 규칙도 stylesheet 에 있으나 적용 시점은 미확인 | CSS 만으로 전환. 가이드 묶음 opacity 전환을 기본으로 하고 선 그리기 연출은 넣지 않음                                                                   |
| 개별 동작   | 10/66 만 SVG 안 `<style>` 로 press (scale 0.97) · pending 연출                                                                                                                                                   | 지원 상태가 있는 일부 항목만 (§3.4)                                                                                                                    |
| 진입·idle   | 진입 때 선 그리기·메모 fade 를 카드 순번 × 90ms (최대 450ms) 로 지연. idle 점선 행진                                                                                                                             | 진입 연출은 도입 — 카드가 처음 그려질 때 한 번, 순번 × 90ms (최대 450ms). idle 반복은 도입하지 않음 (§3.4)                                             |
| 접근성      | `prefers-reduced-motion` 에서 animation 전부 해제, `(hover: none)` 에서 다른 연출, focus ring 은 카드 링크                                                                                                       | reduced motion 즉시 교체, touch 는 anatomy 고정, focus ring 은 기존 chrome 규칙                                                                        |

Nexvyn 의 치수 표기는 도면을 275px 이상으로, 거의 실제 크기로 그리기 때문에 읽힌다. 300×300 에 맞춘 도면을 102px 카드에 넣으면 배율이 0.34 라 같은 표기가 읽히지 않는다 — §3.3 의 가로형 틀과 폭 단계가 이 차이를 다룬다.

### 2.2 목표 기준 — 사용자 제공 분석과 판정 (2026-11-15)

사용자가 목표로 지정한 분석 (「Nexvyn UI — Grid · SVG · Hover Animation 구조 분석」, ChatGPT 공유 대화, 소스 코드 기준) 의 항목별 판정이다. 분석의 타이밍 · token 수치는 이 세션에서 Nexvyn 소스로 다시 확인하지 않았다 — 카드 순번 지연 90ms · 최대 450ms 만 §2.1 실측과 일치한다. Composition 의 값은 자체 값이다 (제약 7).

| 분석 항목               | 분석 내용                                                                                                                             | 판정                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| SVG 계층 6종            | Outline · Content · Structure · Measurement · Handle · Interactive layer                                                              | 채택 — 역할 class 를 이 여섯 계층으로 둔다 (§3.3)                                              |
| 공통 선 굵기 · 불투명도 | wireframe 1.25 · text 0.9 · guide 0.75 · selection 0.75, wireframe 0.85 · guide 0.3                                                   | 채택 (자체 값) — 윤곽 1.25px · 내용 1px · 가이드 0.75px · 손잡이 4px, 화면 기준                |
| 진입 연출               | 윤곽 그리기 0ms → 구조선 200 ~ 350ms → 해칭 · 글자 400 ~ 500ms → 치수 550ms 부터 70ms 간격 → 손잡이 600ms. 카드마다 90ms (최대 450ms) | 채택 — 카드가 처음 그려질 때 한 번 (§3.4). 앞 결정 「진입 stagger 0」 을 바꾼다                |
| 윤곽 그리기 방식        | `pathLength="1"` + `stroke-dashoffset`                                                                                                | 채택 — 시안 2차에서 `non-scaling-stroke` 와 함께 동작 확인 (Chromium)                          |
| Hover 전환              | fill · stroke · opacity 700ms, 가이드 · 손잡이 투명                                                                                   | 채택 — 칠 700ms, 가이드 320ms                                                                  |
| motion token            | 50 · 120 · 200 · 320 · 700 · 1,000ms                                                                                                  | 채택 (자체 token) — 120 · 200 · 320 · 700ms 네 단. 1,000ms 는 idle 반복용이라 두지 않음        |
| 컴포넌트 전용 연출      | Action Button: 550ms 뒤 누름 → 700ms 뒤 Saving + spinner. Checkbox: 채움 → 체크 그리기                                                | 채택 — catalog 상태 쌍이 있는 항목만, CSS delay 로 (§3.4)                                      |
| 클릭으로 상태 유지      | Checkbox 의 44px 클릭 영역 + `useState`                                                                                               | 채택 안 함 — 카드 클릭은 삽입이다                                                              |
| 글자                    | 속 빈 글자 → 채워진 글자                                                                                                              | 채택 안 함 (사용자 확정 2026-11-15) — 내용 글자는 막대 (제약 2). 막대의 색과 불투명도가 바뀐다 |
| 특수 카드               | `card-tall` (2행) · `card-feature` (2×2)                                                                                              | 세로형만 채택 (overlay 가 열린 항목). 2×2 는 채택 안 함                                        |
| 적용 위치               | 편집 Canvas 가 아니라 카탈로그 · 안내 · 온보딩                                                                                        | 일치 — Components 패널과 Navigator Layouts                                                     |
| 같은 스키마에서 생성    | 크기 · 여백 · 상태 값을 시각화와 같은 스키마에서                                                                                      | 일치 — Decision 2 (catalog · layout 결과의 소비자)                                             |

현재 `LIBRARY_CONTRACT_VERSION=67`. 이 ADR로 증가시키지 않는다. RAC workspace 요구 범위는 `^1.22.1`; G0 manifest에는 lockfile로 해소된 실제 버전과 참조 문서 revision/hash를 기록한다. 범위 문자열이나 외부 `main` URL만으로 재현 가능하다고 하지 않는다.

## 3. 처리 흐름과 책임

```text
등록 항목 / project definition snapshot
           + 고정 sample props·locale·date·theme·viewport
                            ↓
             기존 catalog resolve + layout + paint
                            ↓
             해소된 벡터 장면 + semantic anchors
                   ├─ 기존 Canvas 경로와 대조
                   └─ illustration presentation
                       (gray · text bars · fit · vector placeholders)
                            ↓
                 SVG 본체 + anatomy guides
                            ↓
           정적 artifact / 취소 가능한 동적 preview cache
                            ↓
               공통 카드 + kind별 activation adapter
```

### 3.1 기하 해소 계약

`ResolvedIllustrationScene`(제안)은 immutable 파생 결과다. source-space bounds, ordered nodes, clip stack, transform, resolved paint, semantic anchors와 diagnostics를 담는다. 문서에 저장하지 않는다.

| 책임             | 입력과 출력 계약                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| catalog adapter  | 실제 origin/template과 지원 prop을 고정 sample에 적용. raw 사용자 데이터/API/비밀/이벤트 dispatcher를 연결하지 않음 |
| layout adapter   | root와 자식 rect, intrinsic 크기, gap, baseline, portal anchor를 기존 계산에서 읽음. CSS 박스를 다시 추정하지 않음  |
| paint adapter    | token, radius, border target, shadow, state, outline, node별 prepend/append를 해소; 중복 도형 생성 금지             |
| shape normalizer | `auto`·TokenRef·forward target을 제거하고 순수 숫자/색/경로로 변환. unknown kind는 diagnostic error                 |
| SVG emitter      | rect/circle/path/g/clipPath/gradient/filter와 내부 fragment 참조만 출력. 사용자 문자열을 markup으로 주입하지 않음   |
| anatomy composer | 역할 anchor의 bounds에서 guide 위치/치수 계산. guide가 콘텐츠 clip에 잘리지 않도록 별도 overlay group               |
| presentation     | gray 역할 매핑, text→bar, image→기하 placeholder, uniform fit. 원래 scene은 불변으로 유지                           |

`catalogRuleNodeData` 뒤에서만 처리되던 보정은 그 결과까지 조사하고, SVG에 필요한 항목을 공통 순수 함수로 추출한다. 지금의 `catalogRuleShapes`를 이미 완결된 scene이라 부르지 않는다. 노드 외부 shadow·clip·레이어 순서도 G0 책임표에 포함한다.

**생성 실행 환경**: 장면 생성은 브라우저에서만 한다. 빌드 생성은 Playwright 로 띄운 builder 빌드 (또는 browser vitest project) 안에서 fixture graph 를 풀고, 프로젝트 정의의 요청 시 생성은 실행 중인 builder 에서 같은 함수를 부른다. 두 경로 모두 wasm 엔진 (`createLayoutEngine()`) · CanvasKit 글자 측정 (`textMeasure.ts`) · 내장 Pretendard 를 쓴다. Node 에서 엔진·CanvasKit·폰트를 따로 올리는 이식 경로는 만들지 않는다 — 측정 경로가 둘이 되면 같은 입력에서 값이 갈릴 수 있다. inventory 추출 (§5.2) 만 Node 에서 돈다. 엔진 wasm · CanvasKit wasm · 폰트 파일의 hash 를 `definitionDigest` 입력에 넣는다. `pnpm wasm:build:engine` 산출물이 없으면 생성은 실패한다 (조용히 건너뛰지 않음).

**노드 안 부품 key**: `ShapeBase` 에 선택 필드 `part?: string` (제안) 을 둔다. 도형 생성 단계 (`buildCatalogShapes` · `ruleShapes` 의 달력·Chart·segment 경로) 가 역할 key 를 적고, `specShapesToSkia` 는 읽지 않는다. 기존 `id` (border/shadow 대상) 와 뜻이 달라 재사용하지 않는다. G0 inventory 에 「노드 = 부품」 인 항목과 「노드 안 도형 = 부품」 인 항목을 나눠 적고, 뒤쪽만 key 를 붙인다. key 가 없는 도형은 본체로만 그려지고 가이드 대상이 아니다.

SVG 기본 지원에 없는 conic gradient는 미리보기 프로필에서 명시한 무채색 벡터 구간 표현으로 전환하거나 vector wedge로 근사하고 오차를 기록한다. bitmap fallback은 금지한다. 사진·동영상은 동일 bounds의 기하 placeholder를 쓰고 원본 요청은 하지 않는다. 이런 **표현 변환**과 **기하 누락**을 구분하며, 알 수 없는 path/clip은 생성 실패다.

### 3.2 Anatomy 연결

프로필은 `sourceRef`(공식 URL·설치 버전·참조 snapshot hash), role key, catalog 의미 경로/slot, optional 조건, guide 관계를 가진다. 새 RAC tree나 별도 child 좌표를 저장하지 않는다.

- 앵커 identity: asset ID + sample-state ID + 안정 template/slot 경로 + 필요한 반복 item key. React mount ID는 별도다.
- selector 결과 cardinality를 `one / optional / many`로 검증한다. 필수 앵커 0 또는 단일 앵커 2개는 실패한다.
- optional part는 존재할 때만 가이드에 참여한다. 두 anchor 중 하나가 없으면 gap guide도 제거한다.
- collection sample은 고정 item key를 사용한다. array index에 영속 의미를 부여하지 않는다.
- Popover/Calendar 등 overlay는 sample의 open display state와 기존 anchor 배치 계산을 사용한다. 실제 portal을 mount하지 않는다.
- custom component는 `referenceKind=composition`과 catalog 출처를 적는다. block/template 상위 region도 custom 의미를 쓸 수 있다.
- 앵커 key 는 노드 부품이면 template/slot 경로, 노드 안 부품이면 그 경로 + `part` key (§3.1) 다.

**기본 프로필 유도**: 항목마다 프로필을 손으로 쓰지 않는다. 기본값은 아래 규칙으로 만들고, 프로필 파일에는 기본값과 다른 것만 적는다.

- 역할: origin template 의 slot 이름과 부품 type → role key. RAC 공식 anatomy 이름과의 대응표는 type 단위로 한 번만 둔다 (항목 단위 아님).
- sample: binding 의 기본 props 와 origin template 기본 자식. overlay 가 있는 항목만 open 상태를 명시한다.
- 가이드: 외곽 + 손잡이, root 의 padding 이 0 이 아니면 여백 점선, root 폭·높이 치수선, 첫 두 부품 사이 gap. 폭 단계 (§3.3) 가 이 중 몇 개를 그릴지 정한다.
- 손으로 적는 예외: overlay · 반복 부품 · 날짜/시간 조건 · block/layout/template 의 상위 region.

G0 에서 기본 규칙만으로 통과하는 항목 수와 예외 프로필이 필요한 항목 수를 센다. 예외가 전체의 1/3 을 넘으면 규칙을 고친다 (프로필을 늘리지 않음).

| fixture               | 연결할 역할                                              | 주요 가이드                              |
| --------------------- | -------------------------------------------------------- | ---------------------------------------- |
| Button / ActionButton | container, label, optional icon                          | 외곽·콘텐츠 padding·아이콘/라벨 gap      |
| DatePicker            | label, group, date-input, trigger, popover, calendar     | 입력/달력 좌우 끝·trigger 영역·날짜 grid |
| DateRangePicker       | start-input, end-input, trigger, range-calendar, month   | 두 input 관계·2개월 경계·전체 너비       |
| TimeField             | date-input, segment, literal                             | 공통 baseline·segment/literal 중심 간격  |
| RangeCalendar         | grid, cell, selected cell/range                          | 날짜 중심과 선택 범위의 일치             |
| Layout                | body, declared content Slot, optional side/header region | 영역 경계·Slot 위치·컬럼과 gap           |

### 3.3 300×300·무채색 출력

- 본체와 anatomy guide를 합친 painted bounds에 stroke/filter 영역을 포함하고 최소 12 source-output px 안전 여백으로 uniform fit한다. fit은 root transform 한 곳에서 한다.
- 원형·아이콘·달력 cell의 가로/세로 배율을 다르게 하지 않는다. non-scaling stroke 여부는 출력과 카드 크기별로 검증한다.
- 내보내는 SVG 의 필수 경계선은 white/black 배경 각각 대비 3:1 이상을 목표로 한다. 두 조건을 함께 만족하는 회색은 상대 휘도 0.10 ~ 0.30 (대략 `#5A5A5A` ~ `#949494`) 뿐이므로 경계선 색은 이 구간의 한 값으로 고정하고, 면 채움 단계에는 이 조건을 적용하지 않는다. 부가 guide는 시각 회귀로 판정하며 핵심 구조를 그 선만으로 구별하게 만들지 않는다.
- inline SVG 는 색 값을 싣지 않는다. 도형마다 계층 class (윤곽 · 내용 · 구조 · 치수 · 손잡이 · 상태 예시 — §2.2) 와 면 단계 class 를 싣고 chrome CSS 가 `currentColor` · accent token 으로 칠한다. light/dark 는 chrome theme 을 따른다. 내보내는 SVG 는 같은 기하에 고정 회색 표를 적용한 결과다 — `artifactDigest` 는 기하와 역할 class 까지를, 내보내기 파일은 여기에 회색 표 버전을 더해 hash 한다.
- **inline 틀 — 실제 크기 근처**: inline SVG 의 viewBox 는 300×300 이 아니라 그려진 범위 (본체 + 가이드) 를 카드 비율로 넓힌 것이다. 미리보기는 가로형 3:2 이고, overlay 가 열려 세로로 긴 항목은 세로형 3:4 (2열 이상에서는 2행 차지) 다. viewBox 최소 폭은 155 source px — 단계 M (미리보기 192px) 에서 실제 크기의 1.25배, 단계 L (284px) 에서 1.85배가 확대 상한이다. 큰 항목은 제한 없이 줄인다. 내보내는 300×300 은 같은 장면을 정사각으로 fit 한 것이며 기하는 하나다. 줄인 뒤 화면에서 2px 미만이 되는 부품은 가이드 대상에서 빼고 본체만 그린다.
- **가이드 간격은 viewBox 폭에 비례**: 치수선과 본체 사이 거리 · 눈금 길이를 source px 로 고정하면 큰 항목 (Layout 1280px) 에서 화면 1px 로 붙는다. viewBox 폭의 일정 비율로 적는다.
- **선 굵기는 화면 기준**: 윤곽 1.25px · 내용 1px · 가이드 0.75px · 손잡이 4px (시안 2차 값). inline SVG 는 한 벌이 카드 폭 68 ~ 284px 에 걸쳐 그려지므로 (시안 실측) chrome CSS 가 `vector-effect: non-scaling-stroke` 와 굵기를 준다 — 굵기를 SVG 좌표로 적으면 작은 카드에서 0.3px 가 된다. 내보내는 파일은 300px 표시를 기준으로 emitter 가 fit 배율의 역수를 곱한 굵기를 적는다 (`vector-effect` 에 기대지 않음 — 파일을 여는 도구마다 지원이 다름).
- **모서리 손잡이는 길이 0 인 선** (`stroke-linecap: square`, 굵기 4px) 으로 그린다 — 카드 폭과 무관하게 화면에서 같은 크기다.

**카드 폭 단계** (2026-11-15 시안 2차로 확정). 기준은 미리보기의 화면 폭이다. 본체는 모든 단계에서 윤곽선 ↔ 칠이다.

| 단계 | 미리보기 폭 | 가이드                                       | 글자 층                        |
| ---- | ----------- | -------------------------------------------- | ------------------------------ |
| S    | 144px 미만  | 외곽 + 손잡이, 핵심 치수 1개                 | 그 치수의 숫자                 |
| M    | 144 ~ 260px | S + 구조 점선 (여백 · 정렬), 치수 최대 3     | 치수 숫자                      |
| L    | 260px 이상  | M + 부품 간 gap, 치수 최대 6 (Nexvyn 최대치) | 치수 숫자 + 사양 메모 최대 2줄 |

- **열 수는 (가) 로 확정** (사용자 판정 2026-11-15): grid 최소 카드 폭 160px. 228px 패널 1열 · M, 320px 1열 · L, 360px 부터 2열. Components 패널에서는 S 가 나오지 않는다 — S 는 80px 급 썸네일을 쓰는 다른 소비자용이다.
- **치수선은 숫자와 함께만 그린다** (사용자 판정 「뜻이 전달되게」). 숫자를 놓을 자리가 없으면 선도 그리지 않는다. 숫자는 HTML 글자 층이라 카드가 작아도 화면 10px 로 읽힌다.
- **가이드 색은 본체와 갈린다** (사용자 판정 「구분되게」): 구조선 · 치수선 · 손잡이 = `--canvas-selection-strong` (Canvas 선택 표시와 같은 계열), 숫자 = `--focus-ring` (10px 글자 대비 4.5:1 이상). 색 외에 굵기 (0.75px) 와 점선으로도 갈린다. 본체는 `currentColor` 다.
- 글자는 chrome 의 mono 글꼴 token 을 쓰고 내보내는 SVG 에는 들어가지 않는다.
- 단계는 container query 로 CSS 가 고른다. 단계별로 SVG 를 따로 생성하지 않고, 한 SVG 안의 가이드 묶음에 단계 class 를 붙여 숨긴다.
- text bar는 실제 계산된 line box/정렬을 소비한다. 측정은 고정 sample과 고정 폰트 환경에서 끝내고, export에 font 의존성을 남기지 않는다.
- DateField fixture locale/format은 `/`, TimeField는 두 구간과 `:`가 보이는 고정 형식을 사용한다. 실제 사용자 locale을 바꾸지 않는다.
- 날짜 너비/간격 요구는 **preview fixture의 명시적 구성**으로 충족한다. 지원된 catalog props/visual 입력으로 계산하고 child를 출력 단계에서 임의 이동하지 않는다. 기존 원본의 128/256 같은 좌표를 새 catalog의 일반 치수로 강제하지 않는다. 두 월은 같은 month viewport를 공유해 2배 관계를 비교한다.
- anatomy와 rendered 두 상태에서 날짜 정렬 관계가 유지되어야 한다. 부족하면 fixture/공통 계산을 수정하고 gate를 통과시킨다.

### 3.4 Hover·focus

상태는 `anatomy → rendered → anatomy`. 가이드 opacity와 본체 fill/stroke/opacity 전환을 기본으로 하고 path geometry morph는 초기 필수 범위에서 제외한다. 칠 전환은 700ms, 가이드가 물러나는 전환은 320ms 다. idle 반복 애니메이션은 없다.

**진입 연출** (사용자 목표 2026-11-15, §2.2): 카드가 처음 그려질 때 한 번 재생한다 — 윤곽 그리기 (0ms 시작, 500ms) → 구조선 (200ms) → 내용 (400ms) → 치수선 · 숫자 (550ms 부터 70ms 간격) → 손잡이 (600ms) → 메모 (700ms). 카드마다 순번 × 90ms (최대 450ms) 를 더한다. CSS `animation` 뿐이고 `backwards` 로만 채워, 끝나면 idle 스타일로 돌아간다. hover 를 벗어나거나 스크롤로 다시 보여도 재생하지 않는다. section 을 다시 펼치면 내용이 새로 렌더되므로 재생된다. reduced motion 에서는 없다. 여러 카드가 함께 재생되므로 G6 에서 패널 열기 비용을 재고, 넘으면 화면에 보이는 카드로 제한한다.

상태 쌍은 동일 part key로 대응한다. part가 추가/제거되면 fade로 처리하며 무관한 path끼리 보간하지 않는다. `pending` 등 동작 예시는 지원 상태가 있는 일부 항목만 synthetic state로 보여준다. 이를 실제 저장·선택·네트워크 동작으로 연결하지 않는다.

**전환 수단은 CSS 뿐이다** (Nexvyn 과 같은 방식). 카드 Button 의 `:hover` · `:focus-visible` (RAC `data-hovered` · `data-focus-visible`) 이 SVG 안 역할 class 의 fill · stroke · opacity 를 바꾼다. 내장 항목에는 상태 기계 · 타이머 · 재생 큐가 없으므로 pointer leave · blur · unmount 의 cancel 은 CSS 가 처리한다. 본체 도형은 한 벌이고 anatomy 에서는 `fill: none` + 경계선, rendered 에서는 역할별 칠이다. 가이드 묶음과 글자 층은 opacity 로만 물러난다.

글자 층 (치수 숫자 · 사양 메모) 은 SVG 밖의 HTML 층에 % 좌표로 놓는다 — SVG 가 줄어도 글자 크기가 화면 기준으로 고정된다. 좌표와 문자열은 생성 때 anchors 에서 만든 메타데이터다.

hover 카드와 focus-visible 카드가 다르면 둘 다 rendered 로 보인다 (전환은 한 번씩이고 반복이 없다). synthetic state 예시 (`pending` 등) 를 가진 항목만 재생 대상이며 동시에 하나만 재생한다. section collapse 때는 내용이 렌더되지 않는다. reduced motion은 상태를 즉시 교체하고 모든 keyframe/transition 반복을 끈다. touch에서는 hover 예열 없이 첫 탭이 기존 activation을 수행한다.

**컴포넌트 전용 연출**: catalog 상태 쌍이 있는 항목은 rendered 전환 뒤에 상태 예시를 이어 붙인다 (Button: 550ms 뒤 pressed → 700ms 뒤 pending, Checkbox: selected 의 체크 그리기). 두 상태의 도형을 생성 때 같은 장면에 함께 넣고 CSS delay 로 바꾼다. 대상 항목과 상태 쌍은 G0 inventory 에 적는다. 카드 클릭으로 상태를 유지하는 동작은 없다 — 클릭은 삽입이다.

정적 파일의 ID는 asset hash 기반으로 결정적이다. inline mount에서는 `useId` 등 mount별 prefix로 `id`, `url(#...)`, `href`, aria 참조를 일괄 치환한다. 같은 항목이 최근·즐겨찾기·일반 목록에 함께 있어도 전역 ID 중복이 없어야 한다.

## 4. 네 종류의 registry와 동작

공통 descriptor(제안)는 아래 필드를 가진다. **목록 표시용 adapter 결과**이며 새로운 CatalogGraph entry가 아니다.

| 필드                                           | 의미                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `assetId`                                      | namespace가 있는 안정 ID. 기존 palette ID는 명시적으로 매핑하여 보존                         |
| `kind`                                         | `component / block / layout / template`                                                      |
| `sectionId`, `order`, `labelKey`, `visibility` | 목록 분류와 노출. 현재 component 값은 getPaletteItems/PALETTE_CATEGORIES에서 파생            |
| `source`                                       | catalog palette ID, builtin recipe, project definition 등 판별 가능한 참조                   |
| `previewProfileId`                             | sample와 anatomy/표현 프로필 참조                                                            |
| `activation`                                   | kind별 명령 adapter capability 또는 미지원 사유; 실행 함수 자체는 manifest에 직렬화하지 않음 |
| `dependencies`                                 | transitive origin/recipe/theme/anatomy 연결과 해시                                           |

component는 primitive 수와 무관한 사용자 팔레트 단위다. `DatePicker`가 여러 RAC 요소로 구성된다고 자동으로 block이 되지 않는다. `category=layout`인 Frame/Card와 `kind=layout`인 재사용 page layout을 구분한다.

프로젝트 definition ID에는 project namespace를 포함하고 built-in ID와 섞지 않는다. 원본 definition label은 편집해도 identity가 유지된다. project graph revision 전체를 모든 카드의 영구 cache key로 쓰지 않고 참조 subtree/definition/theme dependency digest를 구한다.

### 확장 도입 범위

1. 기존 Components 목록과 command runner에 preview만 연결한다. 추가/필터/검색 정본을 교체하지 않는다.
2. Navigator Layouts는 동일 SVG consumer에 기존 definition snapshot을 넘긴다. layout 편집·선택·적용 버튼 의미는 유지한다.
3. block/template은 최소 각 1개 합성 fixture로 nesting·dependency·preview·unsupported activation을 검증한다. 실제 제품 항목 등록은 유효한 source와 activation adapter를 함께 제공할 때만 허용한다.
4. Blocks/Templates 제품화 시 사용자 결정 2건을 확정하고 기존 명령의 transaction 계획으로 연결한다. 새 authoring/store/marketplace/version-upgrade UI는 이 ADR의 미리보기 구현에 포함하지 않는다.

중첩 dependency cycle은 오류다. 참조 누락·삭제된 layout definition은 stale SVG를 계속 보여주지 않고 preview unavailable 상태로 전환한다. 대상이 유효한 경우에만 기존 동작을 활성화한다.

## 5. 버전관리·이력·재생성

### 5.1 정본과 파일 배치 제안

| 위치                                                | 소유 내용                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 기존 catalog / palette / theme / definition         | 구조·목록·기하 정본 그대로                                                           |
| `apps/builder/src/builder/illustrations/`           | source adapters, RAC anchor 연결, sample·presentation profiles, preview cache bridge |
| `packages/rendering/src/illustrations/`             | scene/anchor 출력 타입, 순수 SVG emitter와 geometry/guide 계산; builder import 금지  |
| `apps/builder/src/builder/styles/`                  | 카드·anatomy·motion chrome 스타일                                                    |
| `apps/builder/scripts/illustrations/`               | inventory, fixture resolve, generate, check, release 명령 구현                       |
| `apps/builder/src/builder/illustrations/generated/` | 현재 manifest와 kind/section별 lazy SVG 모듈. 생성기로만 변경                        |
| `docs/design/component-illustrations/anatomy/`      | 전달용 SVG·contact sheet·manifest·release ledger. 기존 `.gitignore` 예외 아래에 둠   |
| `.agent/runs/<run-id>/`                             | 임시 비교 이미지·성능·검증 로그. 제품 artifact와 분리, 로컬 전용                     |

두 출력 디렉터리는 하나의 생성 명령에서 같은 immutable artifact bytes/manifest를 소비한다. 소스는 profiles와 catalog 하나이며, 양쪽 결과의 hash 일치를 검사한다. 기존 Python 제작물은 상위 폴더에 보존하고 anatomy 디렉터리를 쓰지 않는다. 새 active output을 생성한 뒤 문서가 어느 생성기를 실행해야 하는지 명시한다.

`docs/design/` 전체 ignore를 해제하거나 루트 `design/`·`assets/`를 만들지 않는다. 임의 root 폴더를 만드는 것 없이 기존 패키지/Builder/문서 경계 안에 둔다.

### 5.2 버전 필드

| 필드                                   | 바뀌는 조건                                                                    | 저장/검증                                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `schemaVersion`                        | manifest reader 계약 변경                                                      | 지원하지 않는 버전은 읽지 않고 이전 release/아이콘으로 복귀                           |
| `releaseId`                            | 배포할 inventory/definition/presentation/output 변경 묶음                      | 증가하는 정수; 같은 releaseId의 내용 변경 금지                                        |
| `inventoryDigest`                      | 종류·section ID/label/order·항목 order/label/visibility/source/activation 변경 | canonical JSON hash; section-only 변경도 검출                                         |
| `definitionDigest`                     | origin/template/props/layout/paint/theme 또는 중첩 구성 변경                   | transitive dependency hash; dependency 목록을 함께 기록                               |
| `presentationDigest`                   | anatomy 연결·표시 가이드·gray/text-bar·motion 설정 변경                        | reference snapshot·generator version 포함                                             |
| `artifactDigest`                       | canonical SVG/inline 상태 데이터 결과                                          | 정규화한 안정 serialization bytes SHA-256                                             |
| `sourceRevision` / `sourceInputDigest` | 생성한 source provenance                                                       | 생성물·ledger를 제외한 입력 commit/파일 hash; dirty 입력은 표시하며 정식 release 금지 |

**읽는 곳** — 소비자가 없는 필드는 두지 않는다.

- `schemaVersion`: 패널의 manifest reader (모르는 버전이면 아이콘으로 복귀).
- `inventoryDigest`: `illustrations:check` — 실행된 palette 목록과 다르면 실패. section 만 바뀐 변경을 여기서 잡는다.
- `definitionDigest` · `presentationDigest`: 생성기 — 둘 다 같으면 그 항목의 재생성을 건너뛴다. 동적 preview 의 cache key 이기도 하다.
- `artifactDigest`: lazy SVG 모듈의 파일 이름 (cache 갱신) 과 두 출력 디렉터리의 일치 검사.
- `releaseId` · `release-history.json`: `illustrations:check` — manifest 가 직전 release 와 다른데 기록 항목이 없으면 실패한다 (변경 사유를 강제). 패널 runtime 은 읽지 않는다.
- `sourceRevision`: 사람이 읽는 provenance. 검사는 dirty 여부만 본다.

생성 명령을 두 단계로 나눈다. `generate/check`는 현재 입력으로 deterministic 결과를 만든다. `release`는 입력 commit이 확정된 뒤 그 commit과 결과를 기록한다. 출력 파일의 자기 commit hash는 output 내용과 cache key에 넣지 않는다. 생성 시간은 release 기록에만 남기고 SVG/geometry hash에는 넣지 않는다.

`release-history.json`(제안)은 releaseId, previousReleaseId, sourceRevision, 각 digest, added/removed/renamed/moved/reclassified/visualChanged 항목, 사유와 검사 결과 참조를 append-only로 보관한다. 원본 파일의 실제 diff는 Git에 맡기며 모든 버전의 SVG 복사본을 제품 번들에 넣지 않는다. 롤백도 새로운 release 기록으로 남기고 manifest와 artifact를 한 묶음으로 전환한다.

component 목록은 generator가 **실행된** `getPaletteItems()`와 category 순서를 읽는다. React icon 참조를 제외한 직렬화 descriptor를 공유 추출하여 generator가 browser/CanvasKit을 import하지 않게 한다. 수작업 항목 배열/regex로 둘째 목록을 만들지 않는다. libraryOnly/layoutOnly 조건은 inventory에 남기고 컨텍스트별 expected visible IDs도 검증한다.

### 5.3 변경 사례와 호환성

| 변경                               | 처리                                                                                                                       |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| label 변경 / section 이동·재정렬   | asset ID 유지, inventoryDigest 변경, release에 사유 기록; SVG가 동일하면 재생성 캐시 재사용                                |
| Chart 변형 추가                    | 새 palette ID와 fixture/profile coverage 필요; canonical Chart로 합쳐지면 실패                                             |
| 새 종류 도입                       | kind registry/reader 지원과 source·activation capability 검증; 기존 ID를 위치로 재번호 매기지 않음                         |
| definition·theme·nested block 변경 | 전이 dependency로 관련 SVG만 무효화; parent template까지 전파                                                              |
| ID 변경                            | 명시적 old→new alias (release 기록). chain cycle·알 수 없는 target 거부; 저장된 즐겨찾기/최근 사용의 옛 ID 는 읽을 때 버림 |
| 항목 삭제                          | tombstone, 이유, 대체 항목 선택적 기록. 새 목록에서 제거하고 stale 참조 정리; 문서 노드 삭제 금지                          |
| 이미 삽입한 문서                   | preview release와 분리. 기존 graph/명령/definition 계약을 따르며 자동 migration·자동 교체 없음                             |
| 프로젝트 정의 수정                 | 로컬 dependency digest로 캐시 교체; 사용자 내용·SVG를 Git ledger/배포 ZIP에 넣지 않음                                      |

저장된 즐겨찾기 · 최근 사용 · collapse 값에 alias 를 적용하는 코드는 만들지 않는다 (ADR 사용자 결정 3 — 2026-11-15 확정). alias · tombstone 은 release 기록에만 남고, 저장값 중 모르는 ID 는 읽을 때 버린다. component 의 `assetId` 는 현재 palette `type` 에서 순수 함수로 만들므로 지금 저장값은 그대로 읽힌다.

기존 `comp-${categoryKey}` collapse ID는 유지한다. section 을 개명하면 release 기록에 alias 를 남기고, 옛 ID 의 collapse 값은 읽을 때 버려 그 section 만 기본 상태로 돌아간다. 전체 최근/즐겨찾기/collapse 상태를 초기화하는 방식은 금지한다.

## 6. 성능·실행 격리

- 내장 항목은 생성 완료된 SVG를 kind/section별로 lazy load한다. active panel이 없는 초기 경로에서 emitter·fixture runtime·CanvasKit을 로드하지 않는다.
- 동적 preview는 프로젝트 graph의 읽기 전용 snapshot과 고정 dummy data를 사용한다. 실제 endpoint/binding/action은 해석해 실행하지 않고 preview용 표본으로 치환한다.
- 생성 동시 실행은 1개, unmount/새 요청/definition 삭제 시 이전 작업을 취소하거나 결과를 폐기한다. 긴 작업은 yield 가능한 단계로 나누며 비용이 크면 작업 실행 위치를 G0 근거로 조정한다. worker로 옮겼다고 DOM/폰트 의존이 자동 해결된다고 가정하지 않는다.
- 제안 상한: 동적 scene 500개 노드, 목록 표본 8개 항목, decoded preview cache 총 16 MiB 및 128 entries 중 먼저 닿는 쪽에서 LRU eviction. 제한 초과는 명시적인 요약/미리보기 제한 표시; 전체 항목을 그린 것처럼 제시하지 않는다.
- 동적 생성은 live root 와 다른 엔진 인스턴스를 쓴다 (`createLayoutEngine()` — `pagePlacement.ts` 의 `placementEngine` 이 같은 방식의 선례). 글자 측정 cache 는 읽기 공유하되 preview 가 live root 의 layout 상태를 바꾸지 않는다.
- 무효화 시점: 상태 변경 파이프라인의 구독자 단계에서 「바뀐 definition ID」 만 표시해 두고, digest 계산과 재생성은 그 카드가 화면에 보일 때 한다. 편집마다 digest 를 계산하지 않는다. Layouts 탭이 닫혀 있으면 아무것도 하지 않는다.
- SVG 요소 상한 (제안): SVG 하나 250 (Nexvyn 최대 217), 열린 section 합계 6,000. 초과 항목은 먼저 같은 칠의 반복 도형을 path 하나로 합친다 (달력 셀). 그래도 넘으면 반복 부품을 표본 수로 줄이고 제한 표시를 한다. 닫힌 section 은 내용을 렌더하지 않으므로 합계에 들지 않는다.
- cache key는 asset ID + dependency digests + profile/state + theme/density/locale + viewport bucket + emitter version. 실제 hover frame마다 layout을 재계산하지 않는다.
- 성능 수치는 신규 목표이며 실측 아님: 같은 production 문서·장치·viewport에서 30회 열기/검색 비교, warm panel 반응 p95 증가 ≤ 20ms, preview로 발생한 main-thread 단일 task < 50ms. 추가 JS heap은 cache byte 상한과 별도로 전후 계측한다. 실패하면 원인과 cold/warm을 분리 보고한다.
- 번들 절대/증분 한도는 구현 시 현재 ADR-201 gate를 사용하며 stale 숫자를 새 예산으로 고정하지 않는다. 기존 초과와 이 변경의 증분을 별도 기록한다. G0 기준선 미측정은 PASS가 아니다.

## 7. Phase와 파일 변경표

| Phase | 작업                                                             | 주요 파일/경계                                                                            | 종료 조건                                 |
| ----- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------- |
| 0     | 실행 inventory·anatomy 출처·shape/후처리 coverage·성능 기준 고정 | palette, ruleShapes, canvasBinding, layout, Adobe snapshot, 기존 SVG; 보고는 이 문서 갱신 | G0, unknown 목록과 지원 전략 확정         |
| 1     | 해소된 scene 경계와 순수 SVG emitter                             | rendering illustrations 신규, 기존 shape/render helpers의 필요한 부분만 추출              | G1, Canvas 공통 경로 인접 회귀            |
| 2     | semantic anchors·가이드·presentation·상태 쌍                     | Builder profiles와 rendering guide 함수; 날짜/시간·overlay·collection fixture             | G2, 타입별 coverage 전수                  |
| 3     | inventory/manifest/hash/release·재생성·alias/tombstone           | scripts illustrations, generated modules, anatomy export, release ledger                  | G4, 변화 시나리오와 재현성                |
| 4     | Components 카드 연결                                             | ComponentList, 전용 SVG preview/card, chrome CSS; 기존 command runner 유지                | G3, current palette 전수 + 실제 Builder   |
| 5     | Layouts 재사용·네 kind adapter 확장 검증                         | Navigator 소비자, 기존 layout 명령 회귀, block/template 합성 fixture                      | G5; 미구현 activation과 구현 preview 구분 |
| 6     | 비용 계측·문서·출력 정본 전환                                    | performance/browser harness, SVG README, CHANGELOG, ADR 진행 기록                         | G6, 실측 증거와 미검증 범위 보고          |

**Phase 0 의 시안 (emitter 구현 전)**: Button · DatePicker (열림) · TableView · Chart 한 종 · Layout 한 종을 손으로 만든 SVG 로 폭 단계 S · M · L 과 열 수 (가)/(나) 안에 넣어 실제 패널 (228 · 320 · 480px, light/dark) 에서 본다. 판정은 사용자 confirm 이다. 이 시안은 버리는 산출물이며 저장소에 넣지 않는다 (`.agent/runs/`). 시안에서 S 단계가 읽히지 않으면 열 수 (가) 안으로 가거나 단계 경계를 고친 뒤 Phase 1 에 들어간다.

**시안 1차 (2026-11-15, 판정 완료 — (가) · 가이드는 구분되게 · 치수선은 뜻이 전달되게)**: `.agent/runs/adr311-g0-mockups/index.html` — 5종 × 패널 폭 3 × 열 수 2안, light/dark · 가이드 색 · 상태 전환 버튼. Playwright Chromium 에서 연 실측 (미리보기는 1:1, 카드 = 미리보기 + 이름, L 은 메모 2줄 추가):

| 패널  | 안   | 열 수 | 카드    | 미리보기 | 단계 | 90개 스크롤 길이 |
| ----- | ---- | ----- | ------- | -------- | ---- | ---------------- |
| 228px | (가) | 1     | 210×230 | 192px    | M    | 21,420px         |
| 228px | (나) | 2     | 101×121 | 83px     | S    | 5,805px          |
| 320px | (가) | 1     | 302×354 | 284px    | L    | 32,580px         |
| 320px | (나) | 3     | 95×115  | 77px     | S    | 3,700px          |
| 480px | (가) | 2     | 227×247 | 209px    | M    | 11,475px         |
| 480px | (나) | 5     | 86×106  | 68px     | S    | 2,052px          |

현재 아이콘 카드 (228px 패널 2열 · 102×100) 는 같은 계산으로 4,860px 이다. 시안에서 함께 드러난 것: S 단계의 치수선은 숫자가 없어 뜻이 전달되지 않는다. chrome 의 `--accent` 는 무채색이라 가이드가 본체 윤곽선과 색으로 갈리지 않는다 — 시안에 focus 파랑 안을 같이 넣었고 가이드 색도 사용자 판정 항목이다.

**시안 2차 (2026-11-15)**: `.agent/runs/adr311-g0-mockups/v2.html` — 판정과 §2.2 를 반영한 6종 (Button · Checkbox · DatePicker 열림 · TableView · Bar Chart · Layout). Playwright Chromium 실측:

| 패널              | 열 수 | 카드 (세로형)     | 미리보기 | 단계 | 일반 카드 90개 스크롤 길이 |
| ----------------- | ----- | ----------------- | -------- | ---- | -------------------------- |
| 228px             | 1     | 210×166 (210×294) | 192×128  | M    | 15,660px                   |
| 320px             | 1     | 302×259 (302×449) | 284×189  | L    | 24,060px                   |
| 480px             | 2     | 227×177 (227×363) | 209×139  | M    | 8,340px                    |
| 참고: 80px 썸네일 | 2     | 101×93 (101×195)  | 83×55    | S    | 4,560px                    |

228px 패널의 길이는 정사각 미리보기 (1차) 21,420px 에서 15,660px 로 줄었고, 현재 아이콘 카드의 3.2배다 (세로형 항목이 있으면 더 길다). 확인한 것: 윤곽 그리기 (`pathLength` + `non-scaling-stroke`), Button 의 pending 전환, dark, S 단계의 숫자. 실제 Builder 패널에 넣은 확인은 아니다 — G3 대상이다.

추정 영향 범위 20–30개 파일(신규 모듈/테스트 포함), 생성 SVG·manifest는 별도다. G0에서 확정하며 추정 초과를 이유로 별도 ADR로 자동 분리하지 않는다. Blocks/Templates 실제 제품 활성화는 해당 사용자 결정과 adapter 준비가 충족되어야 하며, fixture 통과만으로 완료 표시하지 않는다.

## 8. 검증 매트릭스

| 대상       | 사례                                                                                          | 기대 / gate                                                                |
| ---------- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 목록       | 항목 추가·삭제·개명·section 이동/순서·종류 변경·layoutOnly/libraryOnly                        | inventory diff와 release 분류 정확, 누락 검출 / G0·G4                      |
| 기하       | rect, 4-corner radius, arc, icon/path, border/shadow target, clip, nested transform, gradient | 해소 오류 0, source bounds 오차 ≤ 0.5px, paint 순서 일치 / G1              |
| 상태       | rest/selected/disabled/invalid, optional label/icon, overlay open, repeated parts             | 동일 semantic part 대응, 없는 guide 없음 / G2                              |
| 날짜       | DateField, TimeField, DatePicker, DateRangePicker, RangeCalendar                              | 본문 좌표 관계 전부, anatomy/rendered 양쪽 / G2                            |
| 출력       | 300×300·흰/검은 배경·100%/작은 thumbnail·shadow 최대 경계                                     | 투명·gray·비율·no raster/external·clipping 0 / G1·G2                       |
| 중복 mount | 같은 항목 recent/favorite/category 3곳                                                        | gradient/filter/clip/aria ID 충돌 0 / G3                                   |
| panel      | 228/320/480/640px, 검색, 접기, resize, 한국어/영어 긴 이름                                    | Section 보존, label 읽기 가능, 실제 열/크기 기록 / G3                      |
| 조작       | hover, focus, blur, Enter/Space, touch, reduced motion                                        | 삽입 1회·Undo 1회, hover 쓰기 0, idle 반복 0 / G3                          |
| 문서 격리  | hover 전후 graph revision/history/autosave/network 비교                                       | 변화 0 / G3                                                                |
| kinds      | component·block·layout·template, 중첩·cycle·삭제 dependency                                   | 일치하는 preview·명시적 실패, layout은 기존 apply/Undo / G5                |
| 재현성     | clean 동일 입력 2회, section-only, theme-only, nested dependency 수정                         | byte 일치 또는 정확한 관련 digest 변경, stale 산출물 거부 / G4             |
| 호환       | 옛 favorites/recent/section state, alias chain/cycle/tombstone                                | 지금 저장값 그대로 읽힘 · 모르는 ID 는 버림 · alias 검사, 문서 변경 0 / G4 |
| 성능       | 90 기준+현재 inventory, 중복 recent/favorite, 복잡 template, hidden panel                     | warm/cold·frame·long task·heap·번들 및 상한 / G6                           |

새 명령은 구현 시 root `pnpm` script로 등록할 계획이다: `illustrations:generate`, `illustrations:check`, `illustrations:release` (이름 제안, 현재 없음). `check`는 inventory·byte 재현성·manifest·coverage·출처 검사를 묶으며 실패 시 exit nonzero다. release 전에 검사하고 pre-push 또는 `push: main` workflow에 경로별 gate로 연결한다.

TS 변경에는 `pnpm run codex:typecheck`, 공통 shape 변경에는 인접 Vitest, UI 변경에는 실제 Builder 흐름을 실행한다. 마지막은 `pnpm run codex:preflight`; 문서 작성 시 통과와 구현 gate 통과를 섞지 않는다. 정식 review가 요청되면 별도 `review-adr` 절차를 따르며 이 문서 자체 점검을 승인 round로 기록하지 않는다.

## 9. 현재 검증 상태

- 확인: 기존 소스 경로·정적 SVG manifest·RAC API 구조·Nexvyn 라이선스와 대표 hover·Builder 현재 카드 크기.
- 확인 (2026-11-15 보완): Nexvyn grid · viewBox · 요소 수 · 가이드 어휘 · hover CSS (§2.1), `ShapeBase` 식별자, `textMeasure.ts` 의 CanvasKit 의존, 즐겨찾기 저장 키. 달력 셀이 grid 노드의 도형으로 그려지는지는 `ruleShapes.ts` · `canvasBinding.ts` 주석 수준으로만 봤다 — G0 inventory 에서 확정한다.
- 외부 기준 (G1 · G2): G1 의 픽셀 대조는 ADR-248 G3 시각 비교 하니스를, G2 의 DOM 대조는 browser parity project 를 쓸 수 있는지 G0 에서 확인한다. 둘 다 아직 이 용도로 돌려 보지 않았다.
- 미구현: SVG consumer, anatomy 연결 registry, 네 kind preview adapter, release manifest/ledger와 자동 gate.
- UNVERIFIED: 생성된 anatomy 화면의 품질, 전체 항목 coverage, Canvas 공통화 회귀, 최종 번들·성능·사용자 조작. 위 Phase/gate는 구현 후의 검증 계획이다.
