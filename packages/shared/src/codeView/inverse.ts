/**
 * ADR-284 Phase 6 — the code view's inverse map: an edited copy of the generated code back to
 * document edits, only through the 1:1 positions (slots — Decision 9 · 연구 §8.5). The code is not
 * parsed as a program: the generated text around the slots must stay as it was; each slot's new
 * text is read by its kind (a variable's name · default, a `filter` term, a sort field, a handler's
 * When). A change outside a slot, or a slot text the kind does not read, is reported by line and
 * applies nothing — 「문서로 환원되지 않는 코드」.
 */
import type {
  DataFieldPath,
  ViewComparison,
  ViewConditionValue,
} from "../catalog/document/types";
import type { CodeViewResult, CodeViewSlot, CodeViewViewOwner } from "./types";

export type CodeViewEdit =
  | {
      readonly kind: "renameVariable";
      readonly variableId: string;
      readonly name: string;
    }
  | {
      readonly kind: "variableDefault";
      readonly variableId: string;
      readonly value: string | number | boolean | readonly string[];
    }
  | {
      readonly kind: "condition";
      readonly owner: CodeViewViewOwner;
      readonly conditionId: string;
      readonly fields: readonly DataFieldPath[];
      readonly op: ViewComparison;
      readonly value?: ViewConditionValue;
    }
  | {
      readonly kind: "sortField";
      readonly owner: CodeViewViewOwner;
      readonly field: DataFieldPath;
    }
  | {
      readonly kind: "trigger";
      readonly interactionIds: readonly string[];
      readonly trigger: string;
    };

export interface CodeViewRejection {
  /** 1-based line of the edited code. */
  readonly line: number;
  readonly reason: "outsideSlot" | "unreadable";
  readonly text: string;
}

export interface CodeViewInverse {
  readonly edits: readonly CodeViewEdit[];
  readonly rejected: readonly CodeViewRejection[];
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const lineAt = (text: string, offset: number) =>
  text.slice(0, Math.max(0, offset)).split("\n").length;

/**
 * The edits an edited copy of `result.code` makes. `triggers(ownerType)` lists the Whens a
 * handler slot may name (the registry's events of the owner's type).
 */
export function codeViewInverse(
  result: CodeViewResult,
  edited: string,
  triggers: (ownerType: string) => readonly string[],
): CodeViewInverse {
  if (edited === result.code) return { edits: [], rejected: [] };
  // The generated text with every slot a capture (a slot is one line's part).
  let pattern = "^";
  let at = 0;
  for (const slot of result.slots) {
    pattern += escape(result.code.slice(at, slot.start));
    pattern += "([^\\n]*?)";
    at = slot.end;
  }
  pattern += `${escape(result.code.slice(at))}$`;
  const match = new RegExp(pattern, "d").exec(edited);
  if (!match) {
    // Outside the slots: the first and last lines that differ.
    let start = 0;
    while (start < edited.length && edited[start] === result.code[start])
      start += 1;
    let tail = 0;
    while (
      tail < edited.length - start &&
      edited[edited.length - 1 - tail] ===
        result.code[result.code.length - 1 - tail]
    )
      tail += 1;
    const from = lineAt(edited, start);
    const to = lineAt(edited, edited.length - tail);
    const lines = edited.split("\n").slice(from - 1, to);
    return {
      edits: [],
      rejected: lines.map((text, index) => ({
        line: from + index,
        reason: "outsideSlot",
        text,
      })),
    };
  }
  const edits: CodeViewEdit[] = [];
  const rejected: CodeViewRejection[] = [];
  result.slots.forEach((slot, index) => {
    const text = match[index + 1]!;
    if (text === slot.text) return;
    const start = match.indices?.[index + 1]?.[0] ?? 0;
    const edit = readSlot(slot, text.trim(), result, triggers);
    if (edit) edits.push(edit);
    else
      rejected.push({
        line: lineAt(edited, start),
        reason: "unreadable",
        text,
      });
  });
  return { edits, rejected };
}

function readSlot(
  slot: CodeViewSlot,
  text: string,
  result: CodeViewResult,
  triggers: (ownerType: string) => readonly string[],
): CodeViewEdit | undefined {
  const target = slot.target;
  switch (target.kind) {
    case "variableName":
      return IDENTIFIER.test(text)
        ? { kind: "renameVariable", variableId: target.variableId, name: text }
        : undefined;
    case "variableDefault": {
      const value = literalOf(text);
      return value === undefined
        ? undefined
        : { kind: "variableDefault", variableId: target.variableId, value };
    }
    case "trigger":
      return triggers(target.ownerType).includes(text)
        ? {
            kind: "trigger",
            interactionIds: target.interactionIds,
            trigger: text,
          }
        : undefined;
    case "sortField": {
      const id = result.symbols.fields[target.collectionId]?.[text];
      return id
        ? {
            kind: "sortField",
            owner: target.owner,
            field: [id as DataFieldPath[number]],
          }
        : undefined;
    }
    case "condition": {
      const term = target.suffixes
        ? paramOf(text, result, target.collectionId, target.suffixes)
        : termOf(text, result, target.collectionId);
      return term
        ? {
            kind: "condition",
            owner: target.owner,
            conditionId: target.conditionId,
            ...term,
          }
        : undefined;
    }
  }
}

/** A JS literal the generator writes for a default: `'text'` · a number · a boolean · a key set. */
export function literalOf(
  text: string,
): string | number | boolean | readonly string[] | undefined {
  const quoted = /^'((?:[^'\\]|\\.)*)'$|^"((?:[^"\\]|\\.)*)"$/.exec(text);
  if (quoted) return (quoted[1] ?? quoted[2]!).replace(/\\(.)/g, "$1");
  if (text === "true" || text === "false") return text === "true";
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  const set = /^new Set\((?:\[(.*)\])?\)$/.exec(text);
  if (set) {
    const items = (set[1] ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const keys = items.map((item) => literalOf(item));
    return keys.every((key) => typeof key === "string")
      ? (keys as string[])
      : undefined;
  }
  return undefined;
}

/**
 * A JSON value as the generator writes it for a structured default (`{count: 1}` · `[1, 1, 2]` ·
 * `{'a-b': 'x', list: [true, null]}`) — objects, arrays, quoted text, numbers, booleans, `null`.
 * Undefined when the text is anything else (an expression, a call, an identifier).
 */
export function structuredLiteralOf(
  text: string,
): { value: unknown } | undefined {
  let at = 0;
  const space = () => {
    while (at < text.length && /\s/.test(text[at]!)) at += 1;
  };
  const fail = Symbol("fail");
  const quoted = (): string | typeof fail => {
    const m = /^'((?:[^'\\]|\\.)*)'|^"((?:[^"\\]|\\.)*)"/.exec(text.slice(at));
    if (!m) return fail;
    at += m[0].length;
    return (m[1] ?? m[2]!).replace(/\\(.)/g, "$1");
  };
  const value = (): unknown => {
    space();
    const ch = text[at];
    if (ch === "'" || ch === '"') return quoted();
    if (ch === "[") {
      at += 1;
      const items: unknown[] = [];
      for (;;) {
        space();
        if (text[at] === "]") {
          at += 1;
          return items;
        }
        const item = value();
        if (item === fail) return fail;
        items.push(item);
        space();
        if (text[at] === ",") at += 1;
        else if (text[at] !== "]") return fail;
      }
    }
    if (ch === "{") {
      at += 1;
      const out: Record<string, unknown> = {};
      for (;;) {
        space();
        if (text[at] === "}") {
          at += 1;
          return out;
        }
        let key: string | typeof fail;
        if (text[at] === "'" || text[at] === '"') key = quoted();
        else {
          const m = /^[A-Za-z_$][\w$]*/.exec(text.slice(at));
          if (!m) return fail;
          at += m[0].length;
          key = m[0];
        }
        if (key === fail) return fail;
        space();
        if (text[at] !== ":") return fail;
        at += 1;
        const item = value();
        if (item === fail) return fail;
        out[key] = item;
        space();
        if (text[at] === ",") at += 1;
        else if (text[at] !== "}") return fail;
      }
    }
    const word = /^(?:true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
      text.slice(at),
    );
    if (!word) return fail;
    at += word[0].length;
    return word[0] === "true"
      ? true
      : word[0] === "false"
        ? false
        : word[0] === "null"
          ? null
          : Number(word[0]);
  };
  const result = value();
  space();
  return result === fail || at !== text.length ? undefined : { value: result };
}

/** The comparisons a parameter suffix names, in the table's order (`_gt` = greater than first). */
const PARAM_ORDER: readonly ViewComparison[] = [
  "equals",
  "notEquals",
  "contains",
  "gte",
  "gt",
  "lte",
  "lt",
  "after",
  "before",
];

/**
 * A request parameter the generator writes (`'gender_ne', String(gender)`) → its field, the
 * comparison its suffix names and the value — the longest suffix that leaves a field key wins.
 */
function paramOf(
  text: string,
  result: CodeViewResult,
  collectionId: string,
  suffixes: Readonly<Partial<Record<ViewComparison, string>>>,
):
  | { fields: DataFieldPath[]; op: ViewComparison; value?: ViewConditionValue }
  | undefined {
  const m = /^'([^']+)', (.+)$/.exec(text);
  if (!m) return undefined;
  const fields = result.symbols.fields[collectionId] ?? {};
  const candidates = PARAM_ORDER.flatMap((op) => {
    const suffix = suffixes[op];
    if (suffix === undefined || !m[1]!.endsWith(suffix)) return [];
    const key = m[1]!.slice(0, m[1]!.length - suffix.length);
    return fields[key] ? [{ op, key, length: suffix.length }] : [];
  }).sort((a, b) => b.length - a.length);
  const found = candidates[0];
  if (!found) return undefined;
  const raw = m[2]!.trim();
  const inner = /^String\((.+)\)$/.exec(raw)?.[1] ?? raw;
  let value: ViewConditionValue | undefined;
  if (IDENTIFIER.test(inner) && result.symbols.variables[inner])
    value = `!var.${result.symbols.variables[inner]}`;
  else {
    const literal = literalOf(inner);
    if (
      typeof literal === "string" ||
      typeof literal === "number" ||
      typeof literal === "boolean"
    )
      value = literal;
  }
  if (value === undefined) return undefined;
  return {
    fields: [[fields[found.key]! as DataFieldPath[number]]],
    op: found.op,
    value,
  };
}

/** A `filter` term the generator writes → its field(s), comparison and value. */
export function termOf(
  text: string,
  result: Pick<CodeViewResult, "symbols">,
  collectionId: string,
):
  | { fields: DataFieldPath[]; op: ViewComparison; value?: ViewConditionValue }
  | undefined {
  const fieldOf = (key: string): DataFieldPath | undefined => {
    const fields = result.symbols.fields[collectionId] ?? {};
    const id = fields[key];
    return id ? [id as DataFieldPath[number]] : undefined;
  };
  const valueOf = (raw: string): ViewConditionValue | undefined => {
    const value = raw.trim();
    if (IDENTIFIER.test(value) && result.symbols.variables[value])
      return `!var.${result.symbols.variables[value]}`;
    const list = /^\[(.*)\]$/.exec(value);
    if (list) {
      const items = list[1]!.split(",").map((item) => literalOf(item.trim()));
      return items.every(
        (item) => typeof item === "string" || typeof item === "number",
      )
        ? (items as (string | number)[])
        : undefined;
    }
    const literal = literalOf(value);
    return typeof literal === "string" ||
      typeof literal === "number" ||
      typeof literal === "boolean"
      ? literal
      : undefined;
  };
  // (a || b) — the same comparison over several fields.
  const or = /^\((.+)\)$/.exec(text);
  if (or && / \|\| /.test(or[1]!)) {
    const parts = or[1]!
      .split(" || ")
      .map((part) => termOf(part, result, collectionId));
    if (
      parts.every(Boolean) &&
      parts.every((part) => part!.op === parts[0]!.op)
    ) {
      return { ...parts[0]!, fields: parts.flatMap((part) => part!.fields) };
    }
  }
  const field = String.raw`item\.([A-Za-z_$][\w$]*)`;
  const patterns: [
    RegExp,
    (m: RegExpExecArray) => ReturnType<typeof termOf>,
  ][] = [
    [
      new RegExp(String.raw`^\(${field} != null && item\.\1 !== ''\)$`),
      (m) => wrap(m[1]!, "exists"),
    ],
    [
      new RegExp(String.raw`^\(${field} == null \|\| item\.\1 === ''\)$`),
      (m) => wrap(m[1]!, "notExists"),
    ],
    [
      new RegExp(
        String.raw`^(!?)(contains|startsWith|endsWith)[A-Za-z]*\(String\(${field}\), (.+)\)$`,
      ),
      (m) =>
        wrap(
          m[3]!,
          (m[1]
            ? `not${m[2]![0]!.toUpperCase()}${m[2]!.slice(1)}`
            : m[2]) as ViewComparison,
          m[4],
        ),
    ],
    [
      new RegExp(
        String.raw`^(!?)${field}\.some\(x => (contains|startsWith|endsWith)[A-Za-z]*\(String\(x\), (.+)\)\)$`,
      ),
      (m) =>
        wrap(
          m[2]!,
          (m[1]
            ? `not${m[3]![0]!.toUpperCase()}${m[3]!.slice(1)}`
            : m[3]) as ViewComparison,
          m[4],
        ),
    ],
    [
      new RegExp(String.raw`^([A-Za-z_$][\w$]*)\.has\(${field}\)$`),
      (m) => wrap(m[2]!, "oneOf", m[1]),
    ],
    [
      new RegExp(String.raw`^(\[.*\])\.includes\(${field}\)$`),
      (m) => wrap(m[2]!, "oneOf", m[1]),
    ],
    [
      new RegExp(String.raw`^${field} (===|!==|>=|>|<=|<) (.+)$`),
      (m) =>
        wrap(
          m[1]!,
          (
            {
              "===": "equals",
              "!==": "notEquals",
              ">=": "gte",
              ">": "gt",
              "<=": "lte",
              "<": "lt",
            } as const
          )[m[2] as "===" | "!==" | ">=" | ">" | "<=" | "<"],
          m[3],
        ),
    ],
  ];
  function wrap(key: string, op: ViewComparison, raw?: string) {
    const path = fieldOf(key);
    if (!path) return undefined;
    if (raw === undefined) return { fields: [path], op };
    const value = valueOf(raw);
    return value === undefined ? undefined : { fields: [path], op, value };
  }
  for (const [pattern, read] of patterns) {
    const m = pattern.exec(text);
    if (m) return read(m);
  }
  return undefined;
}
