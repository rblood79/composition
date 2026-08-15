/**
 * Builder 측 spec registry 진입점.
 *
 * ADR-142 cutover 이후 컴포넌트당 spec 파일은 폐기됐고, `packages/specs` 의 `TAG_SPEC_MAP`
 * 에는 잔존 spec 3개(Frame/Group/Slot)만 남는다. 일반 컴포넌트의 시각 SSOT 는 catalog
 * (`COMPONENT_RULES_TABLE`) + theme/tokens 다 — `resolveComponentRule` 을 쓸 것.
 *
 * 과거 이 모듈은 builder 전용 alias 계층(`BUILDER_ALIAS_MAP`)을 정본 map 위에 얹었으나,
 * ADR-912 로 alias 가 전수 제거되어 빈 객체만 남았고(2026-07-15 파일 삭제) 지금은 정본 map
 * 을 그대로 재노출한다.
 *
 * IMAGE_TAGS 는 layout 과 무관한 이미지 렌더링 태그 집합 — 여기 함께 둔다.
 */

import type { ComponentSpec } from "@composition/specs";
import { TAG_SPEC_MAP } from "@composition/specs";

export { TAG_SPEC_MAP };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSpecForTag(type: string): ComponentSpec<any> | null {
  return TAG_SPEC_MAP[type] ?? null;
}

/** 이미지 렌더링 대상 태그 (ImageSprite / buildImageNodeData 경로) */
export const IMAGE_TAGS = new Set(["Image", "Avatar", "Logo", "Thumbnail"]);
