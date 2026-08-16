/**
 * Builder Hooks - Barrel Export
 *
 * 모든 빌더 관련 훅들을 통합 export
 * @since 2025-12-28 Phase 1.3
 */

// Async Operations
export { useAsyncAction } from "./useAsyncAction";
export { useAsyncData } from "./useAsyncData";
export { useAsyncMutation } from "./useAsyncMutation";
export { useAsyncQuery } from "./useAsyncQuery";

// Data Management
// ADR-132 단일 경유: collection items read 의 정본은 `@composition/shared` 의
// `useCollectionData` / `collectionDataCache` 다. builder 미러는 소비처 0건이었고,
// 배럴이 **빈 캐시 싱글톤**을 공개 API 로 광고하던 상태라 표면을 걷어낸다 —
// 그 이름으로 import 하면 이름·타입은 정상인 채 영원히 비어 있는 Map 을 받고
// `invalidate()` 가 실제 캐시에 no-op 이 된다 (모듈 스코프 인스턴스 분리).
export { useCollectionItemManager } from "./useCollectionItemManager";
// ADR-912 후속 cleanup: useColumnLoader export 제거 — 외부 호출 0건 dead.
export { dataQueryKeys, useDataPanelQuery } from "./useDataQueries";

// Element & Page
export { useElementCreator } from "./useElementCreator";
export { usePageLoader, useAdjacentPagePreload } from "./usePageLoader";
export { usePageManager } from "./usePageManager";

// Component & Layout (Phase 2 승격)
export { useComponentMeta } from "./useComponentMeta";
export { usePanelLayout } from "./usePanelLayout";

// UI State
export { useCopyPaste } from "./useCopyPaste";
export { useFavoriteComponents } from "./useFavoriteComponents";
export { useRecentComponents } from "./useRecentComponents";
export { useRecentSearches } from "./useRecentSearches";
export { useTreeExpandState } from "./useTreeExpandState";
export { useTreeKeyboardNavigation } from "./useTreeKeyboardNavigation";

// Keyboard & Input
export { useActiveScope, useActiveScopeState } from "./useActiveScope";
export { useGlobalKeyboardShortcuts } from "./useGlobalKeyboardShortcuts";
export {
  useKeyboardShortcutsRegistry,
  formatShortcut,
} from "./useKeyboardShortcutsRegistry";
export type {
  KeyboardModifier,
  ShortcutCategory,
} from "./useKeyboardShortcutsRegistry";

// Messaging & Communication
// ADR-912 후속 cleanup: useDeltaMessenger export 제거 — 외부 호출 0건 dead
//   (live messenger 는 canvasDeltaMessenger, utils/).
export { useIframeMessenger } from "./useIframeMessenger";
export { useThemeMessenger } from "./useThemeMessenger";

// Performance & Monitoring
export { usePerformanceMonitor } from "./usePerformanceMonitor";
export { usePerformanceStats } from "./usePerformanceStats";
export { useRAFThrottle } from "./useRAFThrottle";

// Error Handling & Recovery
export { useAutoRecovery } from "./useAutoRecovery";
export { useErrorHandler } from "./useErrorHandler";

// Utilities
export { useInitialMountDetection } from "./useInitialMountDetection";
export { useToast } from "./useToast";
export type { Toast, ToastType } from "./useToast";
