/**
 * @fileoverview ResolvedNode → canonical props helper — ADR-116 direct cutover.
 *
 * Resolver output consumers must read component payload from `ResolvedNode.props`
 * plus explicitly renderable composition extension fields only. Metadata is
 * reserved for page/import/debug annotations and adapter/export quarantine
 * payloads.
 */

import {
  getElementDataBinding,
  type DataBinding,
  type ResolvedNode,
} from "@composition/shared";

export function extractCanonicalPropsFromResolved(
  resolved: ResolvedNode,
): Record<string, unknown> {
  const props = resolved.props ? { ...resolved.props } : {};
  const dataBinding = getElementDataBinding(resolved, "extension-first") as
    | DataBinding
    | undefined;
  if (dataBinding !== undefined) {
    props.dataBinding = dataBinding;
    const staticCollectionData = readStaticCollectionData(dataBinding);
    if (staticCollectionData && staticCollectionData.length > 0) {
      if (
        (resolved.type === "Table" || resolved.type === "TableView") &&
        props.rows === undefined &&
        props.items === undefined
      ) {
        props.rows = staticCollectionData;
      } else if (props.items === undefined) {
        props.items = staticCollectionData;
      }
    }
  }
  return props;
}

function readStaticCollectionData(
  dataBinding: DataBinding,
): Record<string, unknown>[] | undefined {
  if (dataBinding.type !== "collection" || dataBinding.source !== "static") {
    return undefined;
  }
  const data = dataBinding.config?.data;
  if (!Array.isArray(data)) return undefined;
  return data.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}
