# ADR-211 상세 설계 — 차트 표시 예산 (픽셀 폭 기준 마크 수와 창·축약)

2026-09-10 · **Proposed — 리뷰 전.** [상위 ADR](../211-chart-display-budget-pixel-fit-window-decimation.md). 아래 함수/필드/파일명은 제안이며 현행 구현으로 인용하지 않는다. 현행 코드 사실은 상위 ADR §Context 의 표가 정본이다.

## 1. 범위 · 선행 관계 (분리 4질문 lock-in)

- **범위**: 차트 6종 (bar · line · area · pie/donut · radar · radial) 전부. "몇 개를 그릴 수 있는가" 를 데이터 행 수 상수가 아니라 **차트가 차지한 픽셀 공간**에서 파생하고, 넘치는 부분을 창(window) · 축약(decimation/집계) · 묶기(others) 로 처리하는 계약. 두 leg (Skia Canvas · Recharts Preview/Publish) 는 같은 계약 결과를 소비한다.
- **범위 밖**: 새 표현 옵션 (tooltip/legend 확장), 데이터 공급 (collection 식별자 — ADR-152), Properties 컨트롤 mount 비용 (ADR-210 후속 ②), 실시간 스트리밍 데이터.
- **분리 4질문** (adr-writing.md §Fork): (1) base/응용 — ADR-194 (기하 SSOT) · ADR-209 (Canvas·Recharts 분리) · ADR-210 (다중 컬럼·표시) 이 base, 본 ADR 은 그 위의 **표시 예산 계약** (응용). 셋을 전제로 하고 역방향 의존은 없다. (2) schema — 새 저장 props 는 `displayBudget` 한 묶음 (선택적) 뿐이며 ADR-210 의 `valueFields/seriesConfig/valueFormat` 을 specialization 하지 않는다 (직교). (3) 선행 전제 reverse — ADR-157 의 "샘플 N행" 표시 정책은 collection 목록용이고 `CHART_SAMPLE_ROWS` 는 그 동형 이식 (`computeChartScene.ts:56` 주석) 이다. 본 ADR 은 차트에 한해 그 동형을 **폐기**하되 ADR-157 자체는 건드리지 않는다 — grep `CHART_SAMPLE_ROWS` 소비처 4곳 (§4) 이 전부 차트 전용임을 확인. (4) 3차 리뷰까지 미루지 않음 — 이 lock-in 을 round 1 에 낸다. **사용자 confirm**: 2026-09-10 사용자가 방향 ("픽셀 공간에 몇 개가 들어가나", 스크롤·기간 축 축약, "모든 차트에 포함") 과 제목을 직접 정했다 — 세션 기록 (ADR-210 종결 직후).

## 2. 계약 — `fit` · 창 · 축약 · 묶기

### 2.1 예산 축과 `fit` (종류별)

| 종류        | 예산 축                                 | `fit` (정수)                                              | 넘칠 때 기본 동작                                    |
| ----------- | --------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| bar         | 플롯 폭 (horizontal 이면 높이) `plot.w` | `floor(plot.w / (minSlot × 묶음 슬롯 수))`, 누적은 슬롯 1 | 범주 축: 창 · 순서/기간 축: 집계                     |
| line / area | 플롯 폭                                 | `floor(plot.w / minPointGap)`                             | 순서/기간 축: 점 축약 (LTTB) · 범주 축: 창           |
| pie / donut | 둘레 `2π × r` (donut 은 바깥 반지름)    | `floor(2πr / minArc)`                                     | 작은 조각부터 "기타" 로 묶기                         |
| radar       | 둘레 (축 간 호 길이)                    | `floor(2πr / minAxisGap)`                                 | 축 "기타" 묶기 (범주 축) — 창은 극좌표에 쓰지 않는다 |
| radial      | 반지름 (링 두께) `r − innerR`           | `floor((r − innerR) / minRing)`                           | 링 "기타" 묶기                                       |

- `minSlot / minPointGap / minArc / minAxisGap / minRing` 은 `ChartMetrics` 확장 (rule chart 채널, D3 SSOT) — 기본값은 Phase 0 에서 실측으로 정한다 (후보: 8 / 2 / 6 / 12 / 4 px). 저장 props 가 아니다.
- `fit` 은 `size` (두 leg 모두 이미 픽셀 `ChartSize` 를 가진다 — Canvas 는 layout rect, DOM 은 `ResizeObserver`) 에서 파생하므로 같은 크기면 같은 값이다. 크기가 다르면 (Compare Mode 반폭 등) `fit` 도 달라진다 — 이것은 결함이 아니라 계약이다 (§5 fixture 에 명시).

### 2.2 축 종류 판정

- **범주 축**: 카테고리 필드가 문자열이고 날짜/숫자로 파싱되지 않음 → 창.
- **순서/기간 축**: 카테고리 값이 전부 ISO 날짜 또는 유한 숫자 → 축약. 판정은 `resolveChartData` 의 정규화 단계에서 1회, 결과를 `presentation` 옆 `axisKind` 로 실어 두 leg 가 같이 읽는다.
- 저장 props `displayBudget.overflow: "auto" | "window" | "aggregate" | "others"` (기본 `auto` = 위 표). 사용자가 명시하면 판정을 덮는다. Pie/radar/radial 에 `window` 는 validator 가 거부한다 (ADR-210 `presentation.ok=false` 경로 재사용).

### 2.3 창 (window)

- 창 크기 = `fit`, 창 위치 = 첫 범주 index (0 기준). **저장하지 않는 뷰 상태** — Preview/Publish 의 컴포넌트 state 로만 존재하고 canonical write 0 (ADR-210 T11 의 "tooltip write 0" 과 같은 규율).
- Canvas 는 항상 창 0 을 정적으로 그린다 (빌더는 상호작용 표면이 아니다 — 메모리 `feedback-skia-builder-not-frontend-interaction-belongs-to-preview`).
- Preview/Publish 는 Recharts `Brush` (3.10.1 export 확인) 또는 자체 스크롤 트랙 — Phase 0 spike 에서 Brush 가 `PlainBarShape`·`accessibilityLayer` 와 공존하는지 확인 후 결정. 키보드: 좌우 화살표로 창 이동 (D1 — RAC 가 아니라 Recharts accessibilityLayer 범위, 별도 ARIA 작성 금지).
- 창 밖 데이터는 **모델에는 남고 마크만 안 만든다** — 집계·domain(축 범위) 은 전체 데이터로 계산해 창을 옮겨도 축이 흔들리지 않는다.

### 2.4 축약 (aggregate / LTTB)

- bar 순서 축: 인접 `ceil(n / fit)` 개 범주를 한 묶음으로 합산 (sum) — 값 필드가 비율/퍼센트면 평균. 묶음 라벨은 `첫~끝` (예: `2026-01-01 ~ 2026-01-07`).
- line/area 기간 축: LTTB 로 `fit` 개 점 선택 (모양 보존). 시리즈가 여럿이면 시리즈마다 독립 LTTB 가 아니라 **공통 x 집합** (첫 시리즈 기준 또는 합산 시리즈 기준) 을 뽑아 x 를 공유한다 — 누적(stack) 이 깨지지 않게.
- 축약된 값의 tooltip/축 문자열은 ADR-210 `formatValue` 를 그대로 쓰되 단위 접미 (`합계` / `평균`) 를 `seriesLabel` 옆에 붙인다 — 문자열 SSOT 는 `presentation.ts`.

### 2.5 묶기 (others)

- pie/radar/radial: 값 내림차순으로 `fit − 1` 개를 남기고 나머지를 "기타" 1개로 합산. "기타" 는 팔레트 마지막 토큰 (`--chart-series-8`) 이 아니라 전용 토큰 `--chart-others` (rule chart 채널 신설, light/dark 둘 다) — Skia 와 CSS 가 같은 토큰을 읽는다.
- 라벨 문자열 `chart.others` 는 i18n 키 (`translations.ts`), 두 leg 가 같은 문자열을 받도록 `presentation` 에 실린다 (Publish 는 i18n 런타임이 없으므로 export 시점 문자열로 고정 — ADR-210 `CHART_INVALID_SETTINGS_TEXT` 와 같은 방식).

## 3. 계산 위치 (SSOT) 와 소비

- `packages/specs/src/chart/budget.ts` (신규): `resolveDisplayBudget(kind, size, metrics, model) → { fit, axisKind, overflow, window: {start, size} | null, groups: ... }`. 순수 함수, Recharts import 0.
- `computeChartScene` 은 `bandScale(grid.categories.length, …)` (`computeChartScene.ts:613`) 대신 **예산이 남긴 범주 목록** 으로 band/angle scale 을 만든다. `angleScale` (`polar.ts:28`) 도 같은 목록을 받는다.
- `resolveChartData` (`runtimeData.ts:29`) 가 DOM leg 의 같은 입력 — 창/축약/묶기를 적용한 `rows` 와 `axisKind` 를 모델에 싣는다. RechartsChart 는 모델의 행만 그린다.
- Canvas 주입 (`canvasSceneNode.ts:2585-2591`): `CHART_SAMPLE_ROWS` slice 제거, **전체 행**을 `_chartRows` 로 넘기고 예산은 scene 계산이 적용한다. 대신 행 상한이 없어지므로 **모델 계산 비용**이 행 수에 비례한다 — 5,000행 이상은 Phase 0 에서 재고 필요하면 `_chartRows` 에 하드 상한 (예: 20,000) 을 별도 상수로 둔다 (표시 예산과 무관한 안전장치, 안내 문구 별도).
- 패널 안내 (`ChartAuthoringControls.tsx:92-98`): "Canvas: 200/total 행 샘플" → "표시 {fit}/{total} — 나머지는 {창·집계·기타}" 로 교체. i18n `chart.sampleHint` 는 삭제하고 `chart.budgetHint` 신설 (ko/en).

## 4. 변경 파일 (예상)

| 파일                                                                                                        | 변경                                                                            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `packages/specs/src/chart/budget.ts` (신규)                                                                 | `resolveDisplayBudget` · axisKind 판정 · LTTB · 집계 · others                   |
| `packages/specs/src/chart/computeChartScene.ts`                                                             | `CHART_SAMPLE_ROWS` 삭제 · 예산 적용 범주로 scale 생성 · scene 에 `budget` 메타 |
| `packages/specs/src/chart/runtimeData.ts` · `series.ts`                                                     | 모델에 `axisKind` · 창/축약 결과 행                                             |
| `packages/specs/src/chart/presentation.ts` · `types.ts` · `authoring.ts`                                    | `displayBudget` props validator · `ChartMetrics` 최소 단위 5종 · others 문자열  |
| `packages/specs/src/chart/polar.ts` · `marks/pie.ts` · `radar.ts` · `radial.ts`                             | others 조각/축/링                                                               |
| `packages/specs/src/renderers/skiaPrimitives.ts:3357`                                                       | 전체 행 수신 (slice 없음)                                                       |
| `apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts:2585`                                   | slice 제거 · 안전 상한 상수                                                     |
| `apps/builder/src/builder/panels/properties/ChartAuthoringControls.tsx:92` · `ChartDataMappingControls.tsx` | 안내 문구 · `overflow` 선택 컨트롤 (auto/창/집계/기타)                          |
| `apps/builder/src/i18n/translations.ts` · `types.ts`                                                        | `chart.sampleHint` → `chart.budgetHint` · `chart.others`                        |
| `packages/shared/src/components/chart/RechartsChart.tsx` · `Chart.tsx`                                      | 창 상태 (뷰) · Brush/스크롤 · 키보드 창 이동 · others 토큰                      |
| catalog rule chart 채널 (`componentRulesTable.ts`) · theme tokens                                           | `--chart-others` light/dark · 최소 단위 5종                                     |
| `apps/builder/src/builder/workspace/canvas/scene/chartRowInjection.test.ts` (6)                             | 200행 slice 검증 → 전체 행 + 예산 검증으로 교체                                 |

## 5. 검증 fixture 와 판정

- **손계산 오라클** (Q5 독립성): 폭 500px · minSlot 8 → bar `fit = 62`; 시리즈 3 묶음 → 20; 반지름 60 · minArc 6 → pie `fit = 62`. 결과는 spec 함수와 별개로 표에 먼저 적고 테스트가 그 표를 읽는다.
- **두 leg 동일성**: 같은 `size` 에서 Canvas scene 의 범주 목록 · Recharts 모델의 행 = byte 동일 (창 0, 축약 결과, others 합산값). 크기가 다른 경우 (Compare Mode) 는 **다른 것이 정답**임을 fixture 에 명시하고 각 leg 를 자기 크기의 손계산과 대조한다.
- **모양 보존** (축약): LTTB 결과와 원본을 같은 픽셀 폭에 그렸을 때 y 극값 위치 오차 ≤ 1 슬롯, 합계 집계는 원본 합과 동일.
- **회귀 0**: 데이터가 `fit` 이하인 기존 문서 (스냅샷 4건 · ADR-210 T10 32건 · legacy 6종) 는 scene byte 동일 — 예산은 넘칠 때만 개입한다.
- **live**: 실제 빌더에서 1,000행 범주 bar → Canvas 창 0 · 패널 안내 문구 · Preview 스크롤로 끝까지 이동 (write 0) · 기간 축 5,000행 line → 축약 점 수 = `fit` · pie 40 조각 → others 1 · dark 토큰 · Export → publish 같은 결과. 하니스 `apps/builder/scripts/adr211-chart-budget-live.mjs` (ADR-210 P3 하니스 패턴 재사용).
- **성능** (측정 5-질문): 대상 = 합성 행 (규모 전용 — 분포 인용 금지) · 불리 케이스 = 폭 2,000px (fit 최대) + 시리즈 8 + 창 이동 연속 · 대조군 = ADR-210 최종 `53c761c8b` clean worktree (원래 lockfile) · 조건 = headed Chromium 1440×900 DPR 1, 기록. 지표: Builder `render.frame` p95 (columns800 24ms → 목표 ≤ group800 과 ±2ms), runtime static W800 4종 p95 ≤100ms 유지, **5,000행 모델 계산** ≤ 20ms (새 지표, 행 상한 제거의 대가), 번들 순증 ≤ 6 KiB (LTTB 포함) — ADR-210 승인 상한 (Builder ≤1,297,311 / Preview ≤630,625 B, 만료 2026-10-10) 안에서 흡수 가능한지 P4 에서 재판정, 초과 시 사용자 재승인.

## 6. 단계 · 산출물

| Phase | 내용                                                                                                                                                | Gate |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| P0    | spike: 최소 단위 5종 실측 (사람이 구분 가능한 최소 px, light/dark) · Brush 공존 확인 · 5,000행 모델 비용 · `CHART_SAMPLE_ROWS` 소비처 4곳 inventory | G0   |
| P1    | `budget.ts` + scene/모델 적용 (창 0 정적) — Canvas·DOM 두 leg 가 같은 범주 목록. `CHART_SAMPLE_ROWS` 삭제. 손계산 fixture                           | G1   |
| P2    | 축약 (집계·LTTB) + others + `--chart-others` 토큰 + 문자열 SSOT                                                                                     | G2   |
| P3    | Preview/Publish 창 이동 (스크롤/키보드, 뷰 상태) + Properties `overflow` 컨트롤 + 안내 문구                                                         | G3   |
| P4    | 성능·번들 (§5) · production network                                                                                                                 | G4   |
| P5    | preflight · 전체 스위트 · live · rollback 제한 · README/CHANGELOG                                                                                   | G5   |

## 7. 마이그레이션 · rollback

- 새 props `displayBudget` 은 선택적 — 기존 문서는 재직렬화 0, `fit` 이하 문서는 scene byte 동일. `fit` 초과 문서 (현재 200행 초과 문서) 는 **보이는 결과가 바뀐다** (앞 200행 → 창/축약) — 이것이 목적이므로 CHANGELOG 에 사용자-가시 변경으로 기록.
- 구버전은 `displayBudget` 을 무시하고 200행 샘플로 돌아간다 (데이터 손실 0). others/축약은 표시 계산이라 저장 데이터에 흔적이 없다.
- rollback = 커밋 revert. 토큰 `--chart-others` 는 theme 에 남아도 무해.

## 8. 미검증 · 열린 항목

- 최소 단위 기본값 5종은 실측 전 후보다.
- LTTB 의 공통 x 집합 방식 (첫 시리즈 vs 합산) 은 P0 spike 에서 결정.
- 20,000행 안전 상한의 필요 여부는 P0 모델 비용 실측이 정한다.
