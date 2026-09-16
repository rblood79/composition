/**
 * tusd (Go 레퍼런스 서버) 대조군 — 같은 클라이언트가 참조 서버 방언이 아니라 표준 TUS 를 말하는지 (HC5).
 * `TUSD_BIN=/path/to/tusd pnpm -F @composition/upload test src/tusd.conformance.test.ts` — 바이너리가 없으면 skip.
 * mock 전용 결함 주입 (단절 · 504 · 만료 시뮬레이션) 은 여기서 뺀다. 결과 기록: breakdown §2-1.
 */
import { spawn, type ChildProcess } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createFetchDriver } from "./core/drivers/fetch";
import { createMemoryStorage } from "./core/drivers/storage";
import { createUploadQueue } from "./core/queue";
import type {
  HttpDriver,
  HttpRequest,
  UploadItemState,
  UploadQueue,
  UploadQueueOptions,
} from "./types";

const TUSD = process.env.TUSD_BIN ?? "";
const MB = 1024 ** 2;
const CHUNK = MB;

const freePort = (): Promise<number> =>
  new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => resolve(port));
    });
  });

let proc: ChildProcess | null = null;
let endpoint = "";
let dir = "";
const queues: UploadQueue[] = [];

function makeFile(size: number, name = "sample.bin"): File {
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) bytes[i] = (i * 7 + (i >> 9)) & 0xff;
  return new File([bytes], name, {
    type: "application/octet-stream",
    lastModified: 1_700_000_000_000,
  });
}

function spy(
  base: HttpDriver = createFetchDriver(),
): HttpDriver & { requests: HttpRequest[]; responses: number[] } {
  const requests: HttpRequest[] = [];
  const responses: number[] = [];
  return {
    requests,
    responses,
    async send(req) {
      requests.push(req);
      const res = await base.send(req);
      responses.push(res.status);
      return res;
    },
  };
}

function makeQueue(extra: Partial<UploadQueueOptions> = {}): UploadQueue {
  const q = createUploadQueue({
    endpoint,
    chunkSize: CHUNK,
    retryDelays: [0, 50, 100],
    driver: createFetchDriver(),
    storage: createMemoryStorage(),
    withCredentials: false,
    ...extra,
  });
  queues.push(q);
  return q;
}

const waitFor = (
  q: UploadQueue,
  pred: (items: UploadItemState[]) => boolean,
  timeoutMs = 20_000,
) =>
  new Promise<UploadItemState[]>((resolve, reject) => {
    if (pred(q.getItems())) return resolve(q.getItems());
    const t = setTimeout(
      () => reject(new Error(`timeout: ${JSON.stringify(q.getItems())}`)),
      timeoutMs,
    );
    const unsub = q.subscribe((items) => {
      if (pred(items)) {
        clearTimeout(t);
        unsub();
        resolve(items);
      }
    });
  });
const allDone = (items: UploadItemState[]) =>
  items.every((i) => i.status === "done");
const settled = (items: UploadItemState[]) =>
  items.every((i) => i.status === "done" || i.status === "error");

const idOf = (url: string) => url.slice(url.lastIndexOf("/") + 1);
const storedBytes = (url: string) => readFileSync(join(dir, idOf(url)));
const storedInfo = (url: string) =>
  JSON.parse(readFileSync(join(dir, `${idOf(url)}.info`), "utf8")) as {
    MetaData: Record<string, string>;
    Size: number;
    Offset: number;
  };

describe.skipIf(!TUSD || !existsSync(TUSD))(
  "tusd 대조군 — 표준 TUS 서버에 같은 클라이언트",
  () => {
    beforeAll(async () => {
      dir = mkdtempSync(join(tmpdir(), "adr201-tusd-"));
      const port = await freePort();
      proc = spawn(
        TUSD,
        [
          "-host",
          "127.0.0.1",
          "-port",
          String(port),
          "-upload-dir",
          dir,
          "-base-path",
          "/files/",
          "-max-size",
          String(64 * MB),
        ],
        {
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      endpoint = `http://127.0.0.1:${port}/files/`;
      // 기동 대기 — OPTIONS 가 응답할 때까지
      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline) {
        try {
          const r = await fetch(endpoint, { method: "OPTIONS" });
          if (r.status < 500) break;
        } catch {
          /* 아직 */
        }
        await new Promise((r) => setTimeout(r, 100));
      }
    }, 20_000);
    afterAll(async () => {
      for (const q of queues.splice(0)) q.destroy();
      proc?.kill();
      await new Promise((r) => setTimeout(r, 100));
      rmSync(dir, { recursive: true, force: true });
    });

    it("OPTIONS 광고: Tus-Extension 에 creation·termination (checksum 없음), Tus-Max-Size", async () => {
      const r = await fetch(endpoint, { method: "OPTIONS" });
      const ext = r.headers.get("Tus-Extension") ?? "";
      expect(ext).toContain("creation");
      expect(ext).toContain("termination");
      // tusd 2.10 은 checksum 확장을 광고하지 않는다 — 클라이언트는 광고된 것만 켠다 (아래 Upload-Checksum 미전송 검증)
      expect(ext).not.toContain("checksum");
      expect(r.headers.get("Tus-Max-Size")).toBe(String(64 * MB));
    });

    it("생성 → PATCH 루프 → 완료 · 내용 일치 · metadata (filename/filetype) 그대로 · checksum 미광고 → 헤더 없음", async () => {
      const driver = spy();
      const q = makeQueue({ driver });
      const file = makeFile(2.5 * MB);
      q.add([file]);
      const [item] = await waitFor(q, allDone);
      expect(
        storedBytes(item.url!).equals(Buffer.from(await file.arrayBuffer())),
      ).toBe(true);
      const info = storedInfo(item.url!);
      expect(info.MetaData).toMatchObject({
        filename: "sample.bin",
        filetype: "application/octet-stream",
      });
      // tusd 의 .info Offset 은 갱신되지 않는다 — 저장 파일 크기가 진실
      expect(storedBytes(item.url!).length).toBe(file.size);
      const patches = driver.requests.filter((r) => r.method === "PATCH");
      expect(patches.length).toBe(3);
      expect(patches.every((r) => !r.headers["Upload-Checksum"])).toBe(true);
    });

    it("저장소 재개 — 부분 업로드 후 새 큐: creation 0 추가, HEAD 로 이어서, 내용 일치", async () => {
      const storage = createMemoryStorage();
      const file = makeFile(6 * MB);
      const d1 = spy();
      const q1 = makeQueue({ storage, driver: d1, chunkSize: 512 * 1024 });
      q1.add([file]);
      const [it1] = await waitFor(q1, (items) => items[0].offset >= 2 * MB);
      q1.pause(it1.id);
      await waitFor(q1, (items) => items[0].status === "paused");
      const partial = storedBytes(it1.url!).length;
      expect(partial).toBeGreaterThan(0);
      expect(partial).toBeLessThan(file.size);
      q1.destroy();
      const d2 = spy();
      const q2 = makeQueue({ storage, driver: d2 });
      q2.add([makeFile(6 * MB)]);
      const [it2] = await waitFor(q2, allDone);
      expect(it2.url).toBe(it1.url);
      expect(d2.requests.filter((r) => r.method === "POST").length).toBe(0);
      expect(d2.requests.filter((r) => r.method === "HEAD").length).toBe(1);
      const sent = d2.requests
        .filter((r) => r.method === "PATCH")
        .reduce((n, r) => n + ((r.body as Blob)?.size ?? 0), 0);
      expect(sent).toBeLessThanOrEqual(file.size - partial + CHUNK);
      expect(
        storedBytes(it2.url!).equals(Buffer.from(await file.arrayBuffer())),
      ).toBe(true);
    });

    it("409 offset 불일치 (변조) — tusd 409 에는 Upload-Offset 이 없다 → HEAD 로 재동기 → 완료", async () => {
      let tampered = false;
      const base = createFetchDriver();
      const statuses: number[] = [];
      const driver: HttpDriver = {
        async send(req) {
          if (
            req.method === "PATCH" &&
            req.headers["Upload-Offset"] === String(MB) &&
            !tampered
          ) {
            tampered = true;
            req = {
              ...req,
              headers: { ...req.headers, "Upload-Offset": "777" },
            };
          }
          const res = await base.send(req);
          statuses.push(res.status);
          return res;
        },
      };
      const q = makeQueue({ driver });
      const file = makeFile(3 * MB);
      q.add([file]);
      const [item] = await waitFor(q, allDone);
      expect(statuses).toContain(409);
      expect(statuses.filter((s) => s === 409).length).toBe(1);
      expect(
        storedBytes(item.url!).equals(Buffer.from(await file.arrayBuffer())),
      ).toBe(true);
    });

    it("cancel → termination DELETE → 파일 소멸 · 이후 저장된 url 은 404 → E_EXPIRED → 재생성", async () => {
      const storage = createMemoryStorage();
      const q = makeQueue({ storage, chunkSize: 256 * 1024 });
      const [it1] = q.add([makeFile(4 * MB)]);
      const [{ url, fingerprint }] = await waitFor(
        q,
        (items) => items[0].offset >= MB,
      );
      q.cancel(it1.id);
      await waitFor(q, (items) => items[0].status === "error");
      await new Promise((r) => setTimeout(r, 300));
      expect(existsSync(join(dir, idOf(url!)))).toBe(false);
      // 고아 url 을 저장소에 심어 두면 HEAD 404 → E_EXPIRED → forget → create
      storage.set(fingerprint, { url: url! });
      const errors: string[] = [];
      const q2 = makeQueue({ storage });
      q2.subscribe(
        (items) => items[0].lastError && errors.push(items[0].lastError.code),
      );
      q2.add([makeFile(4 * MB)]);
      const [done] = await waitFor(q2, allDone);
      expect(errors).toContain("E_EXPIRED");
      expect(done.url).not.toBe(url);
    });

    it("Tus-Max-Size 초과 → E_TOO_LARGE (OPTIONS 값으로 선차단, creation 0)", async () => {
      const driver = spy();
      const q = makeQueue({ driver });
      q.add([makeFile(65 * MB, "too-big.bin")]);
      const [item] = await waitFor(q, settled, 30_000);
      expect(item.lastError?.code).toBe("E_TOO_LARGE");
      expect(driver.requests.filter((r) => r.method === "POST").length).toBe(0);
    });

    it("traversal 파일명 — 클라이언트는 그대로 싣고, tusd 는 id 기반 저장이라 수용 (metadata 원문 보존)", async () => {
      const names = ["../etc/passwd", "C:\\boot.ini", "a\u0000.jpg", "CON"];
      const q = makeQueue();
      q.add(names.map((n) => makeFile(1024, n)));
      const items = await waitFor(q, settled);
      for (const [i, it] of items.entries()) {
        // tusd 2.x 는 metadata 를 검증하지 않는다 — 어느 쪽이든 클라이언트는 조용히 죽지 않는다
        expect(["done", "error"]).toContain(it.status);
        if (it.status === "done")
          expect(storedInfo(it.url!).MetaData.filename).toBe(names[i]);
        else expect(it.lastError?.code).toBe("E_REJECTED");
        expect(
          readdirSync(dir).some(
            (f) => f.includes("passwd") || f.includes("boot"),
          ),
        ).toBe(false);
      }
    });

    it("parallelUploads 3 · 5 파일 전부 완료", async () => {
      const q = makeQueue({ parallelUploads: 3 });
      q.add([1, 2, 3, 4, 5].map((n) => makeFile(MB + n * 1000, `p${n}.bin`)));
      const items = await waitFor(q, allDone, 30_000);
      for (const it of items) expect(storedBytes(it.url!).length).toBe(it.size);
    });
  },
);
