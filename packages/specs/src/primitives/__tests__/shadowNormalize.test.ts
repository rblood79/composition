import { describe, expect, it } from "vitest";

import { darkShadows, lightShadows } from "../shadows";
import {
  applyShadowInset,
  matchShadowPreset,
  normalizeShadowForTheme,
  shadowLiteralToCssVar,
  stripShadowInset,
} from "../shadowNormalize";

/**
 * ADR-166 후속 — 패널이 기록한 inline 리터럴의 theme 추종.
 *
 * 핵심 계약은 둘이다:
 *   1. **양방향 인식** — light 로 저장했든 dark 로 저장했든 같은 프리셋으로 수렴한다.
 *      한쪽만 인덱싱하면 반대 theme 에서 고른 값이 "임의 CSS" 로 취급돼 그대로 굳는다.
 *   2. **소비자 대칭** — Skia(theme 리터럴)와 DOM(CSS 변수)이 *같은 판정*에 대해서만 손댄다.
 *      한쪽만 정규화하면 캔버스와 Preview 가 서로 다른 그림자를 그린다.
 */
describe("matchShadowPreset — 리터럴 → 프리셋 역매핑", () => {
  it("light / dark 리터럴이 같은 키로 수렴한다", () => {
    for (const key of ["sm", "md", "lg"] as const) {
      expect(matchShadowPreset(lightShadows[key])).toEqual({
        key,
        insetApplied: false,
      });
      expect(matchShadowPreset(darkShadows[key])).toEqual({
        key,
        insetApplied: false,
      });
    }
  });

  it("inset 토글이 덧씌워진 값도 원 프리셋으로 되돌린다", () => {
    expect(matchShadowPreset(applyShadowInset(lightShadows.md))).toEqual({
      key: "md",
      insetApplied: true,
    });
    expect(matchShadowPreset(applyShadowInset(darkShadows.lg))).toEqual({
      key: "lg",
      insetApplied: true,
    });
  });

  it("`inset` 프리셋 자체는 정확 일치라 insetApplied 가 아니다", () => {
    // 값이 `inset ...` 으로 시작하지만 토글 결과가 아니라 프리셋 키다 — 정확 일치를 먼저
    //   보지 않으면 strip 경로로 흘러 매칭 실패한다.
    expect(matchShadowPreset(lightShadows.inset)).toEqual({
      key: "inset",
      insetApplied: false,
    });
  });

  it("프리셋이 아닌 임의 CSS 는 매칭되지 않는다", () => {
    expect(matchShadowPreset("0 1px 2px rgba(0, 0, 0, 0.5)")).toBeNull();
    expect(matchShadowPreset("")).toBeNull();
  });
});

describe("normalizeShadowForTheme — Skia 경로", () => {
  it("light 로 저장된 값이 dark 캔버스에서 dark 값이 된다", () => {
    for (const key of ["sm", "md", "lg"] as const) {
      expect(normalizeShadowForTheme(lightShadows[key], "dark")).toBe(
        darkShadows[key],
      );
      expect(normalizeShadowForTheme(darkShadows[key], "light")).toBe(
        lightShadows[key],
      );
    }
  });

  it("같은 theme 이면 값이 그대로다 (왕복 안정)", () => {
    expect(normalizeShadowForTheme(lightShadows.md, "light")).toBe(
      lightShadows.md,
    );
    expect(normalizeShadowForTheme(darkShadows.md, "dark")).toBe(
      darkShadows.md,
    );
  });

  it("적용 범위 밖(none / inset / inset 토글)은 원문 보존", () => {
    const insetToggled = applyShadowInset(lightShadows.md);
    expect(normalizeShadowForTheme("none", "dark")).toBe("none");
    expect(normalizeShadowForTheme(lightShadows.inset, "dark")).toBe(
      lightShadows.inset,
    );
    expect(normalizeShadowForTheme(insetToggled, "dark")).toBe(insetToggled);
  });

  it("사용자가 붙여넣은 임의 CSS 는 건드리지 않는다", () => {
    const custom = "0 1px 2px rgba(255, 0, 0, 0.5)";
    expect(normalizeShadowForTheme(custom, "dark")).toBe(custom);
  });
});

describe("shadowLiteralToCssVar — DOM 경로", () => {
  it("light / dark 리터럴 모두 같은 CSS 변수로 간다", () => {
    for (const key of ["sm", "md", "lg"] as const) {
      expect(shadowLiteralToCssVar(lightShadows[key])).toBe(
        `var(--shadow-${key})`,
      );
      expect(shadowLiteralToCssVar(darkShadows[key])).toBe(
        `var(--shadow-${key})`,
      );
    }
  });

  it("CSS 변수가 없는 키는 var 로 내지 않는다", () => {
    // `preview-system.css` 는 --shadow-{sm,md,lg} 만 발행한다. none/inset 을 var 로 내면
    //   미정의 변수라 선언이 통째로 무효가 된다.
    expect(shadowLiteralToCssVar("none")).toBe("none");
    expect(shadowLiteralToCssVar(lightShadows.inset)).toBe(lightShadows.inset);
  });

  it("두 소비자가 같은 값 집합에 대해서만 개입한다 (대칭)", () => {
    const samples = [
      lightShadows.sm,
      lightShadows.md,
      lightShadows.lg,
      darkShadows.sm,
      darkShadows.md,
      darkShadows.lg,
      lightShadows.inset,
      darkShadows.inset,
      "none",
      applyShadowInset(lightShadows.md),
      "0 1px 2px rgba(255, 0, 0, 0.5)",
    ];
    for (const value of samples) {
      // Skia 의 "인식" 은 양 theme 으로 봐야 한다 — dark 리터럴을 dark 로 정규화하면 결과가
      //   입력과 같아서, 한 theme 만 보면 인식했는데도 미개입으로 오판한다.
      const skiaRecognizes =
        normalizeShadowForTheme(value, "light") !== value ||
        normalizeShadowForTheme(value, "dark") !== value;
      const domRecognizes = shadowLiteralToCssVar(value) !== value;
      expect(
        domRecognizes,
        `대칭 위반: "${value}" — Skia=${skiaRecognizes} DOM=${domRecognizes}`,
      ).toBe(skiaRecognizes);
    }
  });
});

describe("inset 레이어 헬퍼", () => {
  it("3레이어 프리셋의 모든 레이어에 inset 이 붙고 벗겨진다", () => {
    const applied = applyShadowInset(lightShadows.md);
    expect(applied.split(/,(?![^(]*\))/)).toHaveLength(3);
    for (const layer of applied.split(/,(?![^(]*\))/)) {
      expect(layer.trim().startsWith("inset ")).toBe(true);
    }
    expect(stripShadowInset(applied)).toBe(lightShadows.md);
  });

  it("rgba(...) 내부 쉼표로 레이어를 쪼개지 않는다", () => {
    expect(stripShadowInset(lightShadows.lg)).toBe(lightShadows.lg);
  });
});
