# 프레임 성능 재검증 — 2026-09-06

상태: 재측정·6셀 효과 분리 완료. G1 PASS, GPU edit는 10초 FAIL / 30초 추가검증 PASS로 G5 및 전체 실행 설계 완료 보류.

선행: [GPU 재측정 인수인계](frame-performance-gpu-remeasure-handoff.md),
[실행 설계](../react-skia-zustand-frame-performance-design.md).

## 측정 대상과 대조군

- 기준 HEAD `d0f31008d` + 아래 GPU reset/context-loss 수정. 제품의 P1 경로와 연속 RAF는 유지한다.
- 동일 소스의 production 빌드 세 개를 임시 Vite transform으로 생성한다. `off`는 children Map 재사용과 preparation-skip 둘 다 해제, `map`은 children Map 재사용만, `full`은 실제 P1 코드다. 제품에 새로운 flag나 분기를 추가하지 않았다.
- 각 빌드에 GPU timer off/on을 교차해 6셀, 각 5회 반복한다. 홀수 반복과 짝수 반복은 실행 순서를 뒤집는다. 각 run은 새로운 browser/context와 동일 IndexedDB snapshot으로 시작한다.
- `off→map`은 children Map 재사용 효과, `map→full`은 Map 재사용을 유지한 preparation-skip 추가 효과, `off→full`은 P1 묶음 효과다. 동일 arm의 GPU off→on이 GPU 계측 비용이다. 과거 41.3%와 36.0%의 차이를 이 비용으로 계산하지 않는다.
- Chrome 152, Apple M4 Pro/ANGLE Metal, headed/foreground, 1440×900, DPR 1, 약 120Hz, throttle 1. `threadTicks TaskDuration / Timestamp`는 renderer main-thread task CPU이며 recorder/driver를 포함한다. 전체 process CPU나 Skia 전용 CPU가 아니다.
- 600개 seed를 포함한 합성 fixture: projection 601, resolved 659, render bounds 657. SHA-256 `176cc167dd8de86391a25e746fa9f6266e4fc4afb3289ba0c96eac89319066d4`. 규모 검증용이며 실제 사용자 문서 분포를 대표하지 않는다.
- idle/pan/zoom/edit 각각 nominal 10초. pan/zoom은 동일 600개 입력을 observer RAF 위상에 맞춰 보내며 실제 소요시간을 별도 기록한다. edit는 50회 폭 변경과 원복으로 cache invalidation을 포함한다.
- GPU timer off 셀도 frame capture와 perfMarks/recorder는 켜져 있다. 이는 GPU 계측의 비용을 분리하는 실험이며 모든 계측을 끈 출하 경로의 비용이라고 표현하지 않는다.
- 불리한 입력은 가시 집합 변경 pan, zoom/coverage 변경, layout을 변경하는 편집으로 포함한다. 준비 생략/Map 재사용의 on/off는 실제 구축 계수로 확인한다.

## 측정 중 확인한 GPU 계수 결함

`frameBegin → resetSamples → frameEnd → context loss → poll`에서 이전 창의 query를 새 창의 `invalid`에 더해 `started=0, invalid=1`이 되는 실패를 회귀 테스트로 재현했다. `discardPending`이면 context-loss 경로에서도 새 창의 invalid에 포함하지 않도록 수리했다. 현재 창에서 시작한 query의 context loss는 기존대로 invalid에 포함한다.

- RED: `gpuTimer.test.ts` 1 FAIL / 5 PASS (`invalid: 0` 기대에 실제 1).
- GREEN: GPU timer/frame capture/preparation/content cache 4 files / 23 tests PASS.
- 초기 pilot/수리 전 대조 결과는 로컬 `remeasure-20260906/`에 보존하고 최종 상대 효과 계산에 섞지 않는다.
- 최종 빌드는 `remeasure-20260906-final/manifest.json`의 artifact별 66개 파일 SHA-256과 source override SHA로 식별한다.

## 유효성 및 알려진 환경 한계

각 run에서 page error, request failure의 URL·시각, console error 시각, measurement 시작 시각, visibility, fixture checksum, 전체 호출/누적 시간, latency/GPU raw sample을 보존한다. 프레임 내부 폴링에서 snapshot을 반복 호출하지 않는다.

부팅 시 동일한 Pretendard 정적 폰트 URL 8건이 404를 낸다. 빌드 로그에도 해당 상대 URL 미해결 경고가 있다. 부팅 이전 오류를 숨기거나 전체 runtime 오류 0으로 표현하지 않는다. 측정 구간 오류는 허용하지 않으며, 모든 arm에서 같은 startup-only 현상인지 확인한다. 이 A/B는 해당 공통 환경 안의 비교다.

idle에서 입력 이벤트가 관측된 표본은 순수 idle 효과 계산에서 제외하고, 제외 사유와 원본을 보존한 뒤 다시 수집한다. 다른 시나리오의 유효한 표본은 유지한다. GPU idle의 `started=0`은 표본 없음이며 GPU 0ms를 의미하지 않는다.

## 원시 증거와 재현

로컬 경로: `docs/migrations/evidence/frame-performance/remeasure-20260906-final/`.

- `vite.ablation.config.mjs`, `serve.mjs`, `run-matrix.py`: 임시 대조 빌드와 직렬 실행.
- `perf-baseline-current.mjs`: 현재 하니스 사본에 HTTP 실패 URL/시각 및 전체 errorLog/측정 시작 시각 저장만 추가. driver·계측 창·요약 수식은 유지한다.
- `pair-*/frame-*.json`: 환경, 오류, 전체 raw 표본. `summary.json`과 `summarize.py`: 집계 및 불변식 검사.
- `manifest.json`, `gpu-reset-fix.diff`: 빌드와 소스 식별.

원시 증거는 `.gitignore`의 로컬 영역이다. 이 추적 문서에 최종 숫자·각 run·판정·한계를 남긴다. 저장 스냅샷은 인증 정보가 포함될 수 있어 `/private/tmp`에만 보존한다.

## 추가 검증 사전 계약 — GPU 편집 tail

최초 6셀×5회에서 pan/zoom 지연 및 GPU 예산은 통과했으나 edit GPU p95의 run 중앙값은 0.326666→0.944125ms, +0.617459ms로 +0.5ms 예산을 초과했다. 원본 실패를 보존한다. full arm의 run별 p95는 0.944125 / 0.322666 / 3.591999 / 0.293999 / 0.951124ms이며 각 run은 50~~51개 표본이다. 중앙 GPU 표본은 약 0.29ms로 같지만 0~~4개의 긴 표본 때문에 p95가 크게 변한다.

표본 부족/변동성과 지속적인 회귀를 구분하기 위해 같은 artifact·snapshot·GPU on·idle/pan/zoom 사전 입력을 유지하고 edit만 nominal 30초(150회 편집)로 늘린 독립 off/full 5쌍을 수행한다. 홀짝 순서를 뒤집고 전부 기록한다. 예산은 +0.5ms 또는 baseline 5% 중 큰 값으로 유지하며 이 검사도 실패하면 G5를 종결하지 않는다. 최초 10초 결과를 새 결과로 덮거나 통과할 때까지 반복하지 않는다. 코드와 타이머 수집 정책은 바꾸지 않는다.

## 6셀 idle 최종 결과

idle은 첫 block의 입력 3건 때문에 block 1 전체를 제외하고 block 2~~6을 사용했다. 첫 보충 시도에서도 입력 32건이 감지돼 해당 원본을 `excluded-idle-input32/`에 보존했다. 최종 보충 6셀은 모두 입력 0이다. pan/zoom/edit는 기존 block 1~~5를 사용한다.

| CPU ms/s (5회 중앙값) | GPU off | GPU on | on − off |
| --------------------- | ------: | -----: | -------: |
| 재사용 모두 off       |  31.376 | 33.724 |   +2.348 |
| Map only              |  23.407 | 23.572 |   +0.165 |
| P1 전체               |  20.639 | 21.146 |   +0.507 |

GPU off에서 P1 묶음의 감소는 **34.221%**다. Map 재사용만으로 **25.400%**, 그 Map을 유지한 preparation-skip 추가 효과는 **11.824%**다. 두 비율은 기준이 다르므로 합산하지 않는다. GPU on 셀의 P1 묶음 감소는 37.296%, skip 추가 효과는 10.290%다.

GPU 옵션 on−off 관측 차이를 표에 그대로 남긴다. 각 run의 분산이 있고 일부 범위가 겹치므로 이 값을 안정적인 고정 오버헤드로 일반화하지 않는다. 과거 41.3%−36.0% 차이를 설명하는 값도 아니다.

| arm / GPU  | block 2 | block 3 | block 4 | block 5 | block 6 |
| ---------- | ------: | ------: | ------: | ------: | ------: |
| off / off  |  31.237 |  31.376 |  31.122 |  32.678 |  32.971 |
| off / on   |  31.626 |  33.426 |  36.356 |  33.724 |  33.764 |
| map / off  |  22.499 |  23.374 |  23.485 |  23.889 |  23.407 |
| map / on   |  23.672 |  23.718 |  23.572 |  22.670 |  22.364 |
| full / off |  22.543 |  20.639 |  20.483 |  20.597 |  21.159 |
| full / on  |  21.436 |  21.146 |  20.668 |  21.439 |  20.327 |

P1 전체의 모든 유효 idle run에서 contentBuild/planBuild/mainSubmission/domainPublication은 0이고 RAF는 계속된다. off arm은 매 RAF children/content/plan을 구축하고, Map-only arm은 children 구축 0·cache hit 증가·content/plan 구축 유지로 실제 분기를 확인했다.

## 10초 상호작용과 GPU 판정

| 항목            | off 중앙값 ms | full 중앙값 ms |   차이 ms | 허용 증가 ms | 판정 |
| --------------- | ------------: | -------------: | --------: | -----------: | ---- |
| pan latencyP95  |     17.900000 |      17.500000 | -0.400000 |     1.000000 | PASS |
| zoom latencyP95 |     28.400000 |      28.800000 | +0.400000 |     1.420000 | PASS |
| pan gpuP95      |      1.861791 |       1.752124 | -0.109667 |     0.500000 | PASS |
| zoom gpuP95     |      1.899916 |       2.111791 | +0.211875 |     0.500000 | PASS |
| edit gpuP95     |      0.326666 |       0.944125 | +0.617459 |     0.500000 | FAIL |

GPU 계수는 지원 여부와 raw 길이를 검사했고 `valid + invalid + dropped + pending = started`를 모든 수집 창에서 확인했다. idle의 GPU percentile은 표본 없음으로 남긴다. GPU off arm의 source.gpu는 모두 null이다.

## GPU 편집 추가 검증 결과와 최종 판정

| pair | off n | off p95 ms | full n | full p95 ms |
| ---- | ----: | ---------: | -----: | ----------: |
| 1    |   150 |   0.309499 |    150 |    0.454124 |
| 2    |   151 |   0.367458 |    150 |    0.296499 |
| 3    |   150 |   0.294750 |    151 |    1.184458 |
| 4    |   150 |   0.347499 |    150 |    0.470750 |
| 5    |   150 |   0.295458 |    150 |    0.513250 |

30초 edit의 5쌍 p95 중앙값은 **0.309499→0.470750ms**, 차이 **+0.161251ms**로 +0.5ms 예산 안이다. 원시 표본은 off/full 각각 약 750개다. 큰 표본은 구간 초기에만 몰리지 않고 중간/끝에도 나타났다. 모든 run은 동일 checksum·visible·측정 구간 오류 0이고 query 계수 불변식이 유지된다.

**전체 G5와 실행 설계 완료는 보류한다.** 30초 독립 검증 통과는 원래 10초 프로토콜의 +0.617459ms 실패를 지우지 않는다. 두 구간의 tail 판정이 달라 현재 근거로 지속적인 제품 회귀라고 확정할 수도, GPU 편집 회귀가 없다고 종결할 수도 없다. GPU on/off의 CPU 효과 분리와 CPU/G1 판정은 이 불확실성과 별개다.

추가 run을 통과할 때까지 반복하지 않는다. 다음 작업은 같은 입력 trace의 query 시작/종료·CPU 제출·GC/자원 이벤트를 표본별 시각으로 대응시켜 짧은 edit tail의 원인을 좁히는 것이다. 원인 근거 없이 preparation-skip을 바꾸거나 회귀 예산/측정 창을 완화하지 않는다. P2는 저사양 재개 근거 미확보로 계속 보류한다.

## 복원 하니스 계약 수리

최초 실제 동작 검증은 pointer 선택, drag/Undo/Redo/refresh, presentation preview/cancel/commit/Undo, page switch를 통과한 뒤 첫 context restore에서 timeout이 났다. 별도 native WebGL probe에서 lost/restored 이벤트와 `clearSubmission=1, mainSubmission=1`, 정상 GPU context·surface·snapshot을 확인했다. 제품 복원 실패가 아니라 하니스가 `mainSubmission > 1`을 요구한 문제였다. 과거 clear가 main 계수에 섞이던 시절의 기대가 남아 있었다.

`frame-performance-exercise.mjs`는 복원 요청 직전 main 계수를 읽고, 그 뒤 **새 실제 main flush**가 관측될 때만 진행하도록 수리했다. 관측되지 않은 채널은 0으로 대체하지 않고 오류로 처리한다. readiness나 제품 제출 정책은 바꾸지 않았다. timeout 원본은 `runtime/`, native probe는 `restore-probe.json`, 수정 후 반복은 `runtime-corrected/`에 보존한다.

## 실제 동작·readiness·품질 검증

- `runtime-corrected/exercise.json`: 실제 pointer 선택과 drag/Undo/Redo/refresh, presentation preview/cancel/commit/Undo, page switch PASS. 20회 drag→Undo→실제 WebGL context loss/restore 후 같은 Canvas 영역 PNG가 바이트 단위로 일치했다. `restored.png`에서도 실제 populated Canvas를 확인했다.
- 20회 main/content/standby surface와 content snapshot 각 1, node picture 147, image 0, cleanup timer 0, DOM nodes 2589, listener 547로 일정했다. 강제 GC 뒤 JS heap 범위는 42,634,756~44,545,064 bytes이며 전체 heap 누수 부재를 뜻하지 않는다.
- settled idle content/plan/main submission 0, 지연 image 완료·font sync·resize 뒤 실제 제출, unmount 뒤 renderer source 0·RAF 0 PASS. runtime의 console 404 총 16건은 첫 진입과 refresh의 동일 폰트 URL로 분류했으며 page error는 0이다.
- 엄격한 cold 오류 게이트는 첫 진입의 폰트 404 8건 때문에 FAIL (`cold/`). 이 실패는 보존했다. 동일 오류를 별도 분류한 `cold-observe/`에서는 새 context 10/10이 matching project/revision 2의 실제 main 제출 후 ready가 됐다. 매 run 폰트 404 8건이므로 이 결과를 cold 전체 오류 게이트 PASS로 표현하지 않는다.
- 새 context UI ready 관측 중앙값 2005.9ms / max 2027.3ms, matching flush acknowledgment 중앙값 1810.9ms / max 1833.8ms. 같은 browser process이며 OS/browser-process cold 또는 p99 개선 주장이 아니다.
- focused 6 files / 28 tests, 하니스 13 tests, visual-parity 101 tests, `codex:preflight` PASS. visual-parity는 기존 smoke suite의 계약 검사이며 모든 픽셀/모든 catalog에 대한 일치 증명이 아니다.
- `cross-check`/직접 `review`: 이번 제품 수정은 GPU 표본 계수 경계이며 catalog/spec/Factory/CSS/Preview 소비 정책·실제 렌더 분류·readiness 승인 경로·Zustand 쓰기를 변경하지 않았다. 하니스 복원 조건은 실제 새 main 제출의 증가를 확인하고 clear를 제외한다. 새 CRITICAL/HIGH 코드 문제는 발견하지 않았으나 G5 edit tail와 공통 폰트 404는 위와 같이 열려 있다.
- 최종 artifact 각 66개 파일 및 GPU source override의 SHA-256이 측정 시작 manifest와 모두 일치한다. commit/push는 수행하지 않았다.
