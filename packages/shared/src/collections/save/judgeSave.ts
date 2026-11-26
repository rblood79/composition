/**
 * ADR-324 Decision 5 · 6 — a save's answer judged row by row: confirmed (the server took it),
 * rejected (it did not — the change stays, with why) or unknown (it may have — the row waits for a
 * check). Pure: the response comes read (status · headers · parsed body) or lost.
 *
 * - 2xx is not 「saved」 by itself: 200 · 201 · 204 · 205 finished, 202 only accepted (processing),
 *   any other 2xx unknown. The response's field errors (`errorsPath`) are read before the status —
 *   an error in a 200 is a refusal.
 * - A create's server key: the response row's key field, else the `Location` header's last path
 *   segment, else none (`serverKey: null` — never the key the client sent).
 * - A lost answer is judged by reading the row again (`judgeRecheck`) — never sent again blindly.
 */
import { sameValue } from "../../catalog/runtime/collectionStore";
import type {
  Row,
  RowKey,
  SentEntry,
} from "../../catalog/runtime/collectionStore";
import type { SaveRequest } from "./planSave";

export interface SaveResponse {
  status: number;
  headers: { get(name: string): string | null };
  /** The parsed JSON body; undefined = none · not JSON. */
  body: unknown;
}
/** A request whose answer never came (network error · timeout). */
export interface SaveLost {
  lost: true;
  reason: string;
}

export type RowVerdict =
  | {
      key: RowKey;
      result: "confirmed";
      /** The values the server answered for the sent fields (absent = the sent values). */
      row?: Row;
      /** Values the server answered beyond the sent fields (the new version …). */
      extra?: Row;
      /** A create's key: the server's, `null` = made but not told. */
      serverKey?: RowKey | null;
      /** A versioned row whose new version the answer did not give — read it again. */
      versionUnknown?: true;
    }
  | {
      key: RowKey;
      result: "rejected";
      reason: string;
      /** Another user's change stands in the way (409 · 412 · a version error · 404 of an update). */
      conflict?: true;
      /** The row is gone on the server (404). */
      gone?: true;
      /** The fields' messages (`errorsPath` · a batch's `failed`). */
      errors?: Readonly<Record<string, readonly string[]>>;
      /** 401 · 403 — the rest of this save is not sent. */
      stop?: true;
      /** A lost answer's check found it not applied (a resend is offered). */
      notApplied?: true;
      /** The server's row as read (a conflict shows it). */
      server?: Row;
    }
  | {
      key: RowKey;
      result: "unknown";
      reason: "processing" | "lost" | "unclear" | "unreadable";
      detail?: string;
    };

export interface JudgeContext {
  /** The rows the request carried (their sent state). */
  entries: ReadonlyMap<RowKey, SentEntry>;
  keyFieldKey: string;
  /** The version field's key (a versioned connection). */
  versionKey?: string;
  /** `responseMapping.dataPath` · `errorsPath` of the request's endpoint. */
  dataPath?: string;
  errorsPath?: string;
  atomic?: boolean;
}

function readPath(value: unknown, path: string | undefined): unknown {
  if (!path?.trim()) return value;
  return path
    .trim()
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current !== null && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : undefined,
      value,
    );
}
const isRow = (value: unknown): value is Row =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** The field errors at `path` (each field → its messages); none = undefined. */
export function fieldErrorsAt(
  body: unknown,
  path: string | undefined,
): Record<string, string[]> | undefined {
  if (!path?.trim()) return undefined;
  const value = readPath(body, path);
  if (!isRow(value)) return undefined;
  const errors: Record<string, string[]> = {};
  for (const [name, messages] of Object.entries(value)) {
    const texts = (Array.isArray(messages) ? messages : [messages]).filter(
      (message): message is string =>
        typeof message === "string" && message.trim() !== "",
    );
    if (texts.length) errors[name] = texts;
  }
  return Object.keys(errors).length ? errors : undefined;
}

/** The `Location` header's last path segment (a created row's key). */
export function locationKey(location: string | null): string | undefined {
  if (!location) return undefined;
  try {
    const path = new URL(location, "http://x/").pathname.replace(/\/+$/, "");
    const last = path.slice(path.lastIndexOf("/") + 1);
    return last ? decodeURIComponent(last) : undefined;
  } catch {
    return undefined;
  }
}

/** An entity tag's value (`"v18"` · `W/"v18"` → `v18`). */
const bareTag = (tag: string) =>
  tag
    .trim()
    .replace(/^W\//, "")
    .replace(/^"(.*)"$/, "$1");

type Finished = 200 | 201 | 204 | 205;
const finished = (status: number): status is Finished =>
  status === 200 || status === 201 || status === 204 || status === 205;

/** A refusal's verdict by status (field errors already read). */
function refused(
  key: RowKey,
  status: number,
  kind: SaveRequest["kind"],
): RowVerdict {
  if (status === 401 || status === 403)
    return { key, result: "rejected", reason: `HTTP ${status}`, stop: true };
  if (status === 409 || status === 412)
    return {
      key,
      result: "rejected",
      reason: `HTTP ${status}`,
      conflict: true,
    };
  if (status === 404 && kind !== "create")
    return {
      key,
      result: "rejected",
      reason: "HTTP 404",
      conflict: true,
      gone: true,
    };
  if (status === 429 || status >= 500)
    return { key, result: "unknown", reason: "lost", detail: `HTTP ${status}` };
  return { key, result: "rejected", reason: `HTTP ${status}` };
}

/** The verdicts of one request's answer. */
export function judgeSaveResponse(
  request: SaveRequest,
  answer: SaveResponse | SaveLost,
  context: JudgeContext,
): RowVerdict[] {
  if ("lost" in answer)
    return request.keys.map((key) => ({
      key,
      result: "unknown",
      reason: "lost",
      detail: answer.reason,
    }));
  const { status, body } = answer;
  const errors = fieldErrorsAt(body, context.errorsPath);
  if (errors)
    return request.keys.map((key) => ({
      key,
      result: "rejected",
      reason: "입력 값 오류",
      errors,
    }));
  if (status === 202)
    return request.keys.map((key) => ({
      key,
      result: "unknown",
      reason: "processing",
    }));
  if (status >= 200 && status < 300 && !finished(status))
    return request.keys.map((key) => ({
      key,
      result: "unknown",
      reason: "unclear",
      detail: `HTTP ${status}`,
    }));
  if (request.kind === "batch") return judgeBatch(request, answer, context);
  const key = request.key;
  if (!finished(status)) {
    // (A batch's failed list shape on a row request too: the version error is a conflict.)
    return [refused(key, status, request.kind)];
  }
  const answered = readPath(body, context.dataPath);
  const row = isRow(answered) ? answered : undefined;
  if (request.kind === "remove") return [{ key, result: "confirmed" }];
  if (request.kind === "update") {
    const entry = context.entries.get(key);
    const sent = entry?.kind === "update" ? Object.keys(entry.fields) : [];
    const values: Record<string, unknown> = {};
    const extra: Record<string, unknown> = {};
    if (row)
      for (const [field, value] of Object.entries(row))
        (sent.includes(field) ? values : extra)[field] = value;
    const etag = answer.headers.get("etag");
    if (context.versionKey && !(context.versionKey in extra) && etag)
      extra[context.versionKey] = bareTag(etag);
    return [
      {
        key,
        result: "confirmed",
        ...(row ? { row: values } : {}),
        ...(Object.keys(extra).length ? { extra } : {}),
        ...(context.versionKey && !(context.versionKey in extra)
          ? { versionUnknown: true as const }
          : {}),
      },
    ];
  }
  // (A create: the response's key first, then `Location` — the sent key is no evidence.)
  const fromBody = row?.[context.keyFieldKey];
  const serverKey =
    (typeof fromBody === "string" && fromBody) || typeof fromBody === "number"
      ? String(fromBody)
      : (locationKey(answer.headers.get("location")) ?? null);
  return [
    {
      key,
      result: "confirmed",
      ...(row ? { row } : {}),
      serverKey,
    },
  ];
}

interface BatchItemAnswer {
  id?: unknown;
  ref?: unknown;
  version?: unknown;
  values?: unknown;
  errors?: unknown;
}

function judgeBatch(
  request: Extract<SaveRequest, { kind: "batch" }>,
  answer: SaveResponse,
  context: JudgeContext,
): RowVerdict[] {
  const body = isRow(answer.body) ? answer.body : undefined;
  const list = (name: string) =>
    Array.isArray(body?.[name]) ? (body![name] as BatchItemAnswer[]) : [];
  const failed = list("failed");
  const refOf = (item: BatchItemAnswer) =>
    request.refs.get(String(item.ref ?? item.id));
  const failedVerdict = (item: BatchItemAnswer, key: RowKey): RowVerdict => {
    const errors = fieldErrorsAt(item, "errors");
    const conflict =
      !!errors && !!context.versionKey && context.versionKey in errors;
    return {
      key,
      result: "rejected",
      reason: "반영 안 됨",
      ...(errors ? { errors } : {}),
      ...(conflict ? { conflict: true as const } : {}),
    };
  };
  if (!finished(answer.status)) {
    // (A refused batch: its `failed` items name the rows; the others are refused with it.)
    const named = new Map<RowKey, RowVerdict>();
    for (const item of failed) {
      const key = refOf(item);
      if (key) named.set(key, failedVerdict(item, key));
    }
    return request.keys.map(
      (key) =>
        named.get(key) ?? refused(key, answer.status, "update"),
    );
  }
  const verdicts = new Map<RowKey, RowVerdict>();
  for (const item of failed) {
    const key = refOf(item);
    if (key) verdicts.set(key, failedVerdict(item, key));
  }
  const confirm = (item: BatchItemAnswer, create: boolean) => {
    const key = refOf(item);
    if (!key) return;
    const values = isRow(item.values) ? item.values : undefined;
    const entry = context.entries.get(key);
    const sent = entry?.kind === "update" ? Object.keys(entry.fields) : [];
    const row: Record<string, unknown> = {};
    const extra: Record<string, unknown> = {};
    if (values)
      for (const [field, value] of Object.entries(values))
        (sent.includes(field) || create ? row : extra)[field] = value;
    if (context.versionKey && item.version !== undefined)
      (create ? row : extra)[context.versionKey] = item.version;
    const id = item.id;
    verdicts.set(key, {
      key,
      result: "confirmed",
      ...(Object.keys(row).length ? { row } : {}),
      ...(Object.keys(extra).length ? { extra } : {}),
      ...(create
        ? {
            serverKey:
              (typeof id === "string" && id) || typeof id === "number"
                ? String(id)
                : null,
          }
        : {}),
      ...(!create && context.versionKey && item.version === undefined
        ? { versionUnknown: true as const }
        : {}),
    });
  };
  for (const item of list("updated")) confirm(item, false);
  for (const item of list("deleted")) confirm(item, false);
  for (const item of list("created")) confirm(item, true);
  const answeredAll = request.keys.every((key) => verdicts.has(key));
  if (context.atomic) {
    const mixed =
      failed.length > 0 &&
      [...verdicts.values()].some((verdict) => verdict.result === "confirmed");
    // (An atomic batch that both took and refused rows broke its own declaration — check them.)
    if (mixed)
      return request.keys.map((key) => ({
        key,
        result: "unknown",
        reason: "unclear",
        detail: "원자적 묶음이 일부만 반영",
      }));
    if (failed.length)
      return request.keys.map(
        (key) =>
          verdicts.get(key) ?? {
            key,
            result: "rejected",
            reason: "묶음이 반영되지 않음",
          },
      );
    if (!answeredAll)
      // (No body or items missing: an atomic batch that finished took all of them.)
      return request.keys.map((key) => {
        const held = verdicts.get(key);
        if (held) return held;
        const entry = context.entries.get(key);
        return {
          key,
          result: "confirmed",
          ...(entry?.kind === "insert" ? { serverKey: null } : {}),
          ...(entry?.kind === "update" && context.versionKey
            ? { versionUnknown: true as const }
            : {}),
        };
      });
  }
  return request.keys.map(
    (key) =>
      verdicts.get(key) ?? {
        key,
        result: "unknown",
        reason: "unclear",
        detail: "응답에 그 항목이 없음",
      },
  );
}

/**
 * What reading a row again found (Decision 6): the row, 「none」 guaranteed (a one-row read's
 * 404 · empty answer, or a list gathered whole), or nothing to go by (a page · a filtered list that
 * did not hold it, no way to read).
 */
export type RecheckRead =
  { state: "found"; row: Row } | { state: "absent" } | { state: "unknown" };

/** A lost answer's verdict from reading the row again (the breakdown's 고침 · 지우기 table). */
export function judgeRecheck(
  entry: SentEntry,
  read: RecheckRead,
  versionKey: string | undefined,
): RowVerdict {
  const key = entry.key;
  if (read.state === "unknown")
    return { key, result: "unknown", reason: "unreadable" };
  if (entry.kind === "insert") {
    // (The sent key is no evidence by itself — breakdown 「넣은 행의 서버 key」: the server may key
    //  the row anew (draft-42 → u4). Only a row of that key holding the sent values is the create;
    //  not finding it never means 「not applied」 — sending again would make a second row. It waits
    //  for the viewer: 결과 확인 · 다시 저장 · 취소.)
    const row = read.state === "found" ? read.row : undefined;
    if (
      row &&
      Object.entries(entry.row).every(([field, value]) =>
        sameValue(row[field], value),
      )
    )
      return { key, result: "confirmed", row, serverKey: key };
    return {
      key,
      result: "unknown",
      reason: "unclear",
      detail: row
        ? "보낸 key 의 행이 다른 값"
        : "보낸 key 로 찾지 못함 — 서버가 다른 key 로 만들었을 수 있음",
    };
  }
  if (read.state === "absent")
    return entry.kind === "remove"
      ? { key, result: "confirmed" }
      : {
          key,
          result: "rejected",
          reason: "서버에서 지워짐",
          conflict: true,
          gone: true,
        };
  const row = read.row;
  const sameVersion =
    !versionKey || sameValue(row[versionKey], entry.baseRow[versionKey]);
  if (entry.kind === "update") {
    const fields = Object.entries(entry.fields);
    if (fields.every(([field, sent]) => sameValue(row[field], sent.value)))
      return { key, result: "confirmed", row, extra: row };
    if (
      sameVersion &&
      fields.every(([field]) => sameValue(row[field], entry.baseRow[field]))
    )
      return {
        key,
        result: "rejected",
        reason: "반영 안 됨",
        notApplied: true,
        server: row,
      };
    return {
      key,
      result: "rejected",
      reason: "충돌",
      conflict: true,
      server: row,
    };
  }
  // (A remove whose row is still there: as it was = not applied; else someone changed it.)
  const unchanged =
    sameVersion &&
    Object.keys(entry.baseRow).every((field) =>
      sameValue(row[field], entry.baseRow[field]),
    );
  return unchanged
    ? {
        key,
        result: "rejected",
        reason: "반영 안 됨",
        notApplied: true,
        server: row,
      }
    : { key, result: "rejected", reason: "충돌", conflict: true, server: row };
}
