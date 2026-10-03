import { LIBRARY_CONTRACT_VERSION } from "./types";
import type {
  CatalogLibrary,
  InteractionEntry,
  LibraryDefinition,
  LibraryDefinitionId,
  LibraryTemplateId,
  LibraryTemplateNode,
  LibraryToken,
  LibraryTokenId,
} from "./types";
import type { ComponentRule } from "../../types/composition-document.types";
import {
  CatalogValidationError,
  validateLibraryDefinition,
  validateLibraryTemplate,
  validateLibraryToken,
} from "./validation";

const certifiedLibraries = new WeakSet<object>();
export function assertCatalogLibrary(value: CatalogLibrary): void {
  if (!certifiedLibraries.has(value))
    throw new CatalogValidationError("UNVERIFIED_LIBRARY", "library");
}

/** A read-only facade; Object.freeze(new Map()) does not prevent Map.set(). */
class ImmutableLookup<K, V> implements ReadonlyMap<K, V> {
  readonly [Symbol.toStringTag] = "ImmutableLookup";
  #data: Map<K, V>;
  constructor(data: Map<K, V>) {
    this.#data = data;
    Object.freeze(this);
  }
  get size(): number {
    return this.#data.size;
  }
  get(key: K): V | undefined {
    return this.#data.get(key);
  }
  has(key: K): boolean {
    return this.#data.has(key);
  }
  entries(): MapIterator<[K, V]> {
    return this.#data.entries();
  }
  keys(): MapIterator<K> {
    return this.#data.keys();
  }
  values(): MapIterator<V> {
    return this.#data.values();
  }
  forEach(
    callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    thisArg?: unknown,
  ): void {
    this.#data.forEach((value, key) =>
      callbackfn.call(thisArg, value, key, this),
    );
  }
  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }
}
class ImmutableSet<T> implements ReadonlySet<T> {
  readonly [Symbol.toStringTag] = "ImmutableSet";
  #data: Set<T>;
  constructor(data: Set<T>) {
    this.#data = data;
    Object.freeze(this);
  }
  get size(): number {
    return this.#data.size;
  }
  has(value: T): boolean {
    return this.#data.has(value);
  }
  entries(): SetIterator<[T, T]> {
    return this.#data.entries();
  }
  keys(): SetIterator<T> {
    return this.#data.keys();
  }
  values(): SetIterator<T> {
    return this.#data.values();
  }
  forEach(
    callbackfn: (value: T, value2: T, set: ReadonlySet<T>) => void,
    thisArg?: unknown,
  ): void {
    this.#data.forEach((value) => callbackfn.call(thisArg, value, value, this));
  }
  [Symbol.iterator](): SetIterator<T> {
    return this.values();
  }
}
function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}
function uniqueMap<K, V>(
  items: readonly V[],
  key: (value: V) => K,
  at: string,
): Map<K, V> {
  const result = new Map<K, V>();
  for (const item of items) {
    const id = key(item);
    if (result.has(id))
      throw new CatalogValidationError("DUPLICATE_ID", `${at}: ${String(id)}`);
    result.set(id, freezeDeep(structuredClone(item)));
  }
  return result;
}
export interface CatalogLibraryInput {
  contractVersion: typeof LIBRARY_CONTRACT_VERSION;
  revision: string;
  definitions: readonly LibraryDefinition[];
  templates: readonly LibraryTemplateNode[];
  tokens: readonly LibraryToken[];
  bindingIds: readonly string[];
  /** D3 rules referenced by definitions' `ruleId`. */
  rules?: Readonly<Record<string, ComponentRule>>;
  triggerIds?: readonly string[];
  capabilityIds?: readonly string[];
  actionOpCodes: readonly InteractionEntry["action"]["opcode"][];
}

/**
 * Props contract of an instance of `definition`. A composite instance is its template root
 * (instance root values, ADR-248 §3.4): it accepts the root definition's props plus its own
 * declared edit schema (template binding keys), with the root's finite choices.
 */
export function instanceContract<
  D extends Pick<
    LibraryDefinition,
    "mode" | "accepts" | "propChoices" | "templateRootId"
  >,
>(
  definition: D,
  lookupDefinition: (
    id: string,
  ) =>
    | Pick<LibraryDefinition, "mode" | "accepts" | "propChoices" | "templateRootId">
    | undefined,
  lookupTemplate: (id: string) => { definitionId: string } | undefined,
  visiting: ReadonlySet<string> = new Set(),
): Pick<LibraryDefinition, "accepts" | "propChoices"> {
  if (definition.mode !== "composite" || !definition.templateRootId)
    return definition;
  const root = lookupTemplate(definition.templateRootId);
  // A definition cycle is reported by the cycle check; the contract stops at it.
  if (!root || visiting.has(root.definitionId)) return definition;
  const rootDefinition = lookupDefinition(root.definitionId);
  if (!rootDefinition) return definition;
  const rootContract = instanceContract(
    rootDefinition,
    lookupDefinition,
    lookupTemplate,
    new Set([...visiting, root.definitionId]),
  );
  return {
    accepts: { ...rootContract.accepts, ...definition.accepts },
    propChoices: {
      ...Object.fromEntries(
        Object.entries(rootContract.propChoices ?? {}).filter(
          ([key]) => !(key in definition.accepts),
        ),
      ),
      ...definition.propChoices,
    },
  };
}

/** Build-time or test-only. No global registration and no Builder import. */
export function buildCatalogLibrary(
  input: CatalogLibraryInput,
): CatalogLibrary {
  if (input.contractVersion !== LIBRARY_CONTRACT_VERSION)
    throw new CatalogValidationError(
      "UNSUPPORTED_LIBRARY_CONTRACT",
      "library.contractVersion",
    );
  if (!input.revision)
    throw new CatalogValidationError(
      "LIBRARY_REVISION_REQUIRED",
      "library.revision",
    );
  const definitions = uniqueMap(
    input.definitions.map((item) => validateLibraryDefinition(item)),
    (item) => item.id,
    "library.definitions",
  );
  const templates = uniqueMap(
    input.templates.map((item) => validateLibraryTemplate(item)),
    (item) => item.id,
    "library.templates",
  );
  const tokens = uniqueMap(
    input.tokens.map((item) => validateLibraryToken(item)),
    (item) => item.id,
    "library.tokens",
  );
  const bindingIds = new Set(input.bindingIds);
  const triggerIds = new Set(input.triggerIds ?? []);
  const capabilityIds = new Set(input.capabilityIds ?? []);
  const actionOpCodes = new Set(input.actionOpCodes);
  const literal = (value: unknown): unknown =>
    value && typeof value === "object" && "tokenId" in value
      ? tokens.get((value as { tokenId: LibraryTokenId }).tokenId)?.value
      : value;
  for (const id of [...bindingIds, ...triggerIds, ...capabilityIds])
    if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(id))
      throw new CatalogValidationError("INVALID_BINDING_ID", id);
  for (const opcode of actionOpCodes)
    if (
      !["setState", "navigate", "callEndpoint", "toast", "capability"].includes(
        opcode,
      )
    )
      throw new CatalogValidationError("UNKNOWN_ACTION_OPCODE", opcode);
  if (
    bindingIds.size !== input.bindingIds.length ||
    triggerIds.size !== (input.triggerIds ?? []).length ||
    capabilityIds.size !== (input.capabilityIds ?? []).length ||
    actionOpCodes.size !== input.actionOpCodes.length
  )
    throw new CatalogValidationError(
      "DUPLICATE_EXECUTION_ID",
      "library.execution",
    );
  const rules = new Map<string, Readonly<ComponentRule>>();
  for (const [ruleId, rule] of Object.entries(input.rules ?? {})) {
    if (!rule || typeof rule !== "object" || !rule.variants || !rule.sizes)
      throw new CatalogValidationError("INVALID_LIBRARY_RULE", ruleId);
    rules.set(ruleId, freezeDeep(structuredClone(rule)));
  }
  for (const definition of definitions.values()) {
    if (definition.ruleId !== undefined && !rules.has(definition.ruleId))
      throw new CatalogValidationError("UNKNOWN_RULE_ID", definition.ruleId);
    if (definition.bindingId && !bindingIds.has(definition.bindingId))
      throw new CatalogValidationError(
        "UNKNOWN_BINDING_ID",
        definition.bindingId,
      );
    if (definition.templateRootId && !templates.has(definition.templateRootId))
      throw new CatalogValidationError(
        "DANGLING_TEMPLATE",
        definition.templateRootId,
      );
    for (const [key, value] of Object.entries(definition.defaults)) {
      const expected = definition.accepts[key];
      if (!expected)
        throw new CatalogValidationError(
          "PROP_NOT_ACCEPTED",
          `${definition.id}.${key}`,
        );
      if (typeof value !== "object" && typeof value !== expected)
        throw new CatalogValidationError(
          "PROP_TYPE_MISMATCH",
          `${definition.id}.${key}`,
        );
      const choices = definition.propChoices?.[key];
      if (choices && !choices.includes(literal(value) as never))
        throw new CatalogValidationError(
          "PROP_CHOICE_MISMATCH",
          `${definition.id}.${key}`,
        );
    }
  }
  const instanceOf = (definition: Readonly<LibraryDefinition>) =>
    instanceContract(
      definition,
      (id) => definitions.get(id as LibraryDefinitionId),
      (id) => templates.get(id as LibraryTemplateId),
    );
  for (const node of templates.values()) {
    if (!definitions.has(node.definitionId as LibraryDefinitionId))
      throw new CatalogValidationError(
        "DANGLING_DEFINITION",
        node.definitionId,
      );
    const definition = instanceOf(
      definitions.get(node.definitionId as LibraryDefinitionId)!,
    );
    for (const [key, value] of Object.entries(node.props)) {
      const expected = definition.accepts[key];
      if (!expected)
        throw new CatalogValidationError(
          "PROP_NOT_ACCEPTED",
          `${node.id}.${key}`,
        );
      if (typeof value !== "object" && typeof value !== expected)
        throw new CatalogValidationError(
          "PROP_TYPE_MISMATCH",
          `${node.id}.${key}`,
        );
      const choices = definition.propChoices?.[key];
      if (choices && !choices.includes(literal(value) as never))
        throw new CatalogValidationError(
          "PROP_CHOICE_MISMATCH",
          `${node.id}.${key}`,
        );
    }
    for (const child of node.children)
      if (!templates.has(child))
        throw new CatalogValidationError("DANGLING_TEMPLATE", child);
    const composite = definitions.get(node.definitionId as LibraryDefinitionId)!;
    for (const [index, patch] of (node.descendantPatches ?? []).entries()) {
      const at = `${node.id}.descendantPatches[${index}]`;
      if (
        composite.mode !== "composite" ||
        patch.templatePath[0] !== composite.templateRootId
      )
        throw new CatalogValidationError("INVALID_DESCENDANT_ADDRESS", at);
      let target = templates.get(patch.templatePath[0]);
      for (const step of patch.templatePath.slice(1)) {
        if (!target?.children.includes(step))
          throw new CatalogValidationError("INVALID_DESCENDANT_ADDRESS", at);
        target = templates.get(step);
      }
      if (!target) throw new CatalogValidationError("DANGLING_TEMPLATE", at);
      const targetContract = instanceOf(
        definitions.get(target.definitionId as LibraryDefinitionId)!,
      );
      for (const [key, value] of Object.entries(patch.props ?? {})) {
        const expected = targetContract.accepts[key];
        if (!expected)
          throw new CatalogValidationError("PROP_NOT_ACCEPTED", `${at}.${key}`);
        if (typeof value !== "object" && typeof value !== expected)
          throw new CatalogValidationError("PROP_TYPE_MISMATCH", `${at}.${key}`);
        const choices = targetContract.propChoices?.[key];
        if (choices && !choices.includes(literal(value) as never))
          throw new CatalogValidationError("PROP_CHOICE_MISMATCH", `${at}.${key}`);
      }
    }
  }
  const owned = new Map<LibraryTemplateId, string>();
  const own = (id: LibraryTemplateId, owner: string): void => {
    if (owned.has(id))
      throw new CatalogValidationError("DUPLICATE_OWNERSHIP", id);
    owned.set(id, owner);
  };
  for (const definition of definitions.values())
    if (definition.templateRootId)
      own(definition.templateRootId, definition.id);
  for (const template of templates.values())
    for (const child of template.children) own(child, template.id);
  for (const id of templates.keys())
    if (!owned.has(id))
      throw new CatalogValidationError("UNOWNED_TEMPLATE", id);
  const checkFields = (
    fields: Readonly<Record<string, unknown>>,
    accepts: Readonly<Record<string, string>> | undefined,
    at: string,
  ): void => {
    for (const [key, raw] of Object.entries(fields)) {
      const value =
        raw &&
        typeof raw === "object" &&
        (raw as { kind?: string }).kind === "set"
          ? (raw as { value: unknown }).value
          : raw;
      if (
        !value ||
        typeof value !== "object" ||
        (value as { kind?: string }).kind !== "token"
      )
        continue;
      const tokenId = (value as { tokenId: LibraryTokenId }).tokenId;
      const token = tokens.get(tokenId);
      if (!token) throw new CatalogValidationError("DANGLING_TOKEN", tokenId);
      const allowed = accepts
        ? [accepts[key]]
        : ["color", "backgroundColor", "borderColor", "fill"].includes(key)
          ? ["color"]
          : ["opacity", "fontWeight"].includes(key)
            ? ["number"]
            : [
                  "width",
                  "height",
                  "fontSize",
                  "radius",
                  "gap",
                  "padding",
                  "borderWidth",
                  "thumbSize",
                  "indentPerLevel",
                  "iconGap",
                  "paddingX",
                  "paddingY",
                  "minWidth",
                  "paddingTop",
                  "paddingRight",
                  "paddingBottom",
                  "paddingLeft",
                ].includes(key)
              ? ["length", "number"]
              : ["string"];
      if (!allowed.includes(token.tokenType))
        throw new CatalogValidationError("TOKEN_TYPE_MISMATCH", `${at}.${key}`);
    }
  };
  for (const definition of definitions.values()) {
    checkFields(definition.defaults, definition.accepts, definition.id);
    checkFields(definition.visual, undefined, definition.id);
    for (const [prop, choices] of Object.entries(
      definition.propVisualRules ?? {},
    ))
      for (const [choice, fields] of Object.entries(choices))
        checkFields(fields, undefined, `${definition.id}.${prop}.${choice}`);
    for (const [state, fields] of Object.entries(definition.stateRules))
      checkFields(fields ?? {}, undefined, `${definition.id}.${state}`);
    definition.conditionalRules?.forEach((rule, index) =>
      checkFields(
        rule.visual ?? {},
        undefined,
        `${definition.id}.conditionalRules[${index}]`,
      ),
    );
    definition.partRules?.forEach((rule, index) => {
      const at = `${definition.id}.partRules[${index}]`;
      const child = definitions.get(rule.child.definitionId);
      if (!child) throw new CatalogValidationError("DANGLING_DEFINITION", at);
      if (rule.child.via && !definitions.get(rule.child.via))
        throw new CatalogValidationError("DANGLING_DEFINITION", at);
      for (const [prop, value] of Object.entries(rule.child.props ?? {}))
        if (child.accepts[prop] !== typeof value)
          throw new CatalogValidationError("CONDITION_PROP_NOT_ACCEPTED", at);
      const via = rule.child.via ? definitions.get(rule.child.via) : undefined;
      for (const [prop, value] of Object.entries(rule.child.viaProps ?? {}))
        if (via?.accepts[prop] !== typeof value)
          throw new CatalogValidationError("CONDITION_PROP_NOT_ACCEPTED", at);
      checkFields(rule.visual ?? {}, undefined, at);
    });
  }
  for (const template of templates.values()) {
    const definition = definitions.get(
      template.definitionId as LibraryDefinitionId,
    )!;
    checkFields(template.props, definition.accepts, template.id);
    checkFields(template.visual, undefined, template.id);
  }
  const visiting = new Set<LibraryTemplateId>();
  const visited = new Set<LibraryTemplateId>();
  const visit = (id: LibraryTemplateId): void => {
    if (visiting.has(id))
      throw new CatalogValidationError("TEMPLATE_CYCLE", id);
    if (visited.has(id)) return;
    visiting.add(id);
    const node = templates.get(id)!;
    for (const child of node.children) visit(child);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of templates.keys()) visit(id);
  const defVisiting = new Set<LibraryDefinitionId>();
  const defVisited = new Set<LibraryDefinitionId>();
  const visitDefinition = (id: LibraryDefinitionId): void => {
    if (defVisiting.has(id))
      throw new CatalogValidationError("DEFINITION_CYCLE", id);
    if (defVisited.has(id)) return;
    defVisiting.add(id);
    const definition = definitions.get(id)!;
    if (definition.templateRootId) {
      const walk = (templateId: LibraryTemplateId): void => {
        const node = templates.get(templateId)!;
        if (node.definitionId.startsWith("lib:"))
          visitDefinition(node.definitionId as LibraryDefinitionId);
        for (const child of node.children) walk(child);
      };
      walk(definition.templateRootId);
    }
    defVisiting.delete(id);
    defVisited.add(id);
  };
  for (const id of definitions.keys()) visitDefinition(id);
  const library = Object.freeze({
    contractVersion: LIBRARY_CONTRACT_VERSION,
    revision: input.revision,
    definitions: new ImmutableLookup<
      LibraryDefinitionId,
      Readonly<LibraryDefinition>
    >(definitions),
    templates: new ImmutableLookup<
      LibraryTemplateId,
      Readonly<LibraryTemplateNode>
    >(templates),
    tokens: new ImmutableLookup<LibraryTokenId, Readonly<LibraryToken>>(tokens),
    rules: new ImmutableLookup<string, Readonly<ComponentRule>>(rules),
    execution: Object.freeze({
      bindingIds: new ImmutableSet(bindingIds),
      triggerIds: new ImmutableSet(triggerIds),
      capabilityIds: new ImmutableSet(capabilityIds),
      actionOpCodes: new ImmutableSet(actionOpCodes),
    }),
  });
  certifiedLibraries.add(library);
  return library;
}
