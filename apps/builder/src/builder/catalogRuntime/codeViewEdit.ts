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
import {
  insertNodes,
  moveNodes,
  removeTargets,
  setFields,
  stageOver,
  type CatalogCommand,
  type CatalogCommandPlan,
} from "../../../../../packages/shared/src/catalog/commands";
import {
  addRecord,
  removeRecords,
  updateRecord,
} from "../../../../../packages/shared/src/catalog/commands/project";
import { setNodeInteractions } from "../../../../../packages/shared/src/catalog/commands/project";
import { definitionTypeName } from "../../../../../packages/shared/src/catalog/commands/context";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import type {
  CatalogEntry,
  EntryId,
  InteractionAction,
  InteractionEntry,
  NodeEntry,
  NodeId,
  PageEntry,
  ProjectEntry,
  StateVariableEntry,
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { NewId } from "../../../../../packages/shared/src/catalog/commands/materialize";
import { isBodyType } from "../../../../../packages/shared/src/domain/predicates";
import { generateCodeView } from "../../../../../packages/shared/src/codeView/generate";
import {
  literalOf,
  termOf,
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
  eventArgNames,
  resolveTriggers,
} from "../../../../../packages/shared/src/interactions/capabilityRegistry";
import type { catalogCodeViewData } from "./codeView";
import { catalogBindingCommand } from "./dataBindingCommand";
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
  | "staleBaseline";

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

/** The derived statements (the document makes them — checked, never applied · Decision 6). */
const DERIVED_KINDS = new Set([
  "import",
  "toasts",
  "collection",
  "effect",
  "useFilter",
  "collator",
  "navigate",
  "dnd",
]);

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
   * Read every unit again, changed or not (the G1 gate: each vocabulary form's reader gives back
   * the document's value — unchanged code then plans nothing that changes the code).
   */
  readonly strict?: boolean;
}

/** Plan an edit of the code view (nothing runs here). */
export function catalogCodeViewPlan(input: PlanInput): CatalogCodeViewPlan {
  const { reader, session, edited } = input;
  const rejected: CatalogCodeViewRejection[] = [];
  const reject = (
    from: number,
    reason: CatalogCodeViewReason,
    detail?: string,
  ) => {
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
  if (
    reader.revision !== session.revision ||
    reader.getEntry(session.pageId)?.kind !== "page"
  )
    return {
      rejected: [{ line: 1, reason: "staleBaseline", text: "" }],
    };
  if (edited === session.baseline.code && !input.strict)
    return { rejected: [] };

  const parsed = parseCodeView(edited);
  for (const problem of parsed.problems) reject(problem.from, problem.reason);
  if (!parsed.jsx) reject(0, "outsideVocabulary");
  if (rejected.length) return { rejected };

  const baseline = session.baseline;
  const anchors = baseline.anchors;
  const outcomes = codeViewAnchorOutcomes(
    anchors.map((anchor) => ({ from: anchor.start, to: anchor.end })),
    input.changes,
  );
  const planner = new Planner(input, parsed, outcomes, reject);
  const steps = planner.plan();
  if (rejected.length) return { rejected };

  const command: CatalogCommand = (commandReader) => {
    const stage = stageOver(commandReader);
    const ops: CatalogCommandPlan["ops"][number][] = [];
    for (const step of steps) {
      const plan = step(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
    }
    return { label: "Edit code", ops };
  };

  // Dry run: the staged document's code must give back what the edit wrote.
  let regenerated: string;
  try {
    const stage = stageOver(reader);
    stage.apply(command(reader).ops);
    regenerated = generateCodeView({
      reader: stage,
      pageId: session.pageId,
      ...input.data,
    }).code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reject(planner.lastFrom, "commandRefused", message);
    return { rejected };
  }
  compareRegenerated(
    parsed,
    parseCodeView(regenerated),
    parseCodeView(session.baseline.code),
    planner,
    reject,
  );
  if (rejected.length) return { rejected };
  return steps.length
    ? { command, count: steps.length, rejected }
    : { rejected };
}

/* ─── the planner ────────────────────────────────────────────────────────────────────────── */

type Reject = (
  from: number,
  reason: CatalogCodeViewReason,
  detail?: string,
) => void;

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const capital = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

class Planner {
  readonly steps: CatalogCommand[] = [];
  /** Where the last planned step's code starts (a refusal names that line). */
  lastFrom = 0;
  /** Elements that are new in this edit (their palette defaults may show in the code). */
  readonly added = new Set<CodeViewElement>();
  /** Code name → variable id, as the edited code names them. */
  private readonly variables = new Map<string, string>();
  private readonly baseline: CodeViewResult;
  private readonly page: PageEntry;

  constructor(
    private readonly input: PlanInput,
    private readonly parsed: CodeViewParsed,
    private readonly outcomes: readonly CodeViewAnchorOutcome[],
    private readonly reject: Reject,
  ) {
    this.baseline = input.session.baseline;
    this.page = input.reader.getEntry(input.session.pageId) as PageEntry;
    for (const [name, id] of Object.entries(this.baseline.symbols.variables))
      this.variables.set(name, id);
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
    return this.steps;
  }

  /* ── variables (`useState`) ── */

  private planVariables(): void {
    const statements = this.parsed.statements.filter(
      (item) => item.kind === "state",
    );
    const used = new Set<CodeViewStatement>();
    const variableAnchors = this.baseline.anchors
      .map((anchor, index) => ({ anchor, outcome: this.outcomes[index]! }))
      .filter(
        (item) =>
          item.anchor.target.kind === "variable" &&
          /^let \[/.test(this.code(item.anchor)),
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
    // Deleted · replaced: an equal text, else in a hunk the same place · type · start (decision 5).
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
      const same =
        equal ??
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
      if (next.valueType !== entry.valueType)
        changes.valueType = next.valueType;
      if (
        JSON.stringify(next.defaultValue) !==
          JSON.stringify(entry.defaultValue) &&
        !(next.defaultValue === null && entry.valueType === "object")
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
    // New statements: new page variables.
    for (const statement of statements) {
      if (used.has(statement)) continue;
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
            ownerId: this.page.id,
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
    const m = /= useState(?:<(Selection|SortDescriptor)>)?\(([\s\S]*)\);$/.exec(
      statement.code,
    );
    if (!m) {
      this.reject(statement.from, "outsideVocabulary");
      return undefined;
    }
    const [, type, raw = ""] = m;
    const text = raw.trim();
    if (type === "SortDescriptor")
      return text ? undefined : { valueType: "object", defaultValue: null };
    if (type === "Selection") {
      const keys = text === "new Set()" ? [] : literalOf(text);
      if (!Array.isArray(keys)) {
        this.reject(statement.from, "outsideVocabulary");
        return undefined;
      }
      return { valueType: "string[]", defaultValue: keys };
    }
    if (text === "null") return { valueType: "object", defaultValue: null };
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
    const nodeAnchors = baseline.anchors
      .map((anchor, index) => ({ anchor, outcome: this.outcomes[index]! }))
      .filter((item) => item.anchor.target.kind === "node");
    const units: CodeViewIdentityUnit[] = nodeAnchors.map(
      ({ anchor, outcome }) => {
        const id = (anchor.target as { nodeId: string }).nodeId;
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
          ...(parent
            ? { parentId: (parent.anchor.target as { nodeId: string }).nodeId }
            : {}),
          type:
            /^\{?[\w$]+ && <([\w$.]+)|^<([\w$.]+)/
              .exec(this.code(anchor))
              ?.slice(1)
              .find(Boolean) ?? "",
          code: this.code(anchor),
          state: stateOf(reader, node),
          outcome,
        };
      },
    );
    const identity = codeViewMatchElements(
      units,
      this.parsed.jsx!.roots,
      this.input.edited,
    );
    for (const span of identity.ambiguous)
      this.reject(span.from, "ambiguousIdentity");
    for (const element of identity.added) this.added.add(element);

    // Removed elements (with what reads them — decision 3).
    if (identity.removed.length)
      this.step(
        0,
        removeTargets({
          targets: identity.removed.map((id) => ({
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
      const type = element.type === "div" ? "frame" : element.type;
      const definitionId = catalogPaletteDefinitionId(reader.library, type);
      if (!reader.library.definitions.has(definitionId)) {
        this.reject(element.from, "unknownTag", element.type);
        continue;
      }
      ids.set(element, this.input.newId("node"));
    }

    // Structure: each parent's children as the code lists them (places · moves · inserts).
    const placeChildren = (
      parentId: string,
      children: readonly CodeViewElement[],
      from: number,
    ) => {
      const wanted = children
        .map((child) => ids.get(child))
        .filter((id): id is string => !!id);
      // (Already so — the removals aside: nothing to arrange.)
      const now = (
        reader.getEntry(parentId) as NodeEntry | PageEntry | undefined
      )?.children.filter((id) => !removed.has(id));
      if (now && JSON.stringify(now) === JSON.stringify(wanted)) return;
      this.step(from, (stageReader) => {
        const stage = stageOver(stageReader);
        const ops: CatalogCommandPlan["ops"][number][] = [];
        wanted.forEach((id, index) => {
          const current = (
            stage.getEntry(parentId) as NodeEntry | PageEntry | undefined
          )?.children;
          if (current?.[index] === id) return;
          const element = children.find((child) => ids.get(child) === id)!;
          const plan = this.added.has(element)
            ? insertNodes({
                parent: { kind: "node", id: parentId as NodeId },
                index,
                entries: this.entriesOf(element, ids),
                rootIds: [id as NodeId],
                newId: this.input.newId,
                label: "Add element",
              })(stage)
            : moveNodes({
                ids: [id as NodeId],
                parent: { kind: "node", id: parentId as NodeId },
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
    const visit = (
      parentId: string,
      children: readonly CodeViewElement[],
      from: number,
    ) => {
      placeChildren(parentId, children, from);
      for (const child of children) {
        const id = ids.get(child);
        if (!id) continue;
        if (!this.added.has(child)) this.planAttributes(child, id);
        else this.planNewHandlers(child, id);
        // (A new element's subtree goes in with it; a list's rows are its binding's.)
        if (!this.added.has(child) && !child.rows)
          visit(id, child.children, child.from);
      }
    };
    if (body) visit(body.id, this.parsed.jsx!.roots, this.parsed.jsx!.from);
    else this.reject(this.parsed.jsx!.from, "notInCode");
  }

  /** A new element and its new subtree as entries (the palette's origin · decision 1). */
  private entriesOf(
    element: CodeViewElement,
    ids: ReadonlyMap<CodeViewElement, string>,
  ): NodeEntry[] {
    const type = element.type === "div" ? "frame" : element.type;
    const library = this.reader.library;
    const definitionId = catalogPaletteDefinitionId(library, type);
    const props = catalogCreationProps(library, definitionId, type);
    for (const attribute of element.attributes) {
      if (/^on[A-Z]/.test(attribute.name)) continue;
      const value = this.propValue(attribute);
      if (value !== undefined)
        props[attribute.name] = { kind: "set", value } as never;
    }
    const text = element.text
      ? this.textValue(element.text.code, element.text.from)
      : undefined;
    if (text !== undefined)
      props.children = { kind: "set", value: text } as never;
    const children = element.children.flatMap((child) =>
      this.entriesOf(child, ids),
    );
    return [
      {
        kind: "node",
        id: ids.get(element) as NodeId,
        definitionId,
        children: element.children.map((child) => ids.get(child) as NodeId),
        props: props as NodeEntry["props"],
        visual: {},
        sizing: {},
        descendantOverrides: [],
      } as NodeEntry,
      ...children,
    ];
  }

  /** A new element's handlers (and its new subtree's) — rules on the node it becomes. */
  private planNewHandlers(element: CodeViewElement, id: string): void {
    const handlers = new Map(
      element.attributes
        .filter((attribute) => /^on[A-Z]/.test(attribute.name))
        .map((attribute) => [attribute.name, attribute] as const),
    );
    const type =
      element.type === "div"
        ? "frame"
        : definitionTypeName(
            this.reader,
            catalogPaletteDefinitionId(this.reader.library, element.type),
          );
    if (handlers.size)
      this.planHandlers(element, { id: id as NodeId }, type, handlers);
    for (const child of element.children) {
      const childId = this.ids?.get(child);
      if (childId) this.planNewHandlers(child, childId);
    }
  }
  private ids?: ReadonlyMap<CodeViewElement, string>;

  /** A kept element's attributes · text against the baseline's (only what changed). */
  private planAttributes(element: CodeViewElement, id: string): void {
    const node = this.reader.getEntry(id) as NodeEntry;
    const type = definitionTypeName(this.reader, node.definitionId);
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
    for (const attribute of element.attributes) {
      const old = before.find((anchor) => nameOf(anchor) === attribute.name);
      if (
        old &&
        !this.input.strict &&
        codeViewNormalized(this.code(old)) ===
          codeViewNormalized(
            this.input.edited.slice(attribute.from, attribute.to),
          )
      )
        continue;
      const source = old
        ? (old.target as { source: string }).source
        : undefined;
      if (source === "handler" || (!old && /^on[A-Z]/.test(attribute.name))) {
        handlers.set(attribute.name, attribute);
        continue;
      }
      if (source && source !== "prop") continue; // (the regenerated code tells)
      const value = this.propValue(attribute);
      if (value !== undefined) props[attribute.name] = { kind: "set", value };
    }
    for (const anchor of before) {
      if (
        element.attributes.some(
          (attribute) => attribute.name === nameOf(anchor),
        )
      )
        continue;
      const source = (anchor.target as { source: string }).source;
      if (source === "prop") props[nameOf(anchor)] = { kind: "remove" };
      else if (source === "handler") handlers.set(nameOf(anchor), undefined);
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
        const value = this.textValue(newText.code, newText.from);
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
    if (element.attributes.some((item) => item.name === "items"))
      this.planItems(element, node);
  }

  /* ── values ── */

  /** A prop's code → its document value (`propCode`'s inverse); undefined = refused. */
  private propValue(attribute: CodeViewAttribute): unknown {
    const value = attribute.value;
    if (!value) return true;
    if (value.kind === "string") return value.code.replace(/\\(.)/g, "$1");
    const text = value.code.trim();
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
    this.reject(value.from, "outsideVocabulary");
    return undefined;
  }

  /** An element's text → its `children` (plain text · a template of variables). */
  private textValue(code: string, from: number): string | undefined {
    const template = /^\{`([\s\S]*)`\}$/.exec(code.trim());
    if (!template) {
      if (/[{}]/.test(code)) {
        this.reject(from, "outsideVocabulary");
        return undefined;
      }
      return code.trim();
    }
    let failed = false;
    const text = template[1]!.replace(/\$\{([^}]*)\}/g, (_, inner: string) => {
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

  private planHandlers(
    element: CodeViewElement,
    node: { readonly id: NodeId },
    type: string,
    handlers: ReadonlyMap<string, CodeViewAttribute | undefined>,
  ): void {
    const triggers = resolveTriggers(type);
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
    for (const [trigger, attribute] of handlers) {
      if (!attribute) continue;
      if (!triggers.includes(trigger)) {
        this.reject(attribute.from, "outsideVocabulary", trigger);
        continue;
      }
      const actions = this.actionsOf(trigger, attribute);
      if (!actions) continue;
      const kept = rules.find((rule) => rule.trigger === trigger);
      next.push({
        kind: "interaction",
        id:
          kept?.id ??
          (this.input.newId("interaction") as EntryId<"interaction">),
        ownerId: node.id,
        trigger,
        actions,
      } as InteractionEntry);
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

  /** A handler's code → its Do list (`handlerCode` · `writeAction`'s inverse, the common Dos). */
  private actionsOf(
    trigger: string,
    attribute: CodeViewAttribute,
  ): InteractionAction[] | undefined {
    const code =
      attribute.value?.kind === "expression" ? attribute.value.code.trim() : "";
    const args = eventArgNames(trigger)[0] ?? [];
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
    const valueOf = (raw: string): unknown => {
      const text = raw.trim();
      const index = params.indexOf(text.split(".")[0]!);
      if (index >= 0)
        return [
          `!event.${args[index] ?? text.split(".")[0]}`,
          ...text.split(".").slice(1),
        ].join(".");
      const [name, ...path] = text.split(".");
      if (IDENTIFIER.test(name!) && this.variables.has(name!))
        return [`!var.${this.variables.get(name!)}`, ...path].join(".");
      return literalOf(text);
    };
    const actions: InteractionAction[] = [];
    for (const raw of arrow[3]!
      .split(/;\s*\n/)
      .map((line) => line.trim().replace(/;$/, ""))
      .filter(Boolean)) {
      const set = /^(set[A-Z][\w$]*)\(([\s\S]*)\)$/.exec(raw);
      const toast = /^toasts\.add\(\{title: ('(?:[^'\\]|\\.)*')\}\)$/.exec(raw);
      const go = /^navigate\(('(?:[^'\\]|\\.)*')\)$/.exec(raw);
      if (set) {
        const variableId = setter(set[1]!);
        const body = set[2]!.trim();
        if (!variableId) {
          this.reject(attribute.from, "unknownReference", set[1]);
          return undefined;
        }
        if (body === "v => !v") {
          actions.push({
            opcode: "setState",
            variableId,
            op: "toggle",
          } as InteractionAction);
          continue;
        }
        const increment = /^v => v \+ (-?\d+(?:\.\d+)?)$/.exec(body);
        if (increment) {
          actions.push({
            opcode: "setState",
            variableId,
            op: "increment",
            value: Number(increment[1]),
          } as InteractionAction);
          continue;
        }
        const value = valueOf(body);
        if (value === undefined) {
          this.reject(attribute.from, "outsideVocabulary");
          return undefined;
        }
        actions.push({
          opcode: "setState",
          variableId,
          op: "set",
          value,
        } as InteractionAction);
        continue;
      }
      if (toast) {
        actions.push({
          opcode: "toast",
          message: literalOf(toast[1]!),
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
          this.reject(attribute.from, "unknownReference", String(route));
          return undefined;
        }
        actions.push({ opcode: "navigate", pageId } as InteractionAction);
        continue;
      }
      this.reject(attribute.from, "outsideVocabulary");
      return undefined;
    }
    return actions;
  }

  /* ── a list's rows (`items={…}`) and its view's `filter` terms ── */

  private planItems(element: CodeViewElement, node: NodeEntry): void {
    const binding = node.binding;
    const attribute = element.attributes.find((item) => item.name === "items")!;
    const name =
      attribute.value?.kind === "expression" ? attribute.value.code.trim() : "";
    if (!binding) {
      this.reject(attribute.from, "notInCode");
      return;
    }
    const statement = this.parsed.statements.find(
      (item) => item.kind === "view" && item.name === name,
    );
    const rows = new Set(
      [
        binding.collectionId,
        binding.collectionId.replace(/^data:collection:/, ""),
      ].flatMap((id) => {
        const collection = this.input.data.collections.find(
          (item) => `data:collection:${item.id}` === id || item.id === id,
        );
        return collection
          ? [codeName(collection.name), `${codeName(collection.name)}.items`]
          : [];
      }),
    );
    // `items={users}` — no view.
    if (rows.has(name)) {
      if (binding.view && !binding.viewId)
        this.step(
          attribute.from,
          catalogBindingCommand([{ kind: "node", id: node.id }], {
            ...binding,
            view: undefined,
          } as never),
        );
      return;
    }
    if (!statement || binding.viewId) return; // (unchanged — or the regenerated code tells)
    // (The view's statement as the baseline wrote it: nothing to read.)
    const before = this.baseline.anchors.find(
      (anchor) =>
        anchor.target.kind === "view" &&
        "nodeId" in anchor.target.owner &&
        anchor.target.owner.nodeId === node.id,
    );
    if (
      before &&
      !this.input.strict &&
      codeViewNormalized(this.code(before)) ===
        codeViewNormalized(statement.code)
    )
      return;
    const view = this.viewOf(
      statement,
      rows,
      binding.collectionId,
      binding.view,
    );
    if (!view) return;
    if (JSON.stringify(view) === JSON.stringify(binding.view)) return;
    this.step(
      statement.from,
      catalogBindingCommand([{ kind: "node", id: node.id }], {
        ...binding,
        view,
      }),
    );
  }

  /** `let x = rows.filter(item => …)` → a built-in view (its conditions' ids kept where equal). */
  private viewOf(
    statement: CodeViewStatement,
    rows: ReadonlySet<string>,
    collectionId: string,
    current: ViewQuery | undefined,
  ): ViewQuery | undefined {
    const m =
      /^let [\w$]+ = ([\w$.]+)(?:\s*\.filter\(item =>\s*([\s\S]*)\))?;$/.exec(
        statement.code,
      );
    if (!m || !rows.has(m[1]!)) {
      this.reject(statement.from, "outsideVocabulary", m?.[1]);
      return undefined;
    }
    const existing = new Map<string, ViewCondition>();
    const collect = (group: ViewConditionGroup | undefined) =>
      group?.items.forEach((item) =>
        "items" in item ? collect(item) : existing.set(item.id, item),
      );
    collect(current?.where);
    const symbols = {
      variables: Object.fromEntries(this.variables),
      fields: this.baseline.symbols.fields,
    };
    const items: (ViewCondition | ViewConditionGroup)[] = [];
    for (const term of m[2] ? splitTop(m[2], "&&") : []) {
      const condition = this.conditionOf(term.trim(), symbols, collectionId);
      if (!condition) {
        this.reject(statement.from, "outsideVocabulary", term.trim());
        return undefined;
      }
      const same = [...existing.values()].find(
        (item) =>
          JSON.stringify({ ...item, id: "" }) ===
          JSON.stringify({ ...condition, id: "" }),
      );
      items.push(same ?? condition);
      if (same) existing.delete(same.id);
    }
    return {
      ...(current ?? {}),
      where: { id: current?.where.id ?? "where", op: "and", items },
    };
  }

  /** One `filter` term (with its skip guard) → a condition. */
  private conditionOf(
    term: string,
    symbols: {
      variables: Record<string, string>;
      fields: CodeViewResult["symbols"]["fields"];
    },
    collectionId: string,
  ): ViewCondition | undefined {
    let text = term;
    let skip: ViewCondition["skip"];
    let enabled: ViewCondition["enabled"];
    const guarded = /^\(([\s\S]*)\)$/.exec(text);
    if (guarded) {
      const parts = splitTop(guarded[1]!, "||").map((part) => part.trim());
      if (parts.length > 1) {
        const inner = parts.at(-1)!;
        const prefix = parts.slice(0, -1);
        const flag = prefix[0]?.startsWith("!")
          ? prefix.shift()!.slice(1)
          : undefined;
        if (flag) {
          const id = symbols.variables[flag];
          if (!id) return undefined;
          enabled = `!var.${id}`;
        }
        const literal =
          prefix.length === 1 ? /=== (.+)$/.exec(prefix[0]!)?.[1] : undefined;
        if (literal && literal !== "''" && literal !== "null")
          skip = literalOf(literal) as ViewCondition["skip"];
        text = inner;
      }
    }
    const read = termOf(text, { symbols } as never, collectionId);
    if (!read) return undefined;
    return {
      id: `code-${this.input.newId("node").slice(-8)}`,
      ...read,
      ...(skip !== undefined ? { skip } : {}),
      ...(enabled !== undefined ? { enabled } : {}),
    } as ViewCondition;
  }
}

/** The name the generator gives a collection's rows (`identifier`). */
function codeName(raw: string): string {
  const words = raw
    .replace(/[^A-Za-z0-9_$\s-]/g, " ")
    .split(/[\s_-]+/)
    .filter(Boolean);
  let name = words
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toLowerCase() + word.slice(1)
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join("");
  if (!name) name = "rows";
  if (/^[0-9]/.test(name)) name = `_${name}`;
  return name;
}

/** Split at a top-level operator (outside parentheses · brackets · strings). */
function splitTop(code: string, op: "&&" | "||"): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let index = 0; index < code.length; index += 1) {
    const char = code[index]!;
    if (quote) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) depth -= 1;
    else if (depth === 0 && code.startsWith(op, index)) {
      parts.push(code.slice(start, index));
      start = index + op.length;
      index += op.length - 1;
    }
  }
  parts.push(code.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
}

/** What a node holds that its code does not show — equal states are indistinguishable. */
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

function compareRegenerated(
  edited: CodeViewParsed,
  regenerated: CodeViewParsed,
  baseline: CodeViewParsed,
  planner: Planner,
  reject: Reject,
): void {
  // Statements: each written one comes back (in any order); a derived one the edit did not
  // write is the document's to add — any other the edit did not write is not what it wrote.
  const pool = [...regenerated.statements];
  for (const statement of edited.statements) {
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
  if (pool.some((item) => !DERIVED_KINDS.has(item.kind)))
    reject(edited.component?.from ?? 0, "outsideVocabulary");
  // Elements: the same tree, each written attribute · text as written (a new element may gain
  // its palette defaults).
  const compare = (
    a: readonly CodeViewElement[],
    b: readonly CodeViewElement[],
    parentFrom: number,
  ) => {
    if (a.length !== b.length) {
      const extra = a[b.length] ?? a.at(-1);
      reject(extra?.from ?? parentFrom, "notInCode");
      return;
    }
    a.forEach((element, index) => {
      const other = b[index]!;
      const fresh = planner.added.has(element);
      if (
        element.type !== other.type ||
        element.visibleState !== other.visibleState
      ) {
        reject(element.from, "notInCode");
        return;
      }
      for (const attribute of element.attributes) {
        const twin = other.attributes.find(
          (item) => item.name === attribute.name,
        );
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
          if (!element.attributes.some((item) => item.name === twin.name))
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
      compare(element.children, other.children, element.from);
    });
  };
  compare(
    edited.jsx?.roots ?? [],
    regenerated.jsx?.roots ?? [],
    edited.jsx?.from ?? 0,
  );
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
