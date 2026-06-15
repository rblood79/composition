/**
 * TagGroup Component Spec
 *
 * React Aria 기반 태그 그룹 컴포넌트
 * Single Source of Truth - React와 PIXI 모두에서 동일한 시각적 결과
 *
 * @packageDocumentation
 */

import type { ComponentSpec, Shape, TokenRef } from "../types";
import type { StoredTagItem } from "../types/taggroup-items";
import {
  Layout,
  Rows3,
  MousePointer,
  ToggleLeft,
  ToggleRight,
  CheckSquare,
  AlertTriangle,
  PointerOff,
  PenOff,
  Trash,
  FileText,
  Tag,
  Sparkles,
  HelpCircle,
} from "lucide-react";

/**
 * TagGroup Props
 */
export interface TagGroupProps {
  variant?: "default" | "accent" | "neutral" | "negative";
  size?: "sm" | "md" | "lg";
  selectionMode?: "none" | "single" | "multiple";
  selectionBehavior?: "toggle" | "replace";
  label?: string;
  description?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  disallowEmptySelection?: boolean;
  necessityIndicator?: "icon" | "label";
  isInvalid?: boolean;
  allowsRemoving?: boolean;
  allowsCustomValue?: boolean;
  name?: string;
  maxRows?: number;
  groupActionLabel?: string;
  labelPosition?: "top" | "side";
  labelAlign?: "start" | "end";
  isEmphasized?: boolean;
  contextualHelp?: string;
  style?: Record<string, string | number | undefined>;
  /**
   * ADR-097 — TagGroup items SSOT.
   * Preview (RAC) 는 `<TagGroup items={...}>` 로 직접 consume.
   * Builder (Skia) 는 TagGroup.propagation → TagList.items 전파 후 TagList spec
   *   shapes 가 items 기반 chip self-render (ListBox 선례 대칭).
   */
  items?: StoredTagItem[];
}

/**
 * TagGroup Component Spec
 */
export const TagGroupSpec: ComponentSpec<TagGroupProps> = {
  name: "TagGroup",
  description: "React Aria 기반 태그 그룹 컴포넌트",
  element: "div",
  skipCSSGeneration: true,

  // ADR-087 SP6: outer TagGroup container static layout-primitive 리프팅.
  //   labelPosition side 는 ADR-108 containerVariants 로 선언하고, flexWrap 은 runtime 결정,
  //   gap 은 Label↔TagList 수직 간격 (spec.sizes.gap 은 inner tag-tag 간격과 별개).
  //   skipCSSGeneration:true → CSS emit 없음, 오직 Taffy resolveContainerStylesFallback 경유.
  containerStyles: {
    display: "flex",
    flexDirection: "column",
    gap: "{spacing.xs}",
  },

  // MIRROR: packages/shared/src/components/styles/TagGroup.css .react-aria-TagGroup[data-label-position="side"] - skipCSSGeneration:true 동안 수동 동기화
  composition: {
    delegation: [],
    containerVariants: {
      "label-position": {
        side: {
          styles: {
            "flex-direction": "row",
            "align-items": "flex-start",
          },
        },
      },
    },
  },

  defaultVariant: "default",
  defaultSize: "md",

  properties: {
    sections: [
      {
        title: "Appearance",
        fields: [
          {
            key: "variant",
            type: "variant",
          },
          {
            key: "size",
            type: "size",
          },
          {
            key: "maxRows",
            type: "number",
            label: "Max Rows",
            icon: Rows3,
          },
          {
            key: "labelPosition",
            type: "enum",
            label: "Label Position",
            icon: Layout,
            options: [
              { value: "top", label: "Top" },
              { value: "side", label: "Side" },
            ],
            defaultValue: "top",
          },
          {
            key: "labelAlign",
            type: "enum",
            label: "Label Align",
            icon: Layout,
            options: [
              { value: "start", label: "Start" },
              { value: "end", label: "End" },
            ],
            defaultValue: "start",
          },
          {
            key: "isEmphasized",
            type: "boolean",
            label: "Emphasized",
            icon: Sparkles,
          },
        ],
      },
      {
        title: "Content",
        fields: [
          {
            key: "label",
            type: "string",
            label: "Label",
            icon: Tag,
            emptyToUndefined: true,
          },
          {
            key: "groupActionLabel",
            type: "string",
            label: "Action Label",
            icon: Tag,
            emptyToUndefined: true,
          },
          {
            key: "description",
            type: "string",
            label: "Description",
            icon: FileText,
            emptyToUndefined: true,
          },
          {
            key: "errorMessage",
            type: "string",
            label: "Error Message",
            icon: AlertTriangle,
            emptyToUndefined: true,
          },
          {
            key: "contextualHelp",
            type: "string",
            label: "Contextual Help",
            icon: HelpCircle,
            emptyToUndefined: true,
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
            icon: MousePointer,
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
            icon: ToggleLeft,
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
            icon: ToggleRight,
          },
          {
            key: "necessityIndicator",
            type: "enum",
            label: "Required",
            icon: CheckSquare,
            options: [
              { value: "", label: "None" },
              { value: "icon", label: "Icon (*)" },
              { value: "label", label: "Label (required/optional)" },
            ],
            derivedUpdateFn: (value) => {
              if (value === "") {
                return {
                  isRequired: false,
                  necessityIndicator: undefined,
                };
              }

              return {
                isRequired: true,
                necessityIndicator: value as "icon" | "label",
              };
            },
          },
          {
            key: "isInvalid",
            type: "boolean",
            label: "Invalid",
            icon: AlertTriangle,
          },

          {
            key: "isDisabled",
            type: "boolean",
            label: "Disabled",
            icon: PointerOff,
          },
          {
            key: "allowsRemoving",
            type: "boolean",
            label: "Allows Removing",
            icon: Trash,
            defaultValue: true,
          },
          {
            key: "allowsCustomValue",
            type: "boolean",
            label: "Allows Custom Value",
            icon: PenOff,
          },
        ],
      },
      {
        title: "Tag Management",
        fields: [
          // ADR-097 Phase 1: children-manager → items-manager 전환.
          //   ADR-076 ListBox 선례 동일 패턴. Tag element tree → TagGroup.props.items[]
          //   로 이관 (Phase 2 migrateCollectionItems orchestrator).
          {
            key: "items",
            type: "items-manager",
            label: "Tags",
            itemsKey: "items",
            itemTypeName: "Tag",
            defaultItem: {
              id: "", // runtime에서 crypto.randomUUID() 주입
              label: "New Tag",
              isDisabled: false,
            },
            itemSchema: [
              { key: "label", type: "string", label: "Label" },
              { key: "isDisabled", type: "boolean", label: "Disabled" },
              {
                key: "allowsRemoving",
                type: "boolean",
                label: "Allows Removing",
              },
            ],
            labelKey: "label",
            allowNested: false,
          },
        ],
      },
    ],
  },

  variants: {
    default: {
      // ADR-912 단계 4 C2 (2026-06-03): 정본 table 추종 — 컨테이너 fill base→transparent +
      //   `border` 제거. `.react-aria-TagGroup` 컨테이너는 transparent(skipCSSGeneration:true,
      //   수동 CSS transparent) — 배경/border 는 Tag 자식 칩(별도 Tag spec: fill `{color.layer-1}`
      //   + border)이 담당. buildCatalogShapes 가 컨테이너에 불투명 `{color.layer-2}`+border 를
      //   그리면 legacy `[]` 불일치(kill: "TagGroup 배경+border 추가"). accent/neutral/negative 유지.
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
          base: "{color.accent-subtle}" as TokenRef,
          hover: "{color.accent-subtle}" as TokenRef,
          pressed: "{color.accent-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.accent}" as TokenRef,
    },
    neutral: {
      fill: {
        default: {
          base: "{color.neutral-subtle}" as TokenRef,
          hover: "{color.neutral-subtle}" as TokenRef,
          pressed: "{color.neutral-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.neutral-subtle}" as TokenRef,
    },
    negative: {
      fill: {
        default: {
          base: "{color.negative-subtle}" as TokenRef,
          hover: "{color.negative-subtle}" as TokenRef,
          pressed: "{color.negative-subtle}" as TokenRef,
        },
      },
      text: "{color.neutral}" as TokenRef,
      border: "{color.negative}" as TokenRef,
    },
  },

  sizes: {
    sm: {
      height: 24,
      paddingX: 8,
      paddingY: 2,
      fontSize: "{typography.text-xs}" as TokenRef,
      borderRadius: "{radius.sm}" as TokenRef,
      gap: 6,
    },
    md: {
      height: 32,
      paddingX: 12,
      paddingY: 4,
      fontSize: "{typography.text-sm}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 8,
    },
    lg: {
      height: 40,
      paddingX: 16,
      paddingY: 6,
      fontSize: "{typography.text-base}" as TokenRef,
      borderRadius: "{radius.md}" as TokenRef,
      gap: 10,
    },
  },

  states: {
    hover: {},
    disabled: {
      opacity: 0.38,
      pointerEvents: "none",
    },
    focusVisible: {
      focusRing: "{focus.ring.default}",
    },
  },

  // ADR-912 collection sub-part cutover (2026-06-15): TagListSpec childSpecs 제거.
  //   TagList 는 catalog cutover(isCatalogSkiaCutover true) → BASE_TAG_SPEC_MAP 자동 등록
  //   (childSpecs 경유) 불요. getSpecForTag("TagList") undefined 라도 cutover 게이트가
  //   spec-free Skia 렌더 보장. DOM 은 수동 TagGroup.css(.tag-list-wrapper) 가 담당.
  //   ListBoxItem/GridListItem 동형(ADR-912 collection item leaf cutover). propagation
  //   rules 의 childPath:"TagList" string 은 유지(자식 size/allowsRemoving 전파 — spec 객체 아님).

  propagation: {
    rules: [
      { parentProp: "size", childPath: "Tag", override: true },
      { parentProp: "size", childPath: "TagList", override: true },
      // override: true 필수 (ADR-912 영역 B (A) Tag cutover, 2026-06-12): override 없으면
      //   TagList/Tag 에 allowsRemoving 이 한 번 true 로 전파된 뒤 TagGroup 을 false 로 바꿔도
      //   propagationEngine 이 "자식 명시값 우선"(buildSpecNodeData:372 `!override && childProp!==undefined`)
      //   으로 skip → TagList 가 stale true 유지 → Skia 가 remove X 를 계속 그림(토글 무반응).
      //   size 동형으로 항상 부모 최신값 덮어쓰기.
      { parentProp: "allowsRemoving", childPath: "Tag", override: true },
      { parentProp: "allowsRemoving", childPath: "TagList", override: true },
      { parentProp: "size", childPath: "Label", override: true },
      {
        parentProp: "label",
        childPath: "Label",
        childProp: "children",
        override: true,
      },
      // ADR-097 Phase 4A: items/variant → TagList 전파.
      //   TagList spec shapes 가 items 기반 chip self-render 시 필요.
      //   ListBox 는 self-contained 이지만 TagGroup 은 TagList 중간 컨테이너 유지 →
      //   props 전파 경유로 TagList Skia node 좌표계에서 chip 렌더.
      { parentProp: "items", childPath: "TagList", override: true },
      { parentProp: "variant", childPath: "TagList", override: true },
      // ADR-097 Phase 4A: maxRows → TagList 전파.
      //   TagList spec shapes / calculateContentHeight 모두 props.maxRows 를 소비하여
      //   wrap 시뮬레이션 시 "Show all" chip + 행 수 제한을 적용. 전파 누락 시
      //   TagGroup 에서 maxRows 를 편집해도 Skia/layout 모두 무반응.
      { parentProp: "maxRows", childPath: "TagList", override: true },
      // ADR-912 영역 B (A): selectedKeys/selectionMode → TagList 전파.
      //   chip projection(appendTagRowProjection)이 owner=TagList scene node 에 붙으므로,
      //   chip 의 _isSelected(isListBoxRowSelected) 가 TagList.props.selectedKeys 를 읽는다.
      //   selection 은 TagGroup.props 에만 저장되므로 propagation 으로 TagList 좌표계에 전달
      //   (items/variant/maxRows 와 동일 패턴). 누락 시 Skia chip selection 시각 무반응.
      { parentProp: "selectedKeys", childPath: "TagList", override: true },
      { parentProp: "selectionMode", childPath: "TagList", override: true },
    ],
  },

  render: {
    /**
     * ADR-097 Phase 4A — TagGroup 은 shell 역할로 시각 없음.
     *
     * CSS 구조: TagGroup (column) → Label (자식 element) + TagList (자식 element).
     *   Label 은 자식 Label element 가 spec 기반 독립 렌더.
     *   TagList 는 items propagation 수신 후 spec shapes 로 chip self-render
     *   (TagList.spec.ts 참조, ListBox 선례 대칭).
     *
     * 이전 `_tagItems` legacy 분기는 ElementSprite 주입 경로 부재로 dead code
     *   였으며 ADR-097 Phase 4A 에서 제거. Propagation 경유 TagList 렌더로 일원화.
     */
    shapes: (): Shape[] => [],

    react: (props) => ({
      role: "group",
      "aria-label": props.label,
    }),

    pixi: () => ({
      eventMode: "static" as const,
    }),
  },
};
