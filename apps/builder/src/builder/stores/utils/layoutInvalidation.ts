/**
 * InspectorActions에서 top-level props 변경 시 레이아웃 재계산이 필요한 키.
 * 대부분의 스타일 변경은 `style` 객체 전체 갱신으로 들어오지만,
 * 일부 호출부는 개별 키를 직접 전달할 수 있어 padding/border 계열을 명시적으로 포함한다.
 */
export const LAYOUT_AFFECTING_PROP_KEYS = new Set([
  "style",
  "size",
  "layout",
  "columns",
  "label",
  "title",
  "description",
  "children",
  "text",
  "placeholder",
  "orientation",
  "items",
  "iconName",
  "iconPosition",
  "allowsRemoving",
  "maxRows",
  "value",
  "minValue",
  "maxValue",
  "variant",
  "granularity",
  "hourCycle",
  "locale",
  "calendar",
  "calendarSystem",
  "necessityIndicator",
  "isRequired",
  "labelPosition",
  "overflow",
  "formatOptions",
  "showValueLabel",
  "valueLabel",
  // Disclosure 확장 상태 (2026-07-14): 둘 다 자식 DisclosureContent 의 display:none 주입
  //   (applyImplicitStyles)을 좌우한다 → Inspector 편집 시 layoutVersion 이 올라야
  //   재레이아웃된다. allowsMultipleExpanded 는 그룹 노드 prop 이지만
  //   collectDirtyElementSubtree 가 자식까지 dirty 로 만들어 자식 Disclosure 도 갱신된다.
  "isExpanded",
  "allowsMultipleExpanded",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderWidth",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
]);

export interface LayoutInvalidationNode {
  readonly id: string;
}

export function collectDirtyElementSubtree(
  elementId: string,
  childrenMap: ReadonlyMap<string, readonly LayoutInvalidationNode[]>,
  dirtyIds: Set<string>,
): Set<string> {
  dirtyIds.add(elementId);

  const queue = [elementId];
  while (queue.length > 0) {
    const parentId = queue.pop()!;
    const children = childrenMap.get(parentId) ?? [];
    for (const child of children) {
      dirtyIds.add(child.id);
      queue.push(child.id);
    }
  }

  return dirtyIds;
}
