---
title: Async Pipeline Pattern
impact: CRITICAL
impactDescription: 파이프라인 순서 오류 = UI 불일치, 데이터 유실
tags: [domain, async, pipeline]
---

요소 변경은 catalog 명령 하나로 들어가고, 이후 순서는 runtime 이 소유합니다.

> **정본**: [state-management.md §2 편집 파이프라인](../../../rules/state-management.md) (CRITICAL). 본 문서는 호출자 쪽 규칙만 둡니다. 옛 canonical-first 6단계 (canonical merge → history → `set()` + layoutVersion → `_rebuildIndexes` → persist → `UPDATE_CANONICAL_DOCUMENT`) 는 ADR-248 Phase 4 (2026-10-03) 에서 store 와 함께 삭제됐습니다.

## 파이프라인 요지

명령 → `CatalogWorkspace.execute` (`catalogRuntime/workspace.ts`) → `CatalogCompositionRoot.execute` (`compositionRoot.ts`, REVISION_CONFLICT 이면 한 번 재계획) → `CatalogRuntime.step` (`controller.ts`: transaction 검증 · commit → consumer (실패 시 `revertCommit`) → 저장 대기열 → history → 구독자 · listener) → `CatalogAutosave` (microtask) → `CatalogPreviewChannel` `CATALOG_DELTA`.

호출자가 이 순서를 조립하지 않습니다. 호출자는 **명령을 만들어 넘기는 것까지**만 합니다.

## 호출자 규칙

- **명령은 `CatalogReader` 로만 계획한다**: `CatalogCommand = (reader) => CatalogCommandPlan` (`packages/shared/src/catalog/commands/compose.ts`). 선택 store 나 문서 export 를 읽지 않고, graph 를 스캔하지 않습니다 (`commands/index.ts` 헤더).
- **사용자 동작 1회 = 명령 1개 = transaction 1개 = history entry 1개**: 다중 선택 편집 · 부모와 자식 동시 편집은 `composeCommands(graph, label, commands)` 로 묶습니다. 뒤 명령은 앞 명령이 stage 한 record 를 읽습니다.
- **생성 · 삭제 · 이동**: `insertNodes` · `removeTargets` · `moveNodes` (`commands/structure.ts`). 팔레트 삽입은 `catalogPaletteInsertPlan` (`catalogRuntime/paletteInsert.ts`). 다중 삭제도 `removeTargets` 한 명령입니다.
- **consumer 에서 던지면 롤백**: step 이 commit 을 되돌립니다. 구독자 오류는 commit 뒤라 `CatalogSubscriberError` 로 따로 알립니다 — 구독자에서 던져 편집을 취소하려 하지 않습니다.
- **레이아웃 재계산은 runtime 이 판정**: 호출자가 레이아웃 무효화를 부르지 않습니다. 새 레이아웃 키는 [layout-engine.md 「새 레이아웃 키를 추가할 때」](../../../rules/layout-engine.md) (`styleOf` · `PAINT_ONLY_VISUAL_KEYS`) 를 따릅니다. 폰트 로드 뒤 재측정은 `workspace.refreshFonts()`, breakpoint 전환은 `setBreakpoint`.

## Incorrect

```typescript
// ❌ graph 를 직접 고치거나 op 를 수동으로 만들어 transaction 우회
graph.commit(...);

// ❌ 다중 선택을 명령 여러 번으로 실행 — history entry 가 N 개 생긴다
for (const id of ids) workspace.execute(removeTargets({ targets: [id] }));
```

## Correct

```typescript
// ✅ 명령 하나 — 대상이 여럿이어도 한 transaction
workspace.execute(removeTargets({ targets }));

// ✅ 서로 다른 명령을 한 entry 로
workspace.execute(() =>
  composeCommands(graph, "Edit properties", [parentPatch, childPatch]),
);
```

## 남은 Zustand store (UI · 데이터 전용)

`setTimeout` / `queueMicrotask` 안에서는 클로저 값 대신 `get()` 으로 최신 상태를 읽습니다. 데이터 store 변경의 undo 는 `recordExternal` 로 같은 히스토리 스택에 넣습니다 ([domain-history-integration.md](domain-history-integration.md)).

## 참조 파일

- `apps/builder/src/builder/catalogRuntime/workspace.ts` — `CatalogWorkspace.execute`
- `apps/builder/src/builder/catalogRuntime/controller.ts` — `CatalogRuntime.step`
- `apps/builder/src/builder/catalogRuntime/autosave.ts` · `storage.ts` — 저장
- `apps/builder/src/builder/catalogRuntime/previewChannel.ts` — Preview delta
- `packages/shared/src/catalog/commands/` — 명령
- `packages/shared/src/catalog/transactions/transaction.ts` — 검증 · inverse · layout 영향 판정
