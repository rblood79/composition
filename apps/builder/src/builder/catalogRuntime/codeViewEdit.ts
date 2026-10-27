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
import { literalOf } from "../../../../../packages/shared/src/codeView/inverse";
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
  eventArgsAreFields,
  resolveCapabilities,
  resolveTriggers,
} from "../../../../../packages/shared/src/interactions/capabilityRegistry";
import { conceptStateOf } from "../../../../../packages/shared/src/interactions/conceptState";
import type { catalogCodeViewData } from "./codeView";
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
    this.planSelections();
    this.planDragAndDrop();
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
      if (!this.input.strict && baseline.has(codeViewNormalized(statement.code)))
        continue;
      const element = this.findElement(
        (item) =>
          item.attributes.find((a) => a.name === "dragAndDropHooks")?.value
            ?.code.trim() === statement.name,
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
            ownerId: this.page.id,
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
    const statements = this.parsed.statements.filter(
      (item) => item.kind === "state" || item.kind === "listSelection",
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
      const selection = (type: string) => type === "array" || type === "string[]";
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
    if (statement.kind === "listSelection")
      return { valueType: "string[]", defaultValue: [] };
    const m = /= useState(?:<(Selection|SortDescriptor)>)?\(([\s\S]*)\);$/.exec(
      statement.code,
    );
    if (!m) {
      this.reject(statement.from, "outsideVocabulary");
      return undefined;
    }
    const [, type, raw = ""] = m;
    const text = raw.trim();
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
    // (Their entries now — reading their text is planning: a row read names the view to bind.)
    const entries = new Map<CodeViewElement, NodeEntry[]>();
    for (const element of identity.added)
      if (ids.has(element)) entries.set(element, this.entriesOf(element, ids));

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
                entries: entries.get(element)!,
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
    const sorted = this.sortControlled(
      element,
      definitionTypeName(this.reader, definitionId),
    );
    for (const attribute of element.attributes) {
      if (
        /^on[A-Z]/.test(attribute.name) ||
        attribute.name === "items" ||
        sorted.has(attribute.name) ||
        this.selectionOwned(attribute)
      )
        continue;
      const value = this.propValue(attribute);
      if (value !== undefined)
        props[attribute.name] = { kind: "set", value } as never;
    }
    const text = element.text
      ? this.textValue(element.text.code, element.text.from, element)
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
    const sorted = this.sortControlled(element, type);
    for (const attribute of element.attributes) {
      const old = before.find((anchor) => nameOf(anchor) === attribute.name);
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
        const value = this.textValue(newText.code, newText.from, element);
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

  /** A prop that is a comparison of a variable (`propWhen`'s inverse — 「값 조건」). */
  private whenOf(text: string): Record<string, unknown> | undefined {
    const id = (name: string) => this.variables.get(name);
    const empty = /^([\w$]+) !== 'all' && \1\.size === 0$/.exec(text);
    if (empty && id(empty[1]!))
      return { kind: "when", subject: `!var.${id(empty[1]!)}`, op: "notExists" };
    const some = /^\(([\w$]+) === 'all' \|\| \1\.size > 0\)$/.exec(text);
    if (some && id(some[1]!))
      return { kind: "when", subject: `!var.${id(some[1]!)}`, op: "exists" };
    const size = /^([\w$]+) !== 'all' && \1\.size (===|!==|>=|>|<=|<) (.+)$/.exec(text);
    const plain = /^([\w$]+)((?:\.[\w$]+)*) (===|!==|>=|>|<=|<) (.+)$/.exec(text);
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

  /**
   * A handler's code → its Do list (`handlerCode` · `writeAction`'s inverse): Set state (a value ·
   * toggle · increment · an event's keys), toast, navigate, a list's commands (`update` · `move…` ·
   * `remove…` · `insert…` · `append` · `prepend` · `reload` · `loadMore` · `setFilterText`) and an
   * endpoint call (`await fetch`).
   */
  private actionsOf(
    trigger: string,
    attribute: CodeViewAttribute,
  ): InteractionAction[] | undefined {
    const code =
      attribute.value?.kind === "expression" ? attribute.value.code.trim() : "";
    const args = eventArgNames(trigger)[0] ?? [];
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
    return this.dosOf(arrow[3]!, attribute.from, { trigger, args, fields, params });
  }

  /** A setter call on a node's named state → that node's capability (undefined = not one). */
  private capabilityOf(
    variableId: string,
    next: string,
    valueOf: (raw: string) => unknown,
  ): InteractionAction | undefined {
    const entry = this.reader.getEntry(variableId) as
      | StateVariableEntry
      | undefined;
    const source = entry?.source;
    const node = source ? this.reader.getEntry(source.nodeId) : undefined;
    if (!source || node?.kind !== "node") return undefined;
    const defs = Object.entries(
      resolveCapabilities(definitionTypeName(this.reader, node.definitionId)),
    ).filter(([, def]) => !def.imperative && def.prop === source.prop);
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
  private dosOf(
    body: string,
    from: number,
    context: {
      trigger: string;
      args: readonly string[];
      fields: boolean;
      params: readonly string[];
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
        return [`!item.${event.slice(7)}`, ...(items[2] ? [items[2]] : [])].join(
          ".",
        );
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
    const lines = body
      .split(/;\s*\n/)
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
      const toast = /^toasts\.add\(\{title: ('(?:[^'\\]|\\.)*')\}\)$/.exec(raw);
      const go = /^navigate\(('(?:[^'\\]|\\.)*')\)$/.exec(raw);
      const list = /^([\w$]+)\.(\w+)\(([\s\S]*)\)$/.exec(raw);
      const each =
        /^for \(let id of (.+?)\) ([\w$]+)\.update\(id, \{\.\.\.\2\.getItem\(id\), ([\w$]+): ([\s\S]+)\}\)$/.exec(
          raw,
        );
      const side =
        /^if \((.+) === 'before'\) ([\w$]+)\.moveBefore\((.+?), (.+)\)$/.exec(raw);
      const fetchCall =
        /^await fetch\(('(?:[^'\\]|\\.)*'), \{method: ('[A-Z]+')(?:, body: JSON\.stringify\(([\s\S]+)\))?\}\)$/.exec(
          raw,
        );
      if (set) {
        const variableId = setter(set[1]!);
        const value = set[2]!.trim();
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
          actions.push({ opcode: "setState", variableId, op: "toggle" } as InteractionAction);
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
          .find(
            (item) =>
              item.kind === "state" && item.setter === set[1],
          )
          ?.code.match(/useState(?:<\w+>)?\(([\s\S]*)\);$/)?.[1]
          ?.trim();
        if (start !== undefined && start === value) {
          actions.push({ opcode: "setState", variableId, op: "reset" } as InteractionAction);
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
        actions.push({ opcode: "toast", message: literalOf(toast[1]!) } as InteractionAction);
        continue;
      }
      if (go) {
        const route = literalOf(go[1]!);
        const project = this.reader.getEntry(this.reader.projectId) as ProjectEntry;
        const pageId = project.pageIds.find(
          (pageId) =>
            (this.reader.getEntry(pageId) as PageEntry | undefined)?.route === route,
        );
        if (!pageId) {
          this.reject(from, "unknownReference", String(route));
          return undefined;
        }
        actions.push({ opcode: "navigate", pageId } as InteractionAction);
        continue;
      }
      if (fetchCall) {
        const url = literalOf(fetchCall[1]!);
        const endpoint = this.input.data.endpoints.find(
          (item) => item.url === url,
        );
        if (!endpoint) {
          this.reject(from, "unknownReference", String(url));
          return undefined;
        }
        actions.push({
          opcode: "callEndpoint",
          endpointId: `data:endpoint:${endpoint.id}`,
          ...(fetchCall[3] !== undefined ? { body: valueOf(fetchCall[3]) } : {}),
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
        if (["reload", "loadMore", "removeSelectedItems"].includes(method) && !parts.length)
          action = { opcode: method, collectionId } as never;
        else if (["append", "prepend", "setFilterText"].includes(method) && parts.length === 1)
          action = one("value", parts[0]!);
        else if (method === "remove" && parts.length === 1 && parts[0]!.startsWith("..."))
          action = one("keys", parts[0]!.slice(3));
        else if (method === "insert" && parts.length === 2)
          action = {
            opcode: "insert",
            collectionId,
            index: valueOf(parts[0]!),
            value: valueOf(parts[1]!),
          } as never;
        else if (["insertBefore", "insertAfter"].includes(method) && parts.length === 2)
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
        else if (["moveBefore", "moveAfter"].includes(method) && parts.length === 2)
          action = {
            opcode: method,
            collectionId,
            key: valueOf(parts[0]!),
            keys: valueOf(parts[1]!),
          } as never;
        else if (method === "update" && parts.length === 2) {
          const patch = /^\{\.\.\.[\w$]+\.getItem\((.+?)\), ([\w$]+): ([\s\S]+)\}$/.exec(
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
