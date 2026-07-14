/**
 * @fileoverview 정원형 leaf(ProgressCircle / Avatar) 의 stale inline width/height strip
 *   hydration migration (2026-07-14 — size 변경이 selection 영역에 미반영되던 버그).
 *
 * 배경: factory(`DisplayComponents.ts`)가 Avatar / ProgressCircle 에 `props.style.width/height`
 *   를 **32 숫자로 하드코딩**해 저장했다. 그러나 이 두 컴포넌트의 크기는 catalog
 *   `COMPONENT_RULES_TABLE.{Avatar,ProgressCircle}.sizes.{...}.height` 가 SSOT 다(정원형이라
 *   diameter = height).
 *
 *   inline 숫자가 있으면 `enrichWithIntrinsicSize` 가 `needsWidth/needsHeight = false` 로 판정해
 *   **early return** 하고(utils.ts), size→diameter 분기(`circleLeafDiameter`)가 아예 호출되지
 *   않는다 → size 를 sm/lg 로 바꿔도 layout bounds 가 factory 기본값 32 에 고정 →
 *   **selection 박스가 갱신되지 않고 CSS/Skia 양쪽 모두 크기가 안 변한다**
 *   (md 에서만 우연히 catalog 값과 일치해 정상으로 보였다).
 *
 *   factory 는 inline 을 제거했으나, **기존 직렬화 프로젝트의 element 는 inline 잔재를 보유**한다.
 *   본 migration 은 hydration 시점에 그 잔재를 strip 하여 크기 결정권을 catalog 로 되돌린다.
 *
 * **사용자 조정값 보존**: factory 기본값(32×32)과 **정확히 일치할 때만** strip 한다. 사용자가
 *   Style 패널에서 직접 조정한 크기(예: 48×48)는 의도된 override 이므로 보존 — 무조건 strip 하면
 *   사용자 작업물이 리셋된다. marginLeft(-8, AvatarGroup 겹침) 등 다른 inline 은 항상 보존.
 *
 * 멱등 — strip 할 게 없으면 동일 참조를 반환한다. 선례: migrateFieldInlineLayout(ADR-913).
 */

import type { CanonicalNode, CompositionDocument } from "@composition/shared";

/**
 * inline width/height 잔재를 strip 할 정원형 leaf type.
 * 크기가 catalog `sizes.{...}.height`(=diameter) 로 결정되는 컴포넌트.
 */
const CIRCLE_LEAF_TAGS: ReadonlySet<string> = new Set([
  "Avatar",
  "ProgressCircle",
]);

/**
 * factory 가 박아뒀던 기본 diameter. 이 값과 정확히 일치하는 inline 만 잔재로 간주한다.
 * (Avatar md = 32 / ProgressCircle md = 32 — 둘 다 catalog sizes.md.height 와 동일)
 */
const STALE_FACTORY_DIAMETER = 32;

/** 32 또는 "32px" 처럼 factory 기본값과 동치인 값인지. */
function isStaleFactoryDiameter(value: unknown): boolean {
  if (typeof value === "number") return value === STALE_FACTORY_DIAMETER;
  if (typeof value === "string") {
    return (
      value === String(STALE_FACTORY_DIAMETER) ||
      value === `${STALE_FACTORY_DIAMETER}px`
    );
  }
  return false;
}

/**
 * 정원형 leaf element 의 stale inline width/height 를 strip 한다.
 *
 * @param document - canonical CompositionDocument
 * @returns strip 대상이 있었으면 새 document, 없었으면 동일 참조 (멱등)
 */
export function migrateCircleLeafInlineSize(
  document: CompositionDocument,
): CompositionDocument {
  function migrateNode(node: CanonicalNode): CanonicalNode {
    const children = node.children?.map(migrateNode);

    let props = node.props;
    if (CIRCLE_LEAF_TAGS.has(node.type)) {
      const style = (node.props as Record<string, unknown> | undefined)
        ?.style as Record<string, unknown> | undefined;
      if (style) {
        // width/height 각각 독립 판정 — 한쪽만 사용자 조정된 경우 그쪽만 보존.
        const stripWidth =
          "width" in style && isStaleFactoryDiameter(style.width);
        const stripHeight =
          "height" in style && isStaleFactoryDiameter(style.height);
        if (stripWidth || stripHeight) {
          const nextStyle: Record<string, unknown> = { ...style };
          if (stripWidth) delete nextStyle.width;
          if (stripHeight) delete nextStyle.height;
          props = { ...node.props, style: nextStyle };
        }
      }
    }

    if (props === node.props) {
      return children ? { ...node, children } : node;
    }
    return children ? { ...node, props, children } : { ...node, props };
  }

  const next: CompositionDocument = {
    ...document,
    children: document.children.map(migrateNode),
  };

  return JSON.stringify(document) === JSON.stringify(next) ? document : next;
}
