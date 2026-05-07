import { describe, it, expect } from "vitest";

describe("ADR-116 direct cutover: IndexedDB canonical document storage", () => {
  it("DB_VERSION 이 11 로 갱신된다 (Element order_num index cleanup)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(__dirname, "../indexedDB/adapter.ts");
    const source = await fs.readFile(filePath, "utf-8");
    expect(source).toMatch(/const DB_VERSION\s*=\s*11\b/);
  });

  it("documents primary store 와 메서드 그룹이 추가된다", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const adapterPath = path.resolve(__dirname, "../indexedDB/adapter.ts");
    const typesPath = path.resolve(__dirname, "../types.ts");
    const adapterSource = await fs.readFile(adapterPath, "utf-8");
    const typesSource = await fs.readFile(typesPath, "utf-8");

    expect(adapterSource).toMatch(/createObjectStore\(\s*["']documents["']/);
    expect(adapterSource).toMatch(/documents\s*=\s*\{[\s\S]*?put\s*:/);
    expect(adapterSource).toMatch(/documents\s*=\s*\{[\s\S]*?get\s*:/);
    expect(typesSource).toMatch(/interface\s+CanonicalDocumentRecord\b/);
    expect(typesSource).toMatch(/documents\s*:\s*\{/);
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

  it("elements store 에 order_num index 를 생성하지 않고 upgrade 에서 제거한다", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const adapterPath = path.resolve(__dirname, "../indexedDB/adapter.ts");
    const adapterSource = await fs.readFile(adapterPath, "utf-8");

    const elementsStoreBlock =
      adapterSource.match(
        /if \(!db\.objectStoreNames\.contains\("elements"\)\) \{[\s\S]*?console\.log\("\[IndexedDB\] Created store: elements"\);[\s\S]*?\n\s*\}/,
      )?.[0] ?? "";

    expect(elementsStoreBlock).not.toContain('createIndex("order_num"');
    expect(adapterSource).toContain('deleteIndex("order_num")');
  });
});
