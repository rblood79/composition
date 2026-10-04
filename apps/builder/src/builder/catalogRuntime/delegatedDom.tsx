import {
  createElement,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";
import { parseColor } from "react-aria-components/ColorPicker";
import {
  dateFieldDefaultValue,
  timeFieldDefaultValue,
} from "../../../../../packages/shared/src/utils/dateFieldDefaults";
import { I18nProvider } from "react-aria-components";
import { Button as AriaButton } from "react-aria-components/Button";
import {
  FILE_UPLOAD_INPUT_CHILD_TYPES,
  FileUpload,
} from "../../../../../packages/shared/src/components/FileUpload";
import { FileTriggerIntake } from "../../../../../packages/shared/src/upload/intakeAdapters";
import { resolveTextSourceText, textFromValue } from "@composition/rendering";
import { OWNER_DRAWN_PART_OWNERS } from "@composition/shared";
import {
  Tabs,
  TabList,
  TabPanel,
} from "../../../../../packages/shared/src/components/Tabs";
import { TagGroup } from "../../../../../packages/shared/src/components/TagGroup";
import { ListBox } from "../../../../../packages/shared/src/components/ListBox";
import { GridList } from "../../../../../packages/shared/src/components/GridList";
import {
  Tree,
  TreeItem,
} from "../../../../../packages/shared/src/components/Tree";
import { Breadcrumbs } from "../../../../../packages/shared/src/components/Breadcrumbs";
import { MenuButton } from "../../../../../packages/shared/src/components/Menu";
import { TABLEVIEW_CHILD_STYLE } from "../../../../../packages/shared/src/renderers/LayoutRenderers";
import { resolveCatalogDensityField } from "../../../../../packages/shared/src/catalog/resolvers/resolveCatalogContainer";
import { resolveStaticItemKey } from "../../../../../packages/shared/src/catalog/slotRoles";
import { catalogTabsSelection, catalogTreeItemExpanded } from "./presence";
import { Calendar } from "../../../../../packages/shared/src/components/Calendar";
import { Card } from "../../../../../packages/shared/src/components/Card";
import { Checkbox } from "../../../../../packages/shared/src/components/Checkbox";
import { CheckboxGroup } from "../../../../../packages/shared/src/components/CheckboxGroup";
import { ColorField } from "../../../../../packages/shared/src/components/ColorField";
import {
  ColorSwatchPicker,
  ColorSwatchPickerItem,
} from "../../../../../packages/shared/src/components/ColorSwatchPicker";
import { DateField } from "../../../../../packages/shared/src/components/DateField";
import { Disclosure } from "../../../../../packages/shared/src/components/Disclosure";
import { DisclosureGroup } from "../../../../../packages/shared/src/components/DisclosureGroup";
import { DataField } from "../../../../../packages/shared/src/components/Field";
import { Form } from "../../../../../packages/shared/src/components/Form";
import { Meter } from "../../../../../packages/shared/src/components/Meter";
import { NumberField } from "../../../../../packages/shared/src/components/NumberField";
import { ProgressBar } from "../../../../../packages/shared/src/components/ProgressBar";
import { RadioGroup } from "../../../../../packages/shared/src/components/RadioGroup";
import { RangeCalendar } from "../../../../../packages/shared/src/components/RangeCalendar";
import { SearchField } from "../../../../../packages/shared/src/components/SearchField";
import { Slider } from "../../../../../packages/shared/src/components/Slider";
import { Switch } from "../../../../../packages/shared/src/components/Switch";
import { TextArea } from "../../../../../packages/shared/src/components/TextArea";
import { TextField } from "../../../../../packages/shared/src/components/TextField";
import { TimeField } from "../../../../../packages/shared/src/components/TimeField";
import { ToggleButton } from "../../../../../packages/shared/src/components/ToggleButton";
import { ToggleButtonGroup } from "../../../../../packages/shared/src/components/ToggleButtonGroup";
import {
  allowsMultipleExpanded,
  resolveGroupExpandedDisclosureIds,
} from "../../../../../packages/shared/src/utils/disclosureGroupExpansion";
import type { DefinitionId } from "../../../../../packages/shared/src/catalog/document/types";
import type {
  CatalogCompositionRoot,
  CatalogConsumerNode,
} from "./compositionRoot";

/**
 * ADR-248 DOM bindings for the types whose Preview renderer composes from an element context
 * (the Preview's delegating renderers, `renderFacetDeclaration.ts`). Each binding reads the
 * resolved node and its resolved children and renders the same shared/RAC component the Preview
 * renderer renders; D1 stays with RAC, and the class CSS carries the library visuals. Product-path
 * code (Phase 4 uses it as is); a binding per execution id, not per test.
 *
 * `ownsChild` says which direct children have no DOM of their own (their values are read by the
 * parent, or the component composes that part itself); every other child renders through
 * `renderChild` (its own binding, with its `data-catalog-id`).
 */
export interface DelegatedDomInput {
  readonly root: CatalogCompositionRoot;
  readonly node: CatalogConsumerNode;
  /** Authored inline style (library visuals come from the class CSS). */
  readonly style: CSSProperties;
  readonly renderChild: (id: string) => ReactElement;
  /** Current date/time source for date fields (deterministic in tests). */
  readonly today?: () => unknown;
  /**
   * A running Preview's runtime props (ADR-250): the component's own state (expansion) goes here
   * and comes back as the node's props; absent = a static render of the declared state.
   */
  readonly setRuntimeProps?: (
    recordId: string,
    patch: Readonly<Record<string, unknown>>,
  ) => void;
  /** A record's runtime props (another record's — a group reads its children's). */
  readonly runtimeProps?: (
    recordId: string,
  ) => Readonly<Record<string, unknown>> | undefined;
}
export interface DelegatedDomBinding {
  render(input: DelegatedDomInput): ReactElement;
  /** Renders from its children's values: it renders again when a child changes. */
  watchesChildren?: boolean;
  ownsChild?(
    child: CatalogConsumerNode,
    parent: CatalogConsumerNode,
    root: CatalogCompositionRoot,
  ): boolean;
  /**
   * The child has no element of its own but its children still render (a structural layer the
   * component replaces, e.g. Tabs' TabPanels).
   */
  absorbsChild?(
    child: CatalogConsumerNode,
    parent: CatalogConsumerNode,
    root: CatalogCompositionRoot,
  ): boolean;
  /**
   * A deeper descendant the component leaves unrendered in its current state (e.g. Tabs renders
   * only the selected TabPanel). Called for every node on the path below the ancestor.
   */
  ownsDescendant?(
    node: CatalogConsumerNode,
    ancestor: CatalogConsumerNode,
    root: CatalogCompositionRoot,
  ): boolean;
}

// ── resolved-value helpers ─────────────────────────────────────────────
/** Registered type name of a resolved node (definition name). */
export function catalogTypeName(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): string {
  return (
    node.ruleId ??
    root.runtime.graph.getDefinition(node.definitionId as DefinitionId)?.name ??
    ""
  );
}
/**
 * A part node its owner draws (`OWNER_DRAWN_PART_OWNERS`, 2026-10-04): a toggle's indicator (the
 * RAC toggle draws `div.checkbox` · `::before` · `div.indicator`) and a TreeItem's chevron (the
 * shared Tree's `TreeItemContent` draws `Button[slot="chevron"]`). The record renders no element —
 * the owner absorbs it, so the delegated renderers never see it as a child.
 */
export function catalogOwnerDrawnPart(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): boolean {
  return OWNER_DRAWN_PART_OWNERS[catalogTypeName(root, node)] !== undefined;
}
const childrenOf = (
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): CatalogConsumerNode[] =>
  node.children
    .map((id) => root.domInputs.get(id)!)
    .filter((child) => child && !catalogOwnerDrawnPart(root, child));
const children = (input: DelegatedDomInput): CatalogConsumerNode[] =>
  childrenOf(input.root, input.node);
const childOf = (
  input: DelegatedDomInput,
  ...types: string[]
): CatalogConsumerNode | undefined =>
  children(input).find((child) =>
    types.includes(catalogTypeName(input.root, child)),
  );
/** Parent value when defined (`""` included), else the child's text, else the fallback. */
function propagatedText(
  root: CatalogCompositionRoot,
  parentValue: unknown,
  child: CatalogConsumerNode | undefined,
  fallback = "",
): string {
  if (parentValue !== undefined) return textFromValue(parentValue);
  if (child)
    return resolveTextSourceText(
      catalogTypeName(root, child),
      child.props as Record<string, unknown>,
    );
  return fallback;
}
const str = (value: unknown) => String(value || "");
const opt = (value: unknown) =>
  value === undefined || value === null || value === ""
    ? undefined
    : String(value);
const num = (value: unknown) =>
  value === undefined ? undefined : Number(value);
const bool = (value: unknown) => Boolean(value);
/** Nearest ancestor Form's field layout props (Preview `resolveInheritedFormFieldProps`). */
function inheritedForm(input: DelegatedDomInput) {
  for (
    let parent = input.root.domInputs.get(input.node.parentId);
    parent;
    parent = input.root.domInputs.get(parent.parentId)
  )
    if (catalogTypeName(input.root, parent) === "Form")
      return {
        labelPosition: parent.props.labelPosition,
        labelAlign: parent.props.labelAlign,
        necessityIndicator: parent.props.necessityIndicator,
      };
  return {} as Record<string, unknown>;
}
/** Common catalog chrome of composition-owned wrappers (`react-aria-{Type}` + data axes). */
function chrome(input: DelegatedDomInput, type: string) {
  const rule = input.root.runtime.graph.library.rules.get(type);
  return {
    className: `react-aria-${type}`,
    "data-size": str(input.node.props.size ?? rule?.defaultSize ?? "md"),
    "data-variant": str(
      input.node.props.variant ?? rule?.defaultVariant ?? "default",
    ),
  };
}
const marker = (input: DelegatedDomInput) => ({
  key: input.node.id,
  "data-catalog-id": input.node.id,
});
const renderAll = (input: DelegatedDomInput, list = children(input)) =>
  list.map((child) => input.renderChild(child.id));
/**
 * RAC TreeItems of resolved TreeItem records (shared `TreeItem`: title/childItems); their other
 * children render as the item's content.
 */
/**
 * A Tree's expansion keys: the declared list, or one key (an interaction's `expand` capability
 * carries the item key it names).
 */
function treeKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return typeof value === "string" && value ? [value] : [];
}

function treeItemElements(
  input: DelegatedDomInput,
  list: readonly CatalogConsumerNode[],
): ReactElement[] {
  return list.map((item) => {
    const kids = childrenOf(input.root, item);
    const childItems = kids.filter(
      (kid) => catalogTypeName(input.root, kid) === "TreeItem",
    );
    const others = kids.filter(
      (kid) => catalogTypeName(input.root, kid) !== "TreeItem",
    );
    const title = others.length
      ? ""
      : resolveTextSourceText(
          "TreeItem",
          item.props as Record<string, unknown>,
        );
    const label = others.find(
      (kid) => catalogTypeName(input.root, kid) === "Text",
    );
    return createElement(TreeItem as ElementType, {
      key: item.id,
      "data-catalog-id": item.id,
      // A standalone item is the node itself: its authored inline style (the Tree's items take none).
      ...(item.id === input.node.id ? { style: input.style } : {}),
      id: resolveStaticItemKey(item.props as Record<string, unknown>, item.id),
      title,
      textValue: label
        ? resolveTextSourceText("Text", label.props as Record<string, unknown>)
        : title,
      hasChildren: childItems.length > 0,
      showInfoButton: false,
      isDisabled: item.props.isDisabled === true,
      children: others.map((kid) => input.renderChild(kid.id)),
      childItems: childItems.length
        ? treeItemElements(input, childItems)
        : undefined,
    });
  });
}

const ownsAll = () => true;
const container =
  (
    tag: string,
    extra?: (input: DelegatedDomInput) => Record<string, unknown>,
  ) =>
  (input: DelegatedDomInput) =>
    createElement(
      tag,
      { ...marker(input), ...extra?.(input), style: input.style },
      ...renderAll(input),
    );
function fieldBase(input: DelegatedDomInput) {
  const props = input.node.props;
  const form = inheritedForm(input);
  return {
    ...marker(input),
    style: input.style,
    isDisabled: bool(props.isDisabled),
    isRequired: bool(props.isRequired),
    isReadOnly: bool(props.isReadOnly),
    isInvalid: bool(props.isInvalid),
    isQuiet: bool(props.isQuiet),
    necessityIndicator: props.necessityIndicator ?? form.necessityIndicator,
    labelPosition: props.labelPosition ?? form.labelPosition ?? "top",
    labelAlign: props.labelAlign ?? form.labelAlign,
    name: opt(props.name),
    autoFocus: bool(props.autoFocus),
  };
}
const inputHints = (props: CatalogConsumerNode["props"]) => ({
  autoComplete: opt(props.autoComplete),
  autoCorrect: opt(props.autoCorrect),
  inputMode: opt(props.inputMode),
  enterKeyHint: opt(props.enterKeyHint),
  spellCheck: opt(props.spellCheck),
});
function withI18n(
  element: ReactElement,
  locale: unknown,
  calendar?: unknown,
): ReactElement {
  if (!locale && !calendar) return element;
  const base = String(locale || "en-US");
  const tag = calendar ? `${base}-u-ca-${String(calendar)}` : base;
  return createElement(
    I18nProvider as ElementType,
    { key: element.key, locale: tag },
    element,
  );
}

/**
 * Marker for components that render no DOM of their own or drop DOM props (FileTrigger renders
 * a hidden input + press responder; DataField takes no rest props): the Preview's delegating
 * wrapper form, `display: contents`, so it adds no box.
 */
const markerWrap = (input: DelegatedDomInput, element: ReactElement) =>
  createElement(
    "div",
    { ...marker(input), style: { display: "contents" } },
    element,
  );

// ── bindings ───────────────────────────────────────────────────────────
const DELEGATED: Record<string, DelegatedDomBinding> = {
  tabs: {
    ownsChild: (child, _parent, root) =>
      !["TabList", "TabPanels"].includes(catalogTypeName(root, child)),
    absorbsChild: (child, _parent, root) =>
      catalogTypeName(root, child) === "TabPanels",
    // RAC renders only the selected TabPanel.
    ownsDescendant: (node, ancestor, root) => {
      if (catalogTypeName(root, node) !== "TabPanel") return false;
      const { pairs, selectedKey } = tabsModel(root, ancestor);
      return pairs.some(
        (pair) => pair.panel?.id === node.id && pair.key !== selectedKey,
      );
    },
    render: (input) => {
      const props = input.node.props;
      const tabList = childOf(input, "TabList");
      const { tabs, pairs } = tabsModel(input.root, input.node);
      return createElement(
        Tabs as ElementType,
        {
          ...marker(input),
          key: `${input.node.id}:${str(props.defaultSelectedKey)}`,
          style: input.style,
          // Absent key → RAC's own first-enabled-tab default on the first render.
          defaultSelectedKey: props.defaultSelectedKey || undefined,
          density: props.density || "regular",
          orientation: props.orientation || "horizontal",
          size: props.size || "md",
          isDisabled: bool(props.isDisabled),
        },
        createElement(
          TabList as ElementType,
          {
            key: tabList?.id ?? "tablist",
            ...(tabList ? { "data-catalog-id": tabList.id } : {}),
            density: props.density || "regular",
            size: props.size || "md",
            showIndicator: props.showIndicator !== false,
          },
          ...tabs.map((tab) => input.renderChild(tab.id)),
        ),
        ...pairs.flatMap(({ key, panel }) =>
          panel
            ? [
                createElement(
                  TabPanel as ElementType,
                  { key: panel.id, id: key, "data-catalog-id": panel.id },
                  ...childrenOf(input.root, panel).map((child) =>
                    input.renderChild(child.id),
                  ),
                ),
              ]
            : [],
        ),
      );
    },
  },
  taggroup: {
    ownsChild: (child, _parent, root) =>
      !["TagList", "Tag"].includes(catalogTypeName(root, child)),
    absorbsChild: (child, _parent, root) =>
      catalogTypeName(root, child) === "TagList",
    render: (input) => {
      const props = input.node.props;
      const list = childOf(input, "TagList");
      const tags = childrenOf(input.root, list ?? input.node).filter(
        (child) => catalogTypeName(input.root, child) === "Tag",
      );
      return createElement(TagGroup as ElementType, {
        ...marker(input),
        style: input.style,
        variant: str(props.variant || "default"),
        label: str(props.label),
        description: str(props.description),
        errorMessage: str(props.errorMessage),
        allowsRemoving: bool(props.allowsRemoving),
        selectionMode: props.selectionMode ?? "none",
        selectionBehavior: props.selectionBehavior || "toggle",
        selectedKeys: [],
        isDisabled: bool(props.isDisabled),
        disallowEmptySelection: bool(props.disallowEmptySelection),
        size: props.size || "md",
        labelPosition: props.labelPosition || "top",
        maxRows: typeof props.maxRows === "number" ? props.maxRows : undefined,
        staticItems: tags.length
          ? tags.map((tag) => ({
              text: childrenOf(input.root, tag)
                .filter((kid) => catalogTypeName(input.root, kid) === "Text")
                .map((kid) => str(kid.props.children))
                .join(" "),
              node: input.renderChild(tag.id),
            }))
          : undefined,
      });
    },
  },
  listbox: {
    ownsChild: (child, _parent, root) =>
      !["ListBoxItem", "ListBoxSection"].includes(catalogTypeName(root, child)),
    render: (input) => {
      const props = input.node.props;
      return createElement(
        ListBox as ElementType,
        {
          ...marker(input),
          style: input.style,
          "aria-label": str(props.label || "List"),
          variant: props.variant || undefined,
          orientation: props.orientation || "vertical",
          selectionMode: props.selectionMode ?? "none",
          disallowEmptySelection: bool(props.disallowEmptySelection),
          autoFocus: bool(props.autoFocus),
          defaultSelectedKeys:
            typeof props.selectedKey === "string" ? [props.selectedKey] : [],
        },
        ...renderAll(
          input,
          children(input).filter((child) =>
            ["ListBoxItem", "ListBoxSection"].includes(
              catalogTypeName(input.root, child),
            ),
          ),
        ),
      );
    },
  },
  gridlist: {
    ownsChild: (child, _parent, root) =>
      !["GridListItem", "GridListSection"].includes(
        catalogTypeName(root, child),
      ),
    render: (input) => {
      const props = input.node.props;
      return createElement(
        GridList as ElementType,
        {
          ...marker(input),
          style: input.style,
          "aria-label": str(props.label || "Grid List"),
          variant: props.variant || "default",
          isQuiet: bool(props.isQuiet),
          layout: props.layout || "grid",
          columns: Number(props.columns) || 2,
          selectionMode: props.selectionMode ?? "none",
          defaultSelectedKeys: [],
        },
        ...renderAll(
          input,
          children(input).filter((child) =>
            ["GridListItem", "GridListSection"].includes(
              catalogTypeName(input.root, child),
            ),
          ),
        ),
      );
    },
  },
  breadcrumbs: {
    ownsChild: (child, _parent, root) =>
      catalogTypeName(root, child) !== "Breadcrumb",
    render: (input) => {
      const props = input.node.props;
      return createElement(
        Breadcrumbs as ElementType,
        {
          ...marker(input),
          style: input.style,
          "data-size": str(props.size || "M"),
          "data-variant": str(props.variant || "default"),
          "aria-label":
            typeof props["aria-label"] === "string"
              ? props["aria-label"]
              : undefined,
          size: props.size,
          isDisabled: bool(props.isDisabled),
        },
        ...renderAll(
          input,
          children(input).filter(
            (child) => catalogTypeName(input.root, child) === "Breadcrumb",
          ),
        ),
      );
    },
  },
  menu: {
    // Items live in the closed menu popover; the static DOM is the trigger (Preview renderMenu).
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      return markerWrap(
        input,
        createElement(MenuButton as ElementType, {
          key: input.node.id,
          style: input.style,
          label: resolveTextSourceText(
            "Menu",
            props as Record<string, unknown>,
          ),
          "aria-label":
            typeof props["aria-label"] === "string"
              ? props["aria-label"]
              : undefined,
          variant: props.variant || "primary",
          size: props.size || "md",
          selectionMode: props.selectionMode,
        }),
      );
    },
  },
  tree: {
    // TreeItem children become RAC TreeItems (title/childItems); their other children render.
    // Nested items of a collapsed parent are not rendered (ADR-239 `expandedKeys`).
    ownsDescendant: (node, _ancestor, root) => {
      const parent = root.domInputs.get(node.parentId);
      const get = (id: string) => root.domInputs.get(id);
      const typeOf = (entry: CatalogConsumerNode) =>
        catalogTypeName(root, entry);
      return (
        !!parent &&
        typeOf(node) === "TreeItem" &&
        typeOf(parent) === "TreeItem" &&
        !catalogTreeItemExpanded(parent, get, typeOf)
      );
    },
    render: (input) => {
      const props = input.node.props;
      const items = (list: CatalogConsumerNode[]) =>
        treeItemElements(input, list);
      return createElement(
        Tree as ElementType,
        {
          ...marker(input),
          style: input.style,
          "aria-label": str(props["aria-label"] || props.label || "Tree"),
          selectionMode: props.selectionMode ?? "single",
          disallowEmptySelection: bool(props.disallowEmptySelection),
          selectionBehavior: props.selectionBehavior || "replace",
          expandedKeys: treeKeys(props.expandedKeys),
          // In the Preview the user's expansion is a runtime prop of the record (ADR-250); the
          // declared keys stay in the document.
          ...(input.setRuntimeProps
            ? {
                onExpandedChange: (keys: Iterable<unknown>) =>
                  input.setRuntimeProps!(input.node.id, {
                    expandedKeys: [...keys].map(String),
                  }),
              }
            : {}),
          defaultExpandedKeys: Array.isArray(props.defaultExpandedKeys)
            ? props.defaultExpandedKeys
            : [],
          selectedKeys: [],
          defaultSelectedKeys: [],
        },
        ...items(
          children(input).filter(
            (child) => catalogTypeName(input.root, child) === "TreeItem",
          ),
        ),
      );
    },
  },
  treeitem: {
    // A TreeItem outside a Tree (Preview orphan host): one row of a contents-only shared Tree, so
    // the `Tree.css` row (`[data-composition-tree]`) and its chevron apply (4e-11).
    ownsChild: ownsAll,
    render: (input) =>
      createElement(
        Tree as ElementType,
        {
          key: `host:${input.node.id}`,
          "aria-label": "TreeItem sample",
          style: { display: "contents" },
          selectionMode: "none",
        },
        ...treeItemElements(input, [input.node]),
      ),
  },
  tableview: {
    // The parts are composition divs drawn by the TableView itself (Preview renderTableView).
    render: (input) => {
      const props = input.node.props;
      const density = props.density as string | undefined;
      const part = (node: CatalogConsumerNode): ReactElement => {
        const type = catalogTypeName(input.root, node);
        const spec = TABLEVIEW_CHILD_STYLE[type];
        if (!spec) return input.renderChild(node.id);
        const paddingY =
          type === "Column" || type === "Cell"
            ? resolveCatalogDensityField(type, density, "paddingY")
            : undefined;
        const kids = childrenOf(input.root, node);
        return createElement(
          "div",
          {
            key: node.id,
            "data-catalog-id": node.id,
            "data-tableview-part": type,
            role: spec.role,
            style: {
              ...spec.style,
              ...(paddingY !== undefined
                ? { paddingTop: paddingY, paddingBottom: paddingY }
                : {}),
            },
          },
          ...(kids.length
            ? kids.map(part)
            : typeof node.props.children === "string"
              ? [node.props.children]
              : []),
        );
      };
      return createElement(
        "div",
        {
          ...marker(input),
          className: "react-aria-TableView",
          "data-variant": str(
            props.variant ?? (props.isQuiet === true ? "quiet" : "default"),
          ),
          "data-density": opt(density),
          role: "grid",
          style: { overflow: "hidden", ...input.style },
        },
        ...children(input).map(part),
      );
    },
  },
  filetrigger: {
    render: (input) => {
      const props = input.node.props;
      const list = children(input);
      return markerWrap(
        input,
        createElement(
          FileTriggerIntake as ElementType,
          {
            allowsMultiple: bool(props.allowsMultiple),
            acceptDirectory: bool(props.acceptDirectory),
            defaultCamera: props.defaultCamera,
          },
          ...(list.length
            ? renderAll(input, list)
            : [
                createElement(
                  AriaButton as ElementType,
                  {
                    key: "trigger",
                    className: "react-aria-FileTrigger",
                    "data-variant": str(props.variant || "default"),
                    "data-size": str(props.size || "md"),
                    isDisabled: bool(props.isDisabled),
                    style: input.style,
                  },
                  resolveTextSourceText(
                    "FileTrigger",
                    props as Record<string, unknown>,
                  ),
                ),
              ]),
        ),
      );
    },
  },
  fileupload: {
    render: (input) => {
      const props = input.node.props;
      const list = children(input);
      const isInput = (child: CatalogConsumerNode) =>
        FILE_UPLOAD_INPUT_CHILD_TYPES.has(catalogTypeName(input.root, child));
      return createElement(FileUpload as ElementType, {
        ...marker(input),
        style: input.style,
        endpoint: props.endpoint,
        chunkSize: props.chunkSize,
        parallelUploads: props.parallelUploads,
        maxFileSize: props.maxFileSize,
        allowsMultiple: props.allowsMultiple,
        acceptDirectory: props.acceptDirectory,
        autoProceed: props.autoProceed,
        showPreview: props.showPreview,
        isDisabled: bool(props.isDisabled),
        variant: props.variant,
        size: props.size,
        inputSurface: renderAll(input, list.filter(isInput)),
        sampleRows: renderAll(
          input,
          list.filter((child) => !isInput(child)),
        ),
      });
    },
  },
  textfield: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      return createElement(TextField as ElementType, {
        ...fieldBase(input),
        ...inputHints(props),
        size: props.size,
        label: str(props.label),
        description: str(props.description),
        errorMessage: str(props.errorMessage),
        placeholder: str(props.placeholder),
        type: props.type || "text",
        defaultValue: str(props.value),
        maxLength: num(props.maxLength),
        minLength: num(props.minLength),
        pattern: opt(props.pattern),
      });
    },
  },
  textarea: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      return createElement(TextArea as ElementType, {
        ...fieldBase(input),
        ...inputHints(props),
        size: props.size || "md",
        label: str(props.label),
        description: str(props.description),
        errorMessage: str(props.errorMessage),
        placeholder: str(props.placeholder),
        rows: num(props.rows),
        defaultValue: str(props.value),
        maxLength: num(props.maxLength),
        minLength: num(props.minLength),
      });
    },
  },
  numberfield: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      return createElement(NumberField as ElementType, {
        ...fieldBase(input),
        size: props.size || "md",
        label: str(props.label),
        description: str(props.description),
        errorMessage: str(props.errorMessage),
        defaultValue: Number(props.value || 0),
        minValue: num(props.minValue),
        maxValue: num(props.maxValue),
        step: num(props.step),
        locale: opt(props.locale),
        isWheelDisabled: bool(props.isWheelDisabled),
      });
    },
  },
  searchfield: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      const trigger = childOf(input, "SelectTrigger");
      const value = trigger
        ? childrenOf(input.root, trigger).find(
            (child) => catalogTypeName(input.root, child) === "SelectValue",
          )
        : undefined;
      return createElement(SearchField as ElementType, {
        ...fieldBase(input),
        ...inputHints(props),
        size: props.size || "md",
        label: propagatedText(input.root, props.label, childOf(input, "Label")),
        description: str(props.description),
        errorMessage: str(props.errorMessage),
        placeholder: value
          ? str(value.props.placeholder)
          : str(props.placeholder),
        defaultValue: str(props.value),
        maxLength: num(props.maxLength),
        minLength: num(props.minLength),
        pattern: opt(props.pattern),
      });
    },
  },
  datefield: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      const granularity = ["day", "hour", "minute", "second"].includes(
        String(props.granularity),
      )
        ? props.granularity
        : "day";
      return withI18n(
        createElement(DateField as ElementType, {
          ...fieldBase(input),
          label: propagatedText(
            input.root,
            props.label,
            childOf(input, "Label"),
            "Date",
          ),
          description: str(props.description),
          errorMessage: str(props.errorMessage),
          size: props.size || undefined,
          hideTimeZone: props.hideTimeZone !== false,
          shouldForceLeadingZeros: props.shouldForceLeadingZeros !== false,
          minValue: props.minValue,
          maxValue: props.maxValue,
          placeholderValue: props.placeholderValue,
          defaultValue:
            input.today?.() ?? dateFieldDefaultValue(String(granularity)),
          granularity,
          hourCycle: num(props.hourCycle),
        }),
        props.locale,
        props.calendar,
      );
    },
  },
  timefield: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      const granularity = ["hour", "minute", "second"].includes(
        String(props.granularity),
      )
        ? props.granularity
        : "minute";
      return withI18n(
        createElement(TimeField as ElementType, {
          ...fieldBase(input),
          label: propagatedText(
            input.root,
            props.label,
            childOf(input, "Label"),
            "Time",
          ),
          description: str(props.description),
          errorMessage: str(props.errorMessage),
          size: props.size || undefined,
          hideTimeZone: props.hideTimeZone !== false,
          shouldForceLeadingZeros: props.shouldForceLeadingZeros !== false,
          placeholderValue: props.placeholderValue,
          minValue: props.minValue,
          maxValue: props.maxValue,
          defaultValue: timeFieldDefaultValue(),
          granularity,
          hourCycle: num(props.hourCycle),
        }),
        props.locale,
      );
    },
  },
  colorfield: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      return createElement(ColorField as ElementType, {
        ...fieldBase(input),
        size: props.size || "md",
        label: opt(props.label),
        description: opt(props.description),
        errorMessage: opt(props.errorMessage),
        defaultValue: opt(props.defaultValue),
        channel: props.channel,
        colorSpace: props.colorSpace,
      });
    },
  },
  slider: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      return createElement(Slider as ElementType, {
        ...marker(input),
        style: input.style,
        label: str(props.label),
        defaultValue: [Number(props.value) || 50],
        minValue: Number(props.minValue) || 0,
        maxValue: Number(props.maxValue) || 100,
        step: Number(props.step) || 1,
        orientation: props.orientation || "horizontal",
        size: props.size || "md",
        isDisabled: bool(props.isDisabled),
        isEmphasized: bool(props.isEmphasized),
        showValueLabel: props.showValueLabel !== false,
        labelPosition: props.labelPosition || "top",
        locale: opt(props.locale),
      });
    },
  },
  progressbar: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      return createElement(ProgressBar as ElementType, {
        ...marker(input),
        style: input.style,
        label: propagatedText(input.root, props.label, childOf(input, "Label")),
        variant: props.variant || "default",
        value: Number(props.value || 0),
        minValue: props.minValue !== undefined ? Number(props.minValue) : 0,
        maxValue: props.maxValue !== undefined ? Number(props.maxValue) : 100,
        isIndeterminate: bool(props.isIndeterminate),
        size: props.size || "md",
        staticColor: props.staticColor,
        showValueLabel: props.showValueLabel !== false,
        valueLabel: opt(props.valueLabel),
        locale: opt(props.locale),
        labelPosition: props.labelPosition || "top",
      });
    },
  },
  meter: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      return createElement(Meter as ElementType, {
        ...marker(input),
        style: input.style,
        label: propagatedText(input.root, props.label, childOf(input, "Label")),
        value: Number(props.value || 0),
        minValue: props.minValue !== undefined ? Number(props.minValue) : 0,
        maxValue: props.maxValue !== undefined ? Number(props.maxValue) : 100,
        variant: props.variant || "informative",
        size: props.size || "md",
        showValueLabel: props.showValueLabel !== false,
        valueLabel: opt(props.valueLabel),
        locale: opt(props.locale),
        labelPosition: props.labelPosition || "top",
      });
    },
  },
  switch: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      return createElement(
        Switch as ElementType,
        {
          ...marker(input),
          style: input.style,
          defaultSelected: bool(props.isSelected),
          isDisabled: bool(props.isDisabled),
          isReadOnly: bool(props.isReadOnly),
          name: opt(props.name),
          value: opt(props.value),
          autoFocus: bool(props.autoFocus),
          isEmphasized: bool(props.isEmphasized),
          size: props.size || "md",
        },
        typeof props.children === "string" ? props.children : null,
      );
    },
  },
  checkbox: {
    render: (input) => {
      const props = input.node.props;
      const hasLabel = !!childOf(input, "Label");
      return createElement(
        Checkbox as ElementType,
        {
          ...marker(input),
          style: input.style,
          defaultSelected: bool(props.isSelected),
          isIndeterminate: bool(props.isIndeterminate),
          isDisabled: bool(props.isDisabled),
          isInvalid: bool(props.isInvalid),
          isReadOnly: bool(props.isReadOnly),
          isRequired: bool(props.isRequired),
          name: opt(props.name),
          value: opt(props.value),
          autoFocus: bool(props.autoFocus),
          isEmphasized: bool(props.isEmphasized),
          size: props.size || "md",
        },
        typeof props.children === "string" && !hasLabel ? props.children : null,
        ...renderAll(input),
      );
    },
  },
  checkboxgroup: {
    // The group label is read from the Label child; Checkbox children are composed by the group.
    // ADR-251: the items sit in the CheckboxItems node — the shared `CheckboxGroup` renders its
    // one `div.checkbox-items` around them, so the node itself is absorbed (TagGroup's TagList).
    ownsChild: (child, _parent, root) =>
      !["CheckboxItems", "Checkbox"].includes(catalogTypeName(root, child)),
    absorbsChild: (child, _parent, root) =>
      catalogTypeName(root, child) === "CheckboxItems",
    render: (input) => {
      const props = input.node.props;
      const items = childOf(input, "CheckboxItems");
      const boxes = (items ? childrenOf(input.root, items) : []).filter(
        (child) => catalogTypeName(input.root, child) === "Checkbox",
      );
      const selected = boxes
        .filter((box) => box.props.isSelected === true)
        .map((box) => box.id);
      return createElement(
        CheckboxGroup as ElementType,
        {
          ...marker(input),
          key: `${input.node.id}:${selected.join(",")}`,
          style: input.style,
          label:
            propagatedText(input.root, props.label, childOf(input, "Label")) ||
            undefined,
          defaultValue: selected,
          orientation: props.orientation || "vertical",
          size: props.size || "md",
          isDisabled: bool(props.isDisabled),
          isInvalid: bool(props.isInvalid),
          isReadOnly: bool(props.isReadOnly),
          isRequired: bool(props.isRequired),
          necessityIndicator: props.necessityIndicator,
          labelPosition: props.labelPosition || "top",
          name: opt(props.name),
          errorMessage: opt(props.errorMessage),
        },
        ...boxes.map((box) => {
          const labels = childrenOf(input.root, box).filter(
            (child) => catalogTypeName(input.root, child) === "Label",
          );
          return createElement(
            Checkbox as ElementType,
            {
              key: box.id,
              "data-catalog-id": box.id,
              value: box.id,
              isIndeterminate: bool(box.props.isIndeterminate),
              isDisabled: bool(box.props.isDisabled),
              // The item's resolved size: the group's (`CATALOG_SIZE_PROPAGATION`).
              size: box.props.size || "md",
            },
            ...(labels.length
              ? labels.map((label) => input.renderChild(label.id))
              : typeof box.props.children === "string"
                ? [box.props.children]
                : []),
          );
        }),
      );
    },
  },
  radiogroup: {
    // ADR-251: the items sit in the RadioItems node — the shared `RadioGroup` renders its one
    // `div.radio-items` around them, so the node itself is absorbed.
    ownsChild: (child, _parent, root) =>
      !["RadioItems", "Radio"].includes(catalogTypeName(root, child)),
    absorbsChild: (child, _parent, root) =>
      catalogTypeName(root, child) === "RadioItems",
    render: (input) => {
      const props = input.node.props;
      const items = childOf(input, "RadioItems");
      const radios = (items ? childrenOf(input.root, items) : []).filter(
        (child) => catalogTypeName(input.root, child) === "Radio",
      );
      const selected = radios.find((radio) => radio.props.isSelected === true);
      const value =
        selected?.props.value !== undefined
          ? String(selected.props.value)
          : str(props.value);
      return createElement(
        RadioGroup as ElementType,
        {
          ...marker(input),
          key: `${input.node.id}:${value}`,
          style: input.style,
          label:
            propagatedText(input.root, props.label, childOf(input, "Label")) ||
            undefined,
          defaultValue: value,
          orientation: props.orientation || "vertical",
          size: props.size || "md",
          isDisabled: bool(props.isDisabled),
          isInvalid: bool(props.isInvalid),
          isReadOnly: bool(props.isReadOnly),
          isRequired: bool(props.isRequired),
          necessityIndicator: props.necessityIndicator,
          labelPosition: props.labelPosition || "top",
          name: opt(props.name),
          errorMessage: opt(props.errorMessage),
        },
        ...radios.map((radio) => input.renderChild(radio.id)),
      );
    },
  },
  togglebutton: {
    render: (input) => {
      const props = input.node.props;
      const parent = input.root.domInputs.get(input.node.parentId);
      const inGroup =
        !!parent && catalogTypeName(input.root, parent) === "ToggleButtonGroup";
      return createElement(
        ToggleButton as ElementType,
        {
          ...marker(input),
          id: input.node.id,
          style: input.style,
          ...(inGroup ? {} : { defaultSelected: bool(props.isSelected) }),
          isDisabled: bool(props.isDisabled),
          autoFocus: bool(props.autoFocus),
          isEmphasized: bool(props.isEmphasized),
          isQuiet: bool(props.isQuiet),
          staticColor: props.staticColor || "auto",
          size: props.size || "md",
        },
        typeof props.children === "string" ? props.children : null,
        ...renderAll(input),
      );
    },
  },
  togglebuttongroup: {
    ownsChild: (child, _parent, root) =>
      catalogTypeName(root, child) !== "ToggleButton",
    render: (input) => {
      const props = input.node.props;
      const buttons = children(input).filter(
        (child) => catalogTypeName(input.root, child) === "ToggleButton",
      );
      const selected = new Set(
        buttons
          .filter((button) => button.props.isSelected === true)
          .map((button) => button.id),
      );
      return createElement(
        ToggleButtonGroup as ElementType,
        {
          ...marker(input),
          key: `${input.node.id}:${[...selected].sort().join(",")}`,
          style: input.style,
          orientation: props.orientation,
          selectionMode: props.selectionMode,
          disallowEmptySelection: bool(props.disallowEmptySelection),
          indicator: bool(props.indicator),
          isEmphasized: bool(props.isEmphasized),
          isQuiet: bool(props.isQuiet),
          staticColor: props.staticColor || "auto",
          size: props.size || "md",
          density: props.density || "regular",
          defaultSelectedKeys: selected,
        },
        ...buttons.map((button) => input.renderChild(button.id)),
      );
    },
  },
  buttongroup: {
    render: (input) => {
      const props = input.node.props;
      const justify: Record<string, string> = {
        start: "flex-start",
        center: "center",
        end: "flex-end",
      };
      const gap: Record<string, number> = {
        xs: 4,
        sm: 6,
        md: 8,
        lg: 10,
        xl: 12,
      };
      return createElement(
        "div",
        {
          ...marker(input),
          role: "group",
          style: {
            display: "flex",
            flexDirection: props.orientation === "vertical" ? "column" : "row",
            gap: gap[str(props.size || "md")] ?? 8,
            justifyContent: justify[str(props.align || "end")] ?? "flex-end",
            ...input.style,
          },
        },
        ...renderAll(input),
      );
    },
  },
  avatargroup: {
    render: (input) =>
      createElement(
        "div",
        {
          ...marker(input),
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            ...input.style,
          },
        },
        ...renderAll(input),
      ),
  },
  card: {
    render: (input) => {
      const props = input.node.props;
      const structural = children(input).some((child) =>
        ["CardHeader", "CardContent", "CardPreview", "CardFooter"].includes(
          catalogTypeName(input.root, child),
        ),
      );
      return createElement(
        Card as ElementType,
        {
          ...marker(input),
          style: input.style,
          "data-accent": opt(props.accentColor),
          cardType: props.cardType || undefined,
          variant: props.variant || undefined,
          size: props.size || "md",
          isQuiet: bool(props.isQuiet),
          isSelected: bool(props.isSelected),
          isDisabled: bool(props.isDisabled),
          isFocused: bool(props.isFocused),
          ...(structural ? { structuralChildren: true } : {}),
        },
        ...(structural || typeof props.children !== "string"
          ? []
          : [props.children]),
        ...renderAll(input),
      );
    },
  },
  cardpreview: {
    render: container("div", (input) => chrome(input, "CardPreview")),
  },
  cardheader: {
    render: container("div", (input) => chrome(input, "CardHeader")),
  },
  cardfooter: {
    render: container("div", (input) => chrome(input, "CardFooter")),
  },
  cardcontent: {
    // A Description child is a plain `div.react-aria-Description` (no RAC slot context in a card).
    render: (input) =>
      createElement(
        "div",
        {
          ...marker(input),
          ...chrome(input, "CardContent"),
          style: input.style,
        },
        ...children(input).map((child) =>
          catalogTypeName(input.root, child) === "Description"
            ? createElement(
                "div",
                {
                  key: child.id,
                  "data-catalog-id": child.id,
                  className: "react-aria-Description card-description",
                  "data-size": opt(child.props.size),
                  "data-variant": opt(child.props.variant),
                },
                typeof child.props.children === "string"
                  ? child.props.children
                  : typeof child.props.text === "string"
                    ? child.props.text
                    : null,
              )
            : input.renderChild(child.id),
        ),
      ),
  },
  cardview: {
    render: (input) =>
      createElement(
        "div",
        {
          ...marker(input),
          role: "grid",
          "aria-label": "Card collection",
          style: {
            display: "flex",
            flexWrap: "wrap",
            gap: Number(input.node.props.gap ?? 16),
            ...input.style,
          },
        },
        ...renderAll(input),
      ),
  },
  pagination: {
    render: container("nav", (input) => ({
      ...chrome(input, "Pagination"),
      "aria-label": "Pagination",
      "data-accent": opt(input.node.props.accentColor),
    })),
  },
  nav: {
    render: (input) =>
      createElement(
        "nav",
        {
          ...marker(input),
          ...chrome(input, "Nav"),
          "aria-label": str(input.node.props.label || "Navigation"),
          style: { display: "flex", alignItems: "center", ...input.style },
        },
        ...renderAll(input),
      ),
  },
  toast: {
    render: (input) => {
      const props = input.node.props;
      const list = children(input);
      return createElement(
        "div",
        {
          ...marker(input),
          role: "alert",
          "data-position": str(props.position || "top-right"),
          "data-variant": str(props.variant || "info"),
          "data-timeout": opt(props.timeout),
          "data-max-toasts": opt(props.maxToasts),
          "data-accent": opt(props.accentColor),
          style: input.style,
        },
        ...(list.length
          ? renderAll(input, list)
          : [
              (props.defaultTitle as ReactNode) ||
                (props.defaultDescription as ReactNode) ||
                (props.children as ReactNode) ||
                "Toast",
            ]),
      );
    },
  },
  disclosurecontent: {
    render: (input) => {
      const list = children(input);
      return createElement(
        "div",
        { ...marker(input), style: input.style },
        ...(list.length
          ? renderAll(input, list)
          : [str(input.node.props.children)]),
      );
    },
  },
  disclosure: {
    ownsChild: (child, _parent, root) =>
      ["DisclosureHeader", "Heading"].includes(catalogTypeName(root, child)),
    render: (input) => {
      const props = input.node.props;
      const header = childOf(input, "DisclosureHeader", "Heading");
      const title =
        header && catalogTypeName(input.root, header) === "DisclosureHeader"
          ? propagatedText(input.root, props.title, header)
          : header
            ? resolveTextSourceText(
                catalogTypeName(input.root, header),
                header.props as Record<string, unknown>,
              )
            : "";
      const parent = input.root.domInputs.get(input.node.parentId);
      const inGroup =
        !!parent && catalogTypeName(input.root, parent) === "DisclosureGroup";
      const expanded = Boolean(props.isExpanded ?? true);
      // In the Preview the user's expansion is a runtime prop of the record (ADR-250); a static
      // render shows the declared state.
      const runtime = !inGroup ? input.setRuntimeProps : undefined;
      return createElement(
        Disclosure as ElementType,
        {
          ...marker(input),
          key:
            inGroup || runtime ? input.node.id : `${input.node.id}:${expanded}`,
          id: input.node.id,
          style: input.style,
          title,
          size: props.size || "md",
          isDisabled: bool(props.isDisabled),
          ...(inGroup
            ? {}
            : runtime
              ? {
                  isExpanded: expanded,
                  onExpandedChange: (next: boolean) =>
                    runtime(input.node.id, { isExpanded: next }),
                }
              : { defaultExpanded: expanded }),
        },
        ...renderAll(
          input,
          children(input).filter(
            (child) =>
              !["DisclosureHeader", "Heading"].includes(
                catalogTypeName(input.root, child),
              ),
          ),
        ),
      );
    },
  },
  disclosuregroup: {
    // Its expansion is its Disclosures' `isExpanded` (declared, or the Preview's runtime value).
    watchesChildren: true,
    render: (input) => {
      const props = input.node.props;
      const list = children(input);
      const expanded = resolveGroupExpandedDisclosureIds(
        props as Record<string, unknown>,
        list.map((child) => ({
          id: child.id,
          type: catalogTypeName(input.root, child),
          props: {
            ...(child.props as Record<string, unknown>),
            ...input.runtimeProps?.(child.id),
          },
        })),
      );
      const disclosures = list.filter(
        (child) => catalogTypeName(input.root, child) === "Disclosure",
      );
      const keys = disclosures
        .filter((child) => expanded.has(child.id))
        .map((child) => child.id);
      // In the Preview the user's expansion is each Disclosure's runtime `isExpanded` (ADR-250); a
      // static render shows the declared state.
      const setRuntime = input.setRuntimeProps;
      const multiple = allowsMultipleExpanded(props as Record<string, unknown>);
      return createElement(
        DisclosureGroup as ElementType,
        {
          ...marker(input),
          key: `${input.node.id}:${multiple}`,
          style: input.style,
          "data-variant": str(props.variant || "default"),
          "data-size": str(props.size || "md"),
          allowsMultipleExpanded: multiple,
          isDisabled: bool(props.isDisabled),
          ...(setRuntime
            ? {
                expandedKeys: keys,
                onExpandedChange: (next: Set<unknown>) => {
                  for (const child of disclosures)
                    if (next.has(child.id) !== expanded.has(child.id))
                      setRuntime(child.id, { isExpanded: next.has(child.id) });
                },
              }
            : { defaultExpandedKeys: keys }),
        },
        ...renderAll(input, list),
      );
    },
  },
  colorpicker: {
    render: (input) =>
      createElement(
        "div",
        {
          ...marker(input),
          className: "react-aria-ColorPicker ",
          "data-size": str(input.node.props.size ?? "md"),
          "data-variant": opt(input.node.props.variant),
          style: input.style,
        },
        ...renderAll(input),
      ),
  },
  colorswatchpicker: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      const swatches = children(input).filter(
        (child) => catalogTypeName(input.root, child) === "ColorSwatch",
      );
      const color = (value: unknown) => {
        try {
          return parseColor(String(value || "#3b82f6"));
        } catch {
          return parseColor("#3b82f6");
        }
      };
      return createElement(
        ColorSwatchPicker as ElementType,
        {
          ...marker(input),
          style: input.style,
          ...(typeof props.defaultValue === "string" && props.defaultValue
            ? { defaultValue: props.defaultValue }
            : {}),
          ...(props.layout === "grid" || props.layout === "stack"
            ? { layout: props.layout }
            : {}),
        },
        ...swatches.map((swatch) =>
          createElement(ColorSwatchPickerItem as ElementType, {
            key: swatch.id,
            color: color(swatch.props.color || swatch.props.value),
            isDisabled: props.isDisabled === true,
          }),
        ),
      );
    },
  },
  field: {
    render: (input) => {
      const props = input.node.props;
      return markerWrap(
        input,
        createElement(
          DataField as ElementType,
          {
            key: input.node.id,
            style: input.style,
            fieldKey: props.key,
            label: props.label,
            type: props.type,
            value: props.value,
            showLabel: props.showLabel !== false,
            visible: props.visible !== false,
          },
          ...renderAll(input),
        ),
      );
    },
  },
  form: {
    render: (input) => {
      const props = input.node.props;
      return createElement(
        Form as ElementType,
        {
          ...marker(input),
          style: input.style,
          action: opt(props.action),
          method: props.method || undefined,
          encType: props.encType || undefined,
          target: props.target || undefined,
          autoFocus: bool(props.autoFocus),
          restoreFocus: bool(props.restoreFocus),
          validationBehavior: props.validationBehavior || undefined,
          labelPosition: props.labelPosition || undefined,
          labelAlign: props.labelAlign || undefined,
          necessityIndicator: props.necessityIndicator || undefined,
        },
        ...renderAll(input),
      );
    },
  },
  calendar: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      return createElement(Calendar as ElementType, {
        ...marker(input),
        style: input.style,
        headerStyle: calendarHeaderStyle(input),
        variant: props.variant || "default",
        size: props.size || "md",
        locale: props.locale,
        calendarSystem: props.calendarSystem,
        "aria-label":
          typeof props["aria-label"] === "string"
            ? props["aria-label"]
            : "Calendar",
        isDisabled: bool(props.isDisabled),
        isReadOnly: bool(props.isReadOnly),
        isInvalid: bool(props.isInvalid),
        maxVisibleMonths: Number(props.maxVisibleMonths) || 1,
        pageBehavior: props.pageBehavior === "single" ? "single" : "visible",
        defaultToday: props.defaultToday === true,
        minValue: props.minValue,
        maxValue: props.maxValue,
        defaultValue: props.defaultValue,
        defaultFocusedValue: props.defaultFocusedValue,
        autoFocus: bool(props.autoFocus),
        errorMessage: str(props.errorMessage),
      });
    },
  },
  rangecalendar: {
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      return createElement(RangeCalendar as ElementType, {
        ...marker(input),
        style: input.style,
        headerStyle: calendarHeaderStyle(input),
        variant: props.variant || "default",
        size: props.size || "md",
        locale: props.locale,
        calendarSystem: props.calendarSystem,
        "aria-label":
          typeof props["aria-label"] === "string"
            ? props["aria-label"]
            : "Range Calendar",
        isDisabled: bool(props.isDisabled),
        isReadOnly: bool(props.isReadOnly),
        isInvalid: bool(props.isInvalid),
        maxVisibleMonths: Number(props.maxVisibleMonths) || 1,
        pageBehavior: props.pageBehavior === "single" ? "single" : "visible",
        defaultToday: props.defaultToday === true,
        allowsNonContiguousRanges: bool(props.allowsNonContiguousRanges),
        minValue: props.minValue,
        maxValue: props.maxValue,
        defaultFocusedValue: props.defaultFocusedValue,
        errorMessage: str(props.errorMessage),
      });
    },
  },
};

/** Layout part of the CalendarHeader child's authored visual → `<header>` style (Preview B2). */
function calendarHeaderStyle(
  input: DelegatedDomInput,
): CSSProperties | undefined {
  const header = childOf(input, "CalendarHeader");
  if (!header) return undefined;
  const out: Record<string, unknown> = {};
  for (const key of [
    "display",
    "flexDirection",
    "justifyContent",
    "alignItems",
  ] as const)
    if (header.layout[key] !== undefined) out[key] = header.layout[key];
  for (const key of ["gap", "padding"] as const)
    if (header.visual[key] !== undefined) out[key] = header.visual[key];
  return Object.keys(out).length ? (out as CSSProperties) : undefined;
}

function tabsModel(
  root: CatalogCompositionRoot,
  tabsNode: CatalogConsumerNode,
) {
  return catalogTabsSelection(
    tabsNode,
    (id) => root.domInputs.get(id),
    (node) => catalogTypeName(root, node),
  );
}

export const CATALOG_DELEGATED_DOM: Readonly<
  Record<string, DelegatedDomBinding>
> = DELEGATED;
