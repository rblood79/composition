# ADR-217: Chart 기준선 (ReferenceLine) · 산점도 (Scatter)

## Status

Proposed — 2026-09-12 (ADR-216 후속 — 사용자가 216 범위 선택 시 "ReferenceLine · Scatter 는 후속" 으로 미룬 두 항목. 분리 4질문 lock-in: [breakdown §1](design/217-chart-reference-line-scatter-breakdown.md#1-범위--선행-관계-분리-4질문-lock-in))

## Context

차트 (ADR-194 → 210 → 211 → 215 → 216) 는 bar/line/area/pie/radar/radial 6종과 시간축 · 표시 예산 · 팔레트를 갖췄다. 대시보드에서 자주 쓰이는 두 가지가 아직 없다:

1. **기준선** — 목표 · 임계 · 평균을 값 축 위 가로선 하나로 보이는 것. 지금은 상수 시리즈를 데이터에 넣는 우회뿐이며 (line 만 가능, 범례 · 툴팁에 시리즈로 섞인다) bar 는 방법이 없다.
2. **산점도** — 두 수치 (x, y) 의 분포. 지금 격자는 "범주 × 시리즈 → 값 (같은 범주 합산)" 이라 (`packages/specs/src/chart/series.ts:105-118`) 같은 x 의 점 두 개가 하나로 합쳐지고, x 는 문자열 범주다. 216 이 연속 x (`SeriesGrid.positions` · `positionBand`) 를 line/area 에 열어 두어 산점도의 x 스케일은 이미 있다.

**SSOT 3-domain**: 새 props 는 **D2** (RSC `ReferenceLine` `value/label/lineType/layer` · `Scatter` `dimension/metric/color` — 이름 · 기본값을 RSC 에서 가져오고 Recharts 전용 이름 (`ifOverflow` · `segment`) 은 두지 않는다). 기하 · 색 채널은 **D3** (`packages/specs/src/chart` scene + rule `chart` 채널 토큰 — Skia 와 DOM 이 같은 마크를 그린다). **D1** 은 건드리지 않는다 — Preview 의 점 hover 는 Recharts `Scatter` 가 이미 갖는 runtime 상호작용이며 Skia 는 정적이다.

**Generator · BC 선언**: rule `chart` 채널은 CSSGenerator 가 `--chart-axis/grid/others` 로 emit 하고 Skia 가 같은 채널을 읽는다 (`CSSGenerator.ts:1041-1046` · `skiaPrimitives.ts:3459-3461`) — 새 `chart.reference` 는 같은 3곳 확장이며 자식 selector/variant emit 은 필요 없다. BC: 새 props 미설정 = 현행이라 **기존 문서 영향 0% · 재직렬화 0 파일**; 구버전 dist 는 `referenceLines` 를 무시하고 `chartType:"scatter"` 문서를 설정 오류 표시로 렌더한다 (데이터 보존 — G3 T12 프로브).

**Hard Constraints**:

1. **HC1 기존 문서 byte 동일** — `referenceLines` 미설정 · `chartType` 6종 문서의 scene JSON 이 지금과 byte 동일 (specs chart 기존 454 테스트 무변경 통과).
2. **HC2 D2 어법** — props 이름 · 기본값은 RSC (`referenceLineSpec.types.ts:20-41` · `scatterSpec.types.ts:19-41` · `constants.ts:24 DEFAULT_DIMENSION_SCALE_TYPE = 'linear'`). Recharts 전용 개념 (`ifOverflow` · `segment` · `Scatter.line`) 도입 0.
3. **HC3 domain 은 scene 이 정한다** — 기준선 값을 포함한 값 축 domain 을 `model.ts` 한 자리에서 정하고 두 leg 는 그 `ticks.domain` 만 읽는다 (Recharts `ReferenceLine` · `ifOverflow="extendDomain"` 사용 0 — 축을 두 번 계산하지 않는다).
4. **HC4 두 leg 동일** — 같은 크기에서 기준선 `y` · 라벨 좌표 · 산점도 점 중심 · 눈금 문자열이 Skia scene 과 DOM 속성에서 byte 동일 (`chartParity` +6).
5. **HC5 번들** — initial 순증 Builder ≤ 3 KiB / Preview ≤ 3 KiB gzip, 절대 상한 216 승인값 (Builder 1,322,929 / Preview 660,197, 만료 2026-10-12) 안. Recharts `Scatter` 는 lazy 청크에만 (initial 청크에 심볼 0). 측정은 216 절차 (clean worktree before/after · `--dist` 절대 경로).
6. **HC6 성능** — scatter 20k 행 × S4 모델 p95 ≤ 20 ms (216 line 12.4 ms 와 같은 하니스) · Builder 프레임 Δ p95 ≤ 1 ms · 점 ≤ P (5,000) 는 211 예산이 지킨다.
7. **HC7 Canvas 정적** — Skia 에 상호작용 0 (기준선 편집은 패널, 점 hover 는 Preview).
8. **HC8 방어선 RED** — 신규 `chartType` 은 `computeChartScene.ts:479-483 assertNever` 와 `budget.ts:174-177 throw` 를 **먼저 RED** 로 만들고 GREEN 으로 닫는다 (211 R7 계약 — 조용히 line 으로 그려지는 경로 0).

**Soft Constraints**:

- 신규 문자열은 ko/en (`chart.*` i18n) · 어휘 규칙 (`~/.claude/CLAUDE.md`).
- 기준선 라벨의 자리 (plot 안 · 축 위) 는 D3 우리 결정 — RSC 그림을 픽셀로 복제하지 않는다.
- 두 기능은 독립이다 — 기준선을 먼저 닫아 커밋 가능 상태를 유지한다 (규모: 기준선 소 · 산점도 중).

## Alternatives Considered

### 대안 A: scene 소유 — 기준선은 마크 + domain, 산점도는 공용 격자 위 점 (Recharts 는 그리기만)

- 설명: (기준선) `referenceLines[]` → validator → `valueExtent ∪ {value}` 로 domain 확장 (`model.ts:247-251`) → `LineMark role:"reference" dash?` + 라벨 `TextMark` 를 scene 이 `layer` 에 따라 grid 뒤/마크 뒤에 싣는다 → Skia 는 `LineShape.strokeDasharray` (이미 렌더됨 — `specShapeConverter.ts:470-473`), DOM 은 `backdrop`/`foreground` Customized 그룹의 `<line stroke-dasharray>` 로 그린다. 색은 rule `chart.reference` 채널 (211 `others` 와 같은 3곳). (산점도) `chartType:"scatter"` 가 `buildSeriesGrid` 에 "행 = 범주" 분기 (합산 0) 를 열고 `positions = x` (linear 는 `toFiniteNumber`, time 은 216 파서) → `resolveCategoryBand` linear 분기 → 마크는 `buildDotMarks` (시리즈당 path 1) → 예산 · 창 · 극값은 211/216 그대로 → DOM 은 Recharts `ScatterChart` + 시리즈당 `Scatter` 로 **같은 좌표를 그리기만** 한다 (x/y 축 domain 은 scene 값, 점 shape 는 `dotRadius`).
- 근거: RSC 는 Scatter 를 집계 없는 행 = 점 (`scatterSpecBuilder.ts addData` — time 변환만) · linear 기본으로 두고, ReferenceLine 은 축 자식 (`axisReferenceLineUtils.ts getPositionEncoding` = `scale(value)`). 216 이 같은 방식으로 x 를 연속화했고 (`computeChartScene.ts:608-625`) DOM 의 line/area x 축은 이미 `type="number"` + 명시 domain (`RechartsChart.tsx:633-648`) — 새 스케일 종류 · 새 UI 부품 없음. ADR-194 R5 가 "chartType 추가 = 마크 파일 1개" 를 예정.
- 위험:
  - 기술: M — Recharts `ScatterChart` 안에서 `Customized` 두 그룹 · 명시 domain · custom `shape` 가 line/area 와 같이 동작하는지 spike 1건 필요 (G0). `dimensionScale` 미설정을 scatter 에서 linear 로 해석하는 규칙이 종류 의존이다 (문서화 + 패널 라벨).
  - 성능: L — 기준선 마크 ≤ 8 (4 × 2) · 산점도 마크 = S (subpath 점 ≤ P). 모델 비용은 line 과 같은 O(rows) (합산 Map 이 사라져 오히려 적다).
  - 유지보수: L~M — chartType 열거 지점 20곳 (breakdown §2.1) 을 한 번에 채워야 한다; 컴파일 방어선은 2곳뿐이라 나머지는 테스트로 (G2).
  - 마이그레이션: L — 새 props 미설정 = 현행 (HC1). 구버전 dist 는 `referenceLines` 무시 · `chartType:"scatter"` 는 "Check chart settings" (데이터 보존 — T12 프로브).

### 대안 B: Recharts 위임 — DOM 은 `<ReferenceLine ifOverflow="extendDomain">` · 산점도는 전용 점 모델 + `ScatterChart`

- 설명: 기준선을 Recharts 컴포넌트로 그리고 Skia 는 scene 이 따로 낸 선을 그린다. 산점도는 `SeriesGrid` 와 별개의 `PointGrid` (x, y 배열) 를 만들고 Recharts `ScatterChart` 에 원본 행을 준다.
- 근거: Recharts 문서 그대로 (shadcn 예제 어법). 구현 시작이 가장 빠르다.
- 위험:
  - 기술: **H** — domain 을 Recharts (`extendDomain`) 와 scene (`niceTicks`) 이 각자 정해 눈금이 갈린다 — 216 이 "domain 은 scene" 으로 닫은 자리를 되연다. Recharts 의 domain 확장은 nice 하지 않다 (값 그대로) → Skia 눈금과 불일치가 정상 동작이 된다.
  - 성능: L — 같은 마크 수.
  - 유지보수: **H** — 산점도 전용 모델은 211 예산 · 창 · 극값 · 216 시간축 · 레이아웃 · 툴팁을 두 번째로 갖는다 (병렬 모델 = 이후 모든 차트 ADR 이 두 번 반영).
  - 마이그레이션: L — 저장 props 는 A 와 같다.

### 대안 C: 기능 없이 우회 — 기준선은 상수 시리즈 행, 산점도는 line + `showDots` + 선 숨김 옵션

- 설명: 기준선은 사용자가 데이터에 `target` 열을 넣고 columns 모드 시리즈로 그린다. 산점도는 line 에 `showLine:false` 류 옵션을 더해 점만 남긴다.
- 근거: 코드가 가장 적다 (옵션 1 + 문서).
- 위험:
  - 기술: M — bar 에는 상수 시리즈가 막대로 그려져 기준선이 될 수 없다; line 은 같은 x 를 합산하므로 산점도가 아니다 (중복 x 점이 사라진다 — `series.ts:168-186`).
  - 성능: L.
  - 유지보수: M — 범례 · 툴팁 · 팔레트에 기준선이 시리즈로 섞인다 (사용자가 매번 숨긴다).
  - 마이그레이션: **H** — `showLine` 은 RSC 에 없는 prop (D2 위반, ADR-062 규약) 이고 나중에 진짜 scatter 를 넣으면 두 표현이 공존한다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | L    | L~M      | L            |     0      |
| B    | H    | L    | H        | L            |     2      |
| C    | M    | L    | M        | H            |     1      |

루프 판정: A 가 HIGH 0 — 새 대안 추가 불요. CRITICAL 없음.

## Decision

**대안 A: scene 소유 (기준선 = 마크 + domain · 산점도 = 공용 격자 위 점, Recharts 는 그리기만)** 를 선택한다.

선택 근거:

1. 기술 M 은 spike 1건 (G0) 으로 닫힌다 — `ScatterChart` 도 line/area 와 같은 `Customized` · 명시 domain 어법이고, 실패하면 `LineChart` + `Line stroke="none"` 로 같은 좌표를 그리는 폴백이 있다 (툴팁 어법만 달라진다 — G0 실패 시 대안).
2. 유지보수 L~M (열거 20곳) 은 HC8 방어선 RED + G2 의 6종 byte 동일 테스트가 누락을 잡는다 — 216 이 같은 열거를 이미 한 번 늘렸다 (`dimensionScale` 결선 9곳).
3. domain 을 scene 이 정하면 (HC3) 기준선이 항상 보이고 두 leg 눈금이 같다 — RSC 와 다른 점 (RSC 는 domain 을 넓히지 않고 `Axis.range` 에 맡긴다) 은 breakdown §2.2 에 명시한다.

기각 사유:

- **대안 B 기각**: domain 이중 계산 (기술 H) 은 216 이 닫은 "축은 scene" 결정의 회귀이고, 산점도 전용 모델 (유지보수 H) 은 이후 모든 차트 ADR 을 두 번 반영하게 한다.
- **대안 C 기각**: bar 기준선 불가 · 중복 x 합산 (산점도 아님) · `showLine` 은 RSC 미규정 prop (D2 위반). 우회는 기능이 아니다.

> 구현 상세: [217-chart-reference-line-scatter-breakdown.md](design/217-chart-reference-line-scatter-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                  | 심각도 | 대응                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Recharts `ScatterChart` 가 `Customized` 그룹 · 명시 domain · custom `shape` 를 line/area 와 다르게 다뤄 DOM 좌표가 scene 과 어긋난다                  |  MED   | G0 spike (Chromium 1건) 로 먼저 확인; 실패 시 `LineChart` + `Line stroke="none"` 폴백 (좌표 동일, 툴팁만 index 어법) — HC4 는 유지                                                                                                     |
| R2  | `dimensionScale` 미설정 = scatter 에서 `linear` 해석 — 같은 저장 값의 뜻이 종류마다 다르다                                                            |  MED   | `ResolvedDimensionSettings.scale` 에만 `"linear"` (저장 enum 은 2 그대로) + 패널 라벨 "숫자/시간" + 문서화; chartType 전환이 `{chartType}` 만 patch 하는 현행 (`ChartAuthoringControls.tsx:60`) 에서 오류 상태를 만들지 않는 유일한 길 |
| R3  | chartType 열거 20곳 중 컴파일이 못 잡는 곳 (패널 목록 · binding `visibleWhen` · 예산 컨트롤) 누락 → scatter 에서 휴면 컨트롤이 보이거나 옵션이 빠진다 |  MED   | breakdown §2.1 열거 표를 P3/P4 체크리스트로; live 하니스가 scatter 패널 컨트롤 집합을 단언 (G4)                                                                                                                                        |
| R4  | 산점도 "행 = 범주" 격자에 211 극값이 bucket 별 min/max 로 점을 고른다 — 중복 x 점 · 이상치가 남는 것은 의도이나 밀집 구간이 성기게 보인다             |  LOW   | 기본 extrema 는 line 과 같은 계약 (§2.3); 창 (window) 으로 원본 점을 볼 수 있다. 밀도 표현 (binning) 은 범위 밖으로 기록                                                                                                               |
| R5  | 기준선 domain 확장이 값 눈금을 바꿔 값 라벨 · 막대 높이가 달라 보인다 (설정한 문서만)                                                                 |  LOW   | HC1 (미설정 byte 동일) · 손계산 oracle (G1) · CHANGELOG 에 사용자-가시 기재                                                                                                                                                            |
| R6  | 기준선 라벨이 값 라벨/눈금과 겹친다                                                                                                                   |  LOW   | 라벨은 선 끝 안쪽 (anchor end · 위) 한 자리 — 겹침 회피 규칙은 두지 않는다 (RSC 도 30px 규칙 하나뿐); live 로 대표 케이스 확인                                                                                                         |
| R7  | initial 번들 순증 (기준선 마크 + 산점도 모델 코드가 initial 에 든다)                                                                                  |  MED   | HC5 3 KiB / 3 KiB + 절대 상한; 초과 시 산점도 x 축 눈금 코드를 216 시간 모듈처럼 같은 청크에 두고 재측정, 그래도 초과면 사용자 재승인 (216 선례)                                                                                       |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점  | 통과 조건                                                                                                                                                                              | 실패 시 대안                                                                                     |
| ---- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| G0   | P0    | inventory 줄 인용 재확인 · `ScatterChart` + `Customized` + 명시 domain + custom `shape` spike PASS (Chromium) · before 번들 기록 · Accepted                                            | spike 실패 → `LineChart` + `Line stroke="none"` 폴백으로 설계 정정 (breakdown §2.3 갱신) 후 진행 |
| G1   | P1    | 기준선 손계산 oracle 3 (domain 위/아래/안) · 미설정 문서 scene byte 동일 · 진단 3종 RED→GREEN                                                                                          | oracle 불일치 → domain 규칙 수정 (scene 한 자리)                                                 |
| G2   | P3    | 산점도 손계산 oracle (중복 x · 파싱 실패 · time x) · HC8 방어선 2 RED→GREEN · 6종 문서 byte 동일 · 5,000 점 ≤ P                                                                        | 격자 분기 수정; 예산 초과면 211 모드 표 재판정                                                   |
| G3   | P2·P4 | chartParity 기준선 +4 · 산점도 +2 byte 동일 · T12 구버전 dist 프로브 (기준선 무시 · scatter 는 설정 오류 표시, 데이터 보존)                                                            | 좌표 불일치 → DOM 이 scene 값을 그대로 쓰는지 (Recharts 재계산 경로) 추적 후 수정                |
| G4   | P5    | live 하니스 (실제 빌더): 기준선 추가 → Skia 픽셀 (neutral 가로선) · Preview `<line>` dash/라벨 · scatter 팔레트 생성 → 점 8 · 창 트랙 · 패널 편집 canonical write 1 · 임시상태 write 0 | 실패 항목은 결함 — Implemented 승격 금지                                                         |
| G5   | P5    | 모델 p95 scatter 20k × S4 ≤ 20 ms · 프레임 Δ ≤ 1 ms · 번들 순증 ≤ 3/3 KiB + 절대 상한 안 · lazy 청크에만 `Scatter` · 5-질문 기록                                                       | 번들 초과 → 청크 배치 조정 재측정 → 사용자 재승인 (216 선례); 성능 초과 → 격자 분기 프로파일     |

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- 대시보드 목표선 · 임계선을 bar/line/area/scatter 4종에서 값 하나로 놓을 수 있고, 두 leg 가 같은 눈금 위에 같은 선을 그린다 (`packages/specs/src/chart/marks/referenceLine.ts` 한 파일 + rule 채널 1).
- 산점도가 216 의 연속 x (`positions` · `resolveCategoryBand`) 와 211 예산 · 창을 그대로 상속한다 — 새 모델 · 새 UI 부품 0. 이후 `size` (버블) · 추세선은 같은 격자 위의 후속이다.
- `LineMark.dash` 가 생겨 이후 장식 (평균선 · 밴드) 도 같은 어법으로 늘릴 수 있다.

### Negative

- chartType 열거 지점이 20곳 → 21곳으로 늘어나며 (`Chart.binding.ts` · `budget.ts` · 패널 5 파일 …) 다음 종류 추가도 같은 sweep 을 요구한다 (194 R5 의 "조합 경로 승격" 판정은 아직 하지 않는다).
- `dimensionScale` 의 해석이 종류 의존이 됐다 (scatter 미설정 = linear) — 패널 라벨과 문서로만 드러난다.
- 기준선 domain 확장은 RSC 와 다른 결정 — RSC 그림과 1:1 대조하는 사람은 눈금 차이를 본다 (breakdown §2.2 명시).
- initial 번들이 최대 6 KiB 늘고 216 절대 상한의 여유를 쓴다 (다음 차트 ADR 은 재승인 가능성).
