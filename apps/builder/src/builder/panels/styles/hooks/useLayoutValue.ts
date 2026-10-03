/**
 * 선택 요소의 레이아웃 결과 (폭 · 높이 · 위치) — composition root 의 엔진 기하 (ADR-248).
 *
 * 옛 구현은 `fullTreeLayout` 의 공유 layout map 을 읽었지만, catalog 경로는 그 맵을 채우지 않는다
 * (parity 하니스 전용 — `.claude/rules/layout-engine.md`). 그래서 Chart 예산 상태처럼 크기가 필요한
 * Properties 컨트롤이 늘 `undefined` 를 받았다. 지금은 `root.getGeometry` 를 읽고, step 과 root
 * 교체 (breakpoint · 프로젝트) 마다 다시 읽는다 — Styles host 의 `useLayoutValue` 와 같은 갱신 규칙.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useCatalogWorkspace } from "../../../catalogRuntime/react";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";

type LayoutKey = "width" | "height" | "x" | "y";

/** Re-read after every published step and breakpoint switch (layout and records follow them). */
export function useCatalogLayoutVersion(workspace: CatalogWorkspace): string {
  const subscribe = useCallback(
    (notify: () => void) => {
      const offSteps = workspace.runtime.subscribeSteps(notify);
      const offRoot = workspace.subscribeRoot(notify);
      return () => {
        offSteps();
        offRoot();
      };
    },
    [workspace],
  );
  return useSyncExternalStore(
    subscribe,
    () => `${workspace.runtime.graph.revision}:${workspace.root.breakpoint}`,
  );
}

/** `id` = the record identity (selection item's `identity`). */
export function useCatalogLayoutValue(
  workspace: CatalogWorkspace,
  id: string | null | undefined,
  key: LayoutKey,
): number | undefined {
  const version = useCatalogLayoutVersion(workspace);
  return useMemo(
    () => (id ? workspace.root.getGeometry([id]).get(id)?.[key] : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read per layout version
    [workspace, id, key, version],
  );
}

export function useLayoutValue(
  id: string | null | undefined,
  key: LayoutKey,
): number | undefined {
  return useCatalogLayoutValue(useCatalogWorkspace(), id, key);
}
