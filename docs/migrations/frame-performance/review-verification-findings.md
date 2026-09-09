# 계측 오염 지적 재검증 — 2026-09-06

## 판정

- GPU capture 경로와 출하 기본 경로의 차이는 확증. 기존 41.3%를 preparation-skip 단독 효과로 귀속한 판정은 유지하지 않는다.
- capture off production CPU 중앙값 32.955→21.094 ms/s, 35.992% 감소. CPU 감소 20% 항목만 충족하며 전체 G1 및 전체 실행 설계 완료를 재승격하지 않는다.
- perfMarks 토글만 직접 호출하면 on 표본이 남는다. 현재 하니스 reset 경로에서는 off 표본이 비며, 기존 off raw 5회도 모두 비었다. off arm 오염 주장은 해당 하니스에 대해 기각.

## CPU 실측 조건

원본 production artifact P0 `/private/tmp/frame-prod-p0-fixed`, P1 `/private/tmp/frame-prod-p1-final`. 각각 기존 manifest 38개 파일 SHA-256 전부 일치. 번들 수정 없이 capture 요청을 하지 않았다. 현재 dirty source의 GPU 분리 수정은 이 artifact에 포함되지 않으며 이번 검증 결과를 그 수정의 검증으로 해석하지 않는다.

Chrome headed, 1440×900, 정상 속도 M4 Pro, 600요소 기존 IndexedDB snapshot, 매 run 새 context. P0→P1 순서 5쌍, 10초 idle, CDP Performance threadTicks TaskDuration / Timestamp. 원본 하니스를 `perf-baseline-frozen.mjs`로 고정했다. 모든 run visible, capture null, page/console 오류 0. fixture SHA-256 `176cc167dd8de86391a25e746fa9f6266e4fc4afb3289ba0c96eac89319066d4`로 이전 실측 및 양 arm 모두 동일.

| pair | P0 CPU ms/s | P1 CPU ms/s |
| --- | ---: | ---: |
| 1 | 36.027 | 20.440 |
| 2 | 32.572 | 21.488 |
| 3 | 32.955 | 20.504 |
| 4 | 31.821 | 22.375 |
| 5 | 33.255 | 21.094 |

원시 결과는 `cpu-*-p*/*.json`, 집계는 `summary.json`, 실행 스크립트는 `paired.py`다. capture 외의 perfMarks/recorder/driver 비용은 포함된다. P1 cache/preparation 변경 묶음의 비교이며 preparation-skip 단독 ablation은 아니다. capture on/off 자체의 같은 시점 factorial 실험이 아니므로 이전 41.3%와 이번 36.0% 차이를 GPU 오버헤드로 계산하지 않는다. 저사양, 전체 process CPU, pan/zoom 지연 및 GPU 예산을 이번 idle 결과로 판정하지 않는다.

## 실제 GL 및 토글 검사

CPU 측정 이후 별도 브라우저에서 `isolation.mjs` 실행. 기존 P1 artifact의 capture false/true를 비교했다.

- capture false: 확장 조회 4회는 모두 CanvasKit 초기화/resize 스택. getQueryParameter 0회, capture API 없음.
- capture true: 확장 조회 5회 중 추가 1회는 SkiaCanvas 번들의 GpuTimer 생성자 스택. getQueryParameter 12회.
- 양 context에서 `observe(audit.on)` 1개 기록 → setRecordingEnabled(false) → 기존 count 1 잔류를 직접 재현.
- 이후 동일 context RECORDER_SCRIPT.start(off)는 기존 버퍼를 비웠으며, duringOff/off/afterHarness 모두 []. 이전 recording false도 정상 복원.
- `isolation.json`, 개별 JSON, PNG에 보존. page 오류 0.
- 첫 검사에서는 확장 조회 전체를 GpuTimer 생성으로 오인하여 4 !== 0 assertion 실패. CanvasKit 스택을 확인한 후 생성 경로/실제 query 조회로 판정을 교정했다. 해당 wrapper는 CPU 실측에는 사용하지 않았다.

## 기존 raw 및 게이트

기존 idle-1-off부터 idle-5-off까지 모두 measuredDurations {}, raw.perf [], page/console 오류 0. 하니스 테스트 13/13, perfMarks userTiming 테스트 4/4 PASS.

제품 코드 및 기존 dirty 파일 수정 없음. 전체 preflight는 다른 작업의 dirty 파일을 format할 수 있어 실행하지 않고 guard/diff check로 제한했으며 모두 PASS다. 이번 검증은 CPU 근거와 토글 격리 범위이며 시각 parity와 전체 readiness 플로우 재검증을 주장하지 않는다.
