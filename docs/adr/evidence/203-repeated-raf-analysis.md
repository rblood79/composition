# ADR-203 — 새 하니스 반복 측정과 RAF 지연 귀속

- 날짜: 2026-09-05. 기존 Phase 1 + NormalItemContent memo 로컬 구현 상태.
- 범위: 측정·분석만 수행. 제품 코드와 하니스 정본은 이번 작업에서 수정하지 않았다.
- 결론: **60요소 기존 callback drop 0%는 반복해서 보장되지 않는다. G1 열림 유지.** 큰 RAF stall 한 건은 CanvasKit flush 내부 WebGL 조회 대기로 귀속했다.

## 반복 측정

Chrome 152.0.7977.82, headless, 개발 서버 localhost:5173, 1440×900, 60요소, Navigator+Properties. 하나의 격리 프로젝트에서 external-props → ID-only를 3회 반복했다. 각 run은 현재 `runFrameLane` 그대로 idle 3초 → select 3초, 선택 간격 100ms, 패널 기본 높이를 사용했다. CPU throttle은 적용하지 않았다. 성능 측정끼리는 직렬 실행했다.

임시 `/private/tmp/adr203-repeat.mjs`는 현재 `perf-baseline.mjs`를 복사해 main의 호출 반복과 별도 trace 수집만 추가했다. [반복 원본](203-phase1/repeated-metrics.json)은 trace를 켜기 전 결과다. driver 순서를 무작위화한 비교가 아니므로 driver 간 우열을 판정하지 않는다.

| 회차 | driver         | callback p95 / max (ms) | 기존 dropPct | RAF timestamp 최대 / 초과 수 | longtask |
| ---- | -------------- | ----------------------: | -----------: | ---------------------------: | -------: |
| 1    | external-props |             22.4 / 30.3 |         1.1% |                   16.8ms / 0 |        0 |
| 1    | ID-only        |             20.6 / 24.8 |           0% |                   16.8ms / 0 |        0 |
| 2    | external-props |             19.7 / 24.3 |           0% |                   16.8ms / 0 |        0 |
| 2    | ID-only        |             20.1 / 24.5 |           0% |                   16.8ms / 0 |        0 |
| 3    | external-props |             19.5 / 30.3 |         1.1% |                   16.8ms / 0 |        0 |
| 3    | ID-only        |             19.6 / 28.8 |         0.5% |                   16.8ms / 0 |        0 |

첫 external-props의 callback 초과 2건 중 1건은 첫 callback 대기이며 rafGap은 null이다. 나머지 반복 선택 구간의 초과는 timestamp 간격 16.6–16.8ms에서 발생했다. 시작 대기를 제거해도 모든 run이 0%가 되지는 않는다. 기존 지표 정의나 표본을 바꿔 통과 처리하지 않았다.

## 큰 RAF 지연 — CanvasKit flush의 WebGL 조회

반복 run 이후 같은 프로젝트에서 CDP timeline + V8 sampling을 켜고 ID-only idle 10초 → select 10초를 실행했다. **이 계측 run은 G1 수치 대용이 아니다.** select callback 최대 108.2ms, RAF timestamp 최대 83.3ms, longtask 1회/91ms가 관측됐다. page/console 오류는 0이었다.

`performance.mark('adr203-trace-start')`의 trace ts와 startTime을 사용해 page performance 시각을 정렬했다. [귀속 근거 JSON](203-phase1/raf-trace-attribution.json)에 정렬 anchor, trace SHA-256, 해당 FunctionCall 이벤트, CPU stack, recorder 결과를 보존했다. 170,110개 이벤트의 원본은 `/private/tmp/adr203-repeated/trace.json`에만 있으며 장기 보존 파일은 아니다.

| page performance 시각 | 관측                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------- |
| 73319.491–73405.964ms | SkiaCanvas renderFrame의 FunctionCall: wall 86.473ms, thread CPU 9.095ms                          |
| 73406.000ms           | recorder callback 실행. gap 108.2ms, 전달받은 timestamp 간격은 아직 16.7ms, callback delay 92.1ms |
| 73410.900ms           | 다음 callback. 실행 간격 4.9ms, timestamp 간격 83.3ms                                             |

86.5ms 구간의 CPU stack 표본 663개 중 **610개가 `getProgramParameter`**, 9개가 `getShaderParameter`였다. 표본 수는 호출 횟수가 아니며 네이티브 대기 중 stack도 포함한다. 주요 JS 경로는 다음과 같다.

```text
SkiaCanvas.renderFrame
  → renderFrameCore → SkiaRenderer.render → renderDualSurface
  → present → CanvasKit Surface.flush
  → WASM → CanvasKit la → WebGL getProgramParameter
```

현재 로컬 CanvasKit glue의 `la`는 실제 WebGL `getProgramParameter`를 호출한다. wall 시간과 thread CPU 시간의 큰 차이, 해당 네이티브 호출의 지속적인 stack 관측은 **동기 WebGL 조회에서의 대기**를 지지한다. Navigator React collection 재구축 또는 JS GC가 이 86.5ms 구간을 차지했다는 근거는 없다.

셰이더 프로그램 상태 조회이므로 컴파일·링크 완료 대기는 후보지만, 원래 호출의 pname과 GPU process 작업은 수집되지 않았다. 따라서 **셰이더 컴파일이 확정 원인이라고 단정하지 않는다.** headless 환경에서의 결과를 사용자 GPU에서도 재현된 것으로 해석하지 않는다.

추가 격리 프로젝트에서 `getProgramParameter`에 2ms 초과 호출 기록을 붙여 ID-only 10초 trace를 재실행했다. callback drop 0.5%, timestamp 최대 16.8ms/초과 0, longtask 0, 느린 GL 조회 기록 0이었다. 큰 stall은 재현되지 않았으며 원래 stall의 pname은 여전히 미확정이다. 이전 분석의 133.4ms 미계측 stall까지 같은 원인으로 소급하지 않는다.

## 짧은 callback 지연 — React 작업과 실행 순서

같은 trace의 page 시각 74113.9ms timestamp → 74123.0ms callback 구간에서는 timestamp 간격이 16.7ms이고 callback 간격은 25.3ms였다. 그 직전 React DOM callback이 74112.795ms부터 **8.336ms** 실행됐고, Skia renderFrame은 74122.331ms부터 **0.586ms**였다. 이 구간은 대형 WebGL stall과 구분되는 React 작업 후 callback dispatch 지연이다. 이번 trace만으로 이 React 비용 전체를 Navigator 또는 Action Bar 하나에 귀속하지 않는다.

## 판정과 다음 작업

1. **G1 계속 열림**: 기존 60요소 callback drop 0%가 6개 run 중 3개에서 미달이다. 이번에는 600요소 및 DnD 전체를 다시 검증하지 않았으므로 Phase 1 종료 판정도 하지 않는다.
2. **큰 stall 조사 경계는 Canvas presentation**: 후속 조사에서는 실제 사용자 GPU/headed 조건의 재현, GPU process trace와 느린 WebGL 조회 pname을 함께 확보해야 한다. `present → Surface.flush` 경로까지는 귀속됐으나 강제 예열·캐시 리셋·RAF store 갱신을 추가할 근거는 없다.
3. **짧은 지연은 별도**: 기존 React 비용 분석에 따라 Action Bar 및 남은 RAC context 갱신을 조사할 수 있다. 큰 stall을 이유로 LayerTree 가상화를 되돌리거나 Properties 최적화를 시작하지 않는다.

이번 작업은 증거 문서·JSON만 추가했다. 제품 코드 테스트는 재실행하지 않았고 기존 후속 2의 unit/browser/preflight/parity PASS를 유지한다. 문서 포맷·guard·diff 검사를 수행한다.

후속: [headed GPU 3회 조사](203-headed-gpu-analysis.md)에서 M4 Pro Metal을 확인했지만 큰 stall은 미재현이었다. 현재 headless도 Metal을 보고하므로 renderer 전환 효과로 해석하지 않는다.
