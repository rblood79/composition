# ADR-175: 캔버스 뷰포트 상호작용 스케줄링 계약

## Status

Implemented — 2026-07-31

## Context

Builder canvas의 뷰포트 이동은 `Space + pointer drag`, 일반 wheel pan,
`Ctrl`/`Cmd + wheel` zoom, toolbar zoom, keyboard zoom을 통해 일어난다. 이들은
결과적으로 같은 `{ x, y, zoom }` 카메라 상태를 바꾸지만, 현재 실행·동기화 패턴은
입력별로 다르다.

- `useViewportControl.ts`의 pointer drag는 `ViewportController.updatePan()`으로
  controller의 mutable 상태와 화면을 갱신하고, `endPan()`에서만
  `setViewportSnapshot()`을 호출한다.
- 같은 파일의 일반 wheel pan은 원시 이벤트마다 `controller.setPosition()`을 호출한 뒤
  RAF마다 `setViewportSnapshot()`을 호출한다. `Ctrl`/`Cmd + wheel` zoom은
  `zoomAtPoint(..., true)`로 원시 이벤트마다 store 동기화를 요청한다.
- `ViewportController.setPosition()`은 값이 같아도 현재 상태를 덮고 update listener를
  알린다. `CanvasScrollbar`은 그 listener를 구독한다.
- `BuilderCanvas.tsx`는 `useViewportSyncStore`의 `panOffset`/`zoom`을 구독하고,
  이를 `buildSceneStructureSnapshot()` 및 layout publisher 입력에 전달한다. 이 경로는
  camera 값이 바뀔 때마다 scene visibility와 후속 파생 작업을 다시 평가한다.

따라서 drag가 부드럽다는 사실은 renderer 전체가 camera 변경에 무관하다는 뜻이 아니다.
drag는 React/Zustand mirror write를 interaction 끝까지 미루는 반면, wheel pan과 wheel
zoom은 연속 입력 중 mirror write와 그 fan-out을 계속 발생시킨다. React state 갱신이
다음 render를 유발한다는 공식 동작도 이 비용을 피해야 하는 근거다
([React `useState`](https://react.dev/reference/react/useState)).

브라우저의 `requestAnimationFrame()`은 다음 repaint 직전에 실행되며 디스플레이
refresh rate에 맞춰 호출된다. 따라서 원시 input 빈도가 아니라 한 display frame에
한 번만 transient viewport를 반영하는 것이 자연스러운 coalescing 경계다
([MDN `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)).
wheel은 pointer drag와 별도 입력이며 `delta*` 값만 제공하므로, zoom anchor와 종료
시점은 명시적인 계약이 필요하다
([MDN `wheel`](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event),
[MDN Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events)).

**3-domain 판정**: D1/D2/D3 어느 한 domain의 결정도 아닌 Builder-system runtime
성능·상호작용 계약이다. 컴포넌트의 정지 시각 style token, DOM/접근성, component
props/schema는 변경하지 않는다.

**Hard Constraints**:

1. 연속 interaction 하나의 `finish`까지 `setViewportSnapshot()`의 canonical mirror
   write는 최대 1회여야 한다. 원시 pointer/wheel 이벤트 수와 무관하게 성립해야 한다.
2. input이 끝나거나 중단되기 직전에 pending RAF를 flush하고, controller의 최종
   `{ x, y, zoom }`와 `useViewportSyncStore` snapshot은 정확히 같아야 한다.
3. pointer anchor zoom은 화면 좌표를 scene 좌표로 역변환한 값이 전후 `0.01 CSS px`
   이내로 같아야 하며, min/max zoom clamp에서도 성립해야 한다.
4. transient viewport 적용과 controller listener fan-out은 display frame당 각각 최대
   1회여야 한다. 이 input scheduling 상한과 raw input 대비 mirror commit 수는 이 ADR의
   blocking 성능 목표다. full-frame p95는 별도 관찰값으로 기록해 renderer 잔여 비용과
   구분하며, ADR-175만으로 `8.33ms`/`16.67ms` 달성을 보장한다고 주장하지 않는다.
5. continuous interaction 중 좌표를 읽는 consumer는 stale canonical mirror가 아니라
   transient controller read API를 사용해야 한다. presentation consumer가 intermediate
   값을 보여줄지 final 값만 보일지도 구현 전에 명시한다.
6. 선택 요소의 내부 scroll routing, pan cursor, zoom bounds, breakpoint별 viewport
   persistence, toolbar/keyboard zoom의 최종 snapshot 계약은 유지해야 한다. 외부 viewport
   command와 breakpoint 전환은 active session을 flush·finish한 뒤 적용한다.
7. 사용자가 지정한 대로 ADR-172와 ADR-173의 scene/renderer/culling/cache 결정을
   수정하거나 재도입하지 않는다.

**Soft Constraints**:

- input adapter별 분기를 없애기보다, delta normalizing과 anchor 선택은 adapter에
  남기고 실행·commit 정책만 공통화한다.
- discrete toolbar/keyboard action은 지연 UX를 만들지 않고 즉시 한 번 commit한다.
- 구현 전 Phase 0에서 제공된 Builder 문서
  `/builder/9e9e0000-1111-2222-3333-adr174leak00`와 실제 다페이지 문서를 모두
  측정한다. synthetic filler 문서만으로 통과를 주장하지 않는다.

### ADR-172/173과의 분리 lock

이 ADR은 기존 ADR의 후속·대체·재개가 아니다. 사용자 확인(2026-07-31)에 따라
ADR-172와 ADR-173은 각각 독립 재검토·수정 대상으로 남기며, 다음 네 판단을 lock한다.

1. **base / 응용**: ADR-175는 input-to-viewport commit scheduling만 다룬다. ADR-172의
   scene 파생, ADR-173의 renderer invalidation은 ADR-175의 base도 응용도 아니다.
2. **schema 직교성**: ADR-175는 document/schema를 바꾸지 않는다. 나머지 둘은
   scene visibility·Skia cache/invalidation의 renderer 계약을 다룬다.
3. **전제 reverse 검증**: Deprecated 된 두 ADR의 가시 집합, culling radius, raster
   deferral 가설을 자동 승계하지 않는다. ADR-175는 현행 renderer 동작을 그대로 둔다.
4. **사용자 확인**: 새 ADR의 scope는 공통 pan/zoom scheduling으로 한정하고, 172/173의
   재검토는 이 ADR의 phase나 gate에 넣지 않는다.

## Alternatives Considered

### 대안 A: 공통 `ViewportInteractionSession`과 종료 시 canonical commit

- 설명: 모든 연속 pan/zoom 입력은 session에 원시 transform을 enqueue한다. session은
  RAF당 한 번 controller의 transient 상태와 listener를 갱신하고, `finish`에서만
  `setViewportSnapshot()`을 수행한다. toolbar/keyboard처럼 discrete한 action도 같은
  equality/flush 경로를 쓰되 한 action 안에서 즉시 finish한다.
- 근거: browser repaint 경계에 맞춘 `requestAnimationFrame()` scheduling은 원시 event
  빈도와 화면 반영 빈도를 분리한다
  ([MDN `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)).
  pointer와 wheel이 서로 다른 event model이라는 점도 adapter와 실행 정책의 분리를
  요구한다 ([MDN `wheel`](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event)).
- 위험:
  - 기술: MED — wheel 종료 debounce, pointer cancel, zoom anchor의 순서 보존이 필요하다.
  - 성능: LOW — React mirror write를 interaction 끝으로 제한하고 transient fan-out도
    RAF로 제한한다.
  - 유지보수: MED — 새 viewport 입력은 session adapter를 거쳐야 한다.
  - 마이그레이션: MED — 기존 drag/wheel/toolbar/keyboard 진입점을 함께 이관해야 한다.

### 대안 B: wheel pan만 현재 drag 패턴으로 변경

- 설명: wheel pan의 RAF store write만 종료 시 commit으로 바꾸고, wheel zoom과
  toolbar/keyboard zoom은 현재 각자 경로를 유지한다.
- 근거: `wheel` event의 `deltaX`/`deltaY`는 pointer movement와 직접 같은 lifecycle을
  제공하지 않으므로, 단일 이벤트의 국소 수정은 구현량이 작다
  ([MDN `wheel`](https://developer.mozilla.org/en-US/docs/Web/API/Element/wheel_event)).
- 위험:
  - 기술: LOW — 현행 pan 코드만 좁게 수정하면 된다.
  - 성능: HIGH — `Ctrl`/`Cmd + wheel` zoom의 event별 mirror write와 다른 zoom 입력의
    rerender 비용은 남는다.
  - 유지보수: HIGH — 종료/flush/equality 규칙이 다시 input별로 갈라진다.
  - 마이그레이션: LOW — wheel pan만 바꾼다.

### 대안 C: 모든 입력을 RAF마다 Zustand mirror에 commit

- 설명: current wheel pan처럼 input을 RAF로만 batch하고, drag/zoom도 매 RAF에
  `setViewportSnapshot()`을 호출한다.
- 근거: React는 event handler 안의 state update를 batch하지만, 다음 render를 위해
  state update를 처리한다
  ([React `useState`](https://react.dev/reference/react/useState)). RAF batch는 raw event
  수를 줄이지만 viewport를 구독하는 root 파생 경로 자체는 계속 실행한다.
- 위험:
  - 기술: LOW — 구현 형태는 현행 wheel pan과 유사하다.
  - 성능: HIGH — 고주사율에서 매 frame root mirror write와 scene/layout fan-out이 남는다.
  - 유지보수: MED — 입력은 통일돼도 camera consumer의 비용과 계속 결합한다.
  - 마이그레이션: LOW — 기존 store API를 그대로 쓴다.

### 대안 D: DOM/CSS transform만으로 입력 중 화면을 별도 이동

- 설명: interaction 중에는 canvas wrapper에 CSS transform을 적용하고, 종료 뒤에만
  controller/store를 맞춘다.
- 근거: repaint 직전 animation scheduling 자체는 가능하지만
  ([MDN `requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)),
  Canvas hit-test, overlay, scrollbar, cursor 좌표가 실제 camera와 분리된다.
- 위험:
  - 기술: HIGH — Skia camera, selection overlay, hit-test, scrollbar가 서로 다른 viewport를
    읽게 된다.
  - 성능: MED — React write는 줄지만 compositing/Skia 이중 좌표계 비용은 미측정이다.
  - 유지보수: HIGH — 별도 visual camera를 계속 동기화해야 한다.
  - 마이그레이션: HIGH — 기존 controller를 우회하는 병렬 state가 생긴다.

## Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  L   |    M     |      M       |     0      |
| B    |  L   |  H   |    H     |      L       |     2      |
| C    |  L   |  H   |    M     |      L       |     1      |
| D    |  H   |  M   |    H     |      H       |     3      |

루프 판정: 대안 A는 HIGH+ 위험이 없다. B/C는 성능 목표를 만족하지 못하고, D는
camera SSOT를 둘로 나눠 CRITICAL에 가까운 정합 위험을 만든다. 추가 대안은 불필요하다.

## Decision

**대안 A: 공통 `ViewportInteractionSession`과 종료 시 canonical commit**을 선택한다.

선택 근거:

1. drag가 이미 증명한 "mutable controller 즉시 반영 + 종료 시 mirror"의 장점을 pan뿐
   아니라 연속 zoom까지 같은 lifecycle으로 확장한다.
2. transient viewport와 canonical mirror의 역할을 분리한다. scrollbar와 real-time
   coordinate consumer는 controller read API를, React root·persistence는 final mirror를
   읽도록 명시해 stale 좌표를 허용하지 않는다. 별도 CSS camera를 만들지 않는다.
3. `requestAnimationFrame()`을 input 이벤트가 아닌 display frame의 coalescing 경계로
   사용하므로 고주사율에서도 work fan-out 상한이 명확하다.
4. `setPosition()`의 same-state no-op과 store echo dedupe를 session 경계에 넣어,
   final commit이 다시 controller notification을 유발하는 순환을 막을 수 있다.

기각 사유:

- **대안 B 기각**: 문제를 wheel pan에만 한정하면 wheel zoom 및 다른 zoom command의
  서로 다른 commit 정책이 남는다.
- **대안 C 기각**: RAF batching은 raw event 폭주만 줄일 뿐 `BuilderCanvas`의 camera
  store 구독과 후속 파생 실행을 매 frame 계속 유발한다.
- **대안 D 기각**: visual transform과 실제 Skia camera가 갈라져 좌표·selection·scrollbar
  정합을 보장할 수 없다.

> 구현 상세: [175-viewport-interaction-scheduling-breakdown.md](../design/175-viewport-interaction-scheduling-breakdown.md)

## Risks

| ID  | 위험                                                                                                                            | 심각도 | 대응                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | wheel debounce, `pointercancel`, `blur`, `visibilitychange`, unmount에서 pending transform을 잃어 controller와 mirror가 달라짐  |  HIGH  | 모든 종료 경로가 `flushThenCommit` 한 함수를 사용하고 G2/G4에서 중단 경로를 단언한다.                                                                      |
| R2  | zoom operation을 단순 합산해 cursor가 가리키는 scene point가 이동하거나, pan과 zoom의 입력 순서가 바뀜                          |  HIGH  | frame 안에서도 ordered transform을 보존하고 anchor 불변식 테스트와 G3으로 관리한다.                                                                        |
| R3  | selected scrollable element의 wheel routing이 canvas session으로 잘못 들어가 내부 scroll이 멈춤                                 |  MED   | routing 판정은 session 이전에 유지하고 selected scroll fixture를 G4에 포함한다.                                                                            |
| R4  | final mirror write가 store subscription을 통해 같은 controller 상태를 다시 notify하여 listener work가 중복됨                    |  MED   | controller/store 양방향 모두 값 equality guard를 두고 listener count test를 추가한다.                                                                      |
| R5  | 범위가 scene visibility, culling, raster cache로 새어 ADR-172/173의 Deprecated 가설을 무검증 재도입함                           |  HIGH  | Phase 0부터 changed-file allow-list와 stop condition을 두고 G5 실패 시 해당 ADR 재검토로 분리한다.                                                         |
| R6  | hover, workflow, scroll wheel, pointer handler가 interaction 중 stale mirror를 읽어 hit-test·scroll 좌표가 어긋남               |  HIGH  | Phase 0 consumer inventory를 `transient`/`canonical`/`presentation`으로 완결하고, real-time reader 이관과 test를 G2/G4의 선행조건으로 둔다.                |
| R7  | toolbar/keyboard/minimap/breakpoint persistence 같은 외부 writer가 active wheel session과 경합해 final viewport·저장값을 덮어씀 |  HIGH  | 모든 external command는 active session의 `flushFrame()`·`finish()` 뒤 적용하며, breakpoint persistence flush도 같은 arbitration 규칙을 G2/G4에서 검증한다. |

## Gates

| Gate                         | 시점      | 통과 조건                                                                                                                                                                                                                                                                                                     | 실패 시 대안                                                                                       |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| G1 Baseline                  | Phase 0   | 사용자 체감 재현과 DevTools violation, 실제 input counter, 코드의 controller→mirror→subscription 경로가 같은 원인을 가리키면 구현을 승인한다. device·refresh rate·sample 수·window와 비교 수치는 Phase 3 개선 전후 관찰값으로 보존한다.                                                                       | 사용자 재현 또는 인과 경로가 없으면 구현 시작 금지                                                 |
| G2 Commit and arbitration    | Phase 1~2 | 각 연속 fixture에서 raw event 100회 후 `finish`까지 mirror write 1회, 중단 경로도 final controller/store equality 100%, external command·breakpoint 전환은 이전 session을 flush/finish한 뒤 다음 command를 적용한다. 따라서 interruption은 이전 session과 command의 순서 있는 두 logical commit으로 검증한다. | session 종료·arbitration API를 재설계하고 input migration hold                                     |
| G3 Zoom geometry             | Phase 1~2 | moving anchor가 섞인 zoom/pan sequence와 min/max clamp에서 anchor scene coordinate 오차 `<= 0.01 CSS px`                                                                                                                                                                                                      | ordered operation queue를 보강; delta 단순 합산 금지                                               |
| G4 Builder behavior          | Phase 2~3 | Space-drag, vertical/Shift wheel pan, `Ctrl`/`Cmd + wheel`, toolbar, keyboard, minimap, selected internal scroll, breakpoint persistence, route reload에서 최종 viewport와 interaction UX가 현행 계약과 동등하다. active session 중 hover/workflow/scroll coordinate도 transient state와 일치한다.            | 실패한 adapter 또는 consumer migration만 rollback하고 공통 session을 우회하지 않음                 |
| G5 Visual and scope boundary | Phase 3   | Skia text/page 누락·hit-test mismatch·console error 0, 그리고 ADR-172/173 관할 scene/culling/cache 파일 변경 0                                                                                                                                                                                                | renderer 경로 수정 금지; 별도 ADR 재검토로 전환                                                    |
| G6a Scheduling performance   | Phase 3   | wheel pan/zoom 모두 transient apply와 listener fan-out은 display frame당 각각 최대 1회, continuous session mirror commit은 1회, no-op/echo write는 0회다.                                                                                                                                                     | counter 또는 RAF scheduling을 보정하고 재측정                                                      |
| G6b Full-frame observation   | Phase 3   | G1과 같은 장비·문서·window에서 RAF wall-frame p50/p95, `render.frame` p50/p95, `longtask.input`/`longtask.render`를 baseline과 비교한다. regression이면 원인을 분류한다. renderer 잔여 비용은 ADR-175의 scheduling gate와 분리한다.                                                                           | session 자체가 원인이면 rollback; renderer 원인이면 ADR-172/173에 편입하지 않은 별도 재검토로 기록 |

## Consequences

### Positive

- pan과 zoom의 실행/commit 정책이 한 contract로 수렴해 input별 성능 편차와 종료 누락을
  테스트 가능한 규칙으로 바꾼다.
- 연속 interaction 중 React/Zustand mirror write와 root scene fan-out을 제거해 wheel과
  zoom의 input scheduling 비용을 직접 줄인다. renderer 잔여 비용은 G6b에서 분리해
  관찰한다.
- toolbar·keyboard의 discrete zoom도 같은 controller/equality/commit 경계를 사용하므로
  viewport API가 단순해진다.
- ADR-172/173의 renderer 재검토와 독립적으로, input scheduling 결과를 측정 가능한
  baseline으로 제공한다.

### Negative

- transient state와 canonical mirror의 두 시점이 의도적으로 존재하므로 종료·중단 경로의
  테스트가 필수다.
- session으로 이관하지 않은 새 viewport 입력은 성능·정합 계약을 위반할 수 있어 entry
  point inventory를 지속 관리해야 한다.
- real-time coordinate consumer와 presentation consumer를 구분해 이관해야 하므로, Phase
  0 inventory·test 범위가 기존 제안보다 넓어진다.

## Implementation record — 2026-07-31

- Phase 0은 사용자 재현, DevTools violation, input counter, controller→mirror→store
  subscription echo를 같은 인과로 확인해 구현을 승인했다.
- Phase 1은 `ViewportInteractionSession`의 RAF coalescing, ordered pan/zoom queue,
  final mirror commit, equality/echo guard, external command arbitration을 unit test로
  고정했다.
- Phase 2는 Space-drag, wheel pan, Ctrl/Cmd+wheel zoom, toolbar/keyboard zoom,
  `panToPage`, minimap, scrollbar thumb, breakpoint persistence를 session 경계로
  이관했다. Unified Skia에서는 controller의 display-container attach 여부와 무관하게
  `viewportActions`가 session을 사용하도록 보정했다.
- Phase 3 smoke에서 wheel pan 20회, wheel zoom 12회, Space-drag 20회는 각각 raw input과
  transient apply가 1:1이고 continuous interaction의 mirror commit은 1회였다. 상단 Zoom
  popover의 `확대`도 listener 1회, mirror commit 1회와 `110%` 결과를 확인했다.
- targeted Vitest 18개와 `pnpm run codex:preflight`를 통과했다. 전체 문서의 Skia
  renderer long task는 scheduling 계약 밖의 관찰값으로 남기며, ADR-172/173의
  scene/culling/raster/cache를 재도입하거나 수정하지 않았다.
