import { describe, expect, it } from "vitest";

import { resolveSpecPreset } from "../specPresetResolver";

/**
 * **Slot 은 고유 높이가 없다** — Transform Height 가 catalog 값을 슬롯의 높이로 표시하면 안 된다.
 *
 * Why (2026-07-27 라이브 실측): `sidebar-left` 프리셋의 sidebar 슬롯은 실제 레이아웃 박스가
 * `200 × 1024` 인데 Style 패널 Height 필드는 **60** 을 보여줬다. inline height 가 없을 때
 * 패널이 catalog `sizes[size].height` 로 fallback 하는데, Slot entry 가 40/60/80 을 들고
 * 있었기 때문이다. 그 값은 렌더·레이아웃 소비자가 0건이라 화면에는 영향이 없었고 — 그래서
 * **패널만 거짓말하는** 비대칭이었다.
 *
 * 같은 composition-native 레이아웃 컨테이너인 `body`/`frame` 은 이미 `height: 0`(고유 높이
 * 없음) 표기라, Slot 을 거기 맞춘다. 빈 슬롯의 가시 하한은 프리셋 `minHeight` 소관.
 */
describe("레이아웃 컨테이너의 intrinsic height", () => {
  it.each(["Slot", "body", "frame"])(
    "%s 는 Transform specDefault 로 height 를 공급하지 않는다",
    (type) => {
      expect(resolveSpecPreset(type, undefined).height).toBeUndefined();
    },
  );

  it("Slot 은 size 를 바꿔도 height 를 공급하지 않는다", () => {
    for (const size of ["sm", "md", "lg"]) {
      expect(resolveSpecPreset("Slot", size).height).toBeUndefined();
    }
  });

  it("고유 높이가 있는 컴포넌트는 종전대로 공급한다 (과잉 차단 방지)", () => {
    // 이 단언이 없으면 "전부 undefined" 로 망가뜨려도 위 테스트가 통과한다.
    //   Avatar/Tag 는 자기 박스 높이를 catalog 가 정하는 leaf — 실측으로 고른 대조군이다.
    expect(resolveSpecPreset("Avatar", "md").height).toBe(32);
    expect(resolveSpecPreset("Tag", "md").height).toBe(28);
  });
});
