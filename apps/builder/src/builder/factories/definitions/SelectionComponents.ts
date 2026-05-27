import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentDefinition, ComponentCreationContext } from "../types";
import type {
  StoredSelectItem,
  StoredComboBoxItem,
  StoredListBoxItem,
  StoredGridListItem,
} from "@composition/specs";

/**
 * Select 컴포넌트 정의 (ADR-073 P6)
 *
 * items prop 으로 SelectItem 데이터를 직렬화 가능한 StoredSelectItem[] 형태로 관리.
 * SelectItem 자식 element는 더 이상 생성하지 않는다.
 * Label / SelectTrigger (SelectValue + SelectIcon) sub-element 는 유지.
 */
export function createSelectDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  const items: StoredSelectItem[] = [
    { id: crypto.randomUUID(), label: "Aardvark", value: "aardvark" },
    { id: crypto.randomUUID(), label: "Cat", value: "cat" },
    { id: crypto.randomUUID(), label: "Dog", value: "dog" },
    { id: crypto.randomUUID(), label: "Kangaroo", value: "kangaroo" },
  ];

  return {
    type: "Select",
    parent: {
      type: "Select",
      props: {
        label: "Select",
        name: "",
        placeholder: "Choose an option...",
        selectedKey: undefined,
        labelPosition: "top",
        isDisabled: false,
        isInvalid: false,
        isReadOnly: false,
        isRequired: false,
        items,
        style: {
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Select",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "SelectTrigger",
        props: {
          style: {
            width: "100%",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "SelectValue",
            props: {
              placeholder: "Choose an option...",
              style: { flex: 1 },
            } as ComponentElementProps,
          },
          {
            type: "SelectIcon",
            props: {
              children: "",
              style: { width: 18, height: 18, flexShrink: 0 },
            } as ComponentElementProps,
          },
        ],
      },
    ],
  };
}

/**
 * ComboBox 컴포넌트 정의 (ADR-073 P6)
 *
 * items prop 으로 ComboBoxItem 데이터를 직렬화 가능한 StoredComboBoxItem[] 형태로 관리.
 * ComboBoxItem 자식 element는 더 이상 생성하지 않는다.
 * Label / ComboBoxWrapper (ComboBoxInput + ComboBoxTrigger) sub-element 는 유지.
 */
export function createComboBoxDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  const items: StoredComboBoxItem[] = [
    { id: crypto.randomUUID(), label: "Aardvark", value: "aardvark" },
    { id: crypto.randomUUID(), label: "Cat", value: "cat" },
    { id: crypto.randomUUID(), label: "Dog", value: "dog" },
    { id: crypto.randomUUID(), label: "Kangaroo", value: "kangaroo" },
  ];

  return {
    type: "ComboBox",
    parent: {
      type: "ComboBox",
      props: {
        label: "Combo Box",
        name: "",
        placeholder: "Type or select...",
        inputValue: "",
        allowsCustomValue: true,
        selectedKey: undefined,
        labelPosition: "top",
        isDisabled: false,
        isInvalid: false,
        isReadOnly: false,
        isRequired: false,
        items,
        style: {
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Label",
        props: {
          children: "Combo Box",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "ComboBoxWrapper",
        props: {
          style: {
            width: "100%",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "ComboBoxInput",
            props: {
              children: "",
              placeholder: "Type or select...",
              style: { flex: 1 },
            } as ComponentElementProps,
          },
          {
            type: "ComboBoxTrigger",
            props: {
              children: "",
              style: { width: 18, height: 18, flexShrink: 0 },
            } as ComponentElementProps,
          },
        ],
      },
    ],
  };
}

/**
 * ListBox 컴포넌트 정의 (ADR-076 P6 → ADR-145 Phase A)
 *
 * items prop 으로 ListBoxItem 데이터를 직렬화 가능한 StoredListBoxItem[] 형태로 관리.
 *
 * ADR-145 Phase A: ListBoxItem template element 1개 자동 자식 생성.
 *   - template element 는 row 시각 SSOT — Phase B 에서 `ListBoxSpec.render.shapes` 가
 *     template style 우선 소비. props.items 는 data row 만 제공.
 *   - canonical descendants[path] override 로 template style 사용자 수정 가능.
 *   - reusable master 등록 시 template 도 canonical 메커니즘으로 자동 흡수.
 *
 * 템플릿 모드(columnMapping/PropertyDataBinding + Field 자식) 는 별도 워크플로 —
 * APICollectionEditor 등이 명시적으로 ListBoxItem + Field 자식을 생성.
 */
export function createListBoxDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  const items: StoredListBoxItem[] = [
    {
      id: crypto.randomUUID(),
      label: "Aardvark",
      value: "aardvark",
      description: "A nocturnal burrowing mammal",
    },
    {
      id: crypto.randomUUID(),
      label: "Cat",
      value: "cat",
      description: "A small domesticated carnivore",
    },
    {
      id: crypto.randomUUID(),
      label: "Kangaroo",
      value: "kangaroo",
      description: "A large marsupial native to Australia",
    },
  ];

  return {
    type: "ListBox",
    parent: {
      type: "ListBox",
      props: {
        orientation: "vertical",
        selectionMode: "single",
        items,
        // ADR-079 P3: 중복 주입 해체 — display/flex-direction/gap/padding 은 Spec SSOT.
        //   Style Panel = useLayoutAuxiliary hook read-through (P2)
        //   Preview CSS = generated/ListBox.css (Generator)
        //   Canvas Skia = implicitStyles.listbox 분기 (layout engine 전용 경로)
        //   factory 는 사용자 커스터마이징 기본값 (width) 만 보유.
        style: {
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    // ADR-145 Phase A: ListBoxItem template child 1개 자동 생성.
    //   Phase B 의 spec render.shapes 가 본 template element 의 style 을 소비하여
    //   props.items data 와 결합 paint. 사용자가 descendants override 로 padding/lineHeight 등을
    //   조정하면 row 전체에 반영됨.
    //   `display: none` — template element 는 시각 style 의 메타데이터 carrier (Layers Panel
    //   에서 선택/편집 가능) 일 뿐, ListBox 의 자체 layout 영향에서 제외 (`calculateContentHeight`
    //   line 1484 `display === "none" → return 0`). 시각은 부모 ListBox `render.shapes` 가
    //   `_listBoxItemTemplateStyle` 로 받아 row 단위 paint.
    children: [
      {
        type: "ListBoxItem",
        props: {
          // template element — 시각 style 정의만 담당, label/value 는 props.items 에서 공급
          style: { display: "none" },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * GridList 컴포넌트 정의
 *
 * ADR-099 Phase 5: 신규 GridList 는 `props.items` canonical 경로를 기본 사용한다.
 * legacy GridListItem child template 경로는 기존 프로젝트 호환용으로만 유지된다.
 */
export function createGridListDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  const items: StoredGridListItem[] = [
    {
      id: crypto.randomUUID(),
      label: "Desert Sunset",
      textValue: "Desert Sunset",
      description: "PNG • 2/3/2024",
    },
    {
      id: crypto.randomUUID(),
      label: "Hiking Trail",
      textValue: "Hiking Trail",
      description: "JPEG • 1/10/2022",
    },
    {
      id: crypto.randomUUID(),
      label: "Mountain Sunrise",
      textValue: "Mountain Sunrise",
      description: "PNG • 3/15/2015",
    },
  ];

  return {
    type: "GridList",
    parent: {
      type: "GridList",
      props: {
        layout: "stack",
        columns: 2,
        selectionMode: "none",
        items,
        style: {
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [],
  };
}

/**
 * List 컴포넌트 정의
 */
export function createListDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "List",
    parent: {
      type: "List",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 4,
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "ListItem",
        props: {
          children: "Item 1",
        } as ComponentElementProps,
      },
      {
        type: "ListItem",
        props: {
          children: "Item 2",
        } as ComponentElementProps,
      },
      {
        type: "ListItem",
        props: {
          children: "Item 3",
        } as ComponentElementProps,
      },
    ],
  };
}
