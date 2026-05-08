import { describe, it, expect } from "vitest";
import { stripLegacyOrderPayload } from "../indexedDB/adapter";

describe("ADR-116 direct cutover: IndexedDB canonical document storage", () => {
  it("DB_VERSION 이 13 으로 갱신된다 (page/layout order_num value cleanup)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(__dirname, "../indexedDB/adapter.ts");
    const source = await fs.readFile(filePath, "utf-8");
    expect(source).toMatch(/const DB_VERSION\s*=\s*13\b/);
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

  it("pages/layouts store 에 order_num index 를 생성하지 않고 upgrade 에서 제거한다", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const adapterPath = path.resolve(__dirname, "../indexedDB/adapter.ts");
    const adapterSource = await fs.readFile(adapterPath, "utf-8");

    const pagesStoreBlock =
      adapterSource.match(
        /if \(!db\.objectStoreNames\.contains\("pages"\)\) \{[\s\S]*?console\.log\("\[IndexedDB\] Created store: pages"\);[\s\S]*?\n\s*\}/,
      )?.[0] ?? "";
    const layoutsStoreBlock =
      adapterSource.match(
        /if \(!db\.objectStoreNames\.contains\("layouts"\)\) \{[\s\S]*?console\.log\([\s\S]*?\);[\s\S]*?\n\s*\}/,
      )?.[0] ?? "";

    expect(pagesStoreBlock).not.toContain('createIndex("order_num"');
    expect(layoutsStoreBlock).not.toContain('createIndex("order_num"');
    expect(adapterSource).toContain('pagesStore.deleteIndex("order_num")');
    expect(adapterSource).toContain('layoutsStore.deleteIndex("order_num")');
    expect(adapterSource).toContain("stripLegacyOrderPayloads(");
  });

  it("legacy page/layout row 와 canonical metadata 의 order_num payload 를 제거한다", () => {
    const pageRow = {
      id: "page-1",
      project_id: "project-1",
      order_num: 3,
      title: "Home",
    };
    const layoutRow = {
      id: "layout-1",
      project_id: "project-1",
      orderNum: 1,
      name: "Frame 1",
    };
    const documentRecord = {
      project_id: "project-1",
      document: {
        version: "composition-1.0",
        children: [
          {
            id: "page-1",
            type: "frame",
            metadata: {
              type: "legacy-page",
              pageId: "page-1",
              order_num: 0,
            },
            children: [
              {
                id: "button-1",
                type: "button",
                metadata: {
                  type: "button",
                  orderNum: 4,
                },
              },
            ],
          },
          {
            id: "layout-1",
            type: "frame",
            reusable: true,
            metadata: {
              type: "layout",
              layoutId: "layout-1",
              order_num: 1,
            },
          },
        ],
      },
      updated_at: "2026-05-08T00:00:00.000Z",
    };

    expect(stripLegacyOrderPayload(pageRow)).toBe(true);
    expect(stripLegacyOrderPayload(layoutRow)).toBe(true);
    expect(stripLegacyOrderPayload(documentRecord)).toBe(true);

    expect(pageRow).not.toHaveProperty("order_num");
    expect(layoutRow).not.toHaveProperty("orderNum");
    expect(documentRecord.document.children[0].metadata).toEqual({
      type: "legacy-page",
      pageId: "page-1",
    });
    expect(documentRecord.document.children[0].children?.[0]?.metadata).toEqual(
      {
        type: "button",
      },
    );
    expect(documentRecord.document.children[1].metadata).toEqual({
      type: "layout",
      layoutId: "layout-1",
    });
  });
});
