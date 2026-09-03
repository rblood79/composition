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
  const { parentElement } = context;
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
          // 글자 크기는 parent rule 의 delegation hint 가 정본 (D3 SSOT — catalog). 인라인 12 는
          //   TextField/TextArea 의 DOM 값 (14) 과 갈렸다 (r2 feh1, 2026-09-03).
          style: {
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
  const { parentElement } = context;
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
          // 글자 크기는 parent rule 의 delegation hint 가 정본 (D3 SSOT — catalog). 인라인 12 는
          //   TextField/TextArea 의 DOM 값 (14) 과 갈렸다 (r2 feh1, 2026-09-03).
          style: {
            display: "none",
          },
        } as ComponentElementProps,
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
  const { parentElement } = context;
  const parentId = parentElement?.id || null;

  // ⭐ Layout/Slot System

  return {
    type: "Toast",
    parent: {
      type: "Toast",
      props: {
        // 2026-06-24: borderRadius "8px" (factory inline) 제거 — catalog 토큰(radius.md=6) 정본 정합.
        //   createDefaultToastProps(baseline)는 선행 정정에서 제거됐으나 실제 palette 생성 경로인 본
        //   definition(ComponentFactory.createToast 가 호출)에 잔존하여 Skia(8) ≠ CSS Preview(6) 발산 +
        //   Style Panel false dirty 였다. padding "12px 16px"(비대칭)·gap "4px" 는 catalog 정합(유지).
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          padding: "12px 16px",
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
          // 2026-06-24: inline fontSize → size prop 전환 (catalog 토큰 정합). size="sm" → catalog
          //   Heading.sizes.sm fontSize 14(text-sm). fontWeight 600 inline 은 유지 — CSS 는
          //   variant.textWeight 를 emit 안 하는 Skia-only 채널이라(CSSGenerator size.fontWeight 만
          //   emit), inline 제거 시 DOM <h3> 브라우저 기본 700 ↔ Skia(catalog textWeight 600) 발산.
          //   inline 600 유지로 CSS·Skia 양쪽 600 + dirty baseline(catalog textWeight 600 흡수) 정합.
          size: "sm",
          style: {
            display: "block",
            fontWeight: "600",
          },
        } as ComponentElementProps,
      },
      {
        type: "Description",
        props: {
          children: "Toast message content.",
          // size="lg" → catalog Description.sizes.lg fontSize 14(text-sm) + lineHeight 20.
          //   fontWeight 400 은 DOM 기본(normal)·catalog textWeight 400 일치 → inline 불요.
          size: "lg",
          style: {
            display: "block",
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
 * DOM 구조 (ComboBox 와 동일한 패턴 — ADR-912 R1 2026-06-12 Select family 공용 type retype):
 * NumberField (parent, type="NumberField", display flex column)
 *   ├─ Label (type="Label", children="Number")
 *   ├─ SelectTrigger (type="SelectTrigger", display flex row, bg+border)
 *   │    ├─ SelectValue (type="SelectValue", placeholder="0")
 *   │    ├─ SelectIcon (type="SelectIcon", iconName="minus")
 *   │    └─ SelectIcon (type="SelectIcon", iconName="plus")
 *   └─ FieldError (type="FieldError")
 */
export function createNumberFieldDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement } = context;
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
        // ADR-913 후속 fix (2026-06-19): inline display/flexDirection 제거 — labelPosition="side"
        //   차단 근본. inline flexDirection:column 은 (a) CSS specificity(1-0-0)가 generated CSS
        //   `[data-label-position="side"]`(0-2-0)를 이겨 side selector 무력화 (b) Skia
        //   getSideLabelParentStyle 의 `...rawParentStyle` 마지막 spread 로 row 를 column 으로 덮음.
        //   DateField/TimeField(inline 에 display/flexDir 없음)가 정상이던 패턴으로 통일 — top 모드
        //   기본 column 은 catalog rule(NumberField base archetype) + Skia specFallback 이 담당.
        //   gap=6 catalog(sizes.md.gap=6) 정본 (2026-06-23 전수 정정 — factory gap:4 ≠ CSS gap:6).
        style: {
          width: "100%",
          gap: 6,
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
              placeholder: "0",
              style: {
                display: "block",
                textAlign: "left",
              },
            } as ComponentElementProps,
          },
          {
            type: "SelectIcon",
            props: {
              iconName: "minus",
              slot: "decrement",
            } as ComponentElementProps,
          },
          {
            type: "SelectIcon",
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
          // 글자 크기는 parent rule 의 delegation hint 가 정본 (D3 SSOT — catalog). 인라인 12 는
          //   TextField/TextArea 의 DOM 값 (14) 과 갈렸다 (r2 feh1, 2026-09-03).
          style: {
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
 * CSS DOM 구조 (ADR-912 R1 2026-06-12 Select family 공용 type retype):
 * SearchField (parent, flex column)
 *   ├─ Label (type="Label")
 *   └─ SelectTrigger (type="SelectTrigger", flex row)
 *        ├─ SelectIcon (type="SelectIcon", iconName="search" 🔍)
 *        ├─ SelectValue (type="SelectValue" — 상자 style 은 parent 소유 read-only sub-part)
 *        └─ SelectIcon (type="SelectIcon", iconName="x" ✕)
 */
export function createSearchFieldDefinition(
  context: ComponentCreationContext,
): ComponentDefinition {
  const { parentElement } = context;
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
        // ADR-913 후속 fix (2026-06-19): inline display/flexDirection 제거 — labelPosition="side"
        //   차단 근본 (NumberField 와 동일 — CSS specificity + Skia rawParentStyle spread). top 모드
        //   기본 column 은 catalog rule + Skia specFallback 담당.
        //   gap=8 catalog(sizes.md.gap=8) 정본 (2026-06-23 전수 정정 — factory gap:4 ≠ CSS gap:8).
        style: {
          width: "100%",
          gap: 8,
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
            type: "SelectIcon",
            props: {
              iconName: "search",
              children: "",
              style: { width: 18, height: 18, flexShrink: 0 },
            } as ComponentElementProps,
          },
          {
            type: "SelectValue",
            props: {
              children: "",
              placeholder: "Search...",
            } as ComponentElementProps,
          },
          {
            type: "SelectIcon",
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
  const { parentElement } = context;
  const parentId = parentElement?.id || null;
  const isRange = options?.isRange ?? false;

  // SliderThumb 의 size(지름)·borderRadius 는 implicitStyles + spec.sizes 가 부모
  //   Slider.size 로부터 주입한다. factory 가 width/height 를 baked 하면
  //   patchBatchStyleFromImplicit 의 stale 패치를 유발하므로 빈 props 로 둔다.
  //   (상세: fullTreeLayout.patchBatchStyleFromImplicit 주석)
  const thumbChild = {
    type: "SliderThumb" as const,
    props: {} as ComponentElementProps,
  };
  const thumbChildren = isRange ? [thumbChild, thumbChild] : [thumbChild];

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
        showValueLabel: true,
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
          // 2026-06-24 전수조사 정정: backgroundColor:"transparent" inline 제거. catalog Label
          //   fill.default.base={color.transparent} 가 투명 배경 정본 → inline 은 중복이면서 dirty
          //   baseline(backgroundColor 미보유 → resetValue="") 과 불일치하여 Appearance reset 버튼
          //   false 활성(false dirty). 제거 시 Skia/CSS 투명 배경 동일.
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
