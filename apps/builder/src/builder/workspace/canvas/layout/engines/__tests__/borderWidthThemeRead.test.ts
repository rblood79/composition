/**
 * ADR-227 Phase 3 — 레이아웃 size config 의 borderWidth 는 모듈 로드 시 고정되지 않고 읽을 때 활성 테마
 * (specs `borderWidth` 맵) 를 본다. 테마가 thin=3 으로 바꾼 뒤 Button/ToggleButton 의 box 산식이 3 을 써야
 * DOM (`border-width: var(--border-width-thin)`) 과 같은 border-box 가 된다.
 */
import { afterEach, describe, expect, it } from "vitest";
import { borderWidth, resolveToken } from "@composition/specs";
import { getButtonSizeConfig } from "../utils";

describe("size config borderWidth — 활성 테마 read-through (ADR-227 P3)", () => {
  const seedThin = borderWidth.thin;
  afterEach(() => {
    borderWidth.thin = seedThin;
  });

  it("seed: Button md borderWidth = {border.width.thin} = 1", () => {
    expect(resolveToken("{border.width.thin}")).toBe(1);
    expect(getButtonSizeConfig("button", "md")?.borderWidth).toBe(1);
    expect(getButtonSizeConfig("togglebutton", "md")?.borderWidth).toBe(1);
  });

  it("테마 설치가 맵을 thin=3 으로 덮으면 같은 config 가 3 을 준다 (eager 캡처면 RED)", () => {
    borderWidth.thin = 3;
    expect(getButtonSizeConfig("button", "md")?.borderWidth).toBe(3);
    expect(getButtonSizeConfig("togglebutton", "lg")?.borderWidth).toBe(3);
  });
});
