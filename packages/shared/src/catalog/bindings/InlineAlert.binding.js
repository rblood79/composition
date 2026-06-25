/**
 * InlineAlert — 인라인 알림 box 컨테이너 leaf (Spectrum 2 InlineAlert).
 *
 * **ADR-912 internal 4 slice — InlineAlert catalog 등록 (2026-06-04)**:
 *   InlineAlert 은 catalog 미등록 상태에서 spec.render.shapes(InlineAlert.spec.ts:182-231) 가 Skia
 *   시각 source 였다. 실측 결과 render.shapes 는 bg roundRect + border **shell 만** 그린다(icon/
 *   heading/content 직접 그리기 0 — heading/description 은 자식 Element). catalog 등록으로 시각을
 *   rule(`COMPONENT_RULES_TABLE.InlineAlert`, 5 variant fill + border) + buildCatalogShapes generic
 *   box+border 로 이전. InlineAlert 은 SHELL_ONLY/SYNTHETIC 두 Set 모두 **비멤버 → Plain 분류**
 *   (buildSpecNodeData _hasChildren = 자식 있을 때만). spec.render.shapes 가 _hasChildren 무관하게
 *   항상 box+border 만 반환(text shape 0)하므로 buildCatalogShapes box+border 와 시각 대칭 + 자식
 *   중복 렌더 위험 없음(Calendar 유형 버그 무관).
 *
 * **DOM parity = 변화 0**: rendererMap 에서 InlineAlert 제거 → generic fallback 경로(INTERNAL_RENDERERS
 *   미등록). isSpecOrCatalogBacked true → `react-aria-InlineAlert` + data-size/data-variant 주입
 *   보존 → generated/InlineAlert.css(index.css:108 import 됨) selector 매칭 불변. heading/description
 *   은 자식 Element 가 `.alert-heading`/`.react-aria-Description` selector 로 처리. resolveGenericHtmlTag
 *   InlineAlert 키 없음 → type.toLowerCase() = "inlinealert"(올바른 커스텀 태그, div 류 block).
 *
 * **staticAttrs (role 보강)**: renderInlineAlert(LayoutRenderers.tsx:1413) 와 spec.react()(L233-237)
 *   이 부여하던 role="alert"/aria-live="polite" D1 metadata 는 generic fallback 경로에 부여처가 없다
 *   (단순 styled div, RAC 아님). staticAttrs 로 데이터 기반 부여 — 스크린리더 alert 접근성 보존.
 *
 * D1: composition `<div role="alert">` (internal source, generic DOM via lowercase fallback).
 * D2: variant(5종 neutral/info/positive/notice/negative) + size(sm/md/lg) + heading + children 편집.
 * D3: 시각(variant 별 배경/테두리/패딩)은 theme rule(COMPONENT_RULES_TABLE.InlineAlert).
 */
export const inlineAlertBinding = {
    source: {
        kind: "internal",
        renderer: "inlinealert",
    },
    staticAttrs: {
        role: "alert",
        "aria-live": "polite",
    },
    props: {
        accepts: {
            heading: {
                kind: "string",
                label: "Heading",
                section: "content",
            },
            children: {
                kind: "string",
                label: "Description",
                section: "content",
            },
            // kind:"variant"/"size" 는 options 미보유(types.ts) — 값 집합은 theme rule 동적 제공.
            variant: {
                kind: "variant",
                label: "Variant",
                section: "appearance",
                default: "info",
            },
            size: {
                kind: "size",
                label: "Size",
                section: "appearance",
                default: "md",
            },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=InlineAlert.binding.js.map