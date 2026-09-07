# ADR-194: 차트 컴포넌트 — headless 기하 SSOT + Skia/DOM 대칭 consumer

## Status

**Implemented — 2026-09-08** (Phase 0~6 / G0~G5 전부 통과. 컴포넌트 패널 Collections 의 `chart` — bar/line/area/pie, 신규 런타임 의존 0, Builder Skia 와 Preview/Publish SVG 가 같은 기하 함수 좌표를 복사. 직전 Accepted 2026-08-27 — review-adr round 1 승인, HIGH 1·MED 2·LOW 2 전부 fixed, `docs/adr/reviews/194.md`)

> 출처: 2026-08-27 사용자 요청 — 컴포넌트 패널에 RAC/RSP 기반 컴포넌트만 있고 chart 가 없다. 외부 라이브러리 리서치·비교 (본문 §Alternatives) 후 설계 착수. 완전 신규 주제 (fork 아님) — 전제 기록은 [breakdown §1](../design/194-chart-component-headless-geometry-breakdown.md).

## Context

**SSOT 3-domain 위치**: D1 = **internal source** (RAC 에 chart primitive 없음 — `PrimitiveSource.kind:"internal"` 탈출구, TableView(@tanstack/react-table)·Icon(Lucide) 선례) / D2 = **React Spectrum Charts prop 명 참조** (`dimension`/`metric`/`color`/`orientation`/`type`/`Legend.position`) — RSP v3 자체에는 chart 가 없어 RSC 를 참조 원천으로 둔다 / D3 = **catalog `COMPONENT_RULES_TABLE.Chart` + theme/tokens** (시리즈 팔레트·축·grid·typography). 경계 교차 없음. 단, D3 rule 에 chart 전용 visual 채널(`series[]`/`axis`/`grid`) 을 신설하므로 **Generator(generate-css) 가 이 채널을 CSS var 로 emit 할 수 있는지** 가 Phase 0 확인 대상이다 (§Risks R1).

### 문제 — chart 는 두 렌더 경로 모두에 진입로가 없다

2026-08-27 실측 (breakdown §2):

- 차트 관련 의존성 0건, 결정·논의 0건. 유일한 선례는 Monitor 패널 내부 `RealtimeChart.tsx` (zero-dep SVG, 227줄) 와 Dashboard Kit 의 "Chart placeholder" 언급뿐.
- **Preview/Publish(DOM)** 는 열려 있다 — `kind:"internal"` binding → `rendererMap` 위임 (`packages/shared/src/renderers/index.ts:19`) 으로 3rd-party 도 붙는다.
- **Builder(Skia)** 가 병목이다 — `SKIA_PRIMITIVES` draw fn 은 `(ctx) => Shape[] | null` (`packages/specs/src/renderers/skiaPrimitives.ts:62-68`) 로 canvas 를 직접 잡지 못하고, Shape 유니온 12종 (`packages/specs/src/types/shape.types.ts:34-46`) 에 **임의 path·polyline·회전 텍스트가 없다**. `Path.MakeFromSVGString` 호출부는 `nodeRendererShapes.ts:220` 1곳이며 입력이 lucide 레지스트리로 잠겨 있다 (`specShapeConverter.ts:474-529`). canvas→Skia 텍스처 업로드 인프라는 없다.
- Adobe React Spectrum Charts 에 대한 "스타일 커스터마이징 불가" 인식은 절반만 맞다 — `colors`(CSS 색 배열)·`config`(Vega config 전체 merge)·`renderer` 를 노출한다. 실제 채택 불가 사유는 peerDep `@adobe/react-spectrum >=3.23` (RSP v3 런타임 전체) + vega/vega-lite 로 **600KB+ gz** 이고, 시각 정본이 "Spectrum config 위 merge" 라 catalog SSOT 와 방향이 역전된다는 점이다.
- Spectrum design-data 에 chart 토큰은 0건 (`component=chart` / `property=*chart*`) → 어느 대안이든 시리즈 팔레트는 catalog 자체 정의.

**Hard Constraints**:

1. **번들** — 초기 번들 <500KB (`CLAUDE.md:59`) · 외부 라이브러리 추가 금지 (`.claude/skills/component-design/SKILL.md:81`). 본 ADR 의 신규 런타임 의존 = **0**. builder 초기 chunk / publish 번들 각 Δ ≤ +15KB gz (G4).
2. **시각 대칭** — 동일 기하 산출물(path `d` 문자열·rect 좌표) 을 DOM 과 Skia 가 그대로 소비. 단위 parity 테스트 byte-identical + `/cross-check` live 4종 bbox Δ ≤ 1px (G3). "CSS 가 기준" 이 아니라 **기하 함수가 기준**.
3. **Skia 계약 additive** — Shape 유니온에 `PathShape` 1종 추가만, 기존 12종·`SkiaPrimitiveDrawFn` 시그니처·`IconFontShape` 레지스트리 채널 무변경. `Path.MakeFromSVGString` 은 canvaskit 0.42.0 유지 API (ADR-117 breakdown 실측) 라 117 진행과 직교.
4. **데이터 계약 재사용** — ADR-152/159 dataTable 바인딩 (`readDataBindingRows`) 만 소비, 새 data source 경로 0. 빌더 표시 행 상한은 ADR-157 샘플 정책 동형.
5. **등록 완결** — catalog entry · binding · rule · `PALETTE_ORDER`(+oracle) · factory · defaults · rendererMap/facet · publish registry 8지점 전부. `componentRegistrationContract.test.ts:131` ratchet 0/0/0 유지. `PALETTE_ORDER` 누락 (과거 4건 결손) 은 oracle 로 차단.
6. **성능** — 200행 × 4시리즈 bar 에서 Skia frame p95 baseline +1ms 이내 (`project-builder-frame-cost-distribution-measured` 방법). 축 레이블 텍스트는 공유 FontCollection (`nodeRendererText.ts:602`) 경유 — per-call `ParagraphBuilder.Make` 금지.
7. **접근성** — DOM `role="img"` + `aria-label` (binding `staticAttrs`). ARIA 수동 작성은 이 1건 (internal source 이므로 RAC 부여처 없음 — InlineAlert 선례).

**Soft Constraints**:

- Skia 가 텍스트 회전을 지원하지 않는다 (`buildSpecNodeData.ts:741`, `canvas.rotate` 0건). v1 축 레이블은 수평 고정 + every-nth 생략 — 회전은 후속 (breakdown §7).
- 곡선 보간 (monotone 등) 은 v1 직선 polyline. 필요해지면 d3-shape 5.7KB gz 도입을 별도 Gate 로 판정 — HC1 위반이 아니라 예외 승인 절차.
- ADR-152 의 provider 미배선 결함 (격차 7: dataTable 바인딩이 preview 에서 0행) 은 본 ADR 밖 — Phase 5 live 는 그 수리 이후에만 preview 대조가 성립.
- ADR-193 (dark 모드 semantic 팔레트) 결과에 따라 시리즈 토큰의 dark 단계 해소가 CSS var ↔ Skia 동일 표를 타야 한다 — scene 에 hex 를 싣지 않고 토큰 인덱스만 싣는 설계로 흡수.

## Alternatives Considered

### 대안 A: headless 기하 모듈 (외부 의존 0) + DOM SVG / Skia `PathShape` 이중 consumer (권장)

- 설명: `packages/specs/src/chart/` (specs 가 shared 의 하위층 — `packages/shared/package.json:59` shared→specs 단방향, Skia primitive 가 사는 `packages/specs/src/renderers/skiaPrimitives.ts` 가 import 가능한 유일한 위치; review round 1 정정) 에 순수 함수 `computeChartScene(props, rows, size, rule) → ChartScene` (scales · niceTicks · bar/line/area/pie 마크 · axes · legend). DOM 은 scene → `<svg>`, Skia 는 scene → `PathShape`/`RectShape`/`TextShape`/`LineShape`. 색은 토큰 인덱스로 실어 각 consumer 가 rule 에서 해소.
- 근거: d3 의 핵심 통찰 = 기하(d3-shape/d3-path)는 렌더러 무관 path 문자열 (`d3-path` — Canvas 2D 명령을 SVG path 로 직렬화). CanvasKit `Path.MakeFromSVGString` 이 그 문자열을 직접 소비. Monitor 패널 `RealtimeChart.tsx` (zero-dep SVG) 선례. shadcn/ui charts 가 시리즈 색을 `--chart-N` CSS var 로 주입하는 패턴을 D3 토큰 채널로 채택.
- 위험:
  - 기술: **M** — `PathShape` 신설 (converter/renderCommands/nodeRendererShapes 3파일 분기) + 축·범례·tick 산출 자작. 곡선·회전 부재는 v1 비스코프로 격리.
  - 성능: L — 외부 의존 0, path 파싱은 ADR-153 Picture 캐시 뒤. 200행 상한.
  - 유지보수: **M** — 차트 종류 추가마다 마크 파일 1개 + parity 스냅샷. 라이브러리 upstream 추종 부담은 없음.
  - 마이그레이션: L — 신규 type, 기존 문서 영향 0 (BC 0% / 재직렬화 0 파일).

### 대안 B: Vega scenegraph + 커스텀 Skia renderer (`renderModule`)

- 설명: Vega-Lite spec → Vega scenegraph. DOM 은 Vega SVG renderer, Skia 는 scenegraph item(rect/line/area/symbol/text/path) 을 순회하는 커스텀 renderer 등록 (vega-webgl-renderer 선례).
- 근거: Vega `config` 로 axis/legend/mark/font 전량 제어 가능 (React Spectrum Charts 도 이 위에 있음). 차트 종류 확장성 최고.
- 위험:
  - 기술: **H** — scenegraph item 10여 종 + text/legend layout 을 Skia 로 재현하는 renderer 는 vega-webgl-renderer 규모 (text 는 2D canvas fallback 을 썼음). Vega 의 텍스트 측정이 DOM/canvas 에 의존해 headless 경로가 비동기.
  - 성능: **H** — vega 182KB + vega-lite 87KB gz = 270KB, lazy chunk 로도 publish 번들에 실린다 (HC1 위반).
  - 유지보수: M — Vega 6 major 추종 + renderer 유지.
  - 마이그레이션: L.

### 대안 C: React SVG 라이브러리 (Recharts / visx / Nivo) + SVG 서브셋 → Skia 해석기

- 설명: Preview 는 라이브러리 SVG 그대로, Builder 는 hidden DOM 에 렌더한 SVG 를 순회해 (`g/transform`, `rect`, `path`, `text`, `clipPath`) Skia 로 옮기는 범용 해석기.
- 근거: Recharts 3.10 (148KB gz, shadcn CSS var 테마) · visx 4.0 (모듈 11KB) · Nivo 0.99 (2025-05 이후 정체) 리서치.
- 위험:
  - 기술: **H** — hidden DOM 렌더 → layout → 순회가 비동기·프레임 외부. SVG 서브셋 누락 = 조용한 미렌더. 텍스트 baseline/폰트 메트릭 차이로 대칭 붕괴.
  - 성능: M — DOM thrash + 148KB.
  - 유지보수: **H** — 라이브러리 DOM 구조 변경이 해석기를 깨뜨림 (consumer-to-consumer 결합, `@sync` 금지 패턴과 동형).
  - 마이그레이션: L.

### 대안 D: 2D canvas 래스터 → SkImage (Chart.js / ECharts)

- 설명: offscreen canvas 에 라이브러리가 그리고 `MakeImageFromCanvasImageSource` 로 텍스처 업로드.
- 근거: ECharts 6.1 (canvas/svg, 368KB / tree-shake ~100KB gz) · Chart.js 4.5 (68KB).
- 위험:
  - 기술: M — 텍스처 업로드 인프라 신규 (현재 0건), 비동기.
  - 성능: **H** — 줌마다 재래스터 또는 흐림, VRAM 64MB LRU 압박, 라이브러리 번들.
  - 유지보수: M.
  - 마이그레이션: L.
  - **원칙 위반**: 비트맵은 "시각 결과 동일성" 을 `/cross-check` 로 검증할 수 없고 Skia 전용 표현 (ssot-hierarchy §6).

### 대안 E: Adobe React Spectrum Charts 직접 채택

- 설명: `@adobe/react-spectrum-charts` 1.52 를 internal binding 으로 감싸고 Skia 는 대안 B 와 같은 renderer.
- 근거: Spectrum 디자인 가이드 내장, `colors`/`config`/`renderer` prop.
- 위험:
  - 기술: M — B 와 동일 renderer 필요.
  - 성능: **C** — 자체 313KB + vega 270KB + `@adobe/react-spectrum` v3 런타임 = 600KB+ gz (HC1 단독 초과).
  - 유지보수: **H** — composition 은 RAC 기반인데 RSP v3 를 이중 탑재; 시각 정본이 Spectrum default 위 merge 라 catalog SSOT 역전.
  - 마이그레이션: L.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | M        | L            |     0      |
| B    | H    | H    | M        | L            |     2      |
| C    | H    | M    | H        | L            |     2      |
| D    | M    | H    | M        | L            | 1 (+원칙)  |
| E    | M    | C    | H        | L            |     2      |

루프 판정: A 가 HIGH 0 — 새 대안 추가 불필요. E 의 CRITICAL 은 근본적으로 다른 접근(A: 라이브러리 없이 기하만) 이 이미 표에 있으므로 루프 종료.

## Decision

**대안 A: headless 기하 모듈 (외부 의존 0) + DOM SVG / Skia `PathShape` 이중 consumer** 를 선택한다.

선택 근거 (위험 수용):

1. 기술 M 의 실체는 `PathShape` 3파일 분기 + 기하 자작인데, 전자는 단위 테스트 + live 삼각형 1회로 닫히고 (G1), 후자는 Monitor 패널이 이미 같은 방식으로 운영 중인 규모다. 곡선·회전은 v1 비스코프로 격리해 위험을 키우지 않는다.
2. 유일하게 D3 대칭 원칙 ("두 경로가 동일 SSOT 로부터 동일 시각 결과") 을 **구조로** 만족한다 — 기하 함수가 SSOT, 두 렌더러는 좌표를 복사할 뿐. parity 가 byte-identical 단위 테스트로 검증 가능한 대안은 A 뿐이다.
3. HC1 을 문자 그대로 지킨다 (신규 의존 0). 후속에서 d3-shape 가 필요해지더라도 5.7KB 라 별도 Gate 로 예외 승인할 수 있는 규모다.
4. 데이터·팔레트·등록 경로 전부 기존 계약 (ADR-152/157/159 · catalog rule · internal binding) 재사용 — 신규 개념은 `PathShape` 와 rule 의 chart 채널 2개뿐.

기각 사유:

- **대안 B 기각**: 270KB 가 publish 번들에 실려 HC1 을 구조적으로 위반하고, Skia renderer 구현량이 차트 본체보다 크다. 고급 차트 요구가 실제로 생기면 A 의 scene 계약 위에서 재판정 (breakdown §7).
- **대안 C 기각**: hidden DOM 경유 비동기 + SVG 서브셋 해석기 = consumer-to-consumer 결합 (`@sync` 금지 패턴과 동형). 라이브러리 DOM 변경이 Builder 를 조용히 깨뜨린다.
- **대안 D 기각**: 비트맵은 대칭 검증 불가·줌 흐림·VRAM — ssot-hierarchy §6 "Skia 전용 시각 표현" 위반.
- **대안 E 기각**: 600KB+ 로 HC1 단독 초과, RSP v3 이중 런타임, 시각 정본 역전. 사용자 전제 ("커스터마이징 불가") 는 정정하되 채택 불가 결론은 같다.

D2 판정 기록: RSC 는 `<Chart><Bar/><Axis/><Legend/></Chart>` 조합 모델인데 본 ADR 은 노코드 팔레트용 단일 leaf 로 평탄화 (`chartType` enum + `showAxis`/`showLegend` boolean). prop 명은 RSC 를 그대로 쓰고 (`dimension`/`metric`/`color`/`orientation`/`stackType`←`type`/`legendPosition`←`Legend.position`), 평탄화 근거는 binding 주석에 기록 (R5).

> 구현 상세: [194-chart-component-headless-geometry-breakdown.md](../design/194-chart-component-headless-geometry-breakdown.md) — 전제 lock-in(§1), baseline 실측(§2), 시스템 설계·`PathShape`·binding/rule 표(§3), Phase 0~6(§4), 검증 체크리스트(§5), 위험 매핑(§6), 비스코프(§7)

## Risks

| ID  | 위험                                                                                                                                                                                                       | 심각도 | 대응                                                                                                                                                                                                                                                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | catalog rule 의 chart 전용 visual 채널 (`series[]`/`axis`/`grid`) 을 generate-css 가 CSS var 로 emit 하지 못함 → DOM 이 토큰을 못 받아 비대칭                                                              |  HIGH  | Phase 0 에서 3경로 실측 (G0): rule 정본 `packages/shared/src/catalog/generated/componentRulesTable.ts:17` · 채널 타입 `packages/specs/src/renderers/utils/resolveComponentVisual.ts` (`ComponentVisualRule`) · emit `packages/specs/scripts/generate-css.ts`. 미지원이면 Phase 3 에서 `.react-aria-Chart { --chart-series-N }` emit 확장을 **선행 commit** 으로 반영 |
| R2  | `PathShape` 추가 시 `specShapeConverter`/`renderCommands`/`nodeRendererShapes` 분기 누락 → 조용한 미렌더                                                                                                   |  MED   | converter 단위 테스트 + live 삼각형/arc 1회 (G1). `SkiaNodeData.type` 유니온에 `"path"` 추가로 type-check 가 dispatch 누락을 드러냄                                                                                                                                                                                                                                  |
| R3  | 텍스트 회전 부재로 긴 카테고리 레이블 겹침                                                                                                                                                                 |  LOW   | every-nth 생략 + `maxWidth` ellipsis (TextShape 기존 필드). 회전은 후속 (breakdown §7)                                                                                                                                                                                                                                                                               |
| R4  | 대량 행 → Shape 수 폭발 → 프레임 회귀                                                                                                                                                                      |  MED   | 빌더 행 상한 200 (ADR-157 동형) + 200행×4시리즈 frame p95 측정 (HC6)                                                                                                                                                                                                                                                                                                 |
| R5  | D2 평탄화 (`chartType` enum) 가 RSC 조합 모델과 어긋나 후속 확장 (scatter/이중 축) 시 prop 폭발                                                                                                            |  LOW   | chartType 추가 = 마크 파일 1개; 조합이 정말 필요해지면 reusable(조합) 경로로 승격 판정. binding 주석에 근거 기록                                                                                                                                                                                                                                                     |
| R6  | publish `ComponentRegistry.tsx` 등재 누락 — registration contract test 가 publish 를 포함하지 않으면 조용히 미렌더                                                                                         |  MED   | Phase 0 실측; 미포함이면 publish registry oracle 테스트 추가 (G0 항목)                                                                                                                                                                                                                                                                                               |
| R7  | ADR-152 provider 미배선 (격차 7) 으로 Phase 5 preview 대조 불성립                                                                                                                                          |  LOW   | Phase 5 는 builder 측 + 샘플 fallback 으로 종결 가능; preview 대조는 152 수리 후 residual 로 기록 (ADR-157 G1 동형)                                                                                                                                                                                                                                                  |
| R8  | Skia primitive ctx 에 데이터 행 채널 없음 (`skiaPrimitives.ts:62-68` `{props,size,visual,paint,style}`) → primitive 가 dataBinding 행을 읽을 수 없음                                                       |  MED   | scene-node 층에서 `readDataBindingRows` 결과를 `specProps._chartRows` 로 주입 (`buildSpecNodeData.ts:149-167` `_containerWidth` / `:1698-1712` width injection 동형). primitive 는 `_chartRows ?? props.data` 만 읽음 (breakdown §3-1, review round 1)                                                                                                               |
| R9  | `PathShape` 가 `d` 만 가지면 Skia 노드 width/height 0 → 컬링(`renderCommands.ts:2039-2048`)·`:2119` `cmd.width > 0 \|\| cmd.height > 0` 분기에서 미렌더/캐시 키 붕괴                                       |  MED   | `PathShape.width/height`(bbox) 필수 필드 — 기하 모듈이 계산 (G1 테스트에 bbox 케이스 포함, review round 1)                                                                                                                                                                                                                                                           |
| R10 | `size` prop 이 rule height 를 바꾸는데 layout 무효화 5-심볼 체인 등재 여부 미확인 (`inspectorActions.ts` `LAYOUT_AFFECTING_PROP_KEYS` · `layout/engines/utils.ts` `LAYOUT_PROP_KEYS` 에 `"size"` grep 0건) |  LOW   | Phase 0 (G0) 에서 기존 size 보유 leaf(Button) 의 재레이아웃 경로 실측 → 동일 경로 재사용, 없으면 A·B 양 계층 등재                                                                                                                                                                                                                                                    |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                               | 실패 시 대안                                                                                     |
| ---- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| G0   | Phase 0 종료 | breakdown §2 표 재실측 갱신 commit · generate-css chart 채널 emit 가능 여부 판정 · publish registry 검출 테스트 유무 판정 · 등록 8지점 line 확정 · `size`→layout 무효화 경로 확인 (R10) | emit 불가 → Phase 3 에 emit 확장 선행 commit 추가. gap ≥1.5x → inventory 보강 commit (fork 아님) |
| G1   | Phase 1 종료 | `PathShape` fill/stroke/evenodd/bbox 단위 테스트 PASS · type-check 0 · **live** Skia 삼각형+arc 렌더 1회 스크린샷                                                                       | 노드 `icon_path` 확장으로 대체 (size scale 1 + fill 지원) — 단 lucide 채널 오염 시 금지          |
| G2   | Phase 2 종료 | 기하 스냅샷 테스트 (bar/line/area/pie × orientation × stackType) + niceTicks 경계 (음수/0/단일값/NaN) PASS                                                                              | 경계 실패 케이스를 scene 에 `empty` 상태로 표현 (placeholder 마크)                               |
| G3   | Phase 4 종료 | parity 단위 테스트: 동일 scene → DOM `d`/rect 좌표 == Skia `PathShape.d`/`RectShape` byte-identical · `/cross-check` **live** 4종 bbox Δ ≤ 1px · dark 토글 시 양측 시리즈 색 동일       | 불일치 축 (텍스트 baseline 등) 은 scene 필드 추가로 흡수 — consumer 쪽 보정 금지                 |
| G4   | Phase 6      | `vite build` builder 초기 chunk Δ ≤ +15KB gz · publish Δ ≤ +15KB gz · 200행×4시리즈 frame p95 ≤ baseline +1ms                                                                           | 초과 시 chart 모듈 lazy chunk (팔레트 드롭 시 로드) — 그래도 초과면 Implemented 금지             |
| G5   | Phase 5 종료 | **live**: 팔레트 드롭 → 캔버스 표시 → dataTable 바인딩 → builder 갱신 (preview 대조는 R7 조건부)                                                                                        | 바인딩 실패 시 샘플 fallback 으로 종결 + residual 기록                                           |

## Phase 진행 로그

| Phase | 상태 | 일자 | 결과 |
| :---: | ---- | ---- | ---- |
| 0 | ✅ Implemented | 2026-09-08 | inventory freeze (breakdown §2 재실측, HEAD `795f405b5`). **G0 PASS** — R1 emit 미지원 확정 → `ComponentRule.chart` top-level 채널 신설 + Phase 3 emit 확장 선행 · R6 publish registry 검출 테스트 부재 확정 → Phase 3 oracle 추가 · R8 rows 채널 부재 확정 (주입 지점 `buildSpecNodeData.ts:1760-1766`) · R9 bbox 필수 확정 · **R10 해소** (`editorMutationEffectRegistry.ts:31/96/362` 에 `"size"` 이미 등재 — 초안 grep 은 심볼 이관 전 stale) · ADR-117 Implemented 2026-08-28 (직교 전제 성립). gap 배수 1.0x |
| 1 | ✅ Implemented | 2026-09-08 | `PathShape` (Shape 유니온 13번째, additive) + Skia `path` 노드 + `renderPath` + converter `case "path"`. **G1 PASS** — converter 단위 5 (fill/stroke/evenodd/bbox offset/기본값) + **실제 CanvasKit surface 픽셀 5** (`nodeRendererPath.integration.test.ts` — 삼각형 fill · SVG `A` 호 stroke · evenodd 도넛이 nonzero 와 갈리는 것까지 픽셀로 확인 · offset · 조기 반환). R9 bbox = offset 포함 원점 기준 extent 로 AABB 상위집합 보장. 기존 12 shape·`SkiaPrimitiveDrawFn`·lucide 채널 무변경 |
| 2 | ✅ Implemented | 2026-09-08 | 기하 모듈 `packages/specs/src/chart/` (types·scales·series·marks 4종·axes·legend·computeChartScene, **외부 의존 0**). **G2 PASS** — 43 테스트: niceTicks 경계 (음수/0/단일값/NaN/count≤0 + 무작위 100케이스 유한성) · scene 결정성 (같은 입력 = 같은 scene) · 4종 × orientation 2 × stackType 2 = 16 조합 전 좌표 유한 · `d` 에 NaN/undefined 미출현 · 마크 plot 내포 · empty 5종 · 데이터 해석 (중복 행 합산 · 비수치는 0 아닌 '없음' · line subpath 분할 · 파이 범주 색 · 팔레트 순환) · 스냅샷 4 |
| 3 | ✅ Implemented | 2026-09-08 | 카탈로그 등록 8지점 + **R1 emit 확장** + **R6 publish oracle**. emit: `ComponentRule.chart` top-level 채널 신설 → `.react-aria-Chart { --chart-series-1..8 · --chart-axis · --chart-grid · --chart-stroke-width }` 생성 확인 (다른 93 CSS diff 0). 등록: binding · catalog entry(collections) · rule(variants default/quiet · sizes sm/md/lg · chart 채널) · `PALETTE_ORDER`+oracle · factory `createChartDefinition` · `createDefaultChartProps` · `rendererMap.Chart`+`INTERNAL_RENDERERS.chart` · publish `ComponentRegistry`. R6 oracle `publishRegistryCoverage.test.ts` 는 Chart 등록을 지우면 RED 2 (falsify 확인). ratchet 0/0/0 유지. **scope 조정 (사후 보고)**: DOM consumer `Chart.tsx` 를 Phase 4 에서 앞당김 — 등록만 하고 컴포넌트가 없으면 팔레트에 빈 상자가 나온다 |
| 4 | ✅ Implemented | 2026-09-08 | Skia consumer `chart_scene` primitive (replace) + `_chartRule` 주입 (R8 — `_containerWidth` 와 같은 자리, TokenRef 그대로) + Chart 를 `CONTAINER_DIMENSION_TAGS` 에 등재. **G3 단위 PASS** — `chartParity.test.tsx` 28건이 5 조합 (bar v/dodged · bar h/stacked · line+grid+legend · area · pie+legend) 에서 path `d` **byte 동일** · rect/line 좌표 동일 · text 위치·문자열 동일을 검증. falsify: Skia leg 좌표 +1 → RED 4 (rebuild 후에야 반응 — dist 신선도 조건을 테스트 머리말에 기록). 결함 1건 수리: 초안이 `TextShape.content` 로 써서 **축·범례 텍스트가 통째로 안 그려지는** 상태였고 `as Shape` 캐스팅이 그걸 삼켰다 (필드는 `text`). G3 의 live bbox 대조는 Phase 5 |
| 5 | ✅ Implemented | 2026-09-08 | dataBinding 연결 (Skia: scene-node 층 `_chartRows` · DOM: `useCollectionData` — `useResolvedCollectionItems` 는 행을 label/description 으로 정규화해 임의 필드명을 못 읽는다) + 행 상한 200 (R4) + **G5 live 11/11 PASS**. live 가 잡은 결함 3건 (전부 단위 테스트 통과 상태였다): ① Skia `align:"center"` 는 x 를 무시하고 **컨테이너 중앙** 정렬 → 축 레이블이 전부 상자 한가운데로 몰림 (DOM 은 점 앵커) — 매핑을 `toSkiaTextGeometry` 공용 helper 로 두고 parity 테스트도 앵커 왕복 비교로 정정 ② `Chart.tsx` 가 `react-aria-Chart` base class 를 안 붙여 생성 CSS 전량 미매칭 (internal wrapper 는 자기 base class 를 합성하는 규약) ③ `data` 를 binding `accepts` 에 선언 안 해 `toRacProps` 가 버림 → Preview 만 "No data" (Skia 는 scene props 직독이라 멀쩡 — 한쪽만 깨지는 형태) |


### Live Exercise

**2026-09-08 · Playwright headless (`apps/builder/scripts/adr194-chart-live.mjs`, **19/19 PASS**)** — 격리 프로젝트를 만들어 실제 빌더에서:

1. 컴포넌트 패널 Collections 에 `chart` 노출 → 클릭 → canonical 에 `Chart` 생성.
2. 엔진이 320×240 부여 (layout map), factory 샘플 8행 실림.
3. Skia 가 시리즈 색을 실제 픽셀로 칠함 — 차트 추가 **전** 대조군 대비 Δblue 13,789 · Δpurple 11,004.
4. `chartType` bar → line → pie 전환이 픽셀을 바꿈 (blue 17,277 → 4,494 → 7,982) — prop→렌더 채널과 SVG `A` 호 경로가 live 에서 동작.
5. Compare Mode 로 Preview DOM 대조 — `.react-aria-Chart` 320×240 안에 `rect` 10 · `text` 13 · `line` 2, `--chart-series-1` = `oklch(54.6% 0.245 262.881)` 도달 (R1 emit 확장이 DOM 까지 닿음), `role="img"` + `aria-label="chart"`.

**live 가 잡은 결함 3건** (셋 다 단위 테스트·type-check 통과 상태였다 — 그래서 이 절이 필요하다):

| # | 증상 | 원인 | 수리 |
| - | ---- | ---- | ---- |
| ① | 축 레이블이 전부 상자 한가운데로 몰림 | DOM `textAnchor` 는 **점** 앵커인데 Skia converter 의 `align:"center"` 는 컨테이너 중앙 정렬이라 `x` 가 무시된다. 좌표 숫자만 비교하던 G3 는 **같은 숫자가 다른 뜻**이라 통과했다 | 매핑을 `toSkiaTextGeometry` 공용 helper 로 두고, parity 테스트도 앵커 왕복(`skiaTextAnchorX`)으로 비교 |
| ② | Preview 차트에 생성 CSS 가 전량 미적용 | `Chart.tsx` 가 `react-aria-Chart` base class 를 합성하지 않음 (internal source wrapper 의 공통 규약 — Badge/Icon/ListBox 전수 동일) | 컴포넌트가 base class + `data-variant`/`data-size` 를 직접 부여 |
| ③ | Preview 만 "No data" | `data` 를 binding `accepts` 에 선언하지 않아 `toRacProps` 가 버림. Skia 는 scene-node props 직독이라 멀쩡 — **한쪽만 깨지는** 형태 | `accepts.data` 를 `kind:"items-manager"` 로 선언 (샘플 rows 인라인 편집도 함께 열림) |

**G3 live 4종 bbox (같은 하니스, 최종 19/19 PASS)**: Compare Mode 로 두 leg 을 같은 화면에 두고 chartType 4종 각각에 대해 Preview `.react-aria-Chart` 상자 ↔ Skia layout rect 를 비교 — **Δ 0.00px (4/4)**. Preview 마크 수: bar `rect 10 · line 2 · text 13` · line `path 2 · rect 2 · line 2 · text 13` · area 동일 · pie `path 4 · rect 2 · text 2` (파이는 축이 없어 line 0, text 는 범례 2). 단위 층은 `chartParity.test.tsx` 28건 (path `d` byte 동일 · rect/line 좌표 · text 앵커 왕복).

**성능·번들 (`apps/builder/scripts/adr194-chart-perf.mjs`)**: 200행 × 4시리즈 bar 를 놓고 zoom 드라이버(가시 집합이 매 프레임 바뀌어 캐시에 불리한 쪽)로 4초 측정, 같은 세션의 차트 없는 대조군과 A/B — frame p95 Δ = **+0.2 / +0.6 / −0.2 ms** (3회, 한도 +1ms). 측정 해상도가 ~0.8ms 라 문턱이 잡음 바로 위임을 함께 기록한다. 번들 gz Δ = builder 초기 chunk **+6.71KB** · publish **+5.90KB** (한도 각 +15KB, baseline = 같은 디렉터리 detached checkout `d16c2fecb` 재빌드).

**측정 조건 2건** (재현 시 필수): Skia 캔버스 픽셀은 페이지 안에서 읽을 수 없다 — WebGL `preserveDrawingBuffer:false` 라 `drawImage` 가 빈 화면을 준다 (1차 시도가 그래서 "안 그려졌다" 로 오판했고 스크린샷에는 멀쩡히 있었다). Playwright 스크린샷을 페이지에서 디코드해 분석한다. 그리고 색 분류에서 보라(#8B00FF 계열)는 파랑 조건도 만족하므로 보라를 먼저 판정해야 한다.

## Consequences

### Positive

- 컴포넌트 패널에 `Chart` (bar/line/area/pie) 가 추가되고, Builder Skia 와 Preview/Publish SVG 가 같은 기하 함수 출력을 그린다 — D3 대칭이 단위 테스트로 상시 검증되는 첫 데이터 시각화 컴포넌트.
- `PathShape` 가 Shape 유니온에 들어가면 이후 임의 벡터 형상 (커스텀 아이콘·도형·스파크라인) 도 같은 채널을 쓴다 — lucide 레지스트리에 잠겨 있던 `MakeFromSVGString` 경로가 일반화된다.
- 신규 런타임 의존 0 — 번들·라이선스·upstream 추종 부담 없음. Monitor 패널 mini-chart 도 후속에서 같은 기하 모듈로 수렴 가능.
- 시리즈 팔레트가 catalog 토큰이라 theme/dark 모드 (ADR-193) 와 자동 정합.

### Negative

- 축·범례·tick·stack 을 자작한다 — 차트 종류 확장은 라이브러리 옵션 켜기가 아니라 마크 파일 추가 (`packages/specs/src/chart/marks/*`). 곡선·회전·툴팁은 v1 에 없다.
- Shape 유니온 확장으로 `specShapeConverter.ts` / `renderCommands.ts` / `nodeRendererShapes.ts` / `nodeRendererTypes.ts` 4파일이 늘어난다 (additive).
- `COMPONENT_RULES_TABLE` 에 chart 전용 채널이 생겨 rule 타입 (`ComponentVisualRule`) 과 generate-css 가 한 채널을 더 안다 (R1).
- 등록 8지점 + publish registry 를 모두 갱신해야 팔레트에 나타난다 — 누락은 ratchet/oracle 이 잡지만 작업량은 IconButton(17파일) 급.
