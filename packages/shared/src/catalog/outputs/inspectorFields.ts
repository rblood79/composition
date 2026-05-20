import type {
  InspectorFieldKind,
  PropContract,
  PropContractMap,
  VisibilityCondition,
} from "../types";

export interface InspectorThemeLookup {
  variants?: Record<string, readonly string[]>;
  sizes?: Record<string, readonly string[]>;
}

export interface InspectorFieldModel {
  key: string;
  kind: InspectorFieldKind;
  label: string;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  multiline?: boolean;
  emptyToUndefined?: boolean;
  visibleWhen?: VisibilityCondition;
}

export interface InspectorFieldSectionModel {
  section: string;
  title: string;
  fields: InspectorFieldModel[];
}

export interface BuildInspectorFieldSectionsInput {
  componentType: string;
  contracts: PropContractMap;
  theme?: InspectorThemeLookup;
}

const SECTION_ORDER = ["content", "appearance", "icon", "state", "locale"];

export function buildInspectorFieldSections({
  componentType,
  contracts,
  theme,
}: BuildInspectorFieldSectionsInput): InspectorFieldSectionModel[] {
  const sectionMap = new Map<string, InspectorFieldModel[]>();

  for (const [key, contract] of Object.entries(contracts)) {
    if (contract.inspector === false) continue;

    const section = contract.section ?? "content";
    const fields = sectionMap.get(section) ?? [];
    fields.push(toInspectorField(componentType, key, contract, theme));
    sectionMap.set(section, fields);
  }

  return [...sectionMap.entries()]
    .sort(([a], [b]) => getSectionOrder(a) - getSectionOrder(b))
    .map(([section, fields]) => ({
      section,
      title: sectionTitle(section),
      fields,
    }));
}

function toInspectorField(
  componentType: string,
  key: string,
  contract: PropContract,
  theme: InspectorThemeLookup | undefined,
): InspectorFieldModel {
  return {
    key,
    kind: contract.kind,
    label: contract.label ?? inferLabel(key),
    defaultValue: contract.default,
    options: resolveOptions(componentType, contract, theme),
    min: contract.min,
    max: contract.max,
    step: contract.step,
    placeholder: contract.placeholder,
    multiline: contract.multiline,
    emptyToUndefined: contract.emptyToUndefined,
    visibleWhen: contract.visibleWhen,
  };
}

function resolveOptions(
  componentType: string,
  contract: PropContract,
  theme: InspectorThemeLookup | undefined,
): Array<{ value: string; label: string }> | undefined {
  if (contract.kind === "variant") {
    return theme?.variants?.[componentType]?.map(optionFromValue) ?? [];
  }

  if (contract.kind === "size") {
    return theme?.sizes?.[componentType]?.map(optionFromValue) ?? [];
  }

  return contract.options;
}

function optionFromValue(value: string): { value: string; label: string } {
  return {
    value,
    label: formatOptionLabel(value),
  };
}

function formatOptionLabel(value: string): string {
  const sizeLabels: Record<string, string> = {
    xs: "XS",
    sm: "S",
    md: "M",
    lg: "L",
    xl: "XL",
  };
  if (sizeLabels[value]) return sizeLabels[value];
  return inferLabel(value);
}

function getSectionOrder(section: string): number {
  const index = SECTION_ORDER.indexOf(section);
  return index === -1 ? SECTION_ORDER.length : index;
}

function sectionTitle(section: string): string {
  const titles: Record<string, string> = {
    content: "Content",
    appearance: "Appearance",
    icon: "Icon",
    state: "State",
    locale: "Locale",
  };
  return titles[section] ?? inferLabel(section);
}

function inferLabel(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
