import type { Element } from "../../../types/core/store.types";
import type { SelectedElement } from "../types";
import { getElementDataBinding } from "../../../adapters/canonical/compositionExtensionFields";

/**
 * Builder의 Element 타입을 Inspector의 SelectedElement 타입으로 변환
 */
export function mapElementToSelected(element: Element): SelectedElement {
  const { style, computedStyle, events, ...otherProps } =
    element.props as Record<string, unknown>;

  return {
    id: element.id,
    customId: element.customId,
    type: element.type,
    properties: otherProps,
    // style이 없으면 빈 객체로 초기화 (undefined 방지)
    style: (style as React.CSSProperties) || {},
    computedStyle: computedStyle as Partial<React.CSSProperties> | undefined,
    semanticClasses: [],
    cssVariables: {},
    dataBinding: getElementDataBinding(element, "legacy-only"),
    events: (events as SelectedElement["events"]) || [],
  };
}

/**
 * Inspector의 변경사항을 Builder의 Element 업데이트 형식으로 변환
 */
export function mapSelectedToElementUpdate(
  selected: SelectedElement,
): Partial<Element> {
  const props: Record<string, unknown> = {
    ...selected.properties,
  };

  // style이 있으면 항상 포함 (빈 객체는 스타일 제거를 의미)
  if (selected.style !== undefined) {
    props.style = selected.style;
  }

  // events가 있으면 포함 (빈 배열은 모든 이벤트 제거를 의미)
  if (selected.events !== undefined) {
    props.events = selected.events;
  }

  return {
    id: selected.id,
    customId: selected.customId,
    type: selected.type,
    props: props as Element["props"],
    dataBinding: selected.dataBinding as Element["dataBinding"],
  };
}
