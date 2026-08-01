# ADR-176: Canvas authoring gesture 및 page position 렌더링 최적화

## Status

Proposed — 2026-08-01

## Context

현재 Canvas의 화면 이동은 두 개의 서로 다른 경로를 가진다.

- `Space + pointer drag` viewport 이동은 `CanvasGestureSession`과
  `ViewportInteractionSession`을 통해 raw input을 RAF 단위로 합치고, 종료 시
  canonical viewport mirror를 commit한다. 이 계약은 ADR-175가 이미 결정하고
  구현한 범위다.
- page title을 드래그하는 `usePageDrag`는 별도의 `window pointermove`/
  `pointerup` listener를 만들고 `updatePagePosition`을 RAF마다 호출한다. 이때
  중앙 pointer handler, element hover, workflow hover가 같은 gesture owner를
  공유하지 않는다.

page drag의 매 프레임 canonical page position 변경은 다음 파생 경로를 함께
흔든다.

1. `BuilderCanvas.tsx`가 `pagePositions`와 `pagePositionsVersion`을 구독한다.
2. page position이 바뀔 때 scene snapshot과 renderer input이 다시 계산된다.
3. `SkiaCanvas.tsx`가 page position version을 content invalidation 입력으로 보고
   stale frame을 예약하며, render command cache key도 page position version을
   포함한다.
4. page mode의 `frameAreas`와 selection hit-test 계산이 새 identity를 만들고,
   중앙 pointer effect가 재설정되어 drag 중 listener/ref가 다시 묶인다.
5. 중앙 pointer move는 `getBoundingClientRect`, screen-to-canvas 변환, handle
   hit-test, cursor 대입을 계속 수행한다. cursor setter도 same-value dedupe가
   없다.

이 구조는 page를 실제로 이동시키는 데 필요한 갱신과, page 이동 중 잠시 멈춰도
되는 hover·workflow·pointer arbitration 갱신을 구분하지 않는다. 결과적으로
화면상 page 이동은 하나의 gesture처럼 보이지만 runtime에는 page drag, central
pointer, hover, workflow, renderer invalidation이 동시에 반응할 수 있다.

현재 capture 순서도 owner 계약을 보장하지 않는다. `BuilderCanvas`의 page title
capture가 page title hit-test 전에 `CanvasGestureSession.beginPointer()`를 호출해
일반 pointer를 `element`로 잠그고, workflow capture listener는 별도로 page frame
click을 판정한다. 중앙 handler만 `event.__handled`를 확인한다. 따라서 page title
pointerdown의 최종 owner와 workflow/page-frame 우선순위가 listener 등록 순서에
의존한다.

### 3-domain boundary

이번 ADR은 다음 세 domain을 명시적으로 분리한다.

- **D1 DOM/accessibility**: pointer event ownership, `pointerup`/
  `pointercancel`, `Escape`, blur/unmount cleanup, 중앙 hit-test arbitration을
  다룬다. 새 DOM control이나 접근성 surface를 추가하지 않으며, 기존 page title
  drag의 focus/keyboard 동작을 보존한다.
- **D2 Props/API**: public component props, component spec, document schema,
  Preview/Publish API는 변경하지 않는다. 필요한 것은 Builder 내부의 gesture와
  presentation runtime contract뿐이다.
- **D3 visual style**: CSS token, component style, visual spec은 변경하지
  않는다. 다만 Skia/DOM/page hit-test가 같은 page coordinate를 보았는지는
  시각·정합성 gate로 검증한다.

D1의 input ownership이 D2의 내부 runtime state와 D3의 renderer coordinate
consumer에 연결되지만, public component contract나 정지 상태의 visual style을
바꾸지 않는 것이 범위 경계다.

### Scope and dependency lock

ADR-175는 viewport camera input scheduling의 base 결정이고, ADR-176은 page
position authoring gesture의 sibling runtime 결정이다. page drag를 viewport
camera session의 단순한 하위 모드로 합치지 않는다.

- **Base/application**: ADR-175의 RAF coalescing·finish commit 원칙은 참고하고
  viewport camera 계약은 그대로 둔다. page position은 별도 presentation 값이다.
- **Schema orthogonality**: 기존 page position 필드와 breakpoint snapshot을
  사용하며 document schema migration이나 새 저장 필드를 만들지 않는다.
- **Reverse verification**: ADR-175가 명시한 ADR-172/173의 scene/renderer/
  culling/cache 정책 비변경 경계를 역검증한다. Deprecated 된 culling radius,
  raster deferral, cache lifetime 가설을 이번 최적화의 근거로 승계하지 않는다.
- **No deferred lock-in**: 이 네 가지 경계는 Phase 0 inventory 전에 고정하고,
  후속 review에서 scope를 넓히지 않는다.

### Hard Constraints

1. ADR-175의 viewport 계약을 보존한다. continuous interaction 중 transient
   apply/listener fan-out은 display frame당 최대 1회, canonical viewport mirror는
   정상 종료 시 최대 1회이며 최종 controller/mirror 값은 동일해야 한다.
2. page title pointerdown 뒤에는 하나의 gesture owner가 `pointerup` 또는
   `pointercancel`까지 유지되어야 한다. page owner가 살아 있는 동안 central
   element drag, element hover, workflow hover, page-frame click arbitration은
   page 이동과 경쟁하지 않는다.
3. page drag의 presentation 반영은 display frame당 최대 1회로 합친다. 정상
   종료 시 기존 canonical `updatePagePosition`은 page별 1회만 호출하고,
   cancel·`Escape`·blur·visibility change·unmount에서는 canonical commit을
   하지 않는다.
4. 최종 page coordinate는 scene pixel 기준 오차 `0.01px` 이내로 입력 위치와
   일치해야 한다. active breakpoint의 기존 snapshot만 갱신하고, 다른
   breakpoint snapshot을 생성·재배치하지 않는다.
5. page position을 읽는 renderer, page title bounds, hit-test, transient culling
   consumer는 같은 presentation source를 읽어야 한다. drag 중 page/text가
   사라지거나 선택 위치가 어긋나면 실패다.
6. ADR-172/173의 culling radius, raster deferral, cache lifetime 정책과
   `Spec`/CSS/Preview/Publish output은 변경하지 않는다.
7. 실제 populated Builder 문서에서 console error 0과 기존 page 이동,
   breakpoint position snapshot, reload hydration, Space pan 회귀 0을 확인한다.
8. page title hit-test가 성공한 pointerdown은 generic `beginPointer()`보다 먼저
   `page` owner를 claim한다. workflow, central, viewport capture는 이미 owner가
   있으면 어떠한 competing action도 시작하지 않으며, `event.__handled`는 보조
   표시일 뿐 ownership의 SSOT가 아니다.
9. page owner는 `startBreakpoint`를 보존한다. breakpoint switch 또는 명시적
   “화면 정렬” command는 active page gesture를 먼저 cancel/finish한 뒤 실행하며,
   commit 시 breakpoint가 바뀌었으면 stale gesture를 commit하지 않는다.
10. transient page position은 전체 positions map을 frame마다 복사하지 않는다.
    canonical map reference와 active page 한 건의 override를 사용해 page lookup과
    presentation publish의 추가 비용을 O(1)로 제한한다.
11. page add/delete, project refresh, canonical document replace처럼 page set 또는
    canonical positions reference를 교체하는 외부 사건은 active page gesture를
    먼저 cancel한 뒤 적용한다. stale canonical reference를 finish commit에
    사용하지 않는다.

### Soft Constraints

- 기존 `CanvasGestureSession`, `ViewportInteractionSession`,
  `viewportPresentation`의 naming과 lifecycle 패턴을 재사용한다.
- 새 package나 외부 dependency를 추가하지 않고 Builder 내부 contract로 닫는다.
- 최적화 판단은 synthetic event count만으로 확정하지 않고 실제 multi-page
  Builder trace와 render counters를 함께 사용한다.
- phase 단위 rollback이 가능하도록 presentation adapter와 canonical store를
  한 경계에 둔다.

## Alternatives

| 대안                                                                              | Technical risk                                        | Performance risk                                                        | Maintenance risk                                      | Migration risk                                              | 판정     |
| --------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------- | -------- |
| **A. 공유 gesture owner + page transient presentation + finish canonical commit** | MED: page owner와 viewport owner의 경계를 명시해야 함 | MED: O(1) active override와 frame당 publish 계약을 지켜야 함            | MED: 두 timeline과 cleanup 계약을 테스트해야 함       | MED: `usePageDrag`와 renderer 입력을 단계적으로 연결해야 함 | **채택** |
| **B. 현재 page drag를 유지하고 hover/effect만 억제**                              | LOW: 기존 store 경로를 거의 유지                      | HIGH: page position canonical write와 Skia invalidation이 매 frame 남음 | LOW/MED: 단기 변경은 작지만 중복 listener가 남음      | LOW: 변경 폭이 작음                                         | 기각     |
| **C. 공유 owner만 만들고 page position은 RAF마다 canonical write**                | MED: ownership은 해결되지만 상태 경계가 불완전함      | HIGH: renderer/React fan-out의 핵심 비용이 남음                         | MED: owner와 canonical write가 분리되어 의미가 모호함 | MED: listener 이관은 필요함                                 | 기각     |

B는 성능 목표를 충족하지 못하고, C는 입력 경쟁은 줄여도 page position의
canonical fan-out을 제거하지 못한다. 둘 다 이번 문제의 직접 원인인
`pagePositionsVersion` 기반 파생·invalidation 경로를 해결하지 않는다.

## Risk Threshold Check

| 대안 |            구조적으로 남는 HIGH | 실행 중 추적할 HIGH | threshold 결과                                                   |
| ---- | ------------------------------: | ------------------- | ---------------------------------------------------------------- |
| A    |                               0 | R1/R2/R3/R5/R8/R10  | 통과. 설계상 HIGH는 제거되었고 실행 HIGH는 G1~G7에서 차단해야 함 |
| B    | 1 (continuous renderer fan-out) | 성능 fan-out        | 실패. 핵심 비용이 구조적으로 잔존                                |
| C    |    1 (canonical/render fan-out) | presentation 정합성 | 실패. presentation 계약이 닫히지 않음                            |

이번 ADR의 threshold는 **구조적으로 남는 HIGH risk가 0이고, 실행 중 추적하는
HIGH risk가 명시된 gate에서 차단 가능해야 한다**는 것이다. 따라서 A는 설계
threshold를 통과하지만 Implemented 승격은 R1/R2/R3/R5/R8/R10의 G1~G7 증거가 있어야
한다. 새 renderer culling/raster/cache 정책을 추가하면 threshold를 다시 계산해야
하며 이 ADR의 범위를 벗어난다.

## Decision

대안 A를 채택한다.

1. Canvas gesture lifecycle에 page drag owner를 포함시키되, viewport camera
   state와 page position state는 합치지 않는다. owner는 pointer id를 보존하고
   `pointerup`/`pointercancel`/`Escape`/blur/unmount에서 반드시 종료한다.
2. page drag 중에는 page position을 transient presentation source에 publish하고,
   canonical `updatePagePosition`은 정상 종료 시 최종 값으로 한 번만 호출한다.
   cancel 경로는 presentation을 폐기하고 canonical document를 건드리지 않는다.
3. renderer, page title bounds, hit-test, culling이 page drag 중 transient
   presentation을 읽도록 연결한다. canonical mirror가 늦다는 이유로
   scene/culling/raster 정책을 바꾸지 않는다.
4. page position과 무관한 hover, workflow, central pointer effect dependency 및
   same-value cursor write를 분리·dedupe하여 page owner가 살아 있는 동안
   불필요한 재바인딩과 hit-test를 차단한다.
5. breakpoint snapshot과 reload hydration은 canonical commit 시점에만 반영한다.
   정렬 기능이나 breakpoint 전환이 page drag 중 좌표를 덮어쓰지 않도록 active
   gesture arbitration gate를 둔다.
6. presentation은 새 `PagePositionPresentation` adapter로 고정한다. adapter는
   canonical positions reference, `{ pageId, x, y }` 한 건의 active override,
   `version`, `startBreakpoint`를 보유하고 `readPagePosition(pageId)`와
   `readPageFramePosition(pageId)`를 제공한다. page drag 중 전체 positions map을
   clone하지 않는다. 기존 page frame traversal O(N)은 유지될 수 있으나 새
   presentation layer가 추가 O(N) map clone을 만들면 안 된다.
7. Skia RAF는 adapter snapshot으로 page frame·visible page frame·page title
   bounds·workflow page frame map을 같은 frame에 만든다. cached content command는
   page-local 좌표로 유지하고 active page 위치는 page-root late transform에서
   적용한다. 기존 `pagePosVersion` cache key는 canonical commit version으로
   유지하고 transient presentation version은 cache key에 추가하지 않는다. tree fallback도 같은 page-root transform 경계를 사용한다. central
   pointer와 selection/body hit-test는 같은 adapter snapshot을 읽는다.
   React/Zustand canonical mirror는 continuous page drag 중 갱신하지 않는다.
8. owner arbitration은 page title capture가 우선 claim하고, 이후 모든 capture/
   window listener가 owner와 pointer id를 확인하는 단일 contract로 고정한다.
   page drag의 finish/cancel 책임자는 page gesture controller 하나다.

구현 순서, 변경 파일, 각 gate의 측정 방법은
`docs/adr/design/176-canvas-authoring-gesture-and-page-position-optimization-breakdown.md`
에 둔다. ADR 본문에는 구현 세부 코드를 복제하지 않는다.

## Risks

| ID  | 위험                                                                                                   | 심각도 | 차단 조건                                                           |
| --- | ------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------------------------------- |
| R1  | transient page position과 canonical position이 달라 renderer·hit-test·저장 결과가 어긋남               | HIGH   | G2/G4에서 동일 좌표 source와 최종 `0.01px` 정합 실패 시 phase 중단  |
| R2  | `pointercancel`/blur/unmount 누락으로 gesture owner가 영구 점유되거나 다음 gesture를 막음              | HIGH   | G1에서 모든 종료 경로와 후속 pointerdown 회복을 live 검증           |
| R3  | page position version을 제거·지연하는 과정에서 page/text culling 또는 selection bounds가 stale 됨      | HIGH   | G4에서 다중 page pan/zoom/drag와 text/page visibility를 함께 검증   |
| R4  | finish commit이 history/persistence/breakpoint snapshot과 중복되거나 다른 breakpoint를 오염시킴        | MED    | G2에서 성공 1회·cancel 0회 write와 reload/active breakpoint 검증    |
| R5  | 최적화가 ADR-172/173의 culling/raster/cache 정책 변경으로 번짐                                         | HIGH   | G5에서 변경 파일·diff·runtime counter를 scope audit; 발견 즉시 분리 |
| R6  | page title과 workflow/minimap/page-frame click의 우선순위가 달라짐                                     | MED    | G1/G3 ownership matrix와 클릭 회귀 fixture로 고정                   |
| R7  | `frameAreas`/pointer effect dependency 안정화가 새 선택·cursor stale 상태를 만듦                       | MED    | G3에서 drag 전·중·후 hover/selection/cursor 재개를 검증             |
| R8  | page title capture가 generic owner 또는 workflow capture보다 늦게 claim되어 잘못된 action이 시작됨     | HIGH   | G1에서 capture order와 단일 owner claim을 pointer id별 검증         |
| R9  | transient positions 전체 map 복사 또는 page frame 재계산이 page 수에 비례해 비용 절벽을 만듦           | MED    | G6에서 page count tier별 allocation·p95·최악 frame을 비교           |
| R10 | cached command/tree content와 transient page-root transform 분리가 clip·bounds·Picture 정합성을 깨뜨림 | HIGH   | G4에서 command/tree fallback·clip·hit-test·text parity를 함께 검증  |
| R11 | page add/delete·refresh가 canonical map reference를 교체하는 동안 stale gesture가 commit됨             | MED    | G1/G2에서 page set mutation 중 cancel·write 0·후속 gesture를 검증   |

## Gates

| Gate                      | 통과 기준                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G0 baseline               | 실제 populated multi-page Builder에서 page drag raw event 수, page position write 수, `render.frame`, `render.content.build`, console error, frame timing을 기록한다. synthetic-only 결과는 baseline으로 인정하지 않는다.                                                                                                                                                     |
| G1 ownership/lifecycle    | page title capture가 generic `beginPointer()`보다 먼저 `page` owner를 claim하고 workflow/central/viewport listener가 이미 claim된 pointer를 무시한다. Space pan, page title drag, element drag, canvas click, minimap, workflow 각각의 owner를 표로 고정하고 `pointerup`, `pointercancel`, `Escape`, blur, visibility change, unmount에서 page controller가 owner를 해제한다. |
| G2 presentation/commit    | 100 raw page-move event를 실제 pointer stream으로 재현해 transient publish가 display frame당 최대 1회인지, active override가 전체 map clone 없이 동작하는지 확인한다. 정상 종료 canonical write는 1회, cancel 경로는 0회이며 start/current breakpoint 불일치 시 stale commit이 0회다.                                                                                         |
| G3 suppression/resume     | page owner 중 central pointer hit-test, element hover, workflow hover, cursor recomputation이 0회 또는 owner가 허용한 최소 경로이며, 종료 후 첫 pointermove부터 hover/selection/cursor가 정상 재개된다.                                                                                                                                                                       |
| G4 render/hit-test parity | Skia/DOM page, page title bounds, workflow page-frame map, selection/body hit-test, transient culling이 같은 adapter snapshot을 읽는다. cached command/tree content의 page-root late transform이 clip·bounds·Picture 경계를 보존한다. multi-page drag 중 page/text 누락 0, 선택 좌표 mismatch 0, console error 0이다.                                                         |
| G5 scope boundary         | ADR-172/173의 culling radius, raster deferral, cache lifetime와 cache key 정책, Spec/CSS/Preview/Publish 파일이 변경되지 않는다. 허용되는 renderer 변경은 page-local content와 page-root late transform을 분리하는 좁은 경계뿐이며, 그 외 renderer 정책 변경은 ADR-176을 중단하고 별도 ADR로 분리한다.                                                                        |
| G6 performance            | G0와 동일한 matrix를 page count 1/10/50/100 tier로 반복한다. active override allocation은 page count와 무관하고, canonical write/fan-out 감소가 counter로 확인되며 p95 interaction frame 및 최악 frame이 baseline보다 악화되지 않는다. 절대 60fps 주장은 trace가 증명할 때만 기록한다.                                                                                        |
| G7 quality                | 관련 Vitest/static tests, Builder type-check, `git diff --check`, `pnpm run codex:preflight`, 실제 browser smoke가 통과한다. 사용자-visible 최적화 구현 시 `docs/CHANGELOG.md`를 같은 변경 단위에 갱신한다.                                                                                                                                                                   |

## Consequences

### Positive

- page drag와 Space pan의 gesture owner가 명확해져 competing pointer/hover
  work를 줄일 수 있다.
- page position은 frame 단위 presentation으로 보이고 document/history/
  breakpoint persistence는 finish 시 한 번만 갱신된다.
- renderer와 hit-test가 같은 transient coordinate를 읽으므로 이동 중 page/text
  누락과 stale selection의 원인을 좁힐 수 있다.
- 기존 ADR-175의 viewport contract와 ADR-172/173의 renderer scope를 보존한다.

### Negative

- transient와 canonical이라는 두 시간축을 함께 유지해야 하므로 lifecycle 및
  cancellation 테스트가 늘어난다.
- `usePageDrag`, 중앙 pointer handler, hover/workflow, renderer 입력 사이의
  연결을 단계적으로 바꾸는 migration 비용이 있다.
- page position presentation을 읽지 못하는 legacy consumer가 발견되면 gate를
  통과할 때까지 phase를 완료할 수 없다.
