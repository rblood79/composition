/**
 * ADR-168 Phase 2 — 프리셋 반응형 전치 + 교체 멱등 계약.
 *
 * 프리셋 정의는 작성 편의상 **BP → 스타일** 로 쓰고(`{ tablet: { width: 200 } }`),
 * 저장 형식은 **키 → BP** (`{ width: { tablet: 200 } }`) 다. 두 형태를 오가는 전치가
 * 어긋나면 override 가 통째로 유실되거나 엉뚱한 BP 에 실린다.
 *
 * R1(HIGH — 교체 비멱등): 프리셋을 A→B 로 바꿀 때 A 가 심은 responsive override 가 남으면
 * B 위에 A 의 트랙이 겹친다. base 정리(`stripPresetContainerStyle`)와 **같은 상수에서 파생된**
 * 키 집합으로 responsive 도 정리해야 하며, 두 대상이 갈리는 순간 한쪽만 남는 잔존이 재발한다.
 */
import { describe, expect, it } from "vitest";
import type { ElementResponsiveConfig } from "@composition/shared";
import { isResponsiveEligibleStyleProp } from "@composition/shared";

import { mergePresetResponsive, toResponsiveConfig } from "./presetResponsive";
import { PRESET_RESPONSIVE_OWNED_KEYS } from "./presetStyle";

describe("toResponsiveConfig — BP→스타일 을 키→BP 로 전치", () => {
  it("두 BP 의 같은 키가 하나의 ResponsiveValue 로 합쳐진다", () => {
    expect(
      toResponsiveConfig({
        tablet: { width: 200 },
        mobile: { width: "100%" },
      }),
    ).toEqual({ styles: { width: { tablet: 200, mobile: "100%" } } });
  });

  it("BP 마다 다른 키를 써도 각자 자기 BP 에만 실린다", () => {
    expect(
      toResponsiveConfig({
        tablet: { gridTemplateColumns: "160px 1fr 160px" },
        mobile: { display: "flex", flexDirection: "column" },
      }),
    ).toEqual({
      styles: {
        gridTemplateColumns: { tablet: "160px 1fr 160px" },
        display: { mobile: "flex" },
        flexDirection: { mobile: "column" },
      },
    });
  });

  it("빈 입력·빈 결과는 undefined — canonical 이 빈 config 를 생략 취급하므로 동형", () => {
    expect(toResponsiveConfig(undefined)).toBeUndefined();
    expect(toResponsiveConfig({})).toBeUndefined();
    expect(toResponsiveConfig({ tablet: {} })).toBeUndefined();
  });

  it("undefined 값은 실리지 않는다 (선언 안 함과 동일)", () => {
    expect(
      toResponsiveConfig({ tablet: { width: undefined, height: 40 } }),
    ).toEqual({ styles: { height: { tablet: 40 } } });
  });
});

describe("PRESET_RESPONSIVE_OWNED_KEYS — R1 단일 파생", () => {
  it("base 컨테이너 키와 프리셋 authoring 키를 모두 포함한다", () => {
    // base 만 정리하고 responsive 를 놓치면 교체가 비멱등이 된다.
    for (const key of ["display", "flexDirection"]) {
      expect(PRESET_RESPONSIVE_OWNED_KEYS.has(key), key).toBe(true);
    }
    for (const key of [
      "gridTemplateColumns",
      "gridTemplateRows",
      "gridTemplateAreas",
      "gridColumnStart",
      "gridColumnEnd",
      "gridRowStart",
      "gridRowEnd",
    ]) {
      expect(PRESET_RESPONSIVE_OWNED_KEYS.has(key), key).toBe(true);
    }
  });

  it("정리 대상은 전부 responsive-eligible — 아니면 애초에 저장될 수 없다", () => {
    for (const key of PRESET_RESPONSIVE_OWNED_KEYS) {
      expect(isResponsiveEligibleStyleProp(key), key).toBe(true);
    }
  });
});

describe("mergePresetResponsive — 교체 멱등 (R1)", () => {
  const presetA: ElementResponsiveConfig = {
    styles: {
      gridTemplateColumns: { tablet: "160px 1fr 160px" },
      display: { mobile: "flex" },
    },
  };
  const presetB: ElementResponsiveConfig = {
    styles: { gridTemplateColumns: { tablet: "200px 1fr" } },
  };

  it("A→B 교체 시 A 의 프리셋 소유 키가 남지 않는다", () => {
    const afterA = mergePresetResponsive(undefined, presetA);
    const afterB = mergePresetResponsive(afterA, presetB);
    expect(afterB).toEqual(presetB);
  });

  it("A→B→A 왕복이 A 최초 적용과 정확히 동일 (HC3)", () => {
    const first = mergePresetResponsive(undefined, presetA);
    const roundTrip = mergePresetResponsive(
      mergePresetResponsive(first, presetB),
      presetA,
    );
    expect(roundTrip).toEqual(first);
  });

  it("사용자가 직접 준 override 는 보존한다", () => {
    const withUserEdit: ElementResponsiveConfig = {
      styles: {
        gridTemplateColumns: { tablet: "160px 1fr 160px" },
        paddingTop: { mobile: 8 },
      },
      visibility: { mobile: false },
    };
    const next = mergePresetResponsive(withUserEdit, presetB);
    expect(next?.styles).toEqual({
      gridTemplateColumns: { tablet: "200px 1fr" },
      paddingTop: { mobile: 8 },
    });
    // visibility 는 프리셋 소관이 아니다 — 건드리지 않는다
    expect(next?.visibility).toEqual({ mobile: false });
  });

  it("반응형 없는 프리셋으로 교체하면 이전 프리셋 키만 사라진다", () => {
    const next = mergePresetResponsive(presetA, undefined);
    expect(next).toBeUndefined();
  });

  it("사용자 override 만 남으면 그것만 유지한다", () => {
    const mixed: ElementResponsiveConfig = {
      styles: {
        gridTemplateRows: { tablet: "auto 1fr" },
        marginTop: { tablet: 12 },
      },
    };
    expect(mergePresetResponsive(mixed, undefined)).toEqual({
      styles: { marginTop: { tablet: 12 } },
    });
  });
});
