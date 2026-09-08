# ADR-208: radar/radial 제어 prop 과 차트 종류별 조건부 노출

## Status

Implemented — 2026-09-09 (리뷰 round 1 승인 — `docs/adr/reviews/208.md`, pending 0 · HIGH/MED 전부 fixed. P0~P5 반영: `f53e1385a` · `882e958c5` · `78f5313c9` · `f491d979b` · `2e4c02a25`)

## Context

[ADR-207](207-polar-chart-radar-radial.md) 로 radar/radial 을 반영한 뒤, shadcn charts 예제 **70개를 레지스트리 소스에서 전량** 뽑아 다시 대조했다. ADR-207 종결 시점의 판정은 범주 단위("radar 지원 · radial 지원")였는데, 예제 단위로 보니 **radar 14종 중 5종만** 커버되고 있었다. 격자를 끄거나(`grid-none`), 링만 남기거나(`grid-circle-no-lines`), 다각형을 안 채우거나(`lines-only`), 반원 게이지를 만들거나(`radial-stacked`), 값 대신 범주명을 적는(`pie-label-list`) 것이 전부 빠져 있었다.

이 격차를 메우는 데 필요한 것은 새 기하가 아니다. ADR-207 이 만든 극좌표 scene 계약(`AxisScene.grid` 유니온 · `PathMark.role`/`fillRole` · 12시=0 시계 각도 규약) 위에서 **값만 고르면 된다**. 실제로 2026-09-08 에 이 세 축을 구현해 12종을 추가 커버했고 게이트를 전부 통과했으나, ADR 없이 진행한 절차 결함으로 되돌렸다(`018657233` 외 3건). 그 구현과 실측은 남아 있어 본 ADR 의 대안 평가에 근거로 쓴다.

되돌리며 드러난 진짜 문제는 따로 있다. 세 축은 `ChartProps` 에 **prop 7개**를 더한다. Chart binding 의 `accepts` 는 지금 22개(차트 prop 20 + `variant`/`size`)이고, Properties 패널은 이를 **차트 종류와 무관하게 전부** 보여준다. ADR-207 은 이 문제를 스스로 기록해 두었다 — "`gridType` 이 radar 전용인데 모든 차트에 보인다 (조건부 표시는 패널의 별도 축이라 본 ADR 범위 밖)" (`207-polar-chart-radar-radial.md:190`).

**그 서술은 절반만 맞다.** 조건부 표시는 패널의 별도 축이 아니라 **binding 의 기존 필드**다 — `PropContract.visibleWhen` (`packages/shared/src/catalog/types.ts:212`) 이 `key`/`equals`/`oneOf`/`truthy` 를 받고(`types.ts:184-189`), 평가기 `evaluateVisibility` 가 형제 prop 값을 읽어 판정하며(`apps/builder/src/builder/panels/properties/generic/evaluateVisibility.ts:21,32`), `Card.binding.ts:110` 이 이미 선언해 두었다. 어휘도 배관도 이미 있다.

**그러나 지금 이 배관은 live 패널에 닿지 않는다** (리뷰 round 1 실측). 현재 Properties 뷰의 경로는 `PropertiesPanel.tsx:138` `useEditContract` → `resolveEditContract` → `ResolvedField[]` → `GenericFieldRenderer` (`PropertiesPanel.tsx:240,261`) 인데,

- `ResolvedField` 에 `visibleWhen` 필드가 **없고** (`packages/shared/src/catalog/resolvers/resolveEditContract.ts:58-79` — `min`/`max`/`step`/`options`/`itemsManager` 는 운반하면서 이것만 빠졌다), 실제 생성부도 복사하지 않는다 (`resolveEditContract.ts:335-349`).
- `evaluateVisibility` 호출부는 `CatalogInspectorFields.tsx:256` 과 `GenericPropertyEditor.tsx:93,146` **둘뿐이고 양쪽 다 죽은 경로**다 — 전자는 주석이 스스로 "레거시 Inspector" 라 부르고(`useOwnerCollectionColumns.ts:26`), 후자는 저장소 어디에서도 import 되지 않는다.

즉 `Card.binding.ts:110` 의 `visibleWhen` 도 **현재 화면에서 아무 일도 하지 않는다**. 따라서 본 ADR 은 "선언만 추가하면 되는" 작업이 아니라 **평가기를 live 경로에 잇는 결선 3파일**(`resolveEditContract` 운반 · `ResolvedField` 필드 · `GenericFieldRenderer` 필터)을 먼저 치르는 작업이다. 이 비용은 아래 대안 C 의 기술 위험에 반영돼 있다.

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
- 근거: 우리 카탈로그가 **어휘와 평가기를 이미 갖고 있다** — 타입(`types.ts:212`) · 평가기(`evaluateVisibility.ts`, `oneOf` 포함 6조건) · 선언 선례(`Card.binding.ts:110`). 없는 것은 live 경로 결선 하나뿐이고(위 Context), 그 결선은 `ResolvedField` 가 이미 `options`/`itemsManager` 를 운반하는 것과 **같은 자리에 한 필드를 더하는** 형태다. React Spectrum 의 Inspector 관례(선택된 variant 에 유효한 필드만 노출)와도 같다.
- 위험:
  - 기술: **MED** — 신규 **어휘**는 0 이지만 신규 **결선**이 있다. `ResolvedField` 에 `visibleWhen` 을 더하고(`resolveEditContract.ts:58-79`), 생성 3곳(primitive `accepts` `:335-349` · reusable `propsSchema` `:310-324` · ref fallback)이 복사하게 하고, `GenericFieldRenderer` 가 필드 목록을 거르게 해야 한다. 이 결선은 Chart 만이 아니라 **모든 catalog 컴포넌트의 패널**을 지나므로 회귀 표면이 binding 한 개보다 넓다 (당장 `Card.isSelected` 가 조건부로 바뀐다). 렌더 경로(Skia/DOM)는 건드리지 않는다.
  - 성능: **LOW** — 대안 A 와 같은 번들·frame, 패널은 렌더할 필드가 오히려 준다.
  - 유지보수: **LOW** — `ChartProps` 표는 27개로 커지지만 **화면에 보이는 것은 종류당 부분집합**이고 새 어휘가 0 이라 shadcn 대조가 그대로 성립한다. 조건 표가 소비 경로와 어긋날 위험은 남으며 이는 R2 로 관리한다.
  - 마이그레이션: **LOW** — 기본값 무변경. 기존 prop 에 소급 적용하는 부분은 저장 값이 아니라 표시만 바꾼다. 결선 이후 `Card.isSelected` 가 실제로 숨겨지는 것은 원래 선언된 의도의 복구이지 동작 변경이 아니다.

### Risk Threshold Check

| 대안                          | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ----------------------------- | :--: | :--: | :------: | :----------: | :--------: |
| A — 평면 prop 그대로          | LOW  | LOW  | **HIGH** |     LOW      |     1      |
| B — 어휘 압축 프리셋          | MED  | LOW  |   MED    |     MED      |     0      |
| C — 평면 prop + `visibleWhen` | MED  | LOW  |   LOW    |     LOW      |     0      |

루프 판정: HIGH+ 가 없는 대안이 둘(B·C) 이므로 새 대안 추가 없이 진행한다. C 는 A 의 유일한 HIGH(유지보수)를 제거하는 대신 기술축을 LOW→MED 로 올린다 — live 경로 결선이 실재하는 비용이기 때문이다. **HIGH 를 MED 로 바꾸는 교환**이며, 그 MED 는 P1 이 신규 prop 0 으로 먼저 치러 실패 시 대안 A 로 되돌릴 수 있는 자리에 배치했다.

## Decision

**대안 C: 평면 prop 7개 + 차트 종류별 `visibleWhen` 게이팅**을 선택한다.

선택 근거:

1. **A 의 HIGH 는 prop 개수가 아니라 노출 방식에서 왔다.** 되돌린 구현의 기하·대칭·예산은 전부 통과했고 유지보수만 HIGH 였다. 그 HIGH 의 실체는 "차트 종류와 무관하게 27개가 보인다" 이며, 이는 prop 을 줄이지 않고도 없앨 수 있다. 대안 B 는 HIGH 를 없애려고 표현력(`gridRings` 임의 개수 · 임의 각도)과 어휘 정합성(ADR-194 D2)을 함께 지불한다 — 같은 문제에 더 비싼 값을 치른다.
2. **잔존 위험 둘 다 기계로 잡을 수 있다.** 조건 표와 소비 경로의 어긋남(R2)은 G2 가 조건 표를 다시 읽는 대신 **prop 을 바꿨을 때 그 종류의 scene 이 실제로 달라지는지**를 재서 잡는다 — 달라지는데 숨겨져 있으면 FAIL, 선언을 선언으로 검증하는 순환이 아니다. live 경로 결선의 회귀(R6)는 결선 자체가 `Card.isSelected` 라는 **이미 선언돼 있으나 죽어 있던 조건**을 되살리므로, 그 한 건이 곧 결선의 live 오라클이 된다.
3. **ADR-207 이 남긴 Negative 를 같이 닫는다.** 기존 prop 7개에 소급 적용하는 비용이 신규 7개와 같은 선언 한 줄씩이라, 격차를 메우는 작업이 이미 기록된 결함까지 정리한다.
4. **결선을 지금 치르는 것이 미루는 것보다 싸다.** `visibleWhen` 은 이미 타입·평가기·선언 선례가 있는데 live 경로만 끊긴 상태다 (Context). 이 상태를 그대로 두면 다음 binding 작성자도 선언을 쓰고 동작하지 않는 것을 모른 채 지나간다 — 실제로 `Card.binding.ts:110` 이 그렇게 남아 있다. 결선 3파일은 본 ADR 이 아니어도 언젠가 치를 비용이며, Chart 가 그것을 요구하는 첫 실사용처다.

기각 사유:

- **대안 A 기각**: 유지보수 HIGH 를 수용할 이유가 없다. C 가 같은 구현·같은 예산으로 그 HIGH 만 제거한다.
- **대안 B 기각**: 목표 12종 중 `grid-custom`(임의 링 개수)·`radial-shape`(임의 각도) 최소 2종을 프리셋이 표현하지 못한다. 격차를 메우려는 ADR 이 격차를 남기는 대안을 고를 수 없다. 새 어휘가 ADR-194 D2("prop 명은 RSC 를 그대로")와 어긋나는 것도 함께 기각 사유다.

**HIGH 잔존 1건(R2)의 phase 분리 판정**: R2 를 별도 ADR 로 떼어낼 수 있는가 — **없다**. R2 는 `visibleWhen` 을 쓰기로 한 Decision 자체가 낳는 위험이라 결정과 같은 문서에 있어야 한다. 대신 **phase 로 격리**한다 — P1 이 신규 prop 0 으로 R2 만 검사하는 first nail 이고, G2 가 실패하면 P2~P4 착수 전에 Decision 을 대안 A 로 되돌린다. 위험을 나중 phase 에 누적시키지 않는 배치다.

> 구현 상세: [208-radar-radial-grid-controls-breakdown.md](../design/208-radar-radial-grid-controls-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |  심각도  | 대응                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | 숨긴 prop 의 값은 저장된 채 남아, 종류를 바꿨다 되돌리면 예전 값이 되살아난다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |   LOW    | 의도된 동작이다 — 숨김은 표시 축이지 값 축이 아니며, 값을 지우면 왕복 편집이 작업 손실이 된다. G2 가 왕복 1회를 확인하고 binding 주석에 근거를 남긴다                                                                                                                          |
| R2  | 조건 표가 소비 경로와 어긋나 **읽히는데 안 보이는** prop 이 생긴다 (조용한 결함 — 사용자는 편집 수단 자체를 못 찾는다). 관여하는 네 지점: 조건 선언 `packages/shared/src/catalog/bindings/Chart.binding.ts:39` · 운반 `packages/shared/src/catalog/outputs/inspectorFields.ts:79` · 판정 `apps/builder/src/builder/panels/properties/generic/evaluateVisibility.ts:21,32` · 필터 `apps/builder/src/builder/panels/properties/generic/CatalogInspectorFields.tsx:255-257`. 실제 소비는 `packages/specs/src/chart/computeChartScene.ts:152,219,359` 등에 흩어져 있어 어느 지점도 어긋남을 컴파일 시점에 알리지 않는다 | **HIGH** | G2 — 선언 대조가 아니라 차등 오라클: 종류 6종 × prop 전량에 대해 값을 바꿔 scene 이 달라지는지 재고, 달라지는데 숨겨져 있으면 FAIL                                                                                                                                             |
| R3  | prop 27개는 여전히 저장·직렬화·registration 8지점을 지난다. `visibleWhen` 은 패널만 줄인다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |   MED    | G3 이 신규 prop 마다 8지점 전부를 기계 확인. 개수 자체의 상한은 두지 않되, 다음 확장에서 다시 7개를 더하게 되면 그때 대안 B 를 재평가한다                                                                                                                                      |
| R4  | `DataRenderers.renderChart` 가 신규 prop 을 빠뜨려 **문서 로드 경로만** 기본값 차트를 그린다 (Skia 는 scene props 직독이라 캔버스가 알리바이가 된다)                                                                                                                                                                                                                                                                                                                                                                                                                                                                |   MED    | 되돌린 1차에서 실제로 발생했다. G3 의 8지점에 이 파일을 포함하고, live 오라클은 새로 만든 요소가 아니라 **문서를 다시 연 뒤** 확인한다                                                                                                                                         |
| R6  | live 경로 결선(`ResolvedField.visibleWhen` 운반 + `GenericFieldRenderer` 필터)이 **모든 catalog 컴포넌트의 Properties 패널**을 지난다. 잘못 거르면 무관한 컴포넌트의 필드가 사라진다 (`packages/shared/src/catalog/resolvers/resolveEditContract.ts:310-324,335-349` 세 생성부 + `apps/builder/src/builder/panels/properties/generic/GenericFieldRenderer.tsx`)                                                                                                                                                                                                                                                     |   MED    | `visibleWhen` 미선언 필드는 `evaluateVisibility` 가 `if (!condition) return true` 로 즉시 통과시킨다 (`evaluateVisibility.ts:8`) — 현재 선언은 저장소 전체에서 `Card.binding.ts:110` 한 건뿐이라 결선의 실제 노출면은 그 한 필드다. G2 가 Chart 6종 + Card 1건을 같이 확인한다 |
| R7  | 조건 판정을 **원시 `props[key]`** 로 하면 기본값이 저장 안 된 노드에서 값이 `undefined` 가 되어 `oneOf` 가 전부 거짓이 된다 — 유효한 필드가 통째로 사라진다. `createDefaultChartProps` 는 `chartType:"bar"` 를 쓰지만(`apps/builder/src/types/builder/unified.types.ts:2201`) pencil import·수기 canonical 문서는 보장되지 않는다                                                                                                                                                                                                                                                                                   |   MED    | 판정 입력을 `ResolvedField.currentValue`(= override ?? contract.default, `resolveEditContract.ts:343`) 로 고정한다. P1 의 결선 계약에 명시하고, G2 오라클에 `chartType` 미저장 노드 1건을 넣는다                                                                               |
| R5  | 커버리지 수치(45/70)가 상류 시점에 의존해 낡는다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |   LOW    | 수치를 Gate 조건으로 쓰지 않는다. 격차 발견 도구로만 쓰고 대조 시점을 문서에 명시                                                                                                                                                                                              |

## Gates

| Gate | 시점            | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                      | 실패 시 대안                                                                                                                            |
| ---- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| G0   | P0              | breakdown §2 코드 사실 표가 실측과 일치하고 §2.2 기준선 4개 값이 재측정과 일치. **사실 표는 live 경로(`PropertiesPanel`→`useEditContract`→`GenericFieldRenderer`)와 죽은 경로(`CatalogInspectorFields`/`GenericPropertyEditor`)를 구분해 적었는가** — 파일 단위 인용이 live 여부를 가리면 이 게이트가 공허하게 통과한다 (round 1 실제 사례)                                                    | 사실이 틀렸으면 해당 대안 평가를 다시 한다 (특히 `visibleWhen` 소비 경로 — Decision 의 load-bearing 가정)                               |
| G1   | P1~P4 각 phase  | `AxisScene`·`PathMark`·`Mark` 유니온에 새 종류·새 필드 0. `git diff` 로 `types.ts` 의 유니온 정의부 무변경 확인                                                                                                                                                                                                                                                                                | 새 계약이 필요하면 phase 를 멈추고 ADR-207 급 결정으로 분리                                                                             |
| G2   | P1 (first nail) | ① 차트 종류 6종 × 편집 prop 전량에 대해 **값을 바꿔 scene 이 달라지는 집합** ⊆ **패널에 보이는 집합**. 숨겨졌는데 달라지는 prop 0건 · ② 종류 왕복 1회 후 값 보존 · ③ **결선 회귀** — `Card.isSelectable=false` 에서 `isSelected` 가 live 패널에서 사라지고 `true` 에서 다시 나온다 (결선 전에는 둘 다 보인다 = 원복 RED) · ④ `chartType` 미저장 Chart 노드 1건에서 bar 전용 필드가 보인다 (R7) | 어긋난 항목이 있으면 조건 표가 아니라 소비 경로를 먼저 읽고, `visibleWhen` 이 Chart 에서 동작하지 않으면 Decision 을 대안 A 로 되돌린다 |
| G3   | P2~P4 각 phase  | 신규 prop 마다 registration 8지점(카탈로그 · binding `accepts`+`propPassthrough` · rule · 팔레트/오라클 · factory · `createDefaultChartProps` · `rendererMap`/`DataRenderers` · publish registry) 전부 존재. parity 는 색 채널 포함 GREEN 이고 falsify 로 RED 재현                                                                                                                             | 누락 지점을 채우기 전에 phase 를 닫지 않는다                                                                                            |
| G4   | P2~P4 각 phase  | 신규 prop 미지정 시 스냅샷 4종 1px 무변경                                                                                                                                                                                                                                                                                                                                                      | 기본값이 그림을 바꿨으면 기본값을 고친다 (계약 2)                                                                                       |
| G5   | P5              | 번들 gz builder ≤ +5,120 B / publish ≤ +2,048 B · frame p95 Δ ≤ +1ms (같은 실행의 대조군 bar 재측정 drift 병기)                                                                                                                                                                                                                                                                                | 예산 초과 시 `labelKey` 축(P4)을 먼저 분리해 별도 판정                                                                                  |

### Live Exercise

2026-09-09, Playwright 하니스 `apps/builder/scripts/adr208-visiblewhen-live.mjs` (dev 서버 실측, Chrome MCP 아님). 실제 빌더에 프로젝트를 만들고 팔레트로 Chart 를 놓은 뒤 Properties 패널을 열어 **화면에 그려진 컨트롤 이름**을 읽었다 — `resolveEditContract` 를 직접 부르는 단위와 달리 `PropertiesPanel` → `useEditContract` → `GenericFieldRenderer` 를 전부 지난다.

| #   | 시나리오                                                 | 결과                                              |
| --- | -------------------------------------------------------- | ------------------------------------------------- |
| 1   | `chartType` 저장 여부와 무관하게 bar 전용 필드 노출 (R7) | PASS — controls 21, Orientation·Stack Type 있음   |
| 2   | bar 에서 Grid Type·Inner Radius 미노출                   | PASS                                              |
| 3   | radar 로 전환 시 Grid Type·Inner Radius 노출             | PASS                                              |
| 4   | radar 에서 Orientation·Stack Type 사라짐 (ADR-207 R8)    | PASS                                              |
| 5   | 종류 왕복 후 숨겨졌던 값 보존 (G2 ②)                     | PASS — `orientation=horizontal` 유지, 다시 노출   |
| 6   | P2 4프롭이 radar 에만 노출                               | PASS — Show Spokes·Grid Rings·Fill Grid·Fill Area |
| 7   | P2 프롭이 bar 에서 전부 사라짐                           | PASS                                              |
| 8   | P3 radial 에서 각도 2프롭 + 중앙 합계 노출               | PASS                                              |
| 9   | P3 각도 범위가 radar 에서 미노출 (radial 만 소비)        | PASS                                              |
| 10  | P4 Label Content 가 `showValueLabels` 토글로 왕복        | PASS                                              |
| 11  | Card 결선 회귀                                           | 단위 seam 커버 (아래)                             |

**11/11.** Card 의 `isSelectable` → `isSelected` 왕복은 live 팔레트 진입 경로가 이 하니스에서 응답이 없어(2회 재현) 단위 seam 3케이스(`GenericFieldRenderer.test.tsx` — `resolveEditContract` 를 실제로 돌린다)로 커버를 명시하고 뺐다. 없는 결과를 만들지 않는다.

**하니스 결함 2건이 먼저 잡혔다** — 둘 다 "필드가 없다" 를 조용히 통과시키는 형태였다: ① Properties 패널을 열지 않은 채 엉뚱한 `.panel-contents` 를 집어 `controls=0` · ② boolean 컨트롤은 이름이 `aria-label` 이 아니라 `<label>` 텍스트라 3프롭이 "원래 없는 것" 으로 읽힘. 앵커를 `[aria-label="Variant"]` 로 잡고 두 소스를 합쳐 수집하도록 고쳤다.

## Gate 실측 (2026-09-09)

| Gate | 조건                                                     | 실측                                                                                                                   | 판정 |
| ---- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---- |
| G0   | 코드 사실 표 + 기준선 일치                               | 사실 9건 전부 일치 · 기하 160 / parity 116 / 번들 1,590,771 · 426,716                                                  | PASS |
| G1   | scene 계약 무변경 (`AxisScene`·`PathMark`·`Mark` 유니온) | ADR-207 이 만든 계약 그대로, 새 마크 종류 0                                                                            | PASS |
| G2   | 소비 ⊆ 노출 · 왕복 값 보존 · 결선 회귀 · 미저장 노드     | 차등 오라클 14케이스 (정방향 6 + 역방향 6 + 공허 방지 2) · live 11/11                                                  | PASS |
| G3   | registration 8지점 · 색 채널 parity + falsify            | 신규 7 prop 전부 8지점 · parity 151 · falsify RED 3                                                                    | PASS |
| G4   | 신규 prop 미지정 시 스냅샷 4종 무변경                    | 갱신 0 (기하 212 GREEN)                                                                                                | PASS |
| G5   | 번들 gz ≤ +5,120 / +2,048 · frame p95 Δ ≤ +1ms           | builder **+1,183 B** · publish **+696 B** · frame p95 Δ radar **−0.3ms** / radial **−0.5ms** (대조군 bar drift −0.1ms) | PASS |

> 번들은 `find apps/{builder,publish}/dist/assets -name "*.js" -exec gzip -c {} \; | wc -c` 로 P0·P5 를 같은 명령으로 쟀다. ADR-207 하니스의 절대값(1,761,184 / 504,916)과 집계가 다르므로 **delta 만** 비교한다 (breakdown §2.2).

**G2 가 조건 표를 세 번 고쳤다** — 이것이 이 ADR 에서 가장 값어치 있는 결과다. 착수 전 표는 `computeChartScene` 을 grep 으로 읽어 썼는데 전부 어긋나 있었다:

1. `stackType` — line(`:411-413` 공용 분기)과 pie(`:363-365` 링 분할)도 읽는다 (P1)
2. `innerRadius` — radar 의 `center.inner` 도 읽는다 (P1)
3. `startAngle`/`endAngle` — radial **만** 읽는데 radar·pie 에도 열었다 (P3)

앞의 둘은 "읽히는데 숨김"(R2), 셋째는 "보이는데 안 읽힘" 이다. 셋째를 잡으려고 **역방향 오라클**을 추가했다 — 조건을 단 prop 이 그 종류에서 아무 반응이 없으면 FAIL. 선언을 선언으로 대조했다면 셋 다 통과했을 것이다.

## Consequences

### Positive

- shadcn 예제 커버리지가 33 → 45종(70 중). radar 는 5/14 → 11/14.
- `Chart.binding.ts` 의 Properties 패널이 차트 종류별 부분집합만 보여, bar 를 편집하는 사용자가 극좌표 전용 항목을 보지 않는다. ADR-207:190 이 기록한 Negative 가 닫힌다.
- **죽어 있던 `visibleWhen` 이 살아난다.** 타입·평가기·선언(`Card.binding.ts:110`)이 이미 있으면서 live 경로에 안 닿던 상태가 해소돼, 앞으로 binding 작성자가 쓴 조건이 실제로 동작한다. Chart 는 그 결선을 요구한 첫 실사용처가 된다.
- `ChartLabelFormatter` 중앙화(P4)로 마크 빌더 6개에서 `formatTick` 직접 호출이 사라져, 레이블 내용 규칙이 한 곳에 모인다.

### Negative

- `ChartProps` 가 20 → 27 필드가 된다. 패널에서 보이지 않을 뿐 직렬화·registration·타입 표면에는 전부 남는다 (R3). 다음 확장에서 다시 대폭 늘면 대안 B 재평가가 필요하다.
- `visibleWhen` 조건 표가 `computeChartScene` 의 소비와 **두 곳에 나뉘어** 산다. 둘의 정합은 타입이 아니라 G2 오라클이 지킨다 — ADR-207 이 `AxisScene.grid` 유니온에서 겪은 "컴파일 신호 없음" 과 같은 형태의 부담이 하나 늘어난다.
- radar 의 `stackType` 무시(ADR-207 R8)가 이제 패널에서 **항목이 사라지는** 형태로 보인다. 값은 남아 있으므로, radar 에서 안 보이던 `stackType` 이 bar 로 바꾸면 예전 값으로 되살아나는 것이 사용자에게 놀라움이 될 수 있다 (R1 — 값 보존을 택한 결과).
- 본 ADR 의 표면이 Chart binding 밖으로 나간다 — `resolveEditContract`(shared) 와 `GenericFieldRenderer`(builder) 가 phase 1 의 변경 대상이 된다. 차트 ADR 이 패널 인프라를 건드리는 배치이며, 그 회귀 표면은 R6 가 관리한다.
- 되돌린 커밋 4개를 다시 반영하는 작업이라 diff 대부분은 새로 쓰이지 않는다. 그럼에도 `visibleWhen` 부여와 P1 의 소급 적용 때문에 **그대로 되살릴 수는 없고**, phase 마다 재검증이 필요하다.
