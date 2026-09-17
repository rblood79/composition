# ADR-224: 의도 기반 크기 편집 — Fill 한 번으로 채우기, 가중치는 선택 조정

## Status

Proposed — 2026-09-18

사용자 요청: 기존 Fill/fr 선택 방식의 불편을 해소하고, 기존 스타일 패널의 Size 디자인 패턴을 유지하는 ADR 설계. Round 1 HIGH 4·MEDIUM 3·LOW 1을 반영해 범위를 개정했다. 설계 수리이며 구현 승인·Accepted 승격은 아니다.

## Context

**문제**: 사용자는 Fill을 선택하고 같은 입력에서 배분값을 조정하기를 기대한다. `fr`를 다시 선택해야 가중치를 편집할 수 있고 숫자 입력이 Fixed로 바뀌는 동작은 이 과업을 방해한다. 개선 대상은 선택·입력의 의미이며 Size 섹션 격자는 보존한다.

**증거 경계**: 현행 `resolveFill`은 이미 grow1을 설정한다. 사용자 보고를 “Fill 코드가 없다”로 해석하지 않는다. `commitAxisValue`의 숫자→Fixed 분기와 `sizeModeUnits`의 Fill/fr 중복은 코드에서 확인했다. 실제 증상이 메뉴·입력·저장·렌더 중 어디에서 발생하는지는 G0에서 재현한다.

**Domain**: D1 RAC 입력·접근성과 D3 크기·레이아웃 계약. D2 컴포넌트 XS–XL은 범위 밖이다. catalog/theme가 시각 기본값, CompositionDocument가 authored 정본, Rust/브라우저가 배치 결과를 소유한다.

### Hard constraints

| ID  | 계약                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HC1 | 유효한 Fill 항목 활성화1회로 적용 완료, 이후 단위 선택·숫자 입력·확인0회. 신규 Fill 가중치1.                                                                  |
| HC2 | Width와 Height가 나란한 기존 한 상자 입력, 상자 안 트리거, legend, 28px action cell, Min/Max 펼침·Ratio·Overflow 위치 유지. 추가 상시 행0, 별도 mode Select0. |
| HC3 | 기본 선택 고정/채우기/내용 맞춤, 같은 메뉴의 보조 선택 부모 비율/화면 기준. fr 재선택 제거. Flex 주축 Fill에서만 숫자는 가중치.                               |
| HC4 | 1회 명시 편집/구조 전환은 canonical transaction1개·Undo1회. 측정·viewport/breakpoint 전환의 authored 쓰기0.                                                   |
| HC5 | 선택한 소유 범위만 편집한다. Ratio 잠금은 Height를 종속시키는 명시 복합 동작이다. 무효 Fill geometry 보존 외 부모·형제 자동 모드 변경은 없다.                 |
| HC6 | semantic 저장은 Fill의 축별 가중치만 추가한다. Fixed/%/viewport/fit-content, Min/Max, aspectRatio는 기존 CSS 정본 유지. 이전 mode 자동 복원 기록0.            |
| HC7 | 동일 viewport 수치 fixture에서 Canvas rect와 Preview/publish DOM rect 차이 축별≤1 CSS px. 무관한 기존 CSS 데이터·Fixed shrink 정책 변경0.                     |
| HC8 | authored 가중치와 계산 px를 구별한다. 계산값은 기존 placeholder/tooltip/접근 설명에 제공한다. 잠긴 종속 축은 자동(비율) 읽기 전용이다.                        |

### 선행 계약과 개정 범위

- [ADR-026](completed/026-responsive-constraint-ui.md)의 Fill/fr 입력 방식만 대체한다. 기존 CSS 크기·단위 편집과 패널 격자는 재사용한다. 전체 ADR 상태는 바꾸지 않는다.
- [ADR-116](completed/116-canonical-document-ssot-transition.md)은 기반, 이 ADR은 응용이다. [ADR-154](completed/154-responsive-breakpoint-authoring.md)의 base/tier 명시 opt-in과 [ADR-187](completed/187-editor-presentation-transaction-and-typed-invalidation.md)의 transaction을 소비한다.
- Fill은 부모 문맥에 따라 CSS 표현이 바뀌므로 축별 factor를 보존한다. 나머지 모드의 크기값은 기존 CSS로 충분하다. **Fill 전용 의미 보강**이며 다섯 모드의 전면 schema 전환이 아니다. Fill 해제 시 속성 정리는 여전히 부모 문맥을 고려한다.
- `x-composition.sizingRestore` 신설과 Absolute→Flow 자동 복원은 제외한다. Undo가 이전 상태 전체를 복원한다. 이번 개정은 같은 ADR 안의 범위 축소다.

### 코드 근거

| 경로·심볼                                                                              | 확인 사실 / 설계 영향                                                                                      |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `apps/builder/src/builder/panels/styles/sections/TransformSection.tsx:577`             | Width\|Height 한 행, 내부 단위 트리거·28px 제약 액션; 이 구조 보존                                         |
| `apps/builder/src/builder/components/property/PropertyUnitInput.tsx`                   | placeholder·unitSuffix 입력 구조 재사용; mode별 numeric 의미를 Size 소비처에서 지정                        |
| `apps/builder/src/builder/stores/utils/sizeModeResolver.ts` — resolveFixed/resolveFill | Fixed는 크기값+Fill 속성 정리. shrink0 전환은 현행 정책이 아니므로 도입하지 않음                           |
| `apps/builder/src/builder/utils/aspectRatio.ts:75`                                     | Ratio helper가 조건부 height:auto 생성. Fill의 Height marker/교차 stretch 정리까지 포함하는 복합 명령 필요 |
| `packages/shared/src/types/composition-document.types.ts:1197`                         | extension behavior 필드는 deprecated, editor는 runtime metadata. 새 복원 필드 불필요                       |
| `packages/shared/src/types/pencil-adapter.types.ts:106` — PENCIL_NODE_FIELDS           | Fill 전용 sizing도 직접 필드 등록·왕복 검증 필요                                                           |
| `packages/shared/src/utils/responsiveCss.ts:97` — buildResponsiveElementCss            | 현재 per-node 인자로 parent context 없음; Fill용 effective context 운반과 호출자 변경 필요                 |
| `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts`                       | props/style와 parent id 중심 signature; sizing 및 effective layout parent/tier 의존 추가 필요              |

### 외부 근거

2026-09-18 작성 시 확인한 공식 자료를 유지한다. 최신 제품 UI를 직접 조작한 비교 실험은 아니다.

- [Framer Academy](https://www.framer.com/academy/lessons/framer-fundamentals-sizing-to-fill-and-fit-content): 가용 공간을 채우는 Fill과 콘텐츠 기준 Fit, 순환 의존의 개념을 참고한다.
- [Figma Auto Layout 설계 기록](https://www.figma.com/blog/behind-the-feature-the-making-of-the-new-auto-layout/): Fixed/Fill/Hug를 하나의 선택으로 모으는 의도 구분을 참고한다.
- [Webflow Flexbox](https://help.webflow.com/hc/en-us/articles/33961260795155-Flexbox): 직접 grow/shrink 편집은 제어력이 높지만 기본 과업에 필요한 UI가 아니다.
- [CSS Flexbox §9.7](https://www.w3.org/TR/css-flexbox-1/#resolve-flexible-lengths), [CSS Sizing §2](https://www.w3.org/TR/css-sizing-3/#terms): 제약을 포함한 분배와 intrinsic/definite 구분의 근거다.

## Alternatives Considered

| 대안                               | 설명                                                      | 기술   | 성능   | 유지보수 | 마이그레이션 |
| ---------------------------------- | --------------------------------------------------------- | ------ | ------ | -------- | ------------ |
| A. CSS만 유지                      | 기존 상자에서 Fill 숫자를 grow로 직접 편집                | LOW    | LOW    | HIGH     | LOW          |
| B. 모든 mode semantic 전환         | 5개 mode를 sizing으로 옮기고 별도 control·compiler로 관리 | HIGH   | MEDIUM | HIGH     | HIGH         |
| C. 기존 상자 + Fill 전용 의미 보강 | 숫자=가중치, 내부 트리거=그룹 메뉴; 축별 Fill만 저장      | MEDIUM | LOW    | MEDIUM   | MEDIUM       |

### Risk per Alternative

- A는 가장 작은 UX 수정이다. 그러나 width/height factor가 단일 flexGrow에 합쳐져 방향 왕복에서 이전 축 가중치를 보존하지 못한다. 해당 보존 계약을 버리는 대안으로는 유효하지만 HC6 목표를 만족하지 못한다.
- B는 모든 mode의 표현을 통일한다. 기존 CSS와 소유권·migration 경계가 중복되고 별도 control은 HC2를 위반한다. Round 1에서 지적된 과도한 범위다.
- C는 Fill에서만 문맥 의존 해석을 공유한다. schema 왕복·tier 상속·Ratio의 복합 쓰기 위험은 남지만 나머지 CSS와 컨트롤을 재사용한다.

### Risk Threshold Check

| 대안 | HIGH 이상                  | 판정                                                 |
| ---- | -------------------------- | ---------------------------------------------------- |
| A    | 유지보수                   | 방향 왕복 factor 손실 때문에 기각                    |
| B    | 기술·유지보수·마이그레이션 | 초기 제안에서 철회; 요청보다 넓은 변경               |
| C    | 비교 단계 HIGH 없음        | 선택; 저장/렌더 유실 실패의 영향은 R1~R3 gate로 관리 |

모든 대안이 HIGH인 상황은 아니므로 추가 대안 루프는 불필요하다. C도 단순 label 변경은 아니며 Fill 입력→저장→projection이 함께 닫혀야 한다. 이를 별도 ADR로 분리하면 UI만 바뀌고 factor 보존 계약이 남으므로 같은 ADR에서 검증한다.

## Decision

> 구현 상세: [224-intent-based-size-authoring-breakdown.md](design/224-intent-based-size-authoring-breakdown.md)

**대안 C를 제안한다. 기존 Size 격자와 CSS 크기 저장을 유지하고 Fill에 필요한 의미만 추가한다.**

1. Width\|Height 한 행과 각 한 상자를 유지한다. 기존 내부 트리거를 `고정·채우기·내용 맞춤 ┃ 부모 비율·화면 기준` 그룹 메뉴로 확장한다. 별도 mode Select·계산 크기 행을 추가하지 않는다.
2. Fill을 처음 선택하면 가중치1로 즉시 적용한다. 주축 Fill의 같은 숫자 영역은 `가중치` 편집이다. `2` 입력을 Fixed2px로 전환하지 않는다. 교차축/Grid에는 가중치 편집이 없다.
3. Fill 가중치는 유한한1~1000, step1, 소수 직접 입력 허용이다. 동일 Fill 재선택은 단일/다중 모두 각 기존 값을 보존한다. 신규 진입 대상만1로 초기화한다. sibling 정규화는 도입하지 않는다.
4. `CanonicalNode.sizing`은 축별 `{ factor }`만 보유한다. 부재는 기존 CSS 소유이며 tier/ref 상속 해제를 위한 null은 Fill 해제 표지다. 나머지 모드 및 제약은 기존 CSS 그대로 저장한다.
5. Ratio는 기존 행·lock 버튼을 유지한다. 새 잠금은 Width를 기준으로 Height를 `auto`로 만들고 Height Fill을 해제한다. Height는 `자동(비율)` 읽기 전용, Fill/Fit 등 독립 mode 선택 불가다. 잠금 해제와 resize의 계약은 상세 설계에 고정한다.
6. Min/Max의 저장·배치·펼침 동작은 유지한다. catalog/origin/instance/tier의 유효한 명시 Min을 보존하고, 그 최종 값이 부재/auto인 주축 Fill만 min0으로 projection한다. Fixed의 flex-shrink 기본 정책은 변경하지 않는다.
7. direction 변경은 축별 Fill marker를 재작성하지 않고 파생 CSS를 바꾼다. Flow→Absolute 등 무효 Fill만 변경 전 geometry로 고정한다. Absolute→Flow는 Fixed를 유지하며 이전 Fill을 자동 복원하지 않는다.
8. responsive CSS는 effective layout parent의 tier별 문맥을 입력받는다. canonical/nested·flat collector, Preview·publish·static export 및 layout cache를 함께 바꾼다. CSS만 있는 문서를 열었다고 전환·재저장하지 않는다.

B의 큰 migration과 UI 변경을 수용할 이유가 없어 철회한다. A의 최소 비용은 유리하지만 축별 가중치 보존을 포기하므로 기각한다. C의 남은 통합 비용은 Fill 범위의 왕복·문맥 gate로 제한한다.

## Risks

| ID  | 위험                                                         | 심각도 | 대응                                                       |
| --- | ------------------------------------------------------------ | ------ | ---------------------------------------------------------- |
| R1  | sizing factor 또는 tier null이 DB/ref/Pencil에서 유실        | HIGH   | direct fields·schema·mutation 왕복 G2                      |
| R2  | parent tier 의존 CSS나 cache 갱신이 누락되어 Canvas/DOM 발산 | HIGH   | context 전달 호출자·signature 명시, G3/G4                  |
| R3  | Ratio/Absolute 복합 쓰기에서 반대 축이나 tier geometry 유실  | HIGH   | scope·snapshot 검증+Undo1회, G4                            |
| R4  | 가중치·Ratio·placeholder가 혼동되어 과업을 막음              | MEDIUM | 기존 배치 유지, 의미별 접근 이름, G1/G5                    |
| R5  | 모든 문서를 새로 compile하거나 legacy 크기를 변경            | MEDIUM | Fill 노드 의존 범위·무편집 no-write·Fixed 동일 동작, G2/G6 |

## Gates

제품 G0~G6는 모두 **UNVERIFIED**다. 설계 수리와 제품 검증을 구분한다.

| Gate | 시점      | 통과 조건                                                                                                                                                              | 실패 시 대안                                |
| ---- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| G0   | 구현 전   | Fill 선택/가중치 수정의 보고 증상 재현, 현재 mode×context·Ratio·Min 우선순위 및 저장 경로 확인                                                                         | 원인/fixture 확정 후 구현                   |
| G1   | UI 구현   | Width\|Height·Min/Max·Ratio·Overflow 기존 위치 유지, 추가 행/Select0, Fill 이후 추가 commit0, 같은 상자에서 가중치2, 단일/다중 재선택 값 보존, 240/320px 패널 잘림0    | control 수정                                |
| G2   | 저장 구현 | Fill factor/null의 base/tier/ref/descendant/DB refresh/Pencil/import/export/복제/Undo 왕복; 비Fill CSS 값·Fixed shrink 동작 불변, 무편집 저장0                         | 소유권/adapter 수정                         |
| G3   | 렌더 구현 | 동일 viewport Canvas/Preview/publish Δ≤1 CSS px; 1:2·1.5:3·wrap·grid·명시 catalog Min/auto Min·max 분배 포함                                                           | 공통 projection/엔진 수정                   |
| G4   | 전이 구현 | direction 왕복 factor 유지, parent-only tier CSS 갱신, Absolute→Flow 자동 복원0·Undo 복원, Ratio lock/unlock/resize 및 legacy ratio 보존, stale snapshot commit0       | 복합 명령/cache 수정                        |
| G5   | 과업 완료 | foreground Builder에서 소유자가 Fill/가중치2/Ratio/MinMax 과업을 관찰·확인; activation 계측과 canonical+DOM read-back 일치, 키보드 동일, 의도하지 않은 부모·형제 변경0 | 관찰된 흐름 수리; 소유자 확인 전 UNVERIFIED |
| G6   | 완료 전   | 동일 조건 A/B, 100/1,000 자식의 resize/가중치 편집 각30회 layout+commit p95 증가≤max(기준선10%,1ms), 신규 강제 DOM 측정0; scoped preflight·CHANGELOG·README 정합       | 영향 범위/캐시 수리                         |

**Deferred U1**: 신규 사용자5명의 도움 없는 과업 관찰은 후속 사용성 연구다. Implemented의 필수 조건이 아니며 관찰 전 일반 사용자에게 더 쉬워졌다고 실증 주장하지 않는다. G5 소유자 과업 관찰과 조작 수 계측은 blocking으로 남긴다.

### Live Exercise

미실행. 문서·코드 대조와 설계 수리만 수행했다. 구현 시 G5 소유자 확인과 자동 브라우저 증거를 각각 기록한다.

## Consequences

### Positive

- 기존 패널에 익숙한 사용자가 같은 상자에서 Fill 선택과 가중치 조정을 끝낸다.
- Ratio와 가중치의 용어·편집 역할이 구별된다.
- CSS 기반 크기 정본을 유지하면서 Fill의 방향별 의도만 보강한다.

### Negative

- Fill 전용이더라도 canonical/ref/tier 왕복과 parent-aware 출력 경계는 필요하다.
- Ratio의 복합 동작과 nullable Fill 상속 해제를 테스트해야 한다.
- 기존 문서의 모호한 CSS를 자동 Fill로 전환하지 않으므로 모든 옛 값이 신규 의미를 얻는 것은 아니다.
