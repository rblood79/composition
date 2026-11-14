import { createElement, useContext, useMemo, type ReactNode } from "react";
import { FocusableContext } from "react-aria/private/interactions/useFocusable";

/**
 * RAC `PreviewTrigger` gives its trigger the long-press guard through `FocusableContext`
 * (`usePreviewTrigger` — `style: { WebkitTouchCallout: "none", WebkitUserDrag: "none" }`), and a RAC
 * Button · Link merges that context after its own props — so the guard replaced the trigger's whole
 * authored style in the DOM (2026-11-14 감사 — a Button's padding reached the Canvas only). The
 * context goes on without its `style`; the trigger is marked `data-preview-trigger` and the sheet
 * (`styles/overlays.css`) carries the guard.
 */
export function CatalogPreviewTriggerTarget({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const context = useContext(FocusableContext);
  const value = useMemo(() => {
    if (!context || !("style" in context)) return undefined;
    const { style: _guard, ...rest } = context;
    return { ...rest, "data-preview-trigger": "" } as typeof context;
  }, [context]);
  return value
    ? createElement(FocusableContext.Provider, { value }, children)
    : children;
}
