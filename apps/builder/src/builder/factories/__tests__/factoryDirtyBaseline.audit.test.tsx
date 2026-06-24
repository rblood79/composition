// @vitest-environment jsdom
/**
 * Factory 생성 트리 ↔ Style Panel dirty baseline 정합 전수 회귀 가드 (2026-06-24 결정론적 전수조사).
 *
 * 실제 `createXxxDefinition`(ComponentFactory 가 palette 생성에 호출하는 진짜 source)을 호출해 생성
 * 트리(parent+children) 전 노드를 dirty resolver(`useHasDirtyStyles`)에 통과시켜, Style Panel 4섹션이
 * 검사하는 prop 에서 **false dirty(신규 요소인데 reset 버튼 활성)가 0건**임을 보장한다.
 *
 * Why: 컴포넌트마다 생성 source 가 2개다 — (1) `createXxxDefinition`(factories/definitions, 실제
 * palette 생성) vs (2) `createDefaultXxxProps`(getDefaultProps, dirty baseline). 둘이 어긋나면 신규
 * 요소가 dirty 로 오판된다(예: Image/Toast borderRadius 가 definition 에만 잔존 → false dirty). 본
 * 가드는 definition(실제 생성값)을 currentStyle 로, resolver baseline 을 그대로 써서 둘의 정합을 강제.
 *
 * Group D(Table 패밀리: Table/TableHeader/TableBody/TableView/Row/Column/Cell/ColumnGroup)는 별도
 * 작업 축으로 본 가드에서 제외(CREATORS 미포함).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStore } from "../../stores";
import {
  useHasDirtyStyles,
  PANEL_STYLE_PROPS,
} from "../../panels/styles/hooks/useResetStyles";
import { createElementsFromDefinition } from "../utils/elementCreation";
import type { ComponentElementProps } from "../../../types/builder/unified.types";
import type { Element } from "../../../types/core/store.types";
import type { ComponentDefinition, ComponentCreationContext } from "../types";

import {
  createCardDefinition,
  createTabsDefinition,
  createTreeDefinition,
} from "../definitions/LayoutComponents";
import {
  createTextFieldDefinition,
  createTextAreaDefinition,
  createNumberFieldDefinition,
  createSearchFieldDefinition,
  createSliderDefinition,
  createToastDefinition,
} from "../definitions/FormComponents";
import {
  createCardViewDefinition,
  createIllustratedMessageDefinition,
  createImageDefinition,
  createProgressBarDefinition,
  createMeterDefinition,
  createProgressCircleDefinition,
  createStatusLightDefinition,
  createInlineAlertDefinition,
  createAvatarGroupDefinition,
  createButtonGroupDefinition,
} from "../definitions/DisplayComponents";
import {
  createFrameLayoutDefinition,
  createCheckboxDefinition,
  createRadioDefinition,
  createSwitchDefinition,
  createCheckboxGroupDefinition,
  createRadioGroupDefinition,
  createTagGroupDefinition,
  createBreadcrumbsDefinition,
} from "../definitions/GroupComponents";
import {
  createSelectDefinition,
  createComboBoxDefinition,
  createListBoxDefinition,
  createGridListDefinition,
} from "../definitions/SelectionComponents";
import {
  createDialogDefinition,
  createPopoverDefinition,
  createTooltipDefinition,
} from "../definitions/OverlayComponents";
import {
  createDateFieldDefinition,
  createTimeFieldDefinition,
  createDatePickerDefinition,
  createDateRangePickerDefinition,
  createColorFieldDefinition,
  createColorPickerDefinition,
  createColorSwatchPickerDefinition,
} from "../definitions/DateColorComponents";
import {
  createDisclosureDefinition,
  createDisclosureGroupDefinition,
  createMenuDefinition,
  createNavDefinition,
  createPaginationDefinition,
} from "../definitions/NavigationComponents";

type Creator = (ctx: ComponentCreationContext) => ComponentDefinition;

const CREATORS: Record<string, Creator> = {
  Card: createCardDefinition,
  Tabs: createTabsDefinition,
  Tree: createTreeDefinition,
  TextField: createTextFieldDefinition,
  TextArea: createTextAreaDefinition,
  NumberField: createNumberFieldDefinition,
  SearchField: createSearchFieldDefinition,
  Slider: createSliderDefinition,
  Toast: createToastDefinition,
  CardView: createCardViewDefinition,
  IllustratedMessage: createIllustratedMessageDefinition,
  Image: createImageDefinition,
  ProgressBar: createProgressBarDefinition,
  Meter: createMeterDefinition,
  ProgressCircle: createProgressCircleDefinition,
  StatusLight: createStatusLightDefinition,
  InlineAlert: createInlineAlertDefinition,
  AvatarGroup: createAvatarGroupDefinition,
  ButtonGroup: createButtonGroupDefinition,
  frame: createFrameLayoutDefinition,
  Checkbox: createCheckboxDefinition,
  Radio: createRadioDefinition,
  Switch: createSwitchDefinition,
  CheckboxGroup: createCheckboxGroupDefinition,
  RadioGroup: createRadioGroupDefinition,
  TagGroup: createTagGroupDefinition,
  Breadcrumbs: createBreadcrumbsDefinition,
  Select: createSelectDefinition,
  ComboBox: createComboBoxDefinition,
  ListBox: createListBoxDefinition,
  GridList: createGridListDefinition,
  Dialog: createDialogDefinition,
  Popover: createPopoverDefinition,
  Tooltip: createTooltipDefinition,
  DateField: createDateFieldDefinition,
  TimeField: createTimeFieldDefinition,
  DatePicker: createDatePickerDefinition,
  DateRangePicker: createDateRangePickerDefinition,
  ColorField: createColorFieldDefinition,
  ColorPicker: createColorPickerDefinition,
  ColorSwatchPicker: createColorSwatchPickerDefinition,
  Disclosure: createDisclosureDefinition,
  DisclosureGroup: createDisclosureGroupDefinition,
  Menu: createMenuDefinition,
  Nav: createNavDefinition,
  Pagination: createPaginationDefinition,
};

// Style Panel 4섹션(Transform/Typography/Layout/Appearance)이 reset/modify 로 검사하는 prop 합집합.
//   SSOT 단일 출처(useResetStyles.PANEL_STYLE_PROPS) 재사용 — grid placement 등 패널 미편집 키 제외.
const PANEL_PROPS = PANEL_STYLE_PROPS;

// type:"ref"(RefNode instance template anchor — ListBox/GridList origin 참조)는 Style Panel 에서
//   transform 을 편집하는 일반 컴포넌트가 아니라 instance 노드라 dirty 검사 대상 외(제외).
const NON_SELECTABLE_TYPES = new Set(["ref"]);

const originalState = useStore.getState();

function measureNode(tree: Element[], node: Element): string[] {
  const style = (node.props?.style as Record<string, unknown>) || {};
  const keys = Object.keys(style).filter((k) =>
    (PANEL_PROPS as readonly string[]).includes(k),
  );
  if (keys.length === 0) return [];

  const map = new Map<string, Element>();
  for (const n of tree) map.set(n.id, n);

  useStore.setState({
    selectedElementId: node.id,
    selectedElementProps: node.props as ComponentElementProps,
    currentPageId: null,
    elements: tree,
    elementsMap: map,
    childrenMap: new Map(),
    dirtyElementIds: new Set(),
    layoutVersion: 0,
  });

  const dirtyKeys: string[] = [];
  for (const key of keys) {
    const { result } = renderHook(() => useHasDirtyStyles([key]));
    if (result.current === true) {
      dirtyKeys.push(`${key}=${JSON.stringify(style[key])}`);
    }
  }
  return dirtyKeys;
}

describe("factory 생성 트리 ↔ dirty baseline 정합 (false dirty 0)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useStore.setState(originalState, true);
  });

  it.each(Object.keys(CREATORS))(
    "%s 신규 생성 트리는 false dirty 0건",
    (type) => {
      useStore.setState({
        selectedElementId: null,
        selectedElementProps: null as unknown as ComponentElementProps,
        currentPageId: null,
        elements: [],
        elementsMap: new Map(),
        childrenMap: new Map(),
        dirtyElementIds: new Set(),
        layoutVersion: 0,
      });

      const def = CREATORS[type]({
        parentElement: null,
        pageId: null,
        elements: [],
      } as unknown as ComponentCreationContext);
      const { parent, children } = createElementsFromDefinition(def, {
        pageId: null,
        layoutId: null,
      });

      const tree = [parent, ...children];
      const dirty: string[] = [];
      for (const node of tree) {
        if (NON_SELECTABLE_TYPES.has(node.type)) continue;
        const parentNode = node.parent_id
          ? tree.find((n) => n.id === node.parent_id)
          : undefined;
        const label = `${node.type}${parentNode ? ` (<${parentNode.type})` : ""}`;
        const dirtyKeys = measureNode(tree, node);
        if (dirtyKeys.length > 0) {
          dirty.push(`${label} → ${dirtyKeys.join(", ")}`);
        }
      }

      expect(
        dirty,
        `${type} 생성 트리 false dirty:\n  ${dirty.join("\n  ")}`,
      ).toEqual([]);
    },
  );
});
