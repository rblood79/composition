import type { ReactNode } from "react";
import {
  useCatalogDocumentHead,
  type CatalogDocumentHeadSession,
} from "../../../../packages/shared/src/catalog/runtime/documentHead";

/**
 * The Preview's document language: the site language when the document sets one (ADR-286 —
 * with the site's title · description · favicon, as the published page has them), else the
 * browser's locale, as the published page has it (publish wraps no `I18nProvider` — RAC reads
 * `navigator.language` and follows `languagechange`) and as the Canvas root measures
 * (`locale: navigator.language`). A date field without its own `locale` so formats alike in the
 * Canvas, the Preview and the published page. The Builder UI's language setting is the Builder's
 * chrome, not the document's (2026-10-07 — the Preview took it and drew date segments in en-US
 * beside a ko-KR Canvas).
 */
export function PreviewLocale({
  session,
  children,
}: {
  session?: CatalogDocumentHeadSession;
  children: ReactNode;
}) {
  // (No provider above: RAC's default locale.)
  useCatalogDocumentHead(session);
  return children;
}
