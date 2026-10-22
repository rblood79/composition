import type { CatalogToastPlacement } from "../document/types";

import { CatalogPreviewInteractions } from "./catalogPreviewInteractions";

import { CatalogPreviewSession } from "./catalogPreviewSession";

import type { CatalogCompositionRoot } from "./compositionRoot";

import type { CatalogThemeState } from "./theme";
/** The theme as the DOM reads it: CSS variables (light + dark blocks), color mode, base type. */
export function applyCatalogPreviewTheme(state: CatalogThemeState): void {
  const snapshot = state.snapshot();
  let style = document.getElementById(
    "runtime-theme-vars",
  ) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "runtime-theme-vars";
    document.head.appendChild(style);
  }
  const block = (selector: string, dark: boolean) =>
    `${selector} {\n${snapshot.cssVars
      .filter((cssVar) => cssVar.isDark === dark)
      .map((cssVar) => `  ${cssVar.name}: ${cssVar.value};`)
      .join("\n")}\n}\n`;
  style.textContent =
    block(":root", false) + block('[data-theme="dark"]', true);
  document.documentElement.setAttribute("data-theme", state.colorMode);
  for (const element of [document.documentElement, document.body]) {
    element.style.fontFamily = snapshot.base.fontFamily;
    element.style.fontSize = `${snapshot.base.fontSize}px`;
    element.style.lineHeight = String(snapshot.base.lineHeight);
  }
  document.body.style.color = "var(--fg)";
  document.body.style.backgroundColor = "var(--bg)";
}

const roots = new WeakMap<CatalogCompositionRoot, number>();

let rootCount = 0;

/** A new root (a snapshot, a theme change) mounts a new tree: its records are new objects. */
export const rootKey = (root: CatalogCompositionRoot) => {
  let key = roots.get(root);
  if (key === undefined) roots.set(root, (key = ++rootCount));
  return key;
};

/**
 * S2 1.8.0 `ToastPlacement` → the toast region's place (`end` is the right of a left-to-right
 * page). Absent = `bottom end` — the region's place before the project chose one.
 */
export function catalogToastPosition(
  placement: CatalogToastPlacement | undefined,
): "top-center" | "top-right" | "bottom-center" | "bottom-right" {
  switch (placement) {
    case "top":
      return "top-center";
    case "top end":
      return "top-right";
    case "bottom":
      return "bottom-center";
    default:
      return "bottom-right";
  }
}

/** The session's rule runtime (rules · capability overrides · toasts · navigation by route). */
export function catalogPreviewRuntime(
  session: CatalogPreviewSession,
  toast: { show: (message: string) => void },
): CatalogPreviewInteractions {
  return new CatalogPreviewInteractions({
    graph: () => session.graph,
    root: () => session.root,
    subscribe: session.subscribe,
    navigate: (pageId) => session.navigate(pageId),
    navigateTo: (path) => session.navigateTo(path),
    showToast: (message) => toast.show(message),
    writeState: session.writeState,
    ownerRecord: (recordId, ownerId) => session.ownerRecord(recordId, ownerId),
    sortTable: (tableId, sort) => session.sortTable(tableId, sort),
    colorScheme: (mode) => session.setColorScheme(mode),
    submitEndpoint: (endpointId, body) =>
      session.dataServices.apiEndpointService?.submitApiEndpoint?.(
        endpointId,
        body,
      ) ?? Promise.reject(new Error("endpoint 제출 서비스 없음")),
    append: (collectionId, value) => session.append(collectionId, value),
    update: (collectionId, key, value) => session.update(collectionId, key, value),
    remove: (collectionId, keys) => session.remove(collectionId, keys),
  });
}

/**
 * An internal link (`/route`) moves the Preview to that page; an external one opens a new tab;
 * `#anchor` and `target="_blank"` keep the browser's behavior (the old Preview's rule).
 */
export function catalogPreviewLinkClick(
  session: CatalogPreviewSession,
): (event: MouseEvent) => void {
  return (event) => {
    const anchor = (event.target as Element | null)?.closest?.("a");
    const href = anchor?.getAttribute("href");
    if (!anchor || !href || href.startsWith("#")) return;
    if (anchor.getAttribute("target") === "_blank") return;
    event.preventDefault();
    event.stopPropagation();
    if (/^(https?:\/\/|\/\/|mailto:|tel:|javascript:)/i.test(href)) {
      if (!/^javascript:/i.test(href))
        window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    session.navigateTo(href);
  };
}
