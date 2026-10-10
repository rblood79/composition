import {
  createElement,
  type CSSProperties,
  type ElementType,
  type HTMLAttributes,
} from "react";
import { tableBinding } from "../bindings/Table.binding";
import { resolveSelectionBehavior } from "../../components/selectionStyle";
import { Keyboard } from "react-aria-components/Keyboard";
import {
  Cell as RacCell,
  Column as RacColumn,
  ResizableTableContainer,
  Row as RacRow,
  Table as RacTable,
  TableBody as RacTableBody,
  TableHeader as RacTableHeader,
} from "react-aria-components/Table";
import { Badge } from "@composition/shared/components/Badge";
import { Chart } from "@composition/shared/components/Chart";
import { DialogTrigger } from "@composition/shared/components/DialogTrigger";
import { TooltipTrigger } from "@composition/shared/components/TooltipTrigger";
import { MenuTrigger } from "@composition/shared/components/MenuTrigger";
import { Dialog } from "@composition/shared/components/Dialog";
import { DropZone } from "@composition/shared/components/DropZone";
import { FileUpload } from "@composition/shared/components/FileUpload";
import {
  GridList,
  GridListItem,
} from "@composition/shared/components/GridList";
import { Icon } from "@composition/shared/components/Icon";
import { StatusLight } from "@composition/shared/components/StatusLight";
import { Avatar } from "@composition/shared/components/Avatar";
import { ProgressCircle } from "@composition/shared/components/ProgressCircle";
import { ListBox, ListBoxItem } from "@composition/shared/components/ListBox";
import { MenuButton } from "@composition/shared/components/Menu";
import { Modal } from "@composition/shared/components/Modal";
import { Breadcrumbs } from "@composition/shared/components/Breadcrumbs";
import { Breadcrumb } from "@composition/shared/components/Breadcrumb";
import { Popover } from "@composition/shared/components/Popover";
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
/**
 * ADR-257 Phase 4 — a resizable Table's `<table>` inside RAC's `ResizableTableContainer`: the
 * container is the Table's box (its border, background, height and scroll — RAC measures it and
 * gives the table `width: min-content`), the table only lays the rows out.
 */
const RESIZABLE_TABLE_STYLE: CSSProperties = {
  border: "none",
  borderRadius: 0,
  background: "transparent",
  boxShadow: "none",
  margin: 0,
  minHeight: 0,
  maxWidth: "none",
  overflow: "visible",
};

function CatalogTable({
  heightMode,
  height,
  selectionStyle,
  tableResizable,
  style,
  ...props
}: Record<string, unknown> & { style?: CSSProperties }) {
  const accepts = tableBinding.props.accepts;
  const mode = heightMode ?? accepts.heightMode?.default;
  const fixed = typeof height === "number" ? height : accepts.height?.default;
  // (`Table.css` `border: 1px solid` when the document writes none.)
  const border = Number.parseFloat(String(style?.borderWidth ?? 1)) || 0;
  // S2 `isQuiet` — square corners: the rule's radius rides the inline style, which would beat
  // the `[data-quiet]` sheet block (the Canvas reads the rule's containerVariants.quiet).
  const quiet =
    (props as Record<string, unknown>)["data-quiet"] === "true"
      ? { borderRadius: 0 }
      : undefined;
  const sized =
    mode === "fixed" && typeof fixed === "number" && style?.height === undefined
      ? { height: fixed + border * 2 }
      : undefined;
  const boxStyle = quiet || sized ? { ...style, ...sized, ...quiet } : style;
  const table = createElement(RacTable as ElementType, {
    "aria-label": "Table",
    ...props,
    // ADR-257 Phase 3 — S2 `selectionStyle` → RAC `selectionBehavior` (highlight = replace; the
    // sheet's `[data-selection-style="highlight"]` paints the selected rows).
    selectionBehavior: resolveSelectionBehavior({
      selectionStyle,
      fallback: "toggle",
    }),
    "data-selection-style":
      selectionStyle === "highlight" ? "highlight" : undefined,
    // (An authored height wins, as on the Canvas — `catalogTableHeight` is the height when none.)
    style: tableResizable ? RESIZABLE_TABLE_STYLE : boxStyle,
    "data-node-table": "",
  });
  return tableResizable
    ? createElement(
        ResizableTableContainer as ElementType,
        {
          className: "react-aria-ResizableTableContainer",
          "data-node-table-container": "",
          "data-quiet": (props as Record<string, unknown>)["data-quiet"],
          style: boxStyle,
        },
        table,
      )
    : table;
}

/**
 * ADR-257 Phase 5 — the TableView, as S2 1.8.0 builds it (`TableView.tsx`): RAC's
 * `ResizableTableContainer` (always — S2 wraps every TableView) is the TableView's box (the
 * `.react-aria-TableView` rule: variant · border · background · its record's style), and RAC's
 * `Table` inside lays the node tree's parts out (the same parts as a Table — `TableHeader > Column`,
 * `TableBody > Row > Cell`, drawn by `ruleDom`). Its rows take RAC's column widths as tracks
 * (`--table-resized-tracks`, `tableOperationsDom`). S2's `Virtualizer` is not used: the parts are
 * nodes (the Table's choice, ADR-256 Phase 5i).
 */
function CatalogTableView({
  selectionStyle,
  density,
  overflowMode: _overflowMode,
  allowsSorting: _allowsSorting,
  tableResizable: _tableResizable,
  style,
  ...props
}: Record<string, unknown> & { style?: CSSProperties }) {
  const {
    "data-variant": variant,
    "data-quiet": _quiet,
    "data-catalog-id": catalogId,
    ...tableProps
  } = props as Record<string, unknown>;
  return createElement(
    ResizableTableContainer as ElementType,
    {
      className: "react-aria-TableView",
      "data-catalog-id": catalogId,
      "data-variant": variant ?? "default",
      "data-density": typeof density === "string" ? density : undefined,
      style: { overflow: "hidden", ...style },
    },
    createElement(RacTable as ElementType, {
      "aria-label": "Table",
      ...tableProps,
      // S2: `selectionStyle` highlight = RAC `selectionBehavior="replace"` (Phase 3).
      selectionBehavior: resolveSelectionBehavior({
        selectionStyle,
        fallback: "toggle",
      }),
      "data-selection-style":
        selectionStyle === "highlight" ? "highlight" : undefined,
      style: RESIZABLE_TABLE_STYLE,
      "data-node-table": "",
    }),
  );
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
