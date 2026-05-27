/**
 * ListBox Component Spec
 *
 * React Aria 기반 리스트박스 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import type {
  StoredListBoxItem,
  StoredListBoxEntry,
} from "../types/listbox-items";
import { isListBoxSectionEntry } from "../types/listbox-items";
// ADR-908 Phase 3-A-2: Fill token dual-read seam
import { resolveFillTokens } from "../utils/fillTokens";
import { parsePxValue } from "../primitives";
import { resolveContainerSpacing } from "../primitives/containerSpacing";
import { fontFamily } from "../primitives/typography";
import { resolveStateColors } from "../utils/stateEffect";
import { resolveSpecFontSize } from "../renderers/utils/resolveSpecFontSize";
// ADR-078 Phase 2: 자식 Spec inline emit — `.react-aria-ListBoxItem` 블록이 본 Spec
// 의 `generated/ListBox.css` 같은 @layer 에 삽입된다.
// ADR-078 Phase 3: `resolveListBoxItemMetric` 로 Skia/layout 양쪽 item metric 단일 소스화.
import { ListBoxItemSpec, resolveListBoxItemMetric } from "./ListBoxItem.spec";
// ADR-099 Phase 3 (098-c 슬롯): HeaderSpec 도 childSpecs 경로로 inline emit —
// `.react-aria-ListBox .react-aria-Header` 블록이 generated/ListBox.css 에 추가된다.
import { HeaderSpec } from "./Header.spec";
import {
  List,
  SquareX,
  PointerOff,
  Zap,
  Ruler,
  Rows,
  MousePointer2,
} from "lucide-react";
import { FILTERING_SECTION } from "../utils/sharedSections";

/**
 * ListBox Props
 */
export interface ListBoxProps {
  variant?: "default" | "accent";
  isDisabled?: boolean;
  selectionMode?: "none" | "single" | "multiple";
  selectionBehavior?: "toggle" | "replace";
  disallowEmptySelection?: boolean;
  autoFocus?: boolean;
  name?: string;
  enableVirtualization?: boolean;
  height?: number;
  overscan?: number;
  filterText?: string;
  filterFields?: string[];
  /**
   * 아이템 목록 (ADR-076 P2: StoredListBoxItem[] SSOT)
   * ADR-099 Phase 2 (098-c 슬롯): Section 엔트리 지원 — `StoredListBoxEntry[]`
   * (기존 items 는 discriminator 미보유 → default "item" 해석, BC 0%).
   */
  items?: StoredListBoxEntry[];
  /** 선택된 아이템 key — canonical (ADR-076) */
  selectedKey?: string;
  /** 선택된 아이템 key 목록 — canonical (ADR-076) */
  selectedKeys?: string[];
  /** @deprecated selectedKey 사용 (Phase 5 migration 에서 자동 변환) */
  selectedIndex?: number;
  /** @deprecated selectedKeys 사용 (Phase 5 migration 에서 자동 변환) */
  selectedIndices?: number[];
  /** ElementSprite 주입: 엔진 계산 최종 폭 */
  _containerWidth?: number;
  /** ElementSprite 주입: 자식 Element 존재 시 spec shapes 아이템 렌더링 스킵 */
  _hasChildren?: boolean;
  /**
   * ADR-145 Phase B: ListBoxItem template element 의 style 주입 (buildSpecNodeData 가 SYNTHETIC
   * merge 시점에 전달). `render.shapes` 가 row 시각 (fontSize / paddingX / itemHeight / color)
   * 의 우선 source 로 소비 — ListBox container `props.style` 보다 우선. template style 미정의
   * 키는 ListBox container style → spec size default 순으로 fallback.
   */
  _listBoxItemTemplateStyle?: Record<string, unknown>;
  /**
   * ADR-145 Phase B: Skia 측 viewport intersection — visible row y-range (px) 만 paint.
   * undefined 시 모든 row paint (legacy). figma WebGPU tile-based + Retool react-window 와
   * 동등한 industry-standard culling pattern.
   */
  _viewport?: { top: number; bottom: number };
  style?: Record<string, string | number | undefined>;
}

/**
 * ListBox Component Spec
 */
export const ListBoxSpec: ComponentSpec<ListBoxProps> = {
  name: "ListBox",
  description: "React Aria 기반 리스트박스 컴포넌트",
  archetype: "collection",
  element: "div",

  // ADR-076: 컨테이너 base 시각 SSOT (ADR-071 Menu 선례 재사용)
  // `variants` 는 Skia 렌더(render.shapes) 전용, CSS 경로는 이 블록만 사용
  // 수동 유지 CSS: ListBoxItem base(60-124) + orientation/layout(127-227) +
  // Popover context(246-293) + variant 5종(296-355) + DnD/virtualized/forced-colors(230-400)
  containerStyles: {
    background: "{color.raised}" as TokenRef,
    text: "{color.neutral}" as TokenRef,
    border: "{color.border}" as TokenRef,
    borderWidth: 1,
    borderRadius: "{radius.lg}" as TokenRef,
    padding: "{spacing.xs}" as TokenRef,
    gap: "{spacing.2xs}" as TokenRef,
    // ADR-078 Phase 5: layout primitive Spec SSOT — CSS / Canvas / Style Panel 3경로 동일 소스.
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxHeight: "300px",
    overflow: "auto",
    outline: "none",
  },

  // ADR-078 Phase 2: ListBoxItem.spec base/sizes/states 블록을 본 Spec 의 `generated/ListBox.css`
  // 내부에 inline emit. 수동 ListBox.css 의 orientation/layout/Popover cascade 가 같은 @layer
  // 에서 `.react-aria-ListBoxItem` selector 를 override 할 수 있도록 보장.
  // ADR-099 Phase 3 (098-c 슬롯): HeaderSpec 추가 — `.react-aria-ListBox .react-aria-Header`
  // 블록이 동일 generated/ListBox.css 에 inline emit. Preview DOM 의 RAC `<Header>` 가
  // section 엔트리 렌더 시 sticky 위치 + muted 스타일 적용.
  childSpecs: [ListBoxItemSpec, HeaderSpec],

  defaultVariant: "default",
  defaultSize: "md",

  properties: {
    sections: [
      {
        title: "State",
        fields: [
          {
            key: "selectionMode",
            type: "enum",
            label: "Selection Mode",
            icon: List,
            options: [
              { value: "none", label: "None" },
              { value: "single", label: "Single" },
              { value: "multiple", label: "Multiple" },
            ],
            defaultValue: "single",
          },
          {
            key: "selectionBehavior",
            type: "enum",
            label: "Selection Behavior",
            icon: MousePointer2,
            options: [
              { value: "toggle", label: "Toggle" },
              { value: "replace", label: "Replace" },
            ],
            defaultValue: "toggle",
          },
          {
            key: "disallowEmptySelection",
            type: "boolean",
            label: "Disallow Empty Selection",
            icon: SquareX,
          },
          {
            key: "isDisabled",
            type: "boolean",
            label: "Disabled",
            icon: PointerOff,
          },
        ],
      },
      {
        title: "Performance",
        fields: [
          {
            key: "enableVirtualization",
            type: "boolean",
            label: "Enable Virtualization",
            icon: Zap,
            defaultValue: true,
          },
          {
            key: "height",
            type: "number",
            label: "Container Height (px)",
            icon: Ruler,
            visibleWhen: { key: "enableVirtualization", equals: true },
          },
          {
            key: "overscan",
            type: "number",
            label: "Overscan",
            icon: Rows,
            visibleWhen: { key: "enableVirtualization", equals: true },
            defaultValue: 5,
          },
        ],
      },
      {
        title: "Item Management",
        fields: [
          {
            key: "items",
            type: "items-manager",
            label: "Items",
            itemsKey: "items",
            itemTypeName: "ListBoxItem",
            defaultItem: {
              id: "", // runtime에서 crypto.randomUUID() 주입
              label: "New Item",
              value: "",
              isDisabled: false,
            },
            itemSchema: [
              { key: "label", type: "string", label: "Label" },
              { key: "value", type: "string", label: "Value" },
              { key: "textValue", type: "string", label: "Text Value" },
              { key: "description", type: "string", label: "Description" },
              { key: "isDisabled", type: "boolean", label: "Disabled" },
              { key: "href", type: "string", label: "URL" },
            ],
            labelKey: "label",
            allowNested: false,
            // ADR-099 Phase 4: Section 추가 UI 활성화
            allowSections: true,
          },
        ],
      },
      FILTERING_SECTION,
    ],
  },

  // containerStyles.background = {color.raised} (line 88) — ADR-076/079 완결로 Spec SSOT 선언됨.
  // Generator CSS 와 Skia render.shapes 가 동일한 컨테이너 배경(raised)을 사용해야
  // D3 symmetric consumer 대칭 유지 (이전 {color.base} 는 페이지 bg 와 혼동 위험)
  // ADR-105-c 자연 해소 확증.
  variants: {
    default: {
      fill: {
        default: {
          base: "{color.raised}" as TokenRef,
          hover: "{color.layer-2}" as TokenRef,
          pressed: "{color.layer-1}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
    accent: {
      fill: {
        default: {
          base: "{color.raised}" as TokenRef,
          hover: "{color.accent-subtle}" as TokenRef,
          pressed: "{color.accent-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.border}" as TokenRef,
    },
  },

  // containerStyles.padding = {spacing.xs} = 4 (line 93) — ADR-078 Phase 3 완결로 Spec SSOT 선언됨.
  // ADR-105-c 자연 해소 확증.
  // 프로젝트 관례 (Menu/MenuItem/Select): `sizes.*.paddingX/Y` = 해당 Spec 컴포넌트
  // 자체의 내부 padding. ListBox 는 container 역할이므로 container padding 만 표현.
  // ADR-078 Phase 3: item padding/lineHeight 는 `ListBoxItemSpec.sizes.md` SSOT +
  //   `resolveListBoxItemMetric(fontSize)` 공급 — Skia render.shapes 와 layout 공유.
  // gap 은 CSS `--spacing-2xs` = 2.
  sizes: {
    md: {
      height: 0,
      paddingX: 4,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.lg}" as TokenRef,
      gap: 2,
    },
  },

  states: {
    hover: {},
    pressed: {},
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  // ADR-076: propagation.rules 삭제 — 정적 모드 shapes 가 부모 variant 직접 참조,
  // 템플릿 모드는 Field 자식이 렌더하므로 childPath 전파 불필요

  render: {
    shapes: (props, size, state = "default") => {
      // ADR-076 이후 variants={default, accent} 로 재편. 이전에 DB 에 저장된
      //   element 의 variant 가 현재 variants 키와 맞지 않는 경우 (예: "primary")
      //   lookup 실패 → undefined → resolveStateColors(undefined, ...) crash.
      //   ADR-079 Hard Constraint 1 (migration 금지) 준수 위해 spec 레벨 fallback.
      const requestedVariant = (
        props as { variant?: keyof typeof ListBoxSpec.variants }
      ).variant;
      const variant =
        (requestedVariant
          ? ListBoxSpec.variants![requestedVariant]
          : undefined) ?? ListBoxSpec.variants![ListBoxSpec.defaultVariant!]!;
      // ADR-908 Phase 3-A-2: fill token dual-read seam
      const fill = resolveFillTokens(variant);
      const width =
        typeof props._containerWidth === "number" && props._containerWidth > 0
          ? props._containerWidth
          : (props.style?.width as number) || 200;

      // 사용자 스타일 우선, 없으면 spec 기본값
      const bgColor =
        props.style?.backgroundColor ??
        resolveStateColors(variant, state).background;

      const borderRadius = parsePxValue(
        props.style?.borderRadius,
        size.borderRadius,
      );

      // ADR-145 Phase B: row 시각 SSOT 분리 — ListBoxItem template element 의 style 우선,
      //   없으면 ListBox container style → spec size default 순으로 fallback.
      //   container 시각 (background / border / padding / gap) 은 ListBox `props.style` 유지.
      const templateStyle = (props as Record<string, unknown>)
        ._listBoxItemTemplateStyle as Record<string, unknown> | undefined;
      const pickRowStyle = (key: string): unknown =>
        templateStyle?.[key] ??
        (props.style as Record<string, unknown> | undefined)?.[key];

      const textColor = (pickRowStyle("color") ?? variant.text) as
        | string
        | TokenRef;
      const fontSize = resolveSpecFontSize(
        (pickRowStyle("fontSize") ?? size.fontSize) as
          | string
          | number
          | TokenRef
          | undefined,
        14,
      );
      const ff = (pickRowStyle("fontFamily") as string) || fontFamily.sans;
      const textAlign =
        (pickRowStyle("textAlign") as "left" | "center" | "right") || "left";

      const shapes: Shape[] = [];

      // 리스트 컨테이너 배경
      shapes.push({
        id: "bg",
        type: "roundRect" as const,
        x: 0,
        y: 0,
        width,
        height: "auto",
        radius: borderRadius as unknown as number,
        fill: bgColor,
      });

      // ADR-907 Layer D: style padding/gap/borderWidth/fontSize + item/header metric
      // 을 `resolveListBoxSpacingMetric` 단일 심볼로 소비 — utils.ts ListBox 분기와 공유.
      const metric = resolveListBoxSpacingMetric({
        style: props.style as Record<string, unknown> | undefined,
        defaultGap: (size.gap as unknown as number) ?? 2,
        defaultFontSize: fontSize,
        defaultPaddingX: (size.paddingX as unknown as number) ?? 4,
        defaultPaddingY: (size.paddingY as unknown as number) ?? 4,
      });
      const borderWidth = metric.borderWidth;

      // 테두리
      const borderColor = props.style?.borderColor ?? variant.border;
      if (borderColor) {
        shapes.push({
          type: "border" as const,
          target: "bg",
          borderWidth,
          color: borderColor,
          radius: borderRadius as unknown as number,
        });
      }

      // Child Composition: 자식 Element가 있으면 spec shapes에서 아이템 렌더링 스킵
      const hasChildren = !!(props as Record<string, unknown>)._hasChildren;
      if (hasChildren) return shapes;

      // 리스트 아이템 생성 (ADR-076: StoredListBoxItem[] SSOT / ADR-099 Phase 2: Entry[] 확장)
      // fallback placeholder — items 부재 시 3개 샘플 (Select 선례)
      const entries: StoredListBoxEntry[] =
        props.items && props.items.length > 0
          ? props.items
          : [
              { id: "item-1", label: "Item 1" },
              { id: "item-2", label: "Item 2" },
              { id: "item-3", label: "Item 3" },
            ];

      // ADR-099 Phase 2: flatItems — section 내부 items 를 flat 전개 (selection index 검색용).
      //   RAC 공식 ListBoxSection 은 단일 level (nested section 미지원) — flat 전개 안전.
      const flatItems: StoredListBoxItem[] = [];
      for (const entry of entries) {
        if (isListBoxSectionEntry(entry)) {
          flatItems.push(...entry.items);
        } else {
          flatItems.push(entry);
        }
      }

      // ADR-145 Phase B: row metric — template element 의 paddingX / height 직접 override 우선.
      //   fontSize 기반 계산 (metric.itemPaddingX / metric.itemHeight) 은 이미 위에서 template
      //   fontSize 가 적용됐기 때문에 자동 정합. paddingX/height 만 추가 layer.
      const ITEM_PADDING_X = parsePxValue(
        templateStyle?.paddingX ?? templateStyle?.paddingLeft,
        metric.itemPaddingX,
      );
      const itemH = parsePxValue(templateStyle?.height, metric.itemHeight);
      const gap = metric.rowGap;
      const innerPaddingX = metric.paddingLeft + borderWidth;
      const innerPaddingY = metric.paddingTop + borderWidth;
      let itemY = innerPaddingY;

      // 선택 상태 계산 — canonical(selectedKey/selectedKeys) 우선, legacy index fallback
      // ADR-099 Phase 2: flatItems 기준 id Set — section 내부 items 포함하여 검색
      const selectedIdSet = new Set<string>();
      if (props.selectedKeys && props.selectedKeys.length > 0) {
        for (const key of props.selectedKeys) selectedIdSet.add(key);
      } else if (props.selectedKey != null) {
        selectedIdSet.add(props.selectedKey);
      } else if (props.selectedIndices && props.selectedIndices.length > 0) {
        for (const idx of props.selectedIndices) {
          const flat = flatItems[idx];
          if (flat) selectedIdSet.add(flat.id);
        }
      } else if (props.selectedIndex != null) {
        const flat = flatItems[props.selectedIndex];
        if (flat) selectedIdSet.add(flat.id);
      } else if (flatItems[0]) {
        selectedIdSet.add(flatItems[0].id);
      }

      const HEADER_HEIGHT = metric.headerHeight;
      const HEADER_FONT_SIZE = metric.headerFontSize;
      const SECTION_TOP_PAD = metric.sectionTopPad;

      // ADR-145 Phase B: Skia viewport intersection — visible row 만 paint.
      //   figma WebGPU tile-based + Retool react-window + composition Preview `@tanstack/react-virtual`
      //   와 동등 industry-standard culling pattern. `_viewport` 미주입 시 모든 row paint (legacy).
      const viewport = (props as Record<string, unknown>)._viewport as
        | { top: number; bottom: number }
        | undefined;
      const isRowVisible = (y: number, h: number): boolean => {
        if (!viewport) return true;
        return y + h >= viewport.top && y <= viewport.bottom;
      };

      // ADR-099 Phase 2: item 렌더 헬퍼 — 기존 인라인 로직을 entries 순회 내부에서 재사용.
      const renderOneItem = (item: StoredListBoxItem, y: number) => {
        if (!isRowVisible(y, itemH)) return;
        const isSelected = selectedIdSet.has(item.id);
        const isItemDisabled = Boolean(item.isDisabled);

        shapes.push({
          type: "roundRect" as const,
          x: innerPaddingX,
          y,
          width: width - innerPaddingX * 2,
          height: itemH,
          radius: borderRadius as unknown as number,
          fill: isSelected
            ? (fill.default.hover ?? fill.default.base)
            : bgColor,
        });

        if (props.selectionMode === "multiple") {
          shapes.push({
            type: "icon_font" as const,
            iconName: isSelected ? "check-square" : "square",
            x: innerPaddingX + ITEM_PADDING_X,
            y: y + itemH / 2,
            fontSize,
            fill: isSelected
              ? ("{color.accent}" as TokenRef)
              : ("{color.neutral-subdued}" as TokenRef),
            strokeWidth: 2,
          });
        }

        const textX =
          props.selectionMode === "multiple"
            ? innerPaddingX + ITEM_PADDING_X + fontSize + 6
            : innerPaddingX + ITEM_PADDING_X;
        const itemTextFill = isItemDisabled
          ? ("{color.neutral-subdued}" as TokenRef)
          : isSelected
            ? ("{color.neutral}" as TokenRef)
            : textColor;
        shapes.push({
          type: "text" as const,
          x: textX,
          y: y + itemH / 2,
          text: item.label,
          fontSize,
          fontFamily: ff,
          fontWeight: 600,
          fill: itemTextFill,
          align: textAlign,
          baseline: "middle" as const,
        });
      };

      // ADR-099 Phase 2: entries 순회 — section 분기 + item 렌더.
      //   Header 는 첫 section 외 앞에 SECTION_TOP_PAD 추가 (섹션 간 시각 구분).
      let hasRenderedEntry = false;
      for (const entry of entries) {
        if (isListBoxSectionEntry(entry)) {
          if (hasRenderedEntry) itemY += SECTION_TOP_PAD;
          // Section Header — text shape (Phase 3 에서 HeaderSpec childSpecs + CSS emit 추가)
          //   ADR-145 Phase B: viewport intersection culling 동일 적용.
          if (isRowVisible(itemY, HEADER_HEIGHT)) {
            shapes.push({
              type: "text" as const,
              x: innerPaddingX + ITEM_PADDING_X,
              y: itemY + HEADER_HEIGHT / 2,
              text: entry.header,
              fontSize: HEADER_FONT_SIZE,
              fontFamily: ff,
              fontWeight: 700,
              fill: "{color.neutral-subdued}" as TokenRef,
              align: "left" as const,
              baseline: "middle" as const,
            });
          }
          itemY += HEADER_HEIGHT + gap;
          for (const item of entry.items) {
            renderOneItem(item, itemY);
            itemY += itemH + gap;
          }
        } else {
          renderOneItem(entry, itemY);
          itemY += itemH + gap;
        }
        hasRenderedEntry = true;
      }

      return shapes;
    },

    react: (props) => ({
      "data-disabled": props.isDisabled || undefined,
      role: "listbox",
      "aria-multiselectable": props.selectionMode === "multiple" || undefined,
    }),

    pixi: (props) => ({
      eventMode: props.isDisabled ? ("none" as const) : ("static" as const),
      cursor: props.isDisabled ? "not-allowed" : "default",
    }),
  },
};

/**
 * ListBox 컨테이너 spacing + item/header metric.
 *
 * ADR-907 Phase 4 sweep — `resolveContainerSpacing` (Layer B) 위에
 * ListBox-specific 확장 (itemPaddingX / itemHeight / headerHeight / sectionTopPad) 합성.
 *
 * 호출자:
 *  - Skia: `ListBoxSpec.render.shapes`
 *  - Layout: `apps/builder/.../engines/utils.ts` `calculateContentHeight` ListBox 분기
 */
export interface ListBoxSpacingMetric {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  rowGap: number;
  columnGap: number;
  borderWidth: number;
  fontSize: number;
  itemPaddingX: number;
  itemHeight: number;
  headerHeight: number;
  headerFontSize: number;
  sectionTopPad: number;
}

export interface ListBoxSpacingInput {
  /** element.props.style — padding/gap/borderWidth/fontSize 우선 소스 */
  style?: Record<string, unknown>;
  /** style.gap/rowGap 미지정 시 기본 rowGap (= item 수직 간격). 기본 2 */
  defaultGap?: number;
  /** style.fontSize 미지정 시 기본 fontSize (TokenRef 는 caller 가 resolveSpecFontSize 로 해소). 기본 14 */
  defaultFontSize?: number;
  /** style.padding* 미지정 시 기본 좌우 padding. 기본 4 */
  defaultPaddingX?: number;
  /** style.padding* 미지정 시 기본 상하 padding. 기본 4 */
  defaultPaddingY?: number;
}

export function resolveListBoxSpacingMetric(
  input: ListBoxSpacingInput,
): ListBoxSpacingMetric {
  const defaultPaddingX = input.defaultPaddingX ?? 4;
  const defaultPaddingY = input.defaultPaddingY ?? 4;
  const base = resolveContainerSpacing({
    style: input.style,
    defaults: {
      paddingTop: defaultPaddingY,
      paddingRight: defaultPaddingX,
      paddingBottom: defaultPaddingY,
      paddingLeft: defaultPaddingX,
      rowGap: input.defaultGap ?? 2,
      columnGap: input.defaultGap ?? 2,
      borderWidth: 1,
      fontSize: input.defaultFontSize ?? 14,
    },
  });
  const itemMetric = resolveListBoxItemMetric(base.fontSize);
  return {
    ...base,
    itemPaddingX: itemMetric.paddingX,
    itemHeight: itemMetric.itemHeight,
    headerHeight: Math.round(base.fontSize * 1.75),
    headerFontSize: Math.round(base.fontSize * 0.85),
    sectionTopPad: Math.round(base.fontSize * 0.5),
  };
}
