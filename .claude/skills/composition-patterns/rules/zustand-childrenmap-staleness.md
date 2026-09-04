---
title: Zustand childrenMap Staleness — elementsMap로 최신 props 조회 필수
impact: CRITICAL
impactDescription: childrenMap에서 읽은 Element 참조로 props를 사용하면 stale 데이터 → Canvas/Preview 불일치
tags: [zustand, state, canvas, selector, performance]
---

## 배경: Tabs title 미반영 버그 (2026-02-25)

Tab title을 Property Editor에서 변경하면 Preview에는 반영되나 Skia Canvas에는 반영되지 않음.
원인: `childrenMap`의 Element 참조가 stale 상태.

## 핵심 규칙

### Store 갱신 비대칭

> `elementsMap`/`childrenMap` 은 canonical document 에서 파생된 **read-only derived 캐시** (ADR-122) — 아래 비대칭 원칙은 derived 캐시 간에도 동일하게 유지됩니다.

| 액션                                          | `elementsMap` |      `childrenMap`       |
| --------------------------------------------- | :-----------: | :----------------------: |
| `createUpdateElementPropsAction` (props 변경) |    ✅ 갱신    |       ❌ 기존 유지       |
| `createUpdateElementAction`                   |    ✅ 갱신    | 구조·index 필드만 재구축 |
| `createBatchUpdateElementPropsAction`         |    ✅ 갱신    |       ❌ 기존 유지       |

**`childrenMap`은 parent-child 구조가 변할 때만 갱신됩니다.** props만 변경하면 `childrenMap` 내부의 Element 객체는 **이전 props를 가진 stale 참조**입니다.

### 규칙 1: childrenMap에서 읽은 Element의 props를 신뢰하지 마라

```typescript
// ❌ WRONG: childrenMap의 Element 참조는 stale일 수 있음
const children = state.childrenMap.get(parentId) ?? [];
const label = children[0].props.title; // ← stale!

// ✅ CORRECT: childrenMap에서 ID만 사용, elementsMap에서 최신 데이터 조회
const children = state.childrenMap.get(parentId) ?? [];
const freshChild = state.elementsMap.get(children[0].id);
const label = freshChild?.props.title; // ← 최신 데이터
```

### 규칙 2: useStore selector에서 배열/객체 반환 시 useRef 캐싱 필수

Zustand v5의 `useStore`는 `equalityFn` 파라미터를 지원하지 않음 (무시됨).
`useSyncExternalStore`는 `getSnapshot` 결과의 **참조 안정성**을 요구함.
selector가 매번 새 배열/객체를 반환하면 **무한 루프** 발생.

```typescript
// ❌ WRONG: 매번 새 배열 → useSyncExternalStore 무한 루프
const labels = useStore((state) => {
  return state.childrenMap.get(id)?.map((c) => c.props.title); // 매번 새 배열
});

// ❌ WRONG: Zustand v5에서 equalityFn 무시됨
const labels = useStore(
  (state) => state.childrenMap.get(id)?.map((c) => c.props.title),
  shallow, // ← 무시됨!
);

// ✅ CORRECT: useRef + shallow로 selector 내부 캐싱
import { shallow } from "zustand/shallow";

const cachedRef = useRef<string[] | null>(null);
const labels = useStore(
  useCallback(
    (state) => {
      const next =
        state.childrenMap.get(id)?.map((c) => {
          const fresh = state.elementsMap.get(c.id) ?? c;
          return String((fresh.props as Record<string, unknown>)?.title || "");
        }) ?? null;

      // 내용이 동일하면 이전 참조 반환 → useSyncExternalStore 안정성 보장
      if (shallow(cachedRef.current, next)) {
        return cachedRef.current;
      }
      cachedRef.current = next;
      return next;
    },
    [id],
  ),
);
```

### 규칙 3: 적용 대상 판별

이 패턴이 필요한 경우:

- **부모/조부모 컴포넌트가 자식/손자의 props를 읽어야 하는 경우**
  - 예: `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 컨테이너 — 자식 props 로 부모 spec shapes 를 구성 (Breadcrumbs `_crumbs`, GridList `items` 등, `buildSpecNodeData.ts` 참조)
  - 예: 자식 변경 시 부모/조부모 rebuild 확장 — `StoreRenderBridge.ts` 가 `elementsMap.get()` fresh lookup + `childrenMap` 순회로 처리

이 패턴이 **불필요**한 경우:

- 자기 자신의 props만 읽는 경우 (`element` prop이 이미 최신)
- 구조적 관계만 필요한 경우 (childrenMap의 길이, 존재 여부)

## 참조 파일

- `apps/builder/src/builder/stores/utils/elementUpdate.ts` — Store 갱신 로직
- `apps/builder/src/builder/stores/elements.ts` — `_rebuildIndexes()`
- `apps/builder/src/builder/workspace/canvas/skia/StoreRenderBridge.ts` — `SYNTHETIC_CHILD_PROP_MERGE_TAGS` 소비 + fresh lookup 패턴
- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` — synthetic child props 렌더 규약
