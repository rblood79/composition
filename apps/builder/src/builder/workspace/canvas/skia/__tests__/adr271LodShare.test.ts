import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  countLodProjected,
  countLodText,
  renderCounters,
  resetRenderCounters,
} from "../renderCounters";

/**
 * ADR-271 Phase 0 — 축소 LOD 의 몫을 재는 dev 카운터. 구간 경계 (≤ 0.5 · ≤ 1 · ≤ 2 · ≤ 4 · 그 이상) 와
 * 배율 배선 (renderer 가 full 기록 직전에 `renderScope.zoom` 을 준다).
 */
describe("ADR-271 Phase 0 — 투영 크기 분포", () => {
  beforeEach(() => resetRenderCounters());

  it("요소 투영 크기: 경계는 아래 구간에 넣는다", () => {
    for (const px of [0, 0.5, 0.51, 1, 2, 2.01, 4, 4.5, 100])
      countLodProjected(px);
    expect([
      renderCounters.lodProjLe0_5,
      renderCounters.lodProjLe1,
      renderCounters.lodProjLe2,
      renderCounters.lodProjLe4,
      renderCounters.lodProjGt4,
    ]).toEqual([2, 2, 1, 2, 2]);
  });

  it("글자 투영 크기: 같은 구간 · 요소 카운터와 섞이지 않는다", () => {
    for (const px of [0.4, 1.6, 1.9, 3, 12]) countLodText(px);
    expect([
      renderCounters.lodTextLe0_5,
      renderCounters.lodTextLe1,
      renderCounters.lodTextLe2,
      renderCounters.lodTextLe4,
      renderCounters.lodTextGt4,
    ]).toEqual([1, 0, 2, 1, 1]);
    expect(renderCounters.lodProjGt4).toBe(0);
  });

  it("renderer 가 content full 기록 직전에 배율을 준다 · 재생 지점이 분포를 센다", () => {
    const read = (f: string) =>
      readFileSync(resolve(import.meta.dirname, "..", f), "utf8");
    const renderer = read("SkiaRenderer.ts");
    const set = renderer.indexOf("renderScope.zoom = camera.zoom");
    const draw = renderer.indexOf(
      "this.contentNode.renderSkia(targetCanvas, paddedBounds)",
    );
    expect(set).toBeGreaterThan(0);
    expect(set).toBeLessThan(draw);
    const commands = read("renderCommands.ts");
    expect(commands).toMatch(
      /countTouchedElement\(!picture\);\s+countLodShare\(/,
    );
  });
});
