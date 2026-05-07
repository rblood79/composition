import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentDefinition, ComponentCreationContext } from "../types";

/**
 * TextField 복합 컴포넌트 정의
 *
 * CSS DOM 구조:
 * TextField (parent, type="TextField", display flex column)
 *   ├─ Label (type="Label", children="Text Field")
 *   ├─ Input (type="Input", type="text")
 *   └─ FieldError (type="FieldError")
 */
export function createTextFieldDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "TextField",
    parent: {
      type: "TextField",
      props: {
        label: "Text Field",
        name: "",
        description: "",
        errorMessage: "",
        placeholder: "Enter text...",
        value: "",
        type: "text",
        size: "md",
        labelPosition: "top",
        isRequired: false,
        isDisabled: false,
        isReadOnly: false,
        isInvalid: false,
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
          children: "Text Field",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "Input",
        props: {
          type: "text",
          placeholder: "Enter text...",
          style: {
            width: "100%",
          },
        } as ComponentElementProps,
      },
      {
        type: "FieldError",
        props: {
          children: "",
          style: {
            fontSize: 12,
            display: "none",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * TextArea 복합 컴포넌트 정의
 *
 * CSS DOM 구조:
 * TextArea (parent, type="TextArea", display flex column)
 *   ├─ Label (type="Label", children="Text Area")
 *   ├─ Input (type="Input", height: 80, multiline)
 *   └─ FieldError (type="FieldError")
 */
export function createTextAreaDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "TextArea",
    parent: {
      type: "TextArea",
      props: {
        label: "Text Area",
        name: "",
        description: "",
        errorMessage: "",
        placeholder: "Enter text...",
        value: "",
        rows: 3,
        labelPosition: "top",
        isRequired: false,
        isDisabled: false,
        isReadOnly: false,
        isInvalid: false,
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
          children: "Text Area",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "Input",
        props: {
          type: "text",
          placeholder: "Enter text...",
          style: {
            width: "100%",
            height: 80,
          },
        } as ComponentElementProps,
      },
      {
        type: "FieldError",
        props: {
          children: "",
          style: {
            fontSize: 12,
            display: "none",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Form 컴포넌트 정의 (복합 컴포넌트)
 *
 * CSS DOM 구조:
 * Form (parent, type="Form")
 *   ├─ Heading (type="Heading", children="Form Title")
 *   ├─ Description (type="Description", children="")
 *   ├─ FormField (type="FormField", flex column, gap 4px)
 *   │  ├─ Label (type="Label", children="Field Label")
 *   │  └─ TextField (type="TextField", placeholder "Enter value...")
 *   └─ FormField (type="FormField", flex column, gap 4px)
 *      ├─ Label (type="Label", children="Another Field")
 *      └─ TextField (type="TextField", placeholder "Enter value...")
 *
 * 주의: Form 안의 TextField 자식은 단순 Element로 정의
 * (type만 지정, 내부 구조는 TextField의 Spec이 처리)
 */
export function createFormDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Form",
    parent: {
      type: "Form",
      props: {
        labelPosition: "top",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Heading",
        props: {
          children: "Form Title",
          level: 3,
          style: {
            display: "block",
            fontSize: "18px",
            fontWeight: "600",
          },
        } as ComponentElementProps,
      },
      {
        type: "Description",
        props: {
          children: "",
          style: {
            display: "block",
            fontSize: "14px",
          },
        } as ComponentElementProps,
      },
      {
        type: "FormField",
        props: {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            width: "100%",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "Label",
            props: {
              children: "Field Label",
            } as ComponentElementProps,
          },
          {
            type: "TextField",
            props: {
              label: "Text Field",
              placeholder: "Enter value...",
              value: "",
              type: "text",
              isRequired: false,
              isDisabled: false,
              isReadOnly: false,
            } as ComponentElementProps,
          },
        ],
      },
      {
        type: "FormField",
        props: {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            width: "100%",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "Label",
            props: {
              children: "Another Field",
            } as ComponentElementProps,
          },
          {
            type: "TextField",
            props: {
              label: "Text Field",
              placeholder: "Enter value...",
              value: "",
              type: "text",
              isRequired: false,
              isDisabled: false,
              isReadOnly: false,
            } as ComponentElementProps,
          },
        ],
      },
    ],
  };
}

/**
 * Toast 컴포넌트 정의 (복합 컴포넌트)
 *
 * CSS DOM 구조:
 * Toast (parent, type="Toast")
 *   ├─ Heading (type="Heading", fontSize 14px, fontWeight 600)
 *   └─ Description (type="Description", fontSize 14px)
 */
export function createToastDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Toast",
    parent: {
      type: "Toast",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          padding: "12px 16px",
          borderRadius: "8px",
          width: "fit-content",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Heading",
        props: {
          children: "Toast Title",
          level: 3,
          style: {
            display: "block",
            fontSize: "14px",
            fontWeight: "600",
          },
        } as ComponentElementProps,
      },
      {
        type: "Description",
        props: {
          children: "Toast message content.",
          style: {
            display: "block",
            fontSize: "14px",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * Toolbar 컴포넌트 정의 (복합 컴포넌트)
 *
 * CSS DOM 구조:
 * Toolbar (parent, type="Toolbar")
 *   ├─ Button (type="Button", children="Action 1")
 *   ├─ Button (type="Button", children="Action 2")
 *   ├─ Separator (type="Separator")
 *   └─ Button (type="Button", children="Action 3")
 */
/**
 * NumberField 복합 컴포넌트 정의
 *
 * DOM 구조 (ComboBox 와 동일한 패턴):
 * NumberField (parent, type="NumberField", display flex column)
 *   ├─ Label (type="Label", children="Number")
 *   ├─ ComboBoxWrapper (type="ComboBoxWrapper", display flex row, bg+border)
 *   │    ├─ ComboBoxInput (type="ComboBoxInput", placeholder="0")
 *   │    ├─ ComboBoxTrigger (type="ComboBoxTrigger", iconName="minus")
 *   │    └─ ComboBoxTrigger (type="ComboBoxTrigger", iconName="plus")
 *   └─ FieldError (type="FieldError")
 */
export function createNumberFieldDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "NumberField",
    parent: {
      type: "NumberField",
      props: {
        label: "Number",
        name: "",
        defaultValue: 0,
        minValue: 0,
        maxValue: 100,
        step: 1,
        labelPosition: "top",
        formatOptions: { style: "decimal", notation: "standard" },
        isDisabled: false,
        isInvalid: false,
        isReadOnly: false,
        isRequired: false,
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
          children: "Number",
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
              placeholder: "0",
              style: {
                display: "block",
              },
            } as ComponentElementProps,
          },
          {
            type: "ComboBoxTrigger",
            props: {
              iconName: "minus",
              slot: "decrement",
            } as ComponentElementProps,
          },
          {
            type: "ComboBoxTrigger",
            props: {
              iconName: "plus",
              slot: "increment",
            } as ComponentElementProps,
          },
        ],
      },
      {
        type: "FieldError",
        props: {
          children: "",
          style: {
            fontSize: 12,
            display: "none",
          },
        } as ComponentElementProps,
      },
    ],
  };
}

/**
 * SearchField 복합 컴포넌트 정의
 *
 * CSS DOM 구조:
 * SearchField (parent, type="SearchField")
 *   ├─ Label (type="Label", children="Search")
 *   ├─ Input (type="Input", type="search")
 *   └─ Button (type="Button", children="✕", slot="clear")
 */
/**
 * SearchField 컴포넌트 정의 (ComboBox 동일 패턴)
 *
 * CSS DOM 구조:
 * SearchField (parent, flex column)
 *   ├─ Label (type="Label")
 *   └─ SearchFieldWrapper (type="SearchFieldWrapper", flex row)
 *        ├─ SearchIcon (type="SearchIcon", 🔍)
 *        ├─ SearchInput (type="SearchInput", flex:1)
 *        └─ SearchClearButton (type="SearchClearButton", ✕)
 */
export function createSearchFieldDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  return {
    type: "SearchField",
    parent: {
      type: "SearchField",
      props: {
        label: "Search",
        name: "",
        placeholder: "Search...",
        labelPosition: "top",
        isDisabled: false,
        isInvalid: false,
        isReadOnly: false,
        isRequired: false,
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
          children: "Search",
          style: {
            width: "fit-content",
            height: "fit-content",
            fontWeight: 600,
          },
        } as ComponentElementProps,
      },
      {
        type: "SearchFieldWrapper",
        props: {
          style: {
            width: "100%",
          },
        } as ComponentElementProps,
        children: [
          {
            type: "SearchIcon",
            props: {
              iconName: "search",
              children: "",
              style: { width: 18, height: 18, flexShrink: 0 },
            } as ComponentElementProps,
          },
          {
            type: "SearchInput",
            props: {
              children: "",
              placeholder: "Search...",
              style: { flex: 1 },
            } as ComponentElementProps,
          },
          {
            type: "SearchClearButton",
            props: {
              iconName: "x",
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
 * Slider 복합 컴포넌트 정의
 * React Aria Slider<number | number[]> 패턴 — isRange로 range 모드 전환
 *
 * CSS DOM 구조:
 * Slider (parent, type="Slider", display grid)
 *   ├─ Label (type="Label", grid-area: label)
 *   ├─ SliderOutput (type="SliderOutput", grid-area: output)
 *   └─ SliderTrack (type="SliderTrack", grid-area: track, position relative)
 *        ├─ SliderThumb (type="SliderThumb", border-radius 50%)
 *        └─ SliderThumb (type="SliderThumb", range 모드 시 추가)
 */
export function createSliderDefinition(
  context: ComponentCreationContext,
  options?: { isRange?: boolean },
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;
  const isRange = options?.isRange ?? false;

  const thumbChildren = isRange
    ? [
        {
          type: "SliderThumb" as const,
          props: {
            style: { width: 18, height: 18, borderRadius: "50%" },
          } as ComponentElementProps,
        },
        {
          type: "SliderThumb" as const,
          props: {
            style: { width: 18, height: 18, borderRadius: "50%" },
          } as ComponentElementProps,
        },
      ]
    : [
        {
          type: "SliderThumb" as const,
          props: {
            style: { width: 18, height: 18, borderRadius: "50%" },
          } as ComponentElementProps,
        },
      ];

  return {
    type: "Slider",
    parent: {
      type: "Slider",
      props: {
        label: isRange ? "Range Slider" : "Slider",
        name: "",
        value: isRange ? [20, 80] : 50,
        minValue: 0,
        maxValue: 100,
        step: 1,
        size: "md",
        labelPosition: "top",
        formatOptions: { style: "decimal" },
        isDisabled: false,
        isRequired: false,
        orientation: "horizontal",
        showValue: true,
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
          children: isRange ? "Range Slider" : "Slider",
          style: {
            backgroundColor: "transparent",
          },
        } as ComponentElementProps,
      },
      {
        type: "SliderOutput",
        props: {
          children: isRange ? "20 – 80" : "50",
          style: {
            width: "fit-content",
          },
        } as ComponentElementProps,
      },
      {
        type: "SliderTrack",
        props: {
          style: {
            width: "100%",
          },
        } as ComponentElementProps,
        children: thumbChildren,
      },
    ],
  };
}

export function createToolbarDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement, elements } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Toolbar",
    parent: {
      type: "Toolbar",
      props: {
        "aria-label": "Toolbar",
      } as ComponentElementProps,
      parent_id: parentId,
    },
    children: [
      {
        type: "Button",
        props: {
          children: "Action 1",
          variant: "default",
          size: "sm",
          isDisabled: false,
        } as ComponentElementProps,
      },
      {
        type: "Button",
        props: {
          children: "Action 2",
          variant: "default",
          size: "sm",
          isDisabled: false,
        } as ComponentElementProps,
      },
      {
        type: "Separator",
        props: {
          orientation: "vertical",
          style: {
            width: "1px",
            height: "20px",
          },
        } as ComponentElementProps,
      },
      {
        type: "Button",
        props: {
          children: "Action 3",
          variant: "default",
          size: "sm",
          isDisabled: false,
        } as ComponentElementProps,
      },
    ],
  };
}
