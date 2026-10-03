# ADR-248 Phase 4e — G5 성능·저장·bundle 근거 (2026-10-03)

G5 (breakdown §6.2) 를 제품 Builder 연결 뒤 같은 장비 (Apple M4 Pro · Chrome 154 headless · 1440×900 · DPR 1) 에서 쟀다. 기준선은 ADR-243 종결 후 main HEAD `2a5c97099` (G0 freeze) 의 구 앱 production build 이며, 같은 commit 을 다시 빌드해 G0 bundle 수치 (Builder 1,413,531 · Preview 624,427 B) 와 byte 단위로 같음을 먼저 확인했다.

## 측정 착수 전 5-질문 (`measurement-validity` §1)

| #   | 답                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | fixture 는 G0 perf-baseline `mixed` 합성 문서 (Text/frame 격자) — **규모 전용**. 분포 지표 인용 없음.                                                                                         |
| Q2  | 불리한 조작 포함: leaf 크기 편집 (layout 재계산) · 원본 편집 (instance 12 fan-out) · 구조 이동·삭제 (5k 형제 목록) · 저장 · 새로고침.                                                         |
| Q3  | 대조군 = 구 앱 production build. 같은 조작을 각 앱의 공개 API 로 실행하고 A/B 를 교대 (짝수 run 구 → 새, 홀수 run 새 → 구). 결정적 카운트와 총비용 (dispatch → 화면 반영 frame) 을 따로 본다. |
| Q4  | 카운트는 제품 경로에서 잰다: 패널이 쓰는 `workspace.execute` · 실제 Canvas scene sync · autosave → IndexedDB. Phase 3 의 test entry 수치와 섞지 않는다.                                       |
| Q5  | 시간 oracle 은 브라우저 `performance.now` · `requestAnimationFrame` · IndexedDB head revision (두 앱 공통 정의). 저장 byte 는 G0 와 같은 serializer `TextEncoder(JSON.stringify(document))`.  |

## 1. 5k 제품 경로 결정적 카운트 — PASS

도구 [`scripts/adr248-g5-live.mjs`](../../../apps/builder/scripts/adr248-g5-live.mjs), 결과 [`248-phase4-g5/g5-live.json`](248-phase4-g5/g5-live.json). dev Builder 5175 에서 mixed 60/600/5k (+ 두 번째 page) 를 시드한 뒤, 한 노드를 선택한 상태 (Properties 패널 편집과 같은 상태) 에서 조작 1회 = 명령 1회 → 2 frame → autosave durable 까지를 센다. body 는 `display: block`, seed 는 absolute.

| 조작 (5k)                 | graph 순회 | 전체 export | 64 KiB+ 직렬화 | layout 입력 방문 | resolver 방문 | WASM `updateStyleRaw` | geometry 읽기 (id) | Skia patch root | rebind      | IDB 쓰기 (entries) |
| ------------------------- | ---------: | ----------: | -------------: | ---------------: | ------------: | --------------------: | -----------------: | --------------: | ----------- | -----------------: |
| leaf 텍스트               |          0 |           0 |              0 |                1 |             2 |                     1 |                 18 |               1 | 0           |          1 (851 B) |
| leaf 너비                 |          0 |           0 |              0 |                1 |             2 |                     1 |                 19 |               1 | 0           |          1 (851 B) |
| 원본 편집 (instance 12)   |          0 |           0 |              0 |               13 |            39 |                     0 |                 25 |              13 | 0           |          1 (797 B) |
| page 전환                 |          — |           0 |              0 |                — |             — |                     0 |                  8 |               0 | 0           |                  0 |
| 이동 (body 형제 5,000 안) |          0 |           0 |              1 |            5,001 |         5,001 |                     0 |              7,520 |               0 | `structure` |      1 (159,471 B) |
| 삭제                      |          0 |           0 |              1 |            5,000 |         5,000 |                     0 |              7,516 |               0 | `removed`   |      1 (159,442 B) |

- leaf 텍스트 · 너비 · 원본 편집 · page 전환의 값은 60 / 600 / 5k 에서 **같다** (영향 집합 비례). 원본 편집은 영향 instance 수 (12 + template 1) 에 비례한다.
- page layout signature 경로 (`scene/layoutCache.ts` · `hooks/useLayoutPublisher.ts` · `renderers/invalidationPacket.ts`) 는 4e-9 에서 삭제되어 호출 0 (파일 부재를 스크립트가 기록).
- 전역 ref 검색: graph 의 전체 열거 경로 (`exportDocument` · `indexes` 직접 읽기) 호출 0, 원본 편집은 `instancesOf` 역인덱스로 13.
- **이 측정이 찾은 결함 (수리 `4f303b83d`)**: 수리 전 leaf 편집 1회가 5k 에서 geometry 42,515 id (텍스트) · 47,515 id (너비) 를 읽었다 — 줄바꿈 후보가 부모 subtree 전체였고 Canvas geometry region 이 absolute 박스의 형제 4,999 개를 비교했다. 명령 시간 68.5 → 7.6 ms, 원본 편집 59.9 → 1.2 ms. 원복 RED 2/2.
- 처음 측정은 시드 insert 가 5,000 개를 모두 선택한 채로 남아 하단 액션 바가 편집마다 정렬 명령 8 개를 선택 전체 geometry 로 다시 계산했다 (선택 크기 비례). 측정 조건 오류로 분류하고 선택을 비운 뒤 다시 쟀다. 큰 다중 선택에서 편집마다 정렬 가능 여부를 다시 계산하는 비용은 후속 후보로 남긴다.
- **구조 이동·삭제는 O(형제 + scene)**: 같은 부모의 형제 목록 재계획 (layout 방문 5,001) 과 scene 전체 rebind 가 든다 (5k 에서 약 200 ms). §6.2 는 구조 편집을 따로 판정하라고 정하며, G5 의 paired 조작 목록 (선택 · 개별 편집 · 원본 편집 · page 전환 · save/load) 밖이다. 최적화 후보로 기록한다.

## 2. 저장 byte — PASS 5/5

같은 live 실행에서 저장된 문서를 G0 serializer 로 쟀다. library snapshot byte 0 (프로젝트 definition entry 0).

| 노드 | 구 B (G0) | 새 P (`exportDocument`) | IndexedDB (heads + entries) | 허용 (§6.2 식) | 판정 |
| ---: | --------: | ----------------------: | --------------------------: | -------------: | ---- |
|    0 |    76,182 |                   1,279 |                       1,853 |         80,278 | PASS |
|    1 |    76,823 |                   1,715 |                       2,445 |          6,144 | PASS |
|   60 |   121,583 |                  28,310 |                      38,244 |         59,856 | PASS |
|  600 |   534,201 |                 274,807 |                     368,981 |        554,998 | PASS |
| 5000 | 3,926,667 |               2,306,943 |                   3,087,517 |      4,625,957 | PASS |

## 3. initial / boot bundle — PASS (Preview 는 사용자 판정 a)

도구: 정적 initial closure [`adr209-bundle-closure.mjs`](../../../apps/builder/scripts/adr209-bundle-closure.mjs) (ADR-201 정의), 부팅 중 실제로 받은 JS [`adr248-g5-boot-bundle.mjs`](../../../apps/builder/scripts/adr248-g5-boot-bundle.mjs) (§6.2 「로더 boot 비용까지 실제 번들에 포함」). gzip level 9, 파일별 합.

| 대상    | 구 정적 initial | 새 정적 initial | 구 부팅 JS | 새 부팅 JS | ADR-201 상한 (2026-10-25 만료) |
| ------- | --------------: | --------------: | ---------: | ---------: | -----------------------------: |
| Builder |       1,413,531 |       1,228,752 |  1,543,950 |  1,268,170 |                      1,421,000 |
| Preview |         624,427 |         394,104 |    624,427 |    645,249 |                        623,000 |

- 새 Preview entry 는 catalog Preview 앱을 **조건 없이** 동적 import 한다 — 정적 initial 은 394,104 B 지만 부팅 비용은 그 closure 전체다. 측정 당시 699,110 B 였고, 4e-14-2 (`8f057996a`) 에서 Preview 부팅 집합에 실리던 Canvas 전용 코드 (Skia 변환 · layout 입력 utils · 이미지 cache) 와 저작 명령을 빼 645,249 B 로 줄였다 (import gate 로 고정).
- 남은 초과 22,249 B (구 앱 대비 +20,822 B, +3.3 %) 는 새 runtime 이 Preview 에 들고 오는 graph · 검증 · resolver · code library 의 몫이다. 모듈 단위 개별 gzip 합은 구 977,633 vs 새 979,678 로 거의 같고, 구 Preview 의 router · 구 renderer 제거분과 상쇄된다. 실제 gzip 차이의 대부분은 chunk 수 (22 → 33) 에 따른 압축 공유 감소다.
- 정적 import 로 합치면 Preview 는 −2.7 KB 지만 Builder initial 이 +17 KB 늘어 쓰지 않았다.
- **사용자 판정 (2026-10-03, (a))**: 부팅 기준은 ADR-201 정의 (정적 initial closure) 로 읽는다 → Preview 394,104 ≤ 623,000 PASS. 상한 변경 없음. 부팅 JS 645,249 B 는 기록값으로 남기고, 추가 감량 (컴포넌트 묶음 lazy · snapshot 검증 생략) 은 하지 않는다. 다른 안은 (b) Preview 동작 변경 감량, (c) Preview 상한 재승인이었다.

## 4. paired p95 — PASS 36/36

도구 [`scripts/adr248-g5-paired.mjs`](../../../apps/builder/scripts/adr248-g5-paired.mjs), 결과 [`248-phase4-g5/paired.json`](248-phase4-g5/paired.json) (run 별 표본 전체). 두 production dist 를 같은 장비에서 정적 서버 (`/composition/` base) 로 띄우고, 앱마다 dashboard → 새 프로젝트 → mixed N 시드 + 두 번째 page (빈 body) + `perf-seed-1` 원본과 instance 12 를 각자의 공개 API 로 만든다 (구: element store action · 새: catalog 명령). 새 앱 dist 는 `VITE_COMPOSITION_HARNESS=1` 로 하니스 핸들만 켠 build 다 — 일반 build 와 bundle 크기가 같고 핸들 문자열만 없다.

- run = 새로고침 → ready → 1.5 s 안정 → CPU throttle → 조작마다 warm-up 5 회 뒤 100 회, 각 입력은 dispatch 부터 그 뒤 두 번째 `requestAnimationFrame` (변경이 화면에 반영된 frame) 까지. 입력 간격 50 ms. save 는 명령부터 저장된 head revision 이 바뀔 때까지 (5 ms poll), load 는 새로고침부터 ready 까지 20 회.
- A/B 5 run 씩 교대 (짝수 run 구 → 새, 홀수 run 새 → 구). run 별 p95 의 중앙값으로 판정: 새 ≤ 구 × 1.10 + 2 ms (save · load + 10 ms).
- 구 앱은 원본 편집이 instance 에 닿을 때 세션당 한 번 확인 대화상자를 띄우므로 run 시작 때 승인해 둔다 (새 앱 명령은 묻지 않는다).

값은 구 → **새** (허용), ms, run 별 p95 의 중앙값:

|  노드 | CPU | 선택                       | 개별 편집                    | 원본 편집                    | page 전환                  | 저장                         | 불러오기                         |
| ----: | :-: | -------------------------- | ---------------------------- | ---------------------------- | -------------------------- | ---------------------------- | -------------------------------- |
|    60 | 1x  | 16.4 → **16.54** (≤20.04)  | 16.82 → **16.43** (≤20.5)    | 16.77 → **16.55** (≤20.45)   | 16.78 → **16.46** (≤20.46) | 22.42 → **13.22** (≤34.66)   | 943.2 → **704.65** (≤1047.52)    |
|    60 | 4x  | 17.88 → **17.78** (≤21.67) | 40.69 → **17.87** (≤46.76)   | 36.12 → **17.81** (≤41.73)   | 17.72 → **17.77** (≤21.49) | 52.18 → **13.74** (≤67.4)    | 1538.05 → **1111.15** (≤1701.86) |
|   600 | 1x  | 16.6 → **16.39** (≤20.26)  | 31.42 → **16.27** (≤36.56)   | 32.46 → **16.11** (≤37.71)   | 16.95 → **16.44** (≤20.64) | 37.15 → **13.64** (≤50.87)   | 1032.1 → **747.45** (≤1145.31)   |
|   600 | 4x  | 17.78 → **17.94** (≤21.56) | 91.55 → **17.86** (≤102.7)   | 73.54 → **17.72** (≤82.89)   | 23.62 → **17.7** (≤27.98)  | 116.16 → **15.6** (≤137.78)  | 1824.65 → **1277.15** (≤2017.12) |
| 5,000 | 1x  | 17.06 → **16.47** (≤20.77) | 139.74 → **33.67** (≤155.71) | 110.38 → **32.35** (≤123.42) | 30.99 → **17.28** (≤36.09) | 167.05 → **23.27** (≤193.76) | 1620.05 → **1018.5** (≤1792.06)  |
| 5,000 | 4x  | 17.8 → **17.91** (≤21.58)  | 539.77 → **41.63** (≤595.75) | 432.67 → **33.1** (≤477.94)  | 100.7 → **18** (≤112.77)   | 649.66 → **43.18** (≤724.63) | 3778.25 → **1805.2** (≤4166.08)  |

- 표본 오류 0 (page/console). 선택 · page 전환 (일부) · 60 노드의 대부분은 두 앱 모두 1 frame (16.7 ms 근처) 이라 frame 양자화 바닥이다 — 같음으로 읽는다.
- 크기에 따라 구 앱이 늘어나는 조작 (개별 편집 · 원본 편집 · 저장 · page 전환 · 불러오기) 에서 새 앱은 거의 평평하다. 5k 4x 개별 편집 539.8 → 41.6 ms, 저장 649.7 → 43.2 ms. 이는 §1 의 영향 집합 비례 카운트와 같은 방향이다.
- trial (조작 10 회, warm-up 없음) 에서 새 앱 선택이 33 ms 로 나왔다 — run 첫 선택의 하단 액션 바 첫 mount · shader 준비였고 dev profile 로 확인했다 (이후 16 ms). §6.2 「warm-up 제외」에 맞춰 warm-up 5 회를 두었다.

## 5. retained heap — PASS 9/9

도구: 기존 `perf-baseline.mjs --lane leak` (G0 와 같은 옵션 — cycles 9 · warm-up 1 · select/edit/pages · Navigator·Properties 열림 · 강제 GC 뒤 `JSHeapUsedSize`). 두 production dist 를 같은 정적 서버로 띄웠다. 새 앱은 하니스가 구 store 호출을 catalog 명령으로 옮기는 층 ([`scripts/perfCatalogFacade.mjs`](../../../apps/builder/scripts/perfCatalogFacade.mjs)) 으로 같은 동작을 한다. 결과: [`248-phase4-g5/heap/`](248-phase4-g5/heap/).

| 노드 | 조작 | 구 첫→끝 (MiB) | 새 첫→끝 (MiB) | 새/구 (끝) | 하니스 신호 (구 / 새) |
| ---: | ---- | -------------- | -------------- | ---------: | --------------------- |
|   60 | 선택 | 28.09→28.93    | 24.38→25.07    |       0.87 | `LEAK?` / ok          |
|   60 | 편집 | 31.03→32.00    | 25.50→25.80    |       0.81 | `LEAK?` / ok          |
|   60 | page | 31.74→32.32    | 24.88→25.12    |       0.78 | ok / ok               |
|  600 | 선택 | 33.51→34.31    | 29.42→30.01    |       0.87 | `LEAK?` / ok          |
|  600 | 편집 | 38.71→39.95    | 30.36→30.63    |       0.77 | `LEAK?` / ok          |
|  600 | page | 38.85→39.41    | 28.16→28.42    |       0.72 | ok / ok               |
| 5000 | 선택 | 74.75→75.54    | 66.41→66.97    |       0.89 | ok / ok               |
| 5000 | 편집 | 98.78→100.81   | 67.39→67.66    |       0.67 | `LEAK?` / ok          |
| 5000 | page | 94.07→94.51    | 52.84→53.10    |       0.56 | ok / ok               |

- 상한 ≤ 1.20 배 — 전부 통과. page/console 오류 0.
- 구 앱은 G0 와 같은 조작에서 `LEAK?` 조사 신호를 다시 냈고 (G0 README §성능 표본), 새 앱은 9 개 모두 ok 다. 조사 신호는 누수 확정이 아니며 새 앱의 누수 PASS 근거로도 쓰지 않는다 — 비교 상한 판정만 한다.

## 6. WebKit 기능 확인 — PASS 4/4

도구 [`scripts/adr248-g5-webkit.mjs`](../../../apps/builder/scripts/adr248-g5-webkit.mjs) (Playwright WebKit, dev 5175), 결과 [`248-phase4-g5/webkit.json`](248-phase4-g5/webkit.json): 새 프로젝트에 frame 240×120 과 Text 를 명령으로 삽입 → Canvas scene bounds 240×120 · Text 높이 24 → undo/redo → 저장 뒤 새로고침에서 같은 entry → page/console 오류 0. G0 [WebKit smoke](248-baseline/webkit-smoke.json) 와 같은 범위의 기능 확인이며 WebKit 성능이나 전체 type·상태 parity 는 아니다.

관찰: width 를 주지 않은 absolute Text 의 상자 폭은 1920 이다 (Chromium 도 같다). Text 의 layout 입력에 catalog 규칙의 `width: 100%` 가 있어 흐름 안 Text 와 같은 폭이 된다 — WebKit 고유 동작이 아니다.

## 7. ADR-246 count ratchet 재기록

`perf-baseline.mjs` (ratchet 측정기) 는 구 element store 핸들로 시드·선택·편집했다 — 새 앱에서는 돌지 않아 병합 뒤 pre-push ratchet 이 막힌다. 하니스에 catalog 층 ([`perfCatalogFacade.mjs`](../../../apps/builder/scripts/perfCatalogFacade.mjs)) 을 붙여 같은 부류 (60: select · edit · page-switch · panel-toggle, call counts / 600: select · edit) 를 새 앱 dev 서버에서 2 회씩 재고 `perf-ratchet-gate.mjs --init` 으로 [`perf/ratchet.json`](../../../apps/builder/perf/ratchet.json) 을 새 앱 기준으로 다시 만들었다 (구 기준은 구 모듈의 `v8.fn.<file>` 키라 새 앱과 비교할 수 없다). 같은 결과로 `--judge` 하면 A 초과 0 · 하향 가능 16. recorder 해시는 바뀌지 않았다 (층은 recorder 밖).

기준 재설정은 cutover 로 측정 대상 코드가 통째로 바뀐 데 따른 것이며 상한 완화가 아니다 — 구 기준과 새 기준은 같은 지표 이름을 공유하지 않는다.

## 판정 요약

| 항목                             | 판정                                                                  |
| -------------------------------- | --------------------------------------------------------------------- |
| 5k 제품 경로 결정적 카운트       | PASS (구조 이동·삭제 O(N) 은 기록)                                    |
| 저장 byte                        | PASS 5/5                                                              |
| initial bundle (ADR-201 정의)    | PASS (Builder 1,228,752 · Preview 394,104)                            |
| Preview 부팅 JS (§6.2 로더 포함) | 기록값 645,249 — 사용자 판정 (a): ADR-201 정의 (정적 initial) 로 PASS |
| paired p95                       | PASS 36/36                                                            |
| retained heap                    | PASS 9/9                                                              |
| WebKit 기능                      | PASS 4/4                                                              |
| ratchet                          | 새 앱 기준 재설정                                                     |
