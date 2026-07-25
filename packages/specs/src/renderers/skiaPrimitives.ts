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

import { parseBorderWidth, parsePxValue, parseShadow } from "../primitives";
import {
  fontFamily,
  getTextLineHeight,
  getDescriptionLineHeight,
} from "../primitives/typography";
import {
  COLLECTION_TEXT_DEFAULT_FONT_SIZE,
  resolveCollectionRowMetric,
  resolveListBoxItemInset,
  resolveGridListItemMetric,
} from "./utils/collectionItemMetrics";
import {
  buildDateInputDisplayText,
  buildDatePickerShapes,
  buildDatePlaceholder,
  DATE_PICKER_SIZES,
} from "./datePickerShapes";
import type { BorderStyleValue, Shape, SizeSpec, TokenRef } from "../types";
import { resolveSpecFontSize } from "./utils/resolveSpecFontSize";
import { resolveIllustratedMessageMetric } from "./utils/illustratedMessageMetrics";
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
 * `icon_font` — Lucide 아이콘 단일 glyph. **iconSize 가 크기 채널**, 사용자 fontSize 만 override.
 * 색은 style.color → variant.text. (Icon primitive)
 *
 * **fontSize 를 base 로 읽으면 안 된다 (2026-07-14 회귀)**: ADR-912 `toSkiaStyle` 이후 `style`
 * 은 override 전용이 아니라 **rule base ⊕ override 병합 map** 이다. base 에 rule 의 `fontSize`
 * (typography)와 `iconSize`(아이콘 스케일)가 **둘 다** 들어오므로, `style.fontSize != null` 로
 * override 를 판정하면 **항상 참** 이 되어 iconSize 가 죽는다. SelectIcon 은 두 축의 값이 달라
 * (lg: iconSize 22 vs text-lg 18, xl: 28 vs 20) glyph 가 박스보다 작게 그려졌다 — 박스는
 * iconSize 로 배치되는데 glyph 만 typography 를 따라간 비대칭.
 *
 * Icon(일반) 이 멀쩡해 보였던 건 **우연**이다 — catalog Icon 은 fontSize 와 iconSize 가 값이
 * 같게(16/16, 24/24, 48/48) 작성돼 있어 어느 쪽이 이기든 결과가 같았다.
 *
 * 따라서 크기 채널은 `iconSize`(merged → rule 순)로 읽고, `fontSize` 는 **사용자가 props.style
 * 에 직접 넣었을 때만** override 로 받는다(merged base 의 fontSize 는 무시).
 */
const iconFont: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  // 크기 채널 = iconSize (merged map 우선 — size 별 rule 값이 이미 해소돼 들어온다).
  const iconSize = resolveSpecFontSize(
    (style?.iconSize as string | number | undefined) ?? size.iconSize ?? 24,
    24,
  );
  // fontSize override 는 **사용자 입력(props.style)** 일 때만 — merged base 의 rule fontSize 아님.
  const userFontSize = (props.style as Record<string, unknown> | undefined)
    ?.fontSize as string | number | undefined;
  const effectiveSize =
    userFontSize != null
      ? resolveSpecFontSize(userFontSize, iconSize)
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
  // ADR-148 후속 (2026-07-17) — reusable origin 은 slot 자식이 실 scene 노드로 서므로
  //   (canvasSceneNode unfold), 자식 실재(`_hasChildren` — buildSpecNodeData 주입) 시
  //   내용(text)은 자식이 담당하고 본 escape 는 card shell(bg+border)만 그린다.
  //   projection 행은 자식이 없어 미주입 → 기존 flat-props 렌더(BC).
  const contentHidden = props._hasChildren === true;
  // 2026-07-22 parity sweep: 카드 label/description 은 item fontSize 를 안 쓴다 — react-aria-Text
  //   기본 16(COLLECTION_TEXT_DEFAULT_FONT_SIZE)으로 산출(아래). item fontSize 는 소비처 0.
  // ADR-148 Phase 4 — slot 구성 소비 (listbox_item 동형: projection 이 GridListItem origin
  //   slot 자식에서 파생해 주입한 props._slots — 존재 gating + style overlay + 스택 순서).
  //   _slots 부재 = legacy 문서/비-projection 경로 → 기존 flat-props 동작(BC).
  const slotComposition = readInjectedSlotComposition(props._slots);
  const slotEnabled = (role: string): boolean =>
    !slotComposition || slotComposition.slots[role] != null;
  const labelSlotStyle = slotComposition?.slots["label"]?.style;
  const descriptionSlotStyle = slotComposition?.slots["description"]?.style;
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
  // slot 자식 style overlay (fontSize) — 부재 시 react-aria-Text 기본 16 (label·description 둘 다,
  //   GridList slot 은 override 없음). 과거 label=fontSize(item)·desc=fontSize-2 는 실 렌더(둘 다 16,
  //   라이브 확인)와 어긋나 카드가 origin/CSS 대비 짧고 desc 가 label size 에 결합됐다. 명시 slot 우선.
  const labelFontSize =
    labelSlotStyle?.fontSize != null
      ? resolveSpecFontSize(
          labelSlotStyle.fontSize as string | number,
          COLLECTION_TEXT_DEFAULT_FONT_SIZE,
        )
      : COLLECTION_TEXT_DEFAULT_FONT_SIZE;
  // label↔description 수직 간격 = GridListItem flex `gap: var(--spacing-2xs)` = 2 (2026-07-22 라이브
  //   실측). ADR-160 후속: 리터럴 대신 `resolveGridListItemMetric` SSOT 경유 — layout(M1 §1.55b2)이
  //   동일 심볼을 읽어 within-card gap 소스를 단일화(style.gap ?? 2 잔존 봉쇄).
  const descGap = resolveGridListItemMetric(labelFontSize).descGap;
  const descFontSize =
    descriptionSlotStyle?.fontSize != null
      ? resolveSpecFontSize(
          descriptionSlotStyle.fontSize as string | number,
          COLLECTION_TEXT_DEFAULT_FONT_SIZE,
        )
      : COLLECTION_TEXT_DEFAULT_FONT_SIZE;
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
  const descriptionRaw = isTemplatePreview
    ? props.description != null && props.description !== ""
      ? "Description"
      : null
    : readCardText(props.description);
  // 구성 gating — slot 자식이 구성에 없으면 데이터가 있어도 미렌더 (ADR-148 Decision 3).
  const description = slotEnabled("description") ? descriptionRaw : null;
  const showLabel = slotEnabled("label");

  // label/description 수직 스택 순서 — slot 자식 등장 순서 소비 (기본: label → description).
  const stackEntries: Array<"label" | "description"> = [];
  const pushStackEntry = (entry: "label" | "description") => {
    if (stackEntries.includes(entry)) return;
    if (entry === "label" && !showLabel) return;
    if (entry === "description" && !description) return;
    stackEntries.push(entry);
  };
  if (slotComposition) {
    for (const role of slotComposition.order) {
      if (role === "label" || role === "description") pushStackEntry(role);
    }
  }
  pushStackEntry("label");
  pushStackEntry("description");

  // 카드 콘텐츠 = label line box + gap + description line box. 2026-07-22 parity sweep: label/
  //   description 은 **Text** leaf 라 line box = 1.5×fs(getTextLineHeight) — GridList slot 은
  //   `[slot=*]` line-height override 가 없어 기본 Text 1.5 로 렌더(라이브 확인, origin 76). 과거
  //   getLabelLineHeight(typography 토큰) + base 14/desc 12 는 실 렌더(둘 다 16→24) 대비 카드가
  //   짧았다(-10). label/description 각자 size 로 1.5×fs 산출.
  const entryLineHeight = (entry: "label" | "description"): number =>
    entry === "label"
      ? getTextLineHeight(labelFontSize)
      : getTextLineHeight(descFontSize);
  const labelFontWeight =
    (style?.fontWeight as string | number | undefined) ??
    visual?.textWeight ??
    600;
  const labelWeight =
    (labelSlotStyle?.fontWeight as string | number | undefined) ??
    labelFontWeight;
  const descriptionWeight =
    (descriptionSlotStyle?.fontWeight as string | number | undefined) ?? 400;
  // 실제 카드 폭(px) — buildSpecNodeData width injection 이 layout 폭을 style.width 로 주입
  //   (projection 행 원본은 "100%"/calc 이라 number 판정 후 fallback 200). 좌우 padding 차감이
  //   텍스트 wrap 폭.
  const cardWidth =
    typeof style?.width === "number" && style.width > 0 ? style.width : 200;
  // ADR-160: 카드 geometry(블록 wrap 측정 + top-anchored 스택 + cardHeight)를 layout(M1)·escape
  //   공유 SSOT `resolveCollectionRowMetric` 로 위임(design §2.1). GridList 계약: singleEntryCentered
  //   미설정(항상 top) + textX=cardPaddingX(icon/check 예약 없음) + description lineHeight 1.5×.
  //   `cardWidth`(=style.width)는 buildSpecNodeData width injection 이 확정한 실제 카드 폭.
  const explicitHeight = parsePxValue(style?.height, undefined);
  const cardMetric = resolveCollectionRowMetric({
    containerWidth: cardWidth,
    paddingTop: cardPaddingY,
    paddingRight: cardPaddingX,
    paddingBottom: cardPaddingY,
    paddingLeft: cardPaddingX,
    gap: descGap,
    explicitHeight:
      typeof explicitHeight === "number" ? explicitHeight : undefined,
    textX: cardPaddingX,
    rightReserve: 0,
    fontFamily: ff,
    entries: stackEntries.map((entry) => ({
      role: entry,
      text: entry === "label" ? label : (description ?? ""),
      fontSize: entry === "label" ? labelFontSize : descFontSize,
      fontWeight: entry === "label" ? labelWeight : descriptionWeight,
      lineHeight: entryLineHeight(entry),
    })),
    fallbackLineHeight: 0,
  });
  const textMaxWidth = cardMetric.maxWidth;
  const entryBlockHeight = (entry: "label" | "description"): number =>
    cardMetric.slotBlocks[entry]?.height ?? entryLineHeight(entry);
  const cardHeight = cardMetric.rowHeight;

  const shapes: Shape[] = [];

  // 카드 박스 (bg + border) — GridListItem.spec renderOneCard 정본.
  //   shell 모드(자식이 내용 담당)에서는 높이를 layout 결과("auto" = node height)에 위임 —
  //   metric cardHeight 는 flat props 기준이라 자식 합산 높이와 어긋난다.
  shapes.push({
    id: "card-bg",
    type: "roundRect",
    x: 0,
    y: 0,
    width: "auto",
    height: contentHidden ? ("auto" as unknown as number) : cardHeight,
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

  // label/description 수직 스택 (top-left) — slot 자식 순서/스타일 소비 (ADR-148 Phase 4).
  //   entry y = 이전 entry **wrap 블록** 아래 + descGap. 과거 단일 줄 lineHeight 로만 증가시켜
  //   label 이 wrap(멀티라인)되면 description 이 label 아래 줄 위에 겹쳤다(2026-07-22, listbox_item
  //   동형). text 는 top-anchored(baseline 미지정) 라 y=블록 top 직접, maxWidth 명시로 measure↔paint
  //   wrap 폭 정합, lineHeight 명시로 converter strut 정합.
  const labelFill = (labelSlotStyle?.color as string | undefined) ?? textColor;
  const descriptionFill =
    (descriptionSlotStyle?.color as string | undefined) ??
    ("{color.neutral-subdued}" as TokenRef);
  let stackY = cardPaddingY;
  // shell 모드: 내용 스택은 실 자식 노드가 렌더 (이중 렌더 차단).
  for (const entry of contentHidden ? [] : stackEntries) {
    if (entry === "label") {
      shapes.push({
        type: "text",
        x: cardPaddingX,
        y: stackY,
        text: label,
        fontSize: labelFontSize,
        fontFamily: ff,
        fontWeight: labelWeight,
        fill: labelFill,
        maxWidth: textMaxWidth,
        lineHeight: entryLineHeight("label"),
      });
    } else {
      shapes.push({
        type: "text",
        x: cardPaddingX,
        y: stackY,
        text: description ?? "",
        fontSize: descFontSize,
        fontFamily: ff,
        fontWeight: descriptionWeight,
        fill: descriptionFill,
        maxWidth: textMaxWidth,
        lineHeight: entryLineHeight("description"),
      });
    }
    stackY += entryBlockHeight(entry) + descGap;
  }

  return shapes;
};

/**
 * ADR-148 Phase 0 — projection 이 주입한 slot 구성(`props._slots`)의 방어적 판독.
 *
 * 계약 정본: `packages/shared/src/catalog/slotRoles.ts` `SlotComposition` — package boundary
 * (specs ← shared) 때문에 본 파일이 shared 를 import 할 수 없어 동일 shape 를 구조적으로
 * 읽는다. shape 이 어긋나면 null (legacy flat-props 동작 fallback).
 */
type InjectedSlotComposition = {
  order: string[];
  slots: Record<string, { style?: Record<string, unknown> } | undefined>;
};

function readInjectedSlotComposition(
  raw: unknown,
): InjectedSlotComposition | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const slots = record.slots;
  if (!slots || typeof slots !== "object" || Array.isArray(slots)) return null;
  const order = Array.isArray(record.order)
    ? record.order.filter((role): role is string => typeof role === "string")
    : [];
  return { order, slots: slots as InjectedSlotComposition["slots"] };
}

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
 *
 *   **ADR-148 Phase 0 (slot 자식 배선)**: projection 이 origin slot 조합 자식(Icon/Label/
 *   Description, `metadata.slotRole`)에서 파생한 `props._slots`(SlotComposition) 를 함께
 *   주입하며, 본 escape 는 이를 slot **존재 gating**(구성에 없는 slot 은 데이터가 있어도
 *   미렌더 — origin 에서 slot 자식을 지우면 사라진다), **스타일 overlay**(slot 자식
 *   props.style 의 fontSize/fontWeight/color), **스택 순서**(label/description 등장 순서)로
 *   소비한다. `_slots` 부재 = legacy 문서/비-projection 경로 → 기존 flat-props 동작(BC).
 */
const listBoxItem: SkiaPrimitiveDrawFn = ({ props, size, visual, style }) => {
  // ADR-148 후속 (2026-07-17) — reusable origin 은 slot 자식이 실 scene 노드로 서므로
  //   (canvasSceneNode unfold), 자식 실재(`_hasChildren`) 시 내용(icon/label/description)은
  //   자식이 담당하고 본 escape 는 shell(selection row-bg + check)만 그린다.
  //   projection 행은 자식이 없어 미주입 → 기존 flat-props 렌더(BC).
  const contentHidden = props._hasChildren === true;
  // ADR-148 Phase 0 — slot 구성 소비 (존재 gating + style overlay + 스택 순서).
  const slotComposition = readInjectedSlotComposition(props._slots);
  const slotEnabled = (role: string): boolean =>
    !slotComposition || slotComposition.slots[role] != null;
  const slotStyleOf = (role: string): Record<string, unknown> | undefined =>
    slotComposition?.slots[role]?.style;
  const labelSlotStyle = slotStyleOf("label");
  const descriptionSlotStyle = slotStyleOf("description");
  const iconSlotStyle = slotStyleOf("icon");
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
  // label/description fontSize: slot 자식 style overlay(props.size fold 포함) 우선.
  //   미지정 label 은 react-aria-Text 기본 16 (부모/item fontSize 미상속 — 라이브 실측 2026-07-22).
  //   과거 fallback `fontSize`(=item 14)는 default instance label 을 -3px 짧게(21 vs 실 렌더 24) 그렸다.
  const labelFontSize =
    labelSlotStyle?.fontSize != null
      ? resolveSpecFontSize(
          labelSlotStyle.fontSize as string | number,
          COLLECTION_TEXT_DEFAULT_FONT_SIZE,
        )
      : COLLECTION_TEXT_DEFAULT_FONT_SIZE;
  // description 은 label size 와 무관한 자체 기본(--text-xs = 12) — CSS [slot="description"] 정합.
  //   명시 slot size 우선.
  const descriptionFontSize = parsePxValue(descriptionSlotStyle?.fontSize, 12);
  // lineHeight: label 은 slot CSS override 없어 1.5×fs (getTextLineHeight) — react-aria-Text 기본·
  //   origin 실 Text 자식·CSS 동일 모델. description 은 CSS [slot=description] line-height 토큰으로
  //   1.333×fs (getDescriptionLineHeight) — label 1.5× 와 대조 (라이브 실측 2026-07-22: desc 12→16,
  //   14→18.67). 과거 desc 에 getTextLineHeight(1.5×) 적용 시 12→18 로 +2 과대해 DOM(16) 과 발산.
  const labelLineHeight = getTextLineHeight(labelFontSize);
  const descriptionLineHeight = getDescriptionLineHeight(descriptionFontSize);
  const entryLineHeight = (entry: "label" | "description"): number =>
    entry === "label" ? labelLineHeight : descriptionLineHeight;

  // template placeholder 처리 (Item spec readText 동형).
  const labelRaw = props.children ?? props.textValue ?? props.value;
  const isTemplatePreview = isCardTemplatePlaceholder(labelRaw);
  const label = isTemplatePreview
    ? "Label"
    : (readCardText(props.children) ??
      readCardText(props.textValue) ??
      readCardText(props.value) ??
      "");
  const descriptionRaw = isTemplatePreview
    ? props.description != null && props.description !== ""
      ? "Description"
      : null
    : readCardText(props.description);
  // 구성 gating — slot 자식이 구성에 없으면 데이터가 있어도 미렌더 (ADR-148 Decision 3).
  const description = slotEnabled("description") ? descriptionRaw : null;
  const showLabel = slotEnabled("label");

  // label/description 수직 스택 순서 — slot 자식 등장 순서 소비 (기본: label → description).
  const stackEntries: Array<"label" | "description"> = [];
  const pushStackEntry = (entry: "label" | "description") => {
    if (stackEntries.includes(entry)) return;
    if (entry === "label" && !showLabel) return;
    if (entry === "description" && !description) return;
    stackEntries.push(entry);
  };
  if (slotComposition) {
    for (const role of slotComposition.order) {
      if (role === "label" || role === "description") pushStackEntry(role);
    }
  }
  pushStackEntry("label");
  pushStackEntry("description");

  const minHeight = parsePxValue(style?.minHeight, 20);
  const width =
    typeof style?.width === "number" && style.width > 0 ? style.width : 200;
  const textColor = props.isDisabled
    ? ("{color.neutral-subdued}" as TokenRef)
    : ((style?.color as string | undefined) ??
      visual?.text ??
      ("{color.neutral}" as TokenRef));
  // icon/check slot (spec ListBoxItem.spec.ts:180-195 좌표 공식) — 구성 gating + style overlay.
  const iconName = slotEnabled("icon") ? readCardText(props.icon) : null;
  const iconSize = parsePxValue(
    iconSlotStyle?.fontSize,
    typeof size.iconSize === "number" ? size.iconSize : 16,
  );
  const slotGap = 6;
  const showCheck = Boolean(props.isSelected);
  const checkSize = iconSize;
  const slotInset = typeof size.paddingX === "number" ? size.paddingX : 12;
  // ADR-160 후속: textX/rightReserve 산출을 layout(M1)과 공유 SSOT `resolveListBoxItemInset` 로 위임
  //   — icon/check wrap 폭 예약 공식을 escape·M1 단일 소스화(§2.1 발견 1 입력 산출 봉쇄).
  const { textX, rightReserve } = resolveListBoxItemInset({
    paddingLeft,
    slotInset,
    iconSize,
    hasIcon: Boolean(iconName),
    showCheck,
    checkSize,
    slotGap,
  });
  const ff = (style?.fontFamily as string) || fontFamily.sans;
  const labelFontWeight =
    (style?.fontWeight as string | number | undefined) ??
    visual?.textWeight ??
    600;
  const labelWeight =
    (labelSlotStyle?.fontWeight as string | number | undefined) ??
    labelFontWeight;
  const descriptionWeight =
    (descriptionSlotStyle?.fontWeight as string | number | undefined) ?? 400;
  // ADR-160: 행 geometry(블록 wrap 측정 + 스택 offset + rowHeight)를 layout(M1)·escape 공유
  //   SSOT `resolveCollectionRowMetric` 로 위임 — escape 자체 재측정 통로 봉쇄(design §2.1). ListBox
  //   계약: singleEntryCentered(1줄 세로 중앙) + icon/check-aware maxWidth(textX/rightReserve) +
  //   description lineHeight 1.333×. `width`(=style.width) 는 buildSpecNodeData width injection 이
  //   확정한 실제 행 폭 — 측정 주체 계약(scene %/calc 아님) 성립.
  const explicitHeight = parsePxValue(style?.height, undefined);
  const rowMetric = resolveCollectionRowMetric({
    containerWidth: width,
    paddingTop,
    paddingRight,
    paddingBottom,
    paddingLeft,
    gap: rowGap,
    minHeight,
    explicitHeight:
      typeof explicitHeight === "number" ? explicitHeight : undefined,
    textX,
    rightReserve,
    fontFamily: ff,
    entries: stackEntries.map((entry) => ({
      role: entry,
      text: entry === "label" ? label : (description ?? ""),
      fontSize: entry === "label" ? labelFontSize : descriptionFontSize,
      fontWeight: entry === "label" ? labelWeight : descriptionWeight,
      lineHeight: entryLineHeight(entry),
    })),
    singleEntryCentered: true,
    fallbackLineHeight: labelLineHeight,
  });
  const maxWidth = rowMetric.maxWidth;
  const entryBlockHeight = (entry: "label" | "description"): number =>
    rowMetric.slotBlocks[entry]?.height ?? entryLineHeight(entry);
  const rowHeight = rowMetric.rowHeight;

  const shapes: Shape[] = [];

  // 행-root appearance — background / border / box-shadow / radius 를 origin style override
  //   층(ADR-154 responsive 해석 포함)에서 렌더한다. background 특정이 아니라 Style 패널
  //   appearance 전반: 행이 일반 box 처럼 border·box-shadow 도 그린다 (2026-07-21).
  //   selected 행: projection 이 Selected variant origin style 을 merge 주입 → 그 값이 우선.
  //   hover/pressed 는 빌더 정적 캔버스 미발생.
  const rowRadius = parsePxValue(
    style?.borderRadius,
    typeof size.borderRadius === "number" ? size.borderRadius : 4,
  );
  const rowBgFill =
    (style?.backgroundColor as string | undefined) ??
    (props.isSelected
      ? (visual?.fill?.default.selected ??
        ("{color.accent-subtle}" as TokenRef))
      : undefined);
  const rowBorderWidth = parseBorderWidth(style?.borderWidth, 0);
  const rowBorderColor = style?.borderColor as string | undefined;
  const rowBoxShadows =
    typeof style?.boxShadow === "string" && style.boxShadow !== "none"
      ? parseShadow(style.boxShadow)
      : [];
  // border/box-shadow 는 row-bg 를 target 으로 참조하므로, 배경 fill 이 없어도 target 노드가
  //   존재해야 한다 — 이 경우 transparent fill 로 노드만 보장(시각 무변).
  const needsRowRect =
    Boolean(rowBgFill) || rowBorderWidth > 0 || rowBoxShadows.length > 0;
  if (needsRowRect) {
    shapes.push({
      id: "row-bg",
      type: "roundRect",
      x: 0,
      y: 0,
      width: "auto",
      height: "auto" as unknown as number,
      radius: rowRadius,
      fill: rowBgFill ?? ("{color.transparent}" as TokenRef),
    });
  }
  // box-shadow — CSS 문자열 parseShadow 로 분해해 target row-bg 뒤에 렌더 (다중 shadow 지원).
  for (const sh of rowBoxShadows) {
    shapes.push({
      type: "shadow",
      target: "row-bg",
      offsetX: sh.offsetX,
      offsetY: sh.offsetY,
      blur: sh.blur,
      spread: sh.spread,
      color: sh.color,
      alpha: sh.alpha,
      inset: sh.inset,
      radius: rowRadius,
    });
  }
  // border — borderWidth>0 시 target row-bg 에 stroke. borderStyle 부재 시 solid (origin
  //   responsive override 가 width+color 만 담기도 함 → DOM/standalone 렌더 parity).
  if (rowBorderWidth > 0) {
    shapes.push({
      type: "border",
      target: "row-bg",
      borderWidth: rowBorderWidth,
      color: rowBorderColor ?? ("{color.border}" as TokenRef),
      style: (style?.borderStyle as BorderStyleValue | undefined) ?? "solid",
      radius: rowRadius,
    });
  }

  // icon slot (좌측, 수직 중앙) — 구성 gating 은 iconName 계산에서 선반영.
  //   shell 모드: icon 은 실 자식(Icon 노드)이 렌더.
  if (!contentHidden && iconName) {
    shapes.push({
      type: "icon_font",
      iconName,
      x: slotInset + iconSize / 2,
      y: rowHeight / 2,
      fontSize: iconSize,
      fill: props.isDisabled
        ? textColor
        : ((iconSlotStyle?.color as string | undefined) ?? textColor),
      baseline: "middle",
    });
  }

  // label + (optional) description 수직 스택 — slot 자식 순서/스타일 소비 (ADR-148 Phase 0).
  //   단일 줄이면 rowHeight/2 세로 중앙, 2줄이면 paddingTop 기준 스택 (label/description
  //   각자 line box 높이로 배치 — size 비대칭 정합). descriptionFontSize/line height 는 상단 정의.
  const labelFill = props.isDisabled
    ? textColor
    : ((labelSlotStyle?.color as string | undefined) ?? textColor);
  const descriptionFill =
    (descriptionSlotStyle?.color as string | undefined) ??
    ("{color.neutral-subdued}" as TokenRef);
  // slot 자식 배경(fills → backgroundColor fold, slotRoles.ts) — 해당 slot 텍스트 line box
  //   뒤에 밴드로 렌더. origin 은 실 자식 Text 노드가 fills→box 배경을 그리지만, projection
  //   행은 escape 가 flat 렌더하므로 여기서 재현 (2026-07-21 사용자 보고).
  const slotBgOf = (
    slotStyle: Record<string, unknown> | undefined,
  ): { fill: string; radius: number } | null => {
    const bg = slotStyle?.backgroundColor;
    if (typeof bg !== "string" || bg === "" || bg === "transparent")
      return null;
    return { fill: bg, radius: parsePxValue(slotStyle?.borderRadius, 0) };
  };
  const labelSlotBg = slotBgOf(labelSlotStyle);
  const descriptionSlotBg = slotBgOf(descriptionSlotStyle);
  // lineHeight(px) 명시 — 미지정 시 converter(specShapeConverter)가 getLabelLineHeight
  //   (1.5×fs) 기본을 쓰는데 description 은 CSS [slot=description] 1.333×fs 라 wrap 시
  //   줄 간격이 CSS/행 높이 측정과 발산한다. 측정(entryBlockHeight)과 paint 가 동일 strut 사용.
  const stackTextShape = (entry: "label" | "description", y: number): Shape =>
    entry === "label"
      ? {
          type: "text",
          x: textX,
          y,
          text: label,
          fontSize: labelFontSize,
          fontFamily: ff,
          fontWeight: labelWeight,
          fill: labelFill,
          align: "left",
          baseline: "middle",
          maxWidth,
          overflow: "ellipsis",
          lineHeight: labelLineHeight,
        }
      : {
          type: "text",
          x: textX,
          y,
          text: description ?? "",
          fontSize: descriptionFontSize,
          fontFamily: ff,
          fontWeight: descriptionWeight,
          fill: descriptionFill,
          align: "left",
          baseline: "middle",
          maxWidth,
          overflow: "ellipsis",
          lineHeight: descriptionLineHeight,
        };

  // shell 모드: label/description 스택은 실 자식 노드가 렌더 (이중 렌더 차단).
  if (!contentHidden && stackEntries.length > 0) {
    // 각 entry y — converter 는 baseline:"middle" + y>0 을 "paragraph top = y − 단일줄
    //   lineHeight/2" 로 해석하고 wrap 은 아래로 흐른다. 따라서 y 는 항상 **단일 줄
    //   lineHeight/2** 기준으로 잡되, 두 번째 entry 의 top 은 첫 entry 의 **wrap 블록
    //   높이**(entryBlockHeight) 뒤에 둔다 — 단일 줄 가정 offset 은 label 이 wrap 되면
    //   description 과 겹친다 (2026-07-22). 단일 entry 는 블록 전체를 세로 중앙 배치.
    // ADR-160: 스택 offset(블록 top)은 rowMetric.slotBlocks[entry].y — escape 는 baseline:middle
    //   이므로 텍스트 y = 블록 top + 단일 줄 lineHeight/2. 2-entry top-anchored / 1-entry 세로 중앙은
    //   metric 이 소유(singleEntryCentered).
    const centerYs: number[] = stackEntries.map(
      (entry) =>
        (rowMetric.slotBlocks[entry]?.y ?? 0) + entryLineHeight(entry) / 2,
    );
    // slot 배경 밴드 먼저 (텍스트 뒤). label/description wrap 블록 전체를 채운다.
    stackEntries.forEach((entry, i) => {
      const bg = entry === "label" ? labelSlotBg : descriptionSlotBg;
      if (!bg) return;
      const lh = entryLineHeight(entry);
      shapes.push({
        id: `${entry}-bg`,
        type: "roundRect",
        x: textX,
        y: centerYs[i]! - lh / 2,
        width: maxWidth,
        height: entryBlockHeight(entry),
        radius: bg.radius,
        fill: bg.fill,
      });
    });
    // 텍스트
    stackEntries.forEach((entry, i) => {
      shapes.push(stackTextShape(entry, centerYs[i]!));
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
  void props;
  void size;
  void visual;
  void style;
  // shapes 0 (replace 모드) — 그리기는 SliderTrack 의 slider_fill_bar 가 담당한다.
  //
  // **Why (2026-07-14)**: 이 escape 가 자기 box 안에 원을 그리려면 box 가 value 위치에 있어야
  //   하는데, 그 배치는 implicitStyles 의 `position:absolute + left:%` 주입에 의존했다. 그러나
  //   composition-engine(Rust)은 absolute/inset 을 레이아웃에 반영하지 않는다(Style.inset_* 는
  //   tree.rs 에 선언만 되고 어떤 알고리즘도 읽지 않음, Position::Absolute 부재) → box 가 항상
  //   원점(0,0)에 고정되어 thumb 이 트랙 좌측 끝에 그려졌다(value 무관 x 고정 + y 미정렬).
  //   `_containerWidth` 를 아는 slider_fill_bar 로 렌더 소유권을 되돌려 DOM 좌표와 일치시킨다.
  //   SliderThumb element 자체는 selection/hit box 로만 잔존(box 위치 정합은 엔진의 absolute
  //   지원이 전제라 별도 과제).
  return [];
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

/*
 * ADR-166 Phase 4 (2026-07-25) — `dialog_shadow` / `popover_shadow` 제거됨.
 *
 * 두 primitive 는 인자 무관 하드코딩 상수라 테마를 따르지 않았고, catalog
 * `containerStyles.boxShadow` 와 별개 값이라 D3 SSOT 밖의 두 번째 그림자 소스였다.
 *
 * **그리고 실제로는 캔버스에 닿지도 않았다** (2026-07-25 실측). 둘 다 `target: "bg"` shadow
 * shape 인데, `specShapeConverter` 는 bg box 가 root 로 추출되면(`bgExtracted`) `nodeById` 에
 * **spread 사본**을 넣는다. shadow 는 그 사본의 `effects` 에 push 되고, root 조립부는 `bgBox` 와
 * `children` 만 읽으므로 사본은 버려진다. border 는 `targetNode.box === bgBox` 분기로 bgBox 에
 * 직접 write-through 하지만 shadow 에는 그 분기가 없다. 즉 Popover 는 Phase 3 이전까지 캔버스
 * 그림자가 **아예 없었고**, Phase 4 는 이중 그리기 해소가 아니라 **죽은 코드 제거**(시각 변화 0)다.
 *
 * 재도입 금지 — 그림자는 catalog `containerStyles.boxShadow` = `{shadow.*}` TokenRef 단일 채널.
 * (`target: "bg"` shadow 가 삼켜지는 위 결함 자체는 ADR-166 범위 밖 — design §8 참조.)
 */

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

/**
 * Calendar/RangeCalendar 의 nav chevron 은 DOM(`<ChevronLeft size={16}>`)에서 **size 무관 고정
 * 16px** 이다 (Calendar.tsx:122-126). Skia glyph 도 동일 16 으로 못 박아 CSS↔Skia 대칭 유지 —
 * rule `size.fontSize` 파생(가변) 금지. TagGroup remove X 축1 과 동형(DOM 고정-크기 아이콘 컨벤션).
 *
 * **두 경로가 공유한다**: `inline_icon_text`(CalendarHeader 자식이 있을 때) + `calendar_grid`
 * (standalone — 자식 없을 때 Calendar 가 직접 그리는 nav row). 과거 `calendar_grid` 만 `fontSize+2`
 * 로 남아 sm 14 / md 16 / lg 18 로 가변했다 — **md 만 우연히 DOM 16 과 일치**하고 sm/lg 는 어긋남.
 */
const CALENDAR_CHEVRON_DOM_PX = 16;

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
      // DOM `<ChevronLeft size={16}>` 고정 — fontSize 파생(가변) 금지 (inline_icon_text 와 동일).
      fontSize: CALENDAR_CHEVRON_DOM_PX,
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
      // DOM `<ChevronRight size={16}>` 고정 — fontSize 파생(가변) 금지 (inline_icon_text 와 동일).
      fontSize: CALENDAR_CHEVRON_DOM_PX,
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
  // ADR-151 B1/B2 (2026-07-16): DOM 셀 박스 모델 정렬 — table `td { padding: 2px }`
  //   (CalendarCommon.css --spacing-2xs) → 셀 pitch = cellSize + 4, inter-cell gap 없음.
  //   구 코드의 sizes.gap(컨테이너 세로 gap 값) 오용은 셀 간격 6px 로 DOM(4px)과 발산.
  const CELL_PAD = 2;
  const cellBox = cellSize + CELL_PAD * 2;
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
    const cellLeft = col * cellBox + CELL_PAD;
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
    const cellLeft = col * cellBox + CELL_PAD;
    const cx = cellLeft + cellSize / 2;
    const cy = gridStartY + row * cellBox + CELL_PAD + cellSize / 2;

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

  // segment text 세로 정렬: element.props.style.verticalAlign(Style 패널 Typography Vertical
  //   Align) 우선, 미지정 시 기본 "middle". specShapeConverter 가 node.text.verticalAlign 로
  //   전달 → nodeRendererText computeDrawY 가 `(node.height-textHeight)/2` 진짜 세로 중앙.
  //   CalendarHeader inline_icon_text 동형(2026-07-02 전수조사) — y:0+baseline:"middle" 은
  //   computeDrawY hasExplicitBottomPadding fallback 으로도 중앙 근사되지만, verticalAlign 을
  //   명시 전달해야 Style 패널 Vertical Align 편집이 Skia 에 반영(패널↔Skia 동기화).
  const textVerticalAlign =
    (style?.verticalAlign as "top" | "middle" | "bottom" | undefined) ??
    "middle";

  // 세그먼트 placeholder text — buildDateInputDisplayText 단일 소스 (datePickerShapes).
  //   layout 의 콘텐츠 폭 측정(calculateContentWidth dateinput 분기)이 동일 함수를 써서
  //   box 폭(layout)과 그려지는 텍스트(여기)가 어긋나지 않게 통일.
  const displayText = buildDateInputDisplayText({
    parentTag,
    granularity,
    hourCycle,
    locale,
  });

  const isPickerInput =
    parentTag === "DatePicker" || parentTag === "DateRangePicker";

  // 그룹 A↔B 통일 (factory canonical 자식): picker(DatePicker/DateRangePicker) 의 DateInput 은
  //   이제 SelectTrigger 래퍼 안의 flex 자식으로, box/border 는 SelectTrigger 가, calendar icon 은
  //   별도 SelectIcon 이 그린다. 따라서 picker DateInput 은 **segment text 만** 렌더한다(box/border/
  //   icon 그리면 SelectTrigger box + SelectIcon 과 이중 렌더). x=0 + baseline:middle → 노드
  //   containerHeight 중앙. DateField/TimeField(picker 아님)는 자신이 box 라 box+border+text 유지.
  if (isPickerInput) {
    return [
      {
        type: "text" as const,
        x: 0,
        y: 0,
        text: displayText,
        fontSize,
        fontFamily: ff,
        fontWeight: 400,
        fill: textColor,
        align: "left" as const,
        baseline: "middle" as const,
        verticalAlign: textVerticalAlign,
        whiteSpace: "nowrap" as const,
      },
    ];
  }

  return [
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
      verticalAlign: textVerticalAlign,
      whiteSpace: "nowrap" as const,
    },
  ];
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
 * 좌표: layout box height = trackHeight(8, ProgressBarTrack 동일).
 *   트랙은 box 전체(trackY=0, height=trackHeight). thumb 은 box 세로 중앙(trackHeight/2) 기준
 *   ±thumbSize/2 로 box 밖으로 그린다 (DOM 의 thumb position:absolute 와 동형 — box layout 제외).
 *   thumb 중심 = (width*p/100, trackHeight/2) — CSS `.react-aria-SliderThumb{top:50%}` +
 *   RAC inline `left:${p}%; transform:translate(-50%,-50%)` 와 동일 좌표.
 *
 * **thumb 렌더 소유권 (2026-07-14 복귀)**: 2026-06-10 에 SliderThumb element 로 이관했으나,
 *   그 전제인 `position:absolute + left:%` 배치가 composition-engine(Rust)에서 성립하지 않는다
 *   (inset_* 미소비 / Position::Absolute 부재 → thumb box 가 원점 고정 → x 가 value 를 따라가지
 *   않고 y 도 트랙 중앙에서 벗어남). `_containerWidth` 를 아는 본 escape 로 되돌려 DOM 정합 회복.
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

  // ── thumb 핸들 (2026-07-14 렌더 소유권 복귀) ────────────────────────────────
  // 2026-06-10 에 thumb 렌더를 SliderThumb element 로 넘겼으나, 그 전제("SliderThumb 이
  //   left:percent% 로 배치된다")가 **레이아웃 엔진에서 성립하지 않는다**:
  //   composition-engine(Rust)은 `position:absolute` / `inset_*` 를 레이아웃에 **반영하지 않는다**
  //   (Style.inset_* 필드는 tree.rs 에 선언·역직렬화만 되고 flex/block/grid 어느 알고리즘도
  //   읽지 않으며 Position::Absolute 개념 자체가 없음). 그래서 implicitStyles 가 주입한
  //   `left:"50%" + top + marginLeft` 가 전량 무시되어 SliderThumb box 가 항상 컨테이너
  //   원점(0,0)에 고정 → thumb 이 value 와 무관하게 트랙 좌측 끝에 그려지고(x 발산),
  //   세로도 트랙 중앙이 아니었다(y 발산). CSS(RAC useSliderThumb: left:%+translate(-50%,-50%))
  //   와 정면 발산.
  //
  // 본 escape 는 `_containerWidth`(=트랙 실폭) + value 를 이미 정확히 알고 replace 모드로
  //   트랙 box 전체를 소유하므로, thumb 을 여기서 그리면 엔진의 absolute 미지원과 무관하게
  //   DOM 과 동일한 좌표가 나온다. (SliderThumb element 는 selection/hit box 전용으로 잔존 —
  //   그 box 의 위치 정합은 엔진의 absolute 지원 없이는 불가능하므로 별도 과제.)
  //
  // 좌표 (DOM 대칭): thumb 중심 = (width * p, trackHeight/2)
  //   ← CSS `.react-aria-SliderThumb{top:50%}` + RAC inline `left:${p*100}%; translate(-50%,-50%)`
  //   trackHeight/2 는 트랙 box 세로 중앙 → thumb 이 트랙보다 커서 box 위아래로 넘침(정상).
  const thumbSize =
    typeof size.thumbSize === "number" && size.thumbSize > 0
      ? size.thumbSize
      : 18;
  const thumbRadius = thumbSize / 2;
  const thumbCenterY = trackHeight / 2;

  percents.forEach((p, i) => {
    const cx = (width * p) / 100;
    shapes.push({
      id: `thumb-${i}`,
      type: "circle",
      x: cx,
      y: thumbCenterY,
      radius: thumbRadius,
      fill: fillColor,
    });
    // border 2px {color.base} — CSS `.react-aria-SliderThumb{border:2px solid var(--bg)}` 정합.
    shapes.push({
      type: "border",
      target: `thumb-${i}`,
      borderWidth: 2,
      color: "{color.base}" as TokenRef,
      radius: thumbRadius,
    });
  });

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
  // chevron glyph 크기 = DOM `<ChevronLeft size={16}>`(Calendar/RangeCalendar) 고정 16 과 대칭.
  //   layout iconSize(sm20/md26/lg32)는 cellSize/좌표 전용 — glyph 크기와 분리(과거 fontSize+2 는
  //   size 별 가변 sm14/md16/lg18 → md 만 우연 일치, sm/lg CSS 16 과 어긋남). TagGroup remove X 축1
  //   동형 판정(DOM 고정-크기 아이콘 컨벤션). rule.sizes 미주입 폴백은 기존 fontSize+2 유지.
  const chevronGlyphSize =
    typeof size.iconSize === "number" && size.iconSize > 0
      ? CALENDAR_CHEVRON_DOM_PX
      : fontSize + 2;
  const specGap = typeof size.gap === "number" && size.gap > 0 ? size.gap : 6;
  // height: _containerHeight(CONTAINER_DIMENSION 주입, 실제 노드 높이) 우선 → size.height(rule) →
  //   30 폴백. width 가 _containerWidth 우선인 것과 대칭. cy(세로 중앙)를 실제 노드 높이 기준으로
  //   잡아야 DOM `align-items:center`(header 세로 중앙) 와 정합 — size.height(rule 고정 30)만 쓰면
  //   노드 높이가 30 과 다를 때(예: size lg / 명시 height) text·chevron 이 세로 중앙에서 벗어남.
  const containerHeightInj =
    (props._containerHeight as number | undefined) ?? 0;
  const height =
    containerHeightInj > 0
      ? containerHeightInj
      : typeof size.height === "number" && size.height > 0
        ? size.height
        : 30;
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
        : cellSize * 7 + specGap * 6;

  // ── B2 (2026-07-02): element.props.style layout 소비 (Style 패널 동기화) ──
  //   CalendarHeader 는 chevron/text/chevron 3-shape 고정 leaf(자식 Element 아님)라, CheckboxGroup 처럼
  //   컨테이너 flex 로 자식을 배치할 수 없다. 대신 primitive 가 element.props.style 의 padding/gap/
  //   justifyContent 를 직접 읽어 flex-like 배치를 계산 → Style 패널 Layout 편집이 Skia 에 반영.
  //   DOM 은 Calendar.tsx `<header>` inline style 로 동일 반영(대칭). 기본값(style 미지정)은 기존
  //   space-between + text 중앙(회귀 0): paddingX 0, chevron↔text gap 0(chevron 슬롯 cellSize 흡수).
  //   style-ssot 규칙: gap 은 columnGap/rowGap longhand 우선 → shorthand gap fallback.
  const padLeft = parsePxValue(
    (style?.paddingLeft ?? style?.padding) as string | number | undefined,
    size.paddingX ?? 0,
  );
  const padRight = parsePxValue(
    (style?.paddingRight ?? style?.padding) as string | number | undefined,
    size.paddingX ?? 0,
  );
  // chevron 슬롯(cellSize)↔text 여백. 기본 0(기존 배치 유지) — style 로만 벌린다.
  const itemGap = parsePxValue(
    (style?.columnGap ?? style?.rowGap ?? style?.gap) as
      | string
      | number
      | undefined,
    0,
  );
  const justify =
    (style?.justifyContent as string | undefined) ?? "space-between";
  const flexDirection = (style?.flexDirection as string | undefined) ?? "row";
  const isColumn =
    flexDirection === "column" || flexDirection === "column-reverse";
  // center text 세로 정렬: element.props.style.verticalAlign(Style 패널 Typography Vertical Align)
  //   우선, 미지정 시 기본 "middle"(DOM `<header>` align-items:center 대칭). specShapeConverter 가
  //   node.text.verticalAlign 로 전달 → nodeRendererText computeDrawY 가 `(node.height-textHeight)/2`
  //   진짜 세로 중앙. 미지정(top) 이면 위쪽 치우침이라 기본 middle 로 정합.
  const textVerticalAlign =
    (style?.verticalAlign as "top" | "middle" | "bottom" | undefined) ??
    "middle";

  const textColor =
    (style?.color as string | undefined) ?? visual?.text ?? undefined;
  const iconColor = li.color ?? ti.color ?? textColor;
  const textAlign = visual?.textAlign ?? "center";
  const text =
    typeof props.children === "string" && props.children
      ? props.children
      : "2024년 1월";

  // ── flexDirection: column — chevron/text/chevron 을 세로로 쌓음 (Style 패널 동기화 후속) ──
  //   DOM `<header>` 가 flex-direction:column 이면 자식(prev/heading/next)이 세로 배치되므로
  //   Skia 도 대칭(위 chevron / 중앙 text / 아래 chevron, x 는 컨테이너 중앙). row 는 기존 좌표 유지.
  if (isColumn) {
    const colHeight =
      containerHeightInj > 0 ? containerHeightInj : cellSize * 3 + itemGap * 2;
    const cx = width / 2;
    // 세로 3슬롯: 위 chevron cellSize/2, 중앙 text colHeight/2, 아래 chevron colHeight-cellSize/2.
    return [
      {
        type: "icon_font",
        iconName: li.name,
        x: cx,
        y: padLeft > 0 ? padLeft + cellSize / 2 : cellSize / 2,
        fontSize: chevronGlyphSize,
        fill: iconColor,
        strokeWidth: (props.strokeWidth as number | undefined) ?? 2,
      },
      {
        type: "text",
        x: 0,
        // y=0 + baseline:middle → 컨테이너(colHeight) 세로 중앙 = 위/아래 chevron 사이 중앙.
        //   y>0 은 lineHeight 근사 경로라 회피(row 동일 사유).
        y: 0,
        text,
        fontSize,
        fontFamily: fontFamily.sans,
        fontWeight: 700,
        fill: textColor,
        align: "center",
        baseline: "middle",
        verticalAlign: textVerticalAlign,
        maxWidth: width,
      },
      {
        type: "icon_font",
        iconName: ti.name,
        x: cx,
        y: colHeight - cellSize / 2,
        fontSize: chevronGlyphSize,
        fill: iconColor,
        strokeWidth: (props.strokeWidth as number | undefined) ?? 2,
      },
    ];
  }

  // 좌·우 chevron 중심 x + text 슬롯 [textLeft, textRight] 계산 (row).
  //   space-between(기본): chevron 을 padding 안쪽 양끝에, text 는 그 사이 대칭 슬롯 center.
  //   center: 3요소(chevron+gap+text+gap+chevron)를 컨테이너 중앙에 모음 — text 실측 폭 필요.
  let leftIconX: number;
  let rightIconX: number;
  let textLeft: number;
  let textRight: number;
  if (justify === "center") {
    const textW = measureSpecTextWidth(text, fontSize, fontFamily.sans);
    const totalW = cellSize + itemGap + textW + itemGap + cellSize;
    const startX = (width - totalW) / 2;
    leftIconX = startX + cellSize / 2;
    textLeft = startX + cellSize + itemGap;
    textRight = textLeft + textW;
    rightIconX = textRight + itemGap + cellSize / 2;
  } else {
    // space-between (기본) — chevron padding 안쪽 양끝, text 대칭 슬롯.
    leftIconX = padLeft + cellSize / 2;
    rightIconX = width - padRight - cellSize / 2;
    textLeft = padLeft + cellSize + itemGap;
    textRight = width - padRight - cellSize - itemGap;
  }

  return [
    {
      type: "icon_font",
      iconName: li.name,
      x: leftIconX,
      y: cy,
      fontSize: chevronGlyphSize,
      fill: iconColor,
      strokeWidth: (props.strokeWidth as number | undefined) ?? 2,
    },
    {
      type: "text",
      x: textLeft,
      // y=0 + baseline:"middle" → specShapeConverter 가 `(containerHeight - textBlockHeight)/2`
      //   (컨테이너 실제 높이 기준 진짜 세로 중앙)로 배치 = chevron(icon_font baseline:middle →
      //   containerHeight/2)과 동일 경로. y>0(cy) 을 주면 text 는 `y - lineHeightPx/2` 경로를 타
      //   lineHeight 근사에 의존해 chevron 과 어긋남(위쪽 치우침) → y=0 으로 컨테이너 중앙 위임.
      y: 0,
      text,
      fontSize,
      fontFamily: fontFamily.sans,
      fontWeight: 700,
      fill: textColor,
      align: textAlign,
      baseline: "middle",
      // 세로 중앙: verticalAlign(기본 middle, style override) → specShapeConverter → computeDrawY
      //   `(node.height-textHeight)/2`. baseline:"middle"(좌표)만으론 lineHeight 근사라 위쪽 치우침.
      verticalAlign: textVerticalAlign,
      // flex 중앙 정렬: text 는 [textLeft, textRight] 슬롯에서 center → 중심 = 슬롯 중앙.
      //   space-between 기본 슬롯 [padLeft+cellSize, width-padRight-cellSize] → 중심 width/2.
      //   ⚠️ whiteSpace:"nowrap" 금지 — nodeRendererText 가 nowrap 시 layoutMaxWidth=100000 으로
      //   maxWidth 를 덮어 center 정렬 무력화 → text 가 textLeft 에서 왼쪽 정렬(왼쪽 치우침).
      //   calendar_grid nav text(동형)도 nowrap 미지정. "2026년 7월"은 maxWidth 내라 wrap 안 됨.
      maxWidth: Math.max(0, textRight - textLeft),
    },
    {
      type: "icon_font",
      iconName: ti.name,
      x: rightIconX,
      y: cy,
      fontSize: chevronGlyphSize,
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
 *   metric(box/padding/gap/heading·desc 폰트/line height/전체 높이)은
 *   `resolveIllustratedMessageMetric`(illustratedMessageMetrics.ts — DOM/layout 과 공유 SSOT,
 *   catalog rule sizes read-through) 단일 산식. 텍스트 색은 visual.text.
 *
 * **ADR-151 후속 (2026-07-17) 기하 정렬**: 구 escape 는 top-left(0,0) 고정 + padding/정렬
 *   배치 부재 + layout 높이 분기 부재로 박스(48)를 넘쳐 그렸다 (DOM 240 vs Skia 48).
 *   DOM(flex column + factory style: padding/gap/alignItems) 과 동일 기하로 재작성 —
 *   padding/gap/alignItems 는 element style 우선 (longhand → shorthand → metric fallback,
 *   style-ssot 규칙), 가로 폭은 `_containerWidth`(CONTAINER_DIMENSION_TAGS 주입) 기준.
 *   factory 기본 style 이 alignItems:flex-start (catalog structure.containerStyles 미러) 라
 *   기본 렌더는 좌측 정렬 — style 부재 시 컴포넌트 내부 기본(center)과 동일하게 center.
 */
const illustratedMessage: SkiaPrimitiveDrawFn = ({
  props,
  size,
  visual,
  style,
}) => {
  // 자식 보유 시(미래 확장) escape skip — props 기반 단독 leaf 만 그린다.
  if ((props as Record<string, unknown>)._hasChildren) return [];

  const sizeName = (props.size as string) ?? "md";
  // fontSize 는 size(rule) 만 — merged style map 의 fontSize 는 base 가 항상 채워져
  // override 판정 불능 (feedback-merged-style-map-kills-override-detection). DOM 도
  // heading/desc 에 metric fs 를 명시해 root fontSize 를 상속하지 않는다.
  const m = resolveIllustratedMessageMetric(sizeName, size);

  // element style 소비 (store longhand 정책: longhand → shorthand → metric fallback).
  const padTop = parsePxValue(
    (style?.paddingTop ?? style?.padding) as string | number | undefined,
    m.paddingY,
  );
  const padLeft = parsePxValue(
    (style?.paddingLeft ?? style?.padding) as string | number | undefined,
    m.paddingX,
  );
  const padRight = parsePxValue(
    (style?.paddingRight ?? style?.padding) as string | number | undefined,
    m.paddingX,
  );
  const gap = parsePxValue(
    (style?.rowGap ?? style?.gap) as string | number | undefined,
    m.gap,
  );
  const alignItems = (style?.alignItems as string | undefined) ?? "center";

  const containerWidth =
    typeof props._containerWidth === "number" && props._containerWidth > 0
      ? (props._containerWidth as number)
      : m.box + padLeft + padRight;
  const contentX = padLeft;
  const contentW = Math.max(containerWidth - padLeft - padRight, m.box);
  const boxX =
    alignItems === "flex-start"
      ? contentX
      : alignItems === "flex-end"
        ? contentX + contentW - m.box
        : contentX + (contentW - m.box) / 2;
  const textAlign =
    alignItems === "flex-start"
      ? ("left" as const)
      : alignItems === "flex-end"
        ? ("right" as const)
        : ("center" as const);

  const ff = (style?.fontFamily as string) || fontFamily.sans;
  const textColor =
    (style?.color as string | undefined) ??
    visual?.text ??
    ("{color.neutral}" as TokenRef);

  const heading = (props.heading as string) ?? "No content";
  const description =
    (props.description as string) ?? "There is nothing to display.";

  const shapes: Shape[] = [];

  // 일러스트 placeholder 영역 — DOM `--bg-muted` solid ({color.neutral-subtle}).
  shapes.push({
    id: "illustration",
    type: "roundRect" as const,
    x: boxX,
    y: padTop,
    width: m.box,
    height: m.box,
    radius: 12,
    fill: "{color.neutral-subtle}" as TokenRef,
  });

  // placeholder 중앙 ○ glyph — DOM `&#9675;` fontSize 48 / --fg-muted 미러.
  shapes.push({
    id: "illustration-glyph",
    type: "text" as const,
    x: boxX,
    y: padTop + m.box / 2,
    text: "○",
    fontSize: 48,
    fontFamily: ff,
    fill: "{color.neutral-subdued}" as TokenRef,
    align: "center" as const,
    baseline: "middle" as const,
    maxWidth: m.box,
    whiteSpace: "nowrap" as const,
  });

  // Heading 텍스트 — DOM fontWeight 600 / var(--fg), lineHeight 1.5 밴드 세로 중앙.
  shapes.push({
    id: "heading",
    type: "text" as const,
    x: contentX,
    y: padTop + m.box + gap + m.headingLine / 2,
    text: heading,
    fontSize: m.headingFs,
    fontFamily: ff,
    fontWeight: 600,
    fill: textColor,
    align: textAlign,
    baseline: "middle" as const,
    maxWidth: contentW,
  });

  // Description 텍스트 — DOM var(--fg-muted), lineHeight 1.5 밴드 세로 중앙.
  shapes.push({
    id: "description",
    type: "text" as const,
    x: contentX,
    y: padTop + m.box + gap + m.headingLine + gap + m.descLine / 2,
    text: description,
    fontSize: m.descFs,
    fontFamily: ff,
    fill: "{color.neutral-subdued}" as TokenRef,
    align: textAlign,
    baseline: "middle" as const,
    maxWidth: contentW,
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

  // x=0/y=0 + align:center/baseline:middle → 컨테이너(=원 지름) 전체 기준 정중앙.
  // specShapeConverter 의 text x 계약은 "중심 좌표"가 아니라 "좌측 오프셋 padding" 이다:
  //   x>0 + align:center → paddingLeft=x, maxWidth=containerWidth-2x (좌우 대칭 여백 축소)
  // 따라서 x=radius 를 넘기면 정렬 기준 구간이 [radius, radius+diameter] 로 밀려
  // 이니셜이 원 우측 가장자리에 그려진다(DOM Avatar.tsx 의 justifyContent:center 와 발산).
  shapes.push({
    type: "text" as const,
    x: 0,
    y: 0,
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
  // ADR-166 Phase 4: dialog_shadow / popover_shadow 제거 (catalog boxShadow 단일 채널)
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
 *   backdrop(전체화면 rect). ADR-166 Phase 4 이후 shadow 계열은 이 모드를 쓰지 않는다
 *   (그림자는 primitive 가 아니라 catalog `boxShadow` → Skia effect 로 나간다).
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
