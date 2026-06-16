/**
 * ListBox Component Spec
 *
 * React Aria 기반 리스트박스 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import type { StoredListBoxEntry } from "../types/listbox-items";
import { parsePxValue } from "../primitives";
import { resolveContainerSpacing } from "../primitives/containerSpacing";
import { resolveStateColors } from "../utils/stateEffect";
// ADR-078 Phase 2: 자식 Spec inline emit — `.react-aria-ListBoxItem` 블록이 본 Spec
// 의 `generated/ListBox.css` 같은 @layer 에 삽입된다.
// ADR-078 Phase 3: `resolveListBoxItemMetric` 로 Skia/layout 양쪽 item metric 단일 소스화.
// ADR-912 collection item leaf cutover (2026-06-14): ListBoxItemSpec import 제거 — childSpecs 의
//   ListBoxItem CSS inline emit 을 `generated/ListBoxItem.css` virtual 로 분리(generate-css
//   TEXT_LEAF_META).
// ADR-912 단계5 step4 (2026-06-16): Header.spec.ts 삭제 — childSpecs 는 listBoxHeaderChildSpec
//   인라인 객체로 Section Header CSS inline emit 유지 (아래 정의).
import { resolveListBoxItemMetric } from "../renderers/utils/collectionItemMetrics";
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
 * Section Header — ListBox/GridList/Menu section 의 첫 자식 (RAC slot="section-header").
 *
 * ADR-099 Phase 3 (098-c 슬롯): sticky 위치 + muted 색상 + semibold.
 * ADR-912 단계5 step4 (2026-06-16): Header.spec.ts 물리 삭제 → childSpecs inline emit 보존을 위해
 *   ListBox.spec 내부 인라인 child spec 으로 이관. `.react-aria-Header` 블록이
 *   generated/ListBox.css 에 `generateCSS(child, embedMode)` 경로로 byte-identical emit.
 *   STRUCTURE_META virtual 로는 standalone generated/Header.css 만 생성될 뿐 ListBox.css inline 이
 *   안 되므로(buildVirtualSpecs 가 childSpecs 미주입) 인라인 객체가 유일한 byte-identical 보존책.
 *   시각값 SSOT 는 componentRulesTable.Header.sizes (paddingX/paddingY/fontSize/borderRadius/fontWeight).
 */
const listBoxHeaderChildSpec: ComponentSpec<{ size?: "sm" | "md" | "lg" }> = {
  name: "Header",
  description:
    "Section header — ListBox/GridList/Menu section 의 첫 자식 (RAC slot='section-header')",
  archetype: "simple",
  element: "div",
  skipCSSGeneration: true,

  // ADR-099 Phase 3: RAC 공식 Header 스타일 — sticky 위치 + muted 색상 + semibold.
  containerStyles: {
    position: "sticky",
    background: "{color.raised}" as TokenRef,
    text: "{color.neutral-subdued}" as TokenRef,
  },

  defaultSize: "md",

  // md 기준 Header metric — RAC Header CSS emit 용 (componentRulesTable.Header.sizes 미러).
  sizes: {
    sm: {
      height: 0,
      paddingX: 12,
      paddingY: 4,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      fontWeight: 700,
    },
    md: {
      height: 0,
      paddingX: 12,
      paddingY: 6,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      fontWeight: 700,
    },
    lg: {
      height: 0,
      paddingX: 16,
      paddingY: 8,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      fontWeight: 700,
    },
  },

  // Header 는 정적 텍스트 — hover/pressed/disabled 상태 의미 없음. 빈 states 객체로 선언.
  //   (buildVirtualSpecs default states 를 받지 않도록 명시 — diff-0 보존 CRITICAL)
  states: {},

  render: {
    shapes: () => [],
    react: () => ({
      role: "presentation",
    }),
    pixi: () => ({
      eventMode: "passive" as const,
      cursor: "default",
    }),
  },
};

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

  // ADR-912 collection item leaf cutover (2026-06-14): ListBoxItem 은 childSpecs inline emit 에서
  //   독립 `generated/ListBoxItem.css` virtual 로 분리(catalog rule SSOT). flat selector
  //   `.react-aria-ListBoxItem` 이라 수동 ListBox.css 의 orientation/layout/Popover cascade override 는
  //   동일 @layer 에서 그대로 적용(파일만 분리, cascade 위치 불변).
  // ADR-099 Phase 3 (098-c 슬롯): Section Header 는 childSpecs inline emit — flat selector
  // `.react-aria-Header` 블록이 generated/ListBox.css 에 추가된다. Preview DOM 의 RAC `<Header>` 가
  // section 엔트리 렌더 시 sticky 위치 + muted 스타일 적용.
  // ADR-912 단계5 step4 (2026-06-16): Header.spec.ts 삭제 → 위 listBoxHeaderChildSpec 인라인 객체 사용.
  childSpecs: [listBoxHeaderChildSpec],

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
  // ADR-912 (2026-06-14): ListBoxItem.spec 삭제 후 item padding/lineHeight 는
  //   `resolveListBoxItemMetric(fontSize)`(collectionItemMetrics) 단일 SSOT 공급 —
  //   Skia(listbox_item escape) 와 layout(utils.ts) 공유.
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

      // ADR-907 Layer D: borderWidth는 layout ListBox 분기와 같은 spacing resolver를 소비.
      const metric = resolveListBoxSpacingMetric({
        style: props.style as Record<string, unknown> | undefined,
        defaultGap: (size.gap as unknown as number) ?? 2,
        defaultFontSize: 14,
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

      // ADR-146: data row paint는 ListBoxItem row projection renderer가 담당한다.
      // ListBox parent spec은 container shell(background/border)만 반환한다.
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
  /** description(label+desc) 행 높이 — render.shapes 와 정합. 잘림 방지용. */
  itemHeightWithDescription: number;
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
    itemHeightWithDescription: itemMetric.itemHeightWithDescription,
    headerHeight: Math.round(base.fontSize * 1.75),
    headerFontSize: Math.round(base.fontSize * 0.85),
    sectionTopPad: Math.round(base.fontSize * 0.5),
  };
}
