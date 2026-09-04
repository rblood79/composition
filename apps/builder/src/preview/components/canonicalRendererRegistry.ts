import type { ElementType } from "react";
import { Badge } from "@composition/shared/components/Badge";
import { Calendar } from "@composition/shared/components/Calendar";
import { ComboBox } from "@composition/shared/components/ComboBox";
import { DatePicker } from "@composition/shared/components/DatePicker";
import { DateRangePicker } from "@composition/shared/components/DateRangePicker";
import { Dialog } from "@composition/shared/components/Dialog";
import { DropZone } from "@composition/shared/components/DropZone";
import { GridList } from "@composition/shared/components/GridList";
import { Icon } from "@composition/shared/components/Icon";
import { IllustratedMessage } from "@composition/shared/components/IllustratedMessage";
import { StatusLight } from "@composition/shared/components/StatusLight";
import { Avatar } from "@composition/shared/components/Avatar";
import { ProgressCircle } from "@composition/shared/components/ProgressCircle";
import { ListBox } from "@composition/shared/components/ListBox";
import { MenuButton } from "@composition/shared/components/Menu";
import { Modal } from "@composition/shared/components/Modal";
import { Breadcrumbs } from "@composition/shared/components/Breadcrumbs";
import { Popover } from "@composition/shared/components/Popover";
import { RangeCalendar } from "@composition/shared/components/RangeCalendar";
import { Select } from "@composition/shared/components/Select";
import { Skeleton } from "@composition/shared/components/Skeleton";
import Table from "@composition/shared/components/Table";
import { Tabs } from "@composition/shared/components/Tabs";
import { TagGroup } from "@composition/shared/components/TagGroup";
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
  badge: Badge,
  skeleton: Skeleton,
  illustrated: IllustratedMessage,
  statuslight: StatusLight,
  avatar: Avatar,
  progresscircle: ProgressCircle,
  listbox: ListBox,
  menu: MenuButton,
  select: Select,
  combobox: ComboBox,
  tabs: Tabs,
  taggroup: TagGroup,
  gridlist: GridList,
  breadcrumbs: Breadcrumbs,
  tree: Tree,
  table: Table,
  dialog: Dialog,
  modal: Modal,
  popover: Popover,
  tooltip: Tooltip,
  dropzone: DropZone,
  calendar: Calendar,
  rangecalendar: RangeCalendar,
  datepicker: DatePicker,
  daterangepicker: DateRangePicker,
};

export const DELEGATING_INTERNAL_RENDERERS: ReadonlySet<string> =
  deriveDelegatingInternalRenderers();

export const DELEGATING_RAC_RENDERERS: ReadonlySet<string> =
  deriveDelegatingRacRenderers();
