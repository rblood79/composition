import {
  createElement,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
} from "react";
import { tableBinding } from "../bindings/Table.binding";
import { Keyboard } from "react-aria-components/Keyboard";
import {
  Cell as RacCell,
  Column as RacColumn,
  Row as RacRow,
  Table as RacTable,
  TableBody as RacTableBody,
  TableHeader as RacTableHeader,
} from "react-aria-components/Table";
import { Badge } from "@composition/shared/components/Badge";
import { Calendar } from "@composition/shared/components/Calendar";
import { Chart } from "@composition/shared/components/Chart";
import { DatePicker } from "@composition/shared/components/DatePicker";
import { DateRangePicker } from "@composition/shared/components/DateRangePicker";
import { DialogTrigger } from "@composition/shared/components/DialogTrigger";
import { TooltipTrigger } from "@composition/shared/components/TooltipTrigger";
import { Dialog } from "@composition/shared/components/Dialog";
import { DropZone } from "@composition/shared/components/DropZone";
import { FileUpload } from "@composition/shared/components/FileUpload";
import {
  GridList,
  GridListItem,
} from "@composition/shared/components/GridList";
import { Icon } from "@composition/shared/components/Icon";
import { IllustratedMessage } from "@composition/shared/components/IllustratedMessage";
import { StatusLight } from "@composition/shared/components/StatusLight";
import { Avatar } from "@composition/shared/components/Avatar";
import { ProgressCircle } from "@composition/shared/components/ProgressCircle";
import { ListBox, ListBoxItem } from "@composition/shared/components/ListBox";
import { MenuButton } from "@composition/shared/components/Menu";
import { Modal } from "@composition/shared/components/Modal";
import { Breadcrumbs } from "@composition/shared/components/Breadcrumbs";
import { Breadcrumb } from "@composition/shared/components/Breadcrumb";
import { Popover } from "@composition/shared/components/Popover";
import { RangeCalendar } from "@composition/shared/components/RangeCalendar";
import { Skeleton } from "@composition/shared/components/Skeleton";
import { Tab, Tabs } from "@composition/shared/components/Tabs";
import { Tag, TagGroup } from "@composition/shared/components/TagGroup";
import { Tooltip } from "@composition/shared/components/Tooltip";
import { Tree } from "@composition/shared/components/Tree";
import {
  deriveDelegatingInternalRenderers,
  deriveDelegatingRacRenderers,
} from "./renderFacetDeclaration";

/**
 * ADR-256 Phase 5g: RAC `Keyboard` (`<kbd>`) — in a MenuItem it takes the item's `KeyboardContext`
 * (its id, the item's `aria-describedby`). RAC sets no class of its own; the rule's sheet reads
 * `.react-aria-Keyboard`.
 */
/**
 * ADR-256 Phase 5i — the node tree's RAC Table (`[data-node-table]` — `Table.css`). `heightMode`
 * "fixed" (the binding default) keeps its `height` (default 400) inside its border and scrolls when
 * the author set no height, as the Canvas sizes it (`catalogTableHeight` — a `<table>` is
 * `box-sizing: border-box`); the other modes follow the rows.
 */
function CatalogTable({
  heightMode,
  height,
  style,
  ...props
}: Record<string, unknown> & { style?: CSSProperties }) {
  const accepts = tableBinding.props.accepts;
  const mode = heightMode ?? accepts.heightMode?.default;
  const fixed = typeof height === "number" ? height : accepts.height?.default;
  // (`Table.css` `border: 1px solid` when the document writes none.)
  const border = Number.parseFloat(String(style?.borderWidth ?? 1)) || 0;
  return createElement(RacTable as ElementType, {
    "aria-label": "Table",
    ...props,
    // (An authored height wins, as on the Canvas — `catalogTableHeight` is the height when none.)
    style:
      mode === "fixed" &&
      typeof fixed === "number" &&
      style?.height === undefined
        ? { ...style, height: fixed + border * 2 }
        : style,
    "data-node-table": "",
  });
}

function CatalogKeyboard(props: HTMLAttributes<HTMLElement>) {
  return createElement(Keyboard, {
    className: "react-aria-Keyboard",
    ...props,
  });
}

export const INTERNAL_RENDERERS: Readonly<
  Record<string, ElementType | undefined>
> = {
  icon: Icon,
  keyboard: CatalogKeyboard,
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
  tabs: Tabs,
  // ADR-234 Phase 3 — TabList 정적 자식 (Tab instance). RAC Tab 이라 render props 를 받는다.
  tab: Tab,
  taggroup: TagGroup,
  tag: Tag,
  gridlist: GridList,
  // ADR-234 Phase 3e — GridList 정적 자식 (GridListItem instance).
  gridlistitem: GridListItem,
  breadcrumbs: Breadcrumbs,
  // ADR-237 Phase 3 — Breadcrumbs 정적 자식 (Breadcrumb instance). RAC Breadcrumb + Link, render props 를 받는다.
  breadcrumb: Breadcrumb,
  tree: Tree,
  // ADR-256 Phase 5i: RAC Table from its node tree (the reference's `Table > TableHeader > Column`,
  // `TableBody > Row > Cell`); a bound Table's rows are its projected records (`catalogBoundRows`).
  table: CatalogTable,
  tableheader: RacTableHeader,
  column: RacColumn,
  tablebody: RacTableBody,
  row: RacRow,
  cell: RacCell,
  dialog: Dialog,
  dialogtrigger: DialogTrigger,
  modal: Modal,
  popover: Popover,
  tooltip: Tooltip,
  // ADR-255: the Tooltip origin's root.
  tooltiptrigger: TooltipTrigger,
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
  "gridlistitem",
  "breadcrumb",
]);

export const DELEGATING_INTERNAL_RENDERERS: ReadonlySet<string> =
  deriveDelegatingInternalRenderers();

export const DELEGATING_RAC_RENDERERS: ReadonlySet<string> =
  deriveDelegatingRacRenderers();
