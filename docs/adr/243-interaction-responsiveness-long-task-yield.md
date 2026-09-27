# ADR-243: 상호작용 응답성 — LoAF 귀속으로 분할 지점을 찾고, 측정된 경계에서만 long task 를 나눈다 (선택 · 편집 · Layers · 페이지 전환)

## Status

Proposed — 2026-09-27 (사용자 `/create-adr` — "병렬로 한번에 설계해". 출처: Chrome/web.dev INP case study 대조 — Taboola · Trendyol · QuintoAndar)

## Context

### 문제

단발 상호작용 (캔버스 선택 · Properties/Styles 편집 commit · Layers 행 선택/펼침 · 페이지 전환 · ⌘Z) 의 **입력 → 다음 paint** 지연을 이 저장소는 한 번도 직접 잰 적이 없다. 있는 숫자는 모두 다른 지표다.

- `pnpm perf:baseline` 의 `select` · `edit` 부류는 store 를 직접 호출한다 (`apps/builder/scripts/perf-baseline.mjs:990-1033`, `:1909-1991` — `setSelectedElement` · `updateElementProps`). 입력 이벤트 · hit-test · React 이벤트 배칭을 지나지 않고, 결과는 rAF gap 이다.
- 그 하니스의 "600 요소 선택 ≈ 240 ms · 편집 ≈ 500 ms" 는 **dev 빌드 · headless · ADR-203 이전** 값이다 ([BUILDER_PERF_BASELINE_2026-09.md](../explanation/research/BUILDER_PERF_BASELINE_2026-09.md) §3-2). ADR-203 뒤 선택은 600 요소 p50 16.6 ms · longtask 0, persistent 5k 는 p95 36.5–43.7 ms · run 당 longtask 1 이 남았다 (§3-2a · §7).
- production 600 요소 편집 50회 (CPU 1x, M4 Pro) 는 frame p99 42 ms · 10 초당 longtask 중앙값 14 였다 ([frame-performance-reference-scheduler-20260906.md](evidence/frame-performance-reference-scheduler-20260906.md)). 사용자 Chrome 은 DevTools CPU 4x 상태로 쓰인다 (메모리 `user-chrome-cpu-throttle-4x`) — 4x 에서의 값은 없다.
- dev → production 차이가 크다: ADR-069 · 075 에서 `longtask.input` p95 가 dev 621 → prod 87 ms (−86%) 였다 ([075](completed/075-render-longtask-fanout-decomposition.md) Addendum 1).

진단 도구도 절반만 있다. `localWebVitals.ts:71-93` 가 LoAF observer 를 등록하지만 엔트리마다 `scriptDuration` · `forcedStyleAndLayoutDuration` **합계만** 남기고 `scripts[]` 의 `invoker` · `sourceURL` · `sourceFunctionName` 은 버린다. INP 항목 (`:45-63`) 과 LoAF 를 잇지 않으므로 "어느 상호작용의 long task 가 어느 코드에 몰렸는가" 를 답할 수 없다. `perfMarks.ts:13-15` 의 `longtask.input` / `longtask.render` 분류는 `observe()` 라벨과 시간이 겹치는지만 본다.

외부 사례는 **측정으로 경계를 찾은 뒤** 나눴다: Taboola 는 LoAF 로 render-blocking 구간을 찾아 `scheduler.postTask` 로 분할 (p75 INP 최대 −36%, TBT −70%), Trendyol 은 가장 긴 task 가 IntersectionObserver 콜백 안 `setState` 재렌더 (4x 에서 700–900 ms) 임을 확인하고 그 앞에 `yieldToMain()` (모바일 p75 INP −50%, A/B), QuintoAndar 는 spinner 먼저 → yield · `useTransition` · debounce 로 모바일 p75 INP 1,006 → 216 ms. 세 사례 모두 "어디서 나눌지" 가 측정 결과였다.

이 저장소에서 경계가 **있는지부터** 불확실하다:

- Zustand 갱신은 `useSyncExternalStore` 로 구독돼 transition lane 으로 분리되지 않는다 — ADR-069 가 캔버스 선택 경로에서 `startTransition` 을 제거한 이유다 (`useCanvasElementSelectionHandlers.ts:79-83`). 같은 이유로 `useIframeMessenger.ts:880-974` 의 `startTransition` 래핑과 `BuilderCanvas.tsx:1694` 주석 ("Phase 18: startTransition … INP 개선") 이 실제로 효과가 있는지 확인되지 않았다.
- 상태 파이프라인 **Memory → Index → History 는 동기 한 덩어리**다 (`.claude/rules/state-management.md`, `canonicalMutationRunner.ts:129-168` ①~④). 그 사이는 나눌 수 없다.
- Skia 렌더는 rAF 안 (`SkiaCanvas` renderFrame) 이라 그 프레임 자체다 — 나누면 paint 가 늦어질 뿐이다.
- 반면 **다음 paint 에 필요 없는 작업이 입력 task 안에 있을 수 있다**: 편집마다 canonical 구독자가 `queueMicrotask` 로 persist 를 시작하고 (`BuilderCore.tsx:391-397`), 러너도 persist 를 fire-and-forget 한다 (`canonicalMutationRunner.ts:168`). persist 직렬화는 8 ms 조각마다 `yieldToMain()` 하지만 (`incrementalDocuments.ts:49-79`) **첫 조각은 microtask 로 입력 task 안에서** 실행된다.

분할 도구 상태: `yieldToMain()` (`scheduleTask.ts:130-140`, `scheduler.yield` → `setTimeout(0)`) 의 비테스트 호출처는 `incrementalDocuments.ts:77` 하나다. `scheduleVisibleTask` 의 폴백은 `queueMicrotask` (`scheduleTask.ts:81-84`) 라 scheduler 가 없는 브라우저에서는 양보가 아니다 (현재 호출처 0). `scheduler.yield` · `scheduler.postTask` 는 Chrome/Edge 에 있고 **Safari 에 없다** — 대상 브라우저가 Chrome + Safari(WebKit) 이므로 (Firefox 는 우선 대상 아님) 폴백 의미가 곧 WebKit 사용자의 동작이다. `setTimeout(0)` continuation 은 큐 뒤로 가고 중첩 5단계부터 최소 4 ms 로 제한되며, `MessageChannel` 계열은 제한이 없지만 역시 우선순위가 없다. LoAF 는 Chromium 전용이다.

### SSOT 3-Domain 판정

D1 · D2 · D3 어느 것도 아니다. 런타임 스케줄링 (작업이 어느 task · 어느 프레임에 실행되는가) 만 다룬다 — RAC DOM/ARIA · props · catalog 시각 결과 · canonical 문서 · history entry 형식 변경 0. 분할로 생기는 한 프레임 동안의 중간 표시 (예: 캔버스 하이라이트가 Properties 보다 먼저) 는 시각 스타일이 아니라 시점 문제이고, 최종 시각 결과는 Canvas · Preview 모두 변경 전과 같아야 한다 (HC5).

### Hard constraints

- **HC1 파이프라인 원자성** — canonical → store set → rebuildIndexes → history (러너 ①~④, 러너 밖 기존 경로의 같은 순서 포함) 는 한 task 안에서 끝난다. 분할 경계는 history 기록 **뒤** 에만 둔다. 대기 중 continuation 이 있을 때 들어온 다음 입력 (⌘Z · 재편집 · 삭제 · 페이지 전환) 은 완결된 상태를 읽고, 최종 canonical 문서 · history 스택은 동기 실행과 바이트 동일하다.
- **HC2 계약 지표** — 판정 지표는 **상호작용 지연 = Event Timing `duration` (입력 → 다음 paint)** p95 를 상호작용 종류별로 직접 잰 값이다. production 빌드 · Chrome headed foreground · **CPU 4x** · 시드 600 과 5k. rAF gap · longtask 합계 · dev 수치는 판정에 쓰지 않는다 (참고 열). 분할 대상 기준 (측정 전 고정): 4x · 600 에서 p95 > 100 ms 또는 4x · 5k 에서 p95 > 200 ms 인 상호작용.
- **HC3 완료 시간 비회귀** — 분할은 작업을 뒤로 옮길 뿐 줄이지 않는다 (ADR-203 대안 D 기각 사유 · measurement-validity Q3). 입력 → 마지막 continuation 종료 → 그 다음 paint 의 **완료 시간** p95 가 before 대비 +10% 이내.
- **HC4 WebKit** — 같은 시나리오를 Playwright WebKit production 빌드에서 잰다 (CPU throttle 수단 없음 → 1x). 상호작용 지연 (Event Timing 이 있으면 그것, 없으면 근사 지표 — breakdown §2-1) 과 완료 시간이 before 대비 악화되지 않고, HC1 순서 시나리오가 통과한다.
- **HC5 정합** — continuation 은 실행 시점에 `get()` 으로 최신 상태를 읽고, 예약 뒤 선택 변경 · 요소 삭제 · 프로젝트 전환이 있으면 아무것도 하지 않는다 (세대 토큰). 지연 표시는 ADR-137 Selection Consumer Contract (page-bound mutation 은 즉시 스냅샷에서) 를 따른다.

### Soft constraints

- 기존 도구 (`scheduleTask.ts`) 를 보강하고 새 의존성 (`scheduler-polyfill` 등) 은 Phase 3 측정이 필요를 보일 때만.
- LoAF 귀속은 진단 (Chromium 전용) 이고 판정 oracle 이 아니다 — 판정은 Event Timing (브라우저가 재는 외부 값, measurement-validity Q5).
- 연속 상호작용 (팬 · 줌 · Layers 스크롤 · 가상화 목록 스크롤) 은 범위 밖 — 렌더/DOM 축 (ADR-153 · ADR-162 G4 후속).

## Alternatives Considered

### 대안 A: 측정된 경계에서만 분할 (yield · after-next-paint)

- 설명: Phase 0 에서 실제 입력 구동 하니스 + Event Timing + LoAF `scripts[]` 귀속으로 상호작용별 long task 를 버킷 (입력 핸들러·러너 동기 / React 동기 커밋 / rAF 렌더 / 다음 paint 에 불필요한 작업 / 브라우저 렌더 단계) 으로 나눈다. **다음 paint 에 불필요한 작업이 그 long task 의 30% 이상인 경계에만** `afterNextPaint` (rAF → 다음 task) 또는 `yieldToMain` 을 넣는다. WebKit 폴백은 측정으로 고른다. 후보가 없으면 구현 없이 종결.
- 근거: Taboola (LoAF → postTask) · Trendyol (가장 긴 task 확인 → setState 앞 yield) 의 순서 그대로. 이 저장소 선례: ADR-075 는 Phase 0 prod 측정으로 구현 Phase 를 건너뛰고 종결했고, `incrementalDocuments.ts` 는 8 ms 조각 yield 를 이미 쓴다.
- 위험: 기술(M) / 성능(M) / 유지보수(L) / 마이그레이션(L)
  - 기술 M: continuation 이 나중 상태를 만날 때의 정합 (HC5) · WebKit 폴백 순서 차이. 세대 토큰 + 순서 시나리오로 관리
  - 성능 M: 분할 경계가 없거나 작을 수 있다 (Zustand · rAF 가 지배적이면 효과 ~0) · 완료 시간 소폭 증가
  - 유지보수 L: 경계 수가 측정으로 제한되고 도구는 기존 파일 하나

### 대안 B: 무거운 작업을 worker 로 (persist 직렬화 · 파생 계산)

- 설명: persist 직렬화 (`splitDocument`) · 파생 인덱스 계산을 Web Worker 로 옮겨 메인 스레드 작업 자체를 없앤다.
- 근거: off-main-thread 는 web.dev 가 INP 처방으로 드는 방식이다. ADR-075 대안 B (Skia OffscreenCanvas + Worker) 는 기술·마이그레이션 CRITICAL 로 기각됐고, 여기서는 범위를 직렬화로 좁힌다.
- 위험: 기술(M) / 성능(M) / 유지보수(H) / 마이그레이션(M)
  - 성능 M: worker 로 보내려면 문서를 `structuredClone` 해야 하고 그 비용이 메인에서 드는 `JSON.stringify` 와 같은 급이다 (메모리 `project-mutation-cost-scales-with-document-size` — 3.24 MB 문서 stringify 3.24 MB · clone 3.11 MB). 증분 (변경 노드만) 전송이면 줄지만 그 자체가 새 설계
  - 유지보수 H: IndexedDB 쓰기 · 급감 가드 · 백업 ring · quota 재시도 (`adapter.ts:578-600`) 를 두 실행 문맥에 나눠 가져야 한다
  - 마이그레이션 M: 요소 소실 방지 가드 (ADR-116 계열) 경로가 바뀐다

### 대안 C: 범용 스케줄러 래퍼 (모든 입력 핸들러 · store 액션 일괄)

- 설명: 입력 핸들러 진입부와 `runCanonicalMutation` 스테이지 사이에 일괄 `yieldToMain` / `startTransition` 을 넣는 래퍼로 모든 상호작용을 나눈다.
- 근거: "모든 긴 작업을 쪼갠다" 는 일반 권고.
- 위험: 기술(H) / 성능(M) / 유지보수(H) / 마이그레이션(M)
  - 기술 H: 러너 ①~④ 사이 양보는 HC1 위반 — rAF 렌더 (`SkiaCanvas`) 와 다음 입력이 canonical 은 바뀌고 index · history 는 아직인 상태를 읽는다 (`canonicalMutationRunner.ts:157-167` 순서, `state-management.md` 금지 패턴 "set → rebuildIndexes → canonical" 과 같은 stale 창). `startTransition` 은 Zustand 갱신을 나누지 못한다 (`useCanvasElementSelectionHandlers.ts:79-83`)
  - 성능 M: 양보마다 오버헤드 · WebKit `setTimeout` 폴백은 중첩 4 ms 제한 — 경계가 많을수록 완료 시간 증가
  - 유지보수 H: 모든 호출처가 비동기가 되어 호출자 (단축키 · AI 명령 · 드래그 · undo 재생) 전부의 순서 가정을 다시 검증해야 한다

### 대안 D: 나누지 않고 작업을 줄인다 (구독 범위 축소 · 증분 · 메모)

- 설명: long task 를 만드는 작업 자체를 줄인다 — ADR-203 (LayerTree 창 렌더 · Properties 필드 단위 구독) 방식을 다른 경로로 확장.
- 근거: ADR-203 이 선택 600 p50 218 → 16.6 ms 를 이 방식으로 얻었다. 총비용을 줄이는 유일한 대안 (measurement-validity Q3 에 가장 맞음).
- 위험: 기술(M) / 성능(L) / 유지보수(M) / 마이그레이션(L)
  - 기술 M · 유지보수 M: 경계마다 설계가 다르고 캐시 무효화 결함 위험이 있다 — ADR-172 · 173 은 캐시 계층을 넣고 게이트를 통과한 뒤 같은 날 전량 되돌렸다
  - 범위가 측정 전에는 정해지지 않는다 — 어느 구독자 · 어느 계산을 줄일지가 Phase 0 결과다

### Risk Threshold Check

| 대안 | HIGH+                  | 판정                                                                          |
| ---- | ---------------------- | ----------------------------------------------------------------------------- |
| A    | 없음 (기술 M · 성능 M) | 통과                                                                          |
| B    | 유지보수 H             | A 가 HIGH 없이 같은 버킷 (다음 paint 에 불필요한 작업) 을 다루므로 불필요     |
| C    | 기술 H · 유지보수 H    | HC1 위반 — 기각                                                               |
| D    | 없음                   | 통과. 단 범위가 Phase 0 결과에 달려 있어 단독 결정 불가 → A 의 G0 분기로 연결 |

HIGH 없는 대안 A 가 있어 루프 불필요.

## Decision

**대안 A 를 채택하고, 대안 D 는 Phase 0 결과 분기로 연결한다.** Phase 0 이 먼저다 — 실제 입력 구동 하니스 (production · Chrome headed 4x/1x · WebKit · 600/5k) 로 상호작용 종류별 Event Timing 지연과 LoAF `scripts[]` 귀속을 재고, long task 를 버킷으로 나눈 후보표를 만든다. 분할 경계가 있다고 가정하지 않는다. G0 결과에 따라 셋 중 하나로 간다.

1. 모든 대상 상호작용이 HC2 기준 이내 → 구현 없이 측정 기록으로 종결 (ADR-075 선례).
2. 기준 초과인데 지배적 버킷이 다음 paint 에 필요한 작업 (러너 동기 구간 · React 동기 커밋 중 표시에 필요한 구독자 · rAF 렌더) → 이 ADR 에서 구현하지 않는다. 작업 감소 (대안 D) 후속 ADR 을 제안하고 **사용자가 결정한다** (결정 지점 ④ — 승인 범위의 변경).
3. 기준 초과이고 다음 paint 에 불필요한 작업이 그 long task 의 30% 이상 → 그 경계에만 `afterNextPaint` / `yieldToMain` 을 적용한다 (경계당 커밋 1 · 원복 RED).

분할 도구는 `scheduleTask.ts` 를 보강한다 — `afterNextPaint` 추가, 세대 토큰으로 stale continuation 차단, WebKit 폴백 (`setTimeout(0)` vs `MessageChannel`) 은 Phase 3 에서 두 arm 을 재서 고른다. 러너 동기 구간에 양보가 들어가지 못하게 정적 가드를 둔다.

**위험 수용 근거**: 남는 위험은 기술 M · 성능 M 이다. 기술 M (continuation 정합 · WebKit 순서) 은 경계가 측정으로 제한되고 (분기 3 만), 경계마다 세대 토큰 + 순서 시나리오 (G1 · G3) 로 관리한다. 성능 M (효과 ~0 가능성) 은 분기 1 · 2 가 "구현하지 않음" 을 정식 결과로 두므로 효과 없는 코드가 남지 않는다 — 원복 RED 로 개선이 그 변경 때문임을 보이지 못하면 되돌린다.

**기각 사유**:

- B: 문서를 worker 로 보내는 복사 비용이 없애려는 직렬화와 같은 급이고, 저장 가드 (급감 · 백업 · quota) 를 두 문맥에 나눠야 한다. 분기 3 이 같은 작업을 paint 뒤로 옮기는 것으로 충분한지 먼저 본다 — 충분하지 않다는 측정이 나오면 그때 별도 ADR.
- C: 러너 스테이지 사이 양보는 HC1 을 깨고, `startTransition` 은 Zustand 갱신을 나누지 못한다 (ADR-069 기록). 경계를 측정 없이 일괄로 두는 것 자체가 이 ADR 이 피하려는 형태다.
- D (단독 채택): 무엇을 줄일지가 Phase 0 결과 없이는 정해지지 않는다. 분기 2 로 연결해 측정이 가리킨 곳에서만 후속 ADR 로 다룬다.

**범위 밖**: 연속 상호작용 (팬 · 줌 · Layers 스크롤 · 가상화 목록 window 교체) · cold entry (research 문서 Track A) · Preview/publish 런타임 · Firefox.

> 구현 상세: [243-interaction-responsiveness-breakdown.md](design/243-interaction-responsiveness-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                     | 심각도 | 대응                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 분할 경계가 파이프라인 안쪽에 들어가 rAF 렌더 · 다음 입력이 중간 상태를 읽는다 · undo 원자성이 깨진다 — 러너 (`canonicalMutationRunner.ts:157-167`) 외에 러너 밖 기존 경로 allowlist 15 파일 (ADR-184) · `historyActions.ts` 재생 경로가 같은 순서를 손으로 쓴다         |  HIGH  | G1 정적 가드 (러너 ①~④ 사이 양보 0, 원복 RED) · 경계 후보는 history 뒤만 (breakdown §2-3 버킷 a 분할 금지) · G2/G3 순서 시나리오 (대기 중 ⌘Z · 재편집 · 삭제 · 페이지 전환 → 최종 문서 · history 바이트 동일) |
| R2  | 유리한 경우만 잰다 — 지연 p95 는 줄고 완료 시간 · 총비용은 늘거나, 600 에서만 좋아지거나, 단발 입력에서만 좋아진다 (ADR-172 · 173 전량 되돌림의 형태)                                                                                                                    |  HIGH  | G2 에 완료 시간 열 (HC3) · 5k · burst (10회 50 ms 간격) 불리 케이스 필수 · paired 3쌍 교대 · 허용치는 G0 의 같은 코드 run 편차로 먼저 고정                                                                    |
| R3  | WebKit 폴백 의미 차이 — `setTimeout(0)` 는 중첩 5단계부터 4 ms 제한 · continuation 이 다른 task (persist 조각 · Preview postMessage) 뒤로 가 순서가 Chrome 과 달라진다. `scheduleBackgroundTask` 는 `requestIdleCallback` 유무로 경로가 갈린다 (`scheduleTask.ts:47-66`) |  HIGH  | G3 — WebKit 에서 setTimeout · MessageChannel 두 arm 측정 후 선택 · 순서 시나리오 WebKit 통과 · 완료 시간 비회귀                                                                                               |
| R4  | 측정 도구가 결과를 만든다 — dev 오버헤드 (dev → prod −86%) · headless rAF · CDP throttle 해제 (메모리 `project-builder-frame-cost-distribution-measured`) · Event Timing 8 ms 반올림 · store 직접 호출 구동                                                              |  MED   | production · headed · 실제 입력 구동만 판정 · run 마다 throttle 적용 확인 값 · `visibilityState` 기록 · 8 ms 미만 차이는 판정에 쓰지 않음                                                                     |
| R5  | Phase 0 결과 분할 가능한 경계가 없다 (Zustand · rAF 지배) — 이 ADR 은 측정만 남긴다                                                                                                                                                                                      |  MED   | 정식 결과로 둔다 (Decision 분기 1 · 2). 분기 2 는 사용자 결정                                                                                                                                                 |
| R6  | LoAF 귀속이 production minify 이름 · 5 ms 미만 script 누락으로 잘못 읽힌다                                                                                                                                                                                               |  LOW   | `sourceCharPosition` + 빌드 sourcemap 으로 원 위치 복원 (reference scheduler evidence 의 번들 위치 대조 방식) · 귀속되지 않은 시간은 "미귀속" 버킷으로 남김                                                   |
| R7  | 효과 없는 기존 래핑 (`useIframeMessenger.ts:880-974` 의 `startTransition` · `BuilderCanvas.tsx:1694` 주석) 을 개선 근거로 잘못 인용                                                                                                                                      |  LOW   | Phase 0 에서 래핑 on/off 대조로 효과 기록 · 제거는 이 ADR 범위 밖 (기록만)                                                                                                                                    |

## Gates

측정 공통 (G0 에서 고정 · 모든 Gate 에 적용): production 빌드 · Chrome headed foreground (`visibilityState=visible` 기록) · CPU 4x (run 마다 적용 확인) + 1x 병기 · 시드 600 / 5k (합성 = 규모 전용) + 실제 프로젝트 1 참고 열 · 실제 입력 구동 (store 직접 호출 금지) · before/after 교대 fresh-browser 3쌍 (N 은 결과 전 고정, 추가 run 금지) · run 별 raw 고유 파일 · 판정 = arm 별 `median(after_p95 / before_p95)`.

| Gate | 시점            | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                          | 실패 시 대안                                                                                           |
| ---- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| G0   | Phase 0 종료    | 상호작용 8종 (breakdown §2-1) × 600/5k × 4x/1x 의 Event Timing 지연 p50/p95/p99 · inputDelay/processing/presentation 분해 · LoAF 귀속 버킷표 (미귀속 비율 포함) · 완료 시간 · 같은 코드 3 run 편차와 그로 정한 허용치 (최소 5%) · WebKit 1x 기준선 (Event Timing 지원 여부 · 근사 지표의 Chrome 대조 오차) · 기존 `startTransition` 래핑 on/off 효과 · Decision 분기 1/2/3 판정이 evidence 에 기록 | 누락 항목 보강 후 재측정. 분기 2 면 구현 중단 · 사용자 결정                                            |
| G1   | Phase 1         | 정적 가드: 러너 ①~④ 사이 `await` · `yieldToMain` · `afterNextPaint` · 타이머 0 — 가드가 막는 형태를 임시로 넣어 RED 확인 후 GREEN · 세대 토큰 unit (예약 뒤 선택 변경 · 삭제 · 프로젝트 전환 → no-op) 원복 RED                                                                                                                                                                                     | 가드 · 토큰 수리                                                                                       |
| G2   | Phase 2 각 경계 | 대상 상호작용 4x 지연 p95 ratio ≤ **0.8** 이고 (기준 초과였던 경우) 절대값이 HC2 기준 이내 · 완료 시간 p95 ratio ≤ **1.10** · 비대상 상호작용 지연 ratio ≤ 1 + 허용치 · 불리 케이스 (5k · burst 10회 50 ms) 에서 마지막 입력 완료 시간 ratio ≤ 1.10 · 최종 canonical 문서 · history 스택이 동기 arm 과 바이트 동일 · **원복 RED**: 그 경계만 되돌리면 ratio > 0.9 로 돌아간다                      | 원복으로 개선이 사라지지 않으면 그 변경은 원인이 아님 → 되돌리고 기록. 완료 시간 초과면 그 경계 되돌림 |
| G3   | Phase 3         | WebKit (Playwright, production, 1x): 폴백 두 arm (setTimeout · MessageChannel) 의 연속 양보 20회 총 지연 · 대기 입력 선처리 여부 · rAF 순서 기록 후 선택 · 대상 상호작용 지연 ratio ≤ 1 + 허용치 · 완료 시간 ratio ≤ 1.10 · 순서 시나리오 (대기 중 ⌘Z · 재편집 · 삭제 · 페이지 전환) 최종 문서 · history 바이트 동일                                                                               | 폴백 교체 후 재측정. WebKit 만 악화면 그 경계를 scheduler 있는 브라우저 한정으로 좁히고 기록           |
| G4   | Phase 4         | live (실제 builder — 사용자 Chrome 4x 상태 기록 또는 headed Playwright): 대상 상호작용 · ⌘Z/⌘⇧Z · 새로고침 뒤 문서 동일 · page error 0 · Live Exercise 절 기록                                                                                                                                                                                                                                     | 경로별 수리                                                                                            |

## Consequences

### Positive

- 상호작용 종류별 "입력 → 다음 paint" 기준선과 long task 귀속이 처음으로 생긴다 — 이후 성능 ADR 이 rAF gap 이나 dev 수치 대신 계약 지표로 판정할 수 있다.
- 분할이 측정된 경계에만 들어가고, 원복 RED 로 원인이 입증된 변경만 남는다.
- WebKit (Safari) 의 폴백 동작이 처음으로 측정되고 선택 근거가 기록된다.
- 러너 동기 구간 정적 가드가 이후 누구의 "성능용 await" 도 파이프라인 안에 들어오지 못하게 막는다.

### Negative

- Phase 0 하니스 (실제 입력 구동 · Event Timing · LoAF · WebKit) 작성 비용이 크고, 결과가 분기 1 · 2 면 제품 코드 변경 없이 끝난다.
- 분할된 경계는 완료 시간이 약간 늘 수 있고 (HC3 상한 +10%), 한 프레임 동안 캔버스와 패널 표시 시점이 어긋날 수 있다.
- continuation 경로가 생긴 곳은 세대 토큰 규약을 지켜야 하고, 이후 그 경로를 고치는 사람이 비동기 순서를 함께 검증해야 한다.
- LoAF 귀속은 Chromium 에서만 가능 — WebKit 은 지연 · 완료 시간만 보고 원인 귀속은 Chrome 결과를 빌린다.
