import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { buildCodeCatalogLibrary } from "../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  applyCatalogPreviewTheme,
  catalogPreviewLinkClick,
  catalogPreviewRuntime,
} from "../../../../../packages/shared/src/catalog/runtime/domView";
import {
  CATALOG_TOUCH_VIEW_ATTRIBUTE,
  CATALOG_TOUCH_VIEW_MESSAGE,
} from "../../../../../packages/shared/src/catalog/runtime/themeVarsCss";
import { CatalogPreviewToastBridge } from "../../../../../packages/shared/src/catalog/runtime/toastBridge";
import { NullLayoutEngine } from "../../builder/catalogRuntime/nullLayoutEngine";
import { catalogThemeState } from "../../builder/catalogRuntime/theme";
import { CatalogPreviewSession } from "./catalogPreviewSession";
import { registerCatalogPreviewWheel } from "./catalogPreviewWheel";

/**
 * Compare Mode: a click on an element in the Preview selects it on the Canvas (⌘ / Ctrl toggles
 * it in a multi-selection) — the old Preview's `ELEMENT_SELECTED`. The record's identity and
 * source go to the parent Builder, which maps them onto its own root.
 */
function catalogPreviewSelectClick(
  session: CatalogPreviewSession,
  post: (message: unknown) => void,
): (event: MouseEvent) => void {
  return (event) => {
    const element = (event.target as Element | null)?.closest?.(
      "[data-catalog-id]",
    );
    const identity = element?.getAttribute("data-catalog-id");
    if (!identity) return;
    const record = session.root?.domInputs.get(identity);
    if (!record) return;
    post({
      type: "CATALOG_SELECT",
      identity,
      sourceId: record.sourceId,
      additive: event.metaKey || event.ctrlKey,
    });
  };
}

/** 비활성 상태에서는 선택용 클릭 리스너와 메시지 전송 경로를 등록하지 않는다. */
function registerCatalogPreviewSelectClick(
  session: CatalogPreviewSession,
  post: (message: unknown) => void,
): (() => void) | undefined {
  if (!/^(true|1)$/i.test(import.meta.env.VITE_ENABLE_HITAREA_MODE ?? ""))
    return;
  const click = catalogPreviewSelectClick(session, post);
  document.addEventListener("click", click, true);
  return () => document.removeEventListener("click", click, true);
}

/**
 * ADR-248 4e-6: the Preview document of a catalog project (`preview.html?catalog=1`). Messages
 * are taken only from the parent Builder window of this origin; the document says it is ready
 * (`PREVIEW_READY`, the Builder's existing bootstrap check) and the Builder answers with a
 * snapshot and its page.
 */
async function startCatalogPreview(): Promise<void> {
  const library = await buildCodeCatalogLibrary();
  const origin = window.location.origin;
  const session = new CatalogPreviewSession(library, {
    requestSnapshot: (request) => window.parent.postMessage(request, origin),
    // ADR-284 Decision 11: the running values a filter's detail shows in the Builder.
    reportState: (values) =>
      window.parent.postMessage(
        { type: "CATALOG_STATE_VALUES", values },
        origin,
      ),
    engine: () => new NullLayoutEngine(),
    viewport: { width: window.innerWidth, height: window.innerHeight },
    locale: navigator.language,
    theme: catalogThemeState,
    applyTheme: applyCatalogPreviewTheme,
  });
  window.addEventListener("message", (event) => {
    if (event.origin !== origin || event.source !== window.parent) return;
    // ADR-295 사용자 결정 4: Builder 의 「터치 크기로 미리보기」 — root 가 터치 벌 (`catalogThemeVarsCss`) 을 쓴다
    if (
      (event.data as { type?: unknown } | null)?.type ===
      CATALOG_TOUCH_VIEW_MESSAGE
    ) {
      document.documentElement.toggleAttribute(
        CATALOG_TOUCH_VIEW_ATTRIBUTE,
        (event.data as { touch?: unknown }).touch === true,
      );
      return;
    }
    const receipt = session.receive(event.data);
    if (receipt.kind === "rejected")
      console.error("[CatalogPreview] payload rejected:", receipt.error);
  });
  const toast = new CatalogPreviewToastBridge();
  const runtime = catalogPreviewRuntime(session, toast);
  document.addEventListener("click", catalogPreviewLinkClick(session), true);
  registerCatalogPreviewSelectClick(session, (message) =>
    window.parent.postMessage(message, origin),
  );
  registerCatalogPreviewWheel();
  createRoot(document.body).render(
    createElement(CatalogPreviewApp, { session, runtime, toast }),
  );
  window.parent.postMessage({ type: "PREVIEW_READY" }, origin);
}

export {
  applyCatalogPreviewTheme,
  CatalogPreviewDataProvider,
  catalogPreviewLinkClick,
  catalogPreviewRuntime,
  CatalogPreviewView,
} from "../../../../../packages/shared/src/catalog/runtime/domView";
export {
  catalogPreviewSelectClick,
  registerCatalogPreviewSelectClick,
  startCatalogPreview,
};

import { CatalogPreviewApp } from "./catalogPreviewApp.components";
