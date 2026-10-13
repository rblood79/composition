import { Avatar } from "@composition/shared/components/Avatar";

import { Badge } from "@composition/shared/components/Badge";

import { Breadcrumb } from "@composition/shared/components/Breadcrumb";

import { Breadcrumbs } from "@composition/shared/components/Breadcrumbs";

import { Chart } from "@composition/shared/components/Chart";

import { Dialog } from "@composition/shared/components/Dialog";

import { DialogTrigger } from "@composition/shared/components/DialogTrigger";

import { ContextualHelp } from "@composition/shared/components/ContextualHelp";

import { FieldLabel } from "@composition/shared/components/FieldLabel";

import { DropZone } from "@composition/shared/components/DropZone";

import { FileUpload } from "@composition/shared/components/FileUpload";

import {
  GridList,
  GridListItem,
} from "@composition/shared/components/GridList";

import { Icon } from "@composition/shared/components/Icon";

import { ListBox, ListBoxItem } from "@composition/shared/components/ListBox";

import { MenuButton } from "@composition/shared/components/Menu";

import { MenuTrigger } from "@composition/shared/components/MenuTrigger";

import { Modal } from "@composition/shared/components/Modal";

import { Popover } from "@composition/shared/components/Popover";

import { ProgressCircle } from "@composition/shared/components/ProgressCircle";

import { Skeleton } from "@composition/shared/components/Skeleton";

import { StatusLight } from "@composition/shared/components/StatusLight";

import { Tab, Tabs } from "@composition/shared/components/Tabs";

import { Tag, TagGroup } from "@composition/shared/components/TagGroup";

import { Tooltip } from "@composition/shared/components/Tooltip";

import { TooltipTrigger } from "@composition/shared/components/TooltipTrigger";

import { Tree } from "@composition/shared/components/Tree";

import { type CSSProperties, type ElementType } from "react";

import {
  Cell as RacCell,
  Column as RacColumn,
  Row as RacRow,
  TableBody as RacTableBody,
  TableHeader as RacTableHeader,
} from "react-aria-components/Table";

import {
  CatalogKeyboard,
  CatalogTable,
  CatalogTableView,
} from "./domRegistry.components";
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
/**
 * ADR-257 Phase 4 — a resizable Table's `<table>` inside RAC's `ResizableTableContainer`: the
 * container is the Table's box (its border, background, height and scroll — RAC measures it and
 * gives the table `width: min-content`), the table only lays the rows out.
 */
export const RESIZABLE_TABLE_STYLE: CSSProperties = {
  border: "none",
  borderRadius: 0,
  background: "transparent",
  boxShadow: "none",
  margin: 0,
  minHeight: 0,
  maxWidth: "none",
  overflow: "visible",
};

export const INTERNAL_RENDERERS: Readonly<
  Record<string, ElementType | undefined>
> = {
  icon: Icon,
  keyboard: CatalogKeyboard,
  chart: Chart,
  badge: Badge,
  skeleton: Skeleton,
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
  // ADR-257 Phase 5: the TableView is RAC's Table in RAC's resizable container (S2).
  tableview: CatalogTableView,
  tableheader: RacTableHeader,
  column: RacColumn,
  tablebody: RacTableBody,
  row: RacRow,
  cell: RacCell,
  dialog: Dialog,
  dialogtrigger: DialogTrigger,
  // ADR-259 Phase 3: S2 ContextualHelp (RAC DialogTrigger) · a field's label row.
  contextualhelp: ContextualHelp,
  fieldlabel: FieldLabel,
  modal: Modal,
  popover: Popover,
  tooltip: Tooltip,
  // ADR-255: the Tooltip origin's root.
  tooltiptrigger: TooltipTrigger,
  menutrigger: MenuTrigger,
  dropzone: DropZone,
  fileupload: FileUpload,
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
