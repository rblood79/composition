# ADR-306 구현 설계: Chart 36종 · Recharts 유지 · 공개 size 제거

> 본문: [ADR-306](../306-chart-36-types-recharts-size-removal.md). Proposed 2026-11-10 (같은 날 재작성). 아래의 새 모듈 · 함수 · prop 이름은 제안이고 아직 구현되지 않았다. 코드 인용은 `c464b4fb7` 기준이고 2026-11-15 `f01653b77` 에서 라인 · 사실을 다시 대조했다.

## 1. 전제

- 사용자 확정 3: Recharts 유지 · 공개 S/M/L 제거 · ztd-charts 36종.
- fork 아님: 사용자가 새 ADR 하나를 지시했다. base 는 ADR-248 (문서 · 명령) · 194 (scene) · 209 (Recharts runtime), 이 ADR 은 응용. schema 는 Chart prop 의 가산 확장이고 entry 종류는 그대로. 선행 ADR 의 의존 방향을 바꾸지 않는다.
- 기준: ztd-charts 0.5.0 `3c4376cda61361d630ae4cc7bd472af64ba30d2e` (MIT) 의 `packages/ztd-charts/src/spec/registry.ts` (항목 · 옵션) · `spec/meta.ts` (encoding 채널). Recharts 3.10.1 (`packages/shared/package.json`).
- 측정 등급 (메모리 `feedback-measurement-grade-a-b-c`): 구조 (공유 scene · family 지연 로드) 는 코드 근거로 착수하는 B — 측정은 번들 몫과 예산 숫자를 정하는 데만 쓴다. Phase 0 은 go/no-go 가 아니다.

## 2. 36 항목

「역할」 열은 ztd 채널 → Chart prop 이다. 기존 prop (`dimension` · `metric` · `color` · `valueFields` · `dataMode`) 의 뜻이 맞으면 그것을 쓰고 새 prop 은 뜻이 다를 때만 만든다. 모든 필드 prop 은 기존 field ID 해석 (`chartFieldOptions.ts`) 을 지난다.

### 2.1 기존 type (9 항목 — 새 chartType 없음)

| #   | 제공 id   | chartType | 방식                      | 추가 역할 · 옵션 (§3 「채택」)                                                                   |
| --- | --------- | --------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| 01  | bar       | bar       | 그대로                    | `sort`                                                                                           |
| 02  | line      | line      | 그대로                    | `valueMin` · `valueMax` · `connectNulls` · `endLabels` · `lowerFields` · `upperFields` (범위 띠) |
| 03  | area      | area      | 그대로                    | line 과 같음                                                                                     |
| 04  | pie       | pie       | 그대로                    | `sort` · `labelKey` 에 percent                                                                   |
| 05  | donut     | pie       | 기존 프리셋 `donut-total` | `centerLabel`                                                                                    |
| 06  | radar     | radar     | 그대로                    | `valueMax`                                                                                       |
| 07  | radialBar | radial    | 프리셋 (`valueMax` 100)   | `valueMax` — 기존 radial 저장본의 자동 domain 은 `valueMax` 미지정으로 유지                      |
| 08  | scatter   | scatter   | 그대로                    | `labelField` · `fit` (linear) · `quadrants`                                                      |
| 09  | bubble    | scatter   | 프리셋 (`sizeField` 지정) | `sizeField` · `sizeRange` · `labelField` — 면적 비례 반지름                                      |

### 2.2 새 chartType 27 (family 5)

| #   | chartType   | family       | 역할                                                                                            | 옵션                                                                                                       |
| --- | ----------- | ------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 10  | lollipop    | category     | `dimension` · `metric`                                                                          | `orientation` · `sort`                                                                                     |
| 11  | segmented   | category     | `dimension` · `metric`                                                                          | `shape` (tall · thin) · `sort` · `showLegend` (목록)                                                       |
| 12  | waffle      | category     | `dimension` · `metric`                                                                          | `cells` · `columns` · `valueMax` (전체) · `showTotal`                                                      |
| 13  | funnel      | category     | `dimension` · `metric`                                                                          | `showRates` · `rateBase` (previous · first)                                                                |
| 14  | pareto      | category     | `dimension` · `metric`                                                                          | `threshold` · `sort` · `rankLabels`                                                                        |
| 15  | waterfall   | category     | `dimension` · `metric` · `kindField` (total 행)                                                 | `startTotal` · `endTotal` · `connectors`                                                                   |
| 16  | sparkline   | category     | `metric` · `dimension` (선택)                                                                   | `shape` (line · area · bar) · `showTotal` (마지막 값) · `showExtremes`                                     |
| 17  | marimekko   | category     | `dimension` (열) · `color` (쌓는 시리즈) · `metric`                                             | —                                                                                                          |
| 18  | stream      | category     | `dimension` · `metric` / `valueFields` · `color`                                                | `offset` (wiggle · silhouette) · `reorder` · `curve`                                                       |
| 19  | bump        | category     | `dimension` (시점) · `color` (항목) · `rankField` 또는 `metric`                                 | —                                                                                                          |
| 20  | slope       | category     | `dataMode` group: `dimension` (시점) · `color` (항목) · `metric` / columns: `valueFields` 2     | `periodLabels`                                                                                             |
| 21  | skyline     | category     | `dimension` · `valueFields` (또는 `metric` + `color`) · `frontFields`                           | `depth` · `wall` · `texture` · `frontRate`                                                                 |
| 22  | gauge       | kpi          | `metric` · `goalField`                                                                          | `valueMin` · `valueMax` · `shape` (arc · semi · ring · ticks) · `bands`                                    |
| 23  | bullet      | kpi          | `dimension` · `metric` · `goalField` · `rangeFields`                                            | `independent`                                                                                              |
| 24  | dumbbell    | kpi          | `dimension` · `startField` · `endField`                                                         | `sort` · `includeZero`                                                                                     |
| 25  | histogram   | distribution | 원시: `metric` · `color` (≤ 2 그룹) / 사전 집계: `binStartField` · `binEndField` · `countField` | `shape` (bars · dots · step) · `percentiles` · `threshold` · `edges` · `binWidth` · `bins` · `log` · `kde` |
| 26  | box         | distribution | `dimension` (그룹) · `metric`                                                                   | `shape` (box · violin · both) · `outliers` · `whiskers` · `includeZero`                                    |
| 27  | beeswarm    | distribution | `metric` · `dimension` (선택) · `labelField`                                                    | `dotRadius` · `showMedian`                                                                                 |
| 28  | ridgeline   | distribution | `dimension` (그룹) · `metric`                                                                   | `overlap` · `bandwidth` · `sort`                                                                           |
| 29  | heatmap     | matrix       | `dimension` (열) · `rowField` (행) · `metric`                                                   | `showValueLabels` · `showLegend`                                                                           |
| 30  | calendar    | matrix       | `dimension` (날짜) · `metric`                                                                   | `weekStart` · `cellGap`                                                                                    |
| 31  | candlestick | matrix       | `dimension` (날짜) · `openField` · `highField` · `lowField` · `closeField` · `volumeField`      | `movingAverages` · `valueMin` · `valueMax`                                                                 |
| 32  | parallel    | matrix       | `valueFields` (축) · `labelField`                                                               | `invertFields`                                                                                             |
| 33  | treemap     | network      | `pathFields` · `metric`                                                                         | `labelKey` · `sort`                                                                                        |
| 34  | sunburst    | network      | `pathFields` · `metric`                                                                         | `innerRadius` · `sort`                                                                                     |
| 35  | sankey      | network      | `sourceField` · `targetField` · `metric`                                                        | `nodeWidth` · `nodePadding`                                                                                |
| 36  | chord       | network      | `sourceField` · `targetField` · `metric`                                                        | `padAngle`                                                                                                 |

- `shape` 은 종류 안의 모양 선택 한 prop 이다 (값 집합은 종류마다 다르고 `accepts` 의 options 가 chartType 으로 갈린다). 종류마다 `gaugeVariant` · `boxVariant` 를 따로 만들지 않는다. rule 의 `variant` (상자 모양) 와 다른 축이라 그 이름을 쓰지 않는다.
- matrix family = 행 하나가 칸 · 캔들 · 선 하나인 종류. network = 행이 노드 · 연결 관계를 만드는 종류.
- 새 prop 은 전부 `d2Provenance.ts` 에 `composition` 출처로 적는다 (Chart 는 이미 등재 — `d2Provenance.ts:39`).

## 3. ztd 옵션 분류

Phase 0 이 registry 의 채널 · 옵션 key 전부를 아래 셋 중 하나로 적은 fixture (`chart/__tests__/ztdCoverage.fixture.ts`) 를 만든다. 분류되지 않은 key 가 있으면 테스트가 실패한다.

| 분류 | 기준                                                    | 예                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 채택 | encoding 채널 전부 · 데이터의 뜻이나 형태를 바꾸는 옵션 | §2 표                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 대응 | 같은 일을 하는 기존 prop · 기구가 있다                  | `height` · `width` → Layout / `format` · `unit` · `locale` → `valueFormat` 계열 (ADR-210) / `referenceLines` · `refLines` → ADR-217 / `legend` → `showLegend` · `legendPosition` / `animate` · `duration` · `easing` → 기존 animation 4 prop / `showLabels` → `showValueLabels` / `tooltip` → `showTooltip` / `ariaLabel` → `aria-label` / `xLabel` · `yLabel` · `dimensionLabels` · `labels` → `seriesConfig` 의 label · 축 제목 / `upColor` · `downColor` · `colorMode` → paint 역할 (§5.1, 임의 CSS 색은 받지 않는다) / `xType` → `dimensionScale` (ADR-216) |
| 제외 | ztd runtime 고유 기구 — 종류의 정의가 아니다            | `canvasThreshold` · `maxPoints` · `maxCandles` (표시 예산 ADR-211 이 맡는다) · `stagger` · `animateOnView` · spring easing · `description` 자동 문장 · `hidden` · `jitter` · ChartCard (`subtitle` · `takeaway`) · CLI/MCP/JSON spec                                                                                                                                                                                                                                                                                                                            |
| 결정 | 공통 상호작용 — 사용자 결정 1: 포함 (Phase 6)           | `highlight` · `annotations` (band · line · event · forecast · trend · weekends) · `brush` · `syncId` · `signColors` · `baseline`                                                                                                                                                                                                                                                                                                                                                                                                                                |

## 4. 구조

### 4.1 type 과 descriptor

- `ChartType` 유니온과 `CHART_TYPES` 에 27 값을 더한다 (`types.ts:18` — `satisfies` 가 목록 누락을 막는다).
- `ChartDescriptor` (`authoring.ts:33`) 는 지금 「chartType 당 1」 이다. `paletteId` 를 제공 id 로 바꿔 36 행으로 만들고 `family` · `roles` 를 더한다. donut · radialBar · bubble 은 chartType 이 같고 `defaults` 만 다른 행이다. `getChartDescriptor(chartType)` 는 그 type 의 첫 행을 돌려주는 현재 뜻을 유지한다.
- `roles`: `{ prop, kind: "field" | "fields", required, accepts: "number" | "string" | "date" | "any" }[]`. 이것 하나에서 (a) 패널의 필드 지정 UI (b) family 의 입력 검증 (c) §4.5 의 전달 목록이 나온다.
- descriptor 에는 sample 행 · 계산 코드를 넣지 않는다 (첫 화면 번들).
- 패널 자리 (2026-11-12 「Property 탭 섹션 병합」 뒤): 필드 역할 prop (`goalField` · `rowField` · `pathFields` …) 은 기존 데이터 매핑과 같은 `section: "collection"`, 종류의 모양 · 옵션 (`shape` · `bands` · `cells` …) 은 Content 에 둔다. 숫자 옵션의 범위 (`min` · `max` · `step` · `unit`) 는 binding 에 적는다 (`a6f8f38fd` — 슬라이더 범위는 catalog 값).

### 4.2 family 계약

```ts
// packages/rendering/src/chart/families/types.ts
export type ChartFamilyId =
  "category" | "kpi" | "distribution" | "matrix" | "network";

export interface ChartFamily {
  id: ChartFamilyId;
  /** 순수 · 동기. 원본 행을 직접 읽는다 — resolveChartModel 의 시리즈 격자를 지나지 않는다. */
  buildScene(
    props: ChartProps,
    rows: readonly ChartRow[],
    size: ChartSize,
    metrics: ChartMetrics,
  ): ChartScene;
  /** 새 차트의 기본 행. */
  sample(type: ChartType): readonly ChartRow[];
}
```

- family 안의 단계는 `검증 → 모델 (통계 · 집계 · 배치 입력) → 예산 → 기하` 순서로 고정한다. memo 는 둘로 나눈다. **크기 독립 모델** (값 집계 · 분위수 · bin · KDE · 계층 합 · 그래프 구성과 노드 값) 은 `rows` 참조 + 뜻을 바꾸는 prop 이 키다 — 리사이즈가 이 단계를 다시 돌리지 않는다. **크기 의존 배치** (sankey 열 배치 · 충돌 해소 · relaxation, treemap squarify, beeswarm 충돌 회피, 라벨 솎기) 는 여기에 plot 크기 · metrics · 간격 prop (`nodeWidth` · `nodePadding` · `dotRadius` …) 을 더한 키다 — 크기가 바뀌면 다시 계산한다. ztd `sankeyLayout` 은 `width` · `height` · px 간격으로 배치하므로 (`layout/sankey.ts:52-147`) 이전 좌표를 비율로 늘려 쓰지 않는다. 두 소비자는 같은 배치 결과를 읽는다.
- category family 만 `buildSeriesGrid` (`series.ts:118`) 를 가져다 쓴다. 나머지는 격자를 쓰지 않는다 (본문 F4).
- 통계 · 배치는 ztd `layout/stats.ts` · `hierarchy.ts` · `sankey.ts` · `chord.ts` · `stack.ts` · `data/percentile.ts` 를 이식한다. 파일 머리에 출처 · commit · MIT 고지를 적는다. React · DOM 의존은 원본에도 없다.
- 상태는 scene 으로 표현한다: 입력 오류 → 기존 `diagnostics` + `CHART_INVALID_SETTINGS_TEXT`, 행 0 → `empty`, 예산 초과 → 진단 (`budget.*`) 과 함께 **집계된** 표시. 잘린 표본으로 분위수를 내지 않는다.

### 4.3 등록과 로드

```ts
// packages/rendering/src/chart/families/registry.ts
export function chartFamilyOf(type: ChartType): ChartFamilyId | null; // null = 기존 7
export function getChartFamily(id: ChartFamilyId): ChartFamily | undefined; // 동기
export function loadChartFamily(id: ChartFamilyId): Promise<ChartFamily>; // 진행 중이면 같은 promise · 실패하면 다음 호출이 다시 시도
export function subscribeChartFamilies(listener: () => void): () => void;
export function chartFamilyEpoch(): number; // 로드될 때마다 +1
```

- `computeChartScene` 의 맨 앞: `chartFamilyOf(type)` 이 있으면 `getChartFamily` → 있으면 `buildScene`, 없으면 `pending: true` 인 빈 scene (안내 글자 없음 · 상자만). 기존 7종의 경로는 한 줄도 바뀌지 않는다.
- **Canvas**: `chart_scene` (`skiaPrimitives.ts:2798`) 은 로드를 시작하지 않는다. Chart 의 rule 채널을 싣는 Builder scene-node 층 (`catalogRuntime/ruleShapes.ts:565` — `_chartRule`) 이 family type 을 보면 `loadChartFamily` 를 부른다. 행은 resolver 가 `props.data` 로 싣는다 (`resolution/resolver.ts:2496` — bound Chart 의 records). resolver 는 Preview · Publish 도 지나는 공용 순수 함수라 로드를 걸지 않고, `_chartRows` 는 `chart_scene` 이 읽기만 하고 쓰는 곳이 없다 (2026-11-15 재대조 — 승인 시점에도 같았다). composition root 가 `subscribeChartFamilies` 로 완료를 받아 그 family 의 Chart 노드를 무효화한다. Chart 계산 결과를 잡는 memo 의 키에 `chartFamilyEpoch()` 를 넣는다 (메모리 `feedback-memo-key-needs-async-readiness` · `feedback-canvas-binding-new-invalidation-needs-seed` — 새 무효화는 seeds 에도).
- **DOM**: `Chart.components.tsx` 가 `useSyncExternalStore(subscribeChartFamilies, chartFamilyEpoch)` 로 준비를 읽고 effect 에서 `loadChartFamily` 를 건다. 준비 전에는 기존 `RechartsRuntime` lazy fallback 과 같은 상자를 낸다. 실패는 기존 `role="alert"` + 다시 시도.
- chunk: family 5 개가 각각 dynamic import 대상이다. Canvas 와 DOM 이 같은 chunk 를 받는다 (Builder 는 Preview iframe 과 번들이 달라 각자 1회).

### 4.4 생성 경로

- 지금은 `componentCatalog.ts:501` 이 `createChartInitialProps(type)` 결과 (sample 행 포함) 를 정적으로 싣는다. 새 27 type 의 sample 을 여기 두면 첫 화면 번들에 들어간다.
- 새 type 의 `creationVariants` 는 `data` 없는 initialProps 를 두고, 팔레트 삽입이 **명령을 실행하기 전에** `loadChartFamily` 를 기다린 뒤 `family.sample(type)` 을 채워 한 번의 명령으로 넣는다. 명령 · store action 은 동기 그대로다 (메모리 `feedback-store-action-async-dialog-breaks-sync-callers`). AI · 붙여넣기 등 다른 생성 경로는 `data` 가 없으면 빈 상태 scene 을 보인다.
- 종류 전환 (Properties 의 type 변경): 행은 그대로 두고, 새 type 의 필수 role 중 기존 지정으로 채워지지 않는 것은 비워 둔다 → 패널이 지정을 요구하고 scene 은 설정 오류 상태. 첫 숫자 열로 자동 대체하지 않는다.

### 4.5 prop 전달 — 목록 하나

지금 같은 prop 목록이 세 곳에 손으로 적혀 있다: `Chart.binding.ts` `propPassthrough` · `Chart.components.tsx` 의 destructure · `skiaPrimitives.ts:2743` `CHART_PRESENTATION_KEYS` + 개별 대입. 새 prop 40여 개를 세 곳에 손으로 더하지 않는다.

- `rendering/chart` 에 `CHART_FAMILY_PROP_KEYS` (descriptor `roles` + 옵션 key 에서 만든 배열) 를 두고 세 곳이 그것을 읽는다. 기존 prop 의 개별 대입은 건드리지 않는다.
- 정적 테스트: `accepts` 의 Chart key 집합 = 기존 목록 ∪ `CHART_FAMILY_PROP_KEYS`.

## 5. scene 확장

### 5.1 paint 역할

`RectMark` · `PathMark` 의 `fillSeries` / `strokeSeries` 옆에 `fillRole` / `strokeRole` 을 더한다 (`LineMark.role` 과 같은 규약).

| 역할                    | 쓰는 곳                               | rule `Chart.chart` 채널 (새 key)                      |
| ----------------------- | ------------------------------------- | ----------------------------------------------------- |
| `accent`                | 강조 항목 · 상승 캔들 · 임계 초과 bin | `{color.chart-accent-1}` (기존 토큰)                  |
| `neutral`               | 비강조 · 하락 캔들 · 트랙             | `others` (기존)                                       |
| `positive` · `negative` | waterfall 증감                        | `positive` · `negative` — 토큰은 ADR-302 의 두 축에서 |
| `step-0` ~ `step-4`     | heatmap · calendar 의 값 단계         | `scale: [빈 칸, chart-accent-1 ~ 4]`                  |

- 연속 색을 보간하지 않는다. 값은 5 단계로 양자화하고 두 소비자가 같은 토큰을 푼다 — `color-mix` 나 float 보간 같은 두 번째 색 계산식을 만들지 않는다. 단계 경계 (등간격 · 분위) 는 family 모델이 정한다.
- 새 토큰이 필요하면 theme 쪽 (ADR-302) 에 더한다. 차트 코드에 hex 를 두지 않는다.
- skyline 의 빗금은 `PathMark` 여러 개 (선 묶음) 로 그린다 — pattern fill 을 새 mark 종류로 만들지 않는다.

### 5.2 hover 대상

- scene 에 `targets?: { id; x; y; r?; rect?; rows: number[] }[]` 를 더한다. `id` 는 family 가 정하는 뜻 단위 (점 · 칸 · 노드 · 링크), `rows` 는 원본 행 인덱스다. Canvas 는 읽지 않는다 (기존 `tooltip` 과 같은 규약 — `types.ts:508`).
- DOM host 는 scatter 의 가장 가까운 점 탐색 (`RechartsChart.tsx:1325`) 을 `targets` 로 일반화한다. 키보드 이동은 `targets` 배열 순서를 따른다. scatter 가 지금 키보드를 지원하는지는 Phase 0 에서 확인하고, 없으면 host 일반화 때 같이 얻는다.

### 5.3 DOM host

- `RechartsChart` 에 분기 하나: `chartFamilyOf(type)` 이 있으면 scatter 와 같은 틀 — `ScatterChart` container · 숨긴 숫자 축 2 · `Customized` 안에 `renderMark` (`chart/svgDecorations.tsx`) 로 scene 의 `marks` · `axes` · `legend`. 축 없는 종류도 같은 host 다 (container · tooltip 표면 · aria 를 한 벌로).
- 진입 animation: scene mark 는 Recharts 의 animation 대상이 아니다. host 가 `isAnimationActive` · `animationDuration` · `animationEasing` 을 읽어 CSS 로 한 번 나타내고 `prefers-reduced-motion` 에서 끈다. ztd 의 종류별 움직임 (count-up · 순차 등장) 은 재현하지 않는다.
- 같은 내용의 행 재전송은 기존 직렬화 키 안정화 (`Chart.components.tsx` `valueFieldsKey` 선례) 를 새 배열 prop 에도 적용한다.

## 6. size 제거

지우는 곳 (본문 F5):

| 파일                                                                      | 내용                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared/src/catalog/bindings/Chart.binding.ts`                   | `accepts.size` (616) · `propPassthrough` 의 `"size"` (671) · 머리말 주석                                                                                                                                                                           |
| `packages/shared/src/components/Chart.components.tsx`                     | `size = "M"` · `sizeKey` · `data-size`                                                                                                                                                                                                             |
| `packages/rendering/src/renderers/skiaPrimitives.ts`                      | `props.size` → `sizeKey` (2785)                                                                                                                                                                                                                    |
| `packages/rendering/src/chart/computeChartScene.ts`                       | `resolveChartMetrics(channel, sizeKey, style)` → `(channel, style)` · `ChartRuleChannel.metrics` 를 한 벌로                                                                                                                                        |
| `packages/rendering/src/chart/authoring.ts`                               | `createChartInitialProps` 의 `size: "M"` (251) 과 반환 타입의 `size` (229). 생성 style `width: 320` 은 2026-11-13 에 지웠다 (`69d125406`)                                                                                                          |
| `apps/builder/.../ChartBudgetControls.tsx` · `useChartPropertyExtras.tsx` | `sizeKey` · 의존 목록의 `"size"`                                                                                                                                                                                                                   |
| `componentRulesTable.ts` `Chart`                                          | `sizes.S` · `sizes.L` 삭제 (M 은 rule 타입이 요구하는 기본 한 벌로 남는다) · `chart.metrics` → `{ padding: 12, fontSize: 11 }`. 단계별 높이 삭제 · 상자 `minWidth: 320` · `aspectRatio: "16 / 9"` 는 2026-11-13 에 적용했다 (`69d125406`, 본문 F9) |
| `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` | typed Chart 원본의 `"size": "M"` (6177) — 파일 머리말이 적은 생성 경로 (`phase3ReusableOriginTemplates.test.ts`) 로 고친다                                                                                                                         |
| `packages/shared/src/components/Chart.runtime.ts`                         | 공개 타입 `size?: "S" \| "M" \| "L"` (85)                                                                                                                                                                                                          |
| `packages/shared/src/catalog/document/types.ts`                           | `LIBRARY_CONTRACT_VERSION` 을 착수 시점의 다음 번호로 + 주석                                                                                                                                                                                       |
| 생성 CSS                                                                  | `pnpm build:specs` 로 재생성 — Chart S/L 선택자 0                                                                                                                                                                                                  |

- 다른 컴포넌트의 `size` · 내부 `ChartSize {width,height}` 는 대상이 아니다. 검색 치환하지 않는다.
- `accepts` 에 없는 prop 은 무시되지 않는다 — 원본은 `library.ts:356`, 문서는 `graph.ts:1855` 가 `PROP_NOT_ACCEPTED` 로 거부한다. 그래서 위 표의 원본 수정이 빠지면 라이브러리 구성 자체가 실패한다. Phase 1 은 한 커밋이다.
- contract: 원본이 바뀌므로 `LIBRARY_CONTRACT_VERSION` 을 착수 시점의 다음 번호로 올린다 (`types.ts:166` + 머리말 주석 한 줄 — 2026-11-15 현재 66 이라 67. ADR-310 도 올리므로 main 에 먼저 들어가는 쪽이 앞 번호, 나중 쪽은 rebase 때 그 다음 번호). 그 전 번호의 문서는 Chart 유무와 무관하게 전부 `UNSUPPORTED_LIBRARY_CONTRACT` 로 거부된다 (`graph.ts:597`) — 변환 · 원본 보존 · 사본 저장 절차는 없다. Phase 2 이후의 새 prop 은 `accepts` 가산이라 Phase 1 번호의 문서가 그대로 유효하다 — 원본 template 이 다시 바뀔 때만 올린다.
- 기존 실패 테스트 2건 (`size="L"` → `data-size`) 은 size 없는 계약으로 고치고 그 뒤의 assertion 은 남긴다.

## 7. 검증

### 7.1 손계산 fixture (외부 oracle)

| 입력                                                               | 정답                                           |
| ------------------------------------------------------------------ | ---------------------------------------------- |
| box · histogram: 그룹 A 표본 `[1, 9]`                              | n 2 · 중앙값 5 (격자 합산이면 10 — 원복 RED)   |
| gauge: 값 42 · `valueMax` 100                                      | 42 % (자동 domain 이면 `[0,50]` 의 84 %)       |
| candlestick: 같은 기간 `(10,14,8,12)` · `(12,18,11,15)` 를 합칠 때 | `(10,18,8,15)` · volume 은 합                  |
| waffle: 38 · 33 · 29, `cells` 100                                  | 칸 합 100 (반올림 뒤에도)                      |
| pareto                                                             | 마지막 누적 100 %                              |
| treemap                                                            | 칸 면적 합 = plot 면적 · 부모 = 자식 합        |
| sankey                                                             | 노드 값 = max(들어옴, 나감) · 순환 입력은 진단 |
| calendar: 2024-02-29 · 주 시작 0/1                                 | 윤일 칸 위치 · timezone 과 무관                |

- 차등 oracle: 통계 · 배치 수치는 pinned ztd 의 순수 함수 출력을 JSON 으로 고정해 비교한다 (dev 전용 fixture — ztd 를 의존성으로 두지 않는다). 좌표는 theme · padding 이 달라 비교하지 않는다.
- 분포 · 규모 입력은 합성물이다 — 규모 (요소 수 · 시간) 에만 쓰고 분포를 근거로 인용하지 않는다 (`measurement-validity.md` Q1).

### 7.2 두 소비자 일치 (G3)

- 기존 Chromium chart 테스트 (`packages/shared/src/components/chart/*.browser.test.tsx`) 의 방식으로 host 가 그린 요소의 `getBoundingClientRect` 를 scene 좌표와 비교한다. Canvas 쪽은 `chart_scene` 이 낸 Shape 좌표를 같은 scene 과 비교한다 — 둘 다 scene 을 「복사만」 하는지 본다.
- 상자: 320×240 · 640×360 (sparkline 은 160×48). light/dark. 음수 · 0 · 결측 · 항목 1 · 긴 한국어 라벨.
- live: family 마다 대표 1종을 Builder · Preview · Publish 에서 `/cross-check`.

### 7.3 번들 · 규모

- `adr209-bundle-closure.mjs` 로 Builder · Preview 의 initial closure 와 family chunk 를 따로 잰다. 같은 기계 · 별도 worktree 기준선.
- 규모 fixture (통과 조건이 아니라 진단 · 예산 숫자를 정하는 입력): scatter/bubble 10,000 점 · heatmap 10,000 칸 · histogram 20,000 표본 · sankey 100 노드 300 링크 · treemap 1,000 잎 · candlestick 2,000. 각 family 의 예산 key 는 rule `chart.budget` 에 더한다.
- 성능은 불리한 경우를 잰다: family 미로드 첫 열기 · 리사이즈 연속 (크기 독립 모델 재계산 0 · 크기 의존 배치는 크기마다 1회) · 데이터 교체.

## 8. Phase

각 Phase 는 커밋 가능한 상태로 끝나고 live 1회를 포함한다.

| Phase | 내용                                                                                                                                                                                                                                                                                                         | 끝 조건      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| 0     | §3 분류 fixture · 번들 기준선 · 선행 실패 3건 (size 2 · bar path 문자열 1) 재현과 원인 · scatter 키보드 현황 · `visibleWhen` 이 chartType 목록 조건을 표현하는지 · root script `test:chart-contract` 를 만들어 `codex:preflight` 사슬에 연결                                                                 | G0           |
| 1     | §6 size 제거 (원본 · contract 올림 포함, 한 커밋) · 실패 2건 수리 · CHANGELOG (Breaking)                                                                                                                                                                                                                     | G1           |
| 2     | §4 기반 (type 27 · descriptor 36 · registry · 로드 · 생성 경로 · 전달 목록) + §5 (paint 역할 · targets · DOM host) + **kpi family 3종** 으로 끝까지 (gauge · bullet · dumbbell) · 패널의 역할 기반 필드 지정 · 번들 실측 뒤 상한 두 곳 (`adr201-bundle-gate.mjs:29` · `deploy.yml:93`) 을 같은 커밋에서 갱신 | G2 · G3 · G4 |
| 3     | category family 12                                                                                                                                                                                                                                                                                           | G3 · G4      |
| 4     | distribution 4 + matrix 4                                                                                                                                                                                                                                                                                    | G3 · G4      |
| 5     | network 4 + 기존 9 항목 보강 (§2.1) → 36/36 census                                                                                                                                                                                                                                                           | G3 · G4 · G5 |
| 6     | (사용자 결정 1 — 포함 확정) `highlight` · 주석 5종 · 범위 선택 · 동기화 — 범위 선택은 runtime 상태이고 저장하지 않는다. 동기화는 같은 페이지의 같은 `syncId` 끼리 domain 값을 나눈다                                                                                                                         | G5 재실행    |

- Phase 2 가 kpi 를 같이 끝내는 이유: 기반만 만들고 닫으면 로드 · 전달 · host 가 실제 종류로 검증되지 않는다. kpi 는 가장 작고 (3종 · 통계 없음) 격자를 쓰지 않는 첫 family 다.
- 영향 파일: `packages/rendering/src/chart/` (types · authoring · computeChartScene · `families/*` 신규) · `packages/rendering/src/renderers/skiaPrimitives.ts` · `packages/shared/src/catalog/bindings/Chart.binding.ts` · `componentCatalog.ts` · `generated/componentRulesTable.ts` · `d2Provenance.ts` · `packages/shared/src/components/Chart.components.tsx` · `chart/RechartsChart.tsx` · `apps/builder/src/builder/catalogRuntime/ruleShapes.ts` · `panels/properties/` 의 Chart 파일 (2026-11-15 현재 14 — `Chart*Controls` · `useChartPropertyExtras` · `chartFieldOptions` · `chartPresentationPatch`) · 팔레트 삽입 경로.

## 9. 첫 판에서 바뀐 것

| 첫 판                                                                                               | 재작성                                                     | 이유                                                                                                           |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| contract N → N+1 문서 변환 · 원본 보존 · 사본 저장 · 멱등성 (§5.2 · G1 · R3 · 사용자 결정 1)        | 전부 삭제. 원본에서도 지우고 contract 64 — 63 문서는 거부  | 저장소 정책 (`types.ts:158` 「refused, never re-mapped」) 과 사용자 지시 (2026-10-14 변환 코드 금지) 에 어긋남 |
| 「Recharts 기본 컴포넌트를 쓸 수 있으면 쓰고 아니면 custom SVG」                                    | 새 종류는 전부 Recharts scene host                         | Recharts 내부 배치를 Canvas 가 공유할 수 없다. scatter 선례가 이미 host 구조다                                 |
| 「의미 모델 10종 · 공유 계산층」 (이름만)                                                           | family 5 · `ChartFamily` 계약 · 격자 우회 지점 · 등록 API  | 무엇을 만드는지가 없었다                                                                                       |
| 지연 로드 「준비 경계」 (추상)                                                                      | 로드를 거는 곳 · 무효화 · memo 키 · 생성 경로의 await 위치 | Canvas 계산이 동기 · 정적 import 이고 첫 화면 여유가 2 ~ 3 KB 다                                               |
| 옵션 「direct · mapped · composed · out-of-scope」 를 Phase 0 에 미룸                               | 채널 → prop 표 (§2) 와 분류 기준 · 예 (§3) 를 지금 확정    | 범위가 설계에 없었다                                                                                           |
| 연속 색 · pattern · 대체 데이터 표 · Worker · 새 `codex:chart` gate · pre-push 기구 · 성능 p95 수치 | 단계 토큰 · path 빗금. 나머지는 삭제                       | 요청에 없는 기능 · 근거 없는 수치 · 저장소에 없는 집행 수단                                                    |
| 사용자 결정 1 = 구 S/L 외관 보존 방식                                                               | 사용자 결정 1 = 공통 상호작용 포함 여부 · 2 = 번들 상한    | 변환이 없으니 물을 것이 없다. 실제로 갈리는 것은 범위와 번들이다                                               |
| Phase 0 ~ 7 · G0 ~ G6                                                                               | Phase 0 ~ 6 · G0 ~ G5                                      | 변환 Phase · 통합 전용 Phase 가 사라짐                                                                         |
