---
title: Modular Zustand Store Files
impact: HIGH
impactDescription: 코드 분리, 유지보수성, 테스트 용이성
tags: [zustand, state, architecture]
---

슬라이스별로 파일을 분리하고 store 파일 하나에서 조합합니다.

> **적용 범위 (2026-10-04)**: 남은 UI · 데이터 store 에만 적용한다. 문서 · 요소 상태는 catalog runtime 이 소유한다 (ADR-248 — [state-management.md](../../../rules/state-management.md)). 실제 구성: 슬라이스는 `apps/builder/src/builder/stores/` 의 평면 파일 (`canvasSettings.ts` `createSettingsSlice` · `panelLayout.ts` `createPanelLayoutSlice`) 이고, 조합은 `stores/builderUiStore.ts` 의 `useBuilderUiStore` 다 (`slices/` 디렉토리 · `stores/index.ts` 는 없다). 이름 `useStore` 는 옛 요소 store 이름이라 다시 만들지 않는다.

## Incorrect

```tsx
// ❌ 모든 상태를 하나의 파일에
// stores/store.ts
const useAppStore = create((set) => ({
  // 사용자 상태
  user: null,
  setUser: (user) => set({ user }),

  // UI 상태
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  // 프로젝트 상태
  projects: [],
  addProject: (p) => set((s) => ({ projects: [...s.projects, p] })),

  // ... 수백 줄의 코드
}));
```

## Correct

```tsx
// ✅ 슬라이스별 파일 분리 (평면 파일 — 예: stores/canvasSettings.ts · stores/panelLayout.ts)
// stores/userSettings.ts
export interface UserSlice {
  user: User | null;
  setUser: (user: User | null) => void;
}

export const createUserSlice: StateCreator<StoreState, [], [], UserSlice> = (
  set,
) => ({
  user: null,
  setUser: (user) => set({ user }),
});

// stores/uiLayout.ts
export interface UISlice {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export const createUISlice: StateCreator<StoreState, [], [], UISlice> = (
  set,
) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
});

// stores/appUiStore.ts — 조합 (실제 예: stores/builderUiStore.ts 의 useBuilderUiStore)
import { createUserSlice } from "./userSettings";
import { createUISlice } from "./uiLayout";

type StoreState = UserSlice & UISlice;

export const useAppUiStore = create<StoreState>()((set, get, store) => ({
  ...createUserSlice(set, get, store),
  ...createUISlice(set, get, store),
}));
```
