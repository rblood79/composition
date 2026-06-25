/**
 * ADR-912 6 registry collapse — T1 Field leaf 의 `PrimitiveBinding`.
 * (catalog 미등록 spec 23종 cutover 첫 slice — Field 1종.)
 *
 * Field 는 데이터 매핑 internal 컴포넌트(데이터 key → 표시 값). RAC controller 없음 —
 * `rendererMap.Field = renderDataField` 전용 DOM 렌더러로 렌더(DELEGATING 패턴, DOM 보존).
 * Skia 는 spec render.shapes `() => []`(Skia 0 shape) → buildCatalogShapes 빈 노드.
 * escape 불필요(circle/image/arc/특수 fill 0), generic 0 shape.
 *
 * D1: composition 내부 데이터 필드 `<div>` (RAC primitive 아님 — internal source).
 * D2: key(Data Key) / label / visible / showLabel / type 이 편집 surface (spec properties).
 * D3: 시각 0 (transparent fill, shapes []) — Skia 빈 노드, DOM 은 renderDataField 가 값 표시.
 *
 * palette 미노출(placeable 아님 — 데이터 매핑 internal). catalog 등록 목적은
 * isCatalogSkiaCutover 게이트(buildSpecNodeData) 통과 — spec 삭제 후에도 Skia 빈 노드 정상 처리.
 */
export const fieldBinding = {
    source: {
        kind: "internal",
        renderer: "field",
    },
    props: {
        accepts: {
            key: {
                kind: "string",
                label: "Data Key",
                section: "content",
            },
            label: {
                kind: "string",
                label: "Label",
                section: "content",
            },
            type: {
                kind: "enum",
                label: "Type",
                section: "appearance",
                default: "string",
                options: [
                    { value: "string", label: "String" },
                    { value: "number", label: "Number" },
                    { value: "email", label: "Email" },
                    { value: "url", label: "URL" },
                    { value: "date", label: "Date" },
                    { value: "boolean", label: "Boolean" },
                    { value: "image", label: "Image" },
                ],
            },
        },
        toRacProps: "default",
    },
};
//# sourceMappingURL=Field.binding.js.map