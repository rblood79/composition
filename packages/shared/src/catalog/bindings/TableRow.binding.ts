import type { PrimitiveBinding } from "../types";

/**
 * TableRow — 표 행 type (배경 + 하단 구분선).
 *
 * type 등록은 `componentCatalog.ts` 에 남아 있지만 지금 어떤 origin template 도 이 type 을 쓰지
 * 않는다 — Table · TableView 의 행은 `Row` 노드 (`reusableOriginLibrary.ts`) 이고, 바인딩된 Table 의
 * 데이터 행도 resolver `projectTableRows` 가 `Row` · `Cell` 로 만든다.
 *
 * **Canvas**: rule(`COMPONENT_RULES_TABLE.TableRow`: variants.default.fill base `{color.base}` +
 *   colors.border + sizes.{height/borderRadius}) 의 상자 + `table_row_divider` skiaPrimitive
 *   (append, 하단 line).
 *
 * **DOM**: `INTERNAL_RENDERERS` 미등록 → `domBinding.tsx` `ruleDom` 의 fallback
 *   (`div.react-aria-TableRow`).
 *
 * D1: composition 내부 상자 (RAC 대응 없음).
 * D2: size 편집 surface.
 * D3: 시각(행 배경 + 하단 구분선)은 theme rule(COMPONENT_RULES_TABLE.TableRow) +
 *     table_row_divider escape.
 */
export const tableRowBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tablerow",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "md",
      },
    },
    toRacProps: "default",
  },
  skiaPrimitive: "table_row_divider",
};
