import type { PrimitiveBinding } from "../types";

/**
 * TableCell — Table 2D projection 의 셀 leaf (텍스트 1개).
 *
 * **ADR-912 Pattern B (collection sub-part, 2026-06-13)**: TableCell 은 catalog 미등록 상태에서
 *   `TableCell.spec.render.shapes`(header fw600 / data fw400 cell text)가 Skia 시각 유일 source
 *   였다. catalog 등록으로 rule(`COMPONENT_RULES_TABLE.TableCell`: variants.default.colors.text +
 *   sizes.{fontSize/paddingX/height/borderRadius}) + buildCatalogShapes generic(text)으로 이전.
 *   header/data 굵기·정렬 분기(`_isHeader`/`_align`)는 projection(appendTableRowProjection)이
 *   `style.fontWeight`/`style.textAlign` 보편 D3 데이터로 주입 → buildCatalogShapes 가
 *   `style.fontWeight ?? visual.textWeight` / `style.textAlign` 보편 경로로 읽는다(컴포넌트 식별
 *   분기 0 — ADR-142 §3). 컬럼 폭 내 ellipsis 는 projection 의 `style.width: col.width`(노드 clip)로
 *   처리.
 *
 * **Skia = box+text generic (text-only)**: TableCell 은 render-space projection 노드
 *   (appendTableRowProjection → type:"TableCell" SceneNode)다. buildSpecNodeData 가
 *   `isCatalogCutover("TableCell")` → `buildCatalogShapesOrPrimitive`(text)로 그린다
 *   (skiaPrimitive 없음 — 셀 배경은 부모 TableRow 가 담당, 셀은 text 만). 셀 배경/구분선은 행이
 *   그리므로 TableCell variant fill 은 `{color.transparent}`(투명 box → text 만).
 *
 * **DOM = 부모 Table self-compose (독립 노드 0)**: renderTable(useCollectionData / dataBinding
 *   SSOT)이 RAC `<Table><TableHeader><Column>` + `<TableBody><Row><Cell>` 2D 합성. canonical 문서에
 *   TableCell element 가 없다(projection 전용 런타임 SceneNode) → DOM 재귀 자식 0, catalog 등록
 *   후에도 DOM 변화 0. 발효 가치는 Skia 대칭(spec 의존 끊기 = step 4 삭제 안전) 한정.
 *
 * D1: composition — DOM 은 RAC `<Table>`/`<Cell>` 이 self-compose + ARIA(role=gridcell).
 *     RAC D1/ARIA 권위 보존.
 * D2: children(cell text) + size 편집 surface(셀은 projection 데이터라 편집 surface 최소).
 * D3: 시각(cell text 색/크기/굵기/정렬)은 theme rule(COMPONENT_RULES_TABLE.TableCell) —
 *     variants.default.colors.text + sizes{fontSize/paddingX/height}. Skia generic(text) ↔
 *     DOM RAC self-compose 시각 대칭.
 *
 * source.renderer "tablecell" 은 DOM 에서 호출되지 않는다(부모 Table self-compose) — primitiveEntry
 * 의 getPrimitiveBinding 타입 계약 충족용. canonical TableCell element 가 없어 DELEGATING 등록 불요.
 */
export const tableCellBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tablecell",
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
