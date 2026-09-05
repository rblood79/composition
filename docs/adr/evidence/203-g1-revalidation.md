# ADR-203 G1 재검증 — 60/600 반복 측정과 parity 종결

- 날짜: 2026-09-05
- 체크포인트: `3fb404392` (`perf(adr-203): virtualize Navigator selection path`)
- 범위: 60/600 요소 정식 frame lane 각 3회, 600/5k browser gate, ARIA·키보드·다중선택·DnD·깊은 scroll·캔버스 선택 parity
- 판정: **G1 FAIL 유지.** 600 요소 조건과 G2/G3 parity 축은 통과했지만 60 요소 callback drop 0% 조건이 3회 모두 미달이다. Phase 1과 ADR Status는 `Accepted`로 유지한다.
- 집계 원본: [g1-revalidation.json](203-phase1/g1-revalidation.json)

## 정식 반복 측정

Chrome 152.0.7977.82 headless, 1440×900, localhost 개발 서버, 격리 프로젝트, nominal 60Hz, Navigator+Properties, `external-props` 선택 driver, 100ms 선택 간격, idle/select 각 3초 조건이다. run은 직렬 실행했고 page/console 오류는 전부 0이었다.

| 요소 / 회차                         | callback p50 / p95 / max (ms) | drop % | RAF timestamp max / 초과 | callback delay p95 / max (ms) | longtask |
| ----------------------------------- | ----------------------------: | -----: | -----------------------: | ----------------------------: | -------: |
| [60 / 1](203-phase1/g1-60-1.json)   |            16.5 / 22.6 / 27.6 |    3.8 |                 16.8 / 0 |                    6.7 / 16.3 |        0 |
| [60 / 2](203-phase1/g1-60-2.json)   |            16.6 / 23.0 / 30.4 |    3.3 |                 16.8 / 0 |                    7.7 / 21.1 |        0 |
| [60 / 3](203-phase1/g1-60-3.json)   |            16.6 / 22.3 / 30.4 |    2.7 |                 16.8 / 0 |                    6.8 / 20.2 |        0 |
| [600 / 1](203-phase1/g1-600-1.json) |            16.6 / 23.5 / 32.9 |    2.7 |                 16.8 / 0 |                    7.8 / 17.9 |        0 |
| [600 / 2](203-phase1/g1-600-2.json) |            16.5 / 22.2 / 32.9 |    2.7 |                 16.8 / 0 |                    7.5 / 24.1 |        0 |
| [600 / 3](203-phase1/g1-600-3.json) |            16.6 / 23.8 / 33.9 |    4.3 |                 16.8 / 0 |                    8.2 / 18.7 |        0 |

600 요소는 세 run 모두 G1의 p50 ≤33ms, drop ≤5%, longtask 0을 만족했다. 60 요소는 p50과 longtask 조건은 만족했지만 필수 drop 0%를 한 번도 달성하지 못했다. 여섯 run 모두 RAF timestamp 초과는 0이므로 이번 callback 초과를 presentation frame 누락으로 바꿔 읽지 않는다. 기존 G1 지표 정의와 임계값도 변경하지 않았다.

## Browser gate와 ARIA

`pnpm --filter @composition/builder exec vitest run --config vitest.navigator.config.ts`는 **1 file / 4 tests PASS**다.

- 실제 LayerTree 600/5,000, 320px viewport에서 렌더 행 수 ≤18, 규모 차이 ≤1, 선택 10회 `renderContent` 증가 ≤180을 다시 통과했다.
- 모든 행의 실제 높이 28px와 `LAYER_TREE_ROW_SIZE_PX`, Tree 단일 scroll owner를 대조했다.
- 600행의 End/Home/typeahead 오프스크린 포커스와 scroll을 통과했다.
- 같은 논리 트리를 RAC `TreeBase` 단독 경로와 `Virtualizer + TreeBase` 경로로 각각 렌더해 `role`, `aria-selected`, `aria-expanded`, `aria-level`, `aria-posinset`, `aria-setsize`를 key별로 비교했다. diff는 0이다.
- Navigator 전체 non-browser suite는 **22 files / 139 tests PASS**다. 이 중 `useFocusManagement` 4건은 LayerTree opt-in, 비-opt-in Tree의 기존 microtask 시점, 같은 frame 전 이전 요청 취소, unmount cleanup을 고정한다.

## Live parity

실제 Builder의 Components 중첩 트리를 사용했다. 데이터 변경이 생기는 DnD는 각 케이스 뒤 Undo로 복원했다.

### 키보드와 다중선택

- Home은 `page-components-body`, ArrowDown은 `component-listbox-item-default`로 이동했다.
- 연속 Shift+ArrowDown은 anchor부터 `icon`, `label`, `description`까지 4개 구간을 선택했다.
- Meta click으로 `component-listbox`를 기존 구간에 추가했다.
- `c` typeahead는 `component-card`로 이동했고 Tree scrollTop은 448이 됐다. End는 화면 밖 `component-card__footer`까지 이동했다.

### 깊은 scroll 복원

Navigator 숨김 전 첫 가시 행은 `component-toolbar__button-1`, viewport top offset 0px, scrollTop 588이었다. 다시 표시한 뒤 세 값이 모두 같았다. key diff 0, offset diff 0px다.

### DnD 3종과 포커스 수리

- 형제 after-drop: `component-toolbar__button-3`을 첫 Button 뒤로 이동했다. 실제 순서는 `button-1, button-3, button-2, separator`가 됐고 이동 행에 포커스가 남았다. Undo 후 원래 순서가 복원됐다.
- 컨테이너 on-drop: `component-menu-item-default__label`을 `component-toolbar` 안으로 이동했다. 구조 이동과 Undo는 성공했지만 첫 실행에서 포커스가 대상 Toolbar에 남아 기존 미종결 실패를 재현했다.
- 원인은 `useFocusManagement`가 microtask에서 포커스 key를 한 번만 설정해, 재부모화된 행 DOM의 mount보다 먼저 `TreeBase` effect가 실행되는 데 있었다. LayerTree만 포커스 key를 비운 뒤 다음 animation frame에 다시 요청하도록 opt-in했다. 같은 행을 연속 이동해도 요청이 재실행되고, 이전 frame 요청과 unmount cleanup이 누락되지 않도록 회귀 테스트를 추가했다. PageTree 등 비-opt-in 소비자는 기존 microtask 시점을 유지한다.
- 수정 후 같은 on-drop을 재실행해 이동한 label에 포커스가 남고 Undo가 복원되는 것을 확인했다.
- 무효 drop: `component-menu-item-default`을 자기 자식 label에 놓으려 했을 때 key/level/posinset/setsize 구조가 모두 불변이었다.

### 캔버스 선택

MenuItem을 접고 Tree를 scrollTop 392의 깊은 위치에 둔 뒤 캔버스에서 편집 컨텍스트로 들어가 자식 Icon을 선택했다. `component-menu-item-default`은 자동으로 펼쳐졌고 Icon 행이 선택됐으며 Tree scrollTop은 392로 유지됐다. 조상 자동 펼침과 강제 선택행 scroll 없음 조건을 함께 만족했다.

## 판정

| 축                  | 결과 | 근거                                                       |
| ------------------- | ---- | ---------------------------------------------------------- |
| G1 600 성능         | PASS | 3회 모두 p50 ≤33ms, drop ≤5%, longtask 0                   |
| G1 60 callback drop | FAIL | 3.8%, 3.3%, 2.7% — 필수 0% 미달                            |
| G1 browser/DnD      | PASS | 600/5k 행 제한·행 높이·단일 scroll·DnD 3종                 |
| G2 parity 증거      | PASS | ARIA diff 0, 키보드·다중선택·오프스크린 focus·DnD 후 focus |
| G3 parity 증거      | PASS | 깊은 scroll 복원 0px, 캔버스 조상 펼침·강제 scroll 없음    |

이번 재검증은 Phase 2의 기존 분기 제거와 ADR 승격을 포함하지 않는다. G1이 실패했으므로 Phase 1 종료, Phase 2 착수, `Implemented` 승격을 수행하지 않는다.
