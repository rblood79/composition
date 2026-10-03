---
title: Component Lifecycle Pattern
impact: HIGH
impactDescription: 잘못된 생명주기 = 요소 누락, 고아 요소 발생
tags: [domain, component, lifecycle]
---

컴포넌트 생성 / 수정 / 이동 / 삭제의 생명주기를 정의합니다. 모든 단계는 catalog 명령 하나이고, 이후 순서는 runtime 이 소유합니다 ([domain-async-pipeline.md](domain-async-pipeline.md) · [state-management.md §2](../../../rules/state-management.md)).

> 옛 factory 계층 (`ComponentDefinition` · `createElementsFromDefinition` · `createAddComplexElementAction` · `executeRemoval` 3레이어) 은 ADR-248 Phase 4 (2026-10-03) 에서 삭제됐습니다. `apps/builder/src/builder/factories/` 에는 `constants.ts` · `creationStyleDefaults.ts` 만 남았습니다.

## 단계별 명령

| 단계                     | 명령 (`packages/shared/src/catalog/commands/`)                                                                         | Builder 진입                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 생성                     | `insertNodes` (`structure.ts`)                                                                                         | 팔레트 `catalogPaletteInsertPlan` (`catalogRuntime/paletteInsert.ts`)                                      |
| 그룹 항목 추가           | `insertGroupItem` · `insertCollectionItem` · `insertTableRow` · `insertTableColumns`                                   | `collections.ts`                                                                                           |
| 수정 (field)             | `setFields` · `setWholeField` (`fields.ts`)                                                                            | Properties `catalogPropertiesPatchCommand` (`catalogRuntime/editContract.ts`) · Styles `catalogStylesHost` |
| 이동                     | `moveNodes` (`structure.ts`)                                                                                           | `canvasGesture.ts` · `layerTree.ts` · `shortcuts.ts`                                                       |
| 삭제                     | `removeTargets` (`structure.ts`)                                                                                       | `canvasMenu.ts` · 단축키                                                                                   |
| 복제 · 붙여넣기 · 그룹   | `duplicateNodes` · `pasteNodes` · `groupNodes` · `ungroupNodes`                                                        |                                                                                                            |
| 컴포넌트 · 인스턴스 분리 | `createComponent` · `detachInstances` · `dissolveComponent` (`components.ts`), `createMaterializer` (`materialize.ts`) |                                                                                                            |

- 모든 명령은 `selectAfter` 로 commit 뒤 선택을 정합니다 (`compose.ts`). 여러 명령을 한 entry 로 묶을 때는 `composeCommands`.

## 생성 — 노드 하나, 자식은 정의 템플릿

- 팔레트 삽입은 **노드 하나**를 만듭니다. composite 컴포넌트의 자식 트리는 복제하지 않고, 노드의 정의 (`DefinitionEntry.templateRootId`) 템플릿이 그대로 보입니다. 기본값과 다른 초기 props 만 own write 로 씁니다.
- 정의는 library origin (`packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` `REUSABLE_ORIGIN_DEFINITIONS`) 에서 오고, 팔레트 type → 정의 id 는 `catalogPaletteDefinitionId` 가 정합니다. 노출 목록은 `PALETTE_REUSABLE_ORIGIN_TYPES` (`componentCatalog.ts`).
- 위치 후보는 선택 요소 → 그 조상 → 열린 페이지 body (`pageContent()`) 순서이고, 수용 판정은 명령 안의 `assertNestable` 이 합니다 (`NESTING_NOT_ALLOWED`). 첫 후보가 거절되면 `relocated` 로 알립니다.

## 수정

- Properties: `catalogPropertiesPatchCommand` 가 바뀐 키만 `catalogSemanticPatchCommand` 로 걸러 `setFields` 를 만듭니다 — 값이 같으면 history entry 를 만들지 않습니다.
- 부모와 자식을 같이 바꿔야 하면 `composeCommands` 하나로 묶습니다. 부모 prop 이 자식에 주는 영향 (template binding `{prop}` · size propagation · derived props · part rules) 은 resolver · composition root 가 다시 계산하므로 자식에 값을 복사해 쓰지 않습니다.

## 삭제

- `removeTargets` 는 소유 노드면 subtree 를 지우고, 인스턴스 안 template position 이면 `enabled: false` patch 로 숨깁니다.
- 참조자 정리는 `removeWithReferrers` 가 한 명령 안에서 합니다: 지운 노드를 가리키는 `stateVariable` · `interaction` entry 삭제, 다른 노드의 `descendantOverrides` 중 지운 id 를 가리키는 항목 제거.
- 선택은 step 뒤 `CatalogSession.reconcile()` 이 정리합니다. Skia 노드 해제는 `canvasBinding.ts` 가 합니다 (`unregisterSkiaNode`).

## Incorrect

```typescript
// ❌ composite 자식을 노드로 복제해 생성 — 정의 템플릿과 이중 구조
for (const child of definitionChildren) workspace.execute(insertNodes(...));

// ❌ 삭제 뒤 stateVariable · interaction 을 따로 지움 — entry 가 둘로 갈리고 중간 상태가 저장될 수 있다
```

## Correct

```typescript
// ✅ 팔레트 삽입 — 노드 하나, 위치 · 중첩 판정은 명령이 한다
const plan = catalogPaletteInsertPlan(host, "Tabs");
if (plan.command) workspace.execute(plan.command);

// ✅ 삭제 — 참조자 정리까지 한 명령
workspace.execute(removeTargets({ targets }));
```

## 참조 파일

- `packages/shared/src/catalog/commands/structure.ts` · `fields.ts` · `components.ts` · `collections.ts` · `materialize.ts`
- `packages/shared/src/catalog/document/types.ts` — `NodeEntry` · `DefinitionEntry` · `EditTarget` · `NodeParent`
- `apps/builder/src/builder/catalogRuntime/paletteInsert.ts` · `editContract.ts`
