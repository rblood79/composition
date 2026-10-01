import {
  ArchiveRestore,
  Database,
  File,
  LayoutTemplate,
  Minus,
  Move,
  Pencil,
  Sparkles,
  SwatchBook,
  Variable,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { ACTION_ICONS } from "../../config/actionIcons";

type IconKind =
  | "add"
  | "remove"
  | "edit"
  | "move"
  | "group"
  | "ungroup"
  | "component"
  | "page"
  | "pagePosition"
  | "layout"
  | "theme"
  | "variable"
  | "interaction"
  | "slot"
  | "data"
  | "guide"
  | "ai";

/** The old History panel's icon vocabulary (entry type → tool icon), per catalog label family. */
const ICONS: Record<IconKind, LucideIcon> = {
  add: ACTION_ICONS.add,
  remove: Minus,
  edit: Pencil,
  move: Move,
  group: ACTION_ICONS.group,
  ungroup: ACTION_ICONS.ungroup,
  component: ACTION_ICONS.component,
  page: File,
  pagePosition: LayoutTemplate,
  layout: LayoutTemplate,
  theme: SwatchBook,
  variable: Variable,
  interaction: Workflow,
  slot: ArchiveRestore,
  data: Database,
  guide: ACTION_ICONS.toggleRulers,
  ai: Sparkles,
};

/**
 * Every label a catalog history entry can carry (the commands' defaults and the labels the
 * Builder passes — `catalogRuntime`, panels, the AI host) → its `history.labels.*` key and icon
 * family. A label not listed (a data change, already localized by its recorder; a model-written
 * proposal) shows as written with the edit icon.
 */
const LABELS: Readonly<Record<string, readonly [string, IconKind]>> = {
  Insert: ["insert", "add"],
  Edit: ["edit", "edit"],
  "Edit items": ["editItems", "edit"],
  Move: ["move", "move"],
  Delete: ["delete", "remove"],
  Duplicate: ["duplicate", "add"],
  Paste: ["paste", "add"],
  Group: ["group", "group"],
  Ungroup: ["ungroup", "ungroup"],
  Detach: ["detach", "component"],
  "Create component": ["createComponent", "component"],
  "Dissolve component": ["dissolveComponent", "component"],
  "Edit component default": ["editComponentDefault", "component"],
  "Add page": ["addPage", "page"],
  "Edit page": ["editPage", "page"],
  "Reorder pages": ["reorderPages", "page"],
  "Delete page": ["deletePage", "page"],
  "Duplicate page": ["duplicatePage", "page"],
  "Move page": ["movePage", "pagePosition"],
  "Align pages": ["alignPages", "pagePosition"],
  "Rename page": ["renamePage", "page"],
  "Page route": ["pageRoute", "page"],
  "Parent page": ["parentPage", "page"],
  "Page layout": ["pageLayout", "pagePosition"],
  "Add layout": ["addLayout", "layout"],
  "Delete layout": ["deleteLayout", "layout"],
  "Apply layout preset": ["applyLayoutPreset", "layout"],
  "Layout slot": ["layoutSlot", "layout"],
  Rename: ["rename", "edit"],
  "Rename component": ["renameComponent", "component"],
  "Add theme": ["addTheme", "theme"],
  "Duplicate theme": ["duplicateTheme", "theme"],
  "Delete theme": ["deleteTheme", "theme"],
  "Edit theme": ["editTheme", "theme"],
  "Switch theme": ["switchTheme", "theme"],
  "Edit token": ["editToken", "theme"],
  "Edit typography": ["editTypography", "theme"],
  "Add variable": ["addVariable", "variable"],
  "Rename variable": ["renameVariable", "variable"],
  "Edit variable": ["editVariable", "variable"],
  "Delete variable": ["deleteVariable", "variable"],
  "Move variable to page": ["moveVariableToPage", "variable"],
  "Add interaction": ["addInteraction", "interaction"],
  "Edit interaction": ["editInteraction", "interaction"],
  "Edit interactions": ["editInteractions", "interaction"],
  "Delete interaction": ["deleteInteraction", "interaction"],
  "Add item": ["addItem", "add"],
  "Add column": ["addColumn", "add"],
  "Add row": ["addRow", "add"],
  "Edit size": ["editSize", "edit"],
  Resize: ["resize", "edit"],
  Ratio: ["ratio", "edit"],
  Fill: ["fill", "edit"],
  "Edit properties": ["editProperties", "edit"],
  "Edit id": ["editId", "edit"],
  Reset: ["reset", "edit"],
  "Edit slot": ["editSlot", "slot"],
  "Remove slot": ["removeSlot", "slot"],
  "Fill slot": ["fillSlot", "slot"],
  "Restore slot content": ["restoreSlotContent", "slot"],
  "Remove from slot": ["removeFromSlot", "slot"],
  Padding: ["padding", "edit"],
  Gap: ["gap", "edit"],
  Reorder: ["reorder", "move"],
  "Edit text": ["editText", "edit"],
  "Bind data": ["bindData", "data"],
  "Unbind data": ["unbindData", "data"],
  "Show item part": ["showItemPart", "edit"],
  "Hide item part": ["hideItemPart", "edit"],
  "Absolute position": ["absolutePosition", "move"],
  "Flow position": ["flowPosition", "move"],
  Align: ["align", "move"],
  Distribute: ["distribute", "move"],
  "Add element": ["addElement", "add"],
  "Edit card field": ["editCardField", "edit"],
  "Button icon": ["buttonIcon", "edit"],
  "Remove button icon": ["removeButtonIcon", "edit"],
  "Button label": ["buttonLabel", "edit"],
  "Add guide": ["addGuide", "guide"],
  "Delete guide": ["deleteGuide", "guide"],
  "Move guide": ["moveGuide", "guide"],
  "Edit style": ["editStyle", "edit"],
  "Reset fill": ["resetFill", "edit"],
  "Reset style": ["resetStyle", "edit"],
  "Add override": ["addOverride", "edit"],
  "Remove override": ["removeOverride", "edit"],
  Show: ["show", "edit"],
  Hide: ["hide", "edit"],
  "AI: edit": ["aiEdit", "ai"],
  "AI: delete": ["aiDelete", "ai"],
  "AI: interaction": ["aiInteraction", "ai"],
};

/** `AI: add Button` (the AI host's add) and `AI batch (3)` (a merged AI batch). */
const AI_ADD = /^AI: add (.+)$/;
const AI_BATCH = /^AI batch \((\d+)\)$/;

export interface CatalogHistoryEntryView {
  readonly text: string;
  readonly Icon: LucideIcon;
}

/** A history entry label as the panel shows it: localized text and its family icon. */
export function catalogHistoryEntryView(
  label: string,
  t: (key: string, params?: Record<string, string | number>) => string,
): CatalogHistoryEntryView {
  const known = LABELS[label];
  if (known)
    return { text: t(`history.labels.${known[0]}`), Icon: ICONS[known[1]] };
  const add = AI_ADD.exec(label);
  if (add)
    return {
      text: t("history.labels.aiAdd", { type: add[1] }),
      Icon: ICONS.ai,
    };
  const batch = AI_BATCH.exec(label);
  if (batch)
    return {
      text: t("history.labels.aiBatch", { count: Number(batch[1]) }),
      Icon: ICONS.ai,
    };
  return { text: label, Icon: ICONS.edit };
}

/** Every translated label key (a static check reads them against both locales). */
export const CATALOG_HISTORY_LABEL_KEYS: readonly string[] = [
  ...Object.values(LABELS).map(([key]) => `history.labels.${key}`),
  "history.labels.aiAdd",
  "history.labels.aiBatch",
];
