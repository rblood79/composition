/**
 * A rule value that names where it comes from (the panel's 「값 고르기」 — Figma · Framer bind a
 * property to a source instead of typing a token). The whole value is a reference, so it keeps its
 * type (a row is an object, keys are an array):
 *
 * - `!event.<arg>[.<path>]` — the RAC callback's argument (`eventArgs` — `keys` · `value` · `formData` …)
 * - `!item.<arg>[.<path>]` — the item the key argument names in the owner's bound collection
 *   (`useListData.getItem(key)`): one item for `key` or a single selection, else the items
 * - `!var.<variableId>[.<path>]` — a variable's current value
 *
 * Anything else is itself (a literal). A path reads into an object; on a list it reads each item.
 */
export type RuleValueRef =
  | { from: "event"; arg: string; path: readonly string[] }
  | { from: "item"; arg: string; path: readonly string[] }
  | { from: "var"; variableId: string; path: readonly string[] };

const PREFIXES = { event: "!event.", item: "!item.", var: "!var." } as const;

/** The reference a rule value stores, or undefined for a literal. */
export function parseRuleValueRef(value: unknown): RuleValueRef | undefined {
  if (typeof value !== "string") return undefined;
  for (const from of ["event", "item", "var"] as const) {
    const prefix = PREFIXES[from];
    if (!value.startsWith(prefix)) continue;
    const [head, ...path] = value.slice(prefix.length).split(".");
    if (!head) return undefined;
    return from === "var"
      ? { from, variableId: head, path }
      : { from, arg: head, path };
  }
  return undefined;
}

/** A reference as the rule value it is stored as. */
export function formatRuleValueRef(ref: RuleValueRef): string {
  const head = ref.from === "var" ? ref.variableId : ref.arg;
  return [`${PREFIXES[ref.from]}${head}`, ...ref.path].join(".");
}

/** The argument names whose value is a collection key (`!item.<arg>` reads their items). */
export const KEY_EVENT_ARGS: ReadonlySet<string> = new Set(["key", "keys"]);

/** Whether `!item.<arg>` reads one item: a `key`, or the keys of a single selection. */
export const itemRefIsSingle = (arg: string, singleSelection: boolean) =>
  arg === "key" || singleSelection;

/** What a rule value reads when the rule runs. */
export interface RuleValueEnv {
  /** The RAC callback's arguments by name (`DispatchContext.event`). */
  event?: Readonly<Record<string, unknown>>;
  /**
   * The owner's bound collection items the keys name (`getItem`, in key order; `"all"` = every
   * item); undefined = the owner shows no bound collection.
   */
  itemsOf?: (keys: readonly string[] | "all") => readonly unknown[] | undefined;
  /** The owner's `selectionMode` is `single` (its `keys` name one item). */
  singleSelection?: boolean;
  /** A variable's current value; undefined = no such variable. */
  readVariable?: (variableId: string) => { value: unknown } | undefined;
}

export type RuleValueResult =
  { ok: true; value: unknown } | { ok: false; reason: string };

/** RAC's `Selection` (a Set, `"all"`) and keys as plain data — a variable holds no Set. */
function plain(value: unknown): unknown {
  return value instanceof Set ? [...value].map(String) : value;
}

function readPath(value: unknown, path: readonly string[]): unknown {
  if (!path.length) return value;
  if (Array.isArray(value)) return value.map((item) => readPath(item, path));
  if (value === null || value === undefined || typeof value !== "object")
    return undefined;
  const [segment, ...rest] = path;
  return readPath((value as Record<string, unknown>)[segment!], rest);
}

const keysOf = (value: unknown): readonly string[] | "all" =>
  value === "all"
    ? "all"
    : value instanceof Set || Array.isArray(value)
      ? [...value].map(String)
      : value === null || value === undefined || value === ""
        ? []
        : [String(value)];

/** A rule value as the rule's run reads it: a reference resolved, a literal itself. */
export function resolveRuleValue(
  value: unknown,
  env: RuleValueEnv | undefined,
): RuleValueResult {
  const ref = parseRuleValueRef(value);
  if (!ref) return { ok: true, value };
  if (ref.from === "var") {
    const read = env?.readVariable?.(ref.variableId);
    if (!read) return { ok: false, reason: `변수 없음: ${ref.variableId}` };
    return { ok: true, value: readPath(read.value, ref.path) };
  }
  const event = env?.event;
  if (!event || !(ref.arg in event))
    return { ok: false, reason: `이벤트 인자 없음: ${String(value)}` };
  const raw = plain(event[ref.arg]);
  if (ref.from === "event") return { ok: true, value: readPath(raw, ref.path) };
  const items = env?.itemsOf?.(keysOf(raw));
  if (!items)
    return {
      ok: false,
      reason: `항목을 찾을 데이터 연결 없음: ${String(value)}`,
    };
  const picked = itemRefIsSingle(ref.arg, env?.singleSelection ?? false)
    ? (items[0] ?? null)
    : items;
  return { ok: true, value: readPath(picked, ref.path) };
}
