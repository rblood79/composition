import type { ComponentType, SVGProps } from "react";
import {
  AppWindowMac,
  MousePointer,
  Square,
  type LucideIcon,
} from "lucide-react";
import {
  listPlaceableCatalogEntries,
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

const catalogIconMap: Record<string, LucideIcon> = {
  AppWindowMac,
  MousePointer,
  Square,
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
