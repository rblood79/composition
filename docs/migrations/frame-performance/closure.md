# 프레임 성능 실행 종결 검증

2026-09-06. P0/P1/P3 완료, P2 보류로 종결. 런타임은 production `p1-closure` artifact에서 검증했다.

## 규모·입력 다양성

| fixture | 현재 페이지 projection | resolved input / bounds | P0→P1 idle content build / 10초 | checksum / 오류 |
| --- | ---: | --- | --- | --- |
| 60 | 61 | 119 / 117 | 1201→0 | 동일 / 0 |
| 5000 | 5001 | 5059 / 5057 | 1200→0 | 동일 / 0 |
| text | 601 | 659 / 657 | 1201→0 | 동일 / 0 |
| refs | 13 | 852 / 429 | 1201→0 | 동일 / 0 |

각 fixture는 idle/pan/zoom/select/edit 각 10초, 동일 snapshot A/B 1쌍이다. 600요소 5쌍 효과를 다른 규모로 일반화하지 않는다. text는 Text 600개와 400/500/600/700 fontWeight, refs는 60-child origin + 12 instances이며 projection 수와 실제 resolved 수를 혼동하지 않는다. refs 재실행은 library로 옮겨진 origin child를 중복 seed하지 않고, 현재 페이지의 실제 instance를 선택·편집한다. 최초 `fixture-refs-p1`은 하니스 smoke로만 보존한다.

## Cold 부팅

같은 Chrome process의 새 context 10회다. 이전 context HTTP cache/storage mutation은 공유하지 않고 같은 초기 저장 snapshot을 주입했다. 새 OS process/OS font cache cold 측정과 구분한다. 모두 matching project/revision 2의 실제 main submission 후 ready가 관측됐고 오류 0이다.

- UI ready 관측 ms: 2124.7, 2115.0, 2117.7, 2112.6, 2128.4, 2124.1, 2107.7, 2116.8, 2121.1, 2129.7. 중앙값 2119.4, max 2129.7.
- Matching flush 직후 acknowledgment ms: 1937.6, 1927.8, 1935.1, 1925.0, 1943.7, 1938.5, 1917.7, 1929.7, 1934.8, 1941.5. 중앙값 1935.0, max 1943.7.
- 이 시각은 navigation 시작 이후 경과시간이다. render callback 자체의 duration과 같지 않다. 작은 표본의 cold p99 개선은 주장하지 않는다.

## 실제 동작과 자원

`frame-performance-exercise.mjs`는 실제 Chrome pointer로 요소를 선택·drag하며, production singleton store와 presentation API를 이용한다. 새 Vite query로 store를 import하거나 readiness를 강제로 바꾸지 않는다.

- pointer 선택/hit target 일치, pointer delta 동안 canonical publication 0, drop 이후 props 변경.
- Undo/Redo 및 refresh 후 props 일치. 같은 document 페이지 왕복 뒤 main submission 확인.
- Inspector와 같은 presentation runtime에서 opacity preview 동안 canonical 불변, cancel 재제출, commit 반영, Undo 원복. native color-picker gesture 전체를 실행했다는 의미는 아니다.
- 실제 WEBGL_lose_context 확장으로 20회 loss/restore. renderer source 1개, main/content/standby surface와 snapshot 각 1개, node picture 147개, image 0개, cleanup timer 0개로 복귀. query는 비차단이며 pending/invalid를 raw에 기록한다.
- 지연 PNG 응답을 실제 image cache가 소비한 후 새 main submission, 폰트 동기화 알림 후 새 제출, viewport resize 후 새 제출.
- font 검증은 기존 폰트 동기화 경로다. 신규 외부 폰트 다운로드/OS font cold 결과를 대신하지 않는다.
- minimap 1500ms 종료 뒤 settled 10초 content/plan/main submission/domain publication 모두 0. RAF 약1200회는 유지.
- SPA dashboard 전환으로 Canvas unmount 후 renderer source 0, 뒤 300ms application RAF 0. generation/readiness A→B와 낮은 revision 거부는 기존 lifecycle unit과 함께 검증.
- 첫 drag 하니스는 선택 클릭 250ms 뒤 down을 보내 double-click으로 분류되어 실패했다. 별도 drag 입력 간격을 둬 교정했다. 첫 settled 구간의 1회 제출은 minimap 종료 전 시작한 오류였고, 종료 이후 구간으로 재측정했다. 이 실패를 제품 결함 수리로 기록하지 않는다.

## 품질 게이트

- Focused Vitest 12 files / 79 tests PASS. 하니스 node 13 PASS.
- `gate:visual-parity`: 계약 3 + browser 98 = 101 PASS, exit 0. 기존 /appIcon.svg decode warning은 남아 있고 runtime capture 오류 0과 구분한다.
- `codex:preflight`: PASS. type-check baseline 0, registration 14, agent catalog/engine matrix/text-axis matrix 정상.
- `git diff --check`: PASS. 검증 로그는 `gates/`에 복사했다.
- 직접 review: cache 입력·수명/animation/readiness/SSOT 경계 확인, 범위 내 미해결 HIGH/CRITICAL 없음.

## 종결 경계

P2는 실제 저사양 P1 이후 renderer idle CPU ≥30ms/s 근거 미확보로 보류한다. on-demand wake exhaustive/mutation 검증은 적용하지 않는다. JSX/CSS/spec/Preview 정책은 바뀌지 않았으며 새로운 cache는 CPU node children Map만 소유한다. WASM resource를 새 cache에 보관하지 않는다. 전체 React profiler, 실제 저사양·다른 GPU, 신규 외부 font, 모든 fixture 5회 반복은 미측정이다. 이 한계를 일반적인 개선 완료 수치로 감추지 않는다.

원시 JSON·PNG·빌드 manifest는 repository가 무시하는 로컬 `docs/migrations/evidence/`에 있다. 버전 관리되는 실행 설계 §9에는 핵심 수치·적용 범위·보류 조건을 함께 남겨 로컬 evidence 부재 시에도 판정을 읽을 수 있게 한다.


## 반복 자원·픽셀 추가 검증

최종 runtime은 20회 **실제 drag→Undo→context loss/restore**를 결합했다. 모든 semantic props가 원복되고, 같은 선택 상태의 Canvas 내용 영역에서 복원 전/후 PNG 바이트가 동일했다. 초기 픽셀 비교 실패는 전체 Canvas element screenshot에 DOM 패널까지 합성되며 전후 선택 상태도 달랐기 때문이었다. `runtime-pixel-input-mismatch/`에 실패 이미지를 보존하고 동일 상태·동일 영역으로 재측정했다. 시각 차이에 허용 오차를 추가하지 않았다.

20회 main/content/standby surface와 snapshot 각1, picture147, image0, cleanup timer0, listener547, DOM nodes2589가 일정했다. 강제 GC 후 JS heap 43.38→45.51MB를 raw에 남겼다. 모든 JS/WASM 객체를 전수 추적한 누수 부재 증명이 아니다. 추가 측정 자체가 힙을 보유할 수 있으므로 생존 자원 계수와 heap을 구분한다.

G1 최종 CPU 근거는 [threadTicks 5쌍](p1-measurements.md#main-thread-task-cpu-별도-대조)의 33.47→19.65ms/s (41.3% 감소)다. G2는 P2 미실행으로 적용하지 않는다. G3/G4/G5/G6는 위 테스트·실제 동작과 명시된 측정 범위로 판정하며 다른 장비/모든 fixture 반복으로 일반화하지 않는다.
