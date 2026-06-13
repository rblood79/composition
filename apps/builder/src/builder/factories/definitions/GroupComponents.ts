import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentDefinition, ComponentCreationContext } from "../types";
import type { StoredTagItem, StoredBreadcrumbItem } from "@composition/specs";

/**
 * Frame layout container 정의 (ADR-130 Phase 2).
 *
 * 이전 이름: `createGroupDefinition` — RAC ARIA `Group` (D1) 와 canonical layout
 * `frame` (D3) 의 분리 의도를 명확히 하기 위해 rename.
 *
 * @see docs/adr/130-layer3-canonical-vocabulary-alignment.md §3 Phase 2
 */
export function createFrameLayoutDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "frame",
    parent: {
      type: "frame",
      props: {
        label: "Frame",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 0,
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

// ADR-912 Switcher cleanup — createSwitcherDefinition 제거.
// Switcher(@pixi/ui 세그먼트 컨트롤)는 RAC ToggleButtonGroup(selectionMode="single") 중복 →
// createToggleButtonGroupDefinition 이 대체. 과거 직렬화 Switcher 노드는 hydration 시
// ToggleButtonGroup 으로 변환(adapters/canonical/tagRename.ts).

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
    // ADR-912 collection sub-part cutover (2026-06-14): CheckboxItems 중간 element 폐기.
    //   react-aria-starter CheckboxGroup 원본 구조 채택 — 부모가 자식 Checkbox 를 직접
    //   보유하고, DOM wrapper `<div className="checkbox-items">` 는 renderCheckboxGroup 이
    //   self-compose (starter `<div className="checkbox-items">{children}` 와 동일).
    //   기존 3단(CheckboxGroup>CheckboxItems>Checkbox) 직렬화 프로젝트는 hydration
    //   migration(migrateCheckboxRadioItemsStructure)이 2단으로 자동 승격.
    children: [
      {
        type: "Label",
        props: {
          children: "Checkbox Group",
          style: {
            width: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
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
                fontWeight: 600,
              },
            } as ComponentElementProps,
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
    // ADR-912 collection sub-part cutover (2026-06-14): RadioItems 중간 element 폐기.
    //   react-aria-starter RadioGroup 원본 구조 채택 — 부모가 자식 Radio 를 직접 보유하고,
    //   DOM wrapper `<div className="radio-items">` 는 renderRadioGroup 이 self-compose.
    //   기존 3단(RadioGroup>RadioItems>Radio) 직렬화 프로젝트는 hydration migration 으로 승격.
    children: [
      {
        type: "Label",
        props: {
          children: "Radio Group",
          style: {
            width: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
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
              },
            } as ComponentElementProps,
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

  // ADR-912 영역 B (A): children-manager → items-manager 전환 (TagGroup 선례 동형).
  //   기존 factory 3 Breadcrumb element 배열 → 3 StoredBreadcrumbItem 으로 축소.
  //   crumb 시각은 appendBreadcrumbRowProjection 이 Breadcrumbs.props.items 를 직접 읽어
  //   crumb projection 노드를 전개(중간 컨테이너 없음 — Breadcrumbs→Breadcrumb 1단 직접).
  //   마지막 item 은 href 없음(현재 페이지) — Breadcrumb.spec._isLast 강조 + separator 미생성.
  const items: StoredBreadcrumbItem[] = [
    { id: crypto.randomUUID(), label: "Home", href: "/" },
    { id: crypto.randomUUID(), label: "Category", href: "/category" },
    { id: crypto.randomUUID(), label: "Page" },
  ];

  return {
    type: "Breadcrumbs",
    parent: {
      type: "Breadcrumbs",
      props: {
        "aria-label": "Breadcrumbs",
        size: "M",
        isDisabled: false,
        items,
      } as ComponentElementProps,
      parent_id: parentId,
    },
    // ADR-912 영역 B (A): Breadcrumb element 자식 생성 중단 (items projection 으로 대체).
    children: [],
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
