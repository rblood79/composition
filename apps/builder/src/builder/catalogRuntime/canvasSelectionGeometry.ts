import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";
import {
  OVERLAY_OPEN_OWNERS,
  OVERLAY_BODY_TYPES,
} from "../../../../../packages/shared/src/catalog/runtime/overlayState";

/** 선택 identity는 유지하고 열린 overlay의 표시·크기 조절 본체를 해석한다. */
export function catalogSelectionSurface(
  root: CatalogCompositionRoot,
  identity: string,
): string {
  const records = root.canvasInputs;
  const owner = records.get(identity);
  if (!owner || owner.hidden) return identity;
  const sheetViewport = owner.derivedProps?._sheetViewport === true;
  if (!sheetViewport && !OVERLAY_OPEN_OWNERS.has(root.typeOf(owner)))
    return identity;

  // 선택한 owner의 조립 경로만 읽는다. portal의 큰 본문/컬렉션과 중첩 owner는
  // 탐색하지 않으며, 최종 scene 상자는 소비 시점에 읽어 scroll/zoom/page 이동을 따른다.
  const find = (
    node: CatalogConsumerNode,
    sheet: boolean,
  ): string | undefined => {
    for (const id of node.children) {
      const child = records.get(id);
      if (!child || child.hidden) continue;
      const type = root.typeOf(child);
      if (sheet && type === "Sheet") return id;
      if (child.derivedProps?._overlayPortal === true) return id;
      if (child.derivedProps?._sheetViewport === true) return find(child, true);
      if (
        OVERLAY_OPEN_OWNERS.has(type) ||
        OVERLAY_BODY_TYPES.has(type) ||
        type === "SheetBackdrop"
      )
        continue;
      const surface = find(child, sheet);
      if (surface) return surface;
    }
    return undefined;
  };
  return find(owner, sheetViewport) ?? identity;
}
