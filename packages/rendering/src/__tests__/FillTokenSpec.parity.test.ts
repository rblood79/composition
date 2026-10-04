/**
 * ADR-908 Phase 4 — FillTokenSpec / FillStateTokens 구조 검증
 *
 * Phase 1 에서 작성된 "VariantSpec.background* ↔ FillTokenSpec" parity 테스트는
 * Phase 4 legacy 필드 삭제로 obsolete 됨. 현재 테스트는 FillTokenSpec 자체의
 * 구조 계약 (base required / 나머지 optional / fillStyle 2축 / runtime FillItem
 * raw shape 분리) 만 검증한다.
 */

import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  FillStateTokens,
  FillTokenSpec,
  TokenRef,
} from "@composition/rendering/types/spec.types";

describe("FillStateTokens — 구조 계약", () => {
  it("base 는 required TokenRef", () => {
    expectTypeOf<FillStateTokens["base"]>().toEqualTypeOf<TokenRef>();
  });

  it("hover / pressed / selected / selectedHover / selectedPressed / emphasizedSelected 는 optional", () => {
    expectTypeOf<FillStateTokens["hover"]>().toEqualTypeOf<
      TokenRef | undefined
    >();
    expectTypeOf<FillStateTokens["pressed"]>().toEqualTypeOf<
      TokenRef | undefined
    >();
    expectTypeOf<FillStateTokens["selected"]>().toEqualTypeOf<
      TokenRef | undefined
    >();
    expectTypeOf<FillStateTokens["selectedHover"]>().toEqualTypeOf<
      TokenRef | undefined
    >();
    expectTypeOf<FillStateTokens["selectedPressed"]>().toEqualTypeOf<
      TokenRef | undefined
    >();
    expectTypeOf<FillStateTokens["emphasizedSelected"]>().toEqualTypeOf<
      TokenRef | undefined
    >();
  });
});

describe("FillTokenSpec — 2축 구조 + runtime FillItem 분리", () => {
  it("default 는 required FillStateTokens, outline/subtle 은 Partial, alpha 는 optional number", () => {
    expectTypeOf<FillTokenSpec["default"]>().toEqualTypeOf<FillStateTokens>();
    expectTypeOf<FillTokenSpec["outline"]>().toEqualTypeOf<
      Partial<FillStateTokens> | undefined
    >();
    expectTypeOf<FillTokenSpec["subtle"]>().toEqualTypeOf<
      Partial<FillStateTokens> | undefined
    >();
    expectTypeOf<FillTokenSpec["alpha"]>().toEqualTypeOf<number | undefined>();
  });

  it("runtime FillItem raw shape 전용 필드 (id/opacity/blendMode/color/stops) 미포함", () => {
    type FillTokenSpecKeys = keyof FillTokenSpec;
    type ForbiddenKeys = "id" | "opacity" | "blendMode" | "color" | "stops";
    type HasForbidden = Extract<FillTokenSpecKeys, ForbiddenKeys>;
    expectTypeOf<HasForbidden>().toEqualTypeOf<never>();
  });

  it("minimal fixture — default.base 만으로 유효", () => {
    const minimal: FillTokenSpec = {
      default: { base: "{color.accent}" as TokenRef },
    };
    expect(minimal.default.base).toBeDefined();
    expect(minimal.outline).toBeUndefined();
    expect(minimal.subtle).toBeUndefined();
    expect(minimal.alpha).toBeUndefined();
  });

  it("exhaustive fixture — 모든 state + fillStyle + alpha 동시 선언 가능", () => {
    const full: FillTokenSpec = {
      default: {
        base: "{color.accent}" as TokenRef,
        hover: "{color.accent-hover}" as TokenRef,
        pressed: "{color.accent-pressed}" as TokenRef,
        selected: "{color.accent}" as TokenRef,
        selectedHover: "{color.accent-hover}" as TokenRef,
        selectedPressed: "{color.accent-pressed}" as TokenRef,
        emphasizedSelected: "{color.accent}" as TokenRef,
      },
      outline: { base: "{color.transparent}" as TokenRef },
      subtle: { base: "{color.neutral-subtle}" as TokenRef },
      alpha: 0.8,
    };
    expect(full.default.base).toBe("{color.accent}");
    expect(full.outline?.base).toBe("{color.transparent}");
    expect(full.subtle?.base).toBe("{color.neutral-subtle}");
    expect(full.alpha).toBe(0.8);
  });
});
