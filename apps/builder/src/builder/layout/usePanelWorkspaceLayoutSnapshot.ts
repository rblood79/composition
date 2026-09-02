import { useCallback, useSyncExternalStore } from "react";
import type { PanelId } from "../panels/core/types";
import type {
  PanelWorkspaceFrameSnapshot,
  PanelWorkspaceLayoutCoordinator,
  PanelWorkspaceLayoutSnapshot,
  PanelWorkspaceSplitterGeometry,
} from "./panelWorkspaceLayoutCoordinator";

export function usePanelWorkspaceLayoutSnapshot(
  coordinator: PanelWorkspaceLayoutCoordinator,
): PanelWorkspaceLayoutSnapshot {
  return useSyncExternalStore(
    coordinator.subscribe,
    coordinator.getSnapshot,
    coordinator.getSnapshot,
  );
}

/**
 * coordinator snapshot 에서 원시값 하나를 골라 구독한다. `read` 가 같은 값을 돌려주는
 * flush 에서는 호출한 컴포넌트가 다시 렌더되지 않는다 — snapshot 전체를 구독하면 매
 * flush 가 재렌더이므로, 루트가 아니라 leaf 가 필요한 값만 이 훅으로 읽는다.
 */
export function usePanelWorkspaceLayoutValue<
  T extends string | number | boolean | null,
>(coordinator: PanelWorkspaceLayoutCoordinator, read: () => T): T {
  return useSyncExternalStore(coordinator.subscribe, read, read);
}

// (coordinator, key) 별로 마지막에 돌려준 값. React 밖에 두는 이유 — getSnapshot 은 렌더 중
// 호출되므로 ref·클로저 변수를 여기서 고치면 react-hooks/immutability 위반이고, 같은 key 를
// 읽는 훅 인스턴스가 여럿이어도 같은 객체를 받는 편이 맞다. coordinator 가 수거되면 함께
// 사라진다. 사라진 key (숨겨진 패널·없어진 splitter) 의 항목은 남지만 값 하나짜리라 무시한다.
const selectorCache = new WeakMap<
  PanelWorkspaceLayoutCoordinator,
  Map<string, unknown>
>();

/**
 * snapshot 에서 파생한 객체를 값 비교로 구독한다. `read` 가 매번 새 객체를 돌려줘도 `equals`
 * 가 참이면 직전 객체를 그대로 돌려줘 (`useSyncExternalStore` 의 Object.is 비교를 통과시켜)
 * 재렌더를 막는다. `key` 는 같은 coordinator 안에서 이 선택을 식별한다.
 */
export function usePanelWorkspaceLayoutSelector<T>(
  coordinator: PanelWorkspaceLayoutCoordinator,
  key: string,
  read: () => T,
  equals: (previous: T, next: T) => boolean,
): T {
  const select = useCallback((): T => {
    let cache = selectorCache.get(coordinator);
    if (!cache) {
      cache = new Map();
      selectorCache.set(coordinator, cache);
    }
    const next = read();
    if (cache.has(key)) {
      const previous = cache.get(key) as T;
      if (equals(previous, next)) return previous;
    }
    cache.set(key, next);
    return next;
  }, [coordinator, equals, key, read]);
  return useSyncExternalStore(coordinator.subscribe, select, select);
}

function sameIds(a: readonly PanelId[], b: readonly PanelId[]): boolean {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

/**
 * 두 frame 이 화면에 같은 결과를 내는가. `layoutVersion` 은 비교하지 않는다 — coordinator
 * 는 flush 마다 모든 frame 객체를 새로 만들고 version 을 찍지만, 그 frame 을 그리는
 * 컴포넌트가 다시 렌더될 이유는 geometry·zone·cluster·resize edge 가 바뀌었을 때뿐이다.
 */
export function panelWorkspaceFrameSnapshotEquals(
  a: PanelWorkspaceFrameSnapshot,
  b: PanelWorkspaceFrameSnapshot,
): boolean {
  if (a === b) return true;
  if (
    a.x !== b.x ||
    a.y !== b.y ||
    a.width !== b.width ||
    a.height !== b.height ||
    a.clusterId !== b.clusterId ||
    a.placementZone !== b.placementZone ||
    a.resizeEdges.length !== b.resizeEdges.length
  ) {
    return false;
  }
  for (let index = 0; index < a.resizeEdges.length; index += 1) {
    if (a.resizeEdges[index] !== b.resizeEdges[index]) return false;
  }
  return true;
}

/** 두 cluster splitter 가 화면에 같은 결과를 내는가. frame 과 같은 이유로 `layoutVersion` 제외. */
export function panelWorkspaceSplitterGeometryEquals(
  a: PanelWorkspaceSplitterGeometry,
  b: PanelWorkspaceSplitterGeometry,
): boolean {
  if (a === b) return true;
  return (
    a.id === b.id &&
    a.kind === b.kind &&
    a.orientation === b.orientation &&
    a.clusterId === b.clusterId &&
    a.columnId === b.columnId &&
    a.geometry.x === b.geometry.x &&
    a.geometry.y === b.geometry.y &&
    a.geometry.width === b.geometry.width &&
    a.geometry.height === b.geometry.height &&
    sameIds(a.beforePanelIds, b.beforePanelIds) &&
    sameIds(a.afterPanelIds, b.afterPanelIds)
  );
}

function nullableFrameEquals(
  a: PanelWorkspaceFrameSnapshot | null,
  b: PanelWorkspaceFrameSnapshot | null,
): boolean {
  return (
    a === b ||
    (a !== null && b !== null && panelWorkspaceFrameSnapshotEquals(a, b))
  );
}

/**
 * 패널 하나의 frame 을 구독한다. 새 snapshot 의 frame 이 직전과 화면상 같으면 직전 객체를
 * 그대로 돌려줘 재렌더를 막는다. 그래서 돌려준 frame 의 `layoutVersion` 은 "이 frame 이
 * 마지막으로 바뀐 flush 의 version" 이지 최신 snapshot version 이 아니다 — 최신 version 은
 * `getSnapshot().version` 으로 읽는다.
 */
export function usePanelWorkspaceFrameSnapshot(
  coordinator: PanelWorkspaceLayoutCoordinator,
  panelId: PanelId,
): PanelWorkspaceFrameSnapshot | null {
  const read = useCallback(
    () => coordinator.getSnapshot().frameGeometries.get(panelId) ?? null,
    [coordinator, panelId],
  );
  return usePanelWorkspaceLayoutSelector(
    coordinator,
    `frame:${panelId}`,
    read,
    nullableFrameEquals,
  );
}
