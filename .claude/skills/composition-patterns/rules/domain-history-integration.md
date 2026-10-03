---
title: History Integration Pattern
impact: CRITICAL
impactDescription: 히스토리 미기록 = Undo/Redo 불가, 사용자 데이터 손실
tags: [domain, history, undo-redo]
---

사용자 편집은 모두 히스토리에 남습니다. 기록은 호출자가 아니라 runtime step 이 합니다 — 호출자는 명령을 올바른 단위로 만들기만 합니다.

> **정본**: [state-management.md §3 핵심 규칙](../../../rules/state-management.md) (히스토리 의도 필수 · 프로젝트당 한 스택 · `recordExternal`). 옛 `historyManager` (`addEntry` / `addDiffEntry` / `addBatchDiffEntry`) · hot/cold IndexedDB 히스토리 · `historyActions.ts` canonical events + legacy fallback 은 ADR-248 Phase 4 (2026-10-03) 에서 삭제됐습니다.

## 구조

- entry = `{ label, at, forward, inverse, external? }` (`catalogRuntime/controller.ts`). inverse 는 `applyCatalogTransaction` 이 계산합니다 — 호출자가 이전 값을 structuredClone 해 두지 않습니다.
- 스택은 프로젝트당 메모리 하나이고 IndexedDB 에 저장하지 않습니다. History 패널은 `CatalogHistoryStore` (`catalogRuntime/history.ts`).
- 기록 시점은 step 안 graph commit → consumer → 저장 대기열 **뒤**입니다. 순서는 runtime 이 소유합니다.
- undo / redo 는 entry 의 `inverse` / `forward` 를 기록된 step 으로 다시 돌리고 `external` 효과를 뒤따라 실행합니다 — consumer · 저장 · Preview 를 일반 편집과 똑같이 지납니다. fallback 경로는 없습니다.

## 규칙

1. **히스토리 의도 필수**: `HistoryIntent` (`packages/shared/src/catalog/transactions/transaction.ts`) — `{kind: "record", label}` 또는 `{kind: "skip", reason}`. skip 사유는 `project-create` · `load` · `fixture` · `sync` 넷뿐이고, 없으면 `HISTORY_INTENT_REQUIRED`.
2. **사용자 동작 1회 = 명령 1개 = entry 1개**: 다중 선택 · 부모와 자식 동시 편집은 `composeCommands` 로 묶습니다 (예: `editContract.ts` "Edit properties", `layoutPreset.ts`). `setFields` 에 target 여러 개를 넘겨도 됩니다. 배치 삭제는 `removeTargets` 한 명령.
3. **AI 묶음**: 여러 step 을 낸 AI 작업은 `workspace.mergeHistory(count, label)` 로 한 entry 로 합칩니다 (`aiHost.ts`). 바깥 효과가 섞인 entry 는 합치지 않습니다.
4. **문서 밖 상태 = `recordExternal`**: 데이터 store 변경은 `setDataHistoryRecorder` → `catalogDataHistoryRecorder` (`catalogRuntime/dataHistory.ts`) 를 지나 같은 스택에 `CatalogExternalEffect` 로 들어갑니다.
5. **값이 같으면 기록하지 않는다**: Properties 는 `catalogSemanticPatchCommand` 가 바뀐 키만 남깁니다.

## Incorrect

```typescript
// ❌ 사용자 편집을 skip 으로 실행 — undo 불가
runtime.dispatch({ ..., history: { kind: "skip", reason: "fixture" } });

// ❌ 다중 선택을 명령 N 번으로 — undo 한 번에 하나씩만 되돌아간다
for (const target of targets) workspace.execute(setFields({ targets: [target], ... }));

// ❌ 데이터 store 를 recordExternal 없이 직접 변경
useDataStore.setState({ collections: next });
```

## Correct

```typescript
// ✅ 명령 하나 — record 의도와 label 은 명령 plan 에서 온다
workspace.execute(setFields({ targets, ... }));

// ✅ 서로 다른 명령을 한 entry 로
workspace.execute(() => composeCommands(graph, "Edit properties", commands));

// ✅ 데이터 편집은 DataChange 하나 (recordExternal 경유)
useDataStore.getState().applyDataChange(change);
```

## 참조 파일

- `apps/builder/src/builder/catalogRuntime/controller.ts` — step · undo / redo · `recordExternal` · `mergeHistory`
- `apps/builder/src/builder/catalogRuntime/history.ts` — History 패널 store
- `apps/builder/src/builder/catalogRuntime/dataHistory.ts` — 데이터 store 히스토리 연결
- `packages/shared/src/catalog/transactions/transaction.ts` — `HistoryIntent` · inverse
