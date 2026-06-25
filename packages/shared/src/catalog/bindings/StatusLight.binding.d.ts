import type { PrimitiveBinding } from "../types";
/**
 * StatusLight — 상태 표시 dot + 라벨 leaf (Spectrum 2 StatusLight).
 *
 * **ADR-912 진로 1번 StatusLight proof slice (internal leaf catalog 발효, 2026-06-06)**:
 *   StatusLight 은 catalog 미등록 상태에서 spec.render.shapes(StatusLight.spec.ts:362-425)가
 *   Skia 시각 source 였다. recon(2026-06-06): label 은 factory `children: []` + props.children
 *   (자식 Element 아님). render.shapes 는 dot circle + label text 를 직접 그린다.
 *
 *   **Skia**: `skiaPrimitive: "status_light"` escape(skiaPrimitives.ts, **replace** 모드)가 dot
 *   circle + label text 자체 생성. buildCatalogShapes box+text 는 circle 미지원 + StatusLight 은
 *   box 컨테이너 아님(dot+text leaf) → base box 무의미. rule fill base 는 dot 색(variant status)
 *   이라 base box 로 칠하면 box 전체가 status 색 → DOM(dot 만 색) 과 비대칭 → replace 로 base box
 *   미생성. 기존 `dot` primitive(`props.isDot` gate, Checkbox/Radio 전용 + text 미렌더)와 별개.
 *
 *   **DOM**: source.renderer="statuslight" → INTERNAL_RENDERERS["statuslight"](StatusLight.tsx
 *   React 컴포넌트). variant/size/children 이 props 라 generic fallback 으로는 안 그려진다(자식 0)
 *   → INTERNAL_RENDERERS 어댑터 필수(IllustratedMessage 선례 동형).
 *
 * D1: composition `<div>` (dot span + label span, internal source, INTERNAL_RENDERERS 어댑터).
 * D2: variant(5종 neutral/informative/positive/notice/negative) + size(sm/md/lg/xl) + children(label).
 * D3: dot 색은 variant status 색(theme rule fill base 와 동일 CSS var). Skia escape ↔ DOM 인라인
 *     style 시각 대칭.
 */
export declare const statusLightBinding: PrimitiveBinding;
//# sourceMappingURL=StatusLight.binding.d.ts.map