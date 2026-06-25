/**
 * FieldError — compound 컴포넌트의 validation 에러 메시지 leaf (`<span>`).
 *
 * **ADR-912 위험군 해소 (선행-6 field/form deletion-risk → catalog 등록, 2026-06-04)**:
 *   FieldError 는 catalog 미등록 상태에서 spec.render.shapes 가 Skia 시각 source 였다(deletion-risk).
 *   catalog 등록으로 시각을 rule (`COMPONENT_RULES_TABLE.FieldError`, fontSize+lineHeight+textWeight:400
 *   완비) + buildCatalogShapes generic 으로 이전하여 spec 의존을 끊는다. Description/Label(TEXT_LEAF)
 *   와 시각 source 동형 (text archetype, transparent fill). 색만 다름 — negative(빨강).
 *
 * **kill criteria 통과 — catalog 등록이 정답 (실측 2026-06-04)**:
 *   - spec render.shapes(FieldError.spec.ts:92-138) 가 props.children/style/size 만 읽음 — validation
 *     상태(invalid)·부모 데이터 의존 변형 0. Label 4단계 변형보다 단순(Description 동형). catalog
 *     전환 직교성 자명. (children=에러 메시지는 RAC 가 DOM 주입 / 빌더는 사용자 직접 편집)
 *   - standalone palette 없음(ComponentList 미등록) + factory 자식 전용(TextField/NumberField 등 Form
 *     compound) 은 catalog 등록의 차단 사유 아님 — Label/Description 동일 전제에서 catalog 등록 성공한
 *     선례. "standalone 불가"·"display:none 기본(평시 숨김, validation 시 RAC 표시)" 은 모두 부모 흡수/
 *     projector 의 trigger 가 아님 (render.shapes 부모 데이터 의존이 trigger 인데 미해당).
 *
 * **measure 비대칭 = catalog 와 직교 (선행-6 추가 실측 2026-06-04, 사용자 confirm "measure 까지 실측")**:
 *   FieldError 는 Description 과 달리 `TEXT_LEAF_TAGS`(utils.ts:3202) **비멤버**라 자기 자신의
 *   enrichWithIntrinsicSize 경로(intrinsic width L3289-3299 / content height L3372-3376 — 둘 다
 *   `TEXT_LEAF_TAGS.has(type)` 게이트)에 미진입한다. 대신 **부모(Field 컨테이너)의 자식 height 분기**
 *   (utils.ts:2298-2308, `childTag === "fielderror"` 가 label/description 과 동일 처리)로만 측정된다.
 *   이 measure 경로는 **layout engine 코드**로 catalog 등록(usesGeneric=buildSpecNodeData:1195, Skia
 *   shape 생성기만 교체)과 **무관** — 등록 전후 measure 불변. TEXT_LEAF_TAGS 멤버십 추가 불요.
 *
 * **drift 0 확증 — rule height 0 정본화 + textWeight 400 + lineHeight (2026-06-04)**:
 *   spec render.shapes 는 baseline="top"/align="left"(FieldError.spec.ts:118-132). catalog
 *   buildCatalogShapes 의 isInlineText=(size.height===0 && !hasOpaqueBg)(L207) 가 true 여야 top/left
 *   동형. rule sizes 의 height(spec 14/16/20)를 0 으로 정본화 → isInlineText=true → 정렬 정합
 *   (Description/Label 동일 패턴). fill={color.transparent} 라 hasOpaqueBg=false(L201-206). textWeight
 *   400(spec fwRaw 미지정 기본) + lineHeight={typography.*--line-height}(getLabelLineHeight fallback
 *   동일 토큰) → drift 0. height:0 변경은 부모 height 분기(childStyle.height/lineHeight 참조, rule
 *   미참조) + spec render.shapes(size.height 미사용) 양쪽 측정 무영향.
 *
 * **source = internal**: RAC standalone `FieldError` controller 없음(field 자식 slot,
 *   `<Text slot="errorMessage">` 위임) → internal. DOM tag 는 `resolveGenericHtmlTag` KNOWN_HTML
 *   FieldError→`<span>`(CanonicalNodeRenderer.tsx:314, role="alert"/aria-live RAC 위임).
 *   Skia = box+text generic(buildCatalogShapes, transparent bg + text).
 *
 * D1: composition `<span>` (internal source, generic DOM via KNOWN_HTML).
 * D2: children/size 편집 surface.
 * D3: 시각(텍스트 색 negative/크기/lineHeight/weight 400)은 theme rule
 *     (COMPONENT_RULES_TABLE.FieldError).
 */
export const fieldErrorBinding = {
    source: {
        kind: "internal",
        renderer: "fielderror",
    },
    props: {
        accepts: {
            children: { kind: "string", label: "Text", section: "content" },
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
//# sourceMappingURL=FieldError.binding.js.map