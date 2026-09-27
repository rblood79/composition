# ADR-243 구현 상세 — 상호작용 응답성: 측정 지점 한정 분할

> 본문: [243-interaction-responsiveness-long-task-yield.md](../completed/243-interaction-responsiveness-long-task-yield.md)
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

## 8. Phase 0 결과 — G0 분기 ② (2026-09-28)

> **판정: 분기 ②** — 대상 상호작용 다수가 HC2 기준을 넘지만 long task 의 지배 구간은 입력 이벤트 task (핸들러 · 러너 · React 동기 커밋) 와 rAF 렌더다. 다음 paint 에 불필요한 작업 (버킷 d) 은 30% 문턱에 한참 못 미친다. 분할 Phase 1 ~ 3 은 구현하지 않고, 작업 감소 후속 ADR 도 두지 않는다 (사용자 결정 2026-09-28 — "243 은 측정 기록으로 종결해"). 측정은 사용자 지시로 일부 중단했다 ("측정은 그만해라") — §8-6. raw 17 run 은 local-only (`/private/tmp/adr243-phase0/`, `docs/adr/evidence/` 는 gitignore).

### 8-1. 조건

| 항목      | 값                                                                                                                                                                                                                                                    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 빌드      | production (`vite build --sourcemap`, 작업 트리 = `f80a0146e` + Phase 0 저장 호출 계측). 정적 서버 base `/composition/`                                                                                                                                 |
| 브라우저  | Chrome 154 (Playwright `channel: "chrome"`) **headed** · foreground (`visibilityState=visible` 전 입력 확인, hidden 0) · occlusion/background throttling off 플래그 / Playwright WebKit 26.5 headed                                                  |
| CPU       | Chrome 4x · 1x (CDP `Emulation.setCPUThrottlingRate`). run 앞뒤 고정 루프 probe: 1x 18 ~ 33 ms · 4x 58 ~ 69 ms (약 2배 — probe 가 짧아 4배로 재지지 않는다. 같은 입력의 지연 비는 600 에서 2.3배 · 5k 에서 3.4배). WebKit 1x                       |
| 문서      | 합성 시드 600 · 5,000 (Text/frame 격자 + 페이지 3). **규모 전용** — 분포 지표 인용 없음. 실제 프로젝트 참고 열은 없다 (§8-6)                                                                                                                           |
| 패널      | Navigator · Properties · Styles 열림, Layers 루트 펼침                                                                                                                                                                                                |
| 반복      | 상호작용당 30 입력 (+ warm-up 2, 기록 제외) · burst 는 5회 × 10 입력. fresh browser run 3회. 순서 고정: run 마다 600 → 5k, 4x → 1x                                                                                                                    |
| 입력 구동 | Playwright 실제 mouse · keyboard. store 직접 호출은 준비 (대상 선택 · 포커스) 에만                                                                                                                                                                   |
| 하니스    | `apps/builder/scripts/adr243-interaction.mjs` (setup · run · summarize). raw 17 run: `/private/tmp/adr243-phase0/` (local-only)                                                                                                                       |

지표 정의는 breakdown §2-1 그대로다 — 지연 = Event Timing `duration` (같은 interactionId 항목 중 최대, 항목 없으면 16 ms 로 채움, 분모 = 구동 입력 수) · 완료 = max(지연 끝, 입력 뒤 마지막 저장 호출 종료, 겹치는 마지막 LoAF 끝) − 입력 시작 (5 s 상한, 대기 저장 0 · 활동 없음 1 s 면 조기 종료). 관측률은 전 조건 95 ~ 100% (WebKit layers-expand 600 만 69%).

드라이버 메모 (측정 전 확인한 것):

- Properties 에는 Text/frame 의 숫자 필드가 없어 `props-commit` 은 Text 내용 필드 (Properties `fieldset` "Text") 의 Enter commit 이다. commit 이 필드 포커스를 놓으므로 burst 는 입력마다 필드를 클릭한다 — 4x 에서 10 입력이 50 ms 간격이 아니라 약 2.7 s 에 걸친다 (CDP 입력이 main thread 를 기다림).
- Navigator 는 떠 있는 패널이라 Layers 행이 2 ~ 3개만 보인다 — `layers-select` 는 실제로 보이는 행만 고른다.
- `clearSelection` 은 Layers 선택을 비우지 못해 자식 선택이 body 를 다시 펼친다 — `layers-expand` 는 body 를 선택한 상태에서 잰다.

### 8-2. 기준선 — Chrome 4x (판정 조건)

p95 는 run 3회 p95 의 중앙값, 편차 = (max − min) / 중앙값. 단위 ms.

| 상호작용        | 600 p50 | 600 p95 | 편차 | 600 완료 p95 | 600 판정 (>100) | 5k p50 | 5k p95 | 편차 | 5k 완료 p95 | 5k 판정 (>200) | 5k 분해 delay/proc/pres |
| --------------- | ------: | ------: | ---: | -----------: | :-------------: | -----: | -----: | ---: | ----------: | :------------: | ----------------------- |
| canvas-select   |      88 |     104 |  31% |          104 |      초과       |    104 |    120 |  13% |         120 |      이내      | 2 / 83 / 43             |
| layers-select   |     128 |     152 |  11% |          152 |      초과       |    144 |    160 |  40% |         160 |      이내      | 3 / 9 / 148             |
| layers-expand   |      48 |      56 |  14% |           56 |      이내       |     72 |     88 |  18% |          88 |      이내      | 2 / 13 / 80             |
| props-keystroke |      48 |      48 |   0% |           48 |      이내       |     64 |     80 |  10% |          80 |      이내      | 1 / 49 / 38             |
| props-commit    |     184 |     200 |  12% |          200 |      초과       |    800 |    872 |  16% |         937 |      초과      | 1 / 805 / 81            |
| style-commit    |     184 |     208 |  19% |          225 |      초과       |    784 |    896 |   8% |       1,098 |      초과      | 1 / 840 / 70            |
| undo (⌘Z · ⌘⇧Z) |     176 |     184 |   4% |          192 |      초과       |     48 |    864 |  14% |         972 |      초과      | 48 / 1 / 863            |
| page-switch     |     152 |     168 |  10% |          168 |      초과       |    344 |    664 |   4% |         837 |      초과      | 4 / 6 / 656             |
| burst (마지막)  |     168 |     184 |   4% |          294 |      초과       |    776 |    928 |  21% |       1,415 |      초과      | 9 / 859 / 67            |

- 5k undo 는 두 모양이 섞였다: ⌘Z p50 40 / p95 856, ⌘⇧Z p50 832 / p95 968 (각 45 입력). 600 은 둘 다 176 / ~190.
- 같은 코드 3 run 편차는 4x 에서 0 ~ 40% — G2 허용치 (최소 5%) 는 행마다 이 편차 이상이어야 한다.

#### 참고 열 — Chrome 1x · WebKit 1x (p95)

| 상호작용      | Chrome 1x 600 | Chrome 1x 5k | WebKit 600 (3 run) | WebKit 5k (2 run) |
| ------------- | ------------: | -----------: | -----------------: | ----------------: |
| canvas-select |            56 |           56 |                 32 |                48 |
| layers-select |            64 |           72 |                 48 |                64 |
| layers-expand |            32 |           40 |                 16 |                24 |
| props-commit  |            88 |          256 |                 64 |               272 |
| style-commit  |            72 |          240 |                 64 |               264 |
| undo          |            80 |          256 |                 72 |               264 |
| page-switch   |            72 |          168 |                 64 |               168 |
| burst         |            56 |          216 |                 48 |               240 |

WebKit 26.5 는 Event Timing 을 지원한다 (`supportedEntryTypes` 에 `event`) — 근사 지표 (capture `timeStamp` → rAF → 다음 task) 와 Event Timing 의 p95 차는 Chrome · WebKit 모두 대부분 ±15 ms 안이다 (summary.json `approxP95`). LoAF 는 WebKit 에 없다.

### 8-3. 귀속 (LoAF `scripts[]` → sourcemap, Chrome 4x)

상호작용 창과 겹친 LoAF 의 script 진입점 합 (30 입력 합, ms). 진입점 하나가 그 콜백 안 동기 작업 전부를 담는다.

| 상호작용 (5k)  | 입력 이벤트 task                                          | rAF 렌더 (`frameScheduler.ts`) | 저장 콜백 (IDB · yield) | 그 밖                                                           |
| -------------- | --------------------------------------------------------- | -----------------------------: | ----------------------: | --------------------------------------------------------------- |
| props-commit   | 66,484 (`react-dom` onkeydown) — 93%                      |                     3,734 — 5% |          1,096 — 1.5%   | —                                                               |
| style-commit   | 66,621 — 92%                                              |                     3,531 — 5% |          1,851 — 2.6%   | —                                                               |
| undo           | 71,467 (`useKeyboardShortcutsRegistry.ts` keydown) — 94% |                     3,573 — 5% |          1,172 — 1.5%   | —                                                               |
| page-switch    | 29,601 (`react-dom` onclick) — 53%                        |                     4,380 — 8% |                       — | `panToPage.ts` rAF 11,821 — 21% · React scheduler 6,266 — 11%   |
| canvas-select  | 6,453 (`useCentralCanvasPointerHandlers.ts` pointerdown) — 87% |                    73 — 1% |                       — | 강제 style/layout 403 · render 644                               |
| layers-select  | 5,668 onclick + 1,773 onfocusin — 60%                     |                       344 — 3% |                       — | 미귀속 2,087 · render 1,234 · 강제 style/layout 645              |

600 도 같은 모양이다 (commit 계열 입력 이벤트 task 93 ~ 94%, rAF 5%).

**버킷 판정 (breakdown §2-3)**:

- **a + b (입력 이벤트 task)**: commit · undo 에서 92 ~ 94%. Event Timing 분해도 같다 — 5k props-commit p95 872 중 processing 805. 핸들러 · 러너 (a) 와 React 동기 커밋 (b) 은 같은 task 안이라 LoAF 로는 나뉘지 않는다. 그 비율을 가를 CPU profile run 은 중단으로 없다 (§8-6). 다만 스모크 profile (시드 60 · 4x · 같은 빌드) 에서 commit 계열 pre-paint 시간의 약 70% 가 React work loop (b), 러너 · 핸들러 (a) 5 ~ 7%, rAF (c) 약 20% 였고, b 의 상위 파일은 `BuilderCanvas.tsx` · `buildSceneSnapshot.ts` · `canonicalSceneModel.ts` · `useLayoutPublisher.ts` (캔버스 scene · layout 재구성 — 다음 paint 에 필요) 였다.
- **c (rAF 렌더)**: 5 ~ 8%. page-switch 는 `panToPage` 카메라 이동 rAF 가 21% 더 있다 — 그 프레임 자체라 분할 대상이 아니다.
- **d (다음 paint 에 불필요)**: 입력 task 밖의 저장 콜백은 1.5 ~ 2.6% 이고 대부분 paint 뒤에 돈다. 입력 task 안의 저장 첫 조각은 `splitDocument` 의 8 ms 조각 하나가 상한이다 (`incrementalDocuments.ts:49-79`, 두 번째 저장 호출은 `tail` 에 줄서 다음 task 로 간다) — 5k commit 의 pre-paint 872 ms 중 약 1%. 스모크 profile 의 d 도 pre-paint 2 ~ 3%. **30% 문턱에 닿는 경계가 없다.**
- **e**: 강제 style/layout 은 select 계열에서만 보인다 (canvas-select 403 · layers-select 645 ms / 30 입력) — DOM 축, 범위 밖.

### 8-4. G0 분기 판정

| 분기 | 조건                                                            | 결과                                                                                                                                                         |
| ---- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ①    | 모든 대상이 HC2 기준 이내                                       | **아님** — 4x · 600 에서 7종 초과 (canvas-select 104 는 경계), 4x · 5k 에서 5종 초과 (commit · undo · page-switch · burst)                                  |
| ③    | 기준 초과 + 다음 paint 에 불필요한 작업이 long task 의 30% 이상 | **아님** — 버킷 d 상한 약 1 ~ 3%                                                                                                                             |
| ②    | 기준 초과 + 지배 버킷이 다음 paint 에 필요한 작업               | **해당** — 지배 구간이 입력 이벤트 task (러너 · React 동기 커밋, 캔버스 scene/layout 재구성) 와 rAF 렌더. 이 ADR 에서 구현하지 않고 작업 감소 후속을 사용자 결정으로 |

b 중 "다음 paint 에 필요 없는 구독자" (Layers · 헤더 등) 는 이 데이터로 크기를 가를 수 없다. 그러나 그 구독자도 Zustand `useSyncExternalStore` 구독이라 transition lane 으로 미뤄지지 않고 (ADR-069, `useCanvasElementSelectionHandlers.ts:79-83`), 분리하려면 구독 구조를 줄이는 것 — 대안 D (작업 감소) — 이 된다. 어느 쪽이든 분할 (대안 A) 의 대상이 아니므로 분기는 ②로 같다.

규모 의존이 분명하다: 같은 commit 이 600 → 5k 에서 4x 200 → 872 ms (4.4배), 1x 88 → 256 ms. 입력마다 도는 작업이 문서 크기에 비례한다 (메모리 `project-mutation-cost-scales-with-document-size` 와 같은 방향).

### 8-5. 기존 `startTransition` 래핑 (R7) — 도달 경로

| 위치                                                                  | 이번 8종에서 도달? | 기록                                                                                                                                  |
| --------------------------------------------------------------------- | :----------------: | ------------------------------------------------------------------------------------------------------------------------------------- |
| `useIframeMessenger.ts` 7곳                                           |         ✗          | Preview → builder 메시지 (Preview 상호작용) 전용. Preview 는 열지 않았다                                                              |
| `BuilderCanvas.tsx:1694` 주석 "Phase 18: startTransition … INP 개선" |         ✗          | 주석만 남음 — 핸들러는 ADR-069 에서 래핑을 제거했다 (`useCanvasElementSelectionHandlers.ts:79-83`)                                   |
| `useOptimizedStyleActions.ts:254` `updateStylesTransition`            |         ✗          | 호출처 0                                                                                                                              |
| `PagesSection.tsx` 6곳                                                |    ✓ (page-switch) | 켬/끔 대조 미수행 (§8-6). 5k page-switch 에는 React scheduler task 6,266 ms / 30 입력이 따로 잡힌다 — 래핑된 render 가 paint 전에 돈다 |

### 8-6. 수행하지 않은 것 (측정 중단)

- CPU profile 귀속 run 2개 (Chrome 4x · 600 / 5k) — a · b 비율과 b 의 구독자별 크기. 판정은 LoAF 진입점 + 코드상 d 상한 + 스모크 profile 로 했다.
- WebKit 5k run 3 (2 run 만 있음).
- `PagesSection` `startTransition` 켬/끔 대조.
- 실제 프로젝트 참고 열.

이 넷은 분기 판정을 바꾸지 않는다 — d 의 상한이 코드 구조 (첫 8 ms 조각) 로 정해지고, 나머지는 a/b/c 내부 비율이다.
