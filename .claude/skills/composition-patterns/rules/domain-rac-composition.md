---
title: Catalog RAC Composition Contract
impact: HIGH
impactDescription: children·slot·상태 주체를 다르게 해석하면 Canvas와 DOM 조립이 갈라짐
tags: [domain, catalog, rac, composition, state]
---

# RAC 조립 계약 (ADR-255·256)

구조·상태 조립을 구현하거나 검증할 때 읽는다. D1/D2/D3 권위는
[SSOT](../../../rules/ssot-hierarchy.md), 문서 변경은 [상태 관리](../../../rules/state-management.md),
원본 변경·저장 버전은 [구조 변경 감사](domain-structure-change-audit.md)가 정본이다.
아래 `catalog/`는 `packages/shared/src/catalog/` 기준이다.

## 노드 트리와 전환 범위

Preview는 전환된 family의 작성 노드를 부모 RAC context 안에서 자식 순서대로 렌더한다.
RAC가 DOM 요소를 만들지 않는 부품에 임의 wrapper를 추가하지 않는다. binding은 RAC에 필요한
collection id/textValue·상태·overlay 연결을 담당하며, 작성 자식을 고정 props로 재조립하지 않는다.

전환 여부는 `catalog/nesting/nestingRules.ts`의 `UNCONVERTED_FAMILY_LIMITS`와 해당
`runtime/domBinding.tsx` · `delegatedDom.tsx` 구현을 함께 확인한다. ADR-256은 진행 중이며
제한 표의 행을 전환·검증 없이 지우거나 미전환 family의 옛 renderer를 새 기본 패턴으로 삼지 않는다.
반복 template 등 후속 Phase의 설계를 현재 구현 완료로 가정하지 않는다.

Popover·Tooltip 팔레트 원본은 trigger 조합이다. 루트 타입을 이름으로 추측하지 않는다.
현재 Select·overlay 예시는 [합성 구조](../reference/compositional-architecture.md)에 있다.

## 넣기 판정과 RAC slot

- `packages/shared/src/domain/componentTraits.ts`의 계약과 `catalogChildKind`가
  `leaf` · `items` · `free`를 판정한다. 중첩 규칙·넣기 목록·빈 slot 표시는 같은 판정을 읽는다.
  이름 붙은 template 자리와 `slotFills`는 문서의 채움 구조이며 RAC의 context 연결 `slot`과 다르다.
- RAC slot 연결은 `runtime/racSlot.ts` · `racSlotScope.tsx`에서 해석한다. 제공자 정보는
  설치 RAC에서 생성한 `catalog/generated/racSlotProviders.ts`를 읽고 수동 표를 복제하지 않는다.
- 미지정은 기본 slot이 있으면 prop을 생략한다. 이름이 유효하면 전달한다. 이름 표가 없는
  일반 context에서는 미지정/이름을 그대로 유지한다. 명시 해제는 작성 값 `false`를
  RAC `slot={null}`로 전달한다 (해소기는 null도 해제로 읽는다).
- 이름 표가 있는 context에서 기본 slot이 없거나 이름이 틀린 경우에만 연결 안 됨으로
  처리한다. 잘못된 작성 이름은 보존해 다른 제공자 아래로 옮기면 다시 연결되게 한다.
  가장 가까운 같은 consumer context를 찾으며 다른 종류의 context는 탐색을 막지 않는다.

## 필수 부품과 구조 편집

`catalog/nesting/nestingRules.ts`의 owner/required 계약과 `commands/structure.ts`의 결과 트리
검증을 따른다. 존재해야 하는 부품과 context 관계만 요구하는 항목을 구분한다. 빈 collection은
허용되므로 항목을 최소 하나 남기도록 일반화하지 않는다. Table 열·행 편집은 모든 Row의 Cell 수와
열 수를 같은 명령에서 맞추고, row header 등 해당 family의 RAC 계약도 보존한다.

허용된 wrapper 삽입·같은 context 안 재배치·같은 타입 원본 교체는 최초 template 위치에
고정하지 않는다. 필수 context를 끊는 삭제·이동·slot 변경은 명령이 거부해야 한다.
`catalogPartParent` 등 해당 소비자의 조상 탐색과 DOM·Canvas의 실제 소유 처리를 같이 확인한다.

## 상태 표시·존재·값 바인딩

| 계약          | 의미·구현 정본                                                                                                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `showWhen`    | `document/types.ts`의 `CatalogShowWhen`: `all` 1~3개 조건, 부정과 조건별 `from`. 조건이 거짓이면 DOM과 레이아웃 자리 모두 없음                                                    |
| 상태 주체     | 키를 제공하는 가장 가까운 조상이 기본. `{ type }`은 그 키를 제공하는 가장 가까운 해당 타입, `{ ancestor }`는 특정 저장 주소. `document/stateOwnerRefs.ts` · `runtime/presence.ts` |
| `presentWhen` | 선택적 Label/Description 텍스트 부품에 명시한 `nonEmptyText`. 모든 바인딩 치환 후 `String(value ?? "")` 길이 0이고 자식 노드가 없을 때만 생략. 0·false·공백은 유지                |
| RAC 값 바인딩 | `{valueText}` · `{percentage}` 등은 `runtime/valueBindings.ts`. 지원 키는 생성된 `RAC_VALUE_KEYS`, 주체는 해당 키를 제공하는 가장 가까운 조상. 바인딩 자체는 노드를 제거하지 않음 |

- `showWhen`과 `presentWhen`을 혼용하지 않는다. 둘 다 있으면 둘 다 충족해야 표시한다.
  FieldError에는 `presentWhen`을 적용하지 않는다. 빈 authored errorMessage 때문에 노드를
  없애지 말고 RAC validationErrors 기본 문구를 보존한다.
- 명시 주체는 표시명·조상 순번으로 대체하지 않는다. 복사·materialize·이동 시
  `CatalogStateOwnerRef`의 nodeId/instance address/local template 주소를 기존 명령 경로로
  처리한다. 끊긴 명시 주체를 다른 조상으로 fallback하지 않으며 `STATE_OWNER_UNLINKED`를 확인한다.
- DOM은 `runtime/stateFrames.tsx`의 RAC render props frame을 읽는다. Canvas는 displayState와
  파생 값으로 판정한다. hover·pressed·focus-visible의 실제 상호작용은 Preview에서 검증한다.
- displayState 는 원본의 표시용 상태다. 인스턴스가 그 상태의 prop (`DISPLAY_STATE_PROPS`) 을
  반대로 작성하면 그 자리에서 끝나고 (`resolver.ts`), 증분 record 갱신도 새 해석의 displayState 를
  읽는다 (`compositionRoot.ts`). RAC 가 uncontrolled 로 드는 값 (`defaultSelected` ·
  `defaultSelectedKey`) 은 작성 기본값이 바뀌면 key 로 다시 그린다 (Tabs · Checkbox).
  Why: 2026-10-09 Checkbox — selected 원본 instance 의 Selected 해제가 Canvas (표시 상태 고정) 와
  Preview (uncontrolled 유지) 어디에도 닿지 않았다.
- `{{ variable }}` 상태 변수, 원본의 `{prop}` 치환, RAC render props 값 바인딩은 별개 경로다.
  지원되지 않는 값을 임의 표현식 언어로 확장하지 않는다.
- owner 값 변경 시 `compositionRoot.ts`의 `refreshState` · `catalogStateDependents` ·
  `catalogValueDependents` 재평가와 Builder `canvasBinding.ts`의 dirty 반영을 확인한다.
  직계 자식 fixture만으로 wrapper·중첩 instance의 상태 전달까지 검증했다고 판단하지 않는다.

## 변경 범위의 검증

- 새로 넣은 부품의 목록 노출 → 삽입 → Layers 순서와 Preview 렌더를 확인한다. 명시 slot의
  정상 연결·미지정·해제·잘못된 이름 중 변경된 경로를 검증한다.
- 구조 편집은 필수 부품 거부, 허용 wrapper, Undo/Redo와 저장·재열기를 포함한다.
  상태 주체를 바꾸면 중첩된 같은 타입의 독립 상태·주소 보존도 확인한다.
- D1: 해당 family의 설치 RAC 기준 예제와 태그·부모/자식·순서·텍스트·slot·role/aria 및
  aria 참조 대상을 비교한다. 자동 생성 id의 문자열·추적용 data 속성·class·inline style은
  구조 비교에서 제외한다. RAC에 없는 S2 부품은 해당 ADR의 S2 기준을 따른다.
- D3: 같은 입력·viewport·DPR·theme·상태의 Canvas↔Preview 시각을 별도로 비교한다.
  RAC DOM 구조 통과와 시각 하니스 통과를 서로 대체하지 않는다. 실제 사용자 흐름은
  [evaluate](../../evaluate/SKILL.md), 시각 비교는 [cross-check](../../cross-check/SKILL.md)를 따른다.
- 실행하지 못한 family·상태·저장·DOM·시각 범위는 UNVERIFIED로 보고한다. 전체 ADR의
  완료 판정은 [ADR-256](../../../../docs/adr/256-rac-composition-level.md)의 해당 gate를 따른다.
