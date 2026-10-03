---
title: Sync Inspector Changes with History
impact: HIGH
impactDescription: Undo/Redo 지원, 상태 일관성, 사용자 경험
tags: [inspector, history, state]
---

Design 패널 (Properties · Styles) 의 편집은 catalog 명령 하나로 실행되고, 히스토리는 runtime step 이 기록합니다. 공통 히스토리 계약: [domain-history-integration.md](domain-history-integration.md).

> **실패턴**: composition 은 Command **클래스** 패턴 (`UpdatePropertyCommand` / `executeCommand`) 을 쓰지 않습니다. 명령은 함수형 `CatalogCommand = (reader) => CatalogCommandPlan` (`packages/shared/src/catalog/commands/compose.ts`) 입니다. 옛 `inspectorActions.ts` store 액션 · `historyManager.addEntry()` 직접 호출 · `updateSelectedPropertiesWithChildren` 은 ADR-248 Phase 4 (2026-10-03) 에서 삭제됐습니다.

## 경로

| 편집            | 명령                                                                                                                                                        | 실행                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Properties      | `catalogPropertiesPatchCommand` (`catalogRuntime/editContract.ts`) — 바뀐 키만 `setFields`, binding 키는 `catalogBindingCommand`, 둘 다면 `composeCommands` | `CatalogPropertiesPanel` → `useCatalogCommandRunner` (`panels/navigator/catalog/`) → `workspace.execute` — 거절은 toast |
| Styles          | `catalogStylesHost` (`panels/styles/catalog/catalogStylesHost.ts`) `styleCommandOf` → `catalogStyleWritesOf` + `setFields` (활성 breakpoint)                | `workspace.execute`                                                                                                     |
| Styles 미리보기 | 명령 없음 — `workspace.root.previewRecord` (문서 · 히스토리 쓰기 0), 손을 놓을 때 commit 한 번                                                              |                                                                                                                         |

## Incorrect

```tsx
// ❌ graph 를 직접 고치거나 runtime 에 op 를 손으로 넣음 — inverse · 검증 · 히스토리 우회
workspace.runtime.dispatch({ ops: [...], history: { kind: "record", label } });

// ❌ 드래그 중 매 프레임 execute — 히스토리 entry 수십 개
onDrag={(value) => workspace.execute(setFields({ targets, visual: { width: value } }))}
```

## Correct

```tsx
// ✅ Properties — 바뀐 키만 명령으로, 거절은 runner 가 toast
const command = catalogPropertiesPatchCommand(
  graph,
  targets,
  patch,
  current,
  bindingKeys,
);
if (command) run(command);

// ✅ Styles 드래그 — 미리보기는 previewRecord, 손을 놓을 때 한 번 commit
host.previewStyle(property, value);
// release:
host.updateStyle(property, value);
```

## 관련 규칙

- 부모와 자식을 같이 바꿀 때: 여러 명령을 `composeCommands` 하나로 묶습니다 (entry 하나).
- PropertyUnitInput 의 commit 조건은 `lastSavedValueRef` 기준 단독이고, value 동기화 `useEffect` 는 같은 요소에 focus 중이면 건너뜁니다 — [state-management.md §7](../../../rules/state-management.md) · [style-ssot.md §5](../../../rules/style-ssot.md).
- CSS 키 → typed field 매핑 (padding · margin 분해, `gap` 은 `visual.gap` 단일 field) 은 `catalogStyleWrites` (`catalogRuntime/styleFields.ts`) — [style-ssot.md §1](../../../rules/style-ssot.md).

## 참조 파일

- `apps/builder/src/builder/catalogRuntime/editContract.ts`
- `apps/builder/src/builder/panels/properties/catalog/CatalogPropertiesPanel.tsx`
- `apps/builder/src/builder/panels/styles/catalog/catalogStylesHost.ts`
- `apps/builder/src/builder/panels/navigator/catalog/useCatalogCommandRunner.ts`
