# 상태 관리 상세 레퍼런스

state-management.md의 핵심 규칙에 대한 구현 상세.

## batchUpdateElementProps DB 저장 패턴

DB 저장 시 delta props가 아닌 **merged 전체 props**를 저장해야 한다.

```typescript
// 잘못된 패턴 — delta만 저장 → 새로고침 후 나머지 props 소실
await db.updateElement({ id, props: delta });

// 올바른 패턴 — merged 전체 저장
const merged = { ...existing.props, ...delta };
await db.updateElement({ id, props: merged });
```

`existing`은 store의 `elementsMap.get(id)`에서 읽는다. delta만 저장하면 새로고침 후 delta에 포함되지 않은 나머지 props가 DB에서 사라진다.

## pageElementsSnapshot 갱신

요소 삭제(`executeRemoval`) 후 `pageElementsSnapshot`을 반드시 갱신해야 한다.

- 위치: `elementRemoval.ts`의 `executeRemoval` — 삭제 완료 후 snapshot 업데이트
- 갱신 누락 시: 삭제된 요소가 레이어 트리(Layer Panel)에 유령 항목으로 남음

```typescript
// executeRemoval (elementRemoval.ts) — pageIndex 재구축 후 snapshot 재구성
const newPageIndex = rebuildPageIndex(updatedElements, newElementsMap);
const newPageElementsSnapshot: Record<string, Element[]> = {};
for (const [pageId, elementIds] of newPageIndex.elementsByPage.entries()) {
  newPageElementsSnapshot[pageId] = updatedElements.filter((element) =>
    elementIds.has(element.id),
  );
}
set((state) => ({
  // ...elementsMap/childrenMap/pageIndex 갱신과 함께
  pageElementsSnapshot: newPageElementsSnapshot,
  layoutVersion: state.layoutVersion + 1, // 구조 변경 → 무조건 증가
}));
```

일반 재구축 경로는 `elements.ts` 의 `_rebuildIndexes` — canonical 우선 derive 후 `pageIndex.elementsByPage` 를 순회하며 `elementsMap` 조회로 `pageElementsSnapshot` 을 재구성한다 (구 `buildPageElementsSnapshot()` 헬퍼는 소멸 — 인라인 재구성).

## PropertyUnitInput 요소 전환 보호

이벤트 순서: `mousedown`(선택 변경) → `blur`(입력 커밋). blur 시점에 이미 새 요소가 선택되어 있으므로, blur 핸들러에서 그냥 onChange를 호출하면 새 요소에 잘못된 값이 적용된다.

```typescript
// handleInputFocus — focus 시점의 selectedElementId를 ref에 캡처
const focusedElementIdRef = useRef<string | null>(null);
const handleInputFocus = () => {
  focusedElementIdRef.current = selectedElementId;
};

// handleInputBlur — blur 시점과 비교, 다르면 스킵
const handleInputBlur = (value: string) => {
  if (focusedElementIdRef.current !== selectedElementId) return;
  onChange(value);
};
```

## 스타일 패널 상태 흐름 (Zustand 단독)

구 Jotai bridge (`useZustandJotaiBridge`/`SyntheticComputedStyle` atom 체인) 는 전면 제거됨 — 스타일 패널은 Zustand store 단독으로 동작한다.

- 값 표시 우선순위: inline style 우선, 없으면 spec/catalog preset fallback — 예: `useLayoutValues` (`apps/builder/src/builder/panels/styles/hooks/useLayoutValues.ts`) 의 `firstDefined(inline, specPx, fallback)` 3-arg 패턴
- store 는 longhand 만 저장 (`gap`→`rowGap`/`columnGap`, `padding`→4-way 등) — consumer 는 longhand 우선 + shorthand fallback 으로 읽기
- `PropertyUnitInput` commit 판정은 `lastSavedValueRef` 단독 기준 + focus 중에는 value prop 변경에 의한 리셋 skip
- 정본: `.claude/rules/style-ssot.md` (ADR-909)
