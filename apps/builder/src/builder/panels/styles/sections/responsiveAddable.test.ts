import { describe, expect, it } from "vitest";
import { addableOverrideKeys } from "./ResponsiveSection";

describe("Responsive 「+」 메뉴 — 추가할 수 있는 override", () => {
  it("라벨 위치 · orientation 으로 방향이 정해지는 요소에는 Direction 이 없다", () => {
    // 방향 정본은 tier 축이 없는 prop — tier flexDirection 을 켜면 기본값 row 가 seed 돼 켜는 순간
    //   라벨이 옆으로 가고, 이후 Direction 토글은 전역 prop 을 바꿔 그 tier 에 반영되지 않는다.
    expect(addableOverrideKeys(new Set(), true)).not.toContain("flexDirection");
    expect(addableOverrideKeys(new Set(), true)).toContain("display");
  });

  it("그 밖 요소는 Direction 을 그대로 제공하고, 이미 켠 속성은 뺀다", () => {
    expect(addableOverrideKeys(new Set(), false)).toContain("flexDirection");
    expect(addableOverrideKeys(new Set(["paddingTop"]), false)).not.toContain(
      "padding",
    );
  });
});
