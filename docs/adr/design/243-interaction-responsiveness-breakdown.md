# ADR-243 구현 상세 — 상호작용 응답성: 측정 지점 한정 분할

> 본문: [243-interaction-responsiveness-long-task-yield.md](../243-interaction-responsiveness-long-task-yield.md)
> 이 문서는 Phase · 파일 변경표 · 측정 절차 · 후보 목록만 담는다. 결정·위험·Gate 정본은 ADR 본문.

## 0. 전제 lock-in (fork 아님)

이 ADR 은 기존 ADR 을 나누거나 합치지 않는다. [BUILDER_PERF_BASELINE_2026-09.md](../../explanation/research/BUILDER_PERF_BASELINE_2026-09.md) §4-1 Track C ("edit/persist · Layers scroll · page/zoom — 별도 원인 A/B 와 불리 케이스를 확보하고 착수, 필요 시 별도 ADR") 중 **단발 상호작용** (선택 · 편집 · Layers 행 조작 · 페이지 전환) 의 응답성만 맡는다. 연속 상호작용 (팬 · 줌 · Layers 스크롤 · 가상화 목록 스크롤) 은 범위 밖 — 렌더/DOM 축이고 ADR-153 · ADR-162 G4 후속이 소관이다.

| 질문                    | 답                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| base / 응용             | 해당 없음 — 런타임 스케줄링 한 축. ADR-203 (선택 fan-out 행 수 감소) 의 결과를 기준선으로 쓰되 의존하지 않는다 |
| schema 직교성           | 저장 스키마 · canonical 문서 · history entry 형식 변경 0                                                       |
| 선행 ADR 전제 승계      | ADR-069 의 "Zustand 갱신은 transition lane 으로 분리되지 않는다" 를 Phase 0 에서 재확인 (승계가 아니라 재측정) |
| 결정 지점 (사용자 질문) | G0 분기 ② (다음 paint 에 필요한 작업이 지배적 → 작업 감소 후속 ADR 제안) 만 사용자 결정 대상                   |

## 1. Phase 개요

| Phase | 내용                                                           | 산출                                              | Gate |
| ----- | -------------------------------------------------------------- | ------------------------------------------------- | ---- |
| 0     | 측정 하니스 확장 + production 기준선 + LoAF 귀속 + 경계 후보표 | evidence `243-phase0-baseline.md` · 후보표 · 분기 | G0   |
| 1     | 분할 도구 (yield · after-next-paint · 세대 토큰) + 정적 가드   | `scheduleTask.ts` 보강 · 가드 테스트              | G1   |
| 2     | G0 후보 경계에만 분할 적용 (경계당 커밋 1)                     | 경계별 paired A/B · 원복 RED                      | G2   |
| 3     | WebKit 동일 시나리오 · 폴백 순서 검증                          | WebKit A/B · 순서 시나리오                        | G3   |
| 4     | live exercise · 문서 (README · CHANGELOG · research 문서 §4)   | Live Exercise 절                                  | G4   |

G0 분기 ① (전 대상이 기준 이내) 이면 Phase 1~3 을 건너뛰고 Phase 0 기록 + 문서로 종결한다 (ADR-075 종결 선례).

## 2. Phase 0 — 측정 먼저

### 2-1. 하니스 확장 (`apps/builder/scripts/perf-baseline.mjs` 에 `--lane interaction` 추가, 또는 같은 디렉토리 새 스크립트)

현재 하니스의 `select` · `edit` 부류는 store 를 직접 호출한다 (`perf-baseline.mjs:990-1033`, `:1909-1991` — `setSelectedElement` · `updateElementProps`). 입력 이벤트 · hit-test · 이벤트 핸들러 · React 이벤트 배칭을 지나지 않으므로 **입력 → 다음 paint** 를 잴 수 없다. 새 lane 은 실제 입력으로 구동한다.

| 상호작용 (id)   | 구동 (Playwright 실제 입력)                                                                                 | 비고                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `canvas-select` | `page.mouse.click` — 좌표는 `__composition_LAYOUT_DEBUG__.getSharedLayoutMap()` scene 좌표 → 화면 좌표 변환 | 매번 다른 요소 (가시 집합 안). 메모리 `reference-live-layout-rect-and-palette-add-path` |
| `layers-select` | Layers 행 클릭 (`[role="row"]`, 가상화 window 안 행)                                                        | ADR-203 이후 경로                                                                       |
| `layers-expand` | 행 펼침/접힘 토글                                                                                           |                                                                                         |
| `props-commit`  | Properties 숫자 필드 포커스 → 값 입력 → Enter                                                               | 입력 중 keystroke 와 commit 을 따로 기록                                                |
| `style-commit`  | Styles 패널 필드 commit (useOptimizedStyleActions 경로)                                                     |                                                                                         |
| `page-switch`   | PagesSection 행 클릭                                                                                        |                                                                                         |
| `undo`          | 캔버스 컨테이너 포커스 (`[data-canvas-container="true"]`) 뒤 ⌘Z / ⌘⇧Z                                       | 단축키 scope 함정 — research 문서 §5-6                                                  |
| `burst` (불리)  | `props-commit` 10회를 50 ms 간격으로 연속                                                                   | 마지막 입력의 완료 시간 · 최종 canonical 바이트 비교                                    |

페이지 안에 주입하는 기록기:

- `PerformanceObserver({ type: "event", durationThreshold: 16, buffered: true })` — `interactionId > 0` 항목을 상호작용 id 별로 모은다. 지표 = `duration` (입력 → 다음 paint, 8 ms 단위 반올림) · `inputDelay` · `processingDuration` · `presentationDelay`.
- `PerformanceObserver({ type: "long-animation-frame", buffered: true })` — 엔트리마다 `scripts[]` 의 `invoker` · `invokerType` · `sourceURL` · `sourceFunctionName` · `sourceCharPosition` · `duration` · `forcedStyleAndLayoutDuration` 을 **전부** 저장 (현재 `localWebVitals.ts:74-90` 은 합계만 저장). 상호작용과 LoAF 는 시간 구간 겹침으로 잇는다 (web-vitals 6 `attribution` 빌드의 `longAnimationFrameEntries` · `longestScript` 와 같은 방식 — `node_modules/web-vitals` `types/inp.d.ts:121-133`).
- **입력 표본 고정 (분모)**: 하니스가 구동하는 입력마다 순번 · 종류 · 구동 시각을 기록하고, Event Timing 항목을 `name` + `startTime` 창으로 그 입력에 잇는다. 브라우저의 최소 threshold 가 16 ms 라 그보다 짧은 상호작용은 항목이 오지 않는다 — **항목이 없는 입력은 `duration = 16 ms` (관측 가능한 상한) 로 채워** 종류별 p95 의 분모를 구동한 입력 수 (30) 로 고정한다. 관측 비율 (관측 / 구동) 을 arm 마다 함께 기록한다. 이 규칙은 before · after 에 똑같이 적용되므로, 개선으로 빠른 입력이 사라져도 표본이 줄지 않는다.
- **완료 시간 종점 (before · after 공통)**: 저장 트랜잭션이 아니라 **저장 호출**을 추적한다 — 문서 직렬화 (`splitDocument`) 는 트랜잭션을 만들기 전에 돈다 (`incrementalDocuments.ts:119-121`) 라서 트랜잭션만 보면 5k 직렬화 도중에 완료를 확정할 수 있다. Phase 0 에 동작 변경 0 인 계측을 하나 넣는다: 모든 문서 저장이 모이는 `IncrementalDocuments.put` (`adapter.ts:595` 경유 — `BuilderCore.tsx:391-397` microtask 예약 · `canonicalMutationRunner.ts:168` fire-and-forget · history · 삭제 경로) 이 **호출되는 순간 (직렬화 전)** 대기 수 +1 · 시작 시각 기록, 그 작업이 끝나면 (성공 · 실패 모두) −1 · 완료 시각 기록. production 에도 설치되는 `__composition_PERF__` 에 `persistState()` 로 노출한다. **완료 = 입력 뒤 마지막 저장 완료와 마지막 LoAF 종료 중 늦은 쪽 → 그 다음 paint.** 관측은 입력마다 5 s 까지 이어 가고 (저장 호출 자체를 늦춘 변경도 그 안에서 잡힌다), 대기 수 0 · 새 저장 시작 없음 · 새 LoAF 없음이 1,000 ms 이어지면 일찍 끝낸다. 입력 뒤 5 s 안에 저장이 끝나지 않으면 그 표본은 5 s 로 채운다. before arm 은 이 계측이 들어간 Phase 0 커밋에서 시작하므로 before · after 가 같은 종점을 쓴다. Phase 1 의 continuation 카운터는 귀속 보조로만 쓴다.
- WebKit: `PerformanceObserver.supportedEntryTypes` 에 `event` 가 있으면 같은 기록기, 없으면 근사 지표 — capture 단계 리스너의 `event.timeStamp` → 핸들러 뒤 `requestAnimationFrame` → 그 안에서 예약한 다음 task 시작 시각. Chrome 에서 두 지표를 같은 run 에서 함께 재 근사 오차를 기록한다.

### 2-2. 조건 (결과를 보기 전에 고정)

| 항목        | 값                                                                                                                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 빌드        | **production** (`vite build` → `vite preview --base /composition/`). dev 는 참고 열로만 — ADR-069 · 075 에서 dev → prod 가 −86% 였다                        |
| 브라우저    | Chrome (Playwright `channel: "chrome"`) **headed** · foreground (`visibilityState` 기록) / Playwright WebKit                                                |
| CPU         | Chrome 4x (`--cpu-throttle 4`, CDP `Emulation.setCPUThrottlingRate`) + 1x 병기. WebKit 은 throttle 수단이 없어 1x 만                                        |
| 문서        | 시드 600 · 5k (5k 는 ADR-203 persistent 컨텍스트). 합성 시드는 **규모 전용** (measurement-validity Q1) — 분포 지표 인용 금지. 실제 프로젝트 1개를 참고 열로 |
| 패널        | Navigator (Layers) · Properties · Styles 열림                                                                                                               |
| 반복        | 상호작용당 30회 × fresh-browser 3 run. 같은 코드 3 run 편차를 먼저 기록해 허용치를 정한다 (메모리 `feedback-perf-gate-tolerance-must-exceed-run-variance`)  |
| 계측 on/off | `perfMarks` User Timing 은 off (기본). LoAF · Event Timing 기록기는 before/after 양쪽에 같이 켠다                                                           |

### 2-3. 귀속 버킷

LoAF `scripts[]` 를 sourcemap 으로 원 소스 위치에 되돌린 뒤 (production 은 minify — `sourceCharPosition` + 빌드 sourcemap), 상호작용별 long task 시간을 아래 버킷으로 나눈다.

| 버킷 | 내용                                                                                                 | 다음 paint 에 필요?                              | 이 ADR 처방                 |
| ---- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------- |
| a    | 입력 핸들러 + Zustand `set` + 러너 동기 구간 (canonical → set → rebuildIndexes → history)            | 필요 — 순서 계약 (HC1)                           | 분할 금지. 크면 분기 ②      |
| b    | React 동기 커밋 (useSyncExternalStore 구독자 fan-out — Properties · Layers · 헤더 등)                | 구독자마다 다름 — 선택 표시 · 포커스 대상은 필요 | 불필요한 구독자만 분리 후보 |
| c    | rAF 렌더 (`SkiaCanvas` renderFrame — scene build · layout publish · record · flush)                  | 필요 (그 프레임 자체)                            | 분할 대상 아님. 크면 분기 ② |
| d    | persist 첫 조각 · Preview 동기화 · hydrate · 파생 인덱스 · 분석성 작업 (같은 task 의 microtask 포함) | 불필요                                           | **분할 1순위 후보**         |
| e    | 강제 style/layout (`forcedStyleAndLayoutDuration`) · 브라우저 렌더 단계 (presentationDelay)          | —                                                | 기록만 (DOM 축 — 범위 밖)   |

### 2-4. 코드상 먼저 확인할 후보 (가설 — 측정 전 확정 아님)

| 후보                           | 위치                                                                                                                                    | 가설                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| persist 첫 조각이 입력 task 안 | `BuilderCore.tsx:391-397` (`queueMicrotask` → persist) · `canonicalMutationRunner.ts:168` · `incrementalDocuments.ts:49-79` (8 ms 조각) | 편집마다 persist 경로 2개가 microtask 로 시작해 첫 8 ms 조각씩 다음 paint 앞에서 실행 (버킷 d). "다음 paint 뒤 시작" 으로 옮길 수 있는지 |
| Preview 동기화 · iframe 메시지 | `useIframeMessenger.ts:880-974` (`startTransition` 래핑)                                                                                | Zustand 갱신을 감싼 `startTransition` 이 실제로 분리되는지 (ADR-069 기록상 아님) — 효과 없는 래핑이면 기록                               |
| 선택 뒤 inspector hydrate      | `stores/elements.ts:858-870` (`scheduleCancelableBackgroundTask`)                                                                       | 이미 background — WebKit 에서 `requestIdleCallback` 유무에 따라 폴백 경로가 갈린다                                                       |
| deferred 선택 값               | `stores/index.ts:350-390` (`useDeferredValue`)                                                                                          | 두 번째 렌더 패스가 같은 task 에 들어가는지, 다음 task 로 가는지                                                                         |
| PagesSection 페이지 전환       | `PagesSection.tsx:135-330` (`startTransition` + `scheduleBackgroundTask`)                                                               | 이미 분할된 경로 — 기준선 대조군 겸용                                                                                                    |

## 3. Phase 1 — 분할 도구 · 가드

| 파일                                                                    | 변경                                                                                                                                                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/builder/src/builder/utils/scheduleTask.ts`                        | `yieldToMain` 폴백을 Phase 3 측정 결과 (setTimeout vs MessageChannel) 로 확정 · `afterNextPaint(fn)` (rAF → 다음 task) 추가 · continuation 대기 카운터 (완료 시간 계측용, DEV/하니스 노출) |
| 같은 파일                                                               | `scheduleVisibleTask` 폴백이 `queueMicrotask` (`:81-84`) 라 scheduler 없는 브라우저에서는 양보가 아니다 — 현재 호출처 0. 이 ADR 의 경계에서는 쓰지 않는다 (삭제는 별도 승인)               |
| 새 `scheduleTask.test.ts` 항목                                          | 세대 토큰: continuation 이 예약 뒤 선택 변경 · 요소 삭제 · 프로젝트 전환이 있으면 no-op                                                                                                    |
| `adapters/canonical/canonicalMutationRunner.static.test.ts` (기존 확장) | 러너 ①~④ 사이에 `await` · `yieldToMain` · `afterNextPaint` · `setTimeout` 0 (소스 순서 가드). 원복 RED: 가드가 막는 형태를 임시로 넣어 실패 확인                                           |

## 4. Phase 2 — 경계별 적용

- G0 후보표에서 **버킷 d (또는 b 중 다음 paint 에 불필요한 구독자) 이고 그 상호작용 long task 의 30% 이상** 인 경계만 대상. 경계당 커밋 1.
- 각 경계: 변경 → paired A/B (before/after 교대 fresh-browser 3쌍, N 고정) → 원복 RED (그 경계만 되돌려 개선이 사라지는지) → burst · 5k 불리 케이스 → 다음 경계.
- 개선이 원복으로 사라지지 않으면 그 변경은 원인이 아니다 — 되돌리고 기록한다 (메모리 `feedback-perf-gate-favorable-case-only-measurement` §부수 교훈).

## 5. Phase 3 — WebKit

| 항목          | 절차                                                                                                                                                                                                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 폴백 선택     | WebKit 에서 (1) 연속 yield 20회 총 지연 (setTimeout 중첩 5단계 뒤 최소 4 ms 제한 확인) (2) 대기 중 입력 이벤트가 continuation 보다 먼저 처리되는지 (3) continuation 과 rAF 순서 — setTimeout(0) · MessageChannel 두 arm |
| 순서 시나리오 | continuation 대기 중 ⌘Z · 같은 요소 재편집 · 요소 삭제 · 페이지 전환 → 최종 canonical 문서가 동기 arm 과 바이트 동일 · history 스택 동일                                                                                |
| 지표          | 2-1 의 WebKit 기록기 (Event Timing 있으면 그것, 없으면 근사) — paired A/B                                                                                                                                               |

## 6. Phase 4 — live · 문서

- 사용자 Chrome (CPU 4x 상태 기록 — 메모리 `user-chrome-cpu-throttle-4x`) 또는 headed Playwright 로 실제 builder 에서 대상 상호작용 + ⌘Z/⌘⇧Z + 새로고침 뒤 문서 동일.
- `docs/adr/README.md` · `docs/CHANGELOG.md` (사용자-가시 성능 변화가 있을 때만) · research 문서 §4 순위표 갱신.

## 7. 파일 변경표 (예상 — Phase 2 대상은 G0 결과로 확정)

| 파일                                                                         | Phase | 성격                                  |
| ---------------------------------------------------------------------------- | :---: | ------------------------------------- |
| `apps/builder/scripts/perf-baseline.mjs` (또는 새 interaction 하니스)        |   0   | 측정 전용                             |
| `docs/adr/evidence/243-phase0-baseline.md`                                   |   0   | 기준선 · 후보표                       |
| `apps/builder/src/builder/utils/scheduleTask.ts` (+ test)                    |   1   | 도구                                  |
| `apps/builder/src/adapters/canonical/canonicalMutationRunner.static.test.ts` |   1   | 가드                                  |
| G0 후보 경계 파일 (2-4 표에서 측정으로 남는 것)                              |   2   | 동작 변경 (타이밍만)                  |
| `apps/builder/src/builder/performance/localWebVitals.ts`                     | 선택  | 성능 보고서에 script 귀속 top-N (LOW) |
