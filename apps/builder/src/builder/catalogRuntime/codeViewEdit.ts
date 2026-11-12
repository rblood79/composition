import { catalogPropValueFits } from "../../../../../packages/shared/src/catalog/document/valueType";
import { descendantPatchOf } from "../../../../../packages/shared/src/catalog/document/types";
import { isLibraryOrigin } from "../../../../../packages/shared/src/catalog/runtime/originViewNode";
import {
  isTextRunMarkKey,
  normalizeRichText,
} from "../../../../../packages/shared/src/catalog/document/textRuns";
import type {
  RichText,
  TextRun,
} from "../../../../../packages/shared/src/catalog/document/types";
import { codeViewProjectNames } from "../../../../../packages/shared/src/codeView/files/names";
import { catalogInteractionOverridesAt } from "../../../../../packages/shared/src/catalog/resolution/effectiveInteractions";
import {
  catalogInheritedRuleEnabledCommand,
  catalogReplaceInheritedRuleCommand,
} from "./interactions";
import {
  codeViewAddressOf,
  codeViewExpandedBoundKeys,
  codeViewExpandedBindingProps,
  codeViewExpandedRoot,
  codeViewPositionBindings,
  codeViewPositionOf,
  codeViewPositionUnit,
  codeViewTemplateRoot,
  codeViewRootSlot,
  codeViewRuleKeys,
  codeViewSameAddress,
  codeViewTreeClasses,
} from "../../../../../packages/shared/src/codeView/files/overrides";
import {
  parseCodeViewOverrides,
  type CodeViewOverrideEntry,
  type CodeViewOverrideRules,
} from "../../../../../packages/shared/src/codeView/inverse/overrides";
import {
  codeViewNodeClasses,
  codeViewNodeHasStyle,
  codeViewPageNodes,
} from "../../../../../packages/shared/src/codeView/files/styles";
/**
 * ADR-285 — an edit of the code view applied back to the document across the closed vocabulary
 * (Decision 2 · 3 · 4 · 5 · 6): the edited code is parsed (lezer — never run), each element's
 * identity comes from the editor's edit operations (`identity.ts`), and the difference from the
 * edit session's baseline becomes the document's own commands — elements added (the palette's
 * origin · decision 1), deleted (with what reads them · decision 3), moved, their props · text ·
 * handlers; variables added · renamed (decision 5) · removed · re-defaulted; a list's `filter`
 * terms. Everything is one step (one Undo), planned at the baseline revision (no re-plan).
 *
 * Before anything runs, the plan is staged and the page's code generated again from the staged
 * document: every statement and element the edit wrote must come back as written (a new element
 * may gain its palette defaults). What does not — a part the vocabulary does not read, or reads
 * but no command makes — is refused with its line, and nothing is applied (no partial edit).
 */
import { isDateValueText } from "../../../../../packages/shared/src/state/dateValue";
import {
  createComponent,
  insertNodes,
  renameDefinition,
  setShowWhen,
  setSlotDeclaration,
  moveNodes,
  removeTargets,
  setFields,
  setHtmlId,
  setNodeAttribute,
  setWholeField,
  stageOver,
  type CatalogCommand,
  type CatalogCommandPlan,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  addRecord,
  removeRecords,
  updateRecord,
} from "../../../../../packages/shared/src/catalog/commands/project";
import {
  setNodeInteractions,
  updatePage,
} from "../../../../../packages/shared/src/catalog/commands/project";
import { getPrimitiveBinding } from "../../../../../packages/shared/src/catalog/bindings";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import type {
  CatalogEntry,
  EntryId,
  AuthoredValue,
  InstanceAddress,
  InteractionAction,
  NodeParent,
  WriteValue,
  InteractionEntry,
  NodeEntry,
  NodeId,
  DefinitionEntry,
  PageEntry,
  ProjectEntry,
  StateVariableEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { isBodyType } from "../../../../../packages/shared/src/domain/predicates";
import {
  codeViewComponentPage,
  generateCodeView,
} from "../../../../../packages/shared/src/codeView/generate";
import { componentPropertiesOf } from "../../../../../packages/shared/src/catalog/document/componentProperties";
import {
  COMPONENT_EVENT_ARGS,
  componentEventAttribute,
  componentEventKeyOf,
  componentEventPropertiesOf,
  componentEventTrigger,
  componentPropertyCodeName,
  emitDefinitionOf,
} from "../../../../../packages/shared/src/catalog/document/componentEvents";
import {
  literalOf,
  structuredLiteralOf,
} from "../../../../../packages/shared/src/codeView/inverse";
import {
  codeViewAnchorOutcomes,
  codeViewMatchElements,
  type CodeViewAnchorOutcome,
  type CodeViewChange,
  type CodeViewIdentityUnit,
} from "../../../../../packages/shared/src/codeView/inverse/identity";
import {
  codeViewLineAt,
  codeViewNormalized,
  parseCodeView,
  type CodeViewAttribute,
  type CodeViewElement,
  type CodeViewParsed,
  type CodeViewStatement,
} from "../../../../../packages/shared/src/codeView/inverse/parse";
import type {
  CodeViewAnchor,
  CodeViewResult,
} from "../../../../../packages/shared/src/codeView/types";
import {
  CAPABILITY_REGISTRY,
  eventArgNames,
  eventArgsAreFields,
  resolveCapabilities,
  resolveTriggers,
} from "../../../../../packages/shared/src/interactions/capabilityRegistry";

/**
 * ADR-296 E1 (사용자 결정 4) — every When the type's RAC component has: the registry's events and
 * the ones the panel hides (press side · hover · focus · keyboard). Hiding is the panel's policy,
 * not the document's.
 */
function allTriggers(type: string): readonly string[] {
  const entry = CAPABILITY_REGISTRY[type];
  return [...resolveTriggers(type), ...(entry?.hiddenEvents ?? [])];
}
import { conceptStateOf } from "../../../../../packages/shared/src/interactions/conceptState";
import type { catalogCodeViewData } from "./codeView";
import { planCodeViewFields } from "./codeViewFields";
import {
  codeName as codeNameOf,
  planCodeViews,
  splitTop,
} from "./codeViewViews";
import {
  catalogCreationProps,
  catalogPaletteDefinitionId,
} from "./paletteInsert";

type Data = ReturnType<typeof catalogCodeViewData>;

/** 「코드 고치기」: the page's code when the edit started — the difference is read against it. */
export interface CatalogCodeViewSession {
  readonly projectId: string;
  readonly pageId: EntryId<"page">;
  readonly revision: number;
  readonly baseline: CodeViewResult;
}

export function catalogCodeViewSession(
  reader: CatalogReader,
  pageId: EntryId<"page">,
  data: Data,
): CatalogCodeViewSession | undefined {
  if (reader.getEntry(pageId)?.kind !== "page") return undefined;
  return {
    projectId: reader.projectId,
    pageId,
    revision: reader.revision,
    baseline: generateCodeView({ reader, pageId, ...data }),
  };
}

/** Why a line of the edit is not applied (each has its alternative — `codeView.alternative.*`). */
export type CatalogCodeViewReason =
  | "unparsable"
  | "outsideVocabulary"
  | "unknownTag"
  | "unknownReference"
  | "notInCode"
  | "commandRefused"
  | "derivedChanged"
  | "ambiguousIdentity"
  | "staleBaseline"
  /** ADR-296 E11 — the code names an endpoint by its URL and two endpoints share it. */
  | "ambiguousEndpoint"
  /**
   * ADR-296 Phase 4 · 5 — a read-only file or value (a spec token · a value
   * only the Design panel holds · a Library origin) was edited.
   */
  | "readOnlyFile"
  /**
   * ADR-301 Decision 4 — a structure edit at a Library origin's template position (an element
   * outside its slot · a type change · a move): the origin is read only — unlock it (detail = the
   * origin's definition id).
   */
  | "readOnlyPosition";

export interface CatalogCodeViewRejection {
  /** 1-based line of the edited code. */
  readonly line: number;
  readonly reason: CatalogCodeViewReason;
  /** The line's text. */
  readonly text: string;
  /** A detail the message names (a tag, a name, the document's refusal). */
  readonly detail?: string;
}

export interface CatalogCodeViewPlan {
  /** Absent = nothing to apply (no change, or refused). */
  readonly command?: CatalogCommand;
  /** How many document edits the command makes (its planned steps). */
  readonly count?: number;
  readonly rejected: readonly CatalogCodeViewRejection[];
}

/** The Whens a list's `useDragAndDrop` options hold (its drop · reorder rules). */
const DRAG_TRIGGERS = new Set([
  "onReorder",
  "onInsert",
  "onRootDrop",
  "onItemDrop",
  "onDragEnd",
]);

/** The derived statements (the document makes them — checked, never applied · Decision 6). */
const DERIVED_KINDS = new Set([
  "import",
  "collection",
  "effect",
  "useFilter",
  "collator",
  "navigate",
  "dnd",
  // ADR-291 — the json-formula helpers and the computed rows line (the fields block is edited).
  "formula",
  "computedRows",
  // ADR-296 E3 — a node's ref (`useRef`) for an imperative Do.
  "ref",
  // ADR-296 Phase 2 — the route's parameters (`useParams`).
  "params",
  // ADR-296 E8 — the project variables a page uses (`useProjectState`).
  "projectState",
  // ADR-296 Phase 5 — a component's props type and its inputs (`let {…} = props;`).
  "propsType",
  "props",
]);

/** ADR-296 Phase 2 — the page's head elements (`<title>` · `<meta>` — its `meta`, not nodes). */
const isHead = (element: CodeViewElement) =>
  element.type === "title" || element.type === "meta";

interface PlanInput {
  readonly reader: CatalogReader;
  readonly session: CatalogCodeViewSession;
  /** The edited code. */
  readonly edited: string;
  /** The editor's changes since the baseline, composed (baseline offsets). */
  readonly changes: readonly CodeViewChange[];
  readonly data: Data;
  readonly newId: NewId;
  /**
   * ADR-296 Phase 5 — a component's file: its origin template is the root (`session.pageId` is the
   * definition's id). Its edits are origin commands — every instance follows.
   */
  readonly component?: DefinitionEntry;
  /**
   * Read every unit again, changed or not (the G1 gate: each vocabulary form's reader gives back
   * the document's value — unchanged code then plans nothing that changes the code).
   */
  readonly strict?: boolean;
}

/** Plan an edit of the code view (nothing runs here). */
export function catalogCodeViewPlan(input: PlanInput): CatalogCodeViewPlan {
  const { reader, session, edited } = input;
  const rejected: CatalogCodeViewRejection[] = [];
  const reject = rejecter(edited, rejected);
  if (
    reader.revision !== session.revision ||
    reader.getEntry(session.pageId)?.kind !== "page"
  )
    return {
      rejected: [{ line: 1, reason: "staleBaseline", text: "" }],
    };
  if (edited === session.baseline.code && !input.strict)
    return { rejected: [] };
  const page = planCodeViewPageEdit(input, reject);
  if (!page || rejected.length) return { rejected };
  const { steps } = page;
  const command = composeSteps(steps);

  // Dry run: the staged document's code must give back what the edit wrote.
  let regenerated: string;
  let final: CodeViewFinalClasses;
  try {
    const stage = stageOver(reader);
    stage.apply(command(reader).ops);
    regenerated = generateCodeView({
      reader: stage,
      pageId: session.pageId,
      ...input.data,
    }).code;
    final = codeViewFinalClasses(stage, session.pageId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reject(page.lastFrom, "commandRefused", message);
    return { rejected };
  }
  page.compare(regenerated, final);
  if (rejected.length) return { rejected };
  return steps.length
    ? { command, count: steps.length, rejected }
    : { rejected };
}

/** A refusal collector (one per line and reason) over the edited code's lines. */
export function rejecter(
  edited: string,
  rejected: CatalogCodeViewRejection[],
): Reject {
  return (from, reason, detail) => {
    const line = codeViewLineAt(edited, from);
    if (rejected.some((item) => item.line === line && item.reason === reason))
      return;
    rejected.push({
      line,
      reason,
      text: edited.split("\n")[line - 1] ?? "",
      ...(detail ? { detail } : {}),
    });
  };
}

/** Steps as one command: each plans on the stage the ones before it made. */
export function composeSteps(
  steps: readonly CatalogCommand[],
  onStep?: (index: number) => void,
): CatalogCommand {
  return (commandReader) => {
    const stage = stageOver(commandReader);
    const ops: CatalogCommandPlan["ops"][number][] = [];
    steps.forEach((step, index) => {
      onStep?.(index);
      const plan = step(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
    });
    return { label: "Edit code", ops };
  };
}

/**
 * ADR-296 Decision 1 — a page file's edit planned against `input.reader` (the Apply's stage: the
 * definition files' commands already on it), without running: its steps, and the check of the
 * regenerated page (`compare` — the staged document's code must give back what the edit wrote).
 * Undefined = refused before planning (the reasons are in `reject`).
 */
export function planCodeViewPageEdit(
  input: PlanInput,
  reject: Reject,
):
  | {
      steps: CatalogCommand[];
      compare: (regenerated: string, classes?: CodeViewFinalClasses) => void;
      lastFrom: number;
      newRoot?: string;
    }
  | undefined {
  const { session, edited } = input;
  const parsed = parseCodeView(edited);
  for (const problem of parsed.problems) reject(problem.from, problem.reason);
  if (!parsed.jsx) reject(0, "outsideVocabulary");
  if (parsed.problems.length || !parsed.jsx) return undefined;
  const baseline = session.baseline;
  const outcomes = codeViewAnchorOutcomes(
    baseline.anchors.map((anchor) => ({ from: anchor.start, to: anchor.end })),
    input.changes,
  );
  let failed = false;
  const planner = new Planner(
    input,
    parsed,
    outcomes,
    (from, reason, detail) => {
      failed = true;
      reject(from, reason, detail);
    },
  );
  const steps = planner.plan();
  // ADR-296 Phase 5 — a component file's function name is its definition's name.
  const named = parsed.component?.name;
  const was = parseCodeView(baseline.code).component?.name;
  if (input.component?.templateRootId && named && was && named !== was) {
    if (input.component.id.startsWith("lib:"))
      reject(parsed.component!.from, "readOnlyFile", "name");
    else
      steps.push(
        renameDefinition({
          id: input.component.id as EntryId<"definition">,
          name: named,
          label: "Code",
        }),
      );
  }
  const result = {
    steps: steps.map((step) => step),
    lastFrom: 0,
    /** ADR-296 Phase 5 (G2) — a new component file's origin root (undefined otherwise). */
    newRoot: planner.newRoot,
    /** `classes` — the final document's node classes and styled nodes (Phase 4 — display only). */
    compare: (regenerated: string, classes?: CodeViewFinalClasses) =>
      compareRegenerated(
        parsed,
        parseCodeView(regenerated),
        parseCodeView(baseline.code),
        planner,
        reject,
        classes,
      ),
  };
  // (A refusal names the line of the step that failed — the planner records where each began.)
  Object.defineProperty(result, "lastFrom", {
    get: () => planner.lastFrom,
    set: (value: number) => void value,
  });
  return failed ? undefined : result;
}

/* ─── the planner ────────────────────────────────────────────────────────────────────────── */

export type Reject = (
  from: number,
  reason: CatalogCodeViewReason,
  detail?: string,
) => void;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const capital = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/** ADR-301 — a template position's address and the template node at it. */
type CodeViewPositionTemplate = {
  readonly address: InstanceAddress;
  readonly template: NonNullable<
    ReturnType<CatalogReader["library"]["templates"]["get"]>
  >;
};
/** ADR-301 — the baseline's anchors at one element unit. */
type PositionBaseline = {
  anchor?: CodeViewAnchor;
  attributes: Map<string, CodeViewAnchor>;
  text?: CodeViewAnchor;
};

class Planner {
  readonly steps: CatalogCommand[] = [];
  /** Where the last planned step's code starts (a refusal names that line). */
  lastFrom = 0;
  /** Elements that are new in this edit (their palette defaults may show in the code). */
  readonly added = new Set<CodeViewElement>();
  /**
   * ADR-296 (판독 MEDIUM-1) — the handlers this edit read into rules, and the named functions they
   * call: their meaning is the rules planned, not their names (a name is a position — another rule
   * removed, an element added before renumbers it), so the check compares them by presence only.
   */
  readonly readHandlers = new Set<CodeViewAttribute>();
  readonly readFunctions = new Set<string>();
  /** Whether a kept element's attribute is as the baseline wrote it (unchanged — nothing to read). */
  sameAsBaseline(
    element: CodeViewElement,
    attribute: CodeViewAttribute,
  ): boolean {
    const id = this.ids?.get(element);
    const old = id
      ? this.baseline.anchors.find(
          (anchor) =>
            anchor.target.kind === "attribute" &&
            anchor.target.nodeId === id &&
            anchor.target.name === attribute.name,
        )
      : undefined;
    return (
      !!old &&
      codeViewNormalized(this.code(old)) ===
        codeViewNormalized(
          this.input.edited.slice(attribute.from, attribute.to),
        )
    );
  }
  /** Code name → variable id, as the edited code names them. */
  private readonly variables = new Map<string, string>();
  private readonly baseline: CodeViewResult;
  private readonly page: PageEntry;
  /** ADR-301 — the instances the baseline wrote as their template tree (a `position` anchor's). */
  private readonly baselineExpanded = new Set<string>();

  /** ADR-301 — the Library origin of an expanded instance (the unlock snippet's target). */
  private positionOrigin(ownerId: string): string {
    return (
      (this.reader.getEntry(ownerId) as NodeEntry | undefined)?.definitionId ??
      ownerId
    );
  }

  /**
   * ADR-301 Decision 4 — a template position's element edited, written where the value lives: a
   * prop with a patch at the position → the patch; one its template binds to the instance's prop
   * (`size: "{size}"`) that only this position reads → the instance's prop (a patch would hide it);
   * else a new patch. `{false && …}` → `enabled`; a handler → the position's own rule; a nested
   * instance's `overrides` → its insides (296's grammar). Instance commands only — the Design
   * panel's for the same position.
   */
  private planPosition(
    element: CodeViewElement,
    position: { readonly ownerId: string; readonly key: string },
    { address, template }: CodeViewPositionTemplate,
  ): void {
    const reader = this.reader;
    const owner = reader.getEntry(position.ownerId) as NodeEntry | undefined;
    const root = owner
      ? codeViewExpandedRoot(reader as never, owner.definitionId)
      : undefined;
    if (!owner || !root) return;
    const unit = codeViewPositionUnit(position.ownerId, position.key);
    const target = {
      kind: "descendant" as const,
      ownerId: owner.id as NodeId,
      address,
    };
    const from = element.from;
    const patch = descendantPatchOf(
      owner.descendantOverrides.find((item) =>
        codeViewSameAddress(item.address, address),
      ),
    );
    // `{false && …}` (사용자 결정 3 · 4).
    const wasOff = this.hiddenInBaseline(unit);
    const nowOff = element.visibleState === "false";
    if (element.visibleState !== undefined && !nowOff) {
      this.reject(from, "notInCode", element.visibleState);
      return;
    }
    if (wasOff !== nowOff)
      this.step(
        from,
        setWholeField({
          targets: [target],
          field: "enabled",
          value: nowOff ? false : template.enabled === false ? true : undefined,
        }),
      );
    // The baseline's attributes · text at this position.
    const baselineCode = this.positionBaseline(unit);
    const was = new Map<string, string>();
    for (const [name, item] of baselineCode?.attributes ?? [])
      was.set(name, this.code(item));
    const wasText = baselineCode?.text && this.code(baselineCode.text);
    const now = new Map(element.attributes.map((item) => [item.name, item]));
    const bindings = codeViewPositionBindings(template);
    const readers = bindings.size
      ? codeViewExpandedBoundKeys(reader as never, root)
      : undefined;
    const patchProps: Record<string, WriteValue<AuthoredValue>> = {};
    const rootProps: Record<string, WriteValue<AuthoredValue>> = {};
    /** One prop's write at the layer that makes its value (Decision 4). */
    const write = (prop: string, value: AuthoredValue | undefined) => {
      const key = bindings.get(prop);
      const single = key !== undefined && readers?.get(key) === 1;
      const patched = !!patch?.props && prop in patch.props;
      if (value === undefined) {
        if (patched) patchProps[prop] = { kind: "remove" };
        if (single && owner.props[key!]?.kind === "set")
          rootProps[key!] = { kind: "remove" };
        else if (!patched && key !== undefined)
          patchProps[prop] = { kind: "remove" };
        return;
      }
      if (!patched && single) rootProps[key!] = { kind: "set", value };
      else patchProps[prop] = { kind: "set", value };
    };
    const handlers: string[] = [];
    for (const name of new Set([...was.keys(), ...now.keys()])) {
      if (name === "className" || name === "ref") continue;
      if (/^on[A-Z]/.test(name) || name.startsWith("property:")) {
        handlers.push(name);
        continue;
      }
      if (name === "overrides") continue;
      const edited = now.get(name);
      const before = was.get(name);
      if (
        edited &&
        before !== undefined &&
        codeViewNormalized(this.input.edited.slice(edited.from, edited.to)) ===
          codeViewNormalized(before)
      )
        continue;
      if (!edited) write(name, undefined);
      else {
        const value = this.propValue(edited);
        if (value !== undefined) write(name, value as AuthoredValue);
      }
    }
    const text = element.text;
    if (
      (wasText ? codeViewNormalized(wasText) : undefined) !==
      (text ? codeViewNormalized(text.code) : undefined)
    ) {
      if (!text) write("children", undefined);
      else {
        const value = this.childrenValue(text.code, text.from, element);
        if (value !== undefined) write("children", value as AuthoredValue);
      }
    }
    if (Object.keys(rootProps).length)
      this.step(
        from,
        setFields({
          targets: [{ kind: "node", id: owner.id as NodeId }],
          props: rootProps,
          label: "Code",
        }),
      );
    if (Object.keys(patchProps).length)
      this.step(
        from,
        setFields({ targets: [target], props: patchProps, label: "Code" }),
      );
    // Its own rules: a handler is the position's rule on that When (`expandedRootOf` — one each).
    if (handlers.length) {
      const rulesOf = (
        codes: readonly { trigger: string; code: string; from: number }[],
      ): CodeViewOverrideEntry | undefined => {
        const rules: CodeViewOverrideRules[] = [];
        for (const item of codes) {
          const fn = /^[\w:$]+=\{([\s\S]*)\}$/.exec(item.code.trim())?.[1];
          const parsed = fn
            ? parseCodeViewOverrides(`{'x': {onX: rules({own: [${fn}]})}}`)
            : undefined;
          const own =
            parsed && !("error" in parsed)
              ? parsed.entries[0]?.rules[0]?.own[0]
              : undefined;
          if (!own) {
            this.reject(item.from, "outsideVocabulary", item.trigger);
            return undefined;
          }
          rules.push({
            trigger: item.trigger,
            from: item.from,
            inherited: new Map(),
            own: [{ ...own, from: item.from }],
          });
        }
        return { key: position.key, from, props: new Map(), rules };
      };
      const before = rulesOf(
        handlers
          .filter((name) => was.has(name))
          .map((name) => ({ trigger: name, code: was.get(name)!, from })),
      );
      const after = rulesOf(
        handlers
          .filter((name) => now.has(name))
          .map((name) => {
            const item = now.get(name)!;
            return {
              trigger: name,
              code: this.input.edited.slice(item.from, item.to),
              from: item.from,
            };
          }),
      );
      if (before && after)
        this.planOverrideRules(owner, address, after, before, from);
    }
    // A nested origin instance's insides (Decision 2 — its `overrides`, keys from it).
    if (
      isLibraryOrigin(template.definitionId) &&
      (now.has("overrides") || was.has("overrides"))
    )
      this.planOverrides(element, owner, { unit, prefix: position.key });
  }

  /**
   * ADR-301 Decision 4 (사용자 결정 4) — a template position's element deleted whole: the position
   * hidden (`enabled: false` — the same patch as `{false && …}`), and the regenerated check skips
   * that one element (`hiddenPositions` — R9).
   */
  private removedPosition(position: {
    readonly ownerId: string;
    readonly key: string;
  }): void {
    const address = codeViewAddressOf(
      this.reader as never,
      position.ownerId,
      position.key,
      undefined,
      true,
    );
    if (!address) {
      this.reject(0, "unknownReference", position.key);
      return;
    }
    const unit = codeViewPositionUnit(position.ownerId, position.key);
    this.hiddenPositions.push({
      ownerId: position.ownerId,
      className: position.key.split("/").at(-1)!,
    });
    // (Already hidden — the code just leaves it out: nothing to write.)
    if (this.hiddenInBaseline(unit)) return;
    this.step(
      this.positionBaseline(unit)?.anchor?.start ?? 0,
      setWholeField({
        targets: [
          {
            kind: "descendant",
            ownerId: position.ownerId as NodeId,
            address,
          },
        ],
        field: "enabled",
        value: false,
      }),
    );
  }
  /** ADR-301 — the baseline's anchors by element unit (built on first use). */
  private unitAnchors?: Map<string, PositionBaseline>;
  private positionBaseline(unit: string): PositionBaseline | undefined {
    if (!this.unitAnchors) {
      const units = new Map<string, PositionBaseline>();
      const at = (id: string) => {
        let entry = units.get(id);
        if (!entry) units.set(id, (entry = { attributes: new Map() }));
        return entry;
      };
      for (const anchor of this.baseline.anchors) {
        const target = anchor.target;
        if (target.kind === "position")
          at(codeViewPositionUnit(target.ownerId, target.key)).anchor = anchor;
        else if (target.kind === "attribute")
          at(target.nodeId).attributes.set(target.name, anchor);
        else if (target.kind === "text") at(target.nodeId).text = anchor;
      }
      this.unitAnchors = units;
    }
    return this.unitAnchors.get(unit);
  }
  /** ADR-301 — the baseline wrote this position hidden (`{false && …}` — 사용자 결정 3 · 4). */
  private hiddenInBaseline(unit: string): boolean {
    const anchor = this.positionBaseline(unit)?.anchor;
    return !!anchor && /^\{false && /.test(this.code(anchor));
  }
  /** ADR-301 R9 — the positions the edit deleted whole (hidden): their regenerated `{false && …}`. */
  readonly hiddenPositions: { ownerId: string; className: string }[] = [];

  constructor(
    private readonly input: PlanInput,
    private readonly parsed: CodeViewParsed,
    private readonly outcomes: readonly CodeViewAnchorOutcome[],
    private readonly reject: Reject,
  ) {
    this.baseline = input.session.baseline;
    for (const anchor of this.baseline.anchors)
      if (anchor.target.kind === "position")
        this.baselineExpanded.add(anchor.target.ownerId);
    this.page = input.component
      ? codeViewComponentPage(input.component)
      : (input.reader.getEntry(input.session.pageId) as PageEntry);
    for (const [name, id] of Object.entries(this.baseline.symbols.variables))
      this.variables.set(name, id);
    // ADR-296 E8 — the project variables by their code names, as the Apply's stage has them (a
    // variable `state/project.ts` declares or renames in the same Apply is there).
    const project = input.reader.getEntry(
      input.reader.projectId,
    ) as ProjectEntry;
    for (const id of project.projectVariableIds ?? []) {
      const entry = input.reader.getEntry(id);
      if (entry?.kind !== "projectVariable") continue;
      for (const [name, known] of [...this.variables])
        if (known === id) this.variables.delete(name);
      this.variables.set(codeNameOf(entry.name), id);
    }
  }

  private get reader() {
    return this.input.reader;
  }
  private code(anchor: CodeViewAnchor) {
    return this.baseline.code.slice(anchor.start, anchor.end);
  }
  private step(from: number, command: CatalogCommand) {
    this.lastFrom = from;
    const at = from;
    this.steps.push((reader) => {
      this.lastFrom = at;
      return command(reader);
    });
  }

  plan(): CatalogCommand[] {
    this.planVariables();
    this.planElements();
    this.planSelections();
    this.planDragAndDrop();
    // ADR-291 — the computed-column blocks (a formula typed over is the column's new formula).
    planCodeViewFields({
      reader: this.reader,
      edited: this.parsed,
      baseline: this.baseline,
      strict: !!this.input.strict,
      reject: this.reject,
      step: (from, command) => this.step(from, command),
    });
    if (this.ids)
      planCodeViews({
        reader: this.reader,
        edited: this.parsed,
        baseline: this.baseline,
        baselineParsed: parseCodeView(this.baseline.code),
        collections: this.input.data.collections,
        variables: this.variables,
        ids: this.ids,
        rowReaders: this.rowReaders,
        newId: this.input.newId,
        strict: !!this.input.strict,
        reject: this.reject,
        step: (from, command) => this.step(from, command),
      });
    return this.steps;
  }

  /**
   * A sort variable's state prop beside its handler (`sortDescriptor={s}` · `onSortChange={setS}`):
   * the generator writes it from the rule (a sort variable is always the control's) — not a prop.
   */
  private sortControlled(element: CodeViewElement, type: string): Set<string> {
    const out = new Set<string>();
    for (const attribute of element.attributes) {
      const code =
        attribute.value?.kind === "expression"
          ? attribute.value.code.trim()
          : "";
      const state = /^on[A-Z]/.test(attribute.name)
        ? conceptStateOf(type, attribute.name)
        : undefined;
      const name = /^set[A-Z]/.test(code)
        ? code.charAt(3).toLowerCase() + code.slice(4)
        : "";
      const sort = this.parsed.statements.some(
        (item) =>
          item.kind === "state" &&
          item.name === name &&
          /useState<SortDescriptor>/.test(item.code),
      );
      const prop = state
        ? element.attributes.find((item) => item.name === state.prop)
        : undefined;
      if (
        sort &&
        prop?.value?.kind === "expression" &&
        prop.value.code.trim() === name
      )
        out.add(state!.prop);
    }
    return out;
  }

  /**
   * A list's `useDragAndDrop({…})` (its `dragAndDropHooks={…}`): each `onReorder(e) { … }` ·
   * `async onInsert(e) { … }` option is that list's rule on the When (its Dos read as a handler's,
   * the event's fields as `e.…`). The drag types and drop operation are the document's (derived).
   */
  private planDragAndDrop(): void {
    const baseline = new Set(
      parseCodeView(this.baseline.code)
        .statements.filter((item) => item.kind === "dnd")
        .map((item) => codeViewNormalized(item.code)),
    );
    for (const statement of this.parsed.statements) {
      if (statement.kind !== "dnd") continue;
      if (
        !this.input.strict &&
        baseline.has(codeViewNormalized(statement.code))
      )
        continue;
      const element = this.findElement(
        (item) =>
          item.attributes
            .find((a) => a.name === "dragAndDropHooks")
            ?.value?.code.trim() === statement.name,
      );
      const id = element ? this.ids?.get(element) : undefined;
      const node = id ? this.reader.getEntry(id) : undefined;
      const type =
        node?.kind === "node"
          ? definitionTypeName(this.reader, node.definitionId)
          : element?.type;
      if (!element || !id || !type) {
        this.reject(statement.from, "unknownReference", statement.name);
        continue;
      }
      // The options: `[async] <When>(e) {` … `},` at the object's top level.
      const lines = statement.code.split("\n");
      const options: { trigger: string; body: string; from: number }[] = [];
      let at = statement.from;
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index]!;
        const open = /^\s*(?:async )?(on[A-Z]\w*)\(e\) \{$/.exec(line);
        if (open) {
          const indent = /^\s*/.exec(line)![0];
          const end = lines.findIndex(
            (other, j) => j > index && other === `${indent}},`,
          );
          if (end < 0) {
            this.reject(at, "outsideVocabulary", open[1]);
            return;
          }
          options.push({
            trigger: open[1]!,
            body: lines.slice(index + 1, end).join("\n") + "\n",
            from: at,
          });
          for (let j = index; j <= end; j += 1) at += lines[j]!.length + 1;
          index = end;
          continue;
        }
        at += line.length + 1;
      }
      const triggers = resolveTriggers(type);
      const rules: { trigger: string; actions: InteractionAction[] }[] = [];
      for (const option of options) {
        if (!triggers.includes(option.trigger)) {
          this.reject(option.from, "outsideVocabulary", option.trigger);
          return;
        }
        const actions = this.dosOf(option.body, option.from, {
          trigger: option.trigger,
          args: eventArgNames(option.trigger)[0] ?? [],
          fields: true,
          params: ["e"],
        });
        if (!actions) return;
        rules.push({ trigger: option.trigger, actions });
      }
      this.step(statement.from, (stage) => {
        const project = stage.getEntry(stage.projectId) as ProjectEntry;
        const own = project.interactionIds
          .map((ruleId) => stage.getEntry(ruleId))
          .filter(
            (entry): entry is InteractionEntry =>
              entry?.kind === "interaction" &&
              entry.ownerId === id &&
              !entry.address,
          );
        const entries = [
          ...own.filter((rule) => !DRAG_TRIGGERS.has(rule.trigger)),
          ...rules.map(
            (rule) =>
              ({
                kind: "interaction",
                id:
                  own.find((item) => item.trigger === rule.trigger)?.id ??
                  (this.input.newId("interaction") as EntryId<"interaction">),
                ownerId: id as NodeId,
                trigger: rule.trigger,
                actions: rule.actions,
              }) as InteractionEntry,
          ),
        ];
        return setNodeInteractions({
          ownerId: id as NodeId,
          entries,
          label: "Edit drag and drop",
        })(stage);
      });
    }
  }

  /** `selectedKeys={x}` · `onSelectionChange={setX}` of a list selection `x` — the variable's. */
  private selectionOwned(attribute: CodeViewAttribute): boolean {
    const code =
      attribute.value?.kind === "expression" ? attribute.value.code.trim() : "";
    return this.parsed.statements.some(
      (item) =>
        item.kind === "listSelection" &&
        ((attribute.name === "selectedKeys" && code === item.name) ||
          (attribute.name === "onSelectionChange" && code === item.setter)),
    );
  }

  /** List selections the code names newly: a variable of the list whose `selectedKeys` reads it. */
  private readonly newSelections: CodeViewStatement[] = [];

  /**
   * A new `let {selectedKeys: x, setSelectedKeys: setX} = list;` — the selection of the list that
   * reads it (`selectedKeys={x}`): a variable named on that list's `selectedKeys`.
   */
  private planSelections(): void {
    for (const statement of this.newSelections) {
      const name = statement.name!;
      const element = this.findElement((item) =>
        item.attributes.some(
          (attribute) =>
            attribute.name === "selectedKeys" &&
            attribute.value?.kind === "expression" &&
            attribute.value.code.trim() === name,
        ),
      );
      const nodeId = element ? this.ids?.get(element) : undefined;
      if (!nodeId) {
        this.reject(statement.from, "unknownReference", name);
        continue;
      }
      const id = this.input.newId("stateVariable") as EntryId<"stateVariable">;
      this.variables.set(name, id);
      this.step(
        statement.from,
        addRecord({
          entry: {
            kind: "stateVariable",
            id,
            ownerId: this.variableOwner(),
            name,
            valueType: "string[]",
            defaultValue: [],
            source: { nodeId, prop: "selectedKeys" },
          } as StateVariableEntry,
        }),
      );
    }
  }

  /** The first element (depth first) that matches. */
  private findElement(
    match: (element: CodeViewElement) => boolean,
  ): CodeViewElement | undefined {
    const visit = (
      elements: readonly CodeViewElement[],
    ): CodeViewElement | undefined => {
      for (const element of elements) {
        if (match(element)) return element;
        const inner = visit(element.children);
        if (inner) return inner;
      }
      return undefined;
    };
    return visit(this.parsed.jsx?.roots ?? []);
  }

  /** Elements whose text reads a row (`<rows>.find(row => row.id === …)`) — the views bind them. */
  private readonly rowReaders = new Map<CodeViewElement, string>();

  /* ── variables (`useState`) ── */

  private planVariables(): void {
    // (ADR-287 — a rule's implicit state is the rule's, not a variable: its line is derived.)
    const implicit = this.baseline.symbols.states ?? {};
    const statements = this.parsed.statements.filter(
      (item) =>
        (item.kind === "state" || item.kind === "listSelection") &&
        !(item.name && Object.hasOwn(implicit, item.name)),
    );
    const used = new Set<CodeViewStatement>();
    const variableAnchors = this.baseline.anchors
      .map((anchor, index) => ({ anchor, outcome: this.outcomes[index]! }))
      .filter(
        (item) =>
          item.anchor.target.kind === "variable" &&
          /^let (?:\[|\{selectedKeys)/.test(this.code(item.anchor)),
      );
    const pairs: { statement: CodeViewStatement; id: string }[] = [];
    // Kept spans: the same variable (decision 5 — a name typed over is a rename).
    for (const { anchor, outcome } of variableAnchors) {
      if (outcome.kind !== "kept") continue;
      const statement = statements.find(
        (item) => item.from === outcome.from && !used.has(item),
      );
      if (!statement) continue;
      used.add(statement);
      pairs.push({
        statement,
        id: (anchor.target as { variableId: string }).variableId,
      });
    }
    // Adjacent default edits can replace a later declaration's whole span. Identical text or an
    // unchanged name keeps its variable; a rename still falls back to the same type/start in a hunk.
    const left = variableAnchors.filter(
      (item) =>
        !pairs.some(
          (pair) =>
            pair.id ===
            (item.anchor.target as { variableId: string }).variableId,
        ),
    );
    for (const item of left) {
      const text = codeViewNormalized(this.code(item.anchor));
      const id = (item.anchor.target as { variableId: string }).variableId;
      const equal = statements.find(
        (statement) =>
          !used.has(statement) && codeViewNormalized(statement.code) === text,
      );
      const shape = (code: string) =>
        codeViewNormalized(code).replace(/^let\[[^\]]*\]/, "");
      const oldName = Object.entries(this.baseline.symbols.variables).find(
        ([, variableId]) => variableId === id,
      )?.[0];
      const same =
        equal ??
        statements.find(
          (statement) => !used.has(statement) && statement.name === oldName,
        ) ??
        (item.outcome.kind === "replaced"
          ? statements.find(
              (statement) =>
                !used.has(statement) &&
                shape(statement.code) === shape(this.code(item.anchor)),
            )
          : undefined);
      if (same) {
        used.add(same);
        pairs.push({ statement: same, id });
      } else {
        this.step(
          0,
          removeRecords({
            ids: [id as EntryId<"stateVariable">],
            label: "Delete variable",
          }),
        );
        for (const [name, value] of [...this.variables])
          if (value === id) this.variables.delete(name);
      }
    }
    for (const { statement, id } of pairs) {
      const entry = this.reader.getEntry(id) as StateVariableEntry | undefined;
      if (entry?.kind !== "stateVariable") continue;
      const next = this.stateOf(statement);
      if (!next) continue;
      const oldName = Object.entries(this.baseline.symbols.variables).find(
        ([, value]) => value === id,
      )?.[0];
      if (oldName && oldName !== statement.name) {
        this.variables.delete(oldName);
      }
      this.variables.set(statement.name!, id);
      const changes: Partial<StateVariableEntry> = {};
      if (oldName !== statement.name) changes.name = statement.name!;
      if (statement.kind === "listSelection") {
        if (changes.name)
          this.step(
            statement.from,
            updateRecord({
              entry: { ...entry, ...changes } as StateVariableEntry,
              label: "Edit variable",
            }),
          );
        continue;
      }
      // (A selection is `useState<Selection>` whether its type says `array` or `string[]`.)
      const selection = (type: string) =>
        type === "array" || type === "string[]";
      if (
        next.valueType !== entry.valueType &&
        !(selection(next.valueType) && selection(entry.valueType))
      )
        changes.valueType = next.valueType;
      // (A structured variable's empty start is `""` or `null` alike — the code shows neither.)
      const empty = (value: unknown) => value === "" || value === null;
      if (
        JSON.stringify(next.defaultValue) !==
          JSON.stringify(entry.defaultValue) &&
        !(
          next.valueType === "object" &&
          empty(next.defaultValue) &&
          empty(entry.defaultValue)
        ) &&
        // (A selection whose start is not a key list shows as `new Set()` — as written.)
        !(
          next.valueType === "string[]" &&
          selection(entry.valueType) &&
          !Array.isArray(entry.defaultValue) &&
          JSON.stringify(next.defaultValue) === "[]"
        )
      )
        changes.defaultValue = next.defaultValue as never;
      if (Object.keys(changes).length)
        this.step(
          statement.from,
          updateRecord({
            entry: { ...entry, ...changes } as StateVariableEntry,
            label: "Edit variable",
          }),
        );
    }
    // New statements: new page variables (a list's selection once its list is known).
    for (const statement of statements) {
      if (used.has(statement)) continue;
      if (statement.kind === "listSelection") {
        this.newSelections.push(statement);
        continue;
      }
      const next = this.stateOf(statement);
      if (!next) continue;
      const id = this.input.newId("stateVariable") as EntryId<"stateVariable">;
      this.variables.set(statement.name!, id);
      this.step(
        statement.from,
        addRecord({
          entry: {
            kind: "stateVariable",
            id,
            ownerId: this.variableOwner(),
            name: statement.name!,
            valueType: next.valueType,
            defaultValue: next.defaultValue as never,
          } as StateVariableEntry,
        }),
      );
    }
  }

  /** A `useState` statement's name check · type · start value. */
  private stateOf(
    statement: CodeViewStatement,
  ):
    | { valueType: StateVariableEntry["valueType"]; defaultValue: unknown }
    | undefined {
    if (statement.setter !== `set${capital(statement.name!)}`) {
      this.reject(
        statement.from,
        "outsideVocabulary",
        `set${capital(statement.name!)}`,
      );
      return undefined;
    }
    if (statement.kind === "listSelection")
      return { valueType: "string[]", defaultValue: [] };
    const m =
      /= useState(?:<(Selection|SortDescriptor|DateValue \| null|Time \| null|string\[\] \| 'all'|boolean \| 'first' \| 'last')>)?\(([\s\S]*)\);$/.exec(
        statement.code,
      );
    if (!m) {
      this.reject(statement.from, "outsideVocabulary");
      return undefined;
    }
    const [, type, raw = ""] = m;
    const text = raw.trim();
    if (type === "string[] | 'all'" || type === "boolean | 'first' | 'last'") {
      const valueType =
        type === "string[] | 'all'" ? "selectionKeys" : "autoFocus";
      const value = structuredLiteralOf(text);
      if (!value || !catalogPropValueFits(value.value, valueType)) {
        this.reject(statement.from, "outsideVocabulary");
        return undefined;
      }
      return { valueType, defaultValue: value.value };
    }
    // (A sort variable starts empty — 「정렬 따라가기」 makes it so.)
    if (type === "SortDescriptor")
      return text ? undefined : { valueType: "object", defaultValue: "" };
    if (type === "Selection") {
      const keys = text === "new Set()" ? [] : literalOf(text);
      if (!Array.isArray(keys)) {
        this.reject(statement.from, "outsideVocabulary");
        return undefined;
      }
      return { valueType: "string[]", defaultValue: keys };
    }
    // (A date variable: `useState<DateValue | null>(parseDate('…'))` · `(null)` — its ISO text.)
    if (type === "DateValue | null" || type === "Time | null") {
      if (text === "null") return { valueType: "date", defaultValue: "" };
      // (An absolute instant is `parseAbsolute('…Z', 'UTC')` — the zone its text is read in.)
      const call =
        /^parse(?:Date|DateTime|Time|ZonedDateTime)\(([\s\S]*)\)$|^parseAbsolute\(([\s\S]*?),\s*'UTC'\)$/.exec(
          text,
        );
      const iso = call ? literalOf((call[1] ?? call[2])!.trim()) : undefined;
      if (typeof iso !== "string" || !isDateValueText(iso) || iso === "") {
        this.reject(statement.from, "outsideVocabulary");
        return undefined;
      }
      return { valueType: "date", defaultValue: iso };
    }
    if (text === "null") return { valueType: "object", defaultValue: null };
    // (A JSON literal is a structured default — `{…}` an object's, `[…]` an array's, 2026-10-29.)
    if (text.startsWith("{") || text.startsWith("[")) {
      const structured = structuredLiteralOf(text)?.value;
      if (Array.isArray(structured))
        return { valueType: "array", defaultValue: structured };
      if (structured && typeof structured === "object")
        return { valueType: "object", defaultValue: structured };
      this.reject(statement.from, "outsideVocabulary");
      return undefined;
    }
    const value = literalOf(text);
    if (typeof value === "string")
      return { valueType: "string", defaultValue: value };
    if (typeof value === "number")
      return { valueType: "number", defaultValue: value };
    if (typeof value === "boolean")
      return { valueType: "boolean", defaultValue: value };
    this.reject(statement.from, "outsideVocabulary");
    return undefined;
  }

  /* ── elements ── */

  private planElements(): void {
    const { reader } = this;
    const baseline = this.baseline;
    // The baseline's elements: their units (the enclosing node anchor is the parent).
    // (ADR-301 — an expanded instance's template positions are units too: `position` anchors.)
    const unitOf = (target: CodeViewAnchor["target"]) =>
      target.kind === "node"
        ? target.nodeId
        : target.kind === "position"
          ? codeViewPositionUnit(target.ownerId, target.key)
          : "";
    const nodeAnchors = baseline.anchors
      .map((anchor, index) => ({ anchor, outcome: this.outcomes[index]! }))
      .filter(
        (item) =>
          item.anchor.target.kind === "node" ||
          item.anchor.target.kind === "position",
      );
    const units: CodeViewIdentityUnit[] = nodeAnchors.map(
      ({ anchor, outcome }) => {
        const id = unitOf(anchor.target);
        const parent = nodeAnchors
          .filter(
            (other) =>
              other.anchor !== anchor &&
              other.anchor.start <= anchor.start &&
              other.anchor.end >= anchor.end,
          )
          .sort((a, b) => b.anchor.start - a.anchor.start)[0];
        const node = reader.getEntry(id) as NodeEntry;
        return {
          id,
          ...(parent ? { parentId: unitOf(parent.anchor.target) } : {}),
          type:
            /^\{?[\w$]+ && <([\w$.]+)|^<([\w$.]+)/
              .exec(this.code(anchor))
              ?.slice(1)
              .find(Boolean) ?? "",
          code: this.code(anchor),
          // (A position is its owner's — two instances' same position never pair by text.)
          state: node
            ? stateOf(reader, node)
            : JSON.stringify({ position: id }),
          outcome,
        };
      },
    );
    const identity = codeViewMatchElements(
      units,
      this.parsed.jsx!.roots.filter((element) => !isHead(element)),
      this.input.edited,
    );
    for (const span of identity.ambiguous)
      this.reject(span.from, "ambiguousIdentity");
    for (const element of identity.added) this.added.add(element);

    // ADR-301 — a template position taken out of the code (its element deleted whole).
    const removedNodes: string[] = [];
    for (const id of identity.removed) {
      const position = codeViewPositionOf(id);
      if (position) this.removedPosition(position);
      else removedNodes.push(id);
    }
    // Removed elements (with what reads them — decision 3).
    if (removedNodes.length)
      this.step(
        0,
        removeTargets({
          targets: removedNodes.map((id) => ({
            kind: "node" as const,
            id: id as NodeId,
          })),
          newId: this.input.newId,
          label: "Delete",
        }),
      );

    // The page's content: the body's children (the fragment), else the page's.
    const body = this.page.children
      .map((id) => reader.getEntry(id))
      .find(
        (entry): entry is NodeEntry =>
          entry?.kind === "node" &&
          isBodyType(definitionTypeName(reader, entry.definitionId)),
      );
    const removed = new Set(identity.removed);
    const ids = new Map<CodeViewElement, string>(identity.matched);
    this.ids = ids;
    // New elements: ids now (the plan names them before they exist).
    for (const element of identity.added) {
      if (element.type === "Slot") continue; // (an instance's slot position, not a node)
      const type = element.type === "div" ? "frame" : element.type;
      const definitionId =
        this.componentDefinition(element.type) ??
        catalogPaletteDefinitionId(reader.library, type);
      if (
        !reader.library.definitions.has(definitionId as never) &&
        reader.getEntry(definitionId)?.kind !== "definition"
      ) {
        this.reject(element.from, "unknownTag", element.type);
        continue;
      }
      ids.set(element, this.input.newId("node"));
    }
    // ADR-296 Phase 5 — a new instance's slot contents: an element of a type its placing fills
    // with (`<Tag>` in a TagGroup — the Library's `Tag/Default`) is that definition.
    this.planSlotDefaults(identity.added, ids, reader);
    // (Their entries now — reading their text is planning: a row read names the view to bind.)
    const entries = new Map<CodeViewElement, NodeEntry[]>();
    for (const element of identity.added)
      if (ids.has(element)) entries.set(element, this.entriesOf(element, ids));

    // Structure: each parent's children as the code lists them (places · moves · inserts).
    /** A parent's place for its children: a node · page, or an instance's slot position. */
    type Place = {
      readonly parent: NodeParent;
      readonly current: (stage: CatalogReader) => readonly string[] | undefined;
    };
    const nodePlace = (parentId: string): Place => ({
      parent: { kind: "node", id: parentId as NodeId },
      current: (stage) =>
        (stage.getEntry(parentId) as NodeEntry | PageEntry | undefined)
          ?.children,
    });
    const slotPlace = (ownerId: string, address: InstanceAddress): Place => ({
      parent: { kind: "descendant", ownerId: ownerId as NodeId, address },
      current: (stage) => {
        const owner = stage.getEntry(ownerId) as NodeEntry | undefined;
        const fill = owner?.descendantOverrides.find(
          (item) =>
            item.kind === "fillSlot" &&
            codeViewSameAddress(item.address, address),
        );
        return fill?.kind === "fillSlot" ? fill.childIds : [];
      },
    });
    const placeChildren = (
      place: Place,
      children: readonly CodeViewElement[],
      from: number,
    ) => {
      const wanted = children
        .map((child) => ids.get(child))
        .filter((id): id is string => !!id);
      // (Already so — the removals aside: nothing to arrange.)
      const now = place.current(reader)?.filter((id) => !removed.has(id));
      if (now && JSON.stringify(now) === JSON.stringify(wanted)) return;
      this.step(from, (stageReader) => {
        const stage = stageOver(stageReader);
        const ops: CatalogCommandPlan["ops"][number][] = [];
        wanted.forEach((id, index) => {
          const current = place.current(stage);
          if (current?.[index] === id) return;
          const element = children.find((child) => ids.get(child) === id)!;
          const plan = this.added.has(element)
            ? insertNodes({
                parent: place.parent,
                index,
                entries: entries.get(element)!,
                rootIds: [id as NodeId],
                newId: this.input.newId,
                label: "Add element",
              })(stage)
            : moveNodes({
                ids: [id as NodeId],
                parent: place.parent,
                index,
                newId: this.input.newId,
                label: "Move",
              })(stage);
          stage.apply(plan.ops);
          ops.push(...plan.ops);
        });
        return { label: "Arrange", ops };
      });
    };
    /** Every new instance of a new subtree: its slots as written, outer first. */
    const fill = (element: CodeViewElement) => {
      const elementId = ids.get(element);
      const definitionId = (entries.get(element) ?? [])[0]?.definitionId;
      if (elementId && definitionId)
        this.fillNewSlots(element, elementId, definitionId, entries);
      for (const inner of element.children.flatMap((item) =>
        item.type === "Slot" ? item.children : [item],
      ))
        fill(inner);
    };
    /**
     * ADR-301 — an expanded instance's position: its fill's children (a slot position) are placed
     * and visited as a node's; its own positions are visited; nothing else is the code's to add.
     */
    const visitPosition = (
      element: CodeViewElement,
      position: { readonly ownerId: string; readonly key: string },
    ) => {
      const at = codeViewPositionTemplate(reader, position);
      if (!at) {
        this.reject(element.from, "unknownReference", position.key);
        return;
      }
      this.planPosition(element, position, at);
      const { address, template } = at;
      const inner = element.children.filter(
        (child) => !!codeViewPositionOf(ids.get(child) ?? ""),
      );
      for (const child of inner)
        visitPosition(child, codeViewPositionOf(ids.get(child)!)!);
      const rest = element.children.filter((child) => !inner.includes(child));
      if (!rest.length) return;
      if (!template.slot || inner.length) {
        this.reject(
          rest[0]!.from,
          "readOnlyPosition",
          this.positionOrigin(position.ownerId),
        );
        return;
      }
      placeChildren(slotPlace(position.ownerId, address), rest, element.from);
      visitChildren(rest);
    };
    const visitChildren = (children: readonly CodeViewElement[]) => {
      for (const child of children) {
        const id = ids.get(child);
        if (!id) continue;
        const position = codeViewPositionOf(id);
        if (position) {
          visitPosition(child, position);
          continue;
        }
        if (!this.added.has(child)) this.planAttributes(child, id);
        else {
          fill(child);
          this.planNewHandlers(child, id);
        }
        // (A new element's subtree goes in with it; a list's rows are its binding's.)
        if (!this.added.has(child) && !child.rows)
          visit(id, child.children, child.from);
      }
    };
    const visit = (
      parentId: string,
      children: readonly CodeViewElement[],
      from: number,
    ) => {
      // ADR-296 Phase 5 — an instance's children fill its template root's slot; a `<Slot
      // name="<path>">` fills that position (instance commands — descendant parents).
      const parent = reader.getEntry(parentId) as NodeEntry | undefined;
      // ADR-301 — an expanded instance's children are its template's positions (no new element).
      if (
        parent?.kind === "node" &&
        this.baselineExpanded.has(parentId) &&
        codeViewExpandedRoot(reader as never, parent.definitionId)
      ) {
        for (const child of children) {
          const position = codeViewPositionOf(ids.get(child) ?? "");
          if (position?.ownerId === parentId) visitPosition(child, position);
          else
            this.reject(
              child.from,
              "readOnlyPosition",
              this.positionOrigin(parentId),
            );
        }
        return;
      }
      const rootSlot =
        parent?.kind === "node"
          ? codeViewRootSlot(reader as never, parent)
          : undefined;
      const plain = children.filter((child) => child.type !== "Slot");
      placeChildren(
        rootSlot
          ? slotPlace(parentId, {
              instances: [parentId as NodeId],
              templatePath: rootSlot.templatePath,
            } as InstanceAddress)
          : nodePlace(parentId),
        plain,
        from,
      );
      visitChildren(plain);
      for (const slot of children.filter((child) => child.type === "Slot")) {
        const name = slot.attributes.find((item) => item.name === "name")?.value
          ?.code;
        const address =
          name && parent?.kind === "node"
            ? codeViewAddressOf(reader as never, parentId, name)
            : undefined;
        if (!address) {
          this.reject(slot.from, "unknownReference", name ?? "Slot");
          continue;
        }
        placeChildren(slotPlace(parentId, address), slot.children, slot.from);
        visitChildren(slot.children);
      }
    };
    if (body) {
      visit(
        body.id,
        this.parsed.jsx!.roots.filter((element) => !isHead(element)),
        this.parsed.jsx!.from,
      );
      // ADR-296 E7 — the page element's attributes are the body's (none = `<>`).
      const page = this.parsed.jsx!.page;
      const had = this.baseline.anchors.some(
        (anchor) =>
          anchor.target.kind === "derived" && anchor.target.key === "page",
      );
      if (page || had)
        this.planAttributes(
          page ?? {
            ...this.parsed.jsx!,
            type: "Page",
            attributes: [],
            children: [],
          },
          body.id,
        );
      this.planHead(this.parsed.jsx!.roots.filter(isHead));
    } else if (this.input.component && !this.input.component.templateRootId) {
      // ADR-296 Phase 5 (G2) — a new component's file: its one root element becomes the origin —
      // placed on a host page's body, made a component (`createComponent`), its instance there taken
      // away (existing commands only — no new one).
      const roots = this.parsed.jsx!.roots;
      const root = roots[0];
      const rootId = root ? ids.get(root) : undefined;
      const host = (
        reader.getEntry(
          (reader.getEntry(reader.projectId) as ProjectEntry).pageIds[0] ?? "",
        ) as PageEntry | undefined
      )?.children[0];
      if (
        roots.length !== 1 ||
        !root ||
        !rootId ||
        !this.added.has(root) ||
        !host
      ) {
        this.reject(root?.from ?? this.parsed.jsx!.from, "notInCode", "root");
        return;
      }
      this.newRoot = rootId;
      this.step(
        root.from,
        insertNodes({
          parent: { kind: "node", id: host as NodeId },
          entries: entries.get(root)!,
          rootIds: [rootId as NodeId],
          newId: this.input.newId,
          label: "Code",
        }),
      );
      // (Its new instances' slot contents — a ListBox's items — as in a page: 판독 Phase 5 MEDIUM-3.)
      fill(root);
      this.planNewHandlers(root, rootId);
      const name = this.input.component.name;
      // (One definition id for the plan and the run — the page file of the Apply names it.)
      const definitionId = this.input.newId("definition");
      const newId = ((kind: string) =>
        kind === "definition"
          ? definitionId
          : this.input.newId(kind as never)) as NewId;
      this.step(
        root.from,
        createComponent({ id: rootId as NodeId, name, newId }),
      );
      this.step(root.from, (stage) => {
        const instance = (stage.getEntry(host) as NodeEntry).children.find(
          (id) => {
            const node = stage.getEntry(id) as NodeEntry | undefined;
            const definition = node
              ? (stage.getEntry(node.definitionId) as
                  DefinitionEntry | undefined)
              : undefined;
            return definition?.templateRootId === rootId;
          },
        );
        return removeTargets({
          targets: instance ? [{ kind: "node", id: instance as NodeId }] : [],
          newId: this.input.newId,
          label: "Code",
        })(stage);
      });
    } else if (this.input.component?.templateRootId) {
      // ADR-296 Phase 5 — a component's file: one root, its origin's template root (kept).
      const rootId = this.input.component.templateRootId;
      const roots = this.parsed.jsx!.roots;
      const root = roots[0];
      if (roots.length !== 1 || !root || ids.get(root) !== rootId) {
        this.reject(root?.from ?? this.parsed.jsx!.from, "notInCode", "root");
        return;
      }
      this.planAttributes(root, rootId);
      if (!root.rows) visit(rootId, root.children, root.from);
    } else this.reject(this.parsed.jsx!.from, "notInCode");
  }

  /** ADR-296 Phase 2 — `<title>` · `<meta …>` → the page's `meta` (`updatePage`). */
  private planHead(elements: readonly CodeViewElement[]): void {
    const meta: NonNullable<PageEntry["meta"]> = {};
    const attr = (element: CodeViewElement, name: string) => {
      const value = element.attributes.find(
        (item) => item.name === name,
      )?.value;
      return value?.kind === "string"
        ? value.code.replace(/\\(.)/g, "$1")
        : undefined;
    };
    for (const element of elements) {
      if (element.type === "title") {
        const text = element.text?.code.trim() ?? "";
        const quoted = /^\{('(?:[^'\\]|\\.)*')\}$/.exec(text);
        meta.title = quoted ? String(literalOf(quoted[1]!)) : text;
        continue;
      }
      const name = attr(element, "name");
      const property = attr(element, "property");
      const content = attr(element, "content");
      if (name === "description" && content !== undefined)
        meta.description = content;
      else if (property === "og:image" && content !== undefined)
        meta.socialImage = content as never;
      else if (name === "robots" && content === "noindex")
        meta.hidden = { ...meta.hidden, search: true };
      else if (name === "sitemap" && content === "exclude")
        meta.hidden = { ...meta.hidden, sitemap: true };
      else this.reject(element.from, "outsideVocabulary", element.type);
    }
    if (JSON.stringify(meta) === JSON.stringify(this.page.meta ?? {})) return;
    this.step(
      elements[0]?.from ?? 0,
      updatePage({
        id: this.page.id,
        fields: { meta: Object.keys(meta).length ? meta : undefined },
        label: "Edit page",
      }),
    );
  }

  /** A new element and its new subtree as entries (the palette's origin · decision 1). */
  private entriesOf(
    element: CodeViewElement,
    ids: ReadonlyMap<CodeViewElement, string>,
  ): NodeEntry[] {
    const type = element.type === "div" ? "frame" : element.type;
    const library = this.reader.library;
    // ADR-296 Phase 5 — `<Picker …/>` is an instance of the user component.
    const component = this.componentDefinition(element.type);
    const definitionId = (this.slotDefaults.get(element) ??
      component ??
      catalogPaletteDefinitionId(library, type)) as ReturnType<
      typeof catalogPaletteDefinitionId
    >;
    const props = component
      ? {}
      : catalogCreationProps(library, definitionId, type);
    this.idIsProp = this.acceptsId(definitionId);
    const sorted = this.sortControlled(
      element,
      definitionTypeName(this.reader, definitionId),
    );
    for (const attribute of element.attributes) {
      if (
        /^on[A-Z]/.test(attribute.name) ||
        attribute.name === "items" ||
        attribute.name === "ref" ||
        attribute.name === "overrides" ||
        attribute.name === "composition" ||
        this.isMetadata(
          attribute.name,
          definitionTypeName(this.reader, definitionId),
        ) ||
        sorted.has(attribute.name) ||
        this.selectionOwned(attribute)
      )
        continue;
      const value = this.propValue(attribute);
      if (value !== undefined)
        props[attribute.name] = { kind: "set", value } as never;
    }
    const text = element.text
      ? this.childrenValue(element.text.code, element.text.from, element)
      : undefined;
    if (text !== undefined)
      props.children = { kind: "set", value: text } as never;
    // ADR-296 Phase 5 — a new instance's slot contents are its positions' (filled after it is
    // placed — `fillNewSlots`), not its own children.
    const owned = this.ownChildren(element, definitionId);
    const children = owned.flatMap((child) => this.entriesOf(child, ids));
    const metadata = this.metadataOf(
      element,
      definitionTypeName(this.reader, definitionId),
    );
    this.idIsProp = false;
    return [
      {
        kind: "node",
        id: ids.get(element) as NodeId,
        definitionId,
        children: owned.map((child) => ids.get(child) as NodeId),
        ...this.declarationsOf(element),
        props: props as NodeEntry["props"],
        visual: {},
        sizing: {},
        descendantOverrides: [],
        ...(element.visibleState === "false" ? { enabled: false } : {}),
        ...(Object.keys(metadata).length ? { metadata } : {}),
      } as NodeEntry,
      ...children,
    ];
  }

  /**
   * ADR-296 Phase 2 — whether an attribute is the author's metadata (`id` · `className` · an
   * `aria-label` the component does not take as its prop).
   */
  private isMetadata(name: string, type: string): boolean {
    if (name === "className") return true;
    // (A collection item's `id` is its key prop — ADR-296 Phase 5 slot contents show items.)
    if (name === "id")
      return (
        !(getPrimitiveBinding(type)?.props.accepts ?? {})["id"] &&
        !this.idIsProp
      );
    return (
      name === "aria-label" &&
      !(getPrimitiveBinding(type)?.props.accepts ?? {})["aria-label"]
    );
  }
  private metadataOf(
    element: { attributes: readonly CodeViewAttribute[] },
    type: string,
    /** A kept node: its class (ADR-296 Phase 4 — the style file's selector) is not the author's. */
    nodeId?: string,
  ): NonNullable<NodeEntry["metadata"]> {
    const out: NonNullable<NodeEntry["metadata"]> = {};
    for (const attribute of element.attributes) {
      if (!this.isMetadata(attribute.name, type)) continue;
      if (attribute.value?.kind !== "string") {
        this.reject(attribute.from, "outsideVocabulary", attribute.name);
        continue;
      }
      const value = attribute.value.code.replace(/\\(.)/g, "$1");
      if (attribute.name === "id") out.htmlId = value;
      else if (attribute.name === "className") {
        const tokens = value.split(/\s+/).filter(Boolean);
        // (Only a styled node's code carries its class — 판독 HIGH-1: an unstyled node's same-named
        // author class is the author's.)
        const own =
          nodeId && this.styledNodes().has(nodeId)
            ? this.nodeClasses().get(nodeId)
            : undefined;
        if (own && tokens[0] === own) tokens.shift();
        if (tokens.length) out.className = tokens.join(" ");
      } else out.ariaLabel = value;
    }
    return out;
  }

  /** A new element's handlers (and its new subtree's) — rules on the node it becomes. */
  private planNewHandlers(element: CodeViewElement, id: string): void {
    if (this.keptParts.has(element)) return;
    const handlers = new Map(
      element.attributes
        .filter(
          (attribute) =>
            /^on[A-Z]/.test(attribute.name) && !this.selectionOwned(attribute),
        )
        .map((attribute) => [attribute.name, attribute] as const),
    );
    const type =
      element.type === "div"
        ? "frame"
        : definitionTypeName(
            this.reader,
            (this.componentDefinition(element.type) ??
              catalogPaletteDefinitionId(
                this.reader.library,
                element.type,
              )) as ReturnType<typeof catalogPaletteDefinitionId>,
          );
    if (handlers.size)
      this.planHandlers(element, { id: id as NodeId }, type, handlers);
    // ADR-296 Phase 5 — a new instance's `overrides` (its positions are its component's).
    const definitionId =
      this.slotDefaults.get(element) ??
      this.componentDefinition(element.type) ??
      catalogPaletteDefinitionId(this.reader.library, element.type);
    if (element.attributes.some((item) => item.name === "overrides"))
      this.planOverrides(element, {
        id,
        definitionId,
        descendantOverrides: [],
      } as unknown as NodeEntry);
    for (const child of element.children.flatMap((item) =>
      item.type === "Slot" ? item.children : [item],
    )) {
      const childId = this.ids?.get(child);
      if (childId) this.planNewHandlers(child, childId);
    }
  }
  private ids?: ReadonlyMap<CodeViewElement, string>;
  private classes?: Map<string, string>;
  /** ADR-296 Phase 5 (G2) — a new component file's root (its definition is made in the Apply). */
  newRoot?: string;
  /** The node being read holds `id` as its prop (a collection item's key). */
  private idIsProp = false;
  /** A definition that takes `id` as a prop (a collection item origin — its key). */
  private acceptsId(definitionId: string): boolean {
    const definition = definitionId.startsWith("lib:")
      ? this.reader.library.definitions.get(definitionId as never)
      : (this.reader.getEntry(definitionId) as DefinitionEntry | undefined);
    return !!(definition as { accepts?: Record<string, unknown> } | undefined)
      ?.accepts?.id;
  }
  /** A new variable's owner: the page, or a component's template root (its origin's state). */
  private variableOwner(): StateVariableEntry["ownerId"] {
    return this.input.component?.templateRootId ?? this.page.id;
  }
  /** ADR-296 Phase 5 — a tag that names a user component → its definition. */
  private componentDefinition(tag: string): string | undefined {
    for (const [id, name] of codeViewProjectNames(this.reader as never)
      .components)
      if (name === tag) return id;
    return undefined;
  }
  /** The page's node classes (the baseline's, as the stage names them before this file). */
  baselineClasses(): ReadonlyMap<string, string> {
    return this.nodeClasses();
  }
  private styled?: Set<string>;
  /** The nodes whose code carries their class (a style — ADR-296 Phase 4). */
  styledNodes(): ReadonlySet<string> {
    this.styled ??= new Set(
      [...this.nodeClasses().keys()].filter((id) => {
        const node = this.reader.getEntry(id) as NodeEntry | undefined;
        return !!node && codeViewNodeHasStyle(this.reader as never, node);
      }),
    );
    return this.styled;
  }
  /**
   * ADR-301 — a new element typed by its palette name (`<Popover />`) whose origin the code writes
   * as its template tree: the tree's root type (`DialogTrigger`); undefined = not such an origin.
   */
  expandedTypeOf(element: CodeViewElement): string | undefined {
    const root = this.expandedRootOf(element);
    const template = root
      ? this.reader.library.templates.get(root as never)
      : undefined;
    return template
      ? definitionTypeName(this.reader, template.definitionId as never)
      : undefined;
  }
  /**
   * ADR-301 (판독 round 3 m1) — a new expanded element's props its positions read, each with the
   * position props that hold it: the generator writes them there, not on the root.
   */
  expandedBindingsOf(
    element: CodeViewElement,
  ): Map<string, Set<string>> | undefined {
    const root = this.expandedRootOf(element);
    return root
      ? codeViewExpandedBindingProps(this.reader as never, root)
      : undefined;
  }
  /** ADR-301 — a new element's expanded origin template root (undefined = not expanded). */
  private expandedRootOf(element: CodeViewElement): string | undefined {
    if (!this.added.has(element)) return undefined;
    return codeViewExpandedRoot(
      this.reader as never,
      catalogPaletteDefinitionId(this.reader.library, element.type),
    );
  }
  /** Each code element's node (kept · new). */
  elementIds(): ReadonlyMap<CodeViewElement, string> {
    return this.ids ?? new Map();
  }
  /** ADR-296 Phase 4 — the page's node classes (사용자 결정 6), as the stage names them. */
  private nodeClasses(): Map<string, string> {
    this.classes ??= codeViewNodeClasses(this.reader as never, this.page.id);
    return this.classes;
  }

  /**
   * ADR-296 Phase 5 · Decision 4 (R10) — an instance's `overrides` against the baseline's: instance
   * commands only — a position's props · `hidden` (descendant patch writes), an origin rule off
   * (`catalogInheritedRuleEnabledCommand`) · replaced (`catalogReplaceInheritedRuleCommand`), the
   * position's own rules (`setNodeInteractions` at the address). Never an origin command.
   */
  private planOverrides(
    element: CodeViewElement,
    node: NodeEntry,
    /** ADR-301 Decision 2 — a nested instance position of an expanded `node`: its insides. */
    nested?: { readonly unit: string; readonly prefix: string },
  ): void {
    const attribute = element.attributes.find(
      (item) => item.name === "overrides",
    );
    const anchor = this.baseline.anchors.find(
      (item) =>
        item.target.kind === "attribute" &&
        item.target.nodeId === (nested?.unit ?? node.id) &&
        item.target.name === "overrides",
    );
    const valueOf = (code: string) =>
      code.replace(/^overrides=\{([\s\S]*)\}$/, "$1");
    const was = anchor
      ? valueOf(this.baseline.code.slice(anchor.start, anchor.end))
      : "{}";
    const now = attribute?.value?.code ?? "{}";
    if (
      codeViewNormalized(was) === codeViewNormalized(now) &&
      !this.input.strict
    )
      return;
    const from = attribute?.from ?? element.from;
    const parsed = parseCodeViewOverrides(now);
    const old = parseCodeViewOverrides(was);
    if ("error" in parsed) {
      this.reject(from, "outsideVocabulary", "overrides");
      return;
    }
    const before = new Map(
      ("error" in old ? [] : old.entries).map((entry) => [entry.key, entry]),
    );
    const after = new Map(parsed.entries.map((entry) => [entry.key, entry]));
    if (after.size !== parsed.entries.length) {
      this.reject(from, "ambiguousIdentity", "overrides");
      return;
    }
    for (const key of new Set([...before.keys(), ...after.keys()])) {
      const address = codeViewAddressOf(
        this.reader as never,
        node.id,
        nested ? `${nested.prefix}/${key}` : key,
        node.definitionId,
      );
      if (!address) {
        this.reject(from, "unknownReference", key);
        continue;
      }
      const entry = after.get(key);
      const previous = before.get(key);
      const target = {
        kind: "descendant" as const,
        ownerId: node.id,
        address,
      };
      // Props (a descendant patch's).
      const props: Record<string, WriteValue<AuthoredValue>> = {};
      for (const prop of new Set([
        ...(previous?.props.keys() ?? []),
        ...(entry?.props.keys() ?? []),
      ])) {
        const next = entry?.props.get(prop);
        const last = previous?.props.get(prop);
        if (
          next &&
          last &&
          codeViewNormalized(next.code) === codeViewNormalized(last.code)
        )
          continue;
        if (!next) {
          props[prop] = { kind: "remove" };
          continue;
        }
        const value = this.propValue({
          name: prop,
          from: from + next.from,
          to: from + next.from,
          value: {
            kind: "expression",
            code: next.code,
            from: from + next.from,
            to: from + next.from,
          },
        } as CodeViewAttribute);
        if (value === undefined) continue;
        props[prop] = { kind: "set", value: value as AuthoredValue };
      }
      if (Object.keys(props).length)
        this.step(from, setFields({ targets: [target], props, label: "Code" }));
      if (entry?.hidden !== previous?.hidden)
        this.step(
          from,
          setWholeField({
            targets: [target],
            field: "enabled",
            value: entry?.hidden === undefined ? undefined : !entry.hidden,
          }),
        );
      this.planOverrideRules(node, address, entry, previous, from);
    }
  }

  /** One position's rules (`rules({inherited, own})` per When) against the baseline's. */
  private planOverrideRules(
    instance: NodeEntry,
    address: InstanceAddress,
    entry: CodeViewOverrideEntry | undefined,
    previous: CodeViewOverrideEntry | undefined,
    from: number,
  ): void {
    const owner = { ownerId: instance.id as NodeId, address };
    const sourceId = address.templatePath.at(-1) as string;
    const sourceClass = codeViewTreeClasses(this.reader as never, [
      address.templatePath[0] as string,
    ]).get(sourceId);
    const keys = sourceClass
      ? codeViewRuleKeys(this.reader as never, sourceId, sourceClass)
      : new Map<string, string>();
    const ruleOf = (handler: string) =>
      [...keys].find(([, name]) => name === handler)?.[0];
    const rulesOf = (item: CodeViewOverrideEntry | undefined) =>
      new Map((item?.rules ?? []).map((rules) => [rules.trigger, rules]));
    const next = rulesOf(entry);
    const last = rulesOf(previous);
    let ownChanged = false;
    /** The replacing rules' new Dos (origin rule id → actions). */
    const bodies = new Map<string, InteractionAction[]>();
    const own: { trigger: string; actions: InteractionAction[] }[] = [];
    const contextOf = (trigger: string, params: readonly string[] = []) => ({
      trigger,
      args: componentEventKeyOf(trigger)
        ? COMPONENT_EVENT_ARGS
        : (eventArgNames(trigger)[0] ?? []),
      fields: eventArgsAreFields(trigger),
      params,
      ownerId: instance.id,
    });
    for (const trigger of new Set([...last.keys(), ...next.keys()])) {
      const now = next.get(trigger);
      const was = last.get(trigger);
      for (const handler of new Set([
        ...(was?.inherited.keys() ?? []),
        ...(now?.inherited.keys() ?? []),
      ])) {
        const ruleId = ruleOf(handler);
        if (!ruleId) {
          this.reject(from, "unknownReference", handler);
          continue;
        }
        const after = now?.inherited.get(handler);
        const before = was?.inherited.get(handler);
        const same =
          after && before && "off" in after && "off" in before
            ? true
            : after && before && "body" in after && "body" in before
              ? codeViewNormalized(after.body) ===
                codeViewNormalized(before.body)
              : !after && !before;
        if (same) continue;
        if (!after) {
          this.step(
            from,
            catalogInheritedRuleEnabledCommand(owner, ruleId as never, true),
          );
          ownChanged ||= !!before && "body" in before;
          continue;
        }
        if ("off" in after) {
          this.step(
            from,
            catalogInheritedRuleEnabledCommand(owner, ruleId as never, false),
          );
          ownChanged ||= !!before && "body" in before;
          continue;
        }
        const actions = this.dosOf(
          after.body,
          from + after.from,
          contextOf(trigger, after.params),
        );
        if (!actions) continue;
        if (before && "body" in before) {
          bodies.set(ruleId, actions);
          ownChanged = true;
          continue;
        }
        const origin = this.reader.getEntry(ruleId) as InteractionEntry;
        this.step(
          from,
          catalogReplaceInheritedRuleCommand(
            owner,
            { ...origin, actions },
            this.input.newId,
          ),
        );
      }
      const nowOwn = now?.own ?? [];
      const wasOwn = was?.own ?? [];
      if (
        nowOwn.length !== wasOwn.length ||
        nowOwn.some(
          (item, index) =>
            codeViewNormalized(item.body) !==
            codeViewNormalized(wasOwn[index]!.body),
        )
      )
        ownChanged = true;
      for (const item of nowOwn) {
        const actions = this.dosOf(
          item.body,
          from + item.from,
          contextOf(trigger, item.params),
        );
        if (actions) own.push({ trigger, actions });
      }
    }
    if (
      !ownChanged &&
      ![...next.values()].some((rules) => rules.own.length) &&
      ![...last.values()].some((rules) => rules.own.length)
    )
      return;
    if (!ownChanged) return;
    // The position's own rules: the replacing ones (kept, Dos as written) and the written own ones
    // (each takes a former own rule's id by its place — its identity).
    this.step(from, (reader) => {
      const get = (id: string) => reader.getEntry(id as never);
      const map: Readonly<Record<string, string>> =
        catalogInteractionOverridesAt(get as never, address) ?? {};
      const replacing = new Set<string>(
        Object.values(map).filter((value) => value !== "off"),
      );
      const current = (
        reader.getEntry(reader.projectId) as ProjectEntry
      ).interactionIds
        .map((id) => reader.getEntry(id) as InteractionEntry | undefined)
        .filter(
          (rule): rule is InteractionEntry =>
            rule?.kind === "interaction" &&
            rule.ownerId === instance.id &&
            codeViewSameAddress(rule.address, address),
        );
      const kept = current
        .filter((rule) => replacing.has(rule.id))
        .map((rule) => {
          const origin = Object.entries(map).find(
            ([, value]) => value === rule.id,
          )?.[0];
          const actions = origin ? bodies.get(origin) : undefined;
          return actions ? { ...rule, actions } : rule;
        });
      const former = current.filter((rule) => !replacing.has(rule.id));
      const written = own.map((item, index) => {
        const reused = former.filter((rule) => rule.trigger === item.trigger)[
          own.filter(
            (other, at) => at < index && other.trigger === item.trigger,
          ).length
        ];
        return {
          kind: "interaction",
          id: reused?.id ?? this.input.newId("interaction"),
          ownerId: instance.id,
          address,
          trigger: item.trigger,
          actions: item.actions,
        } as InteractionEntry;
      });
      return setNodeInteractions({
        ownerId: instance.id as NodeId,
        address,
        entries: [...kept, ...written],
        label: "Code",
      })(reader);
    });
  }

  /** A new instance's slot contents → the definition its placing fills that type with. */
  private readonly slotDefaults = new Map<CodeViewElement, string>();
  /** A new instance's required part its placing made (the empty state) — not written again. */
  private readonly keptParts = new Set<CodeViewElement>();
  private planSlotDefaults(
    added: readonly CodeViewElement[],
    ids: ReadonlyMap<CodeViewElement, string>,
    reader: CatalogReader,
  ): void {
    const host = (
      reader.getEntry(
        (reader.getEntry(reader.projectId) as ProjectEntry).pageIds[0] ?? "",
      ) as PageEntry | undefined
    )?.children[0];
    if (!host) return;
    for (const element of added) {
      const content = element.children.filter((child) => child.type !== "Slot");
      const slots = element.children.filter((child) => child.type === "Slot");
      if (!slots.length && !content.length) continue;
      const definitionId =
        this.componentDefinition(element.type) ??
        catalogPaletteDefinitionId(reader.library, element.type);
      if (!codeViewTemplateRoot(reader as never, definitionId)) continue;
      // Place it once on a scratch stage: its fills' definitions by type.
      try {
        const stage = stageOver(reader);
        const id = "project:node:code-view-scratch" as NodeId;
        stage.apply(
          insertNodes({
            parent: { kind: "node", id: host as NodeId },
            entries: [
              {
                kind: "node",
                id,
                definitionId,
                children: [],
                props: {},
                visual: {},
                sizing: {},
                descendantOverrides: [],
              } as unknown as NodeEntry,
            ],
            rootIds: [id],
            newId: this.input.newId,
          })(stage).ops,
        );
        const placed = stage.getEntry(id) as NodeEntry;
        const byType = new Map<string, string>();
        for (const fill of placed.descendantOverrides)
          if (fill.kind === "fillSlot")
            for (const child of fill.childIds) {
              const node = stage.getEntry(child) as NodeEntry | undefined;
              if (!node) continue;
              const type = definitionTypeName(stage, node.definitionId);
              if (!byType.has(type)) byType.set(type, node.definitionId);
            }
        for (const child of [
          ...content,
          ...slots.flatMap((slot) => slot.children),
        ]) {
          const definition = byType.get(child.type);
          if (definition && ids.has(child))
            this.slotDefaults.set(child, definition);
          // (A collection's empty state stays the one its placing made — the code's is that.)
          if (child.type === "IllustratedMessage" && definition)
            this.keptParts.add(child);
        }
      } catch {
        // (A type that cannot be placed here: its children read by their tags.)
      }
    }
  }

  /** The children an element owns (a new instance's slot contents are its positions'). */
  private ownChildren(
    element: CodeViewElement,
    definitionId: string,
  ): readonly CodeViewElement[] {
    const plain = element.children.filter((child) => child.type !== "Slot");
    return codeViewRootSlot(
      this.reader as never,
      {
        definitionId,
        descendantOverrides: [],
      } as never,
    )
      ? []
      : plain;
  }

  /**
   * ADR-296 Phase 5 — a new instance's slot contents as written: each position's default fill
   * (made when it was placed) is replaced by the code's elements (descendant parents — instance
   * commands).
   */
  private fillNewSlots(
    element: CodeViewElement,
    id: string,
    definitionId: string,
    entries: ReadonlyMap<CodeViewElement, NodeEntry[]>,
  ): void {
    const ids = this.ids!;
    const groups: {
      address: InstanceAddress;
      children: readonly CodeViewElement[];
    }[] = [];
    const root = codeViewRootSlot(
      this.reader as never,
      {
        definitionId,
        descendantOverrides: [],
      } as never,
    );
    const plain = element.children.filter((child) => child.type !== "Slot");
    // (A bound list's rows are its binding's; a new instance written without slot content keeps
    // the defaults its placing gave.)
    if (
      element.rows ||
      element.attributes.some((item) => item.name === "items")
    )
      return;
    if (
      !element.children.some((child) => child.type === "Slot") &&
      !(root && plain.length)
    )
      return;
    if (root && plain.length)
      groups.push({
        address: {
          instances: [id as NodeId],
          templatePath: root.templatePath,
        } as InstanceAddress,
        children: plain,
      });
    for (const slot of element.children.filter(
      (child) => child.type === "Slot",
    )) {
      const name = slot.attributes.find((item) => item.name === "name")?.value
        ?.code;
      const address = name
        ? codeViewAddressOf(this.reader as never, id, name, definitionId)
        : undefined;
      if (!address) {
        this.reject(slot.from, "unknownReference", name ?? "Slot");
        continue;
      }
      groups.push({ address, children: slot.children });
    }
    if (!groups.length) return;
    this.step(element.from, (stageReader) => {
      const stage = stageOver(stageReader);
      const ops: CatalogCommandPlan["ops"][number][] = [];
      const run = (command: CatalogCommand) => {
        const plan = command(stage);
        stage.apply(plan.ops);
        ops.push(...plan.ops);
      };
      for (const group of groups) {
        const owner = stage.getEntry(id) as NodeEntry | undefined;
        const fill = owner?.descendantOverrides.find(
          (item) =>
            item.kind === "fillSlot" &&
            codeViewSameAddress(item.address, group.address),
        );
        const defaults = fill?.kind === "fillSlot" ? fill.childIds : [];
        // (A collection's empty state goes only with it — it stays; the code's is that one.)
        const emptyState = (child: string) => {
          const node = stage.getEntry(child) as NodeEntry | undefined;
          return (
            !!node &&
            definitionTypeName(stage, node.definitionId) ===
              "IllustratedMessage"
          );
        };
        const removable = defaults.filter((child) => !emptyState(child));
        const kept = defaults.length - removable.length;
        if (removable.length)
          run(
            removeTargets({
              targets: removable.map((child) => ({
                kind: "node" as const,
                id: child as NodeId,
              })),
              newId: this.input.newId,
              label: "Code",
            }),
          );
        group.children
          .filter((child) => !(kept && child.type === "IllustratedMessage"))
          .forEach((child, index) => {
            const childId = ids.get(child);
            const made = childId ? entries.get(child) : undefined;
            if (!childId || !made) return;
            run(
              insertNodes({
                parent: {
                  kind: "descendant",
                  ownerId: id as NodeId,
                  address: group.address,
                },
                index,
                entries: made,
                rootIds: [childId as NodeId],
                newId: this.input.newId,
                label: "Code",
              }),
            );
          });
      }
      return { label: "Code", ops };
    });
  }

  /** ADR-296 Phase 5 — an element's `composition={{…}}` (slot · regions · placeholder · showWhen · presentWhen). */
  private declarationsOf(element: CodeViewElement): Partial<NodeEntry> {
    const attribute = element.attributes.find(
      (item) => item.name === "composition",
    );
    if (!attribute) return {};
    const value = attribute.value?.code
      ? structuredLiteralOf(attribute.value.code)?.value
      : undefined;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      this.reject(attribute.from, "outsideVocabulary", "composition");
      return {};
    }
    const known = ["slot", "regions", "placeholder", "showWhen", "presentWhen"];
    for (const key of Object.keys(value))
      if (!known.includes(key))
        this.reject(attribute.from, "outsideVocabulary", key);
    return value as Partial<NodeEntry>;
  }
  private planDeclarations(element: CodeViewElement, node: NodeEntry): void {
    const now = this.declarationsOf(element);
    const from =
      element.attributes.find((item) => item.name === "composition")?.from ??
      element.from;
    const same = (a: unknown, b: unknown) =>
      JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    if (
      !same(now.slot, node.slot) ||
      !same(now.regions, node.regions) ||
      !same(now.placeholder, node.placeholder)
    )
      this.step(
        from,
        setSlotDeclaration({
          id: node.id,
          ...(now.slot ? { slot: now.slot } : {}),
          ...(now.regions ? { regions: now.regions } : {}),
          ...(now.placeholder ? { placeholder: true } : {}),
          label: "Code",
        }),
      );
    if (!same(now.showWhen, node.showWhen))
      this.step(
        from,
        setShowWhen({
          id: node.id,
          showWhen: now.showWhen ?? null,
          label: "Code",
        }),
      );
    // (A text part's presence condition has no command of its own — read only.)
    if (!same(now.presentWhen, node.presentWhen))
      this.reject(from, "readOnlyFile", "presentWhen");
  }

  /** A kept element's attributes · text against the baseline's (only what changed). */
  private planAttributes(element: CodeViewElement, id: string): void {
    const node = this.reader.getEntry(id) as NodeEntry;
    const type = definitionTypeName(this.reader, node.definitionId);
    // ADR-301 Decision 5 — an expanded instance's share is at its positions, not an `overrides`.
    const overrides = element.attributes.find(
      (item) => item.name === "overrides",
    );
    if (this.baselineExpanded.has(id) && overrides)
      this.reject(overrides.from, "outsideVocabulary", "overrides");
    else this.planOverrides(element, node);
    this.planDeclarations(element, node);
    const before = this.baseline.anchors.filter(
      (anchor) =>
        anchor.target.kind === "attribute" && anchor.target.nodeId === id,
    );
    const nameOf = (anchor: CodeViewAnchor) =>
      (anchor.target as { name: string }).name;
    const props: Record<
      string,
      { kind: "set"; value: unknown } | { kind: "remove" }
    > = {};
    const handlers = new Map<string, CodeViewAttribute | undefined>();
    const sorted = this.sortControlled(element, type);
    // ADR-294 Decision 6 — a user component instance's properties are written by their names
    // (`role={roleFilter}`) and its events as callback props (`onSelect={…}` = `property:<key>`).
    const properties =
      componentPropertiesOf(this.reader.getEntry(node.definitionId)) ?? [];
    const propKey = (name: string) =>
      properties.find(
        (property) =>
          property.kind !== "event" &&
          componentPropertyCodeName(property) === name,
      )?.key ?? name;
    const handlerTrigger = (name: string) => {
      const event = properties.find(
        (property) =>
          property.kind === "event" &&
          componentEventAttribute(property) === name,
      );
      return event ? componentEventTrigger(event.key) : name;
    };
    const inputValue = (name: string, value: unknown) => {
      // (A variable property's reference is the variable's `!var.` text — not a `PropVar`.)
      const property = properties.find((item) => item.key === propKey(name));
      return property?.kind === "variable" &&
        value &&
        typeof value === "object" &&
        (value as { kind?: unknown }).kind === "var"
        ? (value as { ref: string }).ref
        : value;
    };
    // ADR-296 Phase 2 — the author's metadata (`id` · `className` · `aria-label`).
    this.idIsProp =
      node.props.id?.kind === "set" || this.acceptsId(node.definitionId);
    const metadata = this.metadataOf(element, type, id);
    this.idIsProp = false;
    const nowMeta = node.metadata ?? {};
    const autoId =
      !!nowMeta.htmlId && /^[a-z][a-z0-9-]*_\d+$/.test(nowMeta.htmlId);
    if (
      (metadata.htmlId ?? (autoId ? nowMeta.htmlId : undefined)) !==
      nowMeta.htmlId
    )
      this.step(
        element.from,
        setHtmlId({ id: id as NodeId, htmlId: metadata.htmlId ?? "" }),
      );
    for (const field of ["className", "ariaLabel"] as const)
      if ((metadata[field] ?? "") !== (nowMeta[field] ?? ""))
        this.step(
          element.from,
          setNodeAttribute({
            id: id as NodeId,
            field,
            value: metadata[field] ?? "",
          }),
        );
    // ADR-296 Phase 2 — `{false && <T/>}`: switched off for every consumer.
    if ((element.visibleState === "false") !== (node.enabled === false))
      this.step(
        element.from,
        setWholeField({
          targets: [{ kind: "node", id: id as NodeId }],
          field: "enabled",
          value: element.visibleState !== "false",
        }),
      );
    for (const attribute of element.attributes) {
      if (attribute.name === "overrides" || attribute.name === "composition")
        continue; // (planOverrides · planDeclarations)
      const old = before.find((anchor) => nameOf(anchor) === attribute.name);
      // (ADR-296 E3 — a node's ref is derived from the Dos that call it.)
      if (attribute.name === "ref") continue;
      if (this.isMetadata(attribute.name, type)) continue;
      if (
        !old &&
        (attribute.name === "items" ||
          sorted.has(attribute.name) ||
          this.selectionOwned(attribute))
      )
        continue;
      if (
        old &&
        !this.input.strict &&
        codeViewNormalized(this.code(old)) ===
          codeViewNormalized(
            this.input.edited.slice(attribute.from, attribute.to),
          ) &&
        !this.callsChangedHandler(attribute)
      )
        continue;
      const source = old
        ? (old.target as { source: string }).source
        : undefined;
      if (source === "handler" || (!old && /^on[A-Z]/.test(attribute.name))) {
        handlers.set(handlerTrigger(attribute.name), attribute);
        continue;
      }
      if (source && source !== "prop") continue; // (the regenerated code tells)
      const value = this.propValue(attribute);
      if (value !== undefined)
        props[propKey(attribute.name)] = {
          kind: "set",
          value: inputValue(attribute.name, value),
        };
    }
    for (const anchor of before) {
      if (
        element.attributes.some(
          (attribute) => attribute.name === nameOf(anchor),
        )
      )
        continue;
      const source = (anchor.target as { source: string }).source;
      if (source === "metadata") continue; // (read above)
      if (source === "prop")
        props[propKey(nameOf(anchor))] = { kind: "remove" };
      else if (source === "handler")
        handlers.set(handlerTrigger(nameOf(anchor)), undefined);
    }
    // Text (`children`).
    const oldText = this.baseline.anchors.find(
      (anchor) => anchor.target.kind === "text" && anchor.target.nodeId === id,
    );
    const newText = element.text;
    if (
      this.input.strict ||
      (oldText ? codeViewNormalized(this.code(oldText)) : undefined) !==
        (newText ? codeViewNormalized(newText.code) : undefined)
    ) {
      if (!newText) props.children = { kind: "remove" };
      else {
        const value = this.childrenValue(newText.code, newText.from, element);
        if (value !== undefined) props.children = { kind: "set", value };
      }
    }
    if (Object.keys(props).length)
      this.step(
        element.from,
        setFields({
          targets: [{ kind: "node", id: id as NodeId }],
          props: props as never,
          label: "Edit properties",
        }),
      );
    if (handlers.size) this.planHandlers(element, node, type, handlers);
  }

  /* ── values ── */

  /** A prop's code → its document value (`propCode`'s inverse); undefined = refused. */
  private propValue(attribute: CodeViewAttribute): unknown {
    const value = attribute.value;
    if (!value) return true;
    if (value.kind === "string") return value.code.replace(/\\(.)/g, "$1");
    const text = value.code.trim();
    if (attribute.name === "slot" && text === "null") return false;
    // ADR-296 — a token prop (`token('<name>')`): the token the code names.
    const token = /^token\(('(?:[^'\\]|\\.)*')\)$/.exec(text);
    if (token) {
      const name = String(literalOf(token[1]!));
      const tokenId =
        this.baseline.symbols.tokens?.[name] ?? this.tokenByName(name);
      if (!tokenId) {
        this.reject(value.from, "unknownReference", name);
        return undefined;
      }
      return { kind: "token", tokenId };
    }
    // ADR-296 — a prop's typed object (a calendar duration · a number format) — the graph checks it.
    if (text.startsWith("{") && !text.startsWith("{`")) {
      const object = structuredLiteralOf(text)?.value;
      if (object && typeof object === "object" && !Array.isArray(object))
        return object;
    }
    // ADR-308 — a list the generator writes as an array (a group's `defaultSelectedKeys={['a']}` ·
    // `expandedKeys` · a CheckboxGroup `value`) — the graph checks its items.
    if (text.startsWith("[")) {
      const list = structuredLiteralOf(text)?.value;
      if (Array.isArray(list)) return list;
    }
    if (/^`[\s\S]*`$/.test(text)) {
      const template = this.textValue(`{${text}}`, value.from);
      return template;
    }
    const keys = /^\[([A-Za-z_$][\w$]*)\]$/.exec(text);
    const read = keys?.[1] ?? text;
    const [name, ...path] = read.split(".");
    if (
      IDENTIFIER.test(name!) &&
      !/^(true|false|null|undefined)$/.test(name!)
    ) {
      const id = this.variables.get(name!);
      if (!id) {
        this.reject(value.from, "unknownReference", name);
        return undefined;
      }
      return { kind: "var", ref: [`!var.${id}`, ...path].join(".") };
    }
    const literal = literalOf(text);
    if (literal !== undefined) return literal;
    if (text === "null") return null;
    const when = this.whenOf(text);
    if (when) return when;
    this.reject(value.from, "outsideVocabulary");
    return undefined;
  }

  /** A token by its code name (a project token's name, a library token's theme path). */
  private tokenByName(name: string): string | undefined {
    const project = this.reader.getEntry(this.reader.projectId) as ProjectEntry;
    const own = project.tokenIds.find(
      (id) => (this.reader.getEntry(id) as { name?: string })?.name === name,
    );
    if (own) return own;
    for (const [id, token] of this.reader.library.tokens)
      if (token.ref === `{${name}}` || id === `lib:token:${name}`) return id;
    return undefined;
  }

  /** A prop that is a comparison of a variable (`propWhen`'s inverse — 「값 조건」). */
  private whenOf(text: string): Record<string, unknown> | undefined {
    const id = (name: string) => this.variables.get(name);
    const empty = /^([\w$]+) !== 'all' && \1\.size === 0$/.exec(text);
    if (empty && id(empty[1]!))
      return {
        kind: "when",
        subject: `!var.${id(empty[1]!)}`,
        op: "notExists",
      };
    const some = /^\(([\w$]+) === 'all' \|\| \1\.size > 0\)$/.exec(text);
    if (some && id(some[1]!))
      return { kind: "when", subject: `!var.${id(some[1]!)}`, op: "exists" };
    const size =
      /^([\w$]+) !== 'all' && \1\.size (===|!==|>=|>|<=|<) (.+)$/.exec(text);
    const plain = /^([\w$]+)((?:\.[\w$]+)*) (===|!==|>=|>|<=|<) (.+)$/.exec(
      text,
    );
    const ops = {
      "===": "equals",
      "!==": "notEquals",
      ">=": "gte",
      ">": "gt",
      "<=": "lte",
      "<": "lt",
    } as const;
    const valueOf = (raw: string) => {
      const name = raw.trim();
      if (IDENTIFIER.test(name) && id(name)) return `!var.${id(name)}`;
      return literalOf(name);
    };
    const pick = size
      ? { name: size[1]!, path: ".size", op: size[2]!, value: size[3]! }
      : plain
        ? { name: plain[1]!, path: plain[2]!, op: plain[3]!, value: plain[4]! }
        : undefined;
    if (!pick || !id(pick.name)) return undefined;
    const value = valueOf(pick.value);
    if (value === undefined) return undefined;
    return {
      kind: "when",
      subject: `!var.${id(pick.name)}${pick.path}`,
      op: ops[pick.op as keyof typeof ops],
      value,
    };
  }

  /**
   * An element's text → its `children` (plain text · a template of variables · a row's fields —
   * `${<rows>.find(row => row.id === …)?.<field> ?? ''}` is `{<field>}`, the views bind the row).
   */
  private textValue(
    code: string,
    from: number,
    element?: CodeViewElement,
  ): string | undefined {
    if (/<span\b/.test(code)) {
      this.reject(from, "outsideVocabulary");
      return undefined;
    }
    return this.plainTextValue(code, from, element);
  }

  /**
   * ADR-299 Decision 6 — a text node's children: plain text (`textValue`) or runs — `<span
   * style={{ fontWeight: 700, color: token('accent') }}>…</span>` around a part (keys = the range
   * keys, values = a literal or a token). Anything else in the text is outside the vocabulary.
   */
  private childrenValue(
    code: string,
    from: number,
    element?: CodeViewElement,
  ): string | RichText | undefined {
    if (!/<span\b/.test(code)) return this.plainTextValue(code, from, element);
    const runs: TextRun[] = [];
    const SPAN = /<span style=\{\{([\s\S]*?)\}\}>([\s\S]*?)<\/span>/g;
    let at = 0;
    let failed = false;
    const part = (segment: string, offset: number) => {
      if (!segment) return undefined;
      if (/^\{`[\s\S]*`\}$/.test(segment.trim()))
        return this.plainTextValue(segment.trim(), offset, element, true);
      if (/[{}<>]/.test(segment)) {
        this.reject(offset, "outsideVocabulary");
        failed = true;
        return undefined;
      }
      return segment.replace(/\s*\n\s*/g, " ");
    };
    for (const match of code.matchAll(SPAN)) {
      const before = part(code.slice(at, match.index), from + at);
      if (before) runs.push({ text: before });
      const marks: Record<string, unknown> = {};
      for (const entry of match[1]!.split(/,(?![^(]*\))/)) {
        if (!entry.trim()) continue;
        const pair = /^\s*([A-Za-z]+)\s*:\s*([\s\S]+?)\s*$/.exec(entry);
        if (!pair || !isTextRunMarkKey(pair[1]!)) {
          this.reject(from + match.index!, "outsideVocabulary");
          return undefined;
        }
        const token = /^token\(('(?:[^'\\]|\\.)*')\)$/.exec(pair[2]!);
        if (token) {
          const name = String(literalOf(token[1]!));
          const tokenId =
            this.baseline.symbols.tokens?.[name] ?? this.tokenByName(name);
          if (!tokenId) {
            this.reject(from + match.index!, "unknownReference", name);
            return undefined;
          }
          marks[pair[1]!] = { kind: "token", tokenId };
          continue;
        }
        const literal = literalOf(pair[2]!);
        if (typeof literal !== "string" && typeof literal !== "number") {
          this.reject(from + match.index!, "outsideVocabulary");
          return undefined;
        }
        marks[pair[1]!] = literal;
      }
      const inner = part(
        match[2]!,
        from + match.index! + match[0].indexOf(">") + 1,
      );
      if (inner)
        runs.push(
          Object.keys(marks).length
            ? { text: inner, marks: marks as TextRun["marks"] }
            : { text: inner },
        );
      at = match.index! + match[0].length;
    }
    const after = part(code.slice(at), from + at);
    if (after) runs.push({ text: after });
    if (failed) return undefined;
    return normalizeRichText({ kind: "text", runs });
  }

  private plainTextValue(
    code: string,
    from: number,
    element?: CodeViewElement,
    /** A run's part: its spaces are the text's (no trim). */
    keepSpaces = false,
  ): string | undefined {
    const template = /^\{`([\s\S]*)`\}$/.exec(code.trim());
    if (!template) {
      if (/[{}]/.test(code)) {
        this.reject(from, "outsideVocabulary");
        return undefined;
      }
      return keepSpaces ? code : code.trim();
    }
    let failed = false;
    const text = template[1]!.replace(/\$\{([^}]*)\}/g, (_, inner: string) => {
      const row = /^(.+)\?\.([\w$.#]+) \?\? ''$/.exec(inner.trim());
      if (row && element && /\.find\(row => row\.id === .+\)$/.test(row[1]!)) {
        const read = this.rowReaders.get(element);
        if (read !== undefined && read !== row[1]) {
          failed = true;
          this.reject(from, "outsideVocabulary", row[1]);
          return "";
        }
        this.rowReaders.set(element, row[1]!);
        return `{${row[2]}}`;
      }
      const [name, ...path] = inner.trim().split(".");
      const id = this.variables.get(name!);
      const entry = id ? this.reader.getEntry(id) : undefined;
      if (entry?.kind !== "stateVariable") {
        failed = true;
        this.reject(from, "unknownReference", name);
        return "";
      }
      return `{{${[entry.name, ...path].join(".")}}}`;
    });
    return failed ? undefined : text.replace(/\\`/g, "`");
  }

  /* ── handlers (a When's rules) ── */

  /* ── named handler functions (ADR-296 E9) ── */

  /** The edited code's handler functions: name → its parts. */
  private get handlerFns(): ReadonlyMap<
    string,
    { from: number; code: string; params: string[]; body: string }
  > {
    if (this.fnCache) return this.fnCache;
    const out = new Map<
      string,
      { from: number; code: string; params: string[]; body: string }
    >();
    for (const statement of this.parsed.statements) {
      if (statement.kind !== "handler" || !statement.name) continue;
      const m = /^(?:async )?function [\w$]+\(([^)]*)\) \{([\s\S]*)\}$/.exec(
        statement.code.trim(),
      );
      if (!m) {
        this.reject(statement.from, "outsideVocabulary", statement.name);
        continue;
      }
      out.set(statement.name, {
        from: statement.from,
        code: statement.code,
        params: m[1]!
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        body: m[2]!,
      });
    }
    return (this.fnCache = out);
  }
  private fnCache?: ReadonlyMap<
    string,
    { from: number; code: string; params: string[]; body: string }
  >;

  /** A handler `(…) => { onA(…); onB(…); }` → the named functions it calls (undefined = inline). */
  private namedCalls(attribute: CodeViewAttribute): string[] | undefined {
    const code =
      attribute.value?.kind === "expression" ? attribute.value.code.trim() : "";
    const arrow = /^\(([^)]*)\) => \{([\s\S]*)\}$/.exec(code);
    if (!arrow) return undefined;
    const calls = arrow[2]!
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean);
    const names = calls.map(
      (call) => /^([A-Za-z_$][\w$]*)\(([^)]*)\)$/.exec(call)?.[1],
    );
    const fns = this.handlerFns;
    // (A named state's setter may lead — derived from the control's state, ADR-287.)
    const named = names.filter((name) => !!name && fns.has(name));
    return named.length &&
      names.every((name) => !!name && (fns.has(name) || /^set[A-Z]/.test(name)))
      ? (named as string[])
      : undefined;
  }

  /** Whether a handler attribute calls a function whose code the edit changed. */
  private callsChangedHandler(attribute: CodeViewAttribute): boolean {
    const calls = this.namedCalls(attribute);
    if (!calls) return false;
    const before = new Map(
      parseCodeView(this.baseline.code)
        .statements.filter((item) => item.kind === "handler")
        .map((item) => [item.name, codeViewNormalized(item.code)]),
    );
    return calls.some(
      (name) =>
        before.get(name) !==
        codeViewNormalized(this.handlerFns.get(name)?.code ?? ""),
    );
  }

  private planHandlers(
    element: CodeViewElement,
    node: { readonly id: NodeId },
    type: string,
    handlers: ReadonlyMap<string, CodeViewAttribute | undefined>,
  ): void {
    const triggers = allTriggers(type);
    const rules = (
      this.reader.getEntry(this.reader.projectId) as ProjectEntry
    ).interactionIds
      .map((ruleId) => this.reader.getEntry(ruleId))
      .filter(
        (entry): entry is InteractionEntry =>
          entry?.kind === "interaction" &&
          entry.ownerId === node.id &&
          !entry.address,
      );
    const next: InteractionEntry[] = rules.filter(
      (rule) => !handlers.has(rule.trigger),
    );
    const newRule = (
      trigger: string,
      actions: InteractionAction[],
      id?: string,
    ) =>
      ({
        kind: "interaction",
        id: id ?? (this.input.newId("interaction") as EntryId<"interaction">),
        ownerId: node.id,
        trigger,
        actions,
      }) as InteractionEntry;
    for (const [trigger, attribute] of handlers) {
      if (!attribute) continue;
      // (ADR-294 — a received component event is the instance's own When; the document checks it.)
      if (!triggers.includes(trigger) && !componentEventKeyOf(trigger)) {
        this.reject(attribute.from, "outsideVocabulary", trigger);
        continue;
      }
      const own = rules.filter((rule) => rule.trigger === trigger);
      // ADR-296 E9 — several rules: each named function is one rule (its id by its name).
      const calls = this.namedCalls(attribute);
      this.readHandlers.add(attribute);
      if (calls) {
        for (const name of calls) this.readFunctions.add(name);
        const used = new Set<string>();
        for (const name of calls) {
          const fn = this.handlerFns.get(name)!;
          const known = this.baseline.symbols.handlers?.[name];
          const kept =
            known && own.some((rule) => rule.id === known) && !used.has(known)
              ? known
              : undefined;
          const actions = this.dosOf(fn.body, fn.from, {
            trigger,
            args: componentEventKeyOf(trigger)
              ? COMPONENT_EVENT_ARGS
              : (eventArgNames(trigger)[0] ?? []),
            fields: eventArgsAreFields(trigger),
            params: fn.params,
            ownerId: node.id,
          });
          if (!actions) continue;
          if (kept) used.add(kept);
          next.push(newRule(trigger, actions, kept));
        }
        continue;
      }
      const actions = this.actionsOf(trigger, attribute, node.id);
      if (!actions) continue;
      next.push(newRule(trigger, actions, own[0]?.id));
    }
    this.step(
      element.from,
      setNodeInteractions({
        ownerId: node.id,
        entries: next,
        label: "Edit events",
      }),
    );
  }

  /**
   * A handler's code → its Do list (`handlerCode` · `writeAction`'s inverse): Set state (a value ·
   * toggle · increment · an event's keys), toast, navigate, a list's commands (`update` · `move…` ·
   * `remove…` · `insert…` · `append` · `prepend` · `reload` · `loadMore` · `setFilterText`) and an
   * endpoint call (`await fetch`).
   */
  private actionsOf(
    trigger: string,
    attribute: CodeViewAttribute,
    ownerId?: string,
  ): InteractionAction[] | undefined {
    const code =
      attribute.value?.kind === "expression" ? attribute.value.code.trim() : "";
    const args = componentEventKeyOf(trigger)
      ? COMPONENT_EVENT_ARGS
      : (eventArgNames(trigger)[0] ?? []);
    const fields = eventArgsAreFields(trigger);
    const setter = (name: string) =>
      [...this.variables].find(
        ([variable]) => `set${capital(variable)}` === name,
      )?.[1];
    // `onChange={setSearch}` — a Set state of the event's first value.
    if (IDENTIFIER.test(code)) {
      const variableId = setter(code);
      if (!variableId) {
        this.reject(attribute.from, "unknownReference", code);
        return undefined;
      }
      return [
        {
          opcode: "setState",
          variableId,
          op: "set",
          value: `!event.${args[0] ?? "value"}`,
        } as InteractionAction,
      ];
    }
    const arrow = /^(async )?\(([^)]*)\) => \{([\s\S]*)\}$/.exec(code);
    if (!arrow) {
      this.reject(attribute.from, "outsideVocabulary");
      return undefined;
    }
    const params = arrow[2]!
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    return this.dosOf(arrow[3]!, attribute.from, {
      trigger,
      args,
      fields,
      params,
      ownerId,
    });
  }

  /** A setter call on a node's named state → that node's capability (undefined = not one). */
  private capabilityOf(
    variableId: string,
    next: string,
    valueOf: (raw: string) => unknown,
  ): InteractionAction | undefined {
    const entry = this.reader.getEntry(variableId) as
      StateVariableEntry | undefined;
    const source = entry?.source;
    return source
      ? this.capabilityAt(source.nodeId, source.prop, next, valueOf)
      : undefined;
  }

  /**
   * A setter call on a node's prop state → that node's capability on the prop. ADR-287 — an implicit
   * state (`symbols.states`) also takes a `!param` Do's value (`setMeterValue(80)` → 「값 설정」 80).
   */
  private capabilityAt(
    nodeId: string,
    prop: string,
    next: string,
    valueOf: (raw: string) => unknown,
    implicit = false,
  ): InteractionAction | undefined {
    const node = this.reader.getEntry(nodeId);
    if (node?.kind !== "node") return undefined;
    const all = resolveCapabilities(
      definitionTypeName(this.reader, node.definitionId),
    );
    // ADR-296 E2 — the display state (`isVisible`): show · hide · toggle by the value written.
    if (prop === "isVisible") {
      const id =
        next === "true"
          ? "show"
          : next === "false"
            ? "hide"
            : next === "v => !v"
              ? "toggle"
              : undefined;
      return id && all[id]
        ? ({
            opcode: "capability",
            target: { nodeId: node.id },
            capabilityId: id,
          } as InteractionAction)
        : undefined;
    }
    const defs = Object.entries(all).filter(
      ([, def]) => !def.imperative && def.prop === prop,
    );
    const add = /^v => new Set\(\[\.\.\.v, (.+)\]\)$/.exec(next);
    const remove =
      /^v => new Set\(\[\.\.\.v\]\.filter\(key => key !== (.+)\)\)$/.exec(next);
    const pick = defs.find(([, def]) =>
      next === "new Set()"
        ? Array.isArray(def.value)
        : next === "v => !v"
          ? def.value === "!self"
          : add
            ? def.value === "!param" && def.op === "add"
            : remove
              ? def.value === "!param" && def.op === "remove"
              : def.value !== "!param" &&
                JSON.stringify(def.value) === JSON.stringify(literalOf(next)),
    );
    const written =
      !pick && implicit
        ? defs.find(([, def]) => def.value === "!param" && !def.op)
        : undefined;
    if (written)
      return {
        opcode: "capability",
        target: { nodeId: node.id },
        capabilityId: written[0],
        value: valueOf(next),
      } as InteractionAction;
    if (!pick) return undefined;
    const param = add?.[1] ?? remove?.[1];
    return {
      opcode: "capability",
      target: { nodeId: node.id },
      capabilityId: pick[0],
      ...(param !== undefined ? { value: valueOf(param) } : {}),
    } as InteractionAction;
  }

  /** A handler's · drop option's statements → Dos (undefined = refused). */
  /** `props.on<Name>?.(value)` → the emit Do of the component that holds the rule's node. */
  private emitOf(
    callback: string,
    value: string,
    ownerId: string | undefined,
    valueOf: (raw: string) => unknown,
  ): InteractionAction | undefined {
    const definitionId = ownerId
      ? emitDefinitionOf(
          { ownerId: ownerId as NodeId },
          (id) => this.reader.getEntry(id as never),
          (id) => this.reader.ownerOf(id),
        )
      : undefined;
    const event = componentEventPropertiesOf(
      definitionId ? this.reader.getEntry(definitionId) : undefined,
    ).find((property) => componentEventAttribute(property) === callback);
    if (!event) return undefined;
    const read = value.trim() ? valueOf(value) : undefined;
    return {
      opcode: "emit",
      propertyKey: event.key,
      ...(read !== undefined ? { value: read } : {}),
    } as InteractionAction;
  }

  private dosOf(
    body: string,
    from: number,
    context: {
      trigger: string;
      args: readonly string[];
      fields: boolean;
      params: readonly string[];
      /** ADR-294 — the rule's node (an origin rule's `props.on…?.()` names its component's event). */
      ownerId?: string;
    },
  ): InteractionAction[] | undefined {
    const { args, fields, params } = context;
    const setter = (name: string) =>
      [...this.variables].find(
        ([variable]) => `set${capital(variable)}` === name,
      )?.[1];
    const lists = new Map(
      this.input.data.collections.map((collection) => [
        codeNameOf(collection.name),
        `data:collection:${collection.id}`,
      ]),
    );
    /** An event · item · variable read, or a literal (`eventValue`'s inverse). */
    const valueOf = (raw: string): unknown => {
      const text = raw.trim();
      const keyed = /^(?:\[\.\.\.(.+)\]\[0\]|([\w$.]+)) \?\? ''$/.exec(text);
      if (keyed) return valueOf(keyed[1] ?? keyed[2]!);
      const items =
        /^\[\.\.\.([\w$.]+)\]\.map\(key => [\w$]+\.getItem\(key\)\)(?:\.map\(row => row\?\.([\w$.]+)\))?$/.exec(
          text,
        );
      if (items) {
        const event = valueOf(items[1]!);
        if (typeof event !== "string" || !event.startsWith("!event."))
          return undefined;
        return [
          `!item.${event.slice(7)}`,
          ...(items[2] ? [items[2]] : []),
        ].join(".");
      }
      const [head, ...path] = text.split(".");
      if (fields && head === "e" && path.length)
        return `!event.${path.join(".")}`;
      if (fields && head === "keys") return ["!event.keys", ...path].join(".");
      const index = params.indexOf(head!);
      if (!fields && index >= 0)
        return [`!event.${args[index] ?? head}`, ...path].join(".");
      if (IDENTIFIER.test(head!) && this.variables.has(head!))
        return [`!var.${this.variables.get(head!)}`, ...path].join(".");
      return literalOf(text);
    };
    const listOf = (name: string) => {
      const collectionId = lists.get(name);
      if (!collectionId) this.reject(from, "unknownReference", name);
      return collectionId;
    };
    const actions: InteractionAction[] = [];
    const lines = statementsOf(
      // (A line comment — the generator's note over a kept Do — is not a Do.)
      body.replace(/^\s*\/\/.*$/gm, ""),
    )
      .map((line) => line.trim().replace(/;$/, ""))
      .filter(Boolean);
    for (let index = 0; index < lines.length; index += 1) {
      const raw = lines[index]!;
      // (A foreign drop's keys line — the drop's items read as the dragged keys.)
      if (
        /^let keys = await Promise\.all\(e\.items\.filter\(isTextDropItem\)\.map\(item => item\.getText\(.+\)\)\)$/.test(
          raw,
        )
      )
        continue;
      const set = /^(set[A-Z][\w$]*)\(([\s\S]*)\)$/.exec(raw);
      // (ADR-295 후속 C5 — the S2 options: `variant` in the content, `timeout` in RAC's options;
      //  C8 — `actionLabel` · `shouldCloseOnAction` · `onAction: () => {…}` (its body = Dos).)
      const toast =
        /^queue\.add\(\{title: ('(?:[^'\\]|\\.)*')(?:, variant: '(\w+)')?(?:, actionLabel: ('(?:[^'\\]|\\.)*'))?(, shouldCloseOnAction: true)?(?:, onAction: (?:async )?\(\) => \{([\s\S]*)\})?\}(?:, \{timeout: (\d+)\})?\)$/.exec(
          raw,
        );
      const go = /^navigate\(('(?:[^'\\]|\\.)*')\)$/.exec(raw);
      const list = /^([\w$]+)\.(\w+)\(([\s\S]*)\)$/.exec(raw);
      const each =
        /^for \(let id of (.+?)\) ([\w$]+)\.update\(id, \{\.\.\.\2\.getItem\(id\), ([\w$]+): ([\s\S]+)\}\)$/.exec(
          raw,
        );
      const side =
        /^if \((.+) === 'before'\) ([\w$]+)\.moveBefore\((.+?), (.+)\)$/.exec(
          raw,
        );
      const fetchCall =
        /^await fetch\(('(?:[^'\\]|\\.)*'), \{method: ('[A-Z]+')(?:, body: JSON\.stringify\(([\s\S]+)\))?\}\)$/.exec(
          raw,
        );
      // ADR-296 E3 — an imperative Do on a node's ref (`formRef.current?.submit()`).
      const imperative = /^([A-Za-z_$][\w$]*)\.current\?\.(\w+)\(\)$/.exec(raw);
      if (imperative) {
        const nodeId = this.baseline.symbols.refs?.[imperative[1]!];
        const node = nodeId ? this.reader.getEntry(nodeId) : undefined;
        const def =
          node?.kind === "node"
            ? resolveCapabilities(
                definitionTypeName(this.reader, node.definitionId),
              )[imperative[2]!]
            : undefined;
        if (!nodeId || !def?.imperative) {
          this.reject(from, "unknownReference", imperative[1]);
          return undefined;
        }
        actions.push({
          opcode: "capability",
          target: { nodeId },
          capabilityId: imperative[2]!,
        } as InteractionAction);
        continue;
      }
      // ADR-296 E4 · E13 — a Do on a target the code names by reference (`{target: null}` = unset).
      const targeted =
        /^capability\(('(?:[^'\\]|\\.)*'), \{target: (null|'(?:[^'\\]|\\.)*')(?:, value: ([\s\S]+))?\}\)$/.exec(
          raw,
        );
      if (targeted) {
        const ref = targeted[2] === "null" ? null : literalOf(targeted[2]!);
        const target =
          ref === null
            ? { unset: true }
            : this.baseline.symbols.targets?.[String(ref)];
        if (!target) {
          this.reject(from, "unknownReference", String(ref));
          return undefined;
        }
        actions.push({
          opcode: "capability",
          target,
          capabilityId: literalOf(targeted[1]!),
          ...(targeted[3] !== undefined ? { value: valueOf(targeted[3]) } : {}),
        } as InteractionAction);
        continue;
      }
      // ADR-296 E13 — a Do the code cannot write, as the document holds it.
      const keep = /^keep\(('(?:[^'\\]|\\.)*')\)$/.exec(raw);
      if (keep) {
        const action =
          this.baseline.symbols.kept?.[String(literalOf(keep[1]!))];
        if (!action) {
          this.reject(from, "unknownReference", keep[1]);
          return undefined;
        }
        actions.push(action as InteractionAction);
        continue;
      }
      // ADR-294 — an origin rule sends its component's event (`props.onSelect?.(value)`).
      const sent = /^props\.(on[A-Z][\w$]*)\?\.\(([\s\S]*)\)$/.exec(raw);
      if (sent) {
        const action = this.emitOf(
          sent[1]!,
          sent[2]!,
          context.ownerId,
          valueOf,
        );
        if (!action) {
          this.reject(from, "unknownReference", sent[1]);
          return undefined;
        }
        actions.push(action);
        continue;
      }
      if (set) {
        const variableId = setter(set[1]!);
        const value = set[2]!.trim();
        // (ADR-287 — a rule's implicit state: its setter is the node's Do on that prop.)
        const implicit = Object.entries(
          this.baseline.symbols.states ?? {},
        ).find(([name]) => `set${capital(name)}` === set[1])?.[1];
        if (!variableId && implicit) {
          const capability = this.capabilityAt(
            implicit.nodeId,
            implicit.prop,
            value,
            valueOf,
            true,
          );
          if (!capability) {
            this.reject(from, "outsideVocabulary", value);
            return undefined;
          }
          actions.push(capability);
          continue;
        }
        if (!variableId) {
          this.reject(from, "unknownReference", set[1]);
          return undefined;
        }
        // (A component's named state — `setSelectedKeys(new Set())` on a list's selection: the
        // component's capability on it, as `writeAction` names it.)
        const capability = this.capabilityOf(variableId, value, valueOf);
        if (capability) {
          actions.push(capability);
          continue;
        }
        if (value === "v => !v") {
          actions.push({
            opcode: "setState",
            variableId,
            op: "toggle",
          } as InteractionAction);
          continue;
        }
        const toggle = /^v => v === (.+) \? .+ : \1$/.exec(value);
        if (toggle) {
          actions.push({
            opcode: "setState",
            variableId,
            op: "toggle",
            value: literalOf(toggle[1]!),
          } as InteractionAction);
          continue;
        }
        const increment = /^v => v \+ (-?\d+(?:\.\d+)?)$/.exec(value);
        if (increment) {
          actions.push({
            opcode: "setState",
            variableId,
            op: "increment",
            value: Number(increment[1]),
          } as InteractionAction);
          continue;
        }
        // (The variable's start as its `useState` writes it: a reset — `new Set()` is no value.)
        const start = this.parsed.statements
          .find((item) => item.kind === "state" && item.setter === set[1])
          ?.code.match(/useState(?:<\w+>)?\(([\s\S]*)\);$/)?.[1]
          ?.trim();
        if (start !== undefined && start === value) {
          actions.push({
            opcode: "setState",
            variableId,
            op: "reset",
          } as InteractionAction);
          continue;
        }
        const next = value === "" ? undefined : valueOf(value);
        if (next === undefined) {
          this.reject(from, "outsideVocabulary", value);
          return undefined;
        }
        actions.push({
          opcode: "setState",
          variableId,
          op: "set",
          value: next,
        } as InteractionAction);
        continue;
      }
      if (toast) {
        // (The button's Dos read the handler's event — the same context, a closure.)
        const onAction =
          toast[5] !== undefined ? this.dosOf(toast[5], from, context) : [];
        if (!onAction) return undefined;
        actions.push({
          opcode: "toast",
          message: literalOf(toast[1]!),
          ...(toast[2] ? { variant: toast[2] } : {}),
          ...(toast[3] ? { actionLabel: literalOf(toast[3]) } : {}),
          ...(toast[4] ? { shouldCloseOnAction: true } : {}),
          ...(onAction.length ? { onAction } : {}),
          ...(toast[6] ? { timeout: Number(toast[6]) } : {}),
        } as InteractionAction);
        continue;
      }
      if (go) {
        const route = literalOf(go[1]!);
        const project = this.reader.getEntry(
          this.reader.projectId,
        ) as ProjectEntry;
        const pageId = project.pageIds.find(
          (pageId) =>
            (this.reader.getEntry(pageId) as PageEntry | undefined)?.route ===
            route,
        );
        if (!pageId) {
          this.reject(from, "unknownReference", String(route));
          return undefined;
        }
        actions.push({ opcode: "navigate", pageId } as InteractionAction);
        continue;
      }
      // ADR-296 E11 — an endpoint by its name (`await saveOrder({body})` — `api/saveOrder.ts`).
      const named =
        /^await ([A-Za-z_$][\w$]*)\((?:\{body: ([\s\S]+)\})?\)$/.exec(raw);
      if (named && !fetchCall) {
        const project = this.reader.getEntry(
          this.reader.projectId,
        ) as ProjectEntry;
        const endpointId = (project.endpointIds ?? []).find((id) => {
          const entry = this.reader.getEntry(id);
          return (
            entry?.kind === "endpoint" && codeNameOf(entry.name) === named[1]
          );
        });
        if (!endpointId) {
          this.reject(from, "unknownReference", named[1]);
          return undefined;
        }
        actions.push({
          opcode: "callEndpoint",
          endpointId,
          ...(named[2] !== undefined ? { body: valueOf(named[2]) } : {}),
        } as InteractionAction);
        continue;
      }
      if (fetchCall) {
        const url = literalOf(fetchCall[1]!);
        const matches = this.input.data.endpoints.filter(
          (item) => item.url === url,
        );
        // ADR-296 E11 — the URL names two endpoints: the call is refused (Phase 3: by name).
        if (matches.length > 1) {
          this.reject(from, "ambiguousEndpoint", String(url));
          return undefined;
        }
        const endpoint = matches[0];
        if (!endpoint) {
          this.reject(from, "unknownReference", String(url));
          return undefined;
        }
        actions.push({
          opcode: "callEndpoint",
          endpointId: `data:endpoint:${endpoint.id}`,
          ...(fetchCall[3] !== undefined
            ? { body: valueOf(fetchCall[3]) }
            : {}),
        } as InteractionAction);
        continue;
      }
      if (each) {
        const collectionId = listOf(each[2]!);
        const field = collectionId
          ? this.baseline.symbols.fields[collectionId]?.[each[3]!]
          : undefined;
        if (!collectionId || !field) return undefined;
        actions.push({
          opcode: "update",
          collectionId,
          key: valueOf(each[1]!),
          field,
          value: valueOf(each[4]!),
        } as InteractionAction);
        continue;
      }
      if (side) {
        const other =
          /^else if \((.+) === 'after'\) ([\w$]+)\.moveAfter\((.+?), (.+)\)$/.exec(
            lines[index + 1] ?? "",
          );
        const collectionId = listOf(side[2]!);
        if (
          !collectionId ||
          !other ||
          other[1] !== side[1] ||
          other[2] !== side[2] ||
          other[3] !== side[3] ||
          other[4] !== side[4]
        ) {
          this.reject(from, "outsideVocabulary", raw);
          return undefined;
        }
        index += 1;
        actions.push({
          opcode: "moveBefore",
          collectionId,
          key: valueOf(side[3]!),
          keys: valueOf(side[4]!),
          dropPosition: valueOf(side[1]!),
        } as InteractionAction);
        continue;
      }
      if (list && lists.has(list[1]!)) {
        const collectionId = lists.get(list[1]!)!;
        const parts = splitTop(list[3]!, ",");
        const method = list[2]!;
        const one = (key: string, value: string) =>
          ({ opcode: method, collectionId, [key]: valueOf(value) }) as never;
        let action: InteractionAction | undefined;
        if (
          ["reload", "loadMore", "removeSelectedItems"].includes(method) &&
          !parts.length
        )
          action = { opcode: method, collectionId } as never;
        else if (
          ["append", "prepend", "setFilterText"].includes(method) &&
          parts.length === 1
        )
          action = one("value", parts[0]!);
        // ADR-296 E10 — `useTreeData.append(parentKey, …)` · `prepend(parentKey, …)`.
        else if (["append", "prepend"].includes(method) && parts.length === 2)
          action = {
            opcode: method,
            collectionId,
            parentKey: valueOf(parts[0]!),
            value: valueOf(parts[1]!),
          } as never;
        else if (method === "remove" && parts.length === 1)
          // (`...keys` — a key list; one key is one argument, E12.)
          action = one(
            "keys",
            parts[0]!.startsWith("...") ? parts[0]!.slice(3) : parts[0]!,
          );
        else if (method === "insert" && parts.length === 2)
          action = {
            opcode: "insert",
            collectionId,
            index: valueOf(parts[0]!),
            value: valueOf(parts[1]!),
          } as never;
        else if (method === "insert" && parts.length === 3)
          action = {
            opcode: "insert",
            collectionId,
            parentKey: valueOf(parts[0]!),
            index: valueOf(parts[1]!),
            value: valueOf(parts[2]!),
          } as never;
        else if (method === "move" && parts.length === 3)
          action = {
            opcode: "move",
            collectionId,
            key: valueOf(parts[0]!),
            toParentKey: valueOf(parts[1]!),
            toIndex: valueOf(parts[2]!),
          } as never;
        else if (
          ["insertBefore", "insertAfter"].includes(method) &&
          parts.length === 2
        )
          action = {
            opcode: method,
            collectionId,
            key: valueOf(parts[0]!),
            value: valueOf(parts[1]!),
          } as never;
        else if (method === "move" && parts.length === 2)
          action = {
            opcode: "move",
            collectionId,
            key: valueOf(parts[0]!),
            toIndex: valueOf(parts[1]!),
          } as never;
        else if (
          ["moveBefore", "moveAfter"].includes(method) &&
          parts.length === 2
        )
          action = {
            opcode: method,
            collectionId,
            key: valueOf(parts[0]!),
            keys: valueOf(parts[1]!),
          } as never;
        else if (method === "update" && parts.length === 2) {
          const patch =
            /^\{\.\.\.[\w$]+\.getItem\((.+?)\), ([\w$]+): ([\s\S]+)\}$/.exec(
              parts[1]!,
            );
          const field = patch
            ? this.baseline.symbols.fields[collectionId]?.[patch[2]!]
            : undefined;
          action = patch
            ? field
              ? ({
                  opcode: "update",
                  collectionId,
                  key: valueOf(parts[0]!),
                  field,
                  value: valueOf(patch[3]!),
                } as never)
              : undefined
            : ({
                opcode: "update",
                collectionId,
                key: valueOf(parts[0]!),
                value: valueOf(parts[1]!),
              } as never);
        }
        if (action) {
          actions.push(action);
          continue;
        }
      }
      this.reject(from, "outsideVocabulary", raw);
      return undefined;
    }
    return actions;
  }
}

/** What a node holds that its code does not show — equal states are indistinguishable. */
/** ADR-301 — a template position's address and template node (undefined = it names none). */
function codeViewPositionTemplate(
  reader: CatalogReader,
  position: { readonly ownerId: string; readonly key: string },
): CodeViewPositionTemplate | undefined {
  const address = codeViewAddressOf(
    reader as never,
    position.ownerId,
    position.key,
    undefined,
    true,
  );
  const template = address
    ? reader.library.templates.get(address.templatePath.at(-1) as never)
    : undefined;
  return address && template ? { address, template } : undefined;
}

function stateOf(reader: CatalogReader, node: NodeEntry | undefined): string {
  if (!node) return "";
  const { visual, layout, sizing, responsive, descendantOverrides, name } =
    node as NodeEntry & Record<string, unknown>;
  return JSON.stringify({
    visual,
    layout,
    sizing,
    responsive,
    descendantOverrides,
    name,
    referrers: [...reader.referrersOf(node.id)].sort(),
  });
}

/* ─── the check: the regenerated code gives back what the edit wrote ─────────────────────── */

/** ADR-296 Phase 4 — a document's node classes and the nodes whose code carries them. */
export interface CodeViewFinalClasses {
  readonly classes: ReadonlyMap<string, string>;
  readonly styled: ReadonlySet<string>;
}

/** A page's node classes and styled nodes in a (final) document. */
export function codeViewFinalClasses(
  final: CatalogReader,
  pageId: string,
): CodeViewFinalClasses {
  return {
    classes: codeViewNodeClasses(final as never, pageId),
    styled: new Set(
      codeViewPageNodes(final, pageId)
        .filter((node) => codeViewNodeHasStyle(final as never, node))
        .map((node) => node.id),
    ),
  };
}

function compareRegenerated(
  edited: CodeViewParsed,
  regenerated: CodeViewParsed,
  baseline: CodeViewParsed,
  planner: Planner,
  reject: Reject,
  final?: CodeViewFinalClasses,
): void {
  // ADR-296 Phase 4 — a styled node's class (the first `className` token) is display only: it
  // follows the node's name and document order, so a move may number it again. Only the author's
  // classes are compared — the class is taken off only where the code carries it (a styled node).
  const mine: CodeViewFinalClasses = {
    classes: planner.baselineClasses(),
    styled: planner.styledNodes(),
  };
  const theirs = final ?? mine;
  const authorClasses = (
    text: string,
    nodeId: string | undefined,
    side: CodeViewFinalClasses,
  ) => {
    const value =
      /^className=(?:"((?:[^"\\]|\\.)*)"|\{['"`](.*)['"`]\})$/s.exec(
        text.trim(),
      );
    const tokens = (value?.[1] ?? value?.[2] ?? text)
      .split(/\s+/)
      .filter(Boolean);
    if (
      nodeId &&
      side.styled.has(nodeId) &&
      tokens[0] === side.classes.get(nodeId)
    )
      tokens.shift();
    return tokens.join(" ");
  };
  // Statements: each written one comes back (in any order); a derived one the edit did not
  // write is the document's to add — any other the edit did not write is not what it wrote.
  const pool = [...regenerated.statements];
  const baselineHandlers = new Set(
    baseline.statements
      .filter((item) => item.kind === "handler")
      .map((item) => codeViewNormalized(item.code)),
  );
  for (const statement of edited.statements) {
    // ADR-296 (판독 MEDIUM-1) — a named handler is its rule: read (planned) or as the baseline wrote
    // it; its name is a position the regenerated code may number again.
    if (
      statement.kind === "handler" &&
      (planner.readFunctions.has(statement.name ?? "") ||
        baselineHandlers.has(codeViewNormalized(statement.code)))
    )
      continue;
    const text = codeViewNormalized(statement.code);
    const index = pool.findIndex(
      (item) => codeViewNormalized(item.code) === text,
    );
    if (index >= 0) {
      pool.splice(index, 1);
      continue;
    }
    if (
      statement.kind === "import" &&
      (importCovered(statement, regenerated) ||
        importCovered(statement, baseline))
    )
      continue;
    // (A derived line as the baseline wrote it: its owner went with this edit — the document
    // drops it.)
    if (
      DERIVED_KINDS.has(statement.kind) &&
      baseline.statements.some((item) => codeViewNormalized(item.code) === text)
    )
      continue;
    reject(
      statement.from,
      DERIVED_KINDS.has(statement.kind)
        ? "derivedChanged"
        : "outsideVocabulary",
    );
  }
  if (
    pool.some(
      (item) => !DERIVED_KINDS.has(item.kind) && item.kind !== "handler",
    )
  )
    reject(edited.component?.from ?? 0, "outsideVocabulary");
  // Elements: the same tree, each written attribute · text as written (a new element may gain
  // its palette defaults).
  /** The owner an edited element's children are positions of (an expanded instance · a position). */
  const ownerOf = (parent: CodeViewElement | undefined) => {
    const id = parent ? planner.elementIds().get(parent) : undefined;
    return id ? (codeViewPositionOf(id)?.ownerId ?? id) : undefined;
  };
  const compare = (
    a: readonly CodeViewElement[],
    given: readonly CodeViewElement[],
    parentFrom: number,
    parent?: CodeViewElement,
  ) => {
    // ADR-301 R9 — a position the edit deleted whole comes back hidden (`{false && …}`): only that
    // element (its owner · class · hidden state) is not compared.
    const owner = ownerOf(parent);
    const hidden = planner.hiddenPositions.filter(
      (item) => item.ownerId === owner,
    );
    const b =
      hidden.length && a.length < given.length
        ? given.filter((element) => {
            if (element.visibleState !== "false") return true;
            const className = element.attributes.find(
              (attr) => attr.name === "className",
            )?.value?.code;
            return !hidden.some((item) => item.className === className);
          })
        : given;
    if (a.length !== b.length) {
      const extra = a[b.length] ?? a.at(-1);
      reject(extra?.from ?? parentFrom, "notInCode");
      return;
    }
    a.forEach((element, index) => {
      const other = b[index]!;
      const fresh = planner.added.has(element);
      if (
        (element.type !== other.type &&
          planner.expandedTypeOf(element) !== other.type) ||
        element.visibleState !== other.visibleState
      ) {
        reject(element.from, "notInCode");
        return;
      }
      // ADR-301 (판독 round 3 m1) — a new expanded instance: a prop its positions read is written
      // at each of them (`<Popover size="L" />` → `<DialogTrigger><Popover size="L">`).
      const bindings =
        fresh && element.type !== other.type
          ? planner.expandedBindingsOf(element)
          : undefined;
      for (const attribute of element.attributes) {
        const twin = other.attributes.find(
          (item) => item.name === attribute.name,
        );
        // (A node's ref is derived from the Dos that call it — ADR-296 E3.)
        if (attribute.name === "ref") continue;
        const readers = !twin ? bindings?.get(attribute.name) : undefined;
        if (readers) {
          // (The value alone — the position's prop may have another name; bare = `{true}`.)
          const valueOf = (item: CodeViewAttribute, text: string) =>
            item.value
              ? codeViewNormalized(text.slice(item.value.from, item.value.to))
              : "{true}";
          const value = valueOf(attribute, edited.code);
          const held = (position: CodeViewElement): boolean =>
            position.attributes.some(
              (item) =>
                readers.has(item.name) &&
                valueOf(item, regenerated.code) === value,
            ) || position.children.some(held);
          if (!other.children.some(held))
            reject(attribute.from, "notInCode", attribute.name);
          continue;
        }
        if (attribute.name === "className") {
          const id = planner.elementIds().get(element);
          const written = authorClasses(
            edited.code.slice(attribute.from, attribute.to),
            id,
            mine,
          );
          const given = twin
            ? authorClasses(
                regenerated.code.slice(twin.from, twin.to),
                id,
                theirs,
              )
            : "";
          if (written !== given)
            reject(attribute.from, "notInCode", attribute.name);
          continue;
        }
        // (A handler read into rules, or as the baseline wrote it: its rules are the meaning.)
        if (
          twin &&
          /^on[A-Z]/.test(attribute.name) &&
          (planner.readHandlers.has(attribute) ||
            planner.sameAsBaseline(element, attribute))
        )
          continue;
        if (
          !twin ||
          codeViewNormalized(
            edited.code.slice(attribute.from, attribute.to),
          ) !== codeViewNormalized(regenerated.code.slice(twin.from, twin.to))
        )
          reject(attribute.from, "notInCode", attribute.name);
      }
      if (!fresh)
        for (const twin of other.attributes)
          if (
            twin.name !== "ref" &&
            !element.attributes.some((item) => item.name === twin.name) &&
            !(
              twin.name === "className" &&
              !authorClasses(
                regenerated.code.slice(twin.from, twin.to),
                planner.elementIds().get(element),
                theirs,
              )
            )
          )
            reject(element.from, "notInCode", twin.name);
      if (
        (element.text || !fresh) &&
        codeViewNormalized(element.text?.code ?? "") !==
          codeViewNormalized(other.text?.code ?? "")
      )
        reject(element.text?.from ?? element.from, "notInCode");
      if (
        codeViewNormalized(element.rows?.code ?? "") !==
        codeViewNormalized(other.rows?.code ?? "")
      )
        reject(element.rows?.from ?? element.from, "notInCode");
      // (A new element written without children may gain its palette defaults' — ADR-296 Phase 5
      // slot contents.)
      // (A new collection keeps its template's empty state — 사용자 결정 2026-10-23 — when the code
      // writes none: 판독 Phase 5 MEDIUM-3.)
      const gained =
        fresh &&
        !element.children.some((child) => child.type === "IllustratedMessage")
          ? other.children.filter(
              (child) => child.type !== "IllustratedMessage",
            )
          : other.children;
      if (!(fresh && !element.children.length))
        compare(element.children, gained, element.from, element);
    });
  };
  compare(
    edited.jsx?.roots ?? [],
    regenerated.jsx?.roots ?? [],
    edited.jsx?.from ?? 0,
  );
  // ADR-296 E7 — the page element (`<Page …>`) as written, or `<>` on both sides.
  const page = edited.jsx?.page;
  const twin = regenerated.jsx?.page;
  if (!!page !== !!twin) reject(edited.jsx?.from ?? 0, "notInCode", "Page");
  else if (page && twin) compare([page], [twin], edited.jsx?.from ?? 0);
}

/** An import the document's code covers: the same module, names the document imports too. */
function importCovered(
  statement: CodeViewStatement,
  regenerated: CodeViewParsed,
): boolean {
  const m = /^import \{([^}]*)\} from '([^']+)';?$/.exec(statement.code.trim());
  if (!m) return false;
  const names = m[1]!
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return regenerated.statements.some((item) => {
    const other = /^import \{([^}]*)\} from '([^']+)';?$/.exec(
      item.code.trim(),
    );
    if (!other || other[2] !== m[2]) return false;
    const have = new Set(other[1]!.split(",").map((name) => name.trim()));
    return names.every((name) => have.has(name));
  });
}

export type { CatalogEntry };

/**
 * Apply an edit: plan it at the session's baseline and run it as one step at that revision (no
 * re-plan — a document changed meanwhile refuses it). `applied` counts the planned commands.
 */
export function catalogCodeViewApply(
  workspace: {
    readonly runtime: {
      readonly graph: CatalogReader & { commandReader: CatalogReader };
    };
    readonly newId: NewId;
    execute(
      command: CatalogCommand,
      options?: { expectedRevision?: number },
    ): unknown;
  },
  session: CatalogCodeViewSession,
  edited: string,
  changes: readonly CodeViewChange[],
  data: Data,
): {
  applied: boolean;
  count: number;
  rejected: readonly CatalogCodeViewRejection[];
} {
  const plan = catalogCodeViewPlan({
    reader: workspace.runtime.graph.commandReader,
    session,
    edited,
    changes,
    data,
    newId: workspace.newId,
  });
  if (plan.rejected.length)
    return { applied: false, count: 0, rejected: plan.rejected };
  if (!plan.command) return { applied: true, count: 0, rejected: [] };
  try {
    workspace.execute(plan.command, { expectedRevision: session.revision });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      applied: false,
      count: 0,
      rejected: [
        {
          line: 1,
          reason: /REVISION_CONFLICT/.test(message)
            ? "staleBaseline"
            : "commandRefused",
          text: "",
          detail: message,
        },
      ],
    };
  }
  return { applied: true, count: plan.count ?? 0, rejected: [] };
}

/**
 * A handler body's statements: split at a `;` that ends a line outside quotes and brackets — a
 * toast's `onAction: () => {…}` keeps its own statements inside (295 후속 C8).
 */
function statementsOf(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]!;
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "(" || char === "[" || char === "{") depth += 1;
    else if (char === ")" || char === "]" || char === "}") depth -= 1;
    else if (
      char === ";" &&
      depth === 0 &&
      /^[ \t]*(\n|$)/.test(body.slice(index + 1))
    ) {
      out.push(body.slice(start, index + 1));
      start = index + 1;
    }
  }
  out.push(body.slice(start));
  return out;
}
