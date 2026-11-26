/**
 * ADR-324 Phase 0 (G0) — the stand-in server the save gates measure against: an in-memory REST
 * resource (`/orders` by default) with every capability a connection can declare — per-row
 * `PATCH` · `PUT` · `POST` · `DELETE`, a reference batch endpoint (`POST <base>/batch`, atomic or
 * not), a version field checked by `If-Match` or the body (412 · 409), an idempotency key, gzip
 * request bodies (415 when not accepted) — and faults to inject: a lost response (applied, the
 * answer dropped), a status · a body, field errors in a 200, a create that answers only a
 * `Location`, nothing, or 202.
 *
 * The rows and the request log are read apart from the client (measurement-validity Q5 — the
 * oracle is the server's state, not the client's report). No imports: the live server
 * (`apps/builder/scripts/crud-endpoint-stub.mjs --save`) loads this file with Node's type stripping.
 */

export type StubRow = Record<string, unknown>;

/** How a create answers (the server key's place — breakdown 「넣은 행의 서버 key」). */
export type StubCreateAnswer = "body" | "location" | "none" | "accepted";

export interface SaveEndpointStubOptions {
  /** The resource path (`/orders`). */
  base?: string;
  /** The key field. */
  keyField?: string;
  /** The version field — absent = the server keeps no version (no conflict detection). */
  versionField?: string;
  rows?: readonly StubRow[];
  /** A create's key: `server` makes one even when the body has a key (`draft-42` → `u4`). */
  createKey?: "server" | "client";
  createAnswer?: StubCreateAnswer;
  /** Updates answer `204` with no body (else `200` with the row). */
  emptyUpdates?: boolean;
  /** The batch endpoint applies all or nothing. */
  atomic?: boolean;
  /** `Content-Encoding: gzip` bodies are taken (else 415). */
  acceptGzip?: boolean;
  /** The idempotency key header a create may carry (a repeat answers the first create). */
  idempotencyHeader?: string;
  /** The key prefix of server-made keys. */
  keyPrefix?: string;
}

/** A fault for the next request(s) matching `method` · `path` (a regex on the path · a substring). */
export interface StubFault {
  method?: string;
  path?: string | RegExp;
  /**
   * `lose` — apply, then drop the answer (a network error); `drop` — drop without applying;
   * `status` — answer that status and body without applying; `errors` — apply nothing, answer 200
   * with `{errors}`; `staleWrite` — before handling, another user writes `write` to the row `key`.
   */
  kind: "lose" | "drop" | "status" | "errors" | "staleWrite";
  status?: number;
  body?: unknown;
  errors?: Record<string, string[]>;
  key?: string;
  write?: StubRow;
  /** How many matching requests it hits (default 1). */
  times?: number;
}

export interface StubLogEntry {
  method: string;
  path: string;
  query: string;
  headers: Record<string, string>;
  /** The body as received (decoded when gzip) — parsed JSON, or the text. */
  body: unknown;
  /** The body's text as received (decoded) — a big integer literal stays exact here. */
  raw: string;
  /** The byte length on the wire. */
  wireBytes: number;
  status: number | "lost" | "dropped";
}

export interface SaveEndpointStub {
  readonly options: Required<
    Omit<SaveEndpointStubOptions, "rows" | "versionField" | "idempotencyHeader">
  > &
    Pick<SaveEndpointStubOptions, "versionField" | "idempotencyHeader">;
  /** The rows now, by key (the server's state). */
  readonly rows: Map<string, StubRow>;
  readonly log: StubLogEntry[];
  /** Every write a row took, by key (the edits it went through — 「서버 기록의 그 행 변경 1 회」). */
  readonly writes: Map<string, StubRow[]>;
  inject(fault: StubFault): void;
  /** A `fetch` over this server (a relative or absolute URL — only the path · query are read). */
  fetch(input: string | URL | Request, init?: RequestInit): Promise<Response>;
  /** Another user's edit (a row's fields, the version raised). */
  write(key: string, fields: StubRow): StubRow | undefined;
}

const json = (
  status: number,
  value: unknown,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
const empty = (
  status: number,
  headers: Record<string, string> = {},
): Response => new Response(null, { status, headers });

/** `"v17"` · `v17` · `W/"v17"` → `v17`. */
const bareTag = (tag: string): string =>
  tag
    .trim()
    .replace(/^W\//, "")
    .replace(/^"(.*)"$/, "$1");

async function readBody(
  request: Request,
): Promise<{ text: string; wireBytes: number; gzip: boolean }> {
  const raw = new Uint8Array(await request.arrayBuffer());
  const gzip = /gzip/i.test(request.headers.get("content-encoding") ?? "");
  if (!gzip)
    return {
      text: new TextDecoder().decode(raw),
      wireBytes: raw.byteLength,
      gzip,
    };
  const stream = new Response(raw).body!.pipeThrough(new DecompressionStream("gzip"));
  return {
    text: await new Response(stream).text(),
    wireBytes: raw.byteLength,
    gzip,
  };
}

export function createSaveEndpointStub(
  input: SaveEndpointStubOptions = {},
): SaveEndpointStub {
  const options = {
    base: input.base ?? "/orders",
    keyField: input.keyField ?? "id",
    versionField: input.versionField,
    createKey: input.createKey ?? "server",
    createAnswer: input.createAnswer ?? "body",
    emptyUpdates: input.emptyUpdates ?? false,
    atomic: input.atomic ?? true,
    acceptGzip: input.acceptGzip ?? false,
    idempotencyHeader: input.idempotencyHeader,
    keyPrefix: input.keyPrefix ?? "u",
  };
  const rows = new Map<string, StubRow>();
  const writes = new Map<string, StubRow[]>();
  const log: StubLogEntry[] = [];
  const faults: StubFault[] = [];
  const created = new Map<string, Response>();
  let serial = 0;
  for (const row of input.rows ?? []) {
    const key = String(row[options.keyField]);
    rows.set(key, { ...row });
    serial = Math.max(serial, Number(/(\d+)$/.exec(key)?.[1] ?? 0));
  }

  const versionOf = (row: StubRow | undefined) =>
    options.versionField && row
      ? String(row[options.versionField] ?? "")
      : undefined;
  const etag = (row: StubRow | undefined): Record<string, string> => {
    const version = versionOf(row);
    return version ? { ETag: `"${version}"` } : {};
  };
  const nextVersion = (row: StubRow | undefined): string => {
    const now = versionOf(row) ?? "v0";
    const number = Number(/(\d+)$/.exec(now)?.[1] ?? 0) + 1;
    return `v${number}`;
  };
  const record = (key: string, row: StubRow) => {
    const list = writes.get(key) ?? [];
    list.push({ ...row });
    writes.set(key, list);
  };
  const put = (key: string, row: StubRow) => {
    rows.set(key, row);
    record(key, row);
  };
  /** A write of `fields` over the row (the version raised when versioned). */
  const apply = (
    key: string,
    fields: StubRow,
    whole = false,
  ): StubRow | undefined => {
    const current = rows.get(key);
    if (!current) return undefined;
    const next: StubRow = whole
      ? { [options.keyField]: key, ...fields }
      : { ...current, ...fields };
    next[options.keyField] = key;
    if (options.versionField) next[options.versionField] = nextVersion(current);
    put(key, next);
    return next;
  };
  const conflict = (
    key: string,
    given: string | undefined,
  ): Response | undefined => {
    if (!options.versionField || given === undefined) return undefined;
    const now = versionOf(rows.get(key));
    return now !== undefined && bareTag(given) !== now
      ? json(412, {
          error: `version ${bareTag(given)} ≠ ${now}`,
          [options.versionField]: now,
        })
      : undefined;
  };
  const takeFault = (method: string, path: string): StubFault | undefined => {
    const index = faults.findIndex(
      (fault) =>
        (!fault.method || fault.method.toUpperCase() === method) &&
        (!fault.path ||
          (typeof fault.path === "string"
            ? path.includes(fault.path)
            : fault.path.test(path))),
    );
    if (index < 0) return undefined;
    const fault = faults[index]!;
    if ((fault.times ?? 1) <= 1) faults.splice(index, 1);
    else faults[index] = { ...fault, times: (fault.times ?? 1) - 1 };
    return fault;
  };
  const makeKey = () => `${options.keyPrefix}${(serial += 1)}`;

  const createRow = (body: StubRow): { key: string; row: StubRow } => {
    const given = body[options.keyField];
    const key =
      options.createKey === "client" &&
      (typeof given === "string" || typeof given === "number") &&
      String(given)
        ? String(given)
        : makeKey();
    const row: StubRow = { ...body, [options.keyField]: key };
    if (options.versionField) row[options.versionField] = "v1";
    put(key, row);
    return { key, row };
  };

  const createAnswer = (
    key: string,
    row: StubRow,
    location: string,
  ): Response => {
    switch (options.createAnswer) {
      case "location":
        return empty(201, { Location: location });
      case "none":
        return empty(201);
      case "accepted":
        return empty(202);
      default:
        return json(201, row, { Location: location });
    }
  };

  type BatchItem = {
    id?: unknown;
    ref?: unknown;
    version?: unknown;
    set?: StubRow;
    values?: StubRow;
  };
  const batch = (body: {
    updates?: BatchItem[];
    creates?: BatchItem[];
    deletes?: BatchItem[];
  }): Response => {
    const failed: {
      id?: unknown;
      ref?: unknown;
      errors: Record<string, string[]>;
    }[] = [];
    const check = (item: BatchItem, kind: "update" | "delete") => {
      const key = String(item.id);
      if (!rows.has(key))
        return { errors: { [options.keyField]: [`${key} 없음`] } };
      if (
        options.versionField &&
        item.version !== undefined &&
        String(item.version) !== versionOf(rows.get(key))
      )
        return {
          errors: {
            [options.versionField]: [
              `version ${String(item.version)} ≠ ${versionOf(rows.get(key))}`,
            ],
          },
          conflict: true,
          kind,
        };
      return undefined;
    };
    for (const item of body.updates ?? []) {
      const problem = check(item, "update");
      if (problem) failed.push({ id: item.id, errors: problem.errors });
    }
    for (const item of body.deletes ?? []) {
      const problem = check(item, "delete");
      if (problem) failed.push({ id: item.id, errors: problem.errors });
    }
    if (options.atomic && failed.length) return json(409, { failed });
    const failedIds = new Set(failed.map((item) => String(item.id)));
    const updated: StubRow[] = [];
    for (const item of body.updates ?? []) {
      if (failedIds.has(String(item.id))) continue;
      const row = apply(String(item.id), item.set ?? {});
      if (row)
        updated.push({
          id: item.id,
          ...(options.versionField
            ? { version: row[options.versionField] }
            : {}),
          values: row,
        });
    }
    const createdRows: StubRow[] = [];
    for (const item of body.creates ?? []) {
      const { key, row } = createRow({ ...(item.values ?? {}) });
      createdRows.push({
        ref: item.ref,
        id: key,
        ...(options.versionField ? { version: row[options.versionField] } : {}),
        values: row,
      });
    }
    const deleted: StubRow[] = [];
    for (const item of body.deletes ?? []) {
      if (failedIds.has(String(item.id))) continue;
      const key = String(item.id);
      rows.delete(key);
      record(key, { deleted: true });
      deleted.push({ id: item.id });
    }
    return json(200, {
      updated,
      created: createdRows,
      deleted,
      ...(failed.length ? { failed } : {}),
    });
  };

  async function handle(
    request: Request,
    url: URL,
    entry: StubLogEntry,
  ): Promise<Response> {
    const method = request.method.toUpperCase();
    const path = url.pathname;
    const fault = takeFault(method, path);
    if (fault?.kind === "staleWrite" && fault.key) {
      const current = rows.get(fault.key);
      if (current) apply(fault.key, fault.write ?? {});
    }
    if (fault?.kind === "drop")
      throw new TypeError("Failed to fetch (stub: dropped)");
    const { text, wireBytes, gzip } = await readBody(request);
    entry.wireBytes = wireBytes;
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    entry.body = body;
    entry.raw = text;
    if (gzip && !options.acceptGzip)
      return json(415, { error: "Content-Encoding gzip 를 받지 않는다" });
    if (fault?.kind === "status")
      return fault.body === undefined
        ? empty(fault.status ?? 500)
        : json(fault.status ?? 500, fault.body);
    if (fault?.kind === "errors")
      return json(200, { errors: fault.errors ?? {} });

    const respond = (response: Response): Response => {
      if (fault?.kind === "lose")
        throw new TypeError("Failed to fetch (stub: answer lost)");
      return response;
    };
    const base = options.base;
    const object =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as StubRow)
        : {};
    if (path === base && method === "GET")
      return respond(json(200, [...rows.values()]));
    if (path === `${base}/batch` && method === "POST")
      return respond(batch(object as Parameters<typeof batch>[0]));
    if (path === base && method === "POST") {
      const idem = options.idempotencyHeader
        ? request.headers.get(options.idempotencyHeader)
        : null;
      if (idem && created.has(idem)) return respond(created.get(idem)!.clone());
      const { key, row } = createRow(object);
      const answer = createAnswer(
        key,
        row,
        `${base}/${encodeURIComponent(key)}`,
      );
      if (idem) created.set(idem, answer.clone());
      return respond(answer);
    }
    const one = new RegExp(
      `^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/([^/]+)$`,
    ).exec(path);
    if (!one) return json(404, { error: "not found" });
    const key = decodeURIComponent(one[1]!);
    const current = rows.get(key);
    if (method === "GET")
      return respond(
        current
          ? json(
              200,
              current,
              etag(current),
            )
          : json(404, { error: `${key} 없음` }),
      );
    if (!current) return respond(json(404, { error: `${key} 없음` }));
    const given =
      request.headers.get("if-match") ??
      (options.versionField && object[options.versionField] !== undefined
        ? String(object[options.versionField])
        : undefined) ??
      url.searchParams.get("version") ??
      undefined;
    const refused = conflict(key, given);
    if (refused) return respond(refused);
    if (method === "DELETE") {
      rows.delete(key);
      record(key, { deleted: true });
      return respond(empty(204));
    }
    if (method === "PATCH" || method === "PUT") {
      const fields = { ...object };
      if (options.versionField) delete fields[options.versionField];
      const row = apply(key, fields, method === "PUT")!;
      const tag = etag(row);
      return respond(
        options.emptyUpdates ? empty(204, tag) : json(200, row, tag),
      );
    }
    return json(405, { error: method });
  }

  return {
    options,
    rows,
    log,
    writes,
    inject(fault) {
      faults.push(fault);
    },
    write(key, fields) {
      return apply(key, fields);
    },
    async fetch(input, init) {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), "http://stub.local/"), init);
      const url = new URL(request.url);
      const headers: Record<string, string> = {};
      request.headers.forEach((value, name) => (headers[name] = value));
      const entry: StubLogEntry = {
        method: request.method.toUpperCase(),
        path: url.pathname,
        query: url.search,
        headers,
        body: undefined,
        raw: "",
        wireBytes: 0,
        status: "dropped",
      };
      log.push(entry);
      try {
        const response = await handle(request, url, entry);
        entry.status = response.status;
        return response;
      } catch (error) {
        entry.status = /lost/.test(String(error)) ? "lost" : "dropped";
        throw error;
      }
    },
  };
}
