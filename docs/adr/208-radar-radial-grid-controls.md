# ADR-208: radar/radial 제어 prop 과 차트 종류별 조건부 노출

## Status

Proposed — 2026-09-08

## Context

[ADR-207](completed/207-polar-chart-radar-radial.md) 로 radar/radial 을 반영한 뒤, shadcn charts 예제 **70개를 레지스트리 소스에서 전량** 뽑아 다시 대조했다. ADR-207 종결 시점의 판정은 범주 단위("radar 지원 · radial 지원")였는데, 예제 단위로 보니 **radar 14종 중 5종만** 커버되고 있었다. 격자를 끄거나(`grid-none`), 링만 남기거나(`grid-circle-no-lines`), 다각형을 안 채우거나(`lines-only`), 반원 게이지를 만들거나(`radial-stacked`), 값 대신 범주명을 적는(`pie-label-list`) 것이 전부 빠져 있었다.

이 격차를 메우는 데 필요한 것은 새 기하가 아니다. ADR-207 이 만든 극좌표 scene 계약(`AxisScene.grid` 유니온 · `PathMark.role`/`fillRole` · 12시=0 시계 각도 규약) 위에서 **값만 고르면 된다**. 실제로 2026-09-08 에 이 세 축을 구현해 12종을 추가 커버했고 게이트를 전부 통과했으나, ADR 없이 진행한 절차 결함으로 되돌렸다(`018657233` 외 3건). 그 구현과 실측은 남아 있어 본 ADR 의 대안 평가에 근거로 쓴다.

되돌리며 드러난 진짜 문제는 따로 있다. 세 축은 `ChartProps` 에 **prop 7개**를 더한다. Chart binding 의 `accepts` 는 지금 22개(차트 prop 20 + `variant`/`size`)이고, Properties 패널은 이를 **차트 종류와 무관하게 전부** 보여준다. ADR-207 은 이 문제를 스스로 기록해 두었다 — "`gridType` 이 radar 전용인데 모든 차트에 보인다 (조건부 표시는 패널의 별도 축이라 본 ADR 범위 밖)" (`docs/adr/completed/207-polar-chart-radar-radial.md:190`).

**그 서술은 사실과 다르다.** 조건부 표시는 패널의 별도 축이 아니라 binding 의 기존 필드다 — `PropContract.visibleWhen` (`packages/shared/src/catalog/types.ts:212`) 이 `key`/`equals`/`oneOf`/`truthy` 를 받고(`types.ts:184-189`), generic Inspector 가 필드 단위로 평가해 걸러내며(`apps/builder/src/builder/panels/properties/generic/CatalogInspectorFields.tsx:255-257`), 형제 prop 값을 읽어 판정한다(`evaluateVisibility.ts:21,32`). `Card.binding.ts:110` 이 이미 쓰고 있다. Chart binding 만 이 메커니즘을 안 쓴다.

**Hard Constraints**:

1. **scene 계약 무변경** — 새 마크 종류나 `AxisScene` 필드를 추가하지 않는다. 추가가 필요하면 그것은 ADR-207 급의 결정이며 본 ADR 범위 밖이다.
2. **기본값 무변경** — 신규 prop 을 하나도 지정하지 않은 기존 문서는 1px 도 달라지지 않는다 (스냅샷 4종).
3. **번들 예산** — gz builder +5,120 B / publish +2,048 B 이내. 실측 근거: 되돌린 구현이 builder +4,890 B / publish +623 B.
4. **frame 예산** — 200행×4시리즈 p95 Δ ≤ +1ms. 실측 근거: 되돌린 구현이 radar +0.5ms / radial +0.2ms (같은 실행의 대조군 bar 재측정 drift 도 +0.5ms).
5. **두 leg 대칭** — Skia 와 DOM 이 같은 좌표 **와 같은 색 역할**을 낸다. 색 채널 게이트는 `6a34439d1` 로 이미 반영됐다.

6. **생성기 영향 없음** — `visibleWhen` 은 Properties 패널의 표시 축이라 CSS Generator 가 emit 하는 자식 selector·variant 집합을 바꾸지 않는다. 신규 prop 7개도 SVG 기하의 입력일 뿐 `data-*` 부가속성이 아니다 (`Chart.binding.ts:29-31` — propPassthrough 전량 근거). 따라서 "Generator 가 자식 selector/variant emit 을 지원하는가" 질문은 본 ADR 에 해당하지 않는다.
7. **하위 호환 비용 0** — 신규 필드는 전부 선택적이고 기본값이 기존 동작이다. 기존 문서 재직렬화 **0 파일**, 영향받는 사용자 **0%** (마이그레이션 코드 없음). `visibleWhen` 소급 적용도 저장 값이 아니라 표시만 바꾼다.

**Soft Constraints**:

- shadcn 예제 커버리지는 상류(`shadcn-ui/ui@main`) 시점에 의존하는 수치다. 목표가 아니라 격차 발견 도구로 쓴다.
- 남은 격차 20종 중 인터랙티브 6 · 커스텀 렌더 4 는 노코드 단일 leaf 평탄화와 정면으로 상충한다 (ADR-194 R5 가 조합 모델을 기각한 자리). 본 ADR 은 이 둘을 다루지 않는다.

## Alternatives Considered

### 대안 A: 평면 prop 7개 추가 (되돌린 구현 그대로)

- 설명: `showSpokes`·`gridRings`·`fillGrid`·`fillArea`·`startAngle`·`endAngle`·`labelKey` 를 `ChartProps` 와 binding `accepts` 에 그대로 더한다. 패널 노출 방식은 손대지 않는다.
- 근거: Recharts·shadcn 이 `PolarGrid`/`PolarAngleAxis` 의 prop 을 그대로 노출하는 방식이고, 우리 binding 도 ADR-194 이래 평탄화가 기존 어법이다 (`chartType` enum + boolean). 되돌린 구현이 이 대안의 실측 근거를 전부 갖고 있다 — 기하 212 · parity 151 · live 25/25 · 예산 안.
- 위험:
  - 기술: **LOW** — 구현이 이미 검증됐다. scene 계약 무변경.
  - 성능: **LOW** — 실측 builder +4,890 B / frame p95 Δ ≤ +0.5ms.
  - 유지보수: **HIGH** — 패널 항목이 차트 종류와 무관하게 27개가 된다. bar 를 편집하는 사용자가 `gridRings`·`startAngle`·`fillGrid` 를 본다. ADR-207:190 이 이미 지적한 문제를 3.5배로 키운다. 노코드 도구에서 "이 값을 바꿔도 아무 일이 안 일어난다" 는 조용한 혼란이며, 항목이 늘수록 사용자가 유효한 항목을 찾는 비용이 커진다.
  - 마이그레이션: **LOW** — 전부 선택적 필드, 기본값 무변경.

### 대안 B: 어휘 압축 — `gridStyle` enum + `shape` 프리셋

- 설명: boolean 4개를 `gridStyle: "polygon" | "circle" | "none" | "circle-fill" | ...` enum 하나로, 각도 숫자 2개를 `shape: "full" | "half" | "gauge"` 프리셋으로 접는다. prop 은 7개 대신 3개(`gridStyle`·`shape`·`labelKey`).
- 근거: Nivo 가 `gridShape` 단일 enum 을 쓰고, Figma 컴포넌트가 조합을 variant 하나로 접는 어법과 같다. 노코드 사용자에게 스위치 4개보다 이름 붙은 선택지 5개가 읽기 쉽다는 것이 두 도구의 공통 전제다.
- 위험:
  - 기술: **MED** — 조합 폭발을 프리셋이 못 덮는다. `gridRings` 는 임의 정수이고(shadcn `grid-custom` 이 링 개수를 지정한다), `startAngle`/`endAngle` 은 임의 각도다(`radial-shape` 가 그렇다). 프리셋으로 접으면 이 두 예제를 다시 잃는다 — 즉 대안 B 는 목표 12종 중 최소 2종을 처음부터 포기한다.
  - 성능: **LOW** — 코드량은 오히려 준다.
  - 유지보수: **MED** — shadcn/Recharts 어느 쪽과도 이름이 안 맞는 **새 어휘**가 생긴다. 다음 대조 때 "우리 `shape:"gauge"` 가 저쪽 무엇인가" 를 매번 번역해야 하고, ADR-194 이 세운 "prop 명은 RSC 를 그대로 쓴다" 규칙(D2)과도 어긋난다.
  - 마이그레이션: **MED** — 프리셋에 없는 조합이 필요해지는 순간 평면 prop 을 다시 열어야 하고, 그때 두 어법이 공존한다.

### 대안 C: 평면 prop 7개 + 차트 종류별 `visibleWhen` 게이팅

- 설명: 대안 A 의 prop 을 그대로 쓰되, binding 의 각 `PropContract` 에 `visibleWhen: { key: "chartType", oneOf: [...] }` 를 단다. **같은 조건을 기존 prop 7개**(`orientation`·`stackType`·`curve`·`showDots`·`innerRadius`·`gridType`·`showTotal`)**에도 소급 적용**해 ADR-207:190 이 남긴 Negative 를 닫는다. 저장되는 값은 그대로고 패널 표시만 종류별 부분집합이 된다.
- 근거: 우리 카탈로그가 이미 가진 메커니즘이다 — 타입(`types.ts:212`) · 평가기(`evaluateVisibility.ts`) · 운반(`inspectorFields.ts:79`) · 소비(`CatalogInspectorFields.tsx:255-257`) · 선례(`Card.binding.ts:110`) 가 전부 있고 Chart 만 안 쓴다. React Spectrum 의 Inspector 관례(선택된 variant 에 유효한 필드만 노출)와도 같다.
- 위험:
  - 기술: **LOW** — 신규 메커니즘 0. binding 파일 한 개의 선언 추가이며 렌더 경로를 건드리지 않는다.
  - 성능: **LOW** — 대안 A 와 같은 번들·frame, 패널은 렌더할 필드가 오히려 준다.
  - 유지보수: **LOW** — `ChartProps` 표는 27개로 커지지만 **화면에 보이는 것은 종류당 부분집합**이고 새 어휘가 0 이라 shadcn 대조가 그대로 성립한다. 조건 표가 소비 경로와 어긋날 위험은 남으며 이는 R2 로 관리한다.
  - 마이그레이션: **LOW** — 기본값 무변경. 기존 prop 에 소급 적용하는 부분은 저장 값이 아니라 표시만 바꾼다.

### Risk Threshold Check

| 대안                          | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ----------------------------- | :--: | :--: | :------: | :----------: | :--------: |
| A — 평면 prop 그대로          | LOW  | LOW  | **HIGH** |     LOW      |     1      |
| B — 어휘 압축 프리셋          | MED  | LOW  |   MED    |     MED      |     0      |
| C — 평면 prop + `visibleWhen` | LOW  | LOW  |   LOW    |     LOW      |     0      |

루프 판정: HIGH+ 가 없는 대안이 둘(B·C) 이므로 새 대안 추가 없이 진행한다. C 는 4축 전부 LOW 이며, A 의 유일한 HIGH(유지보수)를 **A 의 다른 축을 낮추지 않고** 제거한다 — 즉 C 는 A 의 지배적 개선이지 다른 절충이 아니다.

## Decision

**대안 C: 평면 prop 7개 + 차트 종류별 `visibleWhen` 게이팅**을 선택한다.

선택 근거:

1. **A 의 HIGH 는 prop 개수가 아니라 노출 방식에서 왔다.** 되돌린 구현의 기하·대칭·예산은 전부 통과했고 유지보수만 HIGH 였다. 그 HIGH 의 실체는 "차트 종류와 무관하게 27개가 보인다" 이며, 이는 prop 을 줄이지 않고도 없앨 수 있다. 대안 B 는 HIGH 를 없애려고 표현력(`gridRings` 임의 개수 · 임의 각도)과 어휘 정합성(ADR-194 D2)을 함께 지불한다 — 같은 문제에 더 비싼 값을 치른다.
2. **잔존 위험은 조건 표와 소비 경로의 어긋남 하나(R2)뿐이고, 그것은 기계로 잡을 수 있다.** G2 는 조건 표를 다시 읽는 대신 **prop 을 바꿨을 때 그 종류의 scene 이 실제로 달라지는지**를 잰다 — 달라지는데 숨겨져 있으면 FAIL. 선언을 선언으로 검증하는 순환이 아니다.
3. **ADR-207 이 남긴 Negative 를 같이 닫는다.** 기존 prop 7개에 소급 적용하는 비용이 신규 7개와 같은 선언 한 줄씩이라, 격차를 메우는 작업이 이미 기록된 결함까지 정리한다.

기각 사유:

- **대안 A 기각**: 유지보수 HIGH 를 수용할 이유가 없다. C 가 같은 구현·같은 예산으로 그 HIGH 만 제거한다.
- **대안 B 기각**: 목표 12종 중 `grid-custom`(임의 링 개수)·`radial-shape`(임의 각도) 최소 2종을 프리셋이 표현하지 못한다. 격차를 메우려는 ADR 이 격차를 남기는 대안을 고를 수 없다. 새 어휘가 ADR-194 D2("prop 명은 RSC 를 그대로")와 어긋나는 것도 함께 기각 사유다.

**HIGH 잔존 1건(R2)의 phase 분리 판정**: R2 를 별도 ADR 로 떼어낼 수 있는가 — **없다**. R2 는 `visibleWhen` 을 쓰기로 한 Decision 자체가 낳는 위험이라 결정과 같은 문서에 있어야 한다. 대신 **phase 로 격리**한다 — P1 이 신규 prop 0 으로 R2 만 검사하는 first nail 이고, G2 가 실패하면 P2~P4 착수 전에 Decision 을 대안 A 로 되돌린다. 위험을 나중 phase 에 누적시키지 않는 배치다.

> 구현 상세: [208-radar-radial-grid-controls-breakdown.md](design/208-radar-radial-grid-controls-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |  심각도  | 대응                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 숨긴 prop 의 값은 저장된 채 남아, 종류를 바꿨다 되돌리면 예전 값이 되살아난다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |   LOW    | 의도된 동작이다 — 숨김은 표시 축이지 값 축이 아니며, 값을 지우면 왕복 편집이 작업 손실이 된다. G2 가 왕복 1회를 확인하고 binding 주석에 근거를 남긴다 |
| R2  | 조건 표가 소비 경로와 어긋나 **읽히는데 안 보이는** prop 이 생긴다 (조용한 결함 — 사용자는 편집 수단 자체를 못 찾는다). 관여하는 네 지점: 조건 선언 `packages/shared/src/catalog/bindings/Chart.binding.ts:39` · 운반 `packages/shared/src/catalog/outputs/inspectorFields.ts:79` · 판정 `apps/builder/src/builder/panels/properties/generic/evaluateVisibility.ts:21,32` · 필터 `apps/builder/src/builder/panels/properties/generic/CatalogInspectorFields.tsx:255-257`. 실제 소비는 `packages/specs/src/chart/computeChartScene.ts:152,219,359` 등에 흩어져 있어 어느 지점도 어긋남을 컴파일 시점에 알리지 않는다 | **HIGH** | G2 — 선언 대조가 아니라 차등 오라클: 종류 6종 × prop 전량에 대해 값을 바꿔 scene 이 달라지는지 재고, 달라지는데 숨겨져 있으면 FAIL                    |
| R3  | prop 27개는 여전히 저장·직렬화·registration 8지점을 지난다. `visibleWhen` 은 패널만 줄인다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |   MED    | G3 이 신규 prop 마다 8지점 전부를 기계 확인. 개수 자체의 상한은 두지 않되, 다음 확장에서 다시 7개를 더하게 되면 그때 대안 B 를 재평가한다             |
| R4  | `DataRenderers.renderChart` 가 신규 prop 을 빠뜨려 **문서 로드 경로만** 기본값 차트를 그린다 (Skia 는 scene props 직독이라 캔버스가 알리바이가 된다)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |   MED    | 되돌린 1차에서 실제로 발생했다. G3 의 8지점에 이 파일을 포함하고, live 오라클은 새로 만든 요소가 아니라 **문서를 다시 연 뒤** 확인한다                |
| R5  | 커버리지 수치(45/70)가 상류 시점에 의존해 낡는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |   LOW    | 수치를 Gate 조건으로 쓰지 않는다. 격차 발견 도구로만 쓰고 대조 시점을 문서에 명시                                                                     |

## Gates

| Gate | 시점            | 통과 조건                                                                                                                                                                                                                                                          | 실패 시 대안                                                                                                                            |
| ---- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | P0              | breakdown §2 코드 사실 9건이 실측과 일치하고 §2.2 기준선 4개 값이 재측정과 일치                                                                                                                                                                                    | 사실이 틀렸으면 해당 대안 평가를 다시 한다 (특히 `visibleWhen` 소비 경로 — Decision 의 load-bearing 가정)                               |
| G1   | P1~P4 각 phase  | `AxisScene`·`PathMark`·`Mark` 유니온에 새 종류·새 필드 0. `git diff` 로 `types.ts` 의 유니온 정의부 무변경 확인                                                                                                                                                    | 새 계약이 필요하면 phase 를 멈추고 ADR-207 급 결정으로 분리                                                                             |
| G2   | P1 (first nail) | 차트 종류 6종 × 편집 prop 전량에 대해 **값을 바꿔 scene 이 달라지는 집합** ⊆ **패널에 보이는 집합**. 숨겨졌는데 달라지는 prop 0건. 종류 왕복 1회 후 값 보존 확인                                                                                                   | 어긋난 항목이 있으면 조건 표가 아니라 소비 경로를 먼저 읽고, `visibleWhen` 이 Chart 에서 동작하지 않으면 Decision 을 대안 A 로 되돌린다 |
| G3   | P2~P4 각 phase  | 신규 prop 마다 registration 8지점(카탈로그 · binding `accepts`+`propPassthrough` · rule · 팔레트/오라클 · factory · `createDefaultChartProps` · `rendererMap`/`DataRenderers` · publish registry) 전부 존재. parity 는 색 채널 포함 GREEN 이고 falsify 로 RED 재현 | 누락 지점을 채우기 전에 phase 를 닫지 않는다                                                                                            |
| G4   | P2~P4 각 phase  | 신규 prop 미지정 시 스냅샷 4종 1px 무변경                                                                                                                                                                                                                          | 기본값이 그림을 바꿨으면 기본값을 고친다 (계약 2)                                                                                       |
| G5   | P5              | 번들 gz builder ≤ +5,120 B / publish ≤ +2,048 B · frame p95 Δ ≤ +1ms (같은 실행의 대조군 bar 재측정 drift 병기)                                                                                                                                                    | 예산 초과 시 `labelKey` 축(P4)을 먼저 분리해 별도 판정                                                                                  |

## Consequences

### Positive

- shadcn 예제 커버리지가 33 → 45종(70 중). radar 는 5/14 → 11/14.
- `Chart.binding.ts` 의 Properties 패널이 차트 종류별 부분집합만 보여, bar 를 편집하는 사용자가 극좌표 전용 항목을 보지 않는다. ADR-207:190 이 기록한 Negative 가 닫힌다.
- `visibleWhen` 이 Chart 에서 검증되면 다른 다형 binding(향후 chartType 추가, 조건부 prop 을 가진 컴포넌트)이 같은 경로를 쓴다 — 새 인프라 없이 선례가 하나 늘어난다.
- `ChartLabelFormatter` 중앙화(P4)로 마크 빌더 6개에서 `formatTick` 직접 호출이 사라져, 레이블 내용 규칙이 한 곳에 모인다.

### Negative

- `ChartProps` 가 20 → 27 필드가 된다. 패널에서 보이지 않을 뿐 직렬화·registration·타입 표면에는 전부 남는다 (R3). 다음 확장에서 다시 대폭 늘면 대안 B 재평가가 필요하다.
- `visibleWhen` 조건 표가 `computeChartScene` 의 소비와 **두 곳에 나뉘어** 산다. 둘의 정합은 타입이 아니라 G2 오라클이 지킨다 — ADR-207 이 `AxisScene.grid` 유니온에서 겪은 "컴파일 신호 없음" 과 같은 형태의 부담이 하나 늘어난다.
- radar 의 `stackType` 무시(ADR-207 R8)가 이제 패널에서 **항목이 사라지는** 형태로 보인다. 값은 남아 있으므로, radar 에서 안 보이던 `stackType` 이 bar 로 바꾸면 예전 값으로 되살아나는 것이 사용자에게 놀라움이 될 수 있다 (R1 — 값 보존을 택한 결과).
- 되돌린 커밋 4개를 다시 반영하는 작업이라 diff 대부분은 새로 쓰이지 않는다. 그럼에도 `visibleWhen` 부여와 P1 의 소급 적용 때문에 **그대로 되살릴 수는 없고**, phase 마다 재검증이 필요하다.
