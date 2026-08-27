import type {
  ContextMenuDeps,
  ContextMenuItem,
  ContextMenuProvider,
  ContextMenuRequest,
  ContextMenuSurface,
} from "./types";

const contextMenuProviders = new Map<ContextMenuSurface, ContextMenuProvider>();

export function registerContextMenuProvider(
  surface: ContextMenuSurface,
  provider: ContextMenuProvider,
): () => void {
  contextMenuProviders.set(surface, provider);

  return () => {
    if (contextMenuProviders.get(surface) === provider) {
      contextMenuProviders.delete(surface);
    }
  };
}

/**
 * 빈 구간을 남기는 구분선을 걷어낸다 — 맨 앞/맨 뒤/연속.
 *
 * provider 는 섹션마다 조건부로 항목을 만드는데, 어떤 선택에서 한 섹션이
 * 통째로 비면 그 앞뒤 구분선이 맞붙어 빈 칸을 사이에 둔 줄이 두 개 그려진다
 * (실측: 단일 선택에서 group 이 빠지자 selection-separator 와
 * component-separator 가 연속. body 단독 선택은 그 전부터 같은 상태였다).
 * 조합마다 조건을 다는 대신 조립 지점에서 한 번 정리한다 — 두 소비 표면
 * (컨텍스트 메뉴 · 액션 바 ⋯) 이 같은 결과를 본다.
 */
export function dropEmptySeparators(
  items: readonly ContextMenuItem[],
): ContextMenuItem[] {
  const result: ContextMenuItem[] = [];
  for (const item of items) {
    if (item.kind !== "separator") {
      result.push(item);
      continue;
    }
    // 맨 앞이거나 직전이 구분선이면 버린다
    if (result.length === 0) continue;
    if (result[result.length - 1].kind === "separator") continue;
    result.push(item);
  }
  // 맨 뒤 구분선 제거 — 위 루프가 연속 구분선을 접었으므로 최대 1개다
  if (result.at(-1)?.kind === "separator") result.pop();
  return result;
}

export function buildContextMenuItems(
  request: ContextMenuRequest,
  deps: ContextMenuDeps = {},
) {
  const items =
    deps.modeOverride?.(request) ??
    contextMenuProviders.get(request.surface)?.(request, deps) ??
    [];
  return dropEmptySeparators(items);
}
