# ADR-312 구현 설계: Chart 데이터 포맷 표준

> 본문: [ADR-312](../312-chart-data-format-standard.md). Proposed 2026-11-16. 아래의 새 타입 · 함수 · `dataMode` 값 이름은 제안이고 아직 구현되지 않았다. 코드 인용은 main `eb981fea4` 기준이다. 경로에 접두가 없으면 `packages/rendering/src/chart/` 아래다.

## 1. 전제

- 사용자 확정: 「임시적인 처리가 아닌 근본적인 포멧」 · 「모든차트의 표준화」 · ADR 분리 「새 ADR + 306 닫기」 (2026-11-16).
- 분리 점검 4 질문 (`.claude/rules/adr-writing.md`):
  1. **base / 응용**: ADR-306 (36 종 구현) 이 base, 이 ADR 은 그 위의 계약 정리다. ADR-306 은 Implemented 로 닫혔고 이 ADR 이 그 선행 조건이 되지 않는다.
  2. **schema 직교성**: 직교가 아니다. 이 ADR 은 ADR-306 이 더한 Chart prop 의 일부를 고쳐 쓴다 (개명 · `dataMode` 값) — 306 의 후속이다.
  3. **선행 전제 재검증**: ADR-306 의 전제 중 「가산 확장 · contract 유지」 는 이 ADR 에서 성립하지 않는다 (본문 Context §선행 결정 「바꾸는 것」). 나머지 (역할 표가 원천 · family 는 원본 행 직접 · 문서 변환 없음) 는 코드로 확인해 그대로 쓴다 (`authoring.ts:37-50` · `computeChartScene.ts:311-330` · `packages/shared/src/catalog/document/types.ts:166-169`).
  4. **판독에 미루지 않음**: 위 셋은 작성 시점에 확인했다. 사용자 confirm 은 2026-11-16 의 분리 질문 답이다.
- 측정 등급: 표준의 구조 (역할 표 · 형태 · 행 정책) 는 코드 근거로 착수한다. 측정은 번들 몫 (HC3) 과 계산 시간 (HC6) 을 정하는 데만 쓴다. Phase 0 은 go / no-go 가 아니다.

## 2. 표준의 정의

### 2.1 역할 표

역할 하나는 「이 차트가 행에서 읽는 열 하나 (또는 열 목록) 의 뜻」 이다. 지금의 `ChartRole` (`authoring.ts:37-42` — `prop` · `kind` · `required` · `accepts`) 을 둘로 나눈다.

```ts
// 역할의 뜻 — 전 종류 공통, 표 하나 (`roles.ts` 제안).
interface ChartRoleDef {
  key: keyof ChartProps & string; // 저장 key
  kind: "field" | "fields";
  accepts: "number" | "string" | "date" | "any";
  additive: boolean; // 같은 키의 행을 합칠 수 있는 값인가 (§2.4)
  defaultField: string | readonly string[]; // 값이 없을 때 읽는 열 · 표본의 열 이름
  label: string; // 패널 기본 라벨 (번역 조회 key)
  source: "rsc" | "composition"; // 이름의 출처 (rsc 면 대응 이름을 주석에)
}

// 종류가 그 역할을 쓰는 방식 — descriptor 의 형태 안.
interface ChartRoleUse {
  role: ChartRoleDef["key"];
  required: boolean;
  label?: string; // 종류별 라벨 (scatter 의 dimension = "X")
  accepts?: ChartRoleDef["accepts"]; // 종류가 받는 형 — calendar · candlestick 의 dimension = "date"
  defaultField?: string | readonly string[]; // 종류가 덮는 기본 열 이름 (최소한으로)
}
```

역할 목록 (제안 — Phase 0 인벤토리로 확정):

| key                                                    | kind   | 뜻                                |   additive   | 기본 열 이름                       | 출처 (대응 이름)                    |
| ------------------------------------------------------ | ------ | --------------------------------- | :----------: | ---------------------------------- | ----------------------------------- |
| `dimension`                                            | field  | 값을 늘어놓는 항목 · 축           |      —       | `category`                         | rsc (`dimension`)                   |
| `metric`                                               | field  | 주 값                             |      ✓       | `value`                            | rsc (`metric`)                      |
| `color`                                                | field  | 열의 값으로 시리즈를 나눔         |      —       | `series`                           | rsc (`color`)                       |
| `valueFields`                                          | fields | 값 열 목록 (열마다 시리즈 · 축)   |      ✓       | (없음 — 형태 columns 의 필수)      | composition (ADR-210)               |
| `goalField`                                            | field  | 목표 값                           |      ✓       | `goal`                             | composition (rsc `target`)          |
| `rangeFields`                                          | fields | 구간 경계                         |      ✗       | (없음)                             | composition                         |
| `startField` · `endField`                              | field  | 한 항목의 두 값 (앞 · 뒤)         |      ✓       | `start` · `end`                    | composition (rsc `metricStart/End`) |
| `lowerFields` · `upperFields`                          | fields | 값의 띠 (아래 · 위)               |      ✓       | (없음)                             | composition (rsc `metricStart/End`) |
| `sizeField`                                            | field  | 표식 크기                         |      —       | `size`                             | composition (rsc `size`)            |
| `labelField`                                           | field  | 표식 이름                         |      —       | `label`                            | composition                         |
| `kindField`                                            | field  | 단계 종류 (waterfall)             |      —       | `kind`                             | composition                         |
| `rankField`                                            | field  | 순위                              |      ✗       | `rank`                             | composition                         |
| `frontFields`                                          | fields | 앞줄 값 열 (skyline)              |      ✓       | (없음)                             | composition                         |
| `rowField`                                             | field  | 둘째 축 (행)                      |      —       | `row`                              | composition                         |
| `binStartField` · `binEndField`                        | field  | 구간의 시작 · 끝                  |      ✗       | `binStart` · `binEnd`              | composition                         |
| `countField`                                           | field  | 구간의 개수                       |      ✓       | `count`                            | composition                         |
| `openField` · `highField` · `lowField` · `volumeField` | field  | 시가 · 고가 · 저가 · 거래량       | ✗ (거래량 ✓) | `open` · `high` · `low` · `volume` | composition                         |
| `pathFields`                                           | fields | 계층 경로 (위 → 아래)             |      —       | `group` · `category`               | composition                         |
| `sourceField` · `targetField`                          | field  | 흐름의 출발 · 도착                |      —       | `source` · `target`                | composition                         |
| `invertFields`                                         | fields | 뒤집는 축 (`valueFields` 의 부분) |      —       | (없음)                             | composition                         |

- 역할이 받는 형은 `ChartRoleUse.accepts ?? ChartRoleDef.accepts` 다. 자동 지정 (§5.2) · 검증 (`role.notNumeric` · 날짜 해석 실패) · 패널 선택지의 형 표시가 이 값을 읽는다. 지금 descriptor 도 종류마다 덮는다 (`authoring.ts:823,835` — `{ ...CATEGORY_ROLE, accepts: "date" }`) — 뜻이 하나인 key 와 종류가 받는 형은 다른 축이다 (리뷰 round 1 m3).
- `closeField` 는 없앤다 — candlestick 의 종가는 `metric` 이다 (본문 Decision 3).
- 표의 key 문법은 정적 검사로 고정한다: 핵심 넷이 아니면 `Field` 또는 `Fields` 로 끝난다.
- 사용자 결정 2 가 React Spectrum Charts 이름을 고르면 `goalField` → `target` · `sizeField` → `size` · `startField` / `endField` → `metricStart` / `metricEnd` 로 바꾸고, sankey 의 `targetField` 는 `destinationField` 같은 다른 이름이 필요하다 (그 결정에 딸린 일).

### 2.2 입력 형태

형태 하나는 역할 집합과 행 정책이다. descriptor 의 `roles` · `columns` (`authoring.ts:50-57`) 를 `forms` 로 바꾼다.

```ts
interface ChartForm {
  id: ChartDataMode; // 형태가 하나면 저장하지 않는다
  roles: readonly ChartRoleUse[];
  rows: "sum" | "row" | "sample"; // §2.4
  key: readonly ChartRoleDef["key"][]; // 같은 행으로 보는 키 (sum 일 때)
}
```

- 형태가 둘 이상인 종류만 `dataMode` 를 읽고 저장한다. 값이 없으면 그 종류의 첫 형태다 (지금의 「unset = group」 과 같다 — `presentation.ts:347`).
- `dataMode` 값 (제안): `group` · `columns` (지금 그대로) + `binned` (histogram 구간 집계 입력) · `ranked` (bump 순위 입력) · `pair` (slope 의 항목마다 두 값).
- 패널의 형태 전환 칸은 `ChartDataMappingControls` 하나가 `forms` 에서 선택지를 만든다. 형태가 하나면 칸이 없다 (parallel).
- 형태를 바꿀 때 가려진 역할의 값은 지우지 않는다 (ADR-210 BD §모드 전환 — `ChartDataMappingControls.tsx:27-29`).
- Pie · Radial 이 columns 를 받지 않는 결정 (ADR-210) 은 「그 종류의 형태 목록에 columns 가 없다」 로 표현된다 — `columns.unsupportedChartType` 진단 (`presentation.ts:398`) 의 판정 근거가 표가 된다.

### 2.3 36 항목 목표 표

「지금」 은 2026-11-16 실측 (본문 F2 ~ F9), 「표준」 은 제안이다. `*` 는 필수. 행 정책은 §2.4.

| 항목                                            | 형태 (표준)                                                                                                                | 행 정책 (지금 → 표준)              | 저장 · 읽기에서 달라지는 것                                                                  |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| bar · line · area · radar                       | group (`dimension*` `metric*` `color`) · columns (`dimension*` `valueFields*`). line · area 는 `lowerFields` `upperFields` | sum → sum                          | 없음 (역할이 표에 들어감)                                                                    |
| pie · donut · radial · radialBar                | group                                                                                                                      | sum → sum                          | 없음                                                                                         |
| scatter · bubble                                | group (`dimension*` `metric*` `color` `sizeField` `labelField`)                                                            | row → row                          | 없음. 라벨 X · Y                                                                             |
| gauge                                           | (`metric*` `goalField`)                                                                                                    | 첫 행 → sum                        | 여러 행이면 합                                                                               |
| bullet                                          | (`dimension*` `metric*` `goalField` `rangeFields`)                                                                         | row → sum                          | 같은 범주 합산. 구간 경계는 첫 행 + 경고                                                     |
| dumbbell                                        | (`dimension*` `startField*` `endField*`)                                                                                   | row → sum                          | 같은 범주 합산. 읽지 않는 `metric` 저장 안 함                                                |
| lollipop · segmented · waffle · funnel · pareto | (`dimension*` `metric*`)                                                                                                   | row → sum                          | 같은 범주 합산                                                                               |
| waterfall                                       | (`dimension*` `metric*` `kindField`)                                                                                       | row → row                          | 없음 (행 = 단계)                                                                             |
| sparkline                                       | (`metric*` `dimension`)                                                                                                    | row → sum (`dimension` 이 있을 때) | `dimension` 이 있으면 같은 항목 합산                                                         |
| marimekko                                       | (`dimension*` `color*` `metric*`)                                                                                          | sum → sum                          | 없음. `seriesConfig` 적용                                                                    |
| stream · skyline                                | group · columns (skyline 은 `frontFields`)                                                                                 | sum → sum                          | 격자 진단을 버리지 않음. 축 해석 공통                                                        |
| bump                                            | ranked (`dimension*` `color*` `rankField*`) · group (`dimension*` `color*` `metric*`)                                      | 순위 합산 → 첫 행 + 경고 / sum     | 형태를 `dataMode` 로 (지금은 `rankField` 유무)                                               |
| slope                                           | group (`dimension*` = 시점, `color*` = 항목, `metric*`) · pair (`color*` = 항목, `startField*` `endField*`)                | 마지막 행 → sum                    | 지금의 columns (`dimension` = 항목, `valueFields` 첫 · 끝) 을 pair 로. 역할 뜻이 형태와 무관 |
| histogram                                       | group (`metric*` `color`) · binned (`binStartField*` `binEndField*` `countField*` `color`)                                 | sample / sum → 그대로              | 형태를 `dataMode` 로 (지금은 `countField` 유무). 읽지 않는 `dimension` 저장 안 함            |
| box · ridgeline                                 | (`dimension*` `metric*`)                                                                                                   | sample → sample                    | 없음                                                                                         |
| beeswarm                                        | (`metric*` `dimension` `labelField`)                                                                                       | sample → sample                    | 없음                                                                                         |
| heatmap                                         | (`dimension*` `rowField*` `metric*`)                                                                                       | sum → sum                          | 없음                                                                                         |
| calendar                                        | (`dimension*` `metric*`)                                                                                                   | sum → sum                          | 날짜 해석 공통                                                                               |
| candlestick                                     | (`dimension*` `metric*` = 종가, `openField` `highField` `lowField` `volumeField`)                                          | row → row                          | `closeField` → `metric`. 날짜 해석 공통                                                      |
| parallel                                        | columns 하나 (`valueFields*` `labelField` `invertFields`)                                                                  | row → row                          | 형태 전환 칸 없음. `seriesConfig` identity 수리. 읽지 않는 `dimension` · `metric` 저장 안 함 |
| treemap · sunburst                              | (`pathFields*` `metric*`)                                                                                                  | sum → sum                          | 읽지 않는 `dimension` 저장 안 함                                                             |
| sankey · chord                                  | (`sourceField*` `targetField*` `metric*`)                                                                                  | sum → sum                          | 읽지 않는 `dimension` 저장 안 함                                                             |

### 2.4 행 정책

- **sum** — 형태의 `key` 역할 값이 같은 행을 한 항목으로 본다. 가산 역할 (`additive: true`) 은 더한다. 비숫자 값은 결측이지 0 이 아니다 (ADR-194 · `series.ts:228-229`). 가산이 아닌 역할은 첫 행의 값을 쓰고 경고 진단 `rows.duplicate` 를 낸다.
- **row** — 행 하나가 표식 하나다 (scatter 의 점 · waterfall 의 단계 · candlestick 의 봉 · parallel 의 선). 합치지 않는다.
- **sample** — 행 하나가 표본 하나다. 통계 (분위수 · 구간 · 밀도) 의 입력이다. 표시 예산이 통계 앞에서 행을 자르지 않는다 (ADR-306 Hard constraint).
- 합산을 한 곳에서 한다: family 가 각자 가진 합산 루프 (`category/blocks.ts:65` · `matrix/grid.ts:164` · `:436` · `network/hierarchy.ts:83` · `network/flow.ts:91` · `network/links.ts:272`) 를 「키로 묶어 가산 역할을 더하는」 공용 함수 하나로 옮긴다 (`families/fields.ts` 옆). 시리즈 격자 (`series.ts:227-232`) 는 그대로 두고 같은 정책임을 fixture 로 고정한다 (HC2).
- 개수 · 평균 같은 다른 집계는 Chart 가 고르지 않는다. 연결한 Chart 는 ADR-284 의 보기 결과를 읽는다 (`packages/shared/src/catalog/runtime/dataBinding.ts:192`) — 「상태별 건수」 는 보기에서 묶고 Chart 는 그 결과 행을 그린다. (사용자 결정 1 이 Chart 칸을 고르면 이 절에 `aggregate` 역할 밖 prop 하나를 더한다.)
- ADR-211 의 `budgetAggregate` 는 표시 예산이 만든 bucket 에만 적용된다 — 이 절과 다른 단계다.

### 2.5 시리즈 표시 표

- 적용 대상: scene 이 이름 붙은 색 항목 (범례 항목 · 색으로 구분되는 묶음) 을 내는 형태. 목록은 Phase 0 이 `scene.legend` 와 색 index 사용처에서 뽑는다 — 예상: 시리즈 경로 · stream · bump · skyline · slope · marimekko · segmented · waffle · histogram (묶음) · parallel · dumbbell (앞 · 뒤).
- identity 는 ADR-210 그대로다 — `["group", 값]` · `["field", key]` (`presentation.ts:47-49`). parallel 의 원 key 비교 (`matrix/parallel.ts:62`) 를 이것으로 고친다.
- 색을 자리 순번으로 주는 종류 (`category/bars.ts:340,351,538,549` · `category/blocks.ts:98,105,301`) 는 `applySeriesConfig` (`series.ts:378-397`) 와 같은 규칙 — 표에 있는 항목은 표의 순서 · 이름 · 색, 나머지는 출현 순서 — 을 쓴다.
- 패널의 Series 섹션 (`ChartSeriesControls`) 은 적용 대상 종류에서 열린다 (지금은 family 에서 닫는다 — `useChartPropertyExtras.tsx:216`).

## 3. 현재 인벤토리 (2026-11-16)

Phase 0 이 fixture 로 고정할 표의 초안이다. 근거 줄은 조사 시점의 것이다.

### 3.1 역할 · 표본 열 (생성 직후의 값)

| 항목                      | 표본 열                                         | 생성 시 저장되는 역할 값                                                                               |
| ------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| bar · line · area · radar | `category` `value` `series`                     | `dimension=category` `metric=value` `color=series`                                                     |
| pie · donut · radial      | `category` `value` `series` (한 시리즈)         | 위와 같음                                                                                              |
| scatter · bubble          | `x` `y` `series` (+ `size`)                     | `dimension=x` `metric=y` `color=series` (+ `sizeField=size`)                                           |
| gauge                     | `label` `value` `target`                        | `dimension=label` `metric=value` `goalField=target`                                                    |
| bullet                    | `kpi` `actual` `target` `poor` `ok` `good`      | `dimension=kpi` `metric=actual` `goalField=target` `rangeFields`                                       |
| dumbbell                  | `region` `before` `after`                       | `dimension=region` `startField` `endField` + **`metric=value`** (읽지 않음)                            |
| lollipop                  | `feature` `usage`                               | `dimension` `metric`                                                                                   |
| segmented                 | `method` `amount`                               | `dimension` `metric`                                                                                   |
| waffle                    | `segment` `customers`                           | `dimension` `metric`                                                                                   |
| funnel                    | `stage` `users`                                 | `dimension` `metric`                                                                                   |
| pareto                    | `keyword` `spend`                               | `dimension` `metric`                                                                                   |
| waterfall                 | `item` `amount` `kind`                          | `dimension` `metric` `kindField`                                                                       |
| sparkline                 | `day` `revenue`                                 | `dimension` `metric`                                                                                   |
| marimekko                 | `channel` `device` `sales`                      | `dimension` `color` `metric`                                                                           |
| stream                    | `week` `genre` `hours`                          | `dimension` `color` `metric`                                                                           |
| bump                      | `month` `app` `rank`                            | `dimension` `color` `rankField` + **`metric=value`** (표본에 없는 열)                                  |
| slope                     | `brand` `period` `share`                        | `dimension=period` `color=brand` `metric`                                                              |
| skyline                   | `day` + 값 열 6                                 | `dimension` `dataMode=columns` `valueFields` `frontFields` + **`metric=value`**                        |
| histogram                 | `ms`                                            | `metric=ms` + **`dimension=category`**                                                                 |
| box · ridgeline           | `api` `ms` / `region` `hours`                   | `dimension` `metric`                                                                                   |
| beeswarm                  | `id` `plan` `minutes`                           | `dimension` `metric` `labelField`                                                                      |
| heatmap                   | `day` `hour` `orders`                           | `dimension=hour` `rowField=day` `metric`                                                               |
| calendar                  | `date` `commits`                                | `dimension` `metric`                                                                                   |
| candlestick               | `date` `open` `high` `low` `close` `volume`     | `dimension` + OHLC · 거래량 + **`metric=value`**                                                       |
| parallel                  | `model` + 값 열 5                               | `dataMode=columns` `valueFields` `labelField` `invertFields` + **`dimension=category` `metric=value`** |
| treemap · sunburst        | 경로 열 2 + 값                                  | `pathFields` `metric` + **`dimension=category`**                                                       |
| sankey · chord            | `source` `target` `value` / `from` `to` `value` | `sourceField` `targetField` `metric` + **`dimension=category`**                                        |

굵은 값이 본문 F5 (읽지 않는데 저장) 다. 표본 테이블의 위치: `families/kpi.ts:1004,1037` · `category/index.ts:94,195-213` · `distribution/index.ts:46,120-126` · `matrix/index.ts:46,186-205` · `network/index.ts:42,95-104`, 시리즈 표본은 `authoring.ts:1023-1055`.

### 3.2 같은 키의 행 (본문 F8)

| 방식        | 종류 (근거)                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 합산        | 시리즈 격자 (`series.ts:230`) — bar · line · area · pie · radar · radial · stream · skyline 뒷줄 · bump. marimekko (`category/blocks.ts:65`) · skyline 앞줄 (`:292`) · histogram 구간 입력 (`distribution/histogram.ts:153`) · heatmap (`matrix/grid.ts:164`) · calendar (`:436`) · treemap · sunburst (`network/hierarchy.ts:83`) · sankey (`network/flow.ts:91`) · chord (`network/links.ts:272`) |
| 행마다 표식 | scatter (`series.ts:205`) · bullet (`kpi.ts:443`) · dumbbell (`kpi.ts:705-712`) · lollipop · segmented · waffle · funnel · pareto (`category/bars.ts:71`) · waterfall (`:1104`) · sparkline (`category/lines.ts:64`) · slope columns (`:638`) · candlestick (`matrix/price.ts:176`) · parallel (`matrix/parallel.ts:52`)                                                                            |
| 행 = 표본   | histogram 값 입력 (`distribution/histogram.ts:197`) · box · beeswarm · ridgeline (`distribution/spread.ts:72`)                                                                                                                                                                                                                                                                                      |
| 첫 행만     | gauge (`kpi.ts:109`)                                                                                                                                                                                                                                                                                                                                                                                |
| 마지막 행   | slope group (`category/lines.ts:664-668`)                                                                                                                                                                                                                                                                                                                                                           |
| 진단        | 없음 (어느 종류도 키 중복을 알리지 않는다)                                                                                                                                                                                                                                                                                                                                                          |

### 3.3 그 밖의 읽기

- `seriesConfig`: 시리즈 경로 (`presentation.ts:413-459` · `series.ts:378-397`) · stream · bump · skyline (`category/lines.ts:265`) · parallel 은 이름만 · identity 불일치 (`matrix/parallel.ts:62`). 그 밖 23 종 읽지 않음.
- 숫자 형식 (`valueFormat` …): 36 종 전부 (`families/fields.ts:48-67` — family 는 `value*` 진단만 남긴다).
- 축 해석: 시리즈 경로만 `dimensionScale` · `dimensionFormat` (`presentation.ts:645-690`). calendar `matrix/grid.ts:380-397` · candlestick `matrix/price.ts:121-127` 은 자체 해석.
- 필드 읽기: 시리즈 경로 `readField` (`series.ts:65-72`), family `fieldKey` · `readNumber` · `readLabel` (`families/fields.ts:19-34`) — 둘 다 `#id` 를 받는다. 라벨 문자열화가 다르다 (`toLabel` 은 객체를 빈 글자로 `series.ts:74-81`, `readLabel` 은 `String(value)`).
- 검증: family `role.missing` (`families/fields.ts:70-79`), 시리즈 경로는 역할 검사 없음 (`computeChartScene.ts:368-376`). `role.notNumeric` 은 내는 곳 없음 (`types.ts:250`). skyline 의 `frontFields` 오류는 `rangeFields.invalid` 코드를 빌려 쓴다 (`category/blocks.ts:276-277`).

## 4. 파생 지점

역할 표에서 나오게 바꿀 곳이다.

| 파생               | 지금                                                                                                                                 | 표준                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 패널 Collection 칸 | binding `accepts` 의 `visibleWhen` 이 `chartTypesReading` 으로 (`packages/shared/src/catalog/bindings/Chart.binding.ts:11-17`)       | 형태까지 본다 — 그 종류의 지금 형태가 쓰는 역할만. 열 선택지는 원천의 열 (§5.2 — 보기의 결과 schema)                                                                                                                                                    |
| 칸 라벨            | binding 의 고정 라벨 (`Category` · `Value` · `Series` — `:123-165`), 번역은 영어 라벨이 조회 key (`apps/builder/src/i18n/labels.ts`) | 종류별 라벨 — `ChartRoleUse.label`. 번역 key 는 역할 · 종류 조합 (메모리 `feedback-binding-label-is-i18n-lookup-key`)                                                                                                                                   |
| 선택 / 필수        | `chartFieldOptions.ts:32-43` (시리즈는 `color` 만 선택)                                                                              | 형태의 `required`                                                                                                                                                                                                                                       |
| 형태 전환 칸       | `ChartDataMappingControls.tsx` (group · columns) · `chartTypeAcceptsColumns` (`authoring.ts:956`)                                    | 형태 목록에서 선택지. 하나면 없음                                                                                                                                                                                                                       |
| 표본 행 편집기     | 고정 `itemSchema` (`Chart.binding.ts:1032-1048`)                                                                                     | 지금 형태의 역할이 가리키는 열 + 행에 실제로 있는 열. 새 행의 기본값도 그 열로                                                                                                                                                                          |
| 표본 행            | family 마다 열 이름 (§3.1)                                                                                                           | 역할의 기본 열 이름 (사용자 결정 3). 값 열 목록 (`valueFields`) 은 뜻 있는 이름 그대로                                                                                                                                                                  |
| 생성 값            | `createChartInitialProps` (`authoring.ts:1061-1112`) · `withFamilySample` (`:1161-1173`) 이 역할 prop 을 씀                          | 기본 열 이름이 있는 역할은 쓰지 않는다 (기본 열 이름으로 읽힘). 기본이 없는 목록 역할 (`valueFields` · `frontFields` · `rangeFields` · `invertFields`) 은 표본의 목록을 쓴다 (`sampleProps`). `CHART_DEFAULT_PROPS` 에서 `dimension` · `metric` 을 뺀다 |
| 검증               | family 만 `role.missing`                                                                                                             | 36 종 공통 — 필수 역할이 가리키는 열이 없으면 `role.missing`, 숫자 역할에 숫자가 하나도 없으면 `role.notNumeric`                                                                                                                                        |
| 전달 목록          | `CHART_FAMILY_PROP_KEYS` (`authoring.ts:964-989`) + binding 의 손 목록 (`Chart.binding.ts:1415-1463`)                                | 역할 key 전부를 역할 표에서                                                                                                                                                                                                                             |
| 필드 사용처        | `fieldUsage.ts` 가 Chart 역할을 보지 않음                                                                                            | Chart 노드의 역할 prop 이 가리키는 필드를 「사용 중」 에 넣는다                                                                                                                                                                                         |
| AI catalog         | `accepts` 에서 일반 파생 (`apps/builder/src/services/ai/catalog/componentCatalog.ts`)                                                | 종류별 형태 · 필수 역할 설명을 붙인다                                                                                                                                                                                                                   |
| ztd 대응 fixture   | `__tests__/ztdCoverage.fixture.ts` 의 채널 → prop                                                                                    | 개명 · 형태 변경을 반영 (candlestick close → `metric` · slope · bump · histogram)                                                                                                                                                                       |

저장 · 전환 규칙:

- 종류 전환 (ADR-306 BD §4.4): 행은 그대로, 새 종류의 역할 중 같은 key 는 이어 쓰고 채워지지 않는 필수 역할은 기본 열 이름으로 읽힌다 → 그 열이 없으면 `role.missing`. 첫 숫자 열로 자동 대체하지 않는다.
- 값이 없는 역할을 기본 열 이름으로 읽는 것과 「Series 해제 = `color: ""` 를 명시 저장」 (ADR-209 후속) 은 같이 선다 — 빈 글자는 「해제」, 값 없음은 「기본」.
- 인스턴스 override: 배열 역할은 통째로 바뀐다 (ADR-210 그대로).

## 5. 컬렉션 연결

본문 Decision 10 · HC7. 같이 쓰는 경로는 손대지 않고 Chart 쪽 두 곳만 바꾼다.

### 5.1 바꾸지 않는 것 (HC7)

- `packages/shared/src/catalog/runtime/dataBinding.ts` 의 `catalogBoundRows` (보기 → 계산 열 → 표시 창) · `packages/shared/src/catalog/runtime/viewQuery.ts` · `readDataBindingRows`.
- resolver 의 Chart 분기 (`packages/shared/src/catalog/resolution/resolver.ts:2086-2094` — `"records"`). Chart 는 보기 결과의 전체 행을 받는다.
- 연결 명령의 기존 단계 (`catalogBindingCommand` — `binding` 쓰기 · 반복 항목의 행 템플릿).
- 로딩 · 오류 · 빈 결과의 표시 (ADR-209 breakdown §상태 표) — 표본 행으로 돌아가지 않는다.

### 5.2 원천이 바뀔 때의 역할

**원천의 열.** Chart 가 실제로 읽는 행의 열이다.

- 연결이 있으면 그 연결의 보기 체인이 내는 **결과 schema** 다. 묶기 · 집계가 있으면 묶음 열과 집계 이름 (`viewResultSchema` — `packages/shared/src/collections/view/evaluate.ts:431`), 없으면 컬렉션의 schema (계산 열 포함). 순수한 schema 계산이라 행을 읽는 경로 (HC7) 를 건드리지 않는다.
- 연결이 없으면 표본 행의 열이다 — 이름은 행의 key, 형은 값에서 읽는다 (숫자 · 날짜로 읽히는 글자 · 글자).
- 이 목록 하나를 자동 지정 · 「가리키는 열이 있는가」 판정 · 패널의 열 선택지 (`useOwnerCollectionColumns.ts:48-56` 은 지금 원본 schema 만 읽는다 — F14) 가 같이 읽는다.
- 결과 schema 의 집계 열은 `id` = `key` = 집계 이름이다. 저장 값은 지금 형식 그대로다 (`chartFieldOptions.ts:79-80` — id 가 있으면 `#id`). 결과 열의 id 가 필드 색인 (`data/fieldIdIndex.ts`) 에 등록되는지는 Phase 0 에서 확인하고, 등록되지 않으면 key 로 저장한다.

**맞추는 함수.** 순수 함수 하나 — 역할 표 · 지금 형태 · 원천의 열 · (해제일 때) 그 종류의 표본 지정을 받아 patch 를 낸다.

1. 역할이 지금 가리키는 열 (값이 없으면 기본 열 이름) 이 원천의 열에 있으면 그대로 둔다. 같은 컬렉션 · 같은 보기를 다시 연결해도 지정이 남는다.
2. 없으면 — **해제일 때만** — 그 종류의 표본 지정 (`sampleProps` 의 목록 역할, 그 밖은 기본 열 이름) 이 가리키는 열이 표본에 있으면 그것으로 되돌린다.
3. 그래도 없고 필수 역할이면 그 종류가 받는 형 (`ChartRoleUse.accepts ?? ChartRoleDef.accepts`) 에 맞는 원천의 첫 열을 준다. 이미 다른 역할에 준 열은 건너뛴다. 목록 역할은 형이 맞는 열을 순서대로, 시리즈 팔레트 길이까지.
4. 맞는 열이 없거나 선택 역할이면 값을 지운다. 필수 역할이면 scene 은 `role.missing` (어느 역할인지 패널이 보여 준다).

**돌리는 자리.**

- `catalogBindingCommand` 가 Chart 대상에서 한 단계를 더한다 (같은 명령 · Undo 한 번) — 연결 · 다른 컬렉션으로 변경 · 연결에 든 보기 (이름 없는 보기) 의 변경 · 공유 보기의 선택 · 해제. Table 이 첫 연결에서 열을 받는 것 (`quickConnectPlan.ts` `resolveColumnMode`) 과 같은 자리다.
- 공유 보기 (`viewId`) 의 **정의** 를 고치는 명령은 그 보기를 읽는 Chart 를 고치지 않는다 (collection 쪽 명령 — HC7). 집계 이름이 바뀌어 없는 열을 가리키게 된 역할은 `role.missing` 으로 보이고, 패널의 「다시 맞추기」 가 같은 함수를 한 번 돌린다.

**보장하는 것.**

- 연결: 형이 맞는 열이 있으면 빈 차트가 아니다.
- 해제: 표본으로 다시 그려진다 — 손대지 않은 표본이면 생성 때의 지정 (값 열 목록 포함) 으로 돌아가고, 사용자가 표본의 열을 바꿨으면 형이 맞는 표본 열로.
- 연결 전과 **같은** 지정으로 돌아가는 것은 Undo 다. 해제 명령은 연결 전 지정을 기억하지 않는다 (원천마다 지정을 따로 저장하려면 객체 prop 이 필요하다 — 대안 B 와 같은 이유로 두지 않는다).
- 표본 행 (`data`) 은 연결 · 해제 어느 쪽에서도 쓰지 않는다 (숨기고 보존).

종류 전환 (ADR-306 — 「첫 숫자 열로 자동 대체하지 않는다」) 과는 다른 자리다. 전환은 같은 원천에서 이미 지정한 것을 지키는 일이고, 여기는 원천이 바뀌어 지정이 가리킬 열이 없어진 때다.

### 5.3 필드 사용처

- `apps/builder/src/builder/panels/datatable/utils/fieldUsage.ts` 에 네 번째 축을 더한다 — Chart 노드의 역할 prop (역할 표의 key 전부) 이 `#id` 또는 key 로 그 필드를 가리키는가. 필드 삭제 · 개명 확인 화면이 Chart 를 보여 준다.

## 6. 검증

### 6.1 측정 설계 (`.claude/rules/measurement-validity.md` §1)

- **Q1 출처**: 행 정책 fixture 는 손으로 만든 작은 표 (키가 겹치는 행 3 ~ 5) 다. 표본 테이블은 중복 키가 없어 정책 검증에 쓰지 않는다 — 「표본 scene 전후 동일」 은 회귀 확인일 뿐이다.
- **Q2 불리한 경우**: 키 중복 · 가산이 아닌 역할의 중복 · 비숫자 값 · 역할이 가리키는 열이 없는 연결 데이터 · `#id` 가 등록되지 않은 참조.
- **Q3 대조군**: HC6 은 같은 기계에서 변경 전 · 후 빌드를 교대로 3 쌍 잰다 (1 만 행, 종류마다 scene 계산 시간 중앙값).
- **Q4 소비 경로**: 역할 표가 실제로 패널 · 표본 편집기 · 검증 · 전달 목록에서 읽히는지를 정적 검사 (손 목록 0) 와 live 로 확인한다.
- **Q5 oracle**: 행 정책의 기대 값은 손계산이다 (구현 출력으로 만들지 않는다). 두 consumer 일치는 ADR-306 의 G3 방식 — 브라우저 `getBoundingClientRect` 대 scene 좌표.

### 6.2 검사 목록

- 정적 (rendering unit, `test:chart-contract` 사슬):
  - 모든 항목의 `forms` 가 비어 있지 않다. 형태마다 `rows` · `key` 가 있다.
  - 역할 key 문법 (§2.1).
  - binding `accepts` 의 역할 key 집합 = 역할 표 (shared 쪽 테스트 — `adr306FamilyProps.test.ts` 의 `BEFORE` 목록을 갱신).
  - 표본 열 ⊂ 역할의 기본 열 이름 ∪ `valueFields` · `frontFields` 의 열.
  - 손으로 적은 역할 목록이 없다 (`SERIES_PROP_KEYS` · binding passthrough 의 역할 줄).
- 동작:
  - 종류마다 중복 키 fixture 의 scene 값이 손계산과 같다 + 원복 RED 1.
  - 기존 9 항목 snapshot · parity 무변경 (HC2).
  - 표본 행 편집기: 36 항목에서 칸 = 형태의 역할, 새 행이 그려진다.
  - `seriesConfig`: 적용 대상 종류에서 이름 · 색이 scene 과 DOM 에 같이.
  - 컬렉션 연결 (G6): 표본과 열 이름이 다른 컬렉션을 연결 → 필수 역할이 채워짐 · 열이 있는 역할은 보존 · 맞는 열이 없으면 `role.missing` · 묶고 합친 보기 (`points` → `total`) 를 연결 → `metric` 이 `total`, 패널 선택지에 `total`, 다시 연결해도 유지 · `status` · `date` · `points` 순서의 컬렉션을 calendar 에 → `dimension` = `date` · 해제 → 표본 그림 (parallel · skyline 의 값 열 목록, 표본 열을 바꾼 차트) · 연결 → 해제 → Undo 두 번 · 공유 보기의 집계 이름을 바꾸면 `role.missing` → 「다시 맞추기」 · 보기를 건 컬렉션에서 Chart 가 보기 결과 행을 읽음. HC7 파일의 diff 0.
  - contract: 이전 번호 문서 거부 (`UNSUPPORTED_LIBRARY_CONTRACT`) · 없앤 key (`closeField`) 가 든 새 문서 `PROP_NOT_ACCEPTED`.
- live (G5): family 마다 1 종 — 생성 → 표본 행 추가 · 수정 → 컬렉션 연결 → 역할 지정 → 형태 전환 → 종류 전환 → 저장 재열기, Canvas · Preview · Publish.

## 7. Phase

| Phase | 내용                                                                                                                                                                                                                                             | Gate    | contract                                      |
| :---: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | --------------------------------------------- |
|   0   | 인벤토리 fixture (§3 을 테스트로) · F11 재현 · 성능 (1 만 행) · 번들 기준선 · `seriesConfig` 적용 대상 목록 확정 · 보기 결과 열의 id 가 필드 색인에 등록되는지                                                                                   | G0      | —                                             |
|   1   | 역할 표 (`ChartRoleDef`) · descriptor `forms` — 기존 9 항목 포함. 파생: 패널 칸 · 종류별 라벨 · 선택 / 필수 · 전달 목록 · 검증 (`role.missing` 공통 · `role.notNumeric`) · 필드 사용처. **저장 무변경**                                          | G1 · G2 | —                                             |
|   2   | 저장 계약 변경 한 번: `closeField` → `metric` · `dataMode` 값 (`binned` · `ranked` · `pair`) · parallel 형태 하나 · 표본 열 이름 · 생성 시 기본 열 이름이 있는 역할 값을 쓰지 않음 · 표본 행 편집기 · ztd fixture · 원천이 바뀔 때의 역할 (§5.2) | G2 · G6 | **+1**                                        |
|   3   | 행 정책: 공용 묶기 함수 · 종류마다 선언대로 · `rows.duplicate` 진단 (사용자 결정 4)                                                                                                                                                              | G3      | (2 와 같은 번호 — push 전이면 같은 올림 안에) |
|   4   | 시리즈 표시 표 공통 · Series 섹션을 적용 대상 종류에 · parallel identity                                                                                                                                                                         | G4      | —                                             |
|   5   | 범주 축 해석 공통 (calendar · candlestick · stream · bump · skyline) · 정리 · 번들 · live · 문서                                                                                                                                                 | G5 · G6 | —                                             |

- Phase 2 와 3 은 같은 문서가 다르게 읽히는 변경이다. contract 올림 하나에 묶는다 — 둘을 따로 push 하면 번호를 두 번 쓰지 않도록 3 의 변경은 「해석 변경」 으로 CHANGELOG 에 적는다.
- 규모 추정: rendering 25 ~ 35 파일 (역할 표 · descriptor · family 5 의 읽기 · 표본) · shared 5 ~ 8 (binding · runtime 타입 · 원본 template · contract 상수) · builder 10 ~ 15 (패널 컨트롤 · 표본 편집기 · 사용처 · 번역) · 테스트 30 ~ 40 (contract 번호 fixture 포함). 추정과 실측이 1.5 배 넘게 벌어지면 Phase 0 인벤토리 보강으로 흡수한다.

## 8. 기록

(Phase 가 닫힐 때 적는다.)
