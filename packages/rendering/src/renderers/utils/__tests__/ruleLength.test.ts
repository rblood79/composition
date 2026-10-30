/**
 * ADR-295 Phase 3c-3 · 3c-3b — length refs (`{length.…}`): one term or several summed, the px in the
 * installed maps and the CSS over the device variables.
 */
import { describe, expect, it } from "vitest";
import type { TokenRef } from "../../../types/token.types";
import {
  DEVICE_TOUCH_REF,
  parseRuleLengthRef,
  parseRuleLengthTerms,
  ruleLengthCss,
  ruleLengthPx,
} from "../ruleLength";

const maps = (touch: 0 | 1) =>
  ({
    "{size.height.M}": touch ? 40 : 32,
    "{size.field-button.M}": touch ? 25 : 20,
    "{typography.text-sm}": touch ? 17 : 14,
    "{typography.text-sm--line-height}": touch ? 22 : 18,
    [DEVICE_TOUCH_REF]: touch,
  }) as Record<string, number>;
const resolve = (touch: 0 | 1) => (ref: TokenRef) => maps(touch)[ref];

describe("ADR-295 length refs", () => {
  it("one term — the existing grammar (± px) and CSS stay as they were", () => {
    expect(parseRuleLengthRef("{length.size.field-button.M*1/1+12}")).toEqual({
      base: "{size.field-button.M}",
      ratio: 1,
      ratioText: "1 / 1",
      add: 12,
    });
    expect(ruleLengthPx("{length.size.height.M*3/16-2}", resolve(0))).toBe(4);
    expect(ruleLengthCss("{length.size.height.M*3/8}")).toBe(
      "calc(var(--catalog-token-size-height-M) * 3 / 8)",
    );
    expect(ruleLengthCss("{length.typography.text-sm*6/14~8/17}")).toBe(
      "calc(var(--catalog-token-text-sm) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch)))",
    );
  });

  it("several terms — summed (a SearchField's text start: height / 2 + line + 6/14 em)", () => {
    const ref =
      "{length.size.height.M*1/2+typography.text-sm--line-height*1/1+typography.text-sm*6/14~8/17}";
    expect(parseRuleLengthTerms(ref)?.terms).toHaveLength(3);
    expect(parseRuleLengthRef(ref)).toBeUndefined();
    expect(ruleLengthPx(ref, resolve(0))).toBeCloseTo(16 + 18 + 6, 10);
    expect(ruleLengthPx(ref, resolve(1))).toBeCloseTo(20 + 22 + 8, 10);
    expect(ruleLengthCss(ref)).toBe(
      "calc(var(--catalog-token-size-height-M) * 1 / 2 + calc(var(--catalog-token-text-sm) * var(--catalog-token-text-sm--line-height)) * 1 / 1 + var(--catalog-token-text-sm) * (6 / 14 + (8 / 17 - 6 / 14) * var(--catalog-token-size-device-touch)))",
    );
  });

  it("a negative ratio subtracts and the px offset follows the last term", () => {
    const ref = "{length.size.field-button.M*-1/1+size.height.M*-3/16+1}";
    expect(ruleLengthPx(ref, resolve(0))).toBe(-20 - 6 + 1);
    expect(ruleLengthPx(ref, resolve(1))).toBe(-25 - 7.5 + 1);
    expect(ruleLengthCss(ref)).toBe(
      "calc(var(--catalog-token-size-field-button-M) * -1 / 1 + var(--catalog-token-size-height-M) * -3 / 16 + 1px)",
    );
    // (An offset in the middle is not a length ref.)
    expect(
      parseRuleLengthTerms("{length.size.height.M*1/2-1+size.height.M*1/1}"),
    ).toBeUndefined();
  });
});
