/**
 * HTML Primitive Default Dimensions
 *
 * `ComponentSpec` 이 없는 generic HTML element 의 intrinsic 폴백 dimensions.
 * Spec 이 있는 태그는 `ComponentSpec.defaultWidth` / `defaultHeight` 를 우선 사용하고,
 * undefined 일 때 본 Record 를 조회한다.
 *
 * ADR-096 Phase 2 — `utils.ts:461/1428` `DEFAULT_ELEMENT_WIDTHS/HEIGHTS` Record 2 건
 * 중 HTML primitive 계열 키만 이관. Spec 있는 태그 (button/input/select/textarea/image)
 * 는 각 Spec 파일로 이관됨 (Phase 3).
 *
 * 소비처: `apps/builder/.../utils.ts` getIntrinsicWidth / getIntrinsicHeight 폴백 체인.
 *
 * @packageDocumentation
 */

/**
 * HTML primitive type 별 기본 폭 (px).
 *
 * Spec 없는 media/embed 태그 한정. 그 외 알 수 없는 태그는 layout engine 의
 * `DEFAULT_WIDTH = 80` 폴백이 담당.
 *
 * ADR-912 단계5 step4 (2026-06-17): `input: 180` 재이관 — Input.spec.ts 삭제로
 * `InputSpec.defaultWidth`(180) 가 사라지면서 getDefaultWidth lookup 체인 5b
 * (`HTML_PRIMITIVE_DEFAULT_WIDTHS[type]`) 가 받도록 귀속. 누락 시 `DEFAULT_WIDTH = 80`
 * 폴백으로 신규 Input 기본폭 180→80 회귀(사용자-가시). ADR-096 Phase 3 가 input 을
 * spec 으로 이관했으나 catalog cutover 후 spec 자체가 삭제되므로 generic 폴백으로 복귀.
 */
export const HTML_PRIMITIVE_DEFAULT_WIDTHS: Readonly<Record<string, number>> = {
  img: 150,
  video: 300,
  canvas: 200,
  iframe: 300,
  input: 180,
};

/**
 * HTML primitive type 별 기본 높이 (px).
 *
 * - 텍스트 primitive (`p/span/h1~h6`): CSS 기본 라인 기반 추정
 * - 컨테이너 primitive (`div/section/ul` 등): 0 = auto (자식 기반 높이)
 * - 미디어 primitive (`img/video/canvas`): 고정 추정값
 * - 리스트/테이블 primitive (`li/tr/td/th`): 단일 셀 기본 높이
 *
 * 그 외 알 수 없는 태그는 layout engine 의 `estimateTextHeight(fontSize, fontSize * 1.5)`
 * 폴백이 담당.
 */
export const HTML_PRIMITIVE_DEFAULT_HEIGHTS: Readonly<Record<string, number>> =
  {
    // Text primitives
    p: 24,
    span: 20,
    h1: 40,
    h2: 36,
    h3: 32,
    h4: 28,
    h5: 24,
    h6: 20,
    // Container primitives (0 = auto, 자식 기반)
    div: 0,
    section: 0,
    article: 0,
    header: 0,
    footer: 0,
    nav: 0,
    aside: 0,
    main: 0,
    // Media primitives
    img: 150,
    video: 200,
    canvas: 150,
    // List primitives
    ul: 0,
    ol: 0,
    li: 24,
    // Table primitives
    table: 0,
    tr: 36,
    td: 36,
    th: 36,
  };
