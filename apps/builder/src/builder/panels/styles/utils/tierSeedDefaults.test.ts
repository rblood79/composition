/**
 * ADR-236 후속 — tablet · mobile override 를 켜는 순간의 seed 는 그 요소의 **실제 기본값** 이어야 한다
 * (켜기 = 현재 값 복사, 시각 변화 0). catalog 가 기본값을 주는 타입에서 CSS 초기값 (row · stretch ·
 * 0 · flex) 을 넣으면 켜는 순간 모양이 바뀐다 (live: DisclosureGroup · Card · FileUpload 가 가로로,
 * Button padding 0).
 */
import { describe, expect, it } from "vitest";
import { resolveTierSeedDefaults } from "./tierSeedDefaults";

describe("resolveTierSeedDefaults — catalog 기본값", () => {
  it("catalog base 가 column 인 타입은 flexDirection column", () => {
    for (const type of ["DisclosureGroup", "Card", "FileUpload"]) {
      expect(resolveTierSeedDefaults(type, "md").flexDirection).toBe("column");
    }
  });

  it("Button 은 catalog padding · display 를 준다 (0 · flex 가 아니다)", () => {
    const seed = resolveTierSeedDefaults("Button", "md");
    expect(seed.display).toBe("inline-flex");
    expect(Number.parseFloat(seed.paddingTop ?? "0")).toBeGreaterThan(0);
    expect(Number.parseFloat(seed.paddingLeft ?? "0")).toBeGreaterThan(0);
  });

  it("catalog 에 display 가 없으면 Canvas 기본 display (block)", () => {
    expect(resolveTierSeedDefaults("Text", undefined).display).toBe("block");
  });

  it("frame 은 catalog 방향이 없다 — 액션이 인라인 · CSS 초기값으로 간다", () => {
    expect(resolveTierSeedDefaults("frame", undefined).flexDirection).toBe(
      undefined,
    );
  });
});
