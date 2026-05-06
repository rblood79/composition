import { describe, it, expect } from "vitest";

describe("ADR-116 direct cutover: getByLayout legacy DB path removed", () => {
  it("IndexedDB adapter 에 getByLayout 과 layout_id index 생성이 없다", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(__dirname, "../indexedDB/adapter.ts");
    const source = await fs.readFile(filePath, "utf-8");

    expect(source).not.toMatch(/\bgetByLayout\s*:/);
    expect(source).not.toMatch(/createIndex\(\s*["']layout_id["']/);
    expect(source).not.toMatch(/indexNames\.contains\(\s*["']layout_id["']/);
  });

  it("DatabaseAdapter 타입에도 getByLayout surface 가 없다", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(__dirname, "../types.ts");
    const source = await fs.readFile(filePath, "utf-8");

    expect(source).not.toMatch(/\bgetByLayout\s*\(/);
    expect(source).not.toMatch(/\bgetByLayout\s*:/);
  });

  it("urlGenerator.ts 에 page.layout_id 직접 참조가 더 이상 존재하지 않는다 (E-6 후)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(__dirname, "../../../utils/urlGenerator.ts");
    const source = await fs.readFile(filePath, "utf-8");
    expect(source).not.toMatch(/page\.layout_id/);
  });

  it("elementUtils.ts 에 el.layout_id 직접 참조가 더 이상 존재하지 않는다 (E-6 후)", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const filePath = path.resolve(
      __dirname,
      "../../../utils/element/elementUtils.ts",
    );
    const source = await fs.readFile(filePath, "utf-8");
    expect(source).not.toMatch(/el\.layout_id/);
  });
});
