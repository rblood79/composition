/**
 * ADR-912 6 registry collapse — T1 Field leaf 의 `PrimitiveBinding`.
 *
 * Field 는 데이터 매핑 internal 컴포넌트(데이터 key → 표시 값). RAC controller 없음 —
 * delegatedDom `field` 가 `DataField` (`components/Field.tsx`) 로 그린다. Canvas 는 rule 시각 0 —
 * 빈 노드.
 *
 * D1: composition 내부 데이터 필드 `<div>` (RAC primitive 아님 — internal source).
 * D2: key(Data Key) / label / type 이 편집 surface.
 * D3: 시각 0 (transparent fill) — Canvas 빈 노드, DOM 은 `DataField` 가 값 표시.
 *
 * palette 미노출(placeable 아님 — 데이터 매핑 internal).
 */

import type { PrimitiveBinding } from "../types";

export const fieldBinding: PrimitiveBinding = {
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
