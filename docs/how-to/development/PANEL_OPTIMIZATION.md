# composition Builder 패널 최적화 종합 계획

> **⚠ Historical Notice (2026-05-13)**: 본 가이드의 코드 예시 중 `useTransformersQuery` / `fetchTransformers` / `activeTab === "transformers"` 분기 / Transformer 관련 패턴은 **ADR-132 Phase 7 (2026-05-13)** 에서 Transformer 시스템 전수 제거로 더 이상 유효하지 않음. React Query 최적화 패턴 자체 (캐싱 / dedupe / conditional fetch) 는 여전히 유효 — DataTables / API Endpoints / Variables 3-tab 에만 적용. `dataTables` 어휘는 `collections` 로 rename 됨 (ADR-132 Phase 5). 참조: [ADR-132](../../adr/completed/132-usecollectiondata-useasynclist-alignment.md).
>
> **작성일**: 2025-12-09
> **목표**: 12시간 이상 사용해도 처음과 같은 퍼포먼스를 유지하는 안정적인 빌더 시스템 구축
> **범위**: `src/builder/panels/` 전체 패널 시스템

---

## 목차

1. [현재 문제 분석](#1-현재-문제-분석)
2. [문제 원인 상세](#2-문제-원인-상세)
3. [최적화 목표](#3-최적화-목표)
4. [최적화 아키텍처 설계](#4-최적화-아키텍처-설계)
5. [Phase별 상세 구현 계획](#5-phase별-상세-구현-계획)
6. [구현 파일 목록](#6-구현-파일-목록)
7. [외부 라이브러리 도입 제안](#7-외부-라이브러리-도입-제안)
8. [기대 효과](#8-기대-효과)
9. [구현 순서](#9-구현-순서)
10. [부록: 코드 예시](#10-부록-코드-예시)

---

## 1. 현재 문제 분석

### 1.1 전체 패널 현황

| 패널                 | 상태        | 주요 문제                                                             | 우선순위 |
| -------------------- | ----------- | --------------------------------------------------------------------- | -------- |
| **MonitorPanel**     | 🔴 Critical | RAF 기반 모니터링, 비활성 시 계속 실행                                | **P0**   |
| **DataTablePanel**   | 🟠 Medium   | 4개 API 호출 (캐시 없음, but useEffect 내 isActive 체크)              | **P2**   |
| **NavigatorPanel**       | ✅ OK       | Virtual Scrolling 이미 적용됨 (VirtualizedLayerTree, VirtualizedTree) | -        |
| **PropertiesPanel**  | 🟠 High     | 5개 selector 구독, Inspector 연동                                     | **P1**   |
| **StylesPanel**      | 🟠 Medium   | 4개 훅 구독, localStorage 접근                                        | **P2**   |
| **EventsPanel**      | ✅ OK       | Early return 패턴 적용됨 (Line 126-129)                               | -        |
| **ComponentsPanel**  | 🟡 Low      | 5개 selector 구독                                                     | **P3**   |
| AIPanel              | ✅ OK       | 컴포넌트 분리 패턴 적용됨                                             | -        |
| SettingsPanel        | ✅ OK       | 컴포넌트 분리 패턴 적용됨                                             | -        |
| ThemesPanel          | ✅ OK       | 컴포넌트 분리 패턴 적용됨                                             | -        |
| DataTableEditorPanel | ✅ OK       | 컴포넌트 분리 패턴 적용됨                                             | -        |
| CodePreviewPanel     | ✅ OK       | Props 기반, Lazy 코드 생성                                            | -        |

### 1.2 좋은 패턴 (참고용)

```tsx
// ✅ AIPanel, SettingsPanel, ThemesPanel 패턴
export function AIPanel({ isActive }: PanelProps) {
  // isActive 체크 먼저!
  if (!isActive) {
    return null;
  }

  // 그 다음 Content 컴포넌트 마운트
  return <AIPanelContent />;
}

function AIPanelContent() {
  // Hook 호출은 여기서 (isActive=true일 때만 실행)
  const data = useStore((state) => state.data);
  // ...
}
```

---

## 2. 문제 원인 상세

### 2.1 MonitorPanel (🔴 Critical)

**파일 위치**: `src/builder/panels/monitor/MonitorPanel.tsx`

#### 문제점

| Line   | 코드                  | 문제                    | 영향                                               |
| ------ | --------------------- | ----------------------- | -------------------------------------------------- |
| 42     | `useMemoryStats()`    | `enabled` 파라미터 없음 | 비활성 시에도 메모리 통계 수집                     |
| 53     | `useWebVitals()`      | `enabled` 파라미터 없음 | 비활성 시에도 Web Vitals 수집                      |
| 52     | `useFPSMonitor()`     | 일부 최적화됨           | ✅ `enabled: isActive && activeTab === "realtime"` |
| 76-86  | 토스트 알림 useEffect | `isActive` 가드 없음    | 숨겨진 패널에서 경고 알림 발생                     |
| 89-112 | 메모리 히스토리 수집  | `isActive` 가드 없음    | RAF 기반 업데이트 지속                             |

#### 현재 코드

```tsx
export function MonitorPanel({ isActive }: PanelProps) {
  // ⚠️ 문제: isActive 체크 전에 무거운 훅들이 실행됨
  const { stats, statusMessage, optimize, isOptimizing } = useMemoryStats(); // ❌
  const [memoryHistory, setMemoryHistory] = useState<number[]>([]);
  const { fps } = useFPSMonitor({
    enabled: isActive && activeTab === "realtime",
  }); // ✅ 일부 OK
  const { vitals, collectLocalVitals } = useWebVitals(); // ❌

  // ⚠️ 문제: 토스트 알림이 isActive 무관하게 실행
  useEffect(() => {
    if (!stats?.browserMemory) return;
    const percent = stats.browserMemory.usagePercent;
    if (percent >= 75) {
      showToast(
        "error",
        `메모리 사용량이 위험 수준입니다 (${percent.toFixed(1)}%)`,
      ); // ❌
    }
  }, [stats?.browserMemory?.usagePercent, showToast]);

  // ⚠️ 문제: 메모리 히스토리 수집이 isActive 무관하게 실행
  useEffect(() => {
    if (!stats) return;
    // RAF로 매 프레임 업데이트 → 비활성 시에도 계속 실행됨
    requestAnimationFrame(() => {
      setMemoryHistory((prev) => {
        const newHistory = [...prev, newValue]; // 배열 복사 + 추가 (메모리 증가)
        if (newHistory.length > MAX_HISTORY_POINTS) {
          return newHistory.slice(-MAX_HISTORY_POINTS);
        }
        return newHistory;
      });
    });
  }, [stats]);

  if (!isActive) {
    return null; // ❌ 이미 위의 Hook들이 실행된 후
  }
  // ...
}
```

#### 시간에 따른 성능 저하

```
빌더 접속
    ↓
MonitorPanel: useMemoryStats() 실행 (비활성이어도)
    ↓
매 프레임 RAF → setMemoryHistory() → 리렌더
    ↓
메모리 사용량 증가 → 토스트 경고 발생 (숨겨진 패널에서)
    ↓
GC 빈번 발생 → 프레임 드롭
    ↓
12시간 후: 전체 빌더 느려짐
```

---

### 2.2 DataTablePanel (🔴 Critical)

**파일 위치**: `src/builder/panels/datatable/DataTablePanel.tsx`

#### 문제점

| Line  | 코드                                   | 문제                       | 영향                      |
| ----- | -------------------------------------- | -------------------------- | ------------------------- |
| 57-61 | `useDataStore` 6개 selector            | `isActive` 체크 전 구독    | 상태 변경마다 리렌더      |
| 64-67 | `useDataTableEditorStore` 4개 selector | `isActive` 체크 전 구독    | 편집 상태 변경 시 리렌더  |
| 73-87 | 4개 API 동시 호출                      | 캐시/진행중 요청 확인 없음 | 탭 전환마다 네트워크 부하 |

#### 현재 코드

```tsx
export function DataTablePanel({ isActive }: PanelProps) {
  const [activeTab, setActiveTab] = useState<DataTableTab>("tables");

  // ⚠️ 문제: isActive 체크 전에 store 구독
  const isLoading = useDataStore((state) => state.isLoading);  // ❌
  const fetchDataTables = useDataStore((state) => state.fetchDataTables);  // ❌
  const fetchApiEndpoints = useDataStore((state) => state.fetchApiEndpoints);  // ❌
  const fetchVariables = useDataStore((state) => state.fetchVariables);  // ❌
  const fetchTransformers = useDataStore((state) => state.fetchTransformers);  // ❌

  const editorMode = useDataTableEditorStore((state) => state.mode);  // ❌
  const openTableCreator = useDataTableEditorStore((state) => state.openTableCreator);  // ❌
  const openTableEditor = useDataTableEditorStore((state) => state.openTableEditor);  // ❌
  const closeEditor = useDataTableEditorStore((state) => state.closeEditor);  // ❌

  // ⚠️ 문제: 4개 API 동시 호출, 캐시 없음
  useEffect(() => {
    if (isActive && currentProjectId) {
      fetchDataTables(currentProjectId);     // API 호출 1
      fetchApiEndpoints(currentProjectId);   // API 호출 2
      fetchVariables(currentProjectId);      // API 호출 3
      fetchTransformers(currentProjectId);   // API 호출 4
      // 탭 전환할 때마다 4개 모두 다시 호출됨!
    }
  }, [isActive, currentProjectId, ...]);

  if (!isActive) {
    return null;  // ❌ 구독은 이미 실행됨
  }
  // ...
}
```

#### 문제 시나리오

1. 사용자가 DataTablePanel 탭 클릭
2. 4개 API 동시 호출
3. 다른 탭으로 이동
4. 다시 DataTablePanel 탭 클릭
5. **또 4개 API 동시 호출** (캐시 없음)
6. 반복 → 네트워크 부하 누적

---

### 2.3 NavigatorPanel (🟠 High)

**파일 위치**: `src/builder/panels/navigator/NavigatorPanel.tsx`

#### 문제점

| Line  | 코드                                  | 문제                                                        |
| ----- | ------------------------------------- | ----------------------------------------------------------- |
| 27-29 | `useStore` 3개 selector               | `currentPageId`, `pages`, `elements` 구독                   |
| 32-33 | `useEditModeStore`, `useLayoutsStore` | 모드/레이아웃 변경마다 리렌더                               |
| 36-38 | 3개 커스텀 훅                         | `useIframeMessenger`, `usePageManager`, `useElementCreator` |

#### 현재 코드

```tsx
export function NavigatorPanel({ isActive }: PanelProps) {
  const { projectId } = useParams<{ projectId: string }>();

  // ⚠️ 문제: 8개 훅/selector가 isActive 체크 전에 실행됨
  const currentPageId = useStore((state) => state.currentPageId);  // ❌
  const pages = useStore((state) => state.pages);  // ❌
  const elements = useStore((state) => state.elements);  // ❌
  const editMode = useEditModeStore((state) => state.mode);  // ❌
  const currentLayoutId = useLayoutsStore((state) => state.currentLayoutId);  // ❌
  const { requestAutoSelectAfterUpdate } = useIframeMessenger();  // ❌
  const { pageList, addPage, addPageWithParams, fetchElements, initializeProject } = usePageManager(...);  // ❌
  const { handleAddElement } = useElementCreator();  // ❌

  // 프로젝트 초기화
  useEffect(() => {
    if (projectId && pages.length === 0 && isActive) {
      initializeProject(projectId);
    }
  }, [projectId, pages.length, isActive, initializeProject]);

  if (!isActive) {
    return null;  // ❌ 이미 8개 훅이 실행된 후
  }
  // ...
}
```

---

### 2.4 PropertiesPanel (🟠 High)

**파일 위치**: `src/builder/panels/properties/PropertiesPanel.tsx`

#### 문제점

| Line    | 코드                    | 문제                                                                 |
| ------- | ----------------------- | -------------------------------------------------------------------- |
| 236     | `useInspectorState`     | `selectedElement` 구독                                               |
| 270-274 | `useStore` 4개 selector | `multiSelectMode`, `selectedElementIds`, `currentPageId`, `elements` |

#### 현재 코드

```tsx
export function PropertiesPanel({ isActive }: PanelProps) {
  // ⚠️ 문제: isActive 체크 전 구독
  const selectedElement = useInspectorState((state) => state.selectedElement); // ❌

  // ⚠️ 일부 최적화됨: getState() 사용
  const removeElement = useStore.getState().removeElement; // ✅ 구독 아님
  const setSelectedElement = useStore.getState().setSelectedElement; // ✅ 구독 아님

  // ⚠️ 문제: 직접 구독
  const multiSelectMode = useStore((state) => state.multiSelectMode); // ❌
  const rawSelectedElementIds = useStore((state) => state.selectedElementIds); // ❌
  const currentPageId = useStore((state) => state.currentPageId); // ❌
  const elements = useStore((state) => state.elements); // ❌

  if (!isActive) {
    return null; // ❌ 구독은 이미 실행됨
  }
  // ...
}
```

---

### 2.5 StylesPanel (🟠 Medium)

**파일 위치**: `src/builder/panels/styles/StylesPanel.tsx`

#### 문제점

| Line  | 코드                | 문제                                    |
| ----- | ------------------- | --------------------------------------- |
| 37    | `useInspectorState` | `selectedElement` 구독                  |
| 39-46 | 커스텀 훅들         | `useSectionCollapse`, `useStyleActions` |

#### 현재 코드

```tsx
export function StylesPanel({ isActive }: PanelProps) {
  // ⚠️ 문제: isActive 체크 전 구독
  const selectedElement = useInspectorState((state) => state.selectedElement); // ❌
  const [filter, setFilter] = useState<"all" | "modified">("all");
  const {
    expandAll,
    collapseAll,
    collapsedSections,
    focusMode,
    toggleFocusMode,
  } = useSectionCollapse(); // ❌
  const { copyStyles, pasteStyles } = useStyleActions(); // ❌

  if (!isActive) {
    return null; // ❌ 훅들이 이미 실행된 후
  }
  // ...
}
```

---

### 2.6 EventsPanel (🟡 Medium)

**파일 위치**: `src/builder/panels/events/EventsPanel.tsx`

#### 문제점

| Line    | 코드                    | 문제                                   |
| ------- | ----------------------- | -------------------------------------- |
| 123-124 | `useInspectorState` 2개 | `selectedElement`, `updateEvents` 구독 |

#### 현재 코드

```tsx
export function EventsPanel({ isActive }: PanelProps) {
  // ⚠️ 문제: isActive 체크 전 구독
  const selectedElement = useInspectorState((state) => state.selectedElement); // ❌
  const updateEvents = useInspectorState((state) => state.updateEvents); // ❌

  if (!isActive) {
    return null; // ❌ 구독은 이미 실행됨
  }
  // ...
}
```

---

### 2.7 ComponentsPanel (🟡 Low)

**파일 위치**: `src/builder/panels/components/ComponentsPanel.tsx`

#### 문제점

| Line  | 코드                    | 문제                                               |
| ----- | ----------------------- | -------------------------------------------------- |
| 20-23 | `useStore` 3개 selector | `selectedElementId`, `currentPageId`, `addElement` |
| 26-27 | 추가 store              | `useEditModeStore`, `useLayoutsStore`              |

#### 현재 코드

```tsx
export function ComponentsPanel({ isActive }: PanelProps) {
  // ⚠️ 문제: isActive 체크 전 구독
  const selectedElementId = useStore((state) => state.selectedElementId); // ❌
  const currentPageId = useStore((state) => state.currentPageId); // ❌
  const addElement = useStore((state) => state.addElement); // ❌
  const editMode = useEditModeStore((state) => state.mode); // ❌
  const currentLayoutId = useLayoutsStore((state) => state.currentLayoutId); // ❌

  if (!isActive) {
    return null; // ❌ 구독은 이미 실행됨
  }
  // ...
}
```

---

## 3. 최적화 목표

### 3.1 핵심 목표

| 목표                 | 설명                      | 측정 지표           |
| -------------------- | ------------------------- | ------------------- |
| **12시간 안정성**    | 장시간 사용해도 성능 유지 | 메모리 < 200MB      |
| **초기 로딩 최적화** | 빠른 빌더 시작            | < 500ms             |
| **탭 전환 응답성**   | 패널 전환 시 즉각 반응    | < 100ms             |
| **네트워크 효율화**  | 중복 요청 제거            | 캐시 hit rate > 80% |

### 3.2 기술적 목표

1. **비활성 패널의 리소스 사용 제로화**
   - Hook 실행 방지
   - Store 구독 해제
   - RAF/타이머 중단

2. **메모리 누수 방지**
   - 순환 버퍼로 배열 증가 방지
   - 적절한 cleanup
   - WeakRef 활용

3. **서버 상태 캐싱**
   - React Query 도입
   - staleTime 기반 캐시
   - 백그라운드 갱신

---

## 4. 최적화 아키텍처 설계

### 4.1 3-Layer Optimization Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Layer 1: Panel Gateway                       │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ isActive?   │──│ Lazy Load   │──│ Mount       │            │
│  │ Check       │  │ Component   │  │ Content     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  - isActive 기반 조건부 마운트                                    │
│  - Lazy Loading (React.lazy + Suspense)                         │
│  - Panel Lifecycle Management                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Layer 2: State Subscription                      │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Zustand     │  │ React Query │  │ Selective   │            │
│  │ Selectors   │  │ Cache       │  │ Subscribe   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  - Zustand Selector 최적화 (shallow comparison)                  │
│  - Selective Subscription Pattern                                │
│  - React Query (서버 상태 캐싱)                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                Layer 3: Resource Management                      │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Circular    │  │ Scheduler   │  │ Virtual     │            │
│  │ Buffer      │  │ (Idle)      │  │ Scrolling   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
│  - Memory Cleanup (WeakRef, FinalizationRegistry)               │
│  - Scheduler (requestIdleCallback)                               │
│  - Virtual Scrolling (@tanstack/react-virtual)                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Panel Gateway 패턴

```tsx
// ✅ 권장 패턴: Gateway → Content 분리
function PanelGateway({ isActive }: PanelProps) {
  // 1단계: isActive 체크 (Hook 호출 전!)
  if (!isActive) {
    return null;
  }

  // 2단계: Content 마운트 (여기서 Hook 실행)
  return <PanelContent />;
}

function PanelContent() {
  // Hook은 여기서만 호출됨 (isActive=true 보장)
  const data = useStore((state) => state.data);
  // ...
}
```

### 4.3 데이터 흐름

```
User Action
    │
    ▼
┌─────────────────┐
│  Panel Gateway  │──── isActive=false ────▶ null (렌더링 안함)
└────────┬────────┘
         │ isActive=true
         ▼
┌─────────────────┐
│  PanelContent   │
│  (Hook 실행)    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────────┐
│Zustand│ │React Query│
│(Client│ │(Server    │
│ State)│ │ State)    │
└───────┘ └───────────┘
```

---

## 5. Phase별 상세 구현 계획

### Phase 1: Panel Gateway Layer (우선순위 🔴)

#### 1.1 `useLazyPanel` Hook 생성

**파일**: `src/builder/panels/core/hooks/useLazyPanel.ts`

````typescript
import { lazy, Suspense, ComponentType, useState, useEffect } from "react";
import { LoadingSpinner } from "../common";

interface UseLazyPanelOptions {
  /** 패널 활성화 여부 */
  enabled: boolean;
  /** 마운트 지연 시간 (ms) - 빠른 탭 전환 시 불필요한 로딩 방지 */
  delay?: number;
  /** 언마운트 시 상태 보존 여부 */
  keepAlive?: boolean;
  /** 로딩 중 표시할 컴포넌트 */
  fallback?: React.ReactNode;
}

interface UseLazyPanelReturn<T> {
  /** 렌더링할 컴포넌트 (null이면 렌더링 안함) */
  Component: ComponentType<T> | null;
  /** 로딩 중 여부 */
  isLoading: boolean;
  /** 에러 */
  error: Error | null;
}

/**
 * 조건부 패널 마운트를 위한 Hook
 *
 * @example
 * ```tsx
 * function MonitorPanel({ isActive }: PanelProps) {
 *   const { Component, isLoading } = useLazyPanel(
 *     () => import('./MonitorPanelContent'),
 *     { enabled: isActive, delay: 100 }
 *   );
 *
 *   if (!Component) return null;
 *   return <Component />;
 * }
 * ```
 */
export function useLazyPanel<T extends object>(
  loader: () => Promise<{ default: ComponentType<T> }>,
  options: UseLazyPanelOptions,
): UseLazyPanelReturn<T> {
  const { enabled, delay = 0, keepAlive = false } = options;

  const [Component, setComponent] = useState<ComponentType<T> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [shouldRender, setShouldRender] = useState(enabled);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let mounted = true;

    if (enabled) {
      // delay가 있으면 지연 후 렌더링
      if (delay > 0) {
        timeoutId = setTimeout(() => {
          if (mounted) setShouldRender(true);
        }, delay);
      } else {
        setShouldRender(true);
      }
    } else if (!keepAlive) {
      setShouldRender(false);
    }

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, delay, keepAlive]);

  useEffect(() => {
    if (!shouldRender) {
      if (!keepAlive) setComponent(null);
      return;
    }

    let mounted = true;
    setIsLoading(true);
    setError(null);

    loader()
      .then((module) => {
        if (mounted) {
          setComponent(() => module.default);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err);
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [shouldRender, keepAlive]);

  return {
    Component: shouldRender ? Component : null,
    isLoading,
    error,
  };
}
````

#### 1.2 `usePanelLifecycle` Hook 생성

**파일**: `src/builder/panels/core/hooks/usePanelLifecycle.ts`

````typescript
import { useEffect, useRef, useCallback } from "react";

interface UsePanelLifecycleOptions {
  /** 패널 활성화 여부 */
  isActive: boolean;
  /** 패널 ID (디버깅용) */
  panelId: string;
  /** 활성화 시 실행할 콜백 */
  onActivate?: () => void;
  /** 비활성화 시 실행할 콜백 */
  onDeactivate?: () => void;
  /** 정리 작업 (RAF, 타이머 취소 등) */
  cleanup?: () => void;
}

/**
 * 패널 생명주기 관리 Hook
 *
 * @example
 * ```tsx
 * usePanelLifecycle({
 *   isActive,
 *   panelId: 'monitor',
 *   onActivate: () => startMonitoring(),
 *   onDeactivate: () => stopMonitoring(),
 *   cleanup: () => cancelAnimationFrame(rafId),
 * });
 * ```
 */
export function usePanelLifecycle(options: UsePanelLifecycleOptions) {
  const { isActive, panelId, onActivate, onDeactivate, cleanup } = options;
  const wasActive = useRef(isActive);

  useEffect(() => {
    // 활성화됨
    if (isActive && !wasActive.current) {
      if (import.meta.env.DEV) {
        console.log(`[Panel] ${panelId} activated`);
      }
      onActivate?.();
    }

    // 비활성화됨
    if (!isActive && wasActive.current) {
      if (import.meta.env.DEV) {
        console.log(`[Panel] ${panelId} deactivated`);
      }
      onDeactivate?.();
      cleanup?.();
    }

    wasActive.current = isActive;
  }, [isActive, panelId, onActivate, onDeactivate, cleanup]);

  // 언마운트 시 정리
  useEffect(() => {
    return () => {
      cleanup?.();
    };
  }, [cleanup]);
}
````

#### 1.3 패널별 적용 예시

**MonitorPanel 리팩토링**:

```tsx
// src/builder/panels/monitor/MonitorPanel.tsx

export function MonitorPanel({ isActive }: PanelProps) {
  // ✅ isActive 체크 먼저!
  if (!isActive) {
    return null;
  }

  return <MonitorPanelContent />;
}

// src/builder/panels/monitor/MonitorPanelContent.tsx
function MonitorPanelContent() {
  // ✅ Hook은 여기서 실행 (isActive=true 보장)
  const { stats, statusMessage, optimize, isOptimizing } = useMemoryStats({
    enabled: true,
  });
  const { fps } = useFPSMonitor({ enabled: activeTab === "realtime" });
  const { vitals, collectLocalVitals } = useWebVitals({
    enabled: activeTab === "realtime",
  });

  // ... 나머지 로직
}
```

---

### Phase 2: State Subscription Layer (우선순위 🔴)

#### 2.1 Zustand Selector 최적화

**파일**: `src/builder/stores/selectors/panelSelectors.ts`

```typescript
import { useStore } from "../index";
import { shallow } from "zustand/shallow";

// ============================================================================
// Individual Selectors (가장 효율적)
// ============================================================================

/** 현재 페이지 ID */
export const useCurrentPageId = () => useStore((state) => state.currentPageId);

/** 선택된 요소 ID */
export const useSelectedElementId = () =>
  useStore((state) => state.selectedElementId);

/** 멀티셀렉트 모드 */
export const useMultiSelectMode = () =>
  useStore((state) => state.multiSelectMode);

/** 선택된 요소 ID 배열 */
export const useSelectedElementIds = () =>
  useStore((state) => state.selectedElementIds, shallow);

/** 현재 페이지 요소들 */
export const useCurrentPageElements = () => {
  const currentPageId = useStore((state) => state.currentPageId);
  const elements = useStore((state) => state.elements, shallow);
  return elements.filter((el) => el.page_id === currentPageId);
};

// ============================================================================
// Actions (구독 없이 가져오기)
// ============================================================================

/** Store actions (구독 없이 함수만 가져오기) */
export const getStoreActions = () => {
  const state = useStore.getState();
  return {
    addElement: state.addElement,
    removeElement: state.removeElement,
    updateElement: state.updateElement,
    updateElementProps: state.updateElementProps,
    setSelectedElement: state.setSelectedElement,
    setSelectedElements: state.setSelectedElements,
  };
};

// ============================================================================
// Combined Selectors (shallow 비교 필수)
// ============================================================================

/** NavigatorPanel용 selector */
export const useNavigatorPanelState = () =>
  useStore(
    (state) => ({
      currentPageId: state.currentPageId,
      pages: state.pages,
      // elements는 별도 구독 권장 (변경 빈도 높음)
    }),
    shallow,
  );

/** ComponentsPanel용 selector */
export const useComponentsPanelState = () =>
  useStore(
    (state) => ({
      selectedElementId: state.selectedElementId,
      currentPageId: state.currentPageId,
    }),
    shallow,
  );
```

#### 2.2 React Query 설정

**파일**: `src/builder/providers/QueryProvider.tsx`

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Query Client 설정
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5분 동안 fresh 상태 유지
      staleTime: 5 * 60 * 1000,
      // 10분 후 가비지 컬렉션
      gcTime: 10 * 60 * 1000,
      // 윈도우 포커스 시 자동 갱신 비활성화
      refetchOnWindowFocus: false,
      // 재연결 시 자동 갱신 비활성화
      refetchOnReconnect: false,
      // 실패 시 3번 재시도
      retry: 3,
      // 재시도 지연 (exponential backoff)
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      // 뮤테이션 실패 시 재시도 안함
      retry: false,
    },
  },
});

interface QueryProviderProps {
  children: React.ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
```

#### 2.3 DataTable Query Hooks

**파일**: `src/builder/panels/data/hooks/useDataTableQuery.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDataStore } from "../../../stores/data";

// Query Keys
export const dataTableKeys = {
  all: ["dataTables"] as const,
  lists: () => [...dataTableKeys.all, "list"] as const,
  list: (projectId: string) => [...dataTableKeys.lists(), projectId] as const,
  details: () => [...dataTableKeys.all, "detail"] as const,
  detail: (id: string) => [...dataTableKeys.details(), id] as const,
};

export const apiEndpointKeys = {
  all: ["apiEndpoints"] as const,
  list: (projectId: string) =>
    [...apiEndpointKeys.all, "list", projectId] as const,
};

export const variableKeys = {
  all: ["variables"] as const,
  list: (projectId: string) =>
    [...variableKeys.all, "list", projectId] as const,
};

export const transformerKeys = {
  all: ["transformers"] as const,
  list: (projectId: string) =>
    [...transformerKeys.all, "list", projectId] as const,
};

/**
 * DataTable 목록 조회
 */
export function useDataTablesQuery(projectId: string, enabled: boolean) {
  const fetchDataTables = useDataStore((state) => state.fetchDataTables);

  return useQuery({
    queryKey: dataTableKeys.list(projectId),
    queryFn: () => fetchDataTables(projectId),
    enabled: enabled && !!projectId,
    staleTime: 5 * 60 * 1000, // 5분 캐시
  });
}

/**
 * API Endpoint 목록 조회
 */
export function useApiEndpointsQuery(projectId: string, enabled: boolean) {
  const fetchApiEndpoints = useDataStore((state) => state.fetchApiEndpoints);

  return useQuery({
    queryKey: apiEndpointKeys.list(projectId),
    queryFn: () => fetchApiEndpoints(projectId),
    enabled: enabled && !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Variables 목록 조회
 */
export function useVariablesQuery(projectId: string, enabled: boolean) {
  const fetchVariables = useDataStore((state) => state.fetchVariables);

  return useQuery({
    queryKey: variableKeys.list(projectId),
    queryFn: () => fetchVariables(projectId),
    enabled: enabled && !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Transformers 목록 조회
 */
export function useTransformersQuery(projectId: string, enabled: boolean) {
  const fetchTransformers = useDataStore((state) => state.fetchTransformers);

  return useQuery({
    queryKey: transformerKeys.list(projectId),
    queryFn: () => fetchTransformers(projectId),
    enabled: enabled && !!projectId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 탭별 개별 쿼리 (지연 로드)
 */
export function useDataTableTabQuery(
  projectId: string,
  activeTab: "tables" | "endpoints" | "variables" | "transformers",
  enabled: boolean,
) {
  const queryClient = useQueryClient();

  // 활성 탭에 해당하는 쿼리만 실행
  const tablesQuery = useDataTablesQuery(
    projectId,
    enabled && activeTab === "tables",
  );
  const endpointsQuery = useApiEndpointsQuery(
    projectId,
    enabled && activeTab === "endpoints",
  );
  const variablesQuery = useVariablesQuery(
    projectId,
    enabled && activeTab === "variables",
  );
  const transformersQuery = useTransformersQuery(
    projectId,
    enabled && activeTab === "transformers",
  );

  // Prefetch: 다른 탭 미리 로드 (낮은 우선순위)
  const prefetchOtherTabs = () => {
    if (activeTab !== "tables") {
      queryClient.prefetchQuery({
        queryKey: dataTableKeys.list(projectId),
        queryFn: () => useDataStore.getState().fetchDataTables(projectId),
      });
    }
    // ... 다른 탭들도 prefetch
  };

  return {
    tablesQuery,
    endpointsQuery,
    variablesQuery,
    transformersQuery,
    prefetchOtherTabs,
  };
}
```

---

### Phase 3: Resource Management Layer (우선순위 🟠)

#### 3.1 CircularBuffer 구현

**파일**: `src/builder/utils/CircularBuffer.ts`

````typescript
/**
 * 고정 크기 순환 버퍼
 *
 * 무한 배열 증가를 방지하고 메모리를 효율적으로 관리
 *
 * @example
 * ```typescript
 * const buffer = new CircularBuffer<number>(60);  // 최대 60개
 * buffer.push(1);
 * buffer.push(2);
 * console.log(buffer.toArray());  // [1, 2]
 * ```
 */
export class CircularBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private tail = 0;
  private count = 0;

  constructor(private maxSize: number) {
    if (maxSize <= 0) {
      throw new Error("Buffer size must be positive");
    }
    this.buffer = new Array(maxSize);
  }

  /** 아이템 추가 */
  push(item: T): void {
    this.buffer[this.head] = item;
    this.head = (this.head + 1) % this.maxSize;

    if (this.count < this.maxSize) {
      this.count++;
    } else {
      // 버퍼가 가득 차면 tail도 이동
      this.tail = (this.tail + 1) % this.maxSize;
    }
  }

  /** 최신 데이터 순서대로 배열 반환 */
  toArray(): T[] {
    const result: T[] = [];

    for (let i = 0; i < this.count; i++) {
      const index = (this.tail + i) % this.maxSize;
      const item = this.buffer[index];
      if (item !== undefined) {
        result.push(item);
      }
    }

    return result;
  }

  /** 버퍼 초기화 */
  clear(): void {
    this.buffer = new Array(this.maxSize);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  /** 현재 아이템 개수 */
  get length(): number {
    return this.count;
  }

  /** 버퍼가 가득 찼는지 */
  get isFull(): boolean {
    return this.count === this.maxSize;
  }

  /** 가장 최근 아이템 */
  get last(): T | undefined {
    if (this.count === 0) return undefined;
    const index = (this.head - 1 + this.maxSize) % this.maxSize;
    return this.buffer[index];
  }
}
````

#### 3.2 useMemoryStats 최적화

**파일**: `src/builder/panels/monitor/hooks/useMemoryStats.ts` (수정)

```typescript
import { useState, useEffect, useRef, useCallback } from "react";
import { CircularBuffer } from "../../../utils/CircularBuffer";

interface UseMemoryStatsOptions {
  /** 모니터링 활성화 여부 */
  enabled: boolean;
  /** 업데이트 간격 (ms) */
  intervalMs?: number;
  /** 히스토리 최대 크기 */
  maxHistorySize?: number;
}

interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercent: number;
}

interface UseMemoryStatsReturn {
  stats: MemoryStats | null;
  history: number[];
  statusMessage: string;
  optimize: () => void;
  isOptimizing: boolean;
}

export function useMemoryStats(
  options: UseMemoryStatsOptions,
): UseMemoryStatsReturn {
  const { enabled, intervalMs = 10000, maxHistorySize = 60 } = options;

  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);

  // ✅ CircularBuffer 사용 (무한 배열 증가 방지)
  const historyBuffer = useRef(new CircularBuffer<number>(maxHistorySize));
  const [history, setHistory] = useState<number[]>([]);

  // RAF/Interval ID 저장
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null);

  // 메모리 통계 수집
  const collectStats = useCallback(() => {
    const perf = performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    };

    if (!perf.memory) {
      setStatusMessage("Memory API not available (Chrome/Edge only)");
      return;
    }

    const newStats: MemoryStats = {
      usedJSHeapSize: perf.memory.usedJSHeapSize,
      totalJSHeapSize: perf.memory.totalJSHeapSize,
      jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
      usagePercent:
        (perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100,
    };

    setStats(newStats);

    // ✅ CircularBuffer에 추가 (자동 크기 제한)
    historyBuffer.current.push(newStats.usedJSHeapSize);
    setHistory(historyBuffer.current.toArray());

    // 상태 메시지 업데이트
    if (newStats.usagePercent >= 75) {
      setStatusMessage("Memory usage critical!");
    } else if (newStats.usagePercent >= 60) {
      setStatusMessage("Memory usage high");
    } else {
      setStatusMessage("");
    }
  }, []);

  // ✅ enabled가 false면 모든 모니터링 중단
  useEffect(() => {
    if (!enabled) {
      // 비활성화: interval 정리
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
      return;
    }

    // 활성화: interval 시작
    collectStats(); // 즉시 한 번 수집
    intervalIdRef.current = setInterval(collectStats, intervalMs);

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = null;
      }
    };
  }, [enabled, intervalMs, collectStats]);

  // 최적화 함수
  const optimize = useCallback(() => {
    setIsOptimizing(true);

    // 히스토리 초기화
    historyBuffer.current.clear();
    setHistory([]);

    // GC 힌트 (Chrome에서만 동작)
    if (typeof gc !== "undefined") {
      gc();
    }

    setTimeout(() => {
      setIsOptimizing(false);
      collectStats();
    }, 1000);
  }, [collectStats]);

  return {
    stats,
    history,
    statusMessage,
    optimize,
    isOptimizing,
  };
}
```

#### 3.3 Performance Monitor

**파일**: `src/builder/utils/performanceMonitor.ts`

```typescript
import { queryClient } from "../providers/QueryProvider";

interface PerformanceMetrics {
  longTaskCount: number;
  totalBlockingTime: number;
  lastCleanup: number;
}

/**
 * 성능 모니터링 및 자동 복구 시스템
 *
 * - Long Task 감지 (50ms 이상)
 * - 자동 캐시 정리
 * - 메모리 사용량 모니터링
 */
class PerformanceMonitor {
  private observer: PerformanceObserver | null = null;
  private metrics: PerformanceMetrics = {
    longTaskCount: 0,
    totalBlockingTime: 0,
    lastCleanup: Date.now(),
  };
  private readonly CLEANUP_THRESHOLD = 10; // Long Task 10회 이상
  private readonly CLEANUP_INTERVAL = 60000; // 최소 1분 간격

  constructor() {
    this.init();
  }

  private init() {
    // Long Task Observer
    if ("PerformanceObserver" in window) {
      try {
        this.observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              this.metrics.longTaskCount++;
              this.metrics.totalBlockingTime += entry.duration;

              if (import.meta.env.DEV) {
                console.warn(
                  `[Performance] Long Task detected: ${entry.duration.toFixed(2)}ms`,
                );
              }

              this.checkAndCleanup();
            }
          }
        });

        this.observer.observe({ entryTypes: ["longtask"] });
      } catch (e) {
        console.warn("[Performance] Long Task API not supported");
      }
    }
  }

  private checkAndCleanup() {
    const now = Date.now();
    const timeSinceLastCleanup = now - this.metrics.lastCleanup;

    // 조건: Long Task 10회 이상 && 마지막 정리 후 1분 이상
    if (
      this.metrics.longTaskCount >= this.CLEANUP_THRESHOLD &&
      timeSinceLastCleanup >= this.CLEANUP_INTERVAL
    ) {
      this.triggerCleanup();
    }
  }

  private triggerCleanup() {
    if (import.meta.env.DEV) {
      console.log("[Performance] Triggering auto cleanup...");
    }

    // 1. React Query 캐시 정리 (stale 데이터만)
    queryClient.invalidateQueries();

    // 2. GC 힌트 (Chrome에서만)
    if (typeof gc !== "undefined") {
      gc();
    }

    // 3. 메트릭 리셋
    this.metrics.longTaskCount = 0;
    this.metrics.totalBlockingTime = 0;
    this.metrics.lastCleanup = Date.now();

    if (import.meta.env.DEV) {
      console.log("[Performance] Cleanup completed");
    }
  }

  /** 현재 메트릭 조회 */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /** 수동 정리 트리거 */
  forceCleanup() {
    this.triggerCleanup();
  }

  /** 옵저버 정리 */
  destroy() {
    this.observer?.disconnect();
    this.observer = null;
  }
}

// 싱글톤 인스턴스
export const performanceMonitor = new PerformanceMonitor();
```

#### 3.4 Virtual Scrolling (NavigatorPanel) - ✅ 이미 적용됨

> **상태**: 구현 완료 (추가 작업 불필요)

NavigatorPanel의 Virtual Scrolling은 **이미 Sidebar 컴포넌트에 구현**되어 있습니다:

**기존 구현 파일**:

- `src/builder/sidebar/VirtualizedLayerTree.tsx` - Layer Tree용 가상 스크롤링
- `src/builder/sidebar/components/VirtualizedTree.tsx` - 일반 Tree용 가상 스크롤링

**주요 특징**:

```typescript
// VirtualizedLayerTree.tsx (Line 422-427)
const virtualizer = useVirtualizer({
  count: flattenedItems.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 28,  // 각 아이템의 예상 높이 (px)
  overscan: 5,             // 화면 밖에 미리 렌더링할 아이템 수
});

// 50개 미만은 일반 렌더링 (오버헤드 방지)
if (flattenedItems.length < 50) {
  return <>{/* 일반 렌더링 */}</>;
}
```

**추가 최적화 포인트** (선택적):

- `VirtualizedTree.tsx`에 keyboard navigation, ARIA 지원 이미 포함
- `TreeItemRow`가 React.memo로 메모이제이션됨

---

### Phase 4: 성능 모니터링 & 자동 복구 (우선순위 🟡)

#### 4.1 Scheduler를 활용한 Idle 작업

**파일**: `src/builder/utils/idleScheduler.ts`

```typescript
/**
 * Idle 시간에 작업 실행
 *
 * requestIdleCallback 폴리필 포함
 */

type IdleCallback = () => void;

interface IdleSchedulerOptions {
  timeout?: number; // 최대 대기 시간 (ms)
}

class IdleScheduler {
  private queue: IdleCallback[] = [];
  private isProcessing = false;

  /**
   * Idle 시간에 콜백 실행 예약
   */
  schedule(callback: IdleCallback, options: IdleSchedulerOptions = {}) {
    this.queue.push(callback);
    this.processQueue(options);
  }

  private processQueue(options: IdleSchedulerOptions) {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    const processNext = (deadline?: IdleDeadline) => {
      while (
        this.queue.length > 0 &&
        (deadline ? deadline.timeRemaining() > 0 : true)
      ) {
        const callback = this.queue.shift();
        if (callback) {
          try {
            callback();
          } catch (error) {
            console.error("[IdleScheduler] Task failed:", error);
          }
        }
      }

      if (this.queue.length > 0) {
        this.requestIdle(processNext, options);
      } else {
        this.isProcessing = false;
      }
    };

    this.requestIdle(processNext, options);
  }

  private requestIdle(
    callback: (deadline?: IdleDeadline) => void,
    options: IdleSchedulerOptions,
  ) {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(callback, { timeout: options.timeout || 1000 });
    } else {
      // Fallback: setTimeout
      setTimeout(() => callback(), 1);
    }
  }

  /** 대기 중인 작업 수 */
  get pendingCount(): number {
    return this.queue.length;
  }

  /** 모든 대기 작업 취소 */
  clear() {
    this.queue = [];
    this.isProcessing = false;
  }
}

export const idleScheduler = new IdleScheduler();
```

---

## 6. 구현 파일 목록

### 6.1 신규 생성 파일

| 파일 경로                                                    | 용도                      | Phase   |
| ------------------------------------------------------------ | ------------------------- | ------- |
| `src/builder/panels/core/hooks/useLazyPanel.ts`              | 조건부 패널 마운트        | Phase 1 |
| `src/builder/panels/core/hooks/usePanelLifecycle.ts`         | 패널 생명주기 관리        | Phase 1 |
| `src/builder/stores/selectors/panelSelectors.ts`             | 최적화된 Zustand selector | Phase 2 |
| `src/builder/providers/QueryProvider.tsx`                    | React Query 설정          | Phase 2 |
| `src/builder/panels/data/hooks/useDataTableQuery.ts`         | DataTable Query 래퍼      | Phase 2 |
| `src/builder/utils/CircularBuffer.ts`                        | 순환 버퍼                 | Phase 3 |
| `src/builder/utils/performanceMonitor.ts`                    | 성능 모니터링             | Phase 4 |
| `src/builder/utils/idleScheduler.ts`                         | Idle 작업 스케줄러        | Phase 4 |
| `src/builder/panels/navigator/components/VirtualElementList.tsx` | 가상 스크롤 목록          | Phase 3 |

### 6.2 수정 파일

| 파일                                                 | 변경 내용                                            | Phase      |
| ---------------------------------------------------- | ---------------------------------------------------- | ---------- |
| `src/builder/panels/monitor/MonitorPanel.tsx`        | Gateway 패턴, enabled 파라미터                       | Phase 1, 3 |
| `src/builder/panels/monitor/hooks/useMemoryStats.ts` | enabled 추가, CircularBuffer                         | Phase 3    |
| `src/builder/panels/monitor/hooks/useWebVitals.ts`   | enabled 파라미터 추가                                | Phase 3    |
| `src/builder/panels/datatable/DataTablePanel.tsx`    | Gateway 패턴, React Query                            | Phase 1, 2 |
| `src/builder/panels/navigator/NavigatorPanel.tsx`            | ✅ Virtual Scrolling 이미 적용 (Gateway 패턴만 검토) | Phase 1    |
| `src/builder/panels/properties/PropertiesPanel.tsx`  | Gateway 패턴, selector 최적화                        | Phase 1, 2 |
| `src/builder/panels/styles/StylesPanel.tsx`          | Gateway 패턴                                         | Phase 1    |
| `src/builder/panels/events/EventsPanel.tsx`          | Gateway 패턴                                         | Phase 1    |
| `src/builder/panels/components/ComponentsPanel.tsx`  | Gateway 패턴                                         | Phase 1    |
| `src/main.tsx` or `src/App.tsx`                      | QueryProvider 추가                                   | Phase 2    |

---

## 7. 외부 라이브러리 도입 제안

### 7.1 필수 도입: @tanstack/react-query

| 항목            | 내용                    |
| --------------- | ----------------------- |
| **라이브러리**  | `@tanstack/react-query` |
| **버전**        | `^5.x`                  |
| **번들 사이즈** | ~13KB (gzip)            |

#### 도입 이유

1. **DataTablePanel의 4개 API 중복 호출 문제 해결**
   - 현재: 탭 전환마다 4개 API 호출
   - 변경: staleTime 기반 캐싱으로 중복 요청 제거

2. **서버 상태와 클라이언트 상태 분리**
   - Zustand: UI 상태 (selectedElement, isActive 등)
   - React Query: 서버 상태 (DataTable, API Endpoints 등)

#### 타당한 근거

1. **기존 생태계 호환**
   - 이미 사용 중: `@tanstack/react-table`, `@tanstack/react-virtual`
   - TanStack 생태계 일관성 유지

2. **Zustand와 완벽 호환**
   - React Query는 서버 상태만 담당
   - Zustand는 클라이언트 상태만 담당
   - 역할 분리로 코드 명확성 향상

3. **검증된 솔루션**
   - npm 주간 다운로드: 3M+
   - GitHub Stars: 40k+
   - 대규모 프로덕션 환경에서 검증됨

#### 기대 효과

| 지표                | Before         | After          | 개선율        |
| ------------------- | -------------- | -------------- | ------------- |
| 탭 전환 시 API 호출 | 4회            | 0회 (캐시 hit) | **100%↓**     |
| 네트워크 요청       | 매번 발생      | 5분 캐시       | **90%↓**      |
| 메모리 (서버 상태)  | Zustand에 혼재 | 자동 GC        | **자동 관리** |
| 에러 처리           | 수동 구현      | 자동 재시도    | **내장**      |

#### 설치 명령어

```bash
npm install @tanstack/react-query
# 개발 도구 (선택)
npm install -D @tanstack/react-query-devtools
```

---

### 7.2 이미 설치된 라이브러리 활용

| 라이브러리                | 현재 사용 | 최적화 활용              |
| ------------------------- | --------- | ------------------------ |
| `@tanstack/react-virtual` | ✅ 설치됨 | NavigatorPanel 가상 스크롤링 |
| `immer`                   | ✅ 설치됨 | Zustand 불변 업데이트    |
| `lodash`                  | ✅ 설치됨 | debounce, throttle       |
| `zustand`                 | ✅ 설치됨 | shallow 비교 활용        |

---

### 7.3 React 내장 기능 활용 (추가 설치 불필요)

| 기능                      | 용도                               |
| ------------------------- | ---------------------------------- |
| `scheduler`               | requestIdleCallback 기반 Idle 작업 |
| `React.lazy` + `Suspense` | 패널 Lazy Loading                  |
| `useSyncExternalStore`    | Zustand tearing 방지               |
| `useTransition`           | 비긴급 업데이트 defer              |

---

### 7.4 도입하지 않는 라이브러리

| 라이브러리     | 이유                                   |
| -------------- | -------------------------------------- |
| `react-window` | `@tanstack/react-virtual` 이미 사용 중 |
| `reselect`     | Zustand selector로 충분                |
| `swr`          | React Query가 더 적합 (복잡한 캐싱)    |
| `jotai`        | Zustand 마이그레이션 비용 큼           |
| `mobx`         | 현재 아키텍처와 맞지 않음              |

---

## 8. 기대 효과

### 8.1 성능 지표 개선

| 지표                          | Before            | After         | 개선율    |
| ----------------------------- | ----------------- | ------------- | --------- |
| **초기 로딩 시간**            | ~800ms            | ~400ms        | **50%↓**  |
| **12시간 후 메모리**          | ~500MB+           | ~150MB        | **70%↓**  |
| **탭 전환 응답**              | ~200ms            | ~50ms         | **75%↓**  |
| **Long Task 빈도**            | 10+/분            | 1-2/분        | **80%↓**  |
| **API 호출 횟수 (DataTable)** | 매번 4개          | 캐시 hit 시 0 | **90%↓**  |
| **비활성 패널 리렌더**        | 모든 상태 변경 시 | 0회           | **100%↓** |

### 8.2 메모리 사용량 시뮬레이션

```
시간 경과에 따른 메모리 사용량 (예상)

Before (최적화 전):
┌──────────────────────────────────────────────────────────────┐
│ 500MB │                                              ▲       │
│       │                                         ▲────┘       │
│ 400MB │                                    ▲────┘            │
│       │                               ▲────┘                 │
│ 300MB │                          ▲────┘                      │
│       │                     ▲────┘                           │
│ 200MB │                ▲────┘                                │
│       │           ▲────┘                                     │
│ 100MB │      ▲────┘                                          │
│       │ ▲────┘                                               │
│   0MB │──────────────────────────────────────────────────────│
│       0h    2h    4h    6h    8h    10h   12h                │
└──────────────────────────────────────────────────────────────┘

After (최적화 후):
┌──────────────────────────────────────────────────────────────┐
│ 500MB │                                                      │
│       │                                                      │
│ 400MB │                                                      │
│       │                                                      │
│ 300MB │                                                      │
│       │                                                      │
│ 200MB │                                                      │
│       │     ▲─────────────────────────────────────────       │
│ 100MB │ ▲───┘  (안정적 유지)                                  │
│       │                                                      │
│   0MB │──────────────────────────────────────────────────────│
│       0h    2h    4h    6h    8h    10h   12h                │
└──────────────────────────────────────────────────────────────┘
```

### 8.3 사용자 경험 개선

| 시나리오          | Before               | After                  |
| ----------------- | -------------------- | ---------------------- |
| 패널 탭 빠른 전환 | 매번 API 호출 → 로딩 | 캐시 hit → 즉시 표시   |
| 장시간 작업       | 점점 느려짐          | 일관된 성능            |
| 대량 요소 편집    | 스크롤 버벅임        | 가상 스크롤로 부드러움 |
| 백그라운드 패널   | 리소스 낭비          | 완전히 비활성화        |

---

## 9. 구현 순서

### 9.1 의존성 그래프

```
Phase 1: Panel Gateway
    │
    ├── useLazyPanel.ts
    ├── usePanelLifecycle.ts
    └── 패널 Gateway 패턴 적용 (7개 패널)
         │
         ▼
Phase 2: React Query 도입
    │
    ├── @tanstack/react-query 설치
    ├── QueryProvider.tsx
    ├── useDataTableQuery.ts
    └── DataTablePanel 적용
         │
         ▼
Phase 3: Resource Management
    │
    ├── CircularBuffer.ts
    ├── useMemoryStats.ts 수정
    ├── useWebVitals.ts 수정
    └── VirtualElementList.tsx
         │
         ▼
Phase 4: Performance Monitor
    │
    ├── performanceMonitor.ts
    ├── idleScheduler.ts
    └── 자동 복구 로직
         │
         ▼
Phase 5: 테스트 & 검증
    │
    ├── 단위 테스트 작성
    ├── 성능 프로파일링
    └── 12시간 장기 테스트
```

### 9.2 상세 일정

| Phase       | 작업                                 | 예상 시간 |
| ----------- | ------------------------------------ | --------- |
| **Phase 1** | Panel Gateway 패턴                   | -         |
| 1.1         | useLazyPanel, usePanelLifecycle 구현 | -         |
| 1.2         | MonitorPanel Gateway 적용            | -         |
| 1.3         | 나머지 6개 패널 Gateway 적용         | -         |
| **Phase 2** | React Query 도입                     | -         |
| 2.1         | @tanstack/react-query 설치           | -         |
| 2.2         | QueryProvider 설정                   | -         |
| 2.3         | DataTablePanel Query 적용            | -         |
| 2.4         | panelSelectors.ts 구현               | -         |
| **Phase 3** | Resource Management                  | -         |
| 3.1         | CircularBuffer 구현                  | -         |
| 3.2         | useMemoryStats 최적화                | -         |
| 3.3         | VirtualElementList 구현              | -         |
| **Phase 4** | Performance Monitor                  | -         |
| 4.1         | performanceMonitor 구현              | -         |
| 4.2         | idleScheduler 구현                   | -         |
| **Phase 5** | 테스트 & 검증                        | -         |

---

## 10. 부록: 코드 예시

### 10.1 최적화된 패널 구조 (완성형)

```tsx
// src/builder/panels/monitor/MonitorPanel.tsx

import { PanelProps } from "../core/types";

/**
 * MonitorPanel - Gateway Component
 *
 * ✅ isActive 체크를 먼저 수행
 * ✅ Content는 조건부 마운트
 */
export function MonitorPanel({ isActive }: PanelProps) {
  // 1단계: isActive 체크 (Hook 호출 전!)
  if (!isActive) {
    return null;
  }

  // 2단계: Content 마운트
  return <MonitorPanelContent />;
}

// src/builder/panels/monitor/MonitorPanelContent.tsx

import { useState, useCallback } from "react";
import { useMemoryStats } from "./hooks/useMemoryStats";
import { useFPSMonitor } from "./hooks/useFPSMonitor";
import { useWebVitals } from "./hooks/useWebVitals";
import { usePanelLifecycle } from "../core/hooks/usePanelLifecycle";

/**
 * MonitorPanelContent - 실제 로직 담당
 *
 * ✅ Hook은 여기서만 호출 (isActive=true 보장)
 * ✅ 모든 모니터링 Hook에 enabled 파라미터 전달
 */
function MonitorPanelContent() {
  const [activeTab, setActiveTab] = useState<string>("memory");

  // ✅ enabled 파라미터로 조건부 실행
  const { stats, history, optimize, isOptimizing } = useMemoryStats({
    enabled: true, // 이미 isActive=true인 상태
  });

  const { fps } = useFPSMonitor({
    enabled: activeTab === "realtime",
  });

  const { vitals, collectLocalVitals } = useWebVitals({
    enabled: activeTab === "realtime",
  });

  // 생명주기 관리
  usePanelLifecycle({
    isActive: true,
    panelId: "monitor",
    onActivate: () => console.log("[Monitor] Activated"),
    onDeactivate: () => console.log("[Monitor] Deactivated"),
  });

  return <div className="monitor-panel">{/* ... UI 렌더링 */}</div>;
}
```

### 10.2 React Query 적용 예시 (DataTablePanel)

```tsx
// src/builder/panels/datatable/DataTablePanel.tsx

import { PanelProps } from "../core/types";

export function DataTablePanel({ isActive }: PanelProps) {
  if (!isActive) {
    return null;
  }

  return <DataTablePanelContent />;
}

// src/builder/panels/datatable/DataTablePanelContent.tsx

import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useDataTablesQuery,
  useApiEndpointsQuery,
  useVariablesQuery,
  useTransformersQuery,
} from "./hooks/useDataTableQuery";

function DataTablePanelContent() {
  const { projectId } = useParams<{ projectId: string }>();
  const [activeTab, setActiveTab] = useState<DataTableTab>("tables");

  // ✅ React Query 사용 - 탭별 조건부 fetch
  const { data: dataTables, isLoading: tablesLoading } = useDataTablesQuery(
    projectId || "",
    activeTab === "tables", // tables 탭일 때만 fetch
  );

  const { data: endpoints, isLoading: endpointsLoading } = useApiEndpointsQuery(
    projectId || "",
    activeTab === "endpoints", // endpoints 탭일 때만 fetch
  );

  const { data: variables, isLoading: variablesLoading } = useVariablesQuery(
    projectId || "",
    activeTab === "variables",
  );

  const { data: transformers, isLoading: transformersLoading } =
    useTransformersQuery(projectId || "", activeTab === "transformers");

  // 현재 탭의 로딩 상태
  const isLoading = {
    tables: tablesLoading,
    endpoints: endpointsLoading,
    variables: variablesLoading,
    transformers: transformersLoading,
  }[activeTab];

  return (
    <div className="datatable-panel">
      {/* Tab Bar */}
      <div className="panel-tabs">{/* ... 탭 버튼들 */}</div>

      {/* Content */}
      <div className="panel-contents">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {activeTab === "tables" && <DataTableList data={dataTables} />}
            {activeTab === "endpoints" && <ApiEndpointList data={endpoints} />}
            {activeTab === "variables" && <VariableList data={variables} />}
            {activeTab === "transformers" && (
              <TransformerList data={transformers} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

---

## 변경 이력

| 날짜       | 버전 | 변경 내용 |
| ---------- | ---- | --------- |
| 2025-12-09 | 1.0  | 초안 작성 |

---

## 관련 문서

- [CLAUDE.md](../../../CLAUDE.md) - 프로젝트 전체 가이드
- [COMPLETED_FEATURES.md](../../reference/status/COMPLETED.md) - 완료된 기능 목록
- [PLANNED_FEATURES.md](../../reference/status/PLANNED.md) - 계획된 기능 목록
