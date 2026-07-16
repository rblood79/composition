/**
 * PanelNode → Element 변환 helper
 *
 * ADR-155 Phase 2: PropertiesPanel 모듈-로컬이던 변환을 분리 —
 * CanvasSelectionShortcuts host 와 PropertiesPanel 이 공유한다.
 * (컴포넌트 파일에서 함수 export 시 react-refresh 가 파일 단위로 무효화되는
 * 것을 피하기 위해 별도 파일)
 */

import type { PanelNode } from "../panelNode";
import type { Element } from "../../../types/core/store.types";

export function panelNodeToElement(node: PanelNode): Element {
  const {
    componentName,
    customId,
    metadata: _metadata,
    name: _name,
    ...rest
  } = node;
  return {
    ...rest,
    ...(customId != null ? { customId } : {}),
    ...(componentName != null ? { componentName } : {}),
  };
}

export function panelNodeMapToElementMap(
  nodesById: ReadonlyMap<string, PanelNode>,
): Map<string, Element> {
  return new Map(
    Array.from(nodesById.entries()).map(([id, node]) => [
      id,
      panelNodeToElement(node),
    ]),
  );
}
