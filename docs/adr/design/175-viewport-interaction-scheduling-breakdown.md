# ADR-175 설계 Breakdown: 캔버스 뷰포트 상호작용 스케줄링 계약

## 1. Scope and dependency lock

### 1.1 In scope

- `Space + pointer drag`, 일반 wheel pan, `Ctrl`/`Cmd + wheel` zoom의 continuous
  interaction lifecycle 통일
- `ZoomControls.tsx`, `useGlobalKeyboardShortcuts.ts`, `viewportActions.ts`의
  discrete zoom command가 같은 controller/equality/commit boundary를 사용하도록 정리
- `ViewportController` transient update, update listener scheduling, same-state dedupe,
  `useViewportSyncStore.setViewportSnapshot()` final mirror write의 역할 분리
- real-time coordinate consumer의 transient read 이관과 presentation consumer의 update
  policy 결정
- final viewport가 breakpoint별 persistence와 외부 viewport command에 반영되고, active
  session과 경합하지 않는지 검증

### 1.2 Explicitly out of scope

- `BuilderCanvas.tsx` scene visibility/derived snapshot, layout publisher dependency 변경
- Skia culling margin, raster coverage, content invalidation, paragraph/cache 수명 변경
- ADR-172 또는 ADR-173 문서·구현의 재개, 수정, supersede
- document schema, component style, Preview/Publish rendering 변경

`BuilderCanvas.tsx`의 `screenToCanvasPoint`처럼 interaction coordinate reader를 transient
read API로 바꾸는 좁은 연결은 in scope다. 단, `sceneStructureSnapshot`, visible page set,
layout publisher의 camera dependency와 구현은 바꾸지 않는다.

### 1.3 Dependency questions lock

| 질문                              | 판정                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| base / 응용인가?                  | 아니다. ADR-175는 viewport input scheduling, ADR-172/173은 renderer 파생·무효화 정책으로 각각 독립이다. |
| schema가 specialization 관계인가? | 아니다. ADR-175는 schema를 변경하지 않고 runtime event scheduling만 다룬다.                             |
| Deprecated 전제를 승계하는가?     | 아니다. culling radius, visibility freeze, raster deferral, cache 가설을 쓰지 않는다.                   |
| 사용자 confirm은 있는가?          | 있다. 2026-07-31 대화에서 ADR-172/173 제외와 독립 ADR 생성을 명시 확인했다.                             |

이 표의 전제가 깨지는 파일 또는 gate가 발견되면 이 ADR의 phase를 진행하지 않는다.

## 2. Current-path inventory and baseline

### 2.1 확인된 경로

| 입력                  | 현재 entry                                                                | transient 적용                   | canonical mirror 시점               | 문제                                                                 |
| --------------------- | ------------------------------------------------------------------------- | -------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| Space-drag            | `useViewportControl.ts` pointer handlers                                  | `ViewportController.updatePan()` | `endPan()`                          | 비교 기준. 매 raw event listener는 오지만 store commit은 종료 1회다. |
| Wheel pan             | 같은 hook `handleWheel()`                                                 | 원시 event마다 `setPosition()`   | RAF마다 `setViewportSnapshot()`     | store 구독 root와 controller listener가 연속으로 fan-out된다.        |
| Wheel zoom            | 같은 hook의 `zoomAtPoint(..., true)`                                      | 원시 event마다 `zoomAtPoint()`   | 원시 event마다 `syncToReactState()` | wheel pan보다 mirror write가 더 잦을 수 있다.                        |
| Toolbar/keyboard zoom | `ZoomControls.tsx`, `useGlobalKeyboardShortcuts.ts`, `viewportActions.ts` | 별도 action path                 | action별 직접 snapshot              | continuous path와 equality/flush 규칙을 공유하지 않는다.             |

### 2.2 Consumer and writer inventory lock

Phase 0는 `useViewportSyncStore`의 production consumer와 모든 `applyViewportState` /
`setPosition` writer를 아래 역할로 분류하고, 새 consumer가 있으면 이 표를 갱신한다.
barrel, store 구현, test file은 consumer가 아니므로 제외한다.

| 종류                       | 파일·경로                                                                                                                                                                                                              | 구현 전 계약                                                                                                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| transient coordinate       | `BuilderCanvas.tsx`의 `screenToCanvasPoint`, `useElementHoverInteraction.ts`, `useScrollWheelInteraction.ts`, `useWorkflowInteraction.ts`의 hover/hit-test                                                             | `controller.getState()` 또는 동등한 read-only transient API로만 screen-to-scene 변환한다. stale mirror를 읽지 않는다.                                                                                                                  |
| transient presentation     | `CanvasScrollbar.tsx`, `scrollbar/viewportMetrics.ts`, `DotBackground.tsx`, `ZoomControls.tsx`                                                                                                                         | controller listener를 display frame당 1회만 받아 갱신한다. scrollbar와 dot background는 DOM 직접 반영을 유지하고, zoom control은 isolated subscription으로 현재 zoom을 갱신한다. `BuilderCanvas` root mirror 구독으로 승격하지 않는다. |
| canonical root/persistence | `BuilderCanvas.tsx`의 scene/layout input, `useWorkspaceCanvasSizing.ts`의 persistence, `canvasSync.ts`                                                                                                                 | session final mirror만 구독한다. scene/layout input은 이 ADR에서 변경하지 않는다.                                                                                                                                                      |
| external writer            | `viewportActions.ts`, `panToPage.ts`, `ZoomControls.tsx`, `useGlobalKeyboardShortcuts.ts`, `useWorkflowInteraction.ts` minimap, `CanvasScrollbar.tsx` thumb drag, `useWorkspaceCanvasSizing.ts` fit/restore/breakpoint | 직접 controller/store write를 금지하고 §3.4 arbitration entry를 통해 active session을 끝낸 뒤 command를 적용한다.                                                                                                                      |
| input adapter              | `useViewportControl.ts` pointer/wheel                                                                                                                                                                                  | internal scroll routing을 먼저 판정하고, 통과한 continuous input만 session에 enqueue한다.                                                                                                                                              |

`usePageManager.ts`와 `TransformSection.tsx` 등 store를 참조하지만 camera의 real-time
좌표 또는 viewport write를 소유하지 않는 consumer도 Phase 0에서 위 분류가 맞음을
확인한다. 이 목록은 `rg -l 'useViewportSyncStore' apps/builder/src/builder` 결과와
대조해 누락 0개여야 한다.

`useViewportControl.ts`의 initial attach/hydration과 canonical mirror→controller bridge는
external command가 아니라 bootstrap 경로다. 이 경로도 active session이 없을 때만
equality guard 뒤에 실행하며, listener/mirror echo를 만들면 G2 실패다.

### 2.3 Phase 0 baseline and measurement contract

계측은 다음 네 counter와 frame-wall time을 한 event timeline에 기록한다.

| Counter               | 정의                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------ |
| `rawInputCount`       | adapter가 받은 pointer/wheel/keyboard repeat event 수                                |
| `transientApplyCount` | 값이 실제로 달라 controller state를 적용한 횟수                                      |
| `listenerFanoutCount` | controller update listener dispatch 횟수                                             |
| `mirrorCommitCount`   | 값이 달라 `setViewportSnapshot()`을 쓴 횟수                                          |
| `rafWallInterval`     | 연속 `requestAnimationFrame` callback timestamp의 차이. display-frame wall time 표본 |
| `handlerBody`         | `observe('input.viewport.*')`로 잰 input handler/session queue 함수 본문 시간        |

`observe()`는 React commit과 subscriber fan-out을 포함하지 않는 function-body 표본이다.
따라서 다음을 같은 p95로 합치지 않는다.

| 표본            | source / label                                                               | 판정 용도                        |
| --------------- | ---------------------------------------------------------------------------- | -------------------------------- |
| input handler   | 새 `PERF_LABEL.INPUT_VIEWPORT_DRAG`, `_WHEEL_PAN`, `_WHEEL_ZOOM`, `_COMMAND` | session 자체의 raw input 비용    |
| RAF wall frame  | session scheduler의 timestamp ring                                           | display budget 관찰              |
| render function | 기존 `PERF_LABEL.RENDER_FRAME`                                               | render body 비용                 |
| browser task    | 기존 `longtask.input`, `longtask.render`                                     | React commit 포함 장기 task 관찰 |

각 run은 device/OS/browser, refresh rate, viewport, document id, input 종류, warm-up
횟수, 기록 window와 sample count를 함께 남긴다. 120 Hz이면 `8.33ms`, 60 Hz이면
`16.67ms`를 **RAF wall-frame 관찰 budget**으로 사용한다. 이 값은 renderer까지 포함한
ADR-175 acceptance 조건이 아니다. 이 ADR의 blocking performance assertion은 raw input
대비 counter 상한이다.

각 입력은 다음 두 문서·상태에서 측정한다.

1. 제공된 `/builder/9e9e0000-1111-2222-3333-adr174leak00`
2. 여러 페이지와 실제 text를 포함한 실사용 문서

두 문서 모두에서 가시 페이지 집합이 유지되는 이동과 새 페이지가 화면에 진입하는 이동,
zoom in/out, breakpoint 전환 뒤 재시작을 포함한다. `bench-*` filler 또는 one-path
measurement만으로 G1을 통과시킬 수 없다.

### 2.4 Phase 0 progress log — 2026-07-31 (Approved)

- **정적 inventory 고정**: continuous input은 `useViewportControl.ts`, direct external
  writer는 `viewportActions.ts`, `panToPage.ts`, `ZoomControls.tsx`,
  `useGlobalKeyboardShortcuts.ts`, `CanvasScrollbar.tsx`,
  `useWorkflowInteraction.ts`, `useWorkspaceCanvasSizing.ts`에 남아 있다. canonical
  mirror reader와 real-time candidate는 `BuilderCanvas.tsx`,
  `useElementHoverInteraction.ts`, `useScrollWheelInteraction.ts`,
  `useWorkflowInteraction.ts`, `CanvasScrollbar.tsx`, `DotBackground.tsx`,
  `ZoomControls.tsx`로 고정했다. 이 목록 밖의 direct writer/real-time reader를 발견하면
  Phase 1 진입 전에 이 표를 갱신한다.
- **관측 배선 완료**: `viewportInteractionMetrics.ts`가 raw input, transient apply,
  listener dispatch/invocation, mirror commit, RAF wall interval을 독립 수집한다.
  현재 drag/wheel pan/wheel zoom은 `input.viewport.*` handler-body label과 함께 이
  counter를 기록하며, `ViewportController`는 listener fan-out을 기록한다.
  `INPUT_VIEWPORT_COMMAND` label은 Phase 2의 external command 이관 전까지 선언만
  존재한다. 관측 자체는 scheduling 정책을 변경하지 않는다.
- **브라우저 probe**: 제공된 route의 `?viewportMetrics=1`은 idle 뒤
  `document.documentElement.dataset.compositionViewportMetrics`에 같은 snapshot을
  노출한다. 이 query가 없을 때는 DOM 변경·timer가 없어 product/runtime 동작에 영향을
  주지 않는다. 이는 자동 브라우저의 DOM realm이 page-owned 전역을 읽지 못하는 제약을
  우회한 Phase 0 전용 관측 surface다.
- **예비 wheel pan 결과 (G1 미승인)**: Chrome automation으로 canvas `1800×884 CSS px`에서
  20px wheel pan 40회를 재생해 `rawInput=40`, `transientApply=40`,
  `mirrorCommit=40`, `listenerDispatch=82`, `listenerInvocation=164`를 확인했다.
  `input.viewport.wheel-pan` handler body는 p95 `0.5ms`였지만,
  `longtask.render`는 42 samples / p95 `362ms`, `render.frame`은 1,000 retained samples /
  p95 `4.6ms`였다. 이는 event-level mirror write와 그 뒤 render task의 분리를 뒷받침하는
  원인 신호일 뿐, CUA가 입력을 직렬 주입해 `rafWallInterval` p50 `412.7ms`가 display
  cadence가 아니므로 performance gate 증적으로 사용할 수 없다.
- **실제 wheel-pan baseline (G1 일부 충족)**: 제공된 Builder route에서 사용자가 일반
  wheel-pan을 직접 수행해 `rawInput=89`, `transientApply=89`,
  `mirrorCommit=52`를 얻었다. `listenerFanout=141`은 정확히
  `rawInput + mirrorCommit`이고, listener가 2개이므로
  `listenerInvocation=282`가 됐다. 이는 현재 input의 즉시
  `controller.setPosition()` notify와 RAF mirror 뒤 store subscription의
  `controller.setPosition()` echo가 모두 fan-out을 만든다는 코드 경로와 일치한다.
  `rafWallInterval`은 p50 `110.3ms`/p95 `227.8ms`였고,
  `longtask.render`는 39 samples 모두 50ms 초과(p50 `123ms`, p95 `227ms`,
  max `288ms`)였다. 같은 실제 run의 DevTools Console은 React wheel task
  `179–737ms`와 `SkiaCanvas.tsx:761` RAF `50–291ms` violation도 보고했다.
  이 값은 scheduling 개선의 실제 source baseline이지만, device/OS/refresh-rate
  metadata, wheel zoom/Space-drag, 실제 다페이지 문서 scenario가 아직 없어 G1 전체
  통과나 Phase 1 진입 근거로 사용하지 않는다.
- **실제 Control + wheel zoom baseline (G1 일부 충족)**: 새 reset 뒤 사용자가
  `Control + wheel`만 수행해 `rawInput=33`, `transientApply=33`,
  `mirrorCommit=25`, `listenerFanout=50`, `listenerInvocation=100`을 얻었다.
  zoom limit에서 state가 변하지 않은 8 raw input을 제외하면, 상태가 변한 25회 각각이
  immediate mirror와 store subscription echo로 정확히 2회의 fan-out을 만들었다.
  `rafWallInterval=0`은 현행 zoom이 RAF가 아니라
  `controller.zoomAtPoint(..., true)`의 즉시 React mirror 경로라는 뜻이다.
  `longtask.input`은 25 samples 모두 50ms 초과(p50 `112ms`, p95 `200ms`)였고,
  `longtask.render`도 23 samples 중 22회가 50ms 초과(p50 `117ms`, p95 `180ms`)였다.
  따라서 wheel zoom도 pan과 같은 session/finish commit 정책의 대상임을 실제 입력으로
  확인했다. device/OS/refresh-rate metadata, Space-drag, 실제 다페이지 문서 scenario는
  여전히 남아 있어 G1 전체 통과로 표시하지 않는다.
- **실제 Space + drag baseline (G1 일부 충족)**: 새 reset 뒤 사용자가
  `Space + drag`만 수행해 `rawInput=328`, `transientApply=328`,
  `mirrorCommit=6`, `listenerFanout=334`, `listenerInvocation=668`을 얻었다.
  6개의 continuous drag는 이미 종료 시 한 번만 mirror하지만, 각 pointer move가
  `controller.updatePan()`을 통해 즉시 listener를 깨우고 종료 mirror의 store echo가
  6회를 더해 `328 + 6 = 334` fan-out이 됐다. 따라서 drag는 canonical commit 정책은
  이미 목표와 같지만 listener dispatch는 RAF coalescing 대상이다.
  `longtask.input`은 없었지만 `longtask.render`는 22 samples 모두 50ms 초과
  (p50 `147ms`, p95 `204ms`, max `234ms`)였다. `rafWallInterval=0`은 이 counter가
  현재 wheel-pan RAF에만 배선돼 있기 때문이며, drag render loop가 frame stall이 없다는
  뜻은 아니다. device/OS/refresh-rate metadata와 실제 다페이지 문서 scenario가 남아
  있어 G1 전체 통과로 표시하지 않는다.
- **실제 multi-page 문서 확인**: 제공 route의 canonical document에는 `Components`와
  `Home`, `Page 2`부터 `Page 22`까지 총 23개의 legacy-page frame이 존재한다. 따라서
  synthetic fixture 없이 가시 페이지 집합 유지와 새 페이지 진입을 포함한 G1 scenario를
  같은 실제 문서에서 재생할 수 있다. 이전 pageRole 위주 조회는 `Home`과 `Page 2`~`Page 22`를
  놓쳤으므로, 이후 inventory는 `metadata.type === "page" | "legacy-page"` 및
  `type === "frame" && reusable !== true`를 함께 사용한다. 아직 각 scenario의 physical
  baseline과 장비 metadata는 기록되지 않았으므로 G1 전체 통과로 표시하지 않는다.
- **자동 multi-page probe (G1 성능 증거 제외)**: Browser UI에서 `Page 2` selection과
  transition 완료를 확인했고, 해당 실제 canvas에는 다수의 page가 가시 상태였다. fresh reload
  뒤 overview에는 23개 page가 같은 canvas에 배치된 것도 확인했다. 이어 자동 scroll 20회를
  재생했을 때 browser automation은 `Ctrl` modifier를 wheel zoom으로 전달하지 않고
  `wheel-pan` 40개로 관측했다. `rawInput=40`, `transientApply=40`,
  `mirrorCommit=40`, `listenerFanout=82`, `listenerInvocation=164`였으며,
  fan-out의 추가 2회는 reload 뒤 page command notification이다. 이 경로의 RAF wall p50은
  `166.7ms`, p95는 `2554ms`였고 long task가 automation dispatch 간격을 포함하므로 physical
  frame 성능을 뜻하지 않는다. reverse scroll의 page re-entry 확인은 automation timeout으로
  완료되지 않아 G1 scenario 통과 증거나 performance baseline으로 사용하지 않는다.
- **Chrome OS-level multi-page smoke (G1 일부 충족)**: DevTools Console에서 counters를
  reset한 뒤, zoom `10%`의 실제 23-page canvas에 normal scroll down 1회와 up 1회를
  입력했다. screenshot으로 전체 page 집합이 가시 상태에서 canvas 밖으로 이동한 뒤 다시
  같은 집합으로 재진입하는 것을 확인했다. snapshot은 `rawInput=2`,
  `transientApply=2`, `mirrorCommit=2`, `listenerFanout=4`,
  `listenerInvocation=8`로, 각 입력의 즉시 controller notification과 RAF mirror echo를
  그대로 보였다. `rafWallInterval=22592.5ms`는 두 입력 사이 Console 전환 시간을 포함하므로
  frame cadence가 아니다. 이 OS-level automation은 human wheel/trackpad의 input rate가
  아니며 sample 수가 2이고 hardware metadata도 없으므로, multi-page 기능 smoke로만
  기록하고 G1 성능 baseline 또는 통과로 사용하지 않는다.
- **Phase 0 승인 결정**: 사용자의 실제 frame-drop 재현, DevTools의 React wheel 및
  `SkiaCanvas.tsx:761` violation, wheel pan/zoom의 input counter, 그리고 즉시
  controller notify → canonical mirror → subscription echo라는 코드 경로가 한 원인을
  독립적으로 확정한다. 따라서 사용자는 2026-07-31 Phase 0을 승인하고 Phase 1 착수를
  지시했다. 위 기록 중 sample 수·hardware metadata·automation cadence 관련 제한은
  Phase 3 전후 비교의 관찰 품질에만 적용하며, Phase 1 진입을 막지 않는다. 이전의
  `G1 일부 충족` 또는 `Phase 1 진입 근거로 사용하지 않는다`라는 표현은 이 승인으로
  supersede한다.

## 3. Target interaction contract

### 3.1 Public execution model

구현 명칭은 예시이며, 핵심은 input adapter가 실행·commit 정책을 직접 갖지 않는 것이다.
session은 `ViewportController`와 같은 workspace 수명 동안 하나만 존재하며(예:
`getViewportInteractionSession()`), `useViewportControl`, `viewportActions`, breakpoint
adapter가 그 인스턴스를 공유한다. hook별 local session 또는 두 개의 active session은
허용하지 않는다.

```ts
type ViewportInteractionSession = {
  begin(
    kind: "drag" | "wheel-pan" | "wheel-zoom" | "discrete" | "programmatic",
  ): void;
  isActive(): boolean;
  queuePan(delta: { x: number; y: number }): void;
  queueZoomAt(input: { delta: number; anchor: { x: number; y: number } }): void;
  flushFrame(): void;
  finish(reason: "pointerup" | "idle" | "discrete" | "interrupted"): void;
};
```

계약:

1. `queue*`는 raw event마다 호출될 수 있으나 canonical store를 쓰지 않는다.
2. `flushFrame`은 pending operation을 순서대로 controller에 적용하고, 같은 display
   frame에서 한 번만 controller listener를 fan-out한다.
3. `finish`는 pending RAF를 먼저 flush한 다음, 마지막 canonical snapshot과 값이 다를
   때만 한 번 mirror commit한다. scheduled RAF가 남아 있으면 cancel해 duplicate flush를
   막는다.
4. `pointercancel`, `window.blur`, `visibilitychange`, bridge detach/unmount는
   `finish("interrupted")`를 호출한다. 현재 visual 위치를 버리지 않는다.
5. toolbar click, keyboard shortcut처럼 discrete한 command는 `begin` → operation →
   `finish("discrete")`를 한 turn 안에 수행한다. hold/repeat가 실제 continuous input으로
   정의된 경우에만 별도 session lifecycle을 갖는다.
6. session은 controller에 operation을 적용하는 동안 listener dispatch를 억제하고,
   `flushFrame` 끝에서 한 번만 dispatch한다. listener가 이미 자체 RAF를 쓰더라도 raw
   listener invocation 수를 제한한다.

### 3.2 Ordered transforms and zoom anchor

pan과 zoom은 교환법칙이 성립하지 않는다. 따라서 frame 안의 operation은 다음처럼
처리한다.

- 인접한 pan delta만 합칠 수 있다.
- zoom 또는 pan/zoom 혼합은 수신 순서를 유지한다. moving cursor의 zoom을 delta 하나로
  합산하지 않는다.
- zoom 전 `world = (anchor - position) / scale`을 계산하고, `nextScale` clamp 뒤
  `nextPosition = anchor - world * nextScale`로 위치를 갱신한다.

이 불변식은 `ViewportController.zoomAtPoint()`의 현행 cursor 유지 수학을 보존한다.

### 3.3 Authority, real-time reads, and echo rules

| 상태                   | 권위                                                   | 읽는 소비자                                                                                      | 쓰기 시점                           |
| ---------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ----------------------------------- |
| transient `{x,y,zoom}` | `ViewportController`와 기존 mutable viewport read path | Skia frame, scrollbar, dot background, real-time coordinate/hit-test, isolated zoom presentation | RAF flush                           |
| canonical mirror       | `useViewportSyncStore`                                 | React root scene/layout input, persistence, non-real-time UI                                     | session finish 또는 discrete finish |

- external store command가 controller로 들어올 때 현재 controller state와 같으면
  `setPosition()`/listener notification을 생략한다.
- session의 final mirror write가 store subscription으로 되돌아오더라도 같은 값이면
  controller를 다시 notify하지 않는다.
- `useViewportControl.ts`의 store→controller bridge는 현재의 `isPanningActive()`가 아니라
  session의 `isActive()`를 사용한다. wheel pan/zoom이 active인 동안 mirror subscription은
  controller를 되돌리거나 notify하지 않는다.
- selected scrollable element의 wheel은 session을 시작하기 전에 기존 internal scroll
  routing으로 반환한다.
- `BuilderCanvas.tsx`의 `screenToCanvasPoint`와 §2.2의 coordinate consumer는 transient
  getter를 사용한다. 이 좁은 wiring 변경은 허용하지만 scene snapshot/layout publisher가
  read하는 canonical mirror는 바꾸지 않는다.
- `ZoomControls.tsx`는 editor input이 아닐 때 controller listener의 isolated subscription을
  표시값으로 사용한다. `DotBackground.tsx`는 같은 listener를 통해 CSS variable을 갱신한다.
  둘 다 session 종료까지 stale 값을 보여 주는 선택지는 허용하지 않는다.

### 3.4 External command arbitration

모든 programmatic/discrete viewport writer는 단일 entry(명칭 예:
`runViewportCommand`)를 거친다. entry는 다음 순서를 **항상** 지킨다.

1. active continuous session이 있으면 pending RAF를 `flushFrame()`하고
   `finish("interrupted")`한다. 이때 이전 session의 final mirror write는 정확히 한 번이다.
2. command는 controller의 최신 transient state와 container size를 기준으로 next viewport를
   계산한다. active session 중의 stale Zustand `zoom`/`panOffset`을 input으로 쓰지 않는다.
3. command를 controller에 적용하고 equality가 다를 때만 canonical mirror를 한 번 쓴다.
   따라서 interrupted continuous session과 뒤따른 command는 의도적으로 **두 개의 순서 있는
   logical commit**이다. 하나로 합쳐 이전 사용자의 final viewport를 잃지 않는다.
4. `panToPage` 같은 programmatic animation은 시작 전에 1~3을 수행한 뒤 별도
   `programmatic` session으로 진행하며 끝 또는 취소에 한 번 commit한다. 새 input 또는 새
   external command가 시작되면 `cancelPanToPage()`와 programmatic session의 `finish()`를
   호출한 뒤 같은 entry로 다시 arbitration한다.

적용 대상은 `applyViewportState`, `zoomViewportAtContainerCenter`, toolbar/keyboard,
minimap, scrollbar thumb drag, `panToPage`, fit/restore/breakpoint 전환이다. breakpoint
전환은 **session finish → 이전 breakpoint persistence flush → active breakpoint 교체 →
새 viewport command** 순서를 지켜, `useWorkspaceCanvasSizing`이 stale mirror를 저장하지
않게 한다.

## 4. Delivery phases

### Phase 0 — inventory and measurement freeze

- §2 counter와 G1 scenario를 추가해 current baseline을 기록한다.
- §2.2의 모든 viewport write entry point와 consumer를 inventory로 고정한다. stale
  coordinate reader 또는 직접 writer가 하나라도 남으면 Phase 1로 진행하지 않는다.
- scene/culling/cache 파일이 필요하다는 판단이 나오면 stop condition을 발동한다.

### Phase 1 — session primitives and contract tests (Implemented 2026-07-31)

- session lifecycle, RAF coalescing, ordered transform queue, `flushThenCommit`, equality
  guard, external arbitration을 unit test와 함께 도입한다.
- 기존 controller 직접 호출과 동시에 살아 있는 dual path를 만들지 않는다. adapter migration
  전에는 test-only seam 또는 one controlled entry만 사용한다.
- `ViewportInteractionSession`과 contract test를 도입했다. raw pan은 frame당 한 번의
  controller listener dispatch로 합치고, pan/zoom mixed queue는 수신 순서를 보존한다.
  `finish()`는 pending frame을 먼저 flush한 뒤 mirror가 다를 때만 commit하며,
  `runCommand()`는 active session의 final commit 뒤 command commit을 적용한다.
  `ViewportController.setPosition()` equality guard가 store subscription echo의 listener
  notification을 막는다. 기존 adapter는 아직 이 session을 호출하지 않는다.

### Phase 2 — input adapter migration

- pointer drag, wheel pan, wheel zoom을 session으로 이관한다.
- toolbar/keyboard/`viewportActions`의 discrete command를 같은 finish path로 이관한다.
- `BuilderCanvas` coordinate wiring, hover/workflow/internal-scroll read path와
  zoom/dot presentation subscription을 §3.3대로 이관한다.
- `panToPage`, minimap, scrollbar thumb, fit/restore/breakpoint path를 §3.4 entry로
  이관한다. breakpoint persistence는 session finish 뒤의 final mirror만 저장한다.
- `pointercancel`, wheel idle, blur, visibility change, unmount cleanup을 G2 fixture로
  고정한다.

### Phase 3 — browser verification and performance decision

- G4~G6 matrix를 local Builder에서 실행한다.
- 실패가 session implementation이면 해당 adapter/primitive만 rollback한다.
- 실패가 scene visibility 또는 Skia raster 비용이면 이 ADR을 확장하지 않고
  ADR-172/173 재검토 작업으로 분리한다.

## 5. Verification matrix

| 시나리오                    | 정확성 단언                                                                                   | 성능 단언                                   |
| --------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Space-drag                  | `pointerup`/`pointercancel` 뒤 controller = mirror                                            | raw move 수와 무관하게 mirror 1회           |
| Wheel pan                   | vertical/Shift horizontal 결과, idle final state; hover/scroll 좌표가 transient state와 일치  | RAF당 transient/listener 최대 1, mirror 1회 |
| Wheel zoom                  | `Ctrl`/`Cmd`, moving anchor, min/max clamp; zoom UI·dot background가 frame 단위 현재값을 표시 | RAF당 transient/listener 최대 1, mirror 1회 |
| Toolbar/keyboard zoom       | center anchor와 zoom level, immediate visual response; active wheel을 먼저 finish             | command당 mirror 최대 1, same-state 0       |
| Minimap/scrollbar/panToPage | active session 뒤 최신 transient state에서 command 적용; animation ownership 전환             | 이전 session 1회 + command 1회 이내         |
| Selected internal scroll    | canvas pan 대신 element scroll                                                                | viewport session/commit 0                   |
| Interrupted interaction     | blur/hidden/unmount 뒤 final snapshot 보존                                                    | pending work/duplicate mirror 0             |
| Persistence                 | breakpoint 전환 전 session finish, route reload 뒤 final viewport 복원                        | restore echo listener 0                     |
| Visual smoke                | page/text 누락 0, hover/selection/hit-test 정상                                               | G6a counter 통과; G6b 관찰값 분류           |

테스트 소유 파일은 최소 다음을 포함한다. 새 `ViewportInteractionSession.test.ts`는 ordered
queue, RAF coalescing, finish/arbitration/equality를 고정한다. `useViewportControl` interaction
test(`useViewportControl.test.ts`)는 input·idle·cancel·unmount를,
`viewportActions.test.ts`는 external command ordering을, `useElementHoverInteraction.test.ts`,
새 `useWorkflowInteraction.test.ts`, 새 `useScrollWheelInteraction.test.ts`는 transient
coordinate read를, `useWorkspaceCanvasSizing.viewportPersistence.test.ts`는 breakpoint flush
순서를 고정한다. 새 `CanvasScrollbar.test.ts`는 raw listener dispatch 상한과 RAF DOM update
상한을 고정한다.

## 6. Stop conditions and rollback

다음 중 하나면 ADR-175 구현을 중단하고 scope를 넓히지 않는다.

1. `BuilderCanvas` scene structure, visible page set, layout publisher dependency를 바꾸지
   않고는 **G6a scheduling**을 통과할 수 없다. coordinate read wiring만의 변경은 이 stop
   condition에 해당하지 않는다.
2. Skia content invalidation, culling margin, raster coverage, paragraph/cache 수명을
   바꾸지 않고는 정지 상태 시각 오류를 해결할 수 없다.
3. real document에서 page/text 누락, hit-test mismatch, persistence loss가 하나라도
   재현된다.

rollback은 session adapter를 기존 entry로 되돌리고 controller/store schema는 바꾸지 않는다.
ADR-172/173의 코드나 문서를 보정해서 문제를 덮는 rollback은 허용하지 않는다.
