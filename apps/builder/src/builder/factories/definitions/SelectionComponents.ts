import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentDefinition, ComponentCreationContext } from "../types";
import { LISTBOX_ORIGIN_ID } from "../../components/listbox/listBoxTemplateOrigins";
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
        // ADR-912 R1 후속 fix (2026-06-12): SelectTrigger.spec 삭제로 끊긴 column flex
        //   layout 을 factory props.style 에 명시 — Skia/Taffy 는 props.style 만 읽고
        //   layout 엔진은 rule table 을 import 하지 않으므로(ADR-907 Layer B), 누락 시
        //   buildNodeStyle/getElementDisplay 가 display:"block" 으로 떨어져 Skia 찌부러짐.
        //   DOM 은 generated CSS(.react-aria-Select)가 동일 값 제공 → 시각 대칭.
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 4,
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
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "SelectTrigger",
        props: {
          // ADR-912 R1 후속 fix: SelectTrigger.spec.containerStyles
          //   (display:flex/flexDirection:row/alignItems:center) 소멸분을 factory 로 이관.
          //   height 는 미주입 — implicitStyles selecttrigger 분기의 rule fallback 이
          //   size delegation 따라 주입(고정 시 size 변경 미반영).
          style: {
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          },
        } as ComponentElementProps,
        children: [
          {
            type: "SelectValue",
            props: {
              placeholder: "Choose an option...",
              style: { flex: 1, textAlign: "left" },
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
 * Label / SelectTrigger (SelectValue + SelectIcon) sub-element 는 유지.
 * (ADR-912 R1 2026-06-12: ComboBoxWrapper/Input/Trigger synthetic type 을 Select family
 *  공용 type 으로 retype — BUILDER_ALIAS_MAP 해체. Select factory 와 동일 자식 구조.)
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
        // ADR-912 R1 후속 fix (2026-06-12): column flex layout factory 명시 (Select 동형).
        style: {
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 4,
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
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "SelectTrigger",
        props: {
          // ADR-912 R1 후속 fix: row flex layout factory 명시 (Select 동형).
          style: {
            width: "100%",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          },
        } as ComponentElementProps,
        children: [
          {
            type: "SelectValue",
            props: {
              children: "",
              placeholder: "Type or select...",
              style: { flex: 1, textAlign: "left" },
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
 * ListBox 컴포넌트 정의 (ADR-076 P6 → ADR-145 Phase A → ADR-146 Phase 2)
 *
 * items prop 으로 ListBoxItem 데이터를 직렬화 가능한 StoredListBoxItem[] 형태로 관리.
 *
 * ADR-146 Phase 2: local hidden template child 대신 Components page 의
 * `ListBoxItem/Default` origin 을 참조하는 locked ref template anchor 를 생성.
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
      type: "ref",
      ref: LISTBOX_ORIGIN_ID,
      componentName: "ListBox",
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
    } as ComponentDefinition["parent"] & {
      componentName: string;
      ref: string;
    },
    // Option B (anchor-less): in-tree template anchor 를 주입하지 않는다.
    //   panel-add 와 origin copy-paste 가 동일한 bare ref 구조 + layer 트리를 갖는다.
    //   data-bound 행 template 은 projection 이 component 정의의 origin slot 에서 해석한다
    //   (canvasSceneNode.resolveListBoxTemplateOriginId). 기존 anchor 보유 instance 는
    //   migrateLegacyListBoxTemplatesToOrigins(hydration)가 strip 한다.
    children: [],
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
