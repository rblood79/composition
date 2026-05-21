import { ComponentElementProps } from "../../../types/core/store.types";
import type { Element } from "../../../types/core/store.types";
import { withFrameElementMirrorId } from "../../../adapters/canonical/frameMirror";
import { ElementUtils } from "../../../utils/element/elementUtils";
import { ComponentDefinition, ComponentCreationContext } from "../types";
import type {
  StoredSelectItem,
  StoredComboBoxItem,
  StoredListBoxItem,
  StoredGridListItem,
} from "@composition/specs";

/**
 * ADR-144 Phase 7 G6 — collection composite factory helpers.
 *
 * Tabs 의 `createTabsCompositeElements` (LayoutComponents.ts) 와 동일한
 * reusable origin + ref/descendants/slot 패턴을 4 family
 * (Select / ComboBox / ListBox / Menu) 에 적용한다. legacy
 * `createSelectDefinition` 등 `props.items[]` factory 는 adapter fallback 으로
 * 유지하며, 새 creation path 는 canonical resolved-tree authoring SSOT 를
 * 생성한다 (Hard Constraint 1 — `CompositionDocument` schema 변경 없음).
 *
 * 공통 payload (Tabs slice 와 대등):
 *   1. `{kind}-item-origin` (reusable master, leaf label) + 자식 label text
 *   2. `{kind}-origin` (reusable master, `slot: [item-origin]`) +
 *      3 ref instance children (descendants 로 label override)
 *   3. `{kind}-instance` (page 에 배치되는 ref instance)
 */

export interface CollectionCompositeElementOptions {
  parentId: string | null;
  idFactory?: () => string;
  now?: () => string;
}

interface CollectionCompositeIds {
  itemOrigin: string;
  itemLabel: string;
  containerOrigin: string;
  refOne: string;
  refTwo: string;
  refThree: string;
  instance: string;
}

interface CollectionCompositeBlueprint {
  /** canonical type for the item leaf master (e.g. "ListBoxItem", "MenuItem"). */
  itemType: string;
  /** canonical type for the collection container (e.g. "ListBox", "Menu"). */
  containerType: string;
  /** name shown in Layers / Inspector for the container origin. */
  containerName: string;
  /** name shown for the item origin master. */
  itemName: string;
  /** default text propagated to the leaf label master. */
  defaultLabel: string;
  /** three labels written into ref-instance descendants. */
  refLabels: [string, string, string];
  /** ARIA / RAC contract props applied to both origin and instance roots. */
  containerProps: ComponentElementProps;
}

function createCollectionCompositeIds(
  idFactory: () => string,
): CollectionCompositeIds {
  return {
    itemOrigin: idFactory(),
    itemLabel: idFactory(),
    containerOrigin: idFactory(),
    refOne: idFactory(),
    refTwo: idFactory(),
    refThree: idFactory(),
    instance: idFactory(),
  };
}

function createCollectionCompositeElements(
  context: ComponentCreationContext,
  options: CollectionCompositeElementOptions,
  blueprint: CollectionCompositeBlueprint,
): { parent: Element; children: Element[] } {
  const idFactory = options.idFactory ?? ElementUtils.generateId;
  const now = options.now ?? (() => new Date().toISOString());
  const ids = createCollectionCompositeIds(idFactory);
  const pageId = context.pageId || null;
  const layoutId = context.layoutId ?? null;
  const timestamp = now();

  const makeElement = (
    id: string,
    type: string,
    props: ComponentElementProps,
    patch: Partial<Element> = {},
  ): Element =>
    withFrameElementMirrorId(
      {
        id,
        type,
        props,
        page_id: patch.page_id ?? null,
        parent_id: patch.parent_id ?? null,
        created_at: timestamp,
        updated_at: timestamp,
        ...patch,
      },
      layoutId,
    );

  const itemOrigin = makeElement(
    ids.itemOrigin,
    blueprint.itemType,
    {} as ComponentElementProps,
    {
      name: blueprint.itemName,
      reusable: true,
      componentRole: "master",
      componentName: blueprint.itemName,
    },
  );
  const itemLabel = makeElement(
    ids.itemLabel,
    "Text",
    { text: blueprint.defaultLabel } as ComponentElementProps,
    { parent_id: ids.itemOrigin, name: "label" },
  );

  const containerOrigin = makeElement(
    ids.containerOrigin,
    blueprint.containerType,
    blueprint.containerProps,
    {
      name: blueprint.containerName,
      reusable: true,
      componentRole: "master",
      componentName: blueprint.containerName,
      slot: [ids.itemOrigin],
    },
  );

  const refIds: Array<{ id: string; label: string }> = [
    { id: ids.refOne, label: blueprint.refLabels[0] },
    { id: ids.refTwo, label: blueprint.refLabels[1] },
    { id: ids.refThree, label: blueprint.refLabels[2] },
  ];
  const refInstances = refIds.map((entry) =>
    makeElement(entry.id, blueprint.itemType, {} as ComponentElementProps, {
      parent_id: ids.containerOrigin,
      ref: ids.itemOrigin,
      componentRole: "instance",
      masterId: ids.itemOrigin,
      descendants: {
        [ids.itemLabel]: { text: entry.label },
      },
    }),
  );

  const instance = makeElement(
    ids.instance,
    blueprint.containerType,
    blueprint.containerProps,
    {
      parent_id: options.parentId,
      page_id: pageId,
      ref: ids.containerOrigin,
      componentRole: "instance",
      masterId: ids.containerOrigin,
    },
  );

  return {
    parent: instance,
    children: [itemOrigin, itemLabel, containerOrigin, ...refInstances],
  };
}

export function createSelectCompositeElements(
  context: ComponentCreationContext,
  options: CollectionCompositeElementOptions,
): { parent: Element; children: Element[] } {
  return createCollectionCompositeElements(context, options, {
    itemType: "SelectItem",
    containerType: "Select",
    containerName: "Select",
    itemName: "SelectItem",
    defaultLabel: "Option",
    refLabels: ["Aardvark", "Cat", "Kangaroo"],
    containerProps: {
      "aria-label": "Select",
      label: "Select",
      placeholder: "Choose an option...",
      labelPosition: "top",
      style: { width: "100%" },
    } as ComponentElementProps,
  });
}

export function createComboBoxCompositeElements(
  context: ComponentCreationContext,
  options: CollectionCompositeElementOptions,
): { parent: Element; children: Element[] } {
  return createCollectionCompositeElements(context, options, {
    itemType: "ComboBoxItem",
    containerType: "ComboBox",
    containerName: "ComboBox",
    itemName: "ComboBoxItem",
    defaultLabel: "Option",
    refLabels: ["Aardvark", "Cat", "Kangaroo"],
    containerProps: {
      "aria-label": "Combo Box",
      label: "Combo Box",
      placeholder: "Type or select...",
      allowsCustomValue: true,
      labelPosition: "top",
      style: { width: "100%" },
    } as ComponentElementProps,
  });
}

export function createListBoxCompositeElements(
  context: ComponentCreationContext,
  options: CollectionCompositeElementOptions,
): { parent: Element; children: Element[] } {
  return createCollectionCompositeElements(context, options, {
    itemType: "ListBoxItem",
    containerType: "ListBox",
    containerName: "ListBox",
    itemName: "ListBoxItem",
    defaultLabel: "Item",
    refLabels: ["Aardvark", "Cat", "Kangaroo"],
    containerProps: {
      "aria-label": "ListBox",
      orientation: "vertical",
      selectionMode: "single",
      style: { width: "100%" },
    } as ComponentElementProps,
  });
}

export function createMenuCompositeElements(
  context: ComponentCreationContext,
  options: CollectionCompositeElementOptions,
): { parent: Element; children: Element[] } {
  return createCollectionCompositeElements(context, options, {
    itemType: "MenuItem",
    containerType: "Menu",
    containerName: "Menu",
    itemName: "MenuItem",
    defaultLabel: "Item",
    refLabels: ["Profile", "Billing", "Settings"],
    containerProps: {
      "aria-label": "Menu",
      variant: "primary",
      size: "md",
      selectionMode: "none",
      style: { width: "fit-content", display: "block" },
    } as ComponentElementProps,
  });
}

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
 * ListBox 컴포넌트 정의 (ADR-076 P6)
 *
 * items prop 으로 ListBoxItem 데이터를 직렬화 가능한 StoredListBoxItem[] 형태로 관리.
 * 정적 모드 ListBoxItem 자식 element 는 더 이상 생성하지 않는다 (부모 단위 원자성).
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
