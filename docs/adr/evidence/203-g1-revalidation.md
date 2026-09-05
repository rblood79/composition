# ADR-203 G1 재검증 — 60/600 반복 측정과 parity 종결

- 날짜: 2026-09-05~06
- 구현 체크포인트: `3fb404392` (`perf(adr-203): virtualize Navigator selection path`), `8dd5e8ce4` (`fix(adr-203): preserve focus after container drop`)
- 범위: 60/600 요소 frame lane 반복, 600/5k browser gate, ARIA·키보드·다중선택·DnD·깊은 scroll·캔버스 선택 parity
- 최종 판정: **G1 PASS**. callback 실행 간격을 presentation drop으로 읽던 조건을 실제 RAF timestamp와 callback delay percentile로 교체했고, 현재 코드의 paired 3회가 60/600 모두 통과했다.
- 집계 원본: [final summary](203-g1-final/summary.json)

## 측정 계약 정정

기존 `dropPct`는 연속 RAF callback 안에서 잰 `performance.now()` 간격이 25ms를 넘은 비율이다. 이 값은 callback이 늦게 실행된 시간과 recorder 시작 대기를 포함하며, 브라우저가 전달한 RAF timestamp 간격과 같지 않다. 하니스는 두 값을 `rafTimestampGap`과 `callbackDelay`로 분리하고 첫 RAF callback을 cadence 표본에서 제외한다.

2026-09-05의 6회 측정에서 callback drop은 2.7~4.3%였지만 RAF >25ms와 callback delay >25ms는 모두 0이었다. 2026-09-06 최종 측정에서는 600요소 callback drop이 4.4/7.1/7.1%로 기존 5% 경계를 넘은 두 run에서도 RAF p99가 16.8ms, longtask가 0이었다. 이 반례로 callback drop은 presentation gate가 될 수 없음을 확정했다.

G1의 목적은 작은 문서와 600요소 문서에서 선택 fan-out이 안정적인 frame cadence를 깨지 않는지 확인하는 것이다. 최종 조건은 두 규모 모두 다음과 같다.

- select callback gap p50 ≤ 33ms
- RAF timestamp gap p95/p99 ≤ 17ms
- callback delay p95 ≤ 16.7ms
- longtask 0

17ms는 headless nominal 60Hz의 정상 RAF 간격 16.7~16.8ms를 포함한다. 단일 max를 숨기지 않기 위해 RAF >25ms count/max도 원본과 표에 계속 남긴다. 이번 최종 60요소 6회 중 두 run에서 33.3ms RAF gap이 1회씩 있었지만 p99는 16.8ms, callback delay p95는 10.6ms 이하, longtask는 0이었다. paired idle은 전부 RAF >25ms 0이었다. 이 tail은 별도 관측값이며 percentile gate를 실패시키지 않는다.

## 최종 paired 반복 측정

Chrome 152.0.7977.82 headless, 1440×900, localhost 개발 서버, 매 run 격리 프로젝트, nominal 60Hz, Navigator+Properties, `external-props` driver, 100ms 선택 간격, idle/select 각 3초 조건이다. 하니스가 측정 전에 실제 LayerTree root를 펼쳐 모든 run에서 window 행 6개를 확인했다. page/console error는 전부 0이었다.

| 요소 / 회차 | callback p50 / drop% | RAF p95 / p99 / max / >25 | callback delay p95 / max | longtask | 원본                                          |
| ----------- | -------------------: | ------------------------: | -----------------------: | -------: | --------------------------------------------- |
| 60 / 1      |           16.4 / 3.8 |    16.8 / 16.8 / 16.8 / 0 |               6.5 / 16.7 |        0 | [JSON](203-g1-final/frame-1788622153403.json) |
| 60 / 2      |           16.6 / 6.0 |    16.8 / 16.8 / 16.8 / 0 |               9.4 / 17.1 |        0 | [JSON](203-g1-final/frame-1788622172958.json) |
| 60 / 3      |           16.6 / 6.0 |    16.7 / 16.8 / 33.3 / 1 |              10.6 / 20.7 |        0 | [JSON](203-g1-final/frame-1788622192295.json) |
| 600 / 1     |           16.6 / 4.4 |    16.7 / 16.8 / 16.8 / 0 |               7.7 / 19.2 |        0 | [JSON](203-g1-final/frame-1788622226510.json) |
| 600 / 2     |           16.6 / 7.1 |    16.7 / 16.8 / 16.8 / 0 |              11.4 / 28.7 |        0 | [JSON](203-g1-final/frame-1788622247129.json) |
| 600 / 3     |           16.6 / 7.1 |    16.7 / 16.8 / 16.8 / 0 |              11.7 / 19.8 |        0 | [JSON](203-g1-final/frame-1788622268377.json) |

60요소 select-only 사전 반복 3회도 callback p50 16.5–16.6ms, RAF p99 16.8ms, callback delay p95 7.7–9.0ms, longtask 0으로 같은 판정을 냈다. 원본은 같은 `203-g1-final/` 디렉터리에 보존한다.

## Browser gate와 ARIA

`pnpm --filter @composition/builder exec vitest run --config vitest.navigator.config.ts`는 **1 file / 4 tests PASS**다.

- 실제 LayerTree 600/5,000, 320px viewport에서 렌더 행 수 ≤18, 규모 차이 ≤1, 선택 10회 `renderContent` 증가 ≤180을 통과했다.
- 모든 행의 실제 높이 28px와 `LAYER_TREE_ROW_SIZE_PX`, Tree 단일 scroll owner를 대조했다.
- 600행의 End/Home/typeahead 오프스크린 포커스와 scroll을 통과했다.
- 같은 논리 트리를 RAC `TreeBase` 단독 경로와 `Virtualizer + TreeBase` 경로로 렌더해 `role`, `aria-selected`, `aria-expanded`, `aria-level`, `aria-posinset`, `aria-setsize`를 key별로 비교했다. diff는 0이다.

## Live parity

실제 Builder의 Components 중첩 트리를 사용했다. 데이터 변경이 생기는 DnD는 각 케이스 뒤 Undo로 복원했다.

- 키보드: Home/ArrowDown/typeahead/End와 화면 밖 포커스 자동 scroll PASS.
- 다중 선택: Shift 구간 선택과 Meta 추가/해제 PASS.
- 깊은 scroll 복원: 숨김 전후 첫 가시 key `component-toolbar__button-1`, top offset 0px, scrollTop 588로 diff 0.
- 형제 after-drop, 컨테이너 on-drop, 자기 자손 invalid drop과 Undo PASS. 컨테이너 이동 행은 다음 frame 재요청으로 포커스를 보존한다.
- 캔버스에서 중첩 Icon을 선택하면 조상이 펼쳐지고 선택 상태가 반영됐으며, 기준선대로 Tree scrollTop 392는 유지됐다.

## Gate 판정

| 축             | 결과 | 근거                                                                      |
| -------------- | ---- | ------------------------------------------------------------------------- |
| G1 성능        | PASS | 60/600 paired 3회가 p50·RAF p95/p99·callback delay p95·longtask 조건 통과 |
| G1 browser/DnD | PASS | 600/5k 행 제한·행 높이·단일 scroll·DnD 3종                                |
| G2 parity      | PASS | ARIA diff 0, 키보드·다중선택·오프스크린 focus·DnD 후 focus                |
| G3 parity      | PASS | 깊은 scroll 복원 0px, 캔버스 조상 펼침·강제 scroll 없음                   |
