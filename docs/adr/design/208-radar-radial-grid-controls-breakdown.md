# ADR-208 구현 분해 — radar/radial 제어 prop 과 차트 종류별 조건부 노출

> 본 문서는 [ADR-208](../208-radar-radial-grid-controls.md) 의 구현 상세다. 결정·대안·위험은 ADR 본문이 정본이며, 여기서 다시 판정하지 않는다.

## 1. Fork 4 질문 lock-in

ADR-207 은 Implemented 로 닫혔고 본 ADR 은 그 잔여 영역(예제 단위 격차)의 신규 제안이므로 `.claude/rules/adr-writing.md` §"ADR Fork / 분리 결정 시 전제·관점 점검" 게이트에 해당한다.

| #   | 질문                       | lock-in                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | base / 응용 분류           | **ADR-207 이 base** (극좌표 scene 계약 — `AxisScene.grid` 유니온, `PathMark.role`/`fillRole`, 각도 규약). 본 ADR 은 그 계약 **위에서 값만 고르는 응용**이다. 새 scene 계약을 만들지 않는다 — Gate G1 이 이를 기계로 확인한다.                                                                                                                                                                                                                                                                                    |
| 2   | schema 직교성              | 직교가 아니라 **specialization**. `ChartProps` 에 필드를 더할 뿐 기존 필드의 뜻을 바꾸지 않는다. 따라서 본 ADR 이 ADR-207 의 후속이며 역은 성립하지 않는다.                                                                                                                                                                                                                                                                                                                                                      |
| 3   | 선행 ADR 전제 reverse 검증 | ADR-207 이 남긴 전제 `207:190` ("조건부 표시는 패널의 별도 축이라 본 ADR 범위 밖") 은 **절반이 거짓**이다 — 별도 축이 아니라 binding 의 `PropContract` 필드다 (`packages/shared/src/catalog/types.ts:212`). 다만 리뷰 round 1 에서 **live 경로 결선이 없다**는 사실이 추가로 확인됐다 (`resolveEditContract.ts:58-79` 가 `visibleWhen` 을 운반하지 않고, `evaluateVisibility` 호출부 2곳은 둘 다 죽은 경로). 정정 후에도 의존 방향은 그대로다 (207 → 208) — 208 이 결선을 치르고 207 이 남긴 Negative 를 닫는다. |
| 4   | codex 3차까지 미루지 않음  | 본 breakdown 작성 직후 `/review-adr 208` 1차 진입. Phase 진입은 리뷰 종결 이후.                                                                                                                                                                                                                                                                                                                                                                                                                                  |

사용자 confirm 기록: 2026-09-08 세션 — "근본적인 해결은 소급ADR인가 4 커밋 revert 후 ADR 부터 인가" → revert 선택 → `/create-adr radar-radial-grid-controls` 직접 입력. 두 발언이 fork 결정의 explicit confirm 이다.

## 2. Phase 0 — 코드 사실 표 (착수 전 실측, 인용 필수)

| 사실                                                                                                                                              | 경로:라인                                                                                                 | 확인 명령                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Chart binding 의 `accepts` 키는 22개 (차트 prop 20 + `variant`/`size`)                                                                            | `packages/shared/src/catalog/bindings/Chart.binding.ts:39`                                                | 아래 §2.1 스크립트                                                                            |
| `visibleWhen` 은 `PropContract` 의 정식 필드                                                                                                      | `packages/shared/src/catalog/types.ts:212`                                                                | `grep -n "visibleWhen" packages/shared/src/catalog/types.ts`                                  |
| `VisibilityCondition` 은 `key`/`equals`/`oneOf`/`truthy` 지원                                                                                     | `packages/shared/src/catalog/types.ts:184-189`                                                            | 같은 파일                                                                                     |
| `oneOf` 는 형제 prop 값을 읽어 판정한다                                                                                                           | `apps/builder/src/builder/panels/properties/generic/evaluateVisibility.ts:21,32`                          | 같은 파일                                                                                     |
| 조건 미선언 필드는 즉시 통과한다 (결선의 노출면을 좁히는 근거)                                                                                    | `apps/builder/src/builder/panels/properties/generic/evaluateVisibility.ts:8`                              | 같은 파일                                                                                     |
| 선언 선례 — `Card.binding.ts` 가 `visibleWhen` 을 쓴다 (저장소 전체에서 유일)                                                                     | `packages/shared/src/catalog/bindings/Card.binding.ts:110`                                                | `grep -rn "visibleWhen" packages/shared/src/catalog/bindings/`                                |
| **live 경로는 `PropertiesPanel` → `useEditContract` → `GenericFieldRenderer`**                                                                    | `apps/builder/src/builder/panels/properties/PropertiesPanel.tsx:138,240,261`                              | 같은 파일                                                                                     |
| **`ResolvedField` 에 `visibleWhen` 이 없다** — `min`/`max`/`step`/`options`/`itemsManager` 만 운반                                                | `packages/shared/src/catalog/resolvers/resolveEditContract.ts:58-79`                                      | `grep -n "visibleWhen" packages/shared/src/catalog/resolvers/resolveEditContract.ts` (결과 0) |
| **생성부 3곳도 복사하지 않는다** (primitive accepts · reusable propsSchema · ref fallback)                                                        | `resolveEditContract.ts:335-349` · `:310-324`                                                             | 같은 파일                                                                                     |
| **`evaluateVisibility` 호출부 2곳은 둘 다 죽은 경로** — `CatalogInspectorFields`(주석이 "레거시 Inspector") · `GenericPropertyEditor`(import 0건) | `CatalogInspectorFields.tsx:256` · `GenericPropertyEditor.tsx:93,146` · `useOwnerCollectionColumns.ts:26` | `grep -rn "GenericPropertyEditor" --include=*.tsx apps/builder/src` 의 import 0건             |
| 판정 입력의 기본값 해소는 `currentValue` 가 이미 한다 (R7 처방)                                                                                   | `resolveEditContract.ts:343`                                                                              | 같은 파일                                                                                     |
| Chart 기본 props 는 `chartType:"bar"` 를 저장한다                                                                                                 | `apps/builder/src/types/builder/unified.types.ts:2201`                                                    | 같은 파일                                                                                     |
| radar 는 `stackType` 을 무시한다 (ADR-207 R8)                                                                                                     | `packages/specs/src/chart/computeChartScene.ts:155-162`                                                   | 같은 파일                                                                                     |
| ADR-207 이 남긴 Negative — "radar 전용인데 모든 차트에 보인다"                                                                                    | `docs/adr/completed/207-polar-chart-radar-radial.md:190`                                                  | 같은 파일                                                                                     |

### 2.1 prop 개수 확인 스크립트

```bash
python3 - <<'PY'
import io,re
s=io.open("packages/shared/src/catalog/bindings/Chart.binding.ts",encoding="utf-8").read()
i=s.index("{",s.index("accepts: {")); d=0
for j in range(i,len(s)):
    d += 1 if s[j]=="{" else (-1 if s[j]=="}" else 0)
    if d==0: break
print(re.findall(r"^      ([A-Za-z][A-Za-z0-9]*):", s[i+1:j], re.M))
PY
```

### 2.2 기준선 (Phase 1 착수 시점에 재측정해 갱신)

P0 실측 (2026-09-09, `5cd41d321` 기준):

| 항목                                         | 값                          |
| -------------------------------------------- | --------------------------- |
| 기하 단위 (`@composition/specs` `src/chart`) | 160 PASS (10 파일)          |
| 대칭 parity (`chartParity.test.tsx`)         | 116 PASS (색 채널 2축 포함) |
| `pnpm type-check`                            | PASS (baseline 0)           |
| 번들 gz builder / publish                    | 1,590,771 B / 426,716 B     |

> 번들 측정 방법: `find apps/{builder,publish}/dist/assets -name "*.js" -exec gzip -c {} \; | wc -c` (production build 후). ADR 본문 Hard Constraint 3 이 인용한 되돌린 구현의 수치(1,761,184 / 504,916)는 ADR-207 하니스의 다른 집계라 **절대값이 다르다** — G5 는 절대값이 아니라 **같은 명령으로 잰 delta** 로 판정한다.

## 3. Phase 분해

각 phase 종료 시 commit 가능 상태를 유지한다. 응답 1개 = phase 1개.

| Phase  | 내용                                                                                                                                                                                                                                                                                                                                                                              | risk | Gate     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--: | -------- |
| **P0** | 위 §2 코드 사실 재확인 + 기준선 재측정. binding prop 개수·번들·테스트 수를 실측으로 갱신                                                                                                                                                                                                                                                                                          | LOW  | G0       |
| **P1** | **first nail — 신규 prop 0**. ⓐ live 경로 결선 (`ResolvedField.visibleWhen` 필드 + 생성부 3곳 복사 + `GenericFieldRenderer` 필터, 판정 입력은 `currentValue`) · ⓑ 기존 차트 종류 전용 prop 7개(`orientation`·`stackType`·`curve`·`showDots`·`innerRadius`·`gridType`·`showTotal`)에 `visibleWhen` 부여. ADR-207:190 의 Negative 를 닫고 `Card.isSelected` 의 죽은 선언도 살아난다 | MED  | G1·G2    |
| **P2** | radar 격자·선 제어 4프롭 (`showSpokes`·`gridRings`·`fillGrid`·`fillArea`) + 각각의 `visibleWhen`                                                                                                                                                                                                                                                                                  | MED  | G1·G3·G4 |
| **P3** | 극좌표 각도 범위 (`startAngle`·`endAngle`) + `showTotal` 의 radial 확장 + `centerTotalLabels` 공유 추출                                                                                                                                                                                                                                                                           | MED  | G1·G3·G4 |
| **P4** | `labelKey` + `ChartLabelFormatter` 중앙화 (마크 빌더 6개에서 `formatTick` 직접 호출 제거)                                                                                                                                                                                                                                                                                         | MED  | G1·G3·G4 |
| **P5** | 측정·문서 — 번들/frame 실측, live 하니스 확장, CHANGELOG, ADR Status 승격                                                                                                                                                                                                                                                                                                         | LOW  | G5       |

P2~P4 의 구현 내용은 revert 된 커밋 `b4896379d` · `40184921f` · `ca0565967` 에 그대로 남아 있다. 되살릴 때는 **그 diff 를 그대로 옮기지 않는다** — Decision 이 고른 `visibleWhen` 부여가 추가되고, P1 이 만든 술어와 겹치는 부분은 P1 쪽으로 모은다.

### P1 상세 — 어느 prop 에 어떤 조건을 다는가

| prop          | 조건                                                        | 근거                                                                                                                                                                                                          |
| ------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `orientation` | `oneOf: ["bar","line","area"]`                              | 극좌표·pie 는 읽지 않는다 (`computeChartScene.ts:417,487,502`)                                                                                                                                                |
| `stackType`   | `oneOf: ["bar","line","area","pie","radial"]`               | radar 만 무시 (ADR-207 R8, `computeChartScene.ts:155`). cartesian 3종은 같은 분기(`:411-413`), pie 는 값 축이 없어 링 분할을 따로 판정한다(`:363-365`) — **P1 실측 정정** (착수 전 표는 line·pie 를 빠뜨렸다) |
| `curve`       | `oneOf: ["line","area"]`                                    | `computeChartScene.ts:505,519`                                                                                                                                                                                |
| `showDots`    | `oneOf: ["line","area","radar"]`                            | `computeChartScene.ts:184,510,525`                                                                                                                                                                            |
| `innerRadius` | `oneOf: ["pie","radial","radar"]`                           | `computeChartScene.ts:152,358`. radar 의 `center.inner` 는 결측 꼭짓점을 접는 반지름이자 격자 안쪽 경계 — **P1 실측 정정**                                                                                    |
| `gridType`    | `equals: "radar"`                                           | `computeChartScene.ts:219` — ADR-207:190 이 지목한 항목                                                                                                                                                       |
| `showTotal`   | `equals: "pie"` (P3 에서 `oneOf: ["pie","radial"]` 로 확장) | `computeChartScene.ts:359`                                                                                                                                                                                    |

> **P1 실측이 표를 두 곳 고쳤다.** 착수 전 표는 `computeChartScene` 을 grep 으로 읽어 썼는데, G2 차등 오라클(값을 바꿔 scene 이 달라지는지)이 `stackType`(line·pie 누락)과 `innerRadius`(radar 누락) 을 잡았다. R2 가 예고한 형태 그대로이며, **선언을 선언으로 대조했다면 통과했을** 어긋남이다.

**조건을 달지 않는 것**: `showAxis`·`showGrid`·`showLegend`·`legendPosition`·`showValueLabels`·`colorBy`·`showTooltip` — 두 계열 모두가 읽거나(`showAxis` 는 cartesian·radar 양쪽) 전 종류 공통이다. 억지로 조건을 달면 표가 커지고 뜻이 흐려진다.

### P1 이 first nail 인 이유

Decision 의 load-bearing 가정은 "`visibleWhen` 을 Chart 패널에서 **동작하게 만들 수 있다**" 하나다 — 리뷰 round 1 이 확인했듯 지금은 동작하지 않는다. P1 은 신규 prop 0 으로 그 결선만 치르고 검사한다. 실패하면 P2~P4 를 시작하기 전에 Decision 을 대안 A 로 되돌리며, 비용은 3파일 + binding 선언 7줄 + live 확인 1회다.

결선의 노출면이 좁다는 것이 P1 을 first nail 로 쓸 수 있는 근거다 — `evaluateVisibility.ts:8` 이 조건 미선언 필드를 즉시 통과시키고, 저장소 전체의 `visibleWhen` 선언은 `Card.binding.ts:110` 한 건뿐이다. 즉 결선이 즉시 바꾸는 것은 **Card 의 `isSelected` 필드 하나**이며, 그것이 곧 결선의 live 오라클(G2 ③)이다.

## 4. 파일 변경 예상

| 파일                                                                                 | P1  | P2  | P3  | P4  |
| ------------------------------------------------------------------------------------ | :-: | :-: | :-: | :-: |
| `packages/shared/src/catalog/resolvers/resolveEditContract.ts` (결선)                |  ●  |     |     |     |
| `apps/builder/src/builder/panels/properties/generic/GenericFieldRenderer.tsx` (결선) |  ●  |     |     |     |
| `packages/shared/src/catalog/bindings/Chart.binding.ts`                              |  ●  |  ●  |  ●  |  ●  |
| `packages/specs/src/chart/types.ts`                                                  |     |  ●  |  ●  |  ●  |
| `packages/specs/src/chart/computeChartScene.ts`                                      |     |  ●  |  ●  |  ●  |
| `packages/specs/src/chart/polarAxes.ts`                                              |     |  ●  |     |     |
| `packages/specs/src/chart/marks/{radar,radial,pie}.ts`                               |     |  ●  |  ●  |  ●  |
| `packages/specs/src/chart/marks/{bar,line,area}.ts`                                  |     |     |     |  ●  |
| `packages/specs/src/renderers/skiaPrimitives.ts`                                     |     |  ●  |  ●  |  ●  |
| `packages/shared/src/components/Chart.tsx`                                           |     |  ●  |  ●  |  ●  |
| `packages/shared/src/renderers/DataRenderers.tsx`                                    |     |  ●  |  ●  |  ●  |
| `apps/builder/scripts/adr207-polar-chart-live.mjs`                                   |  ●  |  ●  |  ●  |  ●  |

`DataRenderers.tsx` 는 문서 로드 경로다 — ADR-207 후속 1차에서 신규 prop 7개를 여기서 빠뜨려 **문서를 다시 열면 기본값 차트가 그려지는** 결함이 있었다. 신규 prop 마다 이 파일을 함께 고친다 (G3 의 registration 8지점이 기계로 확인).

## 5. 원복 RED 매트릭스

phase 마다 "새 코드를 지우면 무엇이 RED 가 되는가" 를 타입별 실제 diff 행으로 기록한다 (묶음 요약 금지 — 메모리 `feedback-mutation-red-record-actual-diff-per-type`).

| phase | 원복 대상                                                                | 기대 RED                                                         |
| ----- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| P1    | ⓐ 결선 (`ResolvedField` 운반 또는 `GenericFieldRenderer` 필터)           | `Card.isSelectable=false` 에서 `isSelected` 가 다시 보인다 (1행) |
| P1    | ⓑ `visibleWhen` 선언 7건                                                 | 패널 노출 오라클 7행 (종류별 개별 diff 기록 — 묶음 요약 금지)    |
| P2    | `showSpokes` 분기 / `fillGrid` 링 지정 / `fillArea` 의 `fillSeries` 생략 | 기하 + parity 색 채널                                            |
| P3    | 트랙의 `totalSweep` 사용 (한 바퀴 고정으로 되돌림)                       | radial 반원 게이지 행                                            |
| P4    | `labelKey` 분기                                                          | labelKey 테스트                                                  |
