/**
 * ADR-142 family ①(primitives/actions) — Skeleton leaf primitive 의 `PrimitiveBinding`.
 * (ADR-912 단계 5 선행-1: catalog 미등록 leaf 등록 — internal source, generic box 커버.)
 *
 * Skeleton 은 RAC controller 가 없는 composition 내부 leaf(loading placeholder).
 * `Skeleton.tsx` 가 `<div role="status" data-variant data-animation data-size>` 로 렌더 —
 * Badge/Icon 에 이은 세 번째 `internal` source leaf.
 *
 * **빌더 배치 노드는 단순 box** (factory `createDefaultSkeletonProps` 가 skeletonVariant 미설정 →
 * spec render.shapes 의 text 분기 roundRect 1개). spec 의 avatar/card/list 분기는
 * `skeletonVariant` 를 요구하는데 빌더에 그 편집 surface 가 없어 dead — generic box+text
 * (buildCatalogShapes)로 Skia 커버 가능, skiaPrimitive escape 불필요(Badge 의 isDot 같은 비-box
 * 모드 없음). 내부 컴포넌트가 자기-로딩 시 쓰는 `<Skeleton componentVariant="...">` 는
 * 빌더 배치 노드의 prop 이 아니라 별도 사용 경로.
 *
 * D1: composition 내부 `<div role="status">` (RAC primitive 아님 — internal source).
 * D2: variant(default/accent) + size 편집 surface (skeletonVariant 는 빌더 미노출).
 * D3: 시각(배경/borderRadius)은 theme/tokens data-* rules. Skia 는 buildCatalogShapes box.
 */
export const skeletonBinding = {
    source: {
        kind: "internal",
        renderer: "skeleton",
    },
    props: {
        accepts: {
            variant: {
                kind: "variant",
                label: "Variant",
                section: "appearance",
                default: "default",
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
//# sourceMappingURL=Skeleton.binding.js.map