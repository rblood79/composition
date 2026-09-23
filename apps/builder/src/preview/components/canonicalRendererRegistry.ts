import type { ElementType } from "react";
import { Badge } from "@composition/shared/components/Badge";
import { Calendar } from "@composition/shared/components/Calendar";
import { Chart } from "@composition/shared/components/Chart";
import { ComboBox } from "@composition/shared/components/ComboBox";
import { DatePicker } from "@composition/shared/components/DatePicker";
import { DateRangePicker } from "@composition/shared/components/DateRangePicker";
import { DialogTrigger } from "@composition/shared/components/DialogTrigger";
import { Dialog } from "@composition/shared/components/Dialog";
import { DropZone } from "@composition/shared/components/DropZone";
import { FileUpload } from "@composition/shared/components/FileUpload";
import { GridList } from "@composition/shared/components/GridList";
import { Icon } from "@composition/shared/components/Icon";
import { IllustratedMessage } from "@composition/shared/components/IllustratedMessage";
import { StatusLight } from "@composition/shared/components/StatusLight";
import { Avatar } from "@composition/shared/components/Avatar";
import { ProgressCircle } from "@composition/shared/components/ProgressCircle";
import { ListBox, ListBoxItem } from "@composition/shared/components/ListBox";
import { MenuButton } from "@composition/shared/components/Menu";
import { Modal } from "@composition/shared/components/Modal";
import { Breadcrumbs } from "@composition/shared/components/Breadcrumbs";
import { Popover } from "@composition/shared/components/Popover";
import { RangeCalendar } from "@composition/shared/components/RangeCalendar";
import { Select } from "@composition/shared/components/Select";
import { Skeleton } from "@composition/shared/components/Skeleton";
import Table from "@composition/shared/components/Table";
import { Tab, Tabs } from "@composition/shared/components/Tabs";
import { Tag, TagGroup } from "@composition/shared/components/TagGroup";
import { Tooltip } from "@composition/shared/components/Tooltip";
import { Tree } from "@composition/shared/components/Tree";
import {
  deriveDelegatingInternalRenderers,
  deriveDelegatingRacRenderers,
} from "./renderFacetDeclaration";

export const INTERNAL_RENDERERS: Readonly<
  Record<string, ElementType | undefined>
> = {
  icon: Icon,
  chart: Chart,
  badge: Badge,
  skeleton: Skeleton,
  illustrated: IllustratedMessage,
  statuslight: StatusLight,
  avatar: Avatar,
  progresscircle: ProgressCircle,
  listbox: ListBox,
  // ADR-234 Phase 3 — ListBox 정적 자식 (ListBoxItem instance).
  listboxitem: ListBoxItem,
  menu: MenuButton,
  select: Select,
  combobox: ComboBox,
  tabs: Tabs,
  // ADR-234 Phase 3 — TabList 정적 자식 (Tab instance). RAC Tab 이라 render props 를 받는다.
  tab: Tab,
  taggroup: TagGroup,
  tag: Tag,
  gridlist: GridList,
  breadcrumbs: Breadcrumbs,
  tree: Tree,
  table: Table,
  dialog: Dialog,
  dialogtrigger: DialogTrigger,
  modal: Modal,
  popover: Popover,
  tooltip: Tooltip,
  dropzone: DropZone,
  fileupload: FileUpload,
  calendar: Calendar,
  rangecalendar: RangeCalendar,
  datepicker: DatePicker,
  daterangepicker: DateRangePicker,
};

/**
 * ADR-234 Phase 3 — internal renderer 중 RAC collection item 을 그대로 감싸 render props (`style` ·
 * `children` 함수) 를 RAC 에 넘기는 것. 상태 변형 층을 rac source 와 같은 함수 경로로 겹친다.
 */
export const RENDER_PROPS_INTERNAL_RENDERERS: ReadonlySet<string> = new Set([
  "tab",
  "tag",
  "listboxitem",
]);

export const DELEGATING_INTERNAL_RENDERERS: ReadonlySet<string> =
  deriveDelegatingInternalRenderers();

export const DELEGATING_RAC_RENDERERS: ReadonlySet<string> =
  deriveDelegatingRacRenderers();
