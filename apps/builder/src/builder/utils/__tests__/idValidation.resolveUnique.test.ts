import { describe, expect, it } from "vitest";
import { resolveUniqueCustomId } from "../idValidation";

// Properties ID 행 액션 (2026-09-16) — 중복이면 `base_N` 의 빈 번호, 고유하면 그대로.
describe("resolveUniqueCustomId", () => {
  const els = [
    { id: "a", customId: "button_1" },
    { id: "b", customId: "button_1" },
    { id: "c", customId: "button_2" },
    { id: "d", customId: "hero" },
  ];

  it("고유한 ID 는 그대로", () => {
    expect(resolveUniqueCustomId("button_2", "c", els)).toBe("button_2");
  });

  it("자기 자신은 중복으로 세지 않는다", () => {
    expect(resolveUniqueCustomId("hero", "d", els)).toBe("hero");
  });

  it("`base_N` 중복은 가장 작은 빈 번호로 (button_1 → button_3: 1·2 사용 중)", () => {
    expect(resolveUniqueCustomId("button_1", "b", els)).toBe("button_3");
  });

  it("번호 없는 중복은 `base_1` 부터", () => {
    expect(
      resolveUniqueCustomId("hero", "x", [...els, { id: "x", customId: "hero" }]),
    ).toBe("hero_1");
  });
});
