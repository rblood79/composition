import type { PrimitiveBinding } from "../types";
/**
 * TreeItem — Tree 항목 행 leaf (expand/collapse chevron + 라벨 텍스트).
 *
 * **ADR-912 R1 후속 (TreeItem catalog cutover, 2026-06-12)**: TreeItem 은 catalog 미등록
 *   상태에서 `TreeItem.spec.render.shapes`(chevron-right icon_font + label text)가 Skia 시각
 *   유일 source 였다. 단 spec 은 depth/indent 를 무시(paddingX=8 하드코딩)해 DOM(RAC
 *   `--tree-item-level` 들여쓰기) ↔ Skia(들여쓰기 없음) 비대칭인 깨진 구현이었다. catalog
 *   등록으로 rule(`COMPONENT_RULES_TABLE.TreeItem`: leadingIcon{chevron-right} +
 *   sizes.{fontSize/iconSize/paddingX/height/indentPerLevel}) + buildCatalogShapes generic +
 *   `leading_icon` skiaPrimitive append + depth indent(_treeLevel × indentPerLevel)로 이전 →
 *   spec 의존 끊기(step 4 삭제 안전) + DOM↔Skia 들여쓰기 대칭 복원.
 *
 * **Skia = box+text generic + leading_icon append + depth indent**: buildSpecNodeData 가
 *   `_treeLevel`(parent 체인 depth, 1-based) + `_hasTreeChildren`(자식 TreeItem 유무 =
 *   chevron 조건)을 주입. buildCatalogShapes(text) + leading_icon(chevron, append)이 **동일
 *   helper `resolveTreeIndent`** 로 `paddingX + (_treeLevel - 1) * indentPerLevel` 들여쓰기.
 *   leaf TreeItem(`_hasTreeChildren===false`)은 chevron glyph skip 하되 text 는 chevron 폭만큼
 *   shift(DOM `visibility:hidden` chevron 버튼과 대칭). DisclosureHeader (B+icon) 동형 +
 *   depth indent 확장(컴포넌트별 if 아님 — _treeLevel/indentPerLevel 데이터 분기, ADR-142 §3).
 *
 * **DOM = 부모 Tree self-compose (독립 노드 0)**: Tree.tsx(renderTreeItemsRecursively)가
 *   RAC `<TreeItem>` 을 재귀 렌더하며 RAC 가 `--tree-item-level` CSS 변수를 자동 주입 →
 *   `Tree.css` 가 `(--tree-item-level - 1) * --padding` 으로 들여쓴다. canonical TreeItem 자식
 *   은 부모 Tree 가 self-compose 흡수하므로 catalog 등록 후에도 DOM 변화 0 — 발효 가치는 Skia
 *   대칭(특히 depth indent 복원) 한정.
 *
 * D1: composition — DOM 은 RAC `<Tree>`/`<TreeItem>` 이 self-compose + ARIA(role=treeitem,
 *     aria-level/expanded). RAC D1/ARIA 권위 보존.
 * D2: children(label) + size 편집 surface.
 * D3: 시각(chevron + label 색/크기/정렬 + depth 들여쓰기)은 theme rule
 *     (COMPONENT_RULES_TABLE.TreeItem) — leadingIcon{name/gap/color} +
 *     sizes{fontSize/iconSize/paddingX/height/indentPerLevel}. Skia generic
 *     (box+text + leading_icon append + indent) ↔ DOM RAC self-compose 시각 대칭.
 */
export declare const treeItemBinding: PrimitiveBinding;
//# sourceMappingURL=TreeItem.binding.d.ts.map