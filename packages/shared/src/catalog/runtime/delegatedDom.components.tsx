import {
  cloneElement,
  createElement,
  Fragment,
  useContext,
  useState,
  type ElementType,
  type ReactElement,
} from "react";

import type { Key } from "react-aria-components/Collection";

import {
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
} from "react-aria-components/ListBox";

import {
  TagGroup as AriaTagGroup,
  TagList as AriaTagList,
} from "react-aria-components/TagGroup";

import { ToggleGroupStateContext } from "react-aria-components/ToggleButtonGroup";

import {
  TagMaxRowsMirror,
  useTagMaxRows,
  useTagRowsState,
} from "../../components/TagGroup";

import { CatalogCalendarPickerContext } from "./calendarPickerContext";

import { catalogForwardHandlers, catalogStateFrame } from "./stateFrames";

import {
  AuthoredDomAttributes,
  bool,
  catalogTypeName,
  childrenOf,
  DelegatedDomInput,
  marker,
  renderAll,
  str,
  tagChipText,
  tagGroupLabelled,
  TagGroupRunContext,
  tagGroupTags,
  tagKey,
  ToggleIndicatorContext,
} from "./delegatedDom.runtime";
import { catalogBindValueText } from "./valueBindings";

export function ToggleIndicatorPart({
  type,
  nodeKey,
}: {
  type: string;
  nodeKey: string;
}): ReactElement | null {
  const toggle = useContext(ToggleIndicatorContext);
  return toggle?.indicators[type]?.(nodeKey, toggle.state) ?? null;
}

/**
 * A ToggleButton outside a group: its selection held here (RAC's uncontrolled state, made
 * controlled), passed down as its state frame (ADR-256 Decision 7).
 */
export function SelfToggleButton({
  ownerId,
  defaultSelected,
  isDisabled,
  render,
  ...handlers
}: {
  ownerId: string;
  defaultSelected: boolean;
  isDisabled: boolean;
  render: (selection: Record<string, unknown>) => ReactElement;
} & Record<string, unknown>): ReactElement {
  const [isSelected, setSelected] = useState(defaultSelected);
  return catalogStateFrame(
    ownerId,
    ownerId,
    { isSelected, isDisabled },
    catalogForwardHandlers(
      render({ isSelected, onChange: setSelected }),
      handlers,
    ),
  );
}

/**
 * A ToggleButton in a group: its selection is the group's RAC state (`ToggleGroupStateContext` —
 * its key is the node id), passed down as its state frame so the `showWhen` nodes inside follow a
 * Preview press (ADR-256 후속 18 — the shared ToggleButton draws children, not RAC's function).
 */
export function GroupToggleFrame({
  ownerId,
  isSelected,
  isDisabled,
  children,
  ...handlers
}: {
  ownerId: string;
  isSelected: boolean;
  isDisabled: boolean;
  children: ReactElement;
} & Record<string, unknown>): ReactElement {
  const group = useContext(ToggleGroupStateContext);
  return catalogStateFrame(
    ownerId,
    ownerId,
    {
      isSelected: group ? group.selectedKeys.has(ownerId) : isSelected,
      isDisabled: isDisabled || !!group?.isDisabled,
    },
    catalogForwardHandlers(children, handlers),
  );
}

export function CalendarPickerSelect({
  element,
}: {
  element: ReactElement;
}): ReactElement {
  const picker = useContext(CatalogCalendarPickerContext);
  return picker
    ? cloneElement(element as ReactElement<Record<string, unknown>>, {
        "aria-label": picker.aria["aria-label"],
        value: picker.aria.value,
        onChange: picker.aria.onChange,
      })
    : element;
}

/**
 * ADR-256 Phase 9 — a calendar picker's ListBox: RAC's items (the picker's render props) drawn by
 * the item node — `id` · `textValue` RAC's, its children under the picker's frame (`{formatted}`).
 */
export function CalendarPickerList({
  listProps,
  itemId,
  itemText,
  renderItemChildren,
}: {
  listProps: Record<string, unknown>;
  itemId: string | undefined;
  itemText: string;
  renderItemChildren: () => ReactElement[];
}): ReactElement {
  const picker = useContext(CatalogCalendarPickerContext);
  return createElement(AriaListBox as ElementType, {
    ...listProps,
    items: picker?.aria.items ?? [],
    children: (entry: { id: string | number; formatted: string }) =>
      createElement(
        AriaListBoxItem as ElementType,
        {
          id: entry.id,
          textValue: entry.formatted,
          "data-catalog-id": itemId,
          className: "react-aria-ListBoxItem",
        },
        ...(() => {
          const kids = renderItemChildren();
          // (Its own text with RAC's `formatted` bound — the reference's plain item text.)
          if (!kids.length)
            return [
              catalogBindValueText(itemText, (key) =>
                key === "formatted"
                  ? { linked: true, value: entry.formatted }
                  : { linked: false, value: undefined },
              ),
            ];
          return picker
            ? [
                catalogStateFrame(
                  `${picker.ownerId}:${String(entry.id)}`,
                  picker.ownerId,
                  { formatted: entry.formatted },
                  createElement(Fragment, null, ...kids),
                ),
              ]
            : kids;
        })(),
      ),
  });
}

export function TagGroupRun({
  input,
  ...authored
}: { input: DelegatedDomInput } & AuthoredDomAttributes): ReactElement {
  const props = input.node.props;
  // (The reference's `onRemove` — a removed tag leaves the list: Preview run state, the document
  // keeps it. RAC shows a tag's remove button only with one.)
  const [removed, setRemoved] = useState<ReadonlySet<Key>>(() => new Set());
  const rows = useTagRowsState();
  const label = str(props.label).trim();
  const named = tagGroupLabelled(input.root, input.node);
  const size = str(props.size) || "M";
  const labelPosition = str(props.labelPosition) || "top";
  const tags = tagGroupTags(input.root, input.node);
  const allTags = () => tags.map(tagKey);
  // A selected Tag is the group's selection (RAC · S2 Tag has no `variant`): its Selected
  // (`isSelected`) hands RAC the key (`defaultSelectedKeys` — RAC selects only in a selection
  // mode, as the Canvas `catalogCollectionItemSelected`). A changed authored set remounts RAC's
  // group (its uncontrolled selection), as ToggleButtonGroup.
  const selectedKeys = tags
    .filter((tag) => tag.props.isSelected === true)
    .map(tagKey);
  return createElement(
    TagGroupRunContext.Provider,
    {
      value: {
        maxRows:
          typeof props.maxRows === "number" && props.maxRows > 0
            ? props.maxRows
            : undefined,
        size,
        labelPosition,
        removed,
        rows,
      },
    },
    createElement(
      AriaTagGroup as ElementType,
      {
        ...marker(input),
        style: input.style,
        className: "react-aria-TagGroup",
        "data-tag-variant": str(props.variant) || "default",
        "data-tag-size": size,
        // (S2 `isEmphasized` — its selected Tags are accent: `TagGroup.css`.)
        "data-emphasized": bool(props.isEmphasized) || undefined,
        "data-label-position": labelPosition,
        // (S2 start · end — start is the sheet's default, so only end is an attribute.)
        "data-label-align": props.labelAlign === "end" ? "end" : undefined,
        key: `selected:${selectedKeys.join(",")}`,
        defaultSelectedKeys: selectedKeys,
        // (Without a visible label the group is named by its `label` — RAC needs a name.)
        "aria-label": named ? undefined : label || "Tag group",
        selectionMode: props.selectionMode ?? "none",
        selectionBehavior: props.selectionBehavior || "toggle",
        disallowEmptySelection: bool(props.disallowEmptySelection),
        onRemove: bool(props.allowsRemoving)
          ? (keys: "all" | Iterable<Key>) =>
              setRemoved(
                (previous) =>
                  new Set([
                    ...previous,
                    ...(keys === "all" ? allTags() : keys),
                  ]),
              )
          : undefined,
        ...authored,
      },
      ...renderAll(input),
    ),
  );
}

export function TagListRun({
  input,
  ...authored
}: { input: DelegatedDomInput } & AuthoredDomAttributes): ReactElement {
  const run = useContext(TagGroupRunContext);
  const tags = childrenOf(input.root, input.node).filter(
    (child) =>
      catalogTypeName(input.root, child) === "Tag" &&
      !run?.removed.has(tagKey(child)),
  );
  const size = run?.size ?? (str(input.node.props.size) || "M");
  const labelPosition = run?.labelPosition ?? "top";
  const {
    hiddenRef,
    wrapperRef,
    hasMaxRows,
    isCollapsed,
    setIsCollapsed,
    showCollapsed,
    visibleTagCount,
  } = useTagMaxRows(
    run?.maxRows,
    run?.rows,
    // (The chips the mirror measures — a Tag added, removed or relabelled is counted again.)
    tags.map((tag) => tagChipText(input.root, tag)).join("\u0000"),
  );
  const shown = showCollapsed ? tags.slice(0, visibleTagCount) : tags;
  const showButton = (label: string, collapse: boolean) =>
    createElement(
      "button",
      {
        className: "tag-show-all-btn",
        type: "button",
        onClick: () => setIsCollapsed(collapse),
      },
      label,
    );
  return createElement(
    "div",
    {
      ...marker(input),
      ref: wrapperRef,
      style: input.style,
      ...authored,
      // (The chip box's class and the author's — not RAC's `react-aria-TagList`, which is the
      // `display: contents` list inside.)
      className: ["tag-list-wrapper", input.node.className]
        .filter(Boolean)
        .join(" "),
    },
    hasMaxRows
      ? createElement(TagMaxRowsMirror, {
          hiddenRef,
          size,
          labelPosition,
          entries: tags.map((tag) => ({
            text: tagChipText(input.root, tag),
            icon: null,
            avatar: null,
          })),
        })
      : null,
    createElement(
      AriaTagList as ElementType,
      { className: "react-aria-TagList" },
      ...shown.map((tag) => input.renderChild(tag.id)),
    ),
    showCollapsed && visibleTagCount < tags.length
      ? showButton(`Show all (${tags.length})`, false)
      : null,
    hasMaxRows && !isCollapsed ? showButton("Show less", true) : null,
  );
}
