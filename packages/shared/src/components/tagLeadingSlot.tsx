/**
 * Tag chip **좌측 슬롯** 마크업 단일 소스 (2026-08-21).
 *
 * chip 좌측에는 슬롯이 하나뿐이고 두 표현이 경쟁한다 — avatar(원형 이미지)와 icon(lucide
 * glyph). 우선순위는 **avatar > icon**이며, 이는 Skia 의 `resolveLeadingSlot`
 * (packages/specs/src/renderers/buildCatalogShapes.ts) 판정과 같은 결론이어야 한다.
 *
 * 마크업이 세 곳(chip 본체 / maxRows 미러 span / `renderTagGroup` items 경로)에 필요해서
 * 헬퍼로 모은다 — 과거 Tag icon 슬라이스에서 렌더러 경로 하나를 빠뜨려 "패널에선 편집되는데
 * DOM 에만 안 보이는" 비대칭이 났던 자리다. 미러는 실제 chip 의 **정확한 폭 대체**여야 하므로
 * 세 곳이 같은 마크업을 써야 한다(폭이 다르면 행당 chip 수가 어긋난다).
 */

import React from "react";

import { Icon } from "./Icon";

export interface TagLeadingSlotSource {
  /** lucide glyph 이름 (avatar 가 있으면 무시된다) */
  icon?: string | null;
  /** 아바타 이미지 URL — 있으면 icon 을 이긴다 */
  avatar?: string | null;
}

/**
 * chip 좌측 슬롯 노드. 둘 다 없으면 `null` — 빈 요소를 두면 gap/폭이 생겨
 * 슬롯 없는 chip 폭(= 라벨 + padding)이 어긋난다.
 */
export function renderTagLeadingSlot({
  icon,
  avatar,
}: TagLeadingSlotSource): React.ReactElement | null {
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        aria-hidden="true"
        className="tag-leading-avatar"
      />
    );
  }
  if (icon) {
    return (
      <Icon iconName={icon} aria-hidden="true" className="tag-leading-icon" />
    );
  }
  return null;
}
