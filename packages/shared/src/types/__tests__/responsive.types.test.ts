/**
 * ADR-154 Phase 1 — responsive 타입/유틸 + canonical schema BC 검증
 *
 * - cascade resolve: desktop-first fallback (명시값 우선 / tablet→desktop /
 *   mobile→tablet→desktop / 전부 부재 시 defaultValue)
 * - breakpoint 경계값: 767/768, 1279/1280 invariant
 * - generateMediaQueryString 출력 형식
 * - canonical schema BC (G4): `responsive` 없는 기존 문서 파싱 무영향 +
 *   `responsive` 보유 노드 catchall 보존
 */

import { describe, expect, it } from "vitest";
import {
  BREAKPOINTS,
  BREAKPOINT_ORDER,
  generateMediaQueryString,
  getResponsiveValueWithCascade,
  hasBreakpointValue,
  hasResponsiveValue,
} from "../responsive.types";
import { CanonicalNodeSchema } from "../../schemas/project.schema";

describe("ADR-154 breakpoint 정의", () => {
  it("경계값 invariant — tablet/desktop 767/768, 1279/1280 연속", () => {
    expect(BREAKPOINTS.mobile.maxWidth).toBe(767);
    expect(BREAKPOINTS.tablet.minWidth).toBe(768);
    expect(BREAKPOINTS.tablet.maxWidth).toBe(1279);
    expect(BREAKPOINTS.desktop.minWidth).toBe(1280);
    expect(BREAKPOINT_ORDER).toEqual(["desktop", "tablet", "mobile"]);
  });

  it("generateMediaQueryString — 3 breakpoint 형식", () => {
    expect(generateMediaQueryString(BREAKPOINTS.desktop)).toBe(
      "@media (min-width: 1280px)",
    );
    expect(generateMediaQueryString(BREAKPOINTS.tablet)).toBe(
      "@media (min-width: 768px) and (max-width: 1279px)",
    );
    expect(generateMediaQueryString(BREAKPOINTS.mobile)).toBe(
      "@media (max-width: 767px)",
    );
  });
});

describe("ADR-154 cascade resolve (desktop-first)", () => {
  it("명시값이 cascade 보다 우선한다", () => {
    const value = { desktop: "row", tablet: "column" } as const;
    expect(getResponsiveValueWithCascade(value, "tablet", "row")).toBe(
      "column",
    );
  });

  it("tablet 미지정 시 desktop 으로 폴백한다", () => {
    const value = { desktop: "row" } as const;
    expect(getResponsiveValueWithCascade(value, "tablet", "column")).toBe(
      "row",
    );
  });

  it("mobile 은 tablet → desktop 순서로 폴백한다", () => {
    expect(
      getResponsiveValueWithCascade(
        { desktop: "a", tablet: "b" },
        "mobile",
        "z",
      ),
    ).toBe("b");
    expect(getResponsiveValueWithCascade({ desktop: "a" }, "mobile", "z")).toBe(
      "a",
    );
  });

  it("전부 부재 시 defaultValue 를 반환한다", () => {
    expect(getResponsiveValueWithCascade(undefined, "mobile", "z")).toBe("z");
    expect(getResponsiveValueWithCascade({}, "tablet", "z")).toBe("z");
  });

  it("desktop 은 폴백 없이 defaultValue 로 간다 (base 는 props.style 소관)", () => {
    expect(getResponsiveValueWithCascade({ tablet: "b" }, "desktop", "z")).toBe(
      "z",
    );
  });

  it("hasResponsiveValue / hasBreakpointValue 판정", () => {
    expect(hasResponsiveValue(undefined)).toBe(false);
    expect(hasResponsiveValue({})).toBe(false);
    expect(hasResponsiveValue({ mobile: false })).toBe(true);
    expect(hasBreakpointValue({ mobile: false }, "mobile")).toBe(true);
    expect(hasBreakpointValue({ mobile: false }, "tablet")).toBe(false);
  });
});

describe("ADR-154 canonical schema BC (G4)", () => {
  it("responsive 없는 기존 노드 파싱 무영향", () => {
    const node = { id: "n1", type: "frame", children: [] };
    const result = CanonicalNodeSchema.safeParse(node);
    expect(result.success).toBe(true);
  });

  it("responsive 보유 노드는 catchall 로 무손실 보존", () => {
    const responsive = {
      visibility: { mobile: false },
      styles: { flexDirection: { tablet: "column" } },
    };
    const result = CanonicalNodeSchema.safeParse({
      id: "n2",
      type: "frame",
      responsive,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as { responsive?: unknown }).responsive).toEqual(
        responsive,
      );
    }
  });
});
