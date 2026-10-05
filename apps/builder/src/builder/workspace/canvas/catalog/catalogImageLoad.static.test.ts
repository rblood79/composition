import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 2026-10-05 감사 H3 — 이미지 비동기 로드가 끝나면 Canvas 가 다시 그려야 한다.
 *
 * 노드 데이터는 bind 때 이미지 캐시를 읽고, 캐시 miss 면 placeholder (Avatar 회색 아이콘 ·
 * 이미지 fill 없음) 로 만든다. 레코드는 그대로라 `scene.sync()` 가 다시 만들지 않으므로,
 * 로드 완료 콜백이 scene 을 다시 bind 해야 한다. 옛 SkiaCanvas 의 등록이 ADR-248
 * Phase 4e-9-1 에서 함께 삭제돼 구독자가 0 이었다.
 */
async function canvasSource(): Promise<string> {
  return readFile(resolve(__dirname, "CatalogCanvas.tsx"), "utf8");
}

describe("CatalogCanvas — 이미지 로드 완료 구독", () => {
  it("로드 완료 콜백을 등록하고 effect 정리 때 해제한다", async () => {
    const source = await canvasSource();
    expect(source).toMatch(
      /const unsubscribeImages = registerImageLoadCallback\(/,
    );
    expect(source).toContain("unsubscribeImages();");
  });

  it("콜백은 다음 프레임에 scene 을 다시 bind 하고 content 를 무효화한다", async () => {
    const source = await canvasSource();
    const start = source.indexOf("registerImageLoadCallback(");
    const callback = source.slice(start, source.indexOf("});", start));
    expect(callback).toContain("imagesStale = true");
    expect(callback).toContain("scheduler.invalidate()");
    const frame = source.slice(source.indexOf("const syncScene = () => {"));
    expect(frame).toMatch(
      /if \(imagesStale\) \{[\s\S]*?scene\.imageLoaded\(\)/,
    );
  });
});
