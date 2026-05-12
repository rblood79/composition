import type { CompositionDocument } from "@composition/shared";
import { Element } from "../../types/core/store.types";
import {
  ComponentCreationResult,
  ComponentCreationContext,
  ComponentCreator,
  ComponentDefinition,
} from "./types";
import {
  createElementsFromDefinition,
  addElementsToStore,
} from "./utils/elementCreation";
import { ElementUtils } from "../../utils/element/elementUtils";

// 컴포넌트 정의 임포트
import {
  createTextFieldDefinition,
  createTextAreaDefinition,
  createFormDefinition,
  createToastDefinition,
  createToolbarDefinition,
  createNumberFieldDefinition,
  createSearchFieldDefinition,
  createSliderDefinition,
} from "./definitions/FormComponents";
import {
  createSelectDefinition,
  createComboBoxDefinition,
  createListBoxDefinition,
  createGridListDefinition,
  createListDefinition,
} from "./definitions/SelectionComponents";
import {
  createGroupDefinition,
  createToggleButtonGroupDefinition,
  createSwitcherDefinition,
  createCheckboxGroupDefinition,
  createRadioGroupDefinition,
  createCheckboxDefinition,
  createRadioDefinition,
  createSwitchDefinition,
  createTagGroupDefinition,
  createBreadcrumbsDefinition,
} from "./definitions/GroupComponents";
import {
  createCardDefinition,
  createTabsDefinition,
  createTreeDefinition,
} from "./definitions/LayoutComponents";
import {
  createDialogDefinition,
  createPopoverDefinition,
  createTooltipDefinition,
} from "./definitions/OverlayComponents";
import {
  createMenuDefinition,
  createNavDefinition,
  createPaginationDefinition,
  createDisclosureDefinition,
  createDisclosureGroupDefinition,
} from "./definitions/NavigationComponents";
import { createTable, createColumnGroup } from "./definitions/TableComponents";
import {
  createDataTableDefinition,
  createSlotDefinition,
} from "./definitions/DataComponents";
import {
  createDatePickerDefinition,
  createDateRangePickerDefinition,
  createCalendarDefinition,
  createColorPickerDefinition,
  createDateFieldDefinition,
  createTimeFieldDefinition,
  createColorFieldDefinition,
  createColorSwatchPickerDefinition,
} from "./definitions/DateColorComponents";
import {
  createAvatarDefinition,
  createAvatarGroupDefinition,
  createStatusLightDefinition,
  createInlineAlertDefinition,
  createButtonGroupDefinition,
  createAccordionDefinition,
  createProgressBarDefinition,
  createMeterDefinition,
  createProgressCircleDefinition,
  createImageDefinition,
  createRangeCalendarDefinition,
  createIllustratedMessageDefinition,
  createCardViewDefinition,
  createTableViewDefinition,
} from "./definitions/DisplayComponents";

/**
 * 통합 컴포넌트 팩토리
 * - 모든 복합 컴포넌트 생성을 관리
 * - 공통 로직 추출로 중복 코드 제거
 */
export class ComponentFactory {
  /**
   * 컴포넌트 생성자 맵
   */
  private static creators: Record<string, ComponentCreator> = {
    TextField: ComponentFactory.createTextField,
    TextArea: ComponentFactory.createTextArea,
    // ⭐ Form Components
    Form: ComponentFactory.createForm,
    Toast: ComponentFactory.createToast,
    Toolbar: ComponentFactory.createToolbar,
    NumberField: ComponentFactory.createNumberField,
    SearchField: ComponentFactory.createSearchField,
    Group: ComponentFactory.createGroup,
    ToggleButtonGroup: ComponentFactory.createToggleButtonGroup,
    Switcher: ComponentFactory.createSwitcher,
    CheckboxGroup: ComponentFactory.createCheckboxGroup,
    RadioGroup: ComponentFactory.createRadioGroup,
    Checkbox: ComponentFactory.createCheckbox,
    Radio: ComponentFactory.createRadio,
    Switch: ComponentFactory.createSwitch,
    Select: ComponentFactory.createSelect,
    ComboBox: ComponentFactory.createComboBox,
    Slider: ComponentFactory.createSlider,
    Card: ComponentFactory.createCard,
    Tabs: ComponentFactory.createTabs,
    Tree: ComponentFactory.createTree,
    TagGroup: ComponentFactory.createTagGroup,
    Breadcrumbs: ComponentFactory.createBreadcrumbs,
    ListBox: ComponentFactory.createListBox,
    GridList: ComponentFactory.createGridList,
    List: ComponentFactory.createList,
    Table: ComponentFactory.createTable,
    // ⭐ Navigation Components
    Menu: ComponentFactory.createMenu,
    Nav: ComponentFactory.createNav,
    Navigation: ComponentFactory.createNav,
    Pagination: ComponentFactory.createPagination,
    Disclosure: ComponentFactory.createDisclosure,
    DisclosureGroup: ComponentFactory.createDisclosureGroup,
    // ⭐ Overlay Components
    Dialog: ComponentFactory.createDialog,
    Popover: ComponentFactory.createPopover,
    Tooltip: ComponentFactory.createTooltip,
    // ⭐ Data Components
    DataTable: ComponentFactory.createDataTable,
    Slot: ComponentFactory.createSlot,
    // ⭐ Date & Color Components
    DatePicker: ComponentFactory.createDatePicker,
    DateRangePicker: ComponentFactory.createDateRangePicker,
    Calendar: ComponentFactory.createCalendar,
    ColorPicker: ComponentFactory.createColorPicker,
    DateField: ComponentFactory.createDateField,
    TimeField: ComponentFactory.createTimeField,
    ColorField: ComponentFactory.createColorField,
    ColorSwatchPicker: ComponentFactory.createColorSwatchPicker,
    // ⭐ Display Components (Phase 1)
    Avatar: ComponentFactory.createAvatar,
    AvatarGroup: ComponentFactory.createAvatarGroup,
    StatusLight: ComponentFactory.createStatusLight,
    InlineAlert: ComponentFactory.createInlineAlert,
    // ⭐ Display Components (Phase 2)
    ButtonGroup: ComponentFactory.createButtonGroup,
    Accordion: ComponentFactory.createAccordion,
    // ⭐ Display Components (Phase 3)
    ProgressBar: ComponentFactory.createProgressBar,
    Meter: ComponentFactory.createMeter,
    ProgressCircle: ComponentFactory.createProgressCircle,
    Image: ComponentFactory.createImage,
    RangeCalendar: ComponentFactory.createRangeCalendar,
    // ⭐ Display Components (Phase 4)
    IllustratedMessage: ComponentFactory.createIllustratedMessage,
    CardView: ComponentFactory.createCardView,
    TableView: ComponentFactory.createTableView,
  };

  /**
   * 복합 컴포넌트 생성 (메인 메서드)
   * @param layoutId - reusable frame 편집 컨텍스트 id
   * @param doc - Canonical CompositionDocument (ADR-903 P3-E E-6: layout body 변환 용)
   */
  static async createComplexComponent(
    type: string,
    parentElement: Element | null,
    pageId: string,
    elements: Element[],
    layoutId: string | null | undefined,
    doc: CompositionDocument,
  ): Promise<ComponentCreationResult> {
    const creator = this.creators[type];
    if (!creator) {
      throw new Error(`No creator found for component type: ${type}`);
    }

    const context: ComponentCreationContext = {
      parentElement,
      pageId,
      elements,
      layoutId,
      doc,
    };

    return await creator.call(this, context);
  }

  /**
   * 공통 컴포넌트 생성 로직
   * reusable frame context 우선, 없으면 page context 사용
   */
  private static async createComponent(
    definitionCreator: (
      context: ComponentCreationContext,
    ) => ComponentDefinition,
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    const { parentElement, pageId, elements, layoutId, doc } = context;
    let parentId = parentElement?.id || null;

    // parent_id가 없으면 현재 page/frame body 요소를 parent로 설정
    if (!parentId) {
      parentId = ElementUtils.findBodyByContext(
        elements,
        pageId || null,
        layoutId || null,
        doc,
      );
      // body element를 찾아서 context 업데이트
      const bodyElement = elements.find((el) => el.id === parentId);
      if (bodyElement) {
        context = { ...context, parentElement: bodyElement };
      }
    }

    // 1. 컴포넌트 정의 생성
    const definition = definitionCreator(context);

    // 2. Element 데이터 생성 (ADR-111: page/frame ownership 명시 주입)
    const { parent, children } = createElementsFromDefinition(definition, {
      pageId: pageId || null,
      layoutId,
    });

    // 3. 스토어에 추가 (IndexedDB persistence via addElement)
    addElementsToStore(parent, children);

    return {
      parent,
      children,
      allElements: [parent, ...children],
    };
  }

  // ==================== 각 컴포넌트 생성 메서드 ====================

  private static async createTextField(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createTextFieldDefinition, context);
  }

  private static async createTextArea(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createTextAreaDefinition, context);
  }

  // ==================== Form Components ====================

  private static async createForm(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createFormDefinition, context);
  }

  private static async createToast(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createToastDefinition, context);
  }

  private static async createToolbar(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createToolbarDefinition, context);
  }

  private static async createNumberField(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createNumberFieldDefinition, context);
  }

  private static async createSearchField(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createSearchFieldDefinition, context);
  }

  private static async createGroup(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createGroupDefinition, context);
  }

  private static async createToggleButtonGroup(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createToggleButtonGroupDefinition, context);
  }

  private static async createSwitcher(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createSwitcherDefinition, context);
  }

  private static async createCheckboxGroup(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createCheckboxGroupDefinition, context);
  }

  private static async createRadioGroup(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createRadioGroupDefinition, context);
  }

  private static async createCheckbox(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createCheckboxDefinition, context);
  }

  private static async createRadio(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createRadioDefinition, context);
  }

  private static async createSwitch(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createSwitchDefinition, context);
  }

  private static async createSelect(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createSelectDefinition, context);
  }

  private static async createComboBox(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createComboBoxDefinition, context);
  }

  private static async createSlider(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createSliderDefinition, context);
  }

  private static async createCard(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createCardDefinition, context);
  }

  private static async createTabs(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createTabsDefinition, context);
  }

  private static async createTree(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createTreeDefinition, context);
  }

  private static async createTagGroup(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createTagGroupDefinition, context);
  }

  private static async createBreadcrumbs(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createBreadcrumbsDefinition, context);
  }

  private static async createListBox(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createListBoxDefinition, context);
  }

  private static async createGridList(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createGridListDefinition, context);
  }

  private static async createList(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createListDefinition, context);
  }

  // ==================== Navigation Components ====================

  private static async createMenu(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createMenuDefinition, context);
  }

  private static async createNav(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createNavDefinition, context);
  }

  private static async createPagination(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createPaginationDefinition, context);
  }

  private static async createDisclosure(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createDisclosureDefinition, context);
  }

  private static async createDisclosureGroup(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createDisclosureGroupDefinition, context);
  }

  // ==================== Overlay Components ====================

  private static async createDialog(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createDialogDefinition, context);
  }

  private static async createPopover(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createPopoverDefinition, context);
  }

  private static async createTooltip(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createTooltipDefinition, context);
  }

  // ==================== Data Components ====================

  /**
   * DataTable 컴포넌트 (비시각적, 데이터 관리용)
   */
  private static async createDataTable(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createDataTableDefinition, context);
  }

  /**
   * Slot 컴포넌트 (Layout 전용, Page 콘텐츠 삽입 위치)
   */
  private static async createSlot(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createSlotDefinition, context);
  }

  // ==================== Date & Color Components ====================

  private static async createDatePicker(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createDatePickerDefinition, context);
  }

  private static async createDateRangePicker(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createDateRangePickerDefinition, context);
  }

  private static async createCalendar(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createCalendarDefinition, context);
  }

  private static async createColorPicker(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createColorPickerDefinition, context);
  }

  private static async createDateField(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createDateFieldDefinition, context);
  }

  private static async createTimeField(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createTimeFieldDefinition, context);
  }

  private static async createColorField(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createColorFieldDefinition, context);
  }

  private static async createColorSwatchPicker(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createColorSwatchPickerDefinition, context);
  }

  // ==================== Display Components (Phase 1) ====================

  private static async createAvatar(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createAvatarDefinition, context);
  }

  private static async createAvatarGroup(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createAvatarGroupDefinition, context);
  }

  private static async createStatusLight(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createStatusLightDefinition, context);
  }

  private static async createInlineAlert(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createInlineAlertDefinition, context);
  }

  // ==================== Display Components (Phase 2) ====================

  private static async createButtonGroup(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createButtonGroupDefinition, context);
  }

  private static async createAccordion(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createAccordionDefinition, context);
  }

  // ==================== Display Components (Phase 3) ====================

  private static async createProgressBar(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createProgressBarDefinition, context);
  }

  private static async createMeter(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createMeterDefinition, context);
  }

  private static async createProgressCircle(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createProgressCircleDefinition, context);
  }

  private static async createImage(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createImageDefinition, context);
  }

  private static async createRangeCalendar(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createRangeCalendarDefinition, context);
  }

  // ==================== Display Components (Phase 4) ====================

  private static async createIllustratedMessage(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createIllustratedMessageDefinition, context);
  }

  private static async createCardView(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createCardViewDefinition, context);
  }

  private static async createTableView(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return this.createComponent(createTableViewDefinition, context);
  }

  // ==================== Table Components ====================

  /**
   * Table 컴포넌트 (특수 처리)
   */
  private static async createTable(
    context: ComponentCreationContext,
  ): Promise<ComponentCreationResult> {
    return await createTable(context);
  }

  /**
   * ColumnGroup 생성 (공개 메서드)
   */
  static async createColumnGroup(
    parentElement: Element | null,
    pageId: string,
    elements: Element[] = [],
  ): Promise<ComponentCreationResult> {
    const context: ComponentCreationContext = {
      parentElement,
      pageId,
      elements,
    };
    return await createColumnGroup(context);
  }
}
