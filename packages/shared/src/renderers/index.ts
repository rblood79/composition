/**
 * 모든 렌더러를 통합하여 export
 */

import * as FormRenderers from "./FormRenderers";
import * as SelectionRenderers from "./SelectionRenderers";
import * as LayoutRenderers from "./LayoutRenderers";
import * as DateRenderers from "./DateRenderers";
import * as CollectionRenderers from "./CollectionRenderers";
import * as TableRenderer from "./TableRenderer";
import * as DataRenderers from "./DataRenderers";
import * as IconRenderers from "./IconRenderers";
import * as ColorRenderers from "./ColorRenderers";
import type { PreviewElement, RenderContext } from "../types";

/**
 * 태그 이름을 렌더러 함수에 매핑
 */
export const rendererMap: Record<
  string,
  (element: PreviewElement, context: RenderContext) => React.ReactNode
> = {
  // Form 컴포넌트
  Form: FormRenderers.renderForm,
  TextField: FormRenderers.renderTextField,
  NumberField: FormRenderers.renderNumberField,
  SearchField: FormRenderers.renderSearchField,
  Input: FormRenderers.renderInput,
  Label: FormRenderers.renderLabel,
  Description: FormRenderers.renderDescription,
  FieldError: FormRenderers.renderFieldError,
  Checkbox: FormRenderers.renderCheckbox,
  CheckboxGroup: FormRenderers.renderCheckboxGroup,
  Radio: FormRenderers.renderRadio,
  RadioGroup: FormRenderers.renderRadioGroup,
  Switch: FormRenderers.renderSwitch,
  TailSwatch: FormRenderers.renderTailSwatch,
  FileTrigger: FormRenderers.renderFileTrigger,
  DropZone: FormRenderers.renderDropZone,

  // Selection 컴포넌트
  ListBox: SelectionRenderers.renderListBox,
  ListBoxItem: SelectionRenderers.renderListBoxItem,
  GridList: SelectionRenderers.renderGridList,
  GridListItem: SelectionRenderers.renderGridListItem,
  Select: SelectionRenderers.renderSelect,
  ComboBox: SelectionRenderers.renderComboBox,
  Slider: SelectionRenderers.renderSlider,
  Field: SelectionRenderers.renderDataField,

  // Layout 컴포넌트
  Tabs: LayoutRenderers.renderTabs,
  TabList: LayoutRenderers.renderTabList,
  TabPanels: LayoutRenderers.renderTabPanels,
  Card: LayoutRenderers.renderCard,
  Dialog: LayoutRenderers.renderDialog,
  Popover: LayoutRenderers.renderPopover,
  CardHeader: LayoutRenderers.renderCardHeader,
  CardContent: LayoutRenderers.renderCardContent,
  CardPreview: LayoutRenderers.renderCardPreview,
  CardFooter: LayoutRenderers.renderCardFooter,
  Button: LayoutRenderers.renderButton,
  // ADR-058 Phase 1: Text는 Spec 경로로 전환됨. rendererMap 바인딩 제거 →
  // Preview resolveHtmlTag fallback이 getElementForTag("Text") → "p"로 해결.
  Tooltip: LayoutRenderers.renderTooltip,
  ProgressBar: LayoutRenderers.renderProgressBar,
  Meter: LayoutRenderers.renderMeter,
  Separator: LayoutRenderers.renderSeparator,
  Group: LayoutRenderers.renderGroup,
  Modal: LayoutRenderers.renderModal,
  Breadcrumbs: LayoutRenderers.renderBreadcrumbs,
  Breadcrumb: LayoutRenderers.renderBreadcrumb,
  Link: LayoutRenderers.renderLink,
  Badge: LayoutRenderers.renderBadge,
  Slot: LayoutRenderers.renderSlot,
  Toast: LayoutRenderers.renderToast,
  Pagination: LayoutRenderers.renderPagination,
  Skeleton: LayoutRenderers.renderSkeleton,
  // Phase 1: Display/Feedback
  Avatar: LayoutRenderers.renderAvatar,
  AvatarGroup: LayoutRenderers.renderAvatarGroup,
  StatusLight: LayoutRenderers.renderStatusLight,
  // ADR-912 internal 4 slice (2026-06-04): InlineAlert 은 catalog 등록 → generic fallback 경로
  //   (react-aria-InlineAlert + data-variant/data-size + generated CSS + staticAttrs role="alert").
  //   rendererMap 위임을 제거해야 CanonicalNodeRenderer L234 가 가로채지 않고 L248 generic 으로 떨어진다.
  //   renderInlineAlert 함수는 LayoutRenderers 에 보존(다른 호출처 없으면 step 4 에서 정리).
  // Phase 2: Action/Group (ADR-030)
  ButtonGroup: LayoutRenderers.renderButtonGroup,
  Nav: LayoutRenderers.renderNav,
  Navigation: LayoutRenderers.renderNav,
  Disclosure: LayoutRenderers.renderDisclosure,
  DisclosureHeader: LayoutRenderers.renderDisclosureHeader,
  DisclosureContent: LayoutRenderers.renderDisclosureContent,
  DisclosureGroup: LayoutRenderers.renderDisclosureGroup,
  ColorSwatch: LayoutRenderers.renderColorSwatch,
  ColorSwatchPicker: LayoutRenderers.renderColorSwatchPicker,
  // Phase 3: Extended Controls (ADR-030)
  ProgressCircle: LayoutRenderers.renderProgressCircle,
  Image: LayoutRenderers.renderImage,
  RangeCalendar: LayoutRenderers.renderRangeCalendar,
  // Phase 4: Advanced Components (ADR-030)
  IllustratedMessage: LayoutRenderers.renderIllustratedMessage,
  CardView: LayoutRenderers.renderCardView,
  TableView: LayoutRenderers.renderTableView,

  // Date 컴포넌트
  Calendar: DateRenderers.renderCalendar,
  DatePicker: DateRenderers.renderDatePicker,
  DateRangePicker: DateRenderers.renderDateRangePicker,
  DateField: DateRenderers.renderDateField,
  TimeField: DateRenderers.renderTimeField,

  // Collection 컴포넌트
  Tree: CollectionRenderers.renderTree,
  TreeItem: CollectionRenderers.renderTreeItem,
  TagGroup: CollectionRenderers.renderTagGroup,
  Tag: CollectionRenderers.renderTag,
  ToggleButtonGroup: CollectionRenderers.renderToggleButtonGroup,
  ToggleButton: CollectionRenderers.renderToggleButton,
  Menu: CollectionRenderers.renderMenu,
  MenuItem: CollectionRenderers.renderMenuItem,
  Toolbar: CollectionRenderers.renderToolbar,

  // Table 컴포넌트
  Table: TableRenderer.renderTable,
  TableHeader: TableRenderer.renderTableHeader,
  TableBody: TableRenderer.renderTableBody,
  Column: TableRenderer.renderColumn,
  Row: TableRenderer.renderRow,
  Cell: TableRenderer.renderCell,

  // Data 컴포넌트
  DataTable: DataRenderers.renderDataTable,

  // Icon 컴포넌트
  Icon: IconRenderers.renderIcon,

  // Color 컴포넌트
  ColorField: ColorRenderers.renderColorField,
  ColorArea: ColorRenderers.renderColorArea,
  ColorSlider: ColorRenderers.renderColorSlider,
  ColorWheel: ColorRenderers.renderColorWheel,
};

export {
  FormRenderers,
  SelectionRenderers,
  LayoutRenderers,
  DateRenderers,
  CollectionRenderers,
  TableRenderer,
  DataRenderers,
  IconRenderers,
  ColorRenderers,
};
