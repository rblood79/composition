# ADR-187: 에디터 프레젠테이션 트랜잭션과 타입 기반 무효화

## Status

Proposed — 2026-08-22

## Context

Style Panel의 color picker popover에서 색상을 pointer drag로 연속 변경할 때
Chrome이 다음 경고를 기록했다.

```text
[Violation] 'requestAnimationFrame' handler took 52ms
```

이 경고 자체는 한 프레임의 main-thread 작업이 길었다는 관측값일 뿐 원인을
특정하지 않는다. 코드 경로를 따라가면 picker primitive보다 **편집 preview를
canonical document 변경으로 표현하고 전역 파생 경로를 깨우는 구조**가 더 근본적인
원인이다.

1. `ColorPickerPanel.handleChange`가 RAF를 소유하고
   (`ColorPickerPanel.tsx:85-100`), `useFillActions.updateFillPreviewThrottled`가 다시
   RAF를 소유한다 (`useFillActions.ts:169-187`). 바깥 RAF는 종료 시 취소되지만
   안쪽 RAF는 `handleColorChangeEnd`가 commit하기 전에 취소·flush되지 않는다.
   따라서 이미 commit된 최종 값 뒤에 stale preview가 실행될 수 있다.
2. `updateSelectedFillsPreviewLightweight`는 이름과 달리 전체 legacy `elements`
   배열과 `elementsMap`을 다시 만들고, dirty subtree를 수집하고,
   `layoutVersion`을 무조건 증가시킨 뒤 canonical을 동기화한다
   (`inspectorActions.ts:1399-1443`). `fills`는 paint 데이터인데 layout 변경으로
   승격된다.
3. 같은 함수는 legacy store `set`을 먼저 수행하고 canonical mutation을 나중에
   호출한다. 이는 ADR-122/184의 canonical-first 순서와 반대이며, 한 frame 안에서도
   canonical reader와 legacy reader가 다른 값을 볼 수 있는 split-brain window를
   만든다.
4. `BuilderCanvas`는 active canonical document 전체 identity를 구독하고
   (`BuilderCanvas.tsx:246-315`), fill을 포함한 projection signature를 전체 scene에
   대해 계산한다 (`buildSceneSnapshot.ts:createNodeProjectionSignature`). projection
   변경은 `StoreRenderBridge`의 full rebuild로 승격될 수 있고, Preview는 RAF에서
   canonical document 전체를 `postMessage`한다 (`useIframeMessenger.ts:306-324,
1087-1106`). 대상 한 개의 색상 변경 비용이 문서 요소 수 `N`과 결합한다.

즉, 이 문제는 RAF 한 번을 지우거나 52ms 경고를 숨기는 것으로 닫히지 않는다.
현재 모델에는 다음 두 개의 시간축과 세 종류의 변경이 구분되어 있지 않다.

- **presentation timeline**: pointer가 움직이는 동안 사용자에게 즉시 보여야 하지만
  history/persist/canonical document에는 아직 기록하면 안 되는 값
- **canonical timeline**: interaction이 정상 종료됐을 때 한 번만 기록되어야 하는
  최종 값
- **invalidation lattice**: `paint < layout < structure`. 상위 종류는 하위 render를
  포함하지만, 하위 종류를 상위로 승격해서는 안 된다.

ADR-176의 `pagePositionPresentation`은 canonical map reference와 작은 active
override를 분리하고, frame publish와 finish-only canonical commit을 구분한 내부
선례다. Preview의 `interactionOverrides`도 canonical document를 직접 바꾸지 않고
node별 runtime overlay를 병합한다. ADR-187은 두 선례를 Style/Property의 연속 편집
전반으로 일반화하되, renderer별 임의 채널이 아니라 하나의 typed transaction
contract로 고정한다.

외부 설계 근거도 같은 방향이다.

- Flutter `RenderBox`는 속성이 layout에 쓰이면 `markNeedsLayout`, painter에만
  쓰이면 `markNeedsPaint`를 호출하도록 구분한다. 변경이 실제로 생겼을 때만
  invalidation해야 한다
  ([RenderBox](https://api.flutter.dev/flutter/rendering/RenderBox-class.html),
  [markNeedsLayout](https://api.flutter.dev/flutter/rendering/RenderObject/markNeedsLayout.html)).
- React의 `useSyncExternalStore`는 데이터가 바뀌지 않은 동안 같은 immutable snapshot
  reference를 반환해야 불필요한 render를 막을 수 있다고 명시한다
  ([React](https://react.dev/reference/react/useSyncExternalStore)).
- Pointer Events는 capture된 pointer의 `pointerup`/`pointercancel` 수명과 implicit
  release를 정의한다. editor transaction도 같은 session 경계를 가져야 한다
  ([W3C Pointer Events](https://www.w3.org/TR/pointerevents/)).

### 3-domain boundary

- **D1 DOM/accessibility**: React Aria `ColorArea`/`ColorSlider`의 입력·키보드·focus
  계약은 유지한다. pointer capture, `pointerup`, `pointercancel`, `Escape`, blur,
  unmount는 transaction lifecycle event로 연결한다.
- **D2 Props/API**: public component props, component Spec, catalog, canonical document
  schema는 변경하지 않는다. 새 타입은 Builder/Preview 내부 runtime message와
  mutation descriptor에 한정한다.
- **D3 visual style**: 색상·fill·opacity 같은 paint 결과와 Skia/Preview 시각 정합을
  다룬다. CSS token과 정지 상태 스타일은 바꾸지 않는다. geometry·typography처럼
  layout에 영향을 주는 편집은 같은 runtime의 `layout` lane으로 분류한다.

**Spec/Generator 판정**: 해당 없음. 이 결정은 Builder 내부 authoring runtime과
Preview transient message만 바꾸며 `packages/specs`, generator, 저장 schema를
확장하지 않는다.

### Scope and dependency lock

- ADR-122의 canonical-only runtime 방향과 canonical-first 계약을 보존한다.
- ADR-176의 presentation lifecycle을 일반화하지만, ADR-176의 미완료 phase를
  분리하는 fork는 아니다. ADR-187은 Style/Property 전반이 사용할 신규 base
  runtime 결정이다.
- 정상 종료 commit은 ADR-184 `runCanonicalMutation`의 순서를 사용하고, ADR-185의
  history required union을 만족한다.
- ADR-075/172/173의 renderer 성능 결론을 숫자 근거로 재사용하지 않는다. Phase 0에서
  현재 production build를 새로 측정한다.

### Hard Constraints

1. continuous interaction의 `begin`~`finish/cancel` 동안 canonical document,
   legacy `elements/elementsMap`, history, persistence, `layoutVersion`, 전체
   `sceneVersion`을 presentation 값으로 변경하지 않는다.
2. scheduling owner는 transaction runtime 하나다. raw publish는 latest-wins로
   합쳐 display frame당 최대 1회 적용한다. control/hook/renderer가 중첩 RAF를
   추가하지 않는다.
3. `finish`, `cancel`, selection change, `pointercancel`, `Escape`, window blur, unmount
   뒤에는 해당 session의 callback이 0회 실행되어야 한다. 일반 focus blur는 control의
   기존 commit 의미를 따르며 일괄 cancel 대상이 아니다. `finish`는 pending 값과 종료
   event의 최종 값을 한 번 합성한 뒤 예약 RAF를 취소한다.
4. caller는 invalidation kind를 직접 선언하지 않는다. 중앙
   `classifyEditorMutation(descriptor)`만 `paint | layout | structure`를 판정하며,
   미분류 descriptor는 production fallback으로 조용히 `paint`가 되지 않고
   개발·테스트에서 실패한다.
5. `paint` publish는 대상 `k`개만 갱신한다. layout publisher 실행 0회, projection
   signature 전체 계산 0회, scene graph/full bridge rebuild 0회, canonical document
   Preview message 0회여야 한다. 추가 작업량은 `O(k)`이고 전체 요소 수 `N`과
   무관해야 한다.
6. `layout` publish는 affected target/subtree로 제한하고 `structure` publish만 scene
   topology 변경을 허용한다. 상위 lane은 paint render를 포함하지만 하위 lane이
   상위 version을 올리지 않는다.
7. 정상 종료는 session이 캡처한 target/path에 최종 descriptor를 적용하여 canonical
   mutation 1회, history entry 1개, persistence request 최대 1회를 만든다. cancel은
   세 항목 모두 0회다. commit은 canonical → store/index → history → persist 순서를
   벗어나지 않는다.
8. session 도중 canonical document가 외부 변경되면 indexed target/path를 다시
   읽는다. 같은 path가 변하지 않았으면 rebase하고, 겹치면 cancel한다. 현재 selection을
   commit target으로 다시 읽어 다른 요소를 덮어쓰지 않는다.
9. Skia와 Preview는 같은 session/revision/descriptor 의미를 소비한다. Preview
   message는 out-of-order revision을 버리고 finish/cancel 뒤 overlay를 제거한다.
   drag 중 두 renderer의 최종 색상 차이는 channel당 1/255 이하, 종료 후 차이는 0이다.
10. production benchmark의 paint pilot에서 요소 수 `N=50/500/5,000`, 대상 `k=1`의
    `presentation publish + Skia apply` p95는 4ms 이하, p99는 8.33ms 미만이어야 한다.
    120Hz 5초 actual pointer trace에서 ADR-187 handler에 귀속되는 8.33ms 초과 frame은
    0이어야 한다. Phase 0 baseline을 기록하지 못하면 구현 phase에 진입하지 않는다.
11. 저장 schema migration, persisted document rewrite, 기존 프로젝트 hydration 변화는
    0건이다. BC 영향은 문서 기준 0%, public API 기준 0%다.
12. 새 외부 dependency를 추가하지 않는다. migration 완료 후 기존 fill preview
    action, 중첩 RAF, presentation 목적 legacy/canonical dual-write를 제거하고 정적
    guard로 재도입을 막는다.

### Soft Constraints

- ADR-176의 `begin/publish/finish/cancel/read/subscribe` 어법과 immutable snapshot을
  재사용한다.
- lane 추가보다 descriptor inventory와 중앙 classifier를 먼저 완결한다.
- phase별 feature flag 또는 property allowlist로 rollback 가능하게 하되, 최종 상태에
  영구적인 신·구 이중 경로를 남기지 않는다.
- 4ms/8.33ms 목표는 architecture gate이지 현재 성능을 이미 달성했다는 주장이 아니다.

## Alternatives Considered

### 대안 A: 현행 generalized — frame마다 canonical 변경 + 전역 scene invalidation

- 설명: picker의 RAF 수만 조정하고 모든 Style/Property preview를 기존
  `updateSelected*Preview`와 `layoutVersion` 경로로 통일한다.
- 기술 위험: MED — 동작 경로는 익숙하지만 legacy-first/canonical-second와 stale
  preview race가 남는다.
- 성능 위험: **HIGH** — 대상 1개의 paint 변경이 canonical document identity,
  projection signature, layout/render/Preview whole-document fan-out을 깨운다.
- 유지보수 위험: **HIGH** — 새 continuous editor마다 preview snapshot, RAF,
  cancel, layoutVersion tail을 복제한다.
- 마이그레이션 위험: LOW — 변경량은 가장 작다.

### 대안 B: canonical per-frame 유지 + typed invalidation만 도입

- 설명: `layoutVersion`을 paint/layout/structure로 나누지만 preview 값 자체는 매
  frame canonical document에 기록한다.
- 기술 위험: MED — invalidation 오분류는 줄지만 history/persist 제외용 별도 분기가
  계속 필요하다.
- 성능 위험: **HIGH** — active document identity, canonical traversal, React
  subscribers, Preview document 전송이 여전히 `N`에 결합한다.
- 유지보수 위험: MED — version 종류는 선명해지지만 canonical과 preview의 수명
  의미가 섞인 상태는 유지된다.
- 마이그레이션 위험: MED — version consumer 전수 이관이 필요하다.

### 대안 C: control별 imperative renderer preview channel

- 설명: color picker는 Skia fill API, slider는 geometry API처럼 control마다 직접
  renderer channel을 만들어 canonical fan-out을 우회한다.
- 기술 위험: **HIGH** — 같은 descriptor가 Skia와 Preview에서 다르게 해석될 수 있고
  hit-test/layout consumer가 빠지기 쉽다.
- 성능 위험: MED — 개별 pilot은 빠르지만 channel 수와 중복 serialization이 늘며
  cross-control transaction coalescing이 없다.
- 유지보수 위험: **HIGH** — begin/cancel/commit/selection conflict를 control마다
  구현하고 renderer 두 벌을 동기화해야 한다.
- 마이그레이션 위험: MED — editor별 순차 이관은 가능하지만 최종 API가 파편화된다.

### 대안 D: Editor Presentation Transaction + 중앙 typed invalidation (선택)

- 설명: canonical과 분리된 ephemeral overlay를 transaction runtime이 소유하고,
  중앙 descriptor classifier가 `paint | layout | structure`를 판정한다. renderer는
  affected target만 소비하고 정상 종료에만 canonical commit한다.
- 기술 위험: MED — 두 timeline, conflict, renderer parity 계약을 명시해야 한다.
- 성능 위험: LOW — paint hot path가 `O(k)`이며 whole-document work를 구조적으로
  금지한다.
- 유지보수 위험: MED — core runtime/classifier 비용은 생기지만 control별 lifecycle과
  renderer channel 중복을 제거한다.
- 마이그레이션 위험: MED — fill pilot 후 continuous editor inventory를 단계적으로
  옮기고 legacy preview API를 삭제해야 한다.

## Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    |  M   |  H   |    H     |      L       |     2      |
| B    |  M   |  H   |    M     |      M       |     1      |
| C    |  H   |  M   |    H     |      M       |     2      |
| D    |  M   |  L   |    M     |      M       |     0      |

판정: HIGH+가 0인 대안 D가 존재한다. 추가 대안 루프는 필요하지 않다. 대안 A/B는
canonical document fan-out이라는 성능 HIGH를 남기고, C는 renderer 대칭성과
lifecycle 중복이라는 기술·유지보수 HIGH를 남긴다.

## Decision

**대안 D — Editor Presentation Transaction + 중앙 typed invalidation**을 채택한다.

1. Builder 내부에 `EditorPresentationTransactionRuntime`을 둔다. runtime은
   immutable canonical reference와 session별 small overlay, pending latest
   descriptor, monotonic revision, 한 개의 frame scheduler를 소유한다.
2. control은 `begin`에서 target/path/base value를 캡처하고 `publish`로 typed
   descriptor만 전달한다. `finish`는 최종 descriptor를 한 번 commit하고 overlay를
   제거하며, `cancel`은 overlay만 제거한다. control은 RAF와 preview store mutation을
   소유하지 않는다.
3. `EditorMutationDescriptor`는 `fills`, paint style, layout style/geometry,
   structure mutation을 discriminated union으로 표현한다.
   `classifyEditorMutation`이 invalidation lattice의 유일한 SSOT다. unknown key는
   명시적인 classifier inventory 없이는 continuous preview 대상이 될 수 없다.
   기존 layout 무효화 분류 배열 (`LAYOUT_AFFECTING_PROP_KEYS` —
   `stores/utils/layoutInvalidation.ts`, `NON_LAYOUT_PROPS_UPDATE` —
   `stores/utils/elementUpdate.ts`, `LAYOUT_STYLE_KEYS`/`LAYOUT_PROP_KEYS` —
   `scene/layoutCache.ts`) 은 canonical commit 이후 경로에서 계속 동작하므로,
   G2 inventory는 이 배열들과의 축별 대조를 포함해 두 분류 소스의 drift
   (drag 중 신규 classifier ↔ commit 후 기존 체인 판정 불일치) 를 차단한다.
4. version을 단일 `sceneVersion` 의미로 사용하지 않는다. presentation에는
   target별 paint revision, layout revision/affected roots, structure revision을
   분리한다. canonical commit 뒤 기존 canonical consumers가 한 번 갱신되는 것은
   허용하지만 drag frame에는 연결하지 않는다.
5. Skia는 dedicated bridge가 overlay patch를 대상 node에 적용하고 content
   invalidation을 요청한다. `paint`는 `useLayoutPublisher`와 full scene rebuild를
   거치지 않는다. Preview는 node별 `editorPresentationOverrides`를 받아 canonical
   props 위에 병합하고 해당 node selector만 갱신한다.
6. finish commit은 `runCanonicalMutation`을 통해 canonical-first로 수행하고
   ADR-185 history contract를 만족한다. overlay는 canonical/store stage가 끝난 뒤
   제거해 final frame flicker를 막고, persist는 기존 runner 경계를 따른다.
7. migration은 fill color를 첫 pilot으로 삼되 Skia/Preview parity gate 전에는
   production cutover하지 않는다. 이후 opacity, gradient stop, stroke/paint,
   geometry slider 순으로 classifier inventory가 완결된 editor만 이관한다.
   structure lane은 별도 scoped scene gate를 통과하기 전 continuous publish에
   사용하지 않는다.
8. active session과 겹치는 canonical path가 외부에서 바뀌면 해당 session을
   cancel한다. 겹치지 않은 document 변경은 indexed path 비교 후 base version을
   rebase한다. selection change는 숨은 target 편집을 막기 위해 cancel한다.

기각 사유:

- **A 기각**: RAF 횟수만 줄여도 whole-document canonical/projection/layout/Preview
  fan-out과 stale inner RAF가 남는다. 증상을 낮출 뿐 비용의 차수를 바꾸지 못한다.
- **B 기각**: typed invalidation은 필요하지만 presentation/canonical 수명 분리 없이
  단독 적용하면 active document identity와 Preview full-document 전송이 남는다.
- **C 기각**: 단일 picker는 빠르게 만들 수 있으나 editor 수에 비례해 lifecycle과
  renderer 해석이 복제되어 완성도와 장기 성능을 함께 잃는다.

> 구현 상세: [187-editor-presentation-transaction-and-typed-invalidation-breakdown.md](design/187-editor-presentation-transaction-and-typed-invalidation-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                       | 심각도 | 대응                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------- |
| R1  | classifier가 fill/paint를 layout으로 승격하거나 geometry를 paint로 축소해 성능 회귀 또는 stale layout을 만든다. 관련 경로: `classifyEditorMutation`, `useLayoutPublisher`, `StoreRenderBridge.sync`, Preview `CanonicalNodeRenderer`       |  HIGH  | descriptor 전수 matrix와 mutation 테스트를 G2에서 선행하고, unknown descriptor는 fail-closed 처리한다                           |
| R2  | `finish/cancel` 뒤 pending callback이 실행되어 최종 canonical 값을 stale preview가 덮는다. 현재 경로의 `ColorPickerPanel.handleChangeEnd`, `useFillActions.updateFillPreviewThrottled`, `FillSection.handleColorChangeEnd`가 직접 선례다   |  HIGH  | scheduler owner를 runtime 하나로 제한하고 fake RAF lifecycle/state-machine 테스트를 G1에서 통과시킨다                           |
| R3  | Skia와 Preview가 descriptor merge 순서·revision을 다르게 처리해 drag 중 또는 종료 후 색상이 어긋난다. 관련 경로: `BuilderCanvas`, `SkiaCanvas`/`StoreRenderBridge`, `useIframeMessenger`, Preview `messageHandler`/`CanonicalNodeRenderer` |  HIGH  | 같은 protocol fixture를 양 renderer 테스트가 공유하고 G4 cross-check와 live parity를 production cutover 전 통과시킨다           |
| R4  | session 도중 canonical document 교체·undo·remote/local mutation이 같은 target을 바꿔 stale base commit이 새 값을 덮는다. 관련 경로: `canonicalDocumentStore`, `runCanonicalMutation`, inspector selection/commit adapter                   |  HIGH  | base path snapshot과 indexed conflict check를 G3에서 검증하고 overlap 시 cancel한다                                             |
| R5  | unmount, iframe reload, lost pointer capture에서 session/overlay가 남아 메모리와 표시가 누적된다                                                                                                                                           |  MED   | lifecycle terminal event 전수 테스트, active session count/age DEV assertion, document replace 시 clear                         |
| R6  | `postMessage`가 지연·역순 도착하여 Preview가 이전 revision을 적용한다                                                                                                                                                                      |  MED   | `sessionId + revision` 단조 비교, finish tombstone, stale message fixture                                                       |
| R7  | image/font/resource 변경을 paint로만 처리해 intrinsic size 또는 text metrics 변경을 놓친다                                                                                                                                                 |  MED   | resource descriptor가 실제 metric 영향을 classifier에서 layout으로 승격하도록 inventory에 명시                                  |
| R8  | migration 중 신·구 preview 경로가 동시에 실행되어 이중 publish/commit이 재발한다                                                                                                                                                           |  MED   | property allowlist는 단일 owner만 선택하고 G7 정적 guard 후 legacy API를 삭제한다                                               |
| R9  | 4ms/8.33ms 수치가 측정 환경 차이로 flaky gate가 된다                                                                                                                                                                                       |  MED   | production build, 고정 fixture, 5회 반복 median/p95/p99, attribution counter를 함께 기록하고 dev 수치를 승인 근거로 쓰지 않는다 |

## Gates

| Gate                  | 시점    | 통과 조건                                                                                                                                                                                                                                                          | 실패 시                                                  |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| G0 baseline           | Phase 0 | current와 pilot fixture에서 `N=50/500/5,000`, raw input/frame apply/canonical write/layout publish/projection signature/full rebuild/Preview bytes/RAF duration을 production build로 기록한다. 52ms 경고가 재현되지 않아도 비용 경로와 counter baseline을 보존한다 | baseline 없는 구현 금지                                  |
| G1 lifecycle          | Phase 1 | fake RAF로 begin→100 publish→finish, cancel, pointercancel, Escape, blur, unmount, selection change를 검증한다. frame apply ≤ display frame 수, finish 후 callback 0, finish commit 1, cancel commit 0, no-op revision 0                                           | runtime API/state machine 재설계                         |
| G2 classifier         | Phase 1 | continuous editor descriptor inventory 100% 분류. fills/color/opacity/shadow paint는 layout/structure revision 0, width/height/padding/gap/text metrics는 layout, add/remove/reparent/order는 structure. unknown descriptor RED 테스트                             | 누락 descriptor는 migration 금지                         |
| G3 canonical/conflict | Phase 2 | presentation 중 canonical/history/persist/legacy mutation 0. finish runner 순서와 history 1, undo/redo/reload 왕복. disjoint mutation rebase, same target/path mutation cancel, selection 변경 후 wrong-target write 0                                             | 해당 property old path 유지, 원인 수정 후 재실행         |
| G4 renderer parity    | Phase 3 | 같은 protocol fixture로 Skia/Preview target 결과가 channel 1/255 이하, 종료 후 0. out-of-order/duplicate/finish/cancel/iframe reload에서 stale overlay 0. CSS↔Skia cross-check PASS                                                                                | production cutover 금지                                  |
| G5 paint performance  | Phase 3 | HC10 수치 충족. 세 N tier 모두 layout publish/projection signature/full scene rebuild/canonical Preview document message 0, allocation/work counter가 N에 따라 증가하지 않는다                                                                                     | fan-out 지점 계측 후 Phase 2/3 재설계                    |
| G6 layout/structure   | Phase 4 | layout descriptor는 affected subtree만 재계산하고 비영향 page/node 값·identity 유지. structure는 affected ancestry 외 full document traversal을 만들지 않거나, 불가하면 continuous structure publish를 비지원으로 고정                                             | lane 축소 또는 별도 ADR 분리                             |
| G7 migration/cleanup  | Phase 5 | migrated editor에서 중첩 RAF, `updateSelected*Preview*`, presentation 목적 `layoutVersion++`, legacy-first/canonical-second 0건. static guard가 의도적 RED fixture를 잡는다                                                                                        | legacy 삭제·cutover 보류                                 |
| G8 final              | Phase 6 | targeted Vitest, `pnpm run codex:typecheck`, `pnpm run codex:preflight`, `git diff --check`, populated Builder 120Hz trace, Preview cross-check, console error 0. 사용자-가시 성능 회귀이므로 `docs/CHANGELOG.md` 반영                                             | 실패 bucket의 phase로 복귀, ADR은 Proposed/Accepted 유지 |

## Consequences

### Positive

- color picker drag의 per-frame 비용이 문서 전체 `N`이 아니라 실제 대상 `k`에
  비례하고, paint 변경이 layout/scene rebuild로 승격되지 않는다.
- input control, Zustand legacy mirror, canonical document, Skia, Preview가 각각
  RAF/cancel 규칙을 소유하던 구조가 한 transaction lifecycle로 수렴한다.
- canonical document는 다시 committed authoring state의 SSOT가 되고 transient
  화면값은 명시적인 overlay로 분리된다.
- 동일 runtime을 opacity, gradient stop, stroke, geometry slider 등 다른 continuous
  editor에 재사용할 수 있다.
- invalidation 종류가 타입과 테스트로 고정되어 앞으로의 성능 회귀를 코드 리뷰가
  아니라 CI에서 발견할 수 있다.

### Negative

- canonical과 presentation 두 timeline, session conflict, renderer protocol을 새로
  운영해야 하므로 core runtime의 초기 복잡도가 증가한다.
- fill pilot만 이관한 중간 phase에는 property allowlist와 신·구 경로 경계가 필요하다.
  다만 최종 gate는 영구 이중 경로를 허용하지 않는다.
- Preview에 작은 delta protocol과 node별 overlay store가 추가된다.
- layout/structure lane은 paint보다 검증 범위가 크며, 모든 editor를 한 번에 이관하지
  않는다. classifier inventory와 phase gate를 통과한 editor만 순차 cutover한다.
- canonical commit 시점의 1회 full canonical consumer 갱신은 남는다. 본 ADR의 목표는
  commit 자체를 없애는 것이 아니라 continuous frame fan-out을 제거하는 것이다.
