# 인수인계 — GPU 지표 재수집과 preparation-skip 단독 귀속 (2026-09-06)

작성: Claude 세션. 수신: 재측정 하니스를 쥔 세션.
선행 문서: `docs/migrations/evidence/frame-performance/review-verification/findings.md`
(CPU 재검증 결과 — 이 문서는 그 위에 남은 2건). 그 경로는 `.gitignore:127` 로 로컬 전용
raw evidence 영역이라 저장소에 없다. 이 인수인계만 추적 대상으로 둔다.
실행 설계 본문: [react-skia-zustand-frame-performance-design.md](../react-skia-zustand-frame-performance-design.md).

## 0. 이 문서가 필요한 이유 — 코드가 바뀌었다

findings.md (로컬) 의 실측은 **원본 immutable artifact** (P0 `/private/tmp/frame-prod-p0-fixed`,
P1 `/private/tmp/frame-prod-p1-final`) 에서 이뤄졌고 그 결론(CPU 32.955→21.094 ms/s,
36.0%)은 유효하다. 그 뒤 아래 2개 커밋이 main 에 반영됐고, **계측의 의미가 바뀌었다**.

| commit      | 내용                                                              |
| ----------- | ----------------------------------------------------------------- |
| `aa3c4d76a` | 판독 지적 10건 수리 (GPU 타이머 정확성 + 계측 게이트 + 정적 계약) |
| `7b1462997` | 정적 가드 리네임 내성 + `@vite-ignore` 판독 오탐 정정 + CHANGELOG |

그래서 **새 빌드로 재수집해야 하는 것**(§1)과 **아직 아무도 재지 않은 것**(§2)이 남는다.

## 1. GPU 지표 재수집 — 기존 GPU 수치 전부 무효

### 무엇이 왜 바뀌었나

`gpuTimer.ts` 의 `poll()` 이 `GPU_DISJOINT_EXT` 를 **결과 준비 전에** 조회하고 있었다.
`EXT_disjoint_timer_query` 는 조회가 플래그를 FALSE 로 리셋하므로:

- 뒤쪽 disjoint 판정(`const disjoint = gl.getParameter(...)`)이 항상 false — dead code.
- 결과가 아직 안 나온 poll 이 disjoint 를 보면 **아직 유효한 in-flight query 를 폐기**.
- 결과적으로 GPU throttling 이 걸린 구간에서 `valid` 가 0 으로 무너진다.

수리 후에는 결과가 준비된 뒤 한 번만 읽는다. 또 `resetSamples()` 가 `measuring` 중일 때
query 를 지우지 못한 채 `started=0` 으로 만들어 `valid > started` 가 되던 불변식 위반도
막았다 (`discardPending` 으로 표시해 그 표본을 어느 카운터에도 넣지 않는다).

**따라서 이 커밋 이전에 수집한 GPU 지표(p50/p95, valid/invalid 비율)는 재수집 대상이다.**
CPU 수치는 GPU query 가 없는 경로에서 잰 것이라 영향 없다.

### 새 게이트 — GpuTimer 가 capture 에서 분리됐다

이전에는 `frameCaptureEnabled` 하나가 GpuTimer 생성까지 겸했다. 이제 별도 opt-in 이다.

- 플래그: `window.__composition_GPU_TIMER_REQUESTED__` (`isGpuTimerRequested()`)
- 하니스: `perf-baseline.mjs --gpu-timer`, `createInstrumentedContext({ gpuTimer })`
- **기본값 off.** `--frame-capture` 만 주면 GpuTimer 를 만들지 않고 GL 조회도 없다.
- `development` 빌드는 종전대로 항상 생성한다 (변경 없음).
- 꺼져 있으면 capture source 의 `gpu` 가 `null` 로 나가고 나머지 지표는 그대로다.
- `frame-performance-exercise.mjs` 는 context-loss 판정이 `gpu.contextLost` 를 읽으므로
  자기 context 에서 `gpuTimer: true` 를 명시한다 (CPU A/B 가 아니라 섞일 여지 없음).

### 요청

`--frame-capture --gpu-timer` 로 GPU 지표를 다시 수집하고, `valid`/`invalid`/`dropped` 가
`started` 를 넘지 않는지 함께 기록. 이전 GPU 표본과 직접 비교하지 말 것 — 수집 규칙이
달라졌다.

## 2. preparation-skip 단독 귀속 — 4셀 factorial

findings.md 가 명시한 대로 지금까지의 실험은 **같은 시점의 factorial 이 아니다**:

> capture on/off 자체의 같은 시점 factorial 실험이 아니므로 이전 41.3% 와 이번 36.0%
> 차이를 GPU 오버헤드로 계산하지 않는다.

36.0% 는 **P1 변경 묶음 전체**(children Map 재사용 + preparation skip)의 효과이고,
preparation-skip 단독 효과가 아니다. 이 상태에서는 전체 G1 완료 판정을 올릴 수 없다.

### 요청 — 4셀

|                      | GPU 타이머 off              | GPU 타이머 on          |
| -------------------- | --------------------------- | ---------------------- |
| preparation-skip off | (A) 대조군                  | (C) GPU 계측 비용 측정 |
| preparation-skip on  | (B) 현재 보고값이 여기 해당 | (D)                    |

- `B − A` = preparation-skip 를 포함한 P1 묶음의 CPU 효과 (GPU 계측 없는 조건).
- `C − A`, `D − B` = GPU 계측 자체가 CPU 에 얹는 비용. 이게 41.3% 와 36.0% 의 간극을
  실제로 설명하는지 확인하는 유일한 방법.
- preparation-skip 단독 ablation 이 필요하면 children Map 재사용만 켠 arm 을 하나 더.

```bash
# CPU A/B (기본 — GPU 조회 없음)
pnpm perf:baseline -- --lane frame --frame-capture ...

# GPU 지표가 필요한 arm 에서만
pnpm perf:baseline -- --lane frame --frame-capture --gpu-timer ...
```

## 3. 하니스가 읽는 값이 바뀐 지점 (새 빌드로 재실행할 때만 해당)

`perf-baseline-frozen.mjs` (로컬) 로 원본 artifact 를 replay 하는 경로에는 영향이 없다.
**새 빌드로 다시 잴 때** 아래를 반영해야 한다.

| 항목                    | 이전                  | 지금                                                       |
| ----------------------- | --------------------- | ---------------------------------------------------------- |
| 미발생 counter          | 0 (zero-fill)         | `undefined` — `=== 0` 단언이 채널 유실에 반응하도록        |
| `reset()` 후 counter    | 키 삭제 → `undefined` | `0` (한 번이라도 fire 한 채널만)                           |
| `reset()` 과 gauge      | 이전 창 값 잔류       | 삭제 (0 은 허구의 측정치)                                  |
| `reset()` 과 readiness  | 이전 창 기록 잔류     | `null`                                                     |
| `clearFrame()`          | `mainSubmission` 증가 | `clearSubmission` — 빈 clear 가 latency 표본을 닫지 않는다 |
| dual surface early exit | 어느 버킷에도 없음    | `frameAborted` / `singleSurfaceFallback`                   |
| 폴링용 접근자           | `snapshot()` 만       | `counter(name)` / `probe()` — 배열 복사 없음               |

`waitForSubmission` 류 predicate 는 `counter("mainSubmission")` 을 쓰고, source 를 읽어야
하는 predicate 는 `probe()` 를 쓴다. rAF 주기로 `snapshot()` 을 부르면 latency 최대 1만 +
GPU samplesMs 최대 1만을 매 프레임 복사해 측정 대상 프레임을 교란한다.

## 4. 이번 인수인계에서 하지 않은 것

- GPU 지표 재수집과 4셀 factorial **실행** — 하니스와 격리 project URL 을 쥔 쪽 몫.
- 전체 G1 / 실행 설계 완료 재승격 — §2 결과 전까지 보류 유지.
- 저사양(P2) 판정, 전체 process CPU, pan/zoom 지연 — 종전대로 열려 있음.

## 5. 참고 — 판독 오탐 1건 기록

판독이 지적한 `@vite-ignore` 제거(빌드 차단)는 **오탐**이었고 `7b1462997` 에서 되돌렸다.
근거로 든 "wasm 미빌드 fresh clone·CI" 흐름이 없다 — `deploy.yml:98/165` 가 build 전에
`pnpm wasm:build:engine` 을 돌린다. 반대로 `@vite-ignore` 를 붙이면 Vite 가 경로를 번들에
넣지 않아 production 부팅이 404 로 95% 에 멈춘다. 같은 지적이 다시 오면 이 절을 참조.
