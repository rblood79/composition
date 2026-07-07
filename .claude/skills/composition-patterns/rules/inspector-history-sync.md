---
title: Sync Inspector Changes with History
impact: HIGH
impactDescription: Undo/Redo 지원, 상태 일관성, 사용자 경험
tags: [inspector, history, state]
---

Inspector에서 속성 변경 시 히스토리 시스템과 동기화합니다.

> **실패턴**: composition 은 Command 클래스 패턴(`UpdatePropertyCommand` / `executeCommand`)을 사용하지 않습니다. 히스토리 기록은 `historyManager.addEntry()` / `addDiffEntry()` 직접 호출이며, Inspector 는 `inspectorActions.ts` 의 store 액션을 경유합니다. 공통 히스토리 계약: [domain-history-integration.md](domain-history-integration.md).

## Incorrect

```tsx
// ❌ 직접 상태 변경 (히스토리 미기록)
function PropertyInput({ elementId, propName, value }) {
  const updateElement = useStore((s) => s.updateElement);

  const handleChange = (newValue) => {
    updateElement(elementId, { [propName]: newValue });
  };

  return <input value={value} onChange={(e) => handleChange(e.target.value)} />;
}

// ❌ Command 클래스 신규 도입 (execute/undo 메서드 패턴) — 현행 아키텍처에 없음
executeCommand(
  new UpdatePropertyCommand(elementId, propName, oldValue, newValue),
);
```

## Correct

```tsx
// ✅ inspectorActions 경유 — 히스토리 기록이 액션 내부에 통합됨
function PropertyInput({ propName, value }: PropertyInputProps) {
  const updateSelectedProperties = useStore((s) => s.updateSelectedProperties);

  const handleChange = (newValue: string) => {
    updateSelectedProperties({ [propName]: newValue });
  };

  return <input value={value} onChange={(e) => handleChange(e.target.value)} />;
}
```

```typescript
// inspectorActions.ts 내부 (요약) — 액션이 히스토리를 직접 기록
// 1. 이전 상태 캡처 (prevElementOverride 지원 — preview 전 원본으로 정확한 undo)
const prevProps = structuredClone(getInspectorWritableProps(historyBase));
const prevElement = structuredClone(historyBase);

// 2. props 변경 시 히스토리 엔트리 추가
historyManager.addEntry({
  type: "update",
  elementId,
  data: { prevProps, props: structuredClone(newProps), prevElement },
});

// 3. 상태 변경 (elementsMap/elements 갱신) → 이후 persist
```

## Inspector 특화 규칙

- **부모+자식 동시 변경**: `updateSelectedPropertiesWithChildren(properties, childUpdates)` 사용 — `_cancelHydrateSelectedProps()` 로 hydration race 차단 후 `batchUpdateElementProps()` 가 단일 batch 히스토리로 기록. 상세: [domain-history-integration.md](domain-history-integration.md) §Child Composition Pattern
- **PropertyUnitInput commit 판정**: `lastSavedValueRef` 기준 단독 (value prop diff 금지). 정본: `.claude/rules/style-ssot.md` §PropertyUnitInput commit 조건
- **shorthand → longhand 분배**: gap/padding/margin 편집은 `inspectorActions` 가 longhand 로 분배해 저장. 정본: `.claude/rules/style-ssot.md`

## 참조 파일

- `apps/builder/src/builder/stores/inspectorActions.ts` - Inspector 액션 + 히스토리 기록 경로
- `apps/builder/src/builder/stores/history.ts` - HistoryManager (`addEntry` / `addDiffEntry`)
