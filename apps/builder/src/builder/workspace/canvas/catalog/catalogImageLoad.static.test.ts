import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 2026-10-05 감사 H3 — 이미지 비동기 로드가 끝나면 Canvas 가 다시 그려야 한다.
 *
 * 노드 데이터는 bind 때 이미지 캐시를 읽고, 캐시 miss 면 placeholder (Avatar 회색 아이콘 ·
 * 이미지 fill 없음) 로 만든다. 레코드는 그대로라 로드 완료 콜백이 알려야 한다. 옛 SkiaCanvas 의
 * 등록이 ADR-248 Phase 4e-9-1 에서 함께 삭제돼 구독자가 0 이었다.
 *
 * ADR-270 Phase 1: 콜백은 URL 을 scene 에 넘기고 `sceneStale` 을 세운다 — 다음 `sync()` 가 그 URL 을
 * 조회한 요소만 다시 기록한다. 같은 프레임의 편집을 지우지 않는다 (옛 `sceneStale = false`).
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

  it("콜백은 URL 을 scene 에 넘기고 다음 프레임의 sync 를 세운다", async () => {
    const source = await canvasSource();
    const start = source.indexOf("registerImageLoadCallback(");
    const callback = source.slice(start, source.indexOf("});", start));
    expect(callback).toContain("scene.imageLoaded(url)");
    expect(callback).toContain("sceneStale = true");
    expect(callback).toContain("scheduler.invalidate()");
    const frame = source.slice(
      source.indexOf("const syncScene = () => {"),
      source.indexOf("const syncAutoColumns"),
    );
    expect(frame).not.toContain("scene.imageLoaded(");
    expect(frame).toMatch(/scene\.sync\(\{ holdImages: dragRecords !== undefined \}\)/);
  });
});
