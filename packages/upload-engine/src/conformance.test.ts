/**
 * mock TUS 서버 적합성 스위트 (G1) — 큐 + tus 어댑터 + FetchDriver 를 실제 HTTP 로 돌린다.
 * 단절 · 409 · 만료 · pause/resume/cancel · backoff · checksum · override · 504 · 저장소 재개 · 동시성 · 폴더.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMockTusServer, type MockTusServer } from "../test/mockTusServer";
import { createFetchDriver } from "./core/drivers/fetch";
import { createMemoryStorage } from "./core/drivers/storage";
import { createUploadQueue, withRelativePath } from "./core/queue";
import type {
  HttpDriver,
  HttpRequest,
  ResumeStorage,
  UploadItemState,
  UploadQueue,
  UploadQueueOptions,
} from "./types";

const MB = 1024 ** 2;
const CHUNK = 1 * MB;
const FAST_RETRY = [0, 30, 60, 90];

let mock: MockTusServer;
const queues: UploadQueue[] = [];

beforeEach(async () => {
  mock = await createMockTusServer({ keepBytes: true });
});
afterEach(async () => {
  for (const q of queues.splice(0)) q.destroy();
  await mock.close();
});

/** 결정성 내용 (offset 연속성 검증용) */
function makeFile(
  size: number,
  name = "sample.bin",
  opts: FilePropertyBag = {},
): File {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 31 + (i >> 8)) & 0xff;
  return new File([bytes], name, {
    type: "application/octet-stream",
    lastModified: 1_700_000_000_000,
    ...opts,
  });
}

function makeQueue(extra: Partial<UploadQueueOptions> = {}): UploadQueue {
  const q = createUploadQueue({
    endpoint: mock.endpoint,
    chunkSize: CHUNK,
    retryDelays: FAST_RETRY,
    driver: createFetchDriver(),
    storage: createMemoryStorage(),
    ...extra,
  });
  queues.push(q);
  return q;
}

/** 조건을 만족하는 첫 스냅샷 (subscribe) — 재시도 타이밍에 의존하지 않는다 */
function waitFor(
  q: UploadQueue,
  pred: (items: UploadItemState[]) => boolean,
  timeoutMs = 10_000,
): Promise<UploadItemState[]> {
  return new Promise((resolve, reject) => {
    const cur = q.getItems();
    if (pred(cur)) return resolve(cur);
    const timer = setTimeout(() => {
      unsub();
      reject(new Error(`waitFor timeout — ${JSON.stringify(q.getItems())}`));
    }, timeoutMs);
    const unsub = q.subscribe((items) => {
      if (pred(items)) {
        clearTimeout(timer);
        unsub();
        resolve(items);
      }
    });
  });
}
const settled = (items: UploadItemState[]) =>
  items.every((i) => i.status === "done" || i.status === "error");
const allDone = (items: UploadItemState[]) =>
  items.every((i) => i.status === "done");

const serverBytes = () =>
  Buffer.concat(Array.from(mock.uploads.values())[0]?.bytes ?? []);
const patchSizes = () =>
  mock.stats.requests
    .filter((r) => r.method.startsWith("PATCH") && r.status === 204)
    .map((r) => r.bytes);

/** driver 를 감싸 요청을 관찰/변조한다 */
function spyDriver(
  onRequest: (req: HttpRequest) => HttpRequest | void,
  base: HttpDriver = createFetchDriver(),
): HttpDriver & { requests: HttpRequest[] } {
  const requests: HttpRequest[] = [];
  return {
    requests,
    send(req) {
      const r = onRequest(req) ?? req;
      requests.push(r);
      return base.send(r);
    },
  };
}

describe("core + creation", () => {
  it("생성 → PATCH 루프 → 완료: 서버 offset = size, 청크 수 = ceil(size/chunk), 내용 일치, forget", async () => {
    const storage = createMemoryStorage();
    const q = makeQueue({ storage });
    const file = makeFile(2.5 * MB);
    const [added] = q.add([file]);
    expect(added.status).toBe("queued");
    expect(added.fingerprint).toBe("");
    const items = await waitFor(q, allDone);
    const u = Array.from(mock.uploads.values())[0];
    expect(u.offset).toBe(file.size);
    expect(u.patches).toBe(3);
    expect(u.metadata).toEqual({
      filename: "sample.bin",
      filetype: "application/octet-stream",
    });
    expect(serverBytes().equals(Buffer.from(await file.arrayBuffer()))).toBe(
      true,
    );
    expect(items[0].offset).toBe(file.size);
    expect(items[0].fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(await storage.get(items[0].fingerprint)).toBeNull();
    expect(mock.stats.requests[0].method).toBe("OPTIONS");
  });

  it("chunkSize Infinity — 단일 PATCH", async () => {
    const q = makeQueue({ chunkSize: Infinity });
    q.add([makeFile(3 * MB)]);
    await waitFor(q, allDone);
    expect(patchSizes()).toEqual([3 * MB]);
  });

  it("빈 파일 · 폴더 상대 경로 (webkitRelativePath 대체 채널) 가 metadata 로", async () => {
    const q = makeQueue();
    q.add([withRelativePath(makeFile(0, "empty.txt"), "dir/sub/empty.txt")]);
    const items = await waitFor(q, allDone);
    expect(items[0].relativePath).toBe("dir/sub/empty.txt");
    expect(Array.from(mock.uploads.values())[0].metadata.relativePath).toBe(
      "dir/sub/empty.txt",
    );
  });

  it("autoProceed:false 는 start() 까지 대기, remove 는 목록에서 제거", async () => {
    const q = makeQueue({ autoProceed: false });
    const [a, b] = q.add([makeFile(MB, "a"), makeFile(MB, "b")]);
    await new Promise((r) => setTimeout(r, 50));
    expect(mock.stats.creations).toBe(0);
    q.start(a.id);
    await waitFor(q, (items) => items[0].status === "done");
    expect(q.getItems()[1].status).toBe("queued");
    q.remove(b.id);
    expect(q.getItems().map((i) => i.id)).toEqual([a.id]);
  });
});

describe("재개 — 서버 Upload-Offset 이 진실", () => {
  it("소켓 단절 (stream 커밋) → E_NETWORK → HEAD → 재전송 ≤ chunkSize", async () => {
    mock.setOptions({ abortAfterBytes: 1.5 * MB });
    const q = makeQueue();
    const file = makeFile(4 * MB);
    q.add([file]);
    const errors: string[] = [];
    q.subscribe(
      (items) => items[0].lastError && errors.push(items[0].lastError.code),
    );
    await waitFor(q, allDone);
    expect(errors).toContain("E_NETWORK");
    expect(mock.stats.heads).toBeGreaterThanOrEqual(1);
    expect(mock.stats.bytesReceived - file.size).toBeLessThanOrEqual(CHUNK);
    expect(serverBytes().equals(Buffer.from(await file.arrayBuffer()))).toBe(
      true,
    );
  });

  it("chunk 커밋 서버 (부분 저장 없음) 에서도 재전송 ≤ chunkSize", async () => {
    mock.setOptions({ abortAfterBytes: 1.5 * MB, commitMode: "chunk" });
    const q = makeQueue();
    const file = makeFile(3 * MB);
    q.add([file]);
    await waitFor(q, allDone);
    expect(mock.stats.bytesReceived - file.size).toBeLessThanOrEqual(CHUNK);
    expect(serverBytes().equals(Buffer.from(await file.arrayBuffer()))).toBe(
      true,
    );
  });

  it("409 offset 불일치 → 대기 없이 HEAD 재동기", async () => {
    let tampered = false;
    const driver = spyDriver((req) => {
      if (
        req.method === "PATCH" &&
        req.headers["Upload-Offset"] === String(MB) &&
        !tampered
      ) {
        tampered = true;
        return {
          ...req,
          headers: { ...req.headers, "Upload-Offset": "12345" },
        };
      }
    });
    const q = makeQueue({ driver });
    const errors: string[] = [];
    q.subscribe(
      (items) => items[0].lastError && errors.push(items[0].lastError.code),
    );
    const file = makeFile(3 * MB);
    q.add([file]);
    await waitFor(q, allDone);
    expect(errors).toContain("E_OFFSET_MISMATCH");
    expect(mock.stats.requests.some((r) => r.status === 409)).toBe(true);
    // 409 에 Upload-Offset 이 동봉되므로 HEAD 없이 재동기
    expect(mock.stats.heads).toBe(0);
    expect(serverBytes().equals(Buffer.from(await file.arrayBuffer()))).toBe(
      true,
    );
  });

  it("409 에 Upload-Offset 이 없는 서버 (tusd 동형) → HEAD 로 재동기, offset 0 오인 없음", async () => {
    let tampered = false;
    const base = createFetchDriver();
    const driver: HttpDriver = {
      async send(req) {
        if (
          req.method === "PATCH" &&
          req.headers["Upload-Offset"] === String(MB) &&
          !tampered
        ) {
          tampered = true;
          req = { ...req, headers: { ...req.headers, "Upload-Offset": "777" } };
        }
        const res = await base.send(req);
        return res.status === 409
          ? { ...res, header: (n) => (n === "Upload-Offset" ? null : res.header(n)) }
          : res;
      },
    };
    const q = makeQueue({ driver });
    const file = makeFile(3 * MB);
    q.add([file]);
    await waitFor(q, allDone);
    expect(mock.stats.heads).toBe(1);
    expect(mock.stats.requests.filter((r) => r.status === 409).length).toBe(1);
    expect(serverBytes().equals(Buffer.from(await file.arrayBuffer()))).toBe(
      true,
    );
  });

  it("만료 (410) → forget → 처음부터 재생성", async () => {
    mock.setOptions({ patchDelayMs: 30 });
    const storage = createMemoryStorage();
    const q = makeQueue({ storage });
    const errors: string[] = [];
    q.subscribe(
      (items) => items[0].lastError && errors.push(items[0].lastError.code),
    );
    const file = makeFile(3 * MB);
    q.add([file]);
    await waitFor(q, (items) => items[0].url !== undefined);
    // 서버 TTL GC 가 첫 업로드를 만료시켰다 — 다음 요청은 410
    Array.from(mock.uploads.values())[0].expiresAt = Date.now() - 1;
    await waitFor(q, allDone);
    expect(errors).toContain("E_EXPIRED");
    expect(mock.stats.creations).toBe(2);
    const done = Array.from(mock.uploads.values()).find(
      (u) => u.offset === file.size,
    )!;
    expect(
      Buffer.concat(done.bytes!).equals(Buffer.from(await file.arrayBuffer())),
    ).toBe(true);
    expect(await storage.get(q.getItems()[0].fingerprint)).toBeNull();
  });

  it("저장소 재개 (새로고침/탭 종료 동형): 새 큐 + 같은 파일 → fingerprint 매치 → HEAD 부터, creation 1회, 재전송 0", async () => {
    mock.setOptions({ patchDelayMs: 40 });
    const storage: ResumeStorage = createMemoryStorage();
    const file = makeFile(4 * MB);
    const q1 = makeQueue({ storage });
    const [it1] = q1.add([file]);
    await waitFor(q1, (items) => items[0].offset >= 2 * MB);
    q1.destroy(); // 페이지 종료 — 전송 중 요청 abort
    const uploaded = Array.from(mock.uploads.values())[0].offset;
    expect(uploaded).toBeGreaterThan(0);
    expect(uploaded).toBeLessThan(file.size);
    const before = mock.stats.bytesReceived;

    const q2 = makeQueue({ storage });
    const [it2] = q2.add([makeFile(4 * MB)]);
    expect(it2.id).not.toBe(it1.id);
    const items = await waitFor(q2, allDone);
    expect(items[0].fingerprint).toBe(
      (await waitFor(q1, () => true))[0].fingerprint,
    );
    expect(mock.stats.creations).toBe(1);
    expect(mock.stats.heads).toBeGreaterThanOrEqual(1);
    // 재전송 = 새 큐가 보낸 총량 − 남아 있던 양 ≤ chunkSize
    expect(
      mock.stats.bytesReceived - before - (file.size - uploaded),
    ).toBeLessThanOrEqual(CHUNK);
    expect(serverBytes().equals(Buffer.from(await file.arrayBuffer()))).toBe(
      true,
    );
  });

  it("Upload-Expires 가 지난 저장 항목은 무시하고 새로 만든다", async () => {
    const storage = createMemoryStorage();
    const file = makeFile(MB);
    const fp = (
      await (async () => {
        const q = makeQueue({ storage, autoProceed: false });
        q.add([file]);
        return waitFor(q, (items) => items[0].fingerprint !== "");
      })()
    )[0].fingerprint;
    storage.set(fp, {
      url: `${mock.endpoint}/ghost`,
      expires: Date.now() - 1000,
    });
    const q = makeQueue({ storage });
    q.add([file]);
    await waitFor(q, allDone);
    expect(mock.stats.creations).toBe(1);
    expect(mock.stats.requests.some((r) => r.path.endsWith("/ghost"))).toBe(
      false,
    );
  });
});

describe("pause / resume / cancel", () => {
  it("pause 는 전송을 끊고 offset 을 committed 로, resume 은 HEAD 후 이어서", async () => {
    mock.setOptions({ patchDelayMs: 40 });
    const q = makeQueue();
    const file = makeFile(5 * MB);
    const [it] = q.add([file]);
    await waitFor(q, (items) => items[0].offset >= MB);
    q.pause(it.id);
    const paused = await waitFor(q, (items) => items[0].status === "paused");
    const serverOffset = Array.from(mock.uploads.values())[0].offset;
    expect(paused[0].offset).toBeLessThanOrEqual(serverOffset + CHUNK);
    await new Promise((r) => setTimeout(r, 100));
    expect(q.getItems()[0].status).toBe("paused");
    const headsBefore = mock.stats.heads;
    q.resume(it.id);
    await waitFor(q, allDone);
    expect(mock.stats.heads).toBe(headsBefore + 1);
    expect(mock.stats.creations).toBe(1);
    expect(serverBytes().equals(Buffer.from(await file.arrayBuffer()))).toBe(
      true,
    );
  });

  it("cancel 은 E_CANCELLED + termination DELETE + 저장소 forget, 이후 start 로 새 업로드", async () => {
    mock.setOptions({ patchDelayMs: 40 });
    const storage = createMemoryStorage();
    const q = makeQueue({ storage });
    const [it] = q.add([makeFile(4 * MB)]);
    await waitFor(q, (items) => items[0].url !== undefined);
    q.cancel(it.id);
    const items = await waitFor(q, (list) => list[0].status === "error");
    expect(items[0].lastError?.code).toBe("E_CANCELLED");
    await waitFor(
      q,
      () =>
        mock.stats.requests.some(
          (r) => r.method === "DELETE" && r.status === 204,
        ),
      2000,
    ).catch(() => {});
    expect(
      mock.stats.requests.some(
        (r) => r.method === "DELETE" && r.status === 204,
      ),
    ).toBe(true);
    expect(await storage.get(items[0].fingerprint)).toBeNull();
    expect(Array.from(mock.uploads.values())[0].terminated).toBe(true);
    q.start(it.id);
    await waitFor(q, allDone);
    expect(mock.stats.creations).toBe(2);
  });

  it("pause()/resume() 무인자 — 전체", async () => {
    mock.setOptions({ patchDelayMs: 30 });
    const q = makeQueue({ parallelUploads: 2 });
    q.add([makeFile(2 * MB, "a"), makeFile(2 * MB, "b")]);
    await waitFor(q, (items) => items.every((i) => i.status === "uploading"));
    q.pause();
    await waitFor(q, (items) => items.every((i) => i.status === "paused"));
    q.resume();
    await waitFor(q, allDone);
  });
});

describe("backoff · 에러 분류 (R1)", () => {
  it("서버 다운 → retryDelays 순서로 재시도, 복구되면 완료 (attempt 관찰)", async () => {
    const q = makeQueue({ retryDelays: [0, 40, 80, 500] });
    const attempts = new Set<number>();
    q.subscribe((items) => attempts.add(items[0].attempt));
    const file = makeFile(3 * MB);
    q.add([file]);
    await waitFor(q, (items) => items[0].url !== undefined);
    await mock.pause();
    await new Promise((r) => setTimeout(r, 150));
    await mock.resume();
    await waitFor(q, allDone);
    expect(Math.max(...attempts)).toBeGreaterThanOrEqual(2);
    expect(q.getItems()[0].attempt).toBe(0);
    expect(serverBytes().equals(Buffer.from(await file.arrayBuffer()))).toBe(
      true,
    );
  });

  it("재시도 소진 → error(E_NETWORK, retryable) · 서버 복구 후 start(id) 로 이어서", async () => {
    const q = makeQueue({ retryDelays: [0, 10] });
    const file = makeFile(3 * MB);
    const [it] = q.add([file]);
    await waitFor(q, (items) => items[0].url !== undefined);
    await mock.pause();
    const items = await waitFor(q, settled);
    expect(items[0].status).toBe("error");
    expect(items[0].lastError?.code).toBe("E_NETWORK");
    expect(items[0].attempt).toBe(3);
    await mock.resume();
    q.start(it.id);
    await waitFor(q, allDone);
    expect(mock.stats.creations).toBe(1);
  });

  it("401 → E_UNAUTHORIZED 즉시 error (재시도 0)", async () => {
    mock.setOptions({ rejectAuth: true });
    const q = makeQueue();
    q.add([makeFile(MB)]);
    const items = await waitFor(q, settled);
    expect(items[0].lastError).toMatchObject({
      code: "E_UNAUTHORIZED",
      status: 401,
      retryable: false,
    });
    expect(mock.stats.creations).toBe(0);
    expect(mock.stats.requests.filter((r) => r.method === "POST").length).toBe(
      1,
    );
  });

  it("Tus-Max-Size 초과 → E_TOO_LARGE, creation 0 · maxFileSize 는 add 시점에 error", async () => {
    mock.setOptions({ maxSize: 2 * MB });
    const q = makeQueue({ maxFileSize: 10 * MB });
    const [big, huge] = q.add([
      makeFile(3 * MB, "big"),
      makeFile(11 * MB, "huge"),
    ]);
    expect(huge.status).toBe("error");
    expect(huge.lastError?.code).toBe("E_TOO_LARGE");
    const items = await waitFor(q, settled);
    expect(items.find((i) => i.id === big.id)?.lastError?.code).toBe(
      "E_TOO_LARGE",
    );
    expect(mock.stats.creations).toBe(0);
  });

  it("PATCH 405 → X-HTTP-Method-Override 로 1회 자동 전환 후 완료", async () => {
    mock.setOptions({ blockPatch: true, allowOverride: true });
    const q = makeQueue();
    const errors: string[] = [];
    q.subscribe(
      (items) => items[0].lastError && errors.push(items[0].lastError.code),
    );
    const file = makeFile(2 * MB);
    q.add([file]);
    await waitFor(q, allDone);
    expect(errors).toContain("E_PATCH_BLOCKED");
    expect(
      mock.stats.requests.filter(
        (r) => r.method === "PATCH(override)" && r.status === 204,
      ).length,
    ).toBe(2);
    expect(serverBytes().equals(Buffer.from(await file.arrayBuffer()))).toBe(
      true,
    );
  });

  it("override 도 막히면 E_PATCH_BLOCKED 로 종료 (retryable false)", async () => {
    mock.setOptions({ blockPatch: true, allowOverride: false });
    const q = makeQueue();
    q.add([makeFile(MB)]);
    const items = await waitFor(q, settled);
    expect(items[0].lastError).toMatchObject({
      code: "E_PATCH_BLOCKED",
      retryable: false,
    });
  });

  it("overridePatchMethod:true 는 처음부터 POST + override", async () => {
    mock.setOptions({ blockPatch: true, allowOverride: true });
    const q = makeQueue({ overridePatchMethod: true });
    q.add([makeFile(MB)]);
    await waitFor(q, allDone);
    expect(
      mock.stats.requests.some((r) => r.method === "PATCH" && r.status === 405),
    ).toBe(false);
  });

  it("504 (프록시 timeout) → E_PROXY_TIMEOUT → 다음 청크부터 절반", async () => {
    mock.setOptions({ gatewayTimeoutMs: 10 });
    const q = makeQueue({ chunkSize: 2 * MB });
    const errors: string[] = [];
    q.subscribe(
      (items) => items[0].lastError && errors.push(items[0].lastError.code),
    );
    const file = makeFile(5 * MB);
    q.add([file]);
    await waitFor(q, allDone);
    expect(errors).toContain("E_PROXY_TIMEOUT");
    // 504 이후의 청크는 전부 절반 (1MB). (stream 커밋 서버는 504 난 청크도 저장했을 수 있어 HEAD 가 결정)
    const sizes = patchSizes();
    expect(sizes.length).toBeGreaterThanOrEqual(3);
    expect(sizes.slice(sizes.length - 3).every((b) => b === MB)).toBe(true);
    expect(mock.stats.requests.some((r) => r.status === 504)).toBe(true);
    expect(serverBytes().equals(Buffer.from(await file.arrayBuffer()))).toBe(
      true,
    );
  });

  it("requestTimeout — 응답 없는 서버는 E_PROXY_TIMEOUT 후 재시도", async () => {
    mock.setOptions({ hangPatch: true });
    const q = makeQueue({ requestTimeout: 150 });
    const errors: string[] = [];
    q.subscribe(
      (items) => items[0].lastError && errors.push(items[0].lastError.code),
    );
    q.add([makeFile(MB)]);
    await waitFor(q, allDone);
    expect(errors).toContain("E_PROXY_TIMEOUT");
  });
});

describe("확장 감지 — checksum · termination · CSRF · 소유자", () => {
  it("서버가 checksum 을 광고하면 Upload-Checksum 을 싣고, 460 은 같은 청크 재전송", async () => {
    mock.setOptions({ failChecksumOnce: true });
    const driver = spyDriver(() => {});
    const q = makeQueue({ driver });
    const errors: string[] = [];
    q.subscribe(
      (items) => items[0].lastError && errors.push(items[0].lastError.code),
    );
    const file = makeFile(2 * MB);
    q.add([file]);
    await waitFor(q, allDone);
    const patches = driver.requests.filter((r) => r.method === "PATCH");
    expect(
      patches.every((r) =>
        /^sha256 [A-Za-z0-9+/=]+$/.test(r.headers["Upload-Checksum"]),
      ),
    ).toBe(true);
    expect(errors).toContain("E_CHECKSUM");
    expect(patches.length).toBe(3); // 2 청크 + 460 재전송 1
    expect(serverBytes().equals(Buffer.from(await file.arrayBuffer()))).toBe(
      true,
    );
  });

  it("checksum:false 또는 서버 미광고면 헤더 없음", async () => {
    mock.setOptions({ extensions: ["creation", "expiration"] });
    const driver = spyDriver(() => {});
    const q = makeQueue({ driver });
    q.add([makeFile(MB)]);
    await waitFor(q, allDone);
    expect(
      driver.requests
        .filter((r) => r.method === "PATCH")
        .every((r) => !r.headers["Upload-Checksum"]),
    ).toBe(true);
    expect(mock.stats.requests.some((r) => r.method === "DELETE")).toBe(false);
  });

  it("CSRF 헤더 필수 서버 — getHeaders() 가 토큰을 주면 통과, 없으면 E_UNAUTHORIZED", async () => {
    mock.setOptions({ requireCsrfHeader: "X-CSRF-Token" });
    const noToken = makeQueue();
    noToken.add([makeFile(MB)]);
    const failed = await waitFor(noToken, settled);
    expect(failed[0].lastError).toMatchObject({
      code: "E_UNAUTHORIZED",
      status: 403,
    });
    const withToken = makeQueue({
      getHeaders: async () => ({ "X-CSRF-Token": "t0k3n" }),
    });
    withToken.add([makeFile(MB)]);
    await waitFor(withToken, allDone);
  });

  it("타인의 upload url (소유자 불일치) → 403 → E_UNAUTHORIZED", async () => {
    mock.setOptions({ patchDelayMs: 30 });
    const storage = createMemoryStorage();
    const file = makeFile(3 * MB);
    const owner = makeQueue({ storage, headers: { "X-Owner": "alice" } });
    owner.add([file]);
    await waitFor(owner, (items) => items[0].offset >= MB);
    owner.destroy();
    const thief = makeQueue({ storage, headers: { "X-Owner": "mallory" } });
    thief.add([makeFile(3 * MB)]);
    const items = await waitFor(thief, settled);
    expect(items[0].lastError).toMatchObject({
      code: "E_UNAUTHORIZED",
      status: 403,
    });
    expect(mock.stats.creations).toBe(1);
  });

  it("Access-Control-Allow-Origin:* + credentials → 명시 실패 (E_NETWORK), creation 0", async () => {
    mock.setOptions({ corsStar: true });
    const q = makeQueue();
    q.add([makeFile(MB)]);
    const items = await waitFor(q, settled);
    expect(items[0].lastError?.code).toBe("E_NETWORK");
    expect(items[0].lastError?.message).toMatch(/Allow-Origin/);
    expect(mock.stats.creations).toBe(0);
    // withCredentials:false 면 `*` 로도 진행
    const q2 = makeQueue({ withCredentials: false });
    q2.add([makeFile(MB)]);
    await waitFor(q2, allDone);
  });
});

describe("동시성 · 다른 프로토콜", () => {
  it("parallelUploads:2 — 동시 활성 ≤ 2, 5개 전부 완료 (순서 유지)", async () => {
    mock.setOptions({ patchDelayMs: 20 });
    const q = makeQueue({ parallelUploads: 2 });
    let maxActive = 0;
    q.subscribe((items) => {
      const n = items.filter(
        (i) => i.status === "uploading" || i.status === "creating",
      ).length;
      maxActive = Math.max(maxActive, n);
    });
    q.add([1, 2, 3, 4, 5].map((n) => makeFile(MB, `f${n}`)));
    await waitFor(q, allDone, 20_000);
    expect(maxActive).toBe(2);
    expect(mock.uploads.size).toBe(5);
  });

  it("multipart fallback — 단일 POST, 재개 없음", async () => {
    const q = makeQueue({
      protocol: "multipart",
      endpoint: `${mock.endpoint}/multipart`,
    });
    const file = makeFile(2 * MB);
    q.add([file]);
    const items = await waitFor(q, allDone);
    expect(items[0].offset).toBe(file.size);
    const post = mock.stats.requests.find((r) => r.method === "POST");
    expect(post?.status).toBe(201);
    expect(post?.bytes).toBeGreaterThan(file.size); // multipart 경계 포함
    expect(mock.stats.patches).toBe(0);
  });

  it("dryRun — 네트워크 0, 진행률 시뮬레이션, 저장소 메모리", async () => {
    const q = createUploadQueue({
      endpoint: "https://example.invalid/files",
      dryRun: true,
      chunkSize: 4 * MB,
    });
    queues.push(q);
    const offsets: number[] = [];
    q.subscribe((items) => offsets.push(items[0].offset));
    q.add([makeFile(10 * MB)]);
    const items = await waitFor(q, allDone);
    expect(items[0].url).toMatch(/^https:\/\/example\.invalid\/files\/dry-/);
    expect(new Set(offsets).size).toBeGreaterThan(3);
    expect(mock.stats.requests.length).toBe(0);
  });
});
