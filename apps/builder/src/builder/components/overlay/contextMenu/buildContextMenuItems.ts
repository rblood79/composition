import type {
  ContextMenuDeps,
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

export function buildContextMenuItems(
  request: ContextMenuRequest,
  deps: ContextMenuDeps = {},
) {
  const overriddenItems = deps.modeOverride?.(request);
  if (overriddenItems !== null && overriddenItems !== undefined) {
    return overriddenItems;
  }

  return contextMenuProviders.get(request.surface)?.(request, deps) ?? [];
}
