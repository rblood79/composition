import { ComponentElementProps } from "../../../types/core/store.types";
import { ComponentDefinition, ComponentCreationContext } from "../types";
import { LISTBOX_ORIGIN_ID } from "../../components/listbox/listBoxTemplateOrigins";
import { GRIDLIST_ORIGIN_ID } from "../../components/gridlist/gridListTemplateOrigins";
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
        // ADR-913 후속 fix (2026-06-30): inline display/flexDirection 제거 — labelPosition="side"
        //   차단 근본. inline flexDirection:column 은 (a) CSS specificity(1-0-0)가 generated CSS
        //   `[data-label-position="side"]`(@layer components)를 이겨 side selector 무력화 (b) Skia
        //   getSideLabelParentStyle 의 `...rawParentStyle` 마지막 spread 로 row 를 column 으로 덮음.
        //   NumberField/DateField(inline 에 display/flexDir 없음)가 정상이던 패턴으로 통일 — top 모드
        //   기본 column 은 catalog composition.layout:flex-column + Skia specFallback(select/combobox
        //   분기 effectiveParent, implicitStyles ~1440)이 담당. ("Skia 찌부러짐" 옛 주석은 ADR-912
        //   Phase 3-A-3a 로 specFallback=catalog base 처리되며 stale.)
        //   gap=6 / width:100% catalog(sizes.md.gap=6) 정본 (2026-06-23 전수 정정).
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
        // ADR-913 후속 fix (2026-06-30): inline display/flexDirection 제거 (Select 동형) —
        //   labelPosition="side" 차단 근본. catalog composition.layout:flex-column + Skia
        //   specFallback(combobox 분기, implicitStyles ~1440)이 base column 담당.
        //   gap=6 catalog(sizes.md.gap=6) 정본 (2026-06-23 전수 정정).
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
        //
        //   maxHeight/overflow 는 예외로 real props.style 에 둔다: catalog
        //   containerStyles(maxHeight:300px/overflow:auto)는 layout(resolveContainerStylesFallback)
        //   + 패널만 소비하고, 스크롤 발화(collectionVirtualization 가상화 window resolver) /
        //   휠(useScrollWheelInteraction) / scrollbar·clip shape(buildSpecNodeData)는 전부 raw
        //   props.style.overflow·maxHeight 를 읽는다. 두 값이 raw style 에 없으면 가상화가
        //   unbounded(auto-height) 로 판정 → 행이 300px 를 넘어도 clamp/스크롤 없이 넘쳐 보인다
        //   (사용자 보고 2026-07-22 "overflow:auto 인데 visible 처럼"). 시스템 페이지 body 에
        //   real overflow:auto 를 부여한 선례(20ac5e60d)와 동일 판단 — real style 1곳이 4 raw
        //   소비자를 동시 충족(catalog 일반화 대비 blast radius 최소).
        style: {
          width: "100%",
          maxHeight: "300px",
          overflow: "auto",
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
      // ADR-161 Phase 2: standalone → ref (ListBox :249-250 동형). 기존 inline props
      //   (layout/columns/selectionMode/items/style)는 ref override 채널로 이전 —
      //   master(component-gridlist) 기본값을 인스턴스가 상속하되 여기서 override.
      type: "ref",
      ref: GRIDLIST_ORIGIN_ID,
      componentName: "GridList",
      props: {
        // 2026-07-29: 기본값 stack → grid. 이 값은 **instance override** 라 master
        //   (`gridListTemplateOrigins`) 를 바꾸는 것만으로는 안 바뀐다 — 둘 다 옮긴다.
        layout: "grid",
        columns: 2,
        selectionMode: "none",
        items,
        style: {
          width: "100%",
        },
      } as ComponentElementProps,
      parent_id: parentId,
    } as ComponentDefinition["parent"] & {
      componentName: string;
      ref: string;
    },
    // Option B (anchor-less): in-tree template anchor 미주입 — panel-add 와 origin
    //   copy-paste 가 동일 bare ref 구조. data-bound 행 template 은 projection 이
    //   component 정의 origin slot 에서 해석 (Phase 3/4). 기존 anchor 보유 instance 는
    //   legacyGridListTemplateMigration(hydration, Phase 5)가 strip 한다.
    children: [],
  };
}
