/**
 * ADR-325 — a collection's runtime store, in three layers (breakdown §세 층의 형):
 *
 * - **rows** — the rows a server (or the author · the Builder) confirmed, by row key. Edits are
 *   never written here.
 * - **results · lists** — each request's answer as a key list (with its cursor · total · load), and
 *   the lists its pages make up.
 * - **changes** — what the user changed and has not saved: by row key, an update (each field's
 *   value before the first edit · now · its edit number), an insert, a remove — with the sends of
 *   them waiting for the server's answer kept apart (`SendTicket`).
 *
 * What a list shows is always 「its rows with the changes laid over them」 (`overlayRows`). A load
 * changes the rows and the results only — the changes stay over whatever comes. The module knows
 * no session, DOM or graph (unit-tested on its own); the session calls it at every load · edit.
 */

export type RowKey = string;
export type Row = Readonly<Record<string, unknown>>;
/** A request's identity — the address · method · body it fetches (or the Builder's · the author's rows). */
export type RequestKey = string;
/** The pages a list joins: a collection and its first request's key. */
export type ListKey = string;

/**
 * The store key of each row object the store holds or made (an accepted row, an inserted one, the
 * copies the overlay made of them). A row's copy carries its key (`carryKey`).
 */
const STORE_KEYS = new WeakMap<object, RowKey>();
export function storeKeyOf(row: object): RowKey | undefined {
  return STORE_KEYS.get(row);
}
function carryKey<T extends object>(from: object, to: T): T {
  const key = STORE_KEYS.get(from);
  if (key !== undefined) STORE_KEYS.set(to, key);
  return to;
}

export interface StoredRow {
  /** `null` — a remove the server confirmed (a trace: an earlier request's answer cannot put it back). */
  row: Row | null;
  /** The sequence of the request · the save answer that wrote this value. */
  at: number;
  /** By field: the last confirmed edit number — an earlier edit's confirmation does not write it. */
  confirmed?: Record<string, number>;
}

export interface QueryResult {
  keys: RowKey[];
  cursor?: string;
  total?: number;
  /** The sequence its request started at — an earlier request's answer does not change the keys. */
  at: number;
  /** Rises each time the key list is replaced whole — a keyless row's key is of one generation. */
  generation: number;
  /** Rises when the key list or a row of it changes — what a list's shown rows remember. */
  revision: number;
  /** The array the rows came in, while every row of it is the store's (no other answer replaced one). */
  source?: readonly Row[];
}

export interface QueryList {
  /** The results in the order received — 「더 보기」 reads them in turn. */
  pages: RequestKey[];
}

export interface FieldChange {
  /** The field's value when it was first changed (the server's). */
  base: unknown;
  value: unknown;
  /** The edit number that wrote `value`. */
  seq: number;
  /** A value the server gave after the first change, other than `base` and `value` (ADR-324 shows it). */
  server?: unknown;
}

export type RowChange =
  | {
      kind: "update";
      /** The row as the server had it when it was first changed — a load does not change it. */
      baseRow: Row;
      fields: Record<string, FieldChange>;
    }
  | {
      kind: "insert";
      row: Row;
      /** The edit that inserted it. */
      seq: number;
      /** The last edit that wrote it (an update of an inserted row is the insert's). */
      last: number;
    }
  /** No `baseRow` = a remove of an insert whose send waits for its answer. */
  | { kind: "remove"; baseRow?: Row; seq: number }
  /**
   * A row the server made without telling its key, with edits after the send: `sent` is what the
   * server took, `row` the row now. It stays until the user links it to a server row or drops it
   * (it cannot be sent — no server identity).
   */
  | { kind: "unlinked"; sent: Row; row: Row; removed?: true; seq: number };

export type SentEntry =
  | {
      key: RowKey;
      kind: "update";
      baseRow: Row;
      fields: Record<string, { value: unknown; seq: number }>;
    }
  | { key: RowKey; kind: "insert"; row: Row; seq: number }
  | { key: RowKey; kind: "remove"; baseRow: Row; seq: number };

export interface SendTicket {
  id: string;
  entries: SentEntry[];
}

export type SendOutcome =
  /** `serverKey: null` — the server made the row but its key is not known. */
  | { key: RowKey; result: "confirmed"; row?: Row; serverKey?: RowKey | null }
  | { key: RowKey; result: "rejected" }
  | { key: RowKey; result: "unknown" };

/** Where an insert · a move goes — by store key (`index` — that place of its level). */
export type StorePosition =
  "start" | { index: number } | { before: RowKey } | { after: RowKey };

export type OrderEdit =
  | { kind: "insert"; key: RowKey; at: StorePosition; parent?: RowKey | null }
  | { kind: "append"; key: RowKey; parent?: RowKey | null }
  | {
      kind: "move";
      keys: readonly RowKey[];
      to: Exclude<StorePosition, "start">;
      toParent?: RowKey | null;
    };

/** Values compare as the stored values they are — `null` · `""` · `0` · `false` are not the same. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (
    a === null ||
    b === null ||
    typeof a !== "object" ||
    typeof b !== "object"
  )
    return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

const isRow = (value: unknown): value is Row =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** How a row of an answer is keyed (`keyOf` — its key field's value, else none). */
export interface AcceptOptions {
  /** The request's sequence — when it started. */
  at: number;
  /** A row's key from its own fields (the collection's key field → `id` · `key` · `value`). */
  keyOf: (row: Row) => RowKey | undefined;
  /**
   * The key of a row without one: `authored` — its place in the collection (`row-N` — one list that
   * does not change while running), `answer` — its place in this answer of this request (ADR-325
   * Decision 7 — it means nothing outside it).
   */
  keyless: "authored" | "answer";
  cursor?: string;
  total?: number;
}

let ticketSerial = 0;

export class CollectionStore {
  readonly rows = new Map<RowKey, StoredRow>();
  readonly results = new Map<RequestKey, QueryResult>();
  readonly lists = new Map<ListKey, QueryList>();
  readonly changes = new Map<RowKey, RowChange>();
  readonly sends = new Map<string, SendTicket>();
  order: OrderEdit[] = [];
  /**
   * A save wrote a row (or a confirmed remove took one out): the rows shown are no longer the
   * arrays the answers came in — a reader cannot take them as they are.
   */
  diverged = false;
  /** Nested rows (a tree's children) a save confirmed — the overlay writes them under their parent. */
  readonly nested = new Set<RowKey>();
  /** Rises at every change of `changes` · `order` — what the shown rows remember with the results'. */
  changeRevision = 0;
  /** The results holding each key (a row's new value reaches every list showing it). */
  private readonly resultsOfKey = new Map<RowKey, Set<RequestKey>>();
  /** Keys made for rows without one, by the result that made them (dropped with its generation). */
  private readonly answerKeys = new Map<RequestKey, RowKey[]>();

  /**
   * A request's answer (breakdown 「조회가 올 때」): its key list replaces the result's — unless an
   * earlier request's answer comes after a later one's — and each row's value is written only when
   * no later request · save wrote it. A trace of a confirmed remove keeps an earlier request's row
   * out. Returns false when the answer was dropped (an earlier request's).
   */
  accept(
    requestKey: RequestKey,
    items: readonly unknown[],
    options: AcceptOptions,
  ): boolean {
    const held = this.results.get(requestKey);
    if (held && held.at > options.at) return false;
    // (Keys this result made for rows without one: another generation's are other rows — U1.)
    const generation = (held?.generation ?? 0) + 1;
    this.dropAnswerKeys(requestKey);
    if (held) for (const key of held.keys) this.unindex(key, requestKey);
    const keys: RowKey[] = [];
    const seen = new Set<RowKey>();
    const made: RowKey[] = [];
    let pristine = true;
    items.forEach((item, index) => {
      if (!isRow(item)) {
        pristine = false;
        return;
      }
      let key = options.keyOf(item);
      if (key === undefined) {
        key =
          options.keyless === "authored"
            ? `row-${index + 1}`
            : `${requestKey}\u0002${generation}\u0002${index}`;
        if (options.keyless === "answer") made.push(key);
      }
      // (One key twice in one answer: the second is its own row — the lists warn of it.)
      if (seen.has(key)) {
        key = `${key}\u0003${index}`;
        if (options.keyless === "answer") made.push(key);
      }
      seen.add(key);
      const stored = this.rows.get(key);
      if (stored && stored.at > options.at) {
        // (A later request · save wrote it: its value stays; a confirmed remove keeps it out.)
        pristine = false;
        if (stored.row === null) return;
      } else if (stored?.row === item) {
        // (The same row object again — nothing to write.)
      } else {
        const before = stored?.row ?? undefined;
        this.rows.set(key, {
          row: item,
          at: options.at,
          ...(stored?.confirmed ? { confirmed: stored.confirmed } : {}),
        });
        STORE_KEYS.set(item, key);
        if (before) this.rowChanged(key, before, item, requestKey);
      }
      keys.push(key);
      this.index(key, requestKey);
    });
    if (made.length) this.answerKeys.set(requestKey, made);
    this.results.set(requestKey, {
      keys,
      ...(options.cursor !== undefined ? { cursor: options.cursor } : {}),
      ...(options.total !== undefined ? { total: options.total } : {}),
      at: options.at,
      generation,
      revision: (held?.revision ?? 0) + 1,
      ...(pristine ? { source: items as readonly Row[] } : {}),
    });
    return true;
  }

  /** The list's pages: its first request only (a reload · another query starts it over). */
  startList(listKey: ListKey, first: RequestKey): void {
    this.lists.set(listKey, { pages: [first] });
  }
  /** The list's next page (`loadMore`). */
  appendPage(listKey: ListKey, page: RequestKey): void {
    const list = this.lists.get(listKey);
    if (!list) this.lists.set(listKey, { pages: [page] });
    else if (!list.pages.includes(page)) list.pages.push(page);
  }
  /** A list no reader reads: it goes, with its results no other list holds (and their rows). */
  dropList(listKey: ListKey): void {
    const list = this.lists.get(listKey);
    if (!list) return;
    this.lists.delete(listKey);
    const held = new Set<RequestKey>();
    for (const other of this.lists.values())
      for (const page of other.pages) held.add(page);
    for (const page of list.pages) if (!held.has(page)) this.dropResult(page);
  }
  /** A result goes, and the rows no result holds that carry no change and no send. */
  dropResult(requestKey: RequestKey): void {
    const result = this.results.get(requestKey);
    if (!result) return;
    this.results.delete(requestKey);
    this.dropAnswerKeys(requestKey);
    for (const key of result.keys) {
      this.unindex(key, requestKey);
      if (!this.resultsOfKey.has(key) && !this.pinned(key))
        this.rows.delete(key);
    }
  }
  /** A row a change or a send holds stays in the store. */
  private pinned(key: RowKey): boolean {
    if (this.changes.has(key)) return true;
    for (const ticket of this.sends.values())
      if (ticket.entries.some((entry) => entry.key === key)) return true;
    return false;
  }

  /**
   * A revision of what a list shows — its pages' results and the changes. Equal revisions = the
   * same rows.
   */
  listRevision(listKey: ListKey): string {
    const list = this.lists.get(listKey);
    const pages =
      list?.pages
        .map((page) => {
          const result = this.results.get(page);
          return result ? `${result.revision}` : "-";
        })
        .join(",") ?? "";
    return `${pages}|${this.changeRevision}`;
  }

  /**
   * A row shown by its key in any list (a server row with its update, an inserted row) — none when
   * it is removed or the store does not hold it.
   */
  knownRow(key: RowKey): Row | undefined {
    const change = this.changes.get(key);
    if (change?.kind === "remove") return undefined;
    if (change?.kind === "insert") return change.row;
    if (change?.kind === "unlinked") return change.removed ? undefined : change.row;
    const stored = this.rows.get(key)?.row ?? undefined;
    if (!stored || change?.kind !== "update") return stored;
    const values: Record<string, unknown> = {};
    for (const [field, held] of Object.entries(change.fields))
      values[field] = held.value;
    return carryKey(stored, { ...stored, ...values });
  }
  /** The server's rows of a list (its pages in turn) — before the changes. */
  listRows(listKey: ListKey): readonly Row[] {
    const list = this.lists.get(listKey);
    if (!list) return [];
    if (list.pages.length === 1) return this.resultRows(list.pages[0]!);
    return list.pages.flatMap((page) => this.resultRows(page));
  }
  /** A result's rows — the array they came in while no other answer replaced a row of it. */
  resultRows(requestKey: RequestKey): readonly Row[] {
    const result = this.results.get(requestKey);
    if (!result) return [];
    if (result.source) return result.source;
    const rows: Row[] = [];
    for (const key of result.keys) {
      const stored = this.rows.get(key)?.row;
      if (stored) rows.push(stored);
    }
    return rows;
  }

  // ─── changes ────────────────────────────────────────────────────────────────────────────────

  /** Whether an open send holds this key (and field — absent = any of it). */
  private sending(key: RowKey, field?: string): boolean {
    for (const ticket of this.sends.values())
      for (const entry of ticket.entries) {
        if (entry.key !== key) continue;
        if (field === undefined || entry.kind !== "update") return true;
        if (field in entry.fields) return true;
      }
    return false;
  }
  private touched(): void {
    this.changeRevision += 1;
  }

  /**
   * An edit of a row's fields (breakdown 「합치기」): the first edit of a field keeps the value it
   * had (`base`); an edit back to it drops the field — not while a send of it waits for its answer.
   * `current` is the row as shown now (its server row when it has no change).
   */
  update(
    key: RowKey,
    patch: Readonly<Record<string, unknown>>,
    seq: number,
    current: Row,
  ): void {
    const change = this.changes.get(key);
    if (change?.kind === "remove") return;
    if (change?.kind === "insert") {
      const row = carryKey(change.row, { ...change.row, ...patch });
      this.changes.set(key, { ...change, row, last: seq });
      this.touched();
      return;
    }
    if (change?.kind === "unlinked") {
      this.changes.set(key, {
        ...change,
        row: carryKey(change.row, { ...change.row, ...patch }),
        seq,
      });
      this.touched();
      return;
    }
    const baseRow = change?.baseRow ?? current;
    const fields = { ...change?.fields };
    for (const [field, value] of Object.entries(patch)) {
      const held = fields[field];
      const base = held ? held.base : baseRow[field];
      if (sameValue(value, base) && !this.sending(key, field)) {
        delete fields[field];
        continue;
      }
      fields[field] = {
        base,
        value,
        seq,
        ...(held && "server" in held ? { server: held.server } : {}),
      };
    }
    if (Object.keys(fields).length)
      this.changes.set(key, { kind: "update", baseRow, fields });
    else this.changes.delete(key);
    this.touched();
  }

  /** An inserted row (at its place — `order`). */
  insert(key: RowKey, row: Row, seq: number, edit: OrderEdit): void {
    STORE_KEYS.set(row, key);
    this.changes.set(key, { kind: "insert", row, seq, last: seq });
    this.order = [...this.order, edit];
    this.touched();
  }

  /** A remove: of an insert = no change (unless its send waits — then it waits for the answer). */
  remove(key: RowKey, seq: number, current: Row): void {
    const change = this.changes.get(key);
    if (change?.kind === "remove") return;
    if (change?.kind === "insert") {
      if (this.sending(key)) this.changes.set(key, { kind: "remove", seq });
      else {
        this.changes.delete(key);
        this.order = this.order.filter(
          (edit) => edit.kind === "move" || edit.key !== key,
        );
      }
    } else if (change?.kind === "unlinked")
      this.changes.set(key, { ...change, removed: true, seq });
    else
      this.changes.set(key, {
        kind: "remove",
        baseRow: change?.kind === "update" ? change.baseRow : current,
        seq,
      });
    this.touched();
  }

  /** A move (keys to a place) — an order edit. */
  move(edit: Extract<OrderEdit, { kind: "move" }>): void {
    this.order = [...this.order, edit];
    this.touched();
  }

  /**
   * A send: the changes the given edits wrote, as they are now (`SendTicket`). Edits go on after
   * it; its answer (`settle`) is judged against what was sent. Undefined = nothing to send.
   */
  beginSend(seqs: ReadonlySet<number>): string | undefined {
    const entries: SentEntry[] = [];
    for (const [key, change] of this.changes) {
      if (change.kind === "update") {
        const fields: Record<string, { value: unknown; seq: number }> = {};
        for (const [field, held] of Object.entries(change.fields))
          if (seqs.has(held.seq))
            fields[field] = { value: held.value, seq: held.seq };
        if (Object.keys(fields).length)
          entries.push({
            key,
            kind: "update",
            baseRow: change.baseRow,
            fields,
          });
      } else if (change.kind === "insert") {
        if (seqs.has(change.seq) || seqs.has(change.last))
          entries.push({
            key,
            kind: "insert",
            row: change.row,
            seq: change.last,
          });
      } else if (change.kind === "remove" && change.baseRow) {
        if (seqs.has(change.seq))
          entries.push({
            key,
            kind: "remove",
            baseRow: change.baseRow,
            seq: change.seq,
          });
      }
    }
    if (!entries.length) return undefined;
    const id = `send-${(ticketSerial += 1)}`;
    this.sends.set(id, { id, entries });
    return id;
  }

  /**
   * A send's answer, row by row (breakdown 「판정」): a confirmed row's sent values become the
   * server's (`at` — the answer's sequence) and only the edits after the send stay; a rejected
   * row's changes stay; `unknown` stays in the ticket. The ticket closes when every row is judged.
   */
  settle(ticketId: string, outcomes: readonly SendOutcome[], at: number): void {
    const ticket = this.sends.get(ticketId);
    if (!ticket) return;
    const byKey = new Map(outcomes.map((outcome) => [outcome.key, outcome]));
    const open: SentEntry[] = [];
    // (Judged entries leave the ticket first: a field's 「sending」 ends with its own answer.)
    const judged: [SentEntry, SendOutcome][] = [];
    for (const entry of ticket.entries) {
      const outcome = byKey.get(entry.key);
      if (!outcome || outcome.result === "unknown") open.push(entry);
      else judged.push([entry, outcome]);
    }
    if (open.length) this.sends.set(ticketId, { ...ticket, entries: open });
    else this.sends.delete(ticketId);
    for (const [entry, outcome] of judged)
      if (outcome.result === "confirmed") this.confirmed(entry, outcome, at);
      else this.rejected(entry);
    this.touched();
  }

  private confirmed(
    entry: SentEntry,
    outcome: Extract<SendOutcome, { result: "confirmed" }>,
    at: number,
  ): void {
    const change = this.changes.get(entry.key);
    if (entry.kind === "update") {
      const stored = this.rows.get(entry.key);
      const server = stored?.row ?? entry.baseRow;
      const confirmed = { ...stored?.confirmed };
      const written: Record<string, unknown> = {};
      for (const [field, sent] of Object.entries(entry.fields)) {
        // (An earlier edit's confirmation after a later one's: it does not write the field.)
        if ((confirmed[field] ?? 0) >= sent.seq) continue;
        confirmed[field] = sent.seq;
        written[field] =
          outcome.row && field in outcome.row ? outcome.row[field] : sent.value;
      }
      const wrote = Object.keys(written).length > 0;
      const row = wrote ? { ...server, ...written } : server;
      if (wrote || stored) {
        if (wrote) STORE_KEYS.set(row, entry.key);
        // (A row no result holds — a tree's nested row: the overlay writes its value under its parent.)
        if (wrote && !this.resultsOfKey.has(entry.key)) this.nested.add(entry.key);
        if (wrote) this.diverged = true;
        this.rows.set(entry.key, {
          row,
          at: wrote ? at : (stored?.at ?? at),
          confirmed,
        });
        if (wrote) this.bumpResults(entry.key);
      }
      if (change?.kind !== "update") return;
      const fields = { ...change.fields };
      for (const [field, sent] of Object.entries(entry.fields)) {
        const held = fields[field];
        if (!held) continue;
        if (held.seq === sent.seq) {
          delete fields[field];
          continue;
        }
        // (Edited after the send: the confirmed value is its base now.)
        if (field in written) {
          const base = written[field];
          if (sameValue(held.value, base) && !this.sending(entry.key, field))
            delete fields[field];
          else fields[field] = { ...held, base };
        }
      }
      if (Object.keys(fields).length)
        this.changes.set(entry.key, {
          kind: "update",
          baseRow: row,
          fields,
        });
      else this.changes.delete(entry.key);
      return;
    }
    if (entry.kind === "insert") {
      const sentRow = outcome.row ?? entry.row;
      const later =
        change?.kind === "insert" ? change.last > entry.seq : !!change;
      if (outcome.serverKey === null) {
        // (A row the server made without its key: the insert closes; edits after it stay unlinked.)
        if (!later || !change) {
          this.changes.delete(entry.key);
          this.dropOrder(entry.key);
          return;
        }
        this.changes.set(entry.key, {
          kind: "unlinked",
          sent: sentRow,
          row: change.kind === "insert" ? change.row : sentRow,
          ...(change.kind === "remove" ? { removed: true as const } : {}),
          seq:
            change.kind === "insert"
              ? change.last
              : "seq" in change
                ? change.seq
                : entry.seq,
        });
        return;
      }
      const key = outcome.serverKey ?? entry.key;
      const row = carryKey(entry.row, { ...sentRow });
      STORE_KEYS.set(row, key);
      this.rows.set(key, { row, at });
      this.diverged = true;
      if (key !== entry.key) {
        this.changes.delete(entry.key);
        this.order = this.order.map((edit) =>
          edit.kind === "move"
            ? {
                ...edit,
                keys: edit.keys.map((each) =>
                  each === entry.key ? key : each,
                ),
              }
            : edit.key === entry.key
              ? { ...edit, key }
              : edit,
        );
      }
      if (change?.kind === "insert" && later) {
        const fields: Record<string, FieldChange> = {};
        for (const [field, value] of Object.entries(change.row))
          if (!sameValue(value, row[field]))
            fields[field] = { base: row[field], value, seq: change.last };
        if (Object.keys(fields).length)
          this.changes.set(key, { kind: "update", baseRow: row, fields });
        else this.changes.delete(key);
      } else if (change?.kind === "remove")
        this.changes.set(key, {
          kind: "remove",
          baseRow: row,
          seq: change.seq,
        });
      else this.changes.delete(key);
      if (key !== entry.key) this.changes.delete(entry.key);
      return;
    }
    // (A remove confirmed: a trace keeps an earlier request's answer from bringing it back.)
    if (change?.kind === "remove") this.changes.delete(entry.key);
    this.rows.set(entry.key, { row: null, at });
    this.diverged = true;
    for (const requestKey of this.resultsOfKey.get(entry.key) ?? []) {
      const result = this.results.get(requestKey);
      if (!result) continue;
      this.results.set(requestKey, {
        ...result,
        keys: result.keys.filter((key) => key !== entry.key),
        revision: result.revision + 1,
        source: undefined,
      });
    }
    this.resultsOfKey.delete(entry.key);
  }

  private rejected(entry: SentEntry): void {
    const change = this.changes.get(entry.key);
    if (entry.kind === "update" && change?.kind === "update") {
      const fields = { ...change.fields };
      for (const [field, sent] of Object.entries(entry.fields)) {
        const held = fields[field];
        // (Edited back after the send: with the send refused, it is no change.)
        if (
          held &&
          held.seq !== sent.seq &&
          sameValue(held.value, held.base) &&
          !this.sending(entry.key, field)
        )
          delete fields[field];
      }
      if (Object.keys(fields).length)
        this.changes.set(entry.key, { ...change, fields });
      else this.changes.delete(entry.key);
    } else if (
      entry.kind === "insert" &&
      change?.kind === "remove" &&
      !change.baseRow
    ) {
      this.changes.delete(entry.key);
      this.dropOrder(entry.key);
    }
  }

  private dropOrder(key: RowKey): void {
    this.order = this.order.filter(
      (edit) => edit.kind === "move" || edit.key !== key,
    );
  }

  /**
   * Drop changes (`unlinked` too) and their order edits — all, or the given keys'. The rows and the
   * results stay; a send in flight is judged as if nothing came after it.
   */
  discard(keys?: readonly RowKey[]): void {
    if (!keys) {
      this.changes.clear();
      this.order = [];
    } else {
      const drop = new Set(keys);
      for (const key of drop) this.changes.delete(key);
      this.order = this.order.flatMap((edit): OrderEdit[] => {
        if (edit.kind !== "move") return drop.has(edit.key) ? [] : [edit];
        const kept = edit.keys.filter((key) => !drop.has(key));
        return kept.length ? [{ ...edit, keys: kept }] : [];
      });
    }
    this.touched();
  }

  /**
   * ADR-324 「my value, saved again」 — an update's base becomes the given server row; fields equal
   * to it go, the server notes clear.
   */
  rebase(key: RowKey, row: Row): void {
    const change = this.changes.get(key);
    if (change?.kind !== "update") return;
    const fields: Record<string, FieldChange> = {};
    for (const [field, held] of Object.entries(change.fields)) {
      if (sameValue(held.value, row[field])) continue;
      fields[field] = { base: row[field], value: held.value, seq: held.seq };
    }
    if (Object.keys(fields).length)
      this.changes.set(key, { kind: "update", baseRow: row, fields });
    else this.changes.delete(key);
    this.touched();
  }

  /** ADR-324 — an unlinked row linked by the user to a server row (`serverKey`). */
  link(key: RowKey, serverKey: RowKey): void {
    const change = this.changes.get(key);
    const server = this.rows.get(serverKey)?.row;
    if (change?.kind !== "unlinked" || !server) return;
    this.changes.delete(key);
    this.dropOrder(key);
    if (change.removed)
      this.changes.set(serverKey, {
        kind: "remove",
        baseRow: server,
        seq: change.seq,
      });
    else {
      const fields: Record<string, FieldChange> = {};
      for (const [field, value] of Object.entries(change.row))
        if (!sameValue(value, change.sent[field]))
          fields[field] = { base: server[field], value, seq: change.seq };
      if (Object.keys(fields).length)
        this.changes.set(serverKey, {
          kind: "update",
          baseRow: server,
          fields,
        });
    }
    this.touched();
  }

  /** Remove traces older than every request still in flight (their answers came or went). */
  sweepTraces(earliestInFlight: number): void {
    for (const [key, stored] of this.rows)
      if (stored.row === null && stored.at <= earliestInFlight)
        this.rows.delete(key);
  }

  /** Whether a key is one the server knows the row by (its key field's value — not a place). */
  isServerKey(key: RowKey): boolean {
    return !key.includes("\u0002") && !/^row-\d+$/.test(key);
  }

  // ─── indexes ────────────────────────────────────────────────────────────────────────────────

  private index(key: RowKey, requestKey: RequestKey): void {
    let set = this.resultsOfKey.get(key);
    if (!set) this.resultsOfKey.set(key, (set = new Set()));
    set.add(requestKey);
  }
  private unindex(key: RowKey, requestKey: RequestKey): void {
    const set = this.resultsOfKey.get(key);
    if (!set) return;
    set.delete(requestKey);
    if (!set.size) this.resultsOfKey.delete(key);
  }
  private dropAnswerKeys(requestKey: RequestKey): void {
    const made = this.answerKeys.get(requestKey);
    if (!made) return;
    this.answerKeys.delete(requestKey);
    for (const key of made) {
      this.unindex(key, requestKey);
      this.rows.delete(key);
      if (this.changes.delete(key)) this.touched();
      this.dropOrder(key);
    }
  }
  /** Every result holding the key reads it again (a value another answer · a save wrote). */
  private bumpResults(key: RowKey): void {
    for (const requestKey of this.resultsOfKey.get(key) ?? []) {
      const result = this.results.get(requestKey);
      if (result)
        this.results.set(requestKey, {
          ...result,
          revision: result.revision + 1,
          source: undefined,
        });
    }
  }
  /**
   * A row's value an answer replaced: the other results showing it read it again, and an update's
   * fields note the server's new value (`server`) — or go, when it is the value the user wrote.
   */
  private rowChanged(
    key: RowKey,
    before: Row,
    after: Row,
    by: RequestKey,
  ): void {
    for (const requestKey of this.resultsOfKey.get(key) ?? []) {
      if (requestKey === by) continue;
      const result = this.results.get(requestKey);
      if (result)
        this.results.set(requestKey, {
          ...result,
          revision: result.revision + 1,
          source: undefined,
        });
    }
    const change = this.changes.get(key);
    if (change?.kind !== "update") return;
    let changed = false;
    const fields = { ...change.fields };
    for (const [field, held] of Object.entries(fields)) {
      const next = after[field];
      if (sameValue(next, before[field])) continue;
      if (sameValue(next, held.value) && !this.sending(key, field)) {
        delete fields[field];
        changed = true;
      } else if (!sameValue(next, held.base)) {
        fields[field] = { ...held, server: next };
        changed = true;
      }
    }
    if (!changed) return;
    if (Object.keys(fields).length)
      this.changes.set(key, { ...change, fields });
    else this.changes.delete(key);
    this.touched();
  }
}

// ─── the rows shown ─────────────────────────────────────────────────────────────────────────────

/** How a collection's rows nest (a tree's children field, or a flat tree's parent field). */
export interface OverlayShape {
  /** A nested tree's children field. */
  childrenKey?: string;
  /** A flat tree's parent field (its value = the parent's own key value). */
  parentField?: string;
  /** A row's own key value (the key field → `id` · `key` · `value`) — a flat tree's parent value. */
  dataKey: (row: Row) => string | number | undefined;
}

type Items = readonly Row[];
const FLAT_CHILDREN = "__compositionFlatTreeChildren__";

/** The key of an item at a level: the store's, else its own key value, else its place under its parent. */
export function levelKey(
  item: Row,
  index: number,
  parent: RowKey | null,
  shape: OverlayShape,
): RowKey {
  const stored = STORE_KEYS.get(item);
  if (stored !== undefined) return stored;
  const own = shape.dataKey(item);
  if (own !== undefined) return String(own);
  return `${parent ?? ""}\u0004row-${index + 1}`;
}

/** An item's children (the tree's children field), else none. */
function childrenOf(
  item: Row,
  childKey: string | undefined,
): Items | undefined {
  const children = childKey ? item[childKey] : undefined;
  return Array.isArray(children)
    ? (children.filter(isRow) as Row[])
    : undefined;
}

/**
 * The rows a list shows (ADR-325 Decision 4): the server's rows with the changes laid over them —
 * an update's fields written, a removed row (and its subtree) gone — then the order edits in turn
 * (inserts · appends · moves, by store key; a place whose key is gone puts the row at the end).
 * No change = the rows themselves (the same array).
 */
export function overlayRows(
  store: CollectionStore,
  base: readonly Row[],
  shape: OverlayShape,
  /**
   * A list the server ordered · filtered for a view (사용자 결정 3): no move applies, an inserted
   * row goes at the end — and only when `admit` keeps it (the view's conditions judged here).
   */
  served?: { admit: (row: Row) => boolean },
): readonly Row[] {
  if (!store.changes.size && !store.order.length && !hasNestedRows(store))
    return base;
  const childKey = shape.parentField ? FLAT_CHILDREN : shape.childrenKey;
  let items: Items = shape.parentField
    ? nestFlat(base, shape.parentField, shape)
    : base;
  // (1 — values: each row's update, a remove drops its subtree; a nested row a save confirmed.)
  const overlay = (level: Items, parent: RowKey | null, at: number): Row[] =>
    level.flatMap((item, index) => {
      const key = levelKey(item, index, parent, shape);
      let row = item;
      const stored = parent !== null ? store.rows.get(key) : undefined;
      if (stored?.row && stored.at > at)
        row = carryKey(item, {
          ...stored.row,
          ...pickChildren(item, childKey),
        });
      const change = store.changes.get(key);
      if (change?.kind === "remove") return [];
      if (change?.kind === "unlinked" && change.removed) return [];
      if (change?.kind === "update") {
        const values: Record<string, unknown> = {};
        for (const [field, held] of Object.entries(change.fields))
          values[field] = held.value;
        row = { ...row, ...values };
        STORE_KEYS.set(row, key);
      }
      const children = childrenOf(row, childKey);
      if (children) {
        const next = overlay(
          children,
          key,
          parent === null ? (store.rows.get(key)?.at ?? at) : at,
        );
        if (
          next.some((child, i) => child !== children[i]) ||
          next.length !== children.length
        ) {
          row = { ...row, [childKey!]: next };
          STORE_KEYS.set(row, key);
        }
      }
      return [row];
    });
  items = overlay(items, null, 0);
  // (2 — order edits.)
  for (const edit of store.order) {
    if (!served) {
      items = applyOrder(store, items, edit, childKey, shape);
      continue;
    }
    if (edit.kind === "move") continue;
    const row = orderedRow(store, edit.key);
    if (row && served.admit(row) && !containsKey(items, edit.key, childKey, shape))
      items = [...items, row];
  }
  return shape.parentField
    ? flattenTree(items, shape.parentField, shape)
    : items;
}

/** A store holding a nested row a save confirmed (a child row's own value). */
function hasNestedRows(store: CollectionStore): boolean {
  return store.nested.size > 0;
}

function pickChildren(item: Row, childKey: string | undefined): Row {
  return childKey && childKey in item ? { [childKey]: item[childKey] } : {};
}

/** The row an order edit puts somewhere: its insert's, else the row a save confirmed under it. */
function orderedRow(store: CollectionStore, key: RowKey): Row | undefined {
  const change = store.changes.get(key);
  if (change?.kind === "insert") return change.row;
  if (change?.kind === "unlinked")
    return change.removed ? undefined : change.row;
  if (change?.kind === "remove") return undefined;
  const stored = store.rows.get(key)?.row;
  if (!stored) return undefined;
  if (change?.kind === "update") {
    const values: Record<string, unknown> = {};
    for (const [field, held] of Object.entries(change.fields))
      values[field] = held.value;
    return carryKey(stored, { ...stored, ...values });
  }
  return stored;
}

function containsKey(
  items: Items,
  key: RowKey,
  childKey: string | undefined,
  shape: OverlayShape,
  parent: RowKey | null = null,
): boolean {
  return items.some((item, index) => {
    const own = levelKey(item, index, parent, shape);
    if (own === key) return true;
    const children = childrenOf(item, childKey);
    return !!children && containsKey(children, key, childKey, shape, own);
  });
}

/** The parent of the level holding `key` (`null` = the top), else undefined. */
function levelOf(
  items: Items,
  key: RowKey,
  childKey: string | undefined,
  shape: OverlayShape,
  parent: RowKey | null = null,
): RowKey | null | undefined {
  for (const [index, item] of items.entries()) {
    const own = levelKey(item, index, parent, shape);
    if (own === key) return parent;
    const children = childrenOf(item, childKey);
    if (!children) continue;
    const found = levelOf(children, key, childKey, shape, own);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** The items with one level (`parent` — `null` the top) changed; undefined when no such parent. */
function withLevel(
  items: Items,
  parent: RowKey | null,
  childKey: string | undefined,
  shape: OverlayShape,
  change: (level: Items, parent: RowKey | null) => Items,
): Items | undefined {
  if (parent === null) return change(items, null);
  if (!childKey) return undefined;
  let found = false;
  const visit = (level: Items, outer: RowKey | null): Items =>
    level.map((item, index) => {
      if (found) return item;
      const own = levelKey(item, index, outer, shape);
      if (own === parent) {
        found = true;
        return carryKey(item, {
          ...item,
          [childKey]: change(childrenOf(item, childKey) ?? [], own),
        });
      }
      const children = childrenOf(item, childKey);
      return children
        ? carryKey(item, { ...item, [childKey]: visit(children, own) })
        : item;
    });
  const next = visit(items, null);
  return found ? next : undefined;
}

/** Where a place falls in a level (`-1` — never: a key not there puts the row at the end). */
function placeIndex(
  level: Items,
  at: StorePosition,
  parent: RowKey | null,
  shape: OverlayShape,
): number {
  if (at === "start") return 0;
  if ("index" in at) return Math.min(at.index, level.length);
  const key = "before" in at ? at.before : at.after;
  const found = level.findIndex(
    (item, index) => levelKey(item, index, parent, shape) === key,
  );
  if (found < 0) return level.length;
  return "before" in at ? found : found + 1;
}

function applyOrder(
  store: CollectionStore,
  items: Items,
  edit: OrderEdit,
  childKey: string | undefined,
  shape: OverlayShape,
): Items {
  if (edit.kind === "insert" || edit.kind === "append") {
    const row = orderedRow(store, edit.key);
    if (!row || containsKey(items, edit.key, childKey, shape)) return items;
    const parent =
      edit.kind === "insert" && edit.at !== "start" && !("index" in edit.at)
        ? (levelOf(
            items,
            "before" in edit.at ? edit.at.before : edit.at.after,
            childKey,
            shape,
          ) ??
          edit.parent ??
          null)
        : (edit.parent ?? null);
    return (
      withLevel(items, parent, childKey, shape, (level, outer) => {
        const index =
          edit.kind === "append"
            ? level.length
            : placeIndex(level, edit.at, outer, shape);
        return [...level.slice(0, index), row, ...level.slice(index)];
      }) ?? items
    );
  }
  const keys = new Set(edit.keys);
  const moved: Row[] = [];
  const rest = (level: Items, parent: RowKey | null): Row[] =>
    level.flatMap((item, index) => {
      const own = levelKey(item, index, parent, shape);
      if (keys.has(own)) {
        moved.push(item);
        return [];
      }
      const children = childrenOf(item, childKey);
      return [
        children
          ? carryKey(item, { ...item, [childKey!]: rest(children, own) })
          : item,
      ];
    });
  const without = rest(items, null);
  if (!moved.length) return items;
  const target =
    "index" in edit.to
      ? undefined
      : "before" in edit.to
        ? edit.to.before
        : edit.to.after;
  const level =
    target !== undefined
      ? (levelOf(without, target, childKey, shape) ?? edit.toParent ?? null)
      : (edit.toParent ?? null);
  return (
    withLevel(without, level, childKey, shape, (list, outer) => {
      const index = placeIndex(list, edit.to, outer, shape);
      return [...list.slice(0, index), ...moved, ...list.slice(index)];
    }) ?? items
  );
}

/** A flat tree's rows nested by their parent field (each copy carries its row's key). */
function nestFlat(
  rows: readonly Row[],
  parentField: string,
  shape: OverlayShape,
): Items {
  const byKey = new Map<string, Row[]>();
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const own = shape.dataKey(row);
    if (own !== undefined)
      counts.set(String(own), (counts.get(String(own)) ?? 0) + 1);
  });
  const parentOf = (row: Row): string | undefined => {
    const value = row[parentField];
    if (typeof value !== "string" && typeof value !== "number")
      return undefined;
    const key = String(value);
    return key && counts.get(key) === 1 && key !== String(shape.dataKey(row))
      ? key
      : undefined;
  };
  for (const row of rows) {
    const parent = parentOf(row);
    if (parent === undefined) continue;
    let list = byKey.get(parent);
    if (!list) byKey.set(parent, (list = []));
    list.push(row);
  }
  const placed = new Set<Row>();
  const build = (row: Row, path: Set<string>): Row => {
    placed.add(row);
    const own = shape.dataKey(row);
    const key = own === undefined ? undefined : String(own);
    const children =
      key !== undefined && !path.has(key)
        ? (byKey.get(key) ?? []).map((child) =>
            build(child, new Set([...path, key])),
          )
        : [];
    return carryKey(row, { ...row, [FLAT_CHILDREN]: children });
  };
  const roots = rows.filter((row) => {
    const parent = parentOf(row);
    return parent === undefined;
  });
  const out = roots.map((row) => build(row, new Set()));
  // (A cycle: its rows are roots — none is lost.)
  for (const row of rows) if (!placed.has(row)) out.push(build(row, new Set()));
  return out;
}

/** The nested rows flat again, each with its parent's key value (a moved row's new parent). */
function flattenTree(
  items: Items,
  parentField: string,
  shape: OverlayShape,
): Row[] {
  const flat: Row[] = [];
  const visit = (
    level: Items,
    parent: string | number | null,
    outer: RowKey | null,
  ) =>
    level.forEach((item, index) => {
      const { [FLAT_CHILDREN]: children, ...rest } = item;
      const own = levelKey(item, index, outer, shape);
      flat.push(carryKey(item, { ...rest, [parentField]: parent }));
      if (Array.isArray(children))
        visit(children as Row[], shape.dataKey(item) ?? own, own);
    });
  visit(items, null, null);
  return flat;
}
