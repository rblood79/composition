/**
 * ADR-248 Phase 3 — the Builder's reusable origins as the one-time conversion input.
 *
 * Test entry only. Runs the production project seed (`createInitialProjectDocument`: the ListBox,
 * GridList and Menu item template ensurers, then `ensureReusableCompositeOrigins`, which calls
 * `catalogOrigins.ts` and the template ensurers) — the Components page a new project gets.
 * `Modal` is a registered reusable entry that fresh documents drop while no ref uses it, so its
 * origin comes from `buildCatalogOrigin("Modal")` directly.
 */
import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import { getReusableEntries } from "@composition/shared";
import { buildCatalogOrigin } from "../../../components/catalogOrigins";
import { createInitialProjectDocument } from "../../../../dashboard/createInitialProjectDocument";

export interface ReusableOriginSource {
  /** Every `reusable: true` node on the Components page, document order (+ direct Modal). */
  origins: CanonicalNode[];
  /** The registered reusable entries (catalog `kind: "reusable"`). */
  entries: { type: string; reusableId: string }[];
  directOriginIds: string[];
}

const childrenOf = (node: CanonicalNode): CanonicalNode[] =>
  Array.isArray(node.children) ? node.children : [];

export function buildReusableOriginSource(): ReusableOriginSource {
  const seeded: CompositionDocument = createInitialProjectDocument(
    { id: "page-home", title: "Home", slug: "/" },
    { id: "page-home-body", type: "body" },
  );
  const origins: CanonicalNode[] = [];
  const walk = (node: CanonicalNode, insideOrigin: boolean) => {
    if (node.reusable === true) {
      if (insideOrigin)
        throw new Error(`REUSABLE_ORIGIN_NESTED_IN_ORIGIN:${node.id}`);
      origins.push(node);
    }
    for (const child of childrenOf(node))
      walk(child, insideOrigin || node.reusable === true);
  };
  seeded.children.forEach((node) => walk(node, false));
  const entries = getReusableEntries().map((entry) => ({
    type: entry.type,
    reusableId: entry.reusableId,
  }));
  const present = new Set(origins.map((origin) => origin.id));
  const directOriginIds: string[] = [];
  for (const entry of entries) {
    if (present.has(entry.reusableId)) continue;
    if (entry.type !== "Modal")
      throw new Error(`REUSABLE_ORIGIN_MISSING:${entry.reusableId}`);
    const modal = buildCatalogOrigin("Modal");
    if (modal.id !== entry.reusableId)
      throw new Error(`REUSABLE_ORIGIN_ID_MISMATCH:${modal.id}`);
    origins.push(modal);
    directOriginIds.push(modal.id);
  }
  return { origins, entries, directOriginIds };
}
