# ADR-224: 의도 기반 크기 편집 — Fill 한 번으로 채우기, 비율은 선택 조정

## Status

Proposed — 2026-09-18

사용자 설계 요청: “fill 선택 후 framer처럼 동작되지 않고 fr을 선택해야 해서 불편하다. 사용자에게 더 쉬운 UI/UX 선택지를 주기 위해 기존 방식은 배제한 후 ADR을 설계.” 이번 범위는 설계다. 제품 구현·기존 ADR 상태 변경·commit/push는 포함하지 않는다.

## Context

**문제 정의**: 사용자의 과업은 “남은 공간 채우기”다. `Fill`을 선택한 뒤 `fr`를 다시 선택하거나 입력 문법을 알아야 과업을 끝낼 수 있다면 mode와 단위를 구분한 내부 구현이 사용자에게 추가 작업을 요구한 것이다. 기존 단위 메뉴를 유지하는 것을 목표의 제약으로 삼지 않는다. Framer의 외형 복제도 목표가 아니다.

**증거의 경계**: 위 증상은 사용자 보고다. 현재 소스의 `resolveFill`은 주축 Fill에도 grow=1을 생성한다. 그러므로 “Fill 처리 코드 자체가 없다”거나 “원인이 grow 누락이다”라고 단정하지 않는다. 현재 패널은 `fill`과 `fr`를 별도 메뉴 항목으로 노출하고 숫자 입력을 Fixed 전환으로 해석한다. 이 두 표현을 목표 UX에서 제거한다. 실제 미반영 원인은 실행 Phase 0의 사용자 흐름 재현에서 구분한다.

**Domain**: D3 크기·레이아웃 의미와 D1 패널 입력·접근성을 연결한다. D2 컴포넌트의 `size=xs…xl`과는 별개다. DOM 접근성은 RAC, 시각 기본값과 intrinsic capability는 catalog, authored state는 `CompositionDocument`, 실제 배치는 Rust 엔진/브라우저가 소유한다. Canvas·Preview·publish는 같은 크기 의미를 소비해야 하므로 경계를 함께 다룬다.

### Hard constraints

| ID  | 계약                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HC1 | 유효한 문맥에서 Fill 메뉴 항목 활성화 1회로 채우기 적용. 후속 단위 선택·숫자 입력·확인 클릭 0회. 기본 비율 1.                                             |
| HC2 | 기본 크기 선택은 고정 / 채우기 / 내용 맞춤. `fr`, grow, basis, stretch, auto를 기본 편집 UI의 선택지나 입력 문법으로 요구하지 않는다.                     |
| HC3 | 비율 입력은 Flex 주축 Fill에만 존재. 교차축·Grid 자식·Flow 채우기에는 노출하지 않는다.                                                                    |
| HC4 | 1회 크기 또는 구조 변경 = canonical transaction 1개 = Undo 1회. 순수 resolver와 브라우저 측정은 authored 값을 쓰지 않는다.                                |
| HC5 | 선택하지 않은 축·형제·부모를 암묵적으로 변경하지 않는다. 유효한 기존 intent를 유지하고, 구조 변경으로 무효가 된 대상만 변경 전 geometry로 보존한다.       |
| HC6 | 기존 문서 단순 열기·resize·breakpoint 전환에 따른 영속 쓰기 0회. 마이그레이션 영향은 실제 편집한 소유 범위로 제한한다.                                    |
| HC7 | 수치 fixture에서 Canvas layout rect와 Preview/publish DOM rect 차이 축별 ≤1 CSS px. 단위는 scene/page 좌표이며 zoom·DPR를 곱한 화면 px를 저장하지 않는다. |
| HC8 | 패널 표시는 authored mode·입력값과 계산된 px를 구분한다. 계산값 미확정 시 `—`, 모드 사용 불가 시 이유를 제공한다.                                         |

### 선행 결정과의 관계

- [ADR-026](completed/026-responsive-constraint-ui.md)의 단위 중심 편집·CSS 역추론을 목표 UX/신규 저장 모델의 전제로 승계하지 않는다. 기존 데이터 해석 경계로만 사용한다. 이 ADR이 Implemented되면 크기 편집 관련 결정의 대체 범위를 기록한다. ADR-026 전체를 지금 Superseded 처리하지 않는다.
- [ADR-116](completed/116-canonical-document-ssot-transition.md)은 정본 기반이며 이 ADR이 그 응용이다. [ADR-154](completed/154-responsive-breakpoint-authoring.md)의 명시적인 tier override, [ADR-187](completed/187-editor-presentation-transaction-and-typed-invalidation.md)의 transaction/presentation 계약을 소비한다.
- schema는 기존 CSS 크기와 같은 영역을 대체한다. 직교하는 별도 Size 저장소를 추가하는 설계가 아니다. 새 canonical 필드와 기존 CSS의 소유권 이전을 본 ADR 안에서 해결한다.
- 의존 방향은 canonical/document → semantic sizing → 패널·렌더 소비다. 과거 패널 구조가 새 모델을 제약하지 않는다. 이번 새 ADR 설계 권한은 위 사용자 요청에서 주어졌으며, 구현 승인은 별도다.

### 현재 통합 지점

| 근거                                                                                                        | 확인한 사실                                                            | 설계에서의 역할                                      |
| ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------- |
| `apps/builder/src/builder/panels/styles/sections/TransformSection.tsx` — `commitAxisValue`, `sizeModeUnits` | Fill/fr가 같은 단위 목록에 별도 존재; Fill에서 숫자를 쓰면 Fixed 전환  | 새 Size control로 교체할 진입점                      |
| `apps/builder/src/builder/stores/utils/sizeModeResolver.ts` — `inferSizeMode`, `resolveFill`                | CSS 역추론, `%`도 fixed 분류, `100%`는 Fill 추론, 주축 `flex-basis:0%` | legacy 해석 경계로 축소; 새 intent를 역추론하지 않음 |
| `packages/shared/src/types/composition-document.types.ts` — `CanonicalNode`                                 | props·responsive·fills 등 canonical 필드 소유                          | semantic sizing 저장/복제/ref 왕복 확장              |
| `apps/builder/src/builder/stores/utils/responsiveWriteRouting.ts` — `shouldWriteBreakpointOverride`         | 명시 opt-in으로 base/tier 쓰기 선택                                    | 새 축별 sizing도 같은 적용 범위 정책 사용            |
| `packages/shared/src/utils/responsiveCss.ts` — `buildResponsiveElementCss`                                  | responsive 스타일 CSS 생성                                             | parent direction까지 tier별 해석하여 출력할 경계     |
| `apps/builder/src/adapters/canonical/canonicalDocumentMigrations.ts` — `applyCanonicalDocumentMigrations`   | 순수·멱등 migration 체인                                               | 형식 검증·정규화; geometry 의존 변환 금지            |

### 외부 근거

2026-09-18 공식 자료 확인. 제품의 최신 실 UI를 직접 조작한 비교 실험은 아니다.

- [Framer Academy](https://www.framer.com/academy/lessons/framer-fundamentals-sizing-to-fill-and-fit-content): Fill은 가용 공간, Fit은 자식 콘텐츠에 대한 의도다. 순환 의존을 검토해야 한다. 의도 용어를 참고하며 수업 화면을 복제하지 않는다.
- [Figma Auto Layout 설계 기록](https://www.figma.com/blog/behind-the-feature-the-making-of-the-new-auto-layout/): Fixed/Fill/Hug를 하나의 선택으로 모은 배경은 서로 충돌하는 크기 의도를 명확히 하기 위해서다. 기본 선택을 3개로 정리하는 대안의 근거다.
- [Webflow Flexbox](https://help.webflow.com/hc/en-us/articles/33961260795155-Flexbox): 자식 sizing에서 grow/shrink를 직접 다룬다. 개발자 제어력을 높이는 대안이지만 본 과업의 기본 UI에는 적용하지 않는다.
- [CSS Flexbox §9.7](https://www.w3.org/TR/css-flexbox-1/#resolve-flexible-lengths), [CSS Sizing §2](https://www.w3.org/TR/css-sizing-3/#terms): 제약을 포함한 공간 재분배와 definite/intrinsic 구분의 계산 근거다.

## Alternatives Considered

| 대안                         | 설명                                                                      | 기술   | 성능   | 유지보수 | 마이그레이션 |
| ---------------------------- | ------------------------------------------------------------------------- | ------ | ------ | -------- | ------------ |
| A. 단위 메뉴 간소화          | 기존 CSS 저장을 유지하고 `fr` 항목만 숨기며 Fill 입력을 보정              | MEDIUM | LOW    | HIGH     | LOW          |
| B. 의도 3종 + 문맥별 값 편집 | 고정/채우기/내용 맞춤, 보조 `%`/화면 기준. semantic 저장과 단일 해석 계약 | HIGH   | MEDIUM | MEDIUM   | HIGH         |
| C. 부모 중심 자동 배분       | 부모에서 균등/비율 배분을 선택하면 자식 크기를 일괄 변경                  | MEDIUM | LOW    | MEDIUM   | MEDIUM       |

### Risk per Alternative

- **A**: 가장 적은 코드로 표면 증상을 줄인다. 그러나 `100%`와 Fill 구별, direction 전환 후 축별 비율, 기본값/명시값 구분을 CSS에서 다시 추론해야 한다. 사용자 요구인 기존 방식 배제와 장기 예측 가능성을 충족하지 못한다.
- **B**: 사용자 입력의 의미가 유지된다. 대신 schema·responsive·ref·CSS 출력까지 바꿔야 하며 한 소비처 누락이 저장 유실 또는 Canvas/Preview 차이를 만든다. 공유 compiler와 편집 범위 전환, roundtrip gate로 관리한다.
- **C**: 균등 카드 과업은 짧다. 고정 로고 + Fill 본문처럼 혼합된 자식 의도를 설명하기 어렵고, 자식 1개를 수정하려다 형제까지 바뀔 위험이 있다. 기본 소유 단위가 사용자 과업과 다르다.

### Risk Threshold Check

| 대안 | HIGH 이상         | 판정                                                                 |
| ---- | ----------------- | -------------------------------------------------------------------- |
| A    | 유지보수          | 기각: 재추론이 근본 불확실성을 유지                                  |
| B    | 기술·마이그레이션 | 조건부 선택: R1/G2 및 R2/G3·G4가 실행 완료의 필수 조건               |
| C    | 없음              | HC5 위반으로 기각; 낮은 구현 위험만으로 사용자 과업을 대체할 수 없음 |

모든 대안이 HIGH인 상황은 아니므로 추가 루프는 불필요하다. B의 저장/렌더 경계를 다른 ADR로 분리하면 새 UI만 먼저 적용되고 의미 정본이 두 벌로 남는다. 동일 ADR의 단계별 gate로 함께 종결한다. 위험은 수용하되 제품 적용 가능성은 아직 **UNVERIFIED**다.

## Decision

> 구현 상세: [224-intent-based-size-authoring-breakdown.md](design/224-intent-based-size-authoring-breakdown.md)

**대안 B를 제안한다. 사용자에게는 의도 선택, 시스템에는 문맥 해석 책임을 부여한다.**

1. **Fill은 완성된 동작이다.** 선택 즉시 기본 비율 1로 공간 채우기를 적용한다. `fr`는 별도 mode·단위 메뉴·필수 입력에서 제거한다. 같은 Fill 재선택은 기존 비율을 유지하고, 다른 mode에서 Fill로 진입하면 1로 시작한다.
2. **기본 선택은 3개다.** `고정(Fixed)`, `채우기(Fill)`, `내용 맞춤(Fit Content)`을 먼저 보여준다. `%`와 `화면 기준`은 같은 메뉴의 보조 그룹에 둔다. 기본값 복원은 mode가 아닌 행 액션이다. 내부 Auto는 노출하지 않는다.
3. **비율은 선택 조정이다.** Flex 주축 Fill일 때만 `비율 1` 입력을 보여준다. 수정하지 않아도 완료된 상태다. 교차축은 stretch, Grid 자식은 cell/area 채우기이며 비율 입력이 없다. Grid track의 `fr` 편집은 부모 Layout 영역에 남는다.
4. **선택 가능한 조건을 미리 알린다.** 불가능한 주요 mode는 이유와 함께 disabled로 남겨 위치를 고정한다. 부모 Fit과의 순환처럼 채울 공간이 정의되지 않은 경우 부모를 자동 Fixed로 바꾸지 않는다. 현재 저장된 intent가 일시적으로 미해결이면 별도 상태로 표시하고 보존한다.
5. **축별 intent와 계산 결과를 분리한다.** width/height mode·factor는 canonical semantic 데이터다. 실제 px는 read-only layout 결과다. aspect ratio·줄바꿈으로 계산은 연결될 수 있지만 한 축 편집이 반대 축 authored mode를 바꾸지는 않는다.
6. **구조 변경은 한 transaction으로 처리한다.** Flow→Absolute, Flex/Grid→Free 등으로 Fill이 무효가 되면 변경 직전 geometry를 보존한다. Absolute→Flow 복원은 저장한 이전 intent가 유효하고 해당 축에 후속 편집이 없을 때만 적용한다. direction 전환은 intent를 재작성하지 않는다.
7. **동일한 semantic 해석을 모든 소비처에 공급한다.** shared TypeScript compiler는 CSS/엔진 입력을 만들고 Rust는 배치를 계산한다. 패널별 판단표나 Rust의 두 번째 mode 추론을 만들지 않는다. Min/Max는 엔진의 재분배에 참여한다.
8. **기존 문서는 호환 경계에서 보존한다.** CSS만 있는 문서를 열었다고 재저장하지 않는다. 해석이 모호한 기존 값은 그대로 보여주고, 사용자가 새 mode를 선택한 소유 범위만 canonical sizing으로 전환한다. 새 UI를 기존 단위 메뉴에 맞춰 축소하지 않는다.

A는 동작 표현의 중복을 제거해도 저장 의미의 중복이 남아 기각한다. C는 부모·형제의 자동 변경이 기본 동작이 되어 기각한다. B의 잔존 위험은 새 입력부터 의미를 명확히 소유하고 저장 왕복·다중 소비처 gate를 통과한 뒤에만 활성화하는 조건으로 수용한다.

## Risks

| ID  | 위험                                                                | 심각도 | 대응                                                          |
| --- | ------------------------------------------------------------------- | ------ | ------------------------------------------------------------- |
| R1  | canonical/DB/ref/import 중 한 경로가 sizing 또는 복원 기록을 유실   | HIGH   | 명시 schema·owner·roundtrip 계약, G2                          |
| R2  | CSS/엔진 해석·responsive parent context가 달라 실제 크기 발산       | HIGH   | 공통 compiler, tier별 context, 수치 oracle, G3·G4             |
| R3  | stale geometry 또는 반대 축 속성 삭제로 구조 전환 시 화면/Undo 훼손 | HIGH   | version 검증 snapshot + atomic planner + G4                   |
| R4  | 기본값·불가 상태·비율 값이 복잡해져 UX 개선이 이름 변경에 그침      | MEDIUM | G1 상호작용 수 + G5 과업 관찰; 사용성 개선은 실측 전 미확정   |
| R5  | sibling 비율·context 갱신이 매 프레임 전체 문서를 순회              | MEDIUM | affected parent/tier 단위 invalidation; G6                    |
| R6  | 옛 문서를 추정 변환하거나 구버전 editor가 새 데이터를 지움          | HIGH   | no-write-on-open·보수적 legacy passthrough·지원 버전 검사, G2 |

## Gates

모든 제품 gate는 작성 시점 **UNVERIFIED**다. 문서 검증 통과와 제품 동작 검증을 구분한다.

| Gate | 시점         | 통과 조건                                                                                                                                                                                     | 실패 시 대안                                                             |
| ---- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| G0   | 구현 착수 전 | 현재 Fill/fr 증상 재현 결과, canonical→DB→hydration→UI→Preview 경로, capability/지원 문맥/기존 문서 corpus 수량 확정                                                                          | 조사 보완; 추정 원인에 맞춘 UI만 먼저 출시하지 않음                      |
| G1   | 입력 구현    | 유효 Fill 활성화 1회·추가 commit 0회, 기본 factor1, cross/Grid에 비율 0개, keyboard 동일, 240/320px 패널에서 잘림 0                                                                           | 입력 흐름 수리                                                           |
| G2   | 저장 구현    | base/tier·origin/ref/descendant·복제/import/export·DB reload·Undo/Redo 무손실, 열기/resize 쓰기0; unsupported schema 편집 차단                                                                | cutover 보류; 원본 문서 유지                                             |
| G3   | 렌더 구현    | 동일 fixture Canvas/Preview/publish Δ≤1 CSS px; 분배·min/max·wrap·비정수 비율·텍스트/이미지·자동 최소 크기 포함                                                                               | compiler/엔진 계약 수리; DOM 임시 보정 금지                              |
| G4   | 전이 구현    | direction 왕복 factor 보존, Absolute 전환 geometry/Undo, 후속 편집 복원 차단, responsive 전환 authored 쓰기0, stale snapshot commit0                                                          | transition planner 수리                                                  |
| G5   | UI 완료      | foreground Builder 실제 과업·키보드·스크린리더 상태 확인 및 read-back. 신규 사용자 5명 중 ≥4명이 도움 없이 Fill/2:1 과업 성공, Fill 완료 중앙값≤10초, 의도하지 않은 부모·형제 변경0           | 사용자 테스트 전에는 ‘더 쉬워졌다’ 확정 금지; 관찰에 따라 문구/배치 수정 |
| G6   | 완료 전      | 동일 머신·HEAD fixture A/B, 100/1,000 자식의 resize/비율 변경 각 30회에서 layout+commit p95 증가 ≤max(기준선의10%,1ms), 신규 측정용 강제 DOM read0; scoped preflight 및 CHANGELOG/인덱스 정합 | 캐시·영향 범위 수리; 예산 임의 완화 금지                                 |

### Live Exercise

미실행. 설계 작성은 G0~G6 통과를 의미하지 않는다. 자동 브라우저 검증과 G5 사람 대상 사용성 관찰을 각각 기록한다.

## Consequences

### Positive

- 사용자는 “채우기”를 선택하는 것으로 과업을 완료한다. `fr` 지식과 후속 단위 변경이 필요 없다.
- 같은 mode가 방향 전환·저장·새로고침 후에도 같은 의도를 유지한다.
- 크기 입력과 계산된 px가 구별되고, 사용 불가 사유를 선택 전에 알 수 있다.

### Negative

- 패널 수정에 그치지 않고 canonical 필드·responsive compiler·저장 왕복 경계를 함께 확장해야 한다.
- legacy CSS를 정확히 보존하는 호환 reader가 필요하다. 사용자가 편집하지 않은 문서를 강제 변환하지 않으므로 이 경계는 일정 기간 유지된다.
- UI에서 숨긴 계산 복잡도를 compiler와 transition planner가 책임진다. 실제 사용성 개선 여부는 G5 실측이 필요하다.
