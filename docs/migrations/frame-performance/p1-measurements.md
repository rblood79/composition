# 프레임 성능 P1 반복 측정

2026-09-06. production 정적 artifact, Chrome headed foreground, 1440×900 DPR 1. 600 합성 요소의 동일 IndexedDB fixture를 사용했다. 각 셀은 run 1–5 순서이며 누락 표본은 `없음`으로 기록한다. 원시 JSON은 같은 로컬 evidence 디렉터리에 보존한다. 인증 상태는 tmp에만 둔다.

## Idle 효과와 최초 입력 프로토콜

`paired-*`는 idle/pan/zoom/select/edit를 각 10초씩 5쌍 교대 실행했다. wheel 입력은 timer 기준 600회다. P0 pair 2의 낮은 task 값도 제외하지 않는다.

| 지표 | P0 5회 | P1 5회 | 중앙값 전→후 |
| --- | --- | --- | --- |
| idle render.frame inclusive ms/s | 17.87, 4.53, 14.87, 13.94, 15.79 | 2.89, 2.59, 2.56, 2.68, 2.62 | 14.87→2.62 |
| idle CDP TaskDuration wall ms/s | 41.05, 10.98, 33.05, 31.85, 35.90 | 22.84, 19.64, 18.81, 18.75, 19.27 | 33.05→19.27 |
| idle 양의 heap delta MB/s (GC 포함 근사) | 8.40, 8.40, 8.40, 8.40, 8.40 | 0.10, 0.10, 0.10, 0.10, 0.10 | 8.40→0.10 |

P1 idle 5회 모두 content/plan build, main submission, canonical publication 0이다. application RAF는 약 1,200회/10초로 계속된다. inclusive label 시간과 CDP wall task 시간은 OS thread CPU와 구분한다.

timer 기반 pan p95 중앙값은 14.1→15.7ms로 최초 G1 지연 기준을 넘었다. 이를 숨기지 않고 `pan-phase-*`에서 input/observer-RAF 위상을 기록했다. 재실행은 17.5→16.0ms로 방향이 반전됐고 위상 분포가 달랐다. 따라서 같은 입력 수만으로 G0 입력 시점 동등성을 보장할 수 없었다.

## RAF 위상을 고정한 지연 대조

`aligned-*`는 600개의 동일 wheel 입력을 observer RAF 두 번마다 하나씩 전달한다. 명목 10초이며 실제 구간 길이를 raw에 기록한다. P0/P1 모두 같은 프로토콜로 다시 5쌍 측정했고, 기준은 변경하지 않았다. p95는 각 run 유효 표본의 floor(n×0.95) 인덱스다.

| 시나리오·지표 | P0 5회 | P1 5회 | 중앙값 전→후 | 허용 회귀 |
| --- | --- | --- | --- | --- |
| pan latency p95 ms | 17.400, 17.500, 17.600, 18.200, 18.300 | 17.500, 17.600, 18.200, 18.200, 18.200 | 17.600→18.200 | +1.000 / PASS |
| pan gpu p95 ms | 1.152, 1.031, 1.036, 1.177, 1.194 | 1.182, 1.209, 1.153, 1.169, 1.177 | 1.152→1.177 | +0.500 / PASS |
| zoom latency p95 ms | 27.200, 26.900, 26.200, 26.600, 26.600 | 27.000, 27.200, 27.000, 27.100, 27.100 | 26.600→27.100 | +1.330 / PASS |
| zoom gpu p95 ms | 2.936, 2.897, 2.553, 2.587, 2.419 | 2.913, 2.818, 2.961, 2.806, 2.556 | 2.587→2.818 | +0.500 / PASS |

latency는 최신 DOM input→다음 성공한 main flush이며 scanout이 아니다. coalesced 입력은 한 표본으로 합친다. select/edit는 programmatic driver라 DOM input 표본이 없으며 0ms로 처리하지 않는다. 실제 pointer drag·선택은 별도 runtime exercise로 검증한다.

## GPU 표본과 변동성

| 시나리오 | P0 GPU p95 5회 | P1 GPU p95 5회 | 중앙값 판정 |
| --- | --- | --- | --- |
| select | 0.583, 0.330, 0.339, 0.352, 0.367 | 0.705, 0.411, 0.466, 0.316, 0.712 | 0.352→0.466 / PASS |
| edit | 0.543, 1.390, 0.362, 1.069, 1.290 | 3.308, 0.306, 1.531, 0.295, 0.470 | 1.069→0.470 / PASS |

edit GPU의 단일 최악 P1 p95 3.308ms는 보존한다. GPU 값은 비동기 query의 유효 표본만 사용하며 pending/invalid/unsupported를 0으로 치환하지 않는다. 구간 종료 직전 pending query가 1개 남을 수 있다. renderer idle에서도 poll하므로 마지막 query를 다음 RAF에서 회수하며, 캡처 경계 밖 결과는 해당 구간 percentile에 소급 합치지 않는다.

## Artifact와 한계

- P0: `/private/tmp/frame-prod-p0-fixed`, `p0-build-manifest.json`. production WASM 부팅 수리와 동일 계측을 포함하고 P1 cache/idle 생략은 없다.
- P1 측정: `/private/tmp/frame-prod-p1-final`, `p1-final-build-manifest.json`.
- 최종 기능 검증: `/private/tmp/frame-prod-closure`, `closure-build-manifest.json`. matching readiness 시각·전역 picture/image 생존 수 관측과 cache cleanup을 추가했다.
- 측정은 빌드·테스트·다른 브라우저 측정과 직렬 실행했다. GPU 장치·Chrome 버전·throttle·visibility·fixture SHA는 각 raw의 environment/fixture에 있다.
- 외부 작업자가 진행 중 HEAD를 `4d3345e1c`로 변경했다. 실행 중인 정적 artifact는 바뀌지 않았다. source HEAD만으로 서로 다른 artifact를 동일 빌드로 해석하지 않는다.
- 60/5,000/text/ref fixture는 정합성과 규모별 smoke 대조다. 5쌍 상대 효과 판정은 600 fixture에 한정한다. 모든 실제 문서·모든 GPU·저사양으로 일반화하지 않는다.
- 정상 production은 frame capture 기본 off다. React profiling build는 사용하지 않았으므로 전체 React commit 감소 수치를 주장하지 않는다.


## Main-thread task CPU 별도 대조

CDP `Performance.enable(timeDomain: threadTicks)`로 수집한 TaskDuration을 monotonic Timestamp 구간으로 나눴다. 정상 속도 기기의 renderer main-thread task CPU이며 recorder/driver도 포함한다. Skia 단독 CPU, 전체 process CPU, 저사양 기기 실측으로 부르지 않는다.

| build | 5회 CPU ms/s | 중앙값 |
| --- | --- | ---: |
| P0 | 33.629, 33.204, 33.767, 33.474, 33.158 | 33.474 |
| P1 | 19.574, 23.745, 19.529, 20.641, 19.652 | 19.652 |

상대 감소 **41.3%**로 G1의 20% 기준을 통과했다. 600 fixture 동일 checksum, 각 10초 idle 5쌍 교대, 오류 0이다. 내부 inclusive/wall-time 실측과 분리해 `thread-*` raw에 보존했다.
