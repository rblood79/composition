# 레퍼런스 방법 적용 — event-driven RAF (2026-09-06)

## 결정과 외부 근거

현재 P1의 연속 RAF를 CanvasKit 공식 Quickstart의 이벤트 기반 예약으로 변경한다. 고가 장비의 특정 GPU query tail을 계속 추적하는 대신 **외부 방법의 적용 → 현재 구현과 동일 조건 비교**라는 사용자 지시에 따른다.

- [CanvasKit Quickstart](https://skia.org/docs/user/modules/quickstart/): 이벤트로만 화면이 바뀌면 draw callback 끝에서 RAF를 재예약하지 않는다. 활성 animation은 별도 연속 작업이다.
- [CanvasKit 공식 SKP benchmark](https://skia.googlesource.com/skia/+/3b13de2073cd/tools/perf-canvaskit-puppeteer/render-skp.html): CPU draw/flush와 전체 frame interval을 구분한다. Builder에서는 `render.skia.draw`가 classification·draw·flush를 포함하는 renderer 호출 구간이며 순수 GPU 시간은 아니다. production에는 draw-only/개별 flush 라벨이 없어 그 값은 미수집이다. SKP benchmark 자체를 실행했다거나 동일 workload라고 주장하지 않는다.
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance): 브라우저가 기록한 `FunctionCall`/`FireAnimationFrame` trace와 main-thread task CPU를 사용한다. 자체 renderRaf 계수와 브라우저 callback 수를 별도로 대조한다.
- [Zustand transient updates](https://github.com/pmndrs/zustand/blob/main/README.md#transient-updates-for-often-occurring-state-changes): 기존 mutable presentation 경계를 유지한다. wake는 React/Zustand 상태가 아닌 구독 신호다.
- [Chrome layered canvas 사례](https://developer.chrome.com/blog/performance-insights): 기존 content/overlay 분리와 일치한다. 이번 변경은 retained surface 구조나 paint 분류를 재설계하지 않는다.

## 변경과 소유권

`frameScheduler.ts`는 pending RAF 하나, dirty, pause, dispose를 관리한다. invalidation burst를 합치고 callback 중 새 invalidation은 다음 프레임으로 넘긴다. producer는 `requestCanvasFrame()`만 호출하며 cache 및 semantic state 소유권은 그대로다. Canvas effect가 구독을 해제하고 pending callback을 취소한다. hidden/context loss에서는 dirty를 보존하고 visible/복구 때 재개한다.

| wake 원인                            | 연결 경계                                                                                                | 검증 근거                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| camera/pan/zoom                      | `ViewportController.notifyUpdateListeners`                                                               | 동일 600개 wheel trace A/B, viewport 회귀 테스트                                                                  |
| document/layout/registry             | rendererInput effect, registry revision, `invalidateContent`, 기존 StoreRenderBridge layout subscription | edit trace, 이미지/폰트 완료, 페이지 전환                                                                         |
| selection/editing/AI/workflow packet | invalidationPacket effect                                                                                | 실제 pointer selection, page switch; AI는 packet 배선 검토                                                        |
| hover/workflow hover                 | 두 interaction hook의 overlay revision 갱신                                                              | hover 실제 main 제출, domain publication 0                                                                        |
| page drag/guides                     | 기존 page position/guide subscription의 overlay 갱신                                                     | page drag/presentation 단위 테스트와 배선 검토                                                                    |
| element drag/drop/sibling spring     | visual/sibling revision, drop snapshot, animation target                                                 | 실제 drag/undo 20회, spring 종료/원복 테스트                                                                      |
| animation/transition                 | engine 시작/종료 wake, renderer active/cleanup 조회                                                      | engine/scheduler 테스트; 현재 production에서 engine 할당 소비자는 없음. AI/sibling 활성 상태는 Canvas가 연속 예약 |
| minimap fade/renderer cleanup        | timer의 overlay revision / cleanup dirty 갱신                                                            | pan/zoom 이후 settled RAF 0, 실제 복구 후 idle 10초                                                               |
| image/font/theme                     | 기존 resource callback→invalidateContent / theme watcher                                                 | 지연 이미지, font sync callback, theme 실제 제출                                                                  |
| resize/DPR/context/visibility        | ResizeObserver/matchMedia, context watcher, visibility listener                                          | 실제 resize·복구 20회; 추가 DPR/visibility 결과는 아래 기록                                                       |
| editor preview/commit/cancel         | 기존 paint/layout bridge→invalidateContent                                                               | 실제 preview→cancel/commit/undo                                                                                   |

forwards animation의 종료값은 유지하되 `isActive()`는 아직 진행 중인 항목만 반환한다. 종료 객체가 남아 있다는 이유로 RAF가 영구 실행되지 않는다. renderer는 Zustand 비의존이고 readiness는 matching project/revision의 실제 main submission으로만 완료한다.

GPU timer는 비교에서 off다. opt-in 기능 검사에서는 pending query가 있을 동안 비차단 수거를 이어간다. 최종 소스는 render RAF와 분리한 16ms timer에서 `pollGpuTimer()`만 호출하고 마지막 제출 뒤 최대 120회 drain으로 제한하며 미회수 query는 pending으로 남겨 보고한다. 이 계측용 상한은 아래 CPU A/B 이후 추가됐으며 timeout으로 ready나 GPU 0을 만들지 않는다.

## 비교 조건 및 종료 조건

- baseline: clean HEAD `91dbcea59`의 현재 P1 production. after: 동일 코드에 scheduler/wake 적용. 이전 off/map/full 실험과 섞지 않는다.
- 같은 600 seed snapshot, projection 601 / resolved 659 / bounds 657. fixture SHA `176cc167dd8de86391a25e746fa9f6266e4fc4afb3289ba0c96eac89319066d4`.
- Chrome 152, M4 Pro/ANGLE Metal, foreground, 1440×900, DPR 1, throttle 1. 전후 빌드별 파일 SHA는 로컬 `manifest.json`.
- 3쌍 사전 고정: before→after / after→before / before→after. idle/pan/zoom/edit 각각 nominal 10초. pan/zoom은 같은 600개 입력, edit는 50회 폭 변경과 원복. 추가 통과 반복 없음.
- 각 구간 CDP `Tracing.start`의 `devtools.timeline,blink.user_timing`을 저장. GPU timer off, frame capture와 observer/driver는 동일하게 on. 전체 TaskDuration에는 이 계측 비용과 UI가 포함되며 renderer 전용 CPU가 아니다.
- renderer callback은 고정된 번들 위치로 식별했다. before `SkiaCanvas` 3행 164710열 함수 `h`; after `pageGuideActions` 7행 103739열 scheduler callback. 해당 minified 함수 본문과 대조했다. 청크 이름만 보고 비용을 귀속하지 않는다.
- 채택 근거는 idle callback 제거, 동일 입력에서 전체 CPU·frame/제출 지연 변화, 기능·수명 회귀다. 외부 문헌이 Builder 전용 20% 또는 GPU +0.5ms 예산을 제공한다고 표현하지 않는다. 과거 예산/실패는 역사적 결과로 보존한다.

## 전후 결과

3회 중앙값. RAF interval은 별도 observer가 받은 브라우저 RAF timestamp 간격이며 모니터 scanout이나 순수 GPU 시간이 아니다. idle에서 application이 쉬어도 observer는 계속 샘플링한다.

| 시나리오 | main-thread CPU ms/s 전→후 | frame p95 ms 전→후 | frame p99 ms 전→후 | renderer draw+flush p95 ms 전→후 | render RAF 전→후 |
| -------- | -------------------------: | -----------------: | -----------------: | -------------------------------: | ---------------: |
| idle     |              24.33 → 20.39 |         9.9 → 10.0 |        10.3 → 10.3 |                        표본 없음 |         1202 → 0 |
| pan      |            152.33 → 150.48 |         10.0 → 9.9 |        10.3 → 10.3 |                        1.3 → 1.3 |       1200 → 600 |
| zoom     |            266.80 → 267.49 |        10.3 → 10.2 |        16.7 → 16.7 |                        3.1 → 3.1 |       1200 → 619 |
| edit     |            244.38 → 239.67 |        10.3 → 10.2 |        42.0 → 41.7 |                        0.6 → 0.6 |        1301 → 52 |

idle CPU는 **24.334→20.390ms/s, 16.209% 감소**다. 브라우저 trace의 renderer callback은 중앙값 **1,204→0회**, 해당 callback thread time 합계는 **46.166→0ms/구간**이다. 계수의 1,202회와 trace 1,204회는 recorder reset/stop과 trace 경계가 조금 다르기 때문이며 같은 숫자로 강제 정규화하지 않는다.

pan input→다음 main submission p95는 **18.1→18.0ms**, zoom은 **28.5→29.0ms**다. zoom CPU는 **266.796→267.489ms/s**로 소폭 증가했으며 개선으로 표현하지 않는다. edit frame p99 **42.0→41.7ms**, longtask 중앙값 **15→14**로 기존 edit stall은 남는다. scheduler가 편집 병목 전체를 해결했다는 결론은 아니다. frame interval 및 CPU renderer 호출 구간을 함께 보면 이번 변경의 효과는 불필요한 idle/중간 RAF 제거에 집중된다.

| 쌍  | idle CPU before ms/s | after ms/s |
| --- | -------------------: | ---------: |
| 1   |               21.672 |     20.704 |
| 2   |               24.725 |     19.166 |
| 3   |               24.334 |     20.390 |

이 결과는 위 환경의 상대 효과다. 다른 GPU·저사양·브라우저의 절대 성능 보장이 아니다. 이전 GPU edit 10초 실패/30초 통과는 그대로 보존하며, 이번 CPU-only 비교에서 GPU 회귀가 해결됐다고 주장하지 않는다.

## 검증·한계·재현

- 관련 회귀 15 files / 100 tests PASS, 시각 계약 gate 101 PASS, preflight PASS. 테스트 통과는 성능 향상 수치의 근거가 아닌 정확성 근거다.
- 실제 pointer, element drag/undo 20회, context restore 20회, restore 전후 Canvas PNG 동일, preview/cancel/commit/undo, page switch, delayed image, font sync callback, resize, unmount PASS. settled idle 10초 renderRaf/contentBuild/planBuild/mainSubmission/domainPublication 모두 0.
- 변경 전후 같은 selection/hover 상태의 Canvas PNG byte equality PASS. hover 실제 제출은 `frame.present=1`, domain publication 0. theme 제출, DPR+resize(1441 CSS px × DPR 2 → canvas 2882 px) PASS.
- 추가 pixel 비교 한 번은 after에 hover 테두리가 남아 실패했다. 서로 다른 hover 상태의 비교를 성공으로 바꾸지 않았고, 포인터를 양쪽 모두 Properties DOM 패널로 이동해 같은 상태를 만든 뒤 정확한 PNG 일치를 확인했다. 원래 실패 로그를 보존한다.
- native hidden 전환은 자동화 브라우저에서 미관측이다. background 억제 옵션을 제거한 별도 실행에서도 `document.hidden=false`여서 실제 hidden/resume PASS로 기록하지 않는다. scheduler의 pause→dirty 보존→resume 동작은 단위 테스트로 검증했다. 물리 모니터 DPR 전환도 미검증이다.
- GPU drain을 분리한 최종 release 빌드에서 실제 drag/undo·context restore 20회, 복구 PNG 동일, preview/cancel/commit/undo, page switch, image/font callback, resize, unmount 및 settled idle RAF 0을 다시 확인했다. 복구 cycle마다 GPU query valid 1/pending 0이며 최종 idle에는 pending 0이다. node picture 147, 각 surface/snapshot 1, DOM 2589, listener 548로 20회 동일했다.
- 최종 preflight(타입 baseline 0 포함), focused 4 files/23 tests, diff/check PASS. 관련 15 files/100 tests와 시각 계약 101은 scheduler 본체 반영 후 통과했으며 GPU-only drain 분리 뒤에는 해당 focused와 실제 복구를 재검증했다.
- **판정: 이번 레퍼런스 기반 scheduler 적용·현재 P1 대비 비교·문서 반영을 완료하고 채택한다.** 다른 기기 성능 보장, 기존 GPU tail 해소, 전체 React fan-out 제거를 완료했다고 주장하지 않는다.
- 측정 빌드 공통 startup Pretendard 404 8건은 보존. refresh가 있는 live run은 16건. 측정 구간 page/console 오류 0, 전체 startup 오류 0은 아니다.
- DPR-only CDP override는 빈 페이지에서도 resolution match 값만 바꾸고 change/resize 이벤트를 발행하지 않았다. 이에 따른 timeout은 보존하고 제품 결함 판정에 사용하지 않는다. 실제 물리 모니터 전환을 검증했다고 주장하지 않는다.
- 비교 raw/trace/manifest/요약/실행 스크립트: 로컬 `docs/migrations/evidence/frame-performance/reference-scheduler-20260906/`. 정적 artifact: `/private/tmp/frame-reference/{before,after,release}`. 인증 snapshot은 `/private/tmp`에만 둔다.
- 실행: `run-comparison.py`는 각 arm의 `perf-reference.mjs --lane frame --headed --frame-capture --fixed-inputs --seed-count 600 --classes idle,pan,zoom,edit --duration-ms 10000 --cpu-time-domain threadTicks`를 교차 3쌍 실행한다. `perf-reference.mjs`는 기존 perf-baseline 하니스에 구간별 CDP trace 저장만 추가한 로컬 사본이며 입력·요약 수식은 유지한다. `summarize.py`가 raw 유효성/fixture/visibility/오류를 검사하고 위 표를 만든다.
