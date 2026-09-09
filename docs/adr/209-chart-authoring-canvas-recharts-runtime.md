# ADR-209: 차트별 편집 경험과 Canvas·Recharts 런타임 분리

## Status

In Progress — 2026-09-09. P0~~P4 구현·검증과 P5 호환성·성능 측정을 수행했다. G0~~G4 통과. G5의 기존 전체 초기 번들 예산 결정과 로그인된 production Builder 부트 검증이 남아 G5/G6 종결은 보류한다. [실행 근거](evidence/209-execution-live.md).

관련 결정: [ADR-194](completed/194-chart-component-headless-geometry.md), [ADR-207](completed/207-polar-chart-radar-radial.md), [ADR-208](completed/208-radar-radial-grid-controls.md). 본 ADR이 Accepted되면 아래 표의 일부 결정을 대체한다. 세 ADR 전체를 Superseded로 바꾸지는 않는다.

## Context

사용자는 `Components > Collections > Chart`를 추가한 뒤 Properties에서 차트 종류를 바꾸는 흐름이 불편하다고 지적했다. Charts 섹션과 차트별 컴포넌트, 종류에 유효한 Properties를 요구했고, 다음 기준을 추가했다.

- 시각 스타일·예제 구성은 [shadcn/ui Charts](https://ui.shadcn.com/charts/area)를 참조한다. 2026-09-09 확인 기준 Area·Bar·Line·Pie·Radar·Radial 6계열과 계열 내부 예제가 있다.
- Builder는 자체 Canvas로 설정 결과의 정적 완성 상태를 보여준다. Preview/Publish는 실제 [Recharts](https://recharts.github.io/)로 차트를 실행한다. Recharts는 애니메이션의 유일한 구현 수단은 아니지만, 이를 자체 개발할 부담을 줄이는 선택이다. [Area API](https://recharts.github.io/en-US/api/Area/)는 실행 여부·지연·시간·easing 및 데이터 변경 전환을 제공한다.
- 데이터는 다른 데이터 컴포넌트와 동일한 Composition collection/dataBinding 체계를 유지한다. RAC Collection JSX나 선택 상태를 Recharts에 전달한다는 의미가 아니다.

### 기존 설계와 달라지는 판단

| 선행 ADR | 유지                                                                             | 이 ADR에서 변경할 결정                                                                                                                                                   |
| -------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 194      | Chart 저장 타입·dataBinding·원본 행 필드 매핑·Canvas 기하·PathShape·catalog 토큰 | Collections의 단일 생성 항목 → Charts의 6개 진입점. Preview/Publish 자체 SVG → Recharts. 신규 의존 0·두 leg의 path byte 동일 조건 → 런타임 의존 격리·최종 시각 결과 정합 |
| 207      | radar/radial의 의미·음수/결측 처리·극좌표 Canvas 구현                            | 별도 팔레트 항목은 계약 복제를 필연적으로 낳는다는 전제. 생성 항목의 구분과 runtime 타입 복제를 분리                                                                     |
| 208      | binding 기반 동적 Properties, 기본값을 포함한 조건 평가, 숨겨진 값 보존          | chartType 선택을 기본 편집에서 제거. 옵션 소비자를 Canvas와 Recharts로 나누고 애니메이션 등 runtime 전용 필드도 검증                                                     |

ADR-194 대안 C(`:62-69`)는 **Recharts hidden DOM → SVG 해석 → Skia**였다. 본 제안의 **독립 Canvas + 실제 Recharts**와 다른 대안이다. 또한 ADR-207 대안 D(`:87-95`)의 등록·데이터 복제는 아래 생성 프리셋 방식으로 피한다. 과거의 기각 사유를 그대로 승계하지 않는다.

### SSOT 3-domain

- **D1 DOM/접근성·상호작용**: 차트의 Preview/Publish 실행은 Recharts가 담당한다. 일반 컴포넌트의 RAC 계약은 유지한다. Chart는 기존 `kind:"internal"` 예외 안에서 실행하며, `role="img"`를 관성적으로 대화형 차트의 바깥에 씌우지 않는다. Recharts의 실제 접근성 트리·키보드 동작을 확인한다.
- **D2 Props/API**: Composition의 직렬화 가능한 Chart 설정이 계약이다. Recharts의 함수·ReactNode 전체 API를 저장 모델로 노출하지 않는다. 기본값·단위·변환을 명시한 adapter가 공개 API에 연결한다.
- **D3 시각 스타일**: catalog rule + theme/tokens가 정본이다. shadcn은 시각 참조이며 CSS/색 정본을 따로 만들지 않는다. Canvas와 Recharts는 같은 설정·데이터·토큰을 읽는 대등한 consumer다. RAC 때처럼 구현 방식은 달라도 되지만 시각적 의미와 최종 상태는 맞아야 한다.

### 설계 작성 당시 확인한 사실과 미확인 경로

`componentCatalog.ts:450`과 `paletteItems.ts:243`은 Chart 하나를 등재한다. `GenericFieldRenderer.tsx:350-357`에는 ADR-208 조건 필터가 이미 배선돼 있다. `Chart.tsx:398-414`는 `useCollectionData` 결과를 최대 200행으로 잘라 공통 기하 함수에 전달하고, 빈 바인딩 결과는 `props.data`로 대체한다. 이것은 **현재 DOM에도 있는 제한**이며 Builder에만 있다고 설명하면 틀린다.

`useCollectionData.tsx:220,322`는 React Stately `useAsyncList`와 DI 서비스를 사용한다. 그러나 작성 시 `rg -l 'CollectionDataProvider|CollectionDataContext' apps packages` 결과에서 provider 장착은 shared 정의 외에 발견되지 않았다. 훅 재사용은 VERIFIED, 실제 앱의 DataTable/API 공급 종결은 UNVERIFIED다. [ADR-152](152-data-panel-collection-binding-integration.md)의 공통 데이터 연결 범위와 대조하고 실제 문서 reload/배포 산출물에서 입증해야 한다. 정적 샘플 성공으로 바인딩 성공을 대신하지 않는다.

**Hard Constraints** — 아래 수치는 실측 성과가 아닌 제안된 구현 통과 기준이다.

1. Charts의 기본 진입점은 **6개**이며 각 항목 1회 추가로 해당 종류가 만들어진다. 기본 Properties의 Chart Type 선택은 0개다.
2. 기존 문서는 canonical의 Chart 식별자와 `props.chartType`·`dataBinding`을 그대로 읽는다. 강제 재직렬화 **0 파일**, DB schema 변경 **0**. 읽기만 한 기존 문서가 dirty가 되면 실패다. 실제 사용자 중 Chart 보유 비율은 미측정이며 0% 영향으로 주장하지 않는다.
3. 차트 전용 fetch·API 자격증명 저장·독립 collection store는 **0개**. 기존 서비스가 제공한 행과 상태를 사용한다. Preview는 기존 검증된 postMessage 경계, Publish는 공통 서비스 계약을 따른다.
4. Builder Canvas 모듈의 Recharts import/실행 **0**, 편집 화면의 hidden Recharts DOM **0**. Preview/Publish의 실제 차트 runtime은 Recharts이고, 자체 SVG를 감싼 이름뿐인 전환은 불가하다.
5. 동일한 데이터 revision·설정·크기·폰트·테마에서 정적 완성 상태의 주요 좌표/외곽 **오차 ≤1 CSS px**, 표시 값·축 눈금·범례·색 역할 일치. SVG path 문자열 일치는 요구하지 않는다. Builder 샘플과 Publish 전체 행을 비교한 차이는 렌더 오차로 집계하지 않는다. **데이터 앵커와 plot 외곽은 두 구현이 구조적으로 일치하는 지점이므로 그것만으로 정합을 판정하지 않는다** — 곡선 제어점·arc 세그먼트처럼 앵커 사이에서만 갈리는 기하는 구간 중간점 좌표를 별도 표본으로 잰다 (R10).
6. 기존 설정은 뜻을 유지한다. 특히 누적 100% 단위, duplicate 합산, 결측, 극좌표 각도 규약은 adapter에서 명시한다. Recharts 기본값을 그대로 받아 기존 그림을 바꾸지 않는다.
7. 의존 예외는 차트 runtime의 Recharts와 필요한 전이 의존에 한정한다. React 중복 탑재 0. Builder 편집 부트에서 Recharts chunk 요청 0; 차트 없는 Preview/Publish의 Recharts chunk 요청 0. 추가 초기 공통 JS ≤10 KiB gzip, 차트 lazy 전이 그래프의 순증 ≤200 KiB gzip을 제안 예산으로 둔다. 과거 ADR의 148KB 등은 현재 예산 검증값이 아니다.
   - **기존 금지 규칙과의 관계**: `.claude/skills/component-design/SKILL.md:86` "외부 라이브러리 추가 설치 금지 (번들 500KB 제약)" 과 `CLAUDE.md` 초기 번들 <500KB 는 [ADR-194](completed/194-chart-component-headless-geometry.md):25 가 "신규 런타임 의존 0" 의 근거로 인용한 규칙이다. 본 ADR은 그 금지를 **폐기하지 않고 차트 runtime 한 곳에 범위 예외를 둔다** — 기존 전체 초기 번들 <500KB와 신규 초기 JS ≤10 KiB gzip 순증을 별도 조건으로 지키고, 예외 대상은 lazy 경계 뒤의 Recharts와 그 전이 의존뿐이다. 이 예외가 성립하려면 규칙 문서 쪽도 같은 문장을 가져야 하므로 **SKILL.md 해당 항목 갱신을 G6 산출물에 포함**한다 (문서와 결정이 갈린 채로 Implemented 승격 금지).
8. Builder 200행×4시리즈의 가시 편집/줌에서 frame 총비용 p95 증가 ≤1ms. 애니메이션 프레임마다 canonical/store write **0**, 편집 부트 readiness의 timeout·가짜 진행률 추가 **0**. warm runtime 200행×4시리즈 데이터 교체의 최종 정적 render p95 ≤100ms(설정한 animation 지연/시간은 별도 측정)를 제안한다.

**Generator 판정**: 팔레트 구분·애니메이션은 CSS 생성 대상이 아니다. 기존 `ComponentRule.chart` → `--chart-*` 전달을 재사용한다. 프리셋이 요구하는 gradient 등 새 시각 채널은 현재 지원 여부를 먼저 확인하고, 필요 시 catalog·generator·Canvas·DOM 네 경계를 함께 확장한다. 한쪽에만 존재하는 스타일 프리셋은 노출하지 않는다.

**Soft Constraints**: 6계열과 합의한 편집·실행 분리에 집중한다. shadcn 전체 예제 수, 임의 JSX 차트 조합, 대규모 telemetry·streaming·downsampling·brush 연동까지 완료 목표로 확대하지 않는다. 기존 기능과 초기 프리셋의 구체 범위는 breakdown에 고정한다.

## Alternatives Considered

### 대안 A: Charts만 분리하고 자체 Canvas/SVG 유지

- 설명: 팔레트·Properties를 개선하고 기존 기하 공유를 유지한다. 애니메이션과 상호작용은 자체 SVG에 추가한다.
- 근거: 현재 `Chart.tsx`와 ADR-194의 경로는 이미 존재하고 tooltip도 구현돼 있다. SVG에서도 animation을 만들 수 있어 기술적으로 불가능한 대안이 아니다.
- 위험: 기술 **M**(새 animation 구현), 성능 **L**(외부 의존 없음), 유지보수 **M**(상호작용 직접 유지), 마이그레이션 **L**.
- 요구 충족: UX는 충족하지만 사용자 지정 Recharts runtime을 충족하지 않는다.

### 대안 B: Charts 분리 + Recharts SVG를 해석해 Canvas에 복사

- 설명: Recharts를 hidden DOM에 렌더하고 SVG를 해석해 Builder에 복제한다. ADR-194 대안 C와 같다.
- 근거: Recharts는 SVG 기반이며 생성한 결과를 읽을 수 있다. 하지만 SVG/DOM 처리의 중간 계층이 필요하다.
- 위험: 기술 **H**(transform/clip/text 해석), 성능 **H**(편집 중 숨은 DOM·계측), 유지보수 **H**(라이브러리 내부 DOM 의존), 마이그레이션 **M**.
- 요구 충족: runtime은 충족하지만 자체 Canvas의 독립성을 훼손한다.

### 대안 C: 생성 항목 6개 + 공통 설정·데이터 + 독립 Canvas/Recharts

- 설명: 저장 Chart 코어는 하나이고 생성 항목·표시 이름·종류별 프리셋을 분리한다. 공통 의미 모델을 Canvas와 Recharts 공개 API에 각각 연결한다.
- 근거: [shadcn Chart 문서](https://ui.shadcn.com/docs/components/chart)는 Recharts 컴포넌트와 토큰/tooltip 구성을 결합한다. 기존 Composition도 자체 Canvas와 실제 RAC를 역할별로 사용한다. 단, 차트의 수치 기하 정합은 별도 증명이 필요하다.
- 위험: 기술 **H**(두 기하 구현의 정합), 성능 **M**(lazy runtime 및 데이터 변환), 유지보수 **M**(지원 옵션별 adapter), 마이그레이션 **M**(기존 기하·상호작용 의미 보존).
- 요구 충족: 합의한 요구 전체를 충족하는 후보다. legacy 호환이 불가능한 옵션을 조용히 버리지 않고 전환을 차단한다.

### 대안 D: Builder도 실제 Recharts DOM으로 표시

- 설명: 두 환경에서 Recharts를 사용하고 Builder 선택/크기 조절만 DOM overlay로 연결한다.
- 근거: Recharts를 두 곳에 사용하면 기하 구현 차이를 줄일 수 있다.
- 위험: 기술 **M**(캔버스 viewport·선택·clip 동기화), 성능 **M**(Builder DOM 차트), 유지보수 **M**, 마이그레이션 **M**.
- 요구 충족: 자체 Canvas 표현이라는 사용자 전제를 충족하지 않는다.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ | 요구 전체 충족                    |
| ---- | ---- | ---- | -------- | ------------ | :---: | --------------------------------- |
| A    | M    | L    | M        | L            |   0   | 아니오 — Recharts runtime 없음    |
| B    | H    | H    | H        | M            |   3   | 아니오 — hidden DOM 의존          |
| C    | H    | M    | M        | M            |   1   | 예, 기하 정합 검증 필요           |
| D    | M    | M    | M        | M            |   0   | 아니오 — Builder Canvas 계약 위반 |

루프 판정: 낮은 위험의 대안 A/D는 존재하지만 요구를 만족하지 않는다. C의 HIGH를 LOW로 낮춰 적지 않는다. 대안 D까지 추가 검토한 뒤에도 요구를 지키면서 기하 정합 위험을 없애는 안은 없으므로 **G0의 실제 Recharts 대조로 먼저 반증하는 조건으로 위험을 수용**한다. runtime을 별도 ADR로 떼면 UX 문서만 완료되고 핵심 요구가 빠지므로 같은 문서 안에서 G0 이후 단계로 격리한다.

## Decision

**대안 C를 채택한다.** 사용자에게는 Charts의 Area·Bar·Line·Pie·Radar·Radial이 각각 독립된 컴포넌트로 보이고, 내부 저장은 기존 Chart 타입을 공유한다. 차트별 프리셋은 명시적 설정 patch이며 공유 데이터나 원본을 복제하지 않는다.

Builder는 정적 Canvas와 동적 Properties를 담당한다. Preview/Publish는 같은 Recharts runtime adapter를 사용해 실제 애니메이션·tooltip·지원되는 접근성을 실행한다. 공통 데이터 source와 필드 매핑, 색·글꼴·격자 토큰, 직렬화된 animation 설정은 함께 읽는다. 애니메이션 중간 프레임·hover는 runtime의 로컬 상태다.

컬렉션 필드 선택과 기본 데이터 행 편집의 역할 라벨은 **Category / Value / Series**로 통일하고, 한국어에서는 **범주 / 값 / 시리즈**로 표시한다. Recharts의 [`dataKey`](https://recharts.github.io/en-US/api/XAxis/)와 [`nameKey`](https://recharts.github.io/en-US/api/Pie/)는 원본 필드를 선택하는 API이며 `category/value/series`라는 데이터 키를 강제하지 않는다. 따라서 기존 저장 prop `dimension/metric/color`와 원본 행의 키를 유지한다. 차트 추가 목록·검색·Properties·프리셋·행 편집은 Settings 언어를 따르며 원본 컬렉션 키와 데이터 값은 번역하지 않는다.

**위험 수용 근거**: 기존 Canvas 구현을 전부 버리지 않고 데이터 의미/토큰/공개 옵션을 공통 계약으로 묶을 수 있다. 다만 legacy 옵션이 Recharts로 보존되는지는 아직 증명되지 않았다. G0에서 6종의 기본·고위험 조합을 실제 Recharts와 비교하고, 성공 전 전체 UI 전환이나 기존 DOM 렌더러 삭제에 진입하지 않는다.

기각 사유: A는 지정 runtime 요구를 충족하지 않고, B는 라이브러리 내부 SVG 구조를 편집 엔진에 결합하며, D는 Builder Canvas 표현 전제를 바꾼다. C도 통과하지 못하면 무단으로 A/D로 바꾸거나 정합 허용치를 완화하지 않고 실패 옵션·오차·가능한 조정 범위를 제시한다.

> 구현 상세: [209-chart-authoring-canvas-recharts-runtime-breakdown.md](design/209-chart-authoring-canvas-recharts-runtime-breakdown.md)

> 후속 보완 상세: [시리즈 해제와 G5/G6 종결](design/209-chart-followup-repair-breakdown.md). 원본 필드 키·ref·공통 collection 계약을 보존하는 해제 설계와 잔여 검증 조건을 정의한다. 제품 구현과 G5/G6 통과는 별도이며, shadcn 대비 신규 기능 확장은 이 보완 범위에 포함하지 않는다.

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 심각도 | 대응                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Canvas 기하와 Recharts가 축/stack/radial을 다르게 해석한다. `packages/specs/src/chart/computeChartScene.ts:144`, `series.ts:44`, `packages/shared/src/components/Chart.tsx:414`, `packages/specs/src/renderers/skiaPrimitives.ts:3318`이 현재 계약 경계다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |  HIGH  | G0 실제 Recharts spike 및 G4 6종 정합. 공개 API만 사용, 기존 설정 의미를 임의로 축소하지 않음                                                                                                                              |
| R2  | 공통 데이터 훅 사용만으로 실제 공급을 가정하거나 샘플이 결손을 가린다. `useCollectionData.tsx:220`, `collectionDataContext.ts:4`, `Chart.tsx:398`, `canvasSceneNode.ts:2569`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |  HIGH  | G0 실제 provider/transport 추적, G3 Preview와 Publish의 cold load·동일 source 대조. 공통 경로 결손은 ADR-152 연계 선행 항목                                                                                                |
| R3  | 숨긴 chartType을 조건 입력에서도 제거해 필드가 사라진다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |  MED   | G2 조건 입력은 유지하고 UI만 숨김, 미저장 chartType=bar 회귀                                                                                                                                                               |
| R4  | 팔레트 6개가 type=Chart를 key로 공유해 최근/즐겨찾기·검색에서 충돌한다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |  MED   | 고유 생성 ID와 저장 component type 분리, G2 기존 Chart 기록 호환                                                                                                                                                           |
| R5  | shared barrel import로 Recharts가 Builder 초기 번들에 들어온다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |  MED   | G5 import graph + production network, lazy 구현 경계                                                                                                                                                                       |
| R6  | animation/tooltip이 재생될 때마다 문서가 변경되거나 ref·Undo가 깨진다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |  MED   | G2/G4 canonical 변경 횟수·reload·Undo 검증. runtime 로컬 상태 저장 금지                                                                                                                                                    |
| R7  | shadcn 색/레이아웃을 별도 하드코딩하거나 runtime만 gradient를 지원한다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |  MED   | G4 토큰/테마/consumer 대조, 지원 완료 프리셋만 노출                                                                                                                                                                        |
| R8  | role=img가 interactive descendants를 가리거나 reduced-motion을 무시한다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |  MED   | G4 실제 접근성 트리·키보드·OS motion 설정 확인                                                                                                                                                                             |
| R9  | 기존 문서의 음수/결측/숨긴 설정/200행 제한 차이를 무변경으로 포장한다                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |  MED   | G3/G4 legacy fixture, 행 정책 변경 명시, G6 rollback 검증                                                                                                                                                                  |
| R10 | **앵커 사이 기하가 ≤1px 오라클을 통과하면서 화면만 갈린다.** `packages/specs/src/chart/curves.ts:4-8` 은 ADR-194 가 "곡선을 각자 그리면 그 순간 발산한다" 며 제거한 발산원을 못박아 뒀고, `curves.ts:89-122` 는 제어점을 **along/across 축 좌표계**에서 계산한 뒤 화면으로 옮긴다 — Recharts `monotone`은 layout에 따라 X/Y 보간을 선택하므로 방향 매핑과 접선 알고리즘을 구분한다. 현재 Canvas의 끝점 secant/내부 평균 접선은 d3의 Steffen 접선과 달라, 축을 올바르게 매핑해도 곡선이 갈린다 (Round 2의 3점 함수 대조: 양 방향 중간점 차이 6.25125px). 데이터 앵커와 plot 외곽은 양쪽이 구조적으로 일치하므로 HC5 의 "주요 좌표" 표본만으로는 이 발산을 볼 수 없다. `curve=monotone` 은 Line·Area 의 Default preset 이다 (breakdown §3.2) |  HIGH  | HC5 에 구간 중간점 표본 명시. G0 first nail 에 `monotone × horizontal` 중간점 대조 1케이스, G4 에 곡선·arc 허용치 조건. 공개 API 로 같은 보간을 못 내면 G0 실패 처리 — Canvas 곡선을 Recharts 에 맞춰 조용히 바꾸지 않는다 |
| R11 | `Chart.tsx` 를 lazy container 로 재구조화하면서 `react-aria-Chart` base class + `data-variant`/`data-size` 합성이 wrapper 에서 빠진다. `packages/shared/src/components/Chart.tsx:470-479` 가 그 합성 지점이고, ADR-194 는 이 누락으로 **생성 CSS 가 Preview 차트에 전량 미적용**된 결함을 실제로 냈다 (194:180 ②)                                                                                                                                                                                                                                                                                                                                                                                                                          |  MED   | breakdown §2 변경 경계에 해당 라인 포함. G4 통과 조건에 Preview/Publish DOM base class·data-attr 검사와 Canvas 토큰 해소값 대조                                                                                            |

## Gates

| Gate | 시점                     | 통과 조건                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 실패 시 대안                                                         |
| ---- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| G0   | 구현 착수의 첫 검증      | 현재 경로 inventory, 공통 데이터 공급 검증 계획·owner, 6종 실제 Recharts spike. 기본형+area 100%/pie 다중 링/radar 결측/radial 각도·누적에서 R1 공개 API 표현 가능성·≤1px 확인. **R10 first nail — `curve=monotone` × `orientation=horizontal` 라인 1개를 Canvas 와 pinned Recharts 로 렌더해 앵커가 아닌 구간 중간점(t=0.5) 좌표를 대조**                                                                                                                                 | UI 전환 미착수, 불일치 입력/공개 API 한계를 보고하고 설계 수정       |
| G1   | 공통 계약 완료           | row 의미·default·필드 매핑·단위·토큰·runtime 옵션이 단일 원천. 손계산 데이터와 실제 Recharts 결과 대조                                                                                                                                                                                                                                                                                                                                                                     | 해당 계약 수정, 기존 문서 값 덮어쓰기 금지                           |
| G2   | 저작 UI 완료             | Charts 6종 실제 추가·정확한 종류/표시 이름·최근/즐겨찾기·검색, 기본 Chart Type 0개, 유효 필드·프리셋 patch·Undo/Redo·재열기                                                                                                                                                                                                                                                                                                                                                | UI 단계 미종결                                                       |
| G3   | 데이터/runtime 연결 완료 | Chart와 기존 데이터 컴포넌트가 동일 source를 소비. Preview cold reload와 독립 Publish 산출물에서 실제 API/DataTable/정적 데이터·로딩·빈 값·오류·업데이트 검증. runtime 200행 절삭 0                                                                                                                                                                                                                                                                                        | 공통 공급 결손을 선행 수리, 샘플로 PASS 대체 금지                    |
| G4   | 시각/동작 검증           | 6종+초기 프리셋, 명시 옵션 전수의 Canvas/실제 Recharts 의미 정합·주요 좌표 ≤1px. **앵커 사이 기하** — curve 3종(monotone/linear/step) × orientation 2 와 pie/donut/radial arc 에서 구간 중간점 좌표 ≤1px 또는 곡선 영역 픽셀 diff 허용치 명시(AA 만 면제). **R11** — Preview/Publish DOM wrapper의 `react-aria-Chart` base class·`data-variant`/`data-size` 매칭, Canvas와 토큰 해소값·그림 대조. light/dark·resize·애니메이션 전/중/후·tooltip·접근성·reduced-motion 검증 | 불일치 조합 수리. runtime-only 옵션을 정적 그림 변화로 채점하지 않음 |
| G5   | 성능/번들                | HC7/8 충족, 모든 신규 chunk 포함한 같은 기준 순증, 가시 populated Builder A/B, 불리 편집/resize와 runtime 데이터 교체 비용 보고                                                                                                                                                                                                                                                                                                                                            | lazy graph·변환 비용 수리, 예산 초과를 자동 승인하지 않음            |
| G6   | 전환 종결                | 기존 문서 0 강제 재직렬화, legacy/new/ref 문서 reload·export/import·Undo·rollback, Preview/Publish 같은 runtime, 관련 focused tests·cross-check·preflight·실사용 증거                                                                                                                                                                                                                                                                                                      | 이전 릴리스 유지, Implemented 승격 금지                              |

측정 표본·불리 조건·대조군·oracle·기기 조건은 breakdown §6에 정의한다. 작성 시점에는 전부 미실행이었다. 현재 G0~G4는 통과했으며 G5/G6의 잔여 조건은 실행 기록과 evidence를 따른다.

## Consequences

### Positive

- 원하는 차트를 직접 추가하고 그 차트에 맞는 옵션을 편집한다. 기존 사용자 데이터 연결 방식은 유지한다.
- 애니메이션과 runtime 상호작용에 실제 Recharts를 활용하면서 Builder의 독립 Canvas 구조를 유지한다.
- catalog·기본값·데이터 계약 6벌 복제와 canonical 타입 마이그레이션을 피한다.

### Negative

- 기존 byte-identical 기하 보증 대신 두 구현의 결과를 지속적으로 검증해야 한다. Recharts 업데이트는 지원 옵션 matrix와 시각 게이트 재검증을 요구한다.
- chart runtime 번들과 lazy 로딩/오류 처리가 추가된다. chart가 있는 Publish 페이지의 최초 사용 비용은 없어지지 않는다.
- 공통 collection 서비스의 실제 연결이 선행 조건이다. 라이브러리 교체가 기존 provider 결손을 자동으로 해결하지 않는다.
- runtime의 200행 절삭 제거 및 animation 신규 기본값은 사용자 가시 변화이므로 구현 종결 때 CHANGELOG에 기록한다.

## 실행 기록

- 2026-09-09 P0: 실제 Recharts 3.10.1 Chromium 9/9 및 타입 검사 PASS. [입력·매핑·baseline·데이터 결선 inventory](evidence/209-p0-recharts-spike.md). 기존 초기 번들 초과 처리는 미확정이며 G5 미실행. P1 착수.

- 2026-09-09 P1/P2: 공통 row/layout/descriptor 계약, Charts 6종 생성·조건부 Properties·프리셋·Undo/Redo·검색/재열기 구현. G1/G2 PASS.
- 2026-09-09 P3/P4: 공통 collection provider와 JSON envelope, 실제 native Recharts 6종으로 전환. production Preview/독립 Publish의 전체 행·빈 값·오류·업데이트를 확인했다. 기본 Chromium 140건+실제 CSS/Skia token 24건, DPR2/dark/reduced-motion 149건 PASS. G3/G4 PASS.
- 2026-09-09 P5: 5쌍 Builder p95 증가 최대 0.4ms, warm runtime 200행 p95 40.0~48.5ms. 초기 JS/lazy 순증은 예산 이내. Chart ref의 편집·Undo·Export/Import·재저장은 현재 및 baseline 코드에서 확인했다. 기존 전체 초기 <500KB 초과 처리와 production Builder 로그인 후 부트 네트워크 검증은 미종결. Implemented 승격·커밋·배포는 수행하지 않았다.
- 2026-09-09 추가 오류 수리: ID 없는 차트 행 선택 시 중복 React key, 해당 행 편집/삭제 target 오류를 수정했다. 새 차트 생성→행 수정→삭제→Undo→reload에서 값 보존과 console warn/error 0을 확인했다. Preview API hydration/재시도 후 남던 이전 오류도 공통 hook의 현재 loadingState 판정으로 수정했다.
- 2026-09-09 padding 후속 수리: Styles 값은 저장됐지만 chart metrics가 catalog 기본 여백만 읽던 누락을 수정했다. 공통 4방향 해석을 Canvas와 Recharts에 연결하고 값이 같은 style 재전송 시 애니메이션 재시작을 방지했다. Chromium 170건, 기존 parity 151건, 기하 34건 및 preflight PASS. 기존 차트 padding 편집→Undo→방향별 편집→reload에서 저장·렌더 반영과 console 0을 확인했다. G5/G6 잔여 조건은 유지하며 앞선 번들 수치는 이 후속 수정 전 측정이다.
- 2026-09-09 명칭·언어 후속 수리: 필드 선택과 기본 행 명칭을 통일하고 차트 UI 전체의 ko/en 번역을 기존 i18n 경로에 연결했다. 컬렉션 필드 옵션은 원문으로 표시하며 언어 전환은 canonical 값을 수정하지 않는다. 관련 35개 테스트 및 preflight PASS. 전용 Builder에서 기본 행과 컬렉션 차트의 Settings 언어 왕복·차트 한국어 검색·생성 Undo를 확인했다. 개발 모듈 갱신 중 DOM 제거 오류를 관측했지만 최종 코드 새로고침 후 같은 조작에서는 새 warn/error가 없었다. G5/G6 잔여 조건은 유지한다.

### Live Exercise

전용 Chrome Builder에서 Charts 6종 생성·조건부 속성·프리셋·종류 변경·Undo/Redo·리로드, 추가된 차트 행 수정/삭제/Undo 후 저장 값과 console 0을 확인했다. production Preview/독립 Publish에서 API·DataTable·static rows 갱신과 201/5000행 보존, 빈 값/오류, dark·키보드 tooltip을 확인했다. [실행 조건과 근거](evidence/209-execution-live.md). 로그인된 production Builder 부트와 기존 전체 번들 기준 결정은 미완료로 남긴다.
