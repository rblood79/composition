---
title: Async Pipeline Pattern
impact: CRITICAL
impactDescription: 파이프라인 순서 오류 = UI 불일치, 데이터 유실
tags: [domain, async, pipeline]
---

요소 변경 시 canonical-first 비동기 파이프라인 순서를 준수합니다.

> **정본**: `.claude/rules/state-management.md` §Canonical sync 호출 순서 (CRITICAL). 본 문서는 그 구현 상세.

## 파이프라인 순서 (canonical-first)

```
1. Canonical Document Update (즉시) → mergeXxxIntoCanonicalDocument (wrapper → mergeElementsCanonicalPrimary)
2. History Record (즉시) → canonicalEvents payload (상태 변경 전 기록)
3. Memory Update (즉시) → set() — derived elements[] 갱신 + layoutVersion 조건부 +1
4. Index Rebuild (즉시) → _rebuildIndexes() (canonical 우선 derive)
5. IndexedDB Persist (백그라운드) → persistActiveCanonicalDocument(db)
6. Preview Sync (자동) → useIframeMessenger effect → UPDATE_CANONICAL_DOCUMENT
```

> **layoutVersion 조건**: 새 layout prop / style 키 추가 시 **5-심볼 2계층 체인** 점검 필수. **계층 A(layoutVersion 트리거)**: props 축은 `LAYOUT_AFFECTING_PROP_KEYS` (`stores/utils/layoutInvalidation.ts`) 에 **추가 필수** / style 축은 `NON_LAYOUT_PROPS_UPDATE` (`stores/utils/elementUpdate.ts`) 에 **추가 금지** (`isLayoutAffectingUpdate()` 가 blacklist 제외 방식으로 판정) / 상속은 `INHERITED_LAYOUT_PROPS_UPDATE`. **계층 B(캐시 시그니처, `workspace/canvas/scene/layoutCache.ts`)**: style 축은 **`LAYOUT_STYLE_KEYS`**, props 축은 `LAYOUT_PROP_KEYS` — **두 배열은 서로 다른 축을 읽으므로 style 키를 `LAYOUT_PROP_KEYS` 에 넣으면 무반영**. A·B 는 AND 조건. 정본: `.claude/rules/layout-engine.md` §"5-심볼 2계층 체인".

## Incorrect

```typescript
// ❌ DB 저장 완료까지 대기 (UI 블로킹)
const addElement = async (element: Element) => {
  const db = await getDB();
  await db.insert(element); // 블로킹!
  set({ elements: [...elements, element] });
};

// ❌ 인덱스 재구성 누락
set({ elements: newElements });
// _rebuildIndexes() 호출 안 함 → elementsMap 불일치

// ❌ set 1차 → canonical 2차 (canonical-first 위반)
set({ elements: [...elements, element] });
get()._rebuildIndexes(); // stale canonical 로 mirror 빌드 → mirror field 누락 race
mergeElementsCanonicalPrimary([element]); // 너무 늦음
```

## Correct

```typescript
// ✅ canonical-first 파이프라인 (실코드: stores/utils/elementCreation.ts createAddElementAction)
export const createAddElementAction =
  (set, get) => async (element: Element) => {
    // 1. Canonical document 1차 갱신
    //    (파일 내부 wrapper mergeCreatedElementsIntoCanonicalDocument →
    //     adapters/canonical/canonicalMutations.ts 의 mergeElementsCanonicalPrimary)
    mergeCreatedElementsIntoCanonicalDocument([elementToAdd]);

    // 2. History 기록 (canonical event payload — ADR-124)
    historyManager.addEntry({
      type: "add",
      elementId: elementToAdd.id,
      data: { canonicalEvents: buildCanonicalInsertEvents([elementToAdd]) },
    });

    // 3. derived store cache 갱신 — 구조 변경이므로 layoutVersion 무조건 증가
    set((prevState) => ({
      elements: [...prevState.elements, elementToAdd],
      layoutVersion: prevState.layoutVersion + 1,
    }));

    // 4. canonical 기반 인덱스 재구축
    get()._rebuildIndexes();

    // 5. Preview 동기화는 useIframeMessenger effect 가 자동 처리
    //    (canonical document 변경 감지 → UPDATE_CANONICAL_DOCUMENT 전송)

    // 6. IndexedDB canonical document 저장 (실패해도 메모리는 정상)
    const db = await getDB();
    await persistActiveCanonicalDocument(db);
  };
```

## 배치 삭제 파이프라인 (removeElements)

다중 요소 동시 삭제 시 `removeElements(ids[])`를 사용합니다.
순차 `for...await removeElement(id)` 호출은 **금지** — 각 호출마다 set() → 렌더 발생으로 요소가 하나씩 사라짐.

```typescript
// ✅ 배치 삭제 — 단일 파이프라인 실행 (stores/utils/elementRemoval.ts)
await removeElements(deletableIds);
// → collectElementsToRemove() × N → 병합 → executeRemoval() 1회
//   1. History payload 구성 — canonicalEvents (buildCanonicalRemoveEvents,
//      canonical mutation 전에 구성해 삭제 전 node 위치 보존)
//   2. Skia unregisterSkiaNode (즉시 — React cleanup 지연 우회)
//   3. canonical document 삭제 반영 (syncRemovedElementsToCanonical)
//   4. historyManager.addEntry (1건)
//   5. set() (1회, 원자적 — elements + 인덱스 + 선택 상태)
//   6. persistActiveCanonicalDocument (백그라운드)
//   7. postMessage (1회)

// ❌ 순차 삭제 — N번 파이프라인 실행
for (const id of ids) {
  await removeElement(id);
}
```

## 요소 순서 — children 배열 SSOT (ADR-118)

order_num 재정렬 파이프라인은 **소멸**했습니다. 요소 순서는 canonical document 의 `children` 배열 위치가 단일 SSOT 이며, 순서/부모 변경은 canonical mutation (`moveElementToCanonicalTarget`, `adapters/canonical/canonicalMutations.ts`) 경유로만 수행합니다.

## layoutVersion 계약 (ADR-012 P4)

`fullTreeLayoutMap` useMemo는 `layoutVersion` 카운터에 의존합니다. 레이아웃 영향 변경 시 반드시 카운터를 증가시켜야 합니다.

```typescript
// ✅ Store 내부: set() 내에서 layoutVersion 증가
set((state) => ({
  elements: newElements,
  layoutVersion: state.layoutVersion + 1,
}));

// ✅ Store 외부(텍스트 측정기 교체, 폰트 로딩 등): invalidateLayout() 호출
useStore.getState().invalidateLayout();

// ✅ props 업데이트 경로: 블랙리스트 제외 방식 판정 (stores/utils/elementUpdate.ts)
// NON_LAYOUT_PROPS_UPDATE 에 없는 style key 가 하나라도 있으면 layout 영향
function isLayoutAffectingUpdate(
  changedStyle: Record<string, unknown>,
): boolean {
  return Object.keys(changedStyle).some((k) => !NON_LAYOUT_PROPS_UPDATE.has(k));
}

// ❌ layoutVersion 미증가 → fullTreeLayoutMap 재계산 스킵 → 크기 고정
set({ elements: newElements }); // layoutVersion 변경 없음!

// ❌ 과거 심볼 LAYOUT_AFFECTING_PROPS allowlist Set — 현재 코드에 없음 (stale 참조 금지)
```

## 주의사항

```typescript
// ✅ structuredClone으로 히스토리용 복사 (참조 분리)
historyManager.addEntry({
  data: { element: structuredClone(element) }, // 깊은 복사 (legacy snapshot 경로)
});

// ✅ 비동기 콜백에서 항상 get()으로 최신 상태 참조 (stale closure 방지)
queueMicrotask(() => {
  const { elements } = get();
  // ...
});
```

## 참조 파일

- `apps/builder/src/builder/stores/utils/elementCreation.ts` - 추가 파이프라인 (canonical-first)
- `apps/builder/src/builder/stores/utils/elementUpdate.ts` - 업데이트 파이프라인 + `NON_LAYOUT_PROPS_UPDATE` / `INHERITED_LAYOUT_PROPS_UPDATE`
- `apps/builder/src/builder/stores/utils/elementRemoval.ts` - 삭제 파이프라인 (단일/배치)
- `apps/builder/src/adapters/canonical/canonicalMutations.ts` - canonical mutation wrapper (`mergeElementsCanonicalPrimary` 등)
- `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts` - 캐시 시그니처 (계층 B) — `LAYOUT_STYLE_KEYS`(style 축) + `LAYOUT_PROP_KEYS`(props 축)
- `apps/builder/src/builder/stores/utils/layoutInvalidation.ts` - `LAYOUT_AFFECTING_PROP_KEYS` (계층 A, Inspector props 편집 트리거)
- `apps/builder/src/builder/stores/inspectorActions.ts` - 프로퍼티 업데이트 + layoutVersion 증가
- `apps/builder/src/builder/hooks/useIframeMessenger.ts` - Preview 동기화 (`UPDATE_CANONICAL_DOCUMENT`)
- `apps/builder/src/builder/utils/canvasDeltaMessenger.ts` - Delta 동기화
