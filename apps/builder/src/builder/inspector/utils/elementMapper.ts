import type { Element } from "../../../types/core/store.types";
import type { SelectedElement } from "../types";
import { getElementDataBinding } from "../../../adapters/canonical/compositionExtensionFields";

/**
 * Builder의 Element 타입을 Inspector의 SelectedElement 타입으로 변환
 */
export function mapElementToSelected(element: Element): SelectedElement {
  const { style, computedStyle, events: _events, ...otherProps } =
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

  // `events` projection 은 ADR-158 Phase 4 에서 삭제됐다 — 인터랙션 패널이
  // canonical root collection 을 직접 읽으므로 선택 스냅샷을 경유하지 않는다.

  return {
    id: selected.id,
    customId: selected.customId,
    type: selected.type,
    props: props as Element["props"],
    dataBinding: selected.dataBinding as Element["dataBinding"],
  };
}
