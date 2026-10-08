import {
  createContext,
  createElement,
  useContext,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";
import { parseColor } from "react-aria-components/ColorPicker";
import { ColorSwatchPickerItem as AriaColorSwatchPickerItem } from "react-aria-components/ColorSwatchPicker";
import { I18nProvider } from "react-aria-components";
import { Button as AriaButton } from "react-aria-components/Button";
import {
  CheckboxButton as AriaCheckboxButton,
  CheckboxField as AriaCheckboxField,
} from "react-aria-components/Checkbox";
import {
  SwitchButton as AriaSwitchButton,
  SwitchField as AriaSwitchField,
} from "react-aria-components/Switch";
import {
  RadioButton as AriaRadioButton,
  RadioField as AriaRadioField,
  RadioGroup as AriaRadioGroup,
} from "react-aria-components/RadioGroup";
import { CheckboxGroup as AriaCheckboxGroup } from "react-aria-components/CheckboxGroup";
import { FieldError as AriaFieldError } from "react-aria-components/FieldError";
import { TextField as AriaTextField } from "react-aria-components/TextField";
import { ProgressBar as AriaProgressBar } from "react-aria-components/ProgressBar";
import { Meter as AriaMeter } from "react-aria-components/Meter";
import { Slider as AriaSlider } from "react-aria-components/Slider";
import { ColorField as AriaColorField } from "react-aria-components/ColorField";
import { DateField as AriaDateField } from "react-aria-components/DateField";
import { TimeField as AriaTimeField } from "react-aria-components/TimeField";
import { NumberField as AriaNumberField } from "react-aria-components/NumberField";
import { SearchField as AriaSearchField } from "react-aria-components/SearchField";
import { Select as AriaSelect } from "react-aria-components/Select";
import { ComboBox as AriaComboBox } from "react-aria-components/ComboBox";
import { DatePicker as AriaDatePicker } from "react-aria-components/DatePicker";
import { DateRangePicker as AriaDateRangePicker } from "react-aria-components/DateRangePicker";
import { Time } from "@internationalized/date";
import { safeParseDateString } from "../../utils/core/dateUtils";
import { ListBox as AriaListBox } from "react-aria-components/ListBox";
import { Text as AriaText } from "react-aria-components/Text";
import {
  FILE_UPLOAD_INPUT_CHILD_TYPES,
  FileUpload,
} from "../../components/FileUpload";
import { FileTriggerIntake } from "../../upload/intakeAdapters";
import { resolveTextSourceText, textFromValue } from "@composition/rendering";
import {
  OWNER_DRAWN_PART_HOSTS,
  OWNER_DRAWN_PART_OWNERS,
} from "@composition/shared";
import { catalogStateChildren, catalogStateFrame } from "./stateFrames";
import { racSlotProps } from "./racSlot";
import { RacSlotScope } from "./racSlotScope";
import {
  CATALOG_LABEL_NODE_FIELDS,
  FIELD_HINT_OWNERS,
  catalogFieldNecessityIndicator,
  catalogPartParent,
  catalogSliderRange,
} from "./presence";
import {
  type NecessityIndicator,
  renderNecessityIndicator,
} from "../../components/FieldNecessityIndicator";
import { Tabs, TabList, TabPanel } from "../../components/Tabs";
import { TabPanels as AriaTabPanels } from "react-aria-components/Tabs";
import { TagGroup } from "../../components/TagGroup";
import { ListBox } from "../../components/ListBox";
import { GridList } from "../../components/GridList";
import { Tree, TreeItem } from "../../components/Tree";
import { TreeItem as AriaTreeItem } from "react-aria-components/Tree";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
} from "react-aria-components/Breadcrumbs";
import { Menu as AriaMenu } from "react-aria-components/Menu";
import { MenuButton } from "../../components/Menu";
import { TABLEVIEW_CHILD_STYLE } from "./tableViewChildStyle";
import { resolveCatalogDensityField } from "../resolvers/resolveCatalogContainer";
import { resolveStaticItemKey } from "../slotRoles";
import {
  catalogDisclosureExpanded,
  catalogTabsSelection,
  catalogTreeItemExpanded,
} from "./presence";
import { Calendar } from "../../components/Calendar";
import { Card } from "../../components/Card";
import { CheckboxIndicatorBox } from "../../components/Checkbox";
import { ColorSwatchPicker } from "../../components/ColorSwatchPicker";
import { Disclosure as RacDisclosure } from "react-aria-components/Disclosure";
import { DisclosureGroup as RacDisclosureGroup } from "react-aria-components/DisclosureGroup";
import { DataField } from "../../components/Field";
import { Form } from "../../components/Form";
import { RangeCalendar } from "../../components/RangeCalendar";
import { ToggleButton } from "../../components/ToggleButton";
import { ToggleButtonGroup } from "../../components/ToggleButtonGroup";
import {
  allowsMultipleExpanded,
  resolveGroupExpandedDisclosureIds,
} from "../../utils/disclosureGroupExpansion";
import type { DefinitionId } from "../document/types";
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
  /**
   * A child record's resolved inline style (what its own binding inlines — `catalogDomStyle`): for
   * a child the renderer composes itself in place of the child's element (a Card's Description).
   */
  readonly childStyle?: (id: string) => CSSProperties;
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
 * RAC toggle draws `div.checkbox` · `::before` · `div.indicator`) and a Disclosure's chevron (the
 * shared Disclosure's trigger draws `svg.disclosure-chevron`). The record renders no element —
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
    const id = resolveStaticItemKey(
      item.props as Record<string, unknown>,
      item.id,
    );
    // ADR-256 Phase 5h — an item whose row is its `TreeItemContent` is the reference's RAC
    // `TreeItem`: the content node (RAC `TreeItemContent` — its chevron `Button`, text …) then the
    // child items.
    const content = others.find(
      (kid) => catalogTypeName(input.root, kid) === "TreeItemContent",
    );
    if (content) {
      const text = childrenOf(input.root, content).find(
        (kid) => catalogTypeName(input.root, kid) === "Text",
      );
      return createElement(
        AriaTreeItem as ElementType,
        {
          key: item.id,
          "data-catalog-id": item.id,
          ...(item.id === input.node.id ? { style: input.style } : {}),
          id,
          textValue: text
            ? resolveTextSourceText(
                "Text",
                text.props as Record<string, unknown>,
              )
            : "",
          isDisabled: item.props.isDisabled === true,
        },
        ...others.map((kid) => input.renderChild(kid.id)),
        ...treeItemElements(input, childItems),
      );
    }
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
      id,
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
/** A Menu's RAC collection children (ADR-256 Phase 5g: + SubmenuTrigger). */
const MENU_CHILD_TYPES: ReadonlySet<string> = new Set([
  "MenuItem",
  "SubmenuTrigger",
  "MenuSection",
  "Separator",
]);
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
export { CATALOG_LABEL_NODE_FIELDS };
/** The Label node of a field that draws its Label from it; `undefined` = the field composes it. */
export function catalogFieldLabelNode(
  root: CatalogCompositionRoot,
  field: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  if (CATALOG_LABEL_NODE_FIELDS[field.bindingId ?? ""] === undefined)
    return undefined;
  return childrenOf(root, field).find(
    (child) => catalogTypeName(root, child) === "Label",
  );
}
/** The necessity indicator a field appends to its Label node (`catalogFieldNecessityIndicator`). */
export function catalogFieldLabelNecessity(
  root: CatalogCompositionRoot,
  label: CatalogConsumerNode,
): ReactNode {
  const field = catalogDomPartParent(root, label);
  if (
    !field ||
    CATALOG_LABEL_NODE_FIELDS[field.bindingId ?? ""] !== "necessity"
  )
    return null;
  return renderNecessityIndicator(
    catalogFieldNecessityIndicator(
      field,
      (record) => root.domInputs.get(record.parentId),
      (record) => catalogTypeName(root, record),
    ) as NecessityIndicator | undefined,
    bool(field.props.isRequired),
  );
}
/**
 * The hint part nodes (`Description` · `FieldError`) of a field that draws them from its nodes
 * (`FIELD_HINT_OWNERS`): instances of the part origins, each drawn by its own binding inside the
 * field's RAC context.
 */
export function catalogFieldHintNodes(
  root: CatalogCompositionRoot,
  field: CatalogConsumerNode,
): { description?: CatalogConsumerNode; error?: CatalogConsumerNode } {
  if (!FIELD_HINT_OWNERS.has(catalogTypeName(root, field))) return {};
  const kids = childrenOf(root, field);
  const find = (type: string) =>
    kids.find((child) => catalogTypeName(root, child) === type);
  return { description: find("Description"), error: find("FieldError") };
}
/**
 * A field's `description` for its shared component: the Description node's element while the
 * field has a description (`renderFieldDescription` places it as it is), else the text.
 */
function fieldDescription(input: DelegatedDomInput, text: string): ReactNode {
  const node = catalogFieldHintNodes(input.root, input.node).description;
  return node && text ? input.renderChild(node.id) : text;
}
/**
 * A field's `errorMessage` for its shared component: the FieldError node's element (a RAC
 * FieldError — RAC shows it while the field is invalid), else the text.
 */
function fieldError(input: DelegatedDomInput, text: string): ReactNode {
  const node = catalogFieldHintNodes(input.root, input.node).error;
  return node ? input.renderChild(node.id) : text;
}
/**
 * A field's `label` for its shared component: the Label node's own element when the field shows
 * a label (`renderFieldLabel` places it as it is), else the text.
 */
function fieldLabel(input: DelegatedDomInput, text: string): ReactNode {
  const label = catalogFieldLabelNode(input.root, input.node);
  return label && text ? input.renderChild(label.id) : text;
}
/**
 * Fields whose control is their Input node (ADR-253): an instance of the Input origin, drawn by
 * its own binding inside the field's RAC context (a RAC `Input`; the `<textarea>` of a TextArea).
 */
export const CATALOG_INPUT_NODE_FIELDS: ReadonlySet<string> = new Set([
  "textfield",
  "textarea",
  "colorfield",
  "numberfield",
  "combobox",
  "searchfield",
]);
/**
 * Fields whose control is a wrapper node (a RAC `Group` — ADR-256 Phase 6b, `FIELD_CONTROL_GROUP_HOSTS`)
 * around part nodes (ADR-253): each part is drawn by its own binding inside the field's RAC
 * context, in the wrapper's order.
 */
export const CATALOG_WRAPPED_CONTROL_FIELDS: ReadonlySet<string> = new Set([
  "numberfield",
  "combobox",
  "searchfield",
  "datepicker",
  "daterangepicker",
]);
/**
 * The control part nodes of a field: those inside its control wrapper (`[]` = the field composes
 * them).
 */
export function catalogFieldControlNodes(
  root: CatalogCompositionRoot,
  field: CatalogConsumerNode,
): CatalogConsumerNode[] {
  if (!CATALOG_WRAPPED_CONTROL_FIELDS.has(field.bindingId ?? "")) return [];
  const wrapper = childrenOf(root, field).find(
    (child) => catalogTypeName(root, child) === "Group",
  );
  return wrapper ? childrenOf(root, wrapper) : [];
}
/** Pickers whose ListBox takes their RAC `ListBoxContext` (ADR-253 Phase 4 · ADR-256 Phase 6c · 6d). */
const LIST_PICKER_BINDINGS: ReadonlySet<string> = new Set([
  "select",
  "combobox",
]);
/**
 * The picker whose RAC `ListBoxContext` a ListBox node takes (its name, selection and focus — D1):
 * a ListBox in a Select · ComboBox — in its Popover, the reference's `Popover > ListBox` (ADR-256
 * Phase 6c · 6d), or its direct child (RAC's context reaches it there too).
 */
export function catalogListPicker(
  root: CatalogCompositionRoot,
  list: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  return pickerHost(root, list, LIST_PICKER_BINDINGS);
}
/** Pickers whose Calendar · RangeCalendar takes their RAC calendar context (ADR-256 Phase 6e). */
const CALENDAR_PICKER_BINDINGS: ReadonlySet<string> = new Set([
  "datepicker",
  "daterangepicker",
]);
/**
 * The picker whose RAC calendar context a Calendar · RangeCalendar node takes (its value, focus and
 * paging — D1): one in a DatePicker · DateRangePicker — in its Popover, the reference's `Popover >
 * Calendar` (ADR-256 Phase 6e), or its direct child (RAC's context reaches it there too).
 */
export function catalogCalendarPicker(
  root: CatalogCompositionRoot,
  calendar: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  return pickerHost(root, calendar, CALENDAR_PICKER_BINDINGS);
}
/**
 * A node's picker of `hosts`: its parent, or the parent of the Popover it is in — layout frames
 * between skipped (`catalogDomPartParent`: a frame keeps a part in its picker's RAC context).
 */
function pickerHost(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
  hosts: ReadonlySet<string>,
): CatalogConsumerNode | undefined {
  const parent = catalogDomPartParent(root, node);
  if (!parent) return undefined;
  const host =
    catalogTypeName(root, parent) === "Popover"
      ? catalogDomPartParent(root, parent)
      : parent;
  return hosts.has(host?.bindingId ?? "") ? host : undefined;
}
/**
 * A part node's parent with the layout frames it sits in skipped (`catalogPartParent` — ADR-256
 * G2: a frame around a field's parts keeps them in the field's RAC context).
 */
export function catalogDomPartParent(
  root: CatalogCompositionRoot,
  part: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  return catalogPartParent(
    part,
    (id) => root.domInputs.get(id),
    (record) => catalogTypeName(root, record),
  );
}
/**
 * The field a part node belongs to: its parent, or the parent of the control wrapper it is in
 * (layout frames skipped — `catalogDomPartParent`).
 */
export function catalogPartField(
  root: CatalogCompositionRoot,
  part: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  const parent = catalogDomPartParent(root, part);
  if (!parent || parent.bindingId !== "group") return parent;
  const field = catalogDomPartParent(root, parent);
  return field && CATALOG_WRAPPED_CONTROL_FIELDS.has(field.bindingId ?? "")
    ? field
    : parent;
}
/**
 * Date fields whose control is their DateInput node (ADR-253): an instance of the DateInput
 * origin, drawn by its own binding inside the field's RAC context (a RAC `DateInput` and its
 * segments).
 */
export const CATALOG_DATE_INPUT_NODE_FIELDS: ReadonlySet<string> = new Set([
  "datefield",
  "timefield",
  "datepicker",
  "daterangepicker",
]);
/**
 * The Input (a date field's DateInput) node of a field that draws its control from it;
 * `undefined` = the field composes it.
 */
export function catalogFieldInputNode(
  root: CatalogCompositionRoot,
  field: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  const type = CATALOG_INPUT_NODE_FIELDS.has(field.bindingId ?? "")
    ? "Input"
    : CATALOG_DATE_INPUT_NODE_FIELDS.has(field.bindingId ?? "")
      ? "DateInput"
      : undefined;
  if (!type) return undefined;
  return [
    ...childrenOf(root, field),
    ...catalogFieldControlNodes(root, field),
  ].find((child) => catalogTypeName(root, child) === type);
}
/**
 * A field's `isInvalid` for RAC: `true` while the document says so, else left unset. An explicit
 * `false` would fix the field as valid — RAC's own validation (required · type · pattern, shown
 * after the value is committed) could never show its error (ADR-253 Decision 5).
 */
export const authoredInvalid = (
  props: CatalogConsumerNode["props"],
): true | undefined => (props.isInvalid === true ? true : undefined);
function fieldBase(input: DelegatedDomInput) {
  const props = input.node.props;
  const form = inheritedForm(input);
  return {
    ...marker(input),
    style: input.style,
    isDisabled: bool(props.isDisabled),
    isRequired: bool(props.isRequired),
    isReadOnly: bool(props.isReadOnly),
    isInvalid: authoredInvalid(props),
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
  // (A calendar system alone extends the environment's locale — RAC's default.)
  const base = String(locale || globalThis.navigator?.language || "en-US");
  const tag = calendar ? `${base}-u-ca-${String(calendar)}` : base;
  return createElement(
    I18nProvider as ElementType,
    { key: element.key, locale: tag },
    element,
  );
}

/**
 * ADR-256 Decision 2 (Phase 2) — a field draws its node tree: the RAC field component and its
 * children in order, each by its own binding inside the field's RAC context (Label with the
 * necessity indicator · Input / DateInput · Description · FieldError, and any free child the
 * author put in). The field gives RAC only its own values: state, validation, value; the label
 * layout and quiet are data attributes its sheet reads. (The shared field components composed
 * the same root from props — they are no longer on the Preview path.)
 */
/**
 * A toggle's RAC button (ADR-256 Phase 3 — `CheckboxButton` · `SwitchButton`): its children in
 * order; the indicator node's place is the element RAC's state draws (a part its owner draws — the
 * node has no element of its own).
 */
type ToggleRenderProps = { isSelected: boolean; isIndeterminate?: boolean };
type ToggleIndicators = Readonly<
  Record<string, (key: string, state: ToggleRenderProps) => ReactElement>
>;
/**
 * The button's render state and indicator drawing, for an indicator node the author put in a layout
 * frame inside the button (RAC's render props reach only the button's direct children; the frame
 * passes this context through as RAC passes its own).
 */
const ToggleIndicatorContext = createContext<{
  readonly state: ToggleRenderProps;
  readonly indicators: ToggleIndicators;
} | null>(null);
function ToggleIndicatorPart({
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
 * The element a toggle indicator node stands for when it is not its button's direct child (inside a
 * layout frame in the button — ADR-256 Phase 3 review m1): the button's indicator, by its state.
 * Other parts their owner draws have no element here.
 */
export function catalogToggleIndicatorElement(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): ReactElement | null {
  const type = catalogTypeName(root, node);
  return OWNER_DRAWN_PART_HOSTS[
    catalogTypeName(root, catalogDomPartParent(root, node) ?? node)
  ] && OWNER_DRAWN_PART_OWNERS[type]
    ? createElement(ToggleIndicatorPart, {
        key: node.id,
        type,
        nodeKey: node.id,
      })
    : null;
}
function toggleButton(
  component: ElementType,
  className: string,
  indicators: ToggleIndicators,
): DelegatedDomBinding {
  return {
    render: (input) =>
      createElement(component, {
        ...marker(input),
        style: input.style,
        className,
        children: (state: ToggleRenderProps) =>
          // (Its render props are the state frame of the `showWhen` nodes inside — Decision 7.)
          catalogStateFrame(
            input.node.id,
            input.node.id,
            state,
            createElement(
              ToggleIndicatorContext.Provider,
              { value: { state, indicators } },
              ...input.node.children.map((id) => {
                const child = input.root.domInputs.get(id);
                const indicator = child
                  ? indicators[catalogTypeName(input.root, child)]
                  : undefined;
                return indicator ? indicator(id, state) : input.renderChild(id);
              }),
            ),
          ),
      }),
  };
}
/**
 * A CheckboxGroup's / RadioGroup's items in order: the toggles in the group's RAC context — under the
 * group, its items wrapper or a layout frame in them (as an item judges itself in the group,
 * `catalogDomPartParent`), not in a nested group.
 */
function groupItems(
  input: DelegatedDomInput,
  itemType: string,
  itemsType: string,
): CatalogConsumerNode[] {
  const visit = (node: CatalogConsumerNode): CatalogConsumerNode[] =>
    childrenOf(input.root, node).flatMap((child) => {
      const type = catalogTypeName(input.root, child);
      return type === itemType
        ? [child]
        : type === itemsType || type === "frame"
          ? visit(child)
          : [];
    });
  return visit(input.node);
}
/**
 * A ToggleButton outside a group: its selection held here (RAC's uncontrolled state, made
 * controlled), passed down as its state frame (ADR-256 Decision 7).
 */
function SelfToggleButton({
  ownerId,
  defaultSelected,
  isDisabled,
  render,
}: {
  ownerId: string;
  defaultSelected: boolean;
  isDisabled: boolean;
  render: (selection: Record<string, unknown>) => ReactElement;
}): ReactElement {
  const [isSelected, setSelected] = useState(defaultSelected);
  return catalogStateFrame(
    ownerId,
    ownerId,
    { isSelected, isDisabled },
    render({ isSelected, onChange: setSelected }),
  );
}
function nodeTreeField(
  component: ElementType,
  type: string,
  own: (props: CatalogConsumerNode["props"]) => Record<string, unknown>,
  i18n?: (props: CatalogConsumerNode["props"]) => [unknown, unknown?],
  defaultLabelAlign?: string,
): DelegatedDomBinding {
  return {
    render: (input) => {
      const props = input.node.props;
      const {
        necessityIndicator: _necessity,
        labelPosition,
        labelAlign,
        isQuiet,
        ...base
      } = fieldBase(input);
      const element = createElement(
        component,
        {
          ...base,
          className: `react-aria-${type}`,
          "data-size": str(props.size) || "md",
          "data-label-position": labelPosition,
          "data-label-align": labelAlign ?? defaultLabelAlign,
          "data-quiet": isQuiet ? "true" : undefined,
          ...own(props),
        },
        ...renderAll(input),
      );
      if (!i18n) return element;
      const [locale, calendar] = i18n(props);
      return withI18n(element, locale, calendar);
    },
  };
}
/** A date prop the document wrote as text (`2026-10-08`), parsed for RAC. */
const dateValue = (value: unknown) =>
  typeof value === "string" ? safeParseDateString(value) : value;
/** A DatePicker's · DateRangePicker's own RAC props (the parts take theirs from its context). */
const datePickerProps = (props: CatalogConsumerNode["props"]) => ({
  granularity: ["day", "hour", "minute", "second"].includes(
    String(props.granularity),
  )
    ? props.granularity
    : "day",
  minValue: dateValue(props.minValue),
  maxValue: dateValue(props.maxValue),
  hideTimeZone: props.hideTimeZone !== false,
  shouldForceLeadingZeros: props.shouldForceLeadingZeros !== false,
  shouldCloseOnSelect: props.shouldCloseOnSelect !== false,
  pageBehavior: props.pageBehavior === "single" ? "single" : undefined,
  validationBehavior: props.validationBehavior || undefined,
});
/** A time prop the document wrote as text (`HH:MM(:SS)`), parsed for RAC. */
function timeValue(value: unknown): unknown {
  if (typeof value !== "string") return value || undefined;
  const [hour, minute, second] = value
    .split(":")
    .map((part) => parseInt(part, 10));
  return hour !== undefined &&
    minute !== undefined &&
    !isNaN(hour) &&
    !isNaN(minute)
    ? new Time(hour, minute, second && !isNaN(second) ? second : 0)
    : undefined;
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
  // ADR-256 Phase 5e-2: Tabs draws its node tree — the reference `Tabs > (… TabList …) + TabPanels >
  // TabPanel`, with free content anywhere (a frame around the TabList, buttons beside it). Each part
  // renders itself in RAC's Tabs context (`tablist` · `tabpanels` · `tabpanel`).
  tabs: {
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
        ...renderAll(input),
      );
    },
  },
  tablist: {
    render: (input) => {
      const tabs = tabsAncestor(input.root, input.node);
      const props = tabs?.props ?? {};
      return createElement(
        TabList as ElementType,
        {
          ...marker(input),
          style: input.style,
          // (The list's accessible name — RAC requires one; the author's `aria-label`.)
          ...(input.node.ariaLabel
            ? { "aria-label": input.node.ariaLabel }
            : {}),
          density: props.density || "regular",
          size: props.size || "md",
          showIndicator: props.showIndicator !== false,
        },
        ...renderAll(input),
      );
    },
  },
  tabpanels: {
    render: (input) =>
      createElement(
        AriaTabPanels as ElementType,
        { ...marker(input), style: input.style },
        ...renderAll(input),
      ),
  },
  tabpanel: {
    render: (input) => {
      // (Its Tab's key — the pairing `catalogTabsSelection` makes.)
      const tabs = tabsAncestor(input.root, input.node);
      const key = tabs
        ? tabsModel(input.root, tabs).pairs.find(
            (pair) => pair.panel?.id === input.node.id,
          )?.key
        : undefined;
      return createElement(
        TabPanel as ElementType,
        { ...marker(input), style: input.style, id: key ?? input.node.id },
        ...renderAll(input),
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
      // ADR-256 Phase 5d: the reference's `Text[description]` · `Text[errorMessage]` are the
      // Description · FieldError part nodes (each shown while it has text — `presentWhen`).
      const hint = (type: string) => {
        const node = childOf(input, type);
        return node ? input.renderChild(node.id) : undefined;
      };
      return createElement(TagGroup as ElementType, {
        ...marker(input),
        style: input.style,
        variant: str(props.variant || "default"),
        label: fieldLabel(input, str(props.label)),
        description: hint("Description"),
        errorMessage: hint("FieldError"),
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
              id: resolveStaticItemKey(
                tag.props as Record<string, unknown>,
                tag.id,
              ),
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
      // A picker's list (ADR-253 Phase 4): RAC's Select · ComboBox own its name, selection and
      // focus (their context), and its sheet reads the picker's size.
      const picker = catalogListPicker(input.root, input.node);
      const inPicker = !!picker;
      // (RAC's ListBox itself, as the reference's pickers compose it: the shared ListBox's
      // variant marks are the standalone list's.)
      return createElement(
        (inPicker ? AriaListBox : ListBox) as ElementType,
        inPicker
          ? {
              ...marker(input),
              style: input.style,
              className: "react-aria-ListBox",
              "data-size": str(picker!.props.size || "md"),
            }
          : {
              ...marker(input),
              style: input.style,
              "aria-label": str(props.label || "List"),
              variant: props.variant || undefined,
              orientation: props.orientation || "vertical",
              selectionMode: props.selectionMode ?? "none",
              disallowEmptySelection: bool(props.disallowEmptySelection),
              autoFocus: bool(props.autoFocus),
              defaultSelectedKeys:
                typeof props.selectedKey === "string"
                  ? [props.selectedKey]
                  : [],
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
  // ADR-256 Phase 5a: a Breadcrumb is RAC `Breadcrumb` — its children in order (the reference's
  // `Link` and a separator Icon there while not current, `showWhen`); its render props
  // (`isCurrent` · `isDisabled`) are the state frame of the nodes inside. Outside a Breadcrumbs (a
  // Components page sample) RAC needs its collection: a host with no box, and a hidden next crumb
  // that keeps a non-current sample a link.
  breadcrumb: {
    render: (input) => {
      const props = input.node.props;
      const element = createElement(AriaBreadcrumb as ElementType, {
        ...marker(input),
        id: resolveStaticItemKey(
          props as Record<string, unknown>,
          input.node.id,
        ),
        style: input.style,
        className: "react-aria-Breadcrumb",
        children: catalogStateChildren(input.node.id, () => renderAll(input)),
      });
      const parent = input.root.domInputs.get(input.node.parentId);
      if (parent && catalogTypeName(input.root, parent) === "Breadcrumbs")
        return element;
      return createElement(
        AriaBreadcrumbs as ElementType,
        {
          key: `host:${input.node.id}`,
          "aria-label": "Breadcrumb sample",
          style: { display: "contents" },
        },
        element,
        ...(input.node.displayState !== "current"
          ? [
              createElement(AriaBreadcrumb as ElementType, {
                key: "__orphan-next",
                id: "__orphan-next",
                style: { display: "none" },
              }),
            ]
          : []),
      );
    },
  },
  menu: {
    // Items live in the closed menu popover; the static DOM is the trigger (Preview renderMenu).
    ownsChild: ownsAll,
    render: (input) => {
      const props = input.node.props;
      const items = () =>
        renderAll(
          input,
          children(input).filter((child) =>
            MENU_CHILD_TYPES.has(catalogTypeName(input.root, child)),
          ),
        );
      // ADR-256 Phase 5g: a submenu (`SubmenuTrigger > MenuItem + Popover > Menu`) is the RAC Menu
      // alone — its SubmenuTrigger is the trigger (RAC's `MenuContext` · the Popover's).
      const popover = input.root.domInputs.get(input.node.parentId);
      const trigger = popover && input.root.domInputs.get(popover.parentId);
      if (
        popover &&
        trigger &&
        catalogTypeName(input.root, popover) === "Popover" &&
        catalogTypeName(input.root, trigger) === "SubmenuTrigger"
      )
        return createElement(
          AriaMenu as ElementType,
          {
            key: input.node.id,
            "data-catalog-id": input.node.id,
            className: "react-aria-Menu",
            "data-size": props.size || "md",
            style: input.style,
            ...(typeof props["aria-label"] === "string"
              ? { "aria-label": props["aria-label"] }
              : {}),
            ...(props.selectionMode
              ? { selectionMode: props.selectionMode }
              : {}),
          },
          ...items(),
        );
      return markerWrap(
        input,
        createElement(
          MenuButton as ElementType,
          {
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
          },
          ...items(),
        ),
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
          // RSP `selectionStyle` (checkbox → RAC `toggle`, highlight → `replace`): the shared Tree
          // converts it (`resolveSelectionBehavior`, highlight when unset).
          selectionStyle: props.selectionStyle,
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
          // The selection is the Preview's run state (RAC's own, as GridList's): a pressed row ·
          // selection checkbox selects it (ADR-256 Phase 5h-2 — a pinned empty selection left the
          // checkbox inert).
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
  textfield: nodeTreeField(AriaTextField, "TextField", (props) => ({
    ...inputHints(props),
    defaultValue: str(props.value),
    maxLength: num(props.maxLength),
    minLength: num(props.minLength),
    pattern: opt(props.pattern),
  })),
  textarea: nodeTreeField(AriaTextField, "TextField", (props) => ({
    ...inputHints(props),
    defaultValue: str(props.value),
    maxLength: num(props.maxLength),
    minLength: num(props.minLength),
  })),
  numberfield: nodeTreeField(AriaNumberField, "NumberField", (props) => ({
    defaultValue: Number(props.value || 0),
    minValue: num(props.minValue),
    maxValue: num(props.maxValue),
    step: num(props.step),
    locale: opt(props.locale),
    isWheelDisabled: bool(props.isWheelDisabled),
  })),
  // ADR-256 Phase 6c: the reference's tree — `Select > Label + Button(SelectValue + Icon) +
  // Text[description] + FieldError + Popover > ListBox`, each part in RAC's Select context (its
  // Popover takes the Select's trigger and place — `PopoverContext`). Without a visible label the
  // Select is named by its placeholder (RAC needs a label or an `aria-label`).
  select: nodeTreeField(AriaSelect, "Select", (props) => ({
    placeholder: opt(props.placeholder),
    "aria-label": str(props.label).trim()
      ? undefined
      : (opt(props.placeholder) ?? "Select an option"),
  })),
  // ADR-256 Phase 6d: the reference's tree — `ComboBox > Label + Group(Input + Button) +
  // Text[description] + FieldError + Popover > ListBox`, each part in RAC's ComboBox context (its
  // Popover takes the Group as trigger and its place — `PopoverContext`). Without a visible label
  // the ComboBox is named by its placeholder (RAC needs a label or an `aria-label`).
  combobox: nodeTreeField(AriaComboBox, "ComboBox", (props) => ({
    allowsCustomValue: bool(props.allowsCustomValue),
    menuTrigger: opt(props.menuTrigger),
    "aria-label": str(props.label).trim()
      ? undefined
      : (opt(props.placeholder) ?? "Select an option"),
  })),
  // ADR-256 Phase 6e: the reference's tree — `DatePicker > Label + Group(DateInput + Button) +
  // Text[description] + FieldError + Popover > Calendar` (a DateRangePicker's pair of DateInputs and
  // RangeCalendar), each part in RAC's picker context (its Popover takes the Group as trigger and its
  // place — `PopoverContext`; its calendar the value · `pageBehavior` — `CalendarContext`).
  datepicker: nodeTreeField(
    AriaDatePicker,
    "DatePicker",
    (props) => ({
      ...datePickerProps(props),
      "aria-label": str(props.label).trim() ? undefined : "Date Picker",
    }),
    (props) => [props.locale, props.calendarSystem],
  ),
  daterangepicker: nodeTreeField(
    AriaDateRangePicker,
    "DateRangePicker",
    (props) => ({
      ...datePickerProps(props),
      hourCycle: num(props.hourCycle),
      allowsNonContiguousRanges: bool(props.allowsNonContiguousRanges),
      startName: opt(props.startName),
      endName: opt(props.endName),
      "aria-label": str(props.label).trim() ? undefined : "Date Range",
    }),
    (props) => [props.locale, props.calendarSystem],
  ),
  searchfield: nodeTreeField(AriaSearchField, "SearchField", (props) => ({
    ...inputHints(props),
    defaultValue: str(props.value),
    maxLength: num(props.maxLength),
    minLength: num(props.minLength),
    pattern: opt(props.pattern),
  })),
  datefield: nodeTreeField(
    AriaDateField,
    "DateField",
    (props) => ({
      hideTimeZone: props.hideTimeZone !== false,
      shouldForceLeadingZeros: props.shouldForceLeadingZeros !== false,
      minValue: dateValue(props.minValue),
      maxValue: dateValue(props.maxValue),
      // No value of its own: the empty segments (RAC · RSP — the Canvas draws the same).
      placeholderValue:
        typeof props.placeholderValue === "string"
          ? safeParseDateString(props.placeholderValue)
          : undefined,
      granularity: ["day", "hour", "minute", "second"].includes(
        String(props.granularity),
      )
        ? props.granularity
        : "day",
      hourCycle: num(props.hourCycle),
    }),
    (props) => [props.locale, props.calendarSystem],
  ),
  timefield: nodeTreeField(
    AriaTimeField,
    "TimeField",
    (props) => ({
      hourCycle: num(props.hourCycle) ?? 24,
      placeholderValue: timeValue(props.placeholderValue),
      minValue: timeValue(props.minValue),
      maxValue: timeValue(props.maxValue),
      hideTimeZone: props.hideTimeZone !== false,
      shouldForceLeadingZeros: props.shouldForceLeadingZeros !== false,
      granularity: ["hour", "minute", "second"].includes(
        String(props.granularity),
      )
        ? props.granularity
        : "minute",
    }),
    (props) => [props.locale],
  ),
  colorfield: nodeTreeField(
    AriaColorField,
    "ColorField",
    (props) => ({
      defaultValue: opt(props.defaultValue),
      channel: props.channel,
      colorSpace: props.colorSpace,
    }),
    undefined,
    "start",
  ),
  // ADR-256 Phase 7c: the Slider is RAC's, its children in order — the reference `Label` +
  // `SliderOutput` + `SliderTrack > SliderFill + SliderThumb`, and anything the author put in.
  slider: {
    render: (input) => {
      const props = input.node.props;
      const { min, max, value } = catalogSliderRange(input.node);
      return withI18n(
        createElement(AriaSlider as ElementType, {
          ...marker(input),
          // (RAC's value is the run state — `defaultValue`; a document edit of the value starts it
          // again, as a Tabs' selected key does.)
          key: `${input.node.id}:${value}`,
          style: input.style,
          className: "react-aria-Slider",
          "data-size": str(props.size) || "md",
          "data-label-position": str(props.labelPosition) || "top",
          "data-emphasized": bool(props.isEmphasized) || undefined,
          defaultValue: value,
          minValue: min,
          maxValue: max,
          step: num(props.step) ?? 1,
          isDisabled: bool(props.isDisabled),
          // (No visible label: RAC needs a name — the type's own.)
          "aria-label": str(props.label).trim() ? undefined : "Slider",
          children: catalogStateChildren(input.node.id, () => renderAll(input)),
        }),
        props.locale,
      );
    },
  },
  // ADR-256 Phase 7a: the ProgressBar is RAC's, its children in order — the reference `Label` +
  // value text (`{valueText}`) + track > fill (`width: {percentage}%`), and anything the author put
  // in. Its render props are the state frame the bound parts read (Decision 12 — `stateFrames.tsx`).
  progressbar: {
    render: (input) => {
      const props = input.node.props;
      const staticColor = props.staticColor;
      return withI18n(
        createElement(AriaProgressBar as ElementType, {
          ...marker(input),
          style: input.style,
          className: "react-aria-ProgressBar",
          "data-variant": str(props.variant) || "default",
          "data-size": str(props.size) || "md",
          "data-label-position": str(props.labelPosition) || "top",
          "data-indeterminate": bool(props.isIndeterminate) ? "true" : undefined,
          "data-static-color":
            staticColor === "white" || staticColor === "black"
              ? staticColor
              : undefined,
          value: num(props.value) ?? 0,
          minValue: num(props.minValue) ?? 0,
          maxValue: num(props.maxValue) ?? 100,
          isIndeterminate: bool(props.isIndeterminate),
          valueLabel: opt(props.valueLabel),
          // (No visible label: RAC needs a name — the type's own.)
          "aria-label": str(props.label).trim() ? undefined : "Progress",
          children: catalogStateChildren(input.node.id, () => renderAll(input)),
        }),
        props.locale,
      );
    },
  },
  // ADR-256 Phase 7b: the Meter is RAC's, its children in order — `Label` + value text
  // (`{valueText}`) + track > fill (`width: {percentage}%`) and anything the author put in; its
  // render props are the frame the bound parts read (Decision 12).
  meter: {
    render: (input) => {
      const props = input.node.props;
      return withI18n(
        createElement(AriaMeter as ElementType, {
          ...marker(input),
          style: input.style,
          className: "react-aria-Meter",
          "data-variant": str(props.variant) || "informative",
          "data-size": str(props.size) || "md",
          "data-label-position": str(props.labelPosition) || "top",
          value: num(props.value) ?? 0,
          minValue: num(props.minValue) ?? 0,
          maxValue: num(props.maxValue) ?? 100,
          valueLabel: opt(props.valueLabel),
          // (No visible label: RAC needs a name — the type's own.)
          "aria-label": str(props.label).trim() ? undefined : "Meter",
          children: catalogStateChildren(input.node.id, () => renderAll(input)),
        }),
        props.locale,
      );
    },
  },
  // ADR-256 Phase 3: the Switch is RAC `SwitchField` — its children in order (the SwitchButton, a
  // Description, a FieldError, anything the author put in).
  switch: {
    render: (input) => {
      const props = input.node.props;
      return createElement(AriaSwitchField as ElementType, {
        ...marker(input),
        style: input.style,
        className: "react-aria-Switch",
        "data-size": str(props.size) || "md",
        "data-emphasized": bool(props.isEmphasized) || undefined,
        defaultSelected: bool(props.isSelected),
        isDisabled: bool(props.isDisabled),
        isReadOnly: bool(props.isReadOnly),
        name: opt(props.name),
        value: opt(props.value),
        autoFocus: bool(props.autoFocus),
        // (Its render props are the state frame of the `showWhen` nodes inside — Decision 7.)
        children: catalogStateChildren(input.node.id, () => renderAll(input)),
      });
    },
  },
  // ADR-256 Phase 3: the Radio is RAC `RadioField` — its children in order (the RadioButton, a
  // Description, anything the author put in). Outside a RadioGroup it needs RAC's group state: a
  // host group with no box of its own (`display: contents` — the old `hostOrphanRadio`).
  radio: {
    render: (input) => {
      const props = input.node.props;
      const element = createElement(AriaRadioField as ElementType, {
        ...marker(input),
        style: input.style,
        className: "react-aria-Radio",
        "data-size": str(props.size) || "md",
        "data-variant": str(props.variant) || "default",
        value: str(props.value),
        isDisabled: bool(props.isDisabled),
        autoFocus: bool(props.autoFocus),
        // (Its render props are the state frame of the `showWhen` nodes inside — Decision 7.)
        children: catalogStateChildren(input.node.id, () => renderAll(input)),
      });
      for (
        let parent = input.root.domInputs.get(input.node.parentId);
        parent;
        parent = input.root.domInputs.get(parent.parentId)
      )
        if (catalogTypeName(input.root, parent) === "RadioGroup")
          return element;
      return createElement(
        AriaRadioGroup,
        {
          key: `host:${input.node.id}`,
          "aria-label": "Radio sample",
          value: props.isSelected === true ? str(props.value) : null,
          style: { display: "contents" },
        },
        element,
      );
    },
  },
  // ADR-256 Phase 3: the Radio's RAC `RadioButton` (the `label`) — its children in order; the
  // RadioIndicator node's place is the ring (`div.indicator` — `Radio.css`, the reference's).
  radiobutton: toggleButton(AriaRadioButton, "react-aria-RadioButton", {
    RadioIndicator: (key) =>
      createElement("div", { key, className: "indicator" }),
  }),
  // ADR-256 Phase 3: the Switch's RAC `SwitchButton` (the `label`) — its children in order; the
  // SwitchIndicator node's place is the track (`div.indicator` — `Switch.css`).
  switchbutton: toggleButton(AriaSwitchButton, "react-aria-SwitchButton", {
    SwitchIndicator: (key) =>
      createElement("div", { key, className: "indicator" }),
  }),
  // ADR-256 Phase 3: the Checkbox is RAC `CheckboxField` — its children in order (the CheckboxButton,
  // a Description, a FieldError, anything the author put in). In a CheckboxGroup it is one of the
  // group's values (its record id — the group's `defaultValue`). Phase 5f: its authored slot
  // connects it to the RAC context it renders in — a collection item's `selection` gives it the
  // item's selection (state · name · handler), so its own state props stay out (RAC merges the
  // element's props over the context's).
  checkbox: {
    render: (input) => {
      const props = input.node.props;
      const host = catalogDomPartParent(input.root, input.node);
      const inGroup =
        host !== undefined &&
        ["CheckboxItems", "CheckboxGroup"].includes(
          catalogTypeName(input.root, host),
        );
      return createElement(RacSlotScope, {
        key: input.node.id,
        context: "Checkbox",
        authored: props.slot,
        render: (resolution) =>
          createElement(AriaCheckboxField as ElementType, {
            "data-catalog-id": input.node.id,
            ...racSlotProps(resolution),
            style: input.style,
            className: "react-aria-Checkbox",
            "data-size": str(props.size) || "md",
            "data-emphasized": bool(props.isEmphasized) || undefined,
            ...(resolution.kind === "named"
              ? {}
              : {
                  ...(inGroup
                    ? { value: input.node.id }
                    : {
                        defaultSelected: bool(props.isSelected),
                        name: opt(props.name),
                        value: opt(props.value),
                      }),
                  isIndeterminate: bool(props.isIndeterminate),
                  isDisabled: bool(props.isDisabled),
                }),
            isInvalid: bool(props.isInvalid),
            isReadOnly: bool(props.isReadOnly),
            isRequired: bool(props.isRequired),
            autoFocus: bool(props.autoFocus),
            // (Its render props are the state frame of the `showWhen` nodes inside — Decision 7.)
            children: catalogStateChildren(input.node.id, () =>
              renderAll(input),
            ),
          }),
      });
    },
  },
  // ADR-256 Phase 3: the Checkbox's RAC `CheckboxButton` (the `label`) — its children in order; the
  // CheckboxIndicator node's place is the indicator box, drawn by RAC's state (a part its owner
  // draws: the node has no element of its own).
  checkboxbutton: toggleButton(
    AriaCheckboxButton,
    "react-aria-CheckboxButton",
    {
      CheckboxIndicator: (key, { isSelected, isIndeterminate }) =>
        createElement(CheckboxIndicatorBox, {
          key,
          isSelected,
          isIndeterminate: isIndeterminate === true,
        }),
    },
  ),

  // ADR-256 Phase 3: a CheckboxGroup is RAC `CheckboxGroup` — its children in order (the Label, the
  // items wrapper, a Description, a FieldError, anything the author put in). Its value is the
  // selected items' record ids (each item is a `CheckboxField` with its record id — `checkbox`).
  checkboxgroup: {
    render: (input) => {
      const props = input.node.props;
      const boxes = groupItems(input, "Checkbox", "CheckboxItems");
      const selected = boxes
        .filter((box) => box.props.isSelected === true)
        .map((box) => box.id);
      const size = str(props.size) || "md";
      return createElement(
        AriaCheckboxGroup as ElementType,
        {
          ...marker(input),
          key: `${input.node.id}:${selected.join(",")}`,
          style: input.style,
          className: "react-aria-CheckboxGroup",
          "data-orientation": str(props.orientation) || "vertical",
          "data-checkbox-size": size,
          "data-size": size,
          "data-label-position": str(props.labelPosition) || "top",
          defaultValue: selected,
          isDisabled: bool(props.isDisabled),
          isInvalid: authoredInvalid(props),
          isReadOnly: bool(props.isReadOnly),
          isRequired: bool(props.isRequired),
          name: opt(props.name),
        },
        ...renderAll(input),
      );
    },
  },
  // ADR-251 · ADR-256 Phase 3: a group's items wrapper is the reference's `div.checkbox-items` /
  // `div.radio-items` (outside RAC's structure, no role) — its children in order, with its node's
  // marker. Its box is the group rule's (`orientation` block); it takes no authored style (as the
  // Canvas paints none).
  checkboxitems: {
    render: (input) =>
      createElement(
        "div",
        { ...marker(input), className: "checkbox-items" },
        ...renderAll(input),
      ),
  },
  radioitems: {
    render: (input) =>
      createElement(
        "div",
        { ...marker(input), className: "radio-items" },
        ...renderAll(input),
      ),
  },
  // ADR-256 Phase 3: a RadioGroup is RAC `RadioGroup` — its children in order. Its value is the
  // first selected item's (each item is a `RadioField` with its `value` — `radio`), else its own.
  radiogroup: {
    render: (input) => {
      const props = input.node.props;
      const radios = groupItems(input, "Radio", "RadioItems");
      const selected = radios.find((radio) => radio.props.isSelected === true);
      const value =
        selected?.props.value !== undefined
          ? String(selected.props.value)
          : str(props.value);
      const size = str(props.size) || "md";
      return createElement(
        AriaRadioGroup as ElementType,
        {
          ...marker(input),
          key: `${input.node.id}:${value}`,
          style: input.style,
          className: "react-aria-RadioGroup",
          "data-radio-variant": str(props.variant) || "default",
          "data-radio-size": size,
          "data-size": size,
          "data-label-position": str(props.labelPosition) || "top",
          defaultValue: value,
          orientation: str(props.orientation) || "vertical",
          isDisabled: bool(props.isDisabled),
          isInvalid: authoredInvalid(props),
          isReadOnly: bool(props.isReadOnly),
          isRequired: bool(props.isRequired),
          name: opt(props.name),
        },
        ...renderAll(input),
      );
    },
  },
  togglebutton: {
    render: (input) => {
      const props = input.node.props;
      const parent = input.root.domInputs.get(input.node.parentId);
      const inGroup =
        !!parent && catalogTypeName(input.root, parent) === "ToggleButtonGroup";
      // Outside a group its selection is its own (RAC state): tracked so the `showWhen` nodes inside
      // read it (ADR-256 Decision 7 — the shared ToggleButton draws children, not RAC's function).
      if (!inGroup)
        return createElement(SelfToggleButton, {
          key: `${input.node.id}:${bool(props.isSelected)}`,
          ownerId: input.node.id,
          defaultSelected: bool(props.isSelected),
          isDisabled: bool(props.isDisabled),
          render: (selection: Record<string, unknown>) =>
            createElement(
              ToggleButton as ElementType,
              {
                ...marker(input),
                id: input.node.id,
                style: input.style,
                ...selection,
                isDisabled: bool(props.isDisabled),
                autoFocus: bool(props.autoFocus),
                isEmphasized: bool(props.isEmphasized),
                isQuiet: bool(props.isQuiet),
                staticColor: props.staticColor || "auto",
                size: props.size || "md",
              },
              typeof props.children === "string" ? props.children : null,
              ...renderAll(input),
            ),
        });
      return createElement(
        ToggleButton as ElementType,
        {
          ...marker(input),
          id: input.node.id,
          style: input.style,
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
  // ADR-256 Phase 3: a ToggleButtonGroup draws its children in order (its ToggleButtons and anything
  // the author put in) — the shared group gives its buttons the S2 contexts (indicator · emphasized ·
  // quiet · static color).
  togglebuttongroup: {
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
          // (Only when disabled — RAC writes `aria-disabled` for any boolean.)
          isDisabled: bool(props.isDisabled) || undefined,
        },
        ...renderAll(input),
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
    // A Description child is a plain `div.react-aria-Description` (no RAC slot context in a card),
    // drawn with the Description node's own style — an instance of the Description origin
    // (ADR-254), so the origin's edits and the card's patch reach it as on the Canvas.
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
                  style: input.childStyle?.(child.id),
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
  // ADR-256 Phase 8c: RAC Disclosure draws its node tree in order — the reference
  // `Heading > Button[slot=trigger] > (chevron + title)` + `DisclosurePanel` (the starter's; RAC's
  // contexts link the trigger and the panel). Its expansion: the declared state, the Preview's runtime
  // value (ADR-250), or its DisclosureGroup's.
  disclosure: {
    render: (input) => {
      const props = input.node.props;
      const parent = input.root.domInputs.get(input.node.parentId);
      const inGroup =
        !!parent && catalogTypeName(input.root, parent) === "DisclosureGroup";
      const expanded = Boolean(props.isExpanded ?? true);
      // In the Preview the user's expansion is a runtime prop of the record (ADR-250); a static
      // render shows the declared state.
      const runtime = !inGroup ? input.setRuntimeProps : undefined;
      // (Its state for the `showWhen` nodes inside — ADR-256 Decision 7: the expansion is its prop,
      // the Preview's runtime value, else the group's.)
      const frame = (element: ReactElement) =>
        catalogStateFrame(
          input.node.id,
          input.node.id,
          {
            isExpanded: inGroup
              ? catalogDisclosureExpanded(
                  input.node,
                  (id) => input.root.domInputs.get(id),
                  (record) => catalogTypeName(input.root, record),
                )
              : expanded,
            isDisabled: bool(props.isDisabled),
          },
          element,
        );
      return frame(
        createElement(
          RacDisclosure as ElementType,
          {
            ...marker(input),
            key:
              inGroup || runtime
                ? input.node.id
                : `${input.node.id}:${expanded}`,
            id: input.node.id,
            style: input.style,
            "data-size": str(props.size || "md"),
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
          ...renderAll(input, children(input)),
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
      // ADR-256 Phase 8d: RAC DisclosureGroup around its children as they are (free content — G0 ②).
      return createElement(
        RacDisclosureGroup as ElementType,
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
  // ADR-256 Phase 5b: a ColorSwatchPicker is RAC `ColorSwatchPicker` — its items in order (each
  // a RAC `ColorSwatchPickerItem` node holding its ColorSwatch).
  colorswatchpicker: {
    render: (input) => {
      const props = input.node.props;
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
        ...renderAll(
          input,
          children(input).filter(
            (child) =>
              catalogTypeName(input.root, child) === "ColorSwatchPickerItem",
          ),
        ),
      );
    },
  },
  // ADR-256 Phase 5b: the picker's item — RAC `ColorSwatchPickerItem` (its `color` is the picker's
  // value for it and the ColorSwatch inside shows it through RAC's context), its children in order.
  colorswatchpickeritem: {
    render: (input) => {
      const props = input.node.props;
      const picker = input.root.domInputs.get(input.node.parentId);
      let color;
      try {
        color = parseColor(String(props.color || "#3b82f6"));
      } catch {
        color = parseColor("#3b82f6");
      }
      const element = createElement(
        AriaColorSwatchPickerItem as ElementType,
        {
          ...marker(input),
          style: input.style,
          className: "react-aria-ColorSwatchPickerItem",
          color,
          isDisabled:
            bool(props.isDisabled) || picker?.props.isDisabled === true,
        },
        ...renderAll(input),
      );
      // (Outside a picker RAC needs its collection: a host with no box.)
      return picker &&
        catalogTypeName(input.root, picker) === "ColorSwatchPicker"
        ? element
        : createElement(
            ColorSwatchPicker as ElementType,
            {
              key: `host:${input.node.id}`,
              "aria-label": "Color swatch sample",
              style: { display: "contents" },
            },
            element,
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
        ...calendarProps(input, "Calendar"),
        defaultValue: catalogCalendarPicker(input.root, input.node)
          ? undefined
          : props.defaultValue,
      });
    },
  },
  rangecalendar: {
    ownsChild: ownsAll,
    render: (input) =>
      createElement(RangeCalendar as ElementType, {
        ...calendarProps(input, "Range Calendar"),
        allowsNonContiguousRanges: bool(
          input.node.props.allowsNonContiguousRanges,
        ),
      }),
  },
};

/**
 * A Calendar's · RangeCalendar's props. In a DatePicker · DateRangePicker (`catalogCalendarPicker`
 * — ADR-256 Phase 6e) RAC's calendar context gives its value, bounds, state, focus and paging: the
 * node's own values stay unset so they do not override it, and the picker's size and visible months
 * (RSP `maxVisibleMonths` — a picker prop the context does not carry) are the calendar's.
 */
function calendarProps(
  input: DelegatedDomInput,
  name: string,
): Record<string, unknown> {
  const props = input.node.props;
  const picker = catalogCalendarPicker(input.root, input.node);
  const own = (value: unknown) => (picker ? undefined : value);
  return {
    ...marker(input),
    style: input.style,
    headerStyle: calendarHeaderStyle(input),
    variant: props.variant || "default",
    size: (picker ?? input.node).props.size || "md",
    locale: props.locale,
    calendarSystem: props.calendarSystem,
    "aria-label":
      typeof props["aria-label"] === "string"
        ? props["aria-label"]
        : own(name),
    isDisabled: own(bool(props.isDisabled)),
    isReadOnly: own(bool(props.isReadOnly)),
    isInvalid: own(bool(props.isInvalid)),
    maxVisibleMonths:
      Number((picker ?? input.node).props.maxVisibleMonths) || 1,
    pageBehavior: own(props.pageBehavior === "single" ? "single" : "visible"),
    defaultToday: props.defaultToday === true,
    minValue: own(props.minValue),
    maxValue: own(props.maxValue),
    defaultFocusedValue: own(props.defaultFocusedValue),
    autoFocus: own(bool(props.autoFocus)),
    errorMessage: own(str(props.errorMessage)),
  };
}

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

/** The Tabs a part sits in (through the frames and free content around it). */
function tabsAncestor(
  root: CatalogCompositionRoot,
  node: CatalogConsumerNode,
): CatalogConsumerNode | undefined {
  for (
    let cursor = root.domInputs.get(node.parentId);
    cursor;
    cursor = root.domInputs.get(cursor.parentId)
  )
    if (catalogTypeName(root, cursor) === "Tabs") return cursor;
  return undefined;
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
