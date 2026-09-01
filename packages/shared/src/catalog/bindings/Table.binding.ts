/**
 * ADR-142 family ⑤(Tree·Table) — Table primitive 의 `PrimitiveBinding`.
 *
 * inventory(§2-1) RAC-controller-backed primitive. composition wrapper(`Table.tsx`, default
 * export)가 useCollectionData(dataBinding → rows, ADR-132) + columns 로 채우고 RAC Table +
 * TableHeader/Column/Row/Cell 2D 합성(internal source). 2D collection 렌더는 RAC 담당.
 *
 * **Skia generic 발효 (skiaLegacy 제거, ADR-912 단계 4 C1 2026-06-03)**: DOM/Inspector·Skia 모두
 * catalog generic. 2D grid 는 Table 2D projection(RowsGroup → Row[i] → Cell[i][j])으로 Skia 렌더.
 * columns 는 columnMapping/binding 데이터라 generic Inspector kind:"binding" 로 표현.
 */

import type { PrimitiveBinding } from "../types";

export const tableBinding: PrimitiveBinding = {
  source: {
    kind: "internal",
    renderer: "table",
  },
  props: {
    accepts: {
      dataBinding: { kind: "binding", label: "Data", section: "content" },
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
      selectionMode: {
        kind: "enum",
        label: "Selection Mode",
        section: "state",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "single", label: "Single" },
          { value: "multiple", label: "Multiple" },
        ],
      },
      // ADR-923 r21m1 (2026-09-02) — 높이 축의 registry 다리. `Table.tsx` 는 `heightMode`(fixed/auto/
      //   viewport/full) × `height` 로 가상화 영역 높이를 정하고 layout(`implicitStyles` Table 분기)
      //   도 같은 두 prop 을 읽는데, 여기 선언이 없어 cutover 렌더러(`CanonicalNodeRenderer`)가 둘 다
      //   전달하지 않았다 → live Preview 는 항상 컴포넌트 기본값(fixed 400)이라 Inspector·AI writer 가
      //   써도 화면이 안 바뀌고(dead writer), auto 로 둔 빈 Table 이 DOM 402 vs layout 40 으로 갈렸다.
      //   (r18m1 Disclosure title 과 같은 형태 — 선언 없는 prop 은 소비 경로가 없다.)
      heightMode: {
        kind: "enum",
        label: "Height Mode",
        section: "appearance",
        default: "fixed",
        options: [
          { value: "fixed", label: "Fixed" },
          { value: "auto", label: "Auto" },
          { value: "viewport", label: "Viewport" },
          { value: "full", label: "Full" },
        ],
      },
      height: {
        kind: "number",
        label: "Height",
        section: "appearance",
        min: 0,
        default: 400,
      },
    },
    toRacProps: "default",
  },
};
