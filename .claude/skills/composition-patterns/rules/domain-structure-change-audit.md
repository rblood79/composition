---
title: Element Structure Change Audit
impact: CRITICAL
impactDescription: Element 트리 구조 변경 시 소비자 전수 조사 누락 = Layer Tree/Canvas/Preview 전면 장애
tags: [domain, element, structure, audit]
---

컴포넌트 구조 (정의 템플릿의 parent-child 관계) 를 바꿀 때 (래퍼 추가 / 제거, 중간 노드 삽입, 자식 재배치 등) 반드시 수행해야 하는 **소비자 영향도 감사 (Consumer Audit)** 절차를 정의합니다.

> 2026-10-04 개정: 사고 당시의 소비자 (factory · `treeUtils` · `preview/App.tsx` · `BuilderCanvas`) 는 ADR-248 Phase 4 에서 삭제됐습니다. **원칙 (작업량 = 소비자 수 × 수정 복잡도) 은 그대로**이고, 체크리스트를 catalog runtime 소비자로 바꿨습니다.

## 배경: Tabs 구조 변경 사고 (2026-02-25)

`Tabs > [Tab, Tab, Panel, Panel]` (flat) → `Tabs > [TabList > [Tab, Tab], TabPanels > [Panel, Panel]]` (nested)로 변경 시, Factory 1개만 수정하고 소비자 9곳을 누락하여 Layer Tree/Canvas/Preview 전면 장애 발생.

**교훈**: 데이터 구조 변경의 작업량은 "변경 자체"가 아닌 "소비자 수 × 수정 복잡도"로 결정됨.

## 필수 감사 절차

### Step 1: 소비자 식별 (grep 필수)

문서 노드에는 `type` · `parent_id` 가 없습니다. 구조는 정의 템플릿 (`templateRootId` 아래 children) 이고, 타입은 `definitionId` 에서 유도합니다. 타입명 문자열로 소비자를 찾습니다.

```bash
# 변경되는 타입명이 등장하는 표 · 분기 전수 (catalog · builder · specs)
grep -rn '"Tab"\|"TabList"\|"TabPanels"' --include="*.ts" --include="*.tsx" packages/shared/src packages/specs/src apps/builder/src
```

### Step 2: 서브시스템 체크리스트

| #   | 서브시스템         | 확인 위치                                                                                                                                                                                  | 확인 사항                                                                                           |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1   | **구조 정의**      | `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` (origin 템플릿) · `document/codeCatalogLibrary.ts` (`catalogTypeDefinitionId`) · `catalog/bindings/*.binding.ts` | 템플릿 children · binding 선언                                                                      |
| 2   | **중첩 규칙**      | `catalog/nesting/nestingRules.ts` (`RAC_COLLECTION_CHILD_TYPES` · `RAC_SUBPART_OWNER_TYPES` …)                                                                                             | 새 부모-자식 쌍이 허용되는지                                                                        |
| 3   | **명령**           | `catalog/commands/collections.ts` (`GROUP_ITEM_TYPES` · `insertGroupItem` · `insertTableRow`) · `commands/items.ts`                                                                        | 항목 추가 / 삭제가 새 래퍼 안으로 가는지                                                            |
| 4   | **Layers**         | `catalogRuntime/layerTree.ts` · `readModel.ts` · `catalog/resolution/positions.ts`                                                                                                         | 행 순서 · 펼침 · 표시명                                                                             |
| 5   | **Canvas**         | `catalogRuntime/compositionRoot.ts` (의존 재계획) · `rulePaint.ts` (`CHILD_PROP_MERGE_TYPES` · `SHELL_ONLY_TYPES`) · `ruleShapes.ts` (`BOX_SIZE_TYPES`) · `subpart.ts` · `itemRoles.ts`    | 부모가 자식 props 를 합치는지 · 자식 그리기 · 상자 크기                                             |
| 6   | **DOM / Preview**  | `catalogRuntime/domBinding.tsx` (`CATALOG_DOM_CHILD_OWNING_BINDINGS`) · `delegatedDom.tsx` · `packages/shared/src/renderers/`                                                              | 자식 조회 · RAC 구조 (D1)                                                                           |
| 7   | **Properties**     | `catalogRuntime/editContract.ts` · `panels/properties/catalog/*`                                                                                                                           | 자식 카운트 · 항목 추가 / 삭제 UI                                                                   |
| 8   | **기존 문서 주소** | `catalog/resolution/address.ts` (`validateInstanceAddress`)                                                                                                                                | 기존 instance 의 `descendantOverrides` address 가 새 템플릿에서 끊기지 않는지 (`DANGLING_TEMPLATE`) |

### Step 3: 기존 문서 호환

Builder 는 옛 프로젝트 문서를 변환하지 않습니다 (`catalogRuntime/project.ts` — "no old document is converted"). 템플릿 구조를 바꾸면 이미 만든 instance 의 override address 가 옛 template id 를 가리킬 수 있습니다. 템플릿 id 를 유지할 수 있으면 유지하고, 못 하면 address 검증이 실패하는 경우를 테스트로 먼저 보입니다.

### Step 4: 실제 확인

구현 뒤 반드시 실행:

1. **팔레트로 새로 생성** → Layers 에서 구조 확인
2. **Canvas (Skia)** → 모든 자식이 그려지는지
3. **Preview (DOM)** → React Aria 동작 확인 — Canvas 와의 대칭은 `/cross-check`
4. **Properties** → 자식 카운트 · 항목 추가 / 삭제
5. **기존 instance** → 구조 변경 전 만든 instance 의 override 가 유지되는지

## Incorrect

```typescript
// ❌ origin 템플릿만 고치고 소비자를 확인하지 않음
// reusableOriginLibrary.ts 의 Tabs 템플릿만 TabList / TabPanels 래퍼로 변경
// → GROUP_ITEM_TYPES · nestingRules · CHILD_PROP_MERGE_TYPES · DOM binding 이 옛 구조를 가정해 깨진다

// ❌ 작업량을 "템플릿 1개 = 소" 로 판단
```

## Correct

```typescript
// ✅ 구조 변경 전 소비자 전수 조사
// 1. 타입명 grep
// 2. 8개 서브시스템 체크리스트 순회
// 3. 기존 instance address 호환 확인
// 4. 실제 확인 (Layers → Canvas → Preview → Properties → 기존 instance)

// ✅ 작업량은 소비자 수 × 수정 복잡도로 산정
```

## 참조 파일

- `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` — origin 템플릿
- `packages/shared/src/catalog/nesting/nestingRules.ts` — 중첩 규칙
- `packages/shared/src/catalog/commands/collections.ts` — 항목 명령
- `apps/builder/src/builder/catalogRuntime/` — `layerTree.ts` · `compositionRoot.ts` · `rulePaint.ts` · `ruleShapes.ts` · `domBinding.tsx` · `editContract.ts`
- `packages/shared/src/catalog/resolution/address.ts` — instance address 검증
