import type { PrimitiveBinding } from "../types";
/**
 * DisclosureHeader — Disclosure 트리거 헤더 leaf (leading chevron + title text).
 *
 * **ADR-912 (B+icon) proof slice (leadingIcon generic append, 2026-06-08)**: DisclosureHeader 는
 *   catalog 미등록 상태에서 spec.render.shapes(DisclosureHeader.spec.ts:113/125)가 Skia 시각 유일
 *   source 였다 — `icon_font(chevron-right)` + `text(title)` 2-shape. catalog 등록으로 rule
 *   (`COMPONENT_RULES_TABLE.DisclosureHeader`: leadingIcon{chevron-right} + sizes.md.iconSize/paddingX
 *   /height) + buildCatalogShapes generic + `leading_icon` skiaPrimitive append 로 이전 → spec 의존
 *   끊기(step 4 삭제 안전).
 *
 * **Skia = box+text generic + leading_icon append**: `skiaPrimitive: "leading_icon"`(skiaPrimitives.ts,
 *   **append** 모드)가 base box+text(buildCatalogShapes) **위에** 좌측 chevron 을 덧그린다. text 는
 *   buildCatalogShapes 가 `size.iconSize` 존재(=leading icon 신호) 시 `iconSize + gap` 만큼 우측 shift
 *   (visual.leadingIcon 데이터 분기 — 컴포넌트별 if 아님, ADR-142 §3). chevron 색 = rule
 *   leadingIcon.color({color.neutral-subdued}, spec 보존). icon_font(중앙 고정 단일 glyph, replace)와
 *   별개 — leading 위치(좌측 paddingX) 배치가 generic leading-icon 채널.
 *
 * **DOM = 부모 Disclosure self-compose (독립 노드 0)**: Disclosure(catalog 미등록 legacy rendererMap)
 *   의 renderDisclosure(LayoutRenderers.tsx:1577)가 DisclosureHeader 자식의 props.children 을 title 로
 *   추출하고 contentChildren 에서 DisclosureHeader 를 제외(L1597-1599) → DisclosureHeader 는 DOM 독립
 *   노드 미생성(부모 `<Heading><Button slot="trigger"><svg chevron>{title}` self-compose,
 *   Disclosure.tsx:72-82). 따라서 catalog 등록 후에도 DOM 변화 0 — 발효 가치는 Skia 대칭 한정.
 *   source.renderer="disclosureheader"(renderDisclosureHeader fallback)은 단독 배치 edge case 안전망.
 *
 * D1: composition — DOM 은 부모 Disclosure 가 `<Heading><Button slot="trigger">` self-compose
 *     (DisclosureHeader 독립 DOM 노드 없음). RAC Disclosure D1/ARIA 권위 보존.
 * D2: children(title) + size 편집 surface.
 * D3: 시각(chevron + title 색/크기/정렬)은 theme rule(COMPONENT_RULES_TABLE.DisclosureHeader) —
 *     leadingIcon{name/gap/color} + sizes.md{fontSize/iconSize/paddingX/height}. Skia generic
 *     (box+text + leading_icon append) ↔ DOM 부모 self-compose 시각 대칭.
 */
export declare const disclosureHeaderBinding: PrimitiveBinding;
//# sourceMappingURL=DisclosureHeader.binding.d.ts.map