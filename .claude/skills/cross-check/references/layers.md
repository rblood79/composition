## 변경 경로 대조

모든 컴포넌트는 catalog 경로다. Frame/Group/Slot도 spec 예외가 없다. rule이 없는
타입은 현재 definition·binding과 부품 소유 계약을 확인하며 spec 경로를 새로 만들지 않는다.

| 레이어         | 확인 위치                                                                                                                   | 확인 사항                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Catalog        | `packages/shared/src/catalog/componentCatalog.ts` · `bindings/` · `generated/componentRulesTable.ts`                        | accepts/defaults, variants/sizes, rule·primitive 참조         |
| 정의·원본·생성 | `catalog/document/codeCatalogLibrary.ts` · `generated/reusableOriginLibrary.ts` · Builder `catalogRuntime/paletteInsert.ts` | definition 선택, template 자식 순서, slot 채움, 초기값        |
| CSS            | `packages/shared/src/components/styles/` · `styles/generated/`                                                              | catalog CSS 생성값, data-variant/data-size/state 선택자       |
| Canvas         | Builder `catalogRuntime/canvasBinding.ts` · `ruleShapes.ts`, shared `catalog/runtime/rulePaint.ts` · `compositionRoot.ts`   | 자식 소유, rule shape, layout 입력, 텍스트 측정, dirty 재평가 |
| DOM            | `packages/shared/src/catalog/runtime/domBinding.tsx` · `delegatedDom.tsx`                                                   | 노드 순서, RAC context, style/props 전달, 상태 frame          |

위 표의 `catalog/`는 `packages/shared/src/catalog/` 기준이다. Builder의 `catalogRuntime/`
재수출 파일만 보고 구현을 확인했다고 판단하지 않는다.

## 시각·레이아웃

- variant·size 기본값과 명시값이 definition/rule → CSS/Canvas 양쪽에 도달하는지 확인한다.
  size 이름은 해당 타입 계약을 따르고 별도 기본 size 표를 만들지 않는다.
- `compositionRoot.ts`의 `styleOf`가 노드의 layout/sizing/visual과 catalog 기본값을 엔진에
  넘기는지 확인한다. 텍스트는 `textLeaf` → `catalogTextMeasure`의 측정값과 실제 페인트를 대조한다.
- 상자 폭·높이로 shape 좌표를 계산하는 타입은 `ruleShapes.ts`의 `BOX_SIZE_TYPES`를 확인한다.
  삭제된 `INTRINSIC_MEASURE_TAGS`·`DEFAULT_SIZE_BY_TAG` 등록은 요구하지 않는다.
- fill·토큰·opacity·border·간격은 같은 fixture/viewport/DPR/theme/상태에서 비교한다.
  부품 자신의 rule과 부모 소유 예외는 [SSOT](../../../rules/ssot-hierarchy.md)를 따른다.

## RAC 조립·상태 검증

자식 구조·slot·상태 조건이 바뀌면 [RAC 조립 계약](../../composition-patterns/rules/domain-rac-composition.md)의
검증 항목을 적용한다. RAC 기준 DOM 구조 비교와 Canvas↔Preview 시각 비교는 별도 판정이다.
시각 하니스 통과만으로 DOM 구조·aria 연결·저장 주소 계약까지 통과했다고 보고하지 않는다.
