/**
 * ADR-912 catalog SSOT collapse Δ7 — layout token table 단일 source.
 *
 * breakdown(`docs/adr/design/912-catalog-ssot-collapse-breakdown.md`) §2-3 Δ7 / §5 kill criteria
 * ("CSS generator 와 Skia/layout 이 서로 다른 layout token table 을 가진다").
 *
 * `flex-column` 등 layout token 을 CSS base style 로 변환하는 단일 정본. 과거 두 곳에 분산돼
 * 있었다 — `CSSGenerator.ts` 의 `COMPOSITION_LAYOUT_STYLES`(CSS 라인 문자열 배열) 와
 * `resolveCatalogContainer.ts` 의 `CATALOG_LAYOUT_STYLES`(kebab key→value 객체). 본 파일이
 * **객체 형태 단일 source** 가 되고, 두 consumer 가 각자 형태로 변환한다:
 *   - CSSGenerator(specs 내부): `layoutTokenToCssLines()` 로 CSS 라인 문자열 생성.
 *   - shared resolver: `LAYOUT_TOKEN_STYLES` 직접 import(shared→specs 정상 방향) 후 merge.
 *
 * **의존 방향 (Δ7)**: layout token 은 CSS vocabulary(D3 시각 어휘)이므로 framework-free 하위
 * 레이어 `specs` 에 산다. `shared` 가 이를 import 하는 것은 `shared → specs` 정상 방향이며,
 * 금지되는 `specs → shared` 역의존이 아니다(specs deps = colord 만, shared deps 에 specs 선언).
 */

/** 컴포넌트 root layout token. composition.layout 의 값 집합. */
export type LayoutToken = "flex-column" | "flex-row" | "inline-flex" | "grid";

/**
 * layout token → base container style (kebab-case key→value 객체, 단일 source).
 * key 삽입 순서가 CSS emit 라인 순서를 결정한다(Object.entries 보존) — 순서 변경 금지.
 */
export const LAYOUT_TOKEN_STYLES: Record<
  LayoutToken,
  Record<string, string>
> = {
  "flex-column": {
    display: "flex",
    "flex-direction": "column",
    "align-items": "flex-start",
    "box-sizing": "border-box",
  },
  "flex-row": {
    display: "flex",
    "flex-direction": "row",
    "align-items": "center",
    "box-sizing": "border-box",
  },
  "inline-flex": {
    display: "inline-flex",
    "align-items": "center",
    "box-sizing": "border-box",
  },
  grid: {
    display: "grid",
    "box-sizing": "border-box",
  },
};

/**
 * layout token 을 CSSGenerator base style 라인(`    prop: value;`)으로 변환한다.
 * 과거 `COMPOSITION_LAYOUT_STYLES` 배열과 byte 동일(4-space indent + `;`)해야 byte-diff 0.
 */
export function layoutTokenToCssLines(layout: LayoutToken): string[] {
  return Object.entries(LAYOUT_TOKEN_STYLES[layout]).map(
    ([prop, value]) => `    ${prop}: ${value};`,
  );
}
