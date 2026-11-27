/**
 * ADR-324 — a Preview · Publish session's 「모아서 저장」: the unsaved changes (ADR-325's change
 * layer) sent as the collection's `save` declares when the viewer presses Save, and their answers
 * judged row by row. The session gives the host (its stores, endpoints, loads); the request
 * building · sending · judging modules load with the first save (`collections/save/*`).
 *
 * Per collection it keeps the save on its way and each row's save status — a conflict (with the
 * server's row), a refusal (with the fields' messages), a row waiting for its result (a lost answer,
 * 202), a row not sent (no server key · no connection).
 */
import type { ApiEndpointDefinition } from "../../types/collection.types";
import type { EndpointTemplateResolver } from "../../collections/executeCollectionEndpoint";
import type { RecheckRead, RowVerdict } from "../../collections/save/judgeSave";
import type { SaveRequest } from "../../collections/save/planSave";
import type {
  CatalogDataField,
  CollectionSaveSettings,
} from "../document/types";
import { sameValue } from "./collectionStore";
import type {
  CollectionStore,
  Row,
  RowKey,
  SendOutcome,
  SentEntry,
} from "./collectionStore";
import { CATALOG_NO_CHANGES, type CatalogChangesState } from "./stateTemplate";
import {
  collectionSaveMessage,
  collectionSaveSummary,
  type SaveMessageCode,
} from "./collectionSaveText";

export type RowSaveStatus =
  | "conflict"
  | "failed"
  | "pending"
  | "processing"
  | "noKey"
  | "noConnection"
  | "noVersion";

/** A rows' choice a save · a discard runs on (the selected rows — none = every such row). */
export type SaveScope = "conflicts" | "link" | "pending";


interface SaveCounts {
  saved: number;
  failed: number;
  conflicts: number;
  pending: number;
  skipped: number;
}

export interface RowSaveState {
  status: RowSaveStatus;
  /**
   * Why — a `SaveReasonCode`, or a text shown as it came (`HTTP 422`, a server's · network's own
   * words); `collectionSaveReasonText` words it in the site's language when the row is drawn.
   */
  reason: string;
  /** The reason's detail (a code or a text, as `reason`). */
  detail?: string;
  /** The fields' messages a refusal held. */
  errors?: Readonly<Record<string, readonly string[]>>;
  /** The server's row as last read (a conflict shows its values). */
  server?: Row;
  /** The row is gone on the server. */
  gone?: true;
}

export interface SaveCollectionInfo {
  id: string;
  name?: string;
  schema?: readonly CatalogDataField[];
  /** ADR-313 — the key field's id. */
  keyField?: string;
}

export interface CollectionSaveHost {
  /** The site's language (`ProjectEntry.site.lang`; none set — the environment's) — a save's messages'. */
  language(): string;
  saveSettings(collectionId: string): CollectionSaveSettings | undefined;
  collection(collectionId: string): SaveCollectionInfo | undefined;
  store(collectionId: string): CollectionStore | undefined;
  /** An endpoint by id (the document's prefixed id or the raw one). */
  endpoint(endpointId: string): ApiEndpointDefinition | undefined;
  templateFor(collectionId: string): EndpointTemplateResolver;
  /** A response's rows in the collection's stored values (ADR-313 intake). */
  intake(collectionId: string, items: unknown): Row[];
  /** The components' item keys → the store's keys (`shownIndex`). */
  storeKeys(collectionId: string, keys: readonly string[]): RowKey[];
  /** The next sequence (a save's answer wins over a load that started before it). */
  nextAt(): number;
  reload(collectionId: string): Promise<void>;
  /** The collection's whole rows are here (a row not in them is 「none」). */
  wholeComplete(collectionId: string): boolean;
  /** The rows · the save states changed: the lists and the `changes` readers read again. */
  refresh(collectionId: string): void;
  fetch?: typeof fetch;
}

export interface SaveResult {
  ok: boolean;
  message: string;
  reason?: string;
}

interface CollectionSaveState {
  saving: boolean;
  rows: Map<RowKey, RowSaveState>;
  /** A 415 to a gzip body: plain bodies for the rest of the session. */
  gzipOff?: boolean;
  /** Each create's idempotency key (the same on a resend). */
  idempotency: Map<RowKey, string>;
}

const loadModules = () =>
  Promise.all([
    import("../../collections/save/planSave"),
    import("../../collections/save/sendSave"),
    import("../../collections/save/judgeSave"),
    import("../../collections/intake/parseJsonLossless"),
    import("../../collections/intake/outgoing"),
  ]).then(([plan, send, judge, lossless, outgoing]) => ({
    ...plan,
    ...send,
    ...judge,
    ...lossless,
    ...outgoing,
  }));
type Modules = Awaited<ReturnType<typeof loadModules>>;

/** Row requests at once (a rows connection — Decision 3). */
const ROW_REQUESTS_AT_ONCE = 4;

let idempotencySerial = 0;

export class CollectionSaver {
  private readonly states = new Map<string, CollectionSaveState>();

  constructor(private readonly host: CollectionSaveHost) {}

  private state(collectionId: string): CollectionSaveState {
    let state = this.states.get(collectionId);
    if (!state)
      this.states.set(
        collectionId,
        (state = { saving: false, rows: new Map(), idempotency: new Map() }),
      );
    return state;
  }

  /** The rows held by a send waiting for its answer (`unknown` — a lost answer, 202). */
  private sendingKeys(store: CollectionStore): Set<RowKey> {
    const keys = new Set<RowKey>();
    for (const ticket of store.sends.values())
      for (const entry of ticket.entries) keys.add(entry.key);
    return keys;
  }

  /** A row status whose change went (saved · dropped) goes with it. */
  private prune(collectionId: string, store: CollectionStore): void {
    const state = this.states.get(collectionId);
    if (!state) return;
    const sending = this.sendingKeys(store);
    for (const key of [...state.rows.keys()])
      if (!store.changes.has(key) && !sending.has(key)) state.rows.delete(key);
  }

  /** A row's save status (for its edit mark). */
  rowState(collectionId: string, key: RowKey): RowSaveState | undefined {
    return this.states.get(collectionId)?.rows.get(key);
  }

  /** `{{ changes.<id> }}` — the save bar's values. */
  changes(collectionId: string): CatalogChangesState {
    const store = this.host.store(collectionId);
    if (!store || !this.host.saveSettings(collectionId))
      return store?.changes.size
        ? { ...CATALOG_NO_CHANGES, count: store.changes.size }
        : CATALOG_NO_CHANGES;
    this.prune(collectionId, store);
    const state = this.states.get(collectionId);
    const sending = this.sendingKeys(store);
    let conflicts = 0;
    let failed = 0;
    for (const row of state?.rows.values() ?? [])
      if (row.status === "conflict") conflicts += 1;
      else if (row.status === "failed") failed += 1;
    // (The rows waiting for their result are the open sends' — whatever their status reads.)
    const pending = sending.size;
    let sendable = false;
    let droppable = false;
    let unlinked = 0;
    for (const [key, change] of store.changes) {
      if (change.kind === "unlinked") unlinked += 1;
      if (sending.has(key)) continue;
      droppable = true;
      if (
        change.kind !== "unlinked" &&
        state?.rows.get(key)?.status !== "conflict"
      )
        sendable = true;
    }
    const saving = !!state?.saving;
    return {
      count: store.changes.size,
      saving,
      pending,
      conflicts,
      failed,
      canSave: !saving && (sendable || pending > 0),
      canDiscard: !saving && droppable,
      unlinked,
      hasConflicts: !saving && conflicts > 0,
      hasUnlinked: !saving && unlinked > 0,
      hasPending: !saving && sending.size > 0,
    };
  }

  /**
   * The key field's key (`id` …) — the collection's `keyField`, else a schema field named `id` ·
   * `key` · `value` (the item key's order — ADR-313 Decision 6).
   */
  private keyFieldKey(collection: SaveCollectionInfo | undefined): string {
    const schema = collection?.schema ?? [];
    const declared = collection?.keyField
      ? schema.find((field) => field.id === collection.keyField)?.key
      : undefined;
    return (
      declared ??
      ["id", "key", "value"].find((key) =>
        schema.some((field) => field.key === key),
      ) ??
      "id"
    );
  }

  private versionKey(
    save: CollectionSaveSettings,
    collection: SaveCollectionInfo | undefined,
  ): string | undefined {
    const conflict = save.conflict;
    return conflict?.by === "version"
      ? collection?.schema?.find((field) => field.id === conflict.fieldId)?.key
      : undefined;
  }


  /** Reads a row again by key: the recheck connection, else the collection's load (Decision 6). */
  private async readRow(
    collectionId: string,
    key: RowKey,
    save: CollectionSaveSettings,
    modules: Modules,
    reloaded: { done: boolean },
  ): Promise<RecheckRead> {
    const store = this.host.store(collectionId);
    if (save.conflict?.by === "recheck") {
      const endpoint = this.host.endpoint(save.conflict.endpointId);
      if (!endpoint) return { state: "unknown" };
      const read = await modules.readSavedRow(key, {
        endpoint,
        resolve: this.host.templateFor(collectionId),
        fetch: this.host.fetch,
        parse: modules.parseJsonLossless,
        keyFieldKey: this.keyFieldKey(this.host.collection(collectionId)),
      });
      if (read.state !== "found")
        return { state: read.state === "absent" ? "absent" : "unknown" };
      const [row] = this.host.intake(collectionId, [read.row]);
      return row ? { state: "found", row } : { state: "unknown" };
    }
    // (No one-row read: the collection's load again — a row it lacks is 「none」 only when the
    //  rows here are the whole.)
    if (!reloaded.done) {
      reloaded.done = true;
      try {
        await this.host.reload(collectionId);
      } catch {
        return { state: "unknown" };
      }
    }
    // (Found = in an answer of this load — a row the store still holds for a change is no evidence.)
    const listed =
      !!store &&
      [...store.results.values()].some((result) => result.keys.includes(key));
    const row = listed ? store?.rows.get(key)?.row : undefined;
    if (row) return { state: "found", row };
    return this.host.wholeComplete(collectionId)
      ? { state: "absent" }
      : { state: "unknown" };
  }

  /** A verdict → the store's outcome (the server's values in stored form) and the row's status. */
  private apply(
    collectionId: string,
    verdict: RowVerdict,
    outcomes: SendOutcome[],
    serverRows: Map<RowKey, Row>,
    /** The verdict's rows are a row read again — already in stored values (no second intake). */
    stored = false,
  ): void {
    const state = this.state(collectionId);
    const canonical = (row: Row | undefined): Row | undefined =>
      !row ? undefined : stored ? row : this.host.intake(collectionId, [row])[0];
    if (verdict.result === "confirmed") {
      const row = canonical(verdict.row);
      const extra = canonical(verdict.extra);
      outcomes.push({
        key: verdict.key,
        result: "confirmed",
        ...(row ? { row } : {}),
        ...(extra ? { extra } : {}),
        ...(verdict.serverKey !== undefined
          ? { serverKey: verdict.serverKey }
          : {}),
      });
      state.rows.delete(verdict.key);
      return;
    }
    if (verdict.result === "rejected") {
      outcomes.push({ key: verdict.key, result: "rejected" });
      if (verdict.server) serverRows.set(verdict.key, verdict.server);
      state.rows.set(verdict.key, {
        status: verdict.conflict ? "conflict" : "failed",
        reason: verdict.reason,
        ...(verdict.errors ? { errors: verdict.errors } : {}),
        ...(verdict.server ? { server: verdict.server } : {}),
        ...(verdict.gone ? { gone: true as const } : {}),
      });
      return;
    }
    outcomes.push({ key: verdict.key, result: "unknown" });
    state.rows.set(verdict.key, {
      status: verdict.reason === "processing" ? "processing" : "pending",
      reason: verdict.reason === "processing" ? "processing" : "pending",
      ...(verdict.reason !== "processing" && verdict.detail
        ? { detail: verdict.detail }
        : {}),
    });
  }

  /**
   * ADR-324 사용자 결정 4 — 「내 값으로 다시 저장」: the conflicted rows (the given · all) take the
   * server's row as their base (`rebase`), so the next send carries its version.
   */
  private rebaseConflicts(
    collectionId: string,
    keys?: readonly RowKey[],
  ): RowKey[] {
    const store = this.host.store(collectionId);
    const state = this.states.get(collectionId);
    if (!store || !state) return [];
    const chosen: RowKey[] = [];
    for (const [key, row] of state.rows) {
      if (row.status !== "conflict" || (keys && !keys.includes(key))) continue;
      const server = row.server ?? store.rows.get(key)?.row ?? undefined;
      if (!server || row.gone) continue;
      store.rebase(key, server);
      state.rows.delete(key);
      chosen.push(key);
    }
    return chosen;
  }

  /** 「이 행에 적용」: one unlinked row and one server row among the keys. */
  private link(collectionId: string, keys: readonly RowKey[]): SaveResult {
    const store = this.host.store(collectionId);
    if (!store) return { ok: false, message: this.message("noChanges") };
    const unlinked = keys.filter(
      (key) => store.changes.get(key)?.kind === "unlinked",
    );
    const servers = keys.filter(
      (key) =>
        store.changes.get(key)?.kind !== "unlinked" && store.rows.get(key)?.row,
    );
    if (unlinked.length !== 1 || servers.length !== 1)
      return {
        ok: false,
        message: this.message("linkPick"),
      };
    store.link(unlinked[0]!, servers[0]!);
    this.host.refresh(collectionId);
    return {
      ok: true,
      message: this.message("linked"),
    };
  }

  /**
   * The rows waiting for their result (the given · all) leave their sends as not applied — the
   * viewer's choice (breakdown 「결과 확인 필요」: 다시 저장 · 취소): their changes stay, to be sent
   * again or dropped. Returns the rows closed.
   */
  private closePending(
    collectionId: string,
    store: CollectionStore,
    keys?: readonly RowKey[],
  ): RowKey[] {
    const state = this.states.get(collectionId);
    const closed: RowKey[] = [];
    for (const ticket of [...store.sends.values()]) {
      const outcomes: SendOutcome[] = [];
      for (const entry of ticket.entries) {
        if (keys && !keys.includes(entry.key)) continue;
        outcomes.push({ key: entry.key, result: "rejected" });
        closed.push(entry.key);
        state?.rows.delete(entry.key);
      }
      if (outcomes.length)
        store.settle(ticket.id, outcomes, this.host.nextAt());
    }
    return closed;
  }

  /**
   * The 「변경 취소」 Do: the changes not being sent (the given rows · the conflicted ones) — or,
   * `pending`, the rows waiting for their result: the wait ends and their changes go.
   */
  discard(
    collectionId: string,
    shownKeys: readonly string[] | undefined,
    scope?: "conflicts" | "pending",
  ): void {
    const store = this.host.store(collectionId);
    if (!store) return;
    const keys = shownKeys
      ? this.host.storeKeys(collectionId, shownKeys)
      : undefined;
    if (scope === "pending") {
      if (this.states.get(collectionId)?.saving) return;
      const closed = this.closePending(collectionId, store, keys);
      if (closed.length) store.discard(closed);
      this.host.refresh(collectionId);
      return;
    }
    const sending = this.sendingKeys(store);
    const state = this.states.get(collectionId);
    const drop = [...store.changes.keys()].filter(
      (key) =>
        !sending.has(key) &&
        (!keys || keys.includes(key)) &&
        (scope !== "conflicts" || state?.rows.get(key)?.status === "conflict"),
    );
    if (drop.length) store.discard(drop);
    for (const key of drop) state?.rows.delete(key);
    this.host.refresh(collectionId);
  }

  /** Whether some collection holds a change not saved (the page's 「leave?」 warning). */
  anyUnsaved(collectionIds: Iterable<string>): boolean {
    for (const id of collectionIds)
      if (
        this.host.saveSettings(id) &&
        (this.host.store(id)?.changes.size ?? 0) > 0
      )
        return true;
    return false;
  }

  /** The 「변경 저장」 Do. */
  async save(
    collectionId: string,
    choice?: { scope: SaveScope; keys?: readonly string[] },
  ): Promise<SaveResult> {
    const save = this.host.saveSettings(collectionId);
    if (!save)
      return {
        ok: false,
        message: this.message("saveOff"),
      };
    const store = this.host.store(collectionId);
    const state = this.state(collectionId);
    if (state.saving) return { ok: false, message: this.message("saving") };
    const chosen = choice?.keys
      ? this.host.storeKeys(collectionId, choice.keys)
      : undefined;
    if (choice?.scope === "link") return this.link(collectionId, chosen ?? []);
    if (!store) return { ok: true, message: this.message("noChanges") };
    let only: Set<RowKey> | undefined;
    if (choice?.scope === "conflicts") {
      only = new Set(this.rebaseConflicts(collectionId, chosen));
      if (!only.size) return { ok: true, message: this.message("noConflicts") };
    }
    // (「다시 저장」 — the waiting rows are closed as not applied and go again: the server may
    //  have applied the first one — a second create is the viewer's choice (a versioned update ·
    //  an idempotency key is refused · answered as the first by the server).)
    if (choice?.scope === "pending") {
      only = new Set(this.closePending(collectionId, store, chosen));
      if (!only.size)
        return { ok: true, message: this.message("noPending") };
    }
    state.saving = true;
    this.host.refresh(collectionId);
    try {
      const counts = await this.run(collectionId, save, store, state, only);
      // (The rows still waiting for their result — this save's and the ones it could not check.)
      counts.pending = this.sendingKeys(store).size;
      return this.summary(counts);
    } finally {
      state.saving = false;
      this.prune(collectionId, store);
      this.host.refresh(collectionId);
    }
  }

  private async run(
    collectionId: string,
    save: CollectionSaveSettings,
    store: CollectionStore,
    state: CollectionSaveState,
    only: ReadonlySet<RowKey> | undefined,
  ): Promise<SaveCounts> {
    const modules = await loadModules();
    const collection = this.host.collection(collectionId);
    const keyFieldKey = this.keyFieldKey(collection);
    const carriesKey = (entry: SentEntry) =>
      entry.kind === "insert" &&
      entry.row[keyFieldKey] !== undefined &&
      entry.row[keyFieldKey] !== null &&
      entry.row[keyFieldKey] !== "";
    const versionKey = this.versionKey(save, collection);
    const reloaded = { done: false };
    const counts: SaveCounts = {
      saved: 0,
      failed: 0,
      conflicts: 0,
      pending: 0,
      skipped: 0,
    };

    // (1 — 결과 확인: the rows waiting for their result are read again first.)
    for (const ticket of [...store.sends.values()]) {
      const outcomes: SendOutcome[] = [];
      const serverRows = new Map<RowKey, Row>();
      for (const entry of ticket.entries) {
        if (only && !only.has(entry.key)) continue;
        if (entry.kind === "insert" && !carriesKey(entry)) continue;
        const read = await this.readRow(
          collectionId,
          entry.key,
          save,
          modules,
          reloaded,
        );
        let verdict = modules.judgeRecheck(entry, read, versionKey);
        // (202: a row still as it was may yet be processed — not 「not applied」.)
        if (
          state.rows.get(entry.key)?.status === "processing" &&
          verdict.result === "rejected" &&
          "notApplied" in verdict &&
          verdict.notApplied
        )
          verdict = { key: entry.key, result: "unknown", reason: "processing" };
        this.apply(collectionId, verdict, outcomes, serverRows, true);
      }
      if (outcomes.length)
        store.settle(ticket.id, outcomes, this.host.nextAt());
      this.writeServerRows(store, serverRows);
      // (A row a check settled: saved, or a conflict to choose for — a row found not applied
      //  goes again below.)
      for (const outcome of outcomes)
        if (outcome.result === "confirmed") counts.saved += 1;
        else if (state.rows.get(outcome.key)?.status === "conflict")
          counts.conflicts += 1;
    }

    // (2 — what goes: every change not waiting, not unlinked, not a conflict the viewer has not
    //  chosen for.)
    const sending = this.sendingKeys(store);
    const keys = new Set<RowKey>();
    for (const [key, change] of store.changes) {
      if (sending.has(key) || change.kind === "unlinked") continue;
      if (only && !only.has(key)) continue;
      if (state.rows.get(key)?.status === "conflict") continue;
      keys.add(key);
    }
    // (3 — Decision 4: the version the first edit saw against the row here now — a later load
    //  brought another user's version: a conflict, never sent.)
    if (versionKey)
      for (const key of [...keys]) {
        const change = store.changes.get(key);
        const base =
          change?.kind === "update" || change?.kind === "remove"
            ? change.baseRow
            : undefined;
        const now = store.rows.get(key)?.row;
        if (!base || !now) continue;
        if (
          now[versionKey] !== undefined &&
          String(now[versionKey]) !== String(base[versionKey])
        ) {
          keys.delete(key);
          state.rows.set(key, {
            status: "conflict",
            reason: "changedFirst",
            server: now,
          });
          counts.conflicts += 1;
        }
      }
    // (4 — the recheck connection: read each row right before sending; another value = conflict.)
    const rechecked = new Map<RowKey, Row>();
    if (save.conflict?.by === "recheck") {
      const endpoint = this.host.endpoint(save.conflict.endpointId);
      for (const key of [...keys]) {
        const change = store.changes.get(key);
        if (change?.kind !== "update" && change?.kind !== "remove") continue;
        const base = change.baseRow;
        if (!base || !store.isServerKey(key)) continue;
        const read = endpoint
          ? await modules.readSavedRow(key, {
              endpoint,
              resolve: this.host.templateFor(collectionId),
              fetch: this.host.fetch,
              parse: modules.parseJsonLossless,
              keyFieldKey,
            })
          : ({ state: "unknown", reason: "recheckNoConnection" } as const);
        if (read.state === "unknown") {
          keys.delete(key);
          state.rows.set(key, {
            status: "failed",
            reason: "recheckFailed",
            detail: read.reason,
          });
          counts.failed += 1;
          continue;
        }
        if (read.state === "absent") {
          keys.delete(key);
          if (change.kind === "remove") {
            // (Already gone: the remove reached its goal — settled as saved.)
            const ticket = store.beginSend("all", new Set([key]));
            if (ticket)
              store.settle(
                ticket,
                [{ key, result: "confirmed" }],
                this.host.nextAt(),
              );
            counts.saved += 1;
          } else {
            state.rows.set(key, {
              status: "conflict",
              reason: "goneOnServer",
              gone: true,
            });
            counts.conflicts += 1;
          }
          continue;
        }
        const [row] = this.host.intake(collectionId, [read.row]);
        const fields =
          change.kind === "update"
            ? Object.keys(change.fields)
            : Object.keys(base);
        const moved =
          !row || fields.some((field) => !sameValue(row[field], base[field]));
        if (moved) {
          keys.delete(key);
          if (row) store.writeServerRow(key, row, this.host.nextAt());
          state.rows.set(key, {
            status: "conflict",
            reason: "changedFirst",
            ...(row ? { server: row } : {}),
          });
          counts.conflicts += 1;
          continue;
        }
        rechecked.set(key, read.row as Row);
      }
    }
    if (!keys.size) return counts;
    const ticketId = store.beginSend("all", keys);
    if (!ticketId) return counts;
    const entries = store.sends.get(ticketId)!.entries;
    const byKey = new Map(entries.map((entry) => [entry.key, entry] as const));
    const schema = (collection?.schema ?? []) as CatalogDataField[];
    const plan = modules.planSave({
      entries,
      save,
      schema,
      keyFieldKey,
      isServerKey: (key) => store.isServerKey(key),
      serverKeyOf: (key, row) => row[keyFieldKey] ?? key,
      outgoing: (record) =>
        modules.outgoingRecord(record, schema as never, "json") as Record<
          string,
          unknown
        >,
      rechecked,
      idempotencyKeyOf: (key) => {
        let value = state.idempotency.get(key);
        if (!value)
          state.idempotency.set(
            key,
            (value = `save-${Date.now().toString(36)}-${(idempotencySerial += 1)}`),
          );
        return value;
      },
    });
    const outcomes: SendOutcome[] = [];
    const serverRows = new Map<RowKey, Row>();
    for (const skipped of plan.skipped) {
      outcomes.push({ key: skipped.key, result: "rejected" });
      state.rows.set(skipped.key, {
        status: skipped.reason,
        reason: skipped.reason,
      });
      counts.skipped += 1;
    }
    let stopped = false;
    let afterward = false;
    const runOne = async (request: SaveRequest): Promise<void> => {
      if (stopped) {
        for (const key of request.keys) {
          outcomes.push({ key, result: "rejected" });
          state.rows.set(key, {
            status: "failed",
            reason: "authStopped",
          });
        }
        return;
      }
      const endpoint = this.host.endpoint(request.endpointId);
      if (!endpoint) {
        for (const key of request.keys) {
          outcomes.push({ key, result: "rejected" });
          state.rows.set(key, { status: "failed", reason: "noEndpoint" });
        }
        return;
      }
      const sendOnce = () =>
        modules.sendSaveRequest(request, {
          endpoint,
          resolve: this.host.templateFor(collectionId),
          gzip:
            save.send.shape === "batch" && !!save.send.gzip && !state.gzipOff,
          fetch: this.host.fetch,
          stringify: modules.stringifyJsonLossless,
          parse: modules.parseJsonLossless,
        });
      let sent = await sendOnce();
      if (sent.gzipRefused) state.gzipOff = true;
      if (sent.notSent) {
        for (const key of request.keys) {
          outcomes.push({ key, result: "rejected" });
          state.rows.set(key, {
            status: sent.wrongMethod ? "noConnection" : "failed",
            reason: sent.notSent,
          });
        }
        return;
      }
      // (A create whose answer was lost goes again only with its idempotency key — the same one.)
      if (
        "lost" in sent.answer &&
        request.kind === "create" &&
        request.idempotency
      )
        sent = await sendOnce();
      const context = {
        entries: byKey,
        keyFieldKey,
        ...(versionKey ? { versionKey } : {}),
        dataPath: endpoint.responseMapping?.dataPath,
        errorsPath: endpoint.responseMapping?.errorsPath,
        atomic: save.send.shape === "batch" && save.send.atomic,
      };
      for (let verdict of modules.judgeSaveResponse(
        request,
        sent.answer,
        context,
      )) {
        const entry = byKey.get(verdict.key);
        let stored = false;
        // (A lost answer · a 5xx: the row read again decides — never sent again blindly.)
        if (
          verdict.result === "unknown" &&
          verdict.reason === "lost" &&
          entry &&
          (entry.kind !== "insert" || carriesKey(entry))
        ) {
          // (A create is read again only when its row carries its key — a key the server makes
          //  cannot be matched: it waits for 결과 확인.)
          const read = await this.readRow(
            collectionId,
            entry.key,
            save,
            modules,
            reloaded,
          );
          verdict = modules.judgeRecheck(entry, read, versionKey);
          stored = true;
        }
        if (verdict.result === "rejected" && verdict.stop) stopped = true;
        // (A conflict's server row: read again when the answer did not carry it.)
        if (
          verdict.result === "rejected" &&
          verdict.conflict &&
          !verdict.server &&
          !verdict.gone &&
          entry
        ) {
          const read = await this.readRow(
            collectionId,
            entry.key,
            save,
            modules,
            reloaded,
          );
          if (read.state === "found")
            verdict = { ...verdict, server: read.row };
          else if (read.state === "absent")
            verdict = { ...verdict, gone: true };
        }
        // (Breakdown 「응답을 잃었을 때」 — a versioned update sent again (by the browser on a
        //  dropped connection, or after a lost answer) returns a conflict after the first one was
        //  applied: the server's row holding my values is done, not a conflict.)
        const conflictRow =
          verdict.result === "rejected" && verdict.conflict
            ? verdict.server
            : undefined;
        if (
          conflictRow &&
          entry?.kind === "update" &&
          Object.entries(entry.fields).every(([field, sent]) =>
            sameValue(conflictRow[field], sent.value),
          )
        ) {
          verdict = {
            key: entry.key,
            result: "confirmed",
            row: conflictRow,
            extra: conflictRow,
          };
          stored = true;
        }
        if (
          verdict.result === "confirmed" &&
          (verdict.serverKey === null || verdict.versionUnknown)
        )
          afterward = true;
        this.apply(collectionId, verdict, outcomes, serverRows, stored);
      }
    };
    if (plan.requests.length === 1 || plan.requests[0]?.kind === "batch")
      for (const request of plan.requests) await runOne(request);
    else {
      // (Rows: removes · updates · creates in order, a few at once — every one is sent (사용자 결정 3).)
      const queue = [...plan.requests];
      const workers = Array.from(
        { length: Math.min(ROW_REQUESTS_AT_ONCE, queue.length) },
        async () => {
          for (let next = queue.shift(); next; next = queue.shift())
            await runOne(next);
        },
      );
      await Promise.all(workers);
    }
    store.settle(ticketId, outcomes, this.host.nextAt());
    this.writeServerRows(store, serverRows);
    for (const outcome of outcomes)
      if (outcome.result === "confirmed") counts.saved += 1;
      else if (outcome.result === "unknown") counts.pending += 1;
      else if (state.rows.get(outcome.key)?.status === "conflict")
        counts.conflicts += 1;
      else if (state.rows.get(outcome.key)?.status === "failed")
        counts.failed += 1;
      else if (
        state.rows.get(outcome.key)?.status === "noConnection" &&
        !plan.skipped.some((skipped) => skipped.key === outcome.key)
      )
        counts.skipped += 1;
    // (A create the server keyed without telling, a version the answer did not give: the
    //  collection's load brings the server's rows — the changes stay over them.)
    if (afterward && !reloaded.done)
      await this.host.reload(collectionId).catch(() => undefined);
    return counts;
  }

  private writeServerRows(
    store: CollectionStore,
    rows: ReadonlyMap<RowKey, Row>,
  ): void {
    for (const [key, row] of rows)
      store.writeServerRow(key, row, this.host.nextAt());
  }

  /** A save message in the site's language. */
  private message(code: SaveMessageCode): string {
    return collectionSaveMessage(code, this.host.language());
  }

  private summary(counts: SaveCounts): SaveResult {
    const line = collectionSaveSummary(counts, this.host.language());
    const ok =
      !counts.failed && !counts.conflicts && !counts.pending && !counts.skipped;
    return {
      ok,
      message: line || this.message("noChanges"),
      ...(ok ? {} : { reason: line }),
    };
  }
}

