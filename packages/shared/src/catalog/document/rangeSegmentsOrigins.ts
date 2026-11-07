// Shared authored default compositions for the catalog and executable Code View adapters.
import type { LibraryDefinition, LibraryTemplateNode } from "./types";

export const RANGE_SEGMENT_DEFINITIONS: readonly LibraryDefinition[] = [
  {
    id: "lib:definition:origin-component-rangeslider",
    name: "RangeSlider",
    mode: "composite",
    accepts: {
      slot: "slot",
      label: "string",
      value: "numberRange",
    },
    defaults: {
      label: "Range",
      value: {
        start: 25,
        end: 75,
      },
    },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-rangeslider",
  },
  {
    id: "lib:definition:origin-component-segmentedcontrol",
    name: "SegmentedControl",
    mode: "composite",
    accepts: {},
    defaults: {},
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-segmentedcontrol",
  },
  {
    id: "lib:definition:origin-component-segmentedcontrolitem",
    name: "SegmentedControlItem",
    mode: "composite",
    accepts: {
      id: "string",
      label: "string",
      icon: "string",
      isDisabled: "boolean",
    },
    defaults: {
      label: "View",
      isDisabled: false,
    },
    visual: {},
    stateRules: {},
    templateRootId: "lib:template:component-segmentedcontrolitem",
  },
];

export const RANGE_SEGMENT_TEMPLATES: readonly LibraryTemplateNode[] = [
  {
    id: "lib:template:component-rangeslider",
    definitionId: "lib:definition:type-RangeSlider",
    children: [
      "lib:template:component-rangeslider__1",
      "lib:template:component-rangeslider__2",
      "lib:template:component-rangeslider__3",
    ],
    props: {
      label: "{label}",
      value: "{value}",
      minValue: 0,
      maxValue: 100,
      step: 1,
      size: "M",
      labelPosition: "top",
      isDisabled: false,
    },
    visual: {
      width: "100%",
    },
  },
  {
    id: "lib:template:component-rangeslider__1",
    definitionId: "lib:definition:origin-component-label",
    children: [],
    props: {
      children: "{label}",
    },
    presentWhen: "nonEmptyText",
    visual: {},
  },
  {
    id: "lib:template:component-rangeslider__2",
    definitionId: "lib:definition:type-SliderOutput",
    children: [],
    props: {
      size: "M",
    },
    visual: {
      width: "fit-content",
    },
  },
  {
    id: "lib:template:component-rangeslider__3",
    definitionId: "lib:definition:type-SliderTrack",
    children: [
      "lib:template:component-rangeslider__3_2",
      "lib:template:component-rangeslider__3_1",
      "lib:template:component-rangeslider__3_3",
    ],
    props: {
      size: "M",
    },
    visual: {
      width: "100%",
    },
  },
  {
    id: "lib:template:component-rangeslider__3_1",
    definitionId: "lib:definition:type-SliderThumb",
    children: [],
    props: {
      size: "M",
    },
    visual: {},
  },
  {
    id: "lib:template:component-rangeslider__3_2",
    definitionId: "lib:definition:type-SliderFill",
    children: [],
    props: {
      size: "M",
    },
    visual: {},
  },
  {
    id: "lib:template:component-rangeslider__3_3",
    definitionId: "lib:definition:type-SliderThumb",
    children: [],
    props: {
      size: "M",
      index: 1,
    },
    visual: {},
  },
  {
    id: "lib:template:component-segmentedcontrol",
    definitionId: "lib:definition:type-SegmentedControl",
    slot: { name: "Items", required: false },
    children: [
      "lib:template:component-segmentedcontrol__first",
      "lib:template:component-segmentedcontrol__second",
    ],
    props: {},
    visual: {},
  },
  {
    id: "lib:template:component-segmentedcontrol__first",
    definitionId: "lib:definition:origin-component-segmentedcontrolitem",
    children: [],
    props: {
      id: "first",
      label: "List",
    },
    visual: {},
  },
  {
    id: "lib:template:component-segmentedcontrol__first__label",
    definitionId: "lib:definition:text",
    children: [],
    props: {
      children: "{label}",
    },
    visual: {},
  },
  {
    id: "lib:template:component-segmentedcontrol__first__indicator",
    definitionId: "lib:definition:type-SelectionIndicator",
    children: [],
    props: {},
    visual: {},
    showWhen: {
      all: ["isSelected"],
    },
  },
  {
    id: "lib:template:component-segmentedcontrol__second",
    definitionId: "lib:definition:origin-component-segmentedcontrolitem",
    children: [],
    props: {
      id: "second",
      label: "Grid",
    },
    visual: {},
  },
  {
    id: "lib:template:component-segmentedcontrol__first__icon",
    definitionId: "lib:definition:type-Icon",
    children: [],
    props: {
      slot: "icon",
      iconName: "{icon}",
    },
    visual: {},
  },
  {
    id: "lib:template:component-segmentedcontrolitem",
    definitionId: "lib:definition:type-SegmentedControlItem",
    children: [
      "lib:template:component-segmentedcontrol__first__indicator",
      "lib:template:component-segmentedcontrolitem__content",
    ],
    props: {},
    visual: {},
  },
  {
    id: "lib:template:component-segmentedcontrolitem__content",
    definitionId: "lib:definition:type-frame",
    children: [
      "lib:template:component-segmentedcontrol__first__icon",
      "lib:template:component-segmentedcontrol__first__label",
    ],
    props: {},
    layout: { display: "flex", alignItems: "center" },
    visual: { minWidth: 0, gap: 6 },
  },
];
