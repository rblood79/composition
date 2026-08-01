# ADR-176 설계 Breakdown: Canvas authoring gesture 및 page position 렌더링 최적화

## 1. Scope and dependency lock

### 1.1 In scope

- `usePageDrag`의 page title gesture를 shared gesture ownership과 동일한
  lifecycle contract로 이관
- page position transient presentation과 finish-only canonical commit 분리
- central pointer, element hover, workflow hover, page-frame click의 owner
  arbitration 및 effect dependency 안정화
- page position을 읽는 renderer/page title bounds/hit-test/culling 경로의 source
  정합성 확인
- 실제 multi-page Builder trace와 regression tests를 통한 성능·정합성 검증

### 1.2 Explicitly out of scope

- document schema, page position field 형식, breakpoint snapshot schema migration
- component spec, CSS generator, Preview/Publish runtime, visual token 변경
- Skia culling radius/padding, raster deferral, content cache lifetime, paragraph
  ownership 변경
- ADR-172/173의 Deprecated 전제 재도입 또는 ADR-175 viewport camera 결정 수정
- 새 global event router를 도입하는 전면 input rewrite

### 1.3 Four-question fork lock

| 질문                                        | 판정                                                                                                                                                                                         |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| base/application 관계인가?                  | ADR-175는 viewport camera scheduling의 base 원칙만 제공한다. ADR-176은 page position authoring gesture의 sibling contract다. page state를 camera state의 specialization으로 취급하지 않는다. |
| schema가 specialization 관계인가?           | 아니다. 기존 page position과 breakpoint snapshot을 그대로 읽고 finish 시 기존 canonical writer를 호출한다.                                                                                   |
| predecessor premise를 reverse verify했는가? | ADR-175의 finish commit/RAF 원칙은 유지하고, ADR-172/173의 culling/raster/cache 정책은 이 ADR의 전제에서 제외한다.                                                                           |
| 나중 review까지 미룰 경계가 있는가?         | 없다. owner, presentation, canonical commit, renderer source, active breakpoint, forbidden renderer scope를 Phase 0 전에 lock한다.                                                           |

## 2. Current evidence and dependency map

현재 read-only audit에서 확인한 연결은 다음과 같다.

| 경로                                                                                 | 현재 동작                                                                                                       | 설계상 관심사                                                          |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/builder/src/builder/workspace/canvas/interaction/canvasGestureSession.ts`      | `idle`, `element`, `pan`과 active pointer/Space 상태를 추적                                                     | page owner를 추가할 때 pointer id와 종료 lifecycle을 보존              |
| `apps/builder/src/builder/workspace/canvas/hooks/usePageDrag.ts`                     | 자체 `window pointermove`/`pointerup`, RAF별 `updatePagePosition`                                               | shared owner, cancel 경로, transient adapter의 진입점                  |
| `apps/builder/src/builder/stores/elements.ts`                                        | `updatePagePosition`이 매 호출 새 positions map과 `pagePositionsVersion`을 생성                                 | canonical writer의 성공 finish-only 호출과 same-value guard            |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`                        | `pagePositions`/version을 scene snapshot·renderer input에 전달; `frameAreas`/selection bounds dependency에 포함 | transient source와 canonical source의 의존성 분리                      |
| `apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts` | move마다 rect 변환·hit-test·cursor를 수행하고 page position dependency가 effect를 재설정                        | page owner 중 suppressed path 및 stable callback/ref                   |
| `apps/builder/src/builder/workspace/canvas/hooks/useElementHoverInteraction.ts`      | Space/pan에서 hover RAF를 취소·억제                                                                             | page owner도 같은 suppression contract로 연결                          |
| `apps/builder/src/builder/workspace/canvas/hooks/useWorkflowInteraction.ts`          | pointer/hover 기반 workflow interaction                                                                         | page drag와 workflow click/hover priority를 명시                       |
| `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx`                      | page position version을 content invalidation/stale frame 입력으로 사용                                          | transient presentation을 읽되 culling/raster 정책은 변경하지 않음      |
| `apps/builder/src/builder/workspace/canvas/skia/renderCommands.ts`                   | render command cache key에 page position version이 관여                                                         | command cache 정책을 바꾸지 않고 입력 source만 검증                    |
| `apps/builder/src/builder/workspace/canvas/renderers/rendererInput.ts`               | scene/renderer input projection                                                                                 | page position presentation과 canonical projection의 identity 경계 확인 |
| `apps/builder/src/builder/workspace/canvas/viewport/viewportPresentation.ts`         | controller의 transient viewport를 frame 단위 publish                                                            | page presentation store가 이 lifecycle 패턴을 재사용할 후보            |

이 표는 구현 허용 목록이 아니라 Phase 0에서 확인할 dependency map이다. 실제
source가 다르면 변경 전에 breakdown과 allow-list를 갱신하고 review를 다시 거친다.

## 3. Runtime state contract

### 3.1 Gesture owner

`CanvasGestureSession`의 owner 상태는 `idle`, `pan`, `element`, `page`로
표현한다. page title capture는 generic `beginPointer()`를 먼저 호출하지 않고
`tryClaimPage(pointerId, pageId, startBreakpoint)`를 먼저 호출한다. claim이
실패하면 기존 `pan`/`element` resolution으로 내려간다. owner가 획득한
`pointerId`, 대상 `pageId`, `startBreakpoint`를 pointer 종료까지 유지한다.

| owner     | 허용되는 연속 동작               | 억제되는 경로                                                       | 종료 시 commit                              |
| --------- | -------------------------------- | ------------------------------------------------------------------- | ------------------------------------------- |
| `pan`     | viewport transient pan/zoom      | element/page hover, 경쟁 drag                                       | ADR-175 viewport mirror                     |
| `element` | 선택 element의 기존 drag preview | page drag, 경쟁 central hit-test                                    | 기존 element drag contract                  |
| `page`    | 대상 page position presentation  | central element drag, element/workflow hover, 경쟁 page/frame click | 성공 시 active breakpoint page position 1회 |
| `idle`    | click/hover/toolbar command      | 없음                                                                | 없음                                        |

page owner는 viewport `pan`과 동시에 살아 있지 않다. Space가 pointerdown 뒤
눌리거나 해제되는 경우에도 active pointer의 owner를 중간에 바꾸지 않으며,
기존 ADR-175의 Space/pan semantics를 우선한다.

### 3.2 Capture arbitration and finalizer

capture 순서는 listener 등록 순서가 아니라 다음 contract로 고정한다.

1. page title capture가 scene coordinate를 계산하고 title bounds를 검사한다.
2. hit이면 `tryClaimPage()`가 성공하고 native event에는 보조적으로
   `__handled`를 표시한다.
3. workflow, central, viewport capture는 `gestureSession.ownerFor(pointerId)`를
   확인한 뒤 `page`이면 즉시 return한다. `__handled`만 보고 안전하다고 판단하지
   않는다.
4. page gesture controller만 page presentation publish, finish, cancel, owner
   release를 수행한다. viewport listener의 일반 `endPointer()`는 page controller의
   종료를 대체하지 않는다.

`pointerup`/`pointercancel`은 pointer id를 검사한다. `Escape`, blur,
`visibilitychange`, unmount는 같은 `cancelPageGesture(reason)` 경로로 들어간다.
breakpoint switch와 explicit “화면 정렬” command는 page controller를 먼저
cancel/finish한 후 canonical action을 실행한다. finish 시 현재 breakpoint가
`startBreakpoint`와 다르면 stale page gesture로 간주해 canonical commit하지
않는다. page add/delete, project refresh, canonical document replace도 같은
cancel 경계를 먼저 통과해야 한다.

### 3.3 Lifecycle and cancellation

- 시작: page title hit-test 성공 → owner lock → 시작 page coordinate와
  breakpoint를 snapshot.
- 진행: raw pointer move는 latest position만 보관하고 RAF 하나를 예약한다.
  RAF에서는 presentation store를 한 번 publish한다.
- 정상 종료: 마지막 pending frame을 flush → 최종 position을 equality check →
  active breakpoint의 기존 canonical writer를 한 번 호출 → presentation을
  canonical과 동일하게 정리 → owner release.
- 취소: `pointercancel`, `Escape`, window blur, `visibilitychange`, unmount는
  pending RAF를 무효화하고 presentation을 폐기하며 canonical writer를 호출하지
  않는다.
- 모든 종료 경로는 pointer id를 검증하고 owner를 release한다. 종료 뒤 다음
  pointerdown에서 stale page id, stale cursor, stale hover가 남아 있지 않아야 한다.

### 3.4 Page position presentation

새 `PagePositionPresentation` module은 `viewportPresentation.ts`의 mutable publish
패턴을 재사용하되 page coordinate와 viewport camera를 하나의 object로 합치지
않는다. 전체 positions map을 복사하지 않고 canonical map reference와 active
page override만 보유한다.

| 필드              | 의미                                       | lifetime                  |
| ----------------- | ------------------------------------------ | ------------------------- |
| `activePageId`    | 현재 page owner의 대상                     | gesture 중                |
| `canonical`       | canonical page positions map reference     | gesture 시작 시 고정      |
| `activeOverride`  | `{ pageId, x, y }` 한 건의 transient 위치  | gesture 중, frame publish |
| `version`         | presentation 변경 감지용 monotonic version | owner 시작부터 종료까지   |
| `isActive`        | transient read 허용 여부                   | gesture 중                |
| `startBreakpoint` | gesture 시작 시 active breakpoint          | owner 시작부터 종료까지   |

canonical `pagePositions`는 저장·history·breakpoint hydration의 SSOT로 남긴다.
presentation은 document store를 직접 mutate하지 않고, 정상 종료 때만 기존
`updatePagePosition` 경계로 내려간다. same-value publish와 same-value canonical
write는 no-op이어야 한다. `readPagePosition(pageId)`와
`readPageFramePosition(pageId)`는 active page만 override하고 나머지는 canonical
reference를 읽는다. 기존 `allPageFrames` 순회는 필요한 consumer에서 유지할 수
있지만, presentation layer가 전체 positions map을 복사하거나 새 O(N) frame
array를 매 input frame마다 생성하면 안 된다. 추가 override allocation은 O(1)이어야
한다.

## 4. Render and hit-test contract

### 4.1 Single coordinate source during page drag

page drag 중 다음 consumer가 동일한 `PagePositionPresentation` snapshot을
사용하도록 연결한다.

- Skia page root와 page title drawing
- DOM overlay/page title bounds
- central pointer selection 및 page/frame hit-test
- transient visible-page culling
- minimap 또는 workflow가 page position을 읽는 경로

구현 injection point는 **Skia RAF의 frame-local presentation snapshot**으로
고정한다. `SkiaCanvas`는 매 frame adapter snapshot과 page-position reader를
`buildSkiaFrameContent`, `buildFrameRenderPlan`, `buildRenderCommandStream`, page
title overlay, workflow page-frame map에 같은 frame으로 전달한다. 각 consumer는
기존 page frame metadata를 순회하되 위치는 reader로 resolve한다. cached command
stream과 tree fallback은 content를 page-local 좌표로 기록하고, execution/render
root에서 active page position을 late transform으로 적용한다. 이 transform은
content cache key·cache lifetime·culling radius를 변경하지 않는다. 기존
`pagePosVersion` cache key는 canonical commit version으로 유지하고 transient
presentation version은 cache key에 추가하지 않는다.
`BuilderCanvas` 중앙 hit-test와 body/page selection은 adapter의
`readPagePosition()`을 사용하고, Skia가 갱신한 bounds/map ref를 읽는다.

React `sceneStructureSnapshot`과 Zustand canonical mirror는 page drag 중
재계산하지 않는다. 따라서 transient page position을 React dependency로 다시
넣는 방식은 금지한다. canonical store를 직접 읽는 legacy consumer가 남으면
G4 실패다.

### 4.2 Dependency stability

- `frameAreas`와 selection bounds는 page drag마다 새 empty array/object를 만들지
  않도록 stable identity 또는 owner-aware invalidation을 검토한다.
- central pointer effect는 page position 변화 자체로 listener를 매 frame
  rebind하지 않도록 stable callback/ref를 사용한다.
- cursor style은 next value가 current value와 같으면 DOM style write를 생략한다.
- page owner가 살아 있는 동안 hover/workflow RAF는 취소하거나 결과를 버리고,
  owner release 뒤 첫 valid pointer event에서 다시 예약한다.
- `PagePositionPresentation`의 active override와 page-position reader는 page count
  1/10/50/100 tier에서 추가 positions map clone이 0건이어야 한다. 기존 frame
  traversal 비용과 새 presentation 비용을 별도 counter로 기록한다.

이 항목은 기능을 바꾸는 memoization이 아니라 owner lifecycle과 same-value
invalidation을 줄이는 범위다. stale selection 또는 hover가 발견되면 해당
최적화를 되돌리고 G3부터 재검증한다.

### 4.3 Renderer boundary prohibition

이번 ADR에서 renderer가 transient page position을 읽도록 연결하는 것은 허용하지만,
다음은 금지한다.

- culling radius/padding 변경
- gesture 중 raster/content invalidation을 얼리거나 지연하는 정책 변경
- render command cache key, cache lifetime, paragraph/Picture 수명 변경
- page visibility를 임의로 확장해 성능을 맞추는 변경

이 금지 항목이 필요해지는 순간 ADR-176의 G5가 실패하고 별도 ADR 설계로
분리한다.

단, **page-local content + page-root late transform**은 이번 ADR에서 허용하는
좁은 renderer wiring이다. 이를 위해 cache key/lifetime을 바꾸거나 page content를
재래스터하는 정책이 필요해지면 G5 실패로 처리한다.

## 5. Implementation phases

### Phase 0 — Inventory and baseline

- gesture owner별 실제 pointerdown/move/up/cancel/escape/blur 경로를 inventory
- 기존 source audit와 앞선 원인 분석 결과를 기준선으로 재사용하고, 원인
  재발견을 반복하지 않는다. 이미 확보된 runtime 수치가 없으면 새 수치를
  만들지 않고 `not measured`로 기록한다.
- page position을 읽는 모든 renderer/overlay/hit-test/culling consumer를 grep로
  대조하고, static path가 모호한 경우에만 runtime probe로 보완
- 아직 구현되지 않은 `PagePositionPresentation` reader는 현재 consumer별
  injection point를 static map으로 고정한다. 실제 reader 도달 여부는 Phase 4에서
  검증한다.

완료 조건: dependency map, forbidden scope checklist가 저장되고, 다음 phase의
변경 allow-list가 source 사실과 일치한다. G0는 새 측정 gate가 아니라 기존
분석 evidence를 고정하는 문서 gate다. Phase 1 착수 전에 runtime baseline을
다시 만들지 않는다. 정량적인 전후 성능 주장을 선택한 경우에만 별도 trace를
추가하고, full regression matrix와 page-count tier 검증은 그 주장에 필요한
범위에서만 Phase 5/G6가 수행한다.

### Phase 1 — Shared page gesture lifecycle

- `CanvasGestureSession`과 `usePageDrag`의 owner acquisition/release 연결
- pointer id guard와 `pointercancel`, `Escape`, blur, visibility, unmount cleanup
- page title/page frame/workflow/minimap 우선순위 test fixture 추가

완료 조건: G1 통과. 아직 canonical per-frame writer를 바꾸지 않아도 되며,
ownership 회귀를 먼저 닫는다.

### Phase 2 — Transient page presentation and finish commit

- page presentation adapter/store 생성 및 RAF coalescing
- `usePageDrag` raw move를 latest-only queue로 변경
- successful finish만 기존 `updatePagePosition`으로 내려가도록 연결
- cancel 경로와 active breakpoint snapshot/reload persistence 검증

완료 조건: G2 통과. page position store API가 document schema를 확장하지 않고,
canonical write count와 final equality가 계측된다.

### Phase 3 — Secondary path suppression and dependency stability

- page owner 중 central pointer/element hover/workflow hover의 arbitration 연결
- effect dependency가 page position frame마다 재설정되지 않도록 안정화
- same-value cursor write와 same-value page update 제거

완료 조건: G3 통과. drag 전후 hover·selection·cursor 재개를 함께 확인하며,
단순히 handler를 끄고 복구하지 않는 방식은 허용하지 않는다.

### Phase 4 — Render and hit-test presentation wiring

- page position을 읽는 renderer/page title/hit-test/culling을 presentation source로
  통일
- command stream/tree fallback의 page-local content와 page-root late transform을
  분리하고, transient presentation version을 cached content key에 추가하지 않음
- Skia/DOM parity와 page/text visibility를 실제 document에서 검증
- 기존 command cache/culling/raster policy가 변하지 않았는지 scope diff와 counter
  로 확인

완료 조건: G4와 G5 통과. renderer 정책 변경이 발견되면 이 phase를 land하지
않고 별도 ADR로 분리한다.

### Phase 5 — Performance, regression, and rollback verification

- G0를 다시 측정하지 않고, verification matrix에서 page drag, Space pan,
  zoom, breakpoint switch, page add, reload의 구현 후 회귀를 검증
- page count 1/10/50/100 tier와 allocation/counter 비교는 확장성 또는 수치
  성능 개선을 주장하는 경우에만 기록
- targeted tests, type-check, preflight, browser smoke 수행
- 수치 성능 주장을 선택하지 않으면 p95/최악 frame 전후 비교를 요구하지 않고
  `not measured`와 주장 범위를 문서화한다. 수치 주장을 선택한 경우에만 같은
  시나리오의 before/after trace를 추가한다.
- user-visible 변경이면 changelog를 갱신하고 phase별 rollback checkpoint를 남김

완료 조건: G6/G7 통과 및 ADR-176을 Implemented로 승격할 근거가 문서화된다.

## 6. Changed-file allow-list

### Candidate allow-list

실제 변경은 Phase 0 inventory 결과에 따라 이 목록 안에서만 허용한다.

- `apps/builder/src/builder/workspace/canvas/interaction/canvasGestureSession.ts`
- `apps/builder/src/builder/workspace/canvas/interaction/canvasGestureSession.test.ts`
- 신규 `apps/builder/src/builder/workspace/canvas/interaction/pagePositionPresentation.ts`
  및 lifecycle/presentation tests
- `apps/builder/src/builder/workspace/canvas/hooks/usePageDrag.ts`
- `apps/builder/src/builder/workspace/canvas/hooks/usePageDrag.test.ts`
- `apps/builder/src/builder/workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts`
- `apps/builder/src/builder/workspace/canvas/hooks/useElementHoverInteraction.ts`
- `apps/builder/src/builder/workspace/canvas/hooks/useWorkflowInteraction.ts`
- `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx`
- `apps/builder/src/builder/stores/elements.ts` 및 인접 page position tests
- 신규 `apps/builder/src/builder/workspace/canvas/interaction/` 또는 `viewport/`
  presentation module/test
- 필요한 경우에 한해 `apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx`,
  `skia/skiaFramePipeline.ts`, `skia/skiaFramePlan.ts`, `skia/skiaOverlayBuilder.ts`,
  `skia/visiblePageRoots.ts`, `skia/skiaTreeBuilder.ts`, `skia/renderCommands.ts`,
  `renderers/rendererInput.ts`
  및 해당 static tests
- 필요한 경우에 한해 `interaction/selectionModel.ts`, `scene/buildPageFrames`와
  `scene/buildVisiblePageSet` 호출 경계
- 구현이 user-visible 최적화로 완료될 때 `docs/CHANGELOG.md`

### Forbidden paths and changes

- `packages/specs`, `apps/builder/src/preview`, `apps/publish` 변경
- document schema, Supabase migration, persistence shape 변경
- ADR-172/173이 관할하는 culling/raster/cache/paragraph/Picture 정책 변경
- unrelated page creation, breakpoint layout, toolbar UI refactor

기존 dirty worktree의 파일은 allow-list와 겹쳐도 먼저 baseline diff를 저장하고,
사용자 변경과 이번 phase 변경을 분리해 검토한다.

## 7. Verification matrix

| 영역                | 정적/단위 검증                                                             | live 검증                                                                                                                                                        | 실패 시 조치                                                         |
| ------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| owner lifecycle     | `canvasGestureSession.test.ts`, page drag lifecycle test                   | page title/Space/element/minimap/workflow matrix                                                                                                                 | Phase 1 중단, owner contract 수정                                    |
| presentation/commit | presentation store test, `elements` writer equality test                   | 100 raw move, success/cancel/escape/blur/unmount, breakpoint/reload                                                                                              | canonical adapter rollback                                           |
| suppression         | hover/central handler static + interaction tests                           | drag 중 hover/cursor/workflow counter, 종료 후 resume                                                                                                            | Phase 3 rollback                                                     |
| render/hit-test     | renderer/Skia static tests와 coordinate fixture                            | multi-page page/text visibility, selection bounds, zoom/pan                                                                                                      | G4 실패; renderer policy 변경 금지                                   |
| performance         | counter assertions, no-op equality tests                                   | 구현 후 contract 회귀와 browser smoke; 수치 성능 주장을 선택한 경우에만 동일 시나리오의 Chrome trace와 full matrix p95/max frame·render command/content counters | 수치 주장을 선택하지 않으면 `not measured`로 기록하고 G0 재측정 금지 |
| quality             | `pnpm run codex:typecheck`, `pnpm run codex:preflight`, `git diff --check` | console error 0 browser smoke                                                                                                                                    | phase를 완료 처리하지 않음                                           |

최소 회귀 matrix는 page 1/여러 page, page overlap/비-overlap, active breakpoint
각 1종, page add, manual move, explicit screen alignment, breakpoint switch,
reload, Space pan, zoom in/out을 포함한다. 특히 breakpoint switch가 page를
자동 정렬하지 않고 explicit “화면 정렬” 동작에서 active breakpoint만 정렬하는
기존 계약을 보존해야 한다. 추가로 page title pointerdown과 workflow page-frame
pointerdown을 동일 좌표에서 각각 재현한다. page count 1/10/50/100의 transient
map allocation과 frame timing은 확장성 또는 수치 성능 주장을 선택한 경우에만
추가로 기록한다.

## 8. Rollback plan

1. 각 phase는 별도 checkpoint와 test evidence를 남긴다. 다음 phase gate가
   실패하면 후속 phase를 land하지 않고 마지막 통과 phase까지 되돌린다.
2. Phase 2에서 transient source가 renderer/hit-test parity를 깨면 presentation
   adapter 연결을 되돌리고 canonical page drag 경로를 유지한다. 이를 최종
   성공으로 간주하지 않고 G4 재설계 상태로 남긴다.
3. Phase 3의 dependency stabilization이 stale hover/selection을 만들면 해당
   memo/effect 변경만 되돌리고 Phase 2의 owner/presentation 계약은 보존한다.
4. Phase 4에서 culling/raster/cache 정책 변경이 불가피하다는 사실이 나오면
   해당 변경을 revert하고 별도 ADR을 만든다. ADR-176에 임시 정책을 넣지 않는다.
5. schema migration이 없으므로 rollback은 기존 canonical page position과
   breakpoint snapshot을 복구할 수 있어야 하며 데이터 migration rollback은
   필요하지 않다.

## 9. Implementation invariants before implementation

다음은 구현 전 이미 lock된 계약이다. Phase 0에서는 기존 source audit와 원인
분석 evidence만 고정한다. runtime baseline을 다시 측정하지 않으며, full 성능
비교는 수치 성능 주장을 선택한 경우에만 Phase 5/G6에서 수행한다.

1. **Presentation injection point**: Skia RAF의 frame-local
   `PagePositionPresentation` snapshot을 사용한다. root transform과 React
   `rendererInput` canonical rewrite 중 선택하지 않는다.
2. **Priority contract**: page title hit-test가 성공한 pointerdown은
   `tryClaimPage()`로 먼저 page owner가 된다. workflow/minimap/central은 owner
   registry를 확인하고 competing action을 시작하지 않는다.
3. **Breakpoint transaction**: finish-only canonical writer가 기존
   `updatePagePosition`의 history/save semantics와 동일한지 확인한다. 다르면
   새 history API를 만들지 말고 기존 action contract를 먼저 해석한다.
4. **No-op policy**: 시작 좌표와 최종 좌표가 같을 때 presentation publish와
   canonical write를 모두 생략하되, owner lifecycle은 정상적으로 종료한다.

위 결정은 ADR의 Hard Constraints를 바꾸지 않는다. source 사실이 이 설계와
충돌하면 구현을 강행하지 않고 ADR-176을 먼저 갱신·재검토한다.
