# ADR-194 Breakdown: 차트 컴포넌트 — headless 기하 SSOT + Skia/DOM 대칭 consumer

> 2026-08-27 초안. ADR 본문: [194-chart-component-headless-geometry.md](../194-chart-component-headless-geometry.md).
> Phase 0 inventory 는 본 문서의 표를 갱신하는 commit 으로 freeze 한다 (M3 — 추정/실측 gap 은
> inventory 보강이지 fork 사유가 아님).

## 1. 전제 lock-in (fork 아님 — 완전 신규 주제)

- 본 ADR 은 기존 ADR 의 분리/fork 가 아니다. `grep -riE '\bcharts?\b' docs/ .claude/` 실측 —
  차트 컴포넌트에 대한 결정·논의 0건 (Monitor 패널 내부 mini-chart 운영 이슈 · Dashboard Kit
  "Chart placeholder" 언급 · Retool 벤치마크 한 줄 · pen.dev 경쟁 분석만 존재).
- 의존 방향: ADR-152/159 (dataTable 바인딩 계약) 가 base, 본 ADR 은 그 consumer (응용). ADR-117
  (PathBuilder 전환) 과는 직교 — 본 ADR 의 신규 path 생성은 0.42.0 유지 API
  `Path.MakeFromSVGString` 만 사용하므로 117 의 진행 여부와 무관.
- SSOT 경계: D1 internal source (RAC 에 chart primitive 없음) / D2 React Spectrum Charts prop
  명 참조 / D3 catalog rule. 경계 변경 없음.

## 2. Current Baseline (2026-08-27 실측 — Explore 결과, HEAD `e319a95af`)

| 항목           | 실측                                                                                                                                                                                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 차트 의존성    | 0건 — d3/vega/recharts/echarts/chart.js/visx/nivo/victory 전부 없음 (lockfile transitive 포함)                                                                                                                                                                                  |
| CanvasKit      | `apps/builder/package.json:38` `^0.40.0` (lock 0.40.0). ADR-117 이 0.42.0 전환 진행 중. publish 앱은 CanvasKit 없음                                                                                                                                                             |
| Shape 유니온   | `packages/specs/src/types/shape.types.ts:34-46` 12종 — rect/roundRect/circle/arc/text/shadow/border/container/gradient/image/line/icon_font. **임의 path·polyline·회전 텍스트 없음**                                                                                            |
| SVG path→Skia  | `skia/nodeRendererShapes.ts:220` `ck.Path.MakeFromSVGString(d)` 1곳 — 입력이 `IconFontShape.iconName` → lucide 레지스트리로 잠김 (`specShapeConverter.ts:474-529`). 노드 레벨 `iconPath.paths: string[]` 은 임의 문자열 수용                                                    |
| 노드 transform | `nodeRendererTypes.ts` `transform?: Float32Array` → `renderCommands.ts:2180` `canvas.concat`. Shape 레벨 진입로 없음 (텍스트 회전은 v2)                                                                                                                                         |
| Skia primitive | `packages/specs/src/renderers/skiaPrimitives.ts:62-68` `(ctx:{props,size,visual,paint,style}) => Shape[] \| null`; 등록 `SKIA_PRIMITIVES` `:3261`, 모드 `SKIA_PRIMITIVE_MODES` `:3329`; dispatch `buildSpecNodeData.ts:1185-1306`                                               |
| DOM 3rd-party  | `PrimitiveSource.kind:"internal"` + `renderer` (`catalog/types.ts:47-61`) → `renderers/index.ts:19` `rendererMap` → `renderFacetDeclaration.ts` delegating-internal. 선례 TableView(@tanstack/react-table)                                                                      |
| 등록 지점      | catalog entry `componentCatalog.ts:33` `primitiveEntry` · binding `bindings/*.binding.ts` · rule `generated/componentRulesTable.ts:17` · `paletteItems.ts:170` `PALETTE_ORDER` (+`paletteOracle.ts`) · factory · defaults · rendererMap · publish `ComponentRegistry.tsx:14-60` |
| CI ratchet     | `factories/__tests__/componentRegistrationContract.test.ts:131` `BASELINE_RATCHET = {rendererMap:0, TAG_SPEC_MAP:0, getDefaultProps:0}`                                                                                                                                         |
| 데이터 계약    | `DataBinding {type, source, config}` (`shared/src/types/element.types.ts:36`) · dataTable 행 읽기 `readDataBindingRows` / `resolveCollectionItems` (ADR-152 Decision) · 샘플 N행 정책 ADR-157                                                                                   |
| 색 토큰        | `COMPONENT_RULES_TABLE` 소비 named hue: blue/purple/green-named/orange/red/magenta/cyan/indigo/yellow/pink/fuchsia/turquoise/seafoam/celery/chartreuse (+`-subtle`). Spectrum design-data 에 chart 토큰 0건                                                                     |
| 폰트/문단      | `skia/fontManager.ts:231` 공유 FontCollection · `nodeRendererText.ts:602` `MakeFromFontCollection` (per-call `ParagraphBuilder.Make` 금지 — 5.78MB/paragraph 복제)                                                                                                              |
| 자체 SVG 선례  | `panels/monitor/components/RealtimeChart.tsx` (227줄, SVG polyline + threshold, zero-dep)                                                                                                                                                                                       |
| 번들 규칙      | `CLAUDE.md:59` 초기 번들 <500KB · `component-design/SKILL.md:81` 외부 라이브러리 추가 금지                                                                                                                                                                                      |

### Phase 0 재grep (착수 직전 필수)

```bash
rg -n "MakeFromSVGString|iconPath" apps/builder/src/builder/workspace/canvas/skia --glob '!*.test.ts'
rg -n "case \"icon_font\"|case \"line\"" apps/builder/src/builder/workspace/canvas/skia/specShapeConverter.ts
rg -n "readDataBindingRows|resolveCollectionItems" packages/shared/src apps/builder/src --glob '!*.test.*' -l
rg -n "fillBar|typography" packages/specs/src/renderers/utils/resolveComponentVisual.ts   # ComponentVisualRule 채널 확장 지점
rg -n "visual|fillBar|--" packages/specs/scripts/generate-css.ts | head -40               # generate-css 가 visual 채널을 CSS var 로 emit 하는지
```

## 3. 시스템 설계

### 3-1. 데이터 흐름 (단일 기하 → 두 consumer)

```
rows (dataBinding → readDataBindingRows | props.data sample)
  → computeChartScene({chartType, dimension, metric, color, orientation, stackType,
                       showAxis, showGrid, showLegend}, rows, {width,height}, rule)
  → ChartScene { plotRect, marks: Mark[], axes: AxisScene[], legend: LegendScene }
       ├─ DOM  : ChartRenderer.tsx  → <svg role="img"> <path d> <rect> <text>
       └─ Skia : SKIA_PRIMITIVES.chart_scene (replace) → PathShape / RectShape / TextShape / LineShape
```

- **rows 주입 (review round 1 정정)**: `SkiaPrimitiveDrawFn` ctx 는 `{props,size,visual,paint,style}` 뿐이라
  (`skiaPrimitives.ts:62-68`) 데이터 행을 받을 채널이 없다. 컬렉션 projection 은 scene-node 층
  (`canvasSceneNode.ts:1329/2080/2535` `getFlatProjectionRows`) 에서 행을 해석하므로, Chart 도
  `buildSpecNodeData` 의 `_containerWidth`(`:149-167`)·width/height injection(`:1698-1712`) 과 같은
  자리에서 `readDataBindingRows` 결과를 `specProps._chartRows` 로 주입한다 (dataBinding 없으면
  `props.data` 샘플). primitive 는 `props._chartRows ?? props.data` 만 읽는다 — 행 해석 로직은
  primitive 밖 (Skia projection + DOM 공통 경로 재사용).
- **마크 bbox**: 모든 `Mark` 는 `bbox {x,y,w,h}` 를 함께 싣는다 — Skia 노드는 `width/height` 가 필수이고
  컬링이 절대좌표 bounds 로 판정한다 (`renderCommands.ts:2039-2048`, `:2119` `cmd.width > 0 ||
cmd.height > 0` 분기). path `d` 만 있는 노드는 0 크기로 취급될 수 있으므로 `PathShape` 에 bbox
  를 명시 필드로 둔다 (`d` 재파싱 금지 — 기하 모듈이 이미 좌표를 안다).
- `Mark` = `{kind:"path", d, bbox, fillToken?, strokeToken?, strokeWidth} | {kind:"rect", x,y,w,h, fillToken} | {kind:"text", x,y,text,align,baseline,role:"tick"|"title"|"legend"} | {kind:"line", x1,y1,x2,y2, role:"grid"|"axis"}`.
- 색은 **토큰 인덱스** (`seriesIndex`) 로 실어 두 consumer 가 각자 rule 에서 해소 — scene 에 hex 를 넣지 않는다 (theme 전환·dark 모드 대칭, ADR-193 정합).
- 기하는 순수 함수 · 결정적 · DOM/CanvasKit 무의존 (`packages/specs/src/chart/`). 숫자 포맷은 `Intl.NumberFormat` 만 사용.

### 3-2. 기하 모듈 (`packages/specs/src/chart/`) — 외부 의존 0

> review round 1 정정: 초안은 `packages/specs/src/chart/` 였으나 workspace 의존이 shared→specs
> 단방향 (`packages/shared/package.json:59`, specs 는 shared 미의존) 이라 `skiaPrimitives.ts`(specs)
> 가 shared 를 import 하면 순환이 된다. 기하 모듈은 specs 에 두고 shared 의 DOM renderer 가 specs 에서
> import 한다 (publish 는 shared→specs transitive).

| 파일                   | 내용                                                                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `types.ts`             | `ChartProps` / `ChartRow` / `ChartScene` / `Mark` / `AxisScene` / `LegendScene`                                                                |
| `scales.ts`            | `linearScale(domain, range)` · `bandScale(categories, range, paddingInner)` · `niceTicks(min,max,n)` (d3-array `ticks` 알고리즘 재구현, ~40줄) |
| `series.ts`            | rows → `{dimension, metric, color}` 그룹핑 · stack 누적 (`stackType: "stacked"\|"dodged"`)                                                     |
| `marks/bar.ts`         | dodged/stacked · orientation horizontal/vertical → rect marks                                                                                  |
| `marks/line.ts`        | polyline `M…L…` (v1 직선; 곡선 보간은 §7)                                                                                                      |
| `marks/area.ts`        | line + baseline close (`Z`)                                                                                                                    |
| `marks/pie.ts`         | 자체 `arcPath(cx,cy,r,innerR,start,end)` — SVG `A` 명령 (CanvasKit `MakeFromSVGString` 가 arc 지원)                                            |
| `axes.ts`              | tick 위치/레이블 · 축선 · grid line · 레이블 생략 규칙 (폭 초과 시 every-nth, 회전 없음)                                                       |
| `legend.ts`            | 항목 배치 (top/bottom/left/right) · swatch rect + text                                                                                         |
| `computeChartScene.ts` | 위 조합 + plotRect 산출 (padding = rule sizes)                                                                                                 |

### 3-3. Skia 확장 — `PathShape` (additive)

```ts
// packages/specs/src/types/shape.types.ts — Shape 유니온에 추가
export interface PathShape {
  type: "path";
  /** SVG path data (M/L/C/Q/A/Z). 좌표계 = 노드 로컬 px. */
  d: string;
  x?: number;
  y?: number; // 오프셋 (기본 0)
  /** bbox (노드 width/height·컬링·Picture 캐시 키) — 기하 모듈이 계산해 싣는다. 필수. */
  width: number;
  height: number;
  fill?: ColorValue;
  fillAlpha?: number;
  stroke?: ColorValue;
  strokeWidth?: number;
  strokeCap?: "butt" | "round" | "square";
  strokeJoin?: "miter" | "round" | "bevel";
  fillRule?: "nonzero" | "evenodd";
}
```

- `specShapeConverter.ts` `case "path"` → `SkiaNodeData.type:"path"` + `pathData:{d, fillColor?, strokeColor?, strokeWidth, cap, join, fillRule, offsetX, offsetY}`.
- `renderCommands.ts` dispatch `case "path": renderPath(...)` · `nodeRendererShapes.ts` `renderPath` — `ck.Path.MakeFromSVGString(d)` (0.42.0 유지 API, ADR-117 무관) → fill paint → stroke paint → `path.delete()`. ADR-153 노드 Picture 캐시가 dirty 아닌 프레임의 재파싱을 흡수한다 (Phase 1 측정으로 확인, 필요 시 `d`→SkPath LRU).
- `IconFontShape` 는 그대로 둔다 (lucide 레지스트리 채널 불변).
- 텍스트 회전은 v1 비스코프 (§7).

### 3-4. 카탈로그 등록 (D2/D3)

**binding** `packages/shared/src/catalog/bindings/Chart.binding.ts`:

| accepts          | kind           | section    | 값 / 기본                                       | RSC 참조                                 |
| ---------------- | -------------- | ---------- | ----------------------------------------------- | ---------------------------------------- |
| `chartType`      | enum           | content    | `bar` \| `line` \| `area` \| `pie` (기본 `bar`) | `<Bar/>`·`<Line/>`·`<Area/>` 마크 평탄화 |
| `dimension`      | string         | content    | x 축 필드 키 (기본 샘플 `category`)             | `Bar.dimension`                          |
| `metric`         | string         | content    | y 값 필드 키 (기본 `value`)                     | `Bar.metric`                             |
| `color`          | string         | content    | 시리즈 분할 필드 키 (기본 없음 = 단일 시리즈)   | `Bar.color`                              |
| `orientation`    | enum           | appearance | `vertical` \| `horizontal`                      | `Bar.orientation`                        |
| `stackType`      | enum           | appearance | `stacked` \| `dodged`                           | `Bar.type`                               |
| `showAxis`       | boolean        | appearance | true                                            | `<Axis/>` 유무                           |
| `showGrid`       | boolean        | appearance | false                                           | `Axis.grid`                              |
| `showLegend`     | boolean        | appearance | color 지정 시 true                              | `<Legend/>` 유무                         |
| `legendPosition` | enum           | appearance | `bottom` \| `top` \| `left` \| `right`          | `Legend.position`                        |
| `variant`        | variant        | appearance | `default`                                       | —                                        |
| `size`           | size           | appearance | `sm` \| `md` \| `lg` (기본 `md`)                | —                                        |
| `data`           | (panel 비노출) | —          | 샘플 rows — dataBinding 없을 때 fallback        | `Chart.data`                             |

- `source: {kind:"internal", renderer:"chart"}` · `skiaPrimitive: "chart_scene"` (replace) ·
  `staticAttrs: {role:"img"}` · `propPassthrough`: 전 accepts (렌더러가 React prop 으로 소비 —
  Icon/StatusLight 선례, data-attr 로는 SVG 기하에 도달 불가).
- boolean 시각 prop 은 `toRacProps` raw 통과가 dead 가 되는 함정
  (`feedback-boolean-visual-prop-falls-through-toracprops`) — passthrough 로 우회.

**rule** `COMPONENT_RULES_TABLE.Chart`:

- `variants.default`: `fill.default.base = {color.layer-1}`, `colors.text = {color.neutral}`, `colors.border = {color.border}`.
- `sizes.sm/md/lg`: `height 160/240/320`, `fontSize {typography.text-xs/-sm/-sm}`, `padding`.
- **chart 채널 (신규 visual 채널)**: `chart: { series: ["{color.blue}","{color.purple}","{color.green-named}","{color.orange}","{color.magenta}","{color.cyan}","{color.yellow}","{color.indigo}"], axis: "{color.neutral-subdued}", grid: "{color.border}", strokeWidth: 2 }` — RSC categorical 순서 참조. `ComponentVisualRule` 타입 확장 (Phase 0 에서 지점 실측).
- generate-css: `.react-aria-Chart { --chart-series-1..8; --chart-axis; --chart-grid }` emit — DOM renderer 는 `var(--chart-series-N)`, Skia 는 `visual.chart.series[i]` → `resolveToken`. **Generator 가 이 채널을 emit 하지 못하면 G0 실패** → Phase 3 에서 emit 확장 선행.

**catalog entry**: `primitiveEntry("Chart", "collections", "catalog", {category:"collections", label:"chart", icon:"BarChart3"})`.

**PALETTE_ORDER**: `{ type: "Chart", source: "catalog" }` — TableView 뒤 (collections 묶음). `paletteOracle.ts` 동시 갱신.

**factory** `DisplayComponents.ts::createChartDefinition` — 샘플 rows 6건 `{category, value, series}` × 2 시리즈. width 320 / height = rule size.

**defaults**: `deriveDefaultPropsFromCatalog("Chart")` + data 샘플 (Icon 과 같은 사유로 row 유지).

**DOM**: `packages/shared/src/renderers/ChartRenderer.tsx` (`rendererMap.Chart`) → `packages/shared/src/components/Chart.tsx` (`<div class="react-aria-Chart" role="img" aria-label>` + `<svg viewBox>`). `renderFacetDeclaration.ts` delegating-internal `"chart"` 등록. publish `ComponentRegistry.tsx` `Chart` 등재.

### 3-5. 데이터 (ADR-152/157/159 계약 재사용)

- 입력 우선순위: `dataBinding(source:"dataTable")` → `readDataBindingRows` (Skia projection + DOM 공통 경로) → 없으면 `props.data` 샘플.
- 빌더 표시 정책: ADR-157 동형 — 행 상한 `CHART_SAMPLE_ROWS = 200` (초과 시 앞 200 + 범례 "+N"). preview/publish 는 전체 행 (상한 5,000, 초과 시 경고 콘솔 1회).
- 신규 데이터 source 경로 0 — 152 의 provider 배선 결함(격차 7) 은 본 ADR 밖 (152 Phase 3 선행 조건).

## 4. Phase

| Phase | 내용                                                                                                                                                                                                                                                     | 산출/검증                                                                                                                |
| :---: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
|   0   | inventory freeze — §2 재grep · `ComponentVisualRule`/generate-css 채널 확장 지점 · `readDataBindingRows` 시그니처 · 등록 8지점 line · publish registry 가 registration contract test 에 포함되는지 · ADR-117 진행 상태 · `size`→layout 무효화 등재 (R10) | §2 표 갱신 commit. **G0**                                                                                                |
|   1   | `PathShape` + Skia `path` 노드 + `renderPath` + converter case + 단위 테스트 (fill/stroke/evenodd/offset) · 임시 dev primitive 로 live 1회 (삼각형+arc)                                                                                                  | type-check 0 · `renderPath` 테스트 · live 스크린샷. **G1**                                                               |
|   2   | 기하 모듈 `packages/specs/src/chart/*` — scales/ticks/series/marks 4종/axes/legend/computeChartScene + 결정적 스냅샷 테스트 (고정 rows → scene JSON) · niceTicks 경계 (음수/0/단일값/NaN 행)                                                             | 단위 테스트 PASS. **G2**                                                                                                 |
|   3   | 카탈로그 등록 — binding · entry · rule(+chart 채널 타입) · generate-css emit · PALETTE_ORDER/oracle · factory · defaults · rendererMap/facet · publish registry · Properties 패널 accepts 노출 확인                                                      | `componentRegistrationContract.test` PASS · `pnpm generate:css` diff 에 `--chart-series-*` · 팔레트에서 드롭 가능 (live) |
|   4   | 두 consumer — `ChartRenderer.tsx`(SVG) + `chart_scene` primitive. **parity 테스트**: 동일 scene → DOM `d`/rect 좌표 == Skia PathShape `d`/RectShape 좌표 byte-identical · `/cross-check` live 4종                                                        | **G3**                                                                                                                   |
|   5   | dataBinding 연결 (`readDataBindingRows`) + 샘플 fallback + 행 상한 · dark 모드 토큰 해소 대칭 (ADR-193 결과에 따라 CSS var ↔ Skia 동일 단계)                                                                                                             | live: dataTable 바인딩 → builder/preview 동일 갱신. **G5**                                                               |
|   6   | 번들 측정 (`vite build` builder 초기 chunk · publish) · CHANGELOG · README · 메모리 · Implemented 승격                                                                                                                                                   | **G4** · 완료 보고에 live exercise 항목 명시                                                                             |

각 Phase 는 commit 가능 상태로 종료 (phase 당 1 commit + main push). sub-group 3+ 분할·scope
1.5x 초과 시 M4 질문 의무 (리뷰 승인 전) / 사후 보고 (승인 후).

## 5. 검증 체크리스트

- [ ] `pnpm type-check` 0 / `componentRegistrationContract.test` ratchet 0/0/0 유지
- [ ] parity 단위 테스트: bar/line/area/pie × (vertical/horizontal, stacked/dodged) scene → DOM/Skia 좌표 동일
- [ ] live (Chrome MCP): 팔레트 드롭 → 캔버스 Skia 차트 표시 → preview iframe SVG 동일 bbox (Δ≤1px) → chartType 4종 토글 → dark 모드 토글 시 양측 시리즈 색 동일
- [ ] 번들: builder 초기 chunk Δ ≤ +15KB gz · publish Δ ≤ +15KB gz (외부 의존 0)
- [ ] 성능: 200행 × 4시리즈 bar 에서 Skia frame p95 ≤ 기존 baseline +1ms (`project-builder-frame-cost-distribution-measured` 방법)
- [ ] 접근성: `role="img"` + `aria-label` (제목 또는 "chart") · publish 렌더 확인

## 6. 위험 대응 매핑 (ADR §Risks ↔ Phase)

| Risk | Phase | 확인 방법                                                                                                               |
| ---- | :---: | ----------------------------------------------------------------------------------------------------------------------- |
| R1   |  0/3  | generate-css 가 `visual.chart` 채널을 emit 하는지 — 미지원 시 emit 확장 commit 선행                                     |
| R2   |   1   | converter/renderCommands 분기 누락 → 단위 테스트 + live 삼각형                                                          |
| R3   |  2/4  | 레이블 every-nth 생략 규칙 스냅샷                                                                                       |
| R4   |   5   | 행 상한 상수 + 200행 frame 측정                                                                                         |
| R5   |   3   | binding 주석에 RSC 마크→enum 평탄화 근거 기록                                                                           |
| R6   |  0/3  | publish registry 누락 검출 테스트 존재 여부 실측 → 없으면 oracle 추가                                                   |
| R8   |  3/5  | `_chartRows` 주입 지점 (`buildSpecNodeData` injection 블록) + primitive 가 rows 를 ctx 밖에서 받지 않음을 테스트로 고정 |
| R9   |   1   | `PathShape` bbox 필수 — 0 크기 노드 컬링 회귀 테스트                                                                    |
| R10  |   0   | `size` 변경 재레이아웃 경로 실측 (5-심볼 2계층)                                                                         |

## 7. 비스코프 (후속 판정)

- 곡선 보간 (monotone/catmull) — 필요 시 d3-shape 5.7KB gz 도입을 별도 Gate 로 판정.
- 텍스트 회전 축 레이블 — `TextShape.rotate` → 노드 `transform` 채널 개방 (Skia 렌더러 확장).
- 툴팁/hover/selection 상호작용 — Preview(D1) 영역 (`feedback-skia-builder-not-frontend-interaction-belongs-to-preview`).
- scatter/heatmap/donut 라벨/이중 축 — chartType enum 확장 시 마크 파일 1개 추가로 흡수 (기하 SSOT 구조 무변경).
- Vega scenegraph → Skia renderer (대안 B) — 고급 차트 요구가 실제로 발생하면 재판정.
