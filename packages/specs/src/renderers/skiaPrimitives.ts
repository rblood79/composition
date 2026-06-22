/**
 * ADR-142 — `skiaPrimitive` draw module 레지스트리.
 *
 * 비-DOM-trivial primitive(box+text 로 표현 안 되는 도형 — 원/선/아이콘 등)의
 * Skia shape descriptor 생성기. `PrimitiveBinding.skiaPrimitive` 키로 dispatch 된다.
 *
 * **정본 모델 (사용자 정정 2026-05-31)**: 컴포넌트별 시각 차이는 buildCatalogShapes 안의
 * `if (props.isDot) / if (divider) / if (iconName)` **컴포넌트 식별 분기**가 아니라,
 * binding 의 `skiaPrimitive` **데이터**로 표현한다. buildCatalogShapes 는 모든 frame 이
 * 공유하는 보편 box+text 시각(fill/border/radius/padding/text)만 generic 처리한다.
 *
 * - primitive 종류는 유한(원/선/아이콘/arc/track/...) → 키 추가는 컴포넌트 N++ 가 아니다.
 * - 컴포넌트는 이 키 중 하나를 binding 에서 가리킬 뿐, 함수 안에 컴포넌트 식별 분기 없음.
 *
 * 설계: docs/adr/design/142-starter-spec-component-system-cutover-breakdown.md §3 (`skiaPrimitive`)
 */

import { parseBorderWidth, parsePxValue } from "../primitives";
import { fontFamily } from "../primitives/typography";
import {
  buildDatePickerShapes,
  buildDatePlaceholder,
  DATE_PICKER_SIZES,
} from "./datePickerShapes";
import type { Shape, SizeSpec, TokenRef } from "../types";
import { resolveSpecFontSize } from "./utils/resolveSpecFontSize";
import type { ComponentVisualRule } from "./utils/resolveComponentVisual";
import { resolveTreeIndent } from "./buildCatalogShapes";
import { measureSpecTextWidth } from "./utils/measureText";
import { breadcrumbSeparatorAfterPaddingXPx } from "../primitives/spacing";

/**
 * skiaPrimitive draw module 1개의 시그니처 — props/size/visual 에서 Shape[] 생성.
 * **null 반환** = "이 props 에는 내 primitive 가 적용되지 않음" → caller 가 보편 box+text
 * (buildCatalogShapes)로 fallback. 예: `dot` 은 `props.isDot` 일 때만 circle, 아니면 null
 * (text Badge 는 일반 frame box+text). 이는 컴포넌트 식별이 아니라 primitive 자체의 적용
 * 조건이다 — "dot primitive 는 isDot 일 때 그린다"(Badge 라는 컴포넌트를 식별하지 않음).
 *
 * **ADR-142 B2 (spec-free)**: 더 이상 spec VariantSpec / selected 상수(CHECKBOX_CHECKED_COLORS
 * 등)를 읽지 않는다. caller(builder)가 rule 테이블에서 해소한 `ComponentVisualRule` 을 주입한다.
 * selected/checked 시각은 보편 상태축 `visual.fill.default.selected` / `visual.selectedBorder` /
 * `visual.border` 에서 읽는다(컴포넌트-특화 상수 맵 제거 — N++ 복제 방지).
 */
export type SkiaPrimitiveDrawFn = (ctx: {
  props: Record<string, unknown>;
  size: SizeSpec;
  visual: ComponentVisualRule | undefined;
  style: Record<string, unknown> | undefined;
}) => Shape[] | null;

/**
 * `icon_font` — Lucide 아이콘 단일 glyph. size.iconSize 기준, style.fontSize override.
 * 색은 style.color → variant.text. (Icon primitive)
 */
const iconFont: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const iconSize = size.iconSize ?? 24;
  const effectiveSize =
    style?.fontSize != null
      ? resolveSpecFontSize(style.fontSize as string | number, iconSize)
      : iconSize;
  return [
    {
      type: "icon_font",
      iconName: (props.iconName as string) ?? "circle",
      x: effectiveSize / 2,
      y: effectiveSize / 2,
      fontSize: effectiveSize,
      fill: (style?.color as string | undefined) ?? visual?.text,
      strokeWidth: (props.strokeWidth as number | undefined) ?? 2,
    },
  ];
};

/**
 * `dot` — 채워진 원(텍스트 없는 점). size.height 기준 지름. fill 은 variant.fill base.
 * `props.isDot` 일 때만 적용 — 아니면 null(text 는 보편 box+text 로 fallback).
 */
const dot: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  if (!props.isDot) return null;
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base;
  const dotSize = size.height === 20 ? 8 : size.height === 24 ? 10 : 12;
  return [
    {
      type: "circle",
      x: dotSize / 2,
      y: dotSize / 2,
      radius: dotSize / 2,
      fill: bgColor,
    },
  ];
};

/**
 * `divider` — 선색으로 채운 얇은 rect(1px 박스의 테두리가 아니라 선 자체). orientation 으로
 * 두께/길이 축 전환. 선색은 style.borderColor → variant.border. (Separator)
 */
const divider: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const lineColor =
    (style?.borderColor as string | undefined) ?? visual?.border;
  const isVertical = (props.orientation as string | undefined) === "vertical";
  const thickness = size.height;
  return [
    {
      type: "rect",
      x: 0,
      y: 0,
      width: isVertical ? thickness : ("auto" as unknown as number),
      height: isVertical ? ("auto" as unknown as number) : thickness,
      fill: lineColor,
    },
  ];
};

/**
 * `table_row_divider` — Table 행 하단 구분선(append). bg box 위에 행 높이 아래쪽에 1px line.
 *
 * **ADR-912 Pattern B (TableRow catalog cutover, 2026-06-13)**: TableRow.spec.render.shapes 의
 *   하단 line(`y1: rowHeight, x2: _rowWidth`)을 이전. `divider`(Separator, y:0 선 자체)와 별개 —
 *   본 module 은 행 배경(buildCatalogShapes bg box) **아래쪽 경계**에 그리는 구분선이라 append +
 *   `y: rowHeight` 절대 배치. 폭은 projection 이 주입한 `_rowWidth`(전체 컬럼 합) — 미주입 시
 *   layout width fallback. 선색 = style.borderColor → variant.border → `{color.border}`.
 *   컴포넌트 식별 분기 아님 — `_rowWidth` 데이터 유무로만 분기(ADR-142 §3, 미주입 type 은
 *   layout width 사용 → 무영향).
 */
const tableRowDivider: SkiaPrimitiveDrawFn = ({
  props,
  size,
  visual,
  style,
}) => {
  const lineColor =
    (style?.borderColor as string | undefined) ??
    visual?.border ??
    ("{color.border}" as TokenRef);
  const rowHeight =
    typeof style?.height === "number" && style.height > 0
      ? style.height
      : typeof size.height === "number" && size.height > 0
        ? size.height
        : 44;
  const rowWidth =
    typeof props._rowWidth === "number" && props._rowWidth > 0
      ? props._rowWidth
      : ("auto" as unknown as number);
  return [
    {
      type: "line",
      x1: 0,
      y1: rowHeight,
      x2: rowWidth,
      y2: rowHeight,
      stroke: lineColor,
      strokeWidth: 1,
    },
  ];
};

/**
 * `tablist_divider` — TabList 하단(horizontal) 또는 우측(vertical) 구분선(append).
 *
 * **ADR-912 projection 3 cutover (2026-06-15, table_row_divider 동형)**: TabList.spec.render.shapes
 *   의 구분선 line(`y: h, x2: _containerWidth`)을 이전. base box(buildCatalogShapes, transparent
 *   shell) 아래쪽/우측 경계에 1px line → append. 폭/높이는 projection·CONTAINER_DIMENSION_TAGS 가
 *   주입한 `_containerWidth`/`_containerHeight`(전체 탭 폭/높이) — 미주입 시 layout width fallback.
 *   선색 = style.borderColor → visual.border → `{color.border}`. orientation 데이터 분기만(ADR-142 §3).
 */
const tablistDivider: SkiaPrimitiveDrawFn = ({
  props,
  size,
  visual,
  style,
}) => {
  const lineColor =
    (style?.borderColor as string | undefined) ??
    visual?.border ??
    ("{color.border}" as TokenRef);
  const isVertical = (props.orientation as string | undefined) === "vertical";
  const h =
    typeof size.height === "number" && size.height > 0 ? size.height : 29;
  const w =
    typeof props._containerWidth === "number" && props._containerWidth > 0
      ? props._containerWidth
      : ("auto" as unknown as number);
  const fullH =
    typeof props._containerHeight === "number" && props._containerHeight > 0
      ? props._containerHeight
      : h;
  // horizontal: 하단(y=h) 가로선 0→w. vertical: 우측(x=0) 세로선 0→fullH.
  return [
    {
      type: "line",
      x1: 0,
      y1: isVertical ? 0 : h,
      x2: isVertical ? 0 : w,
      y2: isVertical ? fullH : h,
      stroke: lineColor,
      strokeWidth: 1,
    },
  ];
};

/** Tab indicator 두께 (CSS 정합: sm=2 / md=3 / lg=4) — height(21/29/41) → thickness. */
const TAB_INDICATOR_THICKNESS: Record<number, number> = { 21: 2, 29: 3, 41: 4 };

/**
 * `tab_indicator` — 선택된 Tab 의 accent 인디케이터(append, 조건부).
 *
 * **ADR-912 projection 3 cutover (2026-06-15)**: Tab.spec.render.shapes 의 조건부 accent rect
 *   (`isSelected && showIndicator` 시 하단/우측 full-width 막대)를 이전. base box(transparent) 위에
 *   덧그리는 막대 → append. 데이터 분기만(ADR-142 §3): `_isSelected`/`_showIndicator`/`orientation`/
 *   `_containerWidth` 미충족 시 빈 배열(미렌더). 비-Tab type 은 이 props 부재 → 자연히 빈 배열.
 *   indicator 색 = `{color.accent}`(spec 동형, full-width 막대라 variant fill 과 별개 고정).
 */
const tabIndicator: SkiaPrimitiveDrawFn = ({ props, size }) => {
  if (props._isSelected !== true || props._showIndicator === false) return [];
  const isVertical = (props.orientation as string | undefined) === "vertical";
  const h =
    typeof size.height === "number" && size.height > 0 ? size.height : 29;
  const thickness = TAB_INDICATOR_THICKNESS[h] ?? 3;
  const w =
    typeof props._containerWidth === "number" && props._containerWidth > 0
      ? props._containerWidth
      : ("auto" as unknown as number);
  return [
    {
      type: "rect",
      x: isVertical ? (typeof w === "number" ? w - thickness : 0) : 0,
      y: isVertical ? 0 : h - thickness,
      width: isVertical ? thickness : w,
      height: isVertical ? h : thickness,
      fill: "{color.accent}" as TokenRef,
    },
  ];
};

/**
 * `breadcrumb_crumb` — Breadcrumb 단일 조각: label + (비-마지막) separator(replace).
 *
 * **ADR-912 projection 3 cutover (2026-06-15)**: Breadcrumb.spec.render.shapes 의 label text
 *   (isLast→accent fw600 / 그 외→neutral-subdued fw400) + 비-마지막 separator(›) text 를 이전.
 *   text 위치가 label 폭만큼 우측 누적이라 buildCatalogShapes 의 single-text(좌측 고정) 가정과
 *   충돌 → replace 로 자체 생성(spec 좌표 공식 1:1). `_isLast`/`_separator` 데이터 분기만(ADR-142 §3).
 */
const breadcrumbCrumb: SkiaPrimitiveDrawFn = ({
  props,
  size,
  visual,
  style,
}) => {
  const ff = (style?.fontFamily as string) || fontFamily.sans;
  const text = String(
    props.children ?? props.label ?? props.title ?? "",
  ).trim();
  const isLast = props._isLast === true;
  const separator = String(props._separator ?? "›");
  const fontSize = resolveSpecFontSize(
    (style?.fontSize as string | number | undefined) ?? size.fontSize,
    16,
  );
  const afterPadX = breadcrumbSeparatorAfterPaddingXPx(
    String(props.size ?? "M"),
  );
  const height =
    typeof size.height === "number" && size.height > 0 ? size.height : 24;

  const shapes: Shape[] = [];
  let x = 0;

  const labelFw = isLast ? 600 : 400;
  const labelFill: TokenRef | string = isLast
    ? ("{color.accent}" as TokenRef)
    : (visual?.text ?? ("{color.neutral-subdued}" as TokenRef));

  if (text) {
    const estW = measureSpecTextWidth(text, fontSize, ff, labelFw);
    shapes.push({
      type: "text" as const,
      x,
      y: height / 2,
      text,
      fontSize,
      fontFamily: ff,
      fontWeight: labelFw,
      fill: labelFill,
      align: "left" as const,
      baseline: "middle" as const,
      maxWidth: estW + fontSize,
    });
    x += estW;
  }

  if (!isLast) {
    const sepWidth = measureSpecTextWidth(separator, fontSize, ff, 400);
    x += afterPadX;
    shapes.push({
      type: "text" as const,
      x,
      y: height / 2,
      text: separator,
      fontSize,
      fontFamily: ff,
      fontWeight: 400,
      fill: "{color.neutral-subdued}" as TokenRef,
      align: "left" as const,
      baseline: "middle" as const,
      maxWidth: sepWidth + fontSize,
    });
  }

  return shapes;
};

/** GridListItem/ListBoxItem template placeholder(`{label}` 등) → sample 미리보기 판정. */
function isCardTemplatePlaceholder(value: unknown): boolean {
  return typeof value === "string" && /^\{[^}]+\}$/.test(value);
}

/** props.children/textValue/value 에서 카드 label 텍스트 추출 (Item spec readText 동형). */
function readCardText(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) {
    return isCardTemplatePlaceholder(value) ? null : value;
  }
  if (typeof value === "number") return String(value);
  return null;
}

/**
 * `gridlist_card` — GridList 카드 항목 (box bg+border + label + description, replace 모드).
 *
 * **ADR-912 collection sub-part cutover (2026-06-14, Avatar replace 선례 동형)**: GridListItem 은
 *   catalog 미등록 상태에서 `GridListItem.spec.render.shapes`(카드 roundRect {color.layer-1} +
 *   border {color.border} + label fw600 + description {color.neutral-subdued})가 Skia 시각 유일
 *   source 였다. catalog 등록으로 rule(`COMPONENT_RULES_TABLE.GridListItem`: fill.default.base +
 *   colors.border + textWeight + sizes.{fontSize/paddingX/paddingY/gap/borderRadius}) + 본 escape 로
 *   이전 → spec 의존 끊기(step 4 삭제 안전).
 *
 *   **replace 모드인 이유**: 카드는 label(상단 top-left) + description(2번째 줄) **2-line top-aligned**
 *   레이아웃이라, buildCatalogShapes 의 box-center/single-text 가정과 충돌(height>0 box 로 오판 →
 *   label center/middle drift). Avatar/SliderTrack 처럼 box+text 전체를 escape 가 자체 생성.
 *   spec.render.shapes(GridListItem.spec.ts:124-217) 좌표 공식과 1:1 대칭.
 *
 *   label/description = projection 이 주입한 props.children/description(보편 데이터, ADR-142 §3 —
 *   컴포넌트 식별 분기 0). template placeholder(`{label}`) → "Label"/"Description" sample.
 */
const gridListCard: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const fontSize = resolveSpecFontSize(
    (style?.fontSize as string | number | undefined) ?? size.fontSize,
    14,
  );
  // 카드 padding: longhand 우선 → shorthand → rule sizes (style-ssot.md).
  const cardPaddingX = parsePxValue(
    style?.paddingLeft ?? style?.padding,
    typeof size.paddingX === "number" ? size.paddingX : 16,
  );
  const cardPaddingY = parsePxValue(
    style?.paddingTop ?? style?.padding,
    typeof size.paddingY === "number" ? size.paddingY : 12,
  );
  const cardBorderRadius = parsePxValue(
    style?.borderRadius,
    typeof size.borderRadius === "number" ? size.borderRadius : 8,
  );
  // label↔description 수직 간격 (spec descGap 4 = label baseline 아래 description top).
  const descGap = 4;
  const descFontSize = fontSize - 2;
  const ff = (style?.fontFamily as string) || fontFamily.sans;
  const textColor =
    (style?.color as string | undefined) ??
    visual?.text ??
    ("{color.neutral}" as TokenRef);
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    ("{color.layer-1}" as TokenRef);
  // ADR-913 slice 4 (2026-06-19): selected 카드 테두리 — DOM(builder GridList.css
  //   `[data-selected]{border-color:var(--accent);border-width:2px}`)과 대칭. listbox_item
  //   형제가 isSelected → accent-subtle row-bg 를 honor 하는 것과 동형(buildCatalogShapes
  //   selected→selectedBorder 정본 패턴). style.borderColor 사용자 편집 우선.
  const isSelected = props.isSelected === true;
  const borderColor =
    (style?.borderColor as string | undefined) ??
    (isSelected
      ? (visual?.selectedBorder ?? ("{color.accent}" as TokenRef))
      : (visual?.border ?? ("{color.border}" as TokenRef)));

  // template placeholder(`{label}`) → sample 미리보기 (빈 화면 방지, Item spec 패턴).
  const labelRaw = props.children ?? props.textValue ?? props.value;
  const isTemplatePreview = isCardTemplatePlaceholder(labelRaw);
  const label = isTemplatePreview
    ? "Label"
    : (readCardText(props.children) ??
      readCardText(props.textValue) ??
      readCardText(props.value) ??
      "");
  const description = isTemplatePreview
    ? props.description != null && props.description !== ""
      ? "Description"
      : null
    : readCardText(props.description);

  const labelH = fontSize;
  const descH = description ? descFontSize + descGap : 0;
  const cardHeight = parsePxValue(
    style?.height,
    cardPaddingY * 2 + labelH + descH,
  );
  const labelFontWeight =
    (style?.fontWeight as string | number | undefined) ??
    visual?.textWeight ??
    600;

  const shapes: Shape[] = [];

  // 카드 박스 (bg + border) — GridListItem.spec renderOneCard 정본.
  shapes.push({
    id: "card-bg",
    type: "roundRect",
    x: 0,
    y: 0,
    width: "auto",
    height: cardHeight,
    radius: cardBorderRadius,
    fill: bgColor,
  });
  shapes.push({
    type: "border",
    target: "card-bg",
    // selected → 2px (DOM `[data-selected]{border-width:2px}` 정합). style.borderWidth 우선.
    borderWidth: parsePxValue(
      style?.borderWidth,
      isSelected
        ? 2
        : typeof size.borderWidth === "number"
          ? size.borderWidth
          : 1,
    ),
    color: borderColor,
    radius: cardBorderRadius,
  });

  // label (top-left)
  shapes.push({
    type: "text",
    x: cardPaddingX,
    y: cardPaddingY,
    text: label,
    fontSize,
    fontFamily: ff,
    fontWeight: labelFontWeight,
    fill: textColor,
  });

  // description (optional, 2번째 줄)
  if (description) {
    shapes.push({
      type: "text",
      x: cardPaddingX,
      y: cardPaddingY + fontSize + descGap,
      text: description,
      fontSize: descFontSize,
      fontFamily: ff,
      fill: "{color.neutral-subdued}" as TokenRef,
    });
  }

  return shapes;
};

/**
 * `listbox_item` — ListBox 행 항목 (selection row-bg + icon + label + description + check, replace 모드).
 *
 * **ADR-912 collection sub-part cutover (2026-06-14, gridlist_card replace 선례 동형)**: ListBoxItem 은
 *   catalog 미등록 상태에서 `ListBoxItem.spec.render.shapes`(selection/hover row-bg + icon(좌측) +
 *   label(fw600) + description(2번째 줄 neutral-subdued) + check(우측 selection))가 Skia 시각 유일
 *   source 였다. catalog 등록으로 rule(fill.default{base transparent / hover layer-1 / selected
 *   accent-subtle} + colors.text + textWeight + sizes.{paddingX/paddingY/gap/iconSize}) + 본 escape 로
 *   이전.
 *
 *   **replace 모드인 이유**: 행은 icon|label/description(수직 스택)|check 의 multi-slot 레이아웃이라
 *   buildCatalogShapes 의 box+single-text 가정으로 재현 불가. ListBoxItem.spec.ts:200-292 좌표 공식과
 *   1:1 대칭. selection 은 props.isSelected(보편 축, ADR-142 §3) — 빌더 정적 캔버스는 default state 라
 *   hover/pressed row-bg 는 미발생(projection default state, spec state 분기 중 selection 만 유효).
 *
 *   icon/label/description = projection(appendListBoxRowProjection)이 주입한 props.icon/children/
 *   description 보편 데이터. template placeholder(`{label}`) → "Label"/"Description" sample.
 */
const listBoxItem: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const fontSize = resolveSpecFontSize(
    (style?.fontSize as string | number | undefined) ?? size.fontSize,
    14,
  );
  // padding longhand 우선 → shorthand → rule sizes (style-ssot.md).
  const paddingLeft = parsePxValue(
    style?.paddingLeft ?? style?.padding,
    typeof size.paddingX === "number" ? size.paddingX : 12,
  );
  const paddingRight = parsePxValue(
    style?.paddingRight ?? style?.padding,
    typeof size.paddingX === "number" ? size.paddingX : 12,
  );
  const paddingTop = parsePxValue(
    style?.paddingTop ?? style?.padding,
    typeof size.paddingY === "number" ? size.paddingY : 4,
  );
  const paddingBottom = parsePxValue(
    style?.paddingBottom ?? style?.padding,
    typeof size.paddingY === "number" ? size.paddingY : 4,
  );
  const rowGap = parsePxValue(
    style?.rowGap ?? style?.columnGap ?? style?.gap,
    typeof size.gap === "number" ? size.gap : 2,
  );
  // lineHeight: fontSize 기반 매핑 (resolveListBoxItemMetric 동형).
  const lineHeight =
    fontSize <= 12 ? 16 : fontSize <= 14 ? 20 : fontSize <= 16 ? 24 : 28;

  // template placeholder 처리 (Item spec readText 동형).
  const labelRaw = props.children ?? props.textValue ?? props.value;
  const isTemplatePreview = isCardTemplatePlaceholder(labelRaw);
  const label = isTemplatePreview
    ? "Label"
    : (readCardText(props.children) ??
      readCardText(props.textValue) ??
      readCardText(props.value) ??
      "");
  const description = isTemplatePreview
    ? props.description != null && props.description !== ""
      ? "Description"
      : null
    : readCardText(props.description);

  const minHeight = parsePxValue(style?.minHeight, 20);
  const contentHeight = description
    ? lineHeight + rowGap + lineHeight
    : lineHeight;
  const rowHeight = parsePxValue(
    style?.height,
    Math.max(paddingTop + paddingBottom + contentHeight, minHeight),
  );
  const width =
    typeof style?.width === "number" && style.width > 0 ? style.width : 200;
  const textColor = props.isDisabled
    ? ("{color.neutral-subdued}" as TokenRef)
    : ((style?.color as string | undefined) ??
      visual?.text ??
      ("{color.neutral}" as TokenRef));
  // icon/check slot (spec ListBoxItem.spec.ts:180-195 좌표 공식).
  const iconName = readCardText(props.icon);
  const iconSize = typeof size.iconSize === "number" ? size.iconSize : 16;
  const slotGap = 6;
  const showCheck = Boolean(props.isSelected);
  const checkSize = iconSize;
  const slotInset = typeof size.paddingX === "number" ? size.paddingX : 12;
  const textX = iconName
    ? Math.max(paddingLeft, slotInset + iconSize + slotGap)
    : paddingLeft;
  const rightReserve = showCheck ? checkSize + slotGap : 0;
  const maxWidth = Math.max(1, width - textX - paddingRight - rightReserve);
  const ff = (style?.fontFamily as string) || fontFamily.sans;
  const labelFontWeight =
    (style?.fontWeight as string | number | undefined) ??
    visual?.textWeight ??
    600;

  const shapes: Shape[] = [];

  // selection row-bg (selected → accent-subtle). hover/pressed 는 빌더 정적 캔버스 미발생.
  if (props.isSelected) {
    shapes.push({
      id: "row-bg",
      type: "roundRect",
      x: 0,
      y: 0,
      width: "auto",
      height: "auto" as unknown as number,
      radius: parsePxValue(
        style?.borderRadius,
        typeof size.borderRadius === "number" ? size.borderRadius : 4,
      ),
      fill:
        visual?.fill?.default.selected ?? ("{color.accent-subtle}" as TokenRef),
    });
  }

  // icon slot (좌측, 수직 중앙)
  if (iconName) {
    shapes.push({
      type: "icon_font",
      iconName,
      x: slotInset + iconSize / 2,
      y: rowHeight / 2,
      fontSize: iconSize,
      fill: textColor,
      baseline: "middle",
    });
  }

  // label + (optional) description 수직 스택
  if (description) {
    shapes.push({
      type: "text",
      x: textX,
      y: paddingTop + lineHeight / 2,
      text: label,
      fontSize,
      fontFamily: ff,
      fontWeight: labelFontWeight,
      fill: textColor,
      align: "left",
      baseline: "middle",
      maxWidth,
      overflow: "ellipsis",
    });
    shapes.push({
      type: "text",
      x: textX,
      y: paddingTop + lineHeight + rowGap + lineHeight / 2,
      text: description,
      fontSize: Math.max(11, fontSize - 1),
      fontFamily: ff,
      fontWeight: 400,
      fill: "{color.neutral-subdued}" as TokenRef,
      align: "left",
      baseline: "middle",
      maxWidth,
      overflow: "ellipsis",
    });
  } else {
    shapes.push({
      type: "text",
      x: textX,
      y: rowHeight / 2,
      text: label,
      fontSize,
      fontFamily: ff,
      fontWeight: labelFontWeight,
      fill: textColor,
      align: "left",
      baseline: "middle",
      maxWidth,
      overflow: "ellipsis",
    });
  }

  // selection-indicator (우측 체크마크)
  if (showCheck) {
    shapes.push({
      type: "icon_font",
      iconName: "check",
      x: width - slotInset - checkSize / 2,
      y: rowHeight / 2,
      fontSize: checkSize,
      fill: "{color.accent}" as TokenRef,
      baseline: "middle",
    });
  }

  return shapes;
};

/**
 * `checkbox` — 체크박스 indicator: box(roundRect, size.indicator.boxSize) + border +
 * checkmark(2 line)/indeterminate(1 line, isChecked·isSelected 시). label 은 자식 Label
 * Element 가 담당하므로 여기서 안 그린다(정본 — indicator 만). isChecked 시 bg/border
 * variant별 CHECKBOX_CHECKED_COLORS 로 전환. (Checkbox primitive)
 */
const checkbox: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const boxSize = size.indicator?.boxSize ?? 20;
  const isChecked = props.isSelected === true;

  const borderRadius = parsePxValue(
    style?.borderRadius,
    size.indicator?.boxRadius ?? 4,
  );
  const borderWidth = parseBorderWidth(style?.borderWidth, 2);

  // checked 시각 = 보편 상태축: bg=fill.default.selected, border=selectedBorder.
  // 미선택: bg=fill.default.base, border=visual.border (이전 CHECKBOX_*_COLORS 상수 흡수).
  // fallback("{color.border}")은 variant 누락 방어 — 정상 spec 에선 도달 안 함(타입 만족).
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    (isChecked ? visual?.fill?.default.selected : visual?.fill?.default.base) ??
    ("{color.base}" as TokenRef);

  const borderColor =
    (style?.borderColor as string | undefined) ??
    (isChecked ? visual?.selectedBorder : visual?.border) ??
    ("{color.border}" as TokenRef);

  const shapes: Shape[] = [
    {
      id: "box",
      type: "roundRect",
      x: 0,
      y: 0,
      width: boxSize,
      height: boxSize,
      radius: borderRadius as unknown as number,
      fill: bgColor,
    },
    {
      type: "border",
      target: "box",
      borderWidth,
      color: borderColor,
      radius: borderRadius as unknown as number,
    },
  ];

  if (isChecked && !props.isIndeterminate) {
    const pad = boxSize * 0.2;
    shapes.push(
      {
        type: "line",
        x1: pad,
        y1: boxSize * 0.5,
        x2: boxSize * 0.4,
        y2: boxSize - pad,
        stroke: "{color.white}" as TokenRef,
        strokeWidth: 2.5,
      },
      {
        type: "line",
        x1: boxSize * 0.4,
        y1: boxSize - pad,
        x2: boxSize - pad,
        y2: pad,
        stroke: "{color.white}" as TokenRef,
        strokeWidth: 2.5,
      },
    );
  } else if (props.isIndeterminate) {
    const pad = boxSize * 0.25;
    shapes.push({
      type: "line",
      x1: pad,
      y1: boxSize / 2,
      x2: boxSize - pad,
      y2: boxSize / 2,
      stroke: "{color.white}" as TokenRef,
      strokeWidth: 2.5,
    });
  }

  return shapes;
};

/**
 * `radio` — 라디오 indicator: outer ring(circle, fillAlpha 0) + border + inner dot(circle,
 * isSelected 시). label 은 자식 Label Element 담당. isSelected 시 ring/dot 색은 보편 상태축
 * (visual.selectedBorder = ring, visual.fill.default.selected = dot). (Radio primitive)
 */
const radio: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const outer = size.indicator?.boxSize ?? 20;
  const inner = size.indicator?.dotSize ?? 8;
  const outerRadius = outer / 2;
  const isSelected = props.isSelected === true;

  const borderWidth = parseBorderWidth(style?.borderWidth, 2);
  // ring border: selected=selectedBorder, 미선택=visual.border (이전 RADIO_*_COLORS 흡수).
  // fallback 은 variant 누락 방어 — 정상 spec 에선 도달 안 함(타입 만족).
  const borderColor =
    (style?.borderColor as string | undefined) ??
    (isSelected ? visual?.selectedBorder : visual?.border) ??
    ("{color.border-hover}" as TokenRef);

  // ring 배경은 투명(fillAlpha 0) — 색은 시각상 무의미하나 legacy parity 위해 fill base 사용.
  const ringFill = visual?.fill?.default.base ?? ("{color.base}" as TokenRef);

  const shapes: Shape[] = [
    {
      id: "ring",
      type: "circle",
      x: outerRadius,
      y: outerRadius,
      radius: outerRadius,
      fill: ringFill,
      fillAlpha: 0,
    },
    {
      type: "border",
      target: "ring",
      borderWidth,
      color: borderColor,
      radius: outerRadius,
    },
  ];

  if (isSelected) {
    shapes.push({
      type: "circle",
      x: outerRadius,
      y: outerRadius,
      radius: inner / 2,
      fill: visual?.fill?.default.selected ?? ("{color.accent}" as TokenRef),
    });
  }

  return shapes;
};

/**
 * `switch_toggle` — 스위치 indicator: track(roundRect) + border(비선택) + thumb(circle,
 * thumbX=isChecked? 우:좌). label 은 자식 Label Element 담당. track 색은 isChecked 시
 * 보편 상태축(visual.fill.default.selected), 비선택 시 accent-subtle(전 variant 공통). (Switch primitive)
 */
const switchToggle: SkiaPrimitiveDrawFn = ({ props, size, visual }) => {
  const trackWidth = size.indicator?.trackWidth ?? 36;
  const trackHeight = size.indicator?.trackHeight ?? 20;
  const thumbSize = size.indicator?.thumbSize ?? 16;
  const thumbOffset = size.indicator?.thumbOffset ?? 2;

  const isChecked = props.isSelected === true;
  // selected track = visual.fill.default.selected (이전 SWITCH_SELECTED_TRACK_COLORS 흡수).
  // 미선택 track 색(accent-subtle)은 모든 variant 공통이라 잔존(variant 차이 없음).
  const trackColor =
    isChecked && visual?.fill?.default.selected
      ? visual.fill.default.selected
      : ("{color.accent-subtle}" as TokenRef);

  const thumbX = isChecked ? trackWidth - thumbSize - thumbOffset : thumbOffset;
  const trackRadius = trackHeight / 2;

  const shapes: Shape[] = [
    {
      id: "track",
      type: "roundRect",
      x: 0,
      y: 0,
      width: trackWidth,
      height: trackHeight,
      radius: trackRadius,
      fill: trackColor,
    },
  ];

  if (!isChecked) {
    shapes.push({
      type: "border",
      target: "track",
      borderWidth: 2,
      color: "{color.border-hover}" as TokenRef,
      radius: trackRadius,
    });
  }

  shapes.push({
    id: "thumb",
    type: "circle",
    x: thumbX + thumbSize / 2,
    y: trackHeight / 2,
    radius: thumbSize / 2,
    fill: isChecked
      ? ("{color.white}" as TokenRef)
      : ("{color.neutral-subtle}" as TokenRef),
  });

  return shapes;
};

/**
 * `slider_thumb` — Slider 핸들: circle + border(replace). SliderThumb element 가
 * implicitStyles slidertrack 분기에서 left:percent% + width/height:thumbSize 로 배치되므로,
 * 자기 box(thumbSize) 안에 원형 핸들을 그린다 (box 중앙 기준). circle 이 전체 외형이라
 * base box 무의미 → replace(avatar/radio 선례 동형, append 아님).
 *
 * **ADR-912 collection sub-part cutover (2026-06-16, SliderThumb spec→catalog)**: 기존
 *   SliderThumb.spec.render.shapes(circle + border 2px {color.base})를 1:1 이전. SliderTrack 의
 *   slider_fill_bar 는 track + value 막대만 그리고 thumb 핸들은 본 escape 가 담당(렌더 소유권
 *   2026-06-10 SliderTrack→SliderThumb 이전 정합 유지). DOM 은 renderSlider(Slider.tsx)가 RAC
 *   SliderThumb 를 self-compose → SliderThumb element 는 DOM 미도달(Slider 가 DELEGATING_RAC_RENDERERS
 *   → 자식 재귀 skip), 본 escape 는 Skia 전용.
 *
 *   지름 = size.height(rule SliderThumb.sizes — Slider.indicator.thumbSize 14/18/22/26 미러).
 *   spec 정합 우선순위: style.width(layout 주입 thumbSize) 가 아니라 size.height 우선 — buildSpecNodeData
 *   가 size 변경마다 rule sizes 로 재계산하므로 신뢰 가능(spec 주석 정합). 색: thumb fill =
 *   style.backgroundColor → visual.fill.default.base → {color.accent}. border = {color.base} 2px(spec 정합).
 */
const sliderThumb: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const diameter =
    typeof size.height === "number" && size.height > 0 ? size.height : 18;
  const r = diameter / 2;
  const fillColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    ("{color.accent}" as TokenRef);
  void props;
  return [
    {
      id: "thumb",
      type: "circle",
      x: r,
      y: r,
      radius: r,
      fill: fillColor,
    },
    {
      type: "border",
      target: "thumb",
      borderWidth: 2,
      color: "{color.base}" as TokenRef,
      radius: r,
    },
  ];
};

// ===========================================================================
// ADR-142 Inc3 family ⑥(overlays) — overlay 시각 패턴 draw module (append 모드).
//
// portal/overlay 의 비-box+text 시각(shadow / V-arrow / backdrop)을 그린다. 값은 module 내부
// 상수(현 render.shapes 하드코딩 1:1 이식) — spec runtime 참조 0(#8), ComponentRule 스키마
// 확장 불필요(ADR-142 R4/HC#11 정본: 비-DOM-trivial = skiaPrimitive). dashed border 는 보편
// box 속성이라 buildCatalogShapes 가 직접 emit(별도 module 아님).
//
// **append 모드**: 이 draw fn 의 출력은 buildCatalogShapes(box+text) 출력에 **합성**된다
// (dispatch 가 SKIA_PRIMITIVE_MODES 로 판정). 기존 6 primitive 는 replace(box+text 대체).
// ===========================================================================

/**
 * Tooltip arrow maxWidth (size 별 Skia escape 데이터). ADR-912 단계5 step4 (2026-06-16):
 * Tooltip.spec.ts 삭제에 맞춰 TOOLTIP_MAX_WIDTH 를 skiaPrimitives 내부로 인라인 미러 이관
 * (ProgressCircle PROGRESSCIRCLE_DIAMETER 선례 — utils.ts). arrow maxWidth 는 Skia escape
 * 전용(generated CSS emit 무관, ComponentRuleSize 미수용) → rule 이관 대신 인라인 보존.
 */
const TOOLTIP_ARROW_MAX_WIDTH: Record<string, number> = {
  sm: 120,
  md: 150,
  lg: 200,
};

/**
 * `tooltip_arrow` — Tooltip V-arrow(placement 기반 2-line). showArrow===true 일 때만 적용.
 * 좌표식은 (구) TooltipSpec.render.shapes 1:1 이식(회귀 0). 색 = bg fill(style/visual).
 */
const tooltipArrow: SkiaPrimitiveDrawFn = ({ props, visual, style }) => {
  if (props.showArrow !== true) return null;
  const arrowSize = 6;
  const placement = (props.placement as string | undefined) ?? "top";
  const sizeName = (props.size as string | undefined) ?? "md";
  const maxWidth = TOOLTIP_ARROW_MAX_WIDTH[sizeName] ?? 150;
  const approxHeight = 24;
  const centerX = maxWidth / 2;
  // bg 색: style.backgroundColor → variant fill base (= legacy bgColor). dispatch 에서 visual
  // 항상 주입되므로 transparent fallback 은 타입 만족용(도달 안 함).
  const stroke: TokenRef = ((style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    "{color.transparent}") as TokenRef;

  if (placement === "top") {
    return [
      {
        type: "line",
        x1: centerX - arrowSize,
        y1: approxHeight,
        x2: centerX,
        y2: approxHeight + arrowSize,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: centerX + arrowSize,
        y1: approxHeight,
        x2: centerX,
        y2: approxHeight + arrowSize,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  if (placement === "bottom") {
    return [
      {
        type: "line",
        x1: centerX - arrowSize,
        y1: 0,
        x2: centerX,
        y2: -arrowSize,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: centerX + arrowSize,
        y1: 0,
        x2: centerX,
        y2: -arrowSize,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  if (placement === "right") {
    const midY = approxHeight / 2;
    return [
      {
        type: "line",
        x1: 0,
        y1: midY - arrowSize,
        x2: -arrowSize,
        y2: midY,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: 0,
        y1: midY + arrowSize,
        x2: -arrowSize,
        y2: midY,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  // left
  const midY = approxHeight / 2;
  return [
    {
      type: "line",
      x1: maxWidth,
      y1: midY - arrowSize,
      x2: maxWidth + arrowSize,
      y2: midY,
      stroke,
      strokeWidth: 2,
    },
    {
      type: "line",
      x1: maxWidth,
      y1: midY + arrowSize,
      x2: maxWidth + arrowSize,
      y2: midY,
      stroke,
      strokeWidth: 2,
    },
  ];
};

/**
 * `popover_arrow` — Popover V-arrow(placement 기반 2-line). !showArrow 일 때(기본 표시).
 * 좌표식은 PopoverSpec.render.shapes(L267-365) 1:1 이식(cx=cy=80 고정, arrowSize=8). 색 = bg fill.
 */
const popoverArrow: SkiaPrimitiveDrawFn = ({ props, visual, style }) => {
  if (props.showArrow) return null;
  const arrowSize = 8;
  const placement = (props.placement as string | undefined) ?? "bottom";
  const cx = 80;
  const cy = 80;
  const stroke: TokenRef = ((style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    "{color.transparent}") as TokenRef;

  if (placement === "bottom") {
    return [
      {
        type: "line",
        x1: cx - arrowSize,
        y1: 0,
        x2: cx,
        y2: -arrowSize,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: cx + arrowSize,
        y1: 0,
        x2: cx,
        y2: -arrowSize,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  if (placement === "top") {
    return [
      {
        type: "line",
        x1: cx - arrowSize,
        y1: cy,
        x2: cx,
        y2: cy + arrowSize,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: cx + arrowSize,
        y1: cy,
        x2: cx,
        y2: cy + arrowSize,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  if (placement === "right") {
    return [
      {
        type: "line",
        x1: 0,
        y1: cy - arrowSize,
        x2: -arrowSize,
        y2: cy,
        stroke,
        strokeWidth: 2,
      },
      {
        type: "line",
        x1: 0,
        y1: cy + arrowSize,
        x2: -arrowSize,
        y2: cy,
        stroke,
        strokeWidth: 2,
      },
    ];
  }
  // left
  return [
    {
      type: "line",
      x1: cx,
      y1: cy - arrowSize,
      x2: cx + arrowSize,
      y2: cy,
      stroke,
      strokeWidth: 2,
    },
    {
      type: "line",
      x1: cx,
      y1: cy + arrowSize,
      x2: cx + arrowSize,
      y2: cy,
      stroke,
      strokeWidth: 2,
    },
  ];
};

/**
 * `dialog_shadow` — Dialog drop shadow(offsetY:8 blur:24 alpha:0.2). target=bg.
 * 값은 (구) DialogSpec.render.shapes 하드코딩 1:1 이식. 보편 box-shadow 의 elevation 종류.
 */
const dialogShadow: SkiaPrimitiveDrawFn = () => [
  {
    type: "shadow",
    target: "bg",
    offsetX: 0,
    offsetY: 8,
    blur: 24,
    spread: 0,
    color: "rgba(0, 0, 0, 0.2)",
    alpha: 0.2,
  },
];

/**
 * `popover_shadow` — Popover drop shadow(offsetY:4 blur:12 alpha:0.15). target=bg.
 * 값은 PopoverSpec.render.shapes 하드코딩 1:1 이식. dialog 보다 약한 elevation.
 */
const popoverShadow: SkiaPrimitiveDrawFn = () => [
  {
    type: "shadow",
    target: "bg",
    offsetX: 0,
    offsetY: 4,
    blur: 12,
    spread: 0,
    color: "rgba(0, 0, 0, 0.15)",
    alpha: 0.15,
  },
];

/**
 * `overlay_backdrop` — Dialog 반투명 backdrop(전체 화면 rect, rgba(0,0,0,0.5)).
 * 값은 (구) DialogSpec.render.shapes 하드코딩 1:1 이식. modal overlay 패턴.
 */
const overlayBackdrop: SkiaPrimitiveDrawFn = () => [
  {
    type: "rect",
    x: -9999,
    y: -9999,
    width: 99999,
    height: 99999,
    fill: "rgba(0, 0, 0, 0.5)" as unknown as TokenRef,
    fillAlpha: 0.5,
  },
];

/**
 * `calendar_grid` — 월 단위 날짜 grid(nav + month/year text + 7 weekday + 최대 31 date cell +
 * today dot). box+text 로 표현 불가한 복합 primitive → `"replace"` 모드(box+text 대체).
 *
 * 값/좌표식은 `CalendarSpec.render.shapes`(Calendar.spec.ts) 1:1 이식 — 단, spec VariantSpec
 * (`variant.text`/`variant.border`/`resolveStateColors`) 대신 보편 rule 테이블에서 해소된
 * `ctx.visual`(text/border/fill.default[state]) + `ctx.size`(fontSize/borderRadius/iconSize)를
 * 읽는다(ADR-912 ②-6-A theme rule base SSOT 정합 — spec-free). RangeCalendar 도 동일 primitive
 * 사용(RangeCalendar.spec = `...CalendarSpec`, 시각 동형). 자식이 있으면(`_hasChildren`)
 * shell(bg+border)만, standalone 이면 full grid.
 */
const calendarGrid: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const borderRadius = parsePxValue(
    style?.borderRadius,
    size.borderRadius as unknown as number,
  );
  const cellSize = (size.iconSize ?? 28) + 4;
  const gap = (size.gap as unknown as number) || 6;
  const paddingX = (size.paddingX as unknown as number) || 8;
  const paddingY = (size.paddingY as unknown as number) || 8;
  const fontSize = resolveSpecFontSize(size.fontSize as string | number, 14);
  const calendarWidth = cellSize * 7 + gap * 6 + paddingX * 2;
  const ff = (style?.fontFamily as string) || fontFamily.sans;

  const textColor =
    (style?.color as string | undefined) ??
    visual?.text ??
    ("{color.neutral}" as TokenRef);
  const borderColor = visual?.border ?? ("{color.border}" as TokenRef);
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    ("{color.base}" as TokenRef);

  const headerHeight = cellSize;
  const navRowY = paddingY;
  const weekdayY = navRowY + headerHeight + gap;
  const gridStartY = weekdayY + cellSize;

  // January 2024: starts on Monday(dayOffset=1), 31 days. today=15(선택/today 표시 예시).
  const dayOffset = 1;
  const totalDays = 31;
  const today = 15;
  const totalRows = Math.ceil((totalDays + dayOffset) / 7);
  const totalHeight =
    gridStartY + totalRows * (cellSize + gap) - gap + paddingY;

  const hasChildren = !!(props as Record<string, unknown>)._hasChildren;

  const shapes: Shape[] = [
    {
      id: "bg",
      type: "roundRect" as const,
      x: 0,
      y: 0,
      width: hasChildren ? ("auto" as unknown as number) : calendarWidth,
      height: hasChildren ? ("auto" as unknown as number) : totalHeight,
      radius: borderRadius,
      fill: bgColor,
    },
    {
      type: "border" as const,
      target: "bg",
      borderWidth: 1,
      color: borderColor,
      radius: borderRadius,
    },
  ];

  if (hasChildren) return shapes;

  shapes.push(
    {
      type: "icon_font" as const,
      iconName: "chevron-left",
      x: paddingX + cellSize / 2,
      y: navRowY + headerHeight / 2,
      fontSize: fontSize + 2,
      fill: textColor,
      strokeWidth: 2,
    },
    {
      type: "text" as const,
      x: paddingX + cellSize,
      y: navRowY + headerHeight / 2,
      text: (() => {
        const loc = props.calendarSystem
          ? `${props.locale || "en-US"}-u-ca-${props.calendarSystem}`
          : (props.locale as string) || "ko-KR";
        try {
          return new Intl.DateTimeFormat(loc, {
            year: "numeric",
            month: "long",
          }).format(new Date());
        } catch {
          return "2024년 1월";
        }
      })(),
      fontSize,
      fontFamily: ff,
      fontWeight: 700,
      fill: textColor,
      align: "center" as const,
      baseline: "middle" as const,
      maxWidth: calendarWidth - (paddingX + cellSize) * 2,
    },
    {
      type: "icon_font" as const,
      iconName: "chevron-right",
      x: calendarWidth - paddingX - cellSize / 2,
      y: navRowY + headerHeight / 2,
      fontSize: fontSize + 2,
      fill: textColor,
      strokeWidth: 2,
    },
  );

  const effectiveLocale = props.calendarSystem
    ? `${props.locale || "en-US"}-u-ca-${props.calendarSystem}`
    : (props.locale as string) || "en-US";
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i); // 2024-01-07 = Sunday
    try {
      return new Intl.DateTimeFormat(effectiveLocale, {
        weekday: "short",
      }).format(d);
    } catch {
      return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][i];
    }
  });
  for (let col = 0; col < 7; col++) {
    const cellLeft = paddingX + col * (cellSize + gap);
    shapes.push({
      type: "text" as const,
      x: cellLeft,
      y: weekdayY + cellSize / 2,
      text: weekdays[col],
      fontSize: fontSize - 2,
      fontFamily: ff,
      fontWeight: 700,
      fill: "{color.neutral-subdued}" as TokenRef,
      align: "center" as const,
      baseline: "middle" as const,
      maxWidth: cellSize,
      whiteSpace: "nowrap" as const,
    });
  }

  for (let day = 1; day <= totalDays; day++) {
    const idx = day - 1 + dayOffset;
    const row = Math.floor(idx / 7);
    const col = idx % 7;
    const cellLeft = paddingX + col * (cellSize + gap);
    const cx = cellLeft + cellSize / 2;
    const cy = gridStartY + row * (cellSize + gap) + cellSize / 2;

    shapes.push({
      type: "text" as const,
      x: cellLeft,
      y: cy,
      text: String(day),
      fontSize,
      fontFamily: ff,
      fontWeight: day === today ? 700 : 400,
      fill: textColor,
      align: "center" as const,
      baseline: "middle" as const,
      maxWidth: cellSize,
      whiteSpace: "nowrap" as const,
    });

    if (day === today) {
      shapes.push({
        type: "circle" as const,
        x: cx,
        y: cy + cellSize / 2 - 4,
        radius: 3,
        fill: "{color.accent}" as TokenRef,
      });
    }
  }

  return shapes;
};

/**
 * `calendar_month_grid` — Calendar compound 의 **CalendarGrid 자식** leaf(요일 헤더 7 + 날짜 셀 +
 * today dot circle). nav(월/년 + chevron)는 **CalendarHeader 자식**(`inline_icon_text`)이 담당하므로
 * 본 escape 는 nav 없이 grid 부분만 self-render — 부모 `calendar_grid`(Calendar 전체, nav 포함)와 별개.
 *
 * **ADR-912 (A/2D) CalendarGrid 발효 (replace, 2026-06-08)**: recon(6축) 으로 즉시 차단 absent 확정 —
 *   day cell 을 spec self-render(자식 NO_SPEC 차단 없음), date state = static props 자기충족
 *   (dayOffset/totalDays/todayDate, RAC CalendarState 비의존 — SliderTrack controller-free 동형).
 *   CalendarHeader 동형 standalone replace escape. circle(today dot) + 2D 절대좌표 self-positioning →
 *   generic buildCatalogShapes box+text 로 재현 불가 → replace 모드(자체 grid box 생성).
 *
 * 좌표 = CalendarGrid.spec.ts render.shapes 1:1: cellSize=iconSize+4, weekdayY=cellSize/2,
 *   gridStartY=cellSize(요일 행 바로 아래, nav 없음). day x=cellLeft(col*(cellSize+gap)),
 *   y=gridStartY+row*(cellSize+gap)+cellSize/2. today circle x=cellCenter, y=cy+cellSize/2-4, radius:3.
 * spec-free: visual rule(text/transparent fill) + props(dayOffset/totalDays/todayDate/locale) 만 읽음.
 *
 * **DOM = 부모 Calendar/RangeCalendar self-compose(독립 노드 0)**: Calendar.tsx:122-128 의
 *   `<div className="calendar-grids"><CalendarGrid offset>{(date)=><CalendarCell/>}</CalendarGrid>`
 *   가 RAC self-compose → canonical CalendarGrid 자식은 DOM drop. 발효 가치 = Skia 대칭 한정.
 */
const calendarMonthGrid: SkiaPrimitiveDrawFn = ({ props, size, visual }) => {
  const iconSize = (size.iconSize as unknown as number) ?? 26;
  const cellSize = iconSize + 4;
  const gap = (size.gap as unknown as number) || 6;
  const fontSize = resolveSpecFontSize(size.fontSize as string | number, 14);
  const ff =
    ((props.style as Record<string, unknown> | undefined)
      ?.fontFamily as string) || fontFamily.sans;

  const textColor =
    ((props.style as Record<string, unknown> | undefined)?.color as
      | string
      | undefined) ??
    visual?.text ??
    ("{color.neutral}" as TokenRef);

  // 요일 헤더 행 바로 아래에서 날짜 그리드 시작 (nav 없음 — CalendarGrid.spec.ts:147-148 동형).
  const weekdayY = cellSize / 2;
  const gridStartY = cellSize;

  const now = new Date();
  const dayOffset =
    (props.dayOffset as number | undefined) ??
    new Date(now.getFullYear(), now.getMonth(), 1).getDay();
  const totalDays =
    (props.totalDays as number | undefined) ??
    new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const showToday = props.defaultToday === true;
  const today = showToday
    ? ((props.todayDate as number | undefined) ?? now.getDate())
    : -1;

  const shapes: Shape[] = [];

  const effectiveLocale = props.calendarSystem
    ? `${props.locale || "en-US"}-u-ca-${props.calendarSystem}`
    : (props.locale as string) || "en-US";
  const weekdays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(2024, 0, 7 + i); // 2024-01-07 = Sunday
    try {
      return new Intl.DateTimeFormat(effectiveLocale, {
        weekday: "short",
      }).format(d);
    } catch {
      return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][i];
    }
  });
  for (let col = 0; col < 7; col++) {
    const cellLeft = col * (cellSize + gap);
    shapes.push({
      type: "text" as const,
      x: cellLeft,
      y: weekdayY,
      text: weekdays[col],
      fontSize,
      fontFamily: ff,
      fontWeight: 700,
      fill: "{color.neutral-subdued}" as TokenRef,
      align: "center" as const,
      baseline: "middle" as const,
      maxWidth: cellSize,
      whiteSpace: "nowrap" as const,
    });
  }

  for (let day = 1; day <= totalDays; day++) {
    const idx = day - 1 + dayOffset;
    const row = Math.floor(idx / 7);
    const col = idx % 7;
    const cellLeft = col * (cellSize + gap);
    const cx = cellLeft + cellSize / 2;
    const cy = gridStartY + row * (cellSize + gap) + cellSize / 2;

    shapes.push({
      type: "text" as const,
      x: cellLeft,
      y: cy,
      text: String(day),
      fontSize,
      fontFamily: ff,
      fontWeight: day === today ? 700 : 400,
      fill: textColor,
      align: "center" as const,
      baseline: "middle" as const,
      maxWidth: cellSize,
      whiteSpace: "nowrap" as const,
    });

    if (day === today) {
      shapes.push({
        type: "circle" as const,
        x: cx,
        y: cy + cellSize / 2 - 4,
        radius: 3,
        fill: "{color.accent}" as TokenRef,
      });
    }
  }

  return shapes;
};

/**
 * `datefield_trigger` — DatePicker/DateRangePicker 의 입력 trigger field(input box + display
 * text + 후행 calendar icon). box+text+icon 복합 → `"replace"` 모드(box+text 대체).
 *
 * 값/좌표식은 `buildDatePickerShapes`(DatePicker.spec.ts) 재사용 — display text 는 props 의
 * value/startDate·endDate/placeholder 에서 조립(DatePicker = value, DateRangePicker = range).
 * 자식이 있으면(`_hasChildren`) 투명 컨테이너(빈 배열). DateRangePicker 는 기본 폭 320.
 * spec-free: buildDatePickerShapes 는 props.style/sizeEntry(size) 만 읽어 spec VariantSpec 미참조.
 */
const datefieldTrigger: SkiaPrimitiveDrawFn = ({ props, size }) => {
  if ((props as Record<string, unknown>)._hasChildren) return [];

  const locale = (props.locale as string) || "en-US";
  const isRange =
    props.startDate !== undefined ||
    props.endDate !== undefined ||
    props._dateRange === true;

  let displayText: string;
  let hasValue: boolean;
  let defaultContainerWidth: number;
  if (isRange) {
    if (props.startDate && props.endDate) {
      displayText = `${props.startDate} – ${props.endDate}`;
      hasValue = true;
    } else {
      // range placeholder = "single – single" (DateRangePicker.spec buildRangePlaceholder 동형,
      // 파일-로컬 helper 재export 대신 공개 buildDatePlaceholder 로 인라인 조립).
      const single = buildDatePlaceholder(locale);
      displayText = (props.placeholder as string) || `${single} – ${single}`;
      hasValue = false;
    }
    defaultContainerWidth = 320;
  } else {
    displayText =
      (props.value as string) ||
      (props.placeholder as string) ||
      buildDatePlaceholder(locale);
    hasValue = !!props.value;
    defaultContainerWidth = 200;
  }

  // sizeEntry 는 DATE_PICKER_SIZES(spec 공유 sizes) 에서 size 이름으로 조회 — ctx.size 의
  // calendar 류 base 가 아니라 date-picker 전용 height/padding/iconSize 가 필요하기 때문.
  const sizeName = (props.size as string) || "md";
  const sizeEntry =
    (DATE_PICKER_SIZES as Record<string, Record<string, unknown>>)[sizeName] ??
    (DATE_PICKER_SIZES as Record<string, Record<string, unknown>>).md ??
    (size as unknown as Record<string, unknown>);

  return buildDatePickerShapes({
    props: props as unknown as Record<string, unknown>,
    sizeEntry,
    displayText,
    hasValue,
    defaultContainerWidth,
  });
};

/**
 * `datefield_segments` — DateField/TimeField/DatePicker/DateRangePicker 의 **입력 영역 자식**
 * (DateInput leaf): input box + border + 세그먼트 placeholder text(+picker 일 때 후행 calendar
 * icon). box+border+text(+icon) 복합 → `"replace"` 모드(box+text 대체).
 *
 * **datefield_trigger 와 구분**: datefield_trigger 는 **부모 DatePicker/DateRangePicker 가 그리는
 * trigger field 전체** (자식 없을 때, buildDatePickerShapes 재사용). datefield_segments 는 **자식
 * DateInput element 자신** 이 그리는 입력 box+segment placeholder. 부모가 `_hasChildren` 으로 자식
 * DateInput 에 위임하면(datefield_trigger 가 `[]` 반환) DateInput 자식이 본 escape 로 그린다.
 *
 * spec-free: DateInput.spec.ts:218-331 render.shapes 의 4-parent 분기(`_parentTag`) 를 이식.
 * props 의 `_parentTag`/`_granularity`/`_hourCycle`/`_locale`/`_containerWidth` + visual rule
 * (variant text/border/fill) 만 읽음 — spec VariantSpec 미참조. controller(RAC DateFieldState) 비의존
 * (static placeholder text, CalendarGrid 동형).
 */
const datefieldSegments: SkiaPrimitiveDrawFn = ({ props, size, visual }) => {
  const p = props as Record<string, unknown>;
  const style = (p.style as Record<string, unknown> | undefined) ?? undefined;

  const sizeName = (p.size as string) || "md";
  const parentTag = (p._parentTag as string) || "DateField";
  const granularity =
    (p._granularity as string) ||
    (parentTag === "TimeField" ? "minute" : "day");
  const hourCycle = p._hourCycle as number | undefined;
  const locale = (p._locale as string) || "en-US";

  const DF_HEIGHT: Record<string, number> = {
    xs: 20,
    sm: 22,
    md: 30,
    lg: 42,
    xl: 54,
  };
  const DF_PADDING_X: Record<string, number> = {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  };
  const DF_PADDING_Y: Record<string, number> = {
    xs: 1,
    sm: 2,
    md: 4,
    lg: 8,
    xl: 12,
  };
  const DF_RADIUS: Record<string, number> = {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
  };

  const inputHeight = DF_HEIGHT[sizeName] ?? DF_HEIGHT.md;
  const paddingX = DF_PADDING_X[sizeName] ?? DF_PADDING_X.md;
  const borderRadius = DF_RADIUS[sizeName] ?? DF_RADIUS.md;
  const fontSize = resolveSpecFontSize(
    (style?.fontSize as string | number | undefined) ??
      (size.fontSize as string | number | undefined),
    14,
  );
  const containerWidth =
    (typeof p._containerWidth === "number" && (p._containerWidth as number)) ||
    (typeof style?.width === "number" && (style.width as number)) ||
    200;

  const borderColor =
    (style?.borderColor as string | undefined) ??
    visual?.border ??
    ("{color.border}" as TokenRef);
  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default?.base ??
    ("{color.layer-2}" as TokenRef);
  const textColor =
    (style?.color as string | undefined) ??
    visual?.text ??
    ("{color.neutral}" as TokenRef);
  const ff = (style?.fontFamily as string | undefined) || fontFamily.sans;

  // 세그먼트 placeholder text (locale 분기 — DateInput.spec buildDateText/buildTimeText 이식).
  const isAsian = /^(ko|ja|zh)/.test(locale);
  const isEuropean = /^(de|fr|es|it|pt|ru)/.test(locale);
  let dateText: string;
  if (isAsian) dateText = "YYYY / MM / DD";
  else if (isEuropean) dateText = "DD / MM / YYYY";
  else dateText = "MM / DD / YYYY";
  const hasTime =
    granularity === "hour" ||
    granularity === "minute" ||
    granularity === "second";
  const timeSeg = (() => {
    let t = "HH : MM";
    if (granularity === "second") t += " : SS";
    if (hourCycle === 12) t += "  AM";
    return t;
  })();
  const displayText =
    parentTag === "TimeField"
      ? timeSeg
      : parentTag === "DateRangePicker"
        ? `${dateText} – ${dateText}`
        : hasTime
          ? `${dateText}  ${timeSeg}`
          : dateText;

  const isPickerInput =
    parentTag === "DatePicker" || parentTag === "DateRangePicker";
  const padRight = isPickerInput
    ? (DF_PADDING_Y[sizeName] ?? DF_PADDING_Y.md)
    : paddingX;
  const iconSz = isPickerInput
    ? ({ xs: 10, sm: 14, md: 16, lg: 20, xl: 22 }[sizeName] ?? 16)
    : 0;
  const gap = isPickerInput ? 4 : 0;

  const shapes: Shape[] = [
    {
      id: "input-bg",
      type: "roundRect" as const,
      x: 0,
      y: 0,
      width: containerWidth,
      height: inputHeight,
      radius: borderRadius,
      fill: bgColor,
    },
    {
      type: "border" as const,
      target: "input-bg",
      borderWidth: 1,
      color: borderColor,
      radius: borderRadius,
    },
    {
      type: "text" as const,
      x: paddingX,
      y: 0,
      text: displayText,
      fontSize,
      fontFamily: ff,
      fontWeight: 400,
      fill: textColor,
      align: "left" as const,
      baseline: "middle" as const,
      // CSS Group(white-space:nowrap) 정합 — Skia 는 box+text+icon 을 한 노드에 그려,
      //   box width:100%(부모폭)면 좁은 폭에서 text 가 maxWidth 에서 줄바꿈된다. CSS 의
      //   field box(.react-aria-Group)는 nowrap 이라 한 줄 유지(넘치면 overflow) →
      //   Skia text 도 nowrap(nodeRendererText: nowrap → layoutMaxWidth 무한, 줄바꿈 금지).
      whiteSpace: "nowrap" as const,
      maxWidth: isPickerInput
        ? containerWidth - paddingX - iconSz - gap - padRight
        : undefined,
    },
  ];

  if (isPickerInput) {
    shapes.push({
      type: "icon_font" as const,
      iconName: "calendar",
      x: containerWidth - padRight - iconSz / 2 - 4,
      y: inputHeight / 2,
      fontSize: iconSz,
      fill: "{color.neutral-subdued}" as TokenRef,
      strokeWidth: 2,
    });
  }

  return shapes;
};

/**
 * `value_fill_bar` — 진행/미터/슬라이더의 value 비례 수평 채움 막대 (append 모드).
 *
 * track box(buildCatalogShapes 가 그림) **위에** 덧그리는 fill rect. 컴포넌트 식별 없이
 * props 데이터로만 분기(no-classification):
 * - `props.value` 가 배열 → range 채움(`v0%~v1%`), 단일 숫자 → `0~v%` 채움.
 * - `props.minValue`/`maxValue` → 정규화(slider). 없으면 0~100(progress/meter).
 * - `props.isIndeterminate` → 정적 20%~50% 막대(애니메이션은 CSS, Skia 는 정적 표현).
 * - `props._hasChildren` → 부모(ProgressBar/Meter)는 자식 Track 이 fill 담당 → `[]` (위임).
 *   Track 노드는 자식 없음 → 직접 그림. thumb 은 SliderThumb 자식 element 가 담당(여기 미생성).
 *
 * 색: `style.color`(사용자 override) → `visual.fillBar`(variant 별 rule 색) → `{color.accent}`.
 */
const valueFillBar: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  // 부모(ProgressBar/Meter) standalone 이 아니면(자식 Track 보유) fill 은 자식이 담당.
  if ((props as Record<string, unknown>)._hasChildren) return [];

  const width =
    typeof props._containerWidth === "number" &&
    (props._containerWidth as number) > 0
      ? (props._containerWidth as number)
      : (typeof style?.width === "number" ? (style.width as number) : 0) || 240;
  const height = size.height ?? 8;

  const barRadius = parsePxValue(
    style?.borderRadius as string | number | undefined,
    typeof size.borderRadius === "number" ? size.borderRadius : height / 2,
  );

  const barColor =
    (style?.color as string | undefined) ??
    visual?.fillBar ??
    ("{color.accent}" as TokenRef);

  // indeterminate: 정적 20%~50% 위치 막대 (progress 류만 — isIndeterminate 데이터)
  if (props.isIndeterminate) {
    return [
      {
        type: "roundRect",
        x: width * 0.2,
        y: 0,
        width: width * 0.3,
        height,
        radius: barRadius,
        fill: barColor,
      },
    ];
  }

  const min = typeof props.minValue === "number" ? props.minValue : 0;
  const max = typeof props.maxValue === "number" ? props.maxValue : 100;
  const span = max - min || 1;
  const raw = props.value ?? 0;
  const values = Array.isArray(raw) ? (raw as number[]) : [raw as number];
  const percents = values.map((v) =>
    Math.max(0, Math.min(100, ((v - min) / span) * 100)),
  );

  const shapes: Shape[] = [];
  if (percents.length >= 2) {
    // range: value[0]~value[1] 구간 채움
    const x0 = (width * percents[0]) / 100;
    const x1 = (width * percents[1]) / 100;
    const w = x1 - x0;
    if (w > 0) {
      shapes.push({
        type: "roundRect",
        x: x0,
        y: 0,
        width: w,
        height,
        radius: barRadius,
        fill: barColor,
      });
    }
  } else {
    // single: 0~value 채움
    const w = (width * percents[0]) / 100;
    if (w > 0) {
      shapes.push({
        type: "roundRect",
        x: 0,
        y: 0,
        width: w,
        height,
        radius: barRadius,
        fill: barColor,
      });
    }
  }
  return shapes;
};

/**
 * `slider_fill_bar` — 슬라이더 트랙 (track 배경 + value 채움 + thumb 핸들, replace 모드).
 *
 * `value_fill_bar`(Progress/Meter, append)와 다른 점:
 * - **thumb(핸들 원 + border)** 를 percent 위치에 그린다 — single 1개 / range 2개.
 * - thumb 지름(`size.thumbSize`)이 trackHeight 보다 커서 layout box 가 thumbSize(implicitStyles
 *   ADR-086 P2) 라 box 좌표계(y:0, height:auto)와 spec track(y=trackY 세로 중앙)이 어긋난다 →
 *   **replace 모드**(track box 도 자체 생성, buildCatalogShapes box 대체). `value_fill_bar`(leaf,
 *   box=trackHeight 정확)는 append 였지만 SliderTrack 은 thumb 컨테이너라 replace.
 * - SliderThumb 자식 element 의 spec.render.shapes 는 `[]`(hitbox 만) → thumb 를 여기서 그려도
 *   이중 렌더 0 (calendar_grid escape 동형). `_hasChildren` 체크 없음(SliderThumb 자식이라 항상
 *   true → value_fill_bar 의 `_hasChildren` early-return 에 걸리는 dead 분기를 본 primitive 가 우회).
 *
 * 좌표 (2026-06-10): layout box height = trackHeight(8, ProgressBarTrack 동일)로 통일됨.
 *   트랙은 box 전체(trackY=0, height=trackHeight). thumb 은 box 세로 중앙(trackHeight/2) 기준
 *   ±thumbSize/2 로 box 밖으로 그린다 (DOM 의 thumb position:absolute 와 동형 — box layout 제외).
 *   thumb x=width*p/100, y=trackHeight/2. (이전: box=thumbSize 18px 전제로 trackY=세로중앙 였음)
 * 색: track 배경 = `style.backgroundColor` → `visual.fill.default.base`(neutral-subtle).
 *     fill = `style.color` → `visual.fillBar` → `{color.accent}`. thumb = fill 과 동색(handle=accent).
 *     thumb border = `{color.base}` 2px(spec 정합).
 */
const sliderFillBar: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const width =
    typeof props._containerWidth === "number" &&
    (props._containerWidth as number) > 0
      ? (props._containerWidth as number)
      : (typeof style?.width === "number" ? (style.width as number) : 0) || 200;

  const trackHeight =
    typeof size.height === "number" && size.height > 0 ? size.height : 8;
  // layout box height = trackHeight(ProgressBarTrack 동일) → 트랙은 box 전체.
  //   thumb 핸들은 SliderThumb element 가 자체 렌더(렌더 소유권 이전, 2026-06-10).
  const trackY = 0;
  const trackRadius = trackHeight / 2;

  const trackBgColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    ("{color.neutral-subtle}" as TokenRef);
  const fillColor =
    (style?.color as string | undefined) ??
    visual?.fillBar ??
    ("{color.accent}" as TokenRef);

  const min = typeof props.minValue === "number" ? props.minValue : 0;
  const max = typeof props.maxValue === "number" ? props.maxValue : 100;
  const span = max - min || 1;
  const raw = props.value ?? 50;
  const values = Array.isArray(raw) ? (raw as number[]) : [raw as number];
  const percents = values.map((v) =>
    Math.max(0, Math.min(100, ((v - min) / span) * 100)),
  );
  const isRange = percents.length >= 2;

  const shapes: Shape[] = [
    // track 배경 (세로 중앙)
    {
      id: "track",
      type: "roundRect",
      x: 0,
      y: trackY,
      width,
      height: trackHeight,
      radius: trackRadius,
      fill: trackBgColor,
    },
  ];

  // value 채움 (single: 0~value / range: value[0]~value[1])
  if (isRange) {
    const x0 = (width * percents[0]) / 100;
    const x1 = (width * percents[1]) / 100;
    const w = x1 - x0;
    if (w > 0) {
      shapes.push({
        id: "fill",
        type: "roundRect",
        x: x0,
        y: trackY,
        width: w,
        height: trackHeight,
        radius: trackRadius,
        fill: fillColor,
      });
    }
  } else {
    const w = (width * percents[0]) / 100;
    if (w > 0) {
      shapes.push({
        id: "fill",
        type: "roundRect",
        x: 0,
        y: trackY,
        width: w,
        height: trackHeight,
        radius: trackRadius,
        fill: fillColor,
      });
    }
  }

  // 2026-06-10: thumb 핸들 렌더는 SliderThumb element(SliderThumb.spec.render.shapes)로 이전.
  //   slider_fill_bar 는 track 배경 + value 채움만 그린다 (value_fill_bar 와 동형, 단 replace 모드
  //   유지 — SliderTrack box 자체 생성). SliderThumb element 가 left:percent% 위치에 원형 핸들을
  //   자체 렌더 → DOM(RAC SliderThumb) 과 아키텍처 대칭 + SliderThumb 삭제 시 thumb 사라짐.

  return shapes;
};

/**
 * `value_fill_arc` — 원형 진행률의 value 비례 호 (append 모드, ProgressCircle).
 *
 * track arc(buildCatalogShapes box 위 — 단, ProgressCircle 은 box 대신 arc track 을
 * 별도 그려야 함 → 본 primitive 가 track + indicator 둘 다 그린다, replace 가 아니라
 * append 지만 track box 가 무의미하므로 자체 track arc 포함).
 * - `props.value`(0~100) → `sweepAngle = value%×360` indicator arc.
 * - `props.isIndeterminate` → 270° 정적 호.
 * - `props._hasChildren` → 자식이 담당 → `[]`.
 *
 * 색: track = `visual.fill.default.base`(neutral-subtle) / indicator = `style.color` →
 * `visual.fillBar` → `{color.accent}`.
 */
const valueFillArc: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  if ((props as Record<string, unknown>)._hasChildren) return [];

  const diameter =
    (typeof size.width === "number" ? size.width : 0) ||
    (typeof size.height === "number" ? size.height : 0) ||
    32;
  const strokeWidth =
    typeof size.strokeWidth === "number" ? size.strokeWidth : 3;
  const outerRadius = diameter / 2;
  const cx = outerRadius;
  const cy = outerRadius;
  const trackRadius = outerRadius - strokeWidth / 2;

  const trackColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    ("{color.neutral-subtle}" as TokenRef);
  const indicatorColor =
    (style?.color as string | undefined) ??
    visual?.fillBar ??
    ("{color.accent}" as TokenRef);

  const shapes: Shape[] = [
    {
      type: "arc",
      x: cx,
      y: cy,
      radius: trackRadius,
      startAngle: 0,
      sweepAngle: 360,
      strokeWidth,
      stroke: trackColor,
      strokeCap: "butt",
    },
  ];

  if (props.isIndeterminate) {
    shapes.push({
      type: "arc",
      x: cx,
      y: cy,
      radius: trackRadius,
      startAngle: -90,
      sweepAngle: 270,
      strokeWidth,
      stroke: indicatorColor,
      strokeCap: "round",
    });
  } else {
    const value = Math.max(
      0,
      Math.min(100, typeof props.value === "number" ? props.value : 0),
    );
    if (value > 0) {
      shapes.push({
        type: "arc",
        x: cx,
        y: cy,
        radius: trackRadius,
        startAngle: -90,
        sweepAngle: (value / 100) * 360,
        strokeWidth,
        stroke: indicatorColor,
        strokeCap: "round",
      });
    }
  }
  return shapes;
};

/**
 * `leading_icon` — 텍스트 좌측 아이콘 (DisclosureHeader chevron 등, ADR-912 (B+icon), append 모드).
 *
 * base box+text(buildCatalogShapes 가 그림) **위에** 좌측 leading icon glyph 를 덧그린다. text 는
 * buildCatalogShapes 가 `size.iconSize` 존재 시 `iconSize + gap` 만큼 우측 shift 하므로 본 module 은
 * icon 만 그린다(text 미생성 — 중복 방지). icon_font(중앙 고정 단일 glyph)와 달리 **좌측 paddingX
 * 기준 배치** — generic leading-icon 채널.
 *
 * 데이터 분기(컴포넌트 식별 없음 — ADR-142 §3):
 * - `visual.leadingIcon` 미정의 → `[]`(leading icon 없는 일반 box+text 는 본 module 미적용).
 * - icon glyph 크기 = `size.iconSize`(rule, size 별). 미정의 시 fontSize 기반 fallback.
 * - x = paddingX(buildCatalogShapes 와 동일 기준: style.paddingLeft ?? size.paddingX ?? 0) + iconSize/2.
 * - y = size.height/2(box 수직 중앙 — base text baseline:"middle" 과 정렬). height 0 이면 fontSize 기반.
 * - color = visual.leadingIcon.color → visual.text fallback.
 */
const leadingIcon: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const li = visual?.leadingIcon;
  if (!li) return [];

  // ADR-912 R1 후속 (TreeItem catalog cutover): TreeItem chevron 은 자식 TreeItem 이
  //   있을 때만 표시한다. buildSpecNodeData 가 `_hasTreeChildren`(boolean)을 주입 —
  //   명시적 false 면 chevron skip(leaf TreeItem). 미주입(undefined, 예 DisclosureHeader)
  //   은 기존대로 항상 표시(데이터 분기 — 컴포넌트별 if 아님, ADR-142 §3).
  if (props._hasTreeChildren === false) return [];

  const fontSize = resolveSpecFontSize(
    (style?.fontSize as string | number | undefined) ?? size.fontSize,
    14,
  );
  const iconSize =
    typeof size.iconSize === "number" && size.iconSize > 0
      ? size.iconSize
      : Math.round(fontSize * 1.1);
  const paddingX =
    parsePxValue(
      (style?.paddingLeft ?? style?.paddingRight ?? style?.padding) as
        | string
        | number
        | undefined,
      size.paddingX ?? 0,
    ) + resolveTreeIndent(props, size); // TreeItem depth 들여쓰기 (text 와 동일 helper)
  const height =
    typeof size.height === "number" && size.height > 0
      ? size.height
      : fontSize + 16; // height 미지정 시 fontSize + paddingY*2(8*2) 가정
  const iconColor =
    (style?.color as string | undefined) ??
    li.color ??
    visual?.text ??
    ("{color.neutral-subdued}" as TokenRef);

  // ADR-912 Disclosure 버그 수정 (2026-06-10): chevron 류 leadingIcon 은 isExpanded
  //   상태에 따라 방향 전환. RAC 공식 CSS 는 `&[data-expanded] svg { rotate: 90deg }`
  //   (chevron-right → 90° = ⌄) 인데 Skia 는 transient rotate 미지원이라 glyph 자체를
  //   chevron-down(expanded)/chevron-right(collapsed)로 바꾼다. isExpanded 는 부모
  //   Disclosure 에서 buildSpecNodeData(resolveDisclosureHeaderParent)가 전파. chevron 류가
  //   아닌 leadingIcon(다른 컴포넌트)은 li.name 그대로 — 데이터 분기(컴포넌트 식별 없음).
  const isChevron = li.name === "chevron-right" || li.name === "chevron-down";
  const iconName =
    isChevron && props.isExpanded === true ? "chevron-down" : li.name;

  return [
    {
      type: "icon_font",
      iconName,
      x: paddingX + iconSize / 2,
      y: height / 2,
      fontSize: iconSize,
      fill: iconColor,
      strokeWidth: (props.strokeWidth as number | undefined) ?? 2,
    },
  ];
};

/**
 * `inline_icon_text` — 좌측 icon + 중앙 text + 우측 icon (CalendarHeader 등, ADR-912 (B+icon), replace 모드).
 *
 * leading_icon(좌측 단일 icon + left-align text, append)과 **다른 레이아웃 가정** — 좌·우 icon 양측 +
 * center text 라 buildCatalogShapes 의 box+text(좌측/center 단일 text)로 표현 불가 → 별도 module 로
 * **전체 3-shape 자기 생성(replace)**. CalendarHeader.spec.ts render.shapes 의 좌표 공식과 1:1 대칭.
 *
 * 데이터 분기(컴포넌트 식별 없음 — ADR-142 §3):
 * - `visual.leadingIcon` && `visual.trailingIcon` 둘 다 존재해야 적용 → 미충족 시 `[]`(leading_icon
 *   단일 또는 일반 box+text 가 처리).
 * - cellSize = `size.iconSize + 4`(spec dims.iconSize + 4 과 동형). 좌 icon x = cellSize/2,
 *   text x = cellSize(align=center, maxWidth=width-cellSize*2), 우 icon x = width - cellSize/2.
 * - width = `_containerWidth`(CONTAINER_DIMENSION_TAGS 주입) ?? `style.width` ?? `cellSize*7 + gap*6` 폴백.
 * - text = props.locale/calendarSystem Intl(year long month) → props.children → "2024년 1월" fallback
 *   (spec render.shapes 동형).
 * - color = visual.text(좌우 icon 동일), textAlign = visual.textAlign ?? "center".
 */
const inlineIconText: SkiaPrimitiveDrawFn = ({
  props,
  size,
  visual,
  style,
}) => {
  const li = visual?.leadingIcon;
  const ti = visual?.trailingIcon;
  // 좌·우 icon 둘 다 있어야 inline_icon_text 모델 — 아니면 leading_icon/box+text 가 처리.
  if (!li || !ti) return null;

  const fontSize = resolveSpecFontSize(
    (style?.fontSize as string | number | undefined) ?? size.fontSize,
    14,
  );
  const iconSize =
    typeof size.iconSize === "number" && size.iconSize > 0
      ? size.iconSize
      : Math.round(fontSize * 1.1) + 12; // CalendarHeader dims.iconSize(md 26) 근사
  const cellSize = iconSize + 4;
  const gap = typeof size.gap === "number" && size.gap > 0 ? size.gap : 6;
  const height =
    typeof size.height === "number" && size.height > 0 ? size.height : 30;
  const cy = height / 2;

  // width: _containerWidth(CONTAINER_DIMENSION 주입) > style.width > 폴백(cellSize*7 + gap*6).
  const containerWidth = (props._containerWidth as number | undefined) ?? 0;
  const rawStyleWidth = style?.width;
  const styleWidth =
    typeof rawStyleWidth === "number"
      ? rawStyleWidth
      : typeof rawStyleWidth === "string"
        ? parseFloat(rawStyleWidth)
        : 0;
  const width =
    containerWidth > 0
      ? containerWidth
      : styleWidth > 0
        ? styleWidth
        : cellSize * 7 + gap * 6;

  const textColor =
    (style?.color as string | undefined) ?? visual?.text ?? undefined;
  const iconColor = li.color ?? ti.color ?? textColor;
  const textAlign = visual?.textAlign ?? "center";
  const text =
    typeof props.children === "string" && props.children
      ? props.children
      : "2024년 1월";

  return [
    {
      type: "icon_font",
      iconName: li.name,
      x: cellSize / 2,
      y: cy,
      fontSize: fontSize + 2,
      fill: iconColor,
      strokeWidth: (props.strokeWidth as number | undefined) ?? 2,
    },
    {
      type: "text",
      x: cellSize,
      y: cy,
      text,
      fontSize,
      fontFamily: fontFamily.sans,
      fontWeight: 700,
      fill: textColor,
      align: textAlign,
      baseline: "middle",
      maxWidth: width - cellSize * 2,
      whiteSpace: "nowrap",
    },
    {
      type: "icon_font",
      iconName: ti.name,
      x: width - cellSize / 2,
      y: cy,
      fontSize: fontSize + 2,
      fill: iconColor,
      strokeWidth: (props.strokeWidth as number | undefined) ?? 2,
    },
  ];
};

/**
 * `illustrated_message` — 빈 상태(empty state) escape. placeholder roundRect + heading text +
 * description text 3 shape 를 자체 생성한다(append 모드 — rule fill transparent base box 위).
 *
 * **ADR-912 진로 1번 IllustratedMessage proof slice (2026-06-06)**: catalog 등록 시 buildCatalogShapes
 *   box+text 는 단일 box + 단일 text 만 가능 → nested placeholder + 2-text 표현 불가. spec.render.shapes
 *   (IllustratedMessage.spec.ts:104-187) 의 시각 로직을 escape 로 이전(spec 의존 0 — seam 제거).
 *   heading/description 은 props(자식 Element 아님, factory children:[]). DOM(IllustratedMessage.tsx)
 *   인라인 style 과 시각 대칭.
 *
 *   size-key 별 dims/headingFontSize/gap 은 자체 인라인 매핑(rule table 미보유 — escape 자기 완결).
 *   fontSize 는 ctx.size.fontSize(rule TokenRef → resolveSpecFontSize), text 색은 visual.text.
 */
const ILLUSTRATION_ESCAPE_DIMS: Readonly<
  Record<string, { box: number; headingFs: number; gap: number }>
> = {
  sm: { box: 80, headingFs: 16, gap: 8 },
  md: { box: 120, headingFs: 18, gap: 12 },
  lg: { box: 160, headingFs: 20, gap: 16 },
};

const illustratedMessage: SkiaPrimitiveDrawFn = ({
  props,
  size,
  visual,
  style,
}) => {
  // 자식 보유 시(미래 확장) escape skip — props 기반 단독 leaf 만 그린다.
  if ((props as Record<string, unknown>)._hasChildren) return [];

  const sizeName = (props.size as string) ?? "md";
  const dims =
    ILLUSTRATION_ESCAPE_DIMS[sizeName] ?? ILLUSTRATION_ESCAPE_DIMS.md;

  const descFs = resolveSpecFontSize(
    (style?.fontSize as string | number | undefined) ?? size.fontSize,
    14,
  );
  const ff = (style?.fontFamily as string) || fontFamily.sans;
  const textColor =
    (style?.color as string | undefined) ??
    visual?.text ??
    ("{color.neutral}" as TokenRef);

  const heading = (props.heading as string) ?? "No content";
  const description =
    (props.description as string) ?? "There is nothing to display.";

  const shapes: Shape[] = [];

  // 일러스트 placeholder 영역
  shapes.push({
    id: "illustration",
    type: "roundRect" as const,
    x: 0,
    y: 0,
    width: dims.box,
    height: dims.box,
    radius: 12,
    fill: "{color.neutral-subtle}" as TokenRef,
    fillAlpha: 0.5,
  });

  // Heading 텍스트
  shapes.push({
    id: "heading",
    type: "text" as const,
    x: 0,
    y: dims.box + dims.gap,
    text: heading,
    fontSize: dims.headingFs,
    fontFamily: ff,
    fontWeight: 600,
    fill: textColor,
    align: "center" as const,
  });

  // Description 텍스트
  shapes.push({
    id: "description",
    type: "text" as const,
    x: 0,
    y: dims.box + dims.gap + dims.headingFs + 8,
    text: description,
    fontSize: descFs,
    fontFamily: ff,
    fill: "{color.neutral-subdued}" as TokenRef,
    align: "center" as const,
  });

  return shapes;
};

/**
 * `status_light` — 상태 표시 dot(circle) + 라벨 text. escape(append 모드).
 *
 * **ADR-912 진로 1번 StatusLight proof slice (2026-06-06)**: catalog 등록 시 buildCatalogShapes
 *   box+text 는 circle 미지원 → spec.render.shapes(StatusLight.spec.ts:362-425)의 dot circle +
 *   text 로직을 escape 로 이전(spec 의존 0 — seam 제거). 기존 `dot` primitive(`props.isDot` gate,
 *   Checkbox/Radio 전용 + text 미렌더)와 별개 — 회귀 위험 0.
 *
 *   dot 색 = visual.fill.default.base(variant status 색), text 색 = visual.text. dotSize/gap/height
 *   는 ctx.size(rule sizes). DOM(StatusLight.tsx) 인라인 style 과 시각 대칭.
 */
const statusLight: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const dotSize = typeof size.dotSize === "number" ? size.dotSize : 10;
  const dotRadius = dotSize / 2;
  const gap = typeof size.gap === "number" ? size.gap : 8;
  const h = typeof size.height === "number" ? size.height : 24;
  const centerY = h / 2;

  const dotColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    ("{color.neutral-subdued}" as TokenRef);
  const textColor =
    (style?.color as string | undefined) ??
    visual?.text ??
    ("{color.neutral}" as TokenRef);

  const shapes: Shape[] = [
    // 상태 표시 dot (수직 중앙 정렬)
    {
      id: "dot",
      type: "circle" as const,
      x: dotRadius,
      y: centerY,
      radius: dotRadius,
      fill: dotColor,
    },
  ];

  // 자식 보유(미래 확장) 시 dot 만 — 라벨은 자식이 담당.
  if ((props as Record<string, unknown>)._hasChildren) return shapes;

  const text = props.children;
  if (text) {
    const fontSize = resolveSpecFontSize(
      (style?.fontSize as string | number | undefined) ?? size.fontSize,
      14,
    );
    const fwRaw = style?.fontWeight;
    const fw =
      fwRaw != null
        ? typeof fwRaw === "number"
          ? fwRaw
          : parseInt(String(fwRaw), 10) || 400
        : 400;
    const ff = (style?.fontFamily as string) || fontFamily.sans;

    shapes.push({
      type: "text" as const,
      x: dotSize + gap,
      y: centerY,
      text: text as string,
      fontSize,
      fontFamily: ff,
      fontWeight: fw,
      fill: textColor,
      align: "left" as const,
      baseline: "middle" as const,
    });
  }

  return shapes;
};

/**
 * `avatar` — 사용자 아바타 circle bg + (image | initials text). escape(replace 모드).
 *
 * **ADR-912 진로 1번 Avatar proof slice (2026-06-06)**: catalog 등록 시 buildCatalogShapes 는
 *   roundRect+border+text 만 그린다 — circle 은 roundRect(full)로 근사 가능하나 **image fill 미지원**
 *   → 구 spec.render.shapes(Avatar.spec.ts, 2026-06-16 삭제)의 circle bg + image|initials 로직을
 *   escape 로 이전(spec 의존 0 — seam 제거). circle 이 전체 shape 라 base box 무의미 → **replace** 모드.
 *
 *   circle bg 색 = style.backgroundColor → visual.fill.default.base(rule "default" variant), text 색 =
 *   style.color → visual.text. 지름 = size.height(rule sizes). image shape 는 specShapeConverter.ts:1006
 *   가 렌더(fit "cover"). DOM(Avatar.tsx) 인라인 style 과 시각 대칭.
 */
const avatar: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  const diameter = typeof size.height === "number" ? size.height : 32;
  const radius = diameter / 2;

  const bgColor =
    (style?.backgroundColor as string | undefined) ??
    visual?.fill?.default.base ??
    ("{color.neutral-subtle}" as TokenRef);

  const shapes: Shape[] = [
    // 원형 배경 (circle 전체가 아바타 외형)
    {
      id: "bg",
      type: "circle" as const,
      x: radius,
      y: radius,
      radius,
      fill: bgColor,
    },
  ];

  // 자식 보유(미래 확장) 시 shell(circle bg)만 — 내용은 자식이 담당.
  if ((props as Record<string, unknown>)._hasChildren) return shapes;

  // 이미지가 있으면 image shape (specShapeConverter 가 fit cover 로 원 안에 채움)
  if (props.src) {
    shapes.push({
      type: "image" as const,
      x: 0,
      y: 0,
      width: diameter,
      height: diameter,
      src: props.src as string,
      radius,
    });
    return shapes;
  }

  // 이니셜 텍스트 (src 없을 때) — initials || alt 첫 2글자 || "?"
  const text =
    (props.initials as string | undefined) ||
    (props.alt as string | undefined)?.slice(0, 2).toUpperCase() ||
    "?";
  const fontSize = resolveSpecFontSize(
    (style?.fontSize as string | number | undefined) ?? size.fontSize,
    14,
  );
  const fwRaw = style?.fontWeight;
  const fw =
    fwRaw != null
      ? typeof fwRaw === "number"
        ? fwRaw
        : parseInt(String(fwRaw), 10) || 500
      : 500;
  const ff = (style?.fontFamily as string) || fontFamily.sans;
  const textColor =
    (style?.color as string | undefined) ??
    visual?.text ??
    ("{color.neutral}" as TokenRef);

  shapes.push({
    type: "text" as const,
    x: radius,
    y: radius,
    text,
    fontSize,
    fontFamily: ff,
    fontWeight: fw,
    fill: textColor,
    align: "center" as const,
    baseline: "middle" as const,
  });

  return shapes;
};

/** skiaPrimitive 키 → draw module. binding.skiaPrimitive 가 이 키를 가리킨다. */
export const SKIA_PRIMITIVES: Readonly<Record<string, SkiaPrimitiveDrawFn>> = {
  icon_font: iconFont,
  dot,
  divider,
  // ADR-912 Pattern B (TableRow catalog cutover): 행 하단 구분선(append, y=rowHeight).
  table_row_divider: tableRowDivider,
  // ADR-912 projection 3 cutover (TabList): 하단/우측 구분선(append, table_row_divider 동형).
  tablist_divider: tablistDivider,
  // ADR-912 projection 3 cutover (Tab): 선택 시 accent 인디케이터 막대(append, 조건부).
  tab_indicator: tabIndicator,
  // ADR-912 projection 3 cutover (Breadcrumb): label + separator(replace, 위치 누적).
  breadcrumb_crumb: breadcrumbCrumb,
  // ADR-912 collection sub-part cutover (GridListItem): 카드 box+label+description(replace).
  gridlist_card: gridListCard,
  // ADR-912 collection sub-part cutover (ListBoxItem): row selection bg+icon+label+desc+check(replace).
  listbox_item: listBoxItem,
  checkbox,
  radio,
  switch_toggle: switchToggle,
  // ADR-912 collection sub-part cutover (SliderThumb): circle 핸들 + border(replace, radio 동형).
  slider_thumb: sliderThumb,
  // ADR-142 Inc3 overlays (append 모드 — SKIA_PRIMITIVE_MODES 참조)
  tooltip_arrow: tooltipArrow,
  popover_arrow: popoverArrow,
  dialog_shadow: dialogShadow,
  popover_shadow: popoverShadow,
  overlay_backdrop: overlayBackdrop,
  // ADR-912 단계 5 (1b) date escape (replace 모드 — box+text 대체)
  calendar_grid: calendarGrid,
  // ADR-912 (A/2D) CalendarGrid 자식 발효 (replace — nav 없는 grid + today circle, calendar_grid 부모와 별개)
  calendar_month_grid: calendarMonthGrid,
  datefield_trigger: datefieldTrigger,
  datefield_segments: datefieldSegments,
  // ADR-912 선행-2 value-fill escape:
  //   value_fill_bar = append (track box 위 value 막대 — Progress/Meter)
  //   value_fill_arc = replace (자체 track arc + indicator arc — ProgressCircle, box 무의미)
  //   slider_fill_bar = replace (자체 track + value 막대 + thumb — SliderTrack, thumb 컨테이너 box)
  value_fill_bar: valueFillBar,
  value_fill_arc: valueFillArc,
  slider_fill_bar: sliderFillBar,
  // ADR-912 진로 1번 internal leaf escape (append 모드 — placeholder+heading+description)
  illustrated_message: illustratedMessage,
  // ADR-912 진로 1번 internal leaf escape (append 모드 — dot circle + label text)
  status_light: statusLight,
  // ADR-912 진로 1번 internal leaf escape (replace 모드 — circle bg + image|initials)
  avatar,
  // ADR-912 (B+icon) leading icon escape (append 모드 — 좌측 chevron, base text 위)
  leading_icon: leadingIcon,
  // ADR-912 (B+icon) inline icon text escape (replace 모드 — 좌 icon + center text + 우 icon, CalendarHeader)
  inline_icon_text: inlineIconText,
};

/** draw module 합성 모드. dispatch(buildSpecNodeData) + composeCatalogShapes 가 분기에 사용. */
export type SkiaPrimitiveMode = "replace" | "prepend" | "append";

/**
 * draw module 의 합성 모드.
 * - `"replace"`(기본): 출력이 box+text 를 **대체**한다(기존 6 leaf primitive — indicator 만 렌더).
 * - `"prepend"`: 출력이 buildCatalogShapes(box+text) 출력 **앞**(아래 레이어)에 합성된다 —
 *   backdrop(전체화면 rect) / shadow(target=bg). legacy 순서 [backdrop, shadow, bg, ...] 재현.
 * - `"append"`: 출력이 box+text 출력 **뒤**(위 레이어)에 합성된다 — arrow(line).
 *
 * 미등록 키는 `"replace"` 로 간주(기존 호환).
 */
const SKIA_PRIMITIVE_MODES: Readonly<Record<string, SkiaPrimitiveMode>> = {
  // ADR-912 Pattern B: table_row_divider 는 bg box(buildCatalogShapes) 아래쪽 경계 line → append.
  table_row_divider: "append",
  // ADR-912 projection 3: tablist_divider 는 transparent shell 아래쪽/우측 경계 line → append.
  tablist_divider: "append",
  // ADR-912 projection 3: tab_indicator 는 transparent box 위 조건부 accent 막대 → append.
  tab_indicator: "append",
  // ADR-912 projection 3: breadcrumb_crumb 은 label+separator 위치 누적 자체 생성 → replace
  //   (buildCatalogShapes single-text 좌측 고정 가정과 충돌).
  breadcrumb_crumb: "replace",
  // ADR-912 collection sub-part: gridlist_card 는 카드 box+label+description 전체 자체 생성
  //   (2-line top-aligned → buildCatalogShapes box-center 가정과 충돌) → replace.
  gridlist_card: "replace",
  // ADR-912 collection sub-part: listbox_item 은 selection bg+icon+label+desc+check multi-slot
  //   전체 자체 생성(buildCatalogShapes box+single-text 로 재현 불가) → replace.
  listbox_item: "replace",
  overlay_backdrop: "prepend",
  dialog_shadow: "prepend",
  popover_shadow: "prepend",
  tooltip_arrow: "append",
  popover_arrow: "append",
  // ADR-912 선행-2: value_fill_bar 는 track box 위 막대 → append.
  //   value_fill_arc 는 자체 track+indicator arc 라 box+text 대체 → replace(기본, 미등록).
  value_fill_bar: "append",
  // ADR-912 SliderTrack: slider_fill_bar 는 track + value 막대 + thumb 자체 생성, box+text 대체
  //   → replace. layout box=thumbSize(thumb 컨테이너)라 buildCatalogShapes box(y:0,height:auto)와
  //   spec track(y=trackY 세로 중앙)이 어긋남 → 자체 track box 생성. 미등록=replace 지만 의도 명시.
  slider_fill_bar: "replace",
  // ADR-912 SliderThumb: slider_thumb 는 circle 핸들이 전체 외형 → base box 무의미 → replace
  //   (avatar/radio 동형). 미등록=replace 지만 의도 명시.
  slider_thumb: "replace",
  // ADR-912 진로 1번: illustrated_message 는 rule fill transparent base box 위 placeholder+text → append.
  illustrated_message: "append",
  // ADR-912 진로 1번: status_light 는 dot+text 자체 생성, box 무의미 → replace.
  //   rule fill base 는 dot 색(variant status). base box 로 칠하면 box 전체가 status 색 →
  //   DOM(dot 만 색) 과 비대칭. replace 로 base box 미생성, escape 가 dot circle + text 만 그림.
  status_light: "replace",
  // ADR-912 진로 1번: avatar 는 circle bg + image|initials 자체 생성, base roundRect box 무의미
  //   (circle 이 전체 외형) → replace. 미등록=replace 지만 의도 명시.
  avatar: "replace",
  // ADR-912 (B+icon): leading_icon 은 base box+text 위 좌측 chevron → append.
  //   text 는 buildCatalogShapes 가 iconSize 만큼 우측 shift, 본 module 은 icon 만 그림.
  leading_icon: "append",
  // ADR-912 (B+icon): inline_icon_text 는 좌 icon + center text + 우 icon 자체 생성, box+text 대체
  //   → replace. center text 가 buildCatalogShapes 의 좌측/center 단일 text 와 충돌하므로 base 미생성.
  inline_icon_text: "replace",
  // ADR-912 (A/2D): calendar_month_grid 는 weekday + day cell 2D self-positioning + today circle 자체 생성,
  //   box+text 대체 → replace. 절대 좌표 grid 라 buildCatalogShapes box(y:0,height:auto)와 어긋남.
  calendar_month_grid: "replace",
  // ADR-912 deletion-risk(date): datefield_segments 는 input box + border + 세그먼트 placeholder text
  //   (+picker icon) 자체 생성, box+text 대체 → replace. DateInput.spec render.shapes 의 4-parent 분기
  //   이식. datefield_trigger(부모 picker 가 그리는 trigger field, 자식 없을 때)와 별개 — 자식 DateInput
  //   element 자신이 그림.
  datefield_segments: "replace",
};

export function getSkiaPrimitive(
  key: string | undefined,
): SkiaPrimitiveDrawFn | undefined {
  return key ? SKIA_PRIMITIVES[key] : undefined;
}

/** draw module 합성 모드. 미등록/미지정 키는 "replace"(box+text 대체, 기존 호환). */
export function getSkiaPrimitiveMode(
  key: string | undefined,
): SkiaPrimitiveMode {
  return (key && SKIA_PRIMITIVE_MODES[key]) || "replace";
}
