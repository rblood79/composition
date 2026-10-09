import type { PrimitiveBinding } from "../types";

/**
 * TreeItem — Tree 항목 행 (RAC `TreeItem`).
 *
 * **노드 트리**: TreeItem origin template 은 `TreeItem > TreeItemContent > Button[slot=chevron] >
 *   Icon + Text` 다 (`reusableOriginLibrary.ts`, ADR-256 Phase 5h). chevron 은 작성자 Button 노드다 —
 *   Canvas 상자는 `presence.ts` `catalogTreeChevronLayout` (항목 깊이의 `Tree.css` 버튼).
 *
 * **Canvas**: rule(`COMPONENT_RULES_TABLE.TreeItem`: sizes.{fontSize/iconSize/paddingX/height/
 *   indentPerLevel}) 의 상자. 깊이 · 자식 유무는 `presence.ts` 가 `_treeLevel` · `_hasTreeChildren`
 *   으로 주고, `buildCatalogShapes.ts` `resolveTreeIndent` 가 `(_treeLevel - 1) * indentPerLevel`
 *   들여쓰기를 계산한다.
 *
 * **DOM**: Tree 안에서는 `delegatedDom.tsx` `tree` 가 TreeItem 노드를 RAC TreeItem 으로 재귀
 *   렌더하며 (`treeItemElements`) RAC 가 `--tree-item-level` CSS 변수를 주입 → `Tree.css` 가
 *   들여쓴다. Tree 밖의 TreeItem 은 `delegatedDom.tsx` `treeitem` 이 contents-only Tree 의 한 행으로
 *   그린다.
 *
 * D1: RAC `<Tree>`/`<TreeItem>` — ARIA(role=treeitem, aria-level/expanded) 는 RAC 권위.
 * D2: children(label) + size + isDisabled 편집 surface.
 * D3: 시각(label 색/크기 + depth 들여쓰기)은 theme rule(COMPONENT_RULES_TABLE.TreeItem) —
 *     sizes{fontSize/iconSize/paddingX/height/indentPerLevel}.
 */
export const treeItemBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "treeitem",
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Label", section: "content" },
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
      // ADR-239 Phase 1 — RAC TreeItem `isDisabled` (disabled 상태 변형의 prop).
      isDisabled: { kind: "boolean", label: "Disabled", section: "state" },
    },
    toRacProps: "default",
  },
  //   (선택 체크박스는 ADR-256 Phase 5h 부터 작성자의 `Checkbox[slot=selection]` 노드 — 행이 그리지
  //   않는다.) 배열 등록이 없으면 dispatch 자체가 안 돼 rule 이 있어도 캔버스만 조용히 비는 축.
  skiaPrimitive: ["leading_icon"],
};
