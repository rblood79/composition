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
  listPlaceableCatalogEntries,
  type ComponentPanelCategory,
  type ComponentCatalogEntry,
} from "@composition/shared/catalog";

export type ComponentPanelSource = "catalog";

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
      layoutOnly: entry.panel.layoutOnly,
      categoryKey: entry.panel.category,
      source: "catalog",
    }));
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
    color: [],
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
  const catalogItems = getCatalogPanelComponents(
    listPlaceableCatalogEntries({ includeLayoutOnly: isLayoutMode }),
  );

  for (const component of catalogItems) {
    const categoryKey = component.categoryKey as ComponentPanelCategory;
    groups[categoryKey].push(component);
  }

  return groups;
}
