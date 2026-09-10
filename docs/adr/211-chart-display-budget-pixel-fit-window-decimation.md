# ADR-211: 차트 표시 예산 — 픽셀 폭 기준 마크 수와 창·축약 계약

## Status

Proposed — 2026-09-10 (코드 기준 `2a9ab37fc`, ADR-210 Implemented 직후). 사용자가 방향과 제목을 정함 (분리 4질문 lock-in: [breakdown §1](design/211-chart-display-budget-pixel-fit-window-decimation-breakdown.md#1-범위--선행-관계-분리-4질문-lock-in)).

## Context

차트가 그릴 수 있는 마크 수는 **차트가 차지한 픽셀 공간**이 정한다. 500px 폭에 막대 1,000개는 들어가지 않는다 — 어떤 규칙으로든 일부만 보여주고 (창·스크롤), 모양을 유지한 채 줄이거나 (기간 축 축약), 작은 것을 묶어야 (기타) 한다. 현재 두 leg 는 각각 다른 잘못된 규칙을 쓴다.

**현행 코드 사실** (2026-09-10, `2a9ab37fc`):

| 사실                                                                                                                                                          | 경로                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| band scale 은 `step = width / count` — **최소 폭이 없다.** 범주 1,000개는 0.5px 막대로 전부 들어간다. 극좌표 `angleScale` 도 같은 규약 (`sweep / n`)          | `packages/specs/src/chart/scales.ts:82` · `polar.ts:34`                                  |
| Canvas 는 `CHART_SAMPLE_ROWS = 200` 으로 **앞 200행**만 주입한다 (ADR-157 collection 샘플 정책의 동형 이식). 픽셀 크기와 무관한 상수                          | `computeChartScene.ts:56-57` · `canvasSceneNode.ts:2585-2591` · `skiaPrimitives.ts:3357` |
| Preview/Publish 는 **전체 행**을 그린다 (`rows = dataBinding ? boundRows : data`). 창·축약·Brush 없음                                                         | `packages/shared/src/components/Chart.tsx:336` · `RechartsChart.tsx:138`                 |
| 두 leg 모두 픽셀 `ChartSize` 를 이미 가진다 — Canvas 는 layout rect, DOM 은 `ResizeObserver`                                                                  | `computeChartScene.ts:504-507` · `Chart.tsx:112-139`                                     |
| 값 컬럼 모드 (ADR-210) 는 200행 × 컬럼 수만큼 마크가 늘어 Builder `render.frame` p95 columns800 **24ms** vs group800 **10ms** (같은 빌드, 한도 안이지만 2.4×) | ADR-210 [P4 evidence](evidence/210-p4-bundle-runtime-frame.md)                           |
| 패널 안내 "Canvas: 200 / total 행 샘플 · 미리보기는 전체 행" 이 이 차이를 사용자에게 설명한다                                                                 | `ChartAuthoringControls.tsx:92-98` · `i18n/translations.ts:85`                           |
| 소비처는 차트 전용 4곳 (`computeChartScene` · `canvasSceneNode` · `ChartAuthoringControls` · `chartRowInjection.test.ts` 6건) — ADR-157 본체는 무관           | grep `CHART_SAMPLE_ROWS`                                                                 |

결과: 빌더 화면은 "앞 200행", Preview 는 "0.5px 막대 1,000개" 로 같은 문서가 두 곳에서 다르게 보이고, 비용은 픽셀이 아니라 데이터 크기에 비례한다. composition 빌더의 목적은 차트 하나가 아니라 **많은 요소를 가볍게** 그리는 것이므로 마크 수의 상한은 픽셀에서 와야 한다.

**SSOT 도메인**: D3 (시각) — `fit`·창·축약·묶기 결과는 spec 기하 SSOT (ADR-194) 가 계산하고 Skia·Recharts 가 대등하게 소비한다. 창 이동 상호작용은 Preview/Publish 의 Recharts 범위 (D1 은 RAC 가 아니라 Recharts accessibilityLayer — 별도 ARIA 작성 금지). 저장 props 는 `displayBudget` 선택적 묶음 하나 (D2 — RSP 에 대응 개념 없음, 차트 전용 custom, ADR-209/210 의 `valueFields` 계열과 같은 근거).

**Hard constraints**:

1. Builder `render.frame` p95: columns800 이 group800 과 ±2ms (현 24 vs 10) — 비용이 컬럼 수·행 수가 아니라 픽셀 폭에 비례.
2. runtime static W800 4종 p95 ≤ 100ms 유지 (ADR-210 G4 수치), 5,000행 모델 계산 ≤ 20ms (행 상한 제거의 대가, 새 지표).
3. 번들 순증 ≤ 6 KiB gzip (LTTB 포함), ADR-210 승인 상한 (Builder ≤1,297,311 / Preview ≤630,625 B, 만료 2026-10-10) 안. 초과 시 사용자 재승인.
4. `fit` 이하 문서는 scene byte 동일 (예산은 넘칠 때만 개입) — 기존 스냅샷 4건 · ADR-210 T10 32건 · legacy 6종 회귀 0.
5. 창 위치는 canonical write 0 (뷰 상태). 두 leg 는 같은 `size` 에서 같은 범주 목록·행을 받는다.

**Soft constraints**: Recharts 3.10.1 고정 (온라인 최신 기능 자동 채택 없음). 최소 단위 px 는 사람이 구분 가능한 값을 실측으로 정한다 (추정 금지). ADR-210 후속 ② (컨트롤 mount 비용) 와 새 표현 옵션은 이 ADR 뒤.

## Alternatives Considered

### 대안 A: 상수 유지 + 셀 기준 cap

- 설명: `CHART_SAMPLE_ROWS` 를 "행" 이 아니라 "행 × 시리즈" 로 센다. Preview 는 그대로 전체 행.
- 근거: ADR-210 P4 에서 검토한 최소 변경. 업계 선례 없음 — 라이브러리들은 픽셀 기준 (아래 B/C).
- 위험:
  - 기술: L — 상수 하나와 slice 조건.
  - 성능: M — Canvas 만 개선, Preview 의 0.5px 막대 1,000개는 그대로.
  - 유지보수: M — 종류마다 (pie 조각·radar 축) 다른 상수가 필요해지고 픽셀과 계속 어긋난다.
  - 마이그레이션: H — 컬럼이 많을수록 캔버스가 더 짧게 잘려 Preview 와 모양이 달라진다 (사용자-가시, 설명 불가).

### 대안 B: 픽셀 예산 계약 — `fit` 파생 + 축 종류별 창·축약·묶기 (spec SSOT)

- 설명: `fit = floor(예산 축 / 최소 단위)` 를 spec 이 종류별로 계산 (bar/line/area 플롯 폭, pie 둘레, radar 축 간격, radial 링 두께). 넘치면 범주 축은 창 (Canvas 창 0 정적, Preview/Publish 스크롤·키보드), 순서/기간 축은 집계·LTTB, 극좌표는 "기타" 묶기. 두 leg 가 같은 결과를 소비. `CHART_SAMPLE_ROWS` 폐지.
- 근거: [ECharts `sampling: 'lttb'`](https://echarts.apache.org/en/option.html#series-line.sampling) + `dataZoom` (창) · [Highcharts dataGrouping](https://api.highcharts.com/highstock/series.line.dataGrouping) (픽셀 폭 `groupPixelWidth` 기준 집계) · [Recharts Brush](https://recharts.github.io/en-US/api/Brush/) (창, 3.10.1 export 확인) · [Steinarsson, LTTB (2013)](https://skemman.is/handle/1946/15343) · Vega-Lite `bin`/`aggregate`. 픽셀 기준 집계 (Highcharts) 와 모양 보존 축약 (LTTB) 은 시계열 차트의 표준 선택이다.
- 위험:
  - 기술: M — LTTB·집계·others 3가지 경로와 축 종류 판정. 순수 함수라 손계산 오라클로 검증 가능.
  - 성능: M — 행 상한이 사라져 모델 계산이 행 수에 비례 (5,000행 지표 신설, 필요 시 안전 상한 별도 상수).
  - 유지보수: M — 최소 단위 5종·`--chart-others` 토큰이 rule 채널에 추가되지만 한 곳 (`budget.ts`) 이 SSOT.
  - 마이그레이션: M — 200행 초과 문서는 보이는 결과가 바뀐다 (목적). `displayBudget` 은 선택적, 구버전은 무시 (데이터 손실 0). 사용자-가시 변경으로 CHANGELOG 기록.

### 대안 C: Preview/Publish 만 창 (Recharts Brush) + Canvas 는 현행 200행

- 설명: 상호작용 표면인 Preview 에만 Brush 를 붙이고 Canvas 규칙은 두지 않는다.
- 근거: Recharts 권장 사용법 그대로 (Brush 는 DOM 전용). 구현 최소.
- 위험:
  - 기술: L — Brush 한 컴포넌트.
  - 성능: M — Canvas 의 columns 4× 비용은 그대로 (hard constraint 1 미달).
  - 유지보수: H — 창 크기·위치 규칙이 DOM 에만 있어 D3 대칭이 깨진다 ("Skia 가 따라간다" 형태의 consumer-to-consumer). pie/radar/radial 은 Brush 가 없어 별도 규칙이 또 필요.
  - 마이그레이션: L — Canvas 무변경.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | M    | M        | H            |     1      |
| B    | M    | M    | M        | M            |     0      |
| C    | L    | M    | H        | L            |     1      |

루프 판정: B 에 HIGH 없음 → 추가 대안 불필요. A·C 의 HIGH 는 각각 "사용자-가시 비대칭" 과 "D3 대칭 파괴" 로 구조적이며 수정으로 낮아지지 않는다.

## Decision

**대안 B: 픽셀 예산 계약**을 선택한다.

선택 근거:

1. 마크 수 상한이 픽셀에서 파생되면 비용이 데이터 크기와 분리된다 — "많은 요소를 가볍게" 와 일치하고 hard constraint 1·2 를 구조로 만족한다.
2. 두 leg 가 같은 `size` 에서 같은 범주 목록·행을 받으므로 "빌더 화면과 Preview 가 다르게 보인다" 는 현 상태가 사라진다. 크기가 다를 때 (Compare Mode) 다른 것은 계약이며 fixture 에 명시한다.
3. 잔존 위험 (모델 비용·최소 단위 실측·LTTB 공통 x) 은 전부 P0 spike 와 손계산 fixture 로 측정 가능한 종류다 — 추정으로 남는 항목이 없다.

기각 사유:

- **대안 A 기각**: 픽셀과 무관한 상수를 종류마다 늘리는 방향. 컬럼 수에 따라 캔버스가 더 짧아져 Preview 와 모양이 달라진다 — ADR-210 이 이 이유로 셀 cap 을 채택하지 않았다.
- **대안 C 기각**: 창 규칙이 DOM 에만 있어 Skia 가 그것을 따라가야 하는 consumer-to-consumer 구조 (ssot-hierarchy §6 금지). 극좌표 3종은 Brush 가 없어 어차피 별도 규칙이 필요하다.

> 구현 상세: [211-chart-display-budget-pixel-fit-window-decimation-breakdown.md](design/211-chart-display-budget-pixel-fit-window-decimation-breakdown.md)

## Risks

| ID  | 위험                                                                                                             | 심각도 | 대응                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 행 상한 제거로 모델 계산이 행 수에 비례 — 대용량 collection 에서 Builder 프레임·Preview 첫 렌더 회귀             |  HIGH  | G0 5,000행 모델 비용 실측 · G4 불리 케이스 (폭 2,000px + 시리즈 8 + 창 이동 연속) · 필요 시 안전 상한 상수 (표시 예산과 분리, 안내 별도)                                                                                                           |
| R2  | 두 leg 의 `fit`·창·축약 결과 불일치 (부동소수 · 반올림 · 시리즈별 LTTB x 집합 차이) → 같은 크기에서 다른 그림    |  HIGH  | G1 같은 `size` 에서 범주 목록·행 byte 동일 fixture · 공통 x 집합 규칙 · 손계산 오라클 (Q5)                                                                                                                                                         |
| R3  | 축약·묶기가 값을 합쳐 tooltip/축 문자열이 원본과 다른 뜻 (합계/평균/기타) 을 갖는데 표기가 없으면 잘못 읽힌다    |  MED   | 문자열 SSOT (`presentation.ts`) 에 단위 접미 · "기타" 문자열 · P3 live 에서 tooltip 확인                                                                                                                                                           |
| R4  | 최소 단위 px 기본값이 실측 없이 정해지면 너무 촘촘하거나 (가독 불가) 너무 성기다 (정보 손실)                     |  MED   | P0 에서 light/dark 실측 후 확정, rule 채널 값으로 두어 문서 저장 없이 조정 가능                                                                                                                                                                    |
| R5  | 200행 초과 기존 문서의 캔버스 결과가 바뀐다 (앞 200행 → 창/축약) — 사용자-가시 변경                              |  MED   | 목적이므로 CHANGELOG 사용자-가시 기록 · `fit` 이하 문서 byte 동일 회귀 (G1) · 구버전 무시 (데이터 손실 0) · BC 수식화: 재직렬화 0 파일, 영향 = dataBinding 행 수 > `fit` 인 차트만 (건수는 P0 inventory 에서 집계 — 로컬 프로젝트라 사전 %는 없다) |
| R6  | Recharts `Brush` 가 `PlainBarShape` · `accessibilityLayer` · 3.10.1 과 공존하지 않거나 번들 순증이 한도를 넘는다 |  MED   | P0 spike 에서 공존 확인, 실패 시 자체 스크롤 트랙 (창 상태만 있으면 됨) · G4 번들 순증 ≤ 6 KiB                                                                                                                                                     |

분리 검토 (HIGH 2): P2 축약·묶기를 별도 ADR 로 뺄 수 있으나 창만으로는 기간 축·극좌표가 그대로 남아 계약이 반쪽이 된다 — 같이 간다. R1·R2 는 각각 G0/G4 · G1 이 1:1 로 관리한다.

## Gates

| Gate | 시점 | 통과 조건                                                                                                                                                                                                                                                                         | 실패 시 대안                                            |
| ---- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| G0   | P0   | 최소 단위 5종 light/dark 실측값 · Brush 공존 여부 · 5,000행 모델 계산 실측 (headed Chromium 1440×900 DPR 1, 기록) · `CHART_SAMPLE_ROWS` 소비처 4곳 inventory 확정                                                                                                                 | 계약 보정 후 리뷰, 구현 보류                            |
| G1   | P1   | R2: 손계산 오라클 표 (폭·반지름별 `fit`) 와 spec 결과 일치 · 같은 `size` 두 leg 범주 목록·행 byte 동일 · `fit` 이하 문서 scene byte 동일 (스냅샷 4 · T10 32 · legacy 6) · `CHART_SAMPLE_ROWS` 참조 0                                                                              | scale 생성 경로 수리, 상수 부활 금지                    |
| G2   | P2   | R3: 집계 합 = 원본 합 · LTTB 극값 위치 오차 ≤ 1 슬롯 · others 합산·토큰 light/dark 두 leg 일치 · 단위 접미 문자열 SSOT                                                                                                                                                            | 축약 방식 변경 (집계 ↔ LTTB) 후 재검증                  |
| G3   | P3   | 실제 빌더: 1,000행 범주 bar → Canvas 창 0 · 패널 안내 · Preview 스크롤/키보드로 끝까지 (canonical write 0) · Properties `overflow` 선택 반영 · Export → publish 같은 결과                                                                                                         | 창 상태 경로 수리                                       |
| G4   | P4   | R1 (측정 5-질문 명시): 대상 = 합성 행 (규모 전용) · 불리 = 폭 2,000px + 시리즈 8 + 창 이동 연속 · 대조군 = `53c761c8b` clean worktree (원래 lockfile) · columns800 vs group800 `render.frame` p95 ±2ms · static W800 4종 ≤100ms · 5,000행 모델 ≤20ms · 번들 순증 ≤6 KiB · 상한 안 | 안전 상한 상수 · LTTB 대신 집계 · 초과 시 사용자 재승인 |
| G5   | P5   | preflight · 전체 스위트 · live · rollback 제한 · README/CHANGELOG (사용자-가시 변경 기록) · 열린 필수 조건 0                                                                                                                                                                      | Proposed/Accepted 상태에 맞게 미완료 기록               |

## Consequences

### Positive

- 마크 수가 픽셀에서 파생되어 Canvas 프레임 비용이 데이터 크기·컬럼 수와 분리된다 (`computeChartScene.ts` scale 생성 · `canvasSceneNode.ts` 주입).
- 같은 크기에서 빌더 화면과 Preview/Publish 가 같은 그림을 그린다 — "200행 샘플" 안내가 사라지고 "표시 {fit}/{total}" 로 바뀐다.
- 기간 축 데이터가 모양을 유지한 채 줄고, 큰 pie/radar 가 "기타" 로 읽을 수 있게 된다.

### Negative

- 200행 초과 기존 문서는 캔버스 결과가 바뀐다 (사용자-가시).
- Preview/Publish 에 뷰 상태 (창 위치) 가 생긴다 — 저장하지 않지만 컴포넌트 state 와 키보드 처리가 늘어난다 (`RechartsChart.tsx` · `Chart.tsx`).
- 축약된 값은 원본 행과 1:1 대응이 없어 tooltip 이 "합계/평균/기타" 를 표기해야 한다. 최소 단위 5종·`--chart-others` 토큰이 rule 채널에 추가된다.
