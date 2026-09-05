# ADR-203 G4/G6 종결 — persistent 5k, headed, pointer, Properties scalar 구독

- 날짜: 2026-09-06
- 환경: Chrome 152.0.7977.82, 1440×900, localhost dev, throttle 없음
- 문서: IndexedDB snapshot으로 재사용한 동일 persistent 프로젝트, 5,000 seed 요소, 2 pages
- 패널: Navigator + Properties + Styles
- 판정: **G4 PASS, G6 착수 및 Phase 4 구현 완료**
- 집계 원본: [summary.json](203-phase3/summary.json)

## 5k 반복 측정

하니스는 매 run에서 실제 LayerTree root를 펼쳐 `rows 1 → 6`을 확인한 뒤 측정했다. 접힌 body 한 행만 재던 결과는 폐기했다. headless run은 직렬 3회, 같은 persistent 프로젝트를 재사용했다.

| 조건 / 회차    | callback p50 / p95 (ms) | 할당 MB/s | RAF p95 / max / >25 | callback delay p95 | longtask | rows | 원본                                        |
| -------------- | ----------------------: | --------: | ------------------: | -----------------: | -------: | ---: | ------------------------------------------- |
| headless / 1   |             16.0 / 41.4 |      93.2 |     16.8 / 50.0 / 3 |               25.7 | 1 / 67ms |    6 | [JSON](203-phase3/frame-1788621959629.json) |
| headless / 2   |             16.2 / 43.7 |     108.2 |     16.8 / 66.7 / 5 |               28.1 | 1 / 70ms |    6 | [JSON](203-phase3/frame-1788621979504.json) |
| headless / 3   |             16.2 / 43.1 |      88.4 |     16.8 / 49.9 / 9 |               27.8 | 1 / 66ms |    6 | [JSON](203-phase3/frame-1788621998391.json) |
| headed / 120Hz |              8.2 / 36.5 |     104.0 |    25.0 / 75.0 / 15 |               28.5 | 1 / 75ms |    6 | [JSON](203-phase3/frame-1788622023813.json) |

G4의 5k select p50 ≤50ms는 headless 세 run과 headed run 모두 통과했다. p95 36.5–43.7ms, 할당 88.4–108.2MB/s, run당 longtask 1건은 잔존 tail이다. G4에는 p95·할당·longtask exit threshold가 없으므로 이 값을 통과로 바꾸어 읽지 않으며, 이후 선택/persist tail 조사 기준으로 남긴다.

## 실제 pointer hit-test

[pointer raw JSON](203-phase3/frame-1788622042983.json)은 headed 120Hz에서 다음 경로를 실행했다.

1. production 전역 단축키 `Meta+0`으로 viewport fit.
2. 실제 middle-button pan 두 번으로 `perf-seed-1` 중심을 Canvas `(720, 450)`에 배치.
3. production `__composition_RENDER_COMMAND_DEBUG__`가 같은 Skia frame singleton에서 읽은 camera와 hit bounds로 client 좌표 계산.
4. `document.elementFromPoint`가 실제 `CANVAS`이고 canvas container 안인지 확인.
5. Playwright primary mouse click 후 `selectedElementId === "perf-seed-1"` 확인.

결과는 pointer PASS, LayerTree rows 6, RAF >25ms 0, longtask 0, page/console error 0이다. 이전 screen 밖 좌표 `(1612, 78)`에서 선택이 이미 남아 있던 거짓 양성 결과는 evidence로 사용하지 않았다.

## Phase 4 — Properties scalar subscription

5k 1차 측정에서 p95 >25ms와 할당 >60MB/s가 모두 성립해 G6가 Phase 4를 활성화했다.

- `PropertiesPanelContent`는 전체 debounced selected element 대신 `selectedElementId`와 ref-resolved `type` scalar만 구독한다.
- clipboard와 slot mirror는 필요한 leaf에서만 선택 props/field 값을 구독한다.
- `GenericField`는 canonical semantic/style field snapshot을 직접 구독하고, 다른 노드나 다른 prop 변경에서는 재렌더하지 않는다.
- semantic propagation과 canonical ref 해소는 write 시점의 active document/read index에서 계산해 stale closure를 피한다.
- Properties/Skia related 회귀는 66 files / 639 tests, Navigator Chromium gate는 1 file / 4 tests, harness node tests는 9 PASS다. Navigator gate의 비동기 layout settle도 `act`로 감싸 경고 없이 종결했다.

실동작은 같은 persistent 5k snapshot에서 LayerTree의 `perf-seed-0` 행을 실제 클릭한 뒤 Properties Text 입력을 `Seed 0` → `ADR-203 scalar live`로 편집했다. 입력과 store mirror가 같은 값으로 즉시 갱신됐고, LayerTree rows 6 · 선택 행 `aria-selected=true` · page/console error 0이었다. [JSON](203-phase3/properties-live.json), [screenshot](203-phase3/properties-live.png).

Phase 4 뒤 5k p50은 G4를 안정적으로 통과했지만 p95·할당 tail은 사라지지 않았다. 이 ADR은 추가 threshold를 소급 도입하지 않고, field subscription invariant와 기존 G4를 종결 조건으로 사용한다.
