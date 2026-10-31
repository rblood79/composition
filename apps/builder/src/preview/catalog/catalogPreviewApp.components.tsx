import {
  CatalogPreviewDataProvider,
  CatalogPreviewToasts,
  CatalogPreviewView,
  CatalogToastProvider,
  catalogPreviewRuntime,
} from "../../../../../packages/shared/src/catalog/runtime/domView";
import { CatalogPreviewToastBridge } from "../../../../../packages/shared/src/catalog/runtime/toastBridge";
import { PreviewLocale } from "../PreviewLocale";
import type { CatalogPreviewSession } from "./catalogPreviewSession";
export function CatalogPreviewApp({
  session,
  runtime,
  toast,
}: {
  session: CatalogPreviewSession;
  runtime: ReturnType<typeof catalogPreviewRuntime>;
  toast: CatalogPreviewToastBridge;
}) {
  return (
    <PreviewLocale session={session}>
      <CatalogToastProvider session={session} runtime={runtime}>
        <CatalogPreviewToasts toast={toast} />
        <CatalogPreviewDataProvider session={session}>
          <CatalogPreviewView session={session} runtime={runtime} />
        </CatalogPreviewDataProvider>
      </CatalogToastProvider>
    </PreviewLocale>
  );
}
