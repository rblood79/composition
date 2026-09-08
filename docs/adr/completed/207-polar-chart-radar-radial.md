# ADR-207: 극좌표 차트 — radar · radial (ADR-194 기하 SSOT 의 극좌표 확장)

## Status

Implemented — 2026-09-08 (리뷰 round 1 이슈 7건 전부 fixed, pending 0 — `docs/adr/reviews/207.md`)

### 진행 로그

| Phase | 상태 | 날짜 |
| --- | --- | --- |
| P0 인벤토리 freeze · baseline | Implemented | 2026-09-08 |
| P1 극좌표 축 (`polar.ts` · `AxisScene` 가산 확장 · 두 consumer 결선) | Implemented | 2026-09-08 |
| P2 radar 마크 + `gridType` | Implemented | 2026-09-08 |
| P3 radial 마크 (트랙 + 값 호 + 누적) + 극좌표 툴팁 | Implemented | 2026-09-08 |
| P4 결선 (binding enum · `gridType` · factory 기본값 · 범례 축 · 문서 로드 경로) | Implemented | 2026-09-08 |
| P5 게이트 (parity 4 · CanvasKit 픽셀 1 · 번들·프레임 · live 17/17 · 문서) | Implemented | 2026-09-08 |

## Context

[ADR-194](194-chart-component-headless-geometry.md) 로 차트 4종 (bar/line/area/pie) 을 반영하고, 2026-09-08 shadcn/ui charts 대조로 누적·보간·점·값 레이블·도넛·툴팁을 후속 확장했다 (ADR-194 §후속 확장). 남은 격차는 **radar (예제 14) · radial (예제 6)** 둘뿐이다.

**본 ADR 이 별도로 서는 이유** — ADR-194 가 스스로 확장/분리 기준을 써 뒀다:

> chartType 추가 비용은 마크 파일 1개(`packages/specs/src/chart/marks/*`)이므로 평탄화가 확장을 막지 않는다.
> — `packages/shared/src/catalog/bindings/Chart.binding.ts` (ADR-194 R5 근거)

radar/radial 은 이 기준을 넘는다. 현행 `AxisScene` 은 `axis: "x" | "y"` 이고 `grid: LineMark[]` 인데 (`packages/specs/src/chart/types.ts:154-162`), radar 의 동심원·다각형 격자는 **선이 아니라 path** 라 담을 수 없다. 즉 마크 파일 추가가 아니라 **두 consumer 가 함께 읽는 scene 계약의 변경**이다. 방금의 후속 확장 5건이 전부 선택적 필드 추가였던 것과 갈리는 지점이다.

**확장 표면은 둘이다** (리뷰 round 1): ① `AxisScene` (위), ② `TooltipScene.center` (`types.ts:206` — 단일 `{x,y,outer,inner}`). 누적 radial 은 같은 각도에 시리즈가 반지름으로 쌓여 각도만으로 히트가 안 갈리므로 링별 반지름 밴드가 필요하다. ②는 스냅샷 4가 전부 `showTooltip=false` 라 **좌표 스냅샷의 감시 밖**이며, `tooltip.test.ts` 12건이 그 축의 감시자다 (G1 통과 조건에 반영).

**SSOT domain**: 본 ADR 은 **D3 (시각 스타일) 단독**이다. D1 은 ADR-194 가 부여한 `role="img"` 를 그대로 쓰고 (새 ARIA 작성 0), D2 는 Recharts/RSC prop 명을 참조한다 (`gridType` ← `PolarGrid.gridType`). SSOT 경계 이동 없음.

**base / 응용**: ADR-194 = base (기하 SSOT · `PathShape` · 대칭 consumer, Implemented), 본 ADR = 응용 + base schema 의 가산 확장. 의존 방향은 단방향이며 역전 가능성 없음 (fork 4 질문 lock-in: design breakdown §1).

**선차단 점검** (`.claude/rules/adr-writing.md` §반복 패턴 선차단):

- **Generator 확장 여부**: 본 ADR 은 `CSSGenerator` / `generate-css` 를 **건드리지 않는다**. 극좌표 마크도 색을 인덱스로 싣고 `--chart-series-N` 으로 받으므로 `generateChartVariables` (`packages/specs/src/renderers/CSSGenerator.ts:1030`) 의 emit 집합이 그대로다 — 자식 selector·variant emit 요구가 새로 생기지 않는다.
- **하위 호환 수식화**: 기존 프로젝트의 차트 요소는 `chartType` 이 기존 4종 중 하나이고 저장 스키마(canonical props)가 바뀌지 않는다 → **영향 0% · 재직렬화 0 파일**. 신규 prop `gridType` 은 미지정 시 `CHART_DEFAULT_PROPS` 기본값으로 접힌다.
- **fork 사유**: 추정 vs 실측 gap 을 분리 사유로 쓰지 않았다. 사유는 위의 scene 계약 변경 하나다 (M3 회피).

**Hard Constraints**:

1. **신규 런타임 의존 0** — ADR-194 HC1 승계. d3-shape / recharts 도입 금지, 극좌표 스케일도 자작한다.
2. **`ChartScene` 확장은 가산적** — 기존 4종 (bar/line/area/pie) 의 좌표가 **1 byte 도 바뀌지 않아야** 한다. 스냅샷 4 + 대칭 parity 64 가 갱신 없이 GREEN 이어야 한다.
3. **두 leg 대칭 유지** — path `d` byte 동일 계약 (ADR-194 G3) 을 극좌표 마크에도 그대로 적용한다.
4. **번들** — builder / publish 각각 **+5KB gz 이내**. ADR-194 의 한도 +15KB 중 이미 각 +6.71 / +5.90KB 를 썼으므로 잔여는 +8.3 / +9.1KB 이고, 그 잔여를 한 번에 다 쓰지 않도록 **잔여의 약 60%** 를 상한으로 잡았다 (남은 shadcn 격차 — 그라디언트·범례 아이콘·상호작용 — 몫을 남긴다).
5. **프레임** — 200행 × 4시리즈에서 p95 **Δ ≤ +1ms** (ADR-194 G4 동형, 불리 케이스 = 줌 드라이버).

**Soft Constraints**:

- Skia `TextShape` 에 회전 필드가 없다 (`packages/specs/src/types/shape.types.ts` — `rotat` 검색 0건). 원 둘레 레이블이 회전을 요구하면 Shape 계약까지 열어야 한다.
- 팔레트는 단일 leaf 평탄화 (ADR-194 R5) — `chartType` enum 으로 종류를 가른다. Recharts 처럼 `RadarChart`/`RadialBarChart` 를 별 컴포넌트로 두는 모델과 갈린다.
- 참조 표면은 shadcn/ui charts 20 예제 (radar 14 · radial 6). radar 는 `PolarGrid`+`PolarAngleAxis`+`Radar`, radial 은 `RadialBar`+`PolarRadiusAxis` 조합이다.

## Alternatives Considered

### 대안 A: `AxisScene` 가산 확장 (`axis` 유니온 + `grid: Array<LineMark | PathMark>`)

- 설명: 축 개념을 하나로 유지한 채 담을 수 있는 것만 넓힌다. `axis: "x"|"y"|"angular"|"radial"`, `grid` 가 path 도 받는다. 극좌표 스케일은 `polar.ts` 신설, 마크는 `marks/radar.ts` · `marks/radial.ts`.
- 근거: **d3-shape** 는 `line`/`area` 에 `lineRadial`/`areaRadial` 을 더할 뿐 축 타입을 나누지 않는다 — 좌표계만 바꾸는 모델. **Vega-Lite** 도 `theta`/`radius` 를 채널로 확장하지 별도 스펙 타입을 만들지 않는다. 우리 scene 은 이미 "마크 + 축 + 범례" 3분할이라 같은 확장이 자연스럽다.
- 위험:
  - 기술: **L** — 소비처는 2곳뿐이고 (`packages/specs/src/renderers/skiaPrimitives.ts:3510` `pushMark(line)` · `packages/shared/src/components/Chart.tsx:185` `renderMark(line, …)`) **둘 다 이미 `Mark` 를 받는 generic 렌더러로 넘긴다** — 유니온을 넓혀도 코드 변경이 **0줄**이다 (리뷰 round 1 실측: 유니온 1줄 확장 후 `pnpm type-check` 0 error). 뒤집으면 **컴파일 신호도 0** 이라는 뜻이므로, 방어는 컴파일러가 아니라 스냅샷 4 + parity 64 + P1 의 `chartType` exhaustive switch 가 한다 (R1·R7).
  - 성능: **L** — 마크 수만 늘어난다 (격자 원 N개). 기존 경로 비용 변화 0.
  - 유지보수: **L** — 축이 한 타입으로 남아 향후 축 관련 변경이 한 곳이다.
  - 마이그레이션: **L** — 가산이라 기존 4종 코드·좌표 무변경. 스냅샷이 감시자.

### 대안 B: `PolarAxisScene` 별도 타입 + `ChartScene.polarAxes?`

- 설명: 기존 `axes` 는 손대지 않고 극좌표 축을 새 필드·새 타입으로 둔다.
- 근거: **Recharts** 가 실제로 이 모델이다 — `XAxis/YAxis` 와 `PolarAngleAxis/PolarRadiusAxis` 가 별 컴포넌트다. 직교축 코드를 전혀 건드리지 않는다는 안전성이 있다.
- 위험:
  - 기술: **L** — 기존 타입 무변경.
  - 성능: **L**.
  - 유지보수: **H** — 같은 뜻("축") 이 두 타입으로 갈린다. 두 consumer (`packages/specs/src/renderers/skiaPrimitives.ts` `chartScene` 의 `for (const axis of scene.axes)` · `packages/shared/src/components/Chart.tsx` `renderChartScene` 의 같은 순회) 가 `axes` 와 `polarAxes` 를 **둘 다 순회**해야 하고, 축에 무언가 더할 때마다 (예: 축 제목, 눈금 서식) 두 곳을 고쳐야 한다. Recharts 는 JSX 조합 모델이라 타입이 갈려도 사용자가 조합하지만, 우리는 scene 하나를 두 consumer 가 순회하는 구조라 분기 비용이 그대로 남는다.
  - 마이그레이션: **L**.

### 대안 C: 스키마 무변경 — 격자·축을 `marks` 배열에 밀어 넣기

- 설명: `AxisScene` 을 손대지 않고, 스포크·격자·레이블을 전부 `scene.marks` 앞쪽에 push 한다. 두 consumer 는 이미 marks 를 4종으로 그리므로 **코드 변경 0**.
- 근거: **Observable Plot** 은 극좌표를 지원하지 않고 사용자가 좌표를 직접 변환하게 둔다 — 축 개념을 만들지 않는 극단. 가장 적은 변경으로 화면을 얻는다.
- 위험:
  - 기술: **L** — 변경 자체가 없다.
  - 성능: **L**.
  - 유지보수: **H** — 격자와 데이터가 한 배열에 섞여 **"이 마크가 격자인가"** 를 배열 순서로만 알 수 있다. `showGrid` 토글 (`packages/specs/src/chart/axes.ts` `buildAxes`), 툴팁 히트 대상 판정 (`chart/tooltip.ts` `hitTooltipBand`), 컬링 (`apps/builder/src/builder/workspace/canvas/skia/specShapeConverter.ts` 의 path bbox), 향후 격자 전용 스타일이 전부 순서 의존이 된다. ADR-194 가 축·범례를 마크와 분리해 둔 이유를 되돌리는 방향이다.
  - 마이그레이션: **L**.

### 대안 D: Chart 와 분리된 별도 컴포넌트 (`RadarChart` 를 팔레트에 따로 등록)

- 설명: `chartType` 확장 대신 새 컴포넌트를 만든다.
- 근거: Recharts/RSC 의 컴포넌트 분리 모델. 극좌표 전용 prop (`gridType` 등) 이 직교 차트 패널에 안 섞인다.
- 위험:
  - 기술: **M** — 등록 8지점 (catalog·binding·rule·PALETTE_ORDER·factory·defaults·rendererMap·publish registry) 을 통째로 반복.
  - 성능: **L**.
  - 유지보수: **H** — 같은 데이터 prop (`dimension`/`metric`/`color`/`dataBinding`) 을 두 컴포넌트가 각자 소유한다 (`packages/shared/src/catalog/bindings/Chart.binding.ts` `accepts` 14개를 복제, `apps/builder/src/types/builder/unified.types.ts` `createDefaultChartProps` 도 복제). ADR-194 R5 의 단일 leaf 평탄화 결정을 번복하는 것이라, 되돌린다면 그 근거가 무엇이 달라졌는지부터 필요하다 — 지금 달라진 것은 없다.
  - 마이그레이션: **M** — 사용자가 "차트" 를 놓을 때 컴포넌트를 먼저 고르게 된다 (노코드 조작 단계 증가).

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A `AxisScene` 가산 확장 |  L   |  L   |    L     |      L       |   **0**    |
| B 극좌표 축 별도 타입 |  L   |  L   |    H     |      L       |     1      |
| C 스키마 무변경 (marks 로) |  L   |  L   |    H     |      L       |     1      |
| D 별도 컴포넌트 |  M   |  L   |    H     |      M       |     1      |

루프 판정: **A 가 HIGH 0** 으로 임계를 통과하므로 새 대안 추가 없이 종료한다. 선택안에 HIGH+ 가 없으므로 "이 Phase 를 별도 ADR 로 분리해야 하는가" 질문도 해당 없다 — 분리 판정은 본 ADR 자체의 fork 4 질문에서 이미 끝났다 (breakdown §1).

## Decision

**대안 A: `AxisScene` 가산 확장**을 선택한다.

선택 근거:

1. **잔존 위험이 전부 L 이고, 그 L 을 기계가 지킨다.** 유니온 확장의 유일한 실질 위험(소비처 누락)은 TypeScript 가 전수 검출하고, 기존 4종 무변경(HC2)은 갱신 금지 스냅샷 4 + parity 64 가 감시한다 — 사람이 지키는 규율이 아니다.
2. **축 개념이 하나로 남는다.** B/C 는 지금 싸지만 "축" 의 정의를 둘로 쪼개거나(B) 없애서(C) 이후 모든 축 작업에 분기 비용을 남긴다. 본 저장소가 반복해서 치른 비용이 정확히 그 형태다 (consumer-to-consumer 참조 / 정본 이원화).
3. **극좌표 재료가 이미 있다.** `polar()` · `arcSlicePath()`(evenodd 고리) · `buildRadialTooltip()` · `stackBands()` 가 pie/도넛 작업에서 나왔다. A 는 이 재료를 그대로 쓰는 유일한 안이다 — D 는 새 컴포넌트로 갈라 재사용을 끊는다.

기각 사유:

- **대안 B 기각**: 축이 두 타입으로 갈려 두 consumer 가 둘 다 순회하게 되고, 축 관련 변경이 영구히 2배가 된다. Recharts 의 분리는 JSX 조합 모델의 산물이라 scene 순회 모델인 우리에게 이유가 승계되지 않는다.
- **대안 C 기각**: "격자냐 데이터냐" 판정이 배열 순서에만 남는다. 스키마를 안 건드린다는 이점은 회피이지 설계가 아니며, `showGrid`·툴팁 히트·컬링이 모두 순서에 묶인다.
- **대안 D 기각**: ADR-194 R5 의 단일 leaf 평탄화를 번복할 새 근거가 없고, 등록 8지점 반복 + 데이터 prop 이원화 비용을 새로 만든다.

**축 레이블 회전 판정 (ADR-194 비스코프 재시험)**: 원 둘레 레이블은 앵커 3종 × baseline 3종의 **6방향 배치로 충분**하다 — Recharts `PolarAngleAxis` 기본 tick 도 회전을 쓰지 않는다. 따라서 `TextShape` 회전 신설은 본 ADR 범위 밖이며 ADR-194 의 비스코프를 유지한다.

> 구현 상세: [207-polar-chart-radar-radial-breakdown.md](../design/207-polar-chart-radar-radial-breakdown.md) — 전제 lock-in(§1), 코드 사실 표(§2), 타입 델타·극좌표 스케일·마크·축(§3), Phase 0~5(§4), 검증 체크리스트 + 측정 5-질문(§5), 위험 매핑(§6), 비스코프(§7)

## Risks

| ID  | 위험 | 심각도 | 대응 |
| --- | ---- | :----: | ---- |
| R1  | `grid` 유니온 확장이 두 consumer 의 기존 순회를 건드려 직교 차트가 회귀 | MED | **컴파일러는 이 확장에 신호를 주지 않는다** (round 1 실측: 유니온 확장 후 type-check 0 error — 소비처가 이미 generic). 방어는 스냅샷 4 **갱신 금지** + parity 64 + `tooltip.test.ts` 12 GREEN 유지 (G1) |
| R2  | 극좌표에서 음수 값 → 반지름 음수 → 도형이 중심을 뚫고 반대편에 그려짐 | MED | `radiusScale` 의 domain 하한을 0 으로 clamp. pie 의 "절대값" 규약과 **다른 선택**임을 기하 주석에 명시하고 G2 에서 반지름 음수 0건 단언 |
| R3  | radar 다각형의 결측 꼭짓점 규약이 line/area 의 "끊기" 와 갈린다 | MED | 다각형은 닫힌 도형이라 subpath 를 나눌 수 없다 → 결측은 반지름 0(중심) 으로 접는다. 규약 차이를 기하 주석 + G2 케이스로 고정 |
| R4  | radial 각도 범위(startAngle/endAngle) prop 증식 | LOW | v1 은 0~360 고정. shadcn 의 반원 형태는 비스코프 (breakdown §7) |
| R5  | 번들·프레임 예산 초과 | MED | G4 에서 측정. 초과 시 radial 을 후속 phase 로 미루고 radar 만 반영 |
| R6  | 등록 경로 미결선 — enum 값만 늘고 렌더가 안 바뀜 | MED | G5 live 에서 Skia 픽셀 + Preview DOM 양쪽 확인 (ADR-194 live 가 잡은 결함 3건이 전부 이 형태였다) |
| R7  | `computeChartScene` 의 마지막 분기가 `else` (line) 라 (`computeChartScene.ts:296-325`), 신규 `chartType` 을 추가하고 분기를 안 넣으면 **line 차트가 조용히 그려진다**. G2 의 유한성·결정성은 line 도 통과시켜 못 잡는다 | MED | P1 에서 `chartType` **exhaustive switch** (`never` 소진) 도입 — R1 이 잃은 컴파일러 방어선을 여기서 되찾는다. G1 통과 조건 |
| R8  | 기존 prop × 신규 타입 조합이 조용히 무응답 (`orientation`·`curve`·`showDots`·`colorBy`·`stackType` 이 radar/radial 에서 뭘 하는지 미정) | MED | 타입별 **무시 계약을 테스트로 고정** — 선례 `labels.test.ts:120` ("line 은 colorBy 를 무시한다"). G2 케이스 |
| R9  | 극좌표 각도 레이블 솎아내기 부재 — `labelStride` (`axes.ts:35`) 는 band step 기준이라 극좌표에 안 쓰인다. 범주가 많으면 (`CHART_SAMPLE_ROWS` 200) 스포크·레이블이 겹친다 | LOW | 각도 간격 기준 stride 를 P1 축 산출에 포함. G2 에 범주 50 케이스 |

## Gates

| Gate | 시점 | 통과 조건 | 실패 시 대안 |
| ---- | ---- | --------- | ------------ |
| G0 | P0 종료 | 기존 4종 baseline 기록 (스냅샷 4 · parity 64 · 기하 106 · 번들 gz 현재값) | 기록 없이 P1 진입 금지 |
| G1 | P1 종료 | 기존 4종 좌표 **byte 무변경** (스냅샷 4 갱신 없이 GREEN) + `tooltip.test.ts` 12 GREEN (스냅샷 밖 축) + `chartType` exhaustive switch 도입 (R7) + type-check 0 | 확장을 가산이 아닌 형태로 했다는 뜻 — 설계 되돌림. **컴파일 통과 자체는 통과 근거가 아니다** (R1) |
| G2 | P2·P3 종료 | radar/radial 기하 단위: 경계 4종 유한성 · 결정성 · 반지름 음수 0건 · `d` 에 NaN/Infinity 0건 · **무시 계약** (R8 — 무관 prop 이 좌표를 안 바꾼다) · **범주 50 레이블 겹침** (R9) | 해당 마크 phase 미종결 |
| G3 | P4 종료 | 대칭 parity 케이스 4 추가 (radar polygon/circle · radial 단일/누적), path `d` **byte 동일** | 대칭 위반 — 어느 leg 이 기하를 안 따랐는지 조사 |
| G4 | P5 | 번들 각 앱 +5KB gz 이내 · 200행×4시리즈 frame p95 Δ ≤ +1ms (줌 드라이버 불리 케이스 + 차트 추가 전 대조군) | radial 을 후속으로 분리 (R5) |
| G5 | P5 | live: 팔레트 전환 → Skia 픽셀 변화 + Preview DOM 격자/호 확인. **Skia 픽셀은 Compare Mode 를 끄고 먼저 측정** | Implemented 승격 차단 |

### Gate 실측 (2026-09-08)

| Gate | 결과 | 근거 |
| ---- | ---- | ---- |
| G0 | PASS | 기하 106 · parity 64 · 스냅샷 4 · 번들 gz builder 1,758,730 B / publish 502,756 B (breakdown §4) |
| G1 | PASS | 스냅샷 4 갱신 0 (git status 변경 없음) · tooltip 12 GREEN · exhaustive switch 도입, 원복 RED 로 `TS2322` 확인 · type-check 0. **집행 게이트는 `pnpm -F @composition/specs build` (dts)** — `pnpm type-check` 는 specs 를 돌지 않는다 (breakdown F18) |
| G2 | PASS | radar 20 · radial 17 — 경계 4종 · 결정성 · 반지름 음수 0 · `d` 에 NaN/Infinity 0 · 무시 계약 (orientation/curve/colorBy/stackType, `stackType` 은 원복 RED 로 비-vacuous 확인) · 범주 50 레이블 솎아내기 |
| G3 | PASS | parity 64 → **84** (극좌표 4 케이스 × 5). falsify: DOM leg 이 격자 path 를 빠뜨리게 하면 radar 2건 RED — 게이트가 비어 있지 않다. CanvasKit 실픽셀 1건 추가 (다각형 stroke · 트랙 고리) |
| G4 | PASS | 번들 gz **builder +2,454 B / publish +2,160 B** (예산 각 5,120 B). frame p95 Δ (200행×4시리즈, 줌 드라이버, 워밍업 arm 폐기, 대조군 = bar): **radar −0.200 ms · radial +0.300 ms**, 대조군 재측정 drift +0.200 ms — 두 Δ 모두 예산 안이고 run 잡음(±0.2 ms) 규모 |
| G5 | PASS | live 17/17 — 아래 §Live Exercise |

### Live Exercise

**2026-09-08 · Playwright 하니스** (`apps/builder/scripts/adr207-polar-chart-live.mjs`, headless, CPU throttle 1x) — 실제 빌더에 프로젝트를 만들고 팔레트에서 Chart 를 놓은 뒤 `chartType` 을 바꿔 가며 두 leg 을 같이 잰다. Skia 픽셀은 **Compare Mode 를 끄고 전체 폭에서 먼저** 재고 (Compare Mode 는 캔버스를 반폭으로 줄여 면적 변화를 지운다), DOM 은 그 뒤 Compare Mode 로 본다.

결과 **17/17 PASS** (`/private/tmp/adr207-polar-live/result.json`):

- **enum 이 실제로 도달**: bar → radar → radial 로 Skia 픽셀 해시가 갈린다 (1283359972 → 840917088 → 1348193692). 등록만 되고 렌더가 안 바뀌는 형태(R6)가 아니다.
- **`gridType` 이 그림을 가른다**: Skia 해시 840917088 → 1232462363. DOM 에서 polygon 격자 `d` 에는 호 명령 `A` 가 없고 circle 격자에는 있다 — 개수는 6으로 같다 (같은 눈금 수, 다른 모양).
- **격자 `PathMark` 가 두 leg 에 도달**: Preview DOM 에 격자 path 6 + 스포크 `line` 4. `AxisScene.grid` 유니온 확장이 실제로 지나간다.
- **radial 트랙**: `--chart-grid` 로 **채워진** path 4개, 시리즈 fill path 7개, 극좌표 축 0 · `line` 0 (트랙이 격자 노릇). 누적 전환 시 해시 1348193692 → 695418593.
- **툴팁 히트가 반지름으로 갈린다**: 같은 12시 각도에서 `y` 만 바꾸니 `MonA12B20` → `WedA18B25`. 각도만으로는 못 가르는 축(round 1 이슈 #5)이 실제로 동작한다.

live 1차 실행(15/16)이 잡은 결함 1건: radial **트랙이 선으로만** 그려져 두께 있는 고리가 동심원 2개로 읽혔다. `PathMark.fillRole` 가산 필드로 축 토큰 채우기를 분리해 수리 (두 leg 동시). 단위·parity 테스트는 이 결함을 통과시켰다 — 좌표가 옳았기 때문이다.

## Consequences

### Positive

- shadcn/ui charts 7 범주 중 미반영이 0 이 된다 (툴팁 세부 변형·상호작용 변형 제외).
- `packages/specs/src/chart/polar.ts` 가 생기면서 `marks/pie.ts` 안에 갇혀 있던 `polar()` 가 공용 계층으로 올라온다 — pie/도넛/radar/radial 이 같은 각도 규약(12시=0, 시계)을 공유한다.
- `AxisScene.grid` 가 path 를 받게 되면서, 앞으로 곡선 격자·비직교 축이 필요할 때 스키마를 다시 열지 않아도 된다.
- 두 consumer 의 코드 변경이 **0줄**이라 (round 1 실측), 대칭 계약을 새로 검증할 표면이 늘지 않는다 — 늘어나는 것은 기하 쪽뿐이다.

### Negative

- `AxisScene.grid` 의 유니온화는 **컴파일 신호를 남기지 않는다** — 소비처가 generic 이라 아무 곳도 갱신을 요구받지 않고, 따라서 앞으로 grid 에 새 마크 종류를 넣어도 소비처가 조용히 통과한다. 회귀 감시가 타입이 아니라 테스트에만 걸린다.
- `ChartProps` 에 `gridType` 이 늘어 Properties 패널 항목이 하나 더 붙는다 (radar 전용인데 모든 차트에 보인다 — 조건부 표시는 패널의 별도 축이라 본 ADR 범위 밖).
- radar 의 결측값 규약(중심으로 접기)이 line/area 의 규약(끊기)과 달라, 차트 종류를 바꾸면 같은 데이터가 다르게 읽힌다. 규약 차이를 문서와 테스트로만 고정한다.
