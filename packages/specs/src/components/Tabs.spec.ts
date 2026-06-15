/**
 * Tabs Component Spec
 *
 * React Aria 기반 탭 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * CSS Preview와 동일한 사이즈를 위해 React-Aria 기본 렌더링 기준으로 측정:
 * - Tab: padding 4px 16px, border-bottom 1px
 * - TabPanel: padding 16px
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import { Ratio, PointerOff, MousePointer2 } from "lucide-react";
// ADR-912 projection 3 cutover (2026-06-15): TabListSpec import 제거 — childSpecs 끊김(catalog 등록).

/**
 * Tabs Props
 */
export interface TabItem {
  id: string;
  title: string;
}

export interface TabsProps {
  variant?: "default";
  density?: "compact" | "regular";
  isQuiet?: boolean;
  isEmphasized?: boolean;
  size?: "sm" | "md" | "lg";
  orientation?: "horizontal" | "vertical";
  selectedKey?: string;
  defaultSelectedKey?: string;
  isDisabled?: boolean;
  showIndicator?: boolean;
  /**
   * Tab items — SSOT (ADR-066).
   * RAC Collection Items 패턴. items[i].id ↔ TabPanel.customId 페어링.
   */
  items?: TabItem[];
  /** ElementSprite 주입: 엔진 계산 최종 폭 */
  _containerWidth?: number;
  style?: Record<string, string | number | undefined>;
}

/**
 * Tabs Component Spec
 */
export const TabsSpec: ComponentSpec<TabsProps> = {
  name: "Tabs",
  description: "React Aria 기반 탭 컴포넌트",
  element: "div",
  skipCSSGeneration: false,

  // ADR-087 SP2: Tabs static layout-primitive 리프팅.
  //   TabList 와 TabPanels 의 size-indexed height/padding 은 runtime 결정 (implicitStyles 잔존).
  containerStyles: {
    display: "flex",
    flexDirection: "column",
  },

  defaultVariant: "default",
  defaultSize: "md",

  properties: {
    sections: [
      {
        title: "Appearance",
        fields: [
          {
            key: "density",
            type: "enum",
            label: "Density",
            icon: Ratio,
            options: [
              { value: "compact", label: "Compact" },
              { value: "regular", label: "Regular" },
            ],
            defaultValue: "regular",
          },
          {
            key: "orientation",
            type: "enum",
            label: "Orientation",
            icon: Ratio,
            options: [
              { value: "horizontal", label: "Horizontal" },
              { value: "vertical", label: "Vertical" },
            ],
            defaultValue: "horizontal",
          },
          {
            key: "isQuiet",
            type: "boolean",
            label: "Quiet",
            icon: Ratio,
          },
          {
            key: "isEmphasized",
            type: "boolean",
            label: "Emphasized",
            icon: Ratio,
          },
          {
            key: "showIndicator",
            type: "boolean",
            label: "Show Indicator",
            icon: MousePointer2,
            defaultValue: true,
          },
        ],
      },
      {
        title: "State",
        fields: [
          {
            key: "isDisabled",
            type: "boolean",
            label: "Disabled",
            icon: PointerOff,
          },
        ],
      },
    ],
  },

  variants: {
    // S2에서 Tabs는 단일 스타일 (accent 기반 indicator)
    // 선택된 탭 텍스트: --fg ({color.neutral}), CSS [data-selected]과 동일
    default: {
      fill: {
        default: {
          base: "{color.transparent}" as TokenRef,
          hover: "{color.transparent}" as TokenRef,
          pressed: "{color.transparent}" as TokenRef,
        },
      },
      text: "{color.neutral-subdued}" as TokenRef,
      textHover: "{color.neutral}" as TokenRef,
      // ADR-912 단계 4 C2 (2026-06-03): 정본 table 추종 — 컨테이너 `border` 제거.
      //   `.react-aria-Tabs` 컨테이너는 박스 border 없음(generated CSS line 9-22 에도 없음).
      //   탭 하단 선(border-bottom)은 Tab 자식/indicator `::before` 가 그린다(컨테이너 박스 아님).
      //   buildCatalogShapes 가 `visual.border` 를 컨테이너 박스 border 로 그리면 legacy `[]` 불일치.
    },
  },

  // TABS_SIZE_CONFIG (primitives/tabSizes.ts) 와 동일 metric. (ADR-105-b)
  // height = paddingY×2 + lineHeight + borderWidth×1 (단면 하단 border — Button과 공식 다름)
  // sm: 2*2 + 16(lh) + 1 = 21, md: 4*2 + 20(lh) + 1 = 29, lg: 8*2 + 24(lh) + 1 = 41
  // Tabs.css 참조 부분 → 105-c (F2 spec-to-CSS) 에 위임
  sizes: {
    sm: {
      height: 21,
      paddingX: 8,
      paddingY: 2,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    md: {
      height: 29,
      paddingX: 12,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
    lg: {
      height: 41,
      paddingX: 16,
      paddingY: 8,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
      gap: 0,
    },
  },

  // ADR-036 Phase 3a: Tier 2 Composite CSS 생성 메타데이터
  composition: {
    layout: "flex-column",
    delegation: [
      {
        childSelector: ".react-aria-Tab",
        variables: {
          sm: {
            "--tab-padding": "var(--spacing-2xs) var(--spacing-sm)",
            "--tab-font-size": "var(--text-xs)",
          },
          md: {
            "--tab-padding": "var(--spacing-xs) var(--spacing-md)",
            "--tab-font-size": "var(--text-sm)",
          },
          lg: {
            "--tab-padding": "var(--spacing-sm) var(--spacing-lg)",
            "--tab-font-size": "var(--text-base)",
          },
        },
      },
    ],
  },

  states: {
    hover: {},
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.inset}",
    },
  },

  // ADR-912 projection 3 cutover (2026-06-15): TabList catalog cutover → childSpecs 제거.
  //   TabList 은 catalog 등록(FAMILY_4_CUTOVER)으로 TAG_SPEC_MAP 자동 등록 불요. propagation(아래)은
  //   childPath:"TabList" string 이라 spec 객체 의존 0 → propagation 유지.

  // ADR-912 영역 B (A): Tabs.props.items → TabList 전파.
  //   chip projection(appendTabRowProjection)이 owner=TabList scene node 에 붙고,
  //   resolveDataBoundTabProjection 이 TabList.props.items 를 읽어 tab-row 노드 전개.
  //   기존 collection projection invariant("projection 대상 노드가 자기 props.items 를 읽음")를
  //   TagGroup→TagList 와 동일 propagation 으로 충족 (owner-lookup ad-hoc 패턴 회피).
  //   selectedKey/showIndicator/variant/size 도 chip 시각(_isSelected/indicator/토큰)용 전파.
  //   selectedKey 는 단일 선택(Tab) — TagList 의 selectedKeys(복수)와 prop 명칭 다름.
  propagation: {
    rules: [
      { parentProp: "items", childPath: "TabList", override: true },
      { parentProp: "selectedKey", childPath: "TabList", override: true },
      {
        parentProp: "defaultSelectedKey",
        childPath: "TabList",
        override: true,
      },
      { parentProp: "showIndicator", childPath: "TabList", override: true },
      { parentProp: "variant", childPath: "TabList", override: true },
      { parentProp: "size", childPath: "TabList", override: true },
      { parentProp: "orientation", childPath: "TabList", override: true },
    ],
  },

  render: {
    // Container layout — TabList/Tab이 각자 렌더링 담당
    // CSS: display:flex; flex-direction:column 구조와 동일
    shapes: (): Shape[] => [],

    react: (props) => ({
      "data-orientation": props.orientation || "horizontal",
    }),
  },
};
