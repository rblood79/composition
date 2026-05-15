import { describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(fullPath)));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    files.push(fullPath);
  }

  return files;
}

function hasRenderToSceneFallback(source: string): boolean {
  return /renderNodesMap\.get\([^)]*\)[\s\S]{0,240}\?\?[\s\S]{0,240}sceneNodesMap\.get\(/.test(
    source,
  );
}

describe("Skia projection SSOT contract", () => {
  it("detects single-line and multiline render-to-scene fallback patterns", () => {
    expect(
      hasRenderToSceneFallback(
        "const body = input.renderNodesMap.get(bodyId) ?? input.sceneNodesMap.get(bodyId);",
      ),
    ).toBe(true);
    expect(
      hasRenderToSceneFallback(`
        const body =
          rendererInput.renderNodesMap.get(bodyId) ??
          rendererInput.sceneNodesMap.get(bodyId);
      `),
    ).toBe(true);
    expect(
      hasRenderToSceneFallback(
        "const body = input.renderNodesMap.get(bodyId);",
      ),
    ).toBe(false);
  });

  it("does not fallback from renderNodesMap to sceneNodesMap in downstream render/skia utilities", async () => {
    const sourceDirs = [resolve(__dirname), resolve(__dirname, "../renderers")];
    const files = (
      await Promise.all(sourceDirs.map((dir) => collectSourceFiles(dir)))
    ).flat();
    const offenders: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf-8");
      if (hasRenderToSceneFallback(source)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
