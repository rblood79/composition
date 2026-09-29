/**
 * ADR-248 Phase 3 — one-time conversion of the Builder's reusable origins (canonical, produced by
 * `catalogOrigins.ts` and the origin ensurers) into typed `lib:*` library entries.
 *
 * Test entry only. The runtime never reads canonical nodes: the converted output is written once to
 * `packages/shared/src/catalog/document/generated/reusableOriginLibrary.ts` (the code-catalog
 * source of truth) and this converter only re-derives it to compare (대조).
 *
 * Every canonical field is either represented in the typed entry or recorded as a contract gap —
 * nothing is dropped silently (`accountedFields` lets the test prove the partition).
 */
import {
  readPropsSchema,
  resolveSubpartStyleOwnerType,
  type CanonicalNode,
} from "@composition/shared";
import { getPropagationRules } from "../../../utils/propagationRegistry";
import {
  catalogTypeDefinition,
  catalogTypeDefinitionId,
  PROP_KIND_VALUE_TYPE,
} from "../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import {
  CatalogValidationError,
  validateLibraryTemplate,
} from "../../../../../../../packages/shared/src/catalog/document/validation";
import type {
  LibraryDefinition,
  LibraryDefinitionId,
  LibraryTemplateId,
  LibraryTemplateNode,
  Scalar,
  ValueType,
  VisualField,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  DISPLAY_STATE_NAMES,
  type DisplayStateName,
} from "../../../../../../../packages/shared/src/catalog/document/types";

export type OriginGapReason =
  | "INSTANCE_PROP_OVERRIDE_NEEDS_DESCENDANT_OVERRIDE"
  | "INSTANCE_PROP_NOT_ACCEPTED_BY_COMPOSITE"
  | "DESCENDANT_ADDRESS_UNRESOLVED"
  | "DESCENDANT_FIELD_NOT_IN_CONTRACT"
  | "TEMPLATE_DESCENDANT_OVERRIDE_NOT_IN_LIBRARY_TEMPLATE"
  | "PROP_NOT_ACCEPTED_BY_TYPE_DEFINITION"
  | "PROP_TYPE_MISMATCH"
  | "PROP_CHOICE_REJECTED"
  | "PROP_VALUE_NOT_SCALAR"
  | "STYLE_FIELD_OUTSIDE_TYPED_VISUAL"
  | "READ_ONLY_SUBPART_STYLE"
  | "DOM_UNREAD_SUBPART_STYLE"
  | "STYLE_VALUE_NOT_SCALAR"
  | "VISUAL_VALUE_REJECTED_BY_TYPED_CONTRACT"
  | "SLOT_RECOMMENDATION_LIST_NOT_TYPED_SLOT"
  | "TEMPLATE_NODE_NAME_NOT_IN_CONTRACT"
  | "METADATA_NOT_IN_CONTRACT"
  | "ENABLED_FLAG_NOT_IN_CONTRACT"
  | "NODE_ICON_NAME_NOT_IN_CONTRACT"
  | "NODE_STYLE_FIELD_NOT_IN_CONTRACT"
  | "CHILDREN_NOT_ARRAY"
  | "UNKNOWN_CANONICAL_FIELD";

export interface OriginContractGap {
  originId: string;
  nodeId: string;
  path: string;
  reason: OriginGapReason;
  valueKind: string;
  value?: unknown;
}

const VISUAL_FIELDS = new Set<VisualField>([
  "color",
  "backgroundColor",
  "borderColor",
  "fill",
  "opacity",
  "fontSize",
  "lineHeight",
  "fontWeight",
  "width",
  "height",
  "overflow",
  "radius",
  "gap",
  "padding",
  "borderWidth",
  "borderStyle",
  "fillAlpha",
  "minHeight",
  "thumbSize",
  "indentPerLevel",
  "iconGap",
  "iconSize",
  // Typed extension fields (numbers in px; a `"Npx"` style value converts, `PX_NUMBER_FIELDS`).
  "paddingX",
  "paddingY",
  "minWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
]);
/** Visual fields the typed contract takes as px numbers: a `"Npx"` style string converts. */
const PX_NUMBER_FIELDS = new Set<string>([
  "paddingX",
  "paddingY",
  "minWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
]);
const pxNumber = (value: unknown): number | undefined => {
  const match =
    typeof value === "string" ? /^(\d+(?:\.\d+)?)px$/.exec(value.trim()) : null;
  return match ? Number(match[1]) : undefined;
};

const LAYOUT_KEYWORD_FIELDS = new Set([
  "display",
  "flexDirection",
  "alignItems",
  "justifyContent",
  "flexWrap",
  "position",
  "alignSelf",
  "justifySelf",
  "verticalAlign",
]);
const LAYOUT_LENGTH_FIELDS = new Set([
  "rowGap",
  "columnGap",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "flexBasis",
]);
const GRID_LINE_FIELDS = new Set([
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
]);
/**
 * Origin `style` key → typed template layout declarations (CSS values). `flex: 1` expands to its
 * longhands and `margin: 0` to the four sides; other shorthands stay reported gaps.
 */
function typedLayout(
  key: string,
  value: unknown,
): Array<[string, string]> | undefined {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string") return undefined;
  const length = (raw: string) =>
    /^-?\d+(?:\.\d+)?$/.test(raw) && raw !== "0" ? `${raw}px` : raw;
  if (LAYOUT_KEYWORD_FIELDS.has(key)) return [[key, text]];
  if (LAYOUT_LENGTH_FIELDS.has(key)) return [[key, length(text)]];
  if (GRID_LINE_FIELDS.has(key)) return [[key, text]];
  if (key === "flexGrow" || key === "flexShrink") return [[key, text]];
  if (key === "flex" && text === "1")
    return [
      ["flexGrow", "1"],
      ["flexShrink", "1"],
      ["flexBasis", "0%"],
    ];
  if (key === "margin" && (text === "0" || text === "0px"))
    return ["marginTop", "marginRight", "marginBottom", "marginLeft"].map(
      (side) => [side, "0"] as [string, string],
    );
  return undefined;
}
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

/** Ask the real library template validator, so the converter never re-implements its rules. */
function acceptedVisualValue(key: string, value: Scalar): boolean {
  try {
    validateLibraryTemplate({
      id: "lib:template:probe",
      definitionId: "lib:definition:probe",
      children: [],
      props: {},
      visual: { [key]: value },
    });
    return true;
  } catch (error) {
    if (error instanceof CatalogValidationError) return false;
    throw error;
  }
}

const valueKind = (value: unknown): string =>
  value === undefined
    ? "undefined"
    : value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value;
const isScalar = (value: unknown): value is Scalar =>
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

export const originDefinitionId = (originId: string): LibraryDefinitionId =>
  `lib:definition:origin-${originId}`;
export const originTemplateId = (nodeId: string): LibraryTemplateId =>
  `lib:template:${nodeId}`;

export interface ReusableOriginConversion {
  definitions: LibraryDefinition[];
  templates: LibraryTemplateNode[];
  typeDefinitions: LibraryDefinition[];
  gaps: OriginContractGap[];
  /** `${nodeId}\u0000${field path}` for every canonical field that became a typed value. */
  represented: string[];
}

export function convertReusableOrigins(
  origins: readonly CanonicalNode[],
): ReusableOriginConversion {
  const definitions: LibraryDefinition[] = [];
  const templates: LibraryTemplateNode[] = [];
  const types = new Map<string, LibraryDefinition>();
  const gaps: OriginContractGap[] = [];
  const represented: string[] = [];
  const originIds = new Set(origins.map((origin) => origin.id));

  const typeDefinition = (type: string): LibraryDefinition => {
    const known = types.get(type);
    if (known) return known;
    const definition = catalogTypeDefinition(type);
    types.set(type, definition);
    return definition;
  };

  const originById = new Map(origins.map((origin) => [origin.id, origin]));
  /** Owner props each origin's template binds for propagated children (prop → default). */
  const ownerBindings: Record<string, Record<string, string>> = {};
  const schemaContract = (origin: CanonicalNode) => {
    const accepts: Record<string, ValueType> = {};
    const defaults: Record<string, Scalar> = {};
    for (const [key, contract] of Object.entries(
      readPropsSchema(origin) ?? {},
    )) {
      const valueType = PROP_KIND_VALUE_TYPE[contract.kind];
      if (!valueType)
        throw new Error(`REUSABLE_ORIGIN_SCHEMA_KIND:${origin.id}.${key}`);
      accepts[key] = valueType;
      if (isScalar(contract.default)) defaults[key] = contract.default;
    }
    return { accepts, defaults };
  };
  /** Instance props contract of an origin: its root's contract plus its edit schema. */
  const originContract = (
    originId: string,
  ): Pick<LibraryDefinition, "accepts" | "propChoices"> => {
    const origin = originById.get(originId)!;
    const root =
      origin.type === "ref"
        ? originContract(String((origin as { ref?: unknown }).ref))
        : typeDefinition(origin.type);
    const schema = schemaContract(origin).accepts;
    return {
      accepts: { ...root.accepts, ...schema },
      propChoices: Object.fromEntries(
        Object.entries(root.propChoices ?? {}).filter(
          ([key]) => !(key in schema),
        ),
      ),
    };
  };
  /** Old descendant path segment (`getCanonicalRefPathSegment` + `~N` duplicates). */
  const childSegments = (children: readonly CanonicalNode[]): string[] => {
    const seen = new Map<string, number>();
    return children.map((child) => {
      const record = child as CanonicalNode & Record<string, unknown>;
      const metadata = record.metadata as Record<string, unknown> | undefined;
      const base = String(
        record.customId ||
          metadata?.customId ||
          record.componentName ||
          record.name ||
          record.id,
      );
      const count = (seen.get(base) ?? 0) + 1;
      seen.set(base, count);
      return count === 1 ? base : `${base}~${count}`;
    });
  };
  /** Canonical descendant key → template path inside the referenced origin's template. */
  const descendantPath = (
    originId: string,
    key: string,
  ): { path: LibraryTemplateId[]; target: CanonicalNode } | undefined => {
    const origin = originById.get(originId)!;
    if (origin.type === "ref") return undefined;
    let target: CanonicalNode = origin;
    const path = [originTemplateId(origin.id)];
    for (const segment of key.split("/")) {
      const children = Array.isArray(target.children)
        ? (target.children as CanonicalNode[])
        : [];
      const index = childSegments(children).indexOf(segment);
      if (index < 0) return undefined;
      target = children[index];
      path.push(originTemplateId(target.id));
    }
    return { path, target };
  };
  const nodeContract = (node: CanonicalNode) =>
    node.type === "ref"
      ? originContract(String((node as { ref?: unknown }).ref))
      : typeDefinition(node.type);

  const convertNode = (
    node: CanonicalNode,
    originId: string,
    isRoot: boolean,
    ancestors: readonly string[] = [],
  ): LibraryTemplateId => {
    if (!ID_PATTERN.test(node.id))
      throw new Error(`REUSABLE_ORIGIN_ID_PATTERN:${node.id}`);
    const id = originTemplateId(node.id);
    const gap = (
      path: string,
      reason: OriginGapReason,
      value: unknown,
    ): void => {
      gaps.push({
        originId,
        nodeId: node.id,
        path,
        reason,
        valueKind: valueKind(value),
        ...(value === undefined ? {} : { value }),
      });
    };
    const keep = (path: string) => represented.push(`${node.id}\u0000${path}`);
    const source = node as CanonicalNode & Record<string, unknown>;
    const isRef = node.type === "ref";
    const refTarget = isRef ? String(source.ref) : undefined;
    if (isRef && !originIds.has(refTarget!))
      throw new Error(
        `REUSABLE_ORIGIN_REF_OUTSIDE_SET:${node.id}->${refTarget}`,
      );
    const definition = isRef ? undefined : typeDefinition(node.type);
    const definitionId = isRef
      ? originDefinitionId(refTarget!)
      : catalogTypeDefinitionId(node.type);
    keep("id");
    keep("type");
    if (isRef) keep("ref");

    const props: Record<string, Scalar> = {};
    const visual: Record<string, Scalar> = {};
    const layout: Record<string, string> = {};
    let enabled: boolean | undefined;
    let displayState: DisplayStateName | undefined;
    const descendantPatches: NonNullable<
      LibraryTemplateNode["descendantPatches"]
    >[number][] = [];
    for (const [key, value] of Object.entries(node.props ?? {})) {
      const path = `props.${key}`;
      if (isRef && key !== "style") {
        // A composite instance is its template root: accepted root props are instance values.
        const contract = originContract(refTarget!);
        const expected = contract.accepts[key];
        if (!isScalar(value)) gap(path, "PROP_VALUE_NOT_SCALAR", value);
        else if (!expected || typeof value !== expected)
          gap(path, "INSTANCE_PROP_NOT_ACCEPTED_BY_COMPOSITE", value);
        else if (
          contract.propChoices?.[key] &&
          !contract.propChoices[key].includes(value)
        )
          gap(path, "PROP_CHOICE_REJECTED", value);
        else {
          props[key] = value;
          keep(path);
        }
        continue;
      }
      if (key === "style") {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          gap(path, "PROP_VALUE_NOT_SCALAR", value);
          continue;
        }
        // A read-only sub-part's inline style reaches neither the DOM (the owner self-composes
        // it from its own props and delegation) nor the legacy Canvas (ssot-hierarchy D3
        // read-only sub-part): the typed template carries only its projected `display`.
        const subpartOwner = resolveSubpartStyleOwnerType(
          node.type,
          ancestors[0],
          ancestors[1],
        );
        for (const [styleKey, styleValue] of Object.entries(value)) {
          const stylePath = `${path}.${styleKey}`;
          // The projected `display` (hidden sub-part) is the one inline value both read.
          if (subpartOwner && styleKey !== "display") {
            gap(stylePath, "READ_ONLY_SUBPART_STYLE", styleValue);
            continue;
          }
          // A field trigger's `SelectIcon`: no DOM renderer reads it (the owner draws its own
          // glyph/button, sized by its delegation), so its inline style reached only the legacy
          // Canvas — a Canvas-only style the typed template does not carry.
          if (
            node.type === "SelectIcon" &&
            ancestors[0] === "SelectTrigger" &&
            styleKey !== "display"
          ) {
            gap(stylePath, "DOM_UNREAD_SUBPART_STYLE", styleValue);
            continue;
          }
          const declarations = VISUAL_FIELDS.has(styleKey as VisualField)
            ? undefined
            : typedLayout(styleKey, styleValue);
          if (declarations) {
            for (const [field, text] of declarations) layout[field] = text;
            keep(stylePath);
          } else if (!VISUAL_FIELDS.has(styleKey as VisualField))
            gap(stylePath, "STYLE_FIELD_OUTSIDE_TYPED_VISUAL", styleValue);
          else if (!isScalar(styleValue))
            gap(stylePath, "STYLE_VALUE_NOT_SCALAR", styleValue);
          else if (
            styleKey === "lineHeight" &&
            pxLineHeightRatio(
              styleValue,
              value as Record<string, unknown>,
              node,
            ) !== undefined
          ) {
            // A leaf's `line-height: Npx` is the unitless ratio N / its own font size (the typed
            // unit); with children the px value would inherit unscaled, so it stays a gap.
            visual.lineHeight = pxLineHeightRatio(
              styleValue,
              value as Record<string, unknown>,
              node,
            )!;
            keep(stylePath);
          } else {
            const typed = PX_NUMBER_FIELDS.has(styleKey)
              ? (pxNumber(styleValue) ?? styleValue)
              : styleValue;
            if (!acceptedVisualValue(styleKey, typed))
              gap(
                stylePath,
                "VISUAL_VALUE_REJECTED_BY_TYPED_CONTRACT",
                styleValue,
              );
            else {
              visual[styleKey] = typed;
              keep(stylePath);
            }
          }
        }
        continue;
      }
      if (!isScalar(value)) {
        gap(path, "PROP_VALUE_NOT_SCALAR", value);
        continue;
      }
      const expected = definition!.accepts[key];
      if (!expected) gap(path, "PROP_NOT_ACCEPTED_BY_TYPE_DEFINITION", value);
      else if (typeof value !== expected)
        gap(path, "PROP_TYPE_MISMATCH", value);
      else if (
        definition!.propChoices?.[key] &&
        !definition!.propChoices[key].includes(value)
      )
        gap(path, "PROP_CHOICE_REJECTED", value);
      else {
        props[key] = value;
        keep(path);
      }
    }
    if (node.props && Object.keys(node.props).length === 0) keep("props");
    // Owner prop propagation (the legacy `propagationRegistry` rule the DOM self-compose reads the
    // same way — TextField `label` → Label text): a direct child of the origin root binds the
    // owner's prop (`{label}`), so a composite instance value reaches it through template binding.
    if (!isRef && ancestors.length === 1)
      for (const rule of getPropagationRules(ancestors[0]) ?? []) {
        if (
          typeof rule.childPath !== "string" ||
          rule.childPath.toLowerCase() !== node.type.toLowerCase() ||
          !rule.parentProp ||
          rule.asStyle ||
          rule.transform ||
          rule.styleValue !== undefined
        )
          continue;
        const childProp = rule.childProp ?? rule.parentProp;
        if (
          definition!.accepts[childProp] !== "string" ||
          definition!.propChoices?.[childProp]
        )
          continue;
        props[childProp] = `{${rule.parentProp}}`;
        // The composite binds the owner prop: its default is the root's own value (else the
        // child's authored value).
        const rootValue = (
          originById.get(originId)?.props as Record<string, unknown> | undefined
        )?.[rule.parentProp];
        const childValue = (
          node.props as Record<string, unknown> | undefined
        )?.[childProp];
        const bound = (ownerBindings[originId] ??= {});
        const value = isScalar(rootValue) ? rootValue : childValue;
        if (typeof value === "string") bound[rule.parentProp] = value;
        else if (!(rule.parentProp in bound)) bound[rule.parentProp] = "";
      }

    const children: LibraryTemplateId[] = [];
    if (source.children !== undefined) {
      if (!Array.isArray(source.children))
        gap("children", "CHILDREN_NOT_ARRAY", source.children);
      else {
        keep("children");
        for (const child of source.children as CanonicalNode[])
          children.push(
            convertNode(child, originId, false, [node.type, ...ancestors]),
          );
      }
    }

    for (const [field, value] of Object.entries(source)) {
      if (
        ["id", "type", "ref", "props", "children"].includes(field) ||
        value === undefined
      )
        continue;
      if (field === "name") {
        if (isRoot) keep("name");
        else gap("name", "TEMPLATE_NODE_NAME_NOT_IN_CONTRACT", value);
      } else if (field === "reusable" && isRoot && value === true)
        keep("reusable");
      else if (field === "metadata") {
        for (const [key, entry] of Object.entries(
          value as Record<string, unknown>,
        )) {
          if (entry === undefined) continue;
          // A root's edit schema becomes the typed composite accepts/defaults (template bindings).
          if (key === "propsSchema" && isRoot) keep(`metadata.${key}`);
          // A state origin's forced state (`readForcedVariantStates`) is the template node's
          // display state; `default` forces nothing.
          else if (key === "variant" && isRoot && typeof entry === "string") {
            const name = entry === "focus-visible" ? "focusVisible" : entry;
            if (name === "default") keep(`metadata.${key}`);
            else if (DISPLAY_STATE_NAMES.includes(name as DisplayStateName)) {
              displayState = name as DisplayStateName;
              keep(`metadata.${key}`);
            } else gap(`metadata.${key}`, "METADATA_NOT_IN_CONTRACT", entry);
          } else gap(`metadata.${key}`, "METADATA_NOT_IN_CONTRACT", entry);
        }
      } else if (field === "slot")
        gap("slot", "SLOT_RECOMMENDATION_LIST_NOT_TYPED_SLOT", value);
      else if (field === "descendants") {
        for (const [key, override] of Object.entries(
          value as Record<string, unknown>,
        )) {
          const at = `descendants.${key}`;
          const resolved = isRef ? descendantPath(refTarget!, key) : undefined;
          if (!override || typeof override !== "object") {
            gap(at, "DESCENDANT_ADDRESS_UNRESOLVED", override);
            continue;
          }
          if (!resolved) {
            for (const [fieldKey, fieldValue] of Object.entries(override))
              if (
                fieldKey === "style" &&
                fieldValue &&
                typeof fieldValue === "object" &&
                !Array.isArray(fieldValue)
              )
                for (const [styleKey, styleValue] of Object.entries(fieldValue))
                  gap(
                    `${at}.style.${styleKey}`,
                    "DESCENDANT_ADDRESS_UNRESOLVED",
                    styleValue,
                  );
              else
                gap(
                  `${at}.${fieldKey}`,
                  "DESCENDANT_ADDRESS_UNRESOLVED",
                  fieldValue,
                );
            continue;
          }
          const patch: {
            templatePath: LibraryTemplateId[];
            props?: Record<string, Scalar>;
            visual?: Record<string, Scalar>;
            layout?: Record<string, string>;
            enabled?: boolean;
          } = { templatePath: resolved.path };
          const contract = nodeContract(resolved.target);
          for (const [fieldKey, fieldValue] of Object.entries(
            override as Record<string, unknown>,
          )) {
            const fieldAt = `${at}.${fieldKey}`;
            if (fieldKey === "enabled" && typeof fieldValue === "boolean") {
              patch.enabled = fieldValue;
              keep(fieldAt);
            } else if (
              fieldKey === "style" &&
              fieldValue &&
              typeof fieldValue === "object" &&
              !Array.isArray(fieldValue)
            ) {
              for (const [styleKey, styleValue] of Object.entries(fieldValue)) {
                const declarations = VISUAL_FIELDS.has(styleKey as VisualField)
                  ? undefined
                  : typedLayout(styleKey, styleValue);
                if (declarations) {
                  for (const [field, text] of declarations)
                    (patch.layout ??= {})[field] = text;
                  keep(`${fieldAt}.${styleKey}`);
                } else if (
                  VISUAL_FIELDS.has(styleKey as VisualField) &&
                  isScalar(styleValue) &&
                  acceptedVisualValue(styleKey, styleValue)
                ) {
                  (patch.visual ??= {})[styleKey] = styleValue;
                  keep(`${fieldAt}.${styleKey}`);
                } else
                  gap(
                    `${fieldAt}.${styleKey}`,
                    "DESCENDANT_FIELD_NOT_IN_CONTRACT",
                    styleValue,
                  );
              }
            } else if (
              isScalar(fieldValue) &&
              contract.accepts[fieldKey] === typeof fieldValue &&
              (!contract.propChoices?.[fieldKey] ||
                contract.propChoices[fieldKey].includes(fieldValue))
            ) {
              (patch.props ??= {})[fieldKey] = fieldValue;
              keep(fieldAt);
            } else gap(fieldAt, "DESCENDANT_FIELD_NOT_IN_CONTRACT", fieldValue);
          }
          if (
            patch.props ||
            patch.visual ||
            patch.layout ||
            patch.enabled !== undefined
          )
            descendantPatches.push(patch);
        }
      } else if (field === "enabled" && typeof value === "boolean") {
        enabled = value;
        keep("enabled");
      } else if (field === "enabled")
        gap("enabled", "ENABLED_FLAG_NOT_IN_CONTRACT", value);
      else if (field === "iconName")
        gap("iconName", "NODE_ICON_NAME_NOT_IN_CONTRACT", value);
      else if (field === "style")
        gap("style", "NODE_STYLE_FIELD_NOT_IN_CONTRACT", value);
      else gap(field, "UNKNOWN_CANONICAL_FIELD", value);
    }

    templates.push({
      id,
      definitionId,
      children,
      props,
      visual,
      ...(Object.keys(layout).length ? { layout } : {}),
      ...(enabled === undefined ? {} : { enabled }),
      ...(descendantPatches.length ? { descendantPatches } : {}),
      ...(displayState ? { displayState } : {}),
    });
    return id;
  };

  for (const origin of origins) {
    const rootId = convertNode(origin, origin.id, true);
    const { accepts, defaults } = schemaContract(origin);
    for (const [prop, value] of Object.entries(
      ownerBindings[origin.id] ?? {},
    )) {
      accepts[prop] ??= "string";
      if (!(prop in defaults)) defaults[prop] = value;
    }
    definitions.push({
      id: originDefinitionId(origin.id),
      name: origin.name ?? origin.id,
      mode: "composite",
      accepts,
      defaults,
      visual: {},
      stateRules: {},
      templateRootId: rootId,
    });
  }
  // A selectable origin's own style is its selected look: its resting `--unselected` layer removes
  // those keys (`style: { key: null }`, old state layer order — the unselected layer applies
  // whenever the item is not selected). The typed origin shows them only when selected.
  for (const origin of origins) {
    const variant = (origin as { metadata?: { variant?: unknown } }).metadata?.variant;
    if (origin.type !== "ref" || variant !== "unselected") continue;
    let target = originById.get(String((origin as { ref?: unknown }).ref));
    while (target?.type === "ref")
      target = originById.get(String((target as { ref?: unknown }).ref));
    const base = target && templates.find((item) => item.id === originTemplateId(target!.id));
    const style = (origin.props as { style?: Record<string, unknown> } | undefined)?.style ?? {};
    for (const [key, value] of Object.entries(style)) {
      if (value !== null || !base || !(key in base.visual)) continue;
      const visual = base.visual as Record<string, Scalar>;
      const selected = {
        ...(base.stateRules?.selected ?? {}),
        [key]: { kind: "set" as const, value: visual[key] },
      };
      delete visual[key];
      (base as { stateRules?: LibraryTemplateNode["stateRules"] }).stateRules = {
        ...base.stateRules,
        selected,
      };
      const at = gaps.findIndex(
        (item) =>
          item.nodeId === origin.id &&
          item.path === `props.style.${key}` &&
          item.reason === "STYLE_VALUE_NOT_SCALAR",
      );
      if (at >= 0) gaps.splice(at, 1);
      represented.push(`${origin.id}\u0000props.style.${key}`);
    }
  }
  // Pre-order: the root is pushed after its subtree above, so reorder templates by DFS once.
  const byId = new Map(templates.map((template) => [template.id, template]));
  const ordered: LibraryTemplateNode[] = [];
  const walk = (id: LibraryTemplateId) => {
    const template = byId.get(id)!;
    ordered.push(template);
    template.children.forEach(walk);
  };
  for (const definition of definitions) walk(definition.templateRootId!);
  if (ordered.length !== templates.length)
    throw new Error("REUSABLE_ORIGIN_TEMPLATE_ORDER_MISMATCH");
  return {
    definitions,
    templates: ordered,
    typeDefinitions: [...types.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    gaps,
    represented,
  };
}

/** `"Npx"` line height of a childless node whose style also carries a numeric font size. */
function pxLineHeightRatio(
  value: unknown,
  style: Record<string, unknown>,
  node: { children?: readonly unknown[] },
): number | undefined {
  const match =
    typeof value === "string" ? /^(\d+(?:\.\d+)?)px$/.exec(value.trim()) : null;
  const fontSize = style.fontSize;
  if (!match || typeof fontSize !== "number" || !(fontSize > 0))
    return undefined;
  if ((node.children?.length ?? 0) > 0) return undefined;
  return Number(match[1]) / fontSize;
}
