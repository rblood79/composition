/**
 * 클라이언트 측 공격 corpus (ADR-201 §3-6 · G1).
 *
 * 클라이언트는 파일명을 검열하지 않는다 — metadata 를 base64 로 그대로 싣고 서버 거부 (400) 를
 * `E_REJECTED` (retryable false) 로 처리한다. 검증은 서버 책임 (참조 서버 · tusd 동일).
 * 추가: `Upload-Length` 초과 PATCH · Upload-Defer-Length · localStorage 파일명 0 · CORS `*` + credentials.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createMockTusServer,
  decodeMetadata,
  validatePathName,
  type MockTusServer,
} from "../test/mockTusServer";
import { encodeMetadata } from "./adapters/tus";
import { createFetchDriver } from "./core/drivers/fetch";
import { createLocalStorageDriver } from "./core/drivers/storage";
import { createUploadQueue } from "./core/queue";
import type { HttpRequest, UploadItemState, UploadQueue } from "./types";

let mock: MockTusServer;
const queues: UploadQueue[] = [];
beforeEach(async () => {
  mock = await createMockTusServer();
});
afterEach(async () => {
  for (const q of queues.splice(0)) q.destroy();
  await mock.close();
});

const settle = (q: UploadQueue): Promise<UploadItemState[]> =>
  new Promise((resolve) => {
    const check = (items: UploadItemState[]) => {
      if (items.every((i) => i.status === "done" || i.status === "error"))
        resolve(items);
    };
    q.subscribe(check);
    check(q.getItems());
  });

const TRAVERSAL_NAMES: Array<[string, string]> = [
  ["../etc/passwd", "traversal"],
  ["..\\..\\windows\\win.ini", "traversal"],
  ["/etc/passwd", "absolute path"],
  ["C:\\boot.ini", "drive letter"],
  ["\\\\server\\share\\x", "unc path"],
  ["..", "traversal"],
  [".", "traversal"],
  ["a\u0000.jpg", "control character"],
  ["a\r\nX-Injected: 1", "control character"],
  ["CON", "reserved name"],
  ["report<script>.txt", "forbidden character"],
  ["x".repeat(300), "segment too long"],
];

describe("traversal 파일명 12종 — 그대로 싣고 서버 거부를 E_REJECTED 로", () => {
  it("서버 검증 함수가 12종 전부 거부하고 정상 이름은 통과", () => {
    for (const [name, why] of TRAVERSAL_NAMES)
      expect(validatePathName(name, false), name).toBe(why);
    for (const ok of ["report.txt", "한글 파일 (1).pdf", "a.b.c", "été.png"]) {
      expect(validatePathName(ok, false), ok).toBeNull();
    }
    expect(validatePathName("dir/../x", true)).toBe("traversal");
    expect(validatePathName("dir/sub/file.txt", true)).toBeNull();
  });

  it.each(TRAVERSAL_NAMES)(
    "%j → 400 E_REJECTED, creation 0, 저장소 0",
    async (name) => {
      const sent: HttpRequest[] = [];
      const base = createFetchDriver();
      const store = new Map<string, string>();
      const q = createUploadQueue({
        endpoint: mock.endpoint,
        driver: { send: (r) => (sent.push(r), base.send(r)) },
        storage: createLocalStorageDriver({
          getItem: (k) => store.get(k) ?? null,
          setItem: (k, v) => void store.set(k, v),
          removeItem: (k) => void store.delete(k),
        }),
        retryDelays: [0],
      });
      queues.push(q);
      q.add([new File([new Uint8Array(64)], name)]);
      const [item] = await settle(q);
      expect(item.status).toBe("error");
      expect(item.lastError).toMatchObject({
        code: "E_REJECTED",
        status: 400,
        retryable: false,
      });
      expect(item.lastError?.message).toMatch(/rejected|Upload-Metadata/);
      // 클라이언트는 이름을 바꾸지 않았다 — base64 를 풀면 원문
      const create = sent.find((r) => r.method === "POST")!;
      expect(
        decodeMetadata(create.headers["Upload-Metadata"]).metadata.filename,
      ).toBe(name);
      expect(mock.uploads.size).toBe(0);
      expect(store.size).toBe(0);
      // 헤더에 CR/LF 가 실리지 않는다 (base64)
      expect(create.headers["Upload-Metadata"]).not.toMatch(/[\r\n\0]/);
    },
  );
});

describe("프로토콜 층", () => {
  it("Upload-Length 초과 PATCH 는 400 (커밋은 length 까지)", async () => {
    const driver = createFetchDriver();
    const create = await driver.send({
      method: "POST",
      url: mock.endpoint,
      headers: { "Tus-Resumable": "1.0.0", "Upload-Length": "10" },
    });
    const url = new URL(create.header("Location")!, mock.endpoint).href;
    const res = await driver.send({
      method: "PATCH",
      url,
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
        "Content-Type": "application/offset+octet-stream",
      },
      body: new Blob([new Uint8Array(64)]),
    });
    expect(res.status).toBe(400);
    expect(Array.from(mock.uploads.values())[0].offset).toBe(10);
  });

  it("Upload-Defer-Length 는 400 · Content-Type 오류는 415 · 없는 id 는 404", async () => {
    const driver = createFetchDriver();
    const defer = await driver.send({
      method: "POST",
      url: mock.endpoint,
      headers: { "Tus-Resumable": "1.0.0", "Upload-Defer-Length": "1" },
    });
    expect(defer.status).toBe(400);
    const create = await driver.send({
      method: "POST",
      url: mock.endpoint,
      headers: { "Tus-Resumable": "1.0.0", "Upload-Length": "4" },
    });
    const url = new URL(create.header("Location")!, mock.endpoint).href;
    const bad = await driver.send({
      method: "PATCH",
      url,
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": "0",
        "Content-Type": "text/plain",
      },
      body: new Blob(["abcd"]),
    });
    expect(bad.status).toBe(415);
    const missing = await driver.send({
      method: "HEAD",
      url: `${mock.endpoint}/nope`,
      headers: { "Tus-Resumable": "1.0.0" },
    });
    expect(missing.status).toBe(404);
  });

  it("metadata 널바이트 · 중복 키 · 잘못된 base64 → 400", () => {
    expect(decodeMetadata("filename AAAA,filename BBBB").error).toBe(
      "duplicate key",
    );
    expect(decodeMetadata("filename !!!").error).toBe("bad base64");
    expect(decodeMetadata("file name AAAA").error).toBe("bad key");
    expect(encodeMetadata({ "bad key": "x", ok: "y" })).toBe("ok eQ==");
    expect(
      decodeMetadata(encodeMetadata({ filename: "a\u0000b" })).metadata
        .filename,
    ).toBe("a\u0000b");
  });
});

describe("클라이언트 층", () => {
  it("localStorage 에는 fingerprint 키 + url 만 — 파일명·크기·내용 0", async () => {
    mock.setOptions({ patchDelayMs: 40 });
    const store = new Map<string, string>();
    const q = createUploadQueue({
      endpoint: mock.endpoint,
      driver: createFetchDriver(),
      chunkSize: 1024 ** 2,
      storage: createLocalStorageDriver({
        getItem: (k) => store.get(k) ?? null,
        setItem: (k, v) => void store.set(k, v),
        removeItem: (k) => void store.delete(k),
      }),
    });
    queues.push(q);
    const name = "secret-contract-2026.pdf";
    q.add([new File([new Uint8Array(3 * 1024 ** 2)], name)]);
    await new Promise<void>((r) => q.subscribe((items) => items[0].url && r()));
    expect(store.size).toBe(1);
    const [key, value] = Array.from(store.entries())[0];
    expect(key).toMatch(/^cu:[0-9a-f]{64}$/);
    expect(JSON.parse(value)).toEqual({
      u: expect.stringContaining(mock.endpoint),
    });
    expect(value).not.toContain("secret");
    expect(value).not.toContain("pdf");
    expect(value).not.toContain(String(3 * 1024 ** 2));
    q.destroy();
  });

  it("사설 모드 (localStorage throw) 에서도 업로드는 진행", async () => {
    const q = createUploadQueue({
      endpoint: mock.endpoint,
      driver: createFetchDriver(),
      storage: createLocalStorageDriver({
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
        removeItem: () => {
          throw new Error("SecurityError");
        },
      }),
    });
    queues.push(q);
    q.add([new File([new Uint8Array(1024)], "x.bin")]);
    const [item] = await settle(q);
    expect(item.status).toBe("done");
  });
});
