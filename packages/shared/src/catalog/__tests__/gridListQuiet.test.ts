import { describe, expect, it } from "vitest";

import { COMPONENT_RULES_TABLE } from "../generated/componentRulesTable";
import { gridListBinding } from "../bindings/GridList.binding";

/**
 * design-data 감사 §1-2 축② 잔여 — 컬렉션 quiet (GridList, 2026-08-22).
 *
 * 감사는 "quiet 이 Table·GridList 부재" 로 적었지만 **GridList 컨테이너에는 걸 곳이 없다** —
 * catalog default variant 도 수동 CSS 도 이미 `transparent` / `border: none` 이라, 거기에 quiet
 * 을 두면 시각 변화가 0 인 dead prop 이 된다. 실제 chrome(배경 layer-1 + 1px border + radius)은
 * **카드**가 들고 있으므로 채널은 `GridListItem.variants.quiet` 이고, owner 의 `isQuiet` 은 그
 * variant 를 고르는 표면이다.
 *
 * fill preset(`FillTokenSpec.quiet`)이 아니라 variant 인 이유: quiet 이 배경과 **테두리를 함께**
 * 지워야 하는데 fill preset 은 배경만 다룬다 (ToggleButton 은 border 가 이미 transparent 라
 * fill 만으로 충분했다). variant 는 fill+colors 를 한 벌로 갖고, 생성 CSS
 * `[data-variant="quiet"]` 와 Skia 의 variant 해석이 추가 배선 없이 그대로 작동한다.
 *
 * 여기서는 **채널 정의**(catalog rule + owner 표면)만 본다. rule → Skia shape 로 실제
 * 이어지는지는 builder 쪽 `resolveSkiaVisualRule` 이 정본 경로라 그쪽 테스트가 맡는다
 * (specs 는 shared 를 import 할 수 없고, resolveSkiaVisualRule 은 builder 소속이다).
 */

describe("GridList quiet — 채널은 컨테이너가 아니라 카드", () => {
  it("owner 표면은 boolean, 시각 정의는 카드 variant", () => {
    expect(gridListBinding.props.accepts.isQuiet).toMatchObject({
      kind: "boolean",
    });
    // 컨테이너 variant enum 에 quiet 을 섞지 않는다 — hover/선택 tint 와 직교한 축이다.
    expect(COMPONENT_RULES_TABLE.GridList.variants.quiet).toBeUndefined();

    const quiet = COMPONENT_RULES_TABLE.GridListItem.variants.quiet;
    expect(quiet).toBeDefined();
    expect(quiet!.fill?.default.base).toBe("{color.transparent}");
    expect(quiet!.colors?.border).toBe("{color.transparent}");
    // 쉬는 상태만 비우고 hover/pressed 는 배경이 돌아온다 (Spectrum quiet 정의).
    expect(quiet!.fill?.default.hover).toBe("{color.neutral-subtle}");
    // 선택 표시는 남긴다 — 지우면 어떤 카드가 선택됐는지 알 수 없다.
    expect(quiet!.colors?.selectedBorder).toBe("{color.accent}");
  });

});
