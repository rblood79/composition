import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ADR-244 R3 — 미리 받기 chunk 는 런타임 import 가 없다 (`import type` 만). 로더 (`initCanvasKit` ·
 * `wasm-bindings/*` · `fontManager`) · `canvaskit-wasm` · builder lazy chunk 를 import 하면, 그 chunk
 * 의 실패 (재배포 404 등) 가 문서 module map 에 남아 builder 부팅의 같은 chunk 까지 막는다. initial 모듈을
 * import 해도 번들러가 공유 chunk 로 쪼개 initial 이 늘어난다 — 필요한 값은 호출자가 넘긴다.
 */
describe("ADR-244 canvasWarmup chunk import boundary", () => {
  it("has type-only imports and no dynamic import", async () => {
    const source = await readFile(
      resolve(__dirname, "../canvasWarmup.ts"),
      "utf-8",
    );
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
    const imports = code.match(/^\s*import\b[^;]*;/gm) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const statement of imports)
      expect(statement).toMatch(/^\s*import\s+type\b/);
    expect(code).not.toMatch(/\bimport\s*\(/);
    expect(code).not.toMatch(/^\s*export\s+[^;]*\bfrom\b/m);
  });
});
