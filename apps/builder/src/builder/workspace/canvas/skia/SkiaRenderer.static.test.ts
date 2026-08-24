import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

async function rendererSource(): Promise<string> {
  return readFile(resolve(__dirname, "SkiaRenderer.ts"), "utf8");
}

describe("ADR-189 sparse damage rendering guards", () => {
  it("damage path는 이전 snapshot 전면 blit이나 full command replay를 하지 않는다", async () => {
    const source = await rendererSource();
    const start = source.indexOf("private renderDamagedContent(");
    const end = source.indexOf("private renderContent(", start);
    const damagePath = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(damagePath).toContain("renderDamage.call(");
    expect(damagePath).toContain("syncStandbyFromContentSnapshot({");
    expect(damagePath).not.toContain("targetCanvas.clear(");
    expect(damagePath).not.toContain("targetCanvas.drawImage(oldSnapshot");
    expect(damagePath).not.toContain("this.contentNode.renderSkia(");
  });

  it("첫 damage 전에 region clear/blit 경로를 full sync에서 예열한다", async () => {
    const source = await rendererSource();
    const start = source.indexOf("private syncStandbyFromContentSnapshot(");
    const end = source.indexOf("private canRenderDamage(", start);
    const syncPath = source.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(syncPath).toContain("this.ck.LTRBRect(0, 0, 1, 1)");
    expect(syncPath).toContain("this.ck.BlendMode.Clear");
    expect(syncPath).toContain("canvas.drawImage(snapshot, 0, 0)");
  });
});
