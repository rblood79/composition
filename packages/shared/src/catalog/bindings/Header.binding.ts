import type { PrimitiveBinding } from "../types";

/**
 * ADR-238 Phase 2 — Header: 목록 section 의 제목 (RAC `Header`, GridList 안은 `GridListHeader` 로 렌더).
 *
 * D1: RAC `Header` (`<header>`) — section 의 `aria-labelledby` 는 RAC 가 잇는다. GridList 안에서는 RAC 가
 *     `GridListHeader` 를 요구해 Preview 가 그 컴포넌트로 바꿔 그린다 (`CanonicalNodeRenderer`).
 * D2: `children` (제목 글자) 만.
 * D3: 기존 catalog `Header` rule + 목록별 DOM 규칙 (`ListBox.css` `.react-aria-ListBox .react-aria-Header`) —
 *     Canvas 는 같은 값을 `sectionHeaderStyle` resolver 로 싣는다.
 */
export const headerBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Header",
  },
  rac: {
    primitive: "Header",
    parts: ["header"],
    slots: [],
    states: [],
    renderProps: [],
    dataAttributes: [],
  },
  props: {
    accepts: {
      children: { kind: "string", label: "Title", section: "content" },
    },
    toRacProps: "default",
  },
};
