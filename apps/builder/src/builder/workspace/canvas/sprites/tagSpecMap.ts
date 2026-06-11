/**
 * TAG_SPEC_MAP — Builder 측 merged spec registry (ADR-108 P0)
 *
 * packages/specs 정본 `TAG_SPEC_MAP` (102 entries — `childSpecs` 자동 확장 포함) 를
 * `BUILDER_ALIAS_MAP` (8 alias — ADR-912 4단계로 TabBar BC alias 제거) 과 병합하여 Canvas layout engine /
 * StoreRenderBridge / specPresetResolver / useLayoutAuxiliary 등이 소비하는
 * 단일 merged map 을 생성한다.
 *
 * 배경:
 *   - ADR-108 P0 이전: builder 가 독자 BASE_TAG_SPEC_MAP (108 entries) 유지 →
 *     packages/specs 와 13 항목 drift 발생 (8 진짜 alias + 3 누락 spec 등록 +
 *     2 stale 후보).
 *   - ADR-108 P0 이후: packages/specs 정본 (102) + builder 전용 8 alias layer.
 *     IllustratedMessage / CardView / TableView 는 packages/specs 정본으로 승격.
 *
 * IMAGE_TAGS 는 layout 과 무관한 이미지 렌더링 태그 집합 — 별도 유지.
 */

import type { ComponentSpec } from "@composition/specs";
import { TAG_SPEC_MAP as BASE_TAG_SPEC_MAP } from "@composition/specs";
import { BUILDER_ALIAS_MAP } from "./builderAliasMap";

/**
 * Builder 측 최종 TAG_SPEC_MAP — packages/specs 정본 + 8 alias.
 *
 * 수동 alias 가 정본 entry 와 type 이름 겹칠 가능성은 없도록 builderAliasMap 이
 * 유지 (Spec 등록 누락이 아닌 진짜 alias 만). 충돌 시 packages/specs 정본 우선
 * (alias spread 뒤에 정본 spread → 정본이 덮어쓰기 방지 위해 alias 먼저).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TAG_SPEC_MAP: Record<string, ComponentSpec<any>> = {
  ...BUILDER_ALIAS_MAP,
  ...BASE_TAG_SPEC_MAP,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSpecForTag(type: string): ComponentSpec<any> | null {
  return TAG_SPEC_MAP[type] ?? null;
}

/** 이미지 렌더링 대상 태그 (ImageSprite / buildImageNodeData 경로) */
export const IMAGE_TAGS = new Set(["Image", "Avatar", "Logo", "Thumbnail"]);
