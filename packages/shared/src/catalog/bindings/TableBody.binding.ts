import type { PrimitiveBinding } from "../types";

/**
 * TableBody — 표 본문 컨테이너 (자식 Row×N flex column).
 *
 * **노드 트리**: Table origin template 의 `Rows` slot 이다 (`reusableOriginLibrary.ts` —
 *   `TableBody > Row > Cell…`, 팔레트 Table 의 starter 행 1 — ADR-277). 바인딩된 Table 은 `repeat`
 *   표시가 붙은 Row 템플릿을 데이터 행마다 반복하고, 다른 Row 는 고정 행으로 제자리 (ADR-310 Phase 4).
 *
 * **Canvas**: `COMPONENT_RULES_TABLE.TableBody`(containerStyles flex column, variant transparent) →
 *   shell box (자식 Row 가 내용 담당).
 *
 * **DOM**: Table 안에서 `domRegistry.tsx` `INTERNAL_RENDERERS.tablebody` (RAC TableBody).
 *
 * D1: RAC `<TableBody>`.
 * D2: 편집 surface 최소(컨테이너 — 자식 Row 가 내용).
 * D3: 시각(flex column 배치 + transparent)은 theme rule(COMPONENT_RULES_TABLE.TableBody).
 */
export const tableBodyBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "tablebody",
  },
  props: {
    accepts: {
      size: {
        kind: "size",
        label: "Size",
        section: "appearance",
        default: "M",
      },
    },
    toRacProps: "default",
  },
};
