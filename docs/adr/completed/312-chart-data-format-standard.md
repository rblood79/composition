# ADR-312: Chart 데이터 포맷 표준 — 역할 표 하나 · 입력 형태 선언 · 행 정책 · 시리즈 표시 표

## Status

Implemented — 2026-11-17 (G5 사용자 확인 — 36 종 전부를 Data 패널 표에 연결한 live 결과 뒤 「Implemented 승격」. 사용자 결정 5 건 모두 답함: 1 · 2 · 3 · 4 권고안, 5 「초과분 수용」 · HC6 「표준대로 두고 수용」). Accepted — 2026-11-16 (사용자 `/execute-adr 312` 호출 + [reviews/312](../reviews/312.md) round 2 pending 0 · CRITICAL/HIGH 전부 fixed. 사용자 결정 5 건은 그 Phase 에 닿을 때 묻는다)

- 사용자 요청: `/create-adr Chart 데이터 포맷 표준화` (2026-11-16).
- 방향을 정한 사용자 원문 (2026-11-16 대화 순서대로):
  - 「chart전체의 data 방식이 일정하지가 않다. 확인해」
  - 「뒤로 미루고 임시적인 처리가 아닌 근본적인 포멧을 정하는 것이다 adr306은 구현가능에 집중이었고 구현확인이 되었으니 모든차트의 표준화를 해야한다」
  - 「https://ui.shadcn.com/docs/components/aria/chart 와 react-spectrum-chart의 데이터 표준화도 체크해」
  - 「추가로 https://json-render.dev/ 도 체크해」
- 사용자가 이미 답한 확인 항목: ADR 분리 — 「새 ADR + 306 닫기」 (2026-11-16 질문. ADR-306 은 같은 날 Implemented, 데이터 포맷은 [306 Status](306-chart-36-types-recharts-size-removal.md) 가 「이 ADR 범위 밖 — 새 ADR」 로 적었다).

> **Phase 2 종결 (2026-11-17 — G2 · G6, contract 69, Breaking)**: 저장 계약 한 번 — candlestick 종가 `closeField` → `metric` · `dataMode` 에 `binned` (histogram) · `ranked` (bump — 첫 형태) · `pair` (slope — 항목 = `color`, 앞 · 뒤 값) · parallel 은 형태 하나 · binding 의 `dataMode` 기본값 삭제 (bump 를 group 으로 읽게 했다). 값이 없는 역할은 기본 열 이름으로 읽힌다 (`resolveChartRoleDefaults` — 필수는 늘, 선택은 그 열이 있을 때만, 빈 글자는 해제) · 새 차트의 표본 열 = 역할 기본 열 이름 (`standardizeChartSample`), 생성 때 역할 값은 목록 역할만 · 표본 행 편집기 칸 = 형태의 역할 · 원천이 바뀔 때 역할을 맞춘다 (`reconcileChartRoles` · 연결 명령 한 step · 결과 schema `chartBindingColumns` — 집계 열은 key 로) · 패널 열 선택지도 결과 schema (F14). HC2 (snapshot · parity) 무변경 — parity 를 지키려 두 consumer 가 `color: ""` (해제) 를 버리던 것을 고쳤다. HC7 파일 diff 0. 원복 RED 4 · live (새 프로젝트 — Bar · Dumbbell 생성 Overrides 에 역할 값 없음 · 표본 편집기 Category · Start · End · 컬렉션 연결 → `status` · `points` 자동 · 해제 → 표본 · Undo 두 번 · Publish 같은 막대). 68 이하 문서는 열리지 않는다.
>
> **Phase 5 종결 (2026-11-17 — G5 · G6, 사용자 확인 2026-11-17 → Implemented)**: 범주 축 해석 한 곳 (`chartTimeParser` — 시간 축 · calendar · candlestick, 자체 `Date.parse` 삭제 · 패널 Date Input Format 칸) · AI catalog 의 종류별 형태 설명 (형태 표 파생) · 번들 Builder +4,462 B gzip (Δ 상한 +4,096 초과 — 사용자 결정 5 「초과분 수용」) · Preview +3,303 B. live 에서 Phase 1 회귀 하나를 찾아 고쳤다 (columns 형태 없는 종류에 pie · radial 안내). live G5: family 5 개 + 시리즈 경로 — 생성 · 연결 (Calendar 의 Date = `date`) · 종류 전환 · `role.missing` · 형태 전환 · 저장 재열기 · Publish · 필드 사용처. 사용자 요청으로 36 종 전부를 Data 패널 표 (Sales) 에 연결 — 32 종이 바로 그려졌고 결함 4 (산점도 X 형 · 맞춤의 형 검사 · 상속 역할 해제 · columns 시리즈 이름의 `#id`) 를 고쳐 36 종 모두 그려진다. 상세 [breakdown §8](../design/312-chart-data-format-standard-breakdown.md).

> **Phase 4 종결 (2026-11-17 — G4, 저장 무변경)**: 시리즈 표시 표 공통 — 색 항목 목록을 종류마다 하나 (`seriesItems.ts` `chartSeriesItems` — 시리즈 격자 · `color` 값 · 범주 값 · 앞 · 뒤 열 · 값 열) 로 두고 시리즈 경로의 `applySeriesConfig` 규칙 그대로 적용한다. marimekko · segmented · waffle · dumbbell · histogram 묶음 · slope 가 표의 이름 · 색 · 순서를 읽고, parallel 축 이름은 `["field", key]` identity 로 고쳤다. 역할 칠 (accent · neutral) 로 그리는 종류는 표에서 색을 정한 항목만 팔레트 색으로 바꾼다. 패널 Series 섹션이 같은 목록으로 적용 대상 family 에서도 열린다 (parallel 은 이름만). G4 10 · 원복 RED 9 · HC2 (chartParity) 무변경 · live Dumbbell 「Before」 · Series 3 이 Canvas 와 Publish 에 같이.

> **Phase 3 종결 (2026-11-17 — G3, 같은 contract 69 안의 해석 변경)**: 형태마다 행 정책 (`ChartForm.rows` · `key` · `grouped`) 을 선언하고, 스스로 합치지 않는 종류는 family 앞의 공용 묶기 (`families/rowPolicy.ts`) 를 지난다 — 범주 × 값 5 종 · bullet · dumbbell · gauge · sparkline · slope 합산, bump 순위는 첫 행 + `rows.duplicate`. 이미 합치던 종류의 루프는 그대로 두고 같은 정책을 손계산 fixture 로 고정했다 (공용 묶기를 앞에 더하면 같은 행을 두 번 지난다). 손계산 fixture 64 · 원복 RED 15 · 표본 36 항목 겹침 없음 (표본 scene 동일). HC6: 바뀐 종류 7 개는 빨라졌고 gauge (+0.52ms) · slope (+0.18ms, 1 만 행) 는 늘었다 — 사용자 답 「표준대로 두고 수용」. live: Dumbbell 표본에서 범주를 겹치게 바꾸면 Canvas · Publish 가 같이 합친다 (Seoul 4.6 + 1.8 = 6.4).

> **사용자 결정 (2026-11-16, Phase 2 착수 전 — 같은 contract 에 묶이는 Phase 3 몫 포함)**: 결정 2 「`<뜻>Field` 유지」 · 결정 3 「역할의 기본 열 이름」 · 결정 4 「전부 표준대로」 · 결정 1 「ADR-284 보기 사용」 — 넷 다 권고안. 결정 5 (번들 상한) 는 초과할 때 묻는다.
>
> **Phase 1 종결 (2026-11-16 — G1 · G2, 저장 무변경)**: 역할 표 하나 (`roles.ts` — `CHART_ROLE_DEFS` 29 · 종류별 형태 `CHART_FORMS`) 에 기존 9 항목 포함 36 항목. 파생 — binding 역할 칸 · 전달 목록 · 패널 선택 / 필수 · 종류별 라벨 (X · Y · Date · Period · Item · Groups) · columns 판정 · 원천 모드 칸 (형태가 둘 이상일 때만 — parallel 의 읽지 않는 토글 제거) · 공통 검증 (`role.missing` 이 시리즈 경로의 「No data」 를 대체 · `role.notNumeric`) · 필드 사용처 Chart 축. snapshot · parity 무변경, 원복 RED 4, live (Chrome MCP — scatter 라벨 · parallel 모드 칸). 상세 [breakdown §8](../design/312-chart-data-format-standard-breakdown.md).
>
> **Phase 0 종결 (2026-11-16 — G0)**: 현재 표를 fixture 로 고정 (`adr312Inventory.test.ts` — 36 항목의 표본 열 · 저장 역할 · 읽지 않는 역할 (동작 판정) · 범례 · `seriesConfig` 반응 · 행 복제 반응). breakdown §3 과의 차이 1 건 — gauge 의 `dimension` 도 읽지 않는다 (F5 에 추가, §3.1 정정). F11 재현 (`fieldUsage.test.ts`). `seriesConfig` 적용 대상 16 확정 (지금 읽는 12 + parallel identity + 읽지 않는 marimekko · segmented · waffle · dumbbell · histogram · slope). 보기의 집계 열은 필드 색인에 등록되지 않아 (`#total` 이 풀리지 않음) 결과 schema 의 집계 열은 key 로 저장한다. 기준선: 1 만 행 scene 시간 36 종 · 번들 Builder 1,566,868 · Preview 166,576 B gzip (closure 측정). 상세 [breakdown §8](../design/312-chart-data-format-standard-breakdown.md).

- 아래의 새 이름 (역할 표 · 형태 · 행 정책 · `dataMode` 값) 은 제안이고 아직 구현되지 않았다. 코드 인용은 main `eb981fea4` 기준이다.

> **설계 리뷰 round 1 반영 (2026-11-16, [reviews/312](../reviews/312.md) — reviewer codex, HIGH 2 · MEDIUM 1 · LOW 1)**. 세 반례를 코드로 대조해 모두 받아들였다. **h1** (기본 열이 없는 목록 역할을 생략 · 삭제하면 표본이 그려지지 않는다 — parallel) → Decision 8 을 「기본 열 이름이 있는 역할만 생략, 목록 역할은 생성 때 쓴다」 로, 해제 규칙을 「값을 지운다」 에서 「표본 지정 → 형이 맞는 표본 열 → 지움」 순서의 복구로 고치고 보장 범위를 적었다 (해제 = 표본으로 다시 그려짐, 연결 전과 같은 지정 = Undo). **h2** (묶기 · 집계 보기는 원본과 다른 schema — 원본 schema 로 맞추면 빈 차트) → 「원천의 열」 을 연결한 보기의 **결과 schema** 로 정의하고 자동 지정 · 보존 판정 · 패널 선택지가 모두 그것을 읽게 했다 (F14). **m3** (역할의 형을 공통 정의에만 두면 calendar 의 날짜 `dimension` 을 못 가른다) → 종류의 역할 사용에 형 제약을 둔다. **l4** (React Spectrum Charts 의 기본 열 이름은 종류마다 다르다) → 레퍼런스 서술을 고쳤다.
>
> **설계 리뷰 종결 (2026-11-16, round 2 수리 검증 — 미해결 HIGH 0 · MEDIUM 0 · pending 0)**. round 1 의 네 건 모두 fixed, 새 차단 이슈 없음. 실행자가 설계 리뷰를 닫는다. 사용자 결정 5 건의 승인과 Status 승격은 이것과 다른 일이다 — Accepted 는 `/execute-adr 312` 때.

## Context

### 도메인

- **D2 (Props/API)**. Chart 는 S2 · RAC 에 대응이 없어 모든 prop 이 composition 확장이다 (`d2Provenance.ts:39` `CATALOG_D2_COMPOSITION_TYPES`). 이름의 참조 원천은 React Spectrum Charts 다 ([ADR-194](194-chart-component-headless-geometry.md) — `dimension` · `metric` · `color`).
- D1 (DOM · 접근성) · D3 (catalog rule · 생성 CSS) 은 바꾸지 않는다. scene 은 데이터 해석의 결과라, 같은 키의 행을 다루는 방식이 바뀌는 종류에서만 달라진다 — 두 consumer (Skia · DOM host) 는 지금처럼 같은 scene 을 읽는다.
- 생성기 선언: 이 ADR 은 catalog rule 의 selector · variant 를 더하지 않는다. `generate-css.ts` 는 대상이 아니다.

### 문제

ADR-306 은 36 종을 그릴 수 있게 하는 데 집중했고, 종류마다 ztd-charts 의 채널을 그때그때 prop 에 대응시켰다 (`ztdCoverage.fixture.ts`). 그 결과 36 종이 데이터를 받는 방식이 여섯 군데에서 갈린다.

### 코드 사실 (2026-11-16 실측 — 전수 표는 [breakdown §3](../design/312-chart-data-format-standard-breakdown.md))

- **F1 — 행은 이미 표 한 장이다.** `ChartRow = Readonly<Record<string, unknown>>` (`packages/rendering/src/chart/types.ts:170`). 모든 종류가 같은 행 배열을 받는다 (`computeChartScene.ts:311-330`).
- **F2 — 역할 표가 9 항목을 빼고 있다.** descriptor 의 `roles` 가 패널 · 검증 · 전달 목록의 원천인데 (`authoring.ts:37-50`), 기존 9 항목 (bar · line · area · pie · donut · radar · radial · scatter · bubble) 은 `roles` 가 비었거나 보강 역할만 있다. 그 종류의 `dimension` · `metric` · `color` 는 별도 목록 (`SERIES_PROP_KEYS` `authoring.ts:964`) 이 든다.
- **F3 — 표본 행 편집기는 7 항목에만 맞는다.** `data` 의 편집 칸이 `category` · `value` · `series` 로 고정이다 (`packages/shared/src/catalog/bindings/Chart.binding.ts:1032-1048`). 표본 열 이름이 다른 29 항목은 행 이름이 비고, 새로 넣은 행을 차트가 읽지 않는다.
- **F4 — 표본 열 이름이 종류마다 다르다.** family 표본은 `kpi` · `actual` · `feature` · `usage` · `from` · `to` 처럼 종류마다 이름을 짓고 (`families/kpi.ts:1004` · `category/index.ts:94` · `distribution/index.ts:46` · `matrix/index.ts:46` · `network/index.ts:42`), 그래서 생성할 때 역할 prop 을 전부 써야 한다 (`sampleProps`).
- **F5 — 읽지 않는 값이 저장된다.** `CHART_DEFAULT_PROPS` 의 `dimension: "category"` · `metric: "value"` (`computeChartScene.ts:95-98`) 가 그 역할을 읽지 않는 종류에도 실린다 — dumbbell · candlestick 의 `metric`, gauge (표본 지정 `dimension=label`) · parallel · treemap · sunburst · sankey · chord · histogram 의 `dimension`.
- **F6 — 입력 형태를 바꾸는 방식이 셋이다.**
  - 명시 칸: `dataMode` (group · columns) — 시리즈 종류 · stream · skyline (`presentation.ts:347-411`).
  - 선택 역할의 유무: histogram 은 `countField` 가 있으면 구간 집계 입력으로 읽고 (`distribution/histogram.ts:116`), bump 는 `rankField` 가 있으면 순위 입력으로 읽는다 (`category/lines.ts:445`).
  - 읽지 않음: parallel 은 `dataMode` 와 무관하게 `valueFields` 를 읽는데 (`matrix/parallel.ts:34-44`) 패널은 모드 토글을 띄운다 (`useChartPropertyExtras.tsx:225`).
  - slope 는 형태에 따라 `dimension` 의 뜻이 바뀐다 — group 은 시점, columns 는 항목 (`category/lines.ts:620-647`).
- **F7 — 주 값의 key 가 하나가 아니다.** 대부분 `metric` 인데 candlestick 은 `closeField` 가 필수이고 `metric` 을 읽지 않는다 (`matrix/price.ts:138-139`).
- **F8 — 같은 키의 행을 다루는 방식이 여섯 가지이고 선언이 없다.**
  - 합산: 시리즈 격자 (`series.ts:230`) · marimekko (`category/blocks.ts:65`) · heatmap (`matrix/grid.ts:164`) · calendar (`:436`) · treemap · sunburst (`network/hierarchy.ts:83`) · sankey (`network/flow.ts:91`) · chord (`network/links.ts:272`).
  - 행마다 표식: lollipop · segmented · waffle · funnel · pareto (`category/bars.ts:71`) · bullet (`kpi.ts:443`) · dumbbell · waterfall · sparkline · candlestick · parallel · scatter (`series.ts:205`).
  - 행 = 표본: histogram (값 입력) · box · beeswarm · ridgeline (`distribution/spread.ts:72`).
  - 첫 행만: gauge (`kpi.ts:109`). 마지막 행: slope (`category/lines.ts:664-668`). 순위까지 합산: bump (`category/lines.ts:445` → `series.ts:230`).
  - 어느 종류도 키 중복을 진단하지 않는다. bar 는 같은 범주를 합치고 lollipop 은 같은 이름을 두 번 그린다.
- **F9 — 시리즈 표시 표 (`seriesConfig`: 표시 이름 · 색) 를 읽는 종류가 일부다.** 시리즈 경로와 stream · bump · skyline 만 읽는다 (`category/lines.ts:265`). parallel 은 identity 형식이 달라 맞지 않는다 (`matrix/parallel.ts:62` — 원 key 비교, 정본은 `presentation.ts:47-49` 의 `["field", key]`). 나머지 23 종은 읽지 않고, segmented · waffle · marimekko 는 색을 자리 순번으로 준다 (`category/bars.ts:340` · `blocks.ts:98`).
- **F10 — 역할 검증이 경로마다 다르다.** family 는 `role.missing` 을 낸다 (`families/fields.ts:70-79`). 시리즈 경로는 역할 검사가 없어 「No data」 가 된다 (`computeChartScene.ts:368-376`). `role.notNumeric` 은 선언만 있고 (`types.ts:250`) 내는 곳이 없다. stream · bump · skyline 은 격자의 진단을 버린다 (`category/lines.ts:257-269`).
- **F11 — Chart 가 쓰는 필드는 「사용 중」 으로 세지 않는다 (코드 판독, Phase 0 재현 대상).** 필드 사용처 집계는 `fieldMap` · `columnMapping` · `{…}` 템플릿만 본다 (`apps/builder/src/builder/panels/datatable/utils/fieldUsage.ts:7-9`). Chart 역할 prop 의 `#id` 참조는 그 셋이 아니다.
- **F12 — 범주 축의 날짜 · 숫자 해석이 셋이다.** 시리즈 경로는 `dimensionScale` · `dimensionFormat` (`presentation.ts:645-690`), calendar 는 자체 날짜 해석 (`matrix/grid.ts:380-397`), candlestick 도 자체 (`matrix/price.ts:121-127`). stream · bump · skyline 은 격자를 쓰면서 범주 축으로 고정한다 (`category/lines.ts:266`).

### 선행 결정

유지하는 것:

- [ADR-194](194-chart-component-headless-geometry.md) — React Spectrum Charts 이름 · 같은 범주 합산 · 비숫자는 결측.
- [ADR-209](209-chart-authoring-canvas-recharts-runtime.md) — 원본 행의 key · 값은 번역하지 않는다. 프리셋은 데이터 지정을 덮지 않는다.
- [ADR-210](210-chart-multi-field-series-presentation.md) — 원본 행을 wide ↔ long 으로 저장 변환하지 않는다. `seriesConfig` identity (`["group", 값]` · `["field", key]`). 모드 전환 때 가려진 값은 지우지 않는다.
- [ADR-211](211-chart-display-budget-pixel-fit-window-decimation.md) — `budgetAggregate` 는 표시 예산이 만든 bucket 에만 적용.
- [ADR-216](216-chart-time-axis-format-window.md) · [217](217-chart-reference-line-scatter.md) — 시간 축은 선택 설정, scatter 는 행 = 점.
- [ADR-152](152-data-panel-collection-binding-integration.md) — 필드 참조 `#id`. 모든 역할이 이 해석을 지난다.
- [ADR-284](284-data-view-filter-sort-group-query.md) Decision 3 — 「묶기 · 집계는 파생 보기에서만」. 연결한 Chart 는 보기의 결과 행을 읽는다 (`packages/shared/src/catalog/runtime/dataBinding.ts:192`).
- [ADR-277](277-table-tableview-merge.md) Decision 2 · [ADR-310](310-collection-item-repeat-marker.md) — Table 은 첫 연결에서 schema 의 열을 받는다 (연결 명령이 대상의 지정을 맞추는 선례). 반복 항목의 공통 모델은 Chart 를 포함하지 않는다.
- [ADR-306](306-chart-36-types-recharts-size-removal.md) — 역할 표가 패널 · 검증 · 전달 목록의 원천. family 는 원본 행을 직접 읽는다. 종류 전환은 행을 두고 채워지지 않는 필수 역할을 비운다. 문서 변환 코드를 만들지 않는다.

바꾸는 것:

- ADR-209 의 「역할 라벨은 Category · Value · Series 로 통일」 → 저장 key 는 그대로, 패널 라벨은 종류마다 (scatter 의 X · Y).
- ADR-210 의 `dataMode` 값 집합 (group · columns) → 형태가 둘 이상인 모든 종류의 전환 칸으로 넓힌다.
- ADR-306 의 「Chart prop 의 가산 확장」 전제 → 이 ADR 은 저장 key · 값의 뜻을 바꾸므로 contract 를 올린다.

### collection 과의 경계 (2026-11-16 실측)

Chart 는 목록 · 표와 같은 데이터 연결을 쓴다 ([ADR-194](194-chart-component-headless-geometry.md) 「새 data source 경로 0」). 같이 쓰는 것과 다른 것을 적어 둔다 — 이 ADR 은 같이 쓰는 경로를 바꾸지 않는다.

같이 쓰는 것:

- 연결 (`binding`) 과 그 명령 — `catalogBindingCommand` (`apps/builder/src/builder/catalogRuntime/dataBindingCommand.ts:176`).
- 행을 읽는 함수 하나 — `catalogBoundRows` (`packages/shared/src/catalog/runtime/dataBinding.ts:179`). 보기 (필터 · 정렬 · 묶기 · 집계, ADR-284) 와 계산 열 ([ADR-291](291-data-query-vocabulary-computed-fields.md)) 이 먼저 돌고 그 결과를 Chart 도 읽는다 (`:190-192` · `:211-216`).
- 필드 참조 `#id` (ADR-152) · 로딩 · 오류 상태 (`packages/shared/src/components/Chart.components.tsx:274-277`). 연결된 Chart 는 로딩 · 오류 · 빈 결과에서 표본 행으로 돌아가지 않는다 (ADR-209 breakdown §상태 표).

다른 것 (성격 차이라 그대로 둔다):

- **받는 행**: 목록 · 표는 표시 창만큼 (`"items"` — 더 보기 · 페이지 · 가상 스크롤, [ADR-310](310-collection-item-repeat-marker.md)), Chart 는 보기 결과의 전체 행 (`"records"` — `packages/shared/src/catalog/resolution/resolver.ts:2086-2094`). 합산 · 통계는 전체 행이 있어야 하고, 줄이는 일은 표시 예산 (ADR-211) 이 맡는다.
- **필드 지정의 자리**: 목록 · 표는 연결 안의 `fieldMap` 과 항목 템플릿의 `{필드}`, Chart 는 자기 역할 prop. Chart 에는 행마다 반복할 항목 노드가 없어 ADR-310 의 공통 표 (`COLLECTION_TYPE_TABLE` — `packages/shared/src/catalog/document/collectionItems.ts`) 에 들지 않는다.
- **표본**: 목록 · 표는 템플릿 항목, Chart 는 `data` 의 표본 행. 연결하면 표본 행 칸은 숨고 값은 남는다 (`apps/builder/src/builder/panels/properties/chartFieldOptions.ts:89`).

비어 있는 것:

- **F13 — 연결해도 역할이 따라가지 않는다.** Chart 에 컬렉션을 연결하는 명령은 `binding` 만 쓴다 (`dataBindingCommand.ts:176-215` — 반복 항목 type 만 행 템플릿을 받는다). 역할 prop 은 표본의 열 이름을 그대로 가리켜, 그 열이 없는 컬렉션이면 빈 차트가 된다. Table 은 첫 연결에서 schema 의 열을 받는다 ([ADR-277](277-table-tableview-merge.md) Decision 2 — `resolveColumnMode`, `apps/builder/src/builder/panels/datatable/utils/quickConnectPlan.ts:46-55`).
- **F14 — 패널의 열 선택지는 원본 schema 다.** Chart 가 읽는 행은 보기의 결과인데 (`packages/shared/src/catalog/runtime/dataBinding.ts:286-294` — 묶은 보기는 묶음 열과 집계 이름으로 된 결과 schema `viewResultSchema`, `packages/shared/src/collections/view/evaluate.ts:431`), 패널의 역할 선택지는 컬렉션의 원본 schema 만 읽는다 (`apps/builder/src/builder/panels/properties/hooks/useOwnerCollectionColumns.ts:48-56`). `points` 를 합쳐 `total` 로 내는 보기를 연결하면 결과 행에 `points` 가 없고 선택지에 `total` 이 없다.

### 레퍼런스 (2026-11-16 확인)

| 원천                                 | 행 모양                            | 필드 지정                                                                                                                                                                 | 표시 이름 · 색                                      | 집계                           |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------ |
| React Spectrum Charts                | 표 한 장을 `Chart` 에              | 전 종류 `dimension` · `metric` · `color` (기본값은 종류마다 — Bar `category` · `value` · `series`), 추가 역할은 `size` · `target` · `metricStart` / `metricEnd` · `order` | `Chart` 의 색 · 선 종류 scale                       | Donut 은 같은 `color` 를 합산  |
| shadcn Chart (aria, Recharts 그대로) | 「어떤 모양이든」 — 예제는 넓은 표 | Recharts `dataKey` (열마다 시리즈) · `nameKey`                                                                                                                            | 데이터와 분리된 `ChartConfig` (key → label · color) | 없음                           |
| json-render (dashboard 예제 catalog) | 표 한 장을 경로로 연결             | `xKey` · `yKey`                                                                                                                                                           | 없음                                                | `aggregate: sum · count · avg` |
| ztd-charts 0.5.0 (ADR-306 의 기준)   | 종류마다 채널                      | 채널 이름이 종류마다 (`label` · `x` · `axis` · `group` · `date` …)                                                                                                        | —                                                   | —                              |

- 우리 핵심 셋의 이름은 React Spectrum Charts 와 같다. 기본 열 이름은 그 라이브러리에서 종류마다 다르다 (Bar 는 `category` · `value` · `series`, Line · Scatter 의 `dimension` 은 `datetime`) — 역할마다 기본 열 이름 하나를 두는 것은 이 ADR 의 선택이고, 종류가 덮을 수 있게 둔다. 그 라이브러리도 Scatter 의 X 를 `dimension` 으로 받는다 — 같은 key 가 종류마다 다른 축인 것은 결함이 아니고, 패널 라벨만 종류에 맞추면 된다.
- 우리 `dataMode` 의 두 값이 두 방식이다 — group 은 React Spectrum Charts (열의 값으로 나눔), columns 는 shadcn · Recharts (열마다 시리즈).
- 우리 `seriesConfig` 가 shadcn 의 `ChartConfig` 다. 차이는 읽는 종류의 범위뿐이다 (F9).
- json-render 의 집계 칸에 해당하는 것은 ADR-284 의 보기 (묶기 · 집계) 로 이미 있다.

### Hard constraints

- **HC1** 문서 변환 코드를 두지 않는다 (ADR-306 · 메모리 `feedback-no-document-migration-code-dev-stage`). 저장 key 나 값의 뜻이 바뀌면 `LIBRARY_CONTRACT_VERSION` (지금 68, `packages/shared/src/catalog/document/types.ts:169`) 을 다음 번호로 올리고 이전 번호의 문서는 열리지 않는다 (`graph.ts:597-602`).
- **HC2** 기존 9 항목의 저장 key 와, 같은 입력에 대한 scene 은 바뀌지 않는다 — `computeChartScene.test.ts` snapshot · `chartParity.test.tsx` 무변경.
- **HC3** 번들 상한: Builder 1,435,351 B · Preview 327,000 B (gzip, ADR-201, 만료 2026-12-25). 역할 표는 descriptor 와 함께 첫 화면 번들에 들어간다. 표본 · 계산은 family chunk 그대로 둔다.
- **HC4** 데이터 해석은 scene 을 만들기 전 한 곳이고 두 consumer 가 그 결과를 읽는다. consumer 한쪽에만 해석을 두지 않는다.
- **HC5** 모든 역할이 `#id` 참조와 정적 key 를 같은 함수로 받는다 (`data/fieldIdIndex.ts:38`).
- **HC6** 행 정책을 맞추느라 격자나 묶기를 새로 지나는 종류의 scene 계산 시간이 지금보다 늘지 않는다 — 1 만 행 fixture 를 같은 기계에서 전후 비교 (기준선은 Phase 0).
- **HC7** collection 과 같이 쓰는 경로는 바뀌지 않는다 — `catalogBoundRows` · 보기 실행 (`packages/shared/src/catalog/runtime/viewQuery.ts`) · 계산 열 · `readDataBindingRows` 의 코드와 그 테스트 무변경. Chart 쪽 변경은 「읽어 온 행을 역할로 해석하는」 단계에만 있다.

### Soft constraints

- 사용자는 비개발자이고 기능 단위로 생각한다 — 「차트에 데이터를 주는 법」 이 종류를 바꿔도 같아야 한다.
- 고객은 대량 데이터를 조회해 차트로 본다. 원본 행은 한 범주에 여러 행인 경우가 흔하다.
- 개발 단계다. 새 27 종은 2026-11-15 ~ 16 에 추가됐다.

## Alternatives Considered

### 대안 A: 표면만 맞춘다

- 설명: 저장 key 와 읽기는 그대로 두고 패널만 고친다 — 표본 행 편집기 칸을 종류의 역할에서 만들고, 라벨을 종류별로 두고, parallel 의 모드 토글을 숨긴다.
- 근거: 변경이 가장 작고 contract 를 올리지 않는다.
- 위험:
  - 기술: LOW.
  - 성능: LOW.
  - 유지보수: **HIGH** — F6 (암묵 형태 전환) · F8 (행 정책 여섯 가지) · F9 (표시 표 범위) 가 남는다. 새 종류를 더할 때마다 같은 갈림이 다시 생기고, 사용자가 말한 「임시적인 처리」 다.
  - 마이그레이션: LOW.

### 대안 B: 인코딩 객체 하나

- 설명: Vega-Lite · ztd `meta.ts` 처럼 `encoding: { x, y, series, … }` prop 하나에 모든 필드 지정을 담는다.
- 근거: 채널 문법이 한 벌이고 외부 표준과 가깝다.
- 위험:
  - 기술: **HIGH** — catalog 에 객체 kind 가 없다 (ADR-211 이 같은 이유로 `displayBudget` 을 평탄 key 넷으로 폈다). `visibleWhen` (`evaluateVisibility.ts`) · 인스턴스 override · `#id` 해석 (`chartFieldOptions.ts:79-80`) · 전달 목록 (`Chart.binding.ts:1415-1463`) 이 모두 평탄 key 전제다.
  - 성능: LOW.
  - 유지보수: MEDIUM.
  - 마이그레이션: **HIGH** — 기존 9 항목의 `dimension` · `metric` · `color` 까지 전부 옮긴다 (HC2 위반).

### 대안 C: React Spectrum Charts 이름으로 추가 역할을 개명

- 설명: 평탄 key 를 유지하되 추가 역할을 그 라이브러리 이름으로 바꾼다 — `goalField` → `target`, `sizeField` → `size`, `startField` / `endField` · `lowerFields` / `upperFields` → `metricStart` / `metricEnd`. 그 라이브러리에 없는 역할만 우리 이름으로 둔다.
- 근거: D2 의 참조 원천과 이름이 같아진다.
- 위험:
  - 기술: MEDIUM — `size` 는 contract 68 에서 지운 공개 prop 의 이름이다 (`adr306ChartSize.test.ts:101` 이 `size` 거부를 고정). `target` 은 sankey 의 도착 필드 (`targetField`) 와 뜻이 겹친다.
  - 성능: LOW.
  - 유지보수: MEDIUM — 접미사가 있는 key 와 없는 key 가 섞여 「역할 key 인가」 를 이름으로 가를 수 없다.
  - 마이그레이션: MEDIUM — family 역할 대부분이 개명된다.

### 대안 D: 계약 표준 — 평탄 key 유지 · 역할 표 하나 · 형태 선언 · 행 정책 선언

- 설명: key 는 평탄한 채로 두고, 종류마다 흩어진 사실을 표 하나로 모은다. 역할 (뜻 · 형 · 기본 열 이름 · 라벨) · 입력 형태 (역할 집합과 전환 칸) · 행 정책 (같은 키의 행) · 시리즈 표시 표의 적용을 종류마다 선언하고, 패널 · 표본 · 검증 · 사용처 집계가 그 표에서 나온다.
- 근거: 세 레퍼런스의 공통점 (표 한 장 + 이름으로 열 지정 + 데이터와 분리된 표시 표) 이 지금 구조와 같다. 갈림은 구조가 아니라 선언의 부재다.
- 위험:
  - 기술: MEDIUM — 행 정책을 맞추면 일부 종류가 같은 키의 행을 다르게 그린다 (표본에는 중복 키가 없어 표본 그림은 같다).
  - 성능: LOW ~ MEDIUM — HC6.
  - 유지보수: LOW.
  - 마이그레이션: MEDIUM — contract 를 한 번 올린다. 개명은 family 역할 일부다.

### Risk Threshold Check

| 대안 | 기술     | 성능      | 유지보수 | 마이그레이션 | HIGH 이상 |
| ---- | -------- | --------- | -------- | ------------ | :-------: |
| A    | LOW      | LOW       | **HIGH** | LOW          |     1     |
| B    | **HIGH** | LOW       | MEDIUM   | **HIGH**     |     2     |
| C    | MEDIUM   | LOW       | MEDIUM   | MEDIUM       |     0     |
| D    | MEDIUM   | LOW ~ MED | LOW      | MEDIUM       |     0     |

HIGH 가 없는 대안이 둘 (C · D) 이라 루프를 더 돌지 않는다. CRITICAL 없음.

## Decision

**대안 D** 를 채택한다. 표준은 아래 열 항이다.

1. **표 한 장.** 차트의 데이터는 평평한 행 배열 하나다 (F1 그대로). 종류 전용 행 모양을 요구하지 않는다.
2. **역할 표 하나.** 36 항목 전부의 역할을 한 표가 든다 — key · 형 · 가산 여부 · 기본 열 이름 · 라벨. 기존 9 항목도 이 표에 넣고 별도 목록 (`SERIES_PROP_KEYS`) 을 없앤다 (F2).
3. **key 문법 — 한 뜻에 한 key.** 핵심 넷 `dimension` · `metric` · `color` · `valueFields` 는 이름과 뜻을 그대로 둔다. 나머지는 `<뜻>Field` · `<뜻>Fields` 다. 주 값은 늘 `metric` 이다 — candlestick 의 `closeField` 를 `metric` 으로 옮긴다 (F7). React Spectrum Charts 의 대응 이름은 역할 표에 출처로 적는다.
4. **입력 형태를 선언한다.** 종류마다 형태 목록을 두고 형태는 역할 집합이다. 형태가 둘 이상이면 전환은 `dataMode` 한 칸이다. 역할의 유무로 형태가 바뀌는 읽기 (histogram · bump) 와 칸을 띄우고 읽지 않는 종류 (parallel) 를 없앤다. 한 종류 안에서 역할의 뜻은 형태가 달라도 같다 (slope) (F6).
5. **행 정책을 선언한다.** 형태마다 같은 키의 행을 다루는 방식을 하나 적는다 — 합산 · 행마다 표식 · 행 = 표본. 같은 모양의 종류는 같은 정책이다 (범주 × 값 종류는 bar 와 같이 합산). 가산이 아닌 역할 (순위 · 구간 경계) 의 키가 겹치면 첫 행을 쓰고 경고 진단을 낸다. 집계 방식 (개수 · 평균) 을 고르는 일은 ADR-284 의 보기가 맡는다 (F8).
6. **시리즈 표시 표는 공통이다.** 색이 이름 붙은 항목을 가르는 모든 종류가 `seriesConfig` 를 같은 identity 로 읽는다 (F9).
7. **파생은 역할 표에서.** 패널의 Collection 칸과 종류별 라벨 · 표본 행 편집기 칸 · 표본의 열 이름 · 검증 진단 · prop 전달 목록 · 필드 사용처 집계 · AI catalog 설명이 역할 표에서 나온다 (F3 · F10 · F11).
8. **저장은 그 종류의 역할만.** 표본은 역할의 기본 열 이름을 쓰고, 값이 없는 역할은 기본 열 이름으로 읽는다. 그래서 새 차트는 기본 열 이름이 있는 역할의 값을 쓰지 않는다. 기본 열 이름이 없는 목록 역할 (`valueFields` · `frontFields` · `rangeFields` · `invertFields`) 은 생성 때 표본의 목록을 쓴다 — 지우면 그릴 열이 없다 (F4 · F5). 종류 전환 규칙 (ADR-306) 과 가려진 값 보존 (ADR-210) 은 그대로다.
9. **범주 축 해석은 한 곳.** 날짜 · 숫자 해석을 읽는 종류는 같은 parser (`dimensionScale` · `dimensionFormat`) 를 쓴다 — calendar · candlestick 의 자체 해석을 없앤다 (F12).
10. **연결은 collection 과 같은 길, 역할은 원천을 따라간다.** 연결 · 보기 · 계산 열 · 필드 참조는 목록 · 표와 같은 경로 그대로다 (HC7). Chart 가 받는 행은 보기 결과의 전체 행이고, 「원천의 열」 은 그 **결과 schema** 다 — 묶기 · 집계가 있으면 묶음 열과 집계 이름, 없으면 컬렉션의 schema (F14). 자동 지정 · 「가리키는 열이 있는가」 판정 · 패널의 열 선택지가 모두 이것을 읽는다. 원천이 바뀌는 명령 (연결 · 다른 컬렉션이나 보기로 변경 · 해제) 이 같은 단계에서 역할을 맞춘다 — 가리키는 열이 새 원천에 있는 역할은 그대로 두고, 없는 필수 역할은 그 종류가 받는 형에 맞는 첫 열로 채운다. 해제하면 표본에 없는 열을 가리키는 역할을 그 종류의 표본 지정으로, 그것이 표본에 없으면 형이 맞는 표본 열로 되돌린다. 보장은 「해제하면 표본으로 다시 그려진다」 까지이고, 연결 전과 같은 지정은 Undo 가 돌려준다. 표본 행은 연결 중 숨고 보존된다 (F13).

contract 는 저장 key · `dataMode` 값이 바뀌는 Phase 에서 한 번 올린다 (HC1).

위험 수용 근거: 남는 위험은 「같은 키의 행을 다르게 그리게 되는 종류」 와 contract 올림이다. 앞의 것은 지금의 갈림 (bar 는 합치고 lollipop 은 두 번 그림) 을 없애는 변경 자체이고 표본 그림은 같다. 뒤의 것은 개발 단계 원칙 그대로이며 영향 범위를 Risks R2 에 적는다.

기각 사유:

- **A** — F6 · F8 · F9 가 남아 종류마다 다른 읽기가 그대로다. 사용자가 「임시적인 처리가 아닌 근본적인 포멧」 을 요구했다.
- **B** — catalog 에 객체 kind 가 없어 패널 · override · 참조 해석을 모두 다시 지어야 하고, 기존 9 항목의 key 를 옮겨 HC2 를 깬다. 평탄 key 로 같은 표준을 얻을 수 있다.
- **C** — `size` · `target` 이 이미 다른 뜻으로 쓰인 이름이고, 문법이 둘이 되어 정적 검사로 역할 key 를 가를 수 없다. 이름의 출처는 역할 표의 출처 칸으로 남긴다. (사용자 결정 2 로 뒤집을 수 있다.)

> 구현 상세: [312-chart-data-format-standard-breakdown.md](../design/312-chart-data-format-standard-breakdown.md)

### 사용자 결정 (5건 — 그 Phase 에 닿을 때 묻는다)

1. **집계 칸의 자리.** 권고: Chart 에 새 칸을 두지 않고 ADR-284 의 보기 (묶기 · 집계) 를 쓴다. 대안: Chart 공통 칸 `aggregate` (합계 · 개수 · 평균) 를 더한다 — 표본 행 (연결 없는 차트) 에서도 개수를 셀 수 있지만 같은 일을 하는 자리가 둘이 된다.
2. **추가 역할의 이름.** 권고: `<뜻>Field` 유지. 대안: React Spectrum Charts 이름 (`target` · `size` · `metricStart` / `metricEnd`). 2026-11-16 대화의 초안은 대안 쪽을 권했는데, 조사에서 `size` (contract 68 에서 지운 공개 prop) · `target` (sankey 도착 필드) 의 겹침을 확인해 권고를 바꿨다.
3. **표본의 열 이름.** 권고: 역할의 기본 열 이름 (`category` · `value` · `series` · `goal` …) — 표본 행 편집기가 전 종류에서 같은 칸 이름을 쓰고 새 차트가 기본 열 이름이 있는 역할의 값을 쓰지 않는다 (목록 역할은 쓴다). 대안: 지금처럼 종류마다 뜻 있는 이름 (`feature` · `usage`) 을 두고 역할 prop 을 쓴다.
4. **행 정책이 바뀌는 종류.** 같은 키의 행이 있을 때 그림이 달라진다 — lollipop · segmented · waffle · funnel · pareto · bullet · dumbbell (행마다 표식 → 합산), gauge (첫 행 → 합산), slope (마지막 행 → 합산), bump (순위 합산 → 첫 행 + 경고). 권고: 전부 표준대로. 대안: 종류별로 지금 방식을 남긴다 (그 종류는 표에 예외로 적는다).
5. **번들 상한.** 역할 표로 Builder 첫 화면이 상한을 넘으면 상한 재승인 (ADR-201) 을 묻는다.

## Risks

| ID  | 위험                                                                                                                                                                                   | 심각도 | 대응                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------- |
| R1  | 기존 9 항목의 회귀 — 역할 표로 옮기며 `series.ts` `buildSeriesGrid` · `presentation.ts` `resolveChartPresentation` · `authoring.ts` `createChartInitialProps` 의 읽기가 달라진다       |  HIGH  | G1 — snapshot · parity 무변경, 저장 key 무변경                                                            |
| R2  | contract 올림 — contract 68 문서는 Chart 유무와 무관하게 전부 열리지 않는다 (`graph.ts:597-602`). 대상은 개발 중 만든 로컬 프로젝트 전부, 평균 재작성 파일 0 (변환 없음 — 다시 만든다) |  MED   | 올림은 한 번, 한 Phase 에. CHANGELOG 에 Breaking. 병렬 세션과 번호 충돌은 push 전 `git fetch` 로 확인     |
| R3  | 행 정책 변경이 뜻하지 않은 그림 차이를 낸다 — `category/bars.ts` `labelValues` · `kpi.ts` gauge · `category/lines.ts` slope 의 읽기                                                    |  MED   | G3 — 종류마다 중복 키 fixture 손계산 + 표본 scene 전후 동일                                               |
| R4  | 표가 둘로 갈린다 — binding `accepts` (shared) 와 역할 표 (rendering) 가 따로 수정된다                                                                                                  |  MED   | G2 — 정적 검사: `accepts` 의 역할 key = 역할 표, 표본 열 ⊂ 기본 열 이름                                   |
| R5  | 기본 열 이름 읽기가 연결 데이터에서 없는 열을 가리킨다 (`category` 열이 없는 컬렉션)                                                                                                   |  MED   | 「열 없음」 진단 (`role.missing`) 을 시리즈 경로에도 — 지금의 「No data」 (F10) 를 대체                   |
| R6  | 첫 화면 번들 증가 (HC3)                                                                                                                                                                |  MED   | G5 — `adr201-bundle-gate.mjs`. 표본 · 계산은 chunk 에 둔다                                                |
| R7  | ADR-306 의 채널 대응 fixture (`ztdCoverage.fixture.ts`) 가 낡는다                                                                                                                      |  LOW   | 개명 · 형태 변경과 같은 커밋에서 고친다                                                                   |
| R8  | 연결할 때의 자동 지정이 뜻과 다른 열을 고른다 (숫자 id 열을 값으로) — `dataBindingCommand.ts` `catalogBindingCommand` 에 더하는 단계                                                   |  MED   | 필수 역할만 · 열이 없는 역할만 · 형이 맞는 첫 열 · 명령 하나 (Undo 한 번). 패널의 역할 칸에서 바로 바꾼다 |
| R9  | 공유 보기의 정의를 고치면 (집계 이름 변경) 그 보기를 읽는 Chart 의 역할이 없는 열을 가리킨다 — 보기 편집 명령은 Chart 를 고치지 않는다 (HC7)                                           |  MED   | `role.missing` 진단이 어느 역할인지 보여 주고 패널의 「다시 맞추기」 가 같은 규칙을 한 번 돌린다          |

## Gates

측정 조건 (기기 · production build · revision) 을 기록에 적는다. 실행하지 않은 gate 를 PASS 로 적지 않는다.

| Gate | 시점        | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 실패 시 대안                                                 |
| ---- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| G0   | Phase 0     | 36 항목 × (역할 · 형태 · 행 정책 · `seriesConfig` · 표본 열) 의 **현재** 표를 fixture 로 고정 · F11 재현 · 성능 (1 만 행) 과 번들 기준선. 착수 여부를 가르지 않는다                                                                                                                                                                                                                                                                                                                                                                                                                                | 표가 breakdown §3 과 다르면 breakdown 을 고친다              |
| G1   | Phase 1     | 기존 9 항목: `computeChartScene.test.ts` snapshot · `chartParity.test.tsx` 무변경, 저장 key 무변경 (R1)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | 역할 표로 옮긴 읽기를 되돌리고 원인 수리                     |
| G2   | Phase 1 ~ 2 | 정적 검사 — 모든 항목의 역할이 비어 있지 않음 · key 문법 · `accepts` ↔ 역할 표 · 표본 열 ⊂ 기본 열 이름. 표본 행 편집기 칸 = 그 형태의 역할 (36 항목) · 종류별 라벨 · Chart 역할 필드가 사용처 집계에 나옴 (R4)                                                                                                                                                                                                                                                                                                                                                                                    | 누락 항목 수리                                               |
| G3   | Phase 3     | 행 정책: 종류마다 중복 키 fixture 의 기대 값 손계산 일치 · 원복 RED 1 · 표본 scene 전후 동일 · HC6 (1 만 행 전후) (R3)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 그 종류를 사용자 결정 4 로 올린다                            |
| G4   | Phase 4     | 색이 항목을 가르는 모든 종류에서 `seriesConfig` 의 표시 이름 · 색이 Canvas scene 과 DOM 에 같이 적용                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | identity 수리                                                |
| G5   | Phase 5     | 이전 contract 문서 거부 · 번들 Δ 가 상한 안 (R6) · live: family 마다 1 종 — 생성 → 표본 행 편집 → 컬렉션 연결 → 역할 지정 → 형태 전환 → 종류 전환 → 저장 재열기 (Canvas · Preview · Publish) + 사용자 확인                                                                                                                                                                                                                                                                                                                                                                                         | 상한 초과는 사용자 결정 5                                    |
| G6   | Phase 2 · 5 | collection 경계: HC7 의 파일 · 테스트 무변경 (정적 대조) · 표본과 열 이름이 다른 컬렉션을 연결 → 필수 역할이 채워져 빈 차트가 아님 · 열이 있는 역할은 지정 보존 · **묶고 합친 보기** (`points` → `total`) 를 연결 → 값이 `total` 을 가리키고 패널 선택지에 `total` · 다시 연결해도 유지 · **날짜 열이 첫 열이 아닌 컬렉션을 calendar 에** → `dimension` 이 날짜 열 · 해제 → 표본 그림이 돌아옴 (**parallel · skyline 의 값 열 목록 포함**, 표본의 열 이름을 사용자가 바꾼 차트 포함) · 연결 → 해제 → Undo 두 번이 각 상태로 · 보기를 건 컬렉션에서 Chart 와 같은 연결의 목록이 같은 결과 행을 읽음 | 같이 쓰는 경로를 고쳐야 하면 범위 변경으로 사용자에게 묻는다 |

집행: `codex:chart-contract` (`scripts/codex/chart-contract-gate.sh`, `codex:preflight` 사슬) · `adr201-bundle-gate.mjs` (push 전) · 배포 workflow `deploy.yml` 의 절대 상한 (`push: main`). 새 게이트 기구를 만들지 않는다.

### Live Exercise

실행자 live (Chrome MCP, dev 5173, 새 프로젝트 adr312-live — contract 68 이하 문서는 열리지 않는다). 결과는 Canvas 와 Publish DOM 에서 읽었다.

- **Phase 2 (G2 · G6)**: Bar · Dumbbell 생성 → Overrides 에 역할 값 없음 · 표본 편집기 칸 Category · Start · End → 컬렉션 연결 → 필수 역할이 `status` · `points` 로 채워짐 → 해제 → 표본 그림 → Undo 두 번이 각 상태로 → Publish 같은 막대.
- **Phase 3 (G3)**: Dumbbell 표본 행의 범주를 겹치게 바꾸면 Canvas · Publish 가 같이 합친다 (Seoul 4.6 + 1.8 = 6.4).
- **Phase 4 (G4)**: Dumbbell Series 섹션 — 이름 「Before」 · 색 3 이 Canvas 와 Publish 에 같이.
- **Phase 5 (G5 · G6)**: family 마다 1 종 — Calendar 생성 → 표 연결 (Date = 날짜 열 `date`, 첫 열 아님) → Line → Bump (`role.missing`) → 형태 전환 Rank → Group → Histogram (Series 섹션) → Sankey (Source · Target 지정) → 새로고침 뒤 연결 · 형태 유지 → Publish 같은 그림 · 콘솔 0. 필드 사용처: 열 삭제 확인에 「used in 2 place(s)」 (F11).
- **36 종 전부 연결 (사용자 요청 2026-11-17)**: Data 패널 Data table creator → Paste 로 「Sales」 (region · product · month · sales · cost · units, 10 행 — 기본 열 이름과 다른 이름) → 팔레트 Chart 36 항목을 하나씩 넣고 Data source = Sales. 32 종이 바로 그려졌고 결함 4 (산점도 X 형 · 맞춤의 형 검사 · 상속 역할 해제 · columns 시리즈 이름의 `#id`) 를 고친 뒤 36 종 모두 그려진다 (Seoul 435 = 120 + 90 + 130 + 95 · Donut 810 · Scatter X sales · Y cost · Sparkline 행마다 · Skyline 범례 sales · cost · units). 회귀 `adr312LiveSales.test.ts` 6 · 원복 RED 4.
- **사용자 확인 (G5)**: 2026-11-17 「Implemented 승격」.
- 남은 관찰 (결함 아님): 값 하나뿐인 시리즈 범례가 「series」 · Gauge 기본 최대 100 이라 합 810 이 넘침 (최대 값은 사용자 설정).

## Consequences

### Positive

- 종류를 바꿔도 데이터를 주는 법이 같다 — 같은 뜻은 같은 칸, 형태 전환은 늘 같은 칸, 표본 행은 어느 종류에서나 편집된다.
- 새 종류를 더하는 일이 역할 표에 행 하나를 적는 일이 된다. 패널 · 표본 · 검증 · 사용처 집계를 따로 손대지 않는다.
- 원본 행 (한 범주에 여러 행) 을 어느 종류에 연결해도 같은 규칙으로 합쳐진다.
- 표시 이름 · 색을 36 종에서 같은 자리에서 정한다.
- 새 차트의 Overrides 에 기본 열 이름으로 읽히는 역할 값이 쌓이지 않는다 (값 열 목록은 남는다).
- 컬렉션을 연결하면 차트가 바로 그려진다 — 표본과 열 이름이 달라도 역할이 따라간다. 연결 · 보기 · 계산 열은 목록 · 표와 같은 것을 그대로 쓴다.

### Negative

- contract 를 올려 그전 프로젝트가 열리지 않는다.
- 같은 키의 행이 있는 데이터에서 일부 종류의 그림이 지금과 달라진다 (사용자 결정 4).
- 표본의 열 이름이 일반 이름이 되면 Library 표본의 열 이름이 덜 구체적이다 (사용자 결정 3).
- 역할 표가 첫 화면 번들에 들어간다.
- 연결할 때의 자동 지정은 추정이라 틀릴 수 있다 — 사용자가 역할 칸에서 고친다.
- ADR-209 의 라벨 통일 결정 · ADR-210 의 `dataMode` 값 집합이 이 ADR 로 바뀐다 — 두 문서를 읽는 사람은 이 문서를 같이 봐야 한다.
