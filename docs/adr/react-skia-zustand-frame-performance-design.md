# Builder 프레임 성능 개선 실행 설계

- 작성일: 2026-09-05
- 상태: P1 CPU·지연 재검증 완료, GPU 편집 tail 게이트 미종결. P3 완료 재판정 보류, P2 조건부 보류 (2026-09-06).
- 코드 기준: 설계 `b5ad1fbc4`, 착수 `4ae4ff43b`, 작업 중 외부 commit `4d3345e1c` 보존. 성능 A/B는 고정 정적 artifact의 manifest로 식별한다.
- 재검증 기준: `d0f31008d` + GPU reset/context-loss 수리. 새 artifact와 source override SHA는 [재검증 증거](evidence/frame-performance-remeasurement-20260906.md)에 기록한다.
- 입력: [React · Zustand · Skia 프레임 성능 분석자료](../migrations/react-skia-zustand-frame-performance-guide.md)
- 목적: 기존 retained rendering과 presentation 경계를 유지하며, 불필요한 CPU 구축과 상태 전파를 줄인다. on-demand RAF는 실측 조건부로 전환한다.

## 0. 레퍼런스 기반 실행 정정 (2026-09-06)

사용자가 제공한 가이드의 목적은 외부 기술 자료의 방법을 현재 구현에 적용하고 변경 전후를 비교하는 것이다. 자체 계수와 임의 예산의 통과를 최적화 완료의 충분한 근거로 삼지 않는다. 단일 PC의 GPU edit tail 추가 추적은 중단했다. 기존 G5 실패와 측정값은 이력으로 보존하지만, 원인이 확정된 제품 결함으로 해석하거나 그 해소를 모든 후속 방법 비교의 선행 조건으로 삼지 않는다.

| 원문 방법 | 현재 구현과의 차이 / 다음 비교 | 효과를 판단할 근거 |
| --- | --- | --- |
| [CanvasKit Quickstart](https://skia.org/docs/user/modules/quickstart/): 이벤트 기반 화면에서는 draw callback의 자기 재예약을 제거 | P1은 content/plan 준비를 생략하지만 연속 RAF는 유지한다. 다음 구현 후보는 단일 pending RAF와 명시적 invalidation wake다. 기존 ADR-167의 저사양 3% 조건은 공식 권고가 아닌 프로젝트 결정이므로 별도 재검토 대상으로 드러낸다. | 현재 P1을 baseline으로 고정하고 동일 행동의 변경 전후 idle callback/task CPU, 활성 interaction frame interval p50/p95/p99를 비교. wake 누락·animation 종료·readiness는 정확성 조건으로 검증 |
| [Zustand transient updates](https://github.com/pmndrs/zustand/blob/main/README.md#transient-updates-for-often-occurring-state-changes): subscribe/ref로 React 재렌더 없이 최신값 소비 | 기존 presentation 계층을 재사용하고 camera/drag/hover별 남은 domain publication·React commit을 대조. 전 경로 fan-out 0을 이미 달성했다고 가정하지 않는다. | 같은 입력의 React Performance Tracks/Profiler render·commit 및 store notification 전후 비교 |
| [Chrome Performance Insights](https://developer.chrome.com/blog/performance-insights): main/highlight offscreen canvas 분리 후 합성 | 기존 content/overlay retained 경로와 방향이 일치한다. overlay-only 변경이 content 재기록을 유발하는 구체 경로가 있을 때 그 경로만 수정한다. | 같은 hover/selection 행동의 content recording·합성 시간과 브라우저 frame trace 비교 |
| [CanvasKit 공식 SKP benchmark](https://skia.googlesource.com/skia/+/3b13de2073cd/tools/perf-canvaskit-puppeteer/render-skp.html): draw, draw+flush, 전체 frame interval 분리 | GPU query p95 하나를 중심으로 한 추적에서 세 시간축의 전후 비교로 복귀한다. GPU query는 보조 진단이다. | 원문 측정 경계와 Builder 대응 경계를 기록하고 CPU 제출과 전체 frame interval을 함께 비교. 일반 Builder의 frame interval을 순수 GPU 시간으로 단정하지 않는다. |

실행 순서는 **원문 방법·적용 조건 확인 → 현재 코드와 차이 명시 → 현재 P1 기준값 고정 → 방법 하나 적용 → 같은 조건에서 변경 전후 비교 → 채택/기각과 한계 기록**이다. 이미 반영된 방법은 중복 구현하지 않는다. 공식 문서가 Builder 전용 수치 예산을 제공하는 것은 아니므로 프로젝트 예산을 공식 기준으로 표현하지 않는다. 외부 사례의 절대 ms를 Builder와 직접 비교하지 않으며, 단일 장비 A/B는 해당 환경의 상대 효과로 한정한다.

회귀 테스트는 구현 정확성의 근거로 유지한다. 성능 효과는 브라우저 원시 trace와 출처가 명시된 측정 방법에 연결한다. 자체 계수는 귀속을 보조하며 테스트 통과 횟수를 성능 개선의 증거로 사용하지 않는다. 이번 정정에서는 scheduler 제품 코드를 변경하지 않았고, 기존 ADR의 상태나 역사적 게이트 결과도 승격하지 않았다.

## 1. 결정과 범위

첫 작업은 **측정과 입력 의존성 확정(P0)** 이다. 다음으로 이득이 확인된 content/plan 파생물 재사용(P1)을 수행한다. 상시 RAF 종료(P2)는 ADR-167 재개 조건과 wake 누락 검증을 통과했을 때만 진행한다. P1만으로 효과가 충분하면 P2 없이 종결할 수 있다.

이 문서는 실행 설계이며 새 ADR의 Accepted 결정이나 기존 ADR의 상태 변경을 의미하지 않는다. 분석자료의 일반 권고를 그대로 실행 승인으로 해석하지 않는다.

| 관련 결정/계획                                                                            | 현재 확인한 상태와 이 설계의 경계                                                                                                                                          |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [상위 성능 계획 §4-1](../explanation/research/BUILDER_PERF_BASELINE_2026-09.md)           | Track A(cold first-frame), Track B(Navigator 선택), Track C(edit 등) 순서를 유지. 본 문서는 공통 프레임 기반의 준비와 조건부 실행을 구체화하며 우선순위를 대체하지 않는다. |
| [ADR-167](../adr/completed/167-on-demand-frame-loop.md)                                   | Deprecated. 당시 idle 6.7ms/s, 코어 0.67%로 기각. 저사양 실측 idle 코어 3% 이상이라는 재개 조건을 P2 입구에 적용한다.                                                      |
| [ADR-187](../adr/completed/187-editor-presentation-transaction-and-typed-invalidation.md) | Implemented. presentation transaction, typed invalidation, commit handoff를 재사용한다. 새 domain/presentation store를 병렬로 만들지 않는다.                               |
| [ADR-203](../adr/completed/203-selection-fanout-layer-tree-virtualized-rows.md)           | Implemented 2026-09-06. LayerTree 가상화와 Properties 조건부 구독 변경은 해당 ADR 소관. 본 문서에서 패널 전체 구독 재설계를 시작하지 않는다.                               |

즉시 범위는 Skia 프레임 비용 계측, 캐시 입력 계약, wake 경계 조사다. schema/DB 변경, canonical migration 전수 정리, Worker/OffscreenCanvas, CanvasKit 교체, 시각 스타일 변경, Monitor 패널 신설은 제외한다. cold font/paragraph prewarm은 Track A에서 처리하고 본 측정에는 별도 cold 지표로 남긴다.

## 2. 코드 대조 결과

아래 경로는 모두 `apps/builder/src/` 기준이다. 행 번호보다 심볼을 기준으로 재확인한다. 이 표는 설계 시점의 동작이다. 실제 반영·실측 판정은 §9와 evidence를 따른다.

| 코드 근거                                                                                                                                                  | 현재 동작                                                                                                           | 설계에 반영할 사항                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`SkiaCanvas.tsx`](../../apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx) `renderFrameCore`                                                  | 다음 RAF 예약 → 상태 폴링/animation → `buildSkiaFrameContent` → `buildFrameRenderPlan` → `renderer.render`          | idle 판정 전 CPU 작업이 있다. 호출 횟수와 실제 cache miss를 분리해 측정한다.                                               |
| [`SkiaRenderer.ts`](../../apps/builder/src/builder/workspace/canvas/skia/SkiaRenderer.ts) `classifyFrame`, `renderDualSurface`                             | renderer 안에서 idle/present/camera-only/content/full 분류. 이후 animation override가 idle/present를 content로 승격 | early-out은 animation tick을 누락하면 안 된다. 분류를 단순 복제하거나 두 번 호출하지 않는다.                               |
| 같은 파일 `classifyFrame`, `scheduleCleanupRender`                                                                                                         | 분류가 cleanup 상태를 소비하고 camera-only에서 200ms timer를 예약. timer는 `needsCleanupRender`만 설정              | 현 classifier는 순수 함수가 아니다. 재사용 여부 조회와 상태 소비를 분리해야 한다. P2에서는 timer 완료가 RAF를 깨워야 한다. |
| [`skiaFramePipeline.ts`](../../apps/builder/src/builder/workspace/canvas/skia/skiaFramePipeline.ts) `buildViaCommandStream`, `buildSharedSceneDerivedData` | command stream 캐시와 별개로 root 수집/배열 조합이 있고 shared scene에는 camera도 포함                              | content 결과 전체를 camera 독립 객체로 취급하지 않는다. 정적 파생물과 프레임 뷰를 분리한다.                                |
| [`ViewportController.ts`](../../apps/builder/src/builder/workspace/canvas/viewport/ViewportController.ts) `notifyUpdateListeners`, `addUpdateListener`     | mutable camera 갱신과 listener 알림 경계가 존재                                                                     | controller의 직접 알림을 wake 입력으로 사용한다. React viewport publication을 다시 경유하지 않는다.                        |
| [`viewportPresentation.ts`](../../apps/builder/src/builder/workspace/canvas/viewport/viewportPresentation.ts) `useViewportPresentationZoom`                | React용 external-store zoom 구독이 존재                                                                             | 전체 React commit 0을 요구하지 않는다. 명시된 zoom 표시 소비자를 제외한 fan-out을 줄인다.                                  |
| [`SkiaCanvas.tsx`](../../apps/builder/src/builder/workspace/canvas/skia/SkiaCanvas.tsx) `publishCanvasFramePresentation` 호출부                            | Skia 제출 직전에 같은 camera/page snapshot을 DOM overlay에 발행                                                     | 별도 overlay RAF를 만들지 않고 snapshot 정합성을 보존한다.                                                                 |
| [`canvasLifecycle.ts`](../../apps/builder/src/builder/workspace/canvas/stores/canvasLifecycle.ts) `acknowledgePresentedFrame`                              | project 일치 및 target 이상 document revision만 ready. SkiaCanvas는 실제 `didPresent` 후 호출                       | 캐시 hit, RAF 실행, timer 완료는 readiness 근거가 아니다. target 변경도 프레임 요청 소스다.                                |
| [`perfMarks.ts`](../../apps/builder/src/builder/utils/perfMarks.ts) `observe`, `setUserTiming`                                                             | User Timing 기본 off, 내부 기록 유지                                                                                | 과거 baseline의 User Timing 비용을 현재 값으로 재사용하지 않는다. 이미 반영된 토글을 새 과제로 만들지 않는다.              |
| [`gpuTimer.ts`](../../apps/builder/src/builder/workspace/canvas/skia/gpuTimer.ts), `SkiaRenderer` constructor                                              | GPU timer 생성은 development 조건 내부. non-idle render에서 poll                                                    | 현재 production GPU percentile 제공을 가정하지 않는다. P0에서 명시적 계측 빌드/수집 경로를 준비한다.                       |

## 3. 유지해야 할 계약

1. Canonical document는 저장 SSOT다. transient pointer/drag/paint를 RAF마다 canonical/Zustand에 기록하지 않는다. 최종 semantic commit은 기존 mutation runner, history, DB, Preview 순서를 따른다.
2. `SkiaRenderer`는 Zustand를 import하지 않는다. scheduler 요청·resource 갱신 알림은 소유자에게 주입한 callback으로 전달한다.
3. 한 Canvas 인스턴스의 application render RAF는 최대 하나만 pending이다. 한 callback의 main presentation은 최대 한 번이다. content/standby surface의 내부 flush 횟수와 main presentation 횟수를 혼동하지 않는다.
4. Canvas와 DOM overlay/hit testing은 같은 frame snapshot을 사용한다. hit bounds나 page title/workflow geometry를 갱신해야 하는 프레임을 GPU content cache hit만으로 건너뛰지 않는다.
5. matching project와 target 이상 document revision의 **성공한 main surface submission**만 ready로 인정한다. scanout 완료를 보장한다는 의미는 아니다. 로딩 중 Header·패널·Action Bar 노출과 100% 처리 조건을 변경하지 않고 패널 mount/geometry를 보존한다.
6. context loss, unmount, project 교체 이후 callback이 이전 renderer를 사용하면 안 된다. font/image를 참조하는 picture를 먼저 폐기한 뒤 해당 WASM resource를 해제한다.
7. D3 catalog/theme/token과 Preview/Publish 정책은 유지한다. scheduling 변경도 결과 픽셀, selection/hover, text editing, clipping의 정합성 검증이 필요하다.

## 4. 프레임 준비와 캐시 설계 — P1

### 4.1 소유권

`SkiaCanvas`가 frame coordinator를 소유한다. 신규 순수 모듈 후보는 `canvas/skia/framePreparation.ts`, scheduler 후보는 `canvas/skia/frameScheduler.ts`다. 이 이름들은 제안이며 현재 존재하는 API가 아니다.

```text
semantic commit / presentation 변경 / resource 완료
  → 기존 bridge가 authoritative revision과 registry를 먼저 갱신
  → coordinator가 최신 입력과 dirty reason을 수집
  → animation 진행 및 최종 정리 필요성 확인
  → frame preparation 결정
  → 필요한 CPU 파생물 구축 + 같은 snapshot의 overlay/hit bounds 갱신
  → renderer main presentation
  → 성공한 matching frame만 readiness acknowledgment
```

dirty reason은 예약과 원인 추적용이다. cache 유효성의 정본은 기존 revision/identity다. reason만 믿고 revision 검증을 생략하거나 domain에 새로운 revision mirror를 매 프레임 쓰지 않는다.

### 4.2 입력과 재사용 단위

| 파생물                            | 필요한 입력 축                                                                                                               | 재사용/승격 규칙                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| command stream/root·bounds 파생물 | document/projection, registry, layout publication, visible root membership, page/frame position, edit mode                   | 모두 불변이면 기존 cache 재사용. 페이지 경계 진입은 camera-only라도 visible membership 변경으로 재구축           |
| frame의 shared scene view         | 위 파생물 + 최신 camera/page presentation snapshot                                                                           | 정적 Map은 공유하되 camera 좌표를 이전 frame 값으로 유지하지 않음                                                |
| retained content picture/surface  | content 입력 + theme/font/image generation, page presentation, sibling animation, damage 정보                                | 기존 renderer의 damage/coverage/zoom 정책을 정본으로 사용. camera-only에도 coverage/zoom 초과 시 content 승격    |
| drag picture와 transform          | drag target topology, resource generation, delta revision                                                                    | target 변경은 기존 topology 무효화, delta만 변하면 retained translate. sibling animation은 content snapshot 갱신 |
| overlay/plan/hit geometry         | selection/edit context, hover, workflow graph, AI, guides/drop indicator, camera, viewport/DPR, minimap, page/frame geometry | 의존 축이 바뀐 부분만 재구축. 초기 P1에서는 plan 전체 재구축을 유지해도 되며 효과가 입증된 부분부터 분리         |

입력 축의 실제 getter/producer/소비자 목록은 P0 산출물에서 고정한다. `documentRevision` 하나로 paint/selection/camera를 모두 content miss로 만들지 않고, 같은 revision에서 resource나 presentation이 바뀌는 경우도 별도 반영한다. 키를 만들기 위한 전체 DFS, JSON serialization, Map 복사는 금지한다.

`ContentBuildResult`를 통째로 영구 보관하지 않는다. 내부 render closure가 mutable 입력을 참조하는지와 camera 포함 여부를 먼저 확인한다. CPU 참조 캐시는 Canvas 인스턴스 수명 안에서 한 세대만 소유하고 project/renderer/resource 교체 시 명시적으로 폐기한다.

### 4.3 안전한 분류 순서

P1 초기에는 연속 RAF를 유지한다. 먼저 동일 입력에서 content의 정적 파생물 재구축을 생략하고, 이득과 정합성을 확인한 뒤 완전 idle일 때만 content/plan 구축을 생략한다.

분류 사전 조회가 필요하면 renderer 내부에 **순수 preparation 조회**를 추출한다. cleanup flag 소비, animation tick, timer 재예약은 실행 단계에서 각각 한 번만 수행한다. renderer와 coordinator에 coverage/zoom 임계값을 이중 정의하지 않는다. renderer의 후속 승격에 content 입력이 필요하면 구축 경로로 돌아가되 main submission은 한 번만 수행한다.

`buildSkiaFrameContent() === null`은 현재 layout publication 전 상태도 포함한다. 이를 성공한 빈 문서로 캐시하지 않는다. layout/resource publication이 오면 재시도하며 null 반복으로 화면 clear/flush를 계속하지 않는다. 정상 빈 프로젝트는 실제 생산되는 page/body shell의 렌더 경로로 테스트한다. `clearFrame()`만으로 readiness를 승인하지 않는다.

## 5. 프레임 예약 설계 — 조건부 P2

### 5.1 상태 기계

coordinator의 로컬 상태는 `pendingRaf`, `dirtyReasons`, `generation`, `suspended`, `disposed`다. 진행 중 animation의 존재 여부는 기존 animation 소유자에게 조회하며 Zustand mirror를 추가하지 않는다.

- `invalidate(reason)`: dirty를 합치고, 활성 surface가 있으며 pending RAF가 없을 때 하나만 예약한다.
- callback 진입: pending을 비우고 처리할 dirty 집합을 분리한다. 작업 중 새 invalidation은 다음 집합에 남는다.
- callback 종료: 새 dirty 또는 실제 진행 중 animation이 있을 때만 다음 RAF를 예약한다. animation 종료 상태를 그리는 마지막 cleanup frame을 보장한다.
- hidden/context loss: pending RAF 취소, dirty는 유지. visible/context 복구 이벤트가 full invalidation을 요청한다. 경과시간만으로 성공 처리하지 않는다.
- unmount/project surface 교체: generation 증가, RAF/timer 취소, subscription 해제. 이전 generation callback은 아무 작업도 하지 않는다.

일반 이벤트에 반복 polling timer를 추가하지 않는다. minimap 숨김과 renderer 품질 정리처럼 기존 시간 기반 동작은 각각 일회성 timer가 `invalidate`를 호출한다. readiness target 미충족만으로 무한 RAF를 돌리지 않고 부족한 document/layout/resource의 publication을 기다린다.

### 5.2 wake 배선 표

아래는 현재 확인한 경계와 P0에서 닫아야 할 항목이다. `recordInvalidation`은 관측 함수이며, 프레임 내부의 기록 호출을 wake source로 세지 않는다. 과거 ADR-167의 16/9 개수를 현재 코드의 고정값으로 복사하지 않는다.

| 변경                                           | 배선 지점/책임                                                                                                                 | dirty/후속 프레임                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| pan/zoom/programmatic camera                   | `ViewportController.addUpdateListener` 직접 구독                                                                               | camera, overlay. 동일 frame 최신값 사용                                 |
| canonical/projection/layout                    | `SkiaCanvas` rendererInput effect 및 `StoreRenderBridge.onDidSync` 완료 뒤. fullTreeLayout publication 독립 경로는 P0에서 확인 | content/geometry. commit handoff·damage 적용 뒤 wake                    |
| selection/editing/AI/workflow                  | `invalidationPacket` effect에서 ref 교체 후                                                                                    | 해당 overlay/content 축. AI 시작은 packet, 진행은 active animation 조건 |
| page drag / 수동 guide                         | 기존 `subscribePagePositionPresentation`, `subscribePageGuideRevision`                                                         | page presentation은 content+overlay, guide는 overlay                    |
| element drag / sibling offset                  | 현재 revision을 polling하는 offset setter의 생산자 경계에 알림 추가                                                            | delta present, topology/content 변경, 종료 cleanup                      |
| hover / drop indicator / snap·measure guide    | 현재 mutable ref writer와 presentation 발행자를 P0에서 열거하여 직접 알림 연결                                                 | overlay. pointer가 멈춘 뒤에도 마지막 상태 반영                         |
| transition / animation 시작                    | `transitionManager`, `animationEngine`의 시작·취소 진입점 알림 추가 필요                                                       | active 동안 연속, 종료·취소 시 마지막 frame                             |
| image / font / theme                           | `registerImageLoadCallback`, font ready/layout invalidation, 기존 theme watcher                                                | resource/content. 실패와 eviction도 cache 의존성 확인                   |
| minimap 1500ms / cleanup 200ms                 | SkiaCanvas timer / renderer에 주입한 callback                                                                                  | overlay / full quality. timer 완료 후 한 번 wake                        |
| page position stale-frame 보정                 | `setPagePosStaleFrames` 생산자와 `tickPagePosStaleFrames` 잔여 상태                                                            | 기존 3-frame 보정 소진까지 예약. 즉시 제거하지 않음                     |
| resize / DPR / visible 복귀                    | 기존 ResizeObserver/DPR 경로 + visibility listener                                                                             | surface/geometry/full. 0 크기에서는 resize 복구 대기                    |
| bootstrap / presentation target / context 복구 | lifecycle target ref 갱신 effect, surface 준비/복구 완료                                                                       | full. target이 cache된 화면과 같아도 실제 제출 요청                     |
| editor presentation preview / commit / cancel  | ADR-187 Skia paint/layout bridge가 registry/cache 적용을 끝내는 경계                                                           | typed invalidation과 handoff 유지, 취소 결과도 제출                     |

**전환 조건**: 모든 행에 producer 파일·심볼·등록 해제·wake 테스트를 연결해야 한다. 한 행이라도 미확정이면 P2 production 활성화는 불가하다. P1의 연속 RAF와 같은 입력 trace로 비교해 누락을 검출한다.

### 5.3 GPU query 수거

현재 timer는 다음 non-idle render에서 결과를 수거하므로 RAF 정지 후 마지막 query가 남을 수 있다. 계측 세션에서만 별도 비차단 drain을 허용한다. drain은 scene/plan 구축이나 surface 제출을 호출하지 않으며 in-flight가 소진되면 종료한다. disjoint/미지원/context loss는 수치를 0으로 쓰지 않고 `invalid`/`unsupported`로 기록한다. drain 제한 내 미회수 sample은 누락 수로 보고한다.

## 6. 단계별 작업과 검증 게이트

제안 성능 예산은 아래와 같다. 현재 달성 수치가 아니며, P0에서 fixture·실행 환경·baseline을 고정한 뒤 비교한다. baseline이 잡음 수준이면 비율 개선을 주장하지 않고 해당 최적화를 보류한다.

| 단계                 | 작업 파일/범위                                                                                                              | 산출물과 종료 조건                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| P0 — 지금 착수       | `apps/builder/scripts/perf-baseline.mjs`, `builder/utils/perfMarks.ts`, 필요 시 `skia/SkiaRenderer.ts`·`gpuTimer.ts` 계측만 | 새 production opt-in 계측 경로, 아래 evidence, wake producer 목록. rendering 정책 변경 없음                                 |
| P1a — CPU 재사용     | `skia/skiaFramePipeline.ts`, 인접 cache/helper 및 테스트                                                                    | 정적 파생물 키·소유권 확정. 같은 입력 반복 시 구축 횟수 0, 변경 축별 재구축 및 stale 방지 테스트                            |
| P1b — idle 준비 생략 | `skia/SkiaCanvas.tsx`, `SkiaRenderer.ts`, 제안 `framePreparation.ts`, `skiaFramePlan.ts`                                    | animation/cleanup을 포함한 판정 순서 고정. settled idle 10초 content/plan build·main submission 0, RAF polling은 허용       |
| P2a — 조건 판정/배선 | 제안 `frameScheduler.ts`와 위 wake 생산자, `wasm-bindings/featureFlags.ts`                                                  | **P1 후에도 저사양 실측 idle ≥30ms/s(코어 3%)**이고 ADR-167 재개 판단을 문서화한 경우 진행. pending ≤1, 모든 wake 행 테스트 |
| P2b — 활성화         | `SkiaCanvas.tsx` 연결 및 lifecycle/복구 테스트                                                                              | settled idle 10초 render RAF 0, 모든 wake 다음 가능한 RAF에서 처리, stale 0. CPU/GPU/메모리 게이트 통과                     |
| P3 — 효과 종결       | 측정 evidence와 변경된 계약 문서                                                                                            | P1 효과와 P2 실행/보류 사유를 각각 기록. 측정상 잔여 병목이 있으면 별도 좁은 후속 작업으로 분리                             |

첫 구현 단위는 P0 하나로 제한한다. content cache 재사용이나 scheduler 전환을 계측 변경에 섞지 않는다. Track A/B와 공통 파일 수정은 순서를 조정하며 성능 측정은 직렬로 실행한다.

### 6.1 측정 프로토콜

- 고정 fixture: 60/600/5,000 노드, reusable ref가 많은 문서, text/font가 많은 문서. fixture checksum과 실제 resolved/render node 수를 함께 남긴다.
- 환경: HEAD, 빌드 종류, 브라우저/GPU, display Hz, viewport/DPR/canvas device size, 패널 열림 상태, foreground 여부, throttle 값을 기록한다. 60Hz의 16.7ms와 120Hz의 8.3ms 예산을 구분한다.
- warm interaction: 같은 조건 A/B를 번갈아 5회, 각 시나리오 10초. cold entry는 새 컨텍스트 10회로 따로 기록하고 max/분포를 제시한다. 작은 cold 표본으로 p99 개선을 주장하지 않는다.
- 시나리오: idle, pan, zoom, page/element drag, hover/selection, Inspector preview→commit/cancel, page switch, async image/font 완료, animation 종료, project entry. cold bootstrap 총시간과 첫 제출 callback 시간을 분리한다.
- 수집: `render.frame`, content/plan/draw p50/p95/p99, CPU ms/s, builder render RAF 및 main submission 수, cache hit/miss/reason, input→다음 presentation 지연, domain mutation 및 React commit 수, JS/WASM resource 증가, GPU raw sample.
- render RAF 간격과 display cadence는 별개다. on-demand의 idle 제출 간격을 dropped frame으로 계산하지 않는다. 일정 시간 display sampling을 켠 진단 run과 scheduler wake를 검증하는 계측 최소화 run을 분리한다.
- production GPU 계측은 기본 배포 설정에 켜지지 않는 명시적 계측 옵션으로 준비한다. Canvas flag가 필요하면 기존 `featureFlags.ts` registry에만 정의한다. React Profiler 수치는 지원하는 profiling 빌드에서 보조 수집하고 일반 production frame 수치와 혼합하지 않는다.

evidence 경로: `docs/migrations/evidence/frame-performance/`. 최초 [baseline](../migrations/evidence/frame-performance/baseline.md), [입력·자원 경계](../migrations/evidence/frame-performance/wake-sources.md), [P1 반복 실측](../migrations/evidence/frame-performance/p1-measurements.md), [종결 검증](../migrations/evidence/frame-performance/closure.md)을 구분한다. 전체 호출·누적 시간·p99, GPU/RAF/input 원시 표본을 보존한다. 600 fixture 5쌍으로 상대 효과를 판정하고 다른 규모·text/ref 문서는 정합성 smoke 대조로 한정한다.

기존 하니스로 가능한 초기 기준선 명령 예시(기본은 dev 서버이며 production 판정을 대신하지 않음):

```bash
pnpm perf:baseline -- --lane frame --headed --seed-count 600 --duration-ms 10000 --classes idle,pan,zoom,select,edit
```

기존 runner는 인증 상태와 테스트 프로젝트 생성 경로를 사용한다. 격리된 측정용 프로젝트로 실행하고 측정 중 다른 탭·테스트 작업으로 foreground를 빼앗지 않는다. 확장 CLI는 `--frame-capture`, `--fixed-inputs`, `--fixture-kind`, `--cold-entries`, `--build-id`, `--cpu-time-domain`을 제공한다. 실제 pointer/자원 수명 검증은 `apps/builder/scripts/frame-performance-exercise.mjs`로 분리한다.

### 6.2 합격 기준

| 게이트              | 기준                                                                                                                                                               | 실패 시                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| G0 측정 유효성      | 환경/fixture 동일, sample 및 호출 수 존재, instrumentation on/off 비용 기록, GPU 미지원 명시                                                                       | 효과 판정 보류. 기록 누락을 0으로 처리하지 않음           |
| G1 CPU 효과         | 비용이 확인된 대상의 build p95 또는 idle CPU ms/s ≥20% 감소. 상호작용 input→presentation p95 회귀 ≤max(1ms, baseline의 5%)                                         | 더 좁은 P1만 유지하거나 최적화 철회                       |
| G2 scheduler 정확성 | burst invalidation→RAF 1회, callback 중 invalidation→후속 1회, 모든 wake 행 통과, animation 마지막 frame 보장                                                      | P2 비활성화, 원인 경계 수정                               |
| G3 readiness/복구   | A→B 전환 중 A 제출 거부, 낮은 revision 거부, target 재설정 후 재제출, context loss/restore 및 unmount 후 callback 무효                                             | 활성화 금지. timeout 성공 fallback 금지                   |
| G4 시각·상태 계약   | Canvas/Preview 동일 fixture parity 기존 예산 유지, overlay/hit bounds 일치, drop/commit history 및 Undo/Redo, refresh 후 canonical 일치                            | 관련 캐시/분류 변경 원복                                  |
| G5 GPU·메모리       | 지원 장비 GPU p95 회귀 ≤max(0.5ms, baseline의 5%), query 누락 보고. 20회 load/drag/restore 반복 후 살아 있는 surface/picture/query/listener가 baseline 범위로 복귀 | GPU/자원 회귀 원인 제거 전 종결 금지                      |
| G6 fan-out          | pointer/drag delta만으로 canonical mutation 0. 프레임 통계의 RAF별 Zustand write 0. 허용된 zoom 표시 등 외 React commit 증가 없음                                  | producer/구독 경계 수정. 무조건 memo 추가로 대체하지 않음 |

G1 상대 개선은 5회 중앙값으로 판정하고 각 run과 최악 run도 보존한다. 분산이 개선폭보다 크면 재측정한다. frame budget 초과가 기존에도 있으면 이 작업이 전체 60/120fps를 달성했다고 쓰지 않고 잔여 원인을 남긴다. GPU 미지원 환경에서는 G5 GPU 축을 미검증으로 남기고 지원 장비에서 활성화 검증을 완료한다.

### 6.3 테스트 구현 목록

- 순수 unit: fake RAF로 중복 예약, reentrant invalidation, suspend/resume, generation 폐기, dispose를 검증한다. 새 모듈의 실행 결과를 단언하며 소스 문자열 등장 횟수만으로 대체하지 않는다.
- cache unit: 입력 축 하나씩 변경하는 양성 대조와 무관한 축의 음성 대조. same-count node 교체, image 완료, font generation, visible page 진입, layout publication 전 null을 포함한다.
- renderer 통합: camera coverage 승격, 200ms cleanup, animation tick 한 번, 마지막 animation 정리, content/overlay/main submission 계수, single-surface fallback.
- lifecycle 통합: 기존 `canvasLifecycle.test.ts` 확장과 실제 `didPresent` 연결. 빈 project shell, hidden 중 hydration, A→B→A, context restore, 같은 target에서 renderer 재생성.
- foreground browser: page/element drag와 guide·workflow·AI, text editing, delayed image/font, minimap 숨김, 화면 밖 페이지로 pan, resize/DPR 변경을 수행한다. dirty producer의 wake 연결을 하나씩 끊는 mutation 대조에서 해당 테스트가 실패해야 한다.
- 구현 완료 시 `cross-check`로 catalog/spec→Canvas와 Preview/Publish 결과를 대조하고 focused Vitest, typecheck, 가능한 `codex:preflight`를 실행한다. 문서 작성 단계에서는 이 구현 검증을 통과했다고 기록하지 않는다.

## 7. 대안과 롤백

| 대안                         | 선택 판단                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| 현행 연속 RAF 유지           | P0 비용이 작으면 유효한 종결. ADR-167의 기존 판정을 존중                                    |
| 연속 RAF + CPU 파생물 재사용 | 우선 선택(P1). wake 누락 위험을 추가하기 전에 비용 절감 확인                                |
| 완전 on-demand               | P1 뒤에도 재개 조건을 충족할 때만 P2. wake 인벤토리와 callback 수명 검증 비용을 수용        |
| 1Hz heartbeat fallback       | ADR-167의 역사적 대안. 이 설계에서는 새 기본 정책으로 채택하지 않음. wake 누락 시 P1로 복귀 |
| Worker/OffscreenCanvas       | P1/P2 뒤에도 main-thread CPU가 지배적이고 전송 비용 A/B가 유리할 때 별도 설계               |

P2 전환 flag는 기존 `wasm-bindings/featureFlags.ts`에 등록하고 연속 RAF 경로를 검증 기간에 유지한다. 동시에 두 scheduler를 실행하지 않는다. wake 누락·readiness 회귀 시 flag로 P1 경로에 복귀한다. P1 cache 결함은 해당 재사용 분기만 끄거나 해당 커밋을 원복하며 lifecycle acknowledgment를 우회하지 않는다. 검증 종료 후 소비자 없는 flag와 중복 실행 경로를 정리한다.

## 8. 착수 체크리스트와 인수인계

- [x] P0: 현재 HEAD/dirty scope 확인, Track A/B와 측정 시간 조정. `4ae4ff43b` main clean에서 착수, 정식 idle 5쌍 직렬 측정.
- [x] P0: production opt-in 계측과 baseline, 입력·자원 경계 확보. dev perfMarks on/off 비용은 변동성으로 별도 효과 주장 없음.
- [x] P0 종료: 600 fixture 5쌍 상대 효과 baseline 고정. 60/5,000/text/ref는 동일 snapshot smoke로 한정하며 전체 React/저사양 실측은 미검증으로 명시.
- [ ] P1 검증 종결: 한 세대 children Map 재사용과 보수적 idle 준비 생략은 반영. CPU·지연은 통과했으나 GPU edit의 10초/30초 판정이 달라 G5 종결 보류.
- [x] P2 입구: 실제 저사양 재개 근거 미확보로 보류. 현재 장비나 CPU throttle을 저사양 실측으로 대체하지 않음.
- [x] P2 실행: 이번에는 미적용. scheduler/wake mutation 게이트는 재개 시 적용.
- [ ] P3 최종 종결: 효과·미측정·보류·롤백·검증 문서 동기화는 완료. GPU edit G5 미해결로 전체 종결은 보류하며 이번 커밋/푸시는 수행하지 않음.

설계문서 작성 자체로 기존 ADR 상태를 변경하지 않는다. 실제 실행은 §9로 인수인계한다. P0 첫 단위 뒤 production 기준선을 고정하고 P1 스파이크를 적용했으며, 추가 fixture·자원 검증은 활성화 판정 전에 후속 보강했다. 이는 최초의 P0 전축 종료→P1 순서보다 범위를 나눈 실행이며, 미실측 축을 통과로 간주하지 않는다.

## 9. 실행 결과 — 2026-09-06

> 계측 정정 이후 재검증 결과 G1은 통과했으나 GPU edit의 G5는 미종결이다. 아래 최초 실행 기록의 41.3%와 GPU p95 통과 판정은 철회했다. GPU query 없는 원본 artifact 재검증은 CPU 32.955→21.094ms/s(36.0%)로 P1 묶음 전체 효과만 확인했다. 최신 종결 여부는 [GPU 재측정 인수인계](evidence/frame-performance-gpu-remeasure-handoff.md)와 후속 결과를 따른다.

### 적용한 P1

- `FrameContentCache`: filtered children·실제/synthetic node Map identity와 registry/layout revision으로 CPU children Map 한 세대를 재사용한다. 같은 개수 node 교체도 무효화하며 effect cleanup에서 참조를 해제한다. root/command stream·picture/font/image를 새 전역 cache에 보관하지 않는다.
- `SkiaRenderer.canReuseFramePreparation`: 상태를 소비하지 않는 사전 조회다. 기존 polling 뒤 모든 입력이 같고 content surface/snapshot이 유효한 경우에만 content/plan 구축을 생략한다. animation/최종 정리·damage·minimap·readiness target·context 경계는 유지한다. camera가 변하면 기존 준비 경로로 진입한다.
- `compositionEngineWasm.ts`: production에서 동적 JS 경로가 404여서 95% 부팅에 머무는 기존 blocker를 발견했다. literal import의 `@vite-ignore`를 제거해 Vite가 JS/WASM을 번들에 포함하도록 수리했다. timeout이나 readiness 우회는 추가하지 않았다. 이 수정은 A/B 양쪽 artifact에 적용했다.
- 계측: 배포 기본 off의 서로 독립적인 capture/GPU timer opt-in, 실제 main flush와 readiness acknowledgment, GPU nonblocking raw/invalid/pending, canonical publication·cache·resource 계수. 프레임 통계를 Zustand에 쓰지 않는다.

### 효과와 적용 경계

GPU 계수 수리 후 동일 소스 3빌드(재사용 off / Map only / P1 전체) × GPU off/on으로 각 5회 비교했다. [재검증 결과와 각 run](evidence/frame-performance-remeasurement-20260906.md)이 최신 정본이다. GPU off에서도 capture/perfMarks/recorder는 유지하므로 모든 계측을 끈 출하 경로의 비용이라고 표현하지 않는다.

600요소 production에서 renderer main-thread task CPU(`threadTicks`) 중앙값은 **31.376→20.639ms/s (34.2% 감소)**다. Map only는 23.407ms/s로 **25.4% 감소**, Map 재사용을 유지한 preparation-skip 추가 효과는 **11.8% 감소**다. 서로 다른 기준의 비율이므로 합산하지 않는다. P1 전체의 유효 settled idle 10초에서 content/plan/main submission은 모두 0이며 application RAF는 계속된다.

GPU off pan input→main flush p95의 5회 중앙값은 **17.9→17.5ms**, zoom은 **28.4→28.8ms**로 기존 회귀 예산 안이다. GPU on의 pan p95는 **1.862→1.752ms**, zoom은 **1.900→2.112ms**로 +0.5ms 예산 안이다. 10초 edit GPU p95는 **0.327→0.944ms**로 +0.617ms여서 예산을 초과했다. 약 50개 표본에서 tail 변동성이 커 같은 사전 입력과 동일 빌드의 edit만 30초로 늘린 독립 5쌍을 추가했다. 이때는 **0.309→0.471ms(+0.161ms)**로 통과했지만, 원래 10초 실패를 덮지 않는다. 두 구간의 판정이 달라 **G5/P3는 미종결**로 유지한다. 다음은 query/CPU 제출/GC 이벤트를 표본별로 연결하는 원인 분석이며, 근거 없이 준비 생략이나 회귀 예산을 바꾸지 않는다.

이전 원본 artifact의 GPU query 없는 **36.0%**는 그 artifact의 P1 묶음 결과로 유효하다. 현재 34.2%와 다른 코드/계측 조건의 숫자다. 최초 **41.3%와 GPU p95 통과 판정은 철회**했고 현재 효과나 GPU 계측 비용으로 재사용하지 않는다.

P2는 **조건부 보류**한다. 실제 저사양 기기에서 P1 이후 renderer idle CPU ≥30ms/s라는 근거가 없으며 현재 M4 Pro, CDP 전체 task나 CPU throttle을 대신 쓰지 않는다. 별도 scheduler·wake setter·heartbeat·활성화 flag는 추가하지 않는다. 재개 시 §5/G2 전체를 검증한다.

### 검증 범위와 게이트

- GPU timer reset/context-loss 실패를 회귀 테스트로 재현하고, 이전 창 query의 invalid 계수 유입을 수리했다. 관련 cache/preparation/readiness/presentation **6 files / 28 tests PASS**; 하니스 **13 tests PASS**.
- `gate:visual-parity` **101 tests PASS** (3 계약 + 98 browser). 이는 기존 smoke suite 통과이며 모든 catalog/텍스트/이미지 fixture가 픽셀 동일하다는 뜻은 아니다.
- `codex:preflight` **PASS**. 최종 scoped format/diff와 source SHA 일치도 확인했다.
- 현재 600요소 반복은 모든 측정 구간 visible, checksum 동일, 측정 구간 오류 0이다. 부팅 때 공통 Pretendard 정적 URL 8건의 404는 별도로 보존한다. 전체 runtime 오류 0으로 표현하지 않는다.
- 기존 60/5,000/text/ref smoke, cold 10회, 실제 drag/Undo/Redo/refresh·presentation·복원·자원 수명 결과는 최초 실행 기록이다. 현재 빌드에서도 실제 drag/Undo/context restore 20회, 동일 Canvas 영역 PNG 바이트 일치, preview/cancel/commit/Undo/Redo/refresh, 지연 이미지·font sync·resize·unmount를 확인했다. surface/snapshot 각 1, picture 147, listener 547, DOM nodes 2589로 일정했다. 신규 외부 폰트 다운로드·저사양·React profiling build·전체 JS heap 누수 부재·P2 wake mutation 검증으로 일반화하지 않는다.

### 정리 라운드 이월 항목 — 2026-09-06

`/simplify` 2라운드 (reuse · simplification · efficiency · altitude 각 1) 에서 나왔으나 이번 범위에서 적용하지 않은 항목이다. "재개 조건" 이 성립하기 전에는 다시 열지 않는다.

| #   | 항목                                                                                                                                                        | 왜 넘겼나                                                                                                                                                                                                                                           | 재개 조건                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | `SkiaCanvas.tsx` `preparedFrame` 을 다시 `preparedInput`/`preparedPacket`/`preparedLayoutVersion` 3개 로컬로 분해 (rebuild 프레임당 객체 1개 할당 회피)     | 같은 라운드의 다른 판독이 정반대로 "그룹화는 과잉 아님" 판정. 그룹화가 고친 것은 실패 경로에서 1개만 `null` 로 되돌리고 2개는 stale 로 남던 비대칭 초기화다. 3필드 객체 1개는 그 프레임이 어차피 수행하는 content rebuild 할당량에 비해 무시할 수준 | 프로파일에서 이 할당이 실제 GC 압력으로 잡힐 때                                                   |
| 2   | `fullTreeLayout.ts` 가 filtered/synthetic children 의 결합 generation 카운터 하나를 발행하고, `FrameContentCache` 는 그 숫자만 비교                         | 생산자 모듈 변경이라 이번 diff 밖. 현재는 무효화 계약이 소비처(`readChildren` 인자 목록)에 산다                                                                                                                                                     | children 에 영향을 주는 상위 입력이 하나 더 늘어날 때 (그 시점에 인자 목록 추가 대신 이 방향으로) |
| 3   | `classifyFrame` 의 idle 판정을 순수 술어로 노출해 `canReuseFramePreparation` 이 재사용 (두 개의 "무엇이 stale 인가" 목록 통합)                              | 무엇이 skip 되는지가 바뀌어 §9 의 새 기준선 (threadTicks 31.376→20.639ms/s) 이 무효화된다                                                                                                                                                           | P1 후속 성능 작업을 열어 기준선을 다시 잴 때 함께                                                 |
| 4   | `perf-baseline.mjs` `seedDocument` 의 `fixtureKind` 8분기를 `seedMixedFixture`/`seedTextFixture`/`seedRefsFixture` 3개 빌더로 분리                          | 60/5k/text/ref 동일 checksum smoke 가 이 fixture 형태에 걸려 있다                                                                                                                                                                                   | fixture 종류를 4번째로 추가할 때 (그때 분기 추가 대신 분리)                                       |
| 5   | `framePreparation.test.ts` (private 필드 `Object.assign` poke) · `frameContentCache.test.ts` (`Map` 참조 동일성 단정) 를 public surface 검증으로 재작성     | 지적은 타당 — 동작이 같은 refactor 에도 깨진다. 다만 `SkiaRenderer.render()` 경로 검증은 CanvasKit 이 필요해 browser vitest (`vitest.browser.config.ts`) 로 옮기는 별도 작업                                                                        | 위 3번을 열 때 함께 (그 refactor 가 정확히 이 테스트를 깬다)                                      |
| 6   | `perf-baseline.mjs` `select`/`edit` 에서 `fixedInputs` 제거 (두 루프는 `setTimeout` 페이싱이라 vsync 의존이 없다 — `wheelBurst` 와 달리 보정할 대상이 없음) | 판독자 본인이 low confidence 로 제출. 루프 tail 반올림이 바뀌어 측정 하니스 동작 변경                                                                                                                                                               | 이 두 driver 의 수치를 다시 잴 일이 생길 때 확인 후                                               |

후속 후보 (위 6건과 별개): `perf-baseline.mjs` (2,079행) 가 `main()` 을 가진 실행 스크립트이면서 동시에 9개 심볼을 export 하는 공용 하니스 라이브러리가 됐다. `frame-harness-lib.mjs` 로 분리하면 `import.meta.url` entry-point guard 가 불필요해지고 CLI 옵션 표면과 공용 인프라가 갈린다. 파일 전체를 흔드는 작업이라 정리 라운드 범위 밖으로 뒀다.

1라운드에서 같은 사유로 넘긴 항목 3건도 유효하다 — `layoutVersion`/AI/`presentationTarget`/`dropIndicator` 무효화를 `renderer.invalidateContent()` 로 통일 (위 3번과 같은 계열, 기준선 무효화) · `canReuseFramePreparation` 의 `screenOverlayVersion` 인자 제거 (같은 축을 `shouldRerender` 가 실제로 쓴다) · `wheelBurst`/`select`/`edit` 공용 `runAtCadence` 추출 (세 driver 의 페이싱이 실제로 다르다).
