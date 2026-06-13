/**
 * GridList Component Spec
 *
 * React Aria 기반 그리드 리스트 컴포넌트 (카드형 선택 UI)
 * S2 SelectBoxGroup 통합 — layout: "stack" | "grid" 지원
 * Single Source of Truth - React와 Skia 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import type {
  StoredGridListItem,
  StoredGridListEntry,
} from "../types/gridlist-items";
// ADR-912 C1: render.shapes shell-only 전환으로 isGridListSectionEntry / fontFamily /
//   resolveSpecFontSize 미사용(카드/section 렌더 GridListItem projection 이관). 제거.
import { resolveContainerSpacing } from "../primitives/containerSpacing";
import { Grid, Binary, Rows, SquareX, PointerOff, Square } from "lucide-react";
import { FILTERING_SECTION } from "../utils/sharedSections";
import { GridListItemSpec } from "./GridListItem.spec";
import { resolveGridListItemMetric } from "../renderers/utils/collectionItemMetrics";
// ADR-099 Phase 5: HeaderSpec 도 childSpecs 경로로 관계 선언 —
// GridList.skipCSSGeneration=true 이므로 Generator emit 안 하지만,
// Spec 계층 관계를 SSOT 로 선언해 향후 skipCSSGeneration 해체 시 자동 연동.
import { HeaderSpec } from "./Header.spec";

/**
 * @deprecated GridList.spec.ts 내부에서만 사용 — StoredGridListItem 으로 대체.
 * ADR-099 Phase 5 이후 외부 참조는 `StoredGridListItem` (gridlist-items.ts) 사용.
 */
export type GridListItem = StoredGridListItem;

/**
 * GridList Props
 */
export interface GridListProps {
  variant?: "default" | "accent";
  layout?: "stack" | "grid";
  selectionMode?: "none" | "single" | "multiple";
  selectionBehavior?: "toggle" | "replace";
  disallowEmptySelection?: boolean;
  isDisabled?: boolean;
  autoFocus?: boolean;
  allowsDragging?: boolean;
  renderEmptyState?: boolean;
  name?: string;
  validationBehavior?: "native" | "aria";
  columns?: number;
  filterText?: string;
  filterFields?: string[];
  /**
   * 아이템 목록 (ADR-099 Phase 5: Section 엔트리 지원 — `StoredGridListEntry[]`)
   * 기존 items 는 discriminator 미보유 → default "item" 해석, BC 0%.
   */
  items?: StoredGridListEntry[];
  /** ElementSprite 주입: 엔진 계산 최종 폭 */
  _containerWidth?: number;
  style?: Record<string, string | number | undefined>;
}

/**
 * GridList Component Spec
 */
export const GridListSpec: ComponentSpec<GridListProps> = {
  name: "GridList",
  description: "카드형 선택 그리드/리스트 컴포넌트",
  element: "div",
  skipCSSGeneration: true,

  // ADR-090 Phase 2: GridListItemSpec 관계 선언.
  //   Generator 는 GridList.skipCSSGeneration=true 이므로 emit 안 하지만, Spec 계층 관계를
  //   SSOT 로 선언해 향후 skipCSSGeneration 해체 시 자식 selector emit 자동 연동.
  // ADR-099 Phase 5: HeaderSpec 추가 — Section Header Spec 계층 관계 SSOT 선언.
  childSpecs: [GridListItemSpec, HeaderSpec],

  defaultVariant: "default",
  defaultSize: "md",

  properties: {
    sections: [
      {
        title: "Layout",
        fields: [
          {
            key: "variant",
            type: "variant",
          },
          {
            key: "layout",
            type: "enum",
            label: "Layout",
            icon: Grid,
            options: [
              { value: "stack", label: "Stack" },
              { value: "grid", label: "Grid" },
            ],
            defaultValue: "stack",
          },
          {
            key: "columns",
            type: "number",
            label: "Columns",
            icon: Binary,
            min: 1,
            max: 12,
            visibleWhen: { key: "layout", equals: "grid" },
            defaultValue: 3,
          },
        ],
      },
      {
        title: "State",
        fields: [
          {
            key: "selectionMode",
            type: "enum",
            label: "Selection Mode",
            icon: Grid,
            options: [
              { value: "none", label: "None" },
              { value: "single", label: "Single" },
              { value: "multiple", label: "Multiple" },
            ],
            defaultValue: "none",
          },
          {
            key: "selectionBehavior",
            type: "enum",
            label: "Selection Behavior",
            icon: Rows,
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
          {
            key: "renderEmptyState",
            type: "boolean",
            label: "Render Empty State",
            icon: Square,
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
            itemTypeName: "GridListItem",
            defaultItem: {
              id: "",
              label: "Item",
              textValue: "Item",
              isDisabled: false,
            },
            itemSchema: [
              { key: "label", type: "string", label: "Label" },
              { key: "textValue", type: "string", label: "Text Value" },
              { key: "description", type: "string", label: "Description" },
              { key: "isDisabled", type: "boolean", label: "Disabled" },
            ],
            labelKey: "label",
            allowNested: false,
            allowSections: true,
          },
        ],
      },
      FILTERING_SECTION,
    ],
  },

  variants: {
    default: {
      fill: {
        default: {
          base: "{color.transparent}" as TokenRef,
          hover: "{color.transparent}" as TokenRef,
          pressed: "{color.transparent}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
    },
    accent: {
      fill: {
        default: {
          base: "{color.transparent}" as TokenRef,
          hover: "{color.accent-subtle}" as TokenRef,
          pressed: "{color.accent-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
    },
  },

  sizes: {
    md: {
      height: 0,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: 0 as unknown as TokenRef,
      gap: 12,
    },
  },

  states: {
    hover: {},
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
    focusVisible: {},
  },

  propagation: {
    rules: [
      { parentProp: "variant", childPath: "GridListItem", override: true },
    ],
  },

  render: {
    // ADR-912 단계 4 C1 (2026-06-03): shell-only 전환. data card paint 는 GridListItem row
    //   projection renderer(canvasSceneNode appendGridListRowProjection → GridListItem.spec.
    //   render.shapes)가 담당한다(ListBox.spec:340-342 동형). GridList parent spec 은 container
    //   shell(bg + border)만 반환. items/section 순회 제거 — 발효(skiaLegacy 제거) 후 GridList 는
    //   isCatalogSkiaCutover 경로(buildCatalogShapes 컨테이너 shell)라 본 render.shapes 는 Skia
    //   미경유이나, layout/legacy consumer 회귀 0 위해 shell parity 유지(ListBox 패턴).
    shapes: (props, size, _state = "default") => {
      const variant =
        GridListSpec.variants![
          (props as { variant?: keyof typeof GridListSpec.variants }).variant ??
            GridListSpec.defaultVariant!
        ];
      const borderRadius = (props.style?.borderRadius ??
        size.borderRadius) as unknown as number;
      const width =
        typeof props._containerWidth === "number" && props._containerWidth > 0
          ? props._containerWidth
          : (props.style?.width as number) || 280;

      const shapes: Shape[] = [];

      // 컨테이너 배경 (GridList rule fill = {color.transparent} 정합).
      const bgColor =
        (props.style?.backgroundColor as string | undefined) ??
        (variant.fill?.default?.base as string | undefined);
      shapes.push({
        id: "bg",
        type: "roundRect" as const,
        x: 0,
        y: 0,
        width,
        height: "auto" as unknown as number,
        radius: borderRadius,
        fill: bgColor ?? ("{color.transparent}" as TokenRef),
      });

      // 테두리 (GridList default variant 는 border 없음 — style override 시에만).
      const borderColor = props.style?.borderColor ?? variant.border;
      if (borderColor) {
        shapes.push({
          type: "border" as const,
          target: "bg",
          borderWidth: 1,
          color: borderColor as TokenRef,
          radius: borderRadius,
        });
      }

      return shapes;
    },

    react: (props) => ({
      role: "grid",
      "aria-multiselectable": props.selectionMode === "multiple" || undefined,
    }),
  },
};

/**
 * GridList 컨테이너 spacing + 카드/그리드 metric.
 *
 * Phase 3 Layer D — `resolveContainerSpacing` (Layer B) 위에
 * GridList-specific 확장 (numCols / cardPadding* / cardBorderRadius / descGap) 을 합성한다.
 *
 * 호출자:
 *  - Skia: `GridList.spec.ts` `render.shapes` (Wave B-2 에서 치환)
 *  - Layout: `apps/builder/.../engines/utils.ts` `calculateContentHeight` GridList 분기 (Wave B-1)
 *  - Preview: 별도 진입 없음 (DOM/CSS 가 직접 style 소비, root style 전달은 Phase 3 MVP 완료)
 */
export interface GridListSpacingMetric {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  rowGap: number;
  columnGap: number;
  borderWidth: number;
  fontSize: number;
  numCols: number;
  cardPaddingX: number;
  cardPaddingY: number;
  cardBorderRadius: number;
  descGap: number;
}

export interface GridListSpacingInput {
  /** element.props.style — padding/gap/borderWidth/fontSize 우선 소스 */
  style?: Record<string, unknown>;
  /** "stack" | "grid". stack 은 numCols=1 강제, grid 는 columns 사용 */
  layout?: "stack" | "grid";
  /** grid 모드에서만 사용. 1 미만은 1 로 clamp */
  columns?: number;
  /** style.gap 미지정 시 기본 row/columnGap. 기본 12 */
  defaultGap?: number;
  /** style.fontSize 미지정 시 기본 fontSize. 기본 14 */
  defaultFontSize?: number;
}

export function resolveGridListSpacingMetric(
  input: GridListSpacingInput,
): GridListSpacingMetric {
  const base = resolveContainerSpacing({
    style: input.style,
    defaults: {
      rowGap: input.defaultGap ?? 12,
      columnGap: input.defaultGap ?? 12,
      fontSize: input.defaultFontSize ?? 14,
    },
  });
  const numCols = input.layout === "grid" ? Math.max(1, input.columns ?? 2) : 1;
  const itemMetric = resolveGridListItemMetric(base.fontSize);
  return {
    ...base,
    numCols,
    cardPaddingX: itemMetric.cardPaddingX,
    cardPaddingY: itemMetric.cardPaddingY,
    cardBorderRadius: itemMetric.cardBorderRadius,
    descGap: itemMetric.descGap,
  };
}
