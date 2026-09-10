# ADR-211: 차트 표시 예산 — 픽셀 폭 기준 마크 수와 창·축약 계약

## Status

Proposed — 2026-09-10 (코드 기준 `2a9ab37fc`, ADR-210 Implemented 직후). 사용자가 방향과 제목을 정함 (분리 4질문 lock-in: [breakdown §1](design/211-chart-display-budget-pixel-fit-window-decimation-breakdown.md#1-범위--선행-관계-분리-4질문-lock-in)). round 1 (codex, HIGH 3 · MEDIUM 6 — [reviews/211.md](reviews/211.md)) 반영: 세 예산 분리 · 집계와 표시 형식 분리 · LTTB → bucket 극값 선택 · Brush → RAC Slider 창 트랙 · 대안 D 추가.

## Context

차트가 그릴 수 있는 마크 수는 **차트가 차지한 픽셀 공간**이 정한다. 500px 폭에 막대 1,000개는 들어가지 않는다 — 어떤 규칙으로든 일부만 보여주고 (창·스크롤), 모양을 유지한 채 줄이거나 (기간 축 축약), 작은 것을 묶어야 (기타) 한다. 현재 두 leg 는 각각 다른 잘못된 규칙을 쓴다.

**현행 코드 사실** (2026-09-10, `2a9ab37fc`):

| 사실                                                                                                                                                          | 경로                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| band scale 은 `step = width / count` — **최소 폭이 없다.** 범주 1,000개는 0.5px 막대로 전부 들어간다. 극좌표 `angleScale` 도 같은 규약 (`sweep / n`)          | `packages/specs/src/chart/scales.ts:82` · `polar.ts:34`                                                                     |
| Canvas 는 `CHART_SAMPLE_ROWS = 200` 으로 **앞 200행**만 주입한다 (ADR-157 collection 샘플 정책의 동형 이식). 픽셀 크기와 무관한 상수                          | `computeChartScene.ts:56-57` · `canvasSceneNode.ts:2585-2591` (Skia 쪽 `skiaPrimitives.ts:3357` 은 수신만, 자체 slice 없음) |
| Preview/Publish 는 **전체 행**을 그린다 (`rows = dataBinding ? boundRows : data`). 창·축약·Brush 없음                                                         | `packages/shared/src/components/Chart.tsx:336` · `RechartsChart.tsx:138`                                                    |
| 범주는 dimension 값을 문자열화해 **첫 출현 순서**로 세고, 같은 범주의 행은 **합산 (sum)** 한다 — 정렬·시간 판정 없음                                          | `series.ts:42-49` · `series.ts:102-118`                                                                                     |
| 두 leg 모두 픽셀 `ChartSize` 를 이미 가진다 — Canvas 는 layout rect, DOM 은 `ResizeObserver`; 둘 다 같은 `resolveChartLayout` 을 쓴다                         | `computeChartScene.ts:504-507, 526` · `Chart.tsx:112-139` · `RechartsChart.tsx:162`                                         |
| 값 컬럼 모드 (ADR-210) 는 200행 × 컬럼 수만큼 마크가 늘어 Builder `render.frame` p95 columns800 **24ms** vs group800 **10ms** (같은 빌드, 한도 안이지만 2.4×) | ADR-210 [P4 evidence](evidence/210-p4-bundle-runtime-frame.md)                                                              |
| pie 는 음수를 절댓값 면적으로, 0 은 조각 없음; radial 은 domain 밖을 clamp                                                                                    | `marks/pie.ts:201-204` · `marks/radial.ts:145-153`                                                                          |
| 패널 안내 "Canvas: 200 / total 행 샘플 · 미리보기는 전체 행" 이 이 차이를 사용자에게 설명한다                                                                 | `ChartAuthoringControls.tsx:92-98` · `i18n/translations.ts:85`                                                              |
| `CHART_INVALID_SETTINGS_TEXT` 는 두 leg 가 같은 **영문 상수**를 그린다 — 번역을 export 에 싣는 경로는 없다                                                    | `computeChartScene.ts:129` · `RechartsChart.tsx:227`                                                                        |
| 새 props 는 catalog `accepts` 에 선언해야 DOM 에 투영되고, Skia 는 allowlist 로 고른다                                                                        | `Chart.binding.ts:39` · `toRacProps.ts:88` · `skiaPrimitives.ts:3330`                                                       |
| `CHART_SAMPLE_ROWS` 제품 코드 소비처 3곳 + 테스트 1 (`chartRowInjection.test.ts` 6건) — 전부 차트 전용, ADR-157 본체는 무관                                   | grep `CHART_SAMPLE_ROWS` (`packages/` · `apps/` src)                                                                        |

결과: 빌더 화면은 "앞 200행", Preview 는 "0.5px 막대 1,000개" 로 같은 문서가 두 곳에서 다르게 보이고, 비용은 픽셀이 아니라 데이터 크기에 비례한다. composition 빌더의 목적은 차트 하나가 아니라 **많은 요소를 가볍게** 그리는 것이므로 마크 수의 상한은 픽셀 (과 시리즈 수) 에서 와야 한다.

**SSOT 도메인**: D3 (시각) — `fit`·창·축약·묶기 결과는 spec 기하 SSOT (ADR-194) 가 계산하고 Skia·Recharts 가 대등하게 소비한다. 창 이동 컨트롤은 RAC `Slider` (D1 은 RAC 소유, 별도 ARIA 작성 금지), 마크 탐색은 Recharts accessibilityLayer. 저장 props 는 `displayBudget` 선택적 묶음 하나 (D2 — RSP 에 대응 개념 없음, 차트 전용 custom, ADR-209/210 의 `valueFields` 계열과 같은 근거).

**축약이 보장하는 것** (round 1 렌즈 질문의 답): 종류별로 다르다 — bar/누적 line·area 의 bucket **집계**는 값의 합 (또는 명시한 통계) 을 보존하고, 비누적 line·area 의 bucket **극값 선택**은 원본 점을 골라 시리즈별 극값을 정확히 보존하며, 극좌표의 **others** 는 개수를 줄이되 값 비중이 작은 조각의 최소 크기는 보장하지 않는다 (`[1000, 1]` 은 조각 2개가 정답). 자동 추정으로 통계 의미를 바꾸지 않는다 — 통계는 사용자 명시 (`aggregate`, 기본 sum) 뿐이고 표시 형식 (`valueFormat`) 은 집계에 영향을 주지 않는다.

**Hard constraints**:

1. Builder `render.frame` p95: columns800 이 group800 과 ±2ms **이고 각각 before (`53c761c8b`) 이하** (현 24 vs 10) — 비용이 컬럼 수·행 수가 아니라 픽셀 폭과 시리즈 수에 비례.
2. runtime static W800 4종 p95 ≤ 100ms 유지 (ADR-210 G4 수치), 5,000행 × 시리즈 4 균등 분포 모델 계산 ≤ 20ms (행 상한 제거의 대가, 새 지표).
3. 번들 순증 ≤ 6 KiB gzip. ADR-210 승인 상한 (Builder ≤1,297,311 / Preview ≤630,625 B, 만료 2026-10-10) 초과 여부는 G4-policy 로 분리 — 초과 시 사용자 재승인.
4. **행 ≤ 200 · 범주 ≤ fitEff · 마크 ≤ M** 인 문서는 scene byte 동일 (예산은 넘칠 때만 개입) — 기존 스냅샷 4건 · ADR-210 T10 32건 · legacy 6종 회귀 0. 그 밖 (행 > 200 · 범주 > fitEff) 은 바뀌는 것이 목적이며 사용자-가시 변경으로 기록.
5. 창 위치는 canonical write 0 (뷰 상태). 두 leg 는 같은 `size`·같은 시리즈 수에서 같은 visible 범주 목록·값을 받는다. `valueFormat` 을 바꿔도 집계값 byte 동일.

**Soft constraints**: Recharts 3.10.1 고정 (`Brush` 는 창 길이를 고정하지 않으므로 채택하지 않음). 최소 단위 px 는 사람이 구분 가능한 값을 실측으로 정한다 (추정 금지). ADR-210 후속 ② (컨트롤 mount 비용) 와 새 표현 옵션은 이 ADR 뒤.

## Alternatives Considered

### 대안 A: 상수 유지 + 셀 기준 cap

- 설명: `CHART_SAMPLE_ROWS` 를 "행" 이 아니라 "행 × 시리즈" 로 센다. Preview 는 그대로 전체 행.
- 근거: ADR-210 P4 에서 검토한 최소 변경. 업계 선례 없음 — 라이브러리들은 픽셀 기준 (아래 B/D).
- 위험:
  - 기술: L — 상수 하나와 slice 조건.
  - 성능: M — Canvas 만 개선, Preview 의 0.5px 막대 1,000개는 그대로.
  - 유지보수: M — 종류마다 (pie 조각·radar 축) 다른 상수가 필요해지고 픽셀과 계속 어긋난다.
  - 마이그레이션: H — 컬럼이 많을수록 캔버스가 더 짧게 잘려 Preview 와 모양이 달라진다 (사용자-가시, 설명 불가).

### 대안 B: 픽셀 슬롯 예산 `fit` 만 — 창·축약·묶기, 행·마크 상한 없음

- 설명: `fit = floor(예산 축 / 최소 단위)` 를 spec 이 종류별로 계산. 넘치면 범주 축은 창, 순서 축은 축약, 극좌표는 others. `CHART_SAMPLE_ROWS` 폐지, 다른 상한 없음.
- 근거: [ECharts `sampling`](https://echarts.apache.org/en/option.html#series-line.sampling) + `dataZoom` · [Highcharts dataGrouping](https://api.highcharts.com/highstock/series.line.dataGrouping) (`groupPixelWidth` 픽셀 기준 집계) · Vega-Lite `bin`/`aggregate`.
- 위험:
  - 기술: M — 집계·선택·others 세 경로와 축 종류 판정. 순수 함수라 손계산 오라클로 검증 가능.
  - 성능: **H** — `fit` 은 슬롯 수일 뿐 시리즈 수가 없어 누적/line/area 마크 수가 `fit × S` 로 늘고, 행 상한이 사라져 모델 계산이 행 수에 무한 비례한다 (round 1 h3).
  - 유지보수: M — 최소 단위 5종·`--chart-others` 토큰이 rule 채널에 추가되지만 한 곳 (`budget.ts`) 이 SSOT.
  - 마이그레이션: M — 200행 초과·범주 초과 문서는 보이는 결과가 바뀐다 (목적). `displayBudget` 은 선택적, 구버전은 무시 (데이터 손실 0).

### 대안 C: Preview/Publish 만 창 (Recharts Brush) + Canvas 는 현행 200행

- 설명: 상호작용 표면인 Preview 에만 Brush 를 붙이고 Canvas 규칙은 두지 않는다.
- 근거: Recharts 권장 사용법 그대로 ([Brush](https://recharts.github.io/en-US/api/Brush/) 는 DOM 전용 zoom/pan 범위 컨트롤).
- 위험:
  - 기술: M — 설치본 3.10.1 `Brush` 는 손잡이 둘의 index 를 각각 움직여 창 길이가 변한다 — 고정 창 이동은 별도 구현.
  - 성능: M — Canvas 의 columns 4× 비용은 그대로 (hard constraint 1 미달).
  - 유지보수: H — 표시 정책이 두 leg 에 따로 있어 "같은 문서가 다르게 보이는" 현 상태가 유지되고, 극좌표 3종은 Brush 가 없어 또 다른 규칙이 필요하다 (정책 비대칭 — consumer 간 코드 의존은 아니다).
  - 마이그레이션: L — Canvas 무변경.

### 대안 D: 세 예산 계약 — 슬롯 `fit` + 마크 상한 `M` (시리즈 포함) + 두 leg 동일 행 상한 `R`, 집계/표시 분리, bucket 극값 선택 (round 1 후 추가)

- 설명: B 에 두 상한을 더한다 — `fitEff = min(fit, floor(M / (S × k)))` 로 총 마크 수를 시리즈 수까지 포함해 제한하고, 모델 계산 행 수는 두 leg 가 똑같이 `R` 로 자른다 (초과 시 진단·안내). 집계 통계는 `aggregate` (기본 sum) 로 명시, `valueFormat` 과 무관. 비누적 line/area 는 LTTB 대신 bucket 별 시리즈별 min/max 원본 점 선택 (극값 정확 보존). 창 컨트롤은 RAC `Slider` 단일 thumb (창 길이 고정), 트랙 높이는 두 leg 가 같이 예약. 최소 마크 크기는 보장하지 않는다 (개수만).
- 근거: Highcharts `dataGrouping.approximation` (sum/average/high/low 명시 — 표시 형식과 별개) · [M4 (Jugel et al., 2014)](https://www.vldb.org/pvldb/vol7/p797-jugel.pdf) 픽셀 열당 min/max 보존이 시각적 손실 0 인 축약 · RAC `useSlider` 키보드 규약.
- 위험:
  - 기술: M — 경로 3 + 판정 + 창 상태. 전부 순수 함수/손계산 fixture 로 검증 가능 (round 1 반례를 fixture 로 고정).
  - 성능: M — 총 마크 ≤ M, 모델 행 ≤ R 로 상한이 있다. `R` 의 실제 필요 여부는 P0 실측.
  - 유지보수: M — rule 채널 항목이 B 보다 3개 많다 (`M` · `R` · `windowTrackHeight`) 이지만 같은 SSOT.
  - 마이그레이션: M — B 와 같음 + `R` 도입 시 두 leg 모두 앞 `R` 행 (사용자-가시, 안내).

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | L    | M    | M        | H            |     1      |
| B    | M    | H    | M        | M            |     1      |
| C    | M    | M    | H        | L            |     1      |
| D    | M    | M    | M        | M            |     0      |

루프 판정 (1회): A·B·C 전부 HIGH 1 → 위험을 회피하는 대안 D 추가 (B 의 성능 HIGH 를 `M`·`R` 로, 극값 손실을 bucket min/max 로). D 는 HIGH 0 → 루프 종료. A·C 의 HIGH 는 각각 "사용자-가시 비대칭" 과 "정책 비대칭 유지" 로 구조적이며 수정으로 낮아지지 않는다.

## Decision

**대안 D: 세 예산 계약**을 선택한다.

선택 근거:

1. 마크 수 상한이 픽셀과 시리즈 수에서 파생되고 (`fitEff`), 총 마크 (`M`) 와 모델 행 (`R`) 에 상한이 있어 비용이 데이터 크기와 분리된다 — "많은 요소를 가볍게" 와 일치하고 hard constraint 1·2 를 구조로 만족한다.
2. 두 leg 가 같은 `size`·같은 시리즈 수에서 같은 visible 범주 목록·값을 받으므로 "빌더 화면과 Preview 가 다르게 보인다" 는 현 상태가 사라진다. 크기가 다를 때 (Compare Mode) 다른 것은 계약이며 fixture 에 명시한다.
3. 축약이 보장하는 것을 종류별로 한 가지로 고정했다 (집계 = 값 통계 보존 · 극값 선택 = 시리즈별 극값 정확 보존 · others = 개수만). 통계 의미를 자동 추정하지 않고 표시 형식과 섞지 않는다.
4. 잔존 위험 (최소 단위 실측 · `M`/`R` 필요 여부 · 결선 · 창 트랙 공존) 은 전부 P0 spike 와 손계산 fixture 로 측정 가능한 종류다.

기각 사유:

- **대안 A 기각**: 픽셀과 무관한 상수를 종류마다 늘리는 방향. 컬럼 수에 따라 캔버스가 더 짧아져 Preview 와 모양이 달라진다 — ADR-210 이 이 이유로 셀 cap 을 채택하지 않았다.
- **대안 B 기각**: 슬롯 수만으로는 시리즈 수·행 수에 비례하는 비용을 막지 못하고 (h3), LTTB 공통 x 는 다른 시리즈의 spike 를 잃는다 (h2). D 가 이 둘을 상한과 min/max 선택으로 닫는다.
- **대안 C 기각**: 표시 정책이 DOM 에만 있어 같은 문서가 두 leg 에서 계속 다르게 보이고, 극좌표 3종은 어차피 별도 규칙이 필요하다. `Brush` 는 창 길이를 고정하지 않아 그대로 쓸 수도 없다.

> 구현 상세: [211-chart-display-budget-pixel-fit-window-decimation-breakdown.md](design/211-chart-display-budget-pixel-fit-window-decimation-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                | 심각도 | 대응                                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 행 상한 200 제거로 모델 계산 (`series.ts:102-118` 합산 · `budget.ts` bucket/others) 이 행 수에 비례 — `R` 없이 대용량 collection 에서 Builder 프레임·Preview 첫 렌더 회귀                                           |  MED   | `M`·`R` 상한 (D) · G0 5,000/20,000행 실측으로 `R` 필요 여부 결정 · G4 불리 케이스 (폭 2,000px + S 8 + 창 이동 20회, cold/warm) · before 총비용 대비                                                                                                  |
| R2  | 두 leg 의 `fitEff`·bucket·others·창 결과 불일치 (부동소수·반올림·트랙 높이 예약 차이) → 같은 크기에서 다른 그림 — 경로 `computeChartScene.ts:613` scale · `runtimeData.ts:29` 모델 · `resolveChartLayout` 트랙 예약 |  MED   | 한 순수 함수 (`budget.ts`) 를 두 leg 가 같은 입력으로 호출 (갈리는 입력은 `size`·`start` 뿐, 계약) · G1 같은 `size` 에서 visible 범주·값 byte 동일 fixture · 손계산 오라클 (Q5)                                                                      |
| R3  | 집계·others 가 값을 합쳐 tooltip/축 문자열의 뜻이 원본과 다른데 (합계/평균/기타) 표기가 없으면 잘못 읽힌다; others 부호 합산으로 pie 조각이 사라질 수 있다                                                          |  MED   | 접미·others 상수 + `othersLabel` (문자열 SSOT `presentation.ts`) · tooltip 은 원본 합 표시 · G2 sum/mean/others 독립 오라클 · P3 live tooltip 확인                                                                                                   |
| R4  | 최소 단위 px·`M`·`R` 기본값이 실측 없이 정해지면 너무 촘촘하거나 (가독 불가) 너무 성기다 (정보 손실)                                                                                                                |  MED   | P0 light/dark 실측 후 확정, rule 채널 값으로 두어 문서 저장 없이 조정 가능                                                                                                                                                                           |
| R5  | 영향 집합 (A) 행 > 200 · (B) 범주 > fitEff · (C) 마크 > M 의 캔버스 결과가 바뀐다 — 사용자-가시 변경                                                                                                                |  MED   | 목적이므로 CHANGELOG 사용자-가시 기록 · byte 동일 집합 (행 ≤ 200 · 범주 ≤ fitEff · 마크 ≤ M) 회귀 (G1) · 구버전 무시 (데이터 손실 0) · BC 수식화: 재직렬화 0 파일, 건수는 P0 inventory (dataBinding 차트별 행·범주·폭) — 로컬 프로젝트라 사전 % 없음 |
| R6  | `displayBudget` 이 선언만 되고 화면에 닿지 않는다 (`accepts` · `toRacProps` · shared memo · Skia allowlist · editor mount 중 하나라도 빠지면 DOM 만 조용히 깨진다)                                                  |  MED   | breakdown §2.6 inventory 를 G0 에 고정 · G3 live 가 Properties → canonical → reload → 두 leg → Export → publish 전 경로를 실제로 통과                                                                                                                |
| R7  | RAC `Slider` 창 트랙이 플롯 높이를 차지해 `fit` 이 줄고, Canvas 의 비활성 트랙과 높이가 어긋나면 R2 로 번진다                                                                                                       |  LOW   | `windowTrackHeight` metrics 로 두 leg 같이 예약 (`n > fitEff` 판정 공유) · P0 에서 fit 감소량 기록                                                                                                                                                   |

잔존 HIGH 위험 없음 — B 의 성능 HIGH 는 D 의 `M`·`R` 로 MED 가 됐고 (같은 경로 R1), 두 leg 불일치는 한 함수·같은 입력이라 MED (R2). 분리 검토: P2 축약·묶기를 별도 ADR 로 뺄 수 있으나 창만으로는 기간 축·극좌표가 그대로 남아 계약이 반쪽이 된다 — 같이 간다.

## Gates

| Gate | 시점 | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 실패 시 대안                                           |
| ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| G0   | P0   | 최소 단위 5종 light/dark 실측값 · 5,000/20,000행 × S 4 모델 계산 실측 → `M`/`R` 값 또는 불필요 판정 (headed Chromium 1440×900 DPR 1, 3+12 표본, cold/warm, 기록) · Slider 창 트랙 공존 (창 길이 불변 · End 로 끝까지 · 트랙 높이의 fit 감소량) · 결선 inventory (§2.6) 확정 · 반례 fixture 초안 (평탄+spike, 상쇄, `[1000,1]`, fit 0/1/2) · 영향 집합 (A)/(B)/(C) 건수                                                                                              | 계약 보정 후 리뷰, 구현 보류                           |
| G1   | P1   | R2: 손계산 오라클 표 (폭·반지름·S 별 `fit`/`fitEff`, fit 0/1/2) 와 spec 결과 일치 · 같은 `size`·`S` 두 leg visible 범주·값 byte 동일 · byte 동일 집합 (행 ≤ 200 · 범주 ≤ fitEff · 마크 ≤ M: 스냅샷 4 · T10 32 · legacy 6) 회귀 0 · `CHART_SAMPLE_ROWS` 참조 0 (**제품 코드 `packages/`·`apps/` src 범위**, 문서·리뷰 제외)                                                                                                                                          | scale 생성 경로 수리, 상수 부활 금지                   |
| G2   | P2   | R3 독립 오라클 4종: sum → bucket 합 = 원본 합 (시리즈별) · mean → bucket 안 범주 평균 손계산 · `valueFormat` 변경 시 집계값 byte 동일 · 극값 선택 → 시리즈별 전역·bucket max/min index 가 선택 집합에 정확히 포함 (평탄+spike·상쇄·결측 gap fixture, 원본 스캔 오라클) · others ranking key 손계산 · pie `+10/−10` 면적 0 + tooltip 합 · radial domain 재계산 · `--chart-others` light/dark 두 leg 일치                                                             | 축약 방식 변경 후 재검증 (LTTB 복귀 금지)              |
| G3   | P3   | R6·R7 live: 실제 빌더 1,000행 범주 bar → Canvas 창 0 + 비활성 트랙 · 패널 안내 · Preview Slider 화살표/PageDown/End 로 끝까지 (창 길이 불변, canonical write 0) · 5,000행 기간 축 비누적 line → 점 ≤ 2·S·B, 누적 → 집계 + 접미 · pie 40 → others 1 · Properties `overflow`/`aggregate`/`axis`/`othersLabel` → canonical write → reload → 두 leg → Export → publish 같은 결과                                                                                        | 결선/창 상태 경로 수리                                 |
| G4   | P4   | **G4-engineering** (5-질문 명시): Q1 합성 행 규모 전용 · Q2 불리 = 폭 2,000px + S 8 + 창 이동 20회 + cold/warm · Q3 대조군 `53c761c8b` clean worktree (원래 lockfile), before 총비용 기록 · Q4 §2.6 · Q5 손계산. columns800 vs group800 `render.frame` p95 ±2ms **이고 각각 before 이하** · static W800 4종 ≤100ms · 5,000행 × S 4 모델 ≤20ms · 번들 순증 ≤6 KiB · network 9/9. **G4-policy**: ADR-210 승인 상한 안이면 PASS, 초과면 사용자 재승인 (자동 PASS 금지) | `R` 도입/축소 · 극값 선택 → 집계 · 초과 시 사용자 결정 |
| G5   | P5   | preflight · 전체 스위트 · live · rollback 제한 (데이터 보존 vs 시각 동일성 분리 기재) · README/CHANGELOG (영향 집합 (A)/(B)/(C) 사용자-가시 기록) · 열린 필수 조건 0                                                                                                                                                                                                                                                                                                | Proposed/Accepted 상태에 맞게 미완료 기록              |

## Consequences

### Positive

- 마크 수가 픽셀·시리즈 수에서 파생되고 총 마크·모델 행에 상한이 있어 Canvas 프레임 비용이 데이터 크기와 분리된다 (`computeChartScene.ts` scale 생성 · `canvasSceneNode.ts` 주입 · `budget.ts`).
- 같은 크기에서 빌더 화면과 Preview/Publish 가 같은 그림을 그린다 — "200행 샘플" 안내가 "표시 {fitEff}/{n}" 로 바뀐다.
- 기간 축 데이터가 시리즈별 극값을 잃지 않고 줄고 (min/max 선택), 누적 차트는 명시한 통계로 묶이며, 큰 pie/radar/radial 은 "기타" 로 읽을 수 있게 된다.

### Negative

- 행 > 200 또는 범주 > fitEff 인 기존 문서는 캔버스 결과가 바뀐다 (사용자-가시). `R` 을 도입하면 두 leg 모두 앞 `R` 행만 계산한다.
- Preview/Publish 에 뷰 상태 (창 위치) 와 Slider 트랙이 생긴다 — 저장하지 않지만 컴포넌트 state 와 플롯 높이 예약이 늘어난다 (`RechartsChart.tsx` · `Chart.tsx` · `resolveChartLayout`).
- 집계된 값은 원본 행과 1:1 대응이 없어 tooltip 이 통계 접미를 표기해야 하고, 값 비중이 작은 조각의 최소 크기는 보장하지 않는다. rule 채널에 최소 단위 5종 · `M` · `R` · `windowTrackHeight` · `--chart-others` 가 추가된다.
