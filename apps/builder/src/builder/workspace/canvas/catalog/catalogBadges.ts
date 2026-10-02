import { catalogCollectionId } from "../../../catalogRuntime/dataBinding";
import { resolveCollectionBadgeStatus } from "../../../panels/datatable/utils/collectionBadgeStatus";
import type {
  ApiEndpoint,
  ApiRunRecord,
  DataTable,
} from "../../../../types/builder/data.types";
import type { DataBadgeBounds } from "../skia/bindingBadgeRenderer";
import type {
  BindingBadgeInfo,
  BindingBadgeTarget,
} from "../skia/overlayTypes";
import { intersectBoxes, type BoundingBox } from "../selection/types";

export interface CatalogBadgeData {
  collections: ReadonlyMap<string, DataTable>;
  apiEndpoints: ReadonlyMap<string, ApiEndpoint>;
  apiRuns: ReadonlyMap<string, ApiRunRecord>;
}

export interface CatalogBadgeInputs {
  data: () => CatalogBadgeData;
  /** Committed nodes bound to a collection reference (the graph's collection index). */
  bindingsOf: (collectionRef: string) => ReadonlySet<string>;
  /** The drawn records of a node. */
  recordsOf: (sourceId: string) => readonly string[];
}

/**
 * ADR-248 Phase 4e: the data binding badges (ADR-212 Phase 6) over the catalog document — each
 * drawn record of a node bound to a data collection gets the collection's badge at its top left,
 * clipped to what its ancestors show. The collection's state is the Data panel list's
 * (`resolveCollectionBadgeStatus`); it is worked out again only when the data store's maps change.
 */
export function createCatalogBadges(inputs: CatalogBadgeInputs) {
  let cache:
    | {
        data: CatalogBadgeData;
        endpoints: ApiEndpoint[];
        infos: Map<string, BindingBadgeInfo>;
      }
    | undefined;
  const infoOf = (data: CatalogBadgeData, table: DataTable) => {
    if (
      !cache ||
      cache.data.collections !== data.collections ||
      cache.data.apiEndpoints !== data.apiEndpoints ||
      cache.data.apiRuns !== data.apiRuns
    )
      cache = {
        data,
        endpoints: Array.from(data.apiEndpoints.values()),
        infos: new Map(),
      };
    let info = cache.infos.get(table.id);
    if (!info) {
      info = {
        collectionId: table.id,
        name: table.name,
        state: resolveCollectionBadgeStatus(
          table,
          cache.endpoints,
          data.apiRuns,
        ).state,
      };
      cache.infos.set(table.id, info);
    }
    return info;
  };
  return {
    targets(
      bounds: ReadonlyMap<string, BoundingBox>,
      visible: ReadonlyMap<string, BoundingBox>,
    ): BindingBadgeTarget[] {
      const data = inputs.data();
      const out: BindingBadgeTarget[] = [];
      for (const table of data.collections.values()) {
        const nodes = inputs.bindingsOf(catalogCollectionId(table.id));
        if (!nodes.size) continue;
        for (const node of nodes)
          for (const record of inputs.recordsOf(node)) {
            const box = bounds.get(record);
            const shown = visible.get(record);
            const clipped = box && shown ? intersectBoxes(box, shown) : null;
            if (clipped)
              out.push({
                ...infoOf(data, table),
                bounds: clipped,
                pageId: null,
              });
          }
      }
      return out;
    },
  };
}

/** The badge under a scene point (the last drawn wins). */
export function catalogBadgeAt(
  badges: ReadonlyMap<string, DataBadgeBounds>,
  point: { x: number; y: number },
): DataBadgeBounds | undefined {
  let found: DataBadgeBounds | undefined;
  for (const badge of badges.values())
    if (
      point.x >= badge.x &&
      point.x <= badge.x + badge.width &&
      point.y >= badge.y &&
      point.y <= badge.y + badge.height
    )
      found = badge;
  return found;
}
