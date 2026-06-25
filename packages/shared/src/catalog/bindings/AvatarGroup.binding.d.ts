import type { PrimitiveBinding } from "../types";
/**
 * AvatarGroup — 아바타 그룹 컨테이너 (Avatar 자식 묶음). composition 자체 추상 + S2 참조
 * (`react-spectrum.adobe.com/AvatarGroup`) — RAC/starter 에 `AvatarGroup` 없음(S2 전용).
 * factory(`DisplayComponents.ts::createAvatarGroupDefinition`)가 자식 Avatar×3 을 자동 생성한다.
 *
 * **ADR-912 R7 G1-a/b (container shell catalog cutover, 2026-06-15)**:
 *   구 `AvatarGroup.spec.ts`(render.shapes=`()=>[]` 투명 컨테이너, skipCSSGeneration:false → 자체
 *   generated/AvatarGroup.css)는 시각 분기가 없는 빈 셸이었다. generate-css virtual 전환(R7 G1-a)으로
 *   DOM CSS source 를 `COMPONENT_RULES_TABLE.AvatarGroup`(variant transparent + sizes height/radius)
 *   로 이전했고, 본 catalog 등록으로 Skia 시각도 spec.render.shapes → buildCatalogShapes generic box
 *   shell 로 이전하여 spec 의존을 끊는다. Card 본체(R6) 동형 — archetype default 컨테이너.
 *
 * **시각 = generic shell(자식 Avatar 가 내용 렌더) + factory props.style layout**: AvatarGroup 은
 *   컨테이너이므로 buildCatalogShapes 가 `_hasChildren` shell(투명 box)을 그리고 자식 Avatar Element
 *   가 시각을 담당한다. container layout(`display:flex` / `flexDirection:row` / `alignItems:center`)은
 *   factory `props.style` SSOT(ADR-907 Layer B, Skia/Taffy 직접 read).
 *
 * **DOM parity = 변화 0**: INTERNAL_RENDERERS 미등록 → CanonicalNodeRenderer generic fallback.
 *   isSpecOrCatalogBacked(spec || isCatalogCutover) 가 catalog 등록 후 true → `react-aria-AvatarGroup`
 *   className + `data-size` 보존 → generated CSS(AvatarGroup.css, virtual diff 0) 매칭 불변.
 *
 * D1: composition `<div>` (internal source, generic DOM).
 * D2: label(content) + size(appearance) + isDisabled(state) 편집 surface.
 * D3: 시각(variant transparent + radius full)은 theme rule(COMPONENT_RULES_TABLE.AvatarGroup).
 *     Skia generic box shell ↔ DOM `react-aria-AvatarGroup[data-size]` 시각 대칭.
 */
export declare const avatarGroupBinding: PrimitiveBinding;
//# sourceMappingURL=AvatarGroup.binding.d.ts.map