# ADR-248 후속 성능 최적화 — 2026-10-05

대상은 `09da2e17c` 이후 큰 문서의 구조 이동·삭제 및 큰 다중 선택의 액션 바다. ADR-248의 Implemented 판정은 유지한다. 이 변경은 아래 반복 비용을 줄이며, 구조 작업 전체의 O(1)이나 기존 G5 전체 재검증을 주장하지 않는다.

## 원인과 수정

- Canvas 구조 갱신은 영향 subtree 전체를 비교한 뒤 geometry 전파에서 같은 root/children을 다시 조회했다. 한 번의 동기 `update()` 안에서 이미 읽은 ID를 제외한다. 다음 update에는 새 집합을 사용하며, 새로 영향을 받은 형제·조상은 계속 조회한다.
- 액션 바는 context menu를 준비하면서 정렬·분배 8개 명령마다 같은 선택 필드와 geometry를 읽었다. 이제 메뉴 생성마다 한 번 준비한다. 각 정렬 결과를 선택 배열에서 다시 `find`하던 이차 탐색도 ID→placement Map으로 바꿨다. 단축키의 개별 명령, command 검증, canonical 쓰기 및 Undo 계약은 유지한다.
- 장기 캐시는 추가하지 않았다. 크기·선택·문서 변경 후 새 메뉴가 새 geometry를 읽는다. 분배 최소 3개 조건을 충족하지 않는 개별 단축키는 조회하지 않는다.

## 측정 조건과 판정

| 질문           | 이번 근거와 한계                                                                                                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 출처           | 합성 absolute frame 600/5,000개. 규모 전용이며 실제 문서 분포의 대표 표본이 아니다.                                                                                                                                               |
| 불리한 입력    | 이동·삭제·Undo, flex/grid flow의 변경된 geometry와 렌더 명령, 정렬 대상 resize·선택 교체·Undo를 검증했다. 복합 Slot/breakpoint 전체 성능은 재측정하지 않았다.                                                                     |
| 대조군         | 같은 dev 서버에서 A/B/A/B/A/B 3쌍. A는 수정 전에 저장한 `09da2e17c`의 Vite 응답(shortcuts/canvasMenu/canvasBinding/CatalogActionBar)을 독립 browser context에 제공한다. B는 작업 트리다. 테스트와 동시 실행한 예비 쌍은 제외했다. |
| 실제 소비 경로 | CatalogActionBar → catalogActionBarModel → catalogCanvasMenuItems → catalogMenuHost.arrangeItems, Canvas → binding.update. 실제 Builder 액션 바 버튼으로 5,000개 왼쪽 정렬·Undo·저장·새로고침 성공.                               |
| oracle         | 손계산 x=20의 정렬 결과와 원래 열 위치, 삭제 후 개수·Undo 순서 확인. 증분 결과는 export 문서로 새로 만든 workspace/Canvas와 비교한다. 이 비교는 브라우저 CSS 픽셀 oracle을 대체하지 않는다.                                       |

Chrome headed, visible, 1440×900, DPR 1, 로컬 dev 서버. 각 쌍은 새 브라우저와 새 프로젝트다. precise coverage 없이 CDP TaskDuration으로 command부터 2 rAF 및 durable save 완료까지의 taskMs를 잰다. 카운트 instrumentation은 양쪽 동일하다. 저장이 rAF보다 늦으면 해당 저장 비용도 포함한다. retained heap/bundle/production p95는 이번에 재측정하지 않았다.

원인 탐색의 기존 frame profiler는 `--lane frame --fixed-inputs --call-counts --classes select,multi-select-edit --seed-count 600 --duration-ms 600 --headed`로 2회 실행했다. structure anonymous 카운트는 select 13,200, multi-select-edit 35,430, shortcuts anonymous는 4,920으로 두 번 일치했다. 이 짧은 탐색 결과로 기존 ADR-246 ratchet 상한을 낮추지 않았다.

| 규모  | 조작    | engine geometry ID 수 A → B | taskMs 중앙값 A → B |
| ----- | ------- | --------------------------- | ------------------- |
| 600   | 이동    | 1,211 → 610                 | 47.73 → 45.00       |
| 600   | 삭제    | 1,206 → 606                 | 14.65 → 14.73       |
| 600   | 액션 바 | 4,800 → 600                 | 20.03 → 11.80       |
| 5,000 | 이동    | 10,011 → 5,010              | 52.32 → 50.79       |
| 5,000 | 삭제    | 10,006 → 5,006              | 44.19 → 43.71       |
| 5,000 | 액션 바 | 40,000 → 5,000              | 528.19 → 291.92     |

각 arm의 카운트는 3회 모두 동일하다. Canvas binding 자체의 5k 이동 조회는 10,002 → 5,001이며 위 표는 Builder의 다른 geometry 소비를 포함한 engine 합계다. **구조 작업은 조회 감소, 체감 개선 미확인.** 액션 바는 이 합성 부하에서 총 taskMs 약 45% 감소했다. 남은 메뉴 command 준비와 구조 command span/형제 목록 비용 때문에 큰 선택의 비용이 사라진 것은 아니다.

원시 교대 결과는 [JSON](248-performance-followup-results.json)에 보관했다.

## 회귀 방지와 실행

인접 unit에서 5k Canvas geometry 상한 5,003 및 300개 선택의 geometry 1회를 고정했다. 수정 전 각각 10,002 및 8회로 RED였다. 이동·삭제·두 번 Undo, flex/grid flow, 새 workspace/Canvas 동등성, 기존 단축키와 준비된 8개 명령의 동등성, resize 후 갱신을 검사한다.

전용 [ratchet](../../../apps/builder/perf/adr248-followup-ratchet.json)은 이 하니스의 600/5,000 geometry 카운트를 등급 A로 기록한다. 기존 ADR-246 전역 ratchet과 분리한다. 기존 공유 판정기 `PERF_RATCHET_PATH=apps/builder/perf/adr248-followup-ratchet.json node apps/builder/scripts/perf-ratchet-gate.mjs --update 600=<frame-600.json> 5000=<frame-5000.json>`로 12개 상한을 낮췄다. 새 상한으로 구 arm을 판정하면 12개 모두 차단된다.

재실행: dev 서버와 기존 인증 세션이 있는 환경에서 `pnpm perf:adr248-followup`. `BUILDER_URL`, `OUT`, `COUNTS`, `RUNS`로 조건을 지정하고 `LIVE=1`로 실제 액션 바 버튼·Undo·refresh를 추가한다. 기본값은 600/5,000 각 3회이며 마지막에 전용 상한을 검사한다. A 재현은 수정 전 checkout의 Vite module 응답을 저장하고 `BASELINE_MODULES=<디렉터리>`로 지정한다. 구 arm이 새 상한에서 실패하는 것은 의도한 RED다.

실제 Builder 검증: 5,000개 이동·삭제 Undo 복원, 액션 바 왼쪽 정렬 5,000개 x=20, Undo 후 열 위치 복원, 저장 후 reload 5,000개 ID/순서/위치 일치, page error 0. 검증 화면은 로컬 `/private/tmp/adr248-followup-live/builder.png`다.

최종 검증: 인접 ActionBar/G5/CanvasMenu 20개 PASS, 나머지 runtime 검사 통과, `codex:preflight` PASS, 전용 600/5k 각 3회 ratchet PASS, `git diff --check` PASS.
