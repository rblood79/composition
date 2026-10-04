// @vitest-environment node
import { IDBFactory } from "fake-indexeddb";
import { describe, it, expect } from "vitest";
import { IndexedDBAdapter } from "../indexedDB/adapter";

describe("IndexedDB adapter schema (data store · 자산)", () => {
  it("DB_VERSION 이 25 로 갱신된다 (2026-10-05 ADR-248 후속: 구 canonical 문서 store 삭제)", async () => {
    // pin 은 버전 상향을 의도적으로 만들기 위한 ratchet 이다. 19(ADR-143)·20(backup ring)
    // 시점에 미갱신으로 stale 였고 21(2026-09-07 canonical 변경 노드 저장) 에서 다시 맞췄다.
    // 22(ADR-218 collection_runtime) 는 P1 커밋이 이 ratchet 을 못 올렸다 — 후속에서 정합.
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(__dirname, "../indexedDB/adapter.ts");
    const source = await fs.readFile(filePath, "utf-8");
    expect(source).toMatch(/const DB_VERSION\s*=\s*25\b/);
    expect(source).toMatch(/createObjectStore\(\s*["']collection_runtime["']/);
    expect(source).toMatch(/createObjectStore\(ASSETS_STORE/);
    expect(source).toMatch(/createObjectStore\(ASSET_GC_STORE/);
  });

  it("구 canonical 문서 store 를 만들지 않고 v24 DB 의 것은 지운다 (다른 store 는 보존)", async () => {
    const factory = new IDBFactory();
    (globalThis as { indexedDB?: IDBFactory }).indexedDB = factory;
    const OLD = [
      "documents",
      "document_heads",
      "document_parts",
      "documents_backup",
    ];
    await new Promise<void>((resolve, reject) => {
      const request = factory.open("composition", 24);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("projects", { keyPath: "id" });
        for (const name of OLD) db.createObjectStore(name);
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const tx = request.result.transaction("projects", "readwrite");
        tx.objectStore("projects").put({ id: "p1", name: "p1" });
        tx.oncomplete = () => {
          request.result.close();
          resolve();
        };
      };
    });
    const adapter = new IndexedDBAdapter();
    await adapter.init();
    expect(await adapter.projects.getById("p1")).toMatchObject({ id: "p1" });
    await adapter.close();
    const names = await new Promise<string[]>((resolve) => {
      const request = factory.open("composition");
      request.onsuccess = () => {
        resolve([...request.result.objectStoreNames]);
        request.result.close();
      };
    });
    for (const name of OLD) expect(names).not.toContain(name);
    expect(names).toContain("collections");
  });

  it("the adapter has no document API", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const adapterSource = await fs.readFile(
      path.resolve(__dirname, "../indexedDB/adapter.ts"),
      "utf-8",
    );
    const typesSource = await fs.readFile(
      path.resolve(__dirname, "../types.ts"),
      "utf-8",
    );
    expect(adapterSource).not.toMatch(/createObjectStore\(\s*["']documents/);
    expect(adapterSource).not.toMatch(/get documents\(\)/);
    expect(typesSource).not.toMatch(/documents\s*:\s*\{/);
  });

  it("runtime migration _meta store/API 와 getByLayout compatibility path 가 없다", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const adapterPath = path.resolve(__dirname, "../indexedDB/adapter.ts");
    const typesPath = path.resolve(__dirname, "../types.ts");
    const adapterSource = await fs.readFile(adapterPath, "utf-8");
    const typesSource = await fs.readFile(typesPath, "utf-8");
    const combined = `${adapterSource}\n${typesSource}`;

    expect(combined).not.toMatch(/createObjectStore\(\s*["']_meta["']/);
    expect(combined).not.toMatch(/\bMetaRecord\b/);
    expect(combined).not.toMatch(/\bmeta\s*[:=]\s*\{/);
    expect(combined).not.toMatch(/\bgetByLayout\b/);
  });

  it("legacy project-state/dormant store 를 생성하지 않고 deletion allowlist 로만 남긴다", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const adapterPath = path.resolve(__dirname, "../indexedDB/adapter.ts");
    const adapterSource = await fs.readFile(adapterPath, "utf-8");

    expect(adapterSource).not.toMatch(/createObjectStore\(\s*["']elements["']/);
    expect(adapterSource).not.toMatch(/createObjectStore\(\s*["']metadata["']/);
    expect(adapterSource).not.toMatch(/createObjectStore\(\s*["']history["']/);
    expect(adapterSource).not.toMatch(
      new RegExp(`createObjectStore\\(\\s*["']${"design_" + "variables"}["']`),
    );
    expect(adapterSource).toContain('"pages"');
    expect(adapterSource).toContain('"elements"');
    expect(adapterSource).toContain('"layouts"');
    expect(adapterSource).toContain('"metadata"');
    expect(adapterSource).toContain('"history"');
    expect(adapterSource).toContain('"design_" + "variables"');
    expect(adapterSource).toContain("db.deleteObjectStore(legacyStore)");
  });

  it("pages/layouts store 를 생성하지 않는다", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const adapterPath = path.resolve(__dirname, "../indexedDB/adapter.ts");
    const adapterSource = await fs.readFile(adapterPath, "utf-8");

    expect(adapterSource).not.toMatch(/createObjectStore\(\s*["']pages["']/);
    expect(adapterSource).not.toMatch(/createObjectStore\(\s*["']layouts["']/);
  });

  it("ADR-121 dormant DB adapter surface 를 제거한다", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const adapterPath = path.resolve(__dirname, "../indexedDB/adapter.ts");
    const typesPath = path.resolve(__dirname, "../types.ts");
    const adapterSource = await fs.readFile(adapterPath, "utf-8");
    const typesSource = await fs.readFile(typesPath, "utf-8");
    const combined = `${adapterSource}\n${typesSource}`;

    expect(combined).not.toContain("Sync" + "Metadata");
    expect(combined).not.toMatch(new RegExp(`\\bmetadata\\s*=\\s*\\{`));
    expect(combined).not.toMatch(new RegExp(`\\bmetadata\\s*:\\s*\\{`));
    expect(combined).not.toContain("History" + "Entry");
    expect(combined).not.toMatch(new RegExp(`\\bhistory\\s*=\\s*\\{`));
    expect(combined).not.toMatch(new RegExp(`\\bhistory\\s*:\\s*\\{`));
    expect(combined).not.toMatch(
      new RegExp(`\\b${"design" + "Variables"}\\s*=\\s*\\{`),
    );
    expect(combined).not.toMatch(
      new RegExp(`\\b${"design" + "Variables"}\\s*:\\s*\\{`),
    );
    expect(combined).not.toMatch(
      new RegExp(`\\bmetadata\\s*:\\s*${"Sync" + "Metadata"}\\b`),
    );
    expect(adapterSource).not.toMatch(/objectStore\(\s*["']metadata["']/);
    expect(adapterSource).not.toMatch(/objectStore\(\s*["']history["']/);
    expect(adapterSource).not.toMatch(
      new RegExp(`objectStore\\(\\s*["']${"design_" + "variables"}["']`),
    );
  });
});
