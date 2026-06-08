/**
 * Breadcrumbs Component Spec
 *
 * React Spectrum S2 API 기반 브레드크럼 컴포넌트
 * Single Source of Truth - React와 Skia 모두에서 동일한 시각적 결과
 *
 * RSP API 레퍼런스: https://react-spectrum.adobe.com/react-spectrum/Breadcrumbs.html
 *
 * @packageDocumentation
 */

import type { ComponentSpec, TokenRef } from "../types";
import type { StoredBreadcrumbItem } from "../types/breadcrumb-items";
import { PointerOff } from "lucide-react";

/**
 * Breadcrumbs Props — RSP API 기준
 */
export interface BreadcrumbsProps {
  /** Controls spacing and layout size. RSP API: 'S' | 'M' | 'L', default 'M' */
  size?: "S" | "M" | "L";
  /** Always shows root item when collapsed */
  showRoot?: boolean;
  /** Places last item on new line */
  isMultiline?: boolean;
  /** Disables all breadcrumbs */
  isDisabled?: boolean;
  /** Auto-focuses last item on render */
  autoFocusCurrent?: boolean;
  /** Separator character (composition extension) */
  separator?: string;
  /**
   * 아이템 목록 (ADR-912 영역 B (A): StoredBreadcrumbItem[] SSOT).
   *
   * Builder(Skia)는 appendBreadcrumbRowProjection 이 Breadcrumbs.props.items 를 직접 읽어
   * crumb projection 노드를 전개한다 (중간 컨테이너 없음 — TagGroup→TagList 2단과 다름,
   * Breadcrumbs→Breadcrumb 1단 직접). Preview(DOM)는 useResolvedCollectionItems 가 흡수.
   */
  items?: StoredBreadcrumbItem[];
  /** ElementSprite 주입: 엔진 계산 최종 폭 */
  _containerWidth?: number;
  style?: Record<string, string | number | undefined>;
  /** @deprecated 레거시 — Skia는 Breadcrumb 자식 spec이 텍스트를 그림 */
  _crumbs?: string[];
}

/**
 * Breadcrumbs Component Spec
 * RSP size default: 'M'
 */
export const BreadcrumbsSpec: ComponentSpec<BreadcrumbsProps> = {
  name: "Breadcrumbs",
  description: "React Spectrum S2 기반 브레드크럼 네비게이션 컴포넌트",
  archetype: "simple",

  // ADR-083 Phase 11 + ADR-084 Phase A4: simple archetype base layout primitive SSOT.
  //   "inline-flex" → "flex" 정정 (Taffy 미지원). flexDirection/flexWrap 명시 추가.
  //   implicitStyles.ts:976 Breadcrumbs parent 분기의 display/flexDirection/alignItems/
  //   flexWrap 직접 할당이 ADR-084 로 해체됨 (child 주입 line 955-971 은 scope 외).
  containerStyles: {
    display: "flex",
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
  },
  element: "nav",

  defaultVariant: "default",
  defaultSize: "M",

  variants: {
    default: {
      fill: {
        default: {
          base: "{color.base}" as TokenRef,
          hover: "{color.base}" as TokenRef,
          pressed: "{color.base}" as TokenRef,
        },
      },
      text: "{color.neutral-subdued}" as TokenRef,
      textHover: "{color.neutral}" as TokenRef,
    },
  },

  sizes: {
    S: {
      height: 16,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
    },
    M: {
      height: 24,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
    },
    L: {
      height: 24,
      paddingX: 0,
      paddingY: 0,
      fontSize: "{typography.text-lg}" as TokenRef,
      borderRadius: "{radius.none}" as TokenRef,
    },
  },

  states: {
    hover: {},
    /* 마지막 항목(현재 페이지)은 레퍼런스대로 흐리지 않음 — opacity는 자손 선택자로만 적용 */
    disabled: {
      opacity: 1,
      pointerEvents: "auto",
      cursor: "default",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  properties: {
    sections: [
      {
        title: "Appearance",
        fields: [
          { type: "size" },
          {
            key: "showRoot",
            type: "boolean",
            label: "Show Root",
            icon: PointerOff,
          },
          {
            key: "isMultiline",
            type: "boolean",
            label: "Multiline",
            icon: PointerOff,
          },
        ],
      },
      {
        title: "State",
        fields: [{ key: "isDisabled", type: "boolean", icon: PointerOff }],
      },
      {
        title: "Breadcrumb Management",
        fields: [
          // ADR-912 영역 B (A): children-manager → items-manager 전환.
          //   ADR-097 TagGroup 선례 동일 패턴. Breadcrumb element tree →
          //   Breadcrumbs.props.items[] (StoredBreadcrumbItem) 로 이관.
          {
            key: "items",
            type: "items-manager",
            label: "Breadcrumbs",
            itemsKey: "items",
            itemTypeName: "Breadcrumb",
            defaultItem: {
              id: "", // runtime에서 crypto.randomUUID() 주입
              label: "Breadcrumb",
              href: "/",
            },
            itemSchema: [
              { key: "label", type: "string", label: "Label" },
              { key: "href", type: "string", label: "Href" },
              { key: "isDisabled", type: "boolean", label: "Disabled" },
            ],
            labelKey: "label",
            allowNested: false,
          },
        ],
      },
    ],
  },

  render: {
    // Skia 텍스트/구분자는 자식 Breadcrumb.spec이 담당 (Taffy 셀과 1:1)
    shapes: () => [],

    react: () => ({
      "aria-label": "Breadcrumb",
    }),
  },
};
