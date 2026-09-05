# ADR-203 — Navigator 잔여 선택 비용 분석

- 날짜: 2026-09-05. 기준 HEAD `4f0d7a36e` + 기존 Phase 1 로컬 변경.
- 범위: 분석만 수행. 제품 코드와 기존 가상화 구현은 변경하지 않았다.
- 판정: **잔여 React 비용은 가시 행 렌더링과 별도 Action Bar에 집중된다. G1은 계속 열림.**
- 집계 근거: [측정 요약 JSON](203-phase1/residual-analysis.json), [기존 Phase 1 결과](203-phase1-live.md).

## 측정 조건과 한계

Chrome 152.0.7977.82 headless, 개발 서버 localhost:5173, 1440×900, 격리 프로젝트 60요소. 선택 간격 100ms, cadence run은 30회, React profile은 50회다. 패널 조건은 같은 프로젝트에서 순차 변경했다. 성능 측정끼리는 직렬 실행했다. production 성능이나 실제 포인터 입력부터 화면 표시까지의 지연을 측정한 것은 아니다.

임시 `/private/tmp/adr203-diagnose.mjs`는 기존 `perf-baseline.mjs`의 격리 프로젝트 생성·seed·인증 로딩을 재사용한다. 기본 실행은 none → Navigator → 두 패널 → Properties → Navigator → 두 패널이다. `--id-only`는 실제 클릭 handler와 같은 store 호출을 사용한다. `--react`는 React DevTools hook과 CDP CPU sampling을 추가하고 Navigator 조건만 측정한다. `--tall`은 실제 resize handle로 패널을 늘린다. 최초 resize는 펼침 전 높이 때문에 382px가 되었으므로 이를 320px 표본으로 취급하지 않았다.

요약 JSON에는 원본 임시 파일 경로·SHA-256, 각 run의 조건, 25ms 초과 구간, React 집계를 보존했다. 대용량 fiber/CPU 원본은 임시 경로에만 있으며 장기 보존 산출물은 아니다. CPU profile에는 결과 직렬화·전송 비용이 포함되어 전체 CPU/GC 비율을 앱 비용으로 사용하지 않았다.

## 1. 기존 drop 지표의 의미를 분리해야 한다

`apps/builder/scripts/perf-baseline.mjs`의 `RECORDER_SCRIPT`는 RAF callback 내부의 `performance.now()` 차이를 기록하고, nominal frame의 1.5배인 25ms를 넘으면 `dropped`로 집계한다. RAF callback 인자인 timestamp를 사용하지 않는다. 따라서 기존 표의 p50/p95도 선택 처리 시간 자체가 아니라 callback 실행 간격이다.

이번에는 timestamp 간격과 callback 실행 간격을 함께 기록했다. 예를 들어 warm Navigator run에서 timestamp 간격은 16.7ms인데 callback 실행 간격은 29.8ms였다. 실행 간격에는 callback 지연의 증감이 포함된다. 이 초과는 지연 신호지만, 그 자체로 RAF 기회가 누락되었다는 증거는 아니다. timestamp cadence 역시 실제 GPU presentation을 증명하지 않는다.

| 조건, React profile 없음        | Tree 높이 / 가시 행 | RAF timestamp 최대 / 25ms 초과 수 | callback 실행 간격 최대 / 25ms 초과 수 |
| ------------------------------- | ------------------- | --------------------------------- | -------------------------------------- |
| 외부 props, Navigator 첫 run    | 90px / 6            | 133.4ms / 1                       | 139.0ms / 5                            |
| 외부 props, Navigator 반복      | 90px / 6            | 16.8ms / 0                        | 29.8ms / 4                             |
| ID-only, Navigator 첫 run       | 90px / 6            | 16.8ms / 0                        | 28.4ms / 1                             |
| ID-only, Navigator 반복         | 90px / 6            | 16.8ms / 0                        | 28.6ms / 2                             |
| 외부 props, Navigator 확대 반복 | 320px / 17          | 16.8ms / 0                        | 30.1ms / 6                             |
| 외부 props, 두 패널 확대 반복   | 320px / 17          | 16.8ms / 0                        | 31.6ms / 14                            |

첫 Navigator run에는 **실제 timestamp 간격 133.4ms가 1회** 있었다. 해당 순간 CPU profile을 수집하지 않았으므로 원인은 미귀속이다. 확대 React 계측 run에서도 timestamp 33.4ms가 1회 있었다. 모든 초과를 측정 착시로 설명하거나, frame drop 0% 달성을 선언하지 않는다. 기존 G1 수치와 FAIL 이력은 유지한다.

## 2. 실제 선택 경로의 store 알림 3회가 주원인은 아니다

기존 baseline driver는 `setSelectedElement(id, props, style, {})`를 호출한다. `LayersSection.handleSelectionChange`는 `setSelectedElement(id)`를 호출한다. `stores/elements.ts`에서 전자는 한 번의 set으로 선택과 props를 반영하고, 후자는 선택 ID 즉시 반영 → 다음 프레임 props → background computed-style hydration 경로를 탄다.

- 외부 props 30회: store 알림 30회.
- ID-only 30회: store 알림 90회. 선택 ID 계열 30회 + props-only 60회.
- 동기 호출 평균은 약 0.09–0.19ms다. 지연된 작업 전체 비용을 뜻하지 않는다.
- 두 경로의 Navigator React 렌더 횟수·누적 비용은 거의 같았다. 알림 3회를 Navigator 렌더 3회로 해석하면 안 된다.

## 3. React 비용은 가시 행 수에 따라 증가한다

아래는 50회 선택 구간의 React `actualDuration` 합계다. **부모 subtree와 자식 subtree는 중복되므로 행끼리 합산하지 않는다.** DOM commit/layout/paint 전체 시간이 아니다.

| 항목                                  | 외부 props, 90px / 6행 | ID-only, 90px / 6행 | 외부 props, 382px / 20행 |
| ------------------------------------- | ---------------------: | ------------------: | -----------------------: |
| Root render 합계                      |                354.9ms |             351.9ms |                  657.2ms |
| LayersSection subtree                 |                227.1ms |             221.5ms |                  534.0ms |
| LayerTree subtree                     |                207.4ms |             202.5ms |                  513.8ms |
| RAC TreeInner subtree                 |                197.4ms |             192.1ms |                  504.1ms |
| NormalItemContent subtree / 렌더 수   |          107.5ms / 305 |       104.9ms / 305 |            297.3ms / 999 |
| ContextualActionBar subtree / 렌더 수 |          119.3ms / 100 |       118.4ms / 100 |            112.1ms / 102 |

90px에서 선택당 Root 약 7.1ms 중 LayersSection은 약 4.5ms, Action Bar는 약 2.4ms다. 382px에서 LayersSection은 약 10.7ms로 증가한 반면 Action Bar는 약 2.2ms다. 가시 행 렌더 수의 증가와 Navigator 비용 증가가 함께 나타났다. 각 측정은 단일 run이므로 정밀한 배율이나 production 예측값으로 일반화하지 않는다.

TreeBaseItem은 50회 선택 구간에 0–1회만 렌더됐다. 숨겨진 collection root 비용도 약 1ms 수준이다. 가상화 이전의 전체 행 collection 재구축을 현재 잔여 병목으로 볼 근거는 없다. LayerTree/TreeBase 자체 self-time은 작고 비용은 RAC의 가시 subtree 안에 집중된다.

LayerTree의 `expandedKeys`/`onExpandedChange`, TreeBase의 `dnd` 참조 변화도 관측됐다. 그러나 참조 변화만으로 비용 기여나 memo 개선 효과를 확정할 수는 없다. 이전/다음 선택 행 이외의 가시 content가 재실행되는 경계를 다음 실험 대상으로 삼는다.

React 계측에서는 bailout된 fiber에 이전 `actualDuration`이 남는 문제를 확인했다. 초기 단순 전수 합계는 폐기하고, root duration > 0이면서 fiber actualStartTime이 직전 commit 시각 이후인 항목만 집계했다. 최초 cutoff는 측정 시작 시각이다. 필터된 self 합계는 각각 354.8 / 351.6 / 656.8ms로 root 합계와 반올림 오차 수준에서 일치했다. ID-only의 commit 알림 414회 중 positive-duration은 151회이므로 commit 알림 수만으로 비용을 추정하지 않는다.

## 4. Action Bar는 별도 계약을 가진 비용이다

Properties를 닫아도 ContextualActionBar는 동작한다. 따라서 “Navigator만 열기”가 Navigator 외 모든 React 작업을 제거하는 조건은 아니다.

`components/overlay/actionBar/ContextualActionBar.tsx`의 effect는 BuilderCanvas registry 갱신 후 `startTransition`으로 모델을 계산한다. 코드에는 render 단계에서 map을 읽으면 토글 라벨이 한 클릭 늦게 갱신되었던 근거가 있다. 50회 선택에 약 100회 렌더되는 현상은 이 모델 반영 경로와 연결된다. 단순 useMemo 전환이나 effect 제거는 stale 방지 계약을 깨뜨릴 수 있으므로 독립적으로 검증해야 한다.

## 다음 구현 우선순위

1. **계측 정리**: callback gap, RAF timestamp cadence, 실제 입력→표시 지연을 분리하고 외부 props/ID-only driver를 명시한다. 기존 G1을 어떤 지표로 판정할지는 별도 결정하며 기존 수치를 덮어쓰지 않는다. 드문 실제 timestamp stall은 trace를 붙여 다시 귀속한다.
2. **Navigator 가시 content 경계**: 선택되지 않은 가시 행의 재실행을 좁힐 수 있는지 실험한다. 동일 높이·같은 driver의 전후 비용과 키보드/다중 선택/DnD 계약을 함께 검증한다. 전역 DFS 제거 또는 store set 병합부터 시작할 측정 근거는 없다.
3. **Action Bar 별도 분석**: registry 최신성·선택 모델 반영 순서를 유지하는 조건에서 중복 렌더 비용을 줄일 수 있는지 검토한다. ADR-203 LayerTree 경계를 넘어가는 구현은 범위를 먼저 명시한다.

이번 분석으로 G1/G2/G3를 닫거나 Phase 2/3을 시작하지 않았다. 제품 변경이 없어 제품 테스트를 재실행하지 않았으며, 기존 Phase 1의 테스트 결과와 미종결 parity 항목은 이전 evidence를 따른다.

## 후속 1 — 계측 지표 분리 구현 (2026-09-05)

사용자 후속 착수 지시로 `apps/builder/scripts/perf-baseline.mjs`를 변경했다. Builder UI/store 구현은 이번 작업에서 변경하지 않았다.

- 기존 `gapP50/P95/P99/Max`, `dropPct`, frames/fps 계산을 보존했다. 첫 callback까지의 대기도 기존 gap에 포함된다.
- `rafTimestampGap`은 RAF 인자 간격만 집계한다. 첫 callback은 제외하므로 표본 수가 callback 수보다 하나 적다.
- `callbackDelay`는 callback의 `performance.now() - timestamp`다. 입력 지연이나 presentation 지연으로 해석하지 않는다.
- `gapEvents`에 callback 또는 timestamp 간격이 25ms를 넘는 구간의 두 간격·timestamp·실행 시각·지연을 함께 저장한다. 모두 page performance time origin 기준이다. 기본 nominal 60Hz 조건이다.
- `--selection-driver external-props|id-only`를 추가했다. 기본은 기존 external-props이며 결과별 driver도 기록한다. ID-only는 elements 투영을 읽지 않고 실제 handler와 같은 ID 단독 호출을 한다. 포인터 hit-test는 수행하지 않는다.
- 최종 report에는 `metricDefinitions`를 추가했다. 아래 실측 원본은 이 설명 메타데이터 추가 직전에 수집했으며 지표 계산·driver는 동일하다.

```sh
pnpm exec node --test apps/builder/scripts/perf-baseline.test.mjs
pnpm perf:baseline -- --lane frame --classes idle,select --selection-driver id-only --duration-ms 3000 --seed-count 60 --open-panels navigator
```

동일 Chrome/headless/dev/60요소/100ms 선택 간격에서 직렬 실행했다. 아래는 하니스 동작 확인용 단일 run이며 driver 간 성능 우열 판정은 아니다.

| 선택 driver           | callback p95 / max | 기존 dropPct | RAF timestamp max / 초과 수 | callback delay p95 / max | 원본                                           |
| --------------------- | -----------------: | -----------: | --------------------------: | -----------------------: | ---------------------------------------------- |
| ID-only               |      21.5 / 31.7ms |         3.8% |                  16.8ms / 0 |             5.4 / 15.6ms | [JSON](203-phase1/metrics-id-only.json)        |
| external-props 기본값 |      23.1 / 28.6ms |         2.7% |                  16.8ms / 0 |             7.5 / 17.5ms | [JSON](203-phase1/metrics-external-props.json) |

두 run 모두 page/console 오류 0, idle callback 초과 0%, select longtask 0이었다. 회귀 테스트 5개는 callback 지연과 RAF cadence 분리, 실제 timestamp 초과, 첫 callback 표본 처리, driver 기본값/오입력, ID-only의 props 투영 미사용 및 호출 인수를 검증한다.

계측 분리는 구현했지만 실제 입력→presentation 측정과 드문 stall의 CPU trace 귀속은 아직 남아 있다. 기존 G1 임계값 변경이나 통과 판정은 하지 않았다. 다음 구현 대상은 같은 높이·driver 조건에서 선택에 영향받지 않는 가시 행의 재렌더를 줄이는 실험이다.

검증 완료: Node 회귀 테스트 **5/5 PASS**, `codex:preflight` **PASS** (typecheck/registration 포함). `git diff --check` 통과. 이번 변경은 성능 하니스에 한정되어 제품 렌더링 parity 테스트는 추가 실행하지 않았다.

## 후속 2 — 일반 가시 행 content memo (2026-09-05)

`LayerTreeItemContent.tsx`의 NormalItemContent가 매번 새로 생성되는 TreeItemState 객체 전체를 받던 경계를 수정했다. 실제 소비하는 isSelected/isExpanded/isFocusVisible만 boolean props로 전달하고 React.memo의 기본 비교를 적용한다. node와 onDelete는 비교에 포함하므로 이름·요소·callback 변경을 누락하는 custom comparator는 없다. VirtualChild, 공용 TreeBase, store, DnD 및 RAC slot 구현은 변경하지 않았다. memo 아래 RAC 버튼 context 구독은 계속 갱신된다.

Chrome 152/headless/dev, 60요소, Navigator만 열기, Tree 382px/20개 가시 행, external-props 100ms 간격 50회, React hook + CDP 계측을 동일하게 적용해 직렬 전후 실행했다. [집계 JSON](203-phase1/content-memo.json)의 component 배열은 `[subtree ms, self ms, 관측 fiber 수]`다. bailout stale duration 제외 방식은 위 분석과 같다. raw는 `/private/tmp/adr203-residual/content-before.json`, `content-after.json`에 있으며 임시 자료다.

| 항목                              |        변경 전 |       변경 후 |
| --------------------------------- | -------------: | ------------: |
| Root React 누적                   |        643.8ms |       502.2ms |
| LayersSection subtree             |        524.1ms |       376.9ms |
| NormalItemContent subtree / self  | 295.5 / 50.4ms | 131.9 / 5.6ms |
| Action Bar subtree                |        110.4ms |       115.7ms |
| callback 간격 p95 / max           |  25.0 / 36.9ms | 21.9 / 24.3ms |
| RAF timestamp 최대 / 25ms 초과 수 |     33.3ms / 1 |    33.4ms / 1 |

Navigator 누적 비용은 약 28% 감소했다. memo 하위 RAC context 갱신에 따라 fiber subtree duration은 계속 기록되므로 관측 fiber 수를 함수 body 실행 횟수로 해석하지 않는다. 단일 개발 환경 계측 run이며 production 성능 보장은 아니다. 변경 후 callback 초과가 0이어도 timestamp 초과 1회는 남았고, 이는 정식 G1 하니스 재판정이 아니므로 G1은 열림이다.

- 회귀 RED 확인: 동일 상태의 새 객체를 전달하면 기존 구현에서 semantics 계산이 재실행되어 신규 테스트가 실패했다.
- 수정 후 인접 단위 테스트 8/8 PASS: memo bailout, 선택/focus/확장, 이름·요소 변경, 최신 삭제 callback, 기존 semantics/context menu/drag slot 계약.
- 실제 RAC 브라우저 테스트 3/3 PASS: 600/5k 가시 행 제한과 매 선택의 aria-selected/active 일치, Home/End/typeahead, 공용 비가상화 Tree 보존.
- 이번 memo 변경의 native DnD 전체 플로우는 별도 재실행하지 않았다. DnD 자체는 수정하지 않았으며 이전 Phase 1의 on-drop focus 등 미종결 항목은 계속 열려 있다.
- cross-check 범위: Builder chrome 전용 content이며 Catalog/Spec/Factory/CSS/Skia/Preview 경로 변경 없음. 시각·DOM 구조 변경 없음.

후속 2 완료 게이트: `codex:preflight` PASS, `gate:visual-parity` PASS (doctor 3 + matrix 98 = 101), `git diff --check` PASS. G1/ADR Implemented 승격과 commit/push는 수행하지 않았다.

후속 3: [새 하니스 3회 반복 및 WebGL flush 지연 귀속](203-repeated-raf-analysis.md). 기본 driver drop 1.1/0/1.1%, ID-only 0/0/0.5%로 G1 열림 유지. 별도 trace에서 큰 stall은 CanvasKit Surface.flush → getProgramParameter 대기로 귀속했다.

후속 5: [Action Bar/RAC 비용 분석](203-actionbar-rac-analysis.md). Action Bar 117ms/50선택 중 OptionsMenu 32.3ms, onAction identity 변경 99회. registry effect를 유지하는 props 경계 최적화 후보를 확인했다.
