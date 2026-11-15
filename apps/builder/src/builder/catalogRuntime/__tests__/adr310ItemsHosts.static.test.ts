import type { CardViewProps } from "@react-spectrum/s2";
import type {
  BreadcrumbsProps,
  GridListProps,
  ListBoxProps,
  MenuProps,
  TabListProps,
  TableBodyProps,
  TagListProps,
  TreeProps,
} from "react-aria-components";
import { expect, it } from "vitest";
import { CODE_VIEW_ITEMS_HOSTS } from "../../../../../../packages/shared/src/codeView/generate";

/**
 * ADR-310 §5 「코드 형태」 칸 — the parts the Code view writes `items` + a render function on are the
 * ones the installed RAC · S2 types give `items` (a type error here = the table names a part that
 * takes children only). SelectBoxGroup (S2: children only) writes `<Collection>` in its place.
 */
type Items<T> = "items" extends keyof T ? true : false;
const TAKES_ITEMS = {
  ListBox: true satisfies Items<ListBoxProps<object>>,
  GridList: true satisfies Items<GridListProps<object>>,
  Menu: true satisfies Items<MenuProps<object>>,
  Tree: true satisfies Items<TreeProps<object>>,
  TagList: true satisfies Items<TagListProps<object>>,
  TableBody: true satisfies Items<TableBodyProps<object>>,
  TabList: true satisfies Items<TabListProps<object>>,
  Breadcrumbs: true satisfies Items<BreadcrumbsProps<object>>,
  CardView: true satisfies Items<CardViewProps<object>>,
} as const;

it("ADR-310 §5: the Code view's `items` parts are the ones whose installed props take `items`", () => {
  expect([...CODE_VIEW_ITEMS_HOSTS].sort()).toEqual(
    Object.keys(TAKES_ITEMS).sort(),
  );
});
