/**
 * Implicit Style Injection — 공유 모듈
 *
 * BuilderCanvas의 createContainerChildRenderer에서 인라인으로 적용되던
 * 태그별 implicit style 규칙을 순수 함수로 추출.
 *
 * fullTreeLayout.ts의 DFS 순회와 BuilderCanvas 양쪽에서 재사용하여
 * 레이아웃 결과의 일관성을 보장한다.
 *
 * @since 2026-02-28 Phase 1 — Full-Tree WASM Layout 통합
 */

import type { Element } from "../../../../../types/core/store.types";
import { parsePadding, PHANTOM_INDICATOR_CONFIGS } from "./utils";
import {
  InlineAlertSpec,
  BreadcrumbsSpec,
  GridListItemSpec,
  normalizeBreadcrumbRspSizeKey,
  resolveToken,
  resolveContainerStylesFallback as _resolveContainerStylesFallback,
  resolveContainerVariants,
  matchNestedSelector,
} from "@composition/specs";
import type { SizeSpec } from "@composition/specs";
import { getNecessityIndicatorSuffix } from "@composition/shared/components";
import { findAncestorByTag } from "../../skia/ancestorLookup";
import { LOWERCASE_TAG_SPEC_MAP } from "./tagSpecLookup";

// ─── 헬퍼 ────────────────────────────────────────────────────────────

/** CSS density 정합: size 명시 → size 기반, size 미명시 → density="regular"이면 lg */
function resolveTabPanelPadding(
  sizeName: string,
  hasExplicitSize: boolean,
  density: string,
): number {
  // ADR-091 Phase 2: TABS_PANEL_PADDING 중간 캐시 → specSizeField 직접 lookup.
  //   `specSizeField` 내부 `sizes[sz] ?? sizes[defaultSize]` fallback 활용 → md 명시 불필요.
  if (hasExplicitSize)
    return specSizeField("tabpanels", sizeName, "paddingX") ?? 16;
  if (density === "regular")
    return specSizeField("tabpanels", "lg", "paddingX") ?? 16;
  return specSizeField("tabpanels", sizeName, "paddingX") ?? 16;
}

// ─── 인터페이스 ──────────────────────────────────────────────────────

export interface ImplicitStyleResult {
  /** 스타일이 주입된 부모 요소 (원본 또는 변환본) */
  effectiveParent: Element;
  /** 필터링 + 스타일 주입된 자식 배열 */
  filteredChildren: Element[];
}

// ─── 공유 유틸 ──────────────────────────────────────────────────────

/** ProgressBar/Meter value → 포맷된 텍스트 (implicitStyles + ElementSprite 공유) */
export function formatProgressValue(
  value: number,
  min: number,
  max: number,
  formatOptions?: Record<string, unknown> | null,
): string {
  if (!formatOptions?.style || formatOptions.style === "percent") {
    const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
    return `${Math.round(Math.max(0, Math.min(100, percent)))}%`;
  }
  // currency/unit style에 필수값 없으면 decimal fallback
  const style = formatOptions.style as Intl.NumberFormatOptions["style"];
  if (style === "currency" && !formatOptions.currency) {
    return String(Math.round(value));
  }
  if (style === "unit" && !formatOptions.unit) {
    return String(Math.round(value));
  }
  try {
    const opts: Intl.NumberFormatOptions = { style };
    if (formatOptions.currency) opts.currency = String(formatOptions.currency);
    if (formatOptions.unit) opts.unit = String(formatOptions.unit);
    if (formatOptions.notation)
      opts.notation =
        formatOptions.notation as Intl.NumberFormatOptions["notation"];
    return new Intl.NumberFormat(undefined, opts).format(value);
  } catch {
    return String(Math.round(value));
  }
}

// ADR-096 Phase 4: LOWERCASE_TAG_SPEC_MAP 을 `engines/tagSpecLookup.ts` 공유
//   모듈로 hoist. utils.ts 에서도 defaultWidth/defaultHeight lookup 에 재사용.

// ADR-086 P2: spec.sizes 기반 필드 직접 소비 헬퍼 (Record 전수 폐쇄용).
//   `TAG_SPEC_MAP[type].sizes[sizeName]` lookup 을 정규화 + default size fallback.
function specSizeField<K extends keyof SizeSpec>(
  type: string,
  sizeName: string,
  field: K,
): SizeSpec[K] | undefined {
  const spec = LOWERCASE_TAG_SPEC_MAP.get(type);
  if (!spec) return undefined;
  const size = spec.sizes[sizeName] ?? spec.sizes[spec.defaultSize];
  return size?.[field];
}

/** `spec.sizes[size].fontSize` TokenRef → px number resolve. 실패 시 undefined. */
function specSizeFontSize(type: string, sizeName: string): number | undefined {
  const fs = specSizeField(type, sizeName, "fontSize");
  if (fs == null) return undefined;
  if (typeof fs === "number") return fs;
  const resolved = resolveToken(fs);
  return typeof resolved === "number" ? resolved : undefined;
}

/** `spec.sizes[size].lineHeight` TokenRef → px number resolve. 실패 시 undefined. */
function specSizeLineHeight(
  type: string,
  sizeName: string,
): number | undefined {
  const lh = specSizeField(type, sizeName, "lineHeight");
  if (lh == null) return undefined;
  if (typeof lh === "number") return lh;
  const resolved = resolveToken(lh);
  return typeof resolved === "number" ? resolved : undefined;
}

/**
 * ADR-108 P0: packages/specs `resolveContainerStylesFallback` wrapper.
 *
 * builder 측 `LOWERCASE_TAG_SPEC_MAP` (packages/specs 102 정본 + 8 alias 병합) 을
 * 주입하여 ComboBoxWrapper 등 alias type 도 정본 spec 의 containerStyles 로 fallback.
 * 테스트 (`resolveContainerStylesFallback.test.ts` / `tokenConsumerDrift.test.ts`) 는
 * 본 파일에서 export 된 wrapper 를 import — ADR-080 G1 계약 유지.
 */
export function resolveContainerStylesFallback(
  type: string,
  parentStyle: Record<string, unknown>,
): Record<string, unknown> {
  return _resolveContainerStylesFallback(
    type,
    parentStyle,
    LOWERCASE_TAG_SPEC_MAP,
  );
}

// ─── 내부 상수 ──────────────────────────────────────────────────────

/**
 * ComboBox/Select/SelectTrigger/ComboBoxWrapper 공통 spec padding
 * (ADR-105-d — formerly @sync F5-4 annotation)
 * Select.css / ComboBox.css size variants 와 동일 값. SelectSpec.sizes / ComboBoxSpec.sizes 에서
 * SSOT 정의됨. Canvas implicit styles 계산용 로컬 복제 — specs 패키지 import 비용 대비 유지 정당.
 * Spec.sizes padding 변경 시 이 테이블도 동시 갱신 필요.
 * CSS padding: top right bottom left — right = top (paddingY), left = paddingLeft
 */
const SPEC_PADDING: Record<string, { left: number; right: number; y: number }> =
  {
    xs: { left: 4, right: 1, y: 1 },
    sm: { left: 8, right: 2, y: 2 },
    md: { left: 12, right: 4, y: 4 },
    lg: { left: 16, right: 8, y: 8 },
    xl: { left: 24, right: 12, y: 12 },
  };

/**
 * ADR-086 P2: size-indexed Record 9 종 폐쇄 (SPEC_ICON_SIZE/SPEC_INPUT_FONT_SIZE/
 *   SPEC_TRIGGER_HEIGHT/PROGRESSBAR_BAR_HEIGHT/PROGRESSBAR_FONT_SIZE/SIZE_LINE_HEIGHT/
 *   SLIDER_TRACK_LAYOUT_HEIGHT/SLIDER_FONT_SIZE/calPadGap). `specSizeField` / `specSizeFontSize` /
 *   `specSizeLineHeight` 헬퍼 + `SliderSpec.sizes[s].indicator.thumbSize` 직접 lookup 으로 대체.
 *
 * ADR-088: 잔존 1 종 `SLIDER_COL_GAP` 해체 완료.
 *   `SizeSpec.columnGap?` 신규 필드 + `SliderSpec.sizes[s].columnGap` 선언 +
 *   `specSizeField("slider", sizeName, "columnGap")` 직접 lookup 으로 대체.
 *   Preview CSS 도 `CSSGenerator.generateSizeStyles` 의 column-gap emit 확장으로 대칭 복원.
 */

/** Checkbox/Radio indicator 크기 (spec shapes 렌더링, Taffy 트리 밖) */
const INDICATOR_SIZES: Record<string, { box: number; gap: number }> = {
  sm: { box: 16, gap: 6 },
  md: { box: 20, gap: 8 },
  lg: { box: 24, gap: 10 },
};

/** ProgressBar/Meter — CSS: row-gap: var(--spacing-xs)=4px, column-gap: var(--spacing-md)=12px */
const PROGRESSBAR_ROW_GAP = 4;
const PROGRESSBAR_COL_GAP = 12;

/** ProgressBar/Meter 태그 집합 */
const PROGRESSBAR_TAGS = new Set([
  "progressbar",
  "progress",
  "loadingbar",
  "meter",
  "gauge",
]);

/** Slider 태그 집합 */
const SLIDER_TAGS = new Set(["slider"]);
/** DatePicker/DateRangePicker 내 Popover로 표시되는 자식 — Taffy 레이아웃 제외 */
const POPOVER_CHILDREN_TAGS = new Set(["Calendar", "RangeCalendar"]);

/**
 * Slider row-gap (CSS: var(--spacing-xs) = 4px).
 *
 * ADR-088: column-gap 은 `SliderSpec.sizes[s].columnGap` SSOT 로 이관 완료. Record 제거.
 *   소비처는 `specSizeField("slider", sizeName, "columnGap")` 로 직접 lookup.
 */
const SLIDER_ROW_GAP = 4;

/** Synthetic Label을 생성하는 태그 */
const SYNTHETIC_LABEL_TAGS = new Set([
  "radio",
  "checkbox",
  "switch",
  "toggle",
  "progressbar",
  "progress",
  "loadingbar",
  "meter",
  "gauge",
]);

/** Necessity Indicator 지원 태그 — Label 자식에 suffix 주입 대상 */
const NECESSITY_INDICATOR_TAGS = new Set([
  "textfield",
  "textarea",
  "numberfield",
  "searchfield",
  "select",
  "combobox",
  "datefield",
  "timefield",
  "colorfield",
  "checkboxgroup",
  "radiogroup",
  "taggroup",
]);

const FORM_SIDE_LABEL_WIDTH = 176;
const FORM_SIDE_LABEL_GAP = 16;

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────

/**
 * 사용자 padding이 설정되어 있는지 확인.
 * shorthand(padding) 또는 개별(paddingTop 등) 중 하나라도 있으면 true.
 */
function hasUserPadding(style: Record<string, unknown>): boolean {
  return (
    style.padding !== undefined ||
    style.paddingTop !== undefined ||
    style.paddingBottom !== undefined ||
    style.paddingLeft !== undefined ||
    style.paddingRight !== undefined
  );
}

/**
 * spec size에 따른 padding을 주입한 스타일 반환.
 * 사용자 padding이 있으면 parsePadding으로 해석, 없으면 spec 기본값.
 */
function withSpecPadding(
  style: Record<string, unknown>,
  sizeName: string,
): Record<string, unknown> {
  const specPad = SPEC_PADDING[sizeName] ?? SPEC_PADDING.md;
  const userPad = hasUserPadding(style) ? parsePadding(style) : null;
  return {
    ...style,
    paddingLeft: userPad ? userPad.left : specPad.left,
    paddingRight: userPad ? userPad.right : specPad.right,
    paddingTop: userPad ? userPad.top : specPad.y,
    paddingBottom: userPad ? userPad.bottom : specPad.y,
  };
}

/**
 * 부모 요소의 style을 변경한 새 Element를 반환.
 */
function withParentStyle(el: Element, style: Record<string, unknown>): Element {
  return {
    ...el,
    props: { ...el.props, style },
  };
}

/** GridListItem/ListBoxItem 자식 Text/Description에 CSS 정합성 fontSize/fontWeight/width 주입 */
function injectCollectionItemFontStyles(children: Element[]): Element[] {
  return children.map((child) => {
    const cs = (child.props?.style as Record<string, unknown>) || {};
    if (child.type === "Text") {
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            fontSize: cs.fontSize ?? 14,
            fontWeight: cs.fontWeight ?? 600,
            width: cs.width ?? "100%",
          },
        },
      };
    }
    if (child.type === "Description") {
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            fontSize: cs.fontSize ?? 12,
            width: cs.width ?? "100%",
          },
        },
      };
    }
    return child;
  });
}

function injectSideLabelLabelAndWrapperStyles(
  children: Element[],
  wrapperTags: ReadonlySet<string>,
): Element[] {
  return children.map((child) => {
    const cs = (child.props?.style || {}) as Record<string, unknown>;

    if (child.type === "Label") {
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            width: cs.width ?? FORM_SIDE_LABEL_WIDTH,
            flexShrink: cs.flexShrink ?? 0,
            alignSelf: cs.alignSelf ?? "flex-start",
          },
        },
      };
    }

    if (!wrapperTags.has(child.type)) return child;

    return {
      ...child,
      props: {
        ...child.props,
        style: {
          ...cs,
          flex: cs.flex ?? 1,
          minWidth: cs.minWidth ?? 0,
        },
      },
    };
  });
}

function injectSideLabelLabelAndContentStyles(
  children: Element[],
  contentTags: ReadonlySet<string>,
): Element[] {
  return children.map((child) => {
    const cs = (child.props?.style || {}) as Record<string, unknown>;

    if (child.type === "Label") {
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            width: cs.width ?? FORM_SIDE_LABEL_WIDTH,
            flexShrink: cs.flexShrink ?? 0,
            alignSelf: cs.alignSelf ?? "flex-start",
          },
        },
      };
    }

    if (child.type === "FieldError" || child.type === "Description") {
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            width: cs.width ?? "100%",
            marginLeft:
              cs.marginLeft ?? FORM_SIDE_LABEL_WIDTH + FORM_SIDE_LABEL_GAP,
          },
        },
      };
    }

    if (!contentTags.has(child.type)) return child;

    return {
      ...child,
      props: {
        ...child.props,
        style: {
          ...cs,
          flex: cs.flex ?? 1,
          minWidth: cs.minWidth ?? 0,
        },
      },
    };
  });
}

function getSideLabelParentStyle(
  specFallback: Record<string, unknown>,
  rawParentStyle: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...specFallback,
    display: "flex",
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    gap: specFallback.gap ?? 4,
    ...rawParentStyle,
  };
}

function resolveActiveContainerVariants(
  containerTag: string,
  containerProps: Record<string, unknown> | undefined,
) {
  return resolveContainerVariants(
    LOWERCASE_TAG_SPEC_MAP.get(containerTag),
    containerProps ?? undefined,
  );
}

function hasResolvedSideLabelVariant(styles: Record<string, string>): boolean {
  return styles.display === "grid" || styles["flex-direction"] === "row";
}

function injectMatchedSideLabelContentStyles(
  children: Element[],
  nested: Array<{ selector: string }>,
  contentTags: ReadonlySet<string>,
): Element[] {
  return children.map((child) => {
    const childTag = child.type ?? "";
    const matches = nested.some((n) =>
      matchNestedSelector(n.selector, { type: childTag }, true),
    );
    if (!matches) return child;
    const [adapted] = injectSideLabelLabelAndContentStyles(
      [child],
      contentTags,
    );
    return adapted ?? child;
  });
}

function getDelegatedSize(
  el: Element,
  elementById: Map<string, Element>,
): string {
  const ownSize = (el.props as Record<string, unknown> | undefined)?.size;
  if (typeof ownSize === "string" && ownSize.trim()) {
    return ownSize;
  }

  const parent = el.parent_id ? elementById.get(el.parent_id) : undefined;
  const parentSize = (parent?.props as Record<string, unknown> | undefined)
    ?.size;
  if (typeof parentSize === "string" && parentSize.trim()) {
    return parentSize;
  }

  const grandParent = parent?.parent_id
    ? elementById.get(parent.parent_id)
    : undefined;
  const grandParentSize = (
    grandParent?.props as Record<string, unknown> | undefined
  )?.size;
  if (typeof grandParentSize === "string" && grandParentSize.trim()) {
    return grandParentSize;
  }

  return "md";
}

// ─── 공개 API ────────────────────────────────────────────────────────

/**
 * 컨테이너 태그에 따라 implicit style을 부모/자식에 주입하고,
 * 렌더링 대상 자식을 필터링한다.
 *
 * 이 함수는 레이아웃 전처리만 담당한다.
 * 렌더링 시점 로직(Card props 동기화, backgroundColor 방어 등)은 포함하지 않는다.
 *
 * @param containerEl   - 컨테이너 요소
 * @param children      - 원본 자식 배열
 * @param getChildElements - 자식 Element 배열 accessor (Tabs dual lookup용)
 * @param elementById   - 전역 요소 맵 (ComboBoxWrapper → 부모 ComboBox 조회용)
 */
export function applyImplicitStyles(
  containerEl: Element,
  children: Element[],
  getChildElements: (id: string) => Element[],
  elementById: Map<string, Element>,
  /** 현재 노드에 사용 가능한 너비 (px) — maxRows 행 시뮬레이션용 */
  _availableWidth?: number,
): ImplicitStyleResult {
  const containerTag = (containerEl.type ?? "").toLowerCase();
  // ADR-083 Phase 0: Spec.containerStyles fallback 공통 선주입 layer.
  //   Spec 미선언 태그 → resolveContainerStylesFallback 이 {} 반환 → 영향 없음.
  //   Spec 선언 태그 (ADR-078 ListBox / ADR-079 ListBoxItem 외 Phase 1~11 로 리프팅될
  //   spec) → 10 필드 중 parentStyle 에 없는 것만 선주입. 기존 inline 값은
  //   rawParentStyle 가 specFallback 을 override → 사용자 편집 우선 보존.
  const rawParentStyle = (containerEl.props?.style || {}) as Record<
    string,
    unknown
  >;
  const specFallback = resolveContainerStylesFallback(
    containerTag,
    rawParentStyle,
  );
  const parentStyle: Record<string, unknown> = {
    ...specFallback,
    ...rawParentStyle,
  };
  const containerProps = containerEl.props as
    | Record<string, unknown>
    | undefined;

  let effectiveParent = containerEl;
  let filteredChildren = children;

  // ── Menu ──────────────────────────────────────────────────────────
  // Menu는 트리거 버튼만 캔버스에 렌더링 — MenuItem 자식은 Popover이므로 Taffy 레이아웃 제외
  if (containerTag === "menu") {
    filteredChildren = [];
    return { effectiveParent, filteredChildren };
  }

  // ── TagGroup ───────────────────────────────────────────────────────
  // CSS 구조: TagGroup(column) > Label + TagList(row wrap) > Tags
  // TagList가 있으면 column 통과, 없으면(레거시) row wrap으로 보정
  if (containerTag === "taggroup") {
    const hasTagList = children.some((c) => c.type === "TagList");
    const tagGroupVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(tagGroupVariant.styles);

    // Compositional Label: whiteSpace nowrap 주입 (줄바꿈 방지)
    filteredChildren = children.map((child) => {
      if (child.type === "Label") {
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              whiteSpace: cs.whiteSpace ?? "nowrap",
            },
          },
        } as Element;
      }
      return child;
    });

    const tgDefaultDir = hasTagList ? "column" : "row";
    // ADR-087 SP6: display/gap 는 TagGroup.spec containerStyles 로 리프팅됨.
    //   labelPosition side 는 ADR-108 containerVariants 데이터로 판정한다.
    effectiveParent = withParentStyle(containerEl, {
      ...specFallback,
      ...(sideMode
        ? {
            flexDirection: tagGroupVariant.styles["flex-direction"] ?? "row",
            alignItems: tagGroupVariant.styles["align-items"] ?? "flex-start",
          }
        : {
            flexDirection: specFallback.flexDirection ?? tgDefaultDir,
          }),
      flexWrap: hasTagList && !sideMode ? undefined : "wrap",
      ...rawParentStyle,
    });
  }

  // ── TagList ──────────────────────────────────────────────────────
  // ADR-097 Phase 4B: items SSOT 전환 — TagList.spec.ts shapes 가 props.items 를
  //   직접 consume 하여 chip self-render (ListBox 선례 대칭).
  //   Tag 자식 element 기반 whiteSpace injection / maxRows 근사 계산 / "Show all"
  //   synthetic Tag 생성 로직은 spec shapes 로 이관되어 본 분기에서 완전 삭제.
  //   layout intrinsic height 는 utils.ts calculateContentHeight taglist 분기에서
  //   items 기반 wrap 시뮬레이션으로 계산.
  //
  // 본 분기에 잔존: containerStyles 에서 커버하지 못하는 runtime fork 만 유지.
  //   - TagGroup.orientation (현재 TagGroup 에 없음, HC#2) 방어적 분기
  //   - TagGroup.labelPosition="side" 시 flex:1/minWidth:0 주입
  //   - gap fallback (4 = TagListSpec.sizes.md.gap 일치)
  if (containerTag === "taglist") {
    const parentEl = containerEl.parent_id
      ? elementById.get(containerEl.parent_id)
      : undefined;
    const parentProps = parentEl?.props as Record<string, unknown> | undefined;
    const orientation = parentProps?.orientation as string | undefined;
    const parentTag = (parentEl?.type ?? "").toLowerCase();
    const parentVariant =
      parentTag === "taggroup"
        ? resolveActiveContainerVariants(parentTag, parentProps)
        : { styles: {} };
    const parentSideMode = hasResolvedSideLabelVariant(parentVariant.styles);

    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      // orientation="vertical" 시 spec default(row+wrap) 를 column 으로 override.
      ...(orientation === "vertical"
        ? { flexDirection: "column" as const, flexWrap: undefined }
        : {}),
      gap: parentStyle.gap ?? 4,
      // labelPosition: "side" 시 flex:1로 남은 공간 차지 (Label 옆 배치)
      ...(parentSideMode ? { flex: 1, minWidth: 0 } : {}),
    });
  }

  // ── ListBox ──────────────────────────────────────────────────────────
  // ADR-078 Phase 5: Spec archetype="collection" = display:flex + flex-direction:column.
  //   Preview CSS / Canvas Skia / Style Panel 모두 동일 의미론 (items 수직 배치).
  //   padding 은 shorthand fallback 만 주입하고 paddingTop/Right/Bottom/Left 별도 주입 금지.
  //   이유: 사용자가 `padding` shorthand 를 편집했을 때 `paddingTop:4` 같은 4-way fallback 이
  //   덮어씌우면 `calculateContentHeight` 가 `style.paddingTop ?? style.padding` 순서로 읽어
  //   항상 stale 값(4) 을 반환. height 가 padding 편집을 따라가지 못하는 버그 근본 원인.
  //   사용자가 4-way 로 직접 편집한 값은 spread 로 자동 유지.
  // ADR-080: layout fallback 상수(display/flexDirection/gap/padding) 는
  //   `ListBoxSpec.containerStyles` SSOT 로부터 read-through. TokenRef 는 resolveToken 경유.
  // ADR-083 Phase 0: resolveContainerStylesFallback 중복 호출 제거.
  //   공통 선주입 layer(applyImplicitStyles 진입부)가 이미 parentStyle 에 ListBoxSpec
  //   containerStyles fallback 을 주입. 본 분기는 effectiveParent 에 parentStyle 전달만 담당.
  if (containerTag === "listbox") {
    effectiveParent = withParentStyle(containerEl, { ...parentStyle });
  }

  // ── GridList ─────────────────────────────────────────────────────────
  // layout: "stack" → display:flex column, "grid" → display:grid with columns
  if (containerTag === "gridlist") {
    const layout = containerProps?.layout as string | undefined;
    const columns = (containerProps?.columns as number) || 2;
    const gap = 12;

    if (layout === "grid") {
      effectiveParent = withParentStyle(containerEl, {
        ...parentStyle,
        display: "grid",
        gridTemplateColumns: Array(columns).fill("1fr"),
        gap: parentStyle.gap ?? gap,
        overflow: parentStyle.overflow ?? "hidden",
      });
    } else {
      effectiveParent = withParentStyle(containerEl, {
        ...parentStyle,
        display: "flex",
        flexDirection: "column",
        gap: parentStyle.gap ?? gap,
      });
    }
  }

  // ── GridListItem ────────────────────────────────────────────────
  // ADR-090 Phase 4: display/flexDirection 은 GridListItem.spec.containerStyles 로 리프팅됨
  //   (resolveContainerStylesFallback 경유 parentStyle 주입).
  //   padding/gap/borderWidth 는 GridListItemSpec.sizes.md 에서 SSOT 참조 (Taffy shorthand 미지원).
  if (containerTag === "gridlistitem") {
    const sz = GridListItemSpec.sizes.md;
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      // CSS grid 1fr 트랙 내에서 축소되도록 minWidth: 0 (CSS minmax(0, 1fr) 동기화)
      minWidth: parentStyle.minWidth ?? 0,
      gap: parentStyle.gap ?? (sz.gap as number),
      paddingTop: parentStyle.paddingTop ?? (sz.paddingY as number),
      paddingBottom: parentStyle.paddingBottom ?? (sz.paddingY as number),
      paddingLeft: parentStyle.paddingLeft ?? (sz.paddingX as number),
      paddingRight: parentStyle.paddingRight ?? (sz.paddingX as number),
      borderWidth: parentStyle.borderWidth ?? 1,
    });
    filteredChildren = injectCollectionItemFontStyles(filteredChildren);
  }

  // ── ListBoxItem ───────────────────────────────────────────────
  // Composition 패턴: CSS .react-aria-ListBoxItem { padding: 4px 12px } 동기화
  if (containerTag === "listboxitem") {
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      display: "flex",
      flexDirection: "column",
      gap: parentStyle.gap ?? 2,
      paddingTop: parentStyle.paddingTop ?? 4,
      paddingBottom: parentStyle.paddingBottom ?? 4,
      paddingLeft: parentStyle.paddingLeft ?? 12,
      paddingRight: parentStyle.paddingRight ?? 12,
    });
    filteredChildren = injectCollectionItemFontStyles(filteredChildren);
  }

  // ── ToggleButtonGroup ─────────────────────────────────────────────
  // ADR-087 SP1: display/alignItems 는 ToggleButtonGroup.spec containerStyles 로 리프팅됨.
  //   flexDirection 은 orientation prop runtime 결정 → 잔존.
  if (containerTag === "togglebuttongroup") {
    const orientation = containerProps?.orientation as string | undefined;
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      flexDirection:
        parentStyle.flexDirection ??
        (orientation === "vertical" ? "column" : "row"),
    });
  }

  // ── Toolbar ──────────────────────────────────────────────────────────
  // ADR-087 SP1: display/alignItems/width:fit-content 는 Toolbar.spec containerStyles
  //   로 리프팅됨. flexDirection (orientation) + gap (size-based) + child flexShrink/
  //   whiteSpace 은 runtime 결정 → 잔존.
  if (containerTag === "toolbar") {
    const orientation = containerProps?.orientation as string | undefined;
    const sizeName = (containerProps?.size as string) ?? "md";
    const gap = sizeName === "sm" ? 4 : sizeName === "lg" ? 10 : 8;
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      flexDirection:
        parentStyle.flexDirection ??
        (orientation === "vertical" ? "column" : "row"),
      gap: parentStyle.gap ?? gap,
    });
    // 자식 Button/ToggleButton: 축소 방지 + 텍스트 줄바꿈 방지
    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            flexShrink: cs.flexShrink ?? 0,
            whiteSpace: cs.whiteSpace ?? "nowrap",
          },
        },
      } as Element;
    });
  }

  // ── CheckboxGroup / RadioGroup ─────────────────────────────────────
  // CSS 구조: RadioGroup(column) > Label + RadioItems(row/column) > Radios
  // RadioItems가 있으면 column 통과, 없으면(레거시) column 보정
  if (containerTag === "checkboxgroup" || containerTag === "radiogroup") {
    const hasLabel = !!containerProps?.label;
    const groupVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(groupVariant.styles);
    // Label 필터링 + whiteSpace nowrap 주입
    filteredChildren = children
      .filter((child) => (child.type === "Label" ? hasLabel : true))
      .map((child) => {
        if (child.type === "Label") {
          const cs = (child.props?.style || {}) as Record<string, unknown>;
          return {
            ...child,
            props: {
              ...child.props,
              style: {
                ...cs,
                whiteSpace: cs.whiteSpace ?? "nowrap",
              },
            },
          } as Element;
        }
        return child;
      });

    effectiveParent = withParentStyle(containerEl, {
      ...specFallback,
      gap: specFallback.gap ?? 4,
      ...(sideMode
        ? {
            flexDirection: groupVariant.styles["flex-direction"] ?? "row",
            alignItems: groupVariant.styles["align-items"] ?? "flex-start",
          }
        : {
            display: specFallback.display ?? "flex",
            flexDirection: specFallback.flexDirection ?? "column",
          }),
      ...rawParentStyle,
    });
  }

  // ── RadioItems / CheckboxItems ────────────────────────────────────
  // RadioGroup 내부 RadioItems: 부모 orientation에 따라 row/column 전환
  // ADR-093 Phase 3: display:"flex" + flexDirection:"column" base primitive 는
  //   Radio/CheckboxItemsSpec.containerStyles 로 리프팅됨 (ADR-094 expandChildSpecs
  //   경유 자동 주입). orientation="horizontal" 시에만 row+alignItems:center override.
  //   gap 은 size-indexed (sm:8/md:12/lg:16) runtime fork 유지 — Taffy 가 sizes 를 직접
  //   모르므로 분기 주입 필요.
  if (containerTag === "radioitems" || containerTag === "checkboxitems") {
    const parentEl = containerEl.parent_id
      ? elementById.get(containerEl.parent_id)
      : undefined;
    const parentProps = parentEl?.props as Record<string, unknown> | undefined;
    const orientation = parentProps?.orientation as string | undefined;
    const sizeName = (parentProps?.size as string) ?? "md";
    const gap = sizeName === "sm" ? 8 : sizeName === "lg" ? 16 : 12;

    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      // orientation="horizontal" 시 spec default(column) 를 row+center 로 override.
      ...(orientation === "horizontal"
        ? { flexDirection: "row" as const, alignItems: "center" as const }
        : {}),
      gap,
    });
  }

  // ── Breadcrumbs ────────────────────────────────────────────────────
  // ADR-086 P5: Breadcrumb child 의 style 주입 (width/minWidth/height/minHeight/
  //   display/flexDirection/alignItems/flexShrink/flexGrow) 제거.
  //   - display/alignItems: Breadcrumb.spec containerStyles 가 inline-flex/center 담당
  //   - width/height: enrichWithIntrinsicSize → calculateContentWidth/Height 의 "breadcrumb"
  //     분기에서 label 실측 기반 intrinsic 산출 (utils.ts)
  //   본 분기는 parent `height/minHeight/gap:0` 적용만 담당한다.
  if (containerTag === "breadcrumbs") {
    const rspSize = normalizeBreadcrumbRspSizeKey(
      String(containerProps?.size ?? "M"),
    );
    const breadcrumbsHeight = BreadcrumbsSpec.sizes[rspSize]?.height ?? 24;

    filteredChildren = children;

    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      height: breadcrumbsHeight,
      minHeight: breadcrumbsHeight,
      gap: 0,
    });
  }

  // ── Tabs ───────────────────────────────────────────────────────────
  if (containerTag === "tabs") {
    const sizeName = (containerProps?.size as string) ?? "md";
    const tabBarHeight = specSizeField("tabs", sizeName, "height") ?? 30;
    const density = (containerProps?.density as string) ?? "compact";
    const tabPanelPadding = resolveTabPanelPadding(
      sizeName,
      !!containerProps?.size,
      density,
    );

    const tabListEl = children.find((c) => c.type === "TabList");
    const tabPanelsEl = children.find((c) => c.type === "TabPanels");
    // 직속 TabPanel (TabPanels 없는 flat 구조)
    const directPanel = children.find((c) => c.type === "TabPanel");

    if (tabListEl) {
      // 새 구조 (TabList 존재): TabList에 고정 height 주입 → Taffy 레이아웃 포함
      // → spatialIndex에 bounds 등록 → 캔버스에서 TabList/Tab 선택 가능
      // ADR-087 SP2: display/flexDirection 은 TabList.spec containerStyles 로 리프팅됨.
      //   height/width 는 size-based tabBarHeight 주입 (runtime 잔존).
      const injectedTabList: Element = {
        ...tabListEl,
        props: {
          ...tabListEl.props,
          style: {
            ...((tabListEl.props?.style as Record<string, unknown>) ?? {}),
            height: tabBarHeight,
            minHeight: tabBarHeight,
            width: "100%",
          },
        },
      };
      // CSS: .react-aria-TabPanel { padding: var(--spacing-md) }
      // TabPanels 또는 직속 Panel에 size별 padding 주입
      const panelContainer = tabPanelsEl ?? directPanel;
      const injectedPanelContainer: Element | undefined = panelContainer
        ? {
            ...panelContainer,
            props: {
              ...panelContainer.props,
              style: {
                ...((panelContainer.props?.style as Record<string, unknown>) ??
                  {}),
                padding: tabPanelPadding,
              },
            },
          }
        : undefined;
      filteredChildren = [
        injectedTabList,
        ...(injectedPanelContainer ? [injectedPanelContainer] : []),
      ];
      // ADR-087 SP2: display/flexDirection 은 Tabs.spec containerStyles 로 리프팅됨.
      effectiveParent = withParentStyle(containerEl, parentStyle);
    } else {
      // 구식 flat 구조 (TabList 없음): 기존 동작 유지 + paddingTop runtime 추가
      filteredChildren = directPanel ? [directPanel] : [];
      effectiveParent = withParentStyle(containerEl, {
        ...parentStyle,
        paddingTop: tabBarHeight,
      });
    }
  }

  // ── TabPanels ────────────────────────────────────────────────────────
  // CSS: .react-aria-TabPanel { padding: var(--spacing-md) }
  // → TabPanels는 활성 Panel 하나만 렌더링, 나머지 숨김
  if (containerTag === "tabpanels") {
    const tabsParent = findAncestorByTag(containerEl, "Tabs", elementById, 3);
    const tabsProps = tabsParent?.props as Record<string, unknown> | undefined;
    const sizeName = (tabsProps?.size as string) ?? "md";
    const density = (tabsProps?.density as string) ?? "compact";
    const tabPanelPadding = resolveTabPanelPadding(
      sizeName,
      !!tabsProps?.size,
      density,
    );
    const selectedKey =
      (tabsProps?.selectedKey as string | undefined) ??
      (tabsProps?.defaultSelectedKey as string | undefined);

    // 활성 TabPanel: itemId가 selectedKey와 매칭 (ADR-066). 없으면 첫 번째.
    const panelItems = children.filter((c) => c.type === "TabPanel");
    const activePanel = selectedKey
      ? (panelItems.find(
          (p) => (p.props as Record<string, unknown>)?.itemId === selectedKey,
        ) ?? panelItems[0])
      : panelItems[0];

    filteredChildren = activePanel ? [activePanel] : [];
    // ADR-087 SP2: display/flexDirection 은 TabPanels.spec containerStyles (ADR-083 Phase 6)
    //   로 이미 리프팅됨. padding 과 flexGrow 는 runtime 결정 → 잔존.
    effectiveParent = withParentStyle(containerEl, {
      ...(containerEl.props?.style as Record<string, unknown> | undefined),
      padding: tabPanelPadding,
      flexGrow: 1,
    });
  }

  // ── TabList ─────────────────────────────────────────────────────────
  if (containerTag === "tablist") {
    // ADR-066: Tab element는 존재하지 않음. Tabs.props.items에서 가상 Tab 생성.
    const tabsParent = findAncestorByTag(containerEl, "Tabs", elementById, 3);
    const tabsProps = tabsParent?.props as Record<string, unknown> | undefined;
    const sizeName = (tabsProps?.size as string) ?? "md";
    const tabBarHeight = specSizeField("tabs", sizeName, "height") ?? 30;
    const items =
      (tabsProps?.items as Array<{ id: string; title: string }> | undefined) ??
      [];

    // items 기반 가상 Tab element 생성 (store row 아님, 렌더 전용 ephemeral)
    filteredChildren = items.map((item, i) => ({
      id: `${tabsParent?.id ?? containerEl.id}:virtualTab:${item.id}`,
      type: "Tab",
      props: {
        title: item.title,
        tabId: item.id,
        _virtual: true,
        style: {
          height: tabBarHeight,
          minHeight: tabBarHeight,
        },
      },
      parent_id: containerEl.id,
      order_num: i + 1,
      page_id: containerEl.page_id,
    })) as Element[];

    // ADR-087 SP2: display/flexDirection 은 TabList.spec containerStyles 로 리프팅됨.
    //   height/width 는 size-based tabBarHeight 주입 (runtime 잔존).
    effectiveParent = withParentStyle(containerEl, {
      ...(containerEl.props?.style as Record<string, unknown> | undefined),
      height: tabBarHeight,
      width: "100%",
    });
  }

  // ── ComboBox / Select / SearchField ───────────────────────────────
  if (
    containerTag === "combobox" ||
    containerTag === "select" ||
    containerTag === "searchfield"
  ) {
    const fieldVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(fieldVariant.styles);
    const hasLabel = !!containerProps?.label;
    const WRAPPER_TAGS = new Set([
      "SelectTrigger",
      "ComboBoxWrapper",
      "SearchFieldWrapper",
    ]);
    filteredChildren = children.filter(
      (c) =>
        (c.type === "Label" ? hasLabel : false) || WRAPPER_TAGS.has(c.type),
    );

    // Wrapper에 padding + gap 주입
    const wrapperChildTag =
      containerTag === "select"
        ? "SelectTrigger"
        : containerTag === "searchfield"
          ? "SearchFieldWrapper"
          : "ComboBoxWrapper";
    filteredChildren = filteredChildren.map((child) => {
      if (child.type === wrapperChildTag) {
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        const sizeName = getDelegatedSize(containerEl, elementById);
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              display: cs.display ?? "flex",
              flexDirection: cs.flexDirection ?? "row",
              width: sideMode ? cs.width : (cs.width ?? "100%"),
              gap: cs.gap ?? 4, // CSS: gap: var(--spacing-xs) = 4px
              ...withSpecPadding(cs, sizeName),
            },
          },
        } as Element;
      }
      return child;
    });

    if (sideMode) {
      filteredChildren = injectSideLabelLabelAndWrapperStyles(
        filteredChildren,
        new Set([wrapperChildTag]),
      );
    }
    effectiveParent = withParentStyle(
      containerEl,
      sideMode
        ? getSideLabelParentStyle(specFallback, rawParentStyle)
        : {
            ...specFallback,
            display: specFallback.display ?? "flex",
            flexDirection: specFallback.flexDirection ?? "column",
            gap: specFallback.gap ?? 4, // CSS: gap: var(--spacing-xs) = 4px
            ...rawParentStyle,
          },
    );
  }

  // ── NumberField ──────────────────────────────────────────────────────
  // ComboBox와 동일한 자식 태그(ComboBoxWrapper/Input/Trigger) 재사용
  // → 기존 ComboBox implicitStyles 처리가 자동 적용됨
  if (containerTag === "numberfield") {
    const fieldVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(fieldVariant.styles);
    const hasLabel = !!containerProps?.label;
    const WRAPPER_TAGS = new Set(["ComboBoxWrapper"]);
    filteredChildren = children.filter(
      (c) =>
        (c.type === "Label" ? hasLabel : false) ||
        WRAPPER_TAGS.has(c.type) ||
        c.type === "FieldError",
    );

    // Wrapper에 padding + gap 주입 (ComboBox 분기와 동일)
    filteredChildren = filteredChildren.map((child) => {
      if (child.type === "ComboBoxWrapper") {
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        const sizeName = getDelegatedSize(containerEl, elementById);
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              display: cs.display ?? "flex",
              flexDirection: cs.flexDirection ?? "row",
              width: sideMode ? cs.width : (cs.width ?? "100%"),
              gap: cs.gap ?? 4,
              ...withSpecPadding(cs, sizeName),
            },
          },
        } as Element;
      }
      return child;
    });

    if (sideMode) {
      filteredChildren = injectSideLabelLabelAndContentStyles(
        filteredChildren,
        new Set(["ComboBoxWrapper"]),
      );
    }
    effectiveParent = withParentStyle(
      containerEl,
      sideMode
        ? getSideLabelParentStyle(specFallback, rawParentStyle)
        : {
            ...specFallback,
            display: specFallback.display ?? "flex",
            flexDirection: specFallback.flexDirection ?? "column",
            gap: specFallback.gap ?? 4,
            ...rawParentStyle,
          },
    );
  }

  // ── SelectTrigger ──────────────────────────────────────────────────
  // ADR-084 Phase A3: display/flexDirection/alignItems 는 SelectTrigger.spec.ts
  //   containerStyles 에서 resolveContainerStylesFallback 경유로 parentStyle 에 선주입.
  //   본 분기는 size-indexed gap/borderWidth/height 만 처리.
  if (containerTag === "selecttrigger") {
    const sizeName = getDelegatedSize(containerEl, elementById);
    effectiveParent = withParentStyle(
      containerEl,
      withSpecPadding(
        {
          ...parentStyle,
          gap: parentStyle.gap ?? 4, // CSS: gap: var(--spacing-xs) = 4px
          // CSS .react-aria-Button: border: 1px solid
          borderWidth: parentStyle.borderWidth ?? 1,
          // Spec height로 CSS와 정확히 일치 (Taffy auto 계산 시 ceil로 1px 오차 방지)
          height:
            parentStyle.height ??
            specSizeField("selecttrigger", sizeName, "height") ??
            30,
        },
        sizeName,
      ),
    );

    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (child.type === "SelectValue") {
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              flex: cs.flex ?? 1,
              minWidth: cs.minWidth ?? 0,
              fontSize:
                cs.fontSize ??
                specSizeFontSize("selecttrigger", sizeName) ??
                14,
              whiteSpace: cs.whiteSpace ?? "nowrap",
              overflow: cs.overflow ?? "hidden",
              textOverflow: cs.textOverflow ?? "ellipsis",
            },
          },
        } as Element;
      }
      // ADR-102: SelectIcon — RAC 공식 미존재 composition 고유 D3 시각 element (chevron 아이콘).
      //   BC HIGH (factory 직렬화 type) → 정당화 유지. grandparent(Select) iconName 전파.
      if (child.type === "SelectIcon") {
        // Select → SelectTrigger → SelectIcon: 조부모(Select)의 iconName 전파
        const selectEl = elementById.get(containerEl.parent_id ?? "");
        const selectProps = selectEl?.props as
          | Record<string, unknown>
          | undefined;
        const iconName =
          (child.props as Record<string, unknown> | undefined)?.iconName ??
          selectProps?.iconName;
        const iconSz =
          specSizeField("selecttrigger", sizeName, "iconSize") ?? 18;
        return {
          ...child,
          props: {
            ...child.props,
            ...(iconName != null ? { iconName } : {}),
            style: {
              ...cs,
              width: iconSz,
              height: iconSz,
              flexShrink: cs.flexShrink ?? 0,
            },
          },
        } as Element;
      }
      return child;
    });
  }

  // ── ComboBoxWrapper ────────────────────────────────────────────────
  if (containerTag === "comboboxwrapper") {
    const sizeName = getDelegatedSize(containerEl, elementById);
    effectiveParent = withParentStyle(
      containerEl,
      withSpecPadding(
        {
          ...parentStyle,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: parentStyle.gap ?? 4, // CSS: gap: var(--spacing-xs) = 4px
          // CSS .combobox-container: border: 1px solid
          borderWidth: parentStyle.borderWidth ?? 1,
          // Spec height로 CSS와 정확히 일치
          height:
            parentStyle.height ??
            specSizeField("comboboxwrapper", sizeName, "height") ??
            30,
        },
        sizeName,
      ),
    );

    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (child.type === "ComboBoxInput") {
        const comboBoxEl = elementById.get(containerEl.parent_id ?? "");
        const comboBoxProps = comboBoxEl?.props as
          | Record<string, unknown>
          | undefined;
        const placeholder =
          comboBoxProps?.placeholder ?? child.props?.placeholder;
        return {
          ...child,
          props: {
            ...child.props,
            placeholder,
            style: {
              ...cs,
              flex: cs.flex ?? 1,
              minWidth: cs.minWidth ?? 0,
              fontSize:
                cs.fontSize ??
                specSizeFontSize("comboboxwrapper", sizeName) ??
                14,
              whiteSpace: cs.whiteSpace ?? "nowrap",
              overflow: cs.overflow ?? "hidden",
              textOverflow: cs.textOverflow ?? "ellipsis",
            },
          },
        } as Element;
      }
      if (child.type === "ComboBoxTrigger") {
        // ComboBox → ComboBoxWrapper → ComboBoxTrigger: 조부모(ComboBox)의 iconName 전파
        const comboBoxEl = elementById.get(containerEl.parent_id ?? "");
        const comboBoxProps = comboBoxEl?.props as
          | Record<string, unknown>
          | undefined;
        const iconName =
          (child.props as Record<string, unknown> | undefined)?.iconName ??
          comboBoxProps?.iconName;
        const iconSz =
          specSizeField("comboboxwrapper", sizeName, "iconSize") ?? 18;
        return {
          ...child,
          props: {
            ...child.props,
            ...(iconName != null ? { iconName } : {}),
            style: {
              ...cs,
              width: iconSz,
              height: iconSz,
              flexShrink: cs.flexShrink ?? 0,
            },
          },
        } as Element;
      }
      return child;
    });
  }

  // ── TextField / TextArea ──────────────────────────────────────────────
  // Label + Input + FieldError 구조. column 레이아웃 보장.
  //
  // ADR-108 P2/P5: `resolveContainerVariants` helper 소비로 labelPosition
  //   변이를 spec.containerVariants (`TextField.spec.ts:308`) 데이터로 결정한다.
  //   helper 가 variant 매칭에 성공 (styles 또는 nested 존재) 시 spec 이 선언한
  //   "side" 모드 — Canvas 는 현 시점 grid 미지원이므로 기존 flex 시뮬레이션
  //   (`getSideLabelParentStyle` + child style 보정) 으로 동일 시각
  //   결과를 산출한다. 자식 주입 여부는 `matchNestedSelector` 로 확증 — helper
  //   가 Label/FieldError/Description 등을 선언하지 않은 spec 변형에도 안전.
  //
  //   `labelPosition` prop 을 직접 읽지 않음 → SSOT 복원 (CSS/Canvas/Panel 모두
  //   동일 spec 데이터 소비). TextArea 는 P5 에서 같은 helper 경로를 공유한다.
  if (containerTag === "textfield" || containerTag === "textarea") {
    const hasLabel = !!containerProps?.label;
    filteredChildren = children.filter(
      (c) =>
        (c.type === "Label" ? hasLabel : false) ||
        c.type === "Input" ||
        c.type === "FieldError",
    );

    const tfSpec = LOWERCASE_TAG_SPEC_MAP.get(containerTag);
    const tfVariant = resolveContainerVariants(
      tfSpec,
      containerProps ?? undefined,
    );
    const tfSideMode =
      Object.keys(tfVariant.styles).length > 0 || tfVariant.nested.length > 0;

    if (tfSideMode) {
      // spec nested[] 에 매칭된 자식만 Canvas side-label flex 시뮬레이션 적용.
      //   TextField.spec.ts:320/329 는 Label + `:not(Label)` 양쪽을 덮어 Input/FieldError
      //   포함. 미매칭 자식 (예: spec 변형 후 새 태그) 은 원본 유지.
      filteredChildren = injectMatchedSideLabelContentStyles(
        filteredChildren,
        tfVariant.nested,
        new Set(["Input"]),
      );
      effectiveParent = withParentStyle(
        containerEl,
        getSideLabelParentStyle(specFallback, rawParentStyle),
      );
    } else {
      effectiveParent = withParentStyle(containerEl, {
        ...specFallback,
        display: specFallback.display ?? "flex",
        flexDirection: specFallback.flexDirection ?? "column",
        gap: specFallback.gap ?? 4,
        ...rawParentStyle,
      });
    }
  }

  // ── DateField / TimeField ────────────────────────────────────────────
  // Label + DateInput(입력 영역) + FieldError. DateInput에 부모 props 주입.
  if (containerTag === "datefield" || containerTag === "timefield") {
    const fieldVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(fieldVariant.styles);
    const hasLabel = !!containerProps?.label;
    const sizeName = (containerProps?.size as string) ?? "md";
    const inputHeight = specSizeField(containerTag, sizeName, "height") ?? 30;

    filteredChildren = children.filter(
      (c) =>
        (c.type === "Label" ? hasLabel : false) ||
        c.type === "DateInput" ||
        c.type === "FieldError",
    );

    // DateInput에 부모 props 주입 (Spec shapes에서 세그먼트 텍스트 생성용)
    filteredChildren = filteredChildren.map((child) => {
      if (child.type === "DateInput") {
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        return {
          ...child,
          props: {
            ...child.props,
            size: sizeName,
            _parentTag:
              containerTag === "datefield" ? "DateField" : "TimeField",
            _granularity: containerProps?.granularity,
            _hourCycle: containerProps?.hourCycle,
            _locale: containerProps?.locale,
            style: {
              ...cs,
              width: cs.width ?? "100%",
              height: inputHeight,
            },
          },
        } as Element;
      }
      return child;
    });

    if (sideMode) {
      filteredChildren = injectSideLabelLabelAndContentStyles(
        filteredChildren,
        new Set(["DateInput"]),
      );
    }
    effectiveParent = withParentStyle(
      containerEl,
      sideMode
        ? getSideLabelParentStyle(specFallback, rawParentStyle)
        : {
            ...specFallback,
            display: specFallback.display ?? "flex",
            flexDirection: specFallback.flexDirection ?? "column",
            gap: specFallback.gap ?? 4,
            ...rawParentStyle,
          },
    );
  }

  // ── SearchFieldWrapper ────────────────────────────────────────────────
  // ComboBoxWrapper와 동일 패턴: border + height + padding + 자식 스타일 주입.
  // ADR-087 SP3: display/flexDirection/alignItems 는 SelectTriggerSpec containerStyles
  //   로 이미 리프팅됨 (SearchFieldWrapper → SelectTriggerSpec TAG_SPEC_MAP). 본 분기는
  //   size-indexed gap/borderWidth/height + padding + child style 주입만 담당.
  if (containerTag === "searchfieldwrapper") {
    const sizeName = getDelegatedSize(containerEl, elementById);
    effectiveParent = withParentStyle(
      containerEl,
      withSpecPadding(
        {
          ...parentStyle,
          gap: parentStyle.gap ?? 4, // CSS: gap: var(--spacing-xs) = 4px
          borderWidth: parentStyle.borderWidth ?? 1,
          height:
            parentStyle.height ??
            specSizeField("searchfieldwrapper", sizeName, "height") ??
            30,
        },
        sizeName,
      ),
    );

    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (child.type === "SearchInput") {
        const searchEl = elementById.get(containerEl.parent_id ?? "");
        const searchProps = searchEl?.props as
          | Record<string, unknown>
          | undefined;
        const placeholder =
          searchProps?.placeholder ?? child.props?.placeholder;
        return {
          ...child,
          props: {
            ...child.props,
            placeholder,
            style: {
              ...cs,
              flex: cs.flex ?? 1,
              minWidth: cs.minWidth ?? 0,
              fontSize:
                cs.fontSize ??
                specSizeFontSize("searchfieldwrapper", sizeName) ??
                14,
              whiteSpace: cs.whiteSpace ?? "nowrap",
              overflow: cs.overflow ?? "hidden",
              textOverflow: cs.textOverflow ?? "ellipsis",
            },
          },
        } as Element;
      }
      if (child.type === "SearchIcon" || child.type === "SearchClearButton") {
        const iconSz =
          specSizeField("searchfieldwrapper", sizeName, "iconSize") ?? 18;
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              width: iconSz,
              height: iconSz,
              flexShrink: cs.flexShrink ?? 0,
            },
          },
        } as Element;
      }
      return child;
    });
  }

  // ── ProgressBar / Meter ───────────────────────────────────────────────
  // ADR-085 P4: Taffy grid 네이티브 지원 (G0 PASS) + ProgressBar/Meter.spec
  //   containerStyles (display:grid + gridTemplateAreas/Columns) resolveContainerStylesFallback
  //   경유 주입 → 기존 flex row wrap emulation 제거, 자식에 gridArea 만 주입.
  // grid-template-areas: '"label value" "bar bar"' (1fr auto / 2 rows)
  if (PROGRESSBAR_TAGS.has(containerTag)) {
    const hasLabel = !!containerProps?.label;
    const showValueLabel = containerProps?.showValueLabel !== false;
    const sizeName = (containerProps?.size as string) ?? "md";

    // layout 엔진이 Skia 렌더링과 동일한 텍스트로 fit-content width를 측정해야 함
    const autoFormattedValue = formatProgressValue(
      Number(containerProps?.value ?? 0),
      Number(containerProps?.minValue ?? 0),
      Number(containerProps?.maxValue ?? 100),
      containerProps?.formatOptions &&
        typeof containerProps.formatOptions === "object"
        ? (containerProps.formatOptions as Record<string, unknown>)
        : null,
    );
    const formattedValue =
      (containerProps?.valueLabel as string | undefined) ?? autoFormattedValue;

    // Label/Output 필터
    filteredChildren = children.filter((c) => {
      if (c.type === "Label") return hasLabel;
      if (c.type === "ProgressBarValue" || c.type === "MeterValue")
        return showValueLabel;
      return true;
    });

    // 자식에 gridArea 주입 — 부모 grid-template-areas 의 명명 영역 매핑.
    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (child.type === "Label") {
        const labelFontSize = specSizeFontSize(containerTag, sizeName) ?? 14;
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              gridArea: cs.gridArea ?? "label",
              fontSize: labelFontSize,
              minWidth: cs.minWidth ?? 0,
              whiteSpace: cs.whiteSpace ?? "nowrap",
            },
          },
        } as Element;
      }
      if (child.type === "ProgressBarTrack" || child.type === "MeterTrack") {
        const trackTag = child.type.toLowerCase();
        const barHeight = specSizeField(trackTag, sizeName, "height") ?? 8;
        return {
          ...child,
          props: {
            ...child.props,
            size: sizeName,
            style: {
              ...cs,
              gridArea: cs.gridArea ?? "bar",
              width: cs.width ?? "100%",
              height: barHeight,
            },
          },
        } as Element;
      }
      if (child.type === "ProgressBarValue" || child.type === "MeterValue") {
        const valueFontSize = specSizeFontSize(containerTag, sizeName) ?? 14;
        const valueLineHeight =
          specSizeLineHeight(containerTag, sizeName) ?? 20;
        return {
          ...child,
          props: {
            ...child.props,
            children: showValueLabel ? formattedValue : "",
            size: sizeName,
            style: {
              ...cs,
              gridArea: cs.gridArea ?? "value",
              fontSize: valueFontSize,
              lineHeight: `${valueLineHeight}px`,
              whiteSpace: cs.whiteSpace ?? "nowrap",
            },
          },
        } as Element;
      }
      return child;
    });

    // 부모 container style: display/gridTemplate* 은 resolveContainerStylesFallback 이
    //   spec.containerStyles 로부터 이미 parentStyle 에 선주입 → 여기서는 gap 만 처리.
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      rowGap: parentStyle.rowGap ?? PROGRESSBAR_ROW_GAP,
      columnGap: parentStyle.columnGap ?? PROGRESSBAR_COL_GAP,
    });
  }

  // ── Slider ──────────────────────────────────────────────────────────
  // ProgressBar와 동일 구조: Label(좌상) + SliderOutput(우상) → 1행, SliderTrack(전폭) → 2행
  // display: flex row wrap 패턴 (Label flex:1 + Output auto → Track width:100% 강제 줄바꿈)
  if (SLIDER_TAGS.has(containerTag)) {
    const hasLabel = !!containerProps?.label;
    const showValue = containerProps?.showValue !== false;
    const sizeName = (containerProps?.size as string) ?? "md";
    const sliderColGap = specSizeField("slider", sizeName, "columnGap") ?? 16;

    // value → 포맷된 텍스트 계산 (ElementSprite 미러링)
    const sliderValue = containerProps?.value;
    const sliderMin = Number(containerProps?.minValue ?? 0);
    let sliderFormattedValue = "";
    if (showValue) {
      if (Array.isArray(sliderValue)) {
        sliderFormattedValue = (sliderValue as number[])
          .map((v) => String(Math.round(Number(v))))
          .join(" – ");
      } else {
        sliderFormattedValue = String(
          Math.round(Number(sliderValue ?? sliderMin)),
        );
      }
    }

    // Label/Output 필터
    filteredChildren = children.filter((c) => {
      if (c.type === "Label") return hasLabel;
      if (c.type === "SliderOutput") return showValue;
      return true;
    });

    // Label: width:0 + flexGrow:1 = CSS grid 1fr 에뮬레이션
    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (child.type === "Label") {
        const labelFontSize = specSizeFontSize("slider", sizeName) ?? 14;
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              fontSize: labelFontSize,
              width: 0,
              flexGrow: cs.flexGrow ?? 1,
              flexShrink: cs.flexShrink ?? 1,
              minWidth: 0,
              whiteSpace: cs.whiteSpace ?? "nowrap",
            },
          },
        } as Element;
      }
      if (child.type === "SliderTrack") {
        // ADR-086 P2: layout height = thumbSize (thumb 수용용, visual trackHeight 와 다름).
        //   SliderSpec.sizes[size].indicator.thumbSize 가 SSOT (14/18/22/26).
        const trackHeight =
          specSizeField("slider", sizeName, "indicator")?.thumbSize ?? 18;
        return {
          ...child,
          props: {
            ...child.props,
            size: sizeName,
            value: containerProps?.value,
            minValue: containerProps?.minValue,
            maxValue: containerProps?.maxValue,
            variant: containerProps?.variant,
            style: {
              ...cs,
              width: cs.width ?? "100%",
              height: trackHeight,
            },
          },
        } as Element;
      }
      if (child.type === "SliderOutput") {
        const valueFontSize = specSizeFontSize("slider", sizeName) ?? 14;
        const valueLineHeight = specSizeLineHeight("slider", sizeName) ?? 20;
        return {
          ...child,
          props: {
            ...child.props,
            children: sliderFormattedValue,
            size: sizeName,
            style: {
              ...cs,
              fontSize: valueFontSize,
              lineHeight: `${valueLineHeight}px`,
              flexShrink: cs.flexShrink ?? 0,
              whiteSpace: cs.whiteSpace ?? "nowrap",
            },
          },
        } as Element;
      }
      return child;
    });

    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      display: parentStyle.display ?? "flex",
      flexDirection: parentStyle.flexDirection ?? "row",
      flexWrap: parentStyle.flexWrap ?? "wrap",
      justifyContent: parentStyle.justifyContent ?? "space-between",
      rowGap: parentStyle.rowGap ?? SLIDER_ROW_GAP,
      columnGap: parentStyle.columnGap ?? sliderColGap,
    });
  }

  // ── SliderTrack (Thumb 배치) ─────────────────────────────────────────
  // 시각적 thumb은 SliderTrack spec shapes가 렌더링.
  // SliderThumb element는 selection bounds + 이벤트 히트 영역용으로 올바른 크기/위치 주입.
  // ADR-089: position:relative 는 SliderTrack.spec.containerStyles 로 리프팅됨.
  //   resolveContainerStylesFallback 이 parentStyle 에 선주입하므로 여기서는 thumb 배치만 처리.
  if (containerTag === "slidertrack") {
    const sliderId = containerEl.parent_id;
    const sliderEl = sliderId ? elementById.get(sliderId) : null;
    const sliderProps = sliderEl?.props as Record<string, unknown> | undefined;
    const rawValue = sliderProps?.value ?? 50;
    const values = Array.isArray(rawValue)
      ? (rawValue as number[])
      : [Number(rawValue) || 50];
    const min = Number(sliderProps?.minValue ?? 0);
    const max = Number(sliderProps?.maxValue ?? 100);
    const range = max - min || 1;
    const sizeName = (sliderProps?.size as string) ?? "md";
    const dims = { sm: 14, md: 18, lg: 22 };
    const thumbSize = dims[sizeName as keyof typeof dims] ?? 18;

    let thumbIdx = 0;
    filteredChildren = filteredChildren.map((child) => {
      if (child.type !== "SliderThumb") return child;
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      const val = values[thumbIdx] ?? values[0] ?? 50;
      thumbIdx++;
      const percent = Math.max(0, Math.min(100, ((val - min) / range) * 100));
      // absolute + left(percent) + marginLeft(-half) — selection bounds 용
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            position: "absolute",
            left: `${percent}%`,
            top: 0,
            width: thumbSize,
            height: thumbSize,
            marginLeft: -(thumbSize / 2),
          },
        },
      } as Element;
    });
  }

  // ── DatePicker / DateRangePicker ─────────────────────────────────────
  // containerVariants("label-position") 로 side 모드 여부를 결정하고, Canvas side-label
  //   시맨틱(Label 고정폭 + Group flex + FieldError 오프셋)은 helper 로 유지한다.
  //   POPOVER_CHILDREN_TAGS 필터링은 popover-hosted Calendar/RangeCalendar 레이아웃
  //   제외용 특수 동작으로 잔존.
  if (containerTag === "datepicker" || containerTag === "daterangepicker") {
    const fieldVariant = resolveActiveContainerVariants(
      containerTag,
      containerProps,
    );
    const sideMode = hasResolvedSideLabelVariant(fieldVariant.styles);
    const hasLabel = !!containerProps?.label;
    filteredChildren = children.filter((c) => {
      if (c.type === "Label") return hasLabel;
      return !POPOVER_CHILDREN_TAGS.has(c.type);
    });

    if (sideMode) {
      filteredChildren = injectSideLabelLabelAndContentStyles(
        filteredChildren,
        new Set(["Group"]),
      );
    }
    effectiveParent = withParentStyle(
      containerEl,
      sideMode
        ? getSideLabelParentStyle(specFallback, rawParentStyle)
        : {
            ...specFallback,
            display: specFallback.display ?? "flex",
            flexDirection: specFallback.flexDirection ?? "column",
            gap: specFallback.gap ?? 4,
            ...rawParentStyle,
          },
    );
  }

  // ── Calendar — size-based padding/gap 주입 (Generated CSS 동기) ─────
  // ADR-084 Phase A1: width/display/flexDirection 은 Calendar.spec.ts containerStyles
  //   에서 resolveContainerStylesFallback 경유로 parentStyle 에 선주입됨.
  //   여기서는 size-indexed padding/gap 만 처리 (spec.sizes 모델 확장 후속 ADR 까지 유지).
  if (containerTag === "calendar" || containerTag === "rangecalendar") {
    const calSize = (containerEl.props?.size as string) || "md";
    // ADR-086 P2: calPadGap Record → CalendarSpec.sizes[size] 직접 소비.
    //   rangecalendar 은 Calendar spec 재사용 (TAG_SPEC_MAP: RangeCalendar: CalendarSpec).
    const pad = specSizeField("calendar", calSize, "paddingX") ?? 8;
    const calGap = specSizeField("calendar", calSize, "gap") ?? 6;
    const ps = parentStyle;
    effectiveParent = {
      ...effectiveParent,
      props: {
        ...effectiveParent.props,
        style: {
          ...(effectiveParent.props?.style as Record<string, unknown>),
          paddingTop: ps.paddingTop ?? pad,
          paddingRight: ps.paddingRight ?? pad,
          paddingBottom: ps.paddingBottom ?? pad,
          paddingLeft: ps.paddingLeft ?? pad,
          gap: ps.gap ?? calGap,
        },
      },
    } as Element;

    // CalendarHeader/CalendarGrid 자식에 width: 100% + whiteSpace: nowrap 주입
    // whiteSpace: nowrap → ElementSprite 다중 줄 보정 로직 우회 (폰트 메트릭 기반 Y 이탈 방지)
    filteredChildren = filteredChildren.map((child) => {
      if (child.type === "CalendarHeader" || child.type === "CalendarGrid") {
        const cs = (child.props?.style || {}) as Record<string, unknown>;
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              width: cs.width || "100%",
              whiteSpace: "nowrap",
            },
          },
        } as Element;
      }
      return child;
    });
  }

  // ── Card / CardHeader / CardContent 분기 해체 (ADR-092 Phase 5 + ADR-095) ──────
  // Card 분기(CardHeader/CardContent width:"100%"): ADR-092 에서 containerStyles 이관 완료.
  // CardHeader → Heading flex:1 / CardContent → Description width:100% 자식 style 주입:
  //   ADR-095 에서 propagation rule (styleValue + skipIfSet) 로 이관 완료. 구현은
  //   CardHeaderSpec.propagation + CardContentSpec.propagation + propagationRegistry 등록.

  // ── Checkbox / Radio / Switch — indicator 공간 확보 ────────────────
  // Indicator는 spec shapes로 렌더링 (Taffy 트리 밖).
  // Label 자식에 marginLeft = indicatorWidth + gap을 주입하여 indicator와 겹치지 않도록 한다.
  // gap은 사용자가 스타일 패널에서 변경 가능 → parentStyle.gap 우선 사용.
  if (
    containerTag === "checkbox" ||
    containerTag === "radio" ||
    containerTag === "switch"
  ) {
    const sizeName = (containerProps?.size as string) ?? "md";
    const s = sizeName as "sm" | "md" | "lg";
    const phantomConfig = PHANTOM_INDICATOR_CONFIGS[containerTag];
    const indicatorWidth =
      phantomConfig?.widths[s] ?? INDICATOR_SIZES[sizeName]?.box ?? 20;
    const defaultGap =
      phantomConfig?.gaps[s] ?? INDICATOR_SIZES[sizeName]?.gap ?? 8;
    const parsedGap = parseFloat(String(parentStyle.gap ?? ""));
    const userGap = !isNaN(parsedGap) ? parsedGap : defaultGap;
    const indicatorOffset = indicatorWidth + userGap;

    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      return {
        ...child,
        props: {
          ...child.props,
          style: {
            ...cs,
            marginLeft:
              (cs.marginLeft as number | undefined) ?? indicatorOffset,
            whiteSpace: cs.whiteSpace ?? "nowrap",
          },
        },
      } as Element;
    });
  }

  // ── Synthetic Label (Radio/Checkbox/Switch/Toggle) ──────────────────
  if (SYNTHETIC_LABEL_TAGS.has(containerTag)) {
    if (filteredChildren.length === 0) {
      const labelText = containerProps?.children ?? containerProps?.label;
      if (typeof labelText === "string" && labelText.trim().length > 0) {
        // Checkbox/Radio/Switch: indicator 공간만큼 marginLeft 주입 (gap은 사용자 값 우선)
        const isIndicatorTag =
          containerTag === "checkbox" ||
          containerTag === "radio" ||
          containerTag === "switch";
        let synLabelMargin = 0;
        if (isIndicatorTag) {
          const sn = ((containerProps?.size as string) ?? "md") as
            | "sm"
            | "md"
            | "lg";
          const pc = PHANTOM_INDICATOR_CONFIGS[containerTag];
          const indWidth = pc?.widths[sn] ?? INDICATOR_SIZES[sn]?.box ?? 20;
          const indGap = pc?.gaps[sn] ?? INDICATOR_SIZES[sn]?.gap ?? 8;
          const pg = parseFloat(String(parentStyle.gap ?? ""));
          const gap = !isNaN(pg) ? pg : indGap;
          synLabelMargin = indWidth + gap;
        }

        const syntheticLabel: Element = {
          id: `${containerEl.id}__synlabel`,
          type: "Label",
          props: {
            children: labelText,
            style: {
              fontSize: 14,
              backgroundColor: "transparent",
              whiteSpace: "nowrap",
              ...(synLabelMargin > 0 ? { marginLeft: synLabelMargin } : {}),
            },
          },
          parent_id: containerEl.id,
          page_id: containerEl.page_id,
          order_num: 1,
        } as Element;
        filteredChildren = [syntheticLabel];
      }
    }
  }

  // ── InlineAlert: spec size → padding/gap/자식 font 주입 (Taffy는 CSS 못 읽음) ──
  if (containerTag === "inlinealert") {
    const sizeName = (containerProps?.size as string) ?? "md";
    const specSize = (InlineAlertSpec.sizes[sizeName] ??
      InlineAlertSpec.sizes[InlineAlertSpec.defaultSize]) as unknown as Record<
      string,
      unknown
    >;
    const s = {
      px: (specSize.paddingX as number) ?? 16,
      py: (specSize.paddingY as number) ?? 16,
      gap: (specSize.gap as number) ?? 12,
      headingFontSize: (specSize.headingFontSize as number) ?? 16,
      headingFontWeight: (specSize.headingFontWeight as number) ?? 700,
      descFontSize: (specSize.descFontSize as number) ?? 14,
      descFontWeight: (specSize.descFontWeight as number) ?? 400,
    };
    // ADR-087 SP5: display/flexDirection/width 는 InlineAlert.spec containerStyles
    //   (ADR-083 Phase 1) 로 이미 리프팅됨. padding/gap 은 size-indexed runtime 잔존.
    effectiveParent = withParentStyle(containerEl, {
      ...parentStyle,
      paddingTop: parentStyle.paddingTop ?? s.py,
      paddingBottom: parentStyle.paddingBottom ?? s.py,
      paddingLeft: parentStyle.paddingLeft ?? s.px,
      paddingRight: parentStyle.paddingRight ?? s.px,
      gap: parentStyle.gap ?? s.gap,
    });

    // 자식 Heading/Description에 spec 기반 font 스타일 주입
    filteredChildren = filteredChildren.map((child) => {
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (child.type === "Heading") {
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              fontSize: cs.fontSize ?? s.headingFontSize,
              fontWeight: cs.fontWeight ?? s.headingFontWeight,
            },
          },
        } as Element;
      }
      if (child.type === "Description") {
        return {
          ...child,
          props: {
            ...child.props,
            style: {
              ...cs,
              width: cs.width ?? "100%",
              fontSize: cs.fontSize ?? s.descFontSize,
              fontWeight: cs.fontWeight ?? s.descFontWeight,
            },
          },
        } as Element;
      }
      return child;
    });
  }

  // ── Separator: size → margin 주입 (Taffy는 CSS data-size 못 읽음) ──
  if (filteredChildren.some((c) => c.type === "Separator" || c.type === "Hr")) {
    filteredChildren = filteredChildren.map((child) => {
      if (child.type !== "Separator" && child.type !== "Hr") return child;
      const childProps = child.props as Record<string, unknown> | undefined;
      const childStyle = (childProps?.style || {}) as Record<string, unknown>;
      // 이미 인라인 margin이 있으면 스킵
      if (childStyle.marginTop != null || childStyle.marginBottom != null)
        return child;
      const sep_size = (childProps?.size as string) ?? "md";
      const sep_margin = sep_size === "sm" ? 4 : sep_size === "lg" ? 16 : 8;
      return {
        ...child,
        props: {
          ...childProps,
          style: {
            ...childStyle,
            marginTop: sep_margin,
            marginBottom: sep_margin,
          },
        },
      } as Element;
    });
  }

  // ── Label necessity indicator 공통 주입 ────────────────────────────
  // 부모 field의 necessityIndicator/isRequired → Label children 텍스트에 직접 반영
  // (레이아웃 측정 + Spec shapes 양쪽에서 동일한 텍스트를 사용하기 위함)
  const parentNecessity = containerProps?.necessityIndicator as
    | string
    | undefined;
  const parentRequired = containerProps?.isRequired as boolean | undefined;

  if (parentNecessity && NECESSITY_INDICATOR_TAGS.has(containerTag)) {
    filteredChildren = filteredChildren.map((child) => {
      if (child.type === "Label") {
        const originalText =
          (child.props?.children as string) ||
          (child.props?.label as string) ||
          "";
        const indicatorText = getNecessityIndicatorSuffix(
          parentNecessity,
          parentRequired ?? false,
        );
        if (indicatorText) {
          return {
            ...child,
            props: {
              ...child.props,
              children: originalText + indicatorText,
            },
          } as Element;
        }
      }
      return child;
    });
  }

  // ── Label flexShrink 공통 주입 ────────────────────────────────────
  // flex row 전환 시 Label이 축소되지 않도록 flexShrink: 0 보장
  if (filteredChildren.some((c) => c.type === "Label")) {
    filteredChildren = filteredChildren.map((child) => {
      if (child.type !== "Label") return child;
      const cs = (child.props?.style || {}) as Record<string, unknown>;
      if (cs.flexShrink == null) {
        return {
          ...child,
          props: {
            ...child.props,
            style: { ...cs, flexShrink: 0 },
          },
        } as Element;
      }
      return child;
    });
  }

  return {
    effectiveParent,
    filteredChildren,
  };
}
