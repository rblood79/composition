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

import { isSlotEnabled, readLeadingSlotSize } from "../catalog/slotRoles";
import type { SlotComposition } from "../catalog/slotRoles";
import { Icon } from "./Icon";

export interface TagLeadingSlotSource {
  /** lucide glyph 이름 (avatar 가 있으면 무시된다) */
  icon?: string | null;
  /** 아바타 이미지 URL — 있으면 icon 을 이긴다 */
  avatar?: string | null;
}

/**
 * ADR-229 Phase 1 — item template origin 의 slot 구성. origin 에 해당 slot 자식이 없으면 그 데이터는
 * 그리지 않는다 (존재 gating — 구성 SSOT = origin 자식). slot 자식 style 의 크기 (icon `fontSize` ·
 * avatar `width`) 는 inline 으로 — Skia `resolveLeadingSlot` 이 `_leadingSlotSize` 로 같은 숫자를 읽는다.
 * null/미주입 = legacy → 기존 동작 (데이터가 있으면 그린다).
 */
export function resolveTagLeadingSlotSource(
  item: TagLeadingSlotSource,
  composition: SlotComposition | null | undefined,
): { avatar: string | null; icon: string | null; size: number | undefined } {
  const avatar =
    item.avatar && isSlotEnabled(composition, "avatar") ? item.avatar : null;
  const icon = item.icon && isSlotEnabled(composition, "icon") ? item.icon : null;
  const size = avatar
    ? readLeadingSlotSize(composition?.slots.avatar?.style, "avatar")
    : icon
      ? readLeadingSlotSize(composition?.slots.icon?.style, "icon")
      : undefined;
  return { avatar, icon, size };
}

/**
 * chip 좌측 슬롯 노드. 둘 다 없으면 `null` — 빈 요소를 두면 gap/폭이 생겨
 * 슬롯 없는 chip 폭(= 라벨 + padding)이 어긋난다.
 */
export function renderTagLeadingSlot(
  item: TagLeadingSlotSource,
  composition?: SlotComposition | null,
): React.ReactElement | null {
  const { avatar, icon, size } = resolveTagLeadingSlotSource(item, composition);
  if (avatar) {
    return (
      <img
        src={avatar}
        alt=""
        aria-hidden="true"
        className="tag-leading-avatar"
        style={size != null ? { width: size, height: size } : undefined}
      />
    );
  }
  if (icon) {
    return (
      <Icon
        iconName={icon}
        aria-hidden="true"
        className="tag-leading-icon"
        style={
          size != null
            ? { width: size, height: size, fontSize: size }
            : undefined
        }
      />
    );
  }
  return null;
}
