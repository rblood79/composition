import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * page-shell bridge 손실 차단 계약 (2026-07-14, Task #8 요소 소실 사건)
 *
 * bridge 는 페이지 topology 변화 시 canonical document 를 재구성한다.
 * 과거 raw `state.elements` 전체 교체는 legacy store 부분 상태 (store-level
 * unload / HMR 분리 인스턴스 / 부분 hydrate) 를 canonical 에 투영해 자동
 * persist 로 영구 손실을 확정시키는 경로였다.
 */
describe("page-shell bridge — canonical-first 재구성 계약", () => {
  async function readBuilderCoreSource(): Promise<string> {
    return readFile(resolve(__dirname, "../BuilderCore.tsx"), "utf-8");
  }

  it("bridge 입력은 canonical-first 병합 — raw state.elements 전체 교체 금지", async () => {
    const source = await readBuilderCoreSource();

    const match = source.match(
      /function getPageShellBridgeElements\([\s\S]*?(?=function hasPageShellTopologyChanged)/,
    );
    expect(match).not.toBeNull();
    const block = match![0];

    expect(block).toContain("getCanonicalOrBootstrapBuilderElements");
    // 과거 패턴: const { elements = [] } = state; return elements;
    expect(block).not.toMatch(/return elements;/);
  });

  it("pages 빈 과도 상태에서는 bridge 재구성을 skip 한다", async () => {
    const source = await readBuilderCoreSource();
    expect(source).toMatch(
      /state\.pages\.length === 0\) return;\s*\n\s*setElementsCanonicalPrimary/,
    );
  });
});
