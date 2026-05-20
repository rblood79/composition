import type { ComponentType, SVGProps } from "react";
import {
  AlertTriangle,
  AppWindowMac,
  AppWindow,
  BarChart3,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleDot,
  CircleUser,
  FileUp,
  Frame,
  Grid,
  GroupIcon,
  Hash,
  ImageIcon,
  InspectionPanel,
  Layers,
  Link as LinkIcon,
  ListIcon,
  ListTree,
  Loader,
  Menu,
  MessageSquare,
  MousePointer,
  Paintbrush,
  RectangleEllipsis,
  Search,
  SeparatorHorizontal,
  Settings,
  SlidersHorizontal,
  Smile,
  Square,
  SquareCheck,
  Star,
  TableProperties,
  Tag,
  Text,
  ToggleLeft,
  ToggleRight,
  Upload,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  componentPanelCategoryConfig,
  listComponentPanelInventoryEntries,
  listPlaceableCatalogEntries,
  type ComponentPanelCategory,
  type ComponentPanelInventoryEntry,
  type ComponentCatalogEntry,
} from "@composition/shared/catalog";

export type ComponentPanelSource = "legacy" | "catalog";

export interface ComponentPanelDefinition {
  type: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  layoutOnly?: boolean;
  categoryKey?: string;
  source?: ComponentPanelSource;
}

export const categoryConfig = componentPanelCategoryConfig;

const catalogIconMap: Record<string, LucideIcon> = {
  AlertTriangle,
  AppWindow,
  AppWindowMac,
  BarChart3,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CircleDot,
  CircleUser,
  FileUp,
  Frame,
  Grid,
  GroupIcon,
  Hash,
  ImageIcon,
  InspectionPanel,
  Layers,
  Link: LinkIcon,
  ListIcon,
  ListTree,
  Loader,
  Menu,
  MessageSquare,
  MousePointer,
  Paintbrush,
  RectangleEllipsis,
  Search,
  SeparatorHorizontal,
  Settings,
  SlidersHorizontal,
  Smile,
  Square,
  SquareCheck,
  Star,
  TableProperties,
  Tag,
  Text,
  ToggleLeft,
  ToggleRight,
  Upload,
  Users,
};

function catalogIcon(entry: ComponentCatalogEntry): LucideIcon {
  return catalogIconMap[entry.panel.icon] ?? MousePointer;
}

export function getCatalogPanelComponents(
  entries: readonly ComponentCatalogEntry[] = listPlaceableCatalogEntries(),
): ComponentPanelDefinition[] {
  return entries
    .filter((entry) => entry.panel.placeable && entry.cutover === "catalog")
    .map((entry) => ({
      type: entry.type,
      label: entry.panel.label,
      icon: catalogIcon(entry),
      categoryKey: entry.panel.category,
      source: "catalog",
    }));
}

function panelInventoryIcon(entry: ComponentPanelInventoryEntry): LucideIcon {
  return catalogIconMap[entry.icon] ?? Square;
}

export function getPanelInventoryComponents({
  isLayoutMode,
}: {
  isLayoutMode: boolean;
}): ComponentPanelDefinition[] {
  return listComponentPanelInventoryEntries({
    includeLayoutOnly: isLayoutMode,
  }).map((entry) => ({
    type: entry.type,
    label: entry.label,
    icon: panelInventoryIcon(entry),
    layoutOnly: entry.layoutOnly,
    categoryKey: entry.category,
    source: "legacy",
  }));
}

export function mergeCatalogPanelComponents<
  TGroups extends Record<string, readonly ComponentPanelDefinition[]>,
>(
  groups: TGroups,
  catalogItems: readonly ComponentPanelDefinition[],
): Record<keyof TGroups, ComponentPanelDefinition[]> {
  const catalogByType = new Map(catalogItems.map((item) => [item.type, item]));
  const replacedTypes = new Set<string>();
  const merged = {} as Record<keyof TGroups, ComponentPanelDefinition[]>;

  for (const [groupName, components] of Object.entries(groups) as Array<
    [keyof TGroups, readonly ComponentPanelDefinition[]]
  >) {
    merged[groupName] = components.map((component) => {
      const catalogItem = catalogByType.get(component.type);
      if (catalogItem) {
        replacedTypes.add(component.type);
        return catalogItem;
      }
      return {
        ...component,
        source: component.source ?? "legacy",
      };
    });
  }

  for (const catalogItem of catalogItems) {
    if (replacedTypes.has(catalogItem.type)) continue;
    const categoryKey = catalogItem.categoryKey as keyof TGroups | undefined;
    if (!categoryKey || !(categoryKey in merged)) continue;
    merged[categoryKey].push(catalogItem);
  }

  return merged;
}

function emptyPanelGroups(): Record<
  ComponentPanelCategory,
  ComponentPanelDefinition[]
> {
  return {
    content: [],
    layout: [],
    buttons: [],
    forms: [],
    collections: [],
    dateTime: [],
    overlays: [],
  };
}

export function getComponentPanelGroups({
  isLayoutMode,
}: {
  isLayoutMode: boolean;
}): Record<ComponentPanelCategory, ComponentPanelDefinition[]> {
  const groups = emptyPanelGroups();

  for (const component of getPanelInventoryComponents({ isLayoutMode })) {
    const categoryKey = component.categoryKey as ComponentPanelCategory;
    groups[categoryKey].push(component);
  }

  return mergeCatalogPanelComponents(groups, getCatalogPanelComponents());
}
