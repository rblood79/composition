import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentDefinition, ComponentCreationContext } from "../types";
import type { StoredTagItem } from "@composition/specs";

/**
 * Group 컴포넌트 정의 (Element Grouping Container)
 * Phase 4: Grouping & Organization
 */
export function createGroupDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "Group",
    parent: {
      type: "Group",
      props: {
        label: "Element Group",
        style: {
          display: "block",
          position: "relative",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [],
  };
}

/**
 * ToggleButtonGroup 컴포넌트 정의
 */
export function createToggleButtonGroupDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "ToggleButtonGroup",
    parent: {
      type: "ToggleButtonGroup",
      props: {
        type: "ToggleButtonGroup",
        size: "md",
        orientation: "horizontal",
        selectionMode: "single",
        value: [],
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "ToggleButton",
        props: {
          children: "Toggle 1",
          isSelected: false,
          isDisabled: false,
        } as ComponentElementProps,
      },
      {
        type: "ToggleButton",
        props: {
          children: "Toggle 2",
          isSelected: false,
          isDisabled: false,
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Switcher 컴포넌트 정의 (탭형 전환)
 *
 * CSS DOM 구조:
 * Switcher (parent, type="Switcher", flex row)
 *   ├─ ToggleButton (type="ToggleButton", children="Tab 1", transparent bg)
 *   └─ ToggleButton (type="ToggleButton", children="Tab 2", transparent bg)
 */
export function createSwitcherDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Switcher",
    parent: {
      type: "Switcher",
      props: {
        items: ["Tab 1", "Tab 2"],
        activeIndex: 0,
        isDisabled: false,
        style: {
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          width: 240,
          height: 40,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "ToggleButton",
        props: {
          children: "Tab 1",
          isSelected: true,
          isDisabled: false,
          style: {
            flex: 1,
            backgroundColor: "transparent",
            textAlign: "center",
          },
        } as ComponentElementProps,
      },
      {
        type: "ToggleButton",
        props: {
          children: "Tab 2",
          isSelected: false,
          isDisabled: false,
          style: {
            flex: 1,
            backgroundColor: "transparent",
            textAlign: "center",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * CheckboxGroup 컴포넌트 정의
 */
export function createCheckboxGroupDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "CheckboxGroup",
    parent: {
      type: "CheckboxGroup",
      props: {
        type: "CheckboxGroup",
        label: "Checkbox Group",
        name: "",
        labelPosition: "top",
        orientation: "vertical",
        value: [],
        isInvalid: false,
        isDisabled: false,
        isReadOnly: false,
        isRequired: false,
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Checkbox Group",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "CheckboxItems",
        props: {} as ComponentElementProps,
        children: [
          {
            type: "Checkbox",
            props: {
              children: "Option 1",
              isSelected: false,
              isDisabled: false,
            } as ComponentElementProps,
            children: [
              {
                type: "Label",
                props: {
                  children: "Option 1",
                  style: {
                    width: "fit-content",
                    height: "fit-content",
                    fontWeight: 600,
                  },
                } as ComponentElementProps,
              },
            ],
          },
          {
            type: "Checkbox",
            props: {
              children: "Option 2",
              isSelected: false,
              isDisabled: false,
            } as ComponentElementProps,
            children: [
              {
                type: "Label",
                props: {
                  children: "Option 2",
                  style: {
                    width: "fit-content",
                    height: "fit-content",
                    fontWeight: 600,
                  },
                } as ComponentElementProps,
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * RadioGroup 컴포넌트 정의
 */
export function createRadioGroupDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "RadioGroup",
    parent: {
      type: "RadioGroup",
      props: {
        label: "Radio Group",
        name: "",
        labelPosition: "top",
        orientation: "vertical",
        value: "",
        isInvalid: false,
        isReadOnly: false,
        isRequired: false,
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Radio Group",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "RadioItems",
        props: {} as ComponentElementProps,
        children: [
          {
            type: "Radio",
            props: {
              children: "Option 1",
              value: "option1",
              isDisabled: false,
            } as ComponentElementProps,
            children: [
              {
                type: "Label",
                props: {
                  children: "Option 1",
                  style: {
                    width: "fit-content",
                    height: "fit-content",
                  },
                } as ComponentElementProps,
              },
            ],
          },
          {
            type: "Radio",
            props: {
              children: "Option 2",
              value: "option2",
              isDisabled: false,
            } as ComponentElementProps,
            children: [
              {
                type: "Label",
                props: {
                  children: "Option 2",
                  style: {
                    width: "fit-content",
                    height: "fit-content",
                  },
                } as ComponentElementProps,
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * TagGroup 컴포넌트 정의 (ADR-097 Addendum 1)
 *
 * items SSOT 전환 완결 — 신규 TagGroup 생성 시 즉시 `props.items: StoredTagItem[]`
 * 로 정적 데이터 주입 (ListBox `createListBoxDefinition` 선례 대칭).
 *
 * 이전 (Addendum 전): Tag element 18 개를 TagList 자식으로 생성 → migration
 *   orchestrator 가 프로젝트 로드 시 items[] 로 흡수하는 **점진 이관** 경로 의존.
 * 현재 (Addendum 후): factory 시점부터 items SSOT. TagList 는 element tree 중간
 *   컨테이너로 유지 (ADR-093/097 Decision Option A 준수, TagListSpec
 *   containerStyles + spec shapes items self-render).
 */
export function createTagGroupDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  // ADR-097 Addendum 1: 신규 TagGroup 의 기본 Tag items (ListBox 3 샘플 패턴 대칭).
  //   기존 factory 18 개 Tag element 배열 → 4 개 items 로 축소.
  const items: StoredTagItem[] = [
    { id: crypto.randomUUID(), label: "Chocolate" },
    { id: crypto.randomUUID(), label: "Mint" },
    { id: crypto.randomUUID(), label: "Strawberry" },
    { id: crypto.randomUUID(), label: "Vanilla" },
  ];

  // 웹 CSS 구조: TagGroup (column) → Label + TagList (row wrap) — Tag elements 없음.
  //   Tag 시각은 TagListSpec shapes 가 items 기반 chip self-render (ADR-097 Phase 4A/4B).
  return {
    type: "TagGroup",
    parent: {
      type: "TagGroup",
      props: {
        label: "Tag Group",
        size: "md",
        labelPosition: "top",
        maxRows: 2,
        allowsRemoving: false,
        selectionMode: "multiple",
        items,
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Tag Group",
          style: {
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "TagList",
        props: {} as ComponentElementProps,
        // ADR-097 Addendum 1: Tag element 자식 생성 중단.
        //   TagList 는 중간 컨테이너로 유지되지만 Tag 시각은 TagListSpec shapes 가
        //   부모 TagGroup.items propagation 경유 chip self-render.
        children: [],
      },
    ],
  };
}

/**
 * Breadcrumbs 컴포넌트 정의
 */
export function createBreadcrumbsDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Breadcrumbs",
    parent: {
      type: "Breadcrumbs",
      props: {
        "aria-label": "Breadcrumbs",
        size: "M",
        isDisabled: false,
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Breadcrumb",
        props: {
          children: "Home",
          href: "/",
        } as ComponentElementProps,
      },
      {
        type: "Breadcrumb",
        props: {
          children: "Category",
          href: "/category",
        } as ComponentElementProps,
      },
      {
        type: "Breadcrumb",
        props: {
          children: "Page",
          href: "/category/page",
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Checkbox 복합 컴포넌트 정의
 *
 * CSS DOM 구조:
 * Checkbox (parent, type="Checkbox", flex row, alignItems center)
 *   └─ Label (type="Label", children="Checkbox")
 */
export function createCheckboxDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "Checkbox",
    parent: {
      type: "Checkbox",
      props: {
        children: "Checkbox",
        name: "",
        value: "",
        isSelected: false,
        isDisabled: false,
        isIndeterminate: false,
        isInvalid: false,
        isReadOnly: false,
        isRequired: false,
        style: {},
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Checkbox",
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Radio 복합 컴포넌트 정의
 *
 * CSS DOM 구조:
 * Radio (parent, type="Radio", flex row, alignItems center)
 *   └─ Label (type="Label", children="Radio")
 */
export function createRadioDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "Radio",
    parent: {
      type: "Radio",
      props: {
        children: "Radio",
        value: "radio",
        isSelected: false,
        isDisabled: false,
        style: {},
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Radio",
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Switch 복합 컴포넌트 정의
 *
 * CSS DOM 구조:
 * Switch (parent, type="Switch", flex row, alignItems center)
 *   └─ Label (type="Label", children="Switch")
 */
export function createSwitchDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "Switch",
    parent: {
      type: "Switch",
      props: {
        children: "Switch",
        name: "",
        isSelected: false,
        isDisabled: false,
        isReadOnly: false,
        style: {},
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Switch",
        } as ComponentElementProps,
      },
    ],
  };
}
