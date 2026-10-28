import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * ADR-242 HC3 — 부팅 뒤 idle 에 초기 화면 밖 lazy 패널 chunk 를 미리 받는다.
 *
 * ADR-248 삭제 3차 (`0b0eaea28`) 가 옛 `usePageManager` 와 함께 호출을 지워 `preloadOffscreenPanels`
 * 가 정의만 남았다 — lazy 패널이 첫 열림마다 Suspense 공개 지연 (~300 ms) 을 다시 겪었다.
 * Builder 진입점이 workspace 를 연 뒤 한 번 부르는지 본다.
 */
const CORE = resolve(__dirname, "../../main/CatalogBuilderCore.tsx");

describe("lazy 패널 idle 선로드 호출 (ADR-242 HC3)", () => {
  it("CatalogBuilderCore 가 preloadOffscreenPanels() 를 부른다", () => {
    const source = readFileSync(CORE, "utf8");
    expect(source).toMatch(
      /import\s*\{[^}]*\bpreloadOffscreenPanels\b[^}]*\}\s*from\s*"\.\.\/panels\/core\/panelConfigs"/,
    );
    expect(source).toMatch(/\bpreloadOffscreenPanels\(\);/);
  });
});
