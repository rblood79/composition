---
title: Use Zustand Factory Pattern
impact: HIGH
impactDescription: 타입 안전성, 미들웨어 호환, 모듈화
tags: [zustand, state, architecture]
---

> **적용 범위 (2026-10-04)**: 남은 UI · 데이터 store 에만 적용한다 — 예: `stores/canvasSettings.ts` `createSettingsSlice` · `stores/panelLayout.ts` `createPanelLayoutSlice` (조합은 `stores/builderUiStore.ts`), `stores/data.ts` `createDataSlice`. 슬라이스 조합이 없는 단일 관심사 store (`toast.ts` · `conversation.ts` 등) 는 현재 직접 `create` 를 쓴다. 문서 · 요소 · 선택 · 히스토리 상태는 Zustand 가 아니라 catalog runtime 이 소유한다 (ADR-248 — [state-management.md](../../../rules/state-management.md)).

Zustand 스토어 생성 시 StateCreator를 사용한 팩토리 패턴을 적용합니다.

## Incorrect

```tsx
// ❌ 직접 create 호출
import { create } from "zustand";

const useCounterStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

## Correct

```tsx
// ✅ StateCreator 팩토리 패턴
import { create, StateCreator } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface CounterState {
  count: number;
  increment: () => void;
}

const createCounterSlice: StateCreator<
  CounterState,
  [["zustand/devtools", never], ["zustand/persist", unknown]]
> = (set) => ({
  count: 0,
  increment: () =>
    set((state) => ({ count: state.count + 1 }), false, "increment"),
});

export const useCounterStore = create<CounterState>()(
  devtools(persist(createCounterSlice, { name: "counter-storage" }), {
    name: "CounterStore",
  }),
);
```
