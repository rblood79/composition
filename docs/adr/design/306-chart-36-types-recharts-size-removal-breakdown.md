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

## 10. 기록

### Phase 0 — 2026-11-15 (G0 닫힘)

- **분류 census**: ztd 0.5.0 `3c4376c` 를 scratchpad 에 받아 실행하지 않고 원본 텍스트에서 key 만 옮겼다 (`chart/__tests__/ztdRegistry.pinned.ts` — 36 항목 · 공통 17 · 항목별 채널 · 옵션). 분류는 `ztdCoverage.fixture.ts` 가 따로 적는다 (`adopt` → Chart prop · `map` → 기존 prop · `exclude` 사유 · `decision` = 사용자 결정 1). `ztdCoverage.test.ts` 41 — 분류 누락 · 원본에 없는 분류 · 채널의 비채택 · family 수 (12 · 3 · 4 · 4 · 4) 를 막는다. 원복 RED: scatter `jitter` 분류 1 줄 삭제 → RED.
- **§2 표에 없던 채택 (분류 때 정함)**: funnel `rateLabel` · heatmap `legendLabels` · 여러 종류의 `zero` → `includeZero` (dumbbell 의 이름으로 통일) · waffle `summaryLabel` → `centerLabel`. 제외로 정한 것: gauge `ticks` (상자 크기가 정함) · waffle `summaryNote` (ChartCard 류 문장) · scatter `hidden` · `jitter`. 공통 상호작용 (사용자 결정 1) 에 line · area 의 `bandFrom` · `outside` 와 sparkline `mark` 를 넣었다 (주석 · 강조와 같이 Phase 6).
- **집행**: root `test:chart-contract` (`pnpm -F @composition/rendering exec vitest run src/chart`, 0.5 s) · `scripts/codex/chart-contract-gate.sh` · `codex:preflight` 사슬 (css-boundary 뒤).
- **번들 기준선** (HEAD `ba5b7f5dc`, 같은 기계, `turbo build` + `adr209-bundle-closure.mjs`): Builder 1,545,850 · Preview 152,370 B gzip. Builder 는 상한 1,414,000 을 이미 넘는다 (ADR-308 CHANGELOG 의 「착수 전 HEAD 부터 1,522,678 — 원인 미조사」 와 같은 상태 · initial closure 에 `AIPanel` chunk). 사용자 결정 2 (종류 목록 · 등록 기구 몫의 상한 재승인) 는 이 초과분을 덮지 않는다 — Phase 2 의 Δ 판정은 before/after 차이로 하고 절대 상한 초과는 ADR-201 쪽 사용자 결정으로 보고한다.
- **선행 실패 3**: chart · chart-a11y project 의 `data-size="lg"` 기대 2 (같은 테스트 · 두 project) · bar `animation=true` 재전송 동일성 1 — Recharts 3.10.1 은 진입 animation 의 마지막 프레임을 보간 float 로 남기고 같은 rows 재전송 뒤 정적 path 는 반올림 값을 낸다 (최대 ≈3e-5 px, 보이지 않음). 원인이 테스트 oracle 의 문자열 비교라 Phase 1 에서 0.01 px 반올림 비교로 고쳤다 (animation 재시작은 px 단위로 움직여 여전히 잡힌다).
- **scatter 키보드**: 없다 — `RechartsChart.tsx` 의 scatter 는 hit 층의 `onPointerMove` 로만 tooltip 을 연다 (Recharts `accessibilityLayer` 는 container 에 있지만 scatter 에는 Recharts 그래픽 항목 · Tooltip 이 없다). §5.2 대로 Phase 2 host 의 `targets` 일반화 때 같이 얻는다.
- **`visibleWhen`**: `VisibilityCondition.oneOf` 로 chartType 목록 조건을 이미 쓴다 (`Chart.binding.ts` 여러 곳). 그러나 `PropContract.options` 는 정적이라 `shape` 의 chartType 별 값 집합은 한 prop 으로 표현되지 않는다 — Phase 2 에서 (a) chartType 별 옵션 조건을 `PropContract` 에 더하거나 (b) 합집합 options + 검증으로 판단한다 (통상 구현 판단).

### Phase 1 — 2026-11-15 (G1 닫힘)

- **삭제**: §6 표 전부 + 원본 생성 경로 — 머리말이 적은 `phase3ReusableOriginTemplates.test.ts` 생성기는 이미 없어 typed 원본 `"size": "M"` 한 줄을 직접 지웠다 (머리말은 낡음). `resolveChartMetrics(channel, sizeKey, style)` → `(channel, style)`, `ChartRuleChannel.metrics` · `ComponentRuleChart.metrics` 는 `{ padding, fontSize }` 한 벌. rule `Chart.sizes` 는 M 하나 (생성 CSS 는 기본 size 블록을 루트에 내고 `[data-size]` 블록 0).
- **contract 68**: ADR-310 Phase 2 가 67 을 먼저 썼다. 테스트의 contract 숫자 고정값 34 파일을 68 로 (310 과 같은 방식).
- **회귀 수리 2**: `componentRulesTable.static.test.ts` 의 Chart 글자 리터럴 분류 (`chart.metrics.S/M/L` → `chart.metrics` 11) · `chartBudgetSize.test.tsx` (예산 컨트롤이 size 를 받는다 → 받지 않는다).
- **G1 테스트**: `packages/shared/src/catalog/document/__tests__/adr306ChartSize.test.ts` 11 — contract 68 · 원본에 size 0 · 67 문서 `UNSUPPORTED_LIBRARY_CONTRACT` · 68 문서의 Chart `size` `PROP_NOT_ACCEPTED` · binding · rule · 생성 CSS · DOM 소스에 size 축 0 · 기존 7종 scene = 옛 M metrics (padding 12 · 글자 11, 손으로 적은 값) 의 scene. 원복 RED: binding 에 `size` 를 되돌리면 2 RED.
- **검사**: type-check PASS · `codex:preflight` PASS (chart-contract 514) · rendering `src/chart` 514 · Chart browser chart + chart-a11y 382/382 · shared · rendering · builder unit 의 남은 실패는 Chart 무관 선행 (Tab · TabPanel 원본 · archetype · border 리터럴 · icon registry — 실패 본문에 Chart · size · contract 언급 0, HEAD 단독 재실행 대조는 하지 않음) · `docs:stale-symbols` 0.
- **번들 Δ** (같은 기계, 기준선 대비): Builder −197 · Preview −18 B (G1 Δ ≤ 0).
- **세로 flex 비율 (F9)**: 2026-11-13 `69d125406` 의 회귀 (`authoredAspectRatio.test.tsx` · `phase4Layout.test.tsx`) 가 builder unit 에서 그대로 PASS — 이 Phase 는 상자 값을 바꾸지 않았다.
- **live**: 본문 `### Live Exercise`.
- **Breaking**: contract 67 이하 문서는 열리지 않는다 (사용자 Builder 의 기존 프로젝트 포함 — 열지 않았다).

### Phase 2 — 2026-11-16 (G2 · G3 · G4 kpi 닫힘)

- **기반**: `ChartType` = `SeriesChartType` (기존 7) ∪ `FamilyChartType` (27) · `SERIES_CHART_TYPES` · `CHART_FAMILY_OF` (`satisfies` 로 27 고정) · `chartFamilyOf` · `isFamilyChartType` (type guard — 기존 7 의 `assertNever` 분기를 좁힌다). 시리즈 검증 (`resolveChartPresentation` 의 `chartType.unsupported`) 과 예산 지원표는 시리즈 7 만 본다. `computeChartScene` 맨 앞의 family 분기 — 로드됐으면 `buildScene`, 아니면 `pending` (상자만), 이 build 에 chunk 가 없으면 설정 오류 `chartFamily.unavailable`. 기존 7 종 경로 무변경 (rendering `src/chart` 514 그대로 PASS).
- **registry** (`families/registry.ts`): `loadChartFamily` (진행 중 같은 promise · 실패는 기록 후 다음 호출이 다시 시도) · `getChartFamily` · `subscribeChartFamilies` · `chartFamilyEpoch` (로드 · 실패마다 +1) · `chartFamilyAvailable` · `chartFamilyError`. 로더는 `import("./kpi")` 하나 (나머지 family 는 Phase 3 ~ 5). 진입점 · scene · 생성 경로가 kpi 를 정적으로 import 하지 않는다는 소스 검사를 같이 둔다.
- **paint 역할 · targets**: `RectMark.fillPaint` · `fillOpacity` · `PathMark.fillPaint` · `strokePaint` · `LineMark.paint` · `width`. **이름 편차**: §5.1 은 `fillRole` / `strokeRole` 이었지만 `PathMark.fillRole` 이 이미 `LineRole` (축 · 격자 토큰) 이라 뜻이 섞인다 — 새 축은 `*Paint` 로 두었다. rule `Chart.chart.paint` (accent · neutral · positive · negative · step-0 ~ 4) → 생성 CSS `--chart-paint-<role>` · Skia `chartPaintToken` (없는 키는 `CHART_PAINT_FALLBACK_TOKENS`). 불투명도 기본 1 (두 consumer 같음). `ChartScene.targets` (`id` · 기준점 · rect / r · 원본 행 · 제목 · 줄) — Canvas 는 읽지 않는다.
- **kpi family** (`families/kpi.ts` + `fields.ts` · `niceScale.ts` — ztd `scale.ts` 의 `niceStep` · `fitDomain` · `niceDomain` · `ticksFor` 이식, MIT 고지): gauge (첫 행 값의 `[valueMin, valueMax]` 비율 · 모양 arc 240° · semi 180° · ring 360° · ticks 눈금 · 목표 눈금 · 구간 경계 · 가운데 숫자 + `centerLabel`), bullet (행마다 `niceDomain(0, max(값 · 목표 · 구간), 4)` · 구간 띠 중립 3 단 불투명도 · 값 막대 accent · 목표선 · `independent: false` 공용 축), dumbbell (`fitDomain(min, max, 4, { zero: includeZero, pad: 0.08 })` · 이후 값 정렬 · 결측 행 제외 · 범례 2 = 필드 이름). 예산: 행 상한 `rowCap` · 줄이 글자 1.6 줄보다 낮아지면 앞 줄만 + `budget.rowsTruncated` — 공용 축 상한은 잘리기 전 전체에서 (잘린 표본으로 축을 만들지 않는다). 진단: `role.missing` · `valueRange.invalid` · `bands.invalid` · `rangeFields.invalid` + 숫자 형식 진단은 시리즈와 같은 검증.
- **G4**: `families/__tests__/kpi.test.ts` 10 — 손계산 (식은 ztd, 값은 손으로: gauge 42 / 100 = 0.42 (자동 domain 이면 0.84) · bullet 상한 [40, 5, 20, 5] · dumbbell [1.36, 4.84] · `ticksFor` [2, 3, 4]) · 예산 초과 진단 + 공용 축 1,000 · 진단 4 종. **ztd 순수 함수 차등**: ztd 를 실행하지 않고 (Phase 0 과 같은 방침) 같은 식을 손으로 푼 값을 고정했다 — 이식 코드의 출력으로 기대값을 만들지 않았다. 원복 RED 3 (gauge 자동 domain → 1 실패 · bullet 상한 원값 → 3 · dumbbell 정렬 반대 → 1, 복원 cmp 일치).
- **전달 목록 하나 (R2)**: `CHART_FAMILY_PROP_KEYS` (descriptor `roles` + `options` 에서 기존 prop 을 뺀 12) 를 binding `propPassthrough` · DOM `splitFamilyProps` (`rest` 에서 떼어 div 속성으로 새지 않게) · Skia `pickChartFamilyProps` 가 읽는다. `adr306FamilyProps.test.ts` 5 — accepts 키 집합 = Phase 1 목록 ∪ 목록 · 세 소비자 · 역할 표 = accepts 의 collection 칸.
- **G3**: DOM — `adr306KpiHost.browser.test.tsx` 30 (kpi 3 × 320×240 · 640×360 × 표본 · 음수 · 0 · 결측 · 항목 1 · 긴 한국어 라벨 + targets 키보드) — host 가 그린 요소의 `getBoundingClientRect` · 속성 = scene (≤ 0.5 px, paint 변수). 원복 RED: DOM rect x + 1 → 20 실패 (rect 가 있는 bullet · dumbbell), 복원 cmp 일치. Canvas — `kpiSkia.test.ts` 4 (`chart_scene` 의 rect · path · line 좌표 = scene, paint 토큰 = rule, 로드 전 바탕 하나). dark 는 토큰 경로가 같아 따로 재지 않았다 (rule `paint` → CSS 변수 · Skia TokenRef, 테마는 토큰이 푼다).
- **G2 (준비 경계)**: 단위 — `registry.test.ts` 4 (로드 전 pending → 로드 뒤 실제 scene · 같은 promise · epoch · 실패 뒤 재시도 · 미구현 family 설정 오류 · chunk 경계 소스 검사). Canvas — `ruleShapes` 가 family 종류를 보면 `loadChartFamily` (실패가 기록돼 있으면 다시 걸지 않는다 — 실패마다 다시 그리고 다시 로드하는 반복을 막는다), `CatalogCanvas` 가 `subscribeChartFamilies` → `scene.chartFamilyLoaded()` → 다음 sync 에 `seedChartFamilyRecords` (bound Chart 중 family 종류만 dirty — 이미지 로드와 같은 길, rebind 없음). DOM — `Chart.components.tsx` 가 `useSyncExternalStore(subscribeChartFamilies, chartFamilyEpoch)` 로 준비를 읽고 effect 에서 로드, 준비 전 「Loading chart…」, 실패 「Chart failed to load」 + Retry. host 의 scene memo 키에 epoch.
- **생성 경로 (R5)**: `createChartInitialProps(family)` 는 `data: []` (sample 은 chunk). 팔레트 삽입 (`CatalogComponentsPanel`) 이 `completeChartCreationProps` 로 family 를 기다려 sample 행 · 역할 이름을 채운 뒤 명령 하나로 넣는다 (명령은 동기 그대로 · 실패는 toast `chart.familyLoadFailed`). Library 「Types」 표본은 기다릴 수 없어 `completeChartCreationPropsSync` (로드돼 있을 때만 채움).
- **패널**: field 역할 (goalField · startField · endField) 은 `CHART_FIELD_ROLE_KEYS` (descriptor 역할 표) 로 컬럼 Select 승격 · 선택 역할은 None 항목. binding `visibleWhen` — dimension 은 gauge 에서 숨김 · metric 은 dumbbell 에서 숨김 · color · labelKey 는 시리즈 7 만. family 종류에서는 시리즈 전용 컨트롤 (시리즈 원천 · 값 필드 · 범주 간격 · 기준선 · 시리즈 표 · 표시 예산) 을 내지 않는다 (live 에서 발견 → 수리). `shape` 의 options 는 gauge 값 하나뿐 (Phase 0 결론 — chartType 별 options 기구는 다음 family 가 `shape` 를 받을 때 정한다).
- **descriptor 편차**: §4.1 의 「descriptor 36 행」 대신 **10 행** (기존 7 + kpi 3). family chunk 가 없는 종류를 팔레트에 내면 넣자마자 설정 오류가 되므로 descriptor (팔레트 · 종류 Select · binding options) 는 그 family 의 Phase 에 더한다. 타입 · `CHART_FAMILY_OF` 는 27 전부 (Phase 2). donut · radialBar · bubble 프리셋 행은 §2.1 보강과 같이 Phase 5.
- **번들 (G2)** — 같은 기계, 기준선 = Phase 1 커밋 `8f9f2a1e8` 트리 (그 뒤 main 은 docs 커밋 하나): Builder **1,545,653 → 1,550,129 (+4,476)** · Preview **152,352 → 155,321 (+2,969)** gzip. kpi 계산 · sample 은 `kpi-*.js` 5,174 B (첫 화면 밖 — closure 의 initial 목록에 없음). 공용 chunk `pie-*.js` 9,450 B 는 원래 첫 화면에 있던 차트 공용 모듈을 kpi 와 나눠 쓰려고 떼어 낸 것 (분리 비용 chunk 당 0.2 ~ 0.5 KB). 사용자 결정 2 대로 Builder 상한을 이 몫만큼 **1,418,476** 으로 (`adr201-bundle-gate.mjs` · `deploy.yml` · ADR-201 재승인 절 · CLAUDE.md). Preview 는 여유 안 — 무변경. Builder 의 Phase 0 이전 초과 (≈ 131 KB) 는 범위 밖 그대로.
- **회귀 수리**: 팔레트 아이콘 표 (`ICON_MAP` 에 `ChartBarDecreasing` · `ChartNoAxesGantt` — 없으면 builder unit 36 파일 실패) · 팔레트 oracle · Layers 아이콘 테스트 (종류 7 → 10) · `rechartsRuntime.browser` 선택자 표 (시리즈 7 로) · `chartInteraction.browser` 재전송 (family 는 sample 을 기다리고 진입은 opacity 라 animation 축 없음) · `authoring.test` descriptor 수.
- **검사**: type-check PASS · `codex:preflight` PASS · rendering `src/chart` 532 (families 18 포함) · Chart browser chart + chart-a11y 434/434 · builder 패널 293 · shared · rendering · builder unit 의 남은 실패는 Phase 1 기록과 같은 Chart 무관 목록 (새 실패 0).
- **live**: 본문 `### Live Exercise`.
- **판독 1 회 (reviewer, 2026-11-16)** — CRITICAL 0 · HIGH 0 · MEDIUM 1 → 수리. (M) Value Columns 모드의 Chart 를 gauge · bullet 로 바꾸면 Value 칸 (`metric`, group 모드에서만 보임) 을 고를 길이 없었다 — family 는 모드 전환 컨트롤을 내지 않는다 → 종류 변경 patch (`chartTypeChangePatch`) 가 family 로 갈 때 `dataMode: "group"` 으로 되돌린다 (`chartTypeChangePatch.test.ts` 2, 원복 RED 1). LOW 중 손이 적은 둘도 수리: chunk 가 없는 family 를 DOM 이 「Loading chart…」 로 기다리던 것 → scene 의 설정 오류를 그린다 (Canvas 와 같은 결과) · dumbbell 범례가 `showLegend` 를 읽는다 (원복 RED 1). LOW deferred: Canvas 의 로드 실패는 Preview iframe 의 Retry 로 풀리지 않는다 (realm 이 다름 — Builder 안의 팔레트 삽입이나 다음 세션만 다시 로드, 주석 정정) · drag 중 family 로드 완료의 seed (이미지 seed 처럼 미루지 않음 — 재현 못함). 수리 검증: `codex:preflight` PASS · Chart browser 434/434 · 패널 301 · rendering `src/chart` 532 — HIGH 0 으로 Phase 2 닫힘 (실행자 선언). 수리 뒤 live 는 다시 돌리지 않았다 (패널 patch 는 순수 함수 · 범례 · DOM 대기는 단위 · browser 로 확인).
- **열린 항목 (Phase 3 앞)**: Canvas 로드 실패의 재시도 경로 (Builder realm) · Library page 의 Chart 「Types」 카드 — page 는 처음 열 때 저장되는데 그때 family 가 로드돼 있지 않으면 family 종류 카드에 행이 없다 (새 프로젝트만 — 기존 프로젝트의 Library 는 이미 저장돼 종류 카드가 늘지 않는다). 처음 열기 전에 family 를 기다리거나 로드 뒤 행을 채우는 sync 를 Phase 3 에 정한다.

### Phase 3 — 2026-11-16 (G3 · G4 category 닫힘)

- **category family 12** (`families/category/` — `common.ts` 상태 · 행 예산 · 값 축 · 범주 라벨 · 범례 · band / `bars.ts` lollipop · segmented · waffle · funnel · pareto · waterfall / `lines.ts` sparkline · stream · bump · slope / `blocks.ts` marimekko · skyline / `index.ts` 표본 · 역할 이름). 뜻 (정렬 기본 · 강조 · 비율 · 누적 · 전환율 기준 · 0 포함 · inside-out · wiggle) 과 배치 비율은 ztd 그대로, 글자 크기만 rule metric. 보조 식은 `families/shapes.ts` 로 이식 (`roundRectPath` · `dodgeVertical` · `stack` · `insideOut` · `ranks` · `allocateCells`, MIT 고지). 색 규약: 하나만 강조하는 종류 (lollipop · funnel · pareto · bump · slope · sparkline) 는 paint 역할 accent / neutral, waterfall 증감은 positive / negative (합계 accent), 항목마다 색이 필요한 종류 (segmented · waffle · marimekko · stream · skyline) 는 시리즈 팔레트. stream · bump · skyline 은 시리즈 격자 (`buildSeriesGrid`) 를 지난다 (§4.2 — category 만 격자 사용).
- **편차 3**: (1) stream 의 기준선 prop 은 `offset` 이 아니라 **`streamOffset`** — Popover · TooltipTrigger 의 `offset` (overlay) 과 섹션이 갈려 `propSectionConsistency` 가 막았다 (prop key 하나는 모든 컴포넌트에서 같은 분류). ztd 분류 fixture 도 `offset → streamOffset`. (2) waterfall `endTotal` 은 ztd 의 「문자열이면 이름」 대신 boolean (이름은 `Total`) — 패널 칸 하나로. (3) ztd 의 칸 안 글자 (segmented 비중 · marimekko 비중 · stream 계열 이름) 는 내지 않았다 — scene 글자는 역할 색 (`currentColor` · 축 토큰) 이라 진한 칸 위에서 읽히지 않는다. 값은 목록 · 툴팁 · 범례로.
- **Phase 0 결론의 `shape` 판단**: (a) 를 택했다 — `PropContract.options[]` 에 선택적 `visibleWhen` 을 더하고 패널이 `withVisibleOptions` 로 거른다 (gauge 4 · segmented 2 · sparkline 3). 저장 값 검증은 합집합 그대로 (숨긴 항목도 유효).
- **binding 조건 파생**: family prop 의 `visibleWhen` 은 descriptor 역할 · 옵션 표에서 (`chartTypesReading`) — 손으로 적은 종류 목록 0. 기존 prop 중 category 가 읽는 것 (`orientation` · `curve` · `showTotal` · `dimension` · `metric` · `color`) 은 같은 표로 넓혔다. `CHART_FAMILY_PROP_KEYS` 는 ADR-306 전부터 있던 prop 을 빼고 만든다 (kpi 12 + category 21 = 33 키).
- **원천 모드**: 값 필드 목록을 읽는 family (descriptor `columns` — stream · slope · skyline) 는 Collection 에 원천 모드 · 값 필드 컨트롤을 내고, 종류 변경 patch 가 columns 를 group 으로 되돌리지 않는다. 선택 역할 (None 항목) 은 종류별 (`optionalFieldKeys` — sparkline Category · bump Value 는 선택, bar Category 는 필수).
- **Phase 2 열린 항목 2 닫음**: (1) Canvas 로드 실패 재시도 — `ensureChartFamily` 가 실패 뒤 15 초 (`CHART_FAMILY_RETRY_MS`) 가 지나 그 Chart 를 다시 그릴 때 다시 로드 (실패마다 즉시 다시 거는 반복은 막음). Preview iframe 의 Retry 는 여전히 다른 realm. (2) Library Types 카드 — **처음엔 view 를 다시 세우는 수리 (`fillChartSamples`) 를 넣었으나 live 에서 FAIL**: Types 카드는 처음 열 때 저장되는 문서 노드라 로드 뒤 view 를 다시 세워도 바뀌지 않는다. → `openComponentsView` 가 저장 전 family 를 기다린다 (그 사이는 view 로만 그림, 기다린 뒤 한 번만 — 실패한 family 는 빈 카드로 저장). 이미 행 없이 저장된 기존 프로젝트의 카드는 그대로다 (마이그레이션 코드 금지 — 사용자 결정). Library 를 동기로 열어 저장 page 를 읽는 unit 테스트 4 파일은 family 를 먼저 받는다 (`support/chartFamilies.ts`).
- **작은 상자** (live 에서 발견 — Library 칸 140 × 78): 범례가 그림 높이의 1/3 을 넘으면 내지 않음 (`seriesLegend`) · bump 줄 간격이 글자보다 좁으면 이름 라벨 없음 · waterfall 칸이 글자 3 개 폭보다 좁으면 값 라벨 없음 · funnel 줄이 글자 두 줄보다 낮으면 이름만 · skyline 은 그림 높이가 글자 12 줄보다 낮으면 띠 · 보조 라벨 없음, 벽 눈금 간격이 좁으면 끝 눈금만 글자.
- **G4** (`families/__tests__/category.test.ts` 88 (판독 수리 뒤) — 손계산: 칸 나누기 [38, 33, 29] · [1, 1, 1] → [34, 33, 33] · valueMax 200 → [25, 15], pareto 누적 54 · 79 · 86 … 100 · 강조 2, funnel 60 % · 25 % / 첫 대비 15 %, waterfall 누적 · 값 없는 합계 = 4100 · domain 5082.5, lollipop domain 87.74, stream silhouette, bump 값 → 순위, marimekko 열 합 45 · 35 · 20, skyline 합치기 · 묶음 범위 — 그리고 12 종 × 3 상자 숫자 유한 · 행 0 · 역할 빈칸 · 음수 · 0 · 결측 · rowCap · 작은 상자). 원복 RED 8: 칸 나누기 2 · pareto 1 · waterfall 1 · binding 조건 2 · 항목 조건 3 · 선택 역할 1 · Canvas 재시도 1 · columns patch 1 (복원 cmp 일치) + Library 미루기 1.
- **G3**: DOM `adr306CategoryHost.browser.test.tsx` 121 (12 종 × 320×240 · 640×360 × 표본 · 음수 · 0 · 결측 · 항목 1 (긴 한국어) + 키보드) — 원복 RED: rect x + 1 → 36 실패. Canvas `categorySkia.test.ts` 13. 패널 조건 차등 오라클 (`chartVisibleWhen.test.ts` — 값을 바꿔 scene 이 바뀌는 prop ⊆ 보이는 prop, 보이는 조건 prop 은 읽힌다) 을 category 12 종으로 넓힘 (waterfall 은 첫 행 kind 를 비운 표본 — `startTotal` 축을 보려고).
- **번들** — 같은 기계, 기준선 = Phase 2 커밋 `5801b6760` 트리: Builder **1,550,129 → 1,554,597 (+4,468)** · Preview **155,321 → 157,910 (+2,589)** gzip. category 계산 · 표본은 `category-*.js` 15,762 B (initial 목록에 없음). 공용 chunk 가 다시 나뉨 (`dots` 8,196 · `series` 4,293 · `pie` 1,657 B — 원래 첫 화면의 차트 공용 모듈). 사용자 결정 2 대로 Builder 상한 **1,422,944** (gate · deploy.yml · ADR-201 · CLAUDE.md, gate self-test PASS).
- **검사**: type-check PASS · `codex:preflight` PASS · rendering `src/chart` 633 · Chart browser chart + chart-a11y 629/629 · builder · shared · rendering unit 의 남은 실패는 Phase 2 기록과 같은 Chart 무관 목록 (테스트 이름 단위 대조 — 새 실패 0) · `docs:stale-symbols` 0.
- **live**: 본문 `### Live Exercise`.
- **판독 1 회 (reviewer, 2026-11-16)** — CRITICAL 0 · HIGH 0 · MEDIUM 1 → 수리. (M) marimekko 는 열 수 상한이 없어 열이 `plotW / 7` 을 넘으면 막대 폭이 음수 (SVG 는 그리지 않음 → Preview · Publish 빈 차트) → 열 하나 4px + 틈 기준으로 앞 열만 + `budget.rowsTruncated`, 그리고 12 종 전부에 「범주 수천 개 × 3 상자에서 rect 음수 · NaN 0」 테스트 (원복 RED 1). LOW 수리 2: Library 대기 분기가 비교 키 (`libraryForksKey` 등) 를 두지 않아 대기 중 step 마다 page 를 다시 열던 것 → 키를 대기 전에 · 숫자 옵션 (waffle `cells` · `columns` · skyline `depth`) 이 NaN · 문자면 기본값 (원복 RED 1). LOW deferred (재현 없음): 대기 중 Library Unlock 뒤 저장 · 대기 끝의 저장이 Canvas drag 중에 오는 경우. 판독이 짚은 phase4eOriginView 실패를 테스트 이름 단위로 Phase 1 기록과 대조: 「the page: a card per built-in origin」 은 Phase 1 에 없던 실패 — **Phase 2 회귀가 「기존 실패」 로 숨어 있었다** (Types 카드 기대값이 시리즈 7 종 고정 · 제품 동작은 맞음) → 기대값을 descriptor 표에서 읽게 고침. 남은 `:1240` (Tabs) 은 Phase 1 기록에 있던 것. 수리 검증: builder unit 새 실패 0 (이름 단위) · rendering `src/chart` 633 · Chart browser 629/629 · `codex:preflight` PASS — HIGH 0 으로 Phase 3 닫힘 (실행자 선언).

### Phase 4 — 2026-11-16 (G3 · G4 distribution · matrix 닫힘)

- **distribution family 4** (`families/distribution/` — `histogram.ts` · `spread.ts` box · beeswarm · ridgeline · `index.ts` 표본) · **matrix family 4** (`families/matrix/` — `grid.ts` heatmap · calendar · `price.ts` candlestick · `parallel.ts` · `index.ts`). 통계는 `families/stats.ts` (ztd `layout/stats.ts` · `geometry.quantileSorted` · `data/percentile.ts` 이식, MIT), 표본 난수는 `families/samples.ts` (ztd `seeded` · `gauss`). 공용 조각은 category 의 `common.ts` 를 그대로 쓴다 (bundler 가 `common-*.js` 2,738 B 로 떼어 낸다 — 첫 화면 밖).
- **원본 전체 통계**: `categoryContext(…, capRows = false)` — 분위 · KDE · 사분위 · 중앙값 · 칸 합계 · 이동평균은 원본 전체로 낸다 (`rowCap` 으로 자른 표본으로 내지 않는다 — §4.2). 그리는 요소만 종류마다 줄이고 진단: histogram 그룹 2 (`budget.groupsTruncated`) · 경계 밖 · log 의 0 이하 (`values.excluded`) · beeswarm 점 2,000 · heatmap 칸 2px · calendar 해 (최근 해부터) · candlestick 봉 합치기 (그림 폭 / 4 — ztd `maxCandles`) · parallel 선 1,500 (`budget.rowsTruncated`).
- **색**: 강조 하나 (histogram 기준 넘은 구간 · 가장 높은 구간 · box · beeswarm · ridgeline 의 중앙값 최대 그룹 · parallel 첫 행 · candlestick 상승) 는 accent / neutral, 값 단계 (heatmap · calendar) 는 `step-1` ~ `step-4` (비율 4 등분 — 최솟값 ~ 95 번째 백분위 `robustMax`), calendar 의 0 · 빈 날은 `step-0`. ztd 의 연속 불투명도 (`sequential`) 는 쓰지 않는다 (§5.1).
- **편차 6**: (1) histogram 기준선은 `threshold` 숫자 하나 — ztd 의 `side: below` · 이름은 받지 않는다 (pareto 와 같은 키, 넘는 쪽이 나쁜 쪽). 같은 이유로 binding 의 `threshold` 슬라이더 범위 (0 ~ 100 %) 와 기본값 80 을 지웠다 — pareto 는 비면 80 (`paretoModel`). (2) histogram 모양 값은 ztd `bars` 대신 sparkline 과 같은 `bar` (항목 하나를 두 종류가 같이 쓴다). (3) 분위 · 기준 · 중앙값 이름표의 바탕 (ztd `panel` 색) 은 그리지 않는다. (4) heatmap 칸 안 숫자는 기본 끔 (`showValueLabels: false`) — 글자 색이 역할 색이라 진한 칸 위에서 읽기 어렵다 (Phase 3 편차 3 과 같은 이유). (5) candlestick 의 brush · 주석 · 마지막 값 표는 Phase 6 (공통 상호작용). 가격 축 범위는 `valueMin` · `valueMax` (ztd `yDomain`) — 한쪽만 주면 그쪽만 고정, 그래서 binding `valueMin` 의 기본값 0 을 지웠다 (gauge 는 비면 0 — `kpi.ts`). (6) 표본 행 수를 줄였다 — histogram 320 → 200 · box 그룹당 80 → 30 · ridgeline 120 → 30 · calendar 1 년 → 26 주 (Library Types 카드도 표본을 저장한다 — 사용자 원칙 「Builder 의 데이터 행 = 디자인 표본」).
- **패널**: 새 prop 27 (역할 11 — Bin Start · Bin End · Count · Label · Row · Open · High · Low · Close · Volume · Inverted Axes / 옵션 16) 은 descriptor 표에서 `visibleWhen` 파생 · `shape` 항목 조건에 histogram 3 · box 3 · `chartType` 선택지 8. 목록 칸 (string-array — `percentiles` · `edges` · `whiskers` · `movingAverages` · `legendLabels`) 은 글자 배열로 저장하고 family 가 `numberList` 로 읽는다 (문서 검증이 숫자 배열을 거부 — 표본 props 도 글자). `bins` · `dotRadius` 는 비우면 자동이라 슬라이더 대신 숫자 칸 (live 에서 발견 — 슬라이더가 빈 값을 1 로 보였다). parallel 은 값 필드 목록 (descriptor `columns`) 이 축이다.
- **작은 상자** (live 에서 발견 — Library 칸): candlestick 은 그림이 글자 14 줄보다 낮으면 거래량 띠 · 이동평균 이름 없음 · 날짜는 상자 안에 들 때만 · 합친 봉의 축 글자는 첫 기간, parallel 은 축 사이 간격이 끝 값 글자보다 좁거나 그림이 글자 10 줄보다 낮으면 축 끝 값 없음, ridgeline 이름은 줄 간격이 글자 1.1 배 이상일 때만, histogram 이름표는 글자 10 줄 이상일 때만 (작으면 선만), calendar 는 칸 묶음을 세로 가운데로.
- **G4** (`families/__tests__/distributionMatrix.test.ts` 75 — 손계산: quantileSorted 1.75 · Tukey [1, 2, 3, 4, 100] → 수염 1 · 4 · 이상값 100 · Sturges [1 … 5] → 경계 [1, 2, 3, 4, 5] 개수 [1, 1, 1, 2] · dotUnit(120, 25) = 5 · box / histogram 그룹 A [1, 9] → n 2 · 중앙값 5 · 경계 [0, 250, 500, 750] 기준 400 → 개수 [2, 1, 2] · 넘은 몫 0.4 · 사전 집계 빈 구간 채움 · p50 20/3 · candlestick 합치기 (10, 18, 8, 15) · 거래량 합 · 이동평균 [NaN, 1.5, 2.5, 3.5] · calendar 2024-02-29 = 0 주 요일 4 (주 시작 0) / 3 (주 시작 1) · 2023-02-29 거부 · heatmap 같은 칸 합산 · 단계 4 등분 · KDE 적분 ≈ 1 · 비스웜 겹침 0 — 그리고 8 종 × 3 상자 숫자 유한 · 행 0 · 역할 빈칸 · 음수 · 0 · 결측 · 항목 1 · 긴 한국어 · 많은 범주 · 작은 상자 · NaN 옵션 · rowCap 을 넘어도 통계는 전체). 원복 RED 7 (통계 원본 전체 · 사전 집계 어림 · 봉 합치기 고가 · 주 시작 요일 · heatmap 합산 · 기준 넘은 몫 · Tukey 높은 울타리 — 낮은 울타리 변이는 이 입력에서 GREEN 이라 높은 쪽으로 확인, 복원 cmp 일치).
- **G3**: DOM `adr306DistributionMatrixHost.browser.test.tsx` 81 (8 종 × 320×240 · 640×360 × 표본 · 음수 · 0 · 결측 · 항목 1 + 키보드) — 원복 RED: path `d` 에 `M0,0` 덧붙임 → 78 실패 (path 가 없는 빈 scene 3 은 통과). Canvas `distributionMatrixSkia.test.ts` 8. 패널 조건 차등 오라클 (`chartVisibleWhen.test.ts`) 을 20 종으로 넓힘 (valueMax 후보에 candlestick 가격대 200,000 을 더함).
- **번들** — 같은 기계, 기준선 = Phase 3 커밋 `9968835e6` 트리: Builder **1,554,597 → 1,556,825 (+2,228)** · Preview **157,910 → 159,033 (+1,123)** gzip. 계산 · 통계 · 표본은 `distribution-*.js` 9,655 · `matrix-*.js` 7,097 B (initial 목록에 없음). 필드 참조 색인이 initial 공용 chunk 로 떨어져 나왔다 (`fieldIdIndex-*.js` — 원래 첫 화면에 있던 모듈). 사용자 결정 2 대로 Builder 상한 **1,425,172** (gate · deploy.yml · ADR-201 · CLAUDE.md, gate self-test PASS).
- **검사**: type-check PASS · `codex:preflight` PASS · rendering `src/chart` 716 · Chart browser chart + chart-a11y 756/756 · builder · shared unit 의 남은 실패는 Phase 3 기록과 같은 Chart 무관 목록 (테스트 이름 단위 대조 — 새 실패 0). 전체 실행에서 `libraryPageSync` 「a card the user deleted is not given again」 이 한 번 5 초 시간 초과 — 단독 1.6 초 · 새 family 로더를 뺀 판도 1.6 초라 이 변경 탓이 아닌 부하 시간 초과로 판정 (판독 agent 가 같은 때 테스트를 돌렸다).
- **live**: 본문 `### Live Exercise`.
- **판독 1 회 (reviewer, 2026-11-16)** — CRITICAL 0 · HIGH 0. 미확인 HIGH 후보 1 은 확인 결과 실제 누락 → 수리: `chartType` 선택지 (`editFields` · `inspectorFields` 가 읽는다) 에 8 종이 없었다 — 팔레트 삽입은 이 선택지를 지나지 않아 live 에서 드러나지 않았다 → 선택지 추가 + 「선택지 = descriptor 종류 전부」 테스트 (원복 RED 1). MEDIUM 3 수리: (1) `Math.max(...)` 펼치기에 그룹 × 표본 배열을 넣어 그룹 수천 (ridgeline 2,000 · violin 3,000 · heatmap 행 13 만) 에서 RangeError → 접어서 구함 (원복 RED 1) · (2) binding `threshold` 기본값 80 이 정의 기본값이 되어 histogram 해석 props 에 늘 들어감 → 기본값 삭제 (pareto 는 비면 80) + 「뜻이 다른 공유 키는 기본값 없음」 테스트 (원복 RED 1) · (3) candlestick 이 날짜까지만 (`utcDay`) 정렬해 같은 날 시간봉 · epoch 순서가 틀림 → 시각 전체 (`timeOf` — ztd `toCandles` 와 같은 숫자 기준 1e10) (원복 RED 1). LOW 수리 2: calendar 같은 날 행 목록 복사 (행 수 제곱) → push · candlestick 상자가 눈금 폭보다 좁으면 빈 scene. LOW deferred 1: 겹치는 사전 집계 구간의 계단선 (진단 없음 — 실제 사례 없음). 수리 검증: rendering `src/chart` 716 · shared family props 7 · Chart browser 756/756 · `codex:preflight` PASS · builder 패널 새 실패 0 — HIGH 0 으로 Phase 4 닫힘 (실행자 선언). 수리 뒤 live (커밋 직전): Chart type 칸 = 「Candlestick」 · 목록 30 종 · Min value 빈 칸 · console 오류 0.
