// @vitest-environment jsdom
import { collectionSaveReasonText } from "../collectionSaveText";
import { describe, expect, it } from "vitest";
import type { ApiEndpointDefinition } from "../../../types/collection.types";
import type {
  CatalogDataField,
  CollectionSaveSettings,
} from "../../document/types";
import {
  createSaveEndpointStub,
  type SaveEndpointStubOptions,
} from "../../../collections/save/saveEndpointStub";
import { intakeQueryItems } from "../../../collections/intake/queryItems";
import { CollectionStore, type Row } from "../collectionStore";
import { CollectionSaver, type CollectionSaveHost } from "../collectionSave";

/**
 * ADR-324 G2 · G3 · G4 — the save against the stand-in server (`saveEndpointStub.ts`). The
 * server's rows · request log are read apart from the client; every expected value is written by
 * hand from the breakdown's 「독립 검증 사례」 table.
 */

const SCHEMA: CatalogDataField[] = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-qty", key: "quantity", type: "number" },
  { id: "f-note", key: "note", type: "string" },
  { id: "f-ver", key: "version", type: "string" },
];

const ROWS = [
  { id: "o1", name: "볼펜", quantity: 3, note: "", version: "v1" },
  { id: "o2", name: "노트", quantity: 10, note: "확인", version: "v1" },
  { id: "o3", name: "지우개", quantity: 0, note: null, version: "v1" },
];

const endpoint = (
  id: string,
  method: string,
  path: string,
  mapping: Partial<NonNullable<ApiEndpointDefinition["responseMapping"]>> = {},
): ApiEndpointDefinition => ({
  id,
  name: id,
  baseUrl: "http://stub.local",
  path,
  method,
  responseMapping: { dataPath: "", errorsPath: "errors", ...mapping },
});
const ENDPOINTS = [
  endpoint("patch", "PATCH", "/orders/{{ key }}"),
  endpoint("put", "PUT", "/orders/{{ key }}"),
  endpoint("post", "POST", "/orders"),
  endpoint("delete", "DELETE", "/orders/{{ key }}"),
  endpoint("batch", "POST", "/orders/batch"),
  endpoint("one", "GET", "/orders/{{ key }}"),
];
const id = (raw: string) => `data:endpoint:${raw}` as const;
const ROWS_SAVE: CollectionSaveSettings = {
  send: {
    shape: "rows",
    update: { endpointId: id("patch"), body: "changed" },
    create: { endpointId: id("post") },
    remove: { endpointId: id("delete") },
  },
};

function harness(
  save: CollectionSaveSettings,
  stubOptions: SaveEndpointStubOptions = {},
  options: {
    schema?: CatalogDataField[];
    whole?: boolean;
    /** Fields the collection's list answer leaves out (a list that does not give the version). */
    listOmits?: readonly string[];
    /** The site's language (the messages' — these cases read the Korean words). */
    language?: string;
  } = {},
) {
  const stub = createSaveEndpointStub({
    versionField: "version",
    rows: ROWS,
    ...stubOptions,
  });
  const schema = options.schema ?? SCHEMA;
  const collection = { id: "orders", schema, keyField: "f-id" };
  const store = new CollectionStore();
  /** Runs as each request reaches the server (an edit while a save is on its way). */
  const beforeFetch: ((method: string) => void)[] = [];
  /** An answer given in place of the server's (a recheck endpoint that answers a list). */
  const intercept: ((
    method: string,
    path: string,
  ) => Response | undefined)[] = [];
  let at = 0;
  const keyOf = (row: Row) =>
    typeof row.id === "string" || typeof row.id === "number"
      ? String(row.id)
      : undefined;
  const intake = (items: unknown): Row[] => {
    const read = intakeQueryItems(items, collection as never);
    return (Array.isArray(read) ? read : [read]) as Row[];
  };
  const load = () =>
    store.accept(
      "GET /orders",
      intake(
        [...stub.rows.values()].map((row) => {
          const copy: Record<string, unknown> = { ...row };
          for (const field of options.listOmits ?? []) delete copy[field];
          return copy;
        }),
      ),
      { at: (at += 1), keyOf, keyless: "answer" },
    );
  load();
  store.startList("L", "GET /orders");
  const host: CollectionSaveHost = {
    language: () => options.language ?? "ko",
    saveSettings: () => save,
    collection: () => collection,
    store: () => store,
    endpoint: (endpointId) =>
      ENDPOINTS.find(
        (item) =>
          `data:endpoint:${item.id}` === endpointId || item.id === endpointId,
      ),
    templateFor: () => () => undefined,
    intake: (_id, items) => intake(items),
    storeKeys: (_id, keys) => [...keys],
    nextAt: () => (at += 1),
    reload: async () => {
      load();
    },
    wholeComplete: () => options.whole ?? true,
    refresh: () => {},
    fetch: ((input: RequestInfo | URL, init?: RequestInit) => {
      const method = String(init?.method ?? "GET");
      for (const hook of beforeFetch) hook(method);
      for (const answer of intercept) {
        const given = answer(method, new URL(String(input)).pathname);
        if (given) return Promise.resolve(given);
      }
      return stub.fetch(input as string, init);
    }) as typeof fetch,
  };
  const saver = new CollectionSaver(host);
  let seq = 0;
  const edit = (key: string, patch: Row) =>
    store.update(key, patch, (seq += 1), store.knownRow(key)!);
  const writes = () => stub.log.filter((entry) => entry.method !== "GET");
  return {
    stub,
    store,
    saver,
    edit,
    load,
    writes,
    beforeFetch,
    intercept,
    nextSeq: () => (seq += 1),
  };
}

describe("ADR-324 G2 — 보내는 것은 변경분", () => {
  it("edits send nothing; a save sends each row's key and changed fields once; a second save sends 0", async () => {
    const { stub, saver, edit, writes, store } = harness(ROWS_SAVE);
    edit("o1", { quantity: 8, note: "급함" });
    edit("o2", { quantity: 0 });
    expect(writes()).toHaveLength(0);
    const result = await saver.save("orders");
    expect(result.ok).toBe(true);
    expect(
      writes().map((entry) => [entry.method, entry.path, entry.body]),
    ).toEqual([
      ["PATCH", "/orders/o1", { quantity: 8, note: "급함" }],
      ["PATCH", "/orders/o2", { quantity: 0 }],
    ]);
    expect(stub.rows.get("o1")).toMatchObject({
      quantity: 8,
      note: "급함",
      name: "볼펜",
    });
    expect(store.changes.size).toBe(0);
    await saver.save("orders");
    expect(writes()).toHaveLength(2);
  });

  it("a batch connection sends one request: key, version, changed fields", async () => {
    const { stub, saver, edit } = harness(
      {
        send: { shape: "batch", endpointId: id("batch"), atomic: true },
        conflict: { by: "version", fieldId: "f-ver", send: "body" },
      },
      { atomic: true },
    );
    edit("o1", { quantity: 8 });
    edit("o3", { note: "x" });
    await saver.save("orders");
    expect(stub.log.filter((entry) => entry.method === "POST")).toHaveLength(1);
    expect(stub.log.at(-1)!.body).toEqual({
      updates: [
        { id: "o1", version: "v1", set: { quantity: 8 } },
        { id: "o3", version: "v1", set: { note: "x" } },
      ],
    });
    expect(stub.rows.get("o1")).toMatchObject({ quantity: 8, version: "v2" });
  });

  it("a row with no server identity (row-1) sends nothing — its change and reason stay", async () => {
    const { saver, store, writes } = harness(ROWS_SAVE);
    store.accept("authored", [{ name: "키 없음", quantity: 1 }], {
      at: 50,
      keyOf: () => undefined,
      keyless: "authored",
    });
    store.update("row-1", { quantity: 2 }, 99, store.knownRow("row-1")!);
    store.remove("row-1", 100, store.knownRow("row-1")!);
    const result = await saver.save("orders");
    expect(writes()).toHaveLength(0);
    expect(store.changes.get("row-1")?.kind).toBe("remove");
    expect(saver.rowState("orders", "row-1")?.status).toBe("noKey");
    expect(result.ok).toBe(false);
  });

  it("null · false · 0 · '' · a big integer · a Y/N field reach the server as written", async () => {
    const schema: CatalogDataField[] = [
      { id: "f-id", key: "id", type: "string" },
      { id: "f-note", key: "note", type: "string" },
      { id: "f-qty", key: "quantity", type: "number" },
      {
        id: "f-flag",
        key: "active",
        type: "boolean",
        encoding: { kind: "flag", true: "Y", false: "N" },
      },
      { id: "f-big", key: "big", type: "string", encoding: { kind: "bigInt" } },
    ] as never;
    const { stub, saver, edit } = harness(
      ROWS_SAVE,
      { rows: [{ id: "o1", note: "a", quantity: 1, active: "Y", big: "1" }] },
      { schema },
    );
    edit("o1", {
      note: null,
      quantity: 0,
      active: false,
      big: "9007199254740993",
    });
    await saver.save("orders");
    const sent = stub.log.at(-1)!;
    expect(sent.body).toMatchObject({ note: null, quantity: 0, active: "N" });
    expect(sent.raw).toContain("9007199254740993");
    expect(Object.keys(sent.body as object).sort()).toEqual([
      "active",
      "big",
      "note",
      "quantity",
    ]);
    edit("o1", { note: "" });
    await saver.save("orders");
    expect(stub.log.at(-1)!.body).toEqual({ note: "" });
  });

  it("gzip: three cells go plain, a 1,000-row paste goes compressed, a 415 sends it again plain", async () => {
    const save: CollectionSaveSettings = {
      send: {
        shape: "batch",
        endpointId: id("batch"),
        atomic: true,
        gzip: true,
      },
    };
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      id: `p${index}`,
      name: `상품 ${index}`,
      quantity: index,
      note: "",
      version: "v1",
    }));
    const { stub, saver, edit } = harness(save, { rows, acceptGzip: true });
    edit("p1", { quantity: 5 });
    await saver.save("orders");
    expect(stub.log.at(-1)!.headers["content-encoding"]).toBeUndefined();
    for (let index = 0; index < 1000; index += 1)
      edit(`p${index}`, { note: `메모 ${index}` });
    await saver.save("orders");
    const big = stub.log.at(-1)!;
    expect(big.headers["content-encoding"]).toBe("gzip");
    expect((big.body as { updates: unknown[] }).updates).toHaveLength(1000);
    expect(stub.rows.get("p999")).toMatchObject({ note: "메모 999" });

    const refusing = harness(save, { rows, acceptGzip: false });
    for (let index = 0; index < 1000; index += 1)
      refusing.edit(`p${index}`, { note: `x${index}` });
    const result = await refusing.saver.save("orders");
    const posts = refusing.stub.log.filter((entry) => entry.method === "POST");
    expect(posts.map((entry) => entry.status)).toEqual([415, 200]);
    expect(posts[1]!.headers["content-encoding"]).toBeUndefined();
    expect(result.ok).toBe(true);
    refusing.edit("p0", { note: "again" });
    for (let index = 1; index < 1000; index += 1)
      refusing.edit(`p${index}`, { note: `again ${index}` });
    await refusing.saver.save("orders");
    expect(
      refusing.stub.log.at(-1)!.headers["content-encoding"],
    ).toBeUndefined();
  });
});

describe("ADR-324 G3 — 결과 판정", () => {
  it("rows: A 204 · B 422 → A confirmed, B stays with its reason", async () => {
    const { stub, saver, edit, store } = harness(ROWS_SAVE, {
      emptyUpdates: true,
    });
    stub.inject({
      method: "PATCH",
      path: "/orders/o2",
      kind: "status",
      status: 422,
      body: {},
    });
    edit("o1", { quantity: 4 });
    edit("o2", { quantity: 5 });
    const result = await saver.save("orders");
    expect(store.changes.has("o1")).toBe(false);
    expect(store.changes.get("o2")).toMatchObject({ kind: "update" });
    expect(saver.rowState("orders", "o2")).toMatchObject({
      status: "failed",
      reason: "HTTP 422",
    });
    expect(result.ok).toBe(false);
  });

  it("an empty 202 is processing — the change stays, even when the server then drops the job", async () => {
    const { stub, saver, edit, store } = harness(ROWS_SAVE);
    stub.inject({ method: "PATCH", kind: "status", status: 202 });
    edit("o1", { quantity: 4 });
    await saver.save("orders");
    expect(saver.rowState("orders", "o1")?.status).toBe("processing");
    expect(store.changes.has("o1")).toBe(true);
    expect(stub.rows.get("o1")!.quantity).toBe(3);
    // (결과 확인 on the next save: the row is still as it was — processing, never 「not applied」.)
    await saver.save("orders");
    expect(saver.rowState("orders", "o1")?.status).toBe("processing");
    expect(store.changes.has("o1")).toBe(true);
  });

  it("a 200 holding field errors is not saved — the cell's message is kept", async () => {
    const { stub, saver, edit, store } = harness(ROWS_SAVE);
    stub.inject({
      method: "PATCH",
      path: "/orders/o1",
      kind: "errors",
      errors: { quantity: ["out of stock"] },
    });
    edit("o1", { quantity: 99 });
    edit("o2", { quantity: 1 });
    await saver.save("orders");
    expect(saver.rowState("orders", "o1")).toMatchObject({
      status: "failed",
      errors: { quantity: ["out of stock"] },
    });
    expect(store.changes.has("o1")).toBe(true);
    expect(store.changes.has("o2")).toBe(false);
  });

  it("a 201 with only Location: the row takes the server key; the next update goes to it", async () => {
    const { stub, saver, store, writes, nextSeq } = harness(ROWS_SAVE, {
      createAnswer: "location",
    });
    store.insert(
      "draft-42",
      { id: "draft-42", name: "새 상품", quantity: 1 },
      nextSeq(),
      {
        kind: "append",
        key: "draft-42",
      },
    );
    await saver.save("orders");
    expect(store.rows.get("u4")?.row).toMatchObject({ name: "새 상품" });
    store.update("u4", { quantity: 2 }, nextSeq(), store.knownRow("u4")!);
    await saver.save("orders");
    expect(writes().map((entry) => `${entry.method} ${entry.path}`)).toEqual([
      "POST /orders",
      "PATCH /orders/u4",
    ]);
    expect(stub.rows.get("u4")).toMatchObject({ quantity: 2 });
  });

  it("draft-42 sent, the server makes u4 and answers it: the next update goes to u4, none to draft-42", async () => {
    const { saver, store, writes, nextSeq } = harness(ROWS_SAVE);
    store.insert(
      "draft-42",
      { id: "draft-42", name: "새 상품", quantity: 1 },
      nextSeq(),
      {
        kind: "append",
        key: "draft-42",
      },
    );
    await saver.save("orders");
    store.update("u4", { quantity: 7 }, nextSeq(), store.knownRow("u4")!);
    await saver.save("orders");
    expect(writes().map((entry) => `${entry.method} ${entry.path}`)).toEqual([
      "POST /orders",
      "PATCH /orders/u4",
    ]);
  });

  it("a 201 without a key and an edit after the send (A → B): unlinked — 0 updates until the user links a row, then 1 to it", async () => {
    const { stub, saver, store, writes, nextSeq, beforeFetch } = harness(
      ROWS_SAVE,
      { createAnswer: "none" },
    );
    store.insert(
      "draft-1",
      { id: "draft-1", name: "A", quantity: 1 },
      nextSeq(),
      {
        kind: "append",
        key: "draft-1",
      },
    );
    // (An edit while the create is on its way — as the POST reaches the server.)
    beforeFetch.push((method) => {
      if (method === "POST" && store.knownRow("draft-1"))
        store.update(
          "draft-1",
          { name: "B" },
          nextSeq(),
          store.knownRow("draft-1")!,
        );
    });
    await saver.save("orders");
    beforeFetch.length = 0;
    expect(store.changes.get("draft-1")?.kind).toBe("unlinked");
    await saver.save("orders");
    expect(writes().map((entry) => entry.method)).toEqual(["POST"]);
    const made = [...stub.rows.keys()].find(
      (key) => stub.rows.get(key)!.name === "A",
    )!;
    expect(made).toBe("u4");
    const linked = await saver.save("orders", {
      scope: "link",
      keys: ["draft-1", "u4"],
    });
    expect(linked.ok).toBe(true);
    await saver.save("orders");
    expect(writes().map((entry) => `${entry.method} ${entry.path}`)).toEqual([
      "POST /orders",
      "PATCH /orders/u4",
    ]);
    expect(writes()[1]!.body).toEqual({ name: "B" });
  });

  it("a lost update answer is judged by reading again: my value → saved, the server wrote it once", async () => {
    const { stub, saver, edit, store } = harness(ROWS_SAVE);
    stub.inject({ method: "PATCH", kind: "lose" });
    edit("o1", { quantity: 8 });
    const result = await saver.save("orders");
    expect(result.ok).toBe(true);
    expect(store.changes.has("o1")).toBe(false);
    expect(stub.writes.get("o1")).toHaveLength(1);
  });

  it("a lost remove: a one-row read's 404 → saved; another page's list without it → result to check", async () => {
    const recheck: CollectionSaveSettings = {
      ...ROWS_SAVE,
      conflict: { by: "recheck", endpointId: id("one") },
    };
    const single = harness(recheck);
    single.stub.inject({ method: "DELETE", kind: "lose" });
    single.store.remove("o2", 1, single.store.knownRow("o2")!);
    await single.saver.save("orders");
    expect(single.store.changes.has("o2")).toBe(false);

    const paged = harness(ROWS_SAVE, {}, { whole: false });
    paged.stub.inject({ method: "DELETE", kind: "lose" });
    paged.store.remove("o2", 1, paged.store.knownRow("o2")!);
    // (The list read again holds another page — the row is not in it.)
    paged.stub.rows.delete("o1");
    await paged.saver.save("orders");
    expect(paged.saver.rowState("orders", "o2")?.status).toBe("pending");
  });

  it("a lost create: no idempotency key — sent once, waits; with one — sent again with it, one row made", async () => {
    const plain = harness(ROWS_SAVE);
    plain.stub.inject({ method: "POST", kind: "lose" });
    plain.store.insert("n1", { name: "C" }, 1, { kind: "append", key: "n1" });
    await plain.saver.save("orders");
    expect(
      plain.writes().filter((entry) => entry.method === "POST"),
    ).toHaveLength(1);
    expect(plain.store.sends.size).toBe(1);

    const keyed = harness(
      { ...ROWS_SAVE, idempotency: { in: "header", name: "Idempotency-Key" } },
      { idempotencyHeader: "Idempotency-Key" },
    );
    keyed.stub.inject({ method: "POST", kind: "lose" });
    keyed.store.insert("n1", { name: "C" }, 1, { kind: "append", key: "n1" });
    await keyed.saver.save("orders");
    const posts = keyed.writes().filter((entry) => entry.method === "POST");
    expect(posts).toHaveLength(2);
    expect(posts[0]!.headers["idempotency-key"]).toBe(
      posts[1]!.headers["idempotency-key"],
    );
    expect(
      [...keyed.stub.rows.values()].filter((row) => row.name === "C"),
    ).toHaveLength(1);
  });
});

describe("ADR-324 G4 — 충돌", () => {
  const VERSIONED: CollectionSaveSettings = {
    ...ROWS_SAVE,
    conflict: { by: "version", fieldId: "f-ver", send: "ifMatch" },
  };

  it("another user's edit first: 412 → conflict, the server's value stays; 「내 값으로 다시 저장」 sends with its version", async () => {
    const { stub, saver, edit, store } = harness(VERSIONED);
    edit("o1", { quantity: 8 });
    stub.inject({
      method: "PATCH",
      kind: "staleWrite",
      key: "o1",
      write: { quantity: 50 },
    });
    await saver.save("orders");
    expect(stub.log.find((entry) => entry.method === "PATCH")!.status).toBe(
      412,
    );
    expect(saver.rowState("orders", "o1")).toMatchObject({
      status: "conflict",
    });
    expect(stub.rows.get("o1")).toMatchObject({ quantity: 50, version: "v2" });
    const mine = await saver.save("orders", { scope: "conflicts" });
    expect(mine.ok).toBe(true);
    const last = stub.log.at(-1)!;
    expect(last.headers["if-match"]).toBe('"v2"');
    expect(stub.rows.get("o1")).toMatchObject({ quantity: 8, version: "v3" });
    expect(store.changes.has("o1")).toBe(false);
  });

  it("v1 kept from the first edit: a load brings v2 — nothing goes, a conflict shows, the server row stays v2", async () => {
    const { stub, saver, store, load, writes } = harness(VERSIONED);
    store.remove("o2", 1, store.knownRow("o2")!);
    stub.write("o2", { note: "다른 사람" });
    load();
    await saver.save("orders");
    expect(writes().filter((entry) => entry.method === "DELETE")).toHaveLength(
      0,
    );
    expect(saver.rowState("orders", "o2")?.status).toBe("conflict");
    expect(stub.rows.get("o2")).toMatchObject({
      version: "v2",
      note: "다른 사람",
    });
  });

  it("a versioned update sent again after it was applied (the browser resends on a dropped socket): 412, read again — my value → saved, no conflict", async () => {
    const { stub, saver, edit, store } = harness(VERSIONED);
    edit("o1", { quantity: 8 });
    // (The first request reached the server; the one this save sees comes after it.)
    stub.inject({ method: "PATCH", kind: "staleWrite", key: "o1", write: { quantity: 8 } });
    const result = await saver.save("orders");
    expect(stub.log.find((entry) => entry.method === "PATCH")!.status).toBe(412);
    expect(result.ok).toBe(true);
    expect(saver.rowState("orders", "o1")).toBeUndefined();
    expect(store.changes.has("o1")).toBe(false);
    expect(store.rows.get("o1")?.row).toMatchObject({ quantity: 8, version: "v2" });
  });

  it("the site's language words the toast and the row's reason (English · Korean; a code, not a sentence, on the row — others in English)", async () => {
    for (const [language, toast, reason] of [
      ["en", "1 conflict", "Someone else changed it first"],
      ["ko", "충돌 1건", "다른 사람이 먼저 바꿈"],
      ["ja", "1 conflict", "Someone else changed it first"],
    ] as const) {
      // (v1 kept from the edit, a load brings v2 — the conflict found before sending.)
      const { stub, saver, store, load } = harness(VERSIONED, {}, { language });
      store.remove("o2", 1, store.knownRow("o2")!);
      stub.write("o2", { note: "B" });
      load();
      const result = await saver.save("orders");
      expect(result.message).toBe(toast);
      const state = saver.rowState("orders", "o2")!;
      expect(state.reason).toBe("changedFirst");
      expect(
        collectionSaveReasonText(state.reason, state.detail, language),
      ).toBe(reason);
      expect((await saver.save("orders", { scope: "pending" })).message).toBe(
        language === "ko"
          ? "결과를 기다리는 행이 없습니다"
          : "No rows waiting for a result",
      );
    }
    // (A reason that is no code shows as it came.)
    expect(collectionSaveReasonText("HTTP 422", undefined, "ko")).toBe(
      "HTTP 422",
    );
    expect(collectionSaveReasonText("pending", "keyNotFound", "ko")).toBe(
      "결과 확인 필요 (보낸 key 로 찾지 못함 — 서버가 다른 key 로 만들었을 수 있음)",
    );
  });

  it("「서버 값 받기」 drops the conflicted row's change", async () => {
    const { stub, saver, edit, store } = harness(VERSIONED);
    edit("o1", { quantity: 8 });
    stub.inject({
      method: "PATCH",
      kind: "staleWrite",
      key: "o1",
      write: { quantity: 50 },
    });
    await saver.save("orders");
    saver.discard("orders", undefined, "conflicts");
    expect(store.changes.has("o1")).toBe(false);
    expect(store.knownRow("o1")).toMatchObject({ quantity: 50 });
  });

  it("a whole-row connection keeps another user's cell: version → refused; recheck → the read value goes", async () => {
    const versioned = harness({
      send: { shape: "rows", update: { endpointId: id("put"), body: "full" } },
      conflict: { by: "version", fieldId: "f-ver", send: "ifMatch" },
    });
    versioned.edit("o2", { quantity: 1 });
    versioned.stub.write("o2", { note: "B" });
    await versioned.saver.save("orders");
    expect(versioned.stub.rows.get("o2")).toMatchObject({
      note: "B",
      quantity: 10,
    });

    const rechecked = harness({
      send: { shape: "rows", update: { endpointId: id("put"), body: "full" } },
      conflict: { by: "recheck", endpointId: id("one") },
    });
    rechecked.edit("o2", { quantity: 1 });
    rechecked.stub.write("o2", { note: "B" });
    await rechecked.saver.save("orders");
    const put = rechecked.stub.log.find((entry) => entry.method === "PUT")!;
    expect(put.body).toMatchObject({ note: "B", quantity: 1 });
    expect(rechecked.stub.rows.get("o2")).toMatchObject({
      note: "B",
      quantity: 1,
    });
  });

  it("no conflict detection: the changed fields overwrite and the save goes", async () => {
    const { stub, saver, edit } = harness(ROWS_SAVE);
    edit("o1", { quantity: 2 });
    stub.write("o1", { quantity: 77, note: "다른 칸" });
    await saver.save("orders");
    expect(stub.rows.get("o1")).toMatchObject({ quantity: 2, note: "다른 칸" });
  });
});

/**
 * Round 3 (codex 판독 2026-11-27) — each case is the review's counter-example: the server's rows
 * and request log are the oracle (`docs/adr/reviews/324.md` round 3).
 */
describe("ADR-324 round 3 — 판독 반례", () => {
  it("h9 — an update connection pointing at a DELETE endpoint sends nothing: the row stays on the server", async () => {
    const { stub, saver, edit, writes, store } = harness({
      send: {
        shape: "rows",
        update: { endpointId: id("delete"), body: "changed" },
      },
    });
    edit("o1", { quantity: 8 });
    const result = await saver.save("orders");
    expect(writes()).toHaveLength(0);
    expect(stub.rows.has("o1")).toBe(true);
    expect(result.ok).toBe(false);
    expect(store.changes.has("o1")).toBe(true);
    expect(saver.rowState("orders", "o1")?.status).toBe("noConnection");
  });

  it("h10 — a versioned connection whose rows came without the version sends nothing (another user's cell is not overwritten)", async () => {
    const save: CollectionSaveSettings = {
      send: { shape: "rows", update: { endpointId: id("put"), body: "full" } },
      conflict: { by: "version", fieldId: "f-ver", send: "ifMatch" },
    };
    const h = harness(save, {}, { listOmits: ["version"] });
    h.edit("o2", { quantity: 1 });
    h.stub.write("o2", { note: "B" });
    const result = await h.saver.save("orders");
    expect(h.writes()).toHaveLength(0);
    expect(h.stub.rows.get("o2")).toMatchObject({ note: "B", quantity: 10 });
    expect(result.ok).toBe(false);
    expect(h.store.changes.has("o2")).toBe(true);
    expect(h.saver.rowState("orders", "o2")?.status).toBe("noVersion");
    // (A read that brings the version: the row is another user's now — a conflict the viewer
    //  chooses for, and 「내 값으로 다시 저장」 sends over that row with its version.)
    h.store.writeServerRow("o2", { ...h.stub.rows.get("o2")! }, 900);
    await h.saver.save("orders");
    expect(h.writes()).toHaveLength(0);
    expect(h.saver.rowState("orders", "o2")?.status).toBe("conflict");
    const mine = await h.saver.save("orders", { scope: "conflicts" });
    expect(mine.ok).toBe(true);
    expect(h.writes().map((entry) => entry.headers["if-match"])).toEqual([
      '"v2"',
    ]);
    expect(h.stub.rows.get("o2")).toMatchObject({ note: "B", quantity: 1 });

    // (A batch: `version: undefined` would drop out of the JSON — the item is not sent either.)
    const batch = harness(
      {
        send: { shape: "batch", endpointId: id("batch"), atomic: true },
        conflict: { by: "version", fieldId: "f-ver", send: "body" },
      },
      { atomic: true },
      { listOmits: ["version"] },
    );
    batch.edit("o2", { quantity: 1 });
    batch.store.remove("o3", 9, batch.store.knownRow("o3")!);
    await batch.saver.save("orders");
    expect(batch.writes()).toHaveLength(0);
    expect(batch.stub.rows.has("o3")).toBe(true);
  });

  it("h11 — a lost create the server keyed otherwise (draft-42 → u4) is not sent again: it waits, one row on the server", async () => {
    const { stub, saver, store, writes } = harness(ROWS_SAVE);
    stub.inject({ method: "POST", kind: "lose" });
    store.insert("draft-42", { id: "draft-42", name: "D", quantity: 1 }, 1, {
      kind: "append",
      key: "draft-42",
    });
    const first = await saver.save("orders");
    expect(first.ok).toBe(false);
    expect(saver.rowState("orders", "draft-42")?.status).toBe("pending");
    expect(store.sends.size).toBe(1);
    const second = await saver.save("orders");
    expect(second.ok).toBe(false);
    expect(second.message).toContain("결과 확인 필요 1건");
    expect(writes().filter((entry) => entry.method === "POST")).toHaveLength(1);
    expect(
      [...stub.rows.values()].filter((row) => row.name === "D"),
    ).toHaveLength(1);
  });

  it("h11 — a lost create whose sent key is on the server with the sent values is saved", async () => {
    const { stub, saver, store, writes } = harness(ROWS_SAVE, {
      createKey: "client",
    });
    stub.inject({ method: "POST", kind: "lose" });
    store.insert("k9", { id: "k9", name: "D", quantity: 1 }, 1, {
      kind: "append",
      key: "k9",
    });
    const result = await saver.save("orders");
    expect(result.ok).toBe(true);
    expect(store.changes.size).toBe(0);
    expect(store.sends.size).toBe(0);
    expect(writes().filter((entry) => entry.method === "POST")).toHaveLength(1);
  });

  it("h12 — a recheck read that answers several rows is no evidence: the remove is neither sent nor reported saved", async () => {
    const recheck: CollectionSaveSettings = {
      ...ROWS_SAVE,
      conflict: { by: "recheck", endpointId: id("one") },
    };
    const { stub, saver, store, writes, intercept } = harness(recheck);
    // (The 「one row」 endpoint ignores the key and answers a list of rows not the one asked.)
    intercept.push((method, path) =>
      method === "GET" && path === "/orders/o1"
        ? new Response(
            JSON.stringify([stub.rows.get("o2"), stub.rows.get("o3")]),
            { headers: { "Content-Type": "application/json" } },
          )
        : undefined,
    );
    store.remove("o1", 1, store.knownRow("o1")!);
    const result = await saver.save("orders");
    expect(writes()).toHaveLength(0);
    expect(stub.rows.has("o1")).toBe(true);
    expect(store.changes.get("o1")?.kind).toBe("remove");
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("저장 1건");
  });

  it("h12 — a list answer holding the row asked among others is that row: the remove goes once", async () => {
    const recheck: CollectionSaveSettings = {
      ...ROWS_SAVE,
      conflict: { by: "recheck", endpointId: id("one") },
    };
    const { stub, saver, store, writes, intercept } = harness(recheck);
    intercept.push((method, path) =>
      method === "GET" && path === "/orders/o1"
        ? new Response(
            JSON.stringify([stub.rows.get("o1"), stub.rows.get("o2")]),
            { headers: { "Content-Type": "application/json" } },
          )
        : undefined,
    );
    store.remove("o1", 1, store.knownRow("o1")!);
    const result = await saver.save("orders");
    expect(writes().map((entry) => `${entry.method} ${entry.path}`)).toEqual([
      "DELETE /orders/o1",
    ]);
    expect(stub.rows.has("o1")).toBe(false);
    expect(result.ok).toBe(true);
  });

  it("h13 — a keyless create answered 202: a save again says it waits; 「취소」 closes it; nothing stays open", async () => {
    const { saver, store, writes } = harness(ROWS_SAVE, {
      createAnswer: "accepted",
    });
    store.insert("n1", { name: "C", quantity: 1 }, 1, {
      kind: "append",
      key: "n1",
    });
    await saver.save("orders");
    expect(saver.rowState("orders", "n1")?.status).toBe("processing");
    const again = await saver.save("orders");
    expect(again.ok).toBe(false);
    expect(again.message).toContain("결과 확인 필요 1건");
    expect(writes()).toHaveLength(1);
    expect(saver.changes("orders")).toMatchObject({
      count: 1,
      pending: 1,
      hasPending: true,
    });
    saver.discard("orders", undefined, "pending");
    expect(store.sends.size).toBe(0);
    expect(store.changes.size).toBe(0);
    expect(saver.changes("orders")).toMatchObject({
      count: 0,
      pending: 0,
      hasPending: false,
    });
  });

  it("h13 — 「다시 저장」 closes a waiting create and sends it again (the viewer's choice — once more, no more)", async () => {
    const { stub, saver, store, writes } = harness(ROWS_SAVE);
    stub.inject({ method: "POST", kind: "drop" });
    store.insert("n1", { name: "C", quantity: 1 }, 1, {
      kind: "append",
      key: "n1",
    });
    await saver.save("orders");
    expect(store.sends.size).toBe(1);
    const result = await saver.save("orders", { scope: "pending" });
    expect(result.ok).toBe(true);
    expect(writes().filter((entry) => entry.method === "POST")).toHaveLength(2);
    expect(store.sends.size).toBe(0);
    expect(store.changes.size).toBe(0);
    expect(
      [...stub.rows.values()].filter((row) => row.name === "C"),
    ).toHaveLength(1);
  });

  it("m15 — a server row whose key reads `row-1` is saved to its address", async () => {
    const { stub, saver, edit, writes } = harness(ROWS_SAVE, {
      rows: [{ id: "row-1", name: "이전", quantity: 1, note: "", version: "v1" }],
    });
    edit("row-1", { name: "새 이름" });
    const result = await saver.save("orders");
    expect(result.ok).toBe(true);
    expect(writes().map((entry) => `${entry.method} ${entry.path}`)).toEqual([
      "PATCH /orders/row-1",
    ]);
    expect(stub.rows.get("row-1")!.name).toBe("새 이름");
  });
});
