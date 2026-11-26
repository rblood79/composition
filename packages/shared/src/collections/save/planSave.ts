/**
 * ADR-324 Decision 2 · 3 · 4 — the requests a save sends: from the sent changes (ADR-325
 * `SentEntry` — each row's fields as they were when the save began, its base row) and the
 * connection's declared capabilities. Pure: no fetch, no session (unit-tested on its own).
 *
 * - An update sends its key and changed fields (a 「row whole」 connection the whole row — over the
 *   row just read when the conflict check is a recheck), a create its row, a remove its key.
 * - Values go back to their fields' declared notation (ADR-313 `outgoingRecord`), and only the
 *   fields sent — nothing the server did not get is added.
 * - The version a versioned connection carries is the base row's (the one the first edit saw).
 * - An update · a remove of a row with no server identity is not sent (`noKey`); a kind of change
 *   the connection has no endpoint for stays (`noConnection`); on a versioned connection, one whose
 *   base row holds no version is not sent (`noVersion` — it would go unconditioned and overwrite
 *   another user's change).
 */
import type {
  CollectionSaveSettings,
  CatalogDataField,
} from "../../catalog/document/types";
import type {
  Row,
  RowKey,
  SentEntry,
} from "../../catalog/runtime/collectionStore";

/** One request: what it sends and the rows it answers for. */
export type SaveRequest =
  | {
      kind: "batch";
      endpointId: string;
      body: BatchBody;
      /** The batch item's reference → the row key (an update · remove by key, a create by `ref`). */
      refs: ReadonlyMap<string, RowKey>;
      keys: readonly RowKey[];
    }
  | {
      kind: "update" | "remove";
      endpointId: string;
      key: RowKey;
      /** The update's body (fields — with the version when sent in the body); a remove has none. */
      body?: Record<string, unknown>;
      /** `If-Match` (an entity tag — quoted). */
      ifMatch?: string;
      /** A remove's version as a query parameter (`?version=`) when not an `If-Match`. */
      versionQuery?: { name: string; value: string };
      keys: readonly RowKey[];
    }
  | {
      kind: "create";
      endpointId: string;
      key: RowKey;
      body: Record<string, unknown>;
      /** The idempotency key — a header or a body field, the same on a resend. */
      idempotency?: { in: "header" | "body"; name: string; value: string };
      keys: readonly RowKey[];
    };

export interface BatchBody {
  updates?: { id: unknown; version?: unknown; set: Record<string, unknown> }[];
  creates?: { ref: string; values: Record<string, unknown> }[];
  deletes?: { id: unknown; version?: unknown }[];
}

export type SaveSkipReason = "noKey" | "noConnection" | "noVersion";

export interface SavePlan {
  requests: SaveRequest[];
  /** Rows not sent, and why (their changes stay). */
  skipped: { key: RowKey; reason: SaveSkipReason }[];
}

export interface SavePlanInput {
  entries: readonly SentEntry[];
  save: CollectionSaveSettings;
  schema: readonly CatalogDataField[];
  /** The key field's key (`id` …) — the field the row's server key is written in. */
  keyFieldKey: string;
  /** Whether a store key is a server identity (ADR-325 `isServerKey`). */
  isServerKey: (key: RowKey) => boolean;
  /** A row's server key value as the row holds it (its key field — a number stays a number). */
  serverKeyOf: (key: RowKey, row: Row) => unknown;
  /** Fields back to their notation (`outgoingRecord`). */
  outgoing: (record: Record<string, unknown>) => Record<string, unknown>;
  /** A 「row whole」 update over a recheck: the row just read for that key (raw, before intake). */
  rechecked?: ReadonlyMap<RowKey, Row>;
  /** The idempotency key of a create (the same on a resend — the session keeps it). */
  idempotencyKeyOf?: (key: RowKey) => string;
}

/** Strips the save's own fields from an outgoing row (keys the server did not get stay out). */
function only(
  record: Record<string, unknown>,
  keys: readonly string[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (key in record) out[key] = record[key];
  return out;
}

/** An entity tag for `If-Match` (RFC 9110 §8.8.3 — quoted unless it already is). */
export function entityTag(version: unknown): string {
  const text = String(version);
  return /^(W\/)?".*"$/.test(text) ? text : `"${text}"`;
}

export function planSave(input: SavePlanInput): SavePlan {
  const { save, schema } = input;
  const fieldKey = (id: string) => schema.find((field) => field.id === id)?.key;
  const versionKey =
    save.conflict?.by === "version"
      ? fieldKey(save.conflict.fieldId)
      : undefined;
  /** A versioned connection carries the version as `If-Match`, else in the body (a remove: the query). */
  const versionAsHeader =
    save.conflict?.by === "version" && save.conflict.send === "ifMatch";
  const skipped: SavePlan["skipped"] = [];
  const requests: SaveRequest[] = [];
  const outgoing = (record: Record<string, unknown>) =>
    only(input.outgoing(record), Object.keys(record));
  const versionOf = (row: Row) =>
    versionKey !== undefined ? row[versionKey] : undefined;
  /** A versioned connection's update · remove whose base row came without its version. */
  const lacksVersion = (row: Row) => {
    if (versionKey === undefined) return false;
    const version = row[versionKey];
    return version === undefined || version === null || version === "";
  };

  if (save.send.shape === "batch") {
    const body: BatchBody = {};
    const refs = new Map<string, RowKey>();
    const keys: RowKey[] = [];
    let serial = 0;
    for (const entry of input.entries) {
      if (entry.kind !== "insert" && !input.isServerKey(entry.key)) {
        skipped.push({ key: entry.key, reason: "noKey" });
        continue;
      }
      if (entry.kind !== "insert" && lacksVersion(entry.baseRow)) {
        skipped.push({ key: entry.key, reason: "noVersion" });
        continue;
      }
      keys.push(entry.key);
      if (entry.kind === "update") {
        const id = input.serverKeyOf(entry.key, entry.baseRow);
        refs.set(String(id), entry.key);
        const set: Record<string, unknown> = {};
        for (const [field, sent] of Object.entries(entry.fields))
          set[field] = sent.value;
        (body.updates ??= []).push({
          id,
          ...(versionKey !== undefined
            ? { version: versionOf(entry.baseRow) }
            : {}),
          set: outgoing(set),
        });
      } else if (entry.kind === "remove") {
        const id = input.serverKeyOf(entry.key, entry.baseRow);
        refs.set(String(id), entry.key);
        (body.deletes ??= []).push({
          id,
          ...(versionKey !== undefined
            ? { version: versionOf(entry.baseRow) }
            : {}),
        });
      } else {
        const ref = `new-${(serial += 1)}`;
        refs.set(ref, entry.key);
        (body.creates ??= []).push({ ref, values: outgoing({ ...entry.row }) });
      }
    }
    if (keys.length)
      requests.push({
        kind: "batch",
        endpointId: save.send.endpointId,
        body,
        refs,
        keys,
      });
    return { requests, skipped };
  }

  // (Rows: removes first, then updates, then creates — the order the breakdown names.)
  const send = save.send;
  const order = { remove: 0, update: 1, insert: 2 } as const;
  const sorted = [...input.entries].sort(
    (a, b) => order[a.kind] - order[b.kind],
  );
  for (const entry of sorted) {
    if (entry.kind === "insert") {
      if (!send.create) {
        skipped.push({ key: entry.key, reason: "noConnection" });
        continue;
      }
      const body = outgoing({ ...entry.row });
      const idem =
        save.idempotency && input.idempotencyKeyOf
          ? { ...save.idempotency, value: input.idempotencyKeyOf(entry.key) }
          : undefined;
      if (idem && idem.in !== "header") body[idem.name] = idem.value;
      requests.push({
        kind: "create",
        endpointId: send.create.endpointId,
        key: entry.key,
        body,
        ...(idem ? { idempotency: idem } : {}),
        keys: [entry.key],
      });
      continue;
    }
    if (!input.isServerKey(entry.key)) {
      skipped.push({ key: entry.key, reason: "noKey" });
      continue;
    }
    const connection = entry.kind === "update" ? send.update : send.remove;
    if (!connection) {
      skipped.push({ key: entry.key, reason: "noConnection" });
      continue;
    }
    if (lacksVersion(entry.baseRow)) {
      skipped.push({ key: entry.key, reason: "noVersion" });
      continue;
    }
    const version = versionOf(entry.baseRow);
    const versioned = versionKey !== undefined;
    if (entry.kind === "remove") {
      requests.push({
        kind: "remove",
        endpointId: connection.endpointId,
        key: entry.key,
        ...(versioned && versionAsHeader
          ? { ifMatch: entityTag(version) }
          : {}),
        ...(versioned && !versionAsHeader
          ? { versionQuery: { name: versionKey!, value: String(version) } }
          : {}),
        keys: [entry.key],
      });
      continue;
    }
    const changed: Record<string, unknown> = {};
    for (const [field, sent] of Object.entries(entry.fields))
      changed[field] = sent.value;
    let body: Record<string, unknown>;
    if (send.update?.body === "full") {
      // (A whole row: over the row just read (recheck) or the base row, the changed fields only —
      //  another user's other cells are what the server had, not what the screen had.)
      const ground = input.rechecked?.get(entry.key) ?? entry.baseRow;
      const whole = { ...ground, ...changed };
      body = { ...only(input.outgoing(whole), Object.keys(whole)) };
    } else body = outgoing(changed);
    if (versioned && !versionAsHeader) body[versionKey!] = version;
    requests.push({
      kind: "update",
      endpointId: connection.endpointId,
      key: entry.key,
      body,
      ...(versioned && versionAsHeader ? { ifMatch: entityTag(version) } : {}),
      keys: [entry.key],
    });
  }
  return { requests, skipped };
}
