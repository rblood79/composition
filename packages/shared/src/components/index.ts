/**
 * Shared Components Index
 *
 * Export all React Aria-based components for use across apps.
 */

// Foundation CSS only — component CSS is loaded by individual .tsx imports
// (e.g., Button.tsx imports './styles/Button.css')
// This prevents Vite from creating duplicate <style> tags.
import "./styles/foundation.css";

// Form Components
export { Button } from "./Button";
export { ToggleButton } from "./ToggleButton";
export { ToggleButtonGroup } from "./ToggleButtonGroup";
export {
  useToggleButtonGroupEmphasized,
  useToggleButtonGroupIndicator,
} from "./ToggleButtonGroupContext";
export { TextField } from "./TextField";
export { NumberField } from "./NumberField";
export { SearchField } from "./SearchField";
export { Checkbox } from "./Checkbox";
export { CheckboxGroup } from "./CheckboxGroup";
export { Radio } from "./Radio";
export { RadioGroup } from "./RadioGroup";
export { Switch } from "./Switch";
export { Slider } from "./Slider";
export { Select, SelectItem } from "./Select";
export { ComboBox, ComboBoxItem } from "./ComboBox";
export { Autocomplete } from "./Autocomplete";
export { Form } from "./Form";
export {
  Label,
  Text,
  Description,
  FieldError,
  FieldGroup,
  Input,
  DataField,
} from "./Field";
export {
  getNecessityIndicatorSuffix,
  renderNecessityIndicator,
} from "./FieldNecessityIndicator";
export type { NecessityIndicator } from "./FieldNecessityIndicator";
export { FileTrigger } from "./FileTrigger";
export { DropZone } from "./DropZone";

// Date/Time Components
export { DateField } from "./DateField";
export { TimeField } from "./TimeField";
export { DatePicker } from "./DatePicker";
export { DateRangePicker } from "./DateRangePicker";
export { Calendar } from "./Calendar";
export { RangeCalendar } from "./RangeCalendar";

// Color Components
export { ColorArea } from "./ColorArea";
export { ColorField } from "./ColorField";
export { ColorPicker } from "./ColorPicker";
export { ColorSlider } from "./ColorSlider";
export { ColorSwatch } from "./ColorSwatch";
export { ColorSwatchPicker } from "./ColorSwatchPicker";
export { ColorWheel } from "./ColorWheel";

// Collection Components
export { ListBox, ListBoxItem } from "./ListBox";
export { GridList, GridListItem } from "./GridList";
export { MenuButton, MenuItem } from "./Menu";
export { Menu, MenuTrigger, SubmenuTrigger } from "react-aria-components";
export { TagGroup, Tag } from "./TagGroup";
export { Tree, TreeItem } from "./Tree";
export { default as Table } from "./Table";
export { Tabs, Tab, TabList, TabPanel } from "./Tabs";

// Navigation Components
export { Link } from "./Link";
export { Breadcrumb } from "./Breadcrumb";
export { Breadcrumbs } from "./Breadcrumbs";
export { Pagination } from "./Pagination";

// Layout Components
export { Group } from "./Group";
export { Separator } from "./Separator";
export { Toolbar } from "./Toolbar";
export { Heading, Text as ContentText } from "./Content";
export { Card } from "./Card";
export { Slot } from "./Slot";
export { Disclosure } from "./Disclosure";
export { DisclosurePanel } from "react-aria-components";
export { DisclosureGroup } from "./DisclosureGroup";

// Icon Component
export { Icon } from "./Icon";

// Feedback Components
export { Badge } from "./Badge";
export { ProgressBar } from "./ProgressBar";
export { Meter } from "./Meter";
export { Skeleton } from "./Skeleton";
export { IllustratedMessage } from "./IllustratedMessage";
export { StatusLight } from "./StatusLight";
export { Avatar } from "./Avatar";
export { Toast, ToastProvider, ToastRegion } from "./Toast";
export { useToast } from "./ToastContext";
export {
  CollectionState,
  CollectionErrorDisplay,
  CollectionLoadingState,
  CollectionEmptyState,
} from "./CollectionErrorState";

// Overlay Components
export { Dialog } from "./Dialog";
export { Modal } from "./Modal";
export { Popover } from "./Popover";
export { Tooltip } from "./Tooltip";
export { TooltipTrigger } from "react-aria-components";
