import { describe, expect, it } from "vitest";
import type { CatalogConsumerNode } from "../runtime/compositionRoot";
import { catalogCollectionHasItems } from "../runtime/presence";
import {
  CATALOG_EMPTY_STATE_COLLECTIONS,
  catalogIsEmptyState,
} from "../nesting/nestingRules";

/**
 * S2 체크리스트 부록 D.3 2단계 (2026-11-23) — S2 CardView · TableView `TableBody` `renderEmptyState`:
 * both take the IllustratedMessage child as their empty state, drawn while they hold no item — RAC's
 * `collection.size`, which a CardView's SkeletonCollection (its loading items) is not.
 */
const node = (
  id: string,
  type: string,
  children: string[] = [],
): CatalogConsumerNode & { type: string } =>
  ({
    id,
    type,
    children,
    props: {},
    parentId: "",
  }) as unknown as CatalogConsumerNode & { type: string };

describe("S2 D.3 — CardView · TableBody empty state", () => {
  it("CardView and Table are empty-state collections (IllustratedMessage) — a TableBody's children stay its rows", () => {
    expect(CATALOG_EMPTY_STATE_COLLECTIONS.has("CardView")).toBe(true);
    expect(CATALOG_EMPTY_STATE_COLLECTIONS.has("Table")).toBe(true);
    expect(CATALOG_EMPTY_STATE_COLLECTIONS.has("TableBody")).toBe(false);
    expect(catalogIsEmptyState("IllustratedMessage", "CardView")).toBe(true);
    expect(catalogIsEmptyState("IllustratedMessage", "Table")).toBe(true);
  });

  it("a Table has items when its body holds a Row (its header · footer are not items)", () => {
    const records = new Map(
      [
        node("table", "Table", ["header", "body", "empty"]),
        node("header", "TableHeader", ["column"]),
        node("column", "Column"),
        node("body", "TableBody"),
        node("empty", "IllustratedMessage"),
        node("filled", "TableBody", ["row"]),
        node("row", "Row"),
      ].map((record) => [record.id, record]),
    );
    const get = (id: string) => records.get(id);
    const typeOf = (record: CatalogConsumerNode) =>
      (record as CatalogConsumerNode & { type: string }).type;
    expect(catalogCollectionHasItems(records.get("table")!, get, typeOf)).toBe(
      false,
    );
    expect(
      catalogCollectionHasItems(
        node("table", "Table", ["header", "filled", "empty"]),
        get,
        typeOf,
      ),
    ).toBe(true);
  });

  it("a CardView with only its SkeletonCollection has no items; a Card is one", () => {
    const records = new Map(
      [
        node("view", "CardView", ["skeletons", "empty"]),
        node("skeletons", "SkeletonCollection", ["card-template"]),
        node("card-template", "Card"),
        node("empty", "IllustratedMessage"),
        node("card", "Card"),
      ].map((record) => [record.id, record]),
    );
    const get = (id: string) => records.get(id);
    const typeOf = (record: CatalogConsumerNode) =>
      (record as CatalogConsumerNode & { type: string }).type;
    expect(catalogCollectionHasItems(records.get("view")!, get, typeOf)).toBe(
      false,
    );
    const withCard = node("view", "CardView", ["skeletons", "empty", "card"]);
    expect(catalogCollectionHasItems(withCard, get, typeOf)).toBe(true);
  });
});
