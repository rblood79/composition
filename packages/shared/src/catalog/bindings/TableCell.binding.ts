import type { PrimitiveBinding } from "../types";

/**
 * TableCell — 표 셀 leaf type (텍스트 1개).
 *
 * type 등록은 `componentCatalog.ts` 에 남아 있지만 지금 어떤 origin template 도 이 type 을 쓰지
 * 않는다 — Table · TableView 의 셀은 `Cell` 노드 (`reusableOriginLibrary.ts`) 이고, 바인딩된 Table 의
 * 데이터 셀도 resolver `projectTableRows` 가 `Cell` 로 만든다.
 *
 * **Canvas**: rule(`COMPONENT_RULES_TABLE.TableCell`: variants.default.colors.text +
 *   sizes.{fontSize/paddingX/height/borderRadius}) — variant fill 은 `{color.transparent}` 라 text 만
 *   보인다.
 *
 * **DOM**: `INTERNAL_RENDERERS` 미등록 → `domBinding.tsx` `ruleDom` 의 fallback
 *   (`div.react-aria-TableCell`).
 *
 * D1: composition 내부 상자 (RAC 대응 없음).
 * D2: children(cell text) + size 편집 surface.
 * D3: 시각(cell text 색/크기)은 theme rule(COMPONENT_RULES_TABLE.TableCell) —
 *     variants.default.colors.text + sizes{fontSize/paddingX/height}.
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
