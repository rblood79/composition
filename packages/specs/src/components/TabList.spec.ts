/**
 * TabList Component Spec
 *
 * Tabs의 자식 컨테이너. Tab 버튼들을 flex-row로 배치하고 하단에 구분선을 렌더링.
 * CSS: .react-aria-TabList { border-bottom: 1px solid var(--border) }
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import type { TabItem } from "./Tabs.spec";

export interface TabListProps {
  orientation?: "horizontal" | "vertical";
  /**
   * ADR-912 영역 B (A): Tab items — Tabs.props.items 가 propagation 으로 전파됨.
   *   chip projection(appendTabRowProjection)이 owner=TabList scene node 에 붙으므로,
   *   TabList.props.items 를 읽어 tab-row 노드를 전개한다(ListBox/GridList/TagList 동형 —
   *   projection 대상 노드가 자기 props.items 를 읽는 projector invariant 유지).
   *   factory 시점 applyFactoryPropagation 이 store/canonical 에 영속, Inspector edit 은
   *   buildPropagationUpdates 가 갱신 → scene graph(toCanvasSceneNode) 가 그대로 읽음.
   */
  items?: TabItem[];
  /** ADR-912 영역 B (A): selected tab 시각용 — Tabs.props.selectedKey propagation. */
  selectedKey?: string;
  defaultSelectedKey?: string;
  /** ADR-912 영역 B (A): indicator 표시 여부 — Tabs.props.showIndicator propagation. */
  showIndicator?: boolean;
  /** ADR-912 영역 B (A): Tabs.props.size propagation (chip 크기 토큰). */
  size?: "sm" | "md" | "lg";
  /** ADR-912 영역 B (A): Tabs.props.variant propagation. */
  variant?: "default";
  /** 컨테이너 시스템 주입 */
  _containerWidth?: number;
  _containerHeight?: number;
  style?: Record<string, string | number | undefined>;
}

const TABLIST_DEFAULTS = {
  border: "{color.border}" as TokenRef,
};

export const TabListSpec: ComponentSpec<TabListProps> = {
  name: "TabList",
  description: "Tab 버튼 컨테이너 — 하단 구분선 렌더링",
  element: "div",
  skipCSSGeneration: false,

  // ADR-087 SP2: TabList static layout-primitive 리프팅.
  //   height/width 는 runtime 결정 (implicitStyles Tabs 분기에서 size-based tabBarHeight 주입).
  containerStyles: {
    display: "flex",
    flexDirection: "row",
  },

  composition: {
    layout: "flex-row",
    delegation: [],
  },

  defaultSize: "md",

  properties: { sections: [] },

  sizes: {
    sm: {
      height: 21,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    md: {
      height: 29,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    lg: {
      height: 41,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
  },

  states: {
    disabled: { opacity: 0.38, pointerEvents: "none" },
  },

  render: {
    shapes: (props, size): Shape[] => {
      const isVertical = props.orientation === "vertical";
      const w = props._containerWidth ?? 200;
      const h = size.height;

      const borderColor = TABLIST_DEFAULTS.border;

      // 하단(horizontal) 또는 우측(vertical) 구분선
      return [
        {
          type: "line" as const,
          x1: 0,
          y1: isVertical ? 0 : h,
          x2: isVertical ? 0 : (w as unknown as number),
          y2: isVertical ? (h as unknown as number) : h,
          stroke: borderColor,
          strokeWidth: 1,
        } satisfies Shape,
      ];
    },
  },
};
